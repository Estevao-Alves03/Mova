import type { ReactElement } from "react"
import { createBrowserRouter, Navigate, type RouteObject } from "react-router"

import { LoginPage } from "@/features/auth/LoginPage"
import { RequireRole } from "@/features/auth/RequireRole"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { PatientsPage } from "@/features/patients/PatientsPage"
import { SchedulePage } from "@/features/schedule/SchedulePage"
import { rolesFor, SETTINGS_ROLES, type SettingsCategoryPath } from "@/features/settings/platform/categories"
import { NotificationsPage } from "@/features/settings/platform/notifications/NotificationsPage"
import { SettingsIndex } from "@/features/settings/platform/SettingsIndex"
import { SettingsLayout } from "@/features/settings/platform/SettingsLayout"
import { TeamPage } from "@/features/settings/platform/team/TeamPage"
import { UnitsPage } from "@/features/settings/platform/units/UnitsPage"
import { ProfilePage } from "@/features/settings/ProfilePage"
import { AdminLayout } from "@/layouts/AdminLayout"

/** Categoria de Configurações protegida pelos papéis definidos em categories.ts. */
function settingsCategory(path: SettingsCategoryPath, element: ReactElement): RouteObject {
  return {
    path,
    element: <RequireRole roles={rolesFor(path)} />,
    children: [{ index: true, element }],
  }
}

// Rotas sem `element`: as telas entram nas próximas etapas.
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/dashboard" replace /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/app",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "schedule", element: <SchedulePage /> },
          { path: "patients", element: <PatientsPage /> },
          {
            // Guardas só de UX; a autorização real será do backend.
            path: "settings",
            element: <RequireRole roles={SETTINGS_ROLES} />,
            children: [
              {
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <SettingsIndex /> },
                  settingsCategory("team", <TeamPage />),
                  settingsCategory("notifications", <NotificationsPage />),
                  settingsCategory("units", <UnitsPage />),
                ],
              },
            ],
          },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
])
