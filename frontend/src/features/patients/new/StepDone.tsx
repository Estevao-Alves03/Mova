import { CalendarClock, CalendarDays, Check, ChevronRight, CircleCheck, ClipboardList, IdCard, MapPin, Stethoscope, Target, UserRound, Mail, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AvailabilitySlot, ScheduleUnit } from "@/features/schedule/scheduleConfig"
import { MONTH_NAMES } from "@/lib/date"
import { getInitials } from "@/lib/user"

import { getAge } from "../format"
import { PATIENT_GOALS, type BasicDataValues } from "./schema"
import { longSlotLabel } from "./scheduling"
import { parseBrazilianDate } from "@/lib/masks"

/** Tudo o que a tela final mostra, capturado no momento da confirmação (a agenda muda logo depois). */
export interface CreatedSummary {
  values: BasicDataValues
  professional: { full_name: string; specialty: string | null; crn: string | null }
  slot: AvailabilitySlot
  unit: ScheduleUnit | undefined
  roomName: string | undefined
}

interface StepDoneProps {
  summary: CreatedSummary
  onViewAgenda: () => void
  onClose: () => void
}

const CHECKS = [
  { title: "Dados Básicos", note: "Validado" },
  { title: "Profissional & Horário", note: "Reservado" },
] as const

/** Etapa 3: confirmação depois de gravar (paciente + 1ª consulta já existem). */
export function StepDone({ summary, onViewAgenda, onClose }: StepDoneProps) {
  const { values, professional, slot, unit, roomName } = summary
  const birth = parseBrazilianDate(values.birth_date)
  const goal = PATIENT_GOALS.find((item) => item.value === values.goal)
  const today = new Date()
  const minutes = Math.round((new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60_000)

  return (
    <div className="flex min-h-0 flex-col">
      <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-success via-primary to-sidebar-gradient-start" aria-hidden />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-8">
        {/* Etapas: as três concluídas */}
        <ol aria-label="Etapas do cadastro" className="rounded-xl bg-muted/60 p-4 md:p-5">
          <div className="mx-auto flex max-w-2xl items-start justify-between">
            {[...CHECKS, { title: "Confirmação", note: "Concluído com sucesso" }].flatMap((step, index) => [
              ...(index > 0 ? [<li key={`line-${index}`} aria-hidden className="mt-[17px] h-1 min-w-4 flex-1 rounded-full bg-success" />] : []),
              <li key={step.title} className="flex flex-col items-center gap-1.5 px-2 text-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-success text-primary-foreground shadow-sm ring-4 ring-muted">
                  <Check className="size-[18px]" aria-hidden />
                </span>
                <span className="text-xs leading-4 font-semibold">{step.title}</span>
                <span
                  className={
                    index === 2
                      ? "rounded-full bg-success/20 px-2 py-0.5 text-[10px] leading-4 font-bold tracking-wide text-success uppercase"
                      : "font-data text-[11px] font-medium text-success"
                  }
                >
                  {step.note}
                </span>
              </li>,
            ])}
          </div>
        </ol>

        {/* Sucesso */}
        <div role="status" className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-success to-primary text-primary-foreground shadow-md">
                <UserRound className="size-8" aria-hidden />
              </div>
              <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-card">
                <CircleCheck className="size-5 text-success" aria-hidden />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] leading-4 font-bold tracking-wider text-success uppercase">
                  Cadastro concluído
                </span>
                <span className="font-data text-xs text-muted-foreground">
                  • {today.getDate()} {MONTH_NAMES[today.getMonth()]}, {today.getFullYear()}
                </span>
              </div>
              <h2 className="text-2xl leading-8 font-bold tracking-tight">Cadastro concluído e 1ª consulta agendada!</h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                O cadastro de <strong className="font-semibold text-foreground">{values.full_name}</strong> foi salvo e o horário foi
                reservado na agenda de <strong className="font-semibold text-foreground">{professional.full_name}</strong>.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            Primeira consulta agendada
          </span>
        </div>

        {/* Ficha + sessão */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-label="Ficha do paciente" className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/60 p-5">
            <h3 className="flex items-center gap-2 text-base leading-6 font-bold">
              <IdCard className="size-5 text-primary" aria-hidden />
              Ficha do Paciente
            </h3>
            <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-base font-bold text-accent-foreground">
                {getInitials(values.full_name)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] leading-5 font-bold">{values.full_name}</span>
                {birth && <span className="text-xs text-muted-foreground">{getAge(birth)} anos</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-2 rounded-lg bg-card/70 p-2 font-data font-semibold">
                <Phone className="size-4 text-success" aria-hidden />
                {values.phone}
              </span>
              {values.email && (
                <span className="flex min-w-0 items-center gap-2 rounded-lg bg-card/70 p-2 font-data">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{values.email}</span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-card p-3 shadow-sm">
              <span className="flex items-center gap-1.5 text-[11px] leading-4 font-semibold tracking-wider text-muted-foreground uppercase">
                <Target className="size-3.5 text-primary" aria-hidden />
                Objetivo Principal
              </span>
              <p className="text-sm font-semibold">{goal?.label}</p>
              {values.notes && <p className="rounded-lg bg-muted p-2.5 text-xs leading-relaxed break-words italic text-muted-foreground">“{values.notes}”</p>}
            </div>
          </section>

          <section aria-label="Primeira sessão agendada" className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base leading-6 font-bold">
                <CalendarClock className="size-5 text-primary" aria-hidden />
                1ª Sessão Agendada
              </h3>
              <span className="rounded-full bg-success px-2 py-0.5 text-[11px] leading-4 font-semibold text-primary-foreground">Vaga Confirmada</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sidebar-gradient-mid to-primary text-primary-foreground">
                <Stethoscope className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] leading-5 font-bold">{professional.full_name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[professional.specialty, professional.crn].filter(Boolean).join(" • ") || "Nutricionista"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-accent p-3 text-accent-foreground">
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                <CalendarDays className="size-[18px] shrink-0" aria-hidden />
                <span className="truncate">{longSlotLabel(slot)}</span>
              </span>
              <span className="shrink-0 rounded bg-card px-2 py-0.5 font-data text-xs text-foreground shadow-sm">{minutes} min</span>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-card p-3 shadow-sm">
              <MapPin className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
              <div className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-bold">
                  Presencial{unit ? ` — ${unit.name}` : ""}
                  {roomName && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{roomName}</span>}
                </span>
                {unit?.address && <span className="text-xs text-muted-foreground">{unit.address}</span>}
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] leading-5 font-bold">Próxima Etapa no Atendimento Presencial</span>
            <p className="text-sm text-muted-foreground">
              O prontuário clínico detalhado (anamnese completa, exames laboratoriais, protocolo de dobras cutâneas e bioimpedância)
              será preenchido pelo nutricionista durante a consulta.
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4 md:px-8 lg:flex-row lg:items-center">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
          Cadastro e agendamento gravados com sucesso.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onViewAgenda} className="rounded-xl">
            <CalendarDays aria-hidden />
            Ver na Agenda Clínica
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl bg-muted">
            Concluir e Voltar à Lista
          </Button>
          {/* A tela do paciente (perfil) é a próxima etapa do projeto. */}
          <Button type="button" disabled title="Em breve" className="rounded-xl font-semibold">
            Ir para o Perfil do Paciente
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
