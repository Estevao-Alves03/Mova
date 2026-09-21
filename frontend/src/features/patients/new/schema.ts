import { Activity, Dumbbell, Leaf, MoreHorizontal, TrendingUp, Zap, type LucideIcon } from "lucide-react"
import { z } from "zod"

import { isValidPhone, parseBrazilianDate } from "@/lib/masks"

export const MAX_NOTES_LENGTH = 300

/** Objetivo principal da consulta. Vai com a 1ª consulta agendada (não com o cadastro básico). */
export const PATIENT_GOALS = [
  { value: "weight_loss", label: "Emagrecimento & Definição", hint: "Perda de gordura corporal", icon: Dumbbell },
  { value: "muscle_gain", label: "Ganho de Massa Muscular", hint: "Hipertrofia & força", icon: TrendingUp },
  { value: "healthy_eating", label: "Reeducação Alimentar", hint: "Hábitos saudáveis & longevidade", icon: Leaf },
  { value: "clinical", label: "Saúde Clínica / Patologias", hint: "Diabetes, colesterol, digestivo", icon: Activity },
  { value: "sports", label: "Performance Esportiva", hint: "Rendimento de alto nível", icon: Zap },
  { value: "other", label: "Outro Objetivo", hint: "Especificar nas observações", icon: MoreHorizontal },
] as const satisfies readonly { value: string; label: string; hint: string; icon: LucideIcon }[]

export type PatientGoal = (typeof PATIENT_GOALS)[number]["value"]
const GOAL_VALUES: string[] = PATIENT_GOALS.map((goal) => goal.value)

/** "unspecified" = "Outro / Prefiro não informar": grava o sexo em branco (a avaliação pedirá depois). */
export const SEX_OPTIONS = ["female", "male", "unspecified"] as const

// Validação de conveniência; a API é quem decide.
export const basicDataSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(120, "O nome deve ter no máximo 120 caracteres."),
  birth_date: z
    .string()
    .trim()
    .refine((value) => value === "" || parseBrazilianDate(value) !== null, "Data inválida. Use DD/MM/AAAA."),
  sex: z.enum(SEX_OPTIONS),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone.")
    .refine(isValidPhone, "Telefone inválido. Use DDD + número."),
  email: z
    .string()
    .trim()
    .max(254, "E-mail longo demais.")
    .refine((value) => value === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "E-mail inválido."),
  goal: z.string().refine((value) => GOAL_VALUES.includes(value), "Selecione o objetivo principal."),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, `A observação deve ter no máximo ${MAX_NOTES_LENGTH} caracteres.`),
})

export type BasicDataValues = z.infer<typeof basicDataSchema>

export const EMPTY_BASIC_DATA: BasicDataValues = {
  full_name: "",
  birth_date: "",
  sex: "unspecified",
  phone: "",
  email: "",
  goal: "",
  notes: "",
}
