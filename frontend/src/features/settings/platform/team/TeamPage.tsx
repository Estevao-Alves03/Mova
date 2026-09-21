import { IdCard, Lock, MoreVertical, Pencil, Search, UserCheck, UserPlus, UserX } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { roleLabels } from "@/lib/roles"
import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/user"

import { useTeam, useUpdateMember } from "../api"
import type { MemberStatus, TeamMember } from "../types"
import { DeactivateMemberDialog } from "./DeactivateMemberDialog"
import { EditMemberDialog } from "./EditMemberDialog"
import { InviteUserDialog } from "./InviteUserDialog"
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog"

type RoleFilter = "all" | Exclude<UserRole, "patient">

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "admin", label: "Administradores" },
  { value: "nutritionist", label: "Nutricionistas" },
  { value: "receptionist", label: "Recepção" },
]

const STATUS: Record<MemberStatus, { label: string; pill: string; dot: string }> = {
  active: { label: "Ativo", pill: "bg-success/10", dot: "bg-success" },
  invited: { label: "Aguardando 1º acesso", pill: "bg-warning/15", dot: "bg-warning" },
  inactive: { label: "Inativo", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

// Escopo derivado das regras de docs/permissoes.md.
function describeScope(member: TeamMember) {
  if (member.role === "admin") return "Acesso total"
  if (member.role === "nutritionist") return `${member.crn ?? "Sem CRN"} • Próprios pacientes`
  return "Agenda • Sem prontuário clínico"
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })

function describeLastAccess(member: TeamMember) {
  if (!member.last_sign_in_at) return member.status === "inactive" ? "Nunca acessou" : "Ainda não acessou"
  const date = new Date(member.last_sign_in_at)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000)
  const time = timeFormat.format(date)
  if (days === 0) return `Hoje, ${time}`
  if (days === 1) return `Ontem, ${time}`
  return `${dayFormat.format(date)}, ${time}`
}

interface MemberActionsProps {
  member: TeamMember
  onEdit: (member: TeamMember) => void
  onDeactivate: (member: TeamMember) => void
}

function MemberActions({ member, onEdit, onDeactivate }: MemberActionsProps) {
  const [open, setOpen] = useState(false)
  const update = useUpdateMember()

  // O próprio usuário edita os dados em Meu Perfil e nunca altera a própria função nem o próprio acesso.
  if (member.is_you) {
    return <span className="pr-2 text-xs text-muted-foreground">Meu Perfil</span>
  }

  function reactivate() {
    setOpen(false)
    update.mutate(
      { id: member.id, active: true },
      {
        onSuccess: () => toast.success(`${member.full_name} voltou a ter acesso.`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  const item =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium outline-none hover:bg-muted focus-visible:bg-muted"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground"
          aria-label={`Ações de ${member.full_name}`}
        >
          <MoreVertical className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-xl p-1.5">
        <button
          type="button"
          className={item}
          onClick={() => {
            setOpen(false)
            onEdit(member)
          }}
        >
          <Pencil className="size-4 text-muted-foreground" aria-hidden />
          Editar dados e função
        </button>
        {member.active ? (
          <button
            type="button"
            className={cn(item, "text-destructive")}
            onClick={() => {
              setOpen(false)
              onDeactivate(member)
            }}
          >
            <UserX className="size-4" aria-hidden />
            Desativar acesso
          </button>
        ) : (
          <button type="button" className={item} onClick={reactivate}>
            <UserCheck className="size-4 text-muted-foreground" aria-hidden />
            Reativar acesso
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function TeamPage() {
  const team = useTeam()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [created, setCreated] = useState<{ fullName: string; email: string; password: string } | null>(null)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null)

  const all = team.data ?? []
  const normalized = query.trim().toLowerCase()
  const members = all.filter(
    (member) =>
      (roleFilter === "all" || member.role === roleFilter) &&
      (!normalized ||
        [member.full_name, member.email, member.crn ?? "", roleLabels[member.role]].some((text) =>
          text.toLowerCase().includes(normalized),
        )),
  )
  const countFor = (filter: RoleFilter) =>
    filter === "all" ? all.length : all.filter((member) => member.role === filter).length

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <IdCard className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl leading-7 font-semibold tracking-tight">Membros da Equipe Clínica</h2>
            <p className="text-xs leading-4 text-muted-foreground">
              Controle credenciais de acesso, papéis no prontuário e registros profissionais.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="h-10 shrink-0 gap-1.5 rounded-xl px-4 text-[13px] font-semibold shadow-sm"
        >
          <UserPlus className="size-[18px]" aria-hidden />
          Convidar Novo Usuário
        </Button>
      </section>

      <section aria-label="Membros" className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex w-full items-center md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" aria-hidden />
            <Input
              type="text"
              aria-label="Filtrar membros"
              placeholder="Filtrar por nome, CRN ou e-mail..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              className="h-10 rounded-xl bg-muted pl-10 shadow-none"
            />
          </div>
          <div role="group" aria-label="Filtrar por função" className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-muted-foreground">Filtrar:</span>
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={roleFilter === filter.value}
                onClick={() => setRoleFilter(filter.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  roleFilter === filter.value
                    ? "bg-muted font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label} ({countFor(filter.value)})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="bg-muted text-[11px] leading-[14px] tracking-wider text-muted-foreground uppercase">
                <th scope="col" className="rounded-l-xl px-4 py-3 font-semibold">Profissional / E-mail</th>
                <th scope="col" className="px-4 py-3 font-semibold">Função &amp; Escopo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Último acesso</th>
                <th scope="col" className="rounded-r-xl px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {team.isPending && (
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton aria-label="Carregando a equipe" className="h-40 rounded-xl" />
                  </td>
                </tr>
              )}
              {team.isError && (
                <tr>
                  <td colSpan={5} role="alert" className="px-4 py-10 text-center text-sm text-destructive">
                    {team.error.message}{" "}
                    <button type="button" onClick={() => void team.refetch()} className="font-semibold underline">
                      Tentar novamente
                    </button>
                  </td>
                </tr>
              )}
              {team.isSuccess && members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              )}
              {members.map((member) => {
                const status = STATUS[member.status]
                return (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              member.active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
                            {member.full_name}
                            {member.is_you && (
                              <span className="rounded bg-accent px-1.5 text-[10px] leading-4 font-semibold text-accent-foreground">
                                Você
                              </span>
                            )}
                          </span>
                          <span className="truncate text-xs leading-4 text-muted-foreground">{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] leading-[18px] font-semibold">{roleLabels[member.role]}</span>
                        <span className="text-[11px] leading-[14px] text-muted-foreground">{describeScope(member)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] leading-[14px] font-semibold",
                          status.pill,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs leading-4 text-muted-foreground">{describeLastAccess(member)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <MemberActions member={member} onEdit={setEditing} onDeactivate={setDeactivating} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p role="status" className="text-xs text-muted-foreground">
          Exibindo {members.length} de {all.length} usuários
        </p>
      </section>

      <section className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Lock className="size-[18px]" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[13px] leading-[18px] font-semibold">Prontuário Blindado</h3>
          <p className="text-xs leading-4 text-muted-foreground">
            Recepcionistas não acessam dados de antropometria ou bioimpedância do paciente.
          </p>
        </div>
      </section>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onCreated={setCreated} />
      <TemporaryPasswordDialog access={created} onClose={() => setCreated(null)} />
      <EditMemberDialog member={editing} onClose={() => setEditing(null)} />
      <DeactivateMemberDialog member={deactivating} onClose={() => setDeactivating(null)} />
    </div>
  )
}
