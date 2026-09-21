import type { Preferences } from "@/features/settings/platform/notifications/types"

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Quando um alerta SONORO pode tocar, conforme as preferências da pessoa (Configurações > Notificações):
 * alertas sonoros ligados; fora do "horário de silêncio" (só toca dentro do horário e dos dias de atendimento);
 * e, com o "silêncio clínico", nunca durante um atendimento ao vivo.
 */
export function soundAllowed(preferences: Preferences, now: Date, inLiveAppointment: boolean) {
  if (!preferences.sounds_enabled) return false
  if (preferences.silence_during_appointment && inLiveAppointment) return false
  const quiet = preferences.quiet_hours
  if (quiet.enabled) {
    const day = now.getDay()
    if (quiet.days === "weekdays" && (day === 0 || day === 6)) return false
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes < toMinutes(quiet.start) || minutes >= toMinutes(quiet.end)) return false
  }
  return true
}

/** O som escolhido para o alerta (nulo se o alerta não existe para o papel ou está em "Silencioso"). */
export function chosenSound(preferences: Preferences, slot: string) {
  const choice = preferences.sounds[slot]
  return choice && choice.sound !== "silent" ? choice : null
}
