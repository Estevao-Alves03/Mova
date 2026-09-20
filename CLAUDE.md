# Mova

Plataforma web de gestão nutricional e acompanhamento clínico, com duas áreas:

- **Administrativa/clínica** (`/app`): recepção, nutricionista e admin.
- **Paciente** (`/me`): acesso somente aos próprios dados. Ainda sem telas e fora da demo.

A entrega de segunda-feira é uma **demo com dados fictícios**. Nunca usar dados reais de pacientes.
Hoje existe uma clínica só, mas toda tabela tem `clinic_id`.

## Stack

- Frontend (`frontend/`): Vite, React, TypeScript, Tailwind CSS (versão instalada pelo `shadcn init`), shadcn/ui, Lucide, React Router, TanStack Query, react-hook-form + zod, Recharts (via chart do shadcn).
- Backend (`backend/`): Python, FastAPI, Pydantic v2, SQLAlchemy 2.0 + psycopg 3.
- Banco e Auth: Supabase (PostgreSQL + Supabase Auth). Migrations somente em `supabase/migrations/` (SQL).
- Deploy: Vercel, dois projetos apontando para este repositório (Root Directory `frontend/` e `backend/`). Ambos devem ter deploy funcionando desde o primeiro dia; o backend expõe `GET /health`.

## Idioma

Interface em pt-BR. Código, tabelas e rotas em inglês.
Na UI: "Pacientes/Clientes" no lado administrativo e "aluno" no portal. No código, sempre `patient`.

## Regras de trabalho

1. Antes de implementar: analisar a estrutura existente, os componentes e os padrões; propor uma solução quando houver dúvida; implementar somente o necessário.
2. Não inventar requisitos nem implementar algo só porque é comum em sistemas parecidos. Se não está definido, perguntar.
3. Não alterar áreas concluídas sem necessidade. Não redesenhar telas.
4. Sem bibliotecas novas, abstrações prematuras, componentes gigantes ou lógica duplicada.
5. Ao terminar uma tarefa: frontend `npm run build` e `tsc --noEmit`; backend `pytest`.

## Segurança (regra central)

- O frontend NÃO é camada de segurança. Toda autorização é validada no FastAPI.
- Auth: Supabase Auth com cadastro público desligado. O front usa supabase-js só para login, logout e sessão. Todo dado passa pelo FastAPI; o front nunca consulta tabelas diretamente.
- O FastAPI valida o JWT (assinatura, `exp`, `aud=authenticated`) e busca o papel na tabela `memberships`. Nunca confiar em `user_metadata`. JWT válido sem membership ativo: 403.
- RLS ligado em todas as tabelas, sem policies, e sem privilégio para `anon` e `authenticated` (defesa em profundidade). O backend acessa o banco por conexão própria.
- `service_role` key e `DATABASE_URL` existem só no backend. Nunca no frontend nem no git.
- Paciente acessa apenas rotas `/me/...`. O `patient_id` vem do token, nunca da URL ou do body.
- Recurso de outro profissional: responder 404 (não 403), para não revelar que existe.
- Toda query filtra pelo `clinic_id` do membership do usuário.
- Não existe perfil super admin no app.

@docs/permissoes.md

## Domínio (resumo)

- Fluxo: cadastro do paciente + agendamento da 1ª consulta, 1ª consulta, anamnese, avaliação, acompanhamento e, depois, ativação do acesso do paciente. O mecanismo de ativação NÃO está definido: não implementar.
- Novo paciente: dados básicos, escolha de profissional/data/horário disponíveis e confirmação. A anamnese não faz parte do cadastro.
- Anamnese: preenchida pelo nutricionista na 1ª consulta, em 8 etapas (dados clínicos, medicamentos e condições, hábitos e rotina, comportamento alimentar, histórico nutricional, objetivos e expectativas, observações clínicas, revisão). Permite avançar, voltar, salvar rascunho, continuar e finalizar. Finalizada = somente leitura.
- Avaliação corporal: separada da anamnese (peso, altura, IMC, % gordura, massas, circunferências, dobras, protocolo, equipamento, observações).
- Histórico = registros individuais de avaliação. Evolução = tendência ao longo do tempo (gráficos, inicial × atual). Não misturar.
- Visão geral e metas: o modelo de metas não está definido. Perguntar antes de criar tabela.

## Escopo da demo

Entra, funcional, nesta ordem:

1. Base: projeto, tokens, layout, navegação e todas as telas em versão estática.
2. Auth e banco: migration aplicada, seed, login, validação de JWT, guards por papel.
3. Pacientes: lista, novo paciente com agendamento, perfil.
4. Agenda: dia, semana e mês, com disponibilidade e conflito de horário.
5. Anamnese: rascunho e finalização.
6. Avaliação corporal, histórico e evolução.
7. Dashboard por papel.

Só visual ou somente leitura (sem lógica): convite de usuário, equipe e acesso, unidades e consultórios.

Funcional (fora da ordem acima, por decisão posterior): **perfil do usuário** (editar dados, foto, trocar senha, 2FA por app autenticador e sessões ativas) e **preferências de notificação** de cada usuário (todos os papéis). Regras em `docs/permissoes.md`.

Fora de escopo: telas do portal do paciente, ativação de conta do paciente, super admin, dados reais, LGPD (consentimento e política), envio de e-mail ou WhatsApp.

Se o tempo apertar, cortar de baixo para cima.

## Desenvolvimento local

Supabase local (Docker), API e frontend:

```
npx supabase start -x studio,imgproxy,postgres-meta,mailpit,realtime,edge-runtime,logflare,vector,supavisor
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env   # preencher com `npx supabase status -o json` e definir SEED_PASSWORD
.venv/bin/python -m scripts.seed
.venv/bin/uvicorn app.main:app --port 8010
.venv/bin/pytest       # exige o Supabase local rodando
cd ../frontend && cp .env.example .env.local && npm install && npm run dev
```

Depois de cada `npx shadcn add` (o CLI ignora o npm e pode usar pnpm), conferir e reparar:

1. Se apareceu `pnpm-lock.yaml`: apagar, remover `node_modules` e rodar `npm install` (senão o React fica duplicado e a tela quebra com "Invalid hook call").
2. Se os componentes importam `cn` de `"cn"` (pacote npm de terceiros): trocar por `@/lib/utils` e rodar `npm uninstall cn`.
3. Reiniciar o `npm run dev` se o `node_modules` foi refeito.

## Economia de contexto

- Ao implementar uma tela, ler apenas `docs/design/telas/<tela>/code.html` e o `screen.png` dela. Nunca todas as telas.
- Estas telas têm o `screen.png` corrompido; usar só o `code.html`: `perfil_do_paciente_anamnese_cl_nica` e `confirma_o_de_cria_o_de_cliente_e_agendamento`.
- Detalhes por camada em `frontend/CLAUDE.md` e `backend/CLAUDE.md`.