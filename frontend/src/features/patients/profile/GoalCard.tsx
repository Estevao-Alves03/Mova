import { Flag } from "lucide-react"

import { PATIENT_GOALS } from "../new/schema"
import type { PatientDetailClinical } from "../types"

/** Metas: por enquanto, o objetivo principal e a observação informados no cadastro (1ª consulta). */
export function GoalCard({ patient }: { patient: PatientDetailClinical }) {
  const goal = PATIENT_GOALS.find((item) => item.value === patient.goal)

  return (
    <section aria-labelledby="patient-goal-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-accent p-1.5 text-primary" aria-hidden>
          <Flag className="size-5" />
        </span>
        <h2 id="patient-goal-title" className="text-base leading-6 font-bold">
          Objetivo Principal do Tratamento
        </h2>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
        {goal ? (
          <>
            <p className="text-xl leading-7 font-bold tracking-tight">{goal.label}</p>
            <p className="text-[13px] text-muted-foreground">{goal.hint}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Objetivo não informado.</p>
        )}
        {patient.initial_notes && (
          <p className="pt-1 text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">Observação inicial:</strong> {patient.initial_notes}
          </p>
        )}
      </div>
    </section>
  )
}
