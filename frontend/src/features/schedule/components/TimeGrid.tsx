import { Lock } from "lucide-react"

import {
  isSameDay,
  minutesSinceMidnight,
  WEEKDAY_SHORT,
  diffInMinutes,
} from "@/lib/date"
import { cn } from "@/lib/utils"

import type { DayHours } from "../agendaEvents"
import type { ScheduleEvent } from "../types"
import { EventCard } from "./EventCard"

const ROW_HEIGHT = 76
const LABEL_WIDTH = 65

interface PlacedEvent {
  event: ScheduleEvent
  lane: number
  lanes: number
}

/** Distribui eventos sobrepostos lado a lado (ex.: "Todos os Profissionais"). */
function layoutDay(events: ScheduleEvent[]): PlacedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  )
  const placed: PlacedEvent[] = []
  let cluster: PlacedEvent[] = []
  let laneEnds: number[] = []
  let clusterEnd = 0

  const flush = () => {
    for (const item of cluster) item.lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const event of sorted) {
    const start = event.start.getTime()
    if (cluster.length > 0 && start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = event.end.getTime()
    clusterEnd = Math.max(clusterEnd, event.end.getTime())
    const item = { event, lane, lanes: 1 }
    cluster.push(item)
    placed.push(item)
  }
  flush()
  return placed
}

interface TimeGridProps {
  days: Date[]
  events: ScheduleEvent[]
  now: Date
  /** Faixa de horas desenhada: cobre os expedientes reais dos profissionais visíveis. */
  grid: { startHour: number; endHour: number }
  /** Expediente real do dia (null = sem atendimento). */
  hoursFor: (day: Date) => DayHours | null
  variant: "week" | "day"
  selectedId?: string
  onSelect: (id: string) => void
  roomName: (roomId?: string) => string | undefined
}

export function TimeGrid({ days, events, now, grid, hoursFor, variant, selectedId, onSelect, roomName }: TimeGridProps) {
  const { startHour, endHour } = grid
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  const topFor = (minutes: number) => ((minutes - startHour * 60) / 60) * ROW_HEIGHT
  // Áreas fora do expediente (antes e depois; o dia inteiro se não há atendimento).
  const closedAreas = (open: DayHours | null) =>
    open
      ? [
          { from: startHour * 60, to: open.start, label: "Fora do expediente" },
          { from: open.end, to: endHour * 60, label: "Fora do expediente" },
        ].filter((area) => area.to > area.from)
      : [{ from: startHour * 60, to: endHour * 60, label: "Sem atendimento" }]
  const columns = `repeat(${days.length}, minmax(0, 1fr))`
  const nowMinutes = minutesSinceMidnight(now)
  const showNowLine =
    days.some((day) => isSameDay(day, now)) &&
    nowMinutes >= startHour * 60 &&
    nowMinutes <= endHour * 60

  return (
    <div className={cn("flex flex-col", variant === "week" && "min-w-[760px]")}>
      <div
        className="mb-2 grid rounded-xl border border-border/60 bg-muted py-2 text-center"
        style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${columns}` }}
      >
        <div className="flex items-center justify-center font-data text-[11px] font-medium text-muted-foreground">
          Horário
        </div>
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          return (
            <div
              key={day.getTime()}
              className={cn(
                "flex flex-col items-center rounded-xl py-1",
                isToday && "bg-accent/60",
              )}
            >
              <span
                className={cn(
                  "text-[11px] leading-[14px] font-semibold uppercase",
                  isToday ? "font-bold text-primary" : "text-muted-foreground",
                )}
              >
                {WEEKDAY_SHORT[day.getDay()]}
                {isToday ? " (Hoje)" : ""}
              </span>
              <span
                className={cn(
                  "text-lg leading-7 font-bold",
                  isToday &&
                    "flex size-7 items-center justify-center rounded-full bg-primary text-base text-primary-foreground shadow-sm",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative" style={{ height: hours.length * ROW_HEIGHT }}>
        <div className="pointer-events-none absolute inset-0 flex flex-col" aria-hidden>
          {hours.map((hour, index) => (
            <div
              key={hour}
              className={cn("flex border-b border-border/60", index % 2 === 0 && "bg-muted/30")}
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className="pt-1 pr-3 text-right font-data text-[11px] text-muted-foreground"
                style={{ width: LABEL_WIDTH }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        <div
          className="absolute inset-y-0 right-0 grid"
          style={{ left: LABEL_WIDTH, gridTemplateColumns: columns }}
        >
          {days.map((day) => {
            const todays = events.filter((event) => isSameDay(event.start, day))
            // Almoço e bloqueios são "fundo" da agenda (largura total, sempre sob as consultas).
            const background = todays
              .filter((event) => event.kind === "break" || event.kind === "block")
              .sort((a, b) => Number(a.kind === "block") - Number(b.kind === "block"))
              .map((event) => ({ event, lane: 0, lanes: 1 }))
            const dayEvents = [...background, ...layoutDay(todays.filter((event) => event.status))]
            return (
              <div key={day.getTime()} className="relative border-r border-border/60 px-1 last:border-r-0">
                {closedAreas(hoursFor(day)).map((area) => (
                  <div
                    key={area.from}
                    className="absolute inset-x-1 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-muted text-muted-foreground"
                    style={{ top: topFor(area.from) + 1, height: ((area.to - area.from) / 60) * ROW_HEIGHT - 4 }}
                  >
                    <Lock className="size-4" aria-hidden />
                    <span className="text-[11px] leading-[14px] font-medium">{area.label}</span>
                  </div>
                ))}
                {dayEvents.map(({ event, lane, lanes }) => {
                  const start = minutesSinceMidnight(event.start)
                  const duration = diffInMinutes(event.start, event.end)
                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      variant={variant}
                      selected={event.id === selectedId}
                      roomName={roomName(event.roomId)}
                      onSelect={onSelect}
                      style={{
                        top: topFor(start) + 1,
                        height: (duration / 60) * ROW_HEIGHT - 3,
                        left: `calc(${(lane / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}

          {showNowLine && (
            <div
              className="pointer-events-none absolute right-0 left-0 z-30 flex items-center"
              style={{ top: topFor(nowMinutes) }}
              aria-hidden
            >
              <div className="-ml-1.5 size-2.5 rounded-full bg-destructive shadow-sm" />
              <div className="h-0.5 flex-1 bg-destructive/90" />
              <span className="ml-1 rounded bg-destructive px-1.5 py-0.5 font-data text-[11px] font-semibold text-primary-foreground">
                {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
