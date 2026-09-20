import { ChartLine, TrendingUp } from "lucide-react"

import type { AccountSummary } from "../types"

interface AccountSummaryCardProps {
  summary: AccountSummary
}

const numberFormat = new Intl.NumberFormat("pt-BR")

export function AccountSummaryCard({ summary }: AccountSummaryCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <ChartLine className="size-5 text-primary" aria-hidden />
        <h3 className="text-base leading-6 font-semibold">Resumo da Conta Clínica</h3>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
          <dt className="text-[11px] leading-[14px] tracking-wider text-muted-foreground uppercase">
            Pacientes ativos
          </dt>
          <dd className="font-data text-2xl leading-8 font-semibold">
            {numberFormat.format(summary.active_patients)}
          </dd>
          <dd className="flex items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
            <TrendingUp className="size-3.5 text-success" aria-hidden />+
            {summary.new_patients_this_month} este mês
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
          <dt className="text-[11px] leading-[14px] tracking-wider text-muted-foreground uppercase">
            Consultas feitas
          </dt>
          <dd className="font-data text-2xl leading-8 font-semibold">
            {numberFormat.format(summary.total_appointments)}
          </dd>
          <dd className="text-[11px] leading-[14px] text-muted-foreground">Total histórico</dd>
        </div>
      </dl>
    </section>
  )
}
