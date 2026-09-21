import { Toaster as Sonner } from "sonner"

// No canto inferior: no alto os avisos cobririam o sino de notificações e a busca do header.
export function Toaster() {
  return <Sonner position="bottom-right" richColors closeButton />
}
