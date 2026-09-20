// Formatos da API (snake_case). Os identificadores vêm do catálogo do backend, por papel.
export interface SoundPreference {
  sound: string
  volume: number
}

export interface QuietHours {
  enabled: boolean
  start: string
  end: string
  days: "weekdays" | "every_day"
}

export interface Preferences {
  sounds_enabled: boolean
  silence_during_appointment: boolean
  sounds: Record<string, SoundPreference>
  events: Record<string, boolean>
  quiet_hours: QuietHours
}

export interface NotificationCatalog {
  events: string[]
  sounds: { id: string; options: string[] }[]
  silence_during_appointment: boolean
}

export interface NotificationPreferencesResponse {
  catalog: NotificationCatalog
  defaults: Preferences
  preferences: Preferences
}
