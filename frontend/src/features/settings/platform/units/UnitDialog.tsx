import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Mail, MapPin, Phone } from "lucide-react"
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

import { useCreateUnit, useUpdateUnit } from "../api"
import { applyApiError } from "../formErrors"
import type { ClinicUnit } from "../types"

// Validação de conveniência; a API é quem decide.
const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da unidade.").max(100, "O nome deve ter no máximo 100 caracteres."),
  address: z.string().trim().max(200, "O endereço deve ter no máximo 200 caracteres."),
  phone: z.string().trim(),
  email: z.string().trim().refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "E-mail inválido."),
})
type UnitFormValues = z.infer<typeof schema>

const EMPTY: UnitFormValues = { name: "", address: "", phone: "", email: "" }

interface UnitDialogProps {
  open: boolean
  /** Unidade em edição; ausente = nova unidade. */
  unit?: ClinicUnit | null
  onClose: () => void
}

export function UnitDialog({ open, unit, onClose }: UnitDialogProps) {
  const create = useCreateUnit()
  const update = useUpdateUnit()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, reset, setError, formState } = useForm<UnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })
  const { errors } = formState
  const pending = create.isPending || update.isPending

  useEffect(() => {
    if (open) {
      reset(
        unit
          ? { name: unit.name, address: unit.address ?? "", phone: unit.phone ?? "", email: unit.email ?? "" }
          : EMPTY,
      )
    }
  }, [open, unit, reset])

  function close() {
    setFormError(undefined)
    onClose()
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined)
    const payload = {
      name: values.name,
      address: values.address || null,
      phone: values.phone || null,
      email: values.email || null,
    }
    const options = {
      onSuccess: () => {
        toast.success(unit ? "Unidade atualizada." : "Unidade criada.")
        close()
      },
      onError: (error: unknown) => setFormError(applyApiError(error, setError, ["name", "address", "phone", "email"])),
    }
    if (unit) update.mutate({ id: unit.id, ...payload }, options)
    else create.mutate(payload, options)
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Building2 className="size-[18px]" aria-hidden />
            </span>
            {unit ? "Editar Unidade" : "Nova Unidade"}
          </DialogTitle>
          <DialogDescription>
            O horário de atendimento é definido por cada nutricionista em Minha Agenda, não pela unidade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField id="unit-name" label="Nome da unidade *" error={errors.name?.message}>
            {(control) => <IconInput icon={Building2} autoComplete="off" {...control} {...register("name")} />}
          </FormField>
          <FormField id="unit-address" label="Endereço" error={errors.address?.message}>
            {(control) => <IconInput icon={MapPin} autoComplete="off" {...control} {...register("address")} />}
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="unit-phone" label="Telefone" error={errors.phone?.message}>
              {(control) => <IconInput icon={Phone} autoComplete="off" placeholder="(11) 3000-0000" {...control} {...register("phone")} />}
            </FormField>
            <FormField id="unit-email" label="E-mail" error={errors.email?.message}>
              {(control) => <IconInput icon={Mail} type="email" autoComplete="off" {...control} {...register("email")} />}
            </FormField>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-xl bg-muted">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="rounded-xl font-semibold">
              {pending ? "Salvando..." : unit ? "Salvar" : "Criar unidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
