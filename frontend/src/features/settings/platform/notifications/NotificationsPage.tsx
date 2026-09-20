import { Bell, BellOff, Moon, Monitor, Play, Volume2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch, type Control } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { useRegisterSettingsActions } from "../settingsContext"
import { useNotificationPreferences, useSaveNotificationPreferences } from "./api"
import { EVENT_LABELS, groupEvents, QUIET_DAYS_LABELS, SOUND_LABELS, SOUND_SLOT_LABELS } from "./catalog"
import { canPreview, previewSound } from "./sounds"
import type { NotificationCatalog, NotificationPreferencesResponse, Preferences } from "./types"

type BrowserPermission = NotificationPermission | "unsupported"

const BROWSER_PERMISSION: Record<BrowserPermission, { label: string; detail: string; tone: string }> = {
  granted: { label: "Habilitadas", detail: "Autorizadas neste dispositivo.", tone: "bg-success/15" },
  denied: { label: "Bloqueadas", detail: "Bloqueadas nas configurações do navegador.", tone: "bg-destructive/10" },
  default: { label: "Não configuradas", detail: "Ainda não autorizadas neste dispositivo.", tone: "bg-muted" },
  unsupported: { label: "Indisponíveis", detail: "Este navegador não suporta notificações.", tone: "bg-muted" },
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl bg-card p-6 shadow-sm", className)}>{children}</section>
}

// Permissão do navegador neste dispositivo (não é uma preferência gravada no servidor).
function BrowserNotifications() {
  const [permission, setPermission] = useState<BrowserPermission>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  )
  const state = BROWSER_PERMISSION[permission]

  function onClick() {
    if (permission === "default") {
      void Notification.requestPermission().then(setPermission)
    } else if (permission === "granted") {
      new Notification("Mova", { body: "As notificações estão ativas neste dispositivo." })
    }
  }

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
          <Monitor className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] leading-[18px] font-semibold">Notificações no Navegador</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold", state.tone)}>
              {state.label}
            </span>
          </div>
          <span className="text-xs leading-4 text-muted-foreground">{state.detail}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={permission === "denied" || permission === "unsupported"}
        onClick={onClick}
        className="h-9 gap-1.5 rounded-xl bg-card px-4 text-[13px] font-medium"
      >
        <BellOff className="size-4" aria-hidden />
        {permission === "default" ? "Permitir no navegador" : "Testar no navegador"}
      </Button>
    </div>
  )
}

