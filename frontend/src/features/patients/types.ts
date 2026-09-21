// Formatos da API de pacientes (snake_case). A recepção NUNCA recebe `goal` (dado clínico).

import type { AppointmentType } from "@/features/schedule/scheduleConfig"
import type { AppointmentStatus } from "@/features/schedule/types"

/** Derivada do histórico pela API: sem consulta concluída, em acompanhamento, ou >45 dias sem retorno agendado. */
export type PatientSituation = "first_visit" | "following" | "alert"

export type PatientSex = "female" | "male"

export interface PatientListItem {
  id: string
  full_name: string
  birth_date: string | null
  sex: PatientSex | null
  phone: string | null
  email: string | null
  nutritionist_id: string | null
  created_at: string
  situation: PatientSituation
  last_consultation_at: string | null
  next_appointment_at: string | null
  /** Objetivo informado na 1ª consulta. Só admin e nutricionista recebem esta chave. */
  goal?: string | null
}

// Perfil do paciente (`GET /patients/{id}`). A recepção recebe só o cadastro, o responsável e a unidade;
// as chaves clínicas (objetivo, consultas) só vêm para admin e nutricionista responsável.

export interface PatientNutritionist {
  id: string
  full_name: string
  crn: string | null
}

export interface PatientTimelineItem {
  id: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  starts_at: string
}

export interface PatientDetail {
  id: string
  full_name: string
  birth_date: string | null
  sex: PatientSex | null
  phone: string | null
  email: string | null
  created_at: string
  nutritionist: PatientNutritionist | null
  /** Vem da próxima consulta ativa (ou da mais recente): o paciente não tem unidade própria. */
  unit: { id: string; name: string } | null
  situation: PatientSituation
}

export interface PatientDetailClinical extends PatientDetail {
  goal: string | null
  initial_notes: string | null
  last_consultation_at: string | null
  next_appointment_at: string | null
  /** Consultas não canceladas, da mais antiga para a mais recente. */
  timeline: PatientTimelineItem[]
}

/** Decide pelo que a API entregou, não pelo papel: nunca se renderiza o que não veio. */
export const isClinical = (patient: PatientDetail): patient is PatientDetailClinical => "timeline" in patient
