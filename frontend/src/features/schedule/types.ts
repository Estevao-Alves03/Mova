export type AgendaView = "day" | "week" | "month"

// Só existem três tipos de atendimento (docs/produto.md); teleconsulta será uma modalidade futura, não um tipo.
export type EventKind = "first" | "return" | "anthropometry" | "break" | "block"

// `waiting` (em espera) e `in_progress` (em atendimento) ainda não existem no enum do banco.
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"

export interface ScheduleEvent {
  id: string
  kind: EventKind
  /** Nome do paciente, ou o rótulo do intervalo/bloqueio. */
  title: string
  professionalId: string
  roomId?: string
  start: Date
  end: Date
  /** Só para consultas (não para intervalos e bloqueios). */
  status?: AppointmentStatus
}

export interface Professional {
  id: string
  name: string
}

export interface Room {
  id: string
  name: string
}
