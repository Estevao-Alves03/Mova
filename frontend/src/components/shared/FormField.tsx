import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface ControlProps {
  id: string
  "aria-invalid": true | undefined
  "aria-describedby": string | undefined
}

interface FormFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  /** Contador ou ação alinhada à direita do label. */
  aside?: ReactNode
  children: (control: ControlProps) => ReactNode
}

/** Label + controle + dica/erro, com ligações de acessibilidade (for, aria-invalid, aria-describedby). */
export function FormField({ id, label, error, hint, className, aside, children }: FormFieldProps) {
  const showHint = !!hint && !error
  const describedBy = error ? `${id}-error` : showHint ? `${id}-hint` : undefined
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {showHint && (
        <p id={`${id}-hint`} className="text-xs leading-4 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs leading-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