function SoundSlotCard({
  slot,
  control,
  enabled,
}: {
  slot: NotificationCatalog["sounds"][number]
  control: Control<Preferences>
  enabled: boolean
}) {
  const meta = SOUND_SLOT_LABELS[slot.id] ?? { label: slot.id, tag: "" }
  const current = useWatch({ control, name: `sounds.${slot.id}` })

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl bg-muted p-4", !enabled && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] leading-[18px] font-semibold">{meta.label}</span>
        {meta.tag && (
          <span className="rounded bg-card px-1.5 text-[10px] leading-4 font-semibold shadow-xs">{meta.tag}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={`sounds.${slot.id}.sound`}
          render={({ field }) => (
            <NativeSelect
              aria-label={`Som de ${meta.label}`}
              disabled={!enabled}
              className="h-9 rounded-lg bg-card text-[13px]"
              {...field}
            >
              {slot.options.map((option) => (
                <option key={option} value={option}>
                  {SOUND_LABELS[option] ?? option}
                </option>
              ))}
            </NativeSelect>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!enabled || !current || !canPreview(current.sound)}
          onClick={() => current && previewSound(current.sound, current.volume)}
          className="size-9 shrink-0 rounded-lg bg-card text-primary"
          aria-label={`Ouvir som de ${meta.label}`}
        >
          <Play className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Controller
          control={control}
          name={`sounds.${slot.id}.volume`}
          render={({ field }) => (
            <input
              type="range"
              min={0}
              max={100}
              value={field.value}
              onChange={(event) => field.onChange(Number(event.target.value))}
              disabled={!enabled}
              aria-label={`Volume de ${meta.label}`}
              className="h-1.5 w-full accent-primary disabled:opacity-70"
            />
          )}
        />
        <span className="w-9 text-right font-data text-[11px] leading-[14px] text-muted-foreground">
          {current?.volume}%
        </span>
      </div>
    </div>
  )
}

function NotificationsForm({ data }: { data: NotificationPreferencesResponse }) {
  const { catalog, defaults } = data
  const save = useSaveNotificationPreferences()
  const form = useForm<Preferences>({ values: data.preferences })
  const { control, handleSubmit, reset, formState } = form
  const soundsEnabled = useWatch({ control, name: "sounds_enabled" })
  const quietEnabled = useWatch({ control, name: "quiet_hours.enabled" })
  const groups = groupEvents(catalog.events)

  const onSave = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      toast.success("Preferências salvas.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as preferências.")
    }
  })

  // O Salvar/Descartar do cabeçalho fixo passa a agir sobre este formulário.
  useRegisterSettingsActions({
    dirty: formState.isDirty,
    saving: save.isPending,
    onSave: () => void onSave(),
    onDiscard: () => reset(),
  })

  return (
    <form onSubmit={onSave} noValidate className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Bell className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl leading-7 font-semibold tracking-tight">Notificações &amp; Alertas Clínicos</h2>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-accent-foreground">
                Suas preferências
              </span>
            </div>
            <p className="text-xs leading-4 text-muted-foreground">
              Configure como e onde você recebe alertas sobre consultas, agendamentos e prontuário.
            </p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <BrowserNotifications />

        {catalog.sounds.length > 0 && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base leading-6 font-semibold">Sons e Alertas em Tempo Real</h3>
                <p className="text-xs leading-4 text-muted-foreground">
                  Sons discretos concebidos especificamente para ambientes de consulta e consultórios.
                </p>
              </div>
              <Controller
                control={control}
                name="sounds_enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Sons e alertas em tempo real"
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {catalog.sounds.map((slot) => (
                <SoundSlotCard key={slot.id} slot={slot} control={control} enabled={soundsEnabled} />
              ))}
            </div>
          </>
        )}

        {catalog.silence_during_appointment && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-accent p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <BellOff className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] leading-[18px] font-semibold text-accent-foreground">
                    Modo Silêncio Clínico durante Atendimento ao Vivo
                  </span>
                  <span className="rounded bg-card px-1.5 text-[10px] leading-4 font-semibold text-accent-foreground">
                    Recomendado
                  </span>
                </div>
                <span className="text-xs leading-4 text-muted-foreground">
                  Silencia automaticamente bipes e avisos sonoros de outras seções sempre que uma ficha de consulta
                  ativa estiver aberta.
                </span>
              </div>
            </div>
            <Controller
              control={control}
              name="silence_during_appointment"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Modo silêncio clínico durante atendimento"
                />
              )}
            />
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base leading-6 font-semibold">Eventos Notificados</h3>
          <p className="text-xs leading-4 text-muted-foreground">
            Escolha quais gatilhos geram um alerta no sistema para você.
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
            <span>Evento / Gatilho</span>
            <span>No sistema</span>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <p className="bg-accent/50 px-4 py-2 text-[11px] leading-[14px] font-semibold tracking-wider text-primary uppercase">
                {group.title}
              </p>
              <ul className="divide-y divide-border/60">
                {group.events.map((event) => {
                  const meta = EVENT_LABELS[event] ?? { label: event, description: "" }
                  return (
                    <li key={event} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] leading-[18px] font-medium">{meta.label}</span>
                        <span className="text-[11px] leading-[14px] text-muted-foreground">{meta.description}</span>
                      </div>
                      <Controller
                        control={control}
                        name={`events.${event}`}
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label={`Notificar: ${meta.label}`}
                          />
                        )}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Moon className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base leading-6 font-semibold">Horário de Silêncio / Fora do Expediente</h3>
              <p className="text-xs leading-4 text-muted-foreground">
                Restringe notificações sonoras aos horários de atendimento para preservar o seu descanso.
              </p>
            </div>
          </div>
          <Controller
            control={control}
            name="quiet_hours.enabled"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Horário de silêncio" />
            )}
          />
        </div>
        <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-3", !quietEnabled && "opacity-60")}>
          <label className="flex flex-col gap-1.5 text-[13px] leading-[18px] font-medium">
            Horário Inicial
            <Controller
              control={control}
              name="quiet_hours.start"
              render={({ field }) => (
                <Input type="time" disabled={!quietEnabled} className="h-10 rounded-xl bg-muted shadow-none" {...field} />
              )}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] leading-[18px] font-medium">
            Horário Final
            <Controller
              control={control}
              name="quiet_hours.end"
              render={({ field }) => (
                <Input type="time" disabled={!quietEnabled} className="h-10 rounded-xl bg-muted shadow-none" {...field} />
              )}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] leading-[18px] font-medium">
            Dias Aplicáveis
            <Controller
              control={control}
              name="quiet_hours.days"
              render={({ field }) => (
                <NativeSelect disabled={!quietEnabled} className="rounded-xl" {...field}>
                  {Object.entries(QUIET_DAYS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            />
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => reset(defaults, { keepDefaultValues: true })}
          className="h-10 rounded-xl bg-muted px-4 text-[13px] font-medium"
        >
          Restaurar Padrões Recomendados
        </Button>
        <Button
          type="submit"
          disabled={!formState.isDirty || save.isPending}
          className="h-10 rounded-xl px-4 text-[13px] font-semibold shadow-sm"
        >
          {save.isPending ? "Salvando..." : "Salvar Preferências"}
        </Button>
      </div>
    </form>
  )
}

export function NotificationsPage() {
  const query = useNotificationPreferences()

  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-card p-6 shadow-sm">
        <p className="text-sm text-destructive">{query.error.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()} className="rounded-xl">
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (!query.data) return <Skeleton className="h-64 rounded-2xl" />
  return <NotificationsForm data={query.data} />
}
