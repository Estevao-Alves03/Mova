// "Dr. Henrique Silva" -> "HS" (ignora títulos abreviados como "Dr." e "Dra.")
export function getInitials(fullName: string) {
  const names = fullName.split(" ").filter((name) => name && !name.endsWith("."))
  const first = names[0]?.[0] ?? ""
  const last = names.length > 1 ? names[names.length - 1][0] : ""
  return (first + last).toUpperCase()
}
