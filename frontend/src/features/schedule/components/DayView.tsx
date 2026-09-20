import type { Agenda } from "../useAgenda"
import { TimeGrid } from "./TimeGrid"

export function DayView({ agenda, roomName }: { agenda: Agenda; roomName: (id?: string) => string | undefined }) {
  return (
    <TimeGrid
      days={[agenda.date]}
      events={agenda.events}
      now={agenda.now}
      grid={agenda.grid}
      hoursFor={agenda.hoursFor}
      variant="day"
      selectedId={agenda.selected?.id}
      onSelect={agenda.select}
      roomName={roomName}
    />
  )
}
