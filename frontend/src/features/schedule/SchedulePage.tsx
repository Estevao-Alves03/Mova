import { Link } from "react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { PROFILE_PATH } from "@/layouts/admin/nav-items"
import { cn } from "@/lib/utils"

import { AgendaToolbar } from "./components/AgendaToolbar"
import { CategoryFilters } from "./components/CategoryFilters"
import { DayView } from "./components/DayView"
import { EventDetailBar } from "./components/EventDetailBar"
import { MiniCalendar } from "./components/MiniCalendar"
import { MonthView } from "./components/MonthView"
import { StatusSummary } from "./components/StatusSummary"
import { WeekView } from "./components/WeekView"
import { useAgenda } from "./useAgenda"

export function SchedulePage() {
  const agenda = useAgenda()
  const roomName = (roomId?: string) => agenda.rooms.find((room) => room.id === roomId)?.name
  const professionalName = (professionalId?: string) =>
    agenda.professionals.find((professional) => professional.id === professionalId)?.name

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="sr-only">Agenda clínica</h1>

      {/* Fixos em todas as visualizações: barra superior e barra lateral. */}
      <AgendaToolbar agenda={agenda} />

      {agenda.loadError && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {agenda.loadError.message}
        </p>
      )}
      {agenda.unconfigured.length > 0 && (
        <p role="status" className="rounded-xl bg-warning/15 px-4 py-3 text-sm">
          {agenda.role === "nutritionist" ? (
            <>
              Sua agenda ainda não foi configurada, então a recepção não consegue agendar com você. Defina as durações
              e os horários em <Link to={PROFILE_PATH} className="font-semibold underline">Meu Perfil</Link>.
            </>
          ) : (
            <>
              {agenda.unconfigured.join(", ")}{" "}
              {agenda.unconfigured.length === 1 ? "ainda não configurou" : "ainda não configuraram"} a agenda
              (durações e horários de atendimento). Não é possível agendar até que isso seja feito.
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <aside aria-label="Calendário, filtros e resumo" className="order-2 flex flex-col gap-4 xl:order-1 xl:col-span-3">
          <MiniCalendar date={agenda.date} view={agenda.view} now={agenda.now} onSelect={agenda.setDate} />
          <CategoryFilters enabled={agenda.enabledKinds} onToggle={agenda.toggleKind} durations={agenda.durations} />
          <StatusSummary counts={agenda.statusCounts} />
        </aside>

        {/* Só esta área muda conforme a visualização. */}
        <section
          aria-label="Agendamentos"
          className={cn("order-1 rounded-2xl bg-card p-4 shadow-sm md:p-6 xl:order-2 xl:col-span-9")}
        >
          {agenda.pending ? (
            <Skeleton aria-label="Carregando a agenda" className="h-[480px] rounded-xl" />
          ) : (
            <>
              {agenda.view === "week" && <WeekView agenda={agenda} roomName={roomName} />}
              {agenda.view === "day" && <DayView agenda={agenda} roomName={roomName} />}
              {agenda.view === "month" && <MonthView agenda={agenda} roomName={roomName} />}
            </>
          )}

          {agenda.view !== "month" && (
            <EventDetailBar
              event={agenda.selected}
              professionalName={professionalName(agenda.selected?.professionalId)}
              roomName={roomName(agenda.selected?.roomId)}
              role={agenda.role}
            />
          )}
        </section>
      </div>
    </div>
  )
}
