import { zodResolver } from "@hookform/resolvers/zod"
import { DoorOpen } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"

import { useCreateRoom, useUpdateRoom } from "../api"
import { applyApiError } from "../formErrors"
import type { ClinicUnit, UnitRoom } from "../types"

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da sala.").max(100, "O nome deve ter no máximo 100 caracteres."),
})
type RoomFormValues = z.infer<typeof schema>

/** Sala em edição (`room`) ou nova sala da unidade (`room` ausente). Fechado quando `unit` é nulo. */
export interface RoomTarget {
  unit: ClinicUnit
  room?: UnitRoom
}

export function RoomDialog({ target, onClose }: { target: RoomTarget | null; onClose: () => void }) {
  const create = useCreateRoom()
  const update = useUpdateRoom()
  const [formError, setFormError] = useState<string>()
  // `null` = ainda não mexeu no interruptor: vale o estado atual da sala.
  const [activeChoice, setActiveChoice] = useState<boolean | null>(null)
  const { register, handleSubmit, reset, setError, formState } = useForm<RoomFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })
  const { errors } = formState
  const pending = create.isPending || update.isPending
  const active = activeChoice ?? target?.room?.active ?? true

  useEffect(() => {
    if (target) reset({ name: target.room?.name ?? "" })
  }, [target, reset])

  function close() {
    setFormError(undefined)
    setActiveChoice(null)
    onClose()
  }

  const onSubmit = handleSubmit((values) => {
    if (!target) return
    setFormError(undefined)
    const options = {
      onSuccess: () => {
        toast.success(target.room ? "Sala atualizada." : "Sala criada.")
        close()
      },
      onError: (error: unknown) => setFormError(applyApiError(error, setError, ["name"])),
    }
    if (target.room) {
      update.mutate(
        {
          unitId: target.unit.id,
          roomId: target.room.id,
          ...(values.name !== target.room.name ? { name: values.name } : {}),
          ...(active !== target.room.active ? { active } : {}),
        },
        options,
      )
    } else {
      create.mutate({ unitId: target.unit.id, name: values.name }, options)
    }
  })

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <DoorOpen className="size-[18px]" aria-hidden />
            </span>
            {target?.room ? "Gerenciar Sala" : "Adicionar Sala"}
          </DialogTitle>
          <DialogDescription>Unidade: {target?.unit.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField id="room-name" label="Nome da sala *" error={errors.name?.message}>
            {(control) => (
              <IconInput icon={DoorOpen} autoComplete="off" placeholder="Ex: Consultório 03" {...control} {...register("name")} />
            )}
          </FormField>

          {target?.room && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
              <div className="flex flex-col gap-0.5">
                <span id="room-active-label" className="text-[13px] leading-[18px] font-semibold">
                  Sala ativa
                </span>
                <span className="text-xs leading-4 text-muted-foreground">
                  Salas inativas não podem ser usadas em novos agendamentos.
                </span>
              </div>
              <Switch checked={active} onCheckedChange={setActiveChoice} aria-labelledby="room-active-label" />
            </div>
          )}

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
              {pending ? "Salvando..." : target?.room ? "Salvar" : "Adicionar sala"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
