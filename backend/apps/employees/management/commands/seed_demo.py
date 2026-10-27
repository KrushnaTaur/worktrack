from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.employees.models import Department, EmployeeProfile
from apps.leaves.models import LeaveRequest, LeaveType
from apps.leaves.services import (
    approve_request,
    count_working_days,
    ensure_balances,
    reject_request,
)

ADMIN_PASSWORD = "Admin@12345"
EMPLOYEE_PASSWORD = "Employee@123"

PEOPLE = [
    ("alice", "Alice", "Johnson", "EMP001", "Engineering", "Backend Developer"),
    ("bob", "Bob", "Smith", "EMP002", "Engineering", "Frontend Developer"),
    ("carol", "Carol", "Davis", "EMP003", "Human Resources", "HR Manager"),
    ("dev", "Dev", "Patel", "EMP004", "Sales", "Account Executive"),
]

# (username, leave type, start offset from next Monday, length in days, reason, action)
REQUESTS = [
    ("alice", "Annual", 0, 3, "Family vacation", None),
    ("bob", "Sick", 8, 2, "Medical appointment", "approve"),
    ("carol", "Casual", 4, 1, "Personal errand", None),
    ("dev", "Annual", 14, 3, "Wedding to attend", "reject"),
]


class Command(BaseCommand):
    help = "Create demo users, departments and leave requests for local development."

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()

        admin, created = User.objects.get_or_create(
            username="demo_admin",
            defaults={
                "email": "demo_admin@worktrack.local", "first_name": "Asha", "last_name": "Admin",
                "role": User.Role.ADMIN, "is_staff": True, "is_superuser": True,
            },
        )
        if created:
            admin.set_password(ADMIN_PASSWORD)
            admin.save()

        departments = {
            name: Department.objects.get_or_create(name=name)[0]
            for name in {person[4] for person in PEOPLE}
        }

        users = {}
        for username, first, last, code, dept, title in PEOPLE:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@worktrack.local", "first_name": first,
                    "last_name": last, "role": User.Role.EMPLOYEE,
                },
            )
            if created:
                user.set_password(EMPLOYEE_PASSWORD)
                user.save()
            EmployeeProfile.objects.get_or_create(
                user=user,
                defaults={
                    "department": departments[dept], "employee_code": code,
                    "job_title": title, "joined_on": today - timedelta(days=400),
                },
            )
            ensure_balances(user.id, today.year)
            users[username] = user

        if not LeaveRequest.objects.exists():
            monday = today + timedelta(days=7 - today.weekday())
            for username, type_name, offset, length, reason, action in REQUESTS:
                start = monday + timedelta(days=offset)
                end = start + timedelta(days=length - 1)
                leave_request = LeaveRequest.objects.create(
                    employee=users[username],
                    leave_type=LeaveType.objects.get(name=type_name),
                    start_date=start, end_date=end,
                    days=count_working_days(start, end), reason=reason,
                )
                if action == "approve":
                    approve_request(leave_request.pk, admin, "Get well soon")
                elif action == "reject":
                    reject_request(leave_request.pk, admin, "Team deadline that week")

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"  Admin:     demo_admin / {ADMIN_PASSWORD}")
        self.stdout.write(f"  Employees: alice, bob, carol, dev / {EMPLOYEE_PASSWORD}")