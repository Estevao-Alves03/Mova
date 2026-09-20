// Formatos da API de agenda (snake_case) e constantes de apresentação.
// Quem valida e decide disponibilidade é o backend; aqui só se descreve e exibe.

export type AppointmentType = "first_consultation" | "return_consultation" | "assessment"

export const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "first_consultation", label: "1ª consulta" },
  { value: "return_consultation", label: "Retorno" },
  { value: "assessment", label: "Avaliação antropométrica" },
]

export type StartStep = 15 | 30 | 60
export const START_STEPS: StartStep[] = [15, 30, 60]

/** 0 = domingo (mesma convenção da API). Ordem de exibição: segunda a domingo. */
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
]

export interface DayConfig {
  weekday: number
  start: string
  end: string
  unit_id: string
}

export interface LunchConfig {
  start: string
  end: string
}

export interface ScheduleConfig {
  professional_id: string
  start_step_minutes: StartStep
  lunch: LunchConfig | null
  durations: Partial<Record<AppointmentType, number>>
  days: DayConfig[]
  configured: boolean
}

export interface ScheduleConfigPayload {
  start_step_minutes: StartStep
  lunch: LunchConfig | null
  durations: Record<AppointmentType, number>
  days: DayConfig[]
}

/** Consulta futura fora da disponibilidade atual. Só informativo: nada foi alterado. */
export interface AffectedAppointment {
  appointment_id: string
  patient_name: string
  appointment_type: AppointmentType
  starts_at: string
  ends_at: string
  reason: "invalid_interval" | "outside_working_hours" | "lunch" | "blocked"
}

export interface ScheduleConfigSaved {
  config: ScheduleConfig
  affected_appointments: AffectedAppointment[]
}

export type BlockKind = "day_off" | "time_block" | "cancellation_hold"

/** Visão do dono: inclui a nota pessoal, que a recepção nunca recebe. */
export interface ScheduleBlock {
  id: string
  kind: BlockKind
  starts_at: string
  ends_at: string
  reason: string | null
  source_appointment_id: string | null
}

export interface BlockPayload {
  kind: "day_off" | "time_block"
  date: string
  end_date?: string
  start_time?: string
  end_time?: string
  reason?: string
}

/** Período indisponível como a recepção enxerga: sem motivo, sem tipo, sem origem. */
export interface UnavailablePeriod {
  starts_at: string
  ends_at: string
  label: "Indisponível"
}

export interface ScheduleUnit {
  id: string
  name: string
}

export interface ScheduleProfessional {
  id: string
  full_name: string
}

export const OUTSIDE_REASON_LABELS: Record<AffectedAppointment["reason"], string> = {
  invalid_interval: "intervalo inválido",
  outside_working_hours: "fora do expediente",
  lunch: "dentro do almoço",
  blocked: "em período bloqueado",
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`
}

/** "08:30" -> 510 */
export function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}
