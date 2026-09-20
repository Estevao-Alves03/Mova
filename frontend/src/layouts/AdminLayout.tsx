import { useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router"

import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDeniedPage } from "@/features/auth/AccessDeniedPage"
import { useProfile } from "@/features/settings/api"
import { ApiError } from "@/lib/api"

import { AppHeader } from "./admin/AppHeader"
import { AppSidebar } from "./admin/AppSidebar"

export function AdminLayout() {
  const profile = useProfile()
  const { pathname } = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)

  // A página não rola: menu e header ficam fixos e só esta região rola. Ao trocar de rota,
  // volta ao topo e recebe o foco (permite rolar pelo teclado logo após navegar).
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
    contentRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // 403: autenticado, mas sem vínculo ativo com a clínica.
  if (profile.error instanceof ApiError && profile.error.status === 403) {
    return <AccessDeniedPage />
  }

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar profile={profile.data} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-muted/40">
        <AppHeader />
        <div
          ref={contentRef}
          tabIndex={-1}
          data-slot="app-content"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 outline-none md:px-8"
        >
          {profile.data ? (
            <Outlet />
          ) : profile.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">{profile.error.message}</p>
              <Button variant="outline" onClick={() => void profile.refetch()} className="rounded-xl">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
