import { Navigate } from "react-router"

import { useProfile } from "@/features/settings/api"

import { categoriesFor } from "./categories"

/** /app/settings abre na primeira categoria a que o papel do usuário tem acesso. */
export function SettingsIndex() {
  const { data: profile } = useProfile()
  const first = categoriesFor(profile?.role)[0]
  return first ? <Navigate to={first.path} replace /> : null
}
