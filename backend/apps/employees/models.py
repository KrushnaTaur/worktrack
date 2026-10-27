from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

phone_validator = RegexValidator(
    r"^\+?[0-9 \-]{7,20}$", "Enter a valid phone number (digits, spaces, hyphens, optional +)."
)


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class EmployeeProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    # PROTECT: a department that still has employees cannot be deleted.
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees")
    employee_code = models.CharField(max_length=20, unique=True)
    job_title = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    joined_on = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_code"]

    def __str__(self):
        return f"{self.employee_code} - {self.user.username}"