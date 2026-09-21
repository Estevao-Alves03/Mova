// Formatos da API (snake_case). Os eventos vêm do catálogo de Configurações > Notificações.
export type NotificationKind = "created" | "cancelled" | "rescheduled"

export interface AppNotification {
  id: string
  /** appointment_created, appointment_cancelled (cancelada ou remarcada) ou daily_summary */
  event: string
  kind: NotificationKind | null
  title: string
  body: string
  appointment_id: string | null
  /** Dia (YYYY-MM-DD) que a agenda abre ao clicar. */
  target_date: string | null
  read: boolean
  created_at: string
}

export interface NotificationFeed {
  unread_count: number
  items: AppNotification[]
}
