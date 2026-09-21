import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const STEPS = [
  { title: "Dados Básicos" },
  { title: "Profissional & Horário" },
  { title: "Confirmação" },
] as const

/** Indicador das 3 etapas (1 = Dados Básicos). */
export function NewPatientStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Etapas do cadastro" className="flex gap-2 pt-2 sm:grid sm:grid-cols-3 sm:gap-3">
      {STEPS.map((step, index) => {
        const number = index + 1
        const active = number === current
        const done = number < current
        return (
          <li
            key={step.title}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-xl p-2.5",
              active ? "flex-1" : "shrink-0 sm:shrink",
              active
                ? "border-2 border-primary bg-accent text-accent-foreground"
                : "border border-border/80 bg-muted/60 text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                active ? "bg-primary text-primary-foreground" : done ? "bg-success text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : number}
            </span>
            <span className={cn("min-w-0 flex-col", active ? "flex" : "hidden sm:flex")}>
              <span className="text-[10px] leading-4 font-bold tracking-wider uppercase">
                Etapa {number}
                {active ? " • Ativa" : done ? " • Concluída" : ""}
              </span>
              <span className={cn("truncate text-[13px] leading-[18px]", active ? "font-bold text-foreground" : "font-medium")}>
                {step.title}
              </span>
            </span>
            {active && (
              <span className="ml-auto hidden shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary sm:inline">
                Em foco
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
