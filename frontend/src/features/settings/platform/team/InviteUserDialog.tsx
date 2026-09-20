import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, BadgeCheck, Mail, Send, ShieldCheck, User } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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

const INVITE_ROLES = ["nutritionist", "receptionist", "admin"] as const

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(120, "O nome deve ter no máximo 120 caracteres."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  role: z.enum(INVITE_ROLES),
})
type InviteFormValues = z.infer<typeof schema>

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Somente visual (docs/produto.md §12): valida o formulário, mas não envia e-mail.
export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { register, handleSubmit, reset, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", role: "nutritionist" },
  })
  const { errors } = formState

  function close(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const onSubmit = handleSubmit(() => {
    toast.info("Demonstração: o convite não foi enviado.", {
      description: "O envio de convites por e-mail ainda não está disponível.",
    })
    close(false)
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
            Envie um convite de acesso por e-mail. A pessoa receberá o link para criar a senha e preencher os
            dados pessoais no primeiro login.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            id="invite-name"
            label="Nome completo *"
            error={errors.full_name?.message}
            hint="Nome de identificação prévia na equipe."
          >
            {(control) => (
              <IconInput icon={User} placeholder="Ex: Juliana Martins" autoComplete="off" {...control} {...register("full_name")} />
            )}
          </FormField>

          <FormField
            id="invite-email"
            label="E-mail institucional ou de trabalho *"
            error={errors.email?.message}
            hint="O link de ativação será encaminhado para este endereço."
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
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] leading-[18px] font-semibold">Coleta autônoma pelo convidado</span>
              <span className="text-xs leading-4 text-muted-foreground">
                CPF, telefone de contato e credenciais de login serão configurados diretamente pelo usuário
                convidado ao aceitar o convite.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)} className="rounded-xl bg-muted">
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl font-semibold">
              <Send className="size-4" aria-hidden />
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
