from django_filters import rest_framework as filters

from .models import EmployeeProfile


class EmployeeFilter(filters.FilterSet):
    is_active = filters.BooleanFilter(field_name="user__is_active")

    class Meta:
        model = EmployeeProfile
        fields = ["department", "is_active"]