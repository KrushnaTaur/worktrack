from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from .models import LeaveBalance, LeaveRequest, LeaveType

Status = LeaveRequest.Status


class InvalidTransition(APIException):
    status_code = 409
    default_detail = "This action is not allowed for the request's current status."
    default_code = "invalid_transition"


class InsufficientBalance(APIException):
    status_code = 400
    default_detail = "Insufficient leave balance."
    default_code = "insufficient_balance"


def count_working_days(start, end) -> int:
    """Mon-Fri days between start and end, inclusive. (No public-holiday calendar.)"""
    return sum(
        1
        for offset in range((end - start).days + 1)
        if (start + timedelta(days=offset)).weekday() < 5
    )


def ensure_balances(user_id: int, year: int) -> None:
    """Create any missing balance rows for the year from each leave type's default."""
    existing = LeaveBalance.objects.filter(user_id=user_id, year=year).values_list(
        "leave_type_id", flat=True
    )
    missing = [
        LeaveBalance(user_id=user_id, leave_type=leave_type, year=year, total_days=leave_type.default_days)
        for leave_type in LeaveType.objects.exclude(id__in=list(existing))
    ]
    LeaveBalance.objects.bulk_create(missing, ignore_conflicts=True)


def available_days(user_id: int, leave_type_id: int, year: int) -> int:
    """Remaining days minus days already reserved by pending requests."""
    ensure_balances(user_id, year)
    balance = LeaveBalance.objects.get(user_id=user_id, leave_type_id=leave_type_id, year=year)
    pending = (
        LeaveRequest.objects.filter(
            employee_id=user_id, leave_type_id=leave_type_id,
            status=Status.PENDING, start_date__year=year,
        ).aggregate(total=Sum("days"))["total"]
        or 0
    )
    return balance.remaining_days - pending


def _locked_balance(leave_request) -> LeaveBalance:
    year = leave_request.start_date.year
    ensure_balances(leave_request.employee_id, year)
    return LeaveBalance.objects.select_for_update().get(
        user_id=leave_request.employee_id, leave_type_id=leave_request.leave_type_id, year=year
    )


def _check_reviewable(leave_request, reviewer, verb: str) -> None:
    if leave_request.employee_id == reviewer.id:
        raise PermissionDenied("You cannot review your own leave request.")
    if leave_request.status != Status.PENDING:
        raise InvalidTransition(
            f"Only pending requests can be {verb}. This request is {leave_request.get_status_display().lower()}."
        )


def _finish_review(leave_request, new_status, reviewer, comment):
    leave_request.status = new_status
    leave_request.reviewed_by = reviewer
    leave_request.review_comment = comment
    leave_request.reviewed_at = timezone.now()
    leave_request.save()
    return leave_request


@transaction.atomic
def approve_request(request_id: int, reviewer, comment: str = ""):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=request_id)
    _check_reviewable(leave_request, reviewer, "approved")
    balance = _locked_balance(leave_request)
    if balance.remaining_days < leave_request.days:
        raise InsufficientBalance(
            f"Employee has only {balance.remaining_days} day(s) left; request needs {leave_request.days}."
        )
    balance.used_days += leave_request.days
    balance.save(update_fields=["used_days"])
    return _finish_review(leave_request, Status.APPROVED, reviewer, comment)


@transaction.atomic
def reject_request(request_id: int, reviewer, comment: str):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=request_id)
    _check_reviewable(leave_request, reviewer, "rejected")
    return _finish_review(leave_request, Status.REJECTED, reviewer, comment)


@transaction.atomic
def cancel_request(request_id: int, user):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=request_id)
    if leave_request.employee_id != user.id:
        raise PermissionDenied("You can only cancel your own leave requests.")

    if leave_request.status == Status.APPROVED:
        if leave_request.start_date <= timezone.localdate():
            raise InvalidTransition("Approved leave that has already started cannot be cancelled.")
        balance = _locked_balance(leave_request)  # refund the days
        balance.used_days = max(0, balance.used_days - leave_request.days)
        balance.save(update_fields=["used_days"])
    elif leave_request.status != Status.PENDING:
        raise InvalidTransition(
            f"A {leave_request.get_status_display().lower()} request cannot be cancelled."
        )

    leave_request.status = Status.CANCELLED
    leave_request.save(update_fields=["status", "updated_at"])
    return leave_request