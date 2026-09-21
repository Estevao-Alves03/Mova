# Frontend (Vite + React + TypeScript)

@../docs/design/DESIGN.md

## Estrutura de `src/`

- `app/`: router, providers, guards de rota.
- `layouts/`: `AdminLayout`, `PortalLayout`, `AuthLayout`.
- `components/ui/`: shadcn. `components/shared/`: componentes reutilizáveis do projeto.
- `features/<dominio>/`: `auth`, `dashboard`, `patients`, `schedule`, `anamnesis`, `assessments`, `evolution`, `settings`, `portal`. Cada feature guarda suas páginas, componentes, hooks e tipos.
- `hooks/`, `lib/` (cliente da API, utils), `types/`, `mocks/`.

## Design

- O design do Stitch é a referência visual e deve ser preservado: azul como cor primária, neutros, cards e bordas discretas, radius moderado (0.25rem padrão, 0.5rem lg, 0.75rem xl), sidebar com gradiente azul.
- Fontes: Plus Jakarta Sans para texto e Geist para dados e números.
- Tokens de `DESIGN.md` viram variáveis CSS do shadcn/Tailwind (background, foreground, card, muted, accent, destructive, border, primary etc.). Não copiar o `tailwind.config` inline nem o script CDN dos `code.html`.
- Ícones: Lucide. As telas do Stitch usam Material Symbols; mapear cada ícone para o equivalente em Lucide. Não misturar as duas bibliotecas.
- Gráficos: as telas têm gráficos estáticos; recriar com Recharts alimentados por dados reais da API.

## Convertendo uma tela do Stitch

1. Ler apenas o `code.html` e o `screen.png` da tela em `docs/design/telas/<tela>/`.
2. Recriar com componentes shadcn e classes Tailwind baseadas nos tokens; quebrar em componentes pequenos dentro da feature.
3. Reutilizar componentes de `components/shared/` antes de criar novos.
4. Layout responsivo (desktop, notebook, tablet, celular). A experiência desktop é prioridade no admin. Evitar scroll horizontal.

## Estrutura da página e rolagem

- O app não tem scroll geral: `AdminLayout` tem altura fixa (`h-svh`), com menu lateral e header fixos, e uma única região de conteúdo que rola (`data-slot="app-content"`).
- Páginas com áreas fixas + conteúdo rolando (Configurações, Perfil): a página é `flex min-h-0 flex-1 flex-col`, o cabeçalho/rodapé é `shrink-0` e só o miolo usa `ScrollRegion` (`components/shared/ScrollRegion.tsx`, acessível por teclado, volta ao topo ao trocar de rota).
- Listas que podem crescer (ex.: sessões) têm altura máxima e rolagem interna; nunca aumentam a página.
- Conferir "sem scroll horizontal" na região `app-content`, não só no `document`.

## Permissões na interface

- Papéis por item de menu e por categoria de Configurações vêm de uma fonte única (`nav-items.ts`, `features/settings/platform/categories.ts`). Não repetir listas de papéis em componentes ou rotas: usar `canSeeNavItem`, `categoriesFor`, `rolesFor` e `RequireRole`.
- Isso é só UX; quem autoriza é o backend.

## Rotas e acesso

- `/login`, `/app/*` (equipe: recepção, nutricionista, admin) e `/me/*` (portal; só reservar a rota e o guard, sem telas na demo).
- Após o login, redirecionar por papel. Os guards de rota são só UX; quem protege é o backend.
- Menu e telas mostram apenas o que o papel pode usar (ver `docs/permissoes.md`).

## Dados

- Uma única camada de API em `lib/api.ts`: anexa o JWT da sessão Supabase, trata 401 (voltar ao login) e 403 (tela de acesso negado).
- supabase-js somente para autenticação. Nenhuma consulta direta a tabelas.
- TanStack Query para estado de servidor; react-hook-form + zod para formulários (anamnese em etapas com rascunho).
- `mocks/` só para telas cujo backend ainda não existe. Remover o mock ao integrar.
- Agenda: profissionais, expediente, almoço, durações por tipo e bloqueios vêm da API (`features/schedule/api.ts`). As consultas também vêm da API (`GET /schedule/appointments`). O front nunca decide disponibilidade: a API valida; a recepção recebe bloqueios só como "Indisponível" (sem motivo).
- Pacientes (`features/patients`): a lista lê `GET /patients` (a API filtra por papel e recorta os campos). Dados clínicos nunca são renderizados para a recepção. Filtros, busca, ordem e página ficam na URL.
- Busca principal (`layouts/admin/PatientSearch.tsx`): combobox no header (nome, telefone, e-mail) sobre `GET /patients/search`, com debounce; ⌘K/Ctrl+K foca. Enquanto não existir a tela do paciente, escolher um resultado abre a lista filtrada por ele.
- Sino (`features/notifications`): consulta `GET /notifications` a cada 30 s (aba visível) e ao voltar para a aba; alertas sonoros/na tela seguem `alertRules.ts` (preferências, horário de silêncio, silêncio clínico). Toasts ficam no canto inferior para não cobrir o sino e a busca do header.
- Só há três tipos de atendimento (1ª consulta, retorno, avaliação antropométrica). Teleconsulta não é tipo.

## Variáveis de ambiente

`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (chave pública). Nunca a `service_role`.