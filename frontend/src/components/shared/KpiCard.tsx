import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  icon: LucideIcon
  /** Ícone em destaque (fundo accent) ou neutro. */
  highlighted?: boolean
  /** Cores próprias do ícone (ex.: alerta em amarelo); substitui `highlighted`. */
  iconClassName?: string
  value: ReactNode
  /** Conteúdo ao lado do valor (meta, selo, unidade). */
  valueAside?: ReactNode
  footer: ReactNode
  className?: string
}

export function KpiCard({
  label,
  icon: Icon,
  highlighted,
  iconClassName,
  value,
  valueAside,
  footer,
  className,
}: KpiCardProps) {
  return (
    <section className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] leading-[18px] font-medium text-muted-foreground">
            {label}
          </h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-data text-[28px] leading-tight font-bold">{value}</span>
            {valueAside}
          </div>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            iconClassName ?? (highlighted ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"),
          )}
        >
          <Icon className="size-[22px]" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 font-data text-[11px] leading-[14px]">{footer}</div>
    </section>
  )
}
