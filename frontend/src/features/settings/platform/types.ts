import type { UserRole } from "@/types/user"

// Formatos da API (snake_case), sem camada de conversão.

export type MemberStatus = "active" | "invited" | "inactive"

export interface TeamMember {
  id: string
  full_name: string
  email: string
  role: UserRole
  crn: string | null
  active: boolean
  /** inactive: desativado; invited: ainda não fez o primeiro acesso; active: já acessou. */
  status: MemberStatus
  last_sign_in_at: string | null
  is_you: boolean
}

export interface MemberCreated {
  member: TeamMember
  /** Vem uma única vez, só na resposta da criação. */
  temporary_password: string
}

export interface UnitRoom {
  id: string
  name: string
  active: boolean
}

/** Nutricionista vinculado à unidade pelo admin. */
export interface UnitMemberLink {
  id: string
  full_name: string
  active: boolean
}

export interface ClinicUnit {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  active: boolean
  rooms: UnitRoom[]
  members: UnitMemberLink[]
}
