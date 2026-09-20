import {
  APPOINTMENT_TYPES,
  toMinutes,
  WEEKDAYS,
  type AppointmentType,
  type ScheduleConfig,
  type ScheduleConfigPayload,
  type StartStep,
} from "@/features/schedule/scheduleConfig"

export interface DayDraft {
  on: boolean
  start: string
  end: string
  unitId: string
}

/** Estado editável do formulário. Durações vazias = ainda não definidas. */
export interface ScheduleDraft {
  step: StartStep
  lunchOn: boolean
  lunchStart: string
  lunchEnd: string
  durations: Record<AppointmentType, string>
  days: Record<number, DayDraft>
}

const DEFAULT_START = "08:00"
const DEFAULT_END = "18:00"
const DEFAULT_LUNCH = { start: "12:00", end: "13:00" }

export function draftFromConfig(config: ScheduleConfig, fallbackUnitId: string): ScheduleDraft {
  const durations = Object.fromEntries(
    APPOINTMENT_TYPES.map(({ value }) => [value, config.durations[value] ? String(config.durations[value]) : ""]),
  ) as ScheduleDraft["durations"]

  const days: ScheduleDraft["days"] = {}
  for (const { value } of WEEKDAYS) {
    const saved = config.days.find((day) => day.weekday === value)
    days[value] = saved
      ? { on: true, start: saved.start, end: saved.end, unitId: saved.unit_id }
      : { on: false, start: DEFAULT_START, end: DEFAULT_END, unitId: fallbackUnitId }
  }

  return {
    step: config.start_step_minutes,
    lunchOn: config.lunch !== null,
    lunchStart: config.lunch?.start ?? DEFAULT_LUNCH.start,
    lunchEnd: config.lunch?.end ?? DEFAULT_LUNCH.end,
    durations,
    days,
  }
}

/** Dicas de preenchimento (UX). Quem valida de verdade é a API; o servidor sempre tem a palavra final. */
export function draftIssues(draft: ScheduleDraft): { blocking: string | null; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  if (draft.lunchOn && toMinutes(draft.lunchEnd) <= toMinutes(draft.lunchStart)) {
    fields.lunch = "O fim do almoço deve ser depois do início."
  }
  for (const { value } of WEEKDAYS) {
    const day = draft.days[value]
    if (day.on && toMinutes(day.end) <= toMinutes(day.start)) {
      fields[`day-${value}`] = "O fim deve ser depois do início."
    }
  }
  const missingDuration = APPOINTMENT_TYPES.some(({ value }) => !draft.durations[value])
  const noDay = !Object.values(draft.days).some((day) => day.on)
  const blocking = Object.keys(fields).length
    ? "Corrija os horários destacados."
    : missingDuration
      ? "Defina a duração dos três tipos de atendimento."
      : noDay
        ? "Escolha ao menos um dia de atendimento."
        : null
  return { blocking, fields }
}

export function draftToPayload(draft: ScheduleDraft): ScheduleConfigPayload {
  return {
    start_step_minutes: draft.step,
    lunch: draft.lunchOn ? { start: draft.lunchStart, end: draft.lunchEnd } : null,
    durations: Object.fromEntries(
      APPOINTMENT_TYPES.map(({ value }) => [value, Number(draft.durations[value])]),
    ) as Record<AppointmentType, number>,
    days: WEEKDAYS.filter(({ value }) => draft.days[value].on).map(({ value }) => ({
      weekday: value,
      start: draft.days[value].start,
      end: draft.days[value].end,
      unit_id: draft.days[value].unitId,
    })),
  }
}
