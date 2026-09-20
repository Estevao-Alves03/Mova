import httpx

from app.tests import helpers
from app.tests.helpers import TINY_JPEG, TINY_PNG, TINY_WEBP

URL = "/api/v1/profile/avatar"


def _upload(client, headers, content, filename="foto.png", content_type="image/png"):
    return client.post(URL, headers=headers, files={"file": (filename, content, content_type)})


def _path_from(signed_url: str) -> str:
    return signed_url.split("/object/sign/avatars/")[1].split("?")[0]


def test_upload_returns_a_signed_url_that_serves_the_image(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    response = _upload(client, headers, TINY_PNG)
    assert response.status_code == 200, response.text
    url = response.json()["avatar_url"]
    assert url and "/object/sign/avatars/" in url and "token=" in url
    image = httpx.get(url, timeout=15)
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"
    assert image.content == TINY_PNG
    assert client.get("/api/v1/profile", headers=headers).json()["avatar_url"]


def test_bucket_is_private(client, settings, make_user, auth_headers):
    headers = auth_headers(make_user())
    path = _path_from(_upload(client, headers, TINY_PNG).json()["avatar_url"])
    direct = httpx.get(f"{settings.supabase_url}/storage/v1/object/public/avatars/{path}", timeout=15)
    assert direct.status_code != 200
    anon = httpx.get(
        f"{settings.supabase_url}/storage/v1/object/avatars/{path}",
        headers={"apikey": settings.supabase_anon_key},
        timeout=15,
    )
    assert anon.status_code != 200


def test_accepts_jpeg_and_webp(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    assert _upload(client, headers, TINY_JPEG, "a.jpg", "image/jpeg").status_code == 200
    assert _upload(client, headers, TINY_WEBP, "a.webp", "image/webp").status_code == 200


def test_replacing_removes_the_previous_object(client, settings, make_user, auth_headers):
    headers = auth_headers(make_user())
    first = _path_from(_upload(client, headers, TINY_PNG).json()["avatar_url"])
    second = _path_from(_upload(client, headers, TINY_JPEG, "a.jpg", "image/jpeg").json()["avatar_url"])
    assert first != second
    assert not helpers.storage_object_exists(settings, first)
    assert helpers.storage_object_exists(settings, second)


def test_delete_removes_object_and_url(client, settings, make_user, auth_headers):
    headers = auth_headers(make_user())
    path = _path_from(_upload(client, headers, TINY_PNG).json()["avatar_url"])
    response = client.delete(URL, headers=headers)
    assert response.status_code == 200 and response.json()["avatar_url"] is None
    assert not helpers.storage_object_exists(settings, path)
    assert client.delete(URL, headers=headers).status_code == 200  # idempotente


def test_svg_is_rejected(client, make_user, auth_headers):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert _upload(client, auth_headers(make_user()), svg, "x.svg", "image/svg+xml").status_code == 415


def test_client_declared_type_is_ignored(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    assert _upload(client, headers, b"isto nao e uma imagem", "foto.png", "image/png").status_code == 415
    assert _upload(client, headers, b"#!/bin/sh\necho hi", "foto.jpg", "image/jpeg").status_code == 415
    assert _upload(client, headers, b"", "vazio.png", "image/png").status_code == 415


def test_oversized_file_is_rejected(client, make_user, auth_headers):
    big = TINY_JPEG + b"\x00" * (2 * 1024 * 1024)
    assert _upload(client, auth_headers(make_user()), big, "big.jpg", "image/jpeg").status_code == 413


def test_exactly_2mb_is_accepted(client, make_user, auth_headers):
    exact = TINY_JPEG + b"\x00" * (2 * 1024 * 1024 - len(TINY_JPEG))
    assert _upload(client, auth_headers(make_user()), exact, "ok.jpg", "image/jpeg").status_code == 200


def test_failed_upload_keeps_the_current_photo(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    before = _upload(client, headers, TINY_PNG).json()["avatar_url"]
    assert _upload(client, headers, b"lixo", "x.png", "image/png").status_code == 415
    after = client.get("/api/v1/profile", headers=headers).json()["avatar_url"]
    assert _path_from(before) == _path_from(after)


def test_photos_are_scoped_to_the_user(client, make_user, auth_headers):
    a, b = make_user(), make_user()
    _upload(client, auth_headers(a), TINY_PNG)
    assert client.get("/api/v1/profile", headers=auth_headers(b)).json()["avatar_url"] is None


def test_upload_requires_authentication(client):
    assert client.post(URL, files={"file": ("a.png", TINY_PNG, "image/png")}).status_code == 401
    assert client.delete(URL).status_code == 401
