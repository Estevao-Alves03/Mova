import { Bell, CalendarClock, CalendarPlus, CalendarX, CheckCheck, ListChecks, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "./api"
import type { AppNotification } from "./types"
import { useNotificationAlerts } from "./useNotificationAlerts"

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })

function timeAgo(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 1) return "agora"
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, "hour")
  return relative.format(Math.round(hours / 24), "day")
}

function iconFor(item: AppNotification): { Icon: LucideIcon; tone: string } {
  if (item.event === "daily_summary") return { Icon: ListChecks, tone: "bg-accent text-accent-foreground" }
  if (item.kind === "cancelled") return { Icon: CalendarX, tone: "bg-destructive/10 text-destructive" }
  if (item.kind === "rescheduled") return { Icon: CalendarClock, tone: "bg-warning/15 text-warning" }
  return { Icon: CalendarPlus, tone: "bg-success/15 text-success" }
}

/** Sino do topo: avisos dos eventos ligados nas preferências da pessoa (nova consulta, cancelamento/remarcação, resumo). */
export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const feed = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  useNotificationAlerts(feed.data)

  const unread = feed.data?.unread_count ?? 0

  function onOpenItem(item: AppNotification) {
    if (!item.read) markRead.mutate(item.id)
    setOpen(false)
    if (item.target_date) navigate(`/app/schedule?view=day&date=${item.target_date}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative shrink-0 justify-self-end">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-xl bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={unread > 0 ? `Notificações, ${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Notificações"}
          >
            <Bell className="size-5" aria-hidden />
          </Button>
        </PopoverTrigger>
        {unread > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 font-data text-[10px] leading-none font-bold text-primary-foreground ring-2 ring-card"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-2xl p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm leading-5 font-bold">Notificações</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
            className="h-7 gap-1 rounded-lg px-2 text-xs font-medium text-primary"
          >
            <CheckCheck aria-hidden />
            Marcar todas como lidas
          </Button>
        </div>

        {feed.isPending ? (
          <Skeleton className="m-4 h-24 rounded-xl" />
        ) : feed.isError ? (
          <p role="alert" className="px-4 py-6 text-center text-sm text-destructive">
            {feed.error.message}
          </p>
        ) : feed.data.items.length === 0 ? (
          <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
            Você não tem notificações.
            <span className="mt-1 block text-xs">Escolha os avisos em Configurações &gt; Notificações.</span>
          </p>
        ) : (
          <ul aria-label="Notificações" className="max-h-96 overflow-y-auto">
            {feed.data.items.map((item) => {
              const { Icon, tone } = iconFor(item)
              return (
                <li key={item.id} className="border-b border-border/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
                      !item.read && "bg-accent/40",
                    )}
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone)}>
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-[13px] leading-[18px]", item.read ? "font-medium" : "font-bold")}>
                          {item.title}
                        </span>
                        {!item.read && (
                          <>
                            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                            <span className="sr-only">não lida</span>
                          </>
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">{item.body}</span>
                      <span className="text-[11px] leading-4 text-muted-foreground/80">{timeAgo(item.created_at)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
