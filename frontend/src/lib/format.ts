const oneDecimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** 88.4 -> "88,4%" */
export function formatPercent(value: number) {
  return `${oneDecimal.format(value)}%`
}

/** 6.2 -> "6,2" */
export function formatDecimal(value: number) {
  return oneDecimal.format(value)
}
