import type { UserRole } from "@/types/user"

// Formatos da API (snake_case), sem camada de conversão.
export interface AccountSummary {
  active_patients: number
  new_patients_this_month: number
  total_appointments: number
}

export interface Profile {
  id: string
  full_name: string
  email: string | null
  role: UserRole
  phone: string | null
  crn: string | null
  crn_state: string | null
  specialty: string | null
  bio: string | null
  avatar_url: string | null
  member_since: string
  active: boolean
  has_professional_fields: boolean
  crn_state_options: string[]
  account_summary: AccountSummary | null
}

export interface ProfileUpdate {
  full_name?: string
  phone?: string
  crn?: string
  crn_state?: string
  bio?: string
}

export interface UserSession {
  id: string
  device: string
  client: string
  kind: "laptop" | "phone" | "desktop"
  ip: string | null
  created_at: string
  last_active_at: string
  current: boolean
}
