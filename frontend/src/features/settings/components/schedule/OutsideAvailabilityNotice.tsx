import { TriangleAlert } from "lucide-react"

import {
  APPOINTMENT_TYPES,
  OUTSIDE_REASON_LABELS,
  type AffectedAppointment,
} from "@/features/schedule/scheduleConfig"

const MAX_LISTED = 5

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const typeLabel = (type: AffectedAppointment["appointment_type"]) =>
  APPOINTMENT_TYPES.find((item) => item.value === type)?.label ?? type

/** Aviso não bloqueante: as consultas continuam agendadas; a recepção remarca quando necessário. */
export function OutsideAvailabilityNotice({ appointments }: { appointments: AffectedAppointment[] }) {
  if (appointments.length === 0) return null
  return (
    <div role="status" className="flex gap-3 rounded-xl bg-warning/15 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-semibold">
          {appointments.length === 1
            ? "1 consulta futura está fora da sua disponibilidade"
            : `${appointments.length} consultas futuras estão fora da sua disponibilidade`}
        </p>
        <p className="text-muted-foreground">
          Nada foi cancelado nem alterado: elas continuam agendadas e a recepção poderá remarcá-las.
        </p>
        <ul className="flex flex-col gap-1">
          {appointments.slice(0, MAX_LISTED).map((appointment) => (
            <li key={appointment.appointment_id} className="truncate text-[13px]">
              <span className="font-data">{dateTime.format(new Date(appointment.starts_at))}</span> ·{" "}
              {appointment.patient_name} · {typeLabel(appointment.appointment_type)} ·{" "}
              <span className="text-muted-foreground">{OUTSIDE_REASON_LABELS[appointment.reason]}</span>
            </li>
          ))}
          {appointments.length > MAX_LISTED && (
            <li className="text-[13px] text-muted-foreground">e mais {appointments.length - MAX_LISTED}…</li>
          )}
        </ul>
      </div>
    </div>
  )
}
