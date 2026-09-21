import { Download, UserPlus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { NewPatientDialog } from "./new/NewPatientDialog"
import { PatientFilters } from "./components/PatientFilters"
import { PatientKpis } from "./components/PatientKpis"
import { PatientsPagination } from "./components/PatientsPagination"
import { PatientsTable } from "./components/PatientsTable"
import { usePatientList } from "./usePatientList"

export function PatientsPage() {
  const list = usePatientList()
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl leading-8 font-bold tracking-tight">Base de Clientes</h1>
          <span aria-hidden className="text-muted-foreground/60">
            •
          </span>
          <span className="text-[13px] text-muted-foreground">{list.baseTotal} clientes cadastrados</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sem regra de exportação definida: só visual. */}
          <Button type="button" variant="outline" disabled className="h-10 gap-2 rounded-xl px-4 text-[13px] font-semibold shadow-sm">
            <Download className="size-[18px]" aria-hidden />
            Exportar Relatório
          </Button>
          {/* Só recepção e admin criam pacientes (docs/permissoes.md); a API também recusa os demais. */}
          {list.canCreate && (
            <Button
              type="button"
              onClick={() => setNewPatientOpen(true)}
              className="h-10 gap-2 rounded-xl px-4 text-[13px] font-semibold shadow-md"
            >
              <UserPlus className="size-[18px]" aria-hidden />
              Novo Paciente
            </Button>
          )}
        </div>
      </header>

      <PatientKpis list={list} />
      <PatientFilters list={list} />

      <section aria-label="Lista de pacientes" className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {list.isPending ? (
          <Skeleton aria-label="Carregando os pacientes" className="m-6 h-64 rounded-xl" />
        ) : list.error ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-destructive">{list.error.message}</p>
            <Button type="button" variant="outline" onClick={list.refetch} className="rounded-xl">
              Tentar novamente
            </Button>
          </div>
        ) : list.baseTotal === 0 ? (
          <p role="status" className="px-6 py-16 text-center text-sm text-muted-foreground">
            Nenhum paciente cadastrado ainda.{list.canCreate ? " Use \"Novo Paciente\" para começar." : ""}
          </p>
        ) : list.items.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">Nenhum paciente encontrado com esses filtros.</p>
            <Button type="button" variant="outline" onClick={() => { list.clearFilters(); list.setQuery("") }} className="rounded-xl">
              Limpar busca e filtros
            </Button>
          </div>
        ) : (
          <>
            <PatientsTable list={list} />
            <PatientsPagination
              page={list.page}
              pageCount={list.pageCount}
              from={list.from}
              to={list.to}
              total={list.total}
              onPage={list.setPage}
            />
          </>
        )}
      </section>

      {list.canCreate && <NewPatientDialog open={newPatientOpen} onOpenChange={setNewPatientOpen} />}
    </div>
  )
}
