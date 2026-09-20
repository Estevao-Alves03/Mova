import { CalendarOff, Plus, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { FormField } from "@/components/shared/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateBlock, useDeleteBlock, useScheduleBlocks } from "@/features/schedule/api"
import type { BlockPayload, ScheduleBlock } from "@/features/schedule/scheduleConfig"
import { ApiError } from "@/lib/api"
import { toISODate } from "@/lib/date"

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" })
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })

function describe(block: ScheduleBlock) {
  const start = new Date(block.starts_at)
  const end = new Date(block.ends_at)
  if (block.kind === "time_block" || block.kind === "cancellation_hold") {
    return `${longDate.format(start)}, ${time.format(start)} às ${time.format(end)}`
  }
  // Folga de dia inteiro: o fim é a meia-noite do dia seguinte ao último dia bloqueado.
  const lastDay = new Date(end.getTime() - 1)
  const sameDay = toISODate(start) === toISODate(lastDay)
  return sameDay ? longDate.format(start) : `${longDate.format(start)} até ${longDate.format(lastDay)}`
}

const KIND_LABEL: Record<ScheduleBlock["kind"], string> = {
  day_off: "Dia inteiro",
  time_block: "Período",
  cancellation_hold: "Horário mantido após cancelamento",
}

interface BlockForm {
  kind: BlockPayload["kind"]
  date: string
  endDate: string
  startTime: string
  endTime: string
  reason: string
}

const emptyForm = (): BlockForm => ({
  kind: "day_off",
  date: toISODate(new Date()),
  endDate: "",
  startTime: "09:00",
  endTime: "10:00",
  reason: "",
})

/** Folgas e bloqueios futuros. A nota é pessoal: a recepção só enxerga "Indisponível". */
export function BlocksSection({ professionalId }: { professionalId: string }) {
  const blocks = useScheduleBlocks(professionalId)
  const create = useCreateBlock(professionalId)
  const remove = useDeleteBlock(professionalId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BlockForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const patch = (next: Partial<BlockForm>) => setForm((previous) => ({ ...previous, ...next }))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const payload: BlockPayload =
      form.kind === "day_off"
        ? { kind: "day_off", date: form.date, ...(form.endDate ? { end_date: form.endDate } : {}) }
        : { kind: "time_block", date: form.date, start_time: form.startTime, end_time: form.endTime }
    if (form.reason.trim()) payload.reason = form.reason.trim()

    setErrors({})
    create.mutate(payload, {
      onSuccess: () => {
        toast.success("Bloqueio adicionado.")
        setForm(emptyForm())
        setOpen(false)
      },
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors)
        else toast.error(error.message)
      },
    })
  }

  function onRemove(block: ScheduleBlock) {
    remove.mutate(block.id, {
      onSuccess: () => toast.success("Bloqueio removido."),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <section aria-labelledby="blocks-title" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h4 id="blocks-title" className="text-sm font-semibold">
            Folgas e bloqueios
          </h4>
          <p className="text-xs leading-4 text-muted-foreground">
            Dias ou horários específicos em que você não atende. Consultas já marcadas não são alteradas.
          </p>
        </div>
        {!open && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="rounded-xl">
            <Plus aria-hidden />
            Adicionar
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-border/60 p-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="block-kind" label="Tipo">
              {(control) => (
                <NativeSelect
                  {...control}
                  value={form.kind}
                  onChange={(event) => patch({ kind: event.target.value as BlockForm["kind"] })}
                >
                  <option value="day_off">Dia inteiro (folga)</option>
                  <option value="time_block">Período em um dia</option>
                </NativeSelect>
              )}
            </FormField>
            <FormField id="block-date" label={form.kind === "day_off" ? "Data inicial" : "Data"} error={errors.date}>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={form.date}
                  min={toISODate(new Date())}
                  onChange={(event) => patch({ date: event.target.value })}
                  className="h-10 rounded-xl"
                />
              )}
            </FormField>
            {form.kind === "day_off" ? (
              <FormField id="block-end-date" label="Data final (opcional)" error={errors.end_date}>
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={form.endDate}
                    min={form.date}
                    onChange={(event) => patch({ endDate: event.target.value })}
                    className="h-10 rounded-xl"
                  />
                )}
              </FormField>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FormField id="block-start" label="Das" error={errors.start_time}>
                  {(control) => (
                    <Input
                      {...control}
                      type="time"
                      value={form.startTime}
                      onChange={(event) => patch({ startTime: event.target.value })}
                      className="h-10 rounded-xl font-data"
                    />
                  )}
                </FormField>
                <FormField id="block-end" label="Até" error={errors.end_time}>
                  {(control) => (
                    <Input
                      {...control}
                      type="time"
                      value={form.endTime}
                      onChange={(event) => patch({ endTime: event.target.value })}
                      className="h-10 rounded-xl font-data"
                    />
                  )}
                </FormField>
              </div>
            )}
            <FormField
              id="block-reason"
              label="Nota pessoal (opcional)"
              hint="Só você vê. A recepção enxerga apenas “Indisponível”."
              error={errors.reason}
            >
              {(control) => (
                <Input
                  {...control}
                  value={form.reason}
                  maxLength={200}
                  onChange={(event) => patch({ reason: event.target.value })}
                  className="h-10 rounded-xl"
                />
              )}
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setErrors({})
              }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending} className="rounded-xl">
              {create.isPending ? "Salvando…" : "Bloquear"}
            </Button>
          </div>
        </form>
      )}

      {blocks.isPending ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : blocks.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {blocks.error.message}
        </p>
      ) : blocks.data.length === 0 ? (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Nenhuma folga ou bloqueio futuro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Folgas e bloqueios futuros">
          {blocks.data.map((block) => (
            <li key={block.id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
              <CalendarOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{describe(block)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {KIND_LABEL[block.kind]}
                  {block.reason ? ` · ${block.reason}` : ""}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={remove.isPending}
                onClick={() => onRemove(block)}
                aria-label={`Remover bloqueio de ${describe(block)}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
