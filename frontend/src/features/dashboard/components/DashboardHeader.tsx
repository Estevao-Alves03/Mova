import { Building2, ChevronDown, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DashboardHeaderProps {
  userName: string
  clinicLabel: string
  units: string[]
  periods: string[]
  selectedPeriod: string
}

// Filtros e relatório são somente visuais: dependem da API do dashboard.
export function DashboardHeader({
  userName,
  clinicLabel,
  units,
  periods,
  selectedPeriod,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] leading-tight font-bold tracking-tight md:text-[28px]">
            Olá, {userName}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-medium text-muted-foreground shadow-xs">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            {clinicLabel}
          </span>
        </div>
        <p className="text-xs leading-4 text-muted-foreground">
          Acompanhe o desempenho clínico da sua operação hoje.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
        <div className="relative flex items-center rounded-xl border border-border bg-card px-3 py-1.5 shadow-xs">
          <Building2 className="mr-2 size-[18px] text-primary" aria-hidden />
          <select
            aria-label="Unidade"
            disabled
            className="cursor-not-allowed appearance-none bg-transparent pr-5 text-[13px] font-medium outline-none"
          >
            {units.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 size-4 text-muted-foreground"
            aria-hidden
          />
        </div>

        <div
          role="group"
          aria-label="Período"
          className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted p-1 shadow-inner"
        >
          {periods.map((period) => {
            const isSelected = period === selectedPeriod
            return (
              <button
                key={period}
                type="button"
                disabled
                aria-pressed={isSelected}
                className={cn(
                  "cursor-not-allowed rounded-lg px-3 py-1 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground",
                )}
              >
                {period}
              </button>
            )
          })}
        </div>

        <Button
          variant="outline"
          disabled
          className="h-9 gap-1.5 rounded-xl bg-card px-3.5 text-[11px] font-semibold shadow-xs"
          title="Baixar relatório"
        >
          <Download className="size-[18px] text-primary" aria-hidden />
          Relatório
        </Button>
      </div>
    </div>
  )
}
