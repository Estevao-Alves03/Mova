import { Ban, CircleCheck, Clock, Utensils } from "lucide-react"
import type { CSSProperties } from "react"

import { diffInMinutes, formatTime } from "@/lib/date"
import { cn } from "@/lib/utils"

import { CATEGORY_BY_KIND, STATUS_LABELS } from "../categories"
import type { ScheduleEvent } from "../types"

interface EventCardProps {
  event: ScheduleEvent
  variant: "week" | "day"
  selected: boolean
  roomName?: string
  onSelect: (id: string) => void
  style: CSSProperties
}

function timeRange(event: ScheduleEvent) {
  return `${formatTime(event.start)} - ${formatTime(event.end)}`
}

export function EventCard({ event, variant, selected, roomName, onSelect, style }: EventCardProps) {
  const category = CATEGORY_BY_KIND[event.kind]
  const isWide = variant === "day"

  if (event.kind === "break") {
    return (
      <div
        style={style}
        className={cn(
          "absolute flex flex-col items-center justify-center gap-0.5 rounded-xl border-l-4 p-2 text-center text-muted-foreground",
          category.card,
        )}
      >
        <Utensils className="size-4" aria-hidden />
        <span className="text-[11px] leading-[14px] font-semibold">{event.title}</span>
        <span className="font-data text-[11px] leading-[14px]">{timeRange(event)}</span>
      </div>
    )
  }

  if (event.kind === "block") {
    return (
      <div
        style={style}
        className={cn(
          "absolute flex flex-col items-center justify-center gap-1 rounded-xl border-l-4 border-dashed p-2 text-center",
          category.card,
        )}
      >
        <Ban className="size-5 text-cat-block" aria-hidden />
        <span className="text-xs leading-4 font-semibold text-cat-block">{event.title}</span>
        <span className="font-data text-[11px] leading-[14px] text-muted-foreground">
          {timeRange(event)}
        </span>
      </div>
    )
  }

  const status = event.status
  const inProgress = status === "in_progress"
  const StatusIcon = status === "completed" ? CircleCheck : Clock
  const statusTone = status === "completed" ? "text-success" : "text-primary"
  const minutes = diffInMinutes(event.start, event.end)

  return (
    <button
      type="button"
      style={style}
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
      aria-label={`${event.title}, ${timeRange(event)}, ${category.shortLabel}${status ? `, ${STATUS_LABELS[status]}` : ""}`}
      className={cn(
        "absolute flex flex-col justify-between overflow-hidden rounded-xl border-l-4 p-2 text-left shadow-sm outline-none transition-all hover:shadow focus-visible:ring-2 focus-visible:ring-ring",
        category.card,
        inProgress && "ring-2 ring-primary",
        selected && "ring-2 ring-primary/70",
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span className={cn("truncate text-[13px] leading-tight font-semibold", isWide && "text-sm")}>
          {event.title}
        </span>
        {inProgress ? (
          <span className="shrink-0 rounded bg-primary px-1.5 text-[9px] leading-[14px] font-bold tracking-wide text-primary-foreground uppercase">
            Em atendimento
          </span>
        ) : (
          <StatusIcon className={cn("size-[15px] shrink-0", statusTone)} aria-hidden />
        )}
      </span>
      {isWide ? (
        <span className="flex items-center justify-between gap-2 font-data text-[11px] leading-[14px] text-muted-foreground">
          <span className="truncate">
            {timeRange(event)} ({minutes} min)
          </span>
          <span className="shrink-0 font-medium text-foreground">
            {category.shortLabel}
            {roomName ? ` · ${roomName}` : ""}
          </span>
        </span>
      ) : (
        <span className="flex flex-col font-data text-[11px] leading-[14px] text-muted-foreground">
          <span className="whitespace-nowrap">{timeRange(event)}</span>
          {minutes >= 60 && <span className="truncate font-medium text-foreground">{category.shortLabel}</span>}
        </span>
      )}
    </button>
  )
}
