from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrReadOnly

from .filters import EmployeeFilter
from .models import Department, EmployeeProfile
from .serializers import DepartmentSerializer, EmployeeSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.annotate(employee_count=Count("employees"))
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "employee_count"]


class EmployeeViewSet(viewsets.ModelViewSet):
    """Admins manage everyone; employees can only see their own profile."""

    queryset = EmployeeProfile.objects.select_related("user", "department")
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = EmployeeFilter
    search_fields = [
        "user__username", "user__first_name", "user__last_name",
        "user__email", "employee_code", "job_title",
    ]
    ordering_fields = ["employee_code", "user__first_name", "joined_on"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        user = self.request.user
        return queryset if user.is_admin_role else queryset.filter(user=user)

    def perform_destroy(self, instance):
        # Soft delete: keep leave history, just block login.
        instance.user.is_active = False
        instance.user.save(update_fields=["is_active"])

    @extend_schema(responses=EmployeeSerializer)
    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        profile = (
            EmployeeProfile.objects.select_related("user", "department")
            .filter(user=request.user)
            .first()
        )
        if profile is None:
            raise NotFound("No employee profile exists for this account.")
        return Response(self.get_serializer(profile).data)