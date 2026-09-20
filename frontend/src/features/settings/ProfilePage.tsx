import { LogOut } from "lucide-react"

import { ScrollRegion } from "@/components/shared/ScrollRegion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/useAuth"

import { useProfile } from "./api"
import { AccountSummaryCard } from "./components/AccountSummaryCard"
import { ActiveSessionsCard } from "./components/ActiveSessionsCard"
import { MyScheduleCard } from "./components/MyScheduleCard"
import { ProfileHero } from "./components/ProfileHero"
import { ProfileInfoCard } from "./components/ProfileInfoCard"
import { ProfileSaveBar } from "./components/ProfileSaveBar"
import { SecurityCard } from "./components/SecurityCard"
import type { Profile } from "./types"
import { useProfileForm } from "./useProfileForm"

function ProfileContent({ profile }: { profile: Profile }) {
  const { form, onSubmit, isSaving } = useProfileForm(profile)

  return (
    <>
      <ScrollRegion label="Dados do perfil" className="flex-1 pr-1">
        <div className="flex flex-col gap-6 pb-2">
          <ProfileHero profile={profile} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <ProfileInfoCard profile={profile} form={form} onSubmit={onSubmit} />
              {profile.role === "nutritionist" && <MyScheduleCard professionalId={profile.id} />}
              {profile.email && <SecurityCard email={profile.email} />}
            </div>
            <div className="flex flex-col gap-6 lg:col-span-4">
              {profile.account_summary && <AccountSummaryCard summary={profile.account_summary} />}
              <ActiveSessionsCard />
            </div>
          </div>
        </div>
      </ScrollRegion>

      <ProfileSaveBar form={form} isSaving={isSaving} />
    </>
  )
}

export function ProfilePage() {
  const { signOut } = useAuth()
  const { data: profile } = useProfile()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight">Meu Perfil Profissional</h1>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void signOut()}
          title="Encerrar sessão no dispositivo atual"
          className="h-10 rounded-xl bg-destructive/10 px-4 text-[13px] font-semibold text-destructive shadow-sm hover:bg-destructive/15"
        >
          <LogOut className="size-[18px]" aria-hidden />
          Sair da Conta
        </Button>
      </div>

      {profile ? <ProfileContent profile={profile} /> : <Skeleton className="h-64 rounded-xl" />}
    </div>
  )
}
