import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { availabilityQuery, useScheduleProfessionals, useScheduleUnits } from "@/features/schedule/api"
import type { AvailabilitySlot } from "@/features/schedule/scheduleConfig"
import { addDays, toISODate } from "@/lib/date"

import { groupByDay, HORIZON_DAYS } from "./scheduling"

/** O que a recepção já escolheu na etapa 2; o resto é derivado dos horários que a API devolve. */
export interface ScheduleSelection {
  professionalId?: string
  /** YYYY-MM-DD */
  date?: string
  /** `starts_at` do horário escolhido. */
  slot?: string
  roomId: string
}

export const EMPTY_SELECTION: ScheduleSelection = { roomId: "" }

/**
 * Nutricionistas, datas e horários da 1ª consulta, direto da disponibilidade real da agenda.
 * Sem escolha explícita, assume o profissional com o horário mais próximo e o primeiro dia dele
 * (o horário em si a recepção sempre escolhe).
 */
export function useSchedulingChoice(selection: ScheduleSelection, enabled: boolean) {
  const professionalsQuery = useScheduleProfessionals()
  const unitsQuery = useScheduleUnits()
  // Fixo enquanto a etapa está aberta; recalcula quando o modal reabre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [enabled])
  const from = toISODate(today)
  const to = toISODate(addDays(today, HORIZON_DAYS - 1))

  const professionals = useMemo(() => professionalsQuery.data ?? [], [professionalsQuery.data])
  const queries = useQueries({
    queries: professionals.map((professional) => ({
      ...availabilityQuery(professional.id, "first_consultation", from, to),
      enabled,
    })),
  })
  const entries = professionals.map((professional, index) => ({ professional, query: queries[index] }))

  const firstSlotOf = (index: number): AvailabilitySlot | undefined => queries[index]?.data?.slots[0]
  const earliest = entries
    .map((entry, index) => ({ entry, slot: firstSlotOf(index) }))
    .filter((item): item is { entry: (typeof entries)[number]; slot: AvailabilitySlot } => !!item.slot)
    .sort((a, b) => a.slot.starts_at.localeCompare(b.slot.starts_at))[0]

  const chosen = entries.find((entry) => entry.professional.id === selection.professionalId) ?? earliest?.entry
  const availability = chosen?.query.data
  const byDay = useMemo(() => groupByDay(availability?.slots ?? []), [availability])
  const dateKey = selection.date && byDay.has(selection.date) ? selection.date : [...byDay.keys()].sort()[0]
  const daySlots = dateKey ? (byDay.get(dateKey) ?? []) : []
  const slot = daySlots.find((item) => item.starts_at === selection.slot)
  const unit = unitsQuery.data?.find((item) => item.id === slot?.unit_id)
  const roomId = unit?.rooms.some((room) => room.id === selection.roomId) ? selection.roomId : ""

  return {
    today,
    entries,
    pending: professionalsQuery.isPending || queries.some((query) => query.isPending),
    error: professionalsQuery.error ?? queries.find((query) => query.error)?.error ?? unitsQuery.error ?? undefined,
    professional: chosen?.professional,
    availability,
    byDay,
    dateKey,
    daySlots,
    slot,
    unit,
    roomId,
  }
}

export type SchedulingChoice = ReturnType<typeof useSchedulingChoice>
