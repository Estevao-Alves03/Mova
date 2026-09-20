import { BadgeCheck } from "lucide-react"
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import type { WeeklyRhythm } from "../types"

const chartConfig = {
  done: { label: "Realizadas", color: "var(--chart-1)" },
  capacity: { label: "Capacidade", color: "var(--chart-2)" },
  occupancy: { label: "Taxa %", color: "var(--chart-3)" },
} satisfies ChartConfig

const BAR_SIZE = 34

// "Sem 01 (01-07)" -> duas linhas: "Sem 01" e "(01-07)"
function WeekTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const [name, range] = (payload?.value ?? "").split(" (")
  return (
    <text x={x} y={y} textAnchor="middle" className="fill-muted-foreground font-data text-[11px]">
      <tspan x={x} dy="1em">
        {name}
      </tspan>
      {range && (
        <tspan x={x} dy="1.25em">
          ({range}
        </tspan>
      )}
    </text>
  )
}

interface OperationalRhythmChartProps {
  periodLabel: string
  weeks: WeeklyRhythm[]
}

export function OperationalRhythmChart({ periodLabel, weeks }: OperationalRhythmChartProps) {
  const closedWeeks = weeks.filter((week) => !week.projected)
  const peakWeek = closedWeeks.reduce((best, week) =>
    week.occupancy > best.occupancy ? week : best,
  )
  const peakName = peakWeek.label.split(" (")[0]
  const projectedTotal = weeks.reduce((sum, week) => sum + week.done, 0)

  return (
    <section className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base leading-6 font-semibold">Ritmo Operacional &amp; Ocupação Semanal</h2>
            <span className="rounded-md bg-muted px-2 py-0.5 font-data text-[11px] leading-[14px] text-muted-foreground">
              {periodLabel}
            </span>
          </div>
          <p className="text-xs leading-4 text-muted-foreground">
            Comparativo de consultas agendadas vs concluídas e curva de taxa de ocupação
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-4 text-[11px] leading-[14px] font-semibold text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
            Realizadas
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-2" aria-hidden />
            Capacidade
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-chart-3" aria-hidden />
            Taxa %
          </li>
        </ul>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <ComposedChart
          accessibilityLayer
          data={weeks}
          barGap={-BAR_SIZE}
          margin={{ top: 16, right: 8, bottom: 0, left: 8 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={44}
            tick={<WeekTick />}
          />
          <YAxis yAxisId="count" hide domain={[0, 44]} />
          <YAxis yAxisId="rate" hide orientation="right" domain={[0, 100]} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar yAxisId="count" dataKey="capacity" fill="var(--color-capacity)" radius={6} barSize={BAR_SIZE}>
            {weeks.map((week) => (
              <Cell key={week.label} fillOpacity={week.projected ? 0.6 : 1} />
            ))}
          </Bar>
          <Bar yAxisId="count" dataKey="done" fill="var(--color-done)" radius={6} barSize={BAR_SIZE}>
            {weeks.map((week) => (
              <Cell key={week.label} fillOpacity={week.projected ? 0.5 : 1} />
            ))}
          </Bar>
          <Line
            yAxisId="rate"
            dataKey="occupancy"
            type="monotone"
            stroke="var(--color-occupancy)"
            strokeWidth={3}
            dot={({ key, cx, cy, payload }) => (
              <circle
                key={key}
                cx={cx}
                cy={cy}
                r={4.5}
                fill="var(--card)"
                stroke="var(--color-occupancy)"
                strokeWidth={3}
                opacity={payload.projected ? 0.6 : 1}
              />
            )}
          />
        </ComposedChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3 text-xs leading-4">
        <span className="flex items-center gap-1.5">
          <BadgeCheck className="size-[18px] shrink-0 text-primary" aria-hidden />
          Pico semanal de eficiência atingido na {peakName} com menor tempo ocioso.
        </span>
        <span className="font-data text-[11px] leading-[14px] font-semibold text-primary">
          Projeção de fechamento: {projectedTotal} atendimentos
        </span>
      </div>
    </section>
  )
}
