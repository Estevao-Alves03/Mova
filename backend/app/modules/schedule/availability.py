"""Motor de disponibilidade: funções puras, sem banco.

Única implementação das regras. Listar horários livres, validar um agendamento e
achar consultas fora da disponibilidade usam `containment_reason`, então nunca
divergem entre si. A trava em SQL (migration 0004) espelha essas regras; um teste
compara as duas.

    disponível = faixa do dia − almoço − bloqueios − consultas ativas

Horários de início seguem uma grade alinhada ao INÍCIO da faixa, a cada
`step` minutos, e a consulta ocupa exatamente a duração configurada para o seu tipo.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta, tzinfo
from uuid import UUID

APPOINTMENT_TYPES = ("first_consultation", "return_consultation", "assessment")
MINUTES_PER_DAY = 24 * 60


class AvailabilityError(Exception):
    """Horário que não pode ser usado. `code` é estável e não carrega dado pessoal."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Window:
    weekday: int  # 0 = domingo
    start: int  # minutos desde 00:00 (horário local da clínica)
    end: int
    unit_id: UUID


@dataclass(frozen=True)
class Rules:
    step: int
    lunch: tuple[int, int] | None
    durations: Mapping[str, int]
    windows: tuple[Window, ...]

    @property
    def configured(self) -> bool:
        """Só se pode agendar com pelo menos uma faixa e as durações de TODOS os tipos."""
        return bool(self.windows) and all(kind in self.durations for kind in APPOINTMENT_TYPES)


@dataclass(frozen=True)
class Period:
    start: datetime
    end: datetime


@dataclass(frozen=True)
class Slot:
    start: datetime
    end: datetime
    unit_id: UUID


def _weekday(local: datetime) -> int:
    return (local.weekday() + 1) % 7  # Python: segunda = 0; aqui: domingo = 0


def _at(day: date, minutes: int, tz: tzinfo) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=tz) + timedelta(minutes=minutes)


def _minutes(local: datetime, day: date) -> int:
    return (local.date() - day).days * MINUTES_PER_DAY + local.hour * 60 + local.minute


def _find_window(rules: Rules, start: datetime, end: datetime, tz: tzinfo, unit_id: UUID | None) -> Window | None:
    local_start = start.astimezone(tz)
    day = local_start.date()
    begin, finish = _minutes(local_start, day), _minutes(end.astimezone(tz), day)
    weekday = _weekday(local_start)
    for window in rules.windows:
        if (
            window.weekday == weekday
            and window.start <= begin
            and window.end >= finish
            and (unit_id is None or window.unit_id == unit_id)
        ):
            return window
    return None


def containment_reason(
    rules: Rules, start: datetime, end: datetime, tz: tzinfo, blocks: Iterable[Period], unit_id: UUID | None = None
) -> str | None:
    """Por que o intervalo NÃO cabe na disponibilidade (None = cabe). Ignora grade, passado e outras consultas."""
    local_start, local_end = start.astimezone(tz), end.astimezone(tz)
    if end <= start or local_start.date() != (local_end - timedelta(microseconds=1)).date():
        return "invalid_interval"
    if _find_window(rules, start, end, tz, unit_id) is None:
        return "outside_working_hours"
    if rules.lunch:
        day = local_start.date()
        begin, finish = _minutes(local_start, day), _minutes(local_end, day)
        if begin < rules.lunch[1] and finish > rules.lunch[0]:
            return "lunch"
    if any(block.start < end and block.end > start for block in blocks):
        return "blocked"
    return None


def validate_booking(
    rules: Rules,
    appointment_type: str,
    start: datetime,
    tz: tzinfo,
    blocks: Iterable[Period],
    busy: Iterable[Period],
    now: datetime,
) -> Slot:
    """Valida um agendamento e devolve o horário que ele ocupa. Levanta AvailabilityError."""
    if not rules.configured:
        raise AvailabilityError("schedule_not_configured")
    end = start + timedelta(minutes=rules.durations[appointment_type])
    reason = containment_reason(rules, start, end, tz, blocks)
    if reason:
        raise AvailabilityError(reason)
    window = _find_window(rules, start, end, tz, None)
    assert window is not None  # garantido por containment_reason
    local = start.astimezone(tz)
    if local.second or local.microsecond or (_minutes(local, local.date()) - window.start) % rules.step:
        raise AvailabilityError("off_grid")
    if start <= now:
        raise AvailabilityError("past")
    if any(period.start < end and period.end > start for period in busy):
        raise AvailabilityError("slot_taken")
    return Slot(start=start, end=end, unit_id=window.unit_id)


def free_slots(
    rules: Rules,
    appointment_type: str,
    first_day: date,
    last_day: date,
    tz: tzinfo,
    blocks: Iterable[Period],
    busy: Iterable[Period],
    now: datetime,
) -> list[Slot]:
    """Horários de início livres para o tipo, entre duas datas (inclusive)."""
    if not rules.configured:
        return []
    duration = rules.durations[appointment_type]
    blocks, busy = list(blocks), list(busy)
    slots: list[Slot] = []
    day = first_day
    while day <= last_day:
        weekday = (day.weekday() + 1) % 7
        for window in (w for w in rules.windows if w.weekday == weekday):
            for begin in range(window.start, window.end - duration + 1, rules.step):
                start, end = _at(day, begin, tz), _at(day, begin + duration, tz)
                if start <= now:
                    continue
                if containment_reason(rules, start, end, tz, blocks, window.unit_id):
                    continue
                if any(period.start < end and period.end > start for period in busy):
                    continue
                slots.append(Slot(start=start, end=end, unit_id=window.unit_id))
        day += timedelta(days=1)
    return sorted(slots, key=lambda slot: slot.start)


def outside_reason(
    rules: Rules, start: datetime, end: datetime, tz: tzinfo, blocks: Iterable[Period], unit_id: UUID
) -> str | None:
    """Motivo de uma consulta EXISTENTE estar fora da disponibilidade atual (None = dentro)."""
    return containment_reason(rules, start, end, tz, blocks, unit_id)
