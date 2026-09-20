import { FieldError } from "./FieldError"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { WEEKDAYS, type ScheduleUnit } from "@/features/schedule/scheduleConfig"
import { cn } from "@/lib/utils"

import type { DayDraft, ScheduleDraft } from "./scheduleDraft"

interface WeekdayRowsProps {
  days: ScheduleDraft["days"]
  errors: Record<string, string>
  units: ScheduleUnit[]
  onChange: (weekday: number, patch: Partial<DayDraft>) => void
}

/** Uma faixa de atendimento por dia da semana (o almoço é único e vale para todos os dias). */
export function WeekdayRows({ days, errors, units, onChange }: WeekdayRowsProps) {
  const showUnit = units.length > 1
  return (
    <ul className="flex flex-col gap-2" aria-label="Dias e horários de atendimento">
      {WEEKDAYS.map(({ value, label, short }) => {
        const day = days[value]
        const error = errors[`day-${value}`]
        return (
          <li key={value} className="flex flex-col gap-1">
            <div
              className={cn(
                "grid items-center gap-3 rounded-xl bg-muted/60 px-3 py-2",
                showUnit
                  ? "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[150px_110px_110px_minmax(0,1fr)]"
                  : "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[150px_110px_110px]",
              )}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={day.on}
                  onCheckedChange={(on) => onChange(value, { on })}
                  aria-label={`Atender ${label}`}
                />
                <span className={cn("text-sm font-medium", !day.on && "text-muted-foreground")}>
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </div>
              {day.on ? (
                <>
                  <Input
                    type="time"
                    aria-label={`${label}: início`}
                    aria-invalid={error ? true : undefined}
                    value={day.start}
                    onChange={(event) => onChange(value, { start: event.target.value })}
                    className="h-9 rounded-xl font-data"
                  />
                  <Input
                    type="time"
                    aria-label={`${label}: fim`}
                    aria-invalid={error ? true : undefined}
                    value={day.end}
                    onChange={(event) => onChange(value, { end: event.target.value })}
                    className="h-9 rounded-xl font-data"
                  />
                  {showUnit && (
                    <NativeSelect
                      aria-label={`${label}: unidade`}
                      value={day.unitId}
                      onChange={(event) => onChange(value, { unitId: event.target.value })}
                      className="col-span-full h-9 sm:col-span-1"
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </>
              ) : (
                <span
                  className={cn(
                    "justify-self-end text-xs text-muted-foreground sm:justify-self-start",
                    showUnit ? "sm:col-span-3" : "sm:col-span-2",
                  )}
                >
                  Sem atendimento
                </span>
              )}
            </div>
            <FieldError message={error} />
          </li>
        )
      })}
    </ul>
  )
}
