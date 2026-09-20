import pytest

from app.modules.auth.user_agent import parse_user_agent

CASES = [
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
     "Mac", "Chrome 123", "laptop"),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
     "Computador Windows", "Edge 122", "desktop"),
    ("Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
     "Computador Linux", "Firefox 124", "desktop"),
    ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
     "iPhone", "Safari 17", "phone"),
    ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
     "Android", "Chrome 123", "phone"),
    ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
     "iPhone", "Chrome 123", "phone"),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
     "Mac", "Safari 17", "laptop"),
    (None, "Dispositivo desconhecido", "Navegador desconhecido", "desktop"),
    ("", "Dispositivo desconhecido", "Navegador desconhecido", "desktop"),
    ("curl/8.5.0", "Dispositivo desconhecido", "Navegador desconhecido", "desktop"),
]


@pytest.mark.parametrize(("user_agent", "device", "client", "kind"), CASES)
def test_parse_user_agent(user_agent, device, client, kind):
    parsed = parse_user_agent(user_agent)
    assert (parsed.device, parsed.client, parsed.kind) == (device, client, kind)
