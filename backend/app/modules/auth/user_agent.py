"""Interpretação simples do User-Agent para exibir "dispositivo" e "navegador"."""

import re
from dataclasses import dataclass
from typing import Literal

DeviceKind = Literal["laptop", "phone", "desktop"]


@dataclass(frozen=True)
class ParsedAgent:
    device: str
    client: str
    kind: DeviceKind


# Ordem importa: Edge/Opera/Chrome mobile também contêm "Chrome" ou "Safari".
_BROWSERS = [
    ("Edge", re.compile(r"Edg(?:e|A|iOS)?/(\d+)")),
    ("Opera", re.compile(r"OPR/(\d+)")),
    ("Firefox", re.compile(r"(?:Firefox|FxiOS)/(\d+)")),
    ("Chrome", re.compile(r"(?:Chrome|CriOS)/(\d+)")),
    ("Safari", re.compile(r"Version/(\d+)[\d.]* .*Safari/")),
]


def _detect_device(ua: str) -> tuple[str, DeviceKind]:
    if "iPhone" in ua:
        return "iPhone", "phone"
    if "iPad" in ua:
        return "iPad", "phone"
    if "Android" in ua:
        return "Android", "phone"
    if "Windows" in ua:
        return "Computador Windows", "desktop"
    if "Macintosh" in ua or "Mac OS X" in ua:
        return "Mac", "laptop"
    if "CrOS" in ua:
        return "Chromebook", "laptop"
    if "Linux" in ua or "X11" in ua:
        return "Computador Linux", "desktop"
    return "Dispositivo desconhecido", "desktop"


def parse_user_agent(user_agent: str | None) -> ParsedAgent:
    if not user_agent:
        return ParsedAgent("Dispositivo desconhecido", "Navegador desconhecido", "desktop")
    device, kind = _detect_device(user_agent)
    client = "Navegador desconhecido"
    for name, pattern in _BROWSERS:
        match = pattern.search(user_agent)
        if match:
            client = f"{name} {match.group(1)}"
            break
    return ParsedAgent(device, client, kind)
