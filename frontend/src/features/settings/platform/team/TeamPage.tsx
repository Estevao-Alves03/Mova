import { IdCard, Lock, MoreVertical, Search, UserPlus } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProfile } from "@/features/settings/api"
import { roleLabels } from "@/lib/roles"
import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"
import { mockTeam } from "@/mocks/settings"
import type { UserRole } from "@/types/user"

import type { MemberStatus, TeamMember } from "../types"
import { InviteUserDialog } from "./InviteUserDialog"

type RoleFilter = "all" | Exclude<UserRole, "patient">

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "admin", label: "Administradores" },
  { value: "nutritionist", label: "Nutricionistas" },
  { value: "receptionist", label: "Recepção" },
]

const STATUS: Record<MemberStatus, { label: string; pill: string; dot: string }> = {
  active: { label: "Ativo", pill: "bg-success/10", dot: "bg-success" },
  invited: { label: "Convidado", pill: "bg-warning/15", dot: "bg-warning" },
  inactive: { label: "Inativo", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

// Escopo derivado das regras de docs/permissoes.md.
function describeScope(member: TeamMember) {
  if (member.role === "admin") return "Acesso total"
  if (member.role === "nutritionist") return `${member.crn ?? "Sem CRN"} • Próprios pacientes`
  return "Agenda • Sem prontuário clínico"
}

export function TeamPage() {
  const { data: profile } = useProfile()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [inviteOpen, setInviteOpen] = useState(false)

  const normalized = query.trim().toLowerCase()
  const members = mockTeam.filter(
    (member) =>
      (roleFilter === "all" || member.role === roleFilter) &&
      (!normalized ||
        [member.fullName, member.email, member.crn ?? "", roleLabels[member.role]].some((text) =>
          text.toLowerCase().includes(normalized),
        )),
  )
  const countFor = (filter: RoleFilter) =>
    filter === "all" ? mockTeam.length : mockTeam.filter((member) => member.role === filter).length

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
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              )}
              {members.map((member) => {
                const status = STATUS[member.status]
                const isYou = !!profile?.email && member.email === profile.email
                return (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              member.status === "active" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {getInitials(member.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
                            {member.fullName}
                            {isYou && (
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
                    <td className="px-4 py-3 text-xs leading-4 text-muted-foreground">{member.lastAccess}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {member.status === "invited" && (
                          <Button type="button" variant="ghost" disabled className="h-8 rounded-lg px-2 text-xs font-semibold text-primary">
                            Reenviar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="size-8 rounded-lg text-muted-foreground"
                          aria-label={`Ações de ${member.fullName}`}
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <span role="status">
            Exibindo {members.length} de {mockTeam.length} usuários
          </span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" disabled className="h-8 rounded-lg bg-muted px-3 text-xs">
              Anterior
            </Button>
            <Button type="button" variant="ghost" disabled className="h-8 rounded-lg bg-muted px-3 text-xs">
              Próxima
            </Button>
          </div>
        </div>
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

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
