import { CalendarClock, CircleCheck, CircleDashed } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { FormField } from "@/components/shared/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  useOutsideAvailability,
  useSaveScheduleConfig,
  useScheduleConfig,
  useScheduleUnits,
} from "@/features/schedule/api"
import {
  APPOINTMENT_TYPES,
  formatDuration,
  START_STEPS,
  type ScheduleConfig,
  type ScheduleUnit,
  type StartStep,
} from "@/features/schedule/scheduleConfig"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

import { BlocksSection } from "./schedule/BlocksSection"
import { FieldError } from "./schedule/FieldError"
import { OutsideAvailabilityNotice } from "./schedule/OutsideAvailabilityNotice"
import { draftFromConfig, draftIssues, draftToPayload, type DayDraft, type ScheduleDraft } from "./schedule/scheduleDraft"
import { WeekdayRows } from "./schedule/WeekdayRows"

// 15 min a 4 h, de 15 em 15 (a API valida o mesmo intervalo).
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15)

function ScheduleForm({ config, units }: { config: ScheduleConfig; units: ScheduleUnit[] }) {
  const professionalId = config.professional_id
  const save = useSaveScheduleConfig(professionalId)
  const outside = useOutsideAvailability(professionalId)
  const initial = useMemo(() => draftFromConfig(config, units[0]?.id ?? ""), [config, units])
  const [draft, setDraft] = useState<ScheduleDraft>(initial)
  const [loaded, setLoaded] = useState(initial)
  const [serverError, setServerError] = useState<string>()

  // Recarrega o formulário quando a configuração salva muda (ex.: depois de salvar).
  if (loaded !== initial) {
    setLoaded(initial)
    setDraft(initial)
  }

  const { blocking, fields } = draftIssues(draft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const noUnit = units.length === 0

  const patchDraft = (patch: Partial<ScheduleDraft>) => setDraft((previous) => ({ ...previous, ...patch }))
  const patchDay = (weekday: number, patch: Partial<DayDraft>) =>
    setDraft((previous) => ({
      ...previous,
      days: { ...previous.days, [weekday]: { ...previous.days[weekday], ...patch } },
    }))

  function onSave() {
    setServerError(undefined)
    save.mutate(draftToPayload(draft), {
      onSuccess: (saved) => {
        toast.success(
          saved.affected_appointments.length
            ? "Agenda salva. Algumas consultas futuras ficaram fora da disponibilidade."
            : "Agenda salva.",
        )
      },
      onError: (error) => {
        setServerError(error instanceof ApiError ? error.message : "Não foi possível salvar a agenda.")
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Duração por tipo de atendimento</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {APPOINTMENT_TYPES.map(({ value, label }) => (
            <FormField key={value} id={`duration-${value}`} label={label}>
              {(control) => (
                <NativeSelect
                  {...control}
                  value={draft.durations[value]}
                  onChange={(event) =>
                    patchDraft({ durations: { ...draft.durations, [value]: event.target.value } })
                  }
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatDuration(minutes)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ))}
        </div>
        <p className="text-xs leading-4 text-muted-foreground">
          Mudar a duração vale só para novos agendamentos e remarcações; consultas já marcadas mantêm o horário.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          id="start-step"
          label="Horários de início a cada"
          hint="Contados a partir do começo do expediente de cada dia."
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.step}
              onChange={(event) => patchDraft({ step: Number(event.target.value) as StartStep })}
            >
              {START_STEPS.map((step) => (
                <option key={step} value={step}>
                  {step} minutos
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span id="lunch-label" className="text-[13px] leading-[18px] font-medium">
              Intervalo de almoço
            </span>
            <Switch
              checked={draft.lunchOn}
              onCheckedChange={(lunchOn) => patchDraft({ lunchOn })}
              aria-labelledby="lunch-label"
            />
          </div>
          {draft.lunchOn ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="time"
                aria-label="Almoço: início"
                aria-invalid={fields.lunch ? true : undefined}
                value={draft.lunchStart}
                onChange={(event) => patchDraft({ lunchStart: event.target.value })}
                className="h-10 rounded-xl font-data"
              />
              <Input
                type="time"
                aria-label="Almoço: fim"
                aria-invalid={fields.lunch ? true : undefined}
                value={draft.lunchEnd}
                onChange={(event) => patchDraft({ lunchEnd: event.target.value })}
                className="h-10 rounded-xl font-data"
              />
            </div>
          ) : (
            <p className="text-xs leading-4 text-muted-foreground">Sem intervalo: o expediente é contínuo.</p>
          )}
          <FieldError message={fields.lunch} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Dias e horários de atendimento</legend>
        {noUnit ? (
          <p role="alert" className="text-sm text-destructive">
            Nenhuma unidade vinculada à sua conta. Peça ao administrador para vincular você a uma unidade (Configurações → Unidades).
          </p>
        ) : (
          <WeekdayRows days={draft.days} errors={fields} units={units} onChange={patchDay} />
        )}
      </fieldset>

      <div className="flex flex-col gap-3">
        <FieldError message={serverError} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-xs leading-4", blocking && dirty ? "text-destructive" : "text-muted-foreground")}>
            {dirty ? (blocking ?? "Alterações não salvas.") : "Tudo salvo."}
          </p>
          <Button
            type="button"
            onClick={onSave}
            disabled={!dirty || !!blocking || save.isPending || noUnit}
            className="h-10 rounded-xl px-5"
          >
            {save.isPending ? "Salvando…" : "Salvar agenda"}
          </Button>
        </div>
      </div>

      {outside.data && <OutsideAvailabilityNotice appointments={outside.data} />}
    </div>
  )
}

/** Configuração da agenda do próprio nutricionista. A recepção não vê este cartão nem tem rota de escrita. */
export function MyScheduleCard({ professionalId }: { professionalId: string }) {
  const config = useScheduleConfig(professionalId)
  const units = useScheduleUnits()

  return (
    <section aria-labelledby="my-schedule-title" className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <CalendarClock className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 id="my-schedule-title" className="text-base leading-6 font-semibold">
              Minha Agenda
            </h3>
            <p className="text-xs leading-4 text-muted-foreground">
              A agenda da clínica usa estas regras. A recepção só agenda dentro delas.
            </p>
          </div>
        </div>
        {config.data && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              config.data.configured ? "bg-success/15 text-foreground" : "bg-warning/20 text-foreground",
            )}
          >
            {config.data.configured ? (
              <CircleCheck className="size-3.5 text-success" aria-hidden />
            ) : (
              <CircleDashed className="size-3.5 text-warning" aria-hidden />
            )}
            {config.data.configured ? "Configurada" : "Pendente"}
          </span>
        )}
      </div>

      {config.data && !config.data.configured && (
        <p role="status" className="rounded-xl bg-warning/15 px-4 py-3 text-sm">
          Enquanto a agenda estiver pendente, a recepção <strong>não consegue agendar</strong> consultas com você.
          Defina a duração dos três tipos de atendimento e ao menos um dia de atendimento.
        </p>
      )}

      {config.isError || units.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {(config.error ?? units.error)?.message}
        </p>
      ) : config.data && units.data ? (
        <>
          <ScheduleForm config={config.data} units={units.data} />
          <hr className="border-border/60" />
          <BlocksSection professionalId={professionalId} />
        </>
      ) : (
        <Skeleton className="h-64 rounded-xl" />
      )}
    </section>
  )
}
