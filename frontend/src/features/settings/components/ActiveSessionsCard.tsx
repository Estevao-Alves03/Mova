import { Laptop, Monitor, MonitorSmartphone, Power, Smartphone, X, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { useRevokeOtherSessions, useRevokeSession, useSessions } from "../api"
import type { UserSession } from "../types"

const deviceIcons: Record<UserSession["kind"], LucideIcon> = {
  laptop: Laptop,
  phone: Smartphone,
  desktop: Monitor,
}

// Até 4 sessões aparecem inteiras; da 5ª em diante a própria lista rola (a página não cresce).
const MAX_VISIBLE_SESSIONS = 4
const SESSION_ROW_PX = 76
const SESSION_GAP_PX = 8
const LIST_MAX_HEIGHT_PX = MAX_VISIBLE_SESSIONS * SESSION_ROW_PX + (MAX_VISIBLE_SESSIONS - 1) * SESSION_GAP_PX

const relativeTime = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })

// "Último acesso há 42 minutos" / "Último acesso ontem"
function describeLastAccess(session: UserSession) {
  if (session.current) return "Ativo agora"
  const seconds = (new Date(session.last_active_at).getTime() - Date.now()) / 1000
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 1) return "Último acesso agora há pouco"
  if (Math.abs(minutes) < 60) return `Último acesso ${relativeTime.format(minutes, "minute")}`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `Último acesso ${relativeTime.format(hours, "hour")}`
  return `Último acesso ${relativeTime.format(Math.round(hours / 24), "day")}`
}

export function ActiveSessionsCard() {
  const sessions = useSessions()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  const list = [...(sessions.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current))
  const hasOthers = list.some((session) => !session.current)

  function onRevoke(session: UserSession) {
    revokeSession.mutate(session.id, {
      onSuccess: () => toast.success(`${session.device} desconectado.`),
      onError: (error) => toast.error(error.message),
    })
  }

  function onRevokeOthers() {
    revokeOthers.mutate(undefined, {
      onSuccess: () => toast.success("Outras sessões encerradas."),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="size-5 text-primary" aria-hidden />
          <h3 className="text-base leading-6 font-semibold">Sessões Ativas</h3>
        </div>
        <span className="size-2 rounded-full bg-success" aria-hidden />
      </div>

      <p className="text-xs leading-4 text-muted-foreground">
        Dispositivos autenticados no momento com acesso aos seus prontuários e agenda.
      </p>

      {sessions.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[76px] rounded-xl" />
          <Skeleton className="h-[76px] rounded-xl" />
        </div>
      )}

      {sessions.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as sessões.
        </p>
      )}

      {sessions.isSuccess && (
        <div
          role="region"
          aria-label={`Lista de sessões ativas (${list.length})`}
          tabIndex={0}
          style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
          className="overflow-y-auto pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ul className="flex flex-col" style={{ gap: SESSION_GAP_PX }}>
            {list.map((session) => {
              const Icon = deviceIcons[session.kind]
              return (
                <li
                  key={session.id}
                  style={{ height: SESSION_ROW_PX }}
                  className={cn(
                    "flex shrink-0 items-start justify-between gap-2 overflow-hidden rounded-xl p-3",
                    session.current ? "bg-accent/40" : "bg-muted",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        session.current ? "text-accent-foreground" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-col">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          title={session.device}
                          className={cn(
                            "truncate text-[13px] leading-[18px]",
                            session.current ? "font-semibold" : "font-medium",
                          )}
                        >
                          {session.device}
                        </span>
                        {session.current && (
                          <span className="shrink-0 rounded bg-accent-foreground px-1.5 font-data text-[11px] leading-[14px] text-primary-foreground">
                            Atual
                          </span>
                        )}
                      </div>
                      <span
                        title={`${session.ip ?? "IP desconhecido"} • ${session.client}`}
                        className="truncate font-data text-[11px] leading-[14px] text-muted-foreground"
                      >
                        {session.ip ?? "IP desconhecido"} • {session.client}
                      </span>
                      <span className="truncate font-data text-[11px] leading-[14px] text-muted-foreground">
                        {describeLastAccess(session)}
                      </span>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={revokeSession.isPending}
                      onClick={() => onRevoke(session)}
                      className="size-7 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
                      aria-label={`Desconectar ${session.device}`}
                    >
                      <X className="size-[18px]" aria-hidden />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {hasOthers && (
        <Button
          type="button"
          variant="secondary"
          disabled={revokeOthers.isPending}
          onClick={onRevokeOthers}
          className="h-9 w-full rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Power className="size-4" aria-hidden />
          Desconectar todas as outras sessões
        </Button>
      )}
    </section>
  )
}
