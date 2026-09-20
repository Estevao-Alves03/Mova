import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import {
  endOfMonth,
  isoWeekNumber,
  isSameDay,
  MONTH_NAMES,
  MONTH_SHORT,
  startOfWeek,
  addDays,
  WEEKDAY_NAMES,
} from "@/lib/date"
import { cn } from "@/lib/utils"

import { ALL, type Agenda } from "../useAgenda"
import type { AgendaView } from "../types"

const VIEW_OPTIONS: { value: AgendaView; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
]

const SHIFT_LABELS: Record<AgendaView, [string, string]> = {
  day: ["Dia anterior", "Próximo dia"],
  week: ["Semana anterior", "Próxima semana"],
  month: ["Mês anterior", "Próximo mês"],
}

function describePeriod(view: AgendaView, date: Date, now: Date) {
  if (view === "day") {
    return {
      title: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`,
      suffix: `(${WEEKDAY_NAMES[date.getDay()]})`,
      badge: isSameDay(date, now) ? "HOJE" : undefined,
    }
  }
  if (view === "week") {
    const monday = startOfWeek(date)
    const saturday = addDays(monday, 5)
    const sameMonth = monday.getMonth() === saturday.getMonth()
    const title = sameMonth
      ? `${monday.getDate()} – ${saturday.getDate()} de ${MONTH_NAMES[monday.getMonth()]} de ${saturday.getFullYear()}`
      : `${monday.getDate()} ${MONTH_SHORT[monday.getMonth()]} – ${saturday.getDate()} ${MONTH_SHORT[saturday.getMonth()]} de ${saturday.getFullYear()}`
    return { title, badge: `Semana ${isoWeekNumber(monday)}` }
  }
  return {
    title: `${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`,
    badge: `${endOfMonth(date).getDate()} Dias`,
  }
}

export function AgendaToolbar({ agenda }: { agenda: Agenda }) {
  const { view, date, now } = agenda
  const period = describePeriod(view, date, now)
  const [previousLabel, nextLabel] = SHIFT_LABELS[view]

  return (
    <section
      aria-label="Controles da agenda"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            onClick={agenda.goToday}
            className="h-8 rounded-lg bg-card px-3 text-[13px] font-semibold shadow-sm hover:text-primary"
          >
            Hoje
          </Button>
          <div className="ml-1 flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => agenda.shift(-1)}
              className="size-8 rounded-lg text-muted-foreground hover:bg-card"
              aria-label={previousLabel}
              title={previousLabel}
            >
              <ChevronLeft className="size-[18px]" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => agenda.shift(1)}
              className="size-8 rounded-lg text-muted-foreground hover:bg-card"
              aria-label={nextLabel}
              title={nextLabel}
            >
              <ChevronRight className="size-[18px]" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h2 aria-live="polite" className="text-xl leading-tight font-bold tracking-tight">
            {period.title}
            {period.suffix && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{period.suffix}</span>
            )}
          </h2>
          {period.badge && (
            <span className="rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-[11px] leading-[14px] font-semibold text-accent-foreground">
              {period.badge}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Visualização" className="inline-flex rounded-xl bg-muted p-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => agenda.setView(option.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] leading-[18px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === option.value
                  ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <NativeSelect
          aria-label="Profissional"
          value={agenda.professionalId}
          disabled={!agenda.canPickProfessional}
          onChange={(event) => agenda.setProfessionalId(event.target.value)}
          className="h-9 w-auto rounded-xl border-0 pr-8 text-[13px] font-semibold"
        >
          {agenda.professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
          {agenda.canPickProfessional && <option value={ALL}>Todos os Profissionais</option>}
        </NativeSelect>

        <NativeSelect
          aria-label="Sala"
          value={agenda.roomId}
          onChange={(event) => agenda.setRoomId(event.target.value)}
          className="h-9 w-auto rounded-xl border-0 pr-8 text-[13px] font-medium"
        >
          <option value={ALL}>Todas as Salas</option>
          {agenda.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </NativeSelect>

        {/* Nutricionista não cria agendamentos (docs/permissoes.md). Ação ainda somente visual. */}
        {agenda.canSchedule && (
          <Button type="button" disabled className="h-9 gap-1.5 rounded-xl px-4 text-[13px] font-semibold shadow-sm">
            <Plus className="size-[18px]" aria-hidden />
            Novo Agendamento
          </Button>
        )}
      </div>
    </section>
  )
}
