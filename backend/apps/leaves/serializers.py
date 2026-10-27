from django.utils import timezone
from rest_framework import serializers

from . import services
from .models import LeaveBalance, LeaveRequest, LeaveType

MAX_SPAN_DAYS = 60


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "default_days"]


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    user_name = serializers.SerializerMethodField()
    remaining_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            "id", "user", "user_name", "leave_type", "leave_type_name",
            "year", "total_days", "used_days", "remaining_days",
        ]
        read_only_fields = ["user", "leave_type", "year", "used_days"]

    def get_user_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    def validate_total_days(self, value):
        if self.instance is not None and value < self.instance.used_days:
            raise serializers.ValidationError(
                f"Total days cannot be less than days already used ({self.instance.used_days})."
            )
        return value


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "employee", "employee_name", "leave_type", "leave_type_name",
            "start_date", "end_date", "days", "reason", "status",
            "reviewed_by", "reviewed_by_name", "review_comment", "reviewed_at", "created_at",
        ]
        read_only_fields = [
            "id", "employee", "days", "status", "reviewed_by",
            "review_comment", "reviewed_at", "created_at",
        ]

    def get_employee_name(self, obj) -> str:
        return obj.employee.get_full_name() or obj.employee.username

    def get_reviewed_by_name(self, obj) -> str | None:
        if obj.reviewed_by is None:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def validate(self, attrs):
        user = self.context["request"].user
        start, end, leave_type = attrs["start_date"], attrs["end_date"], attrs["leave_type"]
        today = timezone.localdate()

        if end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        if start < today:
            raise serializers.ValidationError({"start_date": "Start date cannot be in the past."})
        if start.year > today.year + 1:
            raise serializers.ValidationError({"start_date": "Leave can only be requested up to next year."})
        if (end - start).days >= MAX_SPAN_DAYS:
            raise serializers.ValidationError(
                {"end_date": f"A request cannot span more than {MAX_SPAN_DAYS} days."}
            )

        days = services.count_working_days(start, end)
        if days == 0:
            raise serializers.ValidationError(
                {"end_date": "The selected dates contain no working days (Mon-Fri)."}
            )

        overlap = LeaveRequest.objects.filter(
            employee=user,
            status__in=[LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED],
            start_date__lte=end,
            end_date__gte=start,
        ).exists()
        if overlap:
            raise serializers.ValidationError(
                {"start_date": "You already have a pending or approved request overlapping these dates."}
            )

        available = services.available_days(user.id, leave_type.id, start.year)
        if days > available:
            raise serializers.ValidationError(
                {"leave_type": f"Insufficient balance: {days} day(s) requested, {max(available, 0)} available."}
            )

        attrs["days"] = days
        return attrs


class ReviewSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class RejectSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=255)  # a reason is mandatory on rejection