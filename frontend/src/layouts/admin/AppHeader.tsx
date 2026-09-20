import { Bell, Search } from "lucide-react"
import { useEffect, useRef } from "react"
import { useLocation } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { getPageTitle } from "./nav-items"

export function AppHeader() {
  const { pathname } = useLocation()
  const searchRef = useRef<HTMLInputElement>(null)

  const title = getPageTitle(pathname)

  // Atalho anunciado no campo de busca (⌘K / Ctrl+K).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 bg-card/90 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:grid md:grid-cols-[1fr_2fr_1fr] md:gap-4 md:px-8 xl:grid-cols-[1fr_minmax(0,28rem)_1fr]">
      {/* Grade de 3 colunas no desktop: a busca fica no centro do header,
          independente da largura do título à esquerda. */}
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 md:hidden" />

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap text-[13px] xl:gap-2">
            <BreadcrumbItem className="hidden xl:inline-flex">
              Área Clínica
            </BreadcrumbItem>
            {title && (
              <>
                <BreadcrumbSeparator className="hidden xl:block" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate font-semibold">
                    {title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div
        role="search"
        className="relative flex min-w-0 flex-1 items-center md:w-full md:flex-none"
      >
        <Search
          className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={searchRef}
          type="text"
          name="patient-search"
          aria-label="Buscar paciente"
          placeholder="Buscar paciente por nome..."
          autoComplete="off"
          className="h-10 rounded-xl bg-muted pr-4 pl-10 text-sm shadow-none sm:pr-14"
        />
        <kbd className="pointer-events-none absolute right-3 hidden rounded border border-border bg-card px-1.5 py-0.5 font-data text-[11px] leading-[14px] text-muted-foreground shadow-xs sm:inline-block">
          ⌘K
        </kbd>
      </div>

      <div className="relative shrink-0 justify-self-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="size-5" aria-hidden />
        </Button>
        <span
          className="pointer-events-none absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-card"
          aria-hidden
        />
      </div>
    </header>
  )
}
