import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ApiError } from "@/lib/api"

import { useUpdateProfile } from "./api"
import type { Profile, ProfileUpdate } from "./types"

const CRN_PATTERN = /^CRN-\d{1,2} \d{3,6}$/
export const MAX_BIO_LENGTH = 350

function isValidPhone(value: string) {
  if (value === "") return true
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 10 && digits.length !== 11) return false
  if (digits[0] === "0") return false
  return digits.length === 10 || digits[2] === "9"
}

const crnRegion = (value: string) => /CRN-(\d+)/.exec(value)?.[1]

const schema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Informe o nome completo.")
      .max(120, "O nome deve ter no máximo 120 caracteres."),
    phone: z.string().trim().refine(isValidPhone, "Telefone inválido. Use DDD + número."),
    crn: z
      .string()
      .trim()
      .refine((v) => v === "" || CRN_PATTERN.test(v.toUpperCase()), "CRN inválido. Use o formato CRN-3 48291."),
    crn_state: z.string(),
    bio: z.string().trim().max(MAX_BIO_LENGTH, `A apresentação deve ter no máximo ${MAX_BIO_LENGTH} caracteres.`),
  })
  .refine((v) => !v.crn || !v.crn_state || crnRegion(v.crn.toUpperCase()) === crnRegion(v.crn_state), {
    path: ["crn_state"],
    message: "O estado não corresponde à região do CRN informado.",
  })

export type ProfileFormValues = z.infer<typeof schema>

function toFormValues(profile: Profile): ProfileFormValues {
  return {
    full_name: profile.full_name,
    phone: profile.phone ?? "",
    crn: profile.crn ?? "",
    crn_state: profile.crn_state ?? "",
    bio: profile.bio ?? "",
  }
}

export const PROFILE_FORM_ID = "profile-form"

export function useProfileForm(profile: Profile) {
  const updateProfile = useUpdateProfile()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    // Mantém o formulário sincronizado com o servidor após salvar.
    values: toFormValues(profile),
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: ProfileUpdate = { full_name: values.full_name, phone: values.phone }
    if (profile.has_professional_fields) {
      payload.crn = values.crn
      payload.crn_state = values.crn_state
      payload.bio = values.bio
    }
    try {
      await updateProfile.mutateAsync(payload)
      toast.success("Perfil atualizado.")
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in values) form.setError(field as keyof ProfileFormValues, { message })
        }
        toast.error("Revise os campos destacados.")
      } else {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o perfil.")
      }
    }
  })

  return { form, onSubmit, isSaving: updateProfile.isPending }
}
