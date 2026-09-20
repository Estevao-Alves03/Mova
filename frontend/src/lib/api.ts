import { supabase } from "@/lib/supabase"

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "")

export class ApiError extends Error {
  status: number
  /** Erros de validação por campo (422 do FastAPI): { campo: mensagem }. */
  fieldErrors: Record<string, string>
  /** Código de regra de negócio (ex.: "schedule_not_configured", "slot_taken"), quando a API envia um. */
  code?: string

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  json?: unknown
  formData?: FormData
}

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === "string") return new ApiError(status, detail)
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const { code, message } = detail as { code?: unknown; message?: unknown }
    return new ApiError(
      status,
      typeof message === "string" ? message : "Não foi possível concluir a operação.",
      {},
      typeof code === "string" ? code : undefined,
    )
  }
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {}
    for (const item of detail as { loc?: unknown[]; msg?: string }[]) {
      const field = item.loc?.[item.loc.length - 1]
      if (typeof field === "string" && item.msg && !(field in fieldErrors)) {
        // O Pydantic prefixa "Value error, " nas mensagens dos validadores.
        fieldErrors[field] = item.msg.replace(/^Value error, /, "")
      }
    }
    const first = Object.values(fieldErrors)[0]
    return new ApiError(status, first ?? "Dados inválidos.", fieldErrors)
  }
  return new ApiError(status, "Não foi possível concluir a operação.")
}

/**
 * Única camada de acesso à API: anexa o JWT da sessão Supabase, encerra a
 * sessão local em 401 (token inválido, sessão revogada) e expõe 403 como erro.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_URL) throw new Error("Defina VITE_API_URL (ver .env.example).")

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, "Sessão expirada. Entre novamente.")

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(options.json)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, { method: options.method ?? "GET", headers, body })
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.")
  }

  if (response.status === 401) {
    await supabase.auth.signOut({ scope: "local" })
    throw new ApiError(401, "Sessão expirada. Entre novamente.")
  }
  if (!response.ok) {
    throw parseError(response.status, await response.json().catch(() => null))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
