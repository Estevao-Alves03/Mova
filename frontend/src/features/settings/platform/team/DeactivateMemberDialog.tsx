import { UserX } from "lucide-react"
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

import { useUpdateMember } from "../api"
import type { TeamMember } from "../types"

interface DeactivateMemberDialogProps {
  member: TeamMember | null
  onClose: () => void
}

/** Desativar bloqueia o acesso na hora e preserva todo o histórico (nada é excluído). */
export function DeactivateMemberDialog({ member, onClose }: DeactivateMemberDialogProps) {
  const update = useUpdateMember()

  function confirm() {
    if (!member) return
    update.mutate(
      { id: member.id, active: false },
      {
        onSuccess: () => {
          toast.success(`${member.full_name} não tem mais acesso.`)
          onClose()
        },
        onError: (error) => {
          toast.error(error.message)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <UserX className="size-[18px]" aria-hidden />
            </span>
            Desativar acesso
          </DialogTitle>
          <DialogDescription>
            <strong>{member?.full_name}</strong> perde o acesso ao sistema imediatamente. Pacientes, consultas e
            registros continuam preservados e o acesso pode ser reativado quando quiser.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl bg-muted">
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={update.isPending} onClick={confirm} className="rounded-xl font-semibold">
            {update.isPending ? "Desativando..." : "Desativar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
