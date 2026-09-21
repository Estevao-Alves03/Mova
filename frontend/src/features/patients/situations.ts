import type { PatientSituation } from "./types"

export interface SituationStyle {
  label: string
  /** Rótulo do filtro. */
  filterLabel: string
  /** Classes completas (o Tailwind precisa enxergá-las inteiras). */
  badge: string
  dot: string
  /** Linha "Status:" sob o selo. */
  statusLabel: string
  statusTone: string
}

export const SITUATIONS: Record<PatientSituation, SituationStyle> = {
  following: {
    label: "Em acompanhamento",
    filterLabel: "Em acompanhamento",
    badge: "bg-success/15 text-success",
    dot: "bg-success",
    statusLabel: "Ativo",
    statusTone: "text-success",
  },
  first_visit: {
    label: "Primeira consulta",
    filterLabel: "Primeira consulta",
    badge: "bg-accent text-accent-foreground",
    dot: "bg-primary",
    statusLabel: "Novo",
    statusTone: "text-primary",
  },
  alert: {
    label: "Em alerta (>45d)",
    filterLabel: "Em alerta",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    statusLabel: "Pendente retorno",
    statusTone: "text-warning",
  },
}

export const SITUATION_ORDER: PatientSituation[] = ["following", "first_visit", "alert"]
