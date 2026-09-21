"""Validações e normalizações de campos compartilhadas entre os módulos."""

import re


def normalize_phone(value: str) -> str:
    """"11987412030" -> "(11) 98741-2030"; fixo: "(11) 3284-9000". Levanta ValueError se inválido."""
    digits = re.sub(r"\D", "", value)
    if len(digits) not in (10, 11) or digits[0] == "0":
        raise ValueError("Telefone inválido. Use DDD + número.")
    if len(digits) == 11:
        if digits[2] != "9":
            raise ValueError("Celular inválido: o número deve começar com 9.")
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
