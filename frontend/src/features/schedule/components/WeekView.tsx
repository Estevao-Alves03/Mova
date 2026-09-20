import { addDays } from "@/lib/date"

import type { Agenda } from "../useAgenda"
import { TimeGrid } from "./TimeGrid"

/** Segunda a sábado; o domingo aparece se algum profissional visível atende nele. */
export function WeekView({ agenda, roomName }: { agenda: Agenda; roomName: (id?: string) => string | undefined }) {
  const days: Date[] = []
  for (let day = agenda.range.start; day <= agenda.range.end; day = addDays(day, 1)) days.push(day)
  return (
    <div className="overflow-x-auto">
      <TimeGrid
        days={days}
        events={agenda.events}
        now={agenda.now}
        grid={agenda.grid}
        hoursFor={agenda.hoursFor}
        variant="week"
        selectedId={agenda.selected?.id}
        onSelect={agenda.select}
        roomName={roomName}
      />
    </div>
  )
}
