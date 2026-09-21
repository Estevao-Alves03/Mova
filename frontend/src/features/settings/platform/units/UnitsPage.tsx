import { ArrowRight, Building2, DoorOpen, Mail, Pencil, Phone, Plus, Power, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { useAdminUnits, useUpdateUnit } from "../api"
import type { ClinicUnit } from "../types"
import { RoomDialog, type RoomTarget } from "./RoomDialog"
import { UnitDialog } from "./UnitDialog"
import { UnitMembers } from "./UnitMembers"

const ALL = "all"

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
        active ? "bg-success/10" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} aria-hidden />
      {active ? "Ativa" : "Inativa"}
    </span>
  )
}

interface UnitSectionProps {
  unit: ClinicUnit
  onEdit: (unit: ClinicUnit) => void
  onRoom: (target: RoomTarget) => void
}

function UnitSection({ unit, onEdit, onRoom }: UnitSectionProps) {
  const update = useUpdateUnit()

  function toggleActive() {
    update.mutate(
      { id: unit.id, active: !unit.active },
      {
        onSuccess: () => toast.success(unit.active ? "Unidade desativada." : "Unidade reativada."),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <section aria-label={unit.name} className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg leading-7 font-semibold tracking-tight">{unit.name}</h3>
              <StatusPill active={unit.active} />
            </div>
            <p className="text-xs leading-4 text-muted-foreground">{unit.address ?? "Sem endereço cadastrado"}</p>
            {(unit.phone || unit.email) && (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
                {unit.phone && (
                  <li className="flex items-center gap-1">
                    <Phone className="size-3.5" aria-hidden />
                    {unit.phone}
                  </li>
                )}
                {unit.email && (
                  <li className="flex items-center gap-1">
                    <Mail className="size-3.5" aria-hidden />
                    {unit.email}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onEdit(unit)}
            className="h-9 gap-1.5 rounded-xl px-3 text-xs font-medium"
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar Unidade
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!unit.active}
            onClick={() => onRoom({ unit })}
            className="h-9 gap-1.5 rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
            Adicionar Sala
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={update.isPending}
            onClick={toggleActive}
            className="h-9 gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium text-muted-foreground"
            aria-label={`${unit.active ? "Desativar" : "Reativar"} ${unit.name}`}
          >
            <Power className="size-3.5" aria-hidden />
            {unit.active ? "Desativar" : "Reativar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h4 className="text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
          Salas &amp; Consultórios vinculados ({unit.rooms.length})
        </h4>
        {unit.rooms.length === 0 && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Nenhuma sala cadastrada nesta unidade.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {unit.rooms.map((room, index) => (
            <li key={room.id} className="flex flex-col gap-3 rounded-xl bg-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent font-data text-xs font-semibold text-accent-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13px] leading-[18px] font-semibold">{room.name}</span>
                </div>
                <StatusPill active={room.active} />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRoom({ unit, room })}
                  aria-label={`Gerenciar ${room.name}`}
                  className="h-auto gap-1 p-0 text-xs font-medium text-primary hover:bg-transparent"
                >
                  Gerenciar Sala
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <UnitMembers unit={unit} />
    </section>
  )
}

export function UnitsPage() {
  const unitsQuery = useAdminUnits()
  const [query, setQuery] = useState("")
  const [unitFilter, setUnitFilter] = useState<string>(ALL)
  const [unitDialog, setUnitDialog] = useState<{ unit: ClinicUnit | null } | null>(null)
  const [roomTarget, setRoomTarget] = useState<RoomTarget | null>(null)

  const all = unitsQuery.data ?? []
  const activeUnits = all.filter((unit) => unit.active).length
  const totalRooms = all.reduce((sum, unit) => sum + unit.rooms.length, 0)

  const normalized = query.trim().toLowerCase()
  const units = all.filter(
    (unit) =>
      (unitFilter === ALL || unit.id === unitFilter) &&
      (!normalized ||
        [unit.name, unit.address ?? "", ...unit.rooms.map((room) => room.name)].some((text) =>
          text.toLowerCase().includes(normalized),
        )),
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl leading-7 font-semibold tracking-tight">Unidades Físicas &amp; Consultórios</h2>
            <p className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-[11px] leading-[14px] font-semibold text-accent-foreground">
              {activeUnits} {activeUnits === 1 ? "Unidade Ativa" : "Unidades Ativas"} • {totalRooms} Consultórios no Total
            </p>
            <p className="text-xs leading-4 text-muted-foreground">
              Unidades de atendimento e as salas vinculadas a cada uma.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setUnitDialog({ unit: null })}
          className="h-10 shrink-0 gap-1.5 rounded-xl px-4 text-[13px] font-semibold shadow-sm"
        >
          <DoorOpen className="size-[18px]" aria-hidden />
          Nova Unidade
        </Button>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex w-full items-center md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" aria-hidden />
          <Input
            type="text"
            aria-label="Filtrar unidades e salas"
            placeholder="Filtrar por unidade, sala..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            className="h-10 rounded-xl bg-card pl-10 shadow-xs"
          />
        </div>
        <div role="group" aria-label="Filtrar por unidade" className="flex flex-wrap items-center gap-2">
          {[
            { id: ALL, label: `Todas (${all.length})` },
            ...all.map((unit) => ({ id: unit.id, label: `${unit.name} (${unit.rooms.length} salas)` })),
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={unitFilter === chip.id}
              onClick={() => setUnitFilter(chip.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                unitFilter === chip.id ? "bg-primary font-semibold text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {unitsQuery.isPending ? (
        <Skeleton aria-label="Carregando as unidades" className="h-48 rounded-2xl" />
      ) : unitsQuery.isError ? (
        <p role="alert" className="rounded-2xl bg-card p-10 text-center text-sm text-destructive shadow-sm">
          {unitsQuery.error.message}{" "}
          <button type="button" onClick={() => void unitsQuery.refetch()} className="font-semibold underline">
            Tentar novamente
          </button>
        </p>
      ) : units.length === 0 ? (
        <p role="status" className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          {all.length === 0 ? "Nenhuma unidade cadastrada ainda." : "Nenhuma unidade encontrada."}
        </p>
      ) : (
        units.map((unit) => (
          <UnitSection key={unit.id} unit={unit} onEdit={(target) => setUnitDialog({ unit: target })} onRoom={setRoomTarget} />
        ))
      )}

      <UnitDialog open={!!unitDialog} unit={unitDialog?.unit} onClose={() => setUnitDialog(null)} />
      <RoomDialog target={roomTarget} onClose={() => setRoomTarget(null)} />
    </div>
  )
}
