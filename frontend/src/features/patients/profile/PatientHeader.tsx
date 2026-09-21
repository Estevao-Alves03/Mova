import { CalendarDays, MapPin, Stethoscope } from "lucide-react"

import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"

import { formatShortDate, getAge } from "../format"
import { SITUATIONS } from "../situations"
import type { PatientDetail } from "../types"

const SEX_LABELS = { female: "Feminino", male: "Masculino" } as const

function Field({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl bg-muted/50 p-3", className)}>
      <dt className="text-[11px] leading-[14px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[13px] leading-[18px] font-semibold", !value && "font-normal text-muted-foreground")}>
        {value ?? "Não informado"}
      </dd>
    </div>
  )
}

/** Identificação e dados cadastrais: o único bloco que a recepção vê (o restante do perfil é clínico). */
export function PatientHeader({ patient }: { patient: PatientDetail }) {
  const situation = SITUATIONS[patient.situation]
  const { nutritionist, unit } = patient
  const details = [
    { icon: CalendarDays, text: `Cadastro: ${formatShortDate(patient.created_at)}`, label: undefined },
    nutritionist && {
      icon: Stethoscope,
      text: `${nutritionist.full_name}${nutritionist.crn ? ` (${nutritionist.crn})` : ""}`,
      label: "Responsável",
    },
    unit && { icon: MapPin, text: unit.name, label: "Unidade" },
  ].filter((item) => !!item)

  return (
    <section aria-label="Identificação do paciente" className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex items-start gap-5 sm:items-center">
        <span
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-foreground ring-4 ring-muted"
        >
          {getInitials(patient.full_name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl leading-8 font-bold tracking-tight">{patient.full_name}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                situation.badge,
              )}
            >
              <span className={cn("size-2 rounded-full", situation.dot)} aria-hidden />
              {situation.label}
            </span>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {details.map(({ icon: Icon, text, label }) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon className="size-4 shrink-0" aria-hidden />
                {label && <span className="sr-only">{label}: </span>}
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field
          label="Nasc / Idade"
          value={
            patient.birth_date
              ? `${new Date(`${patient.birth_date}T00:00:00`).toLocaleDateString("pt-BR")} (${getAge(patient.birth_date)}a)`
              : null
          }
        />
        <Field label="Sexo" value={patient.sex ? SEX_LABELS[patient.sex] : null} />
        <Field label="Telefone" value={patient.phone} />
        <Field label="E-mail principal" value={patient.email} className="col-span-2 sm:col-span-3 lg:col-span-3" />
      </dl>
    </section>
  )
}
