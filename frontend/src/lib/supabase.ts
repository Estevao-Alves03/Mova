import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ver .env.example).")
}

// supabase-js é usado somente para autenticação (login, logout, sessão, senha e 2FA).
// Todo dado passa pela API (lib/api.ts).
export const supabase = createClient(url, anonKey)

/**
 * Cliente descartável, sem persistência de sessão: serve para conferir a senha
 * atual sem alterar a sessão do usuário logado.
 */
export function createIsolatedClient() {
  return createClient(url!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "mova-isolated-auth",
    },
  })
}
