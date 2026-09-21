import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, BadgeCheck, Mail, ShieldCheck, User, UserPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { FormField } from "@/components/shared/FormField"
import { IconInput } from "@/components/shared/IconInput"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { roleLabels } from "@/lib/roles"

import { useCreateMember } from "../api"
import { applyApiError } from "../formErrors"

const INVITE_ROLES = ["nutritionist", "receptionist", "admin"] as const

// Validação de conveniência; quem decide é a API.
const schema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(120, "O nome deve ter no máximo 120 caracteres."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  role: z.enum(INVITE_ROLES),
})
type InviteFormValues = z.infer<typeof schema>

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado com os dados do acesso criado (inclui a senha temporária, exibida uma única vez). */
  onCreated: (access: { fullName: string; email: string; password: string }) => void
}

export function InviteUserDialog({ open, onOpenChange, onCreated }: InviteUserDialogProps) {
  const create = useCreateMember()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, reset, setError, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", role: "nutritionist" },
  })
  const { errors } = formState

  function close(next: boolean) {
    if (!next) {
      reset()
      setFormError(undefined)
    }
    onOpenChange(next)
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined)
    create.mutate(values, {
      onSuccess: ({ member, temporary_password }) => {
        close(false)
        onCreated({ fullName: member.full_name, email: member.email, password: temporary_password })
      },
      onError: (error) => setFormError(applyApiError(error, setError, ["full_name", "email", "role"])),
    })
  })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Mail className="size-[18px]" aria-hidden />
            </span>
            Convidar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Cria o acesso com uma senha temporária, exibida uma única vez para você repassar à pessoa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField id="invite-name" label="Nome completo *" error={errors.full_name?.message}>
            {(control) => (
              <IconInput icon={User} placeholder="Ex: Juliana Martins" autoComplete="off" {...control} {...register("full_name")} />
            )}
          </FormField>

          <FormField
            id="invite-email"
            label="E-mail institucional ou de trabalho *"
            error={errors.email?.message}
            hint="É o login da pessoa."
          >
            {(control) => (
              <IconInput
                icon={AtSign}
                type="email"
                placeholder="juliana.martins@exemplo.com"
                autoComplete="off"
                {...control}
                {...register("email")}
              />
            )}
          </FormField>

          <FormField id="invite-role" label="Função na clínica *" error={errors.role?.message}>
            {(control) => (
              <div className="relative">
                <BadgeCheck
                  className="pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <NativeSelect className="pl-9" {...control} {...register("role")}>
                  {INVITE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </FormField>

          <div className="flex gap-2 rounded-xl bg-muted p-3">
            <ShieldCheck className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
            <p className="text-xs leading-4 text-muted-foreground">
              A função define o que a pessoa pode fazer no sistema. Ela nunca vem do login, e sim deste cadastro.
            </p>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)} className="rounded-xl bg-muted">
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending} className="rounded-xl font-semibold">
              <UserPlus className="size-4" aria-hidden />
              {create.isPending ? "Criando..." : "Criar acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
