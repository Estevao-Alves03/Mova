import { ShieldAlert } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"

/** Acesso negado dentro do app (usuário autenticado, mas sem permissão para esta área). */
export function ForbiddenState() {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center shadow-sm">
      <ShieldAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Acesso restrito</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Fale com o administrador da clínica.
      </p>
      <Button asChild variant="outline" className="rounded-xl">
        <Link to="/app/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  )
}
