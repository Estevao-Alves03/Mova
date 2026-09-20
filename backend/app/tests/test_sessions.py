import uuid

from sqlalchemy import text

from app.db.session import get_engine
from app.tests import helpers

URL = "/api/v1/auth/sessions"
CHROME_MAC = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)
IPHONE_SAFARI = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Mobile/15E148 Safari/604.1"
)


def _login(settings, user, user_agent=None):
    return helpers.bearer(helpers.login(settings, user.email, user.password, user_agent))


def test_lists_own_sessions_with_device_info(client, settings, make_user):
    user = make_user()
    mac = _login(settings, user, CHROME_MAC)
    _login(settings, user, IPHONE_SAFARI)

    sessions = client.get(URL, headers=mac).json()
    assert len(sessions) == 2
    by_device = {s["device"]: s for s in sessions}
    assert by_device["Mac"]["client"] == "Chrome 123" and by_device["Mac"]["kind"] == "laptop"
    assert by_device["Mac"]["current"] is True
    assert by_device["iPhone"]["client"] == "Safari 17" and by_device["iPhone"]["kind"] == "phone"
    assert by_device["iPhone"]["current"] is False
    assert sum(s["current"] for s in sessions) == 1
    assert by_device["Mac"]["ip"]


def test_never_lists_other_users_sessions(client, settings, make_user):
    a, b = make_user(), make_user()
    headers_a = _login(settings, a)
    _login(settings, b)
    _login(settings, b)
    assert len(client.get(URL, headers=headers_a).json()) == 1


def test_revoke_another_session(client, settings, make_user):
    user = make_user()
    keep = _login(settings, user)
    _login(settings, user, IPHONE_SAFARI)
    target = next(s for s in client.get(URL, headers=keep).json() if not s["current"])

    assert client.delete(f"{URL}/{target['id']}", headers=keep).status_code == 204
    remaining = client.get(URL, headers=keep).json()
    assert [s["id"] for s in remaining] != [target["id"]] and len(remaining) == 1


def test_cannot_revoke_the_current_session(client, settings, make_user):
    headers = _login(settings, make_user())
    current = client.get(URL, headers=headers).json()[0]
    assert client.delete(f"{URL}/{current['id']}", headers=headers).status_code == 400
    assert client.get(URL, headers=headers).status_code == 200


def test_cannot_revoke_someone_elses_session(client, settings, make_user):
    a, b = make_user(), make_user()
    headers_a = _login(settings, a)
    headers_b = _login(settings, b)
    victim_session = client.get(URL, headers=headers_b).json()[0]["id"]

    assert client.delete(f"{URL}/{victim_session}", headers=headers_a).status_code == 404
    assert client.get(URL, headers=headers_b).status_code == 200  # continua ativa
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from auth.sessions where id = :i"), {"i": victim_session}).scalar() == 1


def test_revoking_unknown_session_is_404(client, settings, make_user):
    headers = _login(settings, make_user())
    assert client.delete(f"{URL}/{uuid.uuid4()}", headers=headers).status_code == 404
    assert client.delete(f"{URL}/nao-e-uuid", headers=headers).status_code == 422


def test_revoke_all_others_keeps_current_and_other_users(client, settings, make_user):
    a, b = make_user(), make_user()
    current = _login(settings, a)
    for _ in range(2):
        _login(settings, a)
    other_user = _login(settings, b)

    assert client.delete(URL, headers=current).status_code == 204
    sessions = client.get(URL, headers=current).json()
    assert len(sessions) == 1 and sessions[0]["current"] is True
    assert client.get(URL, headers=other_user).status_code == 200


def test_sessions_require_membership(client, settings, make_user):
    user = make_user(role=None)
    assert client.get(URL, headers=_login(settings, user)).status_code == 403
