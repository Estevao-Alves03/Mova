export interface WeeklyRhythm {
  /** Ex.: "Sem 01 (01-07)". */
  label: string
  done: number
  capacity: number
  /** Taxa de ocupação da semana, em %. */
  occupancy: number
  /** Semana ainda em andamento ou futura (valores previstos). */
  projected?: boolean
}

export interface DashboardData {
  clinicLabel: string
  units: string[]
  periods: string[]
  selectedPeriod: string
  appointments: { done: number; goal: number; growthPct: number }
  occupancy: {
    ratePct: number
    label: string
    avgHoursPerDay: number
    freeHoursInMonth: number
  }
  patients: { active: number; newThisMonth: number; retentionPct: number }
  rhythm: { periodLabel: string; weeks: WeeklyRhythm[] }
  alerts: {
    patientsWithoutReturn: number
    cancellationsLast24h: number
    freedSlots: string[]
  }
}
