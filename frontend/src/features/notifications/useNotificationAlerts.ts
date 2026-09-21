import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { agendaAppointmentsQuery } from "@/features/schedule/api"
import { useProfile } from "@/features/settings/api"
import { useNotificationPreferences } from "@/features/settings/platform/notifications/api"
import { previewSound } from "@/features/settings/platform/notifications/sounds"
import { toISODate } from "@/lib/date"

import { chosenSound, soundAllowed } from "./alertRules"
import type { NotificationFeed } from "./types"

const IMMINENT_MINUTES = 10
const TICK_MS = 20_000

/**
 * Avisos que dependem do relógio e das preferências da pessoa:
 *  - chegou uma consulta nova: toca o som "Novo Paciente Agendado" (e mostra um aviso na tela);
 *  - faltam 10 minutos para uma consulta do NUTRICIONISTA: aviso na tela e som "Consulta Iminente".
 * Os sons obedecem ao horário de silêncio e ao silêncio clínico durante um atendimento ao vivo.
 */
export function useNotificationAlerts(feed: NotificationFeed | undefined) {
  const { data: profile } = useProfile()
  const preferences = useNotificationPreferences().data?.preferences
  const isNutritionist = profile?.role === "nutritionist"

  // Consultas do próprio nutricionista (a API só devolve as dele). Pede de ontem a amanhã: o dia da clínica pode
  // não coincidir com o do navegador, e os alertas só olham o horário exato de cada consulta.
  const [window3] = useState(() => {
    const day = 86_400_000
    return { from: toISODate(new Date(Date.now() - day)), to: toISODate(new Date(Date.now() + day)) }
  })
  const agenda = useQuery({ ...agendaAppointmentsQuery(window3.from, window3.to), enabled: isNutritionist })
  const appointments = agenda.data

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const liveNow = !!appointments?.some(
    (item) =>
      (item.status === "scheduled" || item.status === "confirmed") &&
      new Date(item.starts_at) <= now &&
      now < new Date(item.ends_at),
  )

  // ---- chegada de aviso novo (a primeira carga só registra o que já existe)
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!feed) return
    if (seen.current === null) {
      seen.current = new Set(feed.items.map((item) => item.id))
      return
    }
    const fresh = feed.items.filter((item) => !item.read && !seen.current!.has(item.id))
    fresh.forEach((item) => seen.current!.add(item.id))
    if (fresh.length === 0) return

    toast(fresh.length === 1 ? fresh[0].title : `${fresh.length} novas notificações`, {
      description: fresh.length === 1 ? fresh[0].body : undefined,
    })
    const sound = preferences ? chosenSound(preferences, "new_appointment") : null
    if (
      sound &&
      preferences &&
      fresh.some((item) => item.event === "appointment_created") &&
      soundAllowed(preferences, new Date(), liveNow)
    ) {
      previewSound(sound.sound, sound.volume)
    }
  }, [feed, preferences, liveNow])

  // ---- consulta iminente (10 min antes), uma vez por consulta
  const alerted = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isNutritionist || !preferences || !appointments) return
    const sound = chosenSound(preferences, "upcoming_appointment")
    if (!preferences.sounds_enabled || !sound) return
    for (const item of appointments) {
      if (item.status !== "scheduled" && item.status !== "confirmed") continue
      const minutes = (new Date(item.starts_at).getTime() - now.getTime()) / 60_000
      if (minutes <= 0 || minutes > IMMINENT_MINUTES || alerted.current.has(item.id)) continue
      alerted.current.add(item.id)
      const time = new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      toast(`Consulta em ${Math.ceil(minutes)} min`, { description: `${item.patient_name} • ${time}` })
      // Durante outro atendimento ao vivo o som fica mudo (só o aviso na tela aparece).
      const busyWithAnother = appointments.some(
        (other) =>
          other.id !== item.id &&
          (other.status === "scheduled" || other.status === "confirmed") &&
          new Date(other.starts_at) <= now &&
          now < new Date(other.ends_at),
      )
      if (soundAllowed(preferences, now, busyWithAnother)) previewSound(sound.sound, sound.volume)
    }
  }, [isNutritionist, preferences, appointments, now])
}
