from datetime import date

from django.db.models import Count, F
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.employees.models import Department
from apps.leaves.models import LeaveBalance, LeaveRequest
from apps.leaves.serializers import LeaveBalanceSerializer, LeaveRequestSerializer
from apps.leaves.services import ensure_balances

Status = LeaveRequest.Status


def _status_counts(queryset) -> dict:
    counts = {value: 0 for value in Status.values}
    for row in queryset.order_by().values("status").annotate(total=Count("id")):
        counts[row["status"]] = row["total"]
    return counts


def _last_months(count: int, today: date) -> list[date]:
    months, year, month = [], today.year, today.month
    for _ in range(count):
        months.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(months))


def _monthly_trend(queryset, today: date, count: int = 6) -> list[dict]:
    """Number of (non-cancelled, non-rejected) requests starting in each of the last N months."""
    months = _last_months(count, today)
    rows = (
        queryset.filter(start_date__gte=months[0])
        .exclude(status__in=[Status.CANCELLED, Status.REJECTED])
        .annotate(month=TruncMonth("start_date"))
        .order_by()
        .values("month")
        .annotate(total=Count("id"))
    )
    totals = {(row["month"].year, row["month"].month): row["total"] for row in rows}
    return [
        {"month": m.strftime("%Y-%m"), "count": totals.get((m.year, m.month), 0)} for m in months
    ]


def _admin_stats(request, today: date) -> dict:
    requests = LeaveRequest.objects.all()
    on_leave = requests.filter(
        status=Status.APPROVED, start_date__lte=today, end_date__gte=today
    ).aggregate(total=Count("employee", distinct=True))["total"]
    by_type = list(
        requests.exclude(status=Status.CANCELLED)
        .order_by()
        .values(name=F("leave_type__name"))
        .annotate(count=Count("id"))
        .order_by("-count", "name")
    )
    recent_pending = requests.filter(status=Status.PENDING).select_related(
        "employee", "leave_type", "reviewed_by"
    )[:5]
    return {
        "role": User.Role.ADMIN,
        "totals": {
            "employees": User.objects.filter(role=User.Role.EMPLOYEE, is_active=True).count(),
            "departments": Department.objects.count(),
            "pending_requests": requests.filter(status=Status.PENDING).count(),
            "on_leave_today": on_leave,
        },
        "requests_by_status": _status_counts(requests),
        "requests_by_type": by_type,
        "monthly_trend": _monthly_trend(requests, today),
        "recent_pending": LeaveRequestSerializer(
            recent_pending, many=True, context={"request": request}
        ).data,
    }


def _employee_stats(request, today: date) -> dict:
    user = request.user
    ensure_balances(user.id, today.year)
    requests = LeaveRequest.objects.filter(employee=user)
    balances = LeaveBalance.objects.filter(user=user, year=today.year).select_related(
        "user", "leave_type"
    )
    upcoming = requests.filter(status=Status.APPROVED, end_date__gte=today).select_related(
        "employee", "leave_type", "reviewed_by"
    ).order_by("start_date")[:5]
    return {
        "role": User.Role.EMPLOYEE,
        "balances": LeaveBalanceSerializer(balances, many=True).data,
        "requests_by_status": _status_counts(requests),
        "monthly_trend": _monthly_trend(requests, today),
        "upcoming_leaves": LeaveRequestSerializer(
            upcoming, many=True, context={"request": request}
        ).data,
    }


class DashboardView(APIView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        today = timezone.localdate()
        if request.user.is_admin_role:
            return Response(_admin_stats(request, today))
        return Response(_employee_stats(request, today))