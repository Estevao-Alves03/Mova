import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  addDays,
  formatTime,
  isSameDay,
  isSameMonth,
  MONTH_NAMES,
  MONTH_SHORT,
  toISODate,
  WEEKDAY_NAMES,
} from "@/lib/date"
import { cn } from "@/lib/utils"

import { CATEGORY_BY_KIND } from "../categories"
import type { Agenda } from "../useAgenda"
import type { ScheduleEvent } from "../types"

const MAX_CHIPS = 3
const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

// "Felipe Duarte" -> "Felipe D."
function shortName(fullName: string) {
  const parts = fullName.split(" ")
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : fullName
}

function chipLabel(event: ScheduleEvent) {
  const label = event.kind === "break" || event.kind === "block" ? CATEGORY_BY_KIND[event.kind].shortLabel : shortName(event.title)
  return `${formatTime(event.start)} ${label}`
}

interface MonthViewProps {
  agenda: Agenda
  roomName: (roomId?: string) => string | undefined
}

export function MonthView({ agenda, roomName }: MonthViewProps) {
  const { date, now, range, events } = agenda
  const [openDay, setOpenDay] = useState<string>()

  const days: Date[] = []
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) days.push(day)

  const byDay = new Map<string, ScheduleEvent[]>()
  for (const event of [...events].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const key = toISODate(event.start)
    byDay.set(key, [...(byDay.get(key) ?? []), event])
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] overflow-hidden rounded-xl border border-border/80">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50 py-2.5 text-center text-[13px] leading-[18px] font-semibold text-muted-foreground">
          {WEEKDAY_HEADERS.map((label, index) => (
            <span key={label} className={cn(index === 0 && "font-medium text-destructive", index === 6 && "font-medium text-primary")}>
              {label}
            </span>
          ))}
        </div>

        <div className="grid auto-rows-[124px] grid-cols-7 divide-x divide-y divide-border/60">
          {days.map((day) => {
            const key = toISODate(day)
            const dayEvents = byDay.get(key) ?? []
            const appointments = dayEvents.filter((event) => event.status)
            const inMonth = isSameMonth(day, date)
            const isToday = isSameDay(day, now)
            const closed = agenda.isClosed(day)
            const hidden = dayEvents.length - MAX_CHIPS

            return (
              <Popover key={key} open={openDay === key} onOpenChange={(open) => setOpenDay(open ? key : undefined)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${day.getDate()} de ${MONTH_NAMES[day.getMonth()]}, ${appointments.length} ${appointments.length === 1 ? "consulta" : "consultas"}`}
                    className={cn(
                      "flex flex-col gap-1 p-2 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      inMonth ? "bg-card" : "bg-muted/30",
                      closed && "bg-muted/30",
                      isToday && "ring-2 ring-primary ring-inset",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-data text-[10px] leading-[14px] font-semibold text-primary">
                        {isToday ? "HOJE" : day.getDate() === 1 ? `1 ${MONTH_SHORT[day.getMonth()]}` : ""}
                      </span>
                      <span
                        className={cn(
                          "font-data text-xs leading-4 font-semibold",
                          !inMonth && "text-muted-foreground/50",
                          isToday && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </span>
                    {closed && dayEvents.length === 0 ? (
                      <span className="my-auto block text-center text-[11px] text-muted-foreground/70">Sem atendimento</span>
                    ) : (
                      <span className={cn("flex flex-col gap-1", !inMonth && "opacity-50")}>
                        {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "block truncate rounded px-2 py-0.5 text-[11px] leading-4 font-medium",
                              event.status === "in_progress"
                                ? "bg-primary text-primary-foreground shadow-2xs"
                                : CATEGORY_BY_KIND[event.kind].chip,
                            )}
                          >
                            {chipLabel(event)}
                          </span>
                        ))}
                      </span>
                    )}
                    {hidden > 0 && (
                      <span className="mt-auto font-data text-[10px] leading-[14px] text-muted-foreground">
                        +{hidden} mais
                      </span>
                    )}
                  </button>
                </PopoverTrigger>

                <PopoverContent align="start" className="w-80 rounded-2xl p-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <h4 className="text-sm leading-5 font-bold">
                        {WEEKDAY_NAMES[day.getDay()]}, {day.getDate()} de {MONTH_NAMES[day.getMonth()]}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {appointments.length === 0
                          ? "Nenhuma consulta"
                          : `${appointments.length} ${appointments.length === 1 ? "consulta agendada" : "consultas agendadas"}`}
                      </span>
                    </div>
                    {isToday && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">HOJE</span>
                    )}
                  </div>
                  {appointments.length > 0 && (
                    <ul className="my-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                      {appointments.map((event) => (
                        <li
                          key={event.id}
                          className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/60 p-2.5"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="flex items-center gap-1.5 truncate text-[13px] leading-[18px] font-semibold">
                              <span className={cn("size-2 shrink-0 rounded-full", CATEGORY_BY_KIND[event.kind].dot)} aria-hidden />
                              {event.title}
                            </p>
                            <p className="truncate pl-3.5 text-[11px] leading-[14px] text-muted-foreground">
                              {CATEGORY_BY_KIND[event.kind].shortLabel}
                              {roomName(event.roomId) ? ` • ${roomName(event.roomId)}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-data text-xs font-bold">{formatTime(event.start)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={cn("flex items-center gap-2", appointments.length === 0 && "pt-3")}>
                    <Button
                      type="button"
                      onClick={() => {
                        setOpenDay(undefined)
                        agenda.showDay(day)
                      }}
                      className="h-8 flex-1 rounded-lg text-xs font-semibold"
                    >
                      Ver Grade do Dia
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpenDay(undefined)}
                      className="h-8 rounded-lg text-xs font-medium"
                    >
                      Fechar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      </div>
    </div>
  )
}
