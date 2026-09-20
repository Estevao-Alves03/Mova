import type { ClinicUnit, TeamMember } from "@/features/settings/platform/types"

// Dados fictícios até existirem as APIs de configurações (os docs as definem como
// somente visuais na demo). E-mails coerentes com o seed para a linha "Você".

export const mockTeam: TeamMember[] = [
  {
    id: "m-1",
    fullName: "Ana Beatriz Rocha",
    email: "ana.rocha@mova.nutri.br",
    role: "admin",
    status: "active",
    lastAccess: "Hoje, 14:32 (sessão atual)",
  },
  {
    id: "m-2",
    fullName: "Dr. Henrique Silva",
    email: "henrique.silva@mova.nutri.br",
    role: "nutritionist",
    crn: "CRN-3 48291",
    status: "active",
    lastAccess: "Hoje, 09:10",
  },
  {
    id: "m-3",
    fullName: "Dra. Camila Meireles",
    email: "camila.meireles@mova.nutri.br",
    role: "nutritionist",
    crn: "CRN-3 51042",
    status: "active",
    lastAccess: "Ontem, às 18:10",
  },
  {
    id: "m-4",
    fullName: "Mariana Fagundes",
    email: "atendimento.sp@mova.nutri.br",
    role: "receptionist",
    status: "active",
    lastAccess: "Hoje, 08:05",
  },
  {
    id: "m-5",
    fullName: "Lucas Vasconcelos",
    email: "lucas.vasconcelos@mova.nutri.br",
    role: "receptionist",
    status: "invited",
    lastAccess: "Aguardando aceite",
  },
  {
    id: "m-6",
    fullName: "Dra. Beatriz Prado",
    email: "beatriz.prado@mova.nutri.br",
    role: "nutritionist",
    crn: "CRN-3 47730",
    status: "inactive",
    lastAccess: "Há 3 meses",
  },
]

// Mesmo horário de funcionamento usado na agenda (seg–sex 08–18h, sábado 08–12h).
const HOURS = "Seg a Sex 08:00 - 18:00 • Sáb 08:00 - 12:00"

export const mockUnits: ClinicUnit[] = [
  {
    id: "u-1",
    name: "Sede Paulista",
    address: "Av. Paulista, 1842, 14º andar - Bela Vista, SP",
    active: true,
    hours: HOURS,
    phone: "(11) 3284-9000",
    email: "recepcao.paulista@mova.nutri.br",
    rooms: [
      { id: "r-1", name: "Consultório 01 (Principal)", active: true },
      { id: "r-2", name: "Consultório 02", active: true },
    ],
  },
  {
    id: "u-2",
    name: "Unidade Jardins",
    address: "Alameda Santos, 1470 - Cerqueira César, SP",
    active: true,
    hours: HOURS,
    phone: "(11) 3145-2200",
    email: "recepcao.jardins@mova.nutri.br",
    rooms: [
      { id: "r-3", name: "Consultório 03", active: true },
      { id: "r-4", name: "Sala de Antropometria", active: true },
      { id: "r-5", name: "Sala de Acolhimento", active: false },
    ],
  },
]
