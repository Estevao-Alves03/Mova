import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck, KeyRound, Lock } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/shared/FormField"
import { IconInput } from "@/components/shared/IconInput"
import { Button } from "@/components/ui/button"
import { createIsolatedClient, supabase } from "@/lib/supabase"

const MIN_PASSWORD_LENGTH = 8

const schema = z
  .object({
    current_password: z.string().min(1, "Informe a senha atual."),
    new_password: z.string().min(MIN_PASSWORD_LENGTH, `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`),
    confirm_password: z.string().min(1, "Repita a nova senha."),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "As senhas não coincidem.",
  })
  .refine((v) => !v.new_password || v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "A nova senha deve ser diferente da atual.",
  })

type PasswordFormValues = z.infer<typeof schema>

interface PasswordFormProps {
  email: string
}

export function PasswordForm({ email }: PasswordFormProps) {
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  })
  const { register, handleSubmit, setError, reset, formState } = form
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    // 1) Confere a senha atual num cliente descartável, sem mexer na sessão atual.
    const checker = createIsolatedClient()
    const { error: signInError } = await checker.auth.signInWithPassword({
      email,
      password: current_password,
    })
    // scope "local": encerra só esta sessão descartável (o padrão, "global", derrubaria todas).
    await checker.auth.signOut({ scope: "local" })
    if (signInError) {
      if (signInError.code === "invalid_credentials") {
        setError("current_password", { message: "Senha atual incorreta." })
      } else {
        toast.error("Não foi possível verificar a senha atual. Tente novamente.")
      }
      return
    }

    // 2) Atualiza a senha da sessão atual.
    const { error } = await supabase.auth.updateUser({ password: new_password })
    if (error) {
      if (error.code === "same_password") {
        setError("new_password", { message: "A nova senha deve ser diferente da atual." })
      } else if (error.code === "weak_password") {
        setError("new_password", { message: "Senha fraca. Use uma senha mais forte." })
      } else {
        toast.error("Não foi possível atualizar a senha. Tente novamente.")
      }
      return
    }
    toast.success("Senha atualizada.")
    reset()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField id="password-current" label="Senha Atual" error={errors.current_password?.message}>
          {(control) => (
            <IconInput
              icon={KeyRound}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...control}
              {...register("current_password")}
            />
          )}
        </FormField>
        <FormField id="password-new" label="Nova Senha" error={errors.new_password?.message}>
          {(control) => (
            <IconInput
              icon={Lock}
              type="password"
              autoComplete="new-password"
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} dígitos`}
              {...control}
              {...register("new_password")}
            />
          )}
        </FormField>
        <FormField id="password-confirm" label="Confirmar Nova Senha" error={errors.confirm_password?.message}>
          {(control) => (
            <IconInput
              icon={CircleCheck}
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              {...control}
              {...register("confirm_password")}
            />
          )}
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={isSubmitting}
          className="h-9 rounded-xl px-4 text-[13px] font-medium"
        >
          {isSubmitting ? "Atualizando..." : "Atualizar senha"}
        </Button>
      </div>
    </form>
  )
}
