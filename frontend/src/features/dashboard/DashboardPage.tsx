import { CalendarCheck, Clock, TrendingUp, UserPlus, Users, Activity } from "lucide-react"

import { useProfile } from "@/features/settings/api"
import { formatDecimal, formatPercent } from "@/lib/format"
import { mockDashboard } from "@/mocks/dashboard"

import { DashboardHeader } from "./components/DashboardHeader"
import { KpiCard } from "./components/KpiCard"
import { OperationalRhythmChart } from "./components/OperationalRhythmChart"
import { RetentionAlertsCard } from "./components/RetentionAlertsCard"

const numberFormat = new Intl.NumberFormat("pt-BR")

export function DashboardPage() {
  const data = mockDashboard
  const { data: profile } = useProfile()
  const { appointments, occupancy, patients } = data
  const completionPct = (appointments.done / appointments.goal) * 100

  return (
    <div className="flex flex-col gap-6 pb-10">
      <DashboardHeader
        userName={profile?.full_name ?? ""}
        clinicLabel={data.clinicLabel}
        units={data.units}
        periods={data.periods}
        selectedPeriod={data.selectedPeriod}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Atendimentos no Mês"
          icon={Activity}
          highlighted
          value={numberFormat.format(appointments.done)}
          valueAside={
            <span className="font-data text-[11px] leading-[14px] text-muted-foreground">
              / {numberFormat.format(appointments.goal)} meta
            </span>
          }
          footer={
            <>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-0.5 font-semibold">
                  <TrendingUp className="size-[15px] text-success" aria-hidden />+
                  {formatPercent(appointments.growthPct)}
                </span>
                <span className="text-muted-foreground">
                  {formatPercent(completionPct)} concluído
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Atendimentos concluídos em relação à meta"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(completionPct)}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </>
          }
        />

        <KpiCard
          label="Taxa de Ocupação"
          icon={CalendarCheck}
          value={formatPercent(occupancy.ratePct)}
          valueAside={
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-foreground uppercase">
              {occupancy.label}
            </span>
          }
          footer={
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-4" aria-hidden />
                Média {formatDecimal(occupancy.avgHoursPerDay)}h/dia
              </span>
              <span className="font-semibold text-foreground">
                {occupancy.freeHoursInMonth}h vagas no mês
              </span>
            </div>
          }
        />

        <KpiCard
          label="Pacientes em Acompanhamento"
          className="md:col-span-2 xl:col-span-1"
          icon={Users}
          value={numberFormat.format(patients.active)}
          valueAside={
            <span className="text-[11px] leading-[14px] font-semibold text-muted-foreground">
              pacientes
            </span>
          }
          footer={
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                <UserPlus className="size-3.5" aria-hidden />+{patients.newThisMonth} novos
              </span>
              <span className="text-muted-foreground">
                Retenção: <strong className="text-foreground">{patients.retentionPct}%</strong>
              </span>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <OperationalRhythmChart
            periodLabel={data.rhythm.periodLabel}
            weeks={data.rhythm.weeks}
          />
        </div>
        <div className="xl:col-span-4">
          <RetentionAlertsCard alerts={data.alerts} />
        </div>
      </div>
    </div>
  )
}
