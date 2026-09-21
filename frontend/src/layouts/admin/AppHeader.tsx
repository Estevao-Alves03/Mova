import { useLocation } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { NotificationBell } from "@/features/notifications/NotificationBell"

import { getPageTitle } from "./nav-items"
import { PatientSearch } from "./PatientSearch"

export function AppHeader() {
  const { pathname } = useLocation()
  const title = getPageTitle(pathname)

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

      <PatientSearch />

      <NotificationBell />
    </header>
  )
}
