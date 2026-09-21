import { CalendarCheck, ChevronRight, Clock } from "lucide-react"
import { Link } from "react-router"

import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"

import { formatNextAppointment, formatShortDate, getAge } from "../format"
import { SITUATIONS } from "../situations"
import { goalLabel } from "../usePatientList"
import type { PatientListItem } from "../types"

// Células reutilizadas pela tabela (desktop) e pelos cartões (telas menores).

export function PatientIdentity({ patient }: { patient: PatientListItem }) {
  const muted = patient.situation === "alert"
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold shadow-xs ring-2 ring-card",
          muted ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        {getInitials(patient.full_name)}
      </span>
      <div className="flex min-w-0 flex-col">
        <Link
          to={`/app/patients/${patient.id}`}
          className="truncate rounded text-[15px] leading-5 font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {patient.full_name}
        </Link>
        <span className="flex items-center gap-1.5 truncate font-data text-xs text-muted-foreground">
          {[
            patient.birth_date ? `${getAge(patient.birth_date)} anos` : null,
            patient.sex ? (patient.sex === "female" ? "Fem" : "Masc") : null,
            patient.phone,
          ]
            .filter(Boolean)
            .map((part, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>•</span>}
                {part}
              </span>
            ))}
        </span>
      </div>
    </div>
  )
}

export function SituationCell({ patient }: { patient: PatientListItem }) {
  const situation = SITUATIONS[patient.situation]
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-semibold",
          situation.badge,
        )}
      >
        <span className={cn("size-1.5 rounded-full", situation.dot)} aria-hidden />
        {situation.label}
      </span>
      <span className="ml-1 font-data text-[11px] text-muted-foreground">
        {patient.situation === "alert" ? (
          <strong className={cn("font-semibold", situation.statusTone)}>{situation.statusLabel}</strong>
        ) : (
          <>
            Status: <strong className={cn("font-semibold", situation.statusTone)}>{situation.statusLabel}</strong>
          </>
        )}
      </span>
    </div>
  )
}

/** Objetivo informado na 1ª consulta: dado clínico, nunca renderizado para a recepção. */
export function GoalCell({ patient }: { patient: PatientListItem }) {
  const label = goalLabel(patient.goal)
  return label ? (
    <span className="w-fit rounded-md bg-accent px-2 py-0.5 text-[11px] leading-4 font-semibold text-accent-foreground">{label}</span>
  ) : (
    <span className="text-xs text-muted-foreground">Não informado</span>
  )
}

export function LastConsultationCell({ patient }: { patient: PatientListItem }) {
  return (
    <span className="font-data text-sm text-foreground">
      {patient.last_consultation_at ? formatShortDate(patient.last_consultation_at) : <span className="text-muted-foreground">Sem consulta</span>}
    </span>
  )
}

export function NextReturnCell({ patient }: { patient: PatientListItem }) {
  const next = patient.next_appointment_at
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        {next ? (
          <span className="flex items-center gap-1 font-data text-sm font-semibold">
            <CalendarCheck className="size-[15px] shrink-0 text-primary" aria-hidden />
            <span className="truncate">{formatNextAppointment(next)}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 font-data text-sm font-semibold text-warning">
            <Clock className="size-[15px] shrink-0" aria-hidden />
            Sem agendamento
          </span>
        )}
      </div>
      <Link
        to={`/app/patients/${patient.id}`}
        aria-label={`Abrir o perfil de ${patient.full_name}`}
        className="shrink-0 rounded text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="size-[18px]" aria-hidden />
      </Link>
    </div>
  )
}
