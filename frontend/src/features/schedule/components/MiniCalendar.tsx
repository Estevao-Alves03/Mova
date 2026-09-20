import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

import {
  addDays,
  addMonths,
  endOfMonth,
  isSameDay,
  isSameMonth,
  MONTH_NAMES,
  startOfMonth,
  startOfWeek,
} from "@/lib/date"
import { cn } from "@/lib/utils"

import type { AgendaView } from "../types"

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"]
const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth()

interface MiniCalendarProps {
  date: Date
  view: AgendaView
  now: Date
  onSelect: (date: Date) => void
}

export function MiniCalendar({ date, view, now, onSelect }: MiniCalendarProps) {
  // Navegar pelos meses do mini calendário não muda a agenda; voltar ao mês da data
  // atual acontece quando a agenda muda de mês (estado ajustado durante a renderização).
  const [offset, setOffset] = useState(0)
  const [anchorKey, setAnchorKey] = useState(monthKey(date))
  if (anchorKey !== monthKey(date)) {
    setAnchorKey(monthKey(date))
    setOffset(0)
  }

  const shownMonth = addMonths(startOfMonth(date), offset)
  const first = startOfMonth(shownMonth)
  const gridStart = addDays(first, -first.getDay())
  const gridEnd = addDays(endOfMonth(shownMonth), 6 - endOfMonth(shownMonth).getDay())
  const days: Date[] = []
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day)

  const weekStart = startOfWeek(date)
  const inHighlight = (day: Date) =>
    view === "week"
      ? day >= weekStart && day <= addDays(weekStart, 5)
      : view === "day" && isSameDay(day, date)

  return (
    <section aria-label="Calendário" className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base leading-6 font-bold">
          {MONTH_NAMES[shownMonth.getMonth()]} {shownMonth.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((value) => value - 1)}
            aria-label="Mês anterior"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOffset((value) => value + 1)}
            aria-label="Próximo mês"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-data text-[11px] font-semibold text-muted-foreground" aria-hidden>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center font-data text-xs">
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={`${day.getDate()} de ${MONTH_NAMES[day.getMonth()]} de ${day.getFullYear()}`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "mx-auto flex size-7 items-center justify-center rounded-lg py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                !isSameMonth(day, shownMonth) && "text-muted-foreground/50",
                inHighlight(day) && "bg-accent font-semibold text-accent-foreground",
                isToday && "rounded-full bg-primary font-semibold text-primary-foreground",
                !isToday && !inHighlight(day) && "hover:bg-muted",
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </section>
  )
}
