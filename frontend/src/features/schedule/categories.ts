import type { AppointmentType } from "./scheduleConfig"
import type { AppointmentStatus, EventKind } from "./types"

export interface CategoryConfig {
  kind: EventKind
  label: string
  /** Rótulo curto (cartões e chips). */
  shortLabel: string
  /** Legenda à direita no filtro (para tipos de atendimento vem da duração configurada). */
  hint: string
  /** Tipo de atendimento da API que esta categoria representa (intervalo e bloqueio não têm). */
  appointmentType?: AppointmentType
  /** Classes completas (o Tailwind precisa enxergá-las inteiras). */
  card: string
  chip: string
  dot: string
  accentVar: string
}

export const CATEGORIES: CategoryConfig[] = [
  {
    kind: "first",
    label: "Primeira Consulta / Anamnese",
    shortLabel: "1ª Consulta",
    hint: "",
    appointmentType: "first_consultation",
    card: "border-cat-first bg-cat-first/10",
    chip: "bg-cat-first/15",
    dot: "bg-cat-first",
    accentVar: "var(--cat-first)",
  },
  {
    kind: "return",
    label: "Consulta de Retorno",
    shortLabel: "Retorno",
    hint: "",
    appointmentType: "return_consultation",
    card: "border-cat-return bg-cat-return/10",
    chip: "bg-cat-return/15",
    dot: "bg-cat-return",
    accentVar: "var(--cat-return)",
  },
  {
    kind: "anthropometry",
    label: "Avaliação Antropométrica",
    shortLabel: "Antropometria",
    hint: "",
    appointmentType: "assessment",
    card: "border-cat-anthropometry bg-cat-anthropometry/10",
    chip: "bg-cat-anthropometry/15",
    dot: "bg-cat-anthropometry",
    accentVar: "var(--cat-anthropometry)",
  },
  {
    kind: "break",
    label: "Intervalo / Almoço",
    shortLabel: "Intervalo",
    hint: "Almoço",
    card: "border-cat-break bg-cat-break/15",
    chip: "bg-cat-break/20",
    dot: "bg-cat-break",
    accentVar: "var(--cat-break)",
  },
  {
    kind: "block",
    label: "Indisponível",
    shortLabel: "Indisponível",
    hint: "Indisp.",
    card: "border-cat-block bg-cat-block/10",
    chip: "bg-cat-block/15",
    dot: "bg-cat-block",
    accentVar: "var(--cat-block)",
  },
]

export const CATEGORY_BY_KIND = Object.fromEntries(CATEGORIES.map((c) => [c.kind, c])) as Record<
  EventKind,
  CategoryConfig
>

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  waiting: "Em espera",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
}

/** Classes do selo de status. */
export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-accent text-accent-foreground",
  confirmed: "bg-success/15 text-foreground",
  waiting: "bg-warning/20 text-foreground",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-destructive/10 text-destructive",
}

/** Grade padrão (08–18h) enquanto nenhum expediente foi configurado. */
export const DEFAULT_GRID_START_HOUR = 8
export const DEFAULT_GRID_END_HOUR = 18
