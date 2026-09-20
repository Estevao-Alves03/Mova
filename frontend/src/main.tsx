import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"

import { router } from "@/app/router"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { ApiError } from "@/lib/api"

import "./styles.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Erros 4xx não melhoram com nova tentativa.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
