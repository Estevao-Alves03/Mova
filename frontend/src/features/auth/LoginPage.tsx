import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, KeyRound } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Navigate, useLocation } from "react-router"
import { z } from "zod"

import { FormField } from "@/components/shared/FormField"
import { IconInput } from "@/components/shared/IconInput"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthLayout } from "@/layouts/AuthLayout"
import { supabase } from "@/lib/supabase"

import { useAuth } from "./useAuth"

const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
})
type Credentials = z.infer<typeof credentialsSchema>

const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Digite os 6 dígitos do código."),
})
type CodeForm = z.infer<typeof codeSchema>

function signInErrorMessage(code: string | undefined) {
  if (code === "invalid_credentials") return "E-mail ou senha incorretos."
  if (code === "over_request_rate_limit") return "Muitas tentativas. Aguarde alguns minutos."
  return "Não foi possível entrar. Tente novamente."
}

function CredentialsForm() {
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
  })

  async function onSubmit({ email, password }: Credentials) {
    setFormError(undefined)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setFormError(signInErrorMessage(error.code))
    // Sucesso: o AuthProvider detecta a sessão e a tela avança sozinha.
  }

  const { errors, isSubmitting } = formState
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField id="login-email" label="E-mail" error={errors.email?.message}>
        {(control) => (
          <IconInput
            icon={AtSign}
            type="email"
            autoComplete="username"
            placeholder="voce@clinica.com.br"
            {...control}
            {...register("email")}
          />
        )}
      </FormField>
      <FormField id="login-password" label="Senha" error={errors.password?.message}>
        {(control) => (
          <IconInput
            icon={KeyRound}
            type="password"
            autoComplete="current-password"
            {...control}
            {...register("password")}
          />
        )}
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="h-10 rounded-xl">
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  )
}

function MfaStep() {
  const { signOut } = useAuth()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  })

  async function onSubmit({ code }: CodeForm) {
    setFormError(undefined)
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp[0]
    if (listError || !factor) {
      setFormError("Não foi possível iniciar a verificação. Tente novamente.")
      return
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (error) setFormError("Código inválido ou expirado.")
    // Sucesso: a sessão sobe para aal2 e o AuthProvider libera o acesso.
  }

  const { errors, isSubmitting } = formState
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Digite o código de 6 dígitos gerado pelo seu app autenticador.
      </p>
      <FormField id="login-code" label="Código" error={errors.code?.message}>
        {(control) => (
          <IconInput
            icon={KeyRound}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="font-data tracking-widest"
            autoFocus
            {...control}
            {...register("code")}
          />
        )}
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="h-10 rounded-xl">
        {isSubmitting ? "Verificando..." : "Verificar"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => void signOut()} className="rounded-xl">
        Voltar
      </Button>
    </form>
  )
}

export function LoginPage() {
  const { status } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/app/dashboard"

  if (status === "signedIn") return <Navigate to={from} replace />
  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    )
  }

  return (
    <AuthLayout title={status === "mfa" ? "Verificação em duas etapas" : "Entrar"}>
      {status === "mfa" ? <MfaStep /> : <CredentialsForm />}
    </AuthLayout>
  )
}
