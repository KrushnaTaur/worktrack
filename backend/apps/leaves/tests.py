from datetime import timedelta

import pytest
from django.utils import timezone

from apps.leaves.models import LeaveBalance

URL = "/api/leave-requests/"


def payload(leave_type, start, end, reason="Family function"):
    return {
        "leave_type": leave_type.pk, "start_date": start.isoformat(),
        "end_date": end.isoformat(), "reason": reason,
    }


def used_days(user, leave_type, year):
    return LeaveBalance.objects.get(user=user, leave_type=leave_type, year=year).used_days


@pytest.fixture
def pending(employee_client, leave_types, next_monday):
    start = next_monday()
    res = employee_client.post(URL, payload(leave_types["Annual"], start, start + timedelta(days=2)), format="json")
    assert res.status_code == 201, res.content
    return res.json()


# ---- applying ----
def test_employee_can_apply(pending, employee_user, leave_types, next_monday):
    assert pending["days"] == 3
    assert pending["status"] == "PENDING"
    assert pending["employee"] == employee_user.pk
    assert used_days(employee_user, leave_types["Annual"], next_monday().year) == 0  # not deducted yet


def test_end_before_start_rejected(employee_client, leave_types, next_monday):
    start = next_monday()
    res = employee_client.post(URL, payload(leave_types["Annual"], start, start - timedelta(days=1)), format="json")
    assert res.status_code == 400
    assert "end_date" in res.json()["error"]["details"]


def test_past_start_rejected(employee_client, leave_types):
    yesterday = timezone.localdate() - timedelta(days=1)
    res = employee_client.post(URL, payload(leave_types["Annual"], yesterday, yesterday), format="json")
    assert res.status_code == 400
    assert "start_date" in res.json()["error"]["details"]


def test_weekend_only_rejected(employee_client, leave_types, next_monday):
    saturday = next_monday(1) - timedelta(days=2)
    res = employee_client.post(
        URL, payload(leave_types["Annual"], saturday, saturday + timedelta(days=1)), format="json"
    )
    assert res.status_code == 400
    assert "no working days" in str(res.json())


def test_reason_is_required(employee_client, leave_types, next_monday):
    start = next_monday()
    res = employee_client.post(URL, payload(leave_types["Annual"], start, start, reason=""), format="json")
    assert res.status_code == 400
    assert "reason" in res.json()["error"]["details"]


def test_overlapping_request_rejected(employee_client, pending, leave_types, next_monday):
    start = next_monday() + timedelta(days=1)  # Tue-Thu overlaps Mon-Wed
    res = employee_client.post(URL, payload(leave_types["Annual"], start, start + timedelta(days=2)), format="json")
    assert res.status_code == 400
    assert "overlapping" in str(res.json())


def test_insufficient_balance_rejected(employee_client, leave_types, next_monday):
    start = next_monday()
    end = next_monday(1) + timedelta(days=4)  # 10 working days > 7 casual days
    res = employee_client.post(URL, payload(leave_types["Casual"], start, end), format="json")
    assert res.status_code == 400
    assert "leave_type" in res.json()["error"]["details"]


# ---- approval workflow ----
def test_admin_approves_and_balance_is_deducted(admin_client, pending, employee_user, leave_types, next_monday):
    res = admin_client.post(f"{URL}{pending['id']}/approve/", {"comment": "Enjoy"}, format="json")
    assert res.status_code == 200, res.content
    assert res.json()["status"] == "APPROVED"
    assert res.json()["reviewed_by_name"]
    assert used_days(employee_user, leave_types["Annual"], next_monday().year) == 3


def test_employee_cannot_approve(employee_client, pending):
    res = employee_client.post(f"{URL}{pending['id']}/approve/", {}, format="json")
    assert res.status_code == 403


def test_cannot_approve_twice(admin_client, pending):
    assert admin_client.post(f"{URL}{pending['id']}/approve/", {}, format="json").status_code == 200
    again = admin_client.post(f"{URL}{pending['id']}/approve/", {}, format="json")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "conflict"


def test_reject_requires_comment_and_keeps_balance(admin_client, pending, employee_user, leave_types, next_monday):
    url = f"{URL}{pending['id']}/reject/"
    assert admin_client.post(url, {}, format="json").status_code == 400
    res = admin_client.post(url, {"comment": "Team deadline"}, format="json")
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"
    assert used_days(employee_user, leave_types["Annual"], next_monday().year) == 0


def test_admin_cannot_review_own_request(admin_client, leave_types, next_monday):
    start = next_monday()
    created = admin_client.post(URL, payload(leave_types["Annual"], start, start), format="json").json()
    res = admin_client.post(f"{URL}{created['id']}/approve/", {}, format="json")
    assert res.status_code == 403


# ---- cancelling ----
def test_employee_cancels_pending(employee_client, pending):
    res = employee_client.post(f"{URL}{pending['id']}/cancel/")
    assert res.status_code == 200 and res.json()["status"] == "CANCELLED"


def test_cancelling_approved_refunds_balance(admin_client, employee_client, pending, employee_user, leave_types, next_monday):
    admin_client.post(f"{URL}{pending['id']}/approve/", {}, format="json")
    assert used_days(employee_user, leave_types["Annual"], next_monday().year) == 3
    res = employee_client.post(f"{URL}{pending['id']}/cancel/")
    assert res.status_code == 200
    assert used_days(employee_user, leave_types["Annual"], next_monday().year) == 0


def test_only_owner_can_cancel(client_for, other_employee, admin_client, pending):
    assert client_for(other_employee).post(f"{URL}{pending['id']}/cancel/").status_code == 404
    assert admin_client.post(f"{URL}{pending['id']}/cancel/").status_code == 403


# ---- visibility, filtering ----
def test_employees_only_see_own_requests(client_for, other_employee, admin_client, pending):
    other = client_for(other_employee)
    assert other.get(URL).json()["count"] == 0
    assert other.get(f"{URL}{pending['id']}/").status_code == 404
    assert admin_client.get(URL).json()["count"] == 1


def test_admin_can_filter_by_status(admin_client, pending):
    assert admin_client.get(URL, {"status": "PENDING"}).json()["count"] == 1
    assert admin_client.get(URL, {"status": "APPROVED"}).json()["count"] == 0
    assert admin_client.get(URL, {"status": "BOGUS"}).status_code == 400


# ---- balances ----
def test_balances_created_on_demand(employee_client, leave_types):
    res = employee_client.get("/api/leave-balances/")
    assert res.status_code == 200
    assert res.json()["count"] == len(leave_types)


def test_admin_adjusts_balance_but_not_below_used(admin_client, employee_client, employee_user, leave_types):
    employee_client.get("/api/leave-balances/")  # creates balances
    balance = LeaveBalance.objects.get(user=employee_user, leave_type=leave_types["Annual"])
    url = f"/api/leave-balances/{balance.pk}/"

    assert employee_client.patch(url, {"total_days": 99}, format="json").status_code == 403
    ok = admin_client.patch(url, {"total_days": 25}, format="json")
    assert ok.status_code == 200 and ok.json()["total_days"] == 25

    LeaveBalance.objects.filter(pk=balance.pk).update(used_days=5)
    bad = admin_client.patch(url, {"total_days": 3}, format="json")
    assert bad.status_code == 400 and "total_days" in bad.json()["error"]["details"]