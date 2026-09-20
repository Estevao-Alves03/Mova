import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import {
  mfaFactorsKey,
  removeFactor,
  startTotpEnrollment,
  verifyTotp,
  type TotpEnrollment,
} from "../mfa"

type Step = "intro" | "verify-current" | "scan" | "done"

interface TwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fator atual (reconfigurar). Sem ele, é a primeira ativação. */
  currentFactorId?: string
}

// Remonta a cada abertura (a chave vem do pai), então o estado sempre começa limpo.
function TwoFactorFlow({ onOpenChange, currentFactorId }: Omit<TwoFactorDialogProps, "open">) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(currentFactorId ? "verify-current" : "intro")
  const [enrollment, setEnrollment] = useState<TotpEnrollment>()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const isReconfigure = !!currentFactorId
  const codeIsComplete = /^\d{6}$/.test(code)

  async function beginEnrollment() {
    setBusy(true)
    setError(undefined)
    try {
      setEnrollment(await startTotpEnrollment())
      setCode("")
      setStep("scan")
    } catch {
      setError("Não foi possível gerar o QR code. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  async function confirmCurrentCode() {
    if (!currentFactorId) return
    setBusy(true)
    setError(undefined)
    try {
      await verifyTotp(currentFactorId, code)
    } catch {
      setError("Código inválido ou expirado.")
      setBusy(false)
      return
    }
    setBusy(false)
    await beginEnrollment()
  }

  async function confirmNewCode() {
    if (!enrollment) return
    setBusy(true)
    setError(undefined)
    try {
      await verifyTotp(enrollment.factorId, code)
    } catch {
      setError("Código inválido ou expirado.")
      setBusy(false)
      return
    }
    try {
      // O fator antigo só sai depois que o novo foi verificado.
      if (currentFactorId) await removeFactor(currentFactorId)
    } catch {
      toast.error("O novo 2FA foi ativado, mas não foi possível remover o anterior.")
    }
    await queryClient.invalidateQueries({ queryKey: mfaFactorsKey })
    setBusy(false)
    setStep("done")
  }

  async function close() {
    // Fechou no meio do cadastro: descarta o fator ainda não verificado.
    if (step === "scan" && enrollment) void removeFactor(enrollment.factorId).catch(() => undefined)
    onOpenChange(false)
  }

  const codeField = (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="two-factor-code" className="text-[13px] leading-[18px] font-medium">
        Código de 6 dígitos
      </label>
      <Input
        id="two-factor-code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "two-factor-error" : undefined}
        className="h-10 rounded-xl bg-muted font-data tracking-widest shadow-none"
        autoFocus
      />
      {error && (
        <p id="two-factor-error" role="alert" className="text-xs leading-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  )

  return (
    <DialogContent
      onInteractOutside={(event) => busy && event.preventDefault()}
      onOpenAutoFocus={(event) => step === "intro" && event.preventDefault()}
    >
      {step === "intro" && (
        <>
          <DialogHeader>
            <DialogTitle>Ativar autenticação em dois fatores</DialogTitle>
            <DialogDescription>
              Além da senha, você passará a informar um código gerado por um app autenticador
              (como Google Authenticator, Microsoft Authenticator ou Authy).
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => void close()}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void beginEnrollment()}>
              {busy ? "Gerando..." : "Gerar QR code"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "verify-current" && (
        <>
          <DialogHeader>
            <DialogTitle>Confirme seu 2FA atual</DialogTitle>
            <DialogDescription>
              Para reconfigurar, digite o código atual do seu app autenticador.
            </DialogDescription>
          </DialogHeader>
          {codeField}
          <DialogFooter>
            <Button variant="ghost" onClick={() => void close()}>
              Cancelar
            </Button>
            <Button disabled={!codeIsComplete || busy} onClick={() => void confirmCurrentCode()}>
              {busy ? "Verificando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "scan" && enrollment && (
        <>
          <DialogHeader>
            <DialogTitle>{isReconfigure ? "Configure o novo 2FA" : "Configure o app autenticador"}</DialogTitle>
            <DialogDescription>
              Escaneie o QR code no app e digite o código gerado para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img
              src={enrollment.qrCode}
              alt="QR code para configurar o app autenticador"
              className="size-44 rounded-lg border bg-white p-2"
            />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-xs leading-4 text-muted-foreground">
                Não consegue escanear? Digite esta chave no app:
              </span>
              <code className="font-data text-xs leading-4 font-semibold break-all select-all">
                {enrollment.secret}
              </code>
            </div>
          </div>
          {codeField}
          <DialogFooter>
            <Button variant="ghost" onClick={() => void close()}>
              Cancelar
            </Button>
            <Button disabled={!codeIsComplete || busy} onClick={() => void confirmNewCode()}>
              {busy ? "Verificando..." : "Confirmar e ativar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "done" && (
        <>
          <DialogHeader>
            <DialogTitle>2FA ativado</DialogTitle>
            <DialogDescription>
              Nos próximos acessos será pedido o código do seu app autenticador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Concluir</Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  )
}

export function TwoFactorDialog({ open, onOpenChange, currentFactorId }: TwoFactorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <TwoFactorFlow onOpenChange={onOpenChange} currentFactorId={currentFactorId} />}
    </Dialog>
  )
}
