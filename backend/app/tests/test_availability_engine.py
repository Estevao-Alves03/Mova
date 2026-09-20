"""Motor de disponibilidade (puro, sem banco), com o exemplo do pedido do produto."""

import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.modules.schedule.availability import (
    AvailabilityError,
    Period,
    Rules,
    Window,
    containment_reason,
    free_slots,
    outside_reason,
    validate_booking,
)

TZ = ZoneInfo("America/Sao_Paulo")
UNIT = uuid.uuid4()
DURATIONS = {"first_consultation": 90, "return_consultation": 60, "assessment": 60}

# 2030-01-07 é uma segunda-feira (tudo no futuro).
MON, TUE, WED, THU, FRI = (date(2030, 1, 7 + i) for i in range(5))
NOW = datetime(2029, 12, 1, 12, 0, tzinfo=TZ)


def hm(hours: int, minutes: int = 0) -> int:
    return hours * 60 + minutes


def rules(step: int = 30, lunch=(hm(12), hm(14)), durations=None, windows=None) -> Rules:
    default_windows = (
        Window(1, hm(8), hm(18), UNIT),   # segunda 08–12 e 14–18 (almoço 12–14)
        Window(2, hm(8), hm(12), UNIT),   # terça 08–12
        Window(4, hm(14), hm(18), UNIT),  # quinta 14–18
        Window(5, hm(8), hm(17), UNIT),   # sexta 08–12 e 14–17
    )
    return Rules(
        step=step,
        lunch=lunch,
        durations=DURATIONS if durations is None else durations,
        windows=default_windows if windows is None else windows,
    )


def at(day: date, hours: int, minutes: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hours, minutes, tzinfo=TZ)


def starts(slots) -> list[str]:
    return [slot.start.astimezone(TZ).strftime("%H:%M") for slot in slots]


def free(kind: str, day: date, **kwargs):
    return free_slots(
        kwargs.pop("rules", rules()), kind, day, day, TZ, kwargs.pop("blocks", []), kwargs.pop("busy", []), NOW
    )


# ---------------------------------------------------------------- o exemplo do pedido

def test_monday_return_60_uses_both_windows_and_skips_lunch():
    assert starts(free("return_consultation", MON)) == [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",   # último termina 12:00
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",   # último termina 18:00
    ]


def test_monday_first_consultation_90_never_invades_lunch_or_overruns_the_day():
    assert starts(free("first_consultation", MON)) == [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",             # 10:30 termina 12:00
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",             # 16:30 termina 18:00
    ]


def test_tuesday_only_morning():
    assert starts(free("return_consultation", TUE)) == ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]


def test_wednesday_does_not_work():
    assert free("return_consultation", WED) == []


def test_thursday_only_afternoon():
    assert starts(free("return_consultation", THU))[0] == "14:00"
    assert starts(free("return_consultation", THU))[-1] == "17:00"


def test_friday_afternoon_ends_at_17():
    assert starts(free("return_consultation", FRI))[-1] == "16:00"      # 16:00–17:00
    assert starts(free("first_consultation", FRI))[-1] == "15:30"       # 15:30–17:00


