import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { ApiError } from "@/lib/api"

/**
 * Mostra o erro da API no formulário: por campo quando o servidor aponta o campo (422/409 de validação);
 * caso contrário devolve a mensagem geral (regra de negócio, indisponibilidade) para exibir acima dos botões.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | undefined {
  if (!(error instanceof ApiError)) return "Não foi possível concluir a operação."
  let matched = false
  for (const field of fields) {
    const message = error.fieldErrors[field]
    if (message) {
      setError(field, { type: "server", message })
      matched = true
    }
  }
  return matched ? undefined : error.message
}
