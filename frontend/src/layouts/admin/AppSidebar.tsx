import { Leaf, LogOut } from "lucide-react"
import { Link, useLocation } from "react-router"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/useAuth"
import type { Profile } from "@/features/settings/types"
import { roleLabels } from "@/lib/roles"
import { getInitials } from "@/lib/user"

import { canSeeNavItem, isNavItemActive, navItems, PROFILE_PATH } from "./nav-items"

interface AppSidebarProps {
  /** Indefinido enquanto o perfil carrega. */
  profile: Profile | undefined
}

export function AppSidebar({ profile }: AppSidebarProps) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const { signOut } = useAuth()
  const roleLabel = profile ? roleLabels[profile.role] : undefined
  const isProfileActive = pathname === PROFILE_PATH

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground/15 shadow-xs backdrop-blur-sm">
              <Leaf className="size-5" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-base leading-6 font-semibold tracking-tight">
                Mova
              </span>
              <span className="font-data text-[11px] leading-[14px] font-semibold tracking-wider text-sidebar-foreground/80 uppercase">
                Gestão Nutricional
              </span>
            </div>
          </div>
          {roleLabel && (
            <span className="shrink-0 rounded-full border border-sidebar-foreground/10 bg-accent/20 px-2 py-0.5 text-[11px] leading-[14px] font-semibold">
              {roleLabel}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.filter((item) => canSeeNavItem(item, profile?.role)).map((item) => {
                const isActive = isNavItemActive(item, pathname)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-10 gap-3 px-3 text-[13px] font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-[active=true]:font-semibold"
                    >
                      <Link
                        to={item.to}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-1 rounded-xl border border-sidebar-border bg-sidebar-foreground/10 p-1">
          {profile ? (
            <Link
              to={PROFILE_PATH}
              aria-label={`Meu perfil, ${profile.full_name}`}
              aria-current={isProfileActive ? "page" : undefined}
              data-active={isProfileActive}
              onClick={() => setOpenMobile(false)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 outline-hidden transition-colors hover:bg-sidebar-foreground/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-foreground/15"
            >
              <div className="relative shrink-0">
                <Avatar className="size-9">
                  {profile.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
                  )}
                  <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-(--sidebar-gradient-end)"
                  title="Online"
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] leading-[18px] font-semibold">
                  {profile.full_name}
                </span>
                <span className="truncate font-data text-[11px] leading-[14px] text-sidebar-muted-foreground">
                  {profile.crn ?? roleLabel}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex flex-1 items-center gap-2 p-1" aria-busy="true">
              <Skeleton className="size-9 rounded-full bg-sidebar-foreground/15" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24 bg-sidebar-foreground/15" />
                <Skeleton className="h-2.5 w-16 bg-sidebar-foreground/15" />
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void signOut()}
            className="size-8 shrink-0 text-sidebar-muted-foreground hover:bg-sidebar-foreground/15 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring"
            aria-label="Sair da conta"
            title="Sair da conta"
          >
            <LogOut aria-hidden />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
