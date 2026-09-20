import type { UserRole } from "@/types/user"

export type MemberStatus = "active" | "invited" | "inactive"

export interface TeamMember {
  id: string
  fullName: string
  email: string
  role: UserRole
  crn?: string
  status: MemberStatus
  /** Texto pronto para exibição. */
  lastAccess: string
}

export interface UnitRoom {
  id: string
  name: string
  active: boolean
}

export interface ClinicUnit {
  id: string
  name: string
  address: string
  active: boolean
  hours: string
  phone: string
  email: string
  rooms: UnitRoom[]
}
