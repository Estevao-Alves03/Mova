import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CircleCheck, UserCheck, UserPlus } from "lucide-react"
import { useNavigate } from "react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ScrollRegion } from "@/components/shared/ScrollRegion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ApiError } from "@/lib/api"
import { parseBrazilianDate } from "@/lib/masks"

import { useCreatePatient, type CreatePatientPayload } from "../api"

import { NewPatientStepper } from "./NewPatientStepper"
import { basicDataSchema, EMPTY_BASIC_DATA, type BasicDataValues } from "./schema"
import { StepBasicData } from "./StepBasicData"
import { StepDone, type CreatedSummary } from "./StepDone"
import { StepSchedule } from "./StepSchedule"
import { EMPTY_SELECTION, useSchedulingChoice, type ScheduleSelection } from "./useSchedulingChoice"

// Campos da etapa 1 que a API pode recusar; nesse caso voltamos a ela com o erro no campo.
const STEP_ONE_FIELDS = ["full_name", "birth_date", "sex", "phone", "email", "goal", "notes"] as const

interface NewPatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Novo paciente & 1ª consulta, em 3 etapas: 1) dados básicos, 2) profissional e horário, 3) confirmação.
 * Nada é gravado antes da última etapa. Só recepção e admin abrem este fluxo (docs/permissoes.md).
 */
export function NewPatientDialog({ open, onOpenChange }: NewPatientDialogProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const create = useCreatePatient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selection, setSelection] = useState<ScheduleSelection>(EMPTY_SELECTION)
  const [submitError, setSubmitError] = useState<string>()
  // Preenchido só depois de gravar: a etapa 3 mostra o que foi criado.
  const [created, setCreated] = useState<CreatedSummary | null>(null)
  const form = useForm<BasicDataValues>({
    resolver: zodResolver(basicDataSchema),
    defaultValues: EMPTY_BASIC_DATA,
    mode: "onTouched",
  })
  const dirty = form.formState.isDirty
  const choice = useSchedulingChoice(selection, open && step === 2)

  function close() {
    onOpenChange(false)
    form.reset(EMPTY_BASIC_DATA)
    setStep(1)
    setSelection(EMPTY_SELECTION)
    setSubmitError(undefined)
    setCreated(null)
    create.reset()
  }

  function select(patch: Partial<ScheduleSelection>) {
    setSelection((previous) => ({ ...previous, ...patch }))
    setSubmitError(undefined)
  }

  function onError(error: Error) {
    if (!(error instanceof ApiError)) {
      setSubmitError("Não foi possível salvar agora. Tente novamente.")
      return
    }
    const stepOneErrors = STEP_ONE_FIELDS.filter((field) => error.fieldErrors[field])
    if (stepOneErrors.length > 0) {
      for (const field of stepOneErrors) form.setError(field, { type: "server", message: error.fieldErrors[field] })
      setStep(1)
      toast.error("Corrija os dados do paciente.")
      return
    }
    setSubmitError(error.message)
    // Horário ocupado, fora do expediente etc.: a escolha não vale mais; recarrega os horários.
    if (error.code) {
      setSelection((previous) => ({ ...previous, slot: undefined }))
      void queryClient.invalidateQueries({ queryKey: ["schedule", "availability"] })
    }
  }

  function onConfirm() {
    if (!choice.professional || !choice.slot) return
    const values = form.getValues()
    const payload: CreatePatientPayload = {
      full_name: values.full_name,
      birth_date: parseBrazilianDate(values.birth_date),
      sex: values.sex === "unspecified" ? null : values.sex,
      phone: values.phone,
      email: values.email || null,
      nutritionist_id: choice.professional.id,
      first_appointment: {
        starts_at: choice.slot.starts_at,
        room_id: choice.roomId || null,
        goal: values.goal as CreatePatientPayload["first_appointment"]["goal"],
        notes: values.notes || null,
      },
    }
    // Capturado agora: depois de gravar, o horário sai da disponibilidade e a escolha deixa de existir.
    const summary: CreatedSummary = {
      values,
      professional: choice.professional,
      slot: choice.slot,
      unit: choice.unit,
      roomName: choice.unit?.rooms.find((room) => room.id === choice.roomId)?.name,
    }
    setSubmitError(undefined)
    create.mutate(payload, {
      onSuccess: () => {
        setCreated(summary)
        setStep(3)
      },
      onError,
    })
  }

  function viewAgenda() {
    if (!created) return
    const day = new Date(created.slot.starts_at)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    close()
    navigate(`/app/schedule?view=day&date=${iso}`)
  }

  // Avançar só com a etapa válida; os erros aparecem nos campos.
  const onAdvance = form.handleSubmit(() => setStep(2))

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        // Com dados digitados, um clique fora não descarta o formulário por acidente.
        onInteractOutside={(event) => dirty && step !== 3 && event.preventDefault()}
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"
      >
        {step === 3 && created ? (
          <>
            <DialogTitle className="sr-only">Cadastro concluído e primeira consulta agendada</DialogTitle>
            <DialogDescription className="sr-only">Resumo do paciente cadastrado e da primeira consulta.</DialogDescription>
            <StepDone summary={created} onViewAgenda={viewAgenda} onClose={close} />
          </>
        ) : (
          <form onSubmit={onAdvance} noValidate className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-col gap-4 border-b border-border px-6 py-5">
              <div className="flex flex-col gap-0.5 pr-8">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <UserPlus className="size-5" aria-hidden />
                  </span>
                  <DialogTitle className="text-xl leading-7 font-bold tracking-tight">Novo Paciente &amp; Primeira Consulta</DialogTitle>
                </div>
                <DialogDescription className="pl-10">
                  Cadastre os dados básicos para iniciar o atendimento e agende o primeiro horário na clínica.
                </DialogDescription>
              </div>
              <NewPatientStepper current={step} />
            </div>

            <ScrollRegion label={step === 1 ? "Dados básicos" : "Profissional e horário"} className="min-w-0 flex-1">
              {step === 1 ? (
                <StepBasicData form={form} />
              ) : (
                <StepSchedule
                  values={form.getValues()}
                  choice={choice}
                  selection={selection}
                  submitError={submitError}
                  onSelect={select}
                  onEditBasic={() => setStep(1)}
                />
              )}
            </ScrollRegion>

            <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 border-t border-border bg-card px-6 py-4 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
                {step === 1
                  ? "Etapa 1 de 3: os dados só são salvos ao confirmar o agendamento."
                  : "O paciente será inserido na Base de Clientes e o horário bloqueado na agenda."}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close} disabled={create.isPending} className="rounded-xl bg-muted">
                  Cancelar
                </Button>
                {step === 1 ? (
                  <Button type="submit" className="rounded-xl font-semibold">
                    Avançar para Disponibilidade &amp; Horário
                    <ArrowRight aria-hidden />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={onConfirm}
                    disabled={!choice.slot || create.isPending}
                    className="rounded-xl font-semibold"
                  >
                    <UserCheck aria-hidden />
                    {create.isPending ? "Salvando..." : "Confirmar Agendamento & Salvar Paciente"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
