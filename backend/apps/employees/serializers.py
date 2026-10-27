from django.contrib.auth import password_validation
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.leaves.services import ensure_balances

from .models import Department, EmployeeProfile


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["id", "name", "description", "employee_count"]

    def get_employee_count(self, obj) -> int:
        count = getattr(obj, "employee_count", None)  # annotated in the list query
        return count if count is not None else obj.employees.count()


class EmployeeSerializer(serializers.ModelSerializer):
    """One serializer that reads/writes the profile and its linked user."""

    username = serializers.CharField(
        source="user.username", max_length=150, validators=[UnicodeUsernameValidator()]
    )
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name", max_length=150)
    last_name = serializers.CharField(source="user.last_name", max_length=150)
    password = serializers.CharField(
        source="user.password", write_only=True, required=False, style={"input_type": "password"}
    )
    is_active = serializers.BooleanField(source="user.is_active", required=False)
    user_id = serializers.IntegerField(read_only=True)
    full_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = [
            "id", "user_id", "username", "email", "first_name", "last_name", "full_name", "password",
            "is_active", "department", "department_name", "employee_code", "job_title",
            "phone", "joined_on", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_full_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    # ---- validation ----
    def validate_username(self, value):
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def validate_joined_on(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Joining date cannot be in the future.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("user", {}).get("password"):
            raise serializers.ValidationError({"password": "This field is required."})
        return attrs

    # ---- writes ----
    @transaction.atomic
    def create(self, validated_data):
        user_data = validated_data.pop("user")
        password = user_data.pop("password")
        user = User.objects.create_user(password=password, role=User.Role.EMPLOYEE, **user_data)
        profile = EmployeeProfile.objects.create(user=user, **validated_data)
        ensure_balances(user.id, timezone.localdate().year)
        return profile

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        password = user_data.pop("password", None)
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        if password:
            user.set_password(password)
        user.save()
        return super().update(instance, validated_data)