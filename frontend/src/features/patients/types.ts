// Formatos da API de pacientes (snake_case). A recepção NUNCA recebe `goal` (dado clínico).

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
