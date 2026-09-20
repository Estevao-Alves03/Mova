import { CATEGORIES, type CategoryConfig } from "../categories"
import { formatDuration, type ScheduleConfig } from "../scheduleConfig"
import type { EventKind } from "../types"

interface CategoryFiltersProps {
  enabled: Set<EventKind>
  onToggle: (kind: EventKind) => void
  /** Durações configuradas do profissional exibido (só quando há um único). */
  durations?: ScheduleConfig["durations"]
}

function hintFor(category: CategoryConfig, durations: CategoryFiltersProps["durations"]) {
  if (!category.appointmentType) return category.hint
  const minutes = durations?.[category.appointmentType]
  return minutes ? formatDuration(minutes) : "—"
}

export function CategoryFilters({ enabled, onToggle, durations }: CategoryFiltersProps) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <legend className="float-left text-[15px] leading-6 font-bold">Categorias Clínicas</legend>
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Filtros</span>
      </div>
      <div className="flex flex-col gap-1">
        {CATEGORIES.map((category) => (
          <label
            key={category.kind}
            className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm transition-colors hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={enabled.has(category.kind)}
              onChange={() => onToggle(category.kind)}
              style={{ accentColor: category.accentVar }}
              className="size-4 rounded"
            />
            <span className={`size-2.5 shrink-0 rounded-full ${category.dot}`} aria-hidden />
            <span className="flex-1 leading-5">{category.label}</span>
            <span className="font-data text-[11px] text-muted-foreground">{hintFor(category, durations)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
