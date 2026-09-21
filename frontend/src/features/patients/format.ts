import { MONTH_SHORT } from "@/lib/date"

/** "2024-10-22T13:00:00Z" -> "22/Out/2024" */
export function formatShortDate(iso: string) {
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, "0")}/${MONTH_SHORT[date.getMonth()]}/${date.getFullYear()}`
}

/** "2024-11-20T17:30:00Z" -> "20/Nov às 14:30" (horário local) */
export function formatNextAppointment(iso: string) {
  const date = new Date(iso)
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  return `${String(date.getDate()).padStart(2, "0")}/${MONTH_SHORT[date.getMonth()]} às ${time}`
}

export function getAge(birthDate: string, now = new Date()) {
  const birth = new Date(birthDate)
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age--
  return age
}
