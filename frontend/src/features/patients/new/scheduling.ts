import type { AvailabilitySlot } from "@/features/schedule/scheduleConfig"
import { addDays, isSameDay, MONTH_NAMES, MONTH_SHORT, startOfDay, toISODate, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/date"

/** Quantos dias à frente a etapa 2 consulta (a API aceita até 62). */
export const HORIZON_DAYS = 28
/** Dias exibidos antes de "Ver mais datas". */
export const INITIAL_DAYS = 7

const pad = (value: number) => String(value).padStart(2, "0")

export const slotTime = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Agrupa os horários pelo dia local (YYYY-MM-DD). */
export function groupByDay(slots: AvailabilitySlot[]) {
  const groups = new Map<string, AvailabilitySlot[]>()
  for (const slot of slots) {
    const key = toISODate(new Date(slot.starts_at))
    groups.set(key, [...(groups.get(key) ?? []), slot])
  }
  return groups
}

export function upcomingDays(today: Date, count: number) {
  const start = startOfDay(today)
  return Array.from({ length: count }, (_, index) => addDays(start, index))
}

/** "Hoje", "Amanhã" ou o dia da semana ("Quinta"). */
export function relativeLabel(day: Date, today: Date) {
  if (isSameDay(day, today)) return "Hoje"
  if (isSameDay(day, addDays(today, 1))) return "Amanhã"
  return WEEKDAY_NAMES[day.getDay()].split("-")[0]
}

/** "Ter, 22 Out" */
export const shortDay = (day: Date) => `${WEEKDAY_SHORT[day.getDay()]}, ${day.getDate()} ${MONTH_SHORT[day.getMonth()]}`

/** "Hoje às 16:30", "Amanhã às 09:00" ou "Qui, 24 Out às 14:00". */
export function nextSlotLabel(slot: AvailabilitySlot, today: Date) {
  const day = new Date(slot.starts_at)
  const label = isSameDay(day, today) || isSameDay(day, addDays(today, 1)) ? relativeLabel(day, today) : shortDay(day)
  return `${label} às ${slotTime(slot.starts_at)}`
}

/** "Terça-feira, 22 de Outubro às 16:30" */
export function longSlotLabel(slot: AvailabilitySlot) {
  const day = new Date(slot.starts_at)
  return `${WEEKDAY_NAMES[day.getDay()]}, ${day.getDate()} de ${MONTH_NAMES[day.getMonth()]} às ${slotTime(slot.starts_at)}`
}
