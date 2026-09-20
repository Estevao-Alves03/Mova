"""O navegador faz um preflight antes de cada PUT/PATCH/DELETE: se o método não for
permitido no CORS, a chamada falha no navegador mesmo com a API correta."""

import pytest

ORIGIN = "http://localhost:5173"


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
def test_preflight_allows_every_method_the_api_uses(client, method):
    response = client.options(
        "/api/v1/notification-preferences",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_preflight_rejects_unknown_origins(client):
    response = client.options(
        "/api/v1/notification-preferences",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "PUT"},
    )
    assert "access-control-allow-origin" not in response.headers
