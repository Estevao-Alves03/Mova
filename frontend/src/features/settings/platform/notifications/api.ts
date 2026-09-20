import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useProfile } from "@/features/settings/api"
import { api } from "@/lib/api"
import type { UserRole } from "@/types/user"

import type { NotificationPreferencesResponse, Preferences } from "./types"

export const notificationPreferencesKey = ["notification-preferences"] as const

// Cada usuário só acessa as próprias preferências (o backend usa o token, não há id na rota).
// O paciente usa a rota /me, como todo o portal do paciente.
const pathFor = (role: UserRole | undefined) =>
  role === "patient" ? "/me/notification-preferences" : "/notification-preferences"

export function useNotificationPreferences() {
  const { data: profile } = useProfile()
  return useQuery({
    queryKey: notificationPreferencesKey,
    queryFn: () => api<NotificationPreferencesResponse>(pathFor(profile?.role)),
    enabled: !!profile,
  })
}

export function useSaveNotificationPreferences() {
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: Preferences) =>
      api<NotificationPreferencesResponse>(pathFor(profile?.role), { method: "PUT", json: preferences }),
    onSuccess: (response) => queryClient.setQueryData(notificationPreferencesKey, response),
  })
}
