from rest_framework.test import APIClient


def _login(username, password):
    return APIClient().post(
        "/api/auth/login/", {"username": username, "password": password}, format="json"
    )


def test_login_returns_tokens_and_user(employee_user, password):
    res = _login(employee_user.username, password)
    assert res.status_code == 200
    body = res.json()
    assert {"access", "refresh", "user"} <= body.keys()
    assert body["user"]["role"] == "EMPLOYEE"


def test_login_with_wrong_password_is_401(employee_user):
    res = _login(employee_user.username, "wrong-password")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


def test_inactive_user_cannot_login(employee_user, password):
    employee_user.is_active = False
    employee_user.save()
    assert _login(employee_user.username, password).status_code == 401


def test_me_requires_authentication():
    assert APIClient().get("/api/auth/me/").status_code == 401


def test_me_returns_current_user(employee_client, employee_user):
    res = employee_client.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.json()["username"] == employee_user.username


def test_logout_blacklists_refresh_token(employee_user, password):
    tokens = _login(employee_user.username, password).json()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    res = client.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json")
    assert res.status_code == 204

    res = APIClient().post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert res.status_code == 401


def test_change_password(employee_client, employee_user, password):
    url = "/api/auth/change-password/"
    bad = employee_client.post(url, {"old_password": "nope", "new_password": "N3w-Strong-Pass!987"}, format="json")
    assert bad.status_code == 400
    assert "old_password" in bad.json()["error"]["details"]

    ok = employee_client.post(url, {"old_password": password, "new_password": "N3w-Strong-Pass!987"}, format="json")
    assert ok.status_code == 200
    assert _login(employee_user.username, "N3w-Strong-Pass!987").status_code == 200