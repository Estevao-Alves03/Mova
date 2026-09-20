# Permissões

Este documento define as permissões e restrições de acesso dos perfis **Recepção**, **Nutricionista** e **Admin** nos módulos de **Pacientes** e **Agenda**.

---

## Pacientes

### Cadastro e edição

| Ação                                 | Recepção |     Nutricionista | Admin |
| ------------------------------------ | -------: | ----------------: | ----: |
| Criar paciente                       |        ✅ |                 ❌ |     ✅ |
| Visualizar paciente                  |        ✅ | ✅ Somente leitura |     ✅ |
| Editar cadastro                      |        ✅ |                 ❌ |     ✅ |
| Reatribuir nutricionista             |        ❌ |                 ❌ |     ✅ |
| Registrar anamnese                   |        ❌ |                 ✅ |     ✅ |
| Registrar avaliação clínica/corporal |        ❌ |                 ✅ |     ✅ |

### Regras

* Somente **Recepção** e **Admin** podem criar ou editar o cadastro de pacientes.
* O **Nutricionista não cria pacientes**.
* O Nutricionista pode visualizar o cadastro dos pacientes sob sua responsabilidade em **somente leitura**.
* O Nutricionista é responsável pelo registro dos dados clínicos, incluindo **anamnese** e **avaliações**.
* Durante a criação do paciente, a **Recepção ou o Admin deve selecionar o nutricionista responsável**.
* `patients.nutritionist_id` é **obrigatório na criação** do paciente.
* A obrigatoriedade de `patients.nutritionist_id` deve ser validada na **API**, não apenas na interface.
* Somente o **Admin** pode alterar/reatribuir o `patients.nutritionist_id` após a criação.
* Para o Nutricionista:

  * `POST /patients` deve retornar **403 Forbidden**.
  * `PATCH /patients/{id}` deve retornar **403 Forbidden**.
  * A ação/botão **"Novo Paciente"** não deve ser exibida na interface.
* A restrição da interface não substitui a autorização no backend. A API deve impedir a operação mesmo que uma requisição seja enviada diretamente.

### Testes obrigatórios

* [ ] Nutricionista não consegue criar paciente via `POST /patients` → `403`.
* [ ] Nutricionista não consegue editar cadastro via `PATCH /patients/{id}` → `403`.
* [ ] Botão **"Novo Paciente"** não aparece para Nutricionista.
* [ ] Recepção consegue criar paciente informando `nutritionist_id`.
* [ ] Admin consegue criar paciente informando `nutritionist_id`.
* [ ] API rejeita criação sem `nutritionist_id`.
* [ ] Nutricionista consegue visualizar os pacientes permitidos em somente leitura.
* [ ] Nutricionista consegue registrar anamnese.
* [ ] Nutricionista consegue registrar avaliação.
* [ ] Nutricionista não consegue alterar o `nutritionist_id`.
* [ ] Admin consegue reatribuir o paciente para outro nutricionista.

---

## Agenda

### Permissões

| Ação                               | Recepção |    Nutricionista | Admin |
| ---------------------------------- | -------: | ---------------: | ----: |
| Visualizar agenda                  |        ✅ | ✅ Própria agenda |     ✅ |
| Criar agendamento                  |        ✅ |                ❌ |     ✅ |
| Agendar para qualquer profissional |        ✅ |                ❌ |     ✅ |
| Remarcar consulta                  |        ✅ |                ❌ |     ✅ |
| Alterar status da própria consulta |        ❌ |                ✅ |     ✅ |

### Regras

* **Recepção** e **Admin** podem criar agendamentos para qualquer profissional.
* O **Nutricionista** visualiza somente a própria agenda.
* O Nutricionista **não cria agendamentos**.
* O Nutricionista **não remarca consultas**.
* O Nutricionista pode alterar o status das **próprias consultas**.
* Os status que o Nutricionista pode registrar são:

  * `Em atendimento`
  * `Concluído`
* O backend deve validar que o Nutricionista só altere o status de consultas vinculadas a ele.
* A restrição deve ser aplicada na **API** e não somente na interface.
* Para o Nutricionista, ações de criação e remarcação não devem ser exibidas na interface.

