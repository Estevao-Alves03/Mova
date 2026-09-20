import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type { Profile, ProfileUpdate, UserSession } from "./types"

export const profileKey = ["profile"] as const
export const sessionsKey = ["sessions"] as const

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: () => api<Profile>("/profile"),
    staleTime: 5 * 60 * 1000,
  })
}

/** Guarda a resposta da API (perfil completo) no cache. */
function useProfileCacheUpdater() {
  const queryClient = useQueryClient()
  return (profile: Profile) => queryClient.setQueryData(profileKey, profile)
}

export function useUpdateProfile() {
  const updateCache = useProfileCacheUpdater()
  return useMutation({
    mutationFn: (payload: ProfileUpdate) => api<Profile>("/profile", { method: "PATCH", json: payload }),
    onSuccess: updateCache,
  })
}

export function useUploadAvatar() {
  const updateCache = useProfileCacheUpdater()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return api<Profile>("/profile/avatar", { method: "POST", formData })
    },
    onSuccess: updateCache,
  })
}

export function useRemoveAvatar() {
  const updateCache = useProfileCacheUpdater()
  return useMutation({
    mutationFn: () => api<Profile>("/profile/avatar", { method: "DELETE" }),
    onSuccess: updateCache,
  })
}

export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () => api<UserSession[]>("/auth/sessions"),
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => api<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>("/auth/sessions", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })
}
