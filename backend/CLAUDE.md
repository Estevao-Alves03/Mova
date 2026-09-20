# Backend (FastAPI)

## Estrutura de `app/`

- `main.py`: app, CORS, routers, `GET /health`.
- `core/`: `config.py` (env), `security.py` (validação do JWT), `deps.py` (dependências), `scoping.py` (escopo de pacientes por papel).
- `db/`: engine e sessão.
- `modules/<dominio>/`: `router.py`, `schemas.py`, `service.py`, `models.py`. Domínios: `auth`, `patients`, `schedule`, `anamnesis`, `assessments`, `dashboard`, `settings`.
- `tests/`.
- Rotas sob `/api/v1`. Rotas do paciente sob `/api/v1/me/...`.

O router só recebe e responde. Regras e consultas ficam no `service`.
O schema do banco é definido em `supabase/migrations/`; os models SQLAlchemy apenas o espelham. Não criar tabelas por fora das migrations.

## Autenticação e autorização

- `core/security.py`: valida o JWT do Supabase com PyJWT (assinatura, `exp`, `aud=authenticated`, `sub`). Preferir a validação por JWKS do projeto; usar o segredo HS256 apenas se o projeto ainda usar a chave legada.
- `core/deps.py`:
  - `get_current_user`: 401 se não houver token válido.
  - `get_membership`: carrega o membership ativo em `memberships`; 403 se não existir.
  - `require_roles(...)`: 403 para papel não permitido.
- `core/scoping.py`: único lugar que aplica o escopo de pacientes (admin e recepção: toda a clínica; nutricionista: `nutritionist_id` = seu membership; paciente: `user_id` do token).
- Sempre filtrar por `clinic_id` do membership. Regras completas em `docs/permissoes.md`.

## Regras de domínio

- Recepção usa schemas sem campos clínicos (`PatientBasic`); rotas clínicas exigem `admin` ou `nutritionist`.
- Agenda (`modules/schedule`): o motor puro `availability.py` decide tudo (faixa do dia − almoço − bloqueios − consultas ativas). O nutricionista configura a própria agenda: passo de início (15/30/60), almoço, uma faixa por dia e **duração por tipo** (`first_consultation`, `return_consultation`, `assessment`). Sem as três durações e ao menos um dia, ninguém agenda (`409 schedule_not_configured`). Nunca decidir disponibilidade no front.
- A recepção só lê configuração/disponibilidade; toda rota de escrita de configuração e bloqueios é `Editors` (admin, nutricionista). A lista de bloqueios (com nota pessoal) também; a recepção usa `/unavailable-periods` (sem motivo). Nunca devolver `reason` de bloqueio a quem só agenda.
- Salvar configuração ou bloqueios **não altera consultas**; as que ficam fora da disponibilidade só são apontadas (`outside_availability`). Remarcar usa a duração atual; consultas não remarcadas mantêm o `ends_at`.
- Cancelar carrega apenas a origem (`client`/`internal`) e `keep_slot_unavailable` (só interno), que cria um `cancellation_hold` vinculado, sem motivo. Não inventar regras de justificativa.
- A trava `enforce_appointment_availability` (SQLSTATE `AV001`) no banco repete o motor para consultas ativas novas/movidas; o motor e a trava têm teste de paridade. Mudou uma regra? Mude nos dois.
- Conflito de horário é garantido pelo banco (exclusion constraints, `23P01`); tratar o erro e devolver 409 (`slot_taken`/`room_taken`).
- Datas em UTC no banco e ISO 8601 na API; o front converte para America/Sao_Paulo.
- Anamnese: `draft` editável; `finalized` somente leitura. Um rascunho por paciente.
- Avaliação corporal: cálculos (IMC, % gordura, massas) ficam isolados em `modules/assessments/calculations.py`, com testes de valores conhecidos. O protótipo usa Pollock 7 dobras. NÃO implementar as fórmulas de memória: pedir a referência validada por um nutricionista antes. Sexo e data de nascimento do paciente são obrigatórios para calcular.
- Evolução é calculada a partir das avaliações; não tem tabela própria.

## Banco

- Conexão via `DATABASE_URL` (pooler do Supabase). Se usar o pooler em modo transaction, desativar prepared statements no psycopg (`prepare_threshold=None`).
- Nunca expor `DATABASE_URL` nem a `service_role` em logs ou respostas.

## Seed (primeira tarefa depois da migration)

Criar `scripts/seed.py`, idempotente, usando a API admin do Supabase para criar usuários e depois os registros nas tabelas:

- 1 clínica, 1 ou 2 unidades com consultórios.
- 1 admin, 1 recepção, 2 nutricionistas e 1 usuário paciente ligado a um paciente.
- Pacientes fictícios distribuídos entre os dois nutricionistas, com agenda configurada (durações por tipo, almoço, faixas) e agendamentos futuros só em horários válidos.
- Senhas vindas de variáveis de ambiente, nunca commitadas.

## Testes

`pytest`. Os testes de `docs/permissoes.md` são obrigatórios e devem passar antes de considerar uma rota pronta.

## Variáveis de ambiente

`DATABASE_URL`, `SUPABASE_URL`, `CORS_ORIGINS`, e `SUPABASE_SERVICE_ROLE_KEY` (só se a API admin do Supabase for usada). Ler tudo via `core/config.py`.