### Disponibilidade e configuração do nutricionista

A agenda do nutricionista é configurada por ele mesmo (cartão **Minha Agenda** no perfil). A recepção só **lê** essa configuração e agenda dentro dela.

| Ação                                                  | Recepção |          Nutricionista |              Admin |
| ----------------------------------------------------- | -------: | ---------------------: | -----------------: |
| Ler configuração/disponibilidade                      |        ✅ |        ✅ Própria       |                  ✅ |
| Editar durações, passo, almoço, dias e horários       |        ❌ |        ✅ Própria       | ✅ (só pela API)    |
| Criar/remover folgas e bloqueios                      |        ❌ |        ✅ Própria       | ✅ (só pela API)    |
| Ler a lista de bloqueios **com a nota pessoal**       |        ❌ |        ✅ Própria       |                  ✅ |
| Ver períodos indisponíveis (sem motivo: "Indisponível") |        ✅ |        ✅ Própria       |                  ✅ |

Regras:

* Três tipos de atendimento, cada um com **duração própria** definida pelo nutricionista: `first_consultation` (1ª consulta), `return_consultation` (retorno) e `assessment` (avaliação antropométrica). Teleconsulta **não é um tipo**; será uma modalidade futura.
* Uma faixa de atendimento por dia da semana e um almoço padrão. Horários de início a cada **15, 30 ou 60 min** (padrão 30), contados a partir do início do expediente. Horários no fuso da clínica (`clinics.timezone`).
* **Sem configuração completa** (as três durações e ao menos um dia) a recepção **não consegue agendar**: a API responde `409 schedule_not_configured` e o banco também recusa.
* Quem valida é a API (e, como última barreira, uma trava no banco): o front só apresenta. Erros de disponibilidade: `409` (`schedule_not_configured`, `slot_taken`, `room_taken`) ou `422` (`outside_working_hours`, `lunch`, `blocked`, `off_grid`, `past`).
* **Alterar a configuração nunca cria, cancela ou altera consultas.** Consultas existentes mantêm o horário e o `ends_at` originais; as que ficam fora da disponibilidade são identificadas pelo motor (`GET .../outside-availability` e o aviso ao salvar) para a recepção remarcar. Remarcar usa a duração **atual** do tipo.
* O motivo (nota) de um bloqueio pessoal **nunca** é enviado à recepção: ela recebe apenas `starts_at`, `ends_at` e o rótulo "Indisponível".
* Cancelamento pela recepção: cancelado pelo **cliente** libera o horário; cancelado por motivo **interno** libera, a menos que a recepção escolha manter indisponível, o que cria um bloqueio de sistema (`cancellation_hold`) vinculado à consulta, sem dados pessoais. Ainda **não há** regras de justificativa/motivo de cancelamento e remarcação definidas: nada foi inventado (o cancelamento só carrega a origem `client`/`internal`).
* Nutricionista consultando outro profissional recebe **404**.

### Testes obrigatórios

