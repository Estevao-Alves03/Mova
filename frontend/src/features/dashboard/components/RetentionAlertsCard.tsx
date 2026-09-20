import { ArrowRight, BellRing, CalendarX, UserX } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"

import type { DashboardData } from "../types"

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" })

interface RetentionAlertsCardProps {
  alerts: DashboardData["alerts"]
}

// Ações dos alertas são somente visuais: envio de mensagens e reocupação de
// horários não estão definidos no produto.
export function RetentionAlertsCard({ alerts }: RetentionAlertsCardProps) {
  const items = [
    {
      key: "no-return",
      icon: UserX,
      iconClassName: "text-warning",
      title: `${alerts.patientsWithoutReturn} pacientes sem retorno há mais de 45 dias`,
      description: "Em fase ativa de plano alimentar; risco iminente de abandono de tratamento.",
      action: "Disparar Mensagem",
      actionClassName: "bg-card text-foreground shadow-xs",
    },
    {
      key: "cancellations",
      icon: CalendarX,
      iconClassName: "text-destructive",
      title: `${alerts.cancellationsLast24h} cancelamentos nas últimas 24 horas`,
      description: `Horários de amanhã à tarde livres na agenda (${listFormat.format(alerts.freedSlots)}).`,
      action: "Reocupar Vagas",
      actionClassName: "bg-accent text-accent-foreground",
    },
  ]

  return (
    <section className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <BellRing className="size-[19px]" aria-hidden />
            </div>
            <div>
              <h2 className="text-base leading-6 font-semibold">Alertas de Retenção &amp; Agenda</h2>
              <p className="text-xs leading-4 text-muted-foreground">
                Ações recomendadas para evitar perda de vínculo
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 font-data text-[11px] leading-[14px] font-semibold">
            {items.length} Ações Críticas
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {items.map(({ key, icon: Icon, iconClassName, title, description, action, actionClassName }) => (
            <li key={key} className="flex items-start gap-2 rounded-xl bg-muted p-4">
              <Icon className={`mt-0.5 size-5 shrink-0 ${iconClassName}`} aria-hidden />
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="text-[13px] leading-[18px] font-semibold">{title}</span>
                <span className="text-xs leading-4 text-muted-foreground">{description}</span>
                <Button
                  variant="ghost"
                  disabled
                  className={`mt-2 h-auto rounded-lg px-3 py-1.5 text-[11px] leading-[14px] font-semibold ${actionClassName}`}
                >
                  {action}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Link
        to="/app/patients"
        className="flex items-center justify-end gap-1 text-[11px] leading-[14px] font-semibold text-primary hover:underline"
      >
        Ver lista de pacientes prioritários
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
