import { useQueries, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { useProfile } from "@/features/settings/api"
import {
  addDays,
  addMonths,
  endOfMonth,
  fromISODate,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "@/lib/date"

import {
  agendaAppointmentsQuery,
  scheduleConfigQuery,
  unavailablePeriodsQuery,
  useScheduleProfessionals,
  useScheduleUnits,
} from "./api"
import { buildStructureEvents, dayHours, gridBounds, unionHours, type ScheduleSource } from "./agendaEvents"
import { CATEGORIES } from "./categories"
import type { AgendaAppointment, AppointmentType } from "./scheduleConfig"
import type { AgendaView, AppointmentStatus, EventKind, Professional, Room, ScheduleEvent } from "./types"

const VIEWS: AgendaView[] = ["day", "week", "month"]
export const ALL = "all"

const KIND_BY_TYPE: Record<AppointmentType, EventKind> = {
  first_consultation: "first",
  return_consultation: "return",
  assessment: "anthropometry",
}

/** Consulta da API -> evento da grade. */
function toEvent(appointment: AgendaAppointment): ScheduleEvent {
  return {
    id: appointment.id,
    kind: KIND_BY_TYPE[appointment.appointment_type],
    title: appointment.patient_name,
    professionalId: appointment.professional_id,
    roomId: appointment.room_id ?? undefined,
    start: new Date(appointment.starts_at),
    end: new Date(appointment.ends_at),
    status: appointment.status,
  }
}

function parseView(value: string | null): AgendaView {
  return VIEWS.includes(value as AgendaView) ? (value as AgendaView) : "week"
}

/** Período exibido: dia; semana (seg–sáb, ou até domingo se alguém atende aos domingos); mês (dom–sáb). */
export function getRange(view: AgendaView, date: Date, includeSunday = false) {
  if (view === "day") return { start: date, end: date }
  if (view === "week") {
    const monday = startOfWeek(date)
    return { start: monday, end: addDays(monday, includeSunday ? 6 : 5) }
  }
  const first = startOfMonth(date)
  const last = endOfMonth(date)
  return { start: addDays(first, -first.getDay()), end: addDays(last, 6 - last.getDay()) }
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export type StatusCounts = Record<"scheduled" | "confirmed" | "waiting" | "in_progress" | "completed", number>

export function useAgenda() {
  const { data: profile } = useProfile()
  const [params, setParams] = useSearchParams()
  const now = useNow()

  const view = parseView(params.get("view"))
  const date = fromISODate(params.get("date")) ?? startOfDay(now)

  function update(next: { view?: AgendaView; date?: Date }) {
    setParams(
      (previous) => {
        const query = new URLSearchParams(previous)
        if (next.view) query.set("view", next.view)
        if (next.date) query.set("date", toISODate(next.date))
        return query
      },
      { replace: true },
    )
  }

  // Permissões (docs/permissoes.md): o nutricionista só vê a própria agenda e não agenda. Quem filtra
  // é a API (`/schedule/professionals` já devolve só ele); aqui é só apresentação.
  const role = profile?.role
  const isNutritionist = role === "nutritionist"
  const canSchedule = role === "admin" || role === "receptionist"

  const professionalsQuery = useScheduleProfessionals()
  const professionals: Professional[] = useMemo(
    () => (professionalsQuery.data ?? []).map((item) => ({ id: item.id, name: item.full_name })),
    [professionalsQuery.data],
  )

  const [professionalChoice, setProfessionalChoice] = useState<string>()
  const professionalId = isNutritionist
    ? (professionals[0]?.id ?? ALL)
    : (professionalChoice ?? professionals[0]?.id ?? ALL)
  const [roomId, setRoomId] = useState<string>(ALL)
  const [enabledKinds, setEnabledKinds] = useState<Set<EventKind>>(
    () => new Set(CATEGORIES.map((category) => category.kind)),
  )
  const [selectedId, setSelectedId] = useState<string>()

  const visibleIds = useMemo(
    () => (professionalId === ALL ? professionals.map((item) => item.id) : [professionalId]),
    [professionalId, professionals],
  )

  // A configuração real (expediente, almoço, durações) define o que a agenda desenha.
  const configs = useQueries({ queries: visibleIds.map((id) => scheduleConfigQuery(id)) })
  const includeSunday = configs.some((query) => query.data?.days.some((day) => day.weekday === 0))

  const range = getRange(view, date, includeSunday)
  const rangeStart = range.start.getTime()
  const rangeEnd = range.end.getTime()

  const fromISO = toISODate(range.start)
  const toISO = toISODate(range.end)
  const periods = useQueries({ queries: visibleIds.map((id) => unavailablePeriodsQuery(id, fromISO, toISO)) })

  // As queries devolvem um array novo a cada render; a chave abaixo só muda quando os dados mudam.
  const dataKey = [...configs, ...periods].map((query) => query.dataUpdatedAt).join(",")
  const sources: ScheduleSource[] = useMemo(
    () =>
      visibleIds.flatMap((id, index) => {
        const config = configs[index]?.data
        return config ? [{ professionalId: id, config, periods: periods[index]?.data ?? [] }] : []
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleIds, dataKey],
  )

  const rangeDays = useMemo(() => {
    const days: Date[] = []
    for (let day = new Date(rangeStart); day <= new Date(rangeEnd); day = addDays(day, 1)) days.push(day)
    return days
  }, [rangeStart, rangeEnd])

  const grid = useMemo(() => gridBounds(sources, rangeDays), [sources, rangeDays])

  // Consultas reais: o nutricionista recebe só as próprias (a API filtra); recepção/admin, todas ou do profissional escolhido.
  const appointmentsQuery = useQuery({
    ...agendaAppointmentsQuery(fromISO, toISO, professionalId === ALL ? undefined : professionalId),
    enabled: !professionalsQuery.isPending,
  })
  const appointmentEvents = useMemo(() => (appointmentsQuery.data ?? []).map(toEvent), [appointmentsQuery.data])

  // Salas reais das unidades (a API já recorta as unidades do nutricionista).
  const unitsQuery = useScheduleUnits()
  const rooms: Room[] = useMemo(
    () => (unitsQuery.data ?? []).flatMap((unit) => unit.rooms.map((room) => ({ id: room.id, name: `${room.name} (${unit.name})` }))),
    [unitsQuery.data],
  )

  const events = useMemo(() => {
    const period = { start: new Date(rangeStart), end: new Date(rangeEnd) }
    return [...buildStructureEvents(sources, period), ...appointmentEvents].filter(
      (event) =>
        (!event.roomId || roomId === ALL || event.roomId === roomId) && enabledKinds.has(event.kind),
    )
  }, [sources, appointmentEvents, rangeStart, rangeEnd, roomId, enabledKinds])

  const pending = professionalsQuery.isPending || appointmentsQuery.isPending || configs.some((query) => query.isPending)
  const loadError =
    professionalsQuery.error ?? appointmentsQuery.error ?? configs.find((query) => query.error)?.error ?? undefined
  const unconfigured = sources
    .filter((source) => !source.config.configured)
    .map((source) => professionals.find((item) => item.id === source.professionalId)?.name ?? "")
  const durations = visibleIds.length === 1 ? sources[0]?.config.durations : undefined

  const statusCounts = useMemo(() => {
    const counts: StatusCounts = { scheduled: 0, confirmed: 0, waiting: 0, in_progress: 0, completed: 0 }
    for (const event of events) {
      if (!event.status || !(event.status in counts)) continue
      if (view === "month" && !isSameMonth(event.start, date)) continue
      counts[event.status as keyof StatusCounts]++
    }
    return counts
  }, [events, view, date])

  const selected: ScheduleEvent | undefined =
    events.find((event) => event.id === selectedId) ??
    (view === "month" ? undefined : events.find((event) => event.status === ("in_progress" satisfies AppointmentStatus)))

  function toggleKind(kind: EventKind) {
    setEnabledKinds((previous) => {
      const next = new Set(previous)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function shift(direction: 1 | -1) {
    const next =
      view === "day" ? addDays(date, direction) : view === "week" ? addDays(date, 7 * direction) : addMonths(date, direction)
    update({ date: next })
  }

  return {
    now,
    view,
    date,
    range,
    setView: (next: AgendaView) => update({ view: next }),
    setDate: (next: Date) => update({ date: next }),
    showDay: (next: Date) => update({ view: "day", date: next }),
    goToday: () => update({ date: startOfDay(new Date()) }),
    shift,
    professionals,
    professionalId,
    setProfessionalId: setProfessionalChoice,
    hoursFor: (day: Date) => unionHours(sources, day),
    isClosed: (day: Date) => sources.length > 0 && sources.every((source) => !dayHours(source.config, day)),
    grid,
    pending,
    loadError,
    unconfigured,
    durations,
    canPickProfessional: !isNutritionist,
    rooms,
    roomId,
    setRoomId,
    enabledKinds,
    toggleKind,
    events,
    statusCounts,
    selected,
    select: setSelectedId,
    role,
    canSchedule,
  }
}

export type Agenda = ReturnType<typeof useAgenda>
