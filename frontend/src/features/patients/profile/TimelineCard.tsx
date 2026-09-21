import { History } from "lucide-react"

import { STATUS_LABELS } from "@/features/schedule/categories"
import { APPOINTMENT_TYPES } from "@/features/schedule/scheduleConfig"
import type { AppointmentStatus } from "@/features/schedule/types"
import { formatTime } from "@/lib/date"
import { cn } from "@/lib/utils"

import { formatShortDate } from "../format"
import type { PatientTimelineItem } from "../types"

const DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-primary",
  confirmed: "bg-primary",
  waiting: "bg-primary",
  in_progress: "bg-primary",
  completed: "bg-success",
  no_show: "bg-destructive",
  cancelled: "bg-muted-foreground",
}

/** Linha do tempo das consultas do paciente (não canceladas), da mais antiga para a mais recente. */
export function TimelineCard({ items }: { items: PatientTimelineItem[] }) {
  return (
    <section aria-labelledby="patient-timeline-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="patient-timeline-title" className="flex items-center gap-2 text-base leading-6 font-bold">
          <History className="size-5 text-primary" aria-hidden />
          Linha do Tempo
        </h2>
        <span className="font-data text-[11px] text-muted-foreground">Consultas</span>
      </div>

      {items.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Nenhuma consulta registrada.
        </p>
      ) : (
        // Lista que cresce com o histórico: altura máxima e rolagem interna, nunca aumenta a página.
        <ol className="relative max-h-96 space-y-4 overflow-y-auto py-1 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2.5 before:w-0.5 before:bg-border">
          {items.map((item) => {
            const start = new Date(item.starts_at)
            return (
              <li key={item.id} className="relative">
                <span aria-hidden className={cn("absolute top-1.5 -left-[19px] size-3 rounded-full ring-4 ring-card", DOT[item.status])} />
                <span className="font-data text-[11px] text-muted-foreground">
                  {formatShortDate(item.starts_at)} • {formatTime(start)}
                </span>
                <p className="text-[13px] leading-[18px] font-semibold">
                  {APPOINTMENT_TYPES.find((type) => type.value === item.appointment_type)?.label}
                </p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS[item.status]}</p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