def test_each_type_uses_its_own_duration():
    slots = {kind: free(kind, MON)[0] for kind in DURATIONS}
    minutes = {kind: int((slot.end - slot.start).total_seconds() // 60) for kind, slot in slots.items()}
    assert minutes == DURATIONS


# ---------------------------------------------------------------- grade, blocos e consultas

@pytest.mark.parametrize("step", [15, 30, 60])
def test_grid_step(step):
    result = starts(free("return_consultation", TUE, rules=rules(step=step)))
    assert result[:3] == {15: ["08:00", "08:15", "08:30"], 30: ["08:00", "08:30", "09:00"], 60: ["08:00", "09:00", "10:00"]}[step]


def test_grid_is_anchored_to_the_window_start():
    custom = rules(windows=(Window(2, hm(8, 10), hm(12), UNIT),))
    assert starts(free("return_consultation", TUE, rules=custom)) == ["08:10", "08:40", "09:10", "09:40", "10:10", "10:40"]


def test_time_block_removes_overlapping_starts():
    block = Period(at(MON, 9), at(MON, 10))
    result = starts(free("return_consultation", MON, blocks=[block]))
    assert "09:00" not in result and "08:30" not in result and "09:30" not in result
    assert "08:00" in result and "10:00" in result


def test_day_off_removes_the_whole_day():
    off = Period(at(MON, 0), at(TUE, 0))
    assert free("return_consultation", MON, blocks=[off]) == []
    assert free("return_consultation", TUE, blocks=[off]) != []


def test_multi_day_block_covers_the_period():
    vacation = Period(at(MON, 0), at(WED, 0))
    assert free("return_consultation", MON, blocks=[vacation]) == []
    assert free("return_consultation", TUE, blocks=[vacation]) == []
    assert free("return_consultation", THU, blocks=[vacation]) != []


def test_existing_appointment_removes_its_real_interval():
    busy = Period(at(MON, 10), at(MON, 11, 30))                         # 90 min
    result = starts(free("return_consultation", MON, busy=[busy]))
    assert "09:30" not in result and "10:00" not in result and "11:00" not in result
    assert "09:00" in result and "11:30" not in result                  # 11:30–12:30 invade o almoço
    assert "14:00" in result


def test_past_slots_are_not_offered():
    now = at(MON, 9, 15)
    result = starts(free_slots(rules(), "return_consultation", MON, MON, TZ, [], [], now))
    assert result[0] == "09:30"


def test_no_lunch_configured():
    result = starts(free("return_consultation", MON, rules=rules(lunch=None, windows=(Window(1, hm(8), hm(18), UNIT),))))
    assert "12:00" in result and "13:00" in result


def test_timezone_conversion_from_utc():
    utc_start = datetime(2030, 1, 7, 13, 0, tzinfo=timezone.utc)          # 10:00 em São Paulo
    slot = validate_booking(rules(), "return_consultation", utc_start, TZ, [], [], NOW)
    assert slot.start.astimezone(TZ).hour == 10 and slot.end - slot.start == timedelta(minutes=60)


# ---------------------------------------------------------------- configuração obrigatória

@pytest.mark.parametrize(
    "custom",
    [rules(durations={}), rules(durations={"return_consultation": 60}), rules(windows=())],
)
def test_not_configured_blocks_everything(custom):
    assert not custom.configured
    assert free_slots(custom, "return_consultation", MON, MON, TZ, [], [], NOW) == []
    with pytest.raises(AvailabilityError) as error:
        validate_booking(custom, "return_consultation", at(MON, 10), TZ, [], [], NOW)
    assert error.value.code == "schedule_not_configured"


def test_configured_needs_all_three_types():
    assert rules().configured
    assert not rules(durations={"first_consultation": 90, "return_consultation": 60}).configured


# ---------------------------------------------------------------- validação de agendamento

def book(start: datetime, kind: str = "return_consultation", **kwargs):
    return validate_booking(
        kwargs.pop("rules", rules()), kind, start, TZ, kwargs.pop("blocks", []), kwargs.pop("busy", []), NOW
    )


def code(callable_, *args, **kwargs) -> str:
    with pytest.raises(AvailabilityError) as error:
        callable_(*args, **kwargs)
    return error.value.code


def test_valid_booking_returns_slot_with_the_types_duration():
    slot = book(at(MON, 10), "first_consultation")
    assert (slot.start, slot.end, slot.unit_id) == (at(MON, 10), at(MON, 11, 30), UNIT)


@pytest.mark.parametrize(
    ("start", "kind", "expected"),
    [
        (at(WED, 10), "return_consultation", "outside_working_hours"),      # não atende na quarta
        (at(TUE, 14), "return_consultation", "outside_working_hours"),      # terça só de manhã
        (at(MON, 7), "return_consultation", "outside_working_hours"),
        (at(MON, 17, 30), "return_consultation", "outside_working_hours"),  # termina 18:30
        (at(MON, 11, 30), "return_consultation", "lunch"),                  # 11:30–12:30
        (at(MON, 13), "return_consultation", "lunch"),
        (at(MON, 10, 30), "first_consultation", None),                      # 10:30–12:00 ok
        (at(MON, 11), "first_consultation", "lunch"),                       # 11:00–12:30
        (at(MON, 10, 15), "return_consultation", "off_grid"),
        (at(FRI, 16, 30), "return_consultation", "outside_working_hours"),  # termina 17:30
    ],
)
def test_booking_reasons(start, kind, expected):
    if expected is None:
        assert book(start, kind)
    else:
        assert code(book, start, kind) == expected


def test_booking_blocked_by_block_and_taken_by_appointment():
    assert code(book, at(MON, 9), blocks=[Period(at(MON, 9), at(MON, 10))]) == "blocked"
    assert code(book, at(MON, 9, 30), busy=[Period(at(MON, 9), at(MON, 10))]) == "slot_taken"
    assert book(at(MON, 10), busy=[Period(at(MON, 9), at(MON, 10))])     # encostado, sem sobrepor


def test_booking_in_the_past_and_with_seconds():
    assert code(validate_booking, rules(), "return_consultation", at(MON, 10), TZ, [], [], at(MON, 10)) == "past"
    assert code(book, at(MON, 10).replace(second=30)) == "off_grid"


# ---------------------------------------------------------------- consultas existentes

def test_outside_reason_flags_existing_appointments_without_touching_them():
    current = rules()
    assert outside_reason(current, at(MON, 10), at(MON, 11), TZ, [], UNIT) is None
    assert outside_reason(current, at(WED, 10), at(WED, 11), TZ, [], UNIT) == "outside_working_hours"
    assert outside_reason(current, at(MON, 12), at(MON, 13), TZ, [], UNIT) == "lunch"
    assert outside_reason(current, at(MON, 10), at(MON, 11), TZ, [Period(at(MON, 10), at(MON, 11))], UNIT) == "blocked"
    assert outside_reason(current, at(MON, 10), at(MON, 11), TZ, [], uuid.uuid4()) == "outside_working_hours"   # outra unidade


def test_existing_appointment_with_old_duration_still_fits_if_inside_hours():
    # 45 min criado quando a duração era 45; hoje o tipo dura 60. Continua dentro: ninguém o altera.
    assert outside_reason(rules(), at(MON, 10), at(MON, 10, 45), TZ, [], UNIT) is None


def test_containment_rejects_intervals_crossing_midnight():
    assert containment_reason(rules(), at(MON, 23), at(TUE, 1), TZ, [], UNIT) == "invalid_interval"
    assert containment_reason(rules(), at(MON, 10), at(MON, 9), TZ, [], UNIT) == "invalid_interval"
