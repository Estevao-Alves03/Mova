from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

HourMinute = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class SoundPreference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sound: str
    volume: int = Field(ge=0, le=100)


class QuietHours(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool
    start: HourMinute
    end: HourMinute
    days: Literal["weekdays", "every_day"]


class PreferencesUpdate(BaseModel):
    """PUT parcial: o que não for enviado mantém o valor atual. Só chaves conhecidas."""

    model_config = ConfigDict(extra="forbid")

    sounds_enabled: bool | None = None
    silence_during_appointment: bool | None = None
    sounds: dict[str, SoundPreference] | None = None
    events: dict[str, bool] | None = None
    quiet_hours: QuietHours | None = None


class PreferencesOut(BaseModel):
    sounds_enabled: bool
    silence_during_appointment: bool
    sounds: dict[str, SoundPreference]
    events: dict[str, bool]
    quiet_hours: QuietHours


class SoundSlot(BaseModel):
    id: str
    options: list[str]


class CatalogOut(BaseModel):
    events: list[str]
    sounds: list[SoundSlot]
    silence_during_appointment: bool


class NotificationPreferencesOut(BaseModel):
    catalog: CatalogOut
    defaults: PreferencesOut
    preferences: PreferencesOut
