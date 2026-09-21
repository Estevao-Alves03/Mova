// Máscaras e validações de formulário compartilhadas. A API sempre valida de novo.

/** "11987412030" -> "(11) 98741-2030" (fixo: "(11) 3284-9000"). */
export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  const area = `(${digits.slice(0, 2)}) `
  const rest = digits.slice(2)
  return digits.length <= 10 ? `${area}${rest.slice(0, 4)}${rest.length > 4 ? `-${rest.slice(4)}` : ""}` : `${area}${rest.slice(0, 5)}-${rest.slice(5)}`
}

/** DDD + 8 dígitos (fixo) ou DDD + 9 iniciando em 9 (celular). Vazio é válido (campo opcional). */
export function isValidPhone(value: string) {
  if (value === "") return true
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 10 && digits.length !== 11) return false
  if (digits[0] === "0") return false
  return digits.length === 10 || digits[2] === "9"
}

/** "18081994" -> "18/08/1994" */
export function maskDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** "18/08/1994" -> "1994-08-18"; null se não for uma data real, futura ou anterior a 1900. */
export function parseBrazilianDate(value: string, today = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  if (!real || year < 1900 || date > today) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}
