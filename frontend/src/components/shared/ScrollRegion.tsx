import { useEffect, useRef, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

interface ScrollRegionProps extends ComponentProps<"div"> {
  /** Nome da região para leitores de tela. */
  label: string
  /** Quando muda (ex.: a rota), a rolagem volta ao topo. */
  resetKey?: string
}

/** Área com rolagem interna, acessível por teclado (role="region" + tabIndex). */
export function ScrollRegion({ label, resetKey, className, children, ...props }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [resetKey])

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "min-h-0 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
