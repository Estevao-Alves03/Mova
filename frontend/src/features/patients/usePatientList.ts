import { useMemo } from "react"
import { useSearchParams } from "react-router"

import { useScheduleProfessionals } from "@/features/schedule/api"
import { useProfile } from "@/features/settings/api"

import { usePatients } from "./api"
import { PATIENT_GOALS } from "./new/schema"
import { SITUATIONS, SITUATION_ORDER } from "./situations"
import type { PatientListItem, PatientSituation } from "./types"

export const PAGE_SIZE = 8
export const ALL = "all"

export type SortKey = "name_asc" | "name_desc" | "last_desc" | "last_asc"
const SORTS: SortKey[] = ["name_asc", "name_desc", "last_desc", "last_asc"]

type FilterKey = "situation" | "goal" | "professional"

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const digits = (text: string) => text.replace(/\D/g, "")

export const goalLabel = (goal: string | null | undefined) => PATIENT_GOALS.find((item) => item.value === goal)?.label ?? null

function compare(sort: SortKey) {
  return (a: PatientListItem, b: PatientListItem) => {
    if (sort === "name_asc" || sort === "name_desc") {
      const order = a.full_name.localeCompare(b.full_name, "pt-BR")
      return sort === "name_asc" ? order : -order
    }
    // Sem consulta vai sempre para o fim, em qualquer direção.
    if (!a.last_consultation_at || !b.last_consultation_at) {
      return Number(!a.last_consultation_at) - Number(!b.last_consultation_at)
    }
    const order = new Date(a.last_consultation_at).getTime() - new Date(b.last_consultation_at).getTime()
    return sort === "last_asc" ? order : -order
  }
}

/**
 * Indicadores do topo, calculados sobre os pacientes reais que o papel enxerga. As regras de cálculo dos
 * indicadores ainda não estão definidas (docs/produto.md §20): é só uma leitura destes dados.
 */
function buildKpis(patients: PatientListItem[], now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const upcoming = patients.filter((patient) => {
    const next = patient.next_appointment_at ? new Date(patient.next_appointment_at) : null
    return !!next && next >= now && next < monthEnd
  })
  const alerts = patients.filter((patient) => patient.situation === "alert")
  const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

  return {
    activeCount: patients.length,
    activeShare: patients.length ? 100 : 0,
    newThisMonth: patients.filter((patient) => new Date(patient.created_at) >= monthStart).length,
    upcomingCount: upcoming.length,
    upcomingShare: share(upcoming.length, patients.length),
    alertCount: alerts.length,
    alertShare: share(alerts.length, patients.length),
  }
}

export function usePatientList() {
  const { data: profile } = useProfile()
  const patientsQuery = usePatients()
  const professionalsQuery = useScheduleProfessionals()
  const [params, setParams] = useSearchParams()

  // Permissões (docs/permissoes.md). Só UX: a API filtra os pacientes e recorta os campos de verdade.
  const role = profile?.role
  const isNutritionist = role === "nutritionist"
  const canCreate = role === "admin" || role === "receptionist"
  // A recepção não recebe dados clínicos (objetivo): a interface também não os oferece.
  const showClinical = role !== "receptionist"
  const canPickProfessional = !isNutritionist

  const professionals = useMemo(() => professionalsQuery.data ?? [], [professionalsQuery.data])
  const visible = useMemo(() => patientsQuery.data ?? [], [patientsQuery.data])

  const query = params.get("q") ?? ""
  const situation = SITUATION_ORDER.includes(params.get("situation") as PatientSituation)
    ? (params.get("situation") as PatientSituation)
    : ALL
  const goal = PATIENT_GOALS.some((item) => item.value === params.get("goal")) ? (params.get("goal") as string) : ALL
  const professionalParam = params.get("professional")
  const professional = professionals.some((item) => item.id === professionalParam) ? (professionalParam as string) : ALL
  const sort = SORTS.includes(params.get("sort") as SortKey) ? (params.get("sort") as SortKey) : "name_asc"

  function update(next: Record<string, string | undefined>) {
    setParams(
      (previous) => {
        const search = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(next)) {
          if (value === undefined || value === "" || value === ALL) search.delete(key)
          else search.set(key, value)
        }
        // Qualquer mudança de filtro, busca ou ordem volta para a primeira página.
        if (!("page" in next)) search.delete("page")
        return search
      },
      { replace: true },
    )
  }

  const normalizedQuery = normalize(query.trim())
  const queryDigits = digits(query)
  const filtered = useMemo(
    () =>
      visible
        .filter(
          (patient) =>
            (situation === ALL || patient.situation === situation) &&
            (!showClinical || goal === ALL || patient.goal === goal) &&
            (professional === ALL || patient.nutritionist_id === professional) &&
            (!normalizedQuery ||
              normalize(patient.full_name).includes(normalizedQuery) ||
              normalize(patient.email ?? "").includes(normalizedQuery) ||
              (queryDigits.length >= 2 && digits(patient.phone ?? "").includes(queryDigits))),
        )
        .sort(compare(sort)),
    [visible, situation, goal, professional, normalizedQuery, queryDigits, sort, showClinical],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(Math.max(Number(params.get("page")) || 1, 1), pageCount)
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const kpis = useMemo(() => buildKpis(visible, new Date()), [visible])

  const chips: { key: FilterKey; label: string }[] = [
    ...(situation !== ALL ? [{ key: "situation" as const, label: `Situação: ${SITUATIONS[situation].filterLabel}` }] : []),
    ...(showClinical && goal !== ALL ? [{ key: "goal" as const, label: `Objetivo: ${goalLabel(goal)}` }] : []),
    ...(canPickProfessional && professional !== ALL
      ? [{ key: "professional" as const, label: `Profissional: ${professionals.find((item) => item.id === professional)?.full_name ?? ""}` }]
      : []),
  ]

  return {
    role,
    canCreate,
    showClinical,
    canPickProfessional,
    professionals,
    isPending: patientsQuery.isPending,
    error: patientsQuery.error ?? undefined,
    refetch: () => void patientsQuery.refetch(),
    query,
    situation,
    goal,
    professional,
    sort,
    setQuery: (value: string) => update({ q: value }),
    setFilter: (key: FilterKey, value: string) => update({ [key]: value }),
    clearFilters: () => update({ situation: ALL, goal: ALL, professional: ALL }),
    toggleSort: (field: "name" | "last") =>
      update({
        sort:
          field === "name"
            ? sort === "name_asc" ? "name_desc" : "name_asc"
            : sort === "last_desc" ? "last_asc" : "last_desc",
      }),
    chips,
    page,
    pageCount,
    setPage: (value: number) => update({ page: String(value) }),
    items,
    total: filtered.length,
    baseTotal: visible.length,
    from: filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: Math.min(page * PAGE_SIZE, filtered.length),
    kpis,
  }
}

export type PatientList = ReturnType<typeof usePatientList>
