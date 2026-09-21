import { zodResolver } from "@hookform/resolvers/zod"
import { BadgeCheck, Pencil, User } from "lucide-react"
import { useEffect, useState } from "react"
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

import { useUpdateMember } from "../api"
import { applyApiError } from "../formErrors"
import type { TeamMember } from "../types"

const ROLES = ["nutritionist", "receptionist", "admin"] as const

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(120, "O nome deve ter no máximo 120 caracteres."),
  role: z.enum(ROLES),
})
type EditFormValues = z.infer<typeof schema>

interface EditMemberDialogProps {
  member: TeamMember | null
  onClose: () => void
}

export function EditMemberDialog({ member, onClose }: EditMemberDialogProps) {
  const update = useUpdateMember()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, reset, setError, formState } = useForm<EditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", role: "nutritionist" },
  })
  const { errors } = formState

  useEffect(() => {
    if (member) reset({ full_name: member.full_name, role: member.role as EditFormValues["role"] })
  }, [member, reset])

  function close() {
    setFormError(undefined)
    onClose()
  }

  const onSubmit = handleSubmit((values) => {
    if (!member) return
    setFormError(undefined)
    update.mutate(
      {
        id: member.id,
        ...(values.full_name !== member.full_name ? { full_name: values.full_name } : {}),
        ...(values.role !== member.role ? { role: values.role } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Dados atualizados.")
          close()
        },
        onError: (error) => setFormError(applyApiError(error, setError, ["full_name", "role"])),
      },
    )
  })

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Pencil className="size-[18px]" aria-hidden />
            </span>
            Editar membro
          </DialogTitle>
          <DialogDescription>{member?.email}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField id="edit-name" label="Nome completo *" error={errors.full_name?.message}>
            {(control) => <IconInput icon={User} autoComplete="off" {...control} {...register("full_name")} />}
          </FormField>

          <FormField
            id="edit-role"
            label="Função na clínica *"
            error={errors.role?.message}
            hint="Nutricionista com pacientes ou consultas futuras não pode mudar de função."
          >
            {(control) => (
              <div className="relative">
                <BadgeCheck
                  className="pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <NativeSelect className="pl-9" {...control} {...register("role")}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </FormField>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-xl bg-muted">
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending} className="rounded-xl font-semibold">
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
