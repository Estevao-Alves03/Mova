import { CalendarCheck } from "lucide-react"

import { startOfDay } from "@/lib/date"

import { formatNextAppointment, formatShortDate } from "../format"
import type { PatientDetailClinical } from "../types"

/** "Hoje", "Amanhã", "Em 15 dias", "Há 15 dias" (dias corridos, no horário local). */
function relativeDays(iso: string, now = new Date()) {
  const days = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) return "Hoje"
  if (days === 1) return "Amanhã"
  if (days === -1) return "Ontem"
  return days > 0 ? `Em ${days} dias` : `Há ${-days} dias`
}

export function SituationCard({ patient }: { patient: PatientDetailClinical }) {
  const { last_consultation_at: last, next_appointment_at: next } = patient

  return (
    <section aria-labelledby="patient-situation-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <h2 id="patient-situation-title" className="flex items-center gap-2 border-b border-border/50 pb-2 text-base leading-6 font-bold">
        <CalendarCheck className="size-5 text-primary" aria-hidden />
        Situação Atual
      </h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
          <div className="flex flex-col">
            <span className="text-[11px] leading-[14px] text-muted-foreground">Última Consulta</span>
            <span className="font-data text-base font-bold">{last ? formatShortDate(last) : "Sem consulta concluída"}</span>
          </div>
          {last && <span className="rounded bg-card px-2 py-0.5 font-data text-[11px] text-muted-foreground">{relativeDays(last)}</span>}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent p-3">
          <div className="flex flex-col">
            <span className="text-[11px] leading-[14px] text-primary">Próxima Consulta</span>
            <span className="font-data text-base font-bold text-primary">{next ? formatNextAppointment(next) : "Sem agendamento"}</span>
          </div>
          {next && (
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-primary shadow-xs">
              {relativeDays(next)}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
