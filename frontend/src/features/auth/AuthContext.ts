import type { Session } from "@supabase/supabase-js"
import { createContext } from "react"

/**
 * loading   – verificando a sessão
 * signedOut – sem sessão
 * mfa       – senha correta, falta o código do 2FA (nível aal2)
 * signedIn  – autenticado
 */
export type AuthStatus = "loading" | "signedOut" | "mfa" | "signedIn"

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
