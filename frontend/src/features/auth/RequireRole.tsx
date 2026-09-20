import { Outlet, useOutletContext } from "react-router"

import { useProfile } from "@/features/settings/api"
import type { UserRole } from "@/types/user"

import { ForbiddenState } from "./ForbiddenState"

// Guarda de rota por papel: só UX. Quem protege os dados é o backend.
// Repassa o contexto do Outlet do layout pai (senão a rota filha não o recebe).
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { data: profile } = useProfile()
  const context = useOutletContext<unknown>()
  if (!profile) return null // o layout já garante o perfil carregado
  return roles.includes(profile.role) ? <Outlet context={context} /> : <ForbiddenState />
}
