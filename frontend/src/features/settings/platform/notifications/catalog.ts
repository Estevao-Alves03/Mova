// Textos exibidos para os identificadores que o backend devolve no catálogo.

export const SOUND_SLOT_LABELS: Record<string, { label: string; tag: string }> = {
  new_appointment: { label: "Novo Paciente Agendado", tag: "Clássico" },
  upcoming_appointment: { label: "Consulta Iminente (10 min antes)", tag: "Alerta" },
  reception_checkin: { label: "Check-in na Recepção / Chegada", tag: "Recepção" },
}

export const SOUND_LABELS: Record<string, string> = {
  classic_soft: "Clássico Clínico Suave",
  crystal_bell: "Sino Cristalino",
  serene_harp: "Harpa Serena",
  pulsing_alert: "Alerta Pulsante",
  double_bell: "Sino Duplo",
  major_chord: "Acorde Maior",
  soft_gong: "Gongo Reverberante Suave",
  office_bell: "Campainha de Consultório",
  warm_notification: "Notificação Quente",
  silent: "Silencioso",
}

export const EVENT_LABELS: Record<string, { label: string; description: string }> = {
  appointment_created: {
    label: "Nova consulta agendada",
    description: "Disparado no momento exato da inclusão na grade",
  },
  appointment_cancelled: {
    label: "Cancelamento ou reagendamento de consulta",
    description: "Libera horário na agenda e notifica a equipe imediatamente",
  },
  appointment_confirmed: {
    label: "Confirmação de presença do paciente",
    description: "Registrada pela recepção na chegada",
  },
  reevaluation_due: {
    label: "Lembrete de reavaliação periódica vencendo (30/60 dias)",
    description: "Alerta pró-ativo de retenção clínica",
  },
  daily_summary: {
    label: "Resumo diário matinal da agenda (07:30)",
    description: "Briefing com primeiras consultas e retornos do dia",
  },
  appointment_reminder: {
    label: "Lembrete de atendimento",
    description: "Aviso antes da sua consulta",
  },
  appointment_changed: {
    label: "Consulta remarcada ou cancelada",
    description: "Aviso quando o horário da sua consulta mudar",
  },
}

const EVENT_GROUPS: { title: string; events: string[] }[] = [
  { title: "Agendamento & Cancelamentos", events: ["appointment_created", "appointment_cancelled", "appointment_confirmed"] },
  { title: "Acompanhamento Clínico", events: ["reevaluation_due"] },
  { title: "Operacional", events: ["daily_summary"] },
  { title: "Seus atendimentos", events: ["appointment_reminder", "appointment_changed"] },
]

/** Agrupa só os eventos que o catálogo do papel oferece; grupos vazios somem. */
export function groupEvents(available: string[]) {
  return EVENT_GROUPS.map((group) => ({
    title: group.title,
    events: group.events.filter((event) => available.includes(event)),
  }))
    .filter((group) => group.events.length > 0)
    .map((group, index) => ({ ...group, title: `${index + 1}. ${group.title}` }))
}

export const QUIET_DAYS_LABELS = {
  weekdays: "Segunda a Sexta-feira",
  every_day: "Todos os dias",
} as const
