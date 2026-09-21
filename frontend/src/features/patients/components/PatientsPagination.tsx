import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** 1 … 4 5 6 … 31 (janela de páginas com reticências). */
function pagesToShow(page: number, count: number): (number | "gap-start" | "gap-end")[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  const pages = new Set([1, count, page - 1, page, page + 1].filter((value) => value >= 1 && value <= count))
  const sorted = [...pages].sort((a, b) => a - b)
  const result: (number | "gap-start" | "gap-end")[] = []
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && value - previous > 1) result.push(previous < page ? "gap-start" : "gap-end")
    result.push(value)
  })
  return result
}

interface PatientsPaginationProps {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  onPage: (page: number) => void
}

export function PatientsPagination({ page, pageCount, from, to, total, onPage }: PatientsPaginationProps) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-6 py-4 sm:flex-row">
      <p role="status" className="text-xs text-muted-foreground">
        Mostrando <strong className="font-data font-semibold text-foreground">{from}</strong> a{" "}
        <strong className="font-data font-semibold text-foreground">{to}</strong> de{" "}
        <strong className="font-data font-semibold text-foreground">{total}</strong> pacientes
        <span aria-hidden> • </span>
        <span className="hidden sm:inline">
          Página {page} de {pageCount}
        </span>
      </p>
      <nav aria-label="Paginação" className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-8 gap-1 rounded-lg px-2.5 text-xs font-medium"
        >
          <ChevronLeft aria-hidden />
          Anterior
        </Button>
        {pagesToShow(page, pageCount).map((item) =>
          typeof item === "string" ? (
            <span key={item} aria-hidden className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Página ${item}`}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPage(item)}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg font-data text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                item === page ? "bg-primary font-semibold text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item}
            </button>
          ),
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="h-8 gap-1 rounded-lg px-2.5 text-xs font-medium"
        >
          Próxima
          <ChevronRight aria-hidden />
        </Button>
      </nav>
    </div>
  )
}
