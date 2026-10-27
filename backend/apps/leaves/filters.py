from django_filters import rest_framework as filters

from .models import LeaveRequest


class LeaveRequestFilter(filters.FilterSet):
    start_from = filters.DateFilter(field_name="start_date", lookup_expr="gte")
    start_to = filters.DateFilter(field_name="start_date", lookup_expr="lte")
    department = filters.NumberFilter(field_name="employee__profile__department_id")

    class Meta:
        model = LeaveRequest
        fields = ["status", "leave_type", "employee"]