import { ChevronDown } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative flex items-center">
      <select
        data-slot="native-select"
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-input bg-muted pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
}

export { NativeSelect }
