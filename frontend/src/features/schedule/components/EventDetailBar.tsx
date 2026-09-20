import { Clock, MapPin, Stethoscope, User } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { diffInMinutes, formatTime } from "@/lib/date"
import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/user"

import { CATEGORY_BY_KIND, STATUS_LABELS, STATUS_STYLES } from "../categories"
import type { ScheduleEvent } from "../types"

interface EventDetailBarProps {
  event?: ScheduleEvent
  professionalName?: string
  roomName?: string
  role?: UserRole
}

// As ações seguem docs/permissoes.md e ainda são somente visuais (sem API de agenda).
export function EventDetailBar({ event, professionalName, roomName, role }: EventDetailBarProps) {
  if (!event || !event.status) {
    return (
      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        Selecione um agendamento para ver os detalhes.
      </div>
    )
  }

  const category = CATEGORY_BY_KIND[event.kind]
  const minutes = diffInMinutes(event.start, event.end)
  const canManage = role === "admin" || role === "receptionist"
  const canConduct = role === "admin" || role === "nutritionist"
  const conductLabel =
    event.status === "in_progress"
      ? "Concluir Consulta"
      : event.status === "completed"
        ? undefined
        : "Iniciar Consulta"
  const where = roomName ? `${roomName} (Presencial)` : undefined

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-12 rounded-xl">
          <AvatarFallback className="rounded-xl bg-accent font-semibold text-accent-foreground">
            {getInitials(event.title)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base leading-6 font-bold">{event.title}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] leading-[14px] font-semibold",
                STATUS_STYLES[event.status],
              )}
            >
              {STATUS_LABELS[event.status]}
            </span>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs leading-4 text-muted-foreground">
            <li className="flex items-center gap-1">
              <Clock className="size-3.5 text-primary" aria-hidden />
              <span className="font-data">
                {formatTime(event.start)} - {formatTime(event.end)}
              </span>{" "}
              ({minutes} min)
            </li>
            <li className="flex items-center gap-1">
              <Stethoscope className="size-3.5 text-primary" aria-hidden />
              {category.label}
            </li>
            {professionalName && (
              <li className="flex items-center gap-1">
                <User className="size-3.5 text-primary" aria-hidden />
                {professionalName}
              </li>
            )}
            {where && (
              <li className="flex items-center gap-1">
                <MapPin className="size-3.5 text-primary" aria-hidden />
                {where}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button type="button" variant="outline" disabled className="h-9 rounded-xl px-4 text-[13px] font-medium">
              Remarcar
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled
              className="h-9 rounded-xl bg-destructive/10 px-4 text-[13px] font-medium text-destructive hover:bg-destructive/15"
            >
              Cancelar
            </Button>
          </>
        )}
        {canConduct && conductLabel && (
          <Button type="button" disabled className="h-9 rounded-xl px-4 text-[13px] font-semibold shadow-sm">
            {conductLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
