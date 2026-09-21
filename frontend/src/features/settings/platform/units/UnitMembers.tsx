import { Link2, UserRound, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

import { useLinkMember, useTeam, useUnlinkMember } from "../api"
import type { ClinicUnit } from "../types"

/** Quem o admin vincula a esta unidade. Criar unidade ou sala NÃO vincula ninguém automaticamente. */
export function UnitMembers({ unit }: { unit: ClinicUnit }) {
  const team = useTeam()
  const link = useLinkMember()
  const unlink = useUnlinkMember()
  const [choice, setChoice] = useState("")

  const linkedIds = new Set(unit.members.map((member) => member.id))
  const available = (team.data ?? []).filter(
    (member) => member.role === "nutritionist" && member.active && !linkedIds.has(member.id),
  )
  const selected = available.some((member) => member.id === choice) ? choice : ""

  function onLink() {
    if (!selected) return
    link.mutate(
      { unitId: unit.id, membershipId: selected },
      {
        onSuccess: () => {
          toast.success("Nutricionista vinculado à unidade.")
          setChoice("")
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function onUnlink(memberId: string, name: string) {
    unlink.mutate(
      { unitId: unit.id, membershipId: memberId },
      {
        onSuccess: () => toast.success(`${name} desvinculado da unidade.`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <h4 className="text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
        Equipe vinculada ({unit.members.length})
      </h4>
      <p className="text-xs leading-4 text-muted-foreground">
        Só os nutricionistas vinculados podem definir atendimento nesta unidade (Minha Agenda).
      </p>

      {unit.members.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Nenhum nutricionista vinculado a esta unidade.
        </p>
      ) : (
        <ul aria-label={`Nutricionistas vinculados a ${unit.name}`} className="flex flex-wrap gap-2">
          {unit.members.map((member) => (
            <li
              key={member.id}
              className={cn(
                "flex items-center gap-2 rounded-full py-1 pr-1.5 pl-3 text-[13px] font-medium",
                member.active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <UserRound className="size-3.5" aria-hidden />
              {member.full_name}
              {!member.active && <span className="text-[11px]">(inativo)</span>}
              <button
                type="button"
                disabled={unlink.isPending}
                onClick={() => onUnlink(member.id, member.full_name)}
                aria-label={`Desvincular ${member.full_name} de ${unit.name}`}
                className="flex size-5 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {unit.active && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <NativeSelect
            aria-label={`Nutricionista para vincular a ${unit.name}`}
            value={selected}
            onChange={(event) => setChoice(event.target.value)}
            disabled={available.length === 0}
            className="h-9 sm:max-w-xs"
          >
            <option value="">
              {available.length === 0 ? "Todos os nutricionistas já estão vinculados" : "Selecione um nutricionista"}
            </option>
            {available.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="ghost"
            disabled={!selected || link.isPending}
            onClick={onLink}
            className="h-9 gap-1.5 rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground"
          >
            <Link2 className="size-3.5" aria-hidden />
            Vincular nutricionista
          </Button>
        </div>
      )}
    </div>
  )
}
