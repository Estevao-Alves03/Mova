import { useEffect, useRef } from "react"
import { useOutletContext } from "react-router"

/** Ações do cabeçalho (Salvar/Descartar) que a aba aberta registra. Sem registro, a aba é somente visual. */
export interface PageActions {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}

export interface SettingsOutletContext {
  setActions: (actions: PageActions | null) => void
}

export function useRegisterSettingsActions({ dirty, saving, onSave, onDiscard }: PageActions) {
  const { setActions } = useOutletContext<SettingsOutletContext>()
  const callbacks = useRef({ onSave, onDiscard })

  useEffect(() => {
    callbacks.current = { onSave, onDiscard }
  }, [onSave, onDiscard])

  useEffect(() => {
    setActions({
      dirty,
      saving,
      onSave: () => callbacks.current.onSave(),
      onDiscard: () => callbacks.current.onDiscard(),
    })
  }, [dirty, saving, setActions])

  useEffect(() => () => setActions(null), [setActions])
}
