import { toMinutes, type ScheduleConfig } from "@/features/schedule/scheduleConfig"
import type { AppointmentStatus, EventKind, Room, ScheduleEvent } from "@/features/schedule/types"
import { addDays, isSameDay, startOfDay, toISODate } from "@/lib/date"

// Consultas fictícias até a Fase B (agenda lendo consultas reais). O expediente, o almoço, a duração
// por tipo e os bloqueios NÃO são fictícios: vêm da configuração real do profissional, e as consultas
// geradas aqui só ocupam horários realmente disponíveis. Determinístico por dia e profissional.

/** Profissional com as regras reais que as consultas fictícias precisam respeitar. */
export interface MockSubject {
  id: string
  /** Posição na lista; define a sala de exemplo. */
  index: number
  config: ScheduleConfig
  /** Períodos indisponíveis (bloqueios), que nenhuma consulta pode invadir. */
  blocks: { start: Date; end: Date }[]
}

export const mockRooms: Room[] = [
  { id: "room-1", name: "Consultório 01 (Principal)" },
  { id: "room-2", name: "Consultório 02" },
  { id: "room-3", name: "Sala de Antropometria" },
]

const PATIENT_NAMES = [
  "Mariana Siqueira", "Tiago Mendes", "Beatriz Costa", "Lucas Arantes", "Diego Faria",
  "Carlos Eduardo Rocha", "Vanessa Toledo", "Gabriela Vasconcelos", "Rodrigo Mendes", "Camila Vasconcellos",
  "Juliana Matos", "Rodrigo Pires", "Aline Moura", "Marcos Vieira", "Larissa Melo", "Caio Cardoso",
  "Fernanda Lopes", "Renata Alves", "Paula Ribeiro", "Gabriel Souza", "Sofia Barros", "André Ramos",
  "Clara Nunes", "Felipe Duarte",
]

type AppointmentKind = Extract<EventKind, "first" | "return" | "anthropometry">

const KIND_TO_TYPE = {
  first: "first_consultation",
  return: "return_consultation",
  anthropometry: "assessment",
} as const

const KIND_WEIGHTS: [AppointmentKind, number][] = [
  ["return", 0.55],
  ["first", 0.25],
  ["anthropometry", 0.2],
]

function hash(text: string) {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

/** PRNG determinístico (mulberry32) a partir de um texto. */
function seededRandom(seed: string) {
  let state = hash(seed)()
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickKind(random: () => number): AppointmentKind {
  let roll = random()
  for (const [kind, weight] of KIND_WEIGHTS) {
    if ((roll -= weight) < 0) return kind
  }
  return "return"
}

type BaseEvent = Omit<ScheduleEvent, "status">

const ceilTo = (value: number, from: number, step: number) => from + Math.ceil((value - from) / step) * step

/** Consultas de um dia dentro do expediente, fora do almoço e dos bloqueios, em horários da grade. */
function buildDay(day: Date, subject: MockSubject): BaseEvent[] {
  const { config } = subject
  const window = config.days.find((item) => item.weekday === day.getDay())
  if (!config.configured || !window) return []

  const iso = toISODate(day)
  const random = seededRandom(`${iso}:${subject.id}`)
  const step = config.start_step_minutes
  const windowStart = toMinutes(window.start)
  const windowEnd = toMinutes(window.end)
  const lunch = config.lunch ? { start: toMinutes(config.lunch.start), end: toMinutes(config.lunch.end) } : null
  const rooms = ["room-1", "room-2"]
  const ownRoom = rooms[subject.index % rooms.length]
  const at = (minutes: number) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60)
  const blocked = (from: number, to: number) =>
    subject.blocks.some((block) => block.start < at(to) && block.end > at(from))

  const events: BaseEvent[] = []
  let cursor = windowStart + (random() < 0.5 ? 0 : step)
  while (cursor < windowEnd) {
    const kind = pickKind(random)
    const duration = config.durations[KIND_TO_TYPE[kind]]
    if (!duration) break
    cursor = ceilTo(cursor, windowStart, step)
    if (lunch && cursor < lunch.end && cursor + duration > lunch.start) {
      cursor = ceilTo(lunch.end, windowStart, step)
      continue
    }
    if (cursor + duration > windowEnd) break
    if (!blocked(cursor, cursor + duration)) {
      const patient = PATIENT_NAMES[Math.floor(random() * PATIENT_NAMES.length)]
      events.push({
        id: `${subject.id}:${iso}:${events.length}`,
        kind,
        title: patient,
        professionalId: subject.id,
        roomId: kind === "anthropometry" && subject.index === 0 ? "room-3" : ownRoom,
        start: at(cursor),
        end: at(cursor + duration),
      })
    }
    cursor += duration + (random() < 0.6 ? 0 : step * (1 + Math.floor(random() * 2)))
  }
  return events
}

function statusFor(event: BaseEvent, now: Date): AppointmentStatus {
  if (event.end <= now) return "completed"
  if (event.start <= now) return "in_progress"
  const minutesUntil = (event.start.getTime() - now.getTime()) / 60_000
  if (isSameDay(event.start, now) && minutesUntil <= 30) return "waiting"
  return seededRandom(event.id)() < 0.7 ? "confirmed" : "scheduled"
}

/** Consultas fictícias (só dentro da disponibilidade real) entre duas datas, inclusive. */
export function getMockAppointments(
  range: { start: Date; end: Date },
  now: Date,
  subjects: MockSubject[],
): ScheduleEvent[] {
  const events: ScheduleEvent[] = []
  for (let day = startOfDay(range.start); day <= range.end; day = addDays(day, 1)) {
    for (const subject of subjects) {
      for (const base of buildDay(day, subject)) events.push({ ...base, status: statusFor(base, now) })
    }
  }
  return events
}
