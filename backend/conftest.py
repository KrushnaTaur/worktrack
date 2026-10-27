from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.employees.models import Department, EmployeeProfile
from apps.leaves.models import LeaveType

PASSWORD = "Str0ng-Pass!234"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()  # resets login throttle counters between tests
    yield


@pytest.fixture
def password():
    return PASSWORD


@pytest.fixture
def client_for():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client
    return _client


@pytest.fixture
def department(db):
    return Department.objects.create(name="Engineering")


@pytest.fixture
def make_employee(db, department):
    counter = {"n": 0}

    def _make(username=None, **extra):
        counter["n"] += 1
        n = counter["n"]
        username = username or f"emp{n}"
        user = User.objects.create_user(
            username=username, email=f"{username}@example.com", password=PASSWORD,
            first_name=username.title(), last_name="Tester",
        )
        EmployeeProfile.objects.create(
            user=user, department=extra.get("department", department),
            employee_code=f"EMP{n:03d}", job_title="Developer", joined_on="2024-01-15",
        )
        return user

    return _make


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin1", email="admin1@example.com", password=PASSWORD, role=User.Role.ADMIN
    )


@pytest.fixture
def employee_user(make_employee):
    return make_employee("alice")


@pytest.fixture
def other_employee(make_employee):
    return make_employee("bob")


@pytest.fixture
def admin_client(client_for, admin_user):
    return client_for(admin_user)


@pytest.fixture
def employee_client(client_for, employee_user):
    return client_for(employee_user)


@pytest.fixture
def leave_types(db):
    types = {}
    for name, days in (("Annual", 18), ("Sick", 10), ("Casual", 7)):
        types[name], _ = LeaveType.objects.get_or_create(name=name, defaults={"default_days": days})
    return types


@pytest.fixture
def next_monday():
    """Always a future Monday, so Mon-Wed is exactly 3 working days."""
    def _next(weeks_ahead=0):
        today = timezone.localdate()
        return today + timedelta(days=7 - today.weekday()) + timedelta(weeks=weeks_ahead)
    return _next