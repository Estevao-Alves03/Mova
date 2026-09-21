import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

import type { PatientList, SortKey } from "../usePatientList"
import { GoalCell, LastConsultationCell, NextReturnCell, PatientIdentity, SituationCell } from "./PatientCells"

function SortHeader({ label, field, sort, onToggle }: { label: string; field: "name" | "last"; sort: SortKey; onToggle: () => void }) {
  const active = sort.startsWith(field)
  const Icon = !active ? ArrowUpDown : sort.endsWith("_asc") ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 rounded uppercase outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <Icon className="size-[15px]" aria-hidden />
      <span className="sr-only">{active ? (sort.endsWith("_asc") ? ", ordem crescente" : ", ordem decrescente") : ", ordenar"}</span>
    </button>
  )
}

function ariaSort(sort: SortKey, field: "name" | "last") {
  if (!sort.startsWith(field)) return "none" as const
  return sort.endsWith("_asc") ? ("ascending" as const) : ("descending" as const)
}

export function PatientsTable({ list }: { list: PatientList }) {
  const { items, showClinical, sort } = list
  const widths = showClinical ? ["30%", "16%", "18%", "17%", "19%"] : ["32%", "22%", "22%", "24%"]
  const head = "px-4 py-3 text-left font-semibold"

  return (
    <>
      {/* Desktop: tabela completa, sem rolagem horizontal. */}
      <table className="hidden w-full table-fixed border-collapse text-left xl:table">
        <caption className="sr-only">Pacientes</caption>
        <colgroup>
          {widths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-11 border-b border-border bg-muted/50 text-[11px] leading-4 tracking-wider text-muted-foreground uppercase">
            <th scope="col" aria-sort={ariaSort(sort, "name")} className={cn(head, "pl-6")}>
              <SortHeader label="Paciente" field="name" sort={sort} onToggle={() => list.toggleSort("name")} />
            </th>
            <th scope="col" className={head}>
              Situação &amp; Status
            </th>
            {showClinical && (
              <th scope="col" className={head}>
                Objetivo
              </th>
            )}
            <th scope="col" aria-sort={ariaSort(sort, "last")} className={head}>
              <SortHeader label="Última Consulta" field="last" sort={sort} onToggle={() => list.toggleSort("last")} />
            </th>
            <th scope="col" className={cn(head, "pr-6")}>
              Próximo Retorno
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {items.map((patient) => (
            <tr key={patient.id} className="transition-colors hover:bg-accent/40">
              <td className="py-3.5 pr-4 pl-6">
                <PatientIdentity patient={patient} />
              </td>
              <td className="px-4 py-3.5">
                <SituationCell patient={patient} />
              </td>
              {showClinical && (
                <td className="px-4 py-3.5">
                  <GoalCell patient={patient} />
                </td>
              )}
              <td className="px-4 py-3.5">
                <LastConsultationCell patient={patient} />
              </td>
              <td className="py-3.5 pr-6 pl-4">
                <NextReturnCell patient={patient} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Telas menores: um cartão por paciente. */}
      <ul aria-label="Pacientes" className="flex flex-col divide-y divide-border/80 xl:hidden">
        {items.map((patient) => (
          <li key={patient.id} className="flex flex-col gap-3 p-4">
            <PatientIdentity patient={patient} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SituationCell patient={patient} />
              {showClinical && <GoalCell patient={patient} />}
              <LastConsultationCell patient={patient} />
              <NextReturnCell patient={patient} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
