import { BriefcaseMedical, CalendarDays, Camera, IdCard, Mail, Trash2 } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/user"

import { useRemoveAvatar, useUploadAvatar } from "../api"
import type { Profile } from "../types"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

// "2022-02-01T03:00:00Z" -> "Fev, 2022"
function formatMemberSince(isoDate: string) {
  const date = new Date(isoDate)
  const parts = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date)
  const month = (parts.find((part) => part.type === "month")?.value ?? "").replace(".", "")
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}, ${year}`
}

interface ProfileHeroProps {
  profile: Profile
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadAvatar = useUploadAvatar()
  const removeAvatar = useRemoveAvatar()

  const chips = [
    profile.crn && { icon: IdCard, text: profile.crn },
    profile.email && { icon: Mail, text: profile.email },
    { icon: CalendarDays, text: `Membro desde ${formatMemberSince(profile.member_since)}` },
  ].filter((chip) => !!chip)

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // permite escolher o mesmo arquivo de novo
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Envie uma imagem JPG, PNG ou WebP.")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("A foto deve ter no máximo 2 MB.")
      return
    }
    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success("Foto atualizada."),
      onError: (error) => toast.error(error.message),
    })
  }

  function onRemove() {
    removeAvatar.mutate(undefined, {
      onSuccess: () => toast.success("Foto removida."),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <section className="relative overflow-hidden rounded-xl bg-card p-6 shadow-sm lg:p-8">
      <div
        className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full bg-accent/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-1/4 -bottom-10 size-56 rounded-full bg-primary/10 blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="size-24 rounded-2xl shadow-md ring-4 ring-card sm:size-28">
            {profile.avatar_url && (
              <AvatarImage
                src={profile.avatar_url}
                alt={`Foto de ${profile.full_name}`}
                className="rounded-2xl object-cover"
              />
            )}
            <AvatarFallback className="rounded-2xl bg-primary text-3xl font-semibold text-primary-foreground">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl leading-7 font-semibold tracking-tight">{profile.full_name}</h2>
              {profile.active && (
                <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] leading-[14px] font-semibold">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  Ativo
                </span>
              )}
            </div>

            {profile.specialty && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BriefcaseMedical className="size-[18px] shrink-0 text-primary" aria-hidden />
                {profile.specialty}
              </p>
            )}

            <ul className="flex flex-wrap items-center gap-2 pt-1 font-data text-[11px] leading-[14px] text-muted-foreground">
              {chips.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-2 sm:flex-row lg:flex-col">
          <input
            ref={fileInput}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            aria-label="Selecionar foto de perfil"
            onChange={onFileSelected}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={uploadAvatar.isPending}
            onClick={() => fileInput.current?.click()}
            className="h-10 rounded-xl bg-accent px-4 text-[13px] font-semibold text-accent-foreground shadow-sm hover:bg-accent/80"
          >
            <Camera className="size-[18px]" aria-hidden />
            {uploadAvatar.isPending ? "Enviando..." : "Alterar foto"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!profile.avatar_url || removeAvatar.isPending}
            onClick={onRemove}
            className="h-10 rounded-xl bg-muted px-4 text-[13px] font-medium text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-[18px]" aria-hidden />
            {removeAvatar.isPending ? "Removendo..." : "Remover"}
          </Button>
        </div>
      </div>
    </section>
  )
}
