import { useQueryClient } from "@tanstack/react-query"
import type { Session } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { supabase } from "@/lib/supabase"

import { AuthContext, type AuthStatus } from "./AuthContext"

async function resolveStatus(session: Session | null): Promise<AuthStatus> {
  if (!session) return "signedOut"
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") return "mfa"
  return "signedIn"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<{ status: AuthStatus; session: Session | null }>({
    status: "loading",
    session: null,
  })

  useEffect(() => {
    let active = true

    async function sync(session: Session | null) {
      const status = await resolveStatus(session)
      if (active) setState({ status, session })
    }

    void supabase.auth.getSession().then(({ data }) => sync(data.session))

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") queryClient.clear()
      // Não chamar o Supabase de dentro do callback (risco de deadlock): adia um tick.
      setTimeout(() => void sync(session), 0)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    // Só este dispositivo; as demais sessões são gerenciadas em "Sessões Ativas".
    await supabase.auth.signOut({ scope: "local" })
  }, [])

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
