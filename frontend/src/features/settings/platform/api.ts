import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { UserRole } from "@/types/user"

import type { ClinicUnit, MemberCreated, TeamMember } from "./types"

export const teamKey = ["team"] as const
export const unitsKey = ["units"] as const

type StaffRole = Exclude<UserRole, "patient">

// Cadastros administrativos: a API só responde ao admin (o `enabled` evita chamadas inúteis a quem não é).
export function useTeam(enabled = true) {
  return useQuery({ queryKey: teamKey, queryFn: () => api<TeamMember[]>("/team"), enabled })
}

/** Quem é da equipe alimenta a agenda (lista de profissionais). */
function refreshTeam(queryClient: QueryClient) {
  // Devolve a promessa: a mutação só termina depois que a lista já foi atualizada.
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: teamKey }),
    queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  ])
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { full_name: string; email: string; role: StaffRole }) =>
      api<MemberCreated>("/team", { method: "POST", json: payload }),
    onSuccess: () => refreshTeam(queryClient),
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; full_name?: string; role?: StaffRole; active?: boolean }) =>
      api<TeamMember>(`/team/${id}`, { method: "PATCH", json: payload }),
    onSuccess: () => refreshTeam(queryClient),
  })
}

export function useAdminUnits(enabled = true) {
  return useQuery({ queryKey: unitsKey, queryFn: () => api<ClinicUnit[]>("/units"), enabled })
}

/** Unidades e salas alimentam a agenda (Minha Agenda, salas); qualquer mudança as atualiza. */
function refreshUnits(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: unitsKey }),
    queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  ])
}

export interface UnitFields {
  name: string
  address: string | null
  phone: string | null
  email: string | null
}

export function useCreateUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UnitFields) => api<ClinicUnit>("/units", { method: "POST", json: payload }),
    onSuccess: () => refreshUnits(queryClient),
  })
}

export function useUpdateUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<UnitFields> & { active?: boolean }) =>
      api<ClinicUnit>(`/units/${id}`, { method: "PATCH", json: payload }),
    onSuccess: () => refreshUnits(queryClient),
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, name }: { unitId: string; name: string }) =>
      api<ClinicUnit>(`/units/${unitId}/rooms`, { method: "POST", json: { name } }),
    onSuccess: () => refreshUnits(queryClient),
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, roomId, ...payload }: { unitId: string; roomId: string; name?: string; active?: boolean }) =>
      api<ClinicUnit>(`/units/${unitId}/rooms/${roomId}`, { method: "PATCH", json: payload }),
    onSuccess: () => refreshUnits(queryClient),
  })
}

/** O admin decide quais nutricionistas atendem em cada unidade. */
export function useLinkMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, membershipId }: { unitId: string; membershipId: string }) =>
      api<ClinicUnit>(`/units/${unitId}/members`, { method: "POST", json: { membership_id: membershipId } }),
    onSuccess: () => refreshUnits(queryClient),
  })
}

export function useUnlinkMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, membershipId }: { unitId: string; membershipId: string }) =>
      api<ClinicUnit>(`/units/${unitId}/members/${membershipId}`, { method: "DELETE" }),
    onSuccess: () => refreshUnits(queryClient),
  })
}
