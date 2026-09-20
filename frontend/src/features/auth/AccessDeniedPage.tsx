import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useAuth } from "./useAuth"

/** 403: usuário autenticado sem vínculo ativo com a clínica. */
export function AccessDeniedPage() {
  const { signOut } = useAuth()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Acesso negado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Sua conta não tem acesso ativo a uma clínica. Fale com o administrador.
      </p>
      <Button variant="outline" onClick={() => void signOut()} className="rounded-xl">
        Sair
      </Button>
    </main>
  )
}
