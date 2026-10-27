from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminOrReadOnly, IsAdminRole

from . import services
from .filters import LeaveRequestFilter
from .models import LeaveBalance, LeaveRequest, LeaveType
from .serializers import (
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    RejectSerializer,
    ReviewSerializer,
)


class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]


class LeaveBalanceViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Everyone reads their own balances; admins read all and may adjust total_days."""

    queryset = LeaveBalance.objects.select_related("user", "leave_type")
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAdminOrReadOnly]
    http_method_names = ["get", "patch", "head", "options"]
    filterset_fields = ["user", "leave_type", "year"]
    ordering_fields = ["year", "total_days", "used_days"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        user = self.request.user
        return queryset if user.is_admin_role else queryset.filter(user=user)

    def list(self, request, *args, **kwargs):
        target = request.query_params.get("user") if request.user.is_admin_role else request.user.id
        if target and str(target).isdigit() and User.objects.filter(pk=int(target)).exists():
            services.ensure_balances(int(target), timezone.localdate().year)
        return super().list(request, *args, **kwargs)


class LeaveRequestViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = LeaveRequest.objects.select_related("employee", "leave_type", "reviewed_by")
    serializer_class = LeaveRequestSerializer
    filterset_class = LeaveRequestFilter
    search_fields = ["employee__username", "employee__first_name", "employee__last_name", "reason"]
    ordering_fields = ["created_at", "start_date", "end_date", "status", "days"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        user = self.request.user
        return queryset if user.is_admin_role else queryset.filter(employee=user)

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user)

    @extend_schema(request=ReviewSerializer, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def approve(self, request, pk=None):
        leave_request = self.get_object()
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.approve_request(
            leave_request.pk, request.user, serializer.validated_data["comment"]
        )
        return Response(self.get_serializer(updated).data)

    @extend_schema(request=RejectSerializer, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.reject_request(
            leave_request.pk, request.user, serializer.validated_data["comment"]
        )
        return Response(self.get_serializer(updated).data)

    @extend_schema(request=None, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        leave_request = self.get_object()
        updated = services.cancel_request(leave_request.pk, request.user)
        return Response(self.get_serializer(updated).data)