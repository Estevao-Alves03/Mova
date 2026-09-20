import { addDays, startOfDay, toISODate } from "@/lib/date"

import { DEFAULT_GRID_END_HOUR, DEFAULT_GRID_START_HOUR } from "./categories"
import { toMinutes, type ScheduleConfig, type UnavailablePeriod } from "./scheduleConfig"
import type { ScheduleEvent } from "./types"

/** Expediente de um dia em minutos desde a meia-noite. */
export interface DayHours {
  start: number
  end: number
}

export interface ScheduleSource {
  professionalId: string
  config: ScheduleConfig
  periods: UnavailablePeriod[]
}

export function dayHours(config: ScheduleConfig, day: Date): DayHours | null {
  const window = config.days.find((item) => item.weekday === day.getDay())
  return window ? { start: toMinutes(window.start), end: toMinutes(window.end) } : null
}

/** Com vários profissionais, o expediente do dia é a união (do primeiro início ao último fim). */
export function unionHours(sources: ScheduleSource[], day: Date): DayHours | null {
  const all = sources.map((source) => dayHours(source.config, day)).filter((hours): hours is DayHours => !!hours)
  if (all.length === 0) return null
  return { start: Math.min(...all.map((hours) => hours.start)), end: Math.max(...all.map((hours) => hours.end)) }
}

/** Faixa de horas da grade: cobre todos os expedientes visíveis (padrão 08–18h se não houver nenhum). */
export function gridBounds(sources: ScheduleSource[], days: Date[]) {
  const hours = days.map((day) => unionHours(sources, day)).filter((item): item is DayHours => !!item)
  if (hours.length === 0) return { startHour: DEFAULT_GRID_START_HOUR, endHour: DEFAULT_GRID_END_HOUR }
  return {
    startHour: Math.floor(Math.min(...hours.map((item) => item.start)) / 60),
    endHour: Math.ceil(Math.max(...hours.map((item) => item.end)) / 60),
  }
}

const at = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60)

/**
 * Almoço e bloqueios como eventos da grade. Os bloqueios chegam já sem motivo (API para quem só
 * agenda), então nenhum texto pessoal pode aparecer aqui; ficam limitados ao expediente do dia.
 */
export function buildStructureEvents(sources: ScheduleSource[], range: { start: Date; end: Date }): ScheduleEvent[] {
  const events: ScheduleEvent[] = []
  for (let day = startOfDay(range.start); day <= range.end; day = addDays(day, 1)) {
    const iso = toISODate(day)
    const dayStart = at(day, 0)
    const dayEnd = at(day, 24 * 60)
    for (const { professionalId, config, periods } of sources) {
      const hours = dayHours(config, day)
      if (!hours) continue

      if (config.lunch) {
        const from = Math.max(toMinutes(config.lunch.start), hours.start)
        const to = Math.min(toMinutes(config.lunch.end), hours.end)
        const lunchStart = at(day, from).getTime()
        const lunchEnd = at(day, to).getTime()
        // Se um bloqueio já cobre o almoço inteiro, a faixa de bloqueio basta.
        const covered = periods.some(
          (period) => new Date(period.starts_at).getTime() <= lunchStart && new Date(period.ends_at).getTime() >= lunchEnd,
        )
        if (to > from && !covered) {
          events.push({
            id: `${professionalId}:${iso}:lunch`,
            kind: "break",
            title: "Intervalo / Almoço",
            professionalId,
            start: at(day, from),
            end: at(day, to),
          })
        }
      }

      periods.forEach((period, index) => {
        const from = Math.max(new Date(period.starts_at).getTime(), dayStart.getTime(), at(day, hours.start).getTime())
        const to = Math.min(new Date(period.ends_at).getTime(), dayEnd.getTime(), at(day, hours.end).getTime())
        if (to > from) {
          events.push({
            id: `${professionalId}:${iso}:block:${index}`,
            kind: "block",
            title: period.label,
            professionalId,
            start: new Date(from),
            end: new Date(to),
          })
        }
      })
    }
  }
  return events
}
