import { AtSign, Award, CircleUserRound, Map, Smartphone, User } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"

import { FormField } from "@/components/shared/FormField"
import { IconInput } from "@/components/shared/IconInput"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

import type { Profile } from "../types"
import { MAX_BIO_LENGTH, PROFILE_FORM_ID, type ProfileFormValues } from "../useProfileForm"

interface ProfileInfoCardProps {
  profile: Profile
  form: UseFormReturn<ProfileFormValues>
  onSubmit: React.FormEventHandler<HTMLFormElement>
}

export function ProfileInfoCard({ profile, form, onSubmit }: ProfileInfoCardProps) {
  const { register, watch, formState } = form
  const { errors } = formState
  const bioLength = watch("bio").length

  return (
    <section className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <User className="size-5" aria-hidden />
          </div>
          <h3 className="text-base leading-6 font-semibold">Informações Pessoais &amp; Cadastro</h3>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-accent-foreground">
          Editável
        </span>
      </div>

      <form
        id={PROFILE_FORM_ID}
        onSubmit={onSubmit}
        noValidate
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <FormField id="profile-full-name" label="Nome Completo" error={errors.full_name?.message} className="md:col-span-2">
          {(control) => (
            <IconInput icon={CircleUserRound} autoComplete="name" {...control} {...register("full_name")} />
          )}
        </FormField>

        <FormField
          id="profile-email"
          label="E-mail Principal (Login)"
          hint="O e-mail de login não pode ser alterado por aqui."
        >
          {(control) => (
            <IconInput icon={AtSign} value={profile.email ?? ""} readOnly disabled {...control} />
          )}
        </FormField>

        <FormField
          id="profile-phone"
          label="Telefone com WhatsApp"
          error={errors.phone?.message}
          hint="Informe DDD + número."
        >
          {(control) => (
            <IconInput
              icon={Smartphone}
              type="tel"
              autoComplete="tel"
              placeholder="(11) 90000-0000"
              {...control}
              {...register("phone")}
            />
          )}
        </FormField>

        {profile.has_professional_fields && (
          <>
            <FormField id="profile-crn" label="Registro Profissional (CRN)" error={errors.crn?.message}>
              {(control) => (
                <IconInput
                  icon={Award}
                  placeholder="CRN-3 48291"
                  className="uppercase"
                  {...control}
                  {...register("crn")}
                />
              )}
            </FormField>

            <FormField
              id="profile-crn-state"
              label="Estado do Conselho Emissor"
              error={errors.crn_state?.message}
            >
              {(control) => (
                <div className="relative">
                  <Map
                    className="pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <NativeSelect className="pl-9" {...control} {...register("crn_state")}>
                    <option value="">Selecione</option>
                    {profile.crn_state_options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </FormField>

            <FormField
              id="profile-bio"
              label="Apresentação"
              error={errors.bio?.message}
              className="md:col-span-2"
              aside={
                <span
                  className={`font-data text-[11px] leading-[14px] ${
                    bioLength > MAX_BIO_LENGTH ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {bioLength}/{MAX_BIO_LENGTH}
                </span>
              }
            >
              {(control) => <Textarea rows={4} {...control} {...register("bio")} />}
            </FormField>
          </>
        )}
      </form>
    </section>
  )
}
