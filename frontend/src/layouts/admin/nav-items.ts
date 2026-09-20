import { SETTINGS_ROLES } from "@/features/settings/platform/categories"
import type { UserRole } from "@/types/user"
import {
  CalendarDays,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  to: string
  label: string
  /** Título no header, quando difere do rótulo do menu. */
  title?: string
  icon: LucideIcon
  /** Papéis que enxergam o item. Sem a lista, todos enxergam. */
  roles?: UserRole[]
}

export const navItems: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/schedule", label: "Agenda", icon: CalendarDays },
  {
    to: "/app/patients",
    label: "Pacientes / Clientes",
    title: "Pacientes e Clientes",
    icon: Users,
  },
  { to: "/app/settings", label: "Configurações", icon: Settings, roles: SETTINGS_ROLES },
]

/** Só UX: a autorização de verdade é do backend. */
export function canSeeNavItem(item: NavItem, role: UserRole | undefined) {
  return !item.roles || (!!role && item.roles.includes(role))
}

export function isNavItemActive(item: NavItem, pathname: string) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export const PROFILE_PATH = "/app/profile"

/** Título mostrado no breadcrumb do header para a rota atual. */
export function getPageTitle(pathname: string) {
  if (pathname === PROFILE_PATH) return "Perfil"
  const item = navItems.find((navItem) => isNavItemActive(navItem, pathname))
  return item ? (item.title ?? item.label) : undefined
}
