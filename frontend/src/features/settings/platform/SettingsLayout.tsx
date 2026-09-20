import { Check, ChevronRight, SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router"

import { ScrollRegion } from "@/components/shared/ScrollRegion"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/features/settings/api"
import { cn } from "@/lib/utils"
import { mockTeam, mockUnits } from "@/mocks/settings"

import { categoriesFor, type SettingsCategoryPath } from "./categories"
import type { PageActions, SettingsOutletContext } from "./settingsContext"

const activeMembers = mockTeam.filter((member) => member.status === "active").length

const SUBTITLES: Record<SettingsCategoryPath, string> = {
  team: `${activeMembers} membros ativos`,
  notifications: "Alertas & sons",
  units: mockUnits.map((unit) => unit.name).join(" & "),
}

/**
 * Estrutura fixa: cabeçalho e lista de categorias não rolam; só o conteúdo da
 * categoria aberta tem rolagem interna. As categorias visíveis vêm do papel do usuário.
 */
export function SettingsLayout() {
  const { data: profile } = useProfile()
  const { pathname } = useLocation()
  const [actions, setActions] = useState<PageActions | null>(null)
  const context = useMemo<SettingsOutletContext>(() => ({ setActions }), [])

  const categories = categoriesFor(profile?.role)
  const isPlatform = categories.some((category) => category.scope === "platform")
  const current = categories.find((category) => pathname.endsWith(`/${category.path}`))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          {isPlatform && (
            <p className="flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold tracking-wider text-primary uppercase">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Painel Administrativo • Mova
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-8 font-semibold tracking-tight">
              {isPlatform ? "Configurações da Plataforma" : "Configurações"}
            </h1>
            {!actions && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                Somente visualização
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isPlatform
              ? "Gerencie os membros da equipe, níveis de acesso e preferências de alertas da clínica."
              : "Ajuste suas preferências pessoais."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!actions?.dirty || actions.saving}
            onClick={actions?.onDiscard}
            className="h-10 rounded-xl bg-muted px-4 text-[13px] font-medium"
          >
            Descartar
          </Button>
          <Button
            type="button"
            disabled={!actions?.dirty || actions.saving}
            onClick={actions?.onSave}
            className="h-10 rounded-xl px-4 text-[13px] font-semibold shadow-sm"
          >
            <Check className="size-[18px]" aria-hidden />
            {actions?.saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:grid-rows-1 xl:gap-6">
        <nav aria-label="Categorias de ajustes" className="min-w-0 rounded-2xl bg-card p-3 shadow-sm xl:self-start">
          <p className="hidden px-2 pb-2 text-[11px] leading-[14px] font-semibold tracking-wider text-muted-foreground uppercase xl:block">
            Categorias de ajustes
          </p>
          <ul className="flex gap-1 overflow-x-auto xl:flex-col xl:overflow-visible">
            {categories.map(({ path, title, icon: Icon }) => (
              <li key={path} className="shrink-0 xl:shrink">
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl p-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate text-[13px] leading-[18px]", isActive ? "font-semibold" : "font-medium text-foreground")}>
                          {title}
                        </span>
                        <span className="hidden truncate text-[11px] leading-[14px] text-muted-foreground xl:block">
                          {SUBTITLES[path]}
                        </span>
                      </span>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground xl:block" aria-hidden />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <ScrollRegion label={current?.title ?? "Configurações"} resetKey={pathname} className="min-w-0 pr-1 pb-2">
          <Outlet context={context} />
        </ScrollRegion>
      </div>
    </div>
  )
}
