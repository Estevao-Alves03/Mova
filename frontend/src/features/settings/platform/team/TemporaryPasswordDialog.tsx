import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TemporaryPasswordDialogProps {
  /** Nome, e-mail e senha do usuário recém-criado; some ao fechar (a senha não fica guardada). */
  access: { fullName: string; email: string; password: string } | null
  onClose: () => void
}

/** A senha temporária só existe nesta resposta: depois de fechar, não há como vê-la de novo. */
export function TemporaryPasswordDialog({ access, onClose }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!access) return
    try {
      await navigator.clipboard.writeText(access.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sem permissão de área de transferência: o usuário copia manualmente (o campo é selecionável).
    }
  }

  return (
    <Dialog open={!!access} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <KeyRound className="size-[18px]" aria-hidden />
            </span>
            Acesso criado
          </DialogTitle>
          <DialogDescription>
            Repasse o e-mail e a senha temporária para <strong>{access?.fullName}</strong>. A pessoa entra com eles e
            pode trocar a senha em Meu Perfil.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-3 rounded-xl bg-muted p-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
              E-mail
            </dt>
            <dd className="text-sm font-medium break-all">{access?.email}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
              Senha temporária
            </dt>
            <dd className="flex items-center justify-between gap-2">
              <code aria-label="Senha temporária" className="font-data text-lg font-semibold tracking-wide select-all">
                {access?.password}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={() => void copy()} className="rounded-lg">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </dd>
          </div>
        </dl>

        <p role="note" className="flex gap-2 text-xs leading-4 text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          Esta senha é exibida uma única vez. Se for perdida, será preciso criar o acesso de novo.
        </p>

        <DialogFooter>
          <Button type="button" onClick={onClose} className="rounded-xl font-semibold">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
