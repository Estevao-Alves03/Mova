import { ArrowUp, CalendarDays, TriangleAlert, Users } from "lucide-react"

import { KpiCard } from "@/components/shared/KpiCard"
import { cn } from "@/lib/utils"

import type { PatientList } from "../usePatientList"

function Bar({ percent, className }: { percent: number; className: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Indicadores do topo: leitura dos pacientes reais (regras de cálculo ainda não definidas). */
export function PatientKpis({ list }: { list: PatientList }) {
  const { kpis } = list
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        label="Pacientes Ativos"
        icon={Users}
        highlighted
        value={kpis.activeCount}
        valueAside={
          <span className="flex items-center gap-0.5 font-data text-[11px] font-semibold text-success">
            <ArrowUp className="size-3.5" aria-hidden />+{kpis.newThisMonth}
            <span className="ml-0.5 font-normal text-muted-foreground">novos no mês</span>
          </span>
        }
        footer={<Bar percent={kpis.activeShare} className="bg-primary" />}
      />
      <KpiCard
        label="Consultas & Retornos (Mês)"
        icon={CalendarDays}
        value={kpis.upcomingCount}
        valueAside={<span className="text-[11px] text-muted-foreground">Agendados para este mês</span>}
        footer={<Bar percent={kpis.upcomingShare} className="bg-primary" />}
      />
      <KpiCard
        label="Retornos em Atenção"
        icon={TriangleAlert}
        iconClassName="bg-warning/10 text-warning"
        value={kpis.alertCount}
        valueAside={
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
            Requer reconvocação
          </span>
        }
        footer={<Bar percent={kpis.alertShare} className="bg-warning" />}
      />
    </div>
  )
}
