import { ClipboardList, History, Ruler, Target, TrendingUp, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Só "Visão Geral e Metas" existe por enquanto; as demais seções entram nas próximas etapas.
const TABS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Visão Geral e Metas", icon: Target, active: true },
  { label: "Anamnese Clínica", icon: ClipboardList },
  { label: "Avaliação Corporal e Dobras", icon: Ruler },
  { label: "Evoluções e Gráficos", icon: TrendingUp },
  { label: "Histórico de Avaliações", icon: History },
]

/** Navegação do prontuário. Só é renderizada para quem recebe dados clínicos. */
export function PatientTabs() {
  return (
    <nav aria-label="Seções do paciente" className="flex overflow-x-auto rounded-2xl border border-border/40 bg-card px-2 shadow-sm">
      {TABS.map(({ label, icon: Icon, active }) => (
        <button
          key={label}
          type="button"
          disabled={!active}
          aria-current={active ? "page" : undefined}
          title={active ? undefined : "Em breve"}
          className={cn(
            "relative flex shrink-0 items-center justify-center gap-1.5 px-4 py-3 text-[13px] leading-[18px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring xl:flex-1",
            active ? "font-semibold text-primary" : "font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
          {label}
          {active && <span aria-hidden className="absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </nav>
  )
}
