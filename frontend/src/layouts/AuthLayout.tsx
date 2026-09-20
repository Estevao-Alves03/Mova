import { Leaf } from "lucide-react"
import type { ReactNode } from "react"

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col">
            <span className="text-base leading-5 font-semibold tracking-tight">Mova</span>
            <span className="font-data text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase">
              NutriGestão Pro
            </span>
          </div>
        </div>
        <h1 className="mb-5 text-xl leading-7 font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  )
}