* [x] Nutricionista visualiza apenas a própria agenda (`test_schedule_api.py`; a lista de profissionais e todas as rotas por profissional).
* [x] Nutricionista não consegue criar agendamento (`test_schedule_api.py`).
* [x] Nutricionista não consegue remarcar nem cancelar consulta (`test_schedule_api.py`).
* [ ] Nutricionista consegue alterar o status de sua própria consulta para `Em atendimento`. *(ainda não implementado)*
* [ ] Nutricionista consegue alterar o status de sua própria consulta para `Concluído`. *(ainda não implementado)*
* [ ] Nutricionista não consegue alterar o status de consulta de outro profissional. *(ainda não implementado)*
* [x] Recepção consegue agendar para qualquer profissional (`test_schedule_api.py`).
* [x] Admin consegue agendar para qualquer profissional (`test_schedule_api.py`).
* [x] Recepção consegue remarcar consultas (`test_schedule_api.py`).
* [x] Admin consegue remarcar consultas (`test_schedule_api.py`).
* [x] Recepção nunca escreve disponibilidade, bloqueios nem configurações (403 em todas as rotas de escrita, também para ids inexistentes) (`test_schedule_api.py`).
* [x] Nutricionista não edita a agenda de outro profissional (404) e o admin não alcança outra clínica (`test_schedule_api.py`).
* [x] Sem configuração completa a API bloqueia o agendamento (`schedule_not_configured`) (`test_schedule_api.py`, `test_schedule_trigger.py`).
* [x] Duração definida por tipo; o horário oferecido e o `ends_at` seguem o tipo (`test_schedule_api.py`).
* [x] Mudar configuração, bloqueios ou durações não altera consultas existentes (linhas idênticas, inclusive `updated_at`) (`test_schedule_api.py`).
* [x] Motivos de bloqueios pessoais nunca são retornados à recepção (respostas e mensagens de erro) (`test_schedule_api.py`).
* [x] Cancelamento pelo cliente libera o horário; interno + manter indisponível cria o bloqueio vinculado, sem motivo (`test_schedule_api.py`).
* [x] A trava do banco recusa horário fora do expediente/almoço/bloqueio/duração errada mesmo via SQL e concorda com o motor em todo horário de 15 em 15 min (`test_schedule_trigger.py`, `test_availability_engine.py`).

---

## Perfil do usuário

O perfil é sempre o **do próprio usuário autenticado**: nenhuma rota recebe `user_id` ou `membership_id` na URL ou no corpo.

### Regras

* Todos os papéis da equipe (Recepção, Nutricionista, Admin) veem e editam o próprio perfil.
* Editáveis: nome completo, telefone, foto. Campos profissionais (CRN, estado do conselho, apresentação) apenas para `nutritionist` e `admin`; para Recepção a API responde **422**.
* Nunca editáveis por esta rota: `role`, `clinic_id`, `user_id`, `active`, `avatar_path`, `email`, `specialty` (campos desconhecidos são rejeitados com 422).
* O CRN e o estado do conselho precisam pertencer à mesma região (ex.: `CRN-3` com `São Paulo (CRN-3)`).
* Foto: só JPG, PNG ou WebP (pelo conteúdo, não pelo `Content-Type`), até 2 MB, em bucket privado; o front recebe URL assinada de 1 hora.
* O resumo da conta (pacientes, consultas concluídas) existe só para `nutritionist` e conta apenas os **próprios** pacientes e consultas.
* Sessões: cada usuário lista e encerra apenas as próprias. Sessão de outro usuário ou inexistente responde **404**; a sessão atual não pode ser encerrada por esta rota (usar sair da conta).
* Sessão encerrada perde o acesso à API imediatamente (não espera o token expirar).
* Com 2FA verificado, token de nível `aal1` (só senha) responde **401**; só `aal2` acessa.
* Trocar senha e gerenciar o 2FA passam pelo Supabase Auth (supabase-js); a senha atual é conferida antes.

### Testes obrigatórios (pytest, `backend/app/tests/`)

* [x] Sem token, token inválido, expirado, de outra audiência/emissor, sem `exp`, `alg=none` ou HS256 forjado: `401` (`test_auth.py`).
* [x] JWT válido sem membership ativo: `403` (`test_auth.py`).
* [x] O papel nunca vem do token (`test_auth.py`).
* [x] Sessão revogada perde acesso na hora (`test_auth.py`).
* [x] Com 2FA ativo, token só de senha recebe `401`; com o segundo fator, `200` (`test_auth.py`).
* [x] Campos protegidos não podem ser alterados via PATCH (`test_profile.py`).
* [x] Recepção não define CRN, estado nem apresentação (`test_profile.py`).
* [x] Um usuário nunca altera nem enxerga o perfil de outro (`test_profile.py`).
* [x] Resumo conta só os pacientes e consultas do próprio nutricionista (`test_profile.py`).
* [x] Validações de nome, telefone, CRN, estado e apresentação apontam o campo (`test_profile.py`).
* [x] Foto: SVG, arquivo com `Content-Type` falso, vazio e acima de 2 MB são recusados; bucket privado; substituir remove a anterior (`test_avatar.py`).
* [x] Sessões: só as próprias; sessão de outro usuário responde 404; a atual não é encerrada; encerrar as outras preserva a atual e o outro usuário (`test_sessions.py`).

