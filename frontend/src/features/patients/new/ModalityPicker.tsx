import { Building2, CircleCheck, Video } from "lucide-react"

import { FormField } from "@/components/shared/FormField"
import { NativeSelect } from "@/components/ui/native-select"
import type { ScheduleUnit } from "@/features/schedule/scheduleConfig"

interface ModalityPickerProps {
  /** Unidade do horário escolhido (a agenda do profissional define onde ele atende naquele dia). */
  unit: ScheduleUnit | undefined
  roomId: string
  onRoomChange: (roomId: string) => void
}

/** Presencial (unidade + sala opcional). Teleconsulta ainda não existe: aparece desabilitada. */
export function ModalityPicker({ unit, roomId, onRoomChange }: ModalityPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[11px] leading-4 font-semibold tracking-wider text-muted-foreground uppercase">
        Modalidade do Atendimento:
      </legend>

      <div className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-accent p-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-[18px]" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] leading-[18px] font-bold">
                Presencial{unit ? ` (${unit.name})` : ""}
              </span>
              <span className="truncate text-[11px] leading-[14px] text-muted-foreground">
                {unit ? (unit.address ?? "Endereço não cadastrado") : "Escolha um horário para ver a unidade"}
              </span>
            </div>
          </div>
          <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden />
        </div>

        {unit && unit.rooms.length > 0 && (
          <FormField id="np-room" label="Sala (opcional)">
            {(control) => (
              <NativeSelect {...control} value={roomId} onChange={(event) => onRoomChange(event.target.value)} className="h-9 bg-card">
                <option value="">Sem sala definida</option>
                {unit.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </div>

      {/* Teleconsulta é uma modalidade futura: sem integração de vídeo, não pode ser escolhida. */}
      <div aria-disabled className="flex items-center justify-between gap-2.5 rounded-xl border border-border bg-card p-3 opacity-60">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Video className="size-[18px]" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] leading-[18px] font-semibold">Teleconsulta (Online)</span>
            <span className="text-[11px] leading-[14px] text-muted-foreground">Em breve</span>
          </div>
        </div>
        <span className="size-4 rounded-full border border-muted-foreground/40" aria-hidden />
      </div>
    </fieldset>
  )
}
