import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type {
  AffectedAppointment,
  BlockPayload,
  ScheduleBlock,
  ScheduleConfig,
  ScheduleConfigPayload,
  ScheduleConfigSaved,
  ScheduleProfessional,
  ScheduleUnit,
  UnavailablePeriod,
} from "./scheduleConfig"

const base = (professionalId: string) => `/schedule/professionals/${professionalId}`

export const scheduleKeys = {
  all: ["schedule"] as const,
  config: (professionalId: string) => ["schedule", "config", professionalId] as const,
  blocks: (professionalId: string) => ["schedule", "blocks", professionalId] as const,
  outside: (professionalId: string) => ["schedule", "outside", professionalId] as const,
  unavailable: (professionalId: string, from: string, to: string) =>
    ["schedule", "unavailable", professionalId, from, to] as const,
}

export function useScheduleUnits() {
  return useQuery({
    queryKey: ["schedule", "units"],
    queryFn: () => api<ScheduleUnit[]>("/schedule/units"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useScheduleProfessionals() {
  return useQuery({
    queryKey: ["schedule", "professionals"],
    queryFn: () => api<ScheduleProfessional[]>("/schedule/professionals"),
    staleTime: 5 * 60 * 1000,
  })
}

export function scheduleConfigQuery(professionalId: string) {
  return {
    queryKey: scheduleKeys.config(professionalId),
    queryFn: () => api<ScheduleConfig>(`${base(professionalId)}/config`),
    staleTime: 60 * 1000,
  }
}

export function useScheduleConfig(professionalId: string) {
  return useQuery(scheduleConfigQuery(professionalId))
}

export function unavailablePeriodsQuery(professionalId: string, from: string, to: string) {
  return {
    queryKey: scheduleKeys.unavailable(professionalId, from, to),
    queryFn: () =>
      api<UnavailablePeriod[]>(`${base(professionalId)}/unavailable-periods?from=${from}&to=${to}`),
    staleTime: 60 * 1000,
  }
}

/** Salvar não altera nenhuma consulta; a resposta só informa quais ficaram fora da disponibilidade. */
export function useSaveScheduleConfig(professionalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScheduleConfigPayload) =>
      api<ScheduleConfigSaved>(`${base(professionalId)}/config`, { method: "PUT", json: payload }),
    onSuccess: (saved) => {
      queryClient.setQueryData(scheduleKeys.config(professionalId), saved.config)
      queryClient.setQueryData(scheduleKeys.outside(professionalId), saved.affected_appointments)
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

/** Só o dono e o admin (a recepção não tem esta rota; ela usa os períodos indisponíveis, sem motivo). */
export function useScheduleBlocks(professionalId: string) {
  return useQuery({
    queryKey: scheduleKeys.blocks(professionalId),
    queryFn: () => api<ScheduleBlock[]>(`${base(professionalId)}/blocks`),
  })
}

export function useOutsideAvailability(professionalId: string) {
  return useQuery({
    queryKey: scheduleKeys.outside(professionalId),
    queryFn: () => api<AffectedAppointment[]>(`${base(professionalId)}/outside-availability`),
  })
}

export function useCreateBlock(professionalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: BlockPayload) =>
      api<ScheduleBlock>(`${base(professionalId)}/blocks`, { method: "POST", json: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  })
}

export function useDeleteBlock(professionalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) => api<void>(`${base(professionalId)}/blocks/${blockId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  })
}
