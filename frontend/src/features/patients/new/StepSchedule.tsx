import { CalendarCheck, CalendarDays, Info } from "lucide-react"
import { useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { fromISODate, toISODate } from "@/lib/date"
import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"

import { ModalityPicker } from "./ModalityPicker"
import { PatientSummaryCard } from "./PatientSummaryCard"
import type { BasicDataValues } from "./schema"
import { INITIAL_DAYS, HORIZON_DAYS, longSlotLabel, nextSlotLabel, relativeLabel, shortDay, slotTime, upcomingDays } from "./scheduling"
import type { ScheduleSelection, SchedulingChoice } from "./useSchedulingChoice"

interface StepScheduleProps {
  values: BasicDataValues
  choice: SchedulingChoice
  selection: ScheduleSelection
  /** Erro da API ao confirmar (horário ocupado, fora do expediente...). */
  submitError?: string
  onSelect: (patch: Partial<ScheduleSelection>) => void
  onEditBasic: () => void
}

function Heading({ children, aside, id }: { children: string; aside?: React.ReactNode; id: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span id={id} className="flex items-center gap-2 text-[11px] leading-4 font-semibold tracking-wider text-muted-foreground uppercase">
        <span className="size-2 rounded-full bg-primary" aria-hidden />
        {children}
      </span>
      {aside}
    </div>
  )
}

/** Etapa 2: profissional → data → horário, tudo da disponibilidade real da agenda. */
export function StepSchedule({ values, choice, submitError, onSelect, onEditBasic }: StepScheduleProps) {
  const [showAllDays, setShowAllDays] = useState(false)
  const { today, entries, byDay, dateKey, daySlots, slot, professional, availability } = choice
  const days = upcomingDays(today, showAllDays ? HORIZON_DAYS : INITIAL_DAYS)
  const selectedDay = dateKey ? fromISODate(dateKey) : null

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12">
      <div className="flex min-w-0 flex-col justify-between gap-6 bg-muted/30 p-6 lg:col-span-5">
        <div className="flex flex-col gap-4">
          <PatientSummaryCard values={values} onEdit={onEditBasic} />
          <ModalityPicker unit={choice.unit} roomId={choice.roomId} onRoomChange={(roomId) => onSelect({ roomId })} />
        </div>
        <p className="flex items-start gap-2 rounded-xl border border-border/80 bg-muted p-3 text-xs leading-4 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          O prontuário clínico detalhado (anamnese, histórico alimentar, medidas e bioimpedância) será registrado pelo
          nutricionista durante a consulta.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-5 border-t border-border p-6 lg:col-span-7 lg:border-t-0 lg:border-l">
        {submitError && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </p>
        )}
        {choice.error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {choice.error.message}
          </p>
        )}

        {/* 1. Profissional */}
        <section className="flex flex-col gap-2.5">
          <Heading
            id="np-prof-label"
            aside={<span className="text-[11px] text-muted-foreground">{entries.length} especialistas cadastrados</span>}
          >
            1. Selecione o Profissional:
          </Heading>
          {choice.pending && entries.length === 0 ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : entries.length === 0 ? (
            <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Nenhum nutricionista ativo na clínica.
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="np-prof-label" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {entries.map(({ professional: item, query }) => {
                const data = query.data
                const first = data?.slots[0]
                const selected = professional?.id === item.id
                const unavailable = !!data && (!data.configured || !first)
                const firstDayCount = first ? (byDayCount(data.slots, first.starts_at)) : 0
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={unavailable}
                    onClick={() => onSelect({ professionalId: item.id, date: undefined, slot: undefined })}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border-2 p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      selected ? "border-primary bg-accent" : "border-border bg-card hover:border-muted-foreground/40",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
                        )}
                      >
                        {getInitials(item.full_name)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] leading-[18px] font-bold">{item.full_name}</span>
                        <span className="truncate text-[11px] leading-[14px] text-muted-foreground">
                          {[item.specialty, item.crn && `(${item.crn})`].filter(Boolean).join(" ") || "Nutricionista"}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 border-t border-border/70 pt-1 text-[11px] leading-4">
                      {!data ? (
                        <span className="text-muted-foreground">Carregando horários…</span>
                      ) : !data.configured ? (
                        <span className="font-medium text-warning">Agenda não configurada</span>
                      ) : !first ? (
                        <span className="text-muted-foreground">Sem horários nos próximos {HORIZON_DAYS} dias</span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 font-medium text-success">
                            <span className="size-1.5 rounded-full bg-success" aria-hidden />
                            {nextSlotLabel(first, today)}
                          </span>
                          <span className="font-semibold text-primary">
                            {firstDayCount} {firstDayCount === 1 ? "horário" : "horários"}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* 2. Data */}
        <section className="flex flex-col gap-2.5">
          <Heading
            id="np-date-label"
            aside={
              <button
                type="button"
                onClick={() => setShowAllDays((value) => !value)}
                className="flex items-center gap-1 rounded text-[11px] font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {showAllDays ? "Ver menos datas" : "Ver mais datas"}
              </button>
            }
          >
            2. Data do Atendimento:
          </Heading>
          <div
            role="radiogroup"
            aria-labelledby="np-date-label"
            className={cn("flex gap-2 pb-1", showAllDays ? "flex-wrap" : "overflow-x-auto")}
          >
            {days.map((day) => {
              const key = toISODate(day)
              const count = byDay.get(key)?.length ?? 0
              const selected = key === dateKey
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${relativeLabel(day, today)}, ${shortDay(day)}, ${count ? `${count} horários` : "sem horários"}`}
                  disabled={count === 0}
                  onClick={() => onSelect({ date: key, slot: undefined })}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-xl px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : count === 0
                        ? "cursor-not-allowed border border-border bg-muted/50 text-muted-foreground/60"
                        : "bg-muted hover:bg-muted/70",
                  )}
                >
                  <span className={cn("text-[10px] leading-4 font-bold tracking-wider uppercase", !selected && "font-medium text-muted-foreground")}>
                    {relativeLabel(day, today)}
                  </span>
                  <span className="text-[13px] leading-[18px] font-bold">{shortDay(day)}</span>
                  <span
                    className={cn(
                      "text-[10px] leading-4 font-medium",
                      selected ? "opacity-90" : count >= 5 ? "text-success" : count >= 3 ? "text-muted-foreground" : count > 0 ? "text-warning" : "",
                    )}
                  >
                    {count === 0 ? "Sem horários" : `${count} ${count === 1 ? "horário" : "horários"}`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 3. Horário */}
        <section className="flex flex-col gap-2.5">
          <Heading id="np-time-label">
            {`3. Horário da Sessão${availability?.duration_minutes ? ` (Duração: ${availability.duration_minutes} min):` : ":"}`}
          </Heading>
          {daySlots.length === 0 ? (
            <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {professional ? "Escolha uma data com horários disponíveis." : "Escolha um profissional com agenda disponível."}
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="np-time-label" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {daySlots.map((item) => {
                const selected = item.starts_at === slot?.starts_at
                return (
                  <button
                    key={item.starts_at}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelect({ slot: item.starts_at })}
                    className={cn(
                      "flex h-9 items-center justify-center gap-1 rounded-lg font-data text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/70",
                    )}
                  >
                    {selected && <CalendarCheck className="size-3.5" aria-hidden />}
                    {slotTime(item.starts_at)}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {slot && professional && selectedDay && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarCheck className="size-5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] leading-4 font-bold tracking-wider text-accent-foreground uppercase">Primeira consulta para:</span>
              <span className="truncate text-[13px] leading-[18px] font-semibold">
                {professional.full_name} • {longSlotLabel(slot)}
              </span>
              <span className="truncate text-[11px] leading-4 text-muted-foreground">
                Presencial
                {choice.unit
                  ? ` (${choice.unit.name}${choice.roomId ? ` - ${choice.unit.rooms.find((room) => room.id === choice.roomId)?.name}` : ""})`
                  : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Quantos horários há no mesmo dia (local) do horário informado. */
function byDayCount(slots: { starts_at: string }[], reference: string) {
  const key = toISODate(new Date(reference))
  return slots.filter((item) => toISODate(new Date(item.starts_at)) === key).length
}
