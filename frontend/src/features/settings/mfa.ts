import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

export const mfaFactorsKey = ["mfa-factors"] as const

/** Fatores TOTP já verificados (2FA ativo = pelo menos um). */
export function useMfaFactors() {
  return useQuery({
    queryKey: mfaFactorsKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp
    },
  })
}

export interface TotpEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

/** Cria um novo fator TOTP (ainda não verificado), limpando tentativas pendentes antes. */
export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const { data: factors } = await supabase.auth.mfa.listFactors()
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Mova ${new Date().toISOString()}`,
    issuer: "Mova",
  })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}

export async function removeFactor(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}
