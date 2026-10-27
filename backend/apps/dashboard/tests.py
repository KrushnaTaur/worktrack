from datetime import timedelta

from apps.leaves.models import LeaveRequest


def test_dashboard_requires_auth():
    from rest_framework.test import APIClient
    assert APIClient().get("/api/dashboard/").status_code == 401


def test_admin_dashboard(admin_client, make_employee, leave_types, next_monday):
    employee = make_employee()
    start = next_monday()
    LeaveRequest.objects.create(
        employee=employee, leave_type=leave_types["Annual"], start_date=start,
        end_date=start + timedelta(days=2), days=3, reason="Trip",
    )
    body = admin_client.get("/api/dashboard/").json()
    assert body["role"] == "ADMIN"
    assert body["totals"]["employees"] == 1
    assert body["totals"]["pending_requests"] == 1
    assert body["requests_by_status"]["PENDING"] == 1
    assert len(body["monthly_trend"]) == 6
    assert len(body["recent_pending"]) == 1


def test_employee_dashboard(employee_client, leave_types):
    body = employee_client.get("/api/dashboard/").json()
    assert body["role"] == "EMPLOYEE"
    assert len(body["balances"]) == len(leave_types)
    assert body["upcoming_leaves"] == []
    assert "totals" not in body  # admin-only data is not exposed