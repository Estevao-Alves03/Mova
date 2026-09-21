import { IdCard, Pencil, Quote } from "lucide-react"

import { getInitials } from "@/lib/user"
import { parseBrazilianDate } from "@/lib/masks"

import { getAge } from "../format"
import { PATIENT_GOALS, type BasicDataValues } from "./schema"

const SEX_LABEL = { female: "Fem", male: "Masc", unspecified: null } as const

/** Resumo do que foi digitado na etapa 1; "Editar" volta a ela. */
export function PatientSummaryCard({ values, onEdit }: { values: BasicDataValues; onEdit: () => void }) {
  const birth = parseBrazilianDate(values.birth_date)
  const goal = PATIENT_GOALS.find((item) => item.value === values.goal)
  const details = [
    birth ? `${getAge(birth)} anos (${values.birth_date})` : null,
    SEX_LABEL[values.sex],
  ].filter(Boolean)

  return (
    <section aria-label="Dados cadastrados" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/70 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <IdCard className="size-[18px] text-primary" aria-hidden />
          Dados Cadastrados
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="size-3" aria-hidden />
          Editar
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
          {getInitials(values.full_name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] leading-5 font-bold">{values.full_name}</span>
          {details.length > 0 && <span className="font-data text-xs text-muted-foreground">{details.join(" • ")}</span>}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="flex flex-col">
          <dt className="text-muted-foreground">WhatsApp/Tel:</dt>
          <dd className="font-medium">{values.phone}</dd>
        </div>
        {values.email && (
          <div className="flex min-w-0 flex-col">
            <dt className="text-muted-foreground">E-mail:</dt>
            <dd className="truncate font-medium">{values.email}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-1 border-t border-border/70 pt-2">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Objetivo Principal:</span>
        <span className="w-fit rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{goal?.label}</span>
      </div>

      {values.notes && (
        <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-muted/60 p-2.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Quote className="size-3" aria-hidden />
            Observação Inicial:
          </span>
          <p className="text-xs leading-relaxed break-words italic">“{values.notes}”</p>
        </div>
      )}
    </section>
  )
}