---

## Configurações

O item "Configurações" aparece para todo usuário da equipe, mas cada **categoria** tem os próprios papéis (fonte única no frontend: `features/settings/platform/categories.ts`; menu, lista de categorias, rotas e redirecionamento inicial leem dela).

| Categoria | Admin | Nutricionista | Recepção | Paciente (`/me`) |
|---|:-:|:-:|:-:|:-:|
| Equipe & Acesso (inclui convidar usuário) | ✅ | ❌ | ❌ | ❌ |
| Unidades & Consultórios | ✅ | ❌ | ❌ | ❌ |
| **Notificações** (as próprias preferências) | ✅ | ✅ | ✅ | ✅ |

### Regras

* Somente o **Admin** acessa Equipe & Acesso e Unidades & Consultórios. Nutricionista e Recepção veem apenas a categoria Notificações; ao abrir a URL de uma categoria administrativa, a interface mostra "Acesso restrito".
* Equipe & Acesso e Unidades & Consultórios são **somente visuais** na demo (`docs/produto.md` §12): sem persistência, sem envio de convite por e-mail.
* O perfil pessoal continua acessível a todos pelo cartão do usuário na barra lateral.
* Quando existirem as APIs administrativas, toda rota exigirá `admin` no backend (`require_roles(UserRole.admin)`); o bloqueio da interface é só UX.

### Testes obrigatórios (quando existirem as APIs administrativas)

* [ ] Nutricionista e Recepção recebem `403` nas rotas de Equipe & Acesso e de Unidades & Consultórios.
* [ ] Admin acessa apenas as configurações da própria clínica.

---

## Preferências de notificação

Cada usuário configura **as próprias** notificações. Não há id de usuário na rota: o membership vem do token.

### Regras

* Equipe (Admin, Nutricionista, Recepção): `GET/PUT /api/v1/notification-preferences`. Paciente: `GET/PUT /api/v1/me/notification-preferences` (o paciente só acessa rotas `/me`). Cada rota responde `403` para o outro grupo.
* O catálogo do que pode ser configurado depende do **papel** (eventos e alertas sonoros); o backend rejeita com `422` qualquer evento ou alerta que o papel não tenha, som fora das opções do alerta, volume fora de 0–100, horário fora de `HH:MM` e campos desconhecidos (`membership_id`, `role`, `clinic_id`...).
* "Silêncio durante o atendimento" existe só para Nutricionista e Admin; paciente não tem alertas sonoros.
* O único canal é **"No sistema"**. E-mail e WhatsApp entram quando existir o envio (fora de escopo).
* Uma linha por membership (`notification_preferences`), removida junto com o membership. RLS ligado, sem policies e sem privilégio para `anon`/`authenticated`.
* O PUT é parcial: o que não for enviado mantém o valor atual; o que nunca foi gravado vale o padrão do papel.

### Testes obrigatórios (pytest, `backend/app/tests/test_notification_preferences.py`)

* [x] Sem token: `401`; JWT sem membership ativo: `403`.
* [x] Catálogo e padrões por papel (admin, recepção, nutricionista, paciente).
* [x] Gravar persiste; PUT parcial preserva o restante; restaurar padrões; PUT idempotente com uma única linha.
* [x] Validações apontam o campo (evento/som de outro papel, volume, horário, dias, tipo inválido); atualização recusada não grava nada.
* [x] Não é possível apontar outro membership nem alterar identidade (`membership_id`, `role`, `clinic_id`, `user_id`, `id`).
* [x] Um usuário nunca vê nem altera as preferências de outro.
* [x] Rotas de equipe e de paciente separadas (`403` cruzado); paciente configura pela rota `/me`.
* [x] Remover o membership remove as preferências; tabela com RLS e sem acesso para `anon`/`authenticated`.
* [x] CORS permite todos os métodos usados pela API (incluindo `PUT`) e recusa origens desconhecidas (`test_cors.py`).
