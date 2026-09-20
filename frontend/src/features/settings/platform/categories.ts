import { Bell, Building2, IdCard, type LucideIcon } from "lucide-react"

import type { UserRole } from "@/types/user"

export type SettingsCategoryPath = "team" | "notifications" | "units"

export interface SettingsCategory {
  path: SettingsCategoryPath
  title: string
  icon: LucideIcon
  /** platform: administração da clínica; personal: preferências do próprio usuário. */
  scope: "platform" | "personal"
  /** Papéis que acessam a categoria. Fonte única para menu, rotas e redirecionamento. */
  roles: UserRole[]
}

const ADMIN: UserRole[] = ["admin"]
const EVERYONE: UserRole[] = ["admin", "nutritionist", "receptionist", "patient"]

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { path: "team", title: "Equipe & Acesso", icon: IdCard, scope: "platform", roles: ADMIN },
  { path: "notifications", title: "Notificações", icon: Bell, scope: "personal", roles: EVERYONE },
  { path: "units", title: "Unidades & Consultórios", icon: Building2, scope: "platform", roles: ADMIN },
]

/** Quem enxerga o item "Configurações": quem acessa pelo menos uma categoria. */
export const SETTINGS_ROLES: UserRole[] = [...new Set(SETTINGS_CATEGORIES.flatMap((category) => category.roles))]

/** Só UX: a autorização de verdade é do backend. */
export function categoriesFor(role: UserRole | undefined) {
  return SETTINGS_CATEGORIES.filter((category) => !!role && category.roles.includes(role))
}

export function rolesFor(path: SettingsCategoryPath) {
  return SETTINGS_CATEGORIES.find((category) => category.path === path)!.roles
}
