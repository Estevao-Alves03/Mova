import { CircleAlert, CircleCheck, Save } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"

import { Button } from "@/components/ui/button"

import { PROFILE_FORM_ID, type ProfileFormValues } from "../useProfileForm"

interface ProfileSaveBarProps {
  form: UseFormReturn<ProfileFormValues>
  isSaving: boolean
}

/** Rodapé fixo (fora da rolagem) com Cancelar/Salvar do formulário de informações pessoais. */
export function ProfileSaveBar({ form, isSaving }: ProfileSaveBarProps) {
  const { isDirty } = form.formState

  return (
    <div className="flex shrink-0 flex-col items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-md sm:flex-row">
      <p
        role="status"
        className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"
      >
        {isDirty ? (
          <>
            <CircleAlert className="size-[18px] text-warning" aria-hidden />
            Você tem alterações não salvas.
          </>
        ) : (
          <>
            <CircleCheck className="size-[18px] text-success" aria-hidden />
            Todas as alterações estão salvas.
          </>
        )}
      </p>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Button
          type="button"
          variant="ghost"
          disabled={!isDirty || isSaving}
          onClick={() => form.reset()}
          className="h-10 rounded-xl bg-muted px-6 text-[13px] font-medium"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form={PROFILE_FORM_ID}
          disabled={!isDirty || isSaving}
          className="h-10 rounded-xl px-6 text-[13px] font-semibold shadow-md"
        >
          <Save className="size-[18px]" aria-hidden />
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  )
}
