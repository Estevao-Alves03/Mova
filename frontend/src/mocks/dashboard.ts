import type { DashboardData } from "@/features/dashboard/types"

// Dados fictícios (visão do nutricionista) até existir a API do dashboard.
export const mockDashboard: DashboardData = {
  clinicLabel: "Clínica Jardins & Telemedicina",
  units: [
    "Todas Unidades (Jardins + Online)",
    "Unidade Jardins Presencial",
    "Telemedicina & Digital",
  ],
  periods: ["Hoje", "Esta Semana", "Este Mês", "Últimos 30d", "2025"],
  selectedPeriod: "Este Mês",
  appointments: { done: 142, goal: 160, growthPct: 14.2 },
  occupancy: {
    ratePct: 88.4,
    label: "Excelente",
    avgHoursPerDay: 6.2,
    freeHoursInMonth: 12,
  },
  patients: { active: 184, newThisMonth: 26, retentionPct: 92 },
  rhythm: {
    periodLabel: "Março 2025",
    weeks: [
      { label: "Sem 01 (01-07)", done: 33, capacity: 40, occupancy: 82.5 },
      { label: "Sem 02 (08-14)", done: 35, capacity: 40, occupancy: 87.5 },
      { label: "Sem 03 (15-21)", done: 36, capacity: 40, occupancy: 90 },
      { label: "Sem 04 (Atual)", done: 38, capacity: 40, occupancy: 96.8 },
      { label: "Sem 05 (Prev)", done: 22, capacity: 28, occupancy: 78.6, projected: true },
    ],
  },
  alerts: {
    patientsWithoutReturn: 18,
    cancellationsLast24h: 3,
    freedSlots: ["14:00", "16:00", "17:30"],
  },
}
