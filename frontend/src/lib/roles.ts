import type { UserRole } from "@/types/user"

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  nutritionist: "Nutricionista",
  receptionist: "Recepção",
  patient: "Paciente",
}
