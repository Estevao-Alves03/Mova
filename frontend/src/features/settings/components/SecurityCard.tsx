import { LockKeyhole, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { useMfaFactors } from "../mfa"
import { PasswordForm } from "./PasswordForm"
import { TwoFactorDialog } from "./TwoFactorDialog"

interface SecurityCardProps {
  email: string
}

export function SecurityCard({ email }: SecurityCardProps) {
  const factors = useMfaFactors()
  const [dialogOpen, setDialogOpen] = useState(false)
  const currentFactor = factors.data?.[0]
  const enabled = !!currentFactor

  return (
    <section className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <LockKeyhole className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-base leading-6 font-semibold">Segurança &amp; Autenticação</h3>
          <p className="text-xs leading-4 text-muted-foreground">
            Gerencie sua senha de acesso e camadas extras de proteção de dados
          </p>
        </div>
      </div>

      <PasswordForm email={email} />

      <div className="flex flex-col items-start justify-between gap-4 rounded-xl bg-muted p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <ShieldCheck className="size-[22px]" aria-hidden />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] leading-[18px] font-semibold">
                Autenticação em Dois Fatores (2FA)
              </span>
              {factors.isLoading ? (
                <Skeleton className="h-5 w-16 rounded-full" />
              ) : (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] leading-[14px] font-semibold">
                  {enabled ? "Ativado" : "Desativado"}
                </span>
              )}
            </div>
            <span className="text-xs leading-4 text-muted-foreground">
              {enabled
                ? "Os códigos são gerados pelo seu app autenticador."
                : "Proteja sua conta com um código gerado por um app autenticador."}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={factors.isLoading || factors.isError}
          onClick={() => setDialogOpen(true)}
          className="h-9 shrink-0 rounded-xl px-4 text-[13px] font-medium"
        >
          {enabled ? "Reconfigurar 2FA" : "Ativar 2FA"}
        </Button>
      </div>

      <TwoFactorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentFactorId={currentFactor?.id}
      />
    </section>
  )
}
