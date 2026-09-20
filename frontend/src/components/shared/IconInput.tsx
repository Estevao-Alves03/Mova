import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface IconInputProps extends ComponentProps<"input"> {
  icon: LucideIcon
}

export function IconInput({ icon: Icon, className, ...props }: IconInputProps) {
  return (
    <div className="relative flex items-center">
      <Icon
        className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground"
        aria-hidden
      />
      <Input className={cn("h-10 rounded-xl bg-muted pl-9 shadow-none", className)} {...props} />
    </div>
  )
}
