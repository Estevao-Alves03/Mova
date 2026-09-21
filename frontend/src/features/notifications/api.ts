import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type { NotificationFeed } from "./types"

export const notificationsKey = ["notifications"] as const

/** Sem sockets: o sino consulta a API a cada 30 s (só com a aba visível) e ao voltar para a aba. */
export const POLL_INTERVAL_MS = 30_000

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => api<NotificationFeed>("/notifications?limit=30"),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })
}
