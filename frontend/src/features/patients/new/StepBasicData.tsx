import { Check, Contact, Info, IdCard, Mail, MessageSquare, Phone, Target, User, Venus, Mars } from "lucide-react"
import { Controller, type UseFormReturn } from "react-hook-form"

import { FormField } from "@/components/shared/FormField"
import { IconInput } from "@/components/shared/IconInput"
import { Textarea } from "@/components/ui/textarea"
import { maskDate, maskPhone } from "@/lib/masks"
import { cn } from "@/lib/utils"

import { MAX_NOTES_LENGTH, PATIENT_GOALS, type BasicDataValues } from "./schema"

function SectionTitle({ icon: Icon, children, aside }: { icon: typeof Contact; children: string; aside?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <Icon className="size-5 text-primary" aria-hidden />
      <h3 className="text-base leading-6 font-bold">{children}</h3>
      {aside && <span className="ml-auto text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  )
}

const SEX_CHOICES = [
  { value: "female", label: "Feminino", icon: Venus },
  { value: "male", label: "Masculino", icon: Mars },
  { value: "unspecified", label: "Outro / Prefiro não informar", icon: null },
] as const

/** Etapa 1: dados básicos do paciente (cadastro) e motivo/objetivo da 1ª consulta. */
export function StepBasicData({ form }: { form: UseFormReturn<BasicDataValues> }) {
  const { register, control, watch, formState } = form
  const { errors } = formState
  const notesLength = watch("notes").length

  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <SectionTitle icon={IdCard} aside="* Campos obrigatórios">
          A. Identificação do Paciente
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <FormField id="np-name" label="Nome Completo *" error={errors.full_name?.message} className="sm:col-span-7">
            {(field) => (
              <IconInput
                icon={User}
                placeholder="Ex: Camila Vasconcellos"
                autoComplete="off"
                autoFocus
                {...field}
                {...register("full_name")}
              />
            )}
          </FormField>

          <Controller
            control={control}
            name="birth_date"
            render={({ field }) => (
              <FormField id="np-birth" label="Data de Nascimento" error={errors.birth_date?.message} className="sm:col-span-5">
                {(control) => (
                  <IconInput
                    icon={Contact}
                    inputMode="numeric"
                    placeholder="DD/MM/AAAA"
                    autoComplete="off"
                    {...control}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(event) => field.onChange(maskDate(event.target.value))}
                  />
                )}
              </FormField>
            )}
          />

          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5 sm:col-span-12">
                <span id="np-sex-label" className="text-[13px] leading-[18px] font-medium">
                  Sexo Biológico
                </span>
                <div role="radiogroup" aria-labelledby="np-sex-label" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SEX_CHOICES.map((choice) => {
                    const selected = field.value === choice.value
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => field.onChange(choice.value)}
                        className={cn(
                          "flex min-h-10 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-[13px] leading-[18px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-accent font-semibold text-accent-foreground"
                            : "border-border bg-muted text-foreground hover:bg-muted/70",
                          choice.value === "unspecified" && !selected && "text-muted-foreground",
                        )}
                      >
                        {choice.icon && <choice.icon className="size-4" aria-hidden />}
                        {choice.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={MessageSquare}>B. Contato &amp; Comunicação</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <FormField id="np-phone" label="Telefone / WhatsApp *" error={errors.phone?.message} className="sm:col-span-6">
                {(control) => (
                  <IconInput
                    icon={Phone}
                    type="tel"
                    inputMode="tel"
                    placeholder="(11) 90000-0000"
                    autoComplete="off"
                    {...control}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(event) => field.onChange(maskPhone(event.target.value))}
                  />
                )}
              </FormField>
            )}
          />
          <FormField
            id="np-email"
            label="E-mail Principal"
            error={errors.email?.message}
            aside={<span className="text-[13px] text-muted-foreground">Opcional</span>}
            className="sm:col-span-6"
          >
            {(field) => (
              <IconInput
                icon={Mail}
                type="email"
                placeholder="exemplo@email.com"
                autoComplete="off"
                {...field}
                {...register("email")}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={Target}>C. Motivo do Atendimento &amp; Objetivo Principal</SectionTitle>

        <Controller
          control={control}
          name="goal"
          render={({ field }) => (
            <div className="flex flex-col gap-3">
              <span id="np-goal-label" className="text-[13px] leading-[18px] font-semibold">
                Objetivo Principal da Consulta *
              </span>
              <div
                role="radiogroup"
                aria-labelledby="np-goal-label"
                aria-invalid={errors.goal ? true : undefined}
                aria-describedby={errors.goal ? "np-goal-error" : undefined}
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {PATIENT_GOALS.map((goal) => {
                  const selected = field.value === goal.value
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(goal.value)}
                      onBlur={field.onBlur}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border-2 p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <goal.icon className="size-[18px]" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className={cn("text-[13px] leading-[18px]", selected ? "font-bold" : "font-semibold")}>{goal.label}</span>
                          <span className="text-[11px] leading-[14px] text-muted-foreground">{goal.hint}</span>
                        </span>
                      </span>
                      {selected ? (
                        <Check className="size-[18px] shrink-0 text-primary" aria-hidden />
                      ) : (
                        <span className="size-4 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
              {errors.goal && (
                <p id="np-goal-error" role="alert" className="text-xs leading-4 text-destructive">
                  {errors.goal.message}
                </p>
              )}
            </div>
          )}
        />

        <FormField
          id="np-notes"
          label="Observação Inicial do Paciente (Opcional)"
          error={errors.notes?.message}
          aside={
            <span className="font-data text-xs text-muted-foreground">
              {notesLength} / {MAX_NOTES_LENGTH} caracteres
            </span>
          }
        >
          {(field) => (
            <Textarea
              rows={2}
              className="min-h-16"
              placeholder="Descreva brevemente queixas iniciais, rotina ou observações relatadas pelo paciente..."
              {...field}
              {...register("notes")}
            />
          )}
        </FormField>

        <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-4 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          O prontuário clínico detalhado (anamnese completa, exames laboratoriais, dobras cutâneas, bioimpedância e
          plano alimentar individualizado) será realizado pelo nutricionista durante a consulta.
        </p>
      </section>
    </div>
  )
}
