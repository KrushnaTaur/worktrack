from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from django.db.models import F, Q


class LeaveType(models.Model):
    name = models.CharField(max_length=50, unique=True)
    default_days = models.PositiveSmallIntegerField(validators=[MaxValueValidator(365)])

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class LeaveBalance(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave_balances"
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="balances")
    year = models.PositiveSmallIntegerField()
    total_days = models.PositiveSmallIntegerField(validators=[MaxValueValidator(365)])
    used_days = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-year", "user_id", "leave_type_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "leave_type", "year"], name="unique_balance_per_user_type_year"
            ),
            models.CheckConstraint(
                condition=Q(used_days__lte=F("total_days")), name="balance_used_lte_total"
            ),
        ]

    @property
    def remaining_days(self) -> int:
        return self.total_days - self.used_days

    def __str__(self):
        return f"{self.user} {self.leave_type} {self.year}: {self.used_days}/{self.total_days}"


class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave_requests"
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="requests")
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveSmallIntegerField()  # working days, computed on the server
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="reviewed_leave_requests",
    )
    review_comment = models.CharField(max_length=255, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")), name="leave_end_on_or_after_start"
            ),
            models.CheckConstraint(condition=Q(days__gte=1), name="leave_days_positive"),
        ]
        indexes = [
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self):
        return f"{self.employee} {self.leave_type} {self.start_date}..{self.end_date} [{self.status}]"