import type { StatusCounts } from "../useAgenda"

const LABELS: Record<keyof StatusCounts, string> = {
  scheduled: "Agendados",
  confirmed: "Confirmados",
  waiting: "Em Espera",
  in_progress: "Em Atendimento",
  completed: "Concluídos",
}

const ROWS: { status: keyof StatusCounts; row: string; dot: string; pulse?: boolean }[] = [
  { status: "scheduled", row: "bg-accent text-accent-foreground", dot: "bg-accent-foreground" },
  { status: "confirmed", row: "bg-success/10", dot: "bg-success" },
  { status: "waiting", row: "bg-warning/15", dot: "bg-warning" },
  { status: "in_progress", row: "bg-primary/10 text-primary", dot: "bg-primary", pulse: true },
  { status: "completed", row: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
]

export function StatusSummary({ counts }: { counts: StatusCounts }) {
  return (
    <section aria-label="Status da recepção" className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-sm">
      <h3 className="text-[15px] leading-6 font-bold">Status da Recepção</h3>
      <ul className="flex flex-col gap-1.5">
        {ROWS.map(({ status, row, dot, pulse }) => (
          <li
            key={status}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] leading-[14px] font-semibold ${row}`}
          >
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                {pulse && (
                  <span className={`absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping ${dot}`} aria-hidden />
                )}
                <span className={`relative inline-flex size-2 rounded-full ${dot}`} aria-hidden />
              </span>
              {LABELS[status]}
            </span>
            <span className="font-data font-bold">{counts[status]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
