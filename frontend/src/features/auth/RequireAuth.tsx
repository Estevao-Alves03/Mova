import { Navigate, Outlet, useLocation } from "react-router"

import { Skeleton } from "@/components/ui/skeleton"

import { useAuth } from "./useAuth"

// Guard de rota: só UX. Quem protege os dados é o backend.
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    )
  }
  if (status !== "signedIn") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
