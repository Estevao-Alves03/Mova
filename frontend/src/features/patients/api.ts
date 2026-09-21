import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type { PatientGoal } from "./new/schema"
import type { PatientDetail, PatientDetailClinical, PatientListItem } from "./types"

export interface CreatePatientPayload {
  full_name: string
  birth_date: string | null
  sex: "female" | "male" | null
  phone: string
  email: string | null
  nutritionist_id: string
  first_appointment: {
    starts_at: string
    room_id: string | null
    goal: PatientGoal
    notes: string | null
  }
}

export interface CreatedPatient {
  patient: { id: string; full_name: string; nutritionist_id: string | null }
  appointment: { id: string; starts_at: string; ends_at: string; unit_id: string; room_id: string | null }
}

export const patientsKey = ["patients"] as const

/** Pacientes que o papel pode ver (a API filtra: o nutricionista só recebe os próprios; a recepção, sem dados clínicos). */
export function usePatients() {
  return useQuery({ queryKey: patientsKey, queryFn: () => api<PatientListItem[]>("/patients") })
}

/** Perfil de um paciente do escopo do papel (a API responde 404 para qualquer outro, sem distinguir o motivo). */
export function usePatient(patientId: string | undefined) {
  return useQuery({
    queryKey: [...patientsKey, patientId] as const,
    queryFn: () => api<PatientDetail | PatientDetailClinical>(`/patients/${patientId}`),
    enabled: !!patientId,
    // Um 404 não melhora ao tentar de novo.
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

/** Resultado da busca principal: só identificação e contato (nada clínico, para qualquer papel). */
export interface PatientSearchResult {
  id: string
  full_name: string
  birth_date: string | null
  sex: "female" | "male" | null
  phone: string | null
  email: string | null
}

export const MIN_SEARCH_LENGTH = 2

/** Busca por nome, telefone ou e-mail (a API aplica o escopo do papel e recorta os campos). */
export function usePatientSearch(term: string) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: [...patientsKey, "search", trimmed] as const,
    queryFn: () => api<PatientSearchResult[]>(`/patients/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    staleTime: 30 * 1000,
    // Enquanto a próxima busca carrega, a lista anterior continua na tela (sem piscar).
    placeholderData: keepPreviousData,
  })
}

/** Cadastra o paciente e agenda a 1ª consulta numa única operação (a API valida o horário). */
export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePatientPayload) => api<CreatedPatient>("/patients", { method: "POST", json: payload }),
    // O paciente entra na lista; o horário reservado sai da disponibilidade e entra na agenda.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: patientsKey }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
      ]),
  })
}
