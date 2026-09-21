import { RotateCcw, Search, X } from "lucide-react"

import { IconInput } from "@/components/shared/IconInput"
import { NativeSelect } from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

import { PATIENT_GOALS } from "../new/schema"
import { SITUATIONS, SITUATION_ORDER } from "../situations"
import { ALL, type PatientList } from "../usePatientList"

export function PatientFilters({ list }: { list: PatientList }) {
  const { showClinical, canPickProfessional } = list
  const hasFilters = list.chips.length > 0
  const selects = [showClinical, canPickProfessional].filter(Boolean).length + 1

  return (
    <section aria-label="Busca e filtros" className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <IconInput
            icon={Search}
            type="search"
            aria-label="Buscar na lista de pacientes"
            placeholder="Buscar paciente por nome, telefone ou e-mail..."
            value={list.query}
            onChange={(event) => list.setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        <p role="status" className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <span>
            Exibindo{" "}
            <strong className="font-data font-semibold text-foreground">
              {list.from}–{list.to}
            </strong>{" "}
            de <strong className="font-data font-semibold text-foreground">{list.total}</strong> pacientes
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
        <span className="text-[11px] leading-4 font-semibold tracking-wider text-muted-foreground uppercase">Filtrar por:</span>
        <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", selects >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          <NativeSelect
            aria-label="Situação"
            value={list.situation}
            onChange={(event) => list.setFilter("situation", event.target.value)}
            className="font-medium"
          >
            <option value={ALL}>Situação: Todas</option>
            {SITUATION_ORDER.map((situation) => (
              <option key={situation} value={situation}>
                Situação: {SITUATIONS[situation].filterLabel}
              </option>
            ))}
          </NativeSelect>

          {/* Objetivo é dado clínico: a recepção não filtra por ele. */}
          {showClinical && (
            <NativeSelect
              aria-label="Objetivo"
              value={list.goal}
              onChange={(event) => list.setFilter("goal", event.target.value)}
              className="font-medium"
            >
              <option value={ALL}>Todos os Objetivos</option>
              {PATIENT_GOALS.map((goal) => (
                <option key={goal.value} value={goal.value}>
                  {goal.label}
                </option>
              ))}
            </NativeSelect>
          )}

          {/* O nutricionista só vê os próprios pacientes: não há o que filtrar. */}
          {canPickProfessional && (
            <NativeSelect
              aria-label="Profissional"
              value={list.professional}
              onChange={(event) => list.setFilter("professional", event.target.value)}
              className="font-medium"
            >
              <option value={ALL}>Todos os Profissionais</option>
              {list.professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  Profissional: {professional.full_name}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!hasFilters}
            onClick={list.clearFilters}
            title="Limpar todos os filtros"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-muted px-3.5 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <RotateCcw className="size-4" aria-hidden />
            Limpar filtros
          </button>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border/80 pt-2.5">
          <span className="mr-1 text-xs text-muted-foreground">Filtros ativos:</span>
          {list.chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remover filtro ${chip.label}`}
                onClick={() => list.setFilter(chip.key, ALL)}
                className="flex items-center rounded outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={list.clearFilters} className="ml-1 text-xs font-medium text-primary hover:underline">
            Redefinir
          </button>
        </div>
      )}
    </section>
  )
}
