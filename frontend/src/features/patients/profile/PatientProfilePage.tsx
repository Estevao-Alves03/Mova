import { useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"

import { usePatient } from "../api"
import { isClinical } from "../types"
import { GoalCard } from "./GoalCard"
import { PatientHeader } from "./PatientHeader"
import { PatientTabs } from "./PatientTabs"
import { SituationCard } from "./SituationCard"
import { TimelineCard } from "./TimelineCard"

export function PatientProfilePage() {
  const { patientId } = useParams()
  const { data: patient, isPending, error, refetch } = usePatient(patientId)

  if (isPending) return <Skeleton aria-label="Carregando o paciente" className="h-64 rounded-2xl" />

  if (error) {
    // 404 vale para inexistente e para paciente de outro profissional: a tela não diferencia (nem revela).
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center shadow-sm">
        <p className={notFound ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
          {notFound ? "Paciente não encontrado." : error.message}
        </p>
        {!notFound && (
          <Button type="button" variant="outline" onClick={() => void refetch()} className="rounded-xl">
            Tentar novamente
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PatientHeader patient={patient} />

      {/* Só chega o que o papel pode ver: a recepção fica apenas com o cadastro. */}
      {isClinical(patient) && (
        <>
          <PatientTabs />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-8">
              <GoalCard patient={patient} />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-4">
              <SituationCard patient={patient} />
              <TimelineCard items={patient.timeline} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
