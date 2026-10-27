from apps.accounts.models import User
from apps.employees.models import Department, EmployeeProfile
from apps.leaves.models import LeaveBalance, LeaveType

URL = "/api/employees/"


def employee_payload(department, **overrides):
    data = {
        "username": "newhire", "email": "newhire@example.com", "first_name": "New",
        "last_name": "Hire", "password": "Str0ng-Pass!234", "department": department.pk,
        "employee_code": "EMP900", "job_title": "QA Engineer", "phone": "+91 98765 43210",
        "joined_on": "2024-03-01",
    }
    data.update(overrides)
    return data


def test_admin_creates_employee_with_balances(admin_client, department, leave_types):
    res = admin_client.post(URL, employee_payload(department), format="json")
    assert res.status_code == 201, res.content
    assert "password" not in res.json()
    user = User.objects.get(username="newhire")
    assert user.role == User.Role.EMPLOYEE
    assert user.check_password("Str0ng-Pass!234")
    assert LeaveBalance.objects.filter(user=user).count() == LeaveType.objects.count()


def test_employee_cannot_create_employee(employee_client, department):
    res = employee_client.post(URL, employee_payload(department), format="json")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "forbidden"


def test_unauthenticated_is_401(department):
    from rest_framework.test import APIClient
    assert APIClient().get(URL).status_code == 401


def test_duplicate_email_and_code_rejected(admin_client, department):
    assert admin_client.post(URL, employee_payload(department), format="json").status_code == 201
    res = admin_client.post(
        URL, employee_payload(department, username="other"), format="json"
    )
    assert res.status_code == 400
    details = res.json()["error"]["details"]
    assert "email" in details and "employee_code" in details


def test_weak_or_missing_password_rejected(admin_client, department):
    weak = admin_client.post(URL, employee_payload(department, password="12345678"), format="json")
    assert weak.status_code == 400 and "password" in weak.json()["error"]["details"]

    payload = employee_payload(department)
    del payload["password"]
    missing = admin_client.post(URL, payload, format="json")
    assert missing.status_code == 400 and "password" in missing.json()["error"]["details"]


def test_admin_can_update_employee(admin_client, employee_user):
    profile = employee_user.profile
    res = admin_client.patch(
        f"{URL}{profile.pk}/", {"job_title": "Tech Lead", "email": employee_user.email}, format="json"
    )
    assert res.status_code == 200
    assert res.json()["job_title"] == "Tech Lead"


def test_employee_sees_only_own_profile(employee_client, employee_user, other_employee):
    res = employee_client.get(URL)
    assert res.json()["count"] == 1
    assert employee_client.get(f"{URL}{other_employee.profile.pk}/").status_code == 404
    assert employee_client.get(f"{URL}me/").json()["username"] == employee_user.username


def test_admin_search_and_pagination(admin_client, make_employee):
    for _ in range(12):
        make_employee()
    page = admin_client.get(URL, {"page_size": 5}).json()
    assert page["count"] == 12 and len(page["results"]) == 5 and page["next"]
    assert admin_client.get(URL, {"search": "emp3"}).json()["count"] == 1


def test_delete_deactivates_instead_of_deleting(admin_client, employee_user):
    res = admin_client.delete(f"{URL}{employee_user.profile.pk}/")
    assert res.status_code == 204
    employee_user.refresh_from_db()
    assert employee_user.is_active is False
    assert EmployeeProfile.objects.filter(user=employee_user).exists()


def test_department_rules(admin_client, employee_client, department, employee_user):
    assert employee_client.post("/api/departments/", {"name": "HR"}, format="json").status_code == 403
    assert admin_client.post("/api/departments/", {"name": "HR"}, format="json").status_code == 201

    dup = admin_client.post("/api/departments/", {"name": "HR"}, format="json")
    assert dup.status_code == 400

    blocked = admin_client.delete(f"/api/departments/{department.pk}/")  # has alice
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "conflict"

    empty = Department.objects.get(name="HR")
    assert admin_client.delete(f"/api/departments/{empty.pk}/").status_code == 204