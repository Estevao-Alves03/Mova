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
* `POST /patients` cadastra o paciente **e agenda a 1ª consulta numa única transação**: o horário passa pela mesma validação de disponibilidade da agenda (`schedule_not_configured`, `outside_working_hours`, `lunch`, `blocked`, `off_grid`, `past`, `slot_taken`...), e se falhar **nada é criado**. O objetivo e a observação inicial ficam com a consulta e nunca voltam na resposta. Nutricionista inválido (inexistente, de outra clínica, inativo ou que não é nutricionista) responde **422** apontando `nutritionist_id`.
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
* Lista de pacientes: **Recepção não recebe dados clínicos** (objetivo, protocolo, peso e variação, aderência); a interface omite essas colunas, o filtro por objetivo e o indicador de aderência, e a API deve enviar o schema básico. O Nutricionista vê só os **próprios** pacientes (sem filtro de profissional); Admin e Recepção veem todos e podem filtrar por profissional.
* `GET /patients` lista os pacientes que o papel pode ver: Admin e Recepção, toda a clínica; Nutricionista, só os próprios (`nutritionist_id`). A Recepção recebe um schema **sem a chave `goal`**. A situação (primeira consulta, em acompanhamento, em alerta) é derivada do histórico: sem consulta concluída = primeira consulta; mais de 45 dias desde a última consulta concluída e sem retorno agendado = em alerta.
* **Busca principal** (campo do topo, todos os papéis da equipe): `GET /patients/search?q=` procura por **nome** (sem diferenciar acentos nem maiúsculas), **telefone** (só pelos dígitos, com ou sem máscara) e **e-mail**, com no mínimo 2 caracteres e até 20 resultados. Aplica o **mesmo escopo** da lista (nutricionista: só os próprios; outra clínica e excluídos nunca aparecem) e devolve apenas identificação e contato, sem nenhum dado clínico. Curingas de SQL digitados (`%`, `_`) são tratados como texto.
* A restrição da interface não substitui a autorização no backend. A API deve impedir a operação mesmo que uma requisição seja enviada diretamente.

### Testes obrigatórios

* [x] Nutricionista não consegue criar paciente via `POST /patients` → `403` (`test_patients_api.py`).
* [ ] Nutricionista não consegue editar cadastro via `PATCH /patients/{id}` → `403`.
* [ ] Botão **"Novo Paciente"** não aparece para Nutricionista.
* [x] Recepção consegue criar paciente informando `nutritionist_id` (`test_patients_api.py`).
* [x] Admin consegue criar paciente informando `nutritionist_id` (`test_patients_api.py`).
* [x] API rejeita criação sem `nutritionist_id` (`test_patients_api.py`).
* [x] Falha de horário na criação não deixa paciente nem consulta órfãos (`test_patients_api.py`).
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

`GET /schedule/appointments` lista as consultas reais do período (até 62 dias): recepção e admin veem todas (ou de um profissional); o nutricionista só as próprias (outro profissional = 404). Consultas canceladas não aparecem. Nada clínico (objetivo, observações) vai nesta resposta.

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
* [x] A agenda lista consultas reais, o nutricionista só vê as próprias, cancelada não aparece, sem campos clínicos; paciente criado no formulário aparece na agenda do nutricionista escolhido (`test_agenda_and_patients_list_api.py`).
* [x] A busca principal acha por nome, telefone e e-mail, respeita o escopo por papel e a clínica, não devolve dado clínico e trata curingas e entradas hostis como texto (`test_patient_search_api.py`).
* [x] A lista de pacientes respeita o escopo por papel, a recepção não recebe `goal` e a situação segue o histórico (`test_agenda_and_patients_list_api.py`).
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
* Equipe & Acesso e Unidades & Consultórios são **funcionais** e salvam cada ação na hora (sem Salvar/Descartar no cabeçalho). Toda rota exige `admin` no backend (`require_roles(UserRole.admin)`) e filtra pela clínica do token; o bloqueio da interface é só UX.
* O perfil pessoal continua acessível a todos pelo cartão do usuário na barra lateral.

### Equipe e acesso (`/api/v1/team`, só admin)

* `GET /team` lista a equipe da clínica (nunca pacientes). `POST /team` cria o acesso: nome, e-mail e função (`admin`, `nutritionist`, `receptionist`). `PATCH /team/{id}` altera `full_name`, `role` e `active`; campos desconhecidos (`email`, `clinic_id`, `user_id`...) respondem **422**.
* O acesso nasce com uma **senha temporária** (12 caracteres), devolvida **uma única vez** na resposta da criação; nada a guarda em texto e a listagem nunca a devolve. Não há envio de e-mail. A pessoa entra com ela e pode trocá-la em Meu Perfil.
* A função vem sempre de `memberships`, definida pelo admin; e-mail já cadastrado responde **409** (não se vincula conta existente).
* Nada é excluído: **desativar** (`active=false`) bloqueia o acesso na hora (a sessão já aberta passa a receber 403) e preserva pacientes, consultas e registros; pode ser reativado.
* O admin **não altera a própria função nem desativa a própria conta** (409) e a clínica **nunca fica sem um admin ativo** (409).
* Nutricionista com pacientes ou consultas futuras **não muda de função** (409): é preciso reatribuí-los antes. Desativar é permitido.
* Membro de outra clínica, paciente ou inexistente: **404**.

### Unidades e consultórios (`/api/v1/units`, só admin)

* `GET /units` (com salas, inclusive inativas), `POST /units`, `PATCH /units/{id}`, `POST /units/{id}/rooms`, `PATCH /units/{id}/rooms/{room_id}`. A agenda continua lendo apenas as unidades **ativas** por `GET /schedule/units`.
* Unidade: nome, endereço, telefone e e-mail (o horário de atendimento **não** é da unidade: é de cada nutricionista, em Minha Agenda). Nomes únicos por clínica e, para salas, por unidade (sem diferenciar maiúsculas): duplicado responde **409** apontando o campo.
* Nada é excluído: desativa-se. **Unidade** usada na agenda de algum profissional ou com consultas futuras não é desativada (409); **sala** com consultas futuras também não. Sala nova exige unidade ativa.
* Unidade de outra clínica ou inexistente: **404**.

### Vínculo de nutricionistas às unidades (`/api/v1/units/{id}/members`, só admin)

* O admin decide quais **nutricionistas** atendem em cada unidade (Configurações > Unidades > "Equipe vinculada"). **Criar unidade ou sala não vincula ninguém automaticamente.** Recepção e admin não precisam de vínculo: enxergam todas as unidades.
* `POST /units/{id}/members` (`{"membership_id"}`) vincula: só nutricionista **ativo** da mesma clínica (422 no campo), unidade **ativa** (409), sem duplicar (409). `DELETE /units/{id}/members/{membership_id}` desvincula.
* O vínculo vale de verdade na API: o nutricionista só recebe as unidades vinculadas em `GET /schedule/units` e `PUT .../config` recusa (422) dia de atendimento em unidade não vinculada a ele (também quando o admin edita a agenda dele).
* Não se desvincula quem ainda atende na unidade (dias da agenda) nem quem tem consultas futuras nela (409). Quem já atendia numa unidade antes do vínculo existir foi vinculado automaticamente (migration 0008).

### Testes obrigatórios

* [x] Nutricionista, Recepção, paciente e usuário sem membership recebem `403` (e sem token `401`) em todas as rotas de Equipe e de Unidades, e nada muda (`test_team_api.py`, `test_units_api.py`).
* [x] Admin acessa apenas a própria clínica: lista sem dados de outra clínica e recebe 404 nos recursos alheios (`test_team_api.py`, `test_units_api.py`).
* [x] A senha temporária abre o acesso com a função definida pelo admin, aparece só na criação e nunca na listagem (`test_team_api.py`).
* [x] Desativar bloqueia o acesso imediatamente e preserva o histórico; reativar restaura (`test_team_api.py`).
* [x] Auto-alteração, último admin e nutricionista com pacientes são barrados (`test_team_api.py`).
* [x] Validações apontam o campo; campos protegidos e desconhecidos são recusados (`test_team_api.py`, `test_units_api.py`).
* [x] Unidade em uso na agenda, com consultas futuras ou sala com consultas futuras não são desativadas (`test_units_api.py`).
* [x] Só o admin vincula/desvincula; unidade nova começa sem vínculos; nutricionista só vê e só configura unidades vinculadas; não desvincula quem atende ou tem consultas futuras (`test_unit_members_api.py`).

---

## Notificações do sino

O sino do topo mostra os avisos gerados pelos **eventos ligados nas Preferências de notificação** de cada pessoa. Cada usuário lê e marca apenas os **próprios** avisos (`GET /api/v1/notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`; o membership vem do token). Aviso de outra pessoa ou inexistente responde **404**; paciente e usuário sem membership recebem **403** (o portal do paciente não tem sino).

### Regras

* **Eventos que geram aviso hoje:** `appointment_created` (nova consulta: agendamento avulso e o cadastro "Novo paciente & 1ª consulta"), `appointment_cancelled` (cancelamento **ou** remarcação; o aviso diz qual dos dois) e `daily_summary`. Os demais eventos do catálogo (`appointment_confirmed`, `reevaluation_due`, `appointment_reminder`, `appointment_changed`) ainda não têm gerador: dependem de check-in, avaliações e portal do paciente.
* **Quem recebe:** admin e recepção (toda a clínica) e o **nutricionista da consulta** (só as próprias). Quem fez a ação **não** é avisado do que ele mesmo fez; membro inativo não recebe.
* **Preferência valendo na hora do evento:** só gera aviso quem tem o evento ligado naquele momento. Desligar depois não apaga o que já chegou. O aviso nasce na **mesma transação** da consulta: se o agendamento falhar (horário ocupado, agenda não configurada...), nenhum aviso é criado.
* **Sem dado clínico:** o texto traz só o que a agenda já mostra (paciente, tipo, horário, profissional). Objetivo e observações nunca entram.
* **Resumo diário** (padrão desligado): sem agendador, ele é criado quando a pessoa abre o app depois das 07:30 do fuso da clínica, uma vez por dia, se houver consultas (nutricionista: as dele; admin e recepção: as da clínica).
* **Alertas sonoros e avisos na tela (no navegador):** aviso novo mostra um aviso na tela e, se for consulta nova, toca o som "Novo Paciente Agendado". O nutricionista também recebe, 10 minutos antes de cada consulta dele, o aviso "Consulta em N min" e o som "Consulta Iminente" (admin não, para não tocar por toda a clínica). Os sons só tocam com os alertas sonoros ligados, dentro do horário e dos dias de atendimento (se o horário de silêncio estiver ativo) e, com o "silêncio clínico", nunca durante um atendimento ao vivo do nutricionista (hoje: dentro do horário de uma consulta dele).

### Testes obrigatórios (`test_notifications_api.py`)

* [x] Sem token `401`; paciente e sem membership `403`; toda a equipe lê o próprio sino.
* [x] Nova consulta avisa nutricionista e admin, não quem agendou nem outro nutricionista; admin agendando avisa a recepção.
* [x] Cadastro de paciente também avisa; agendamento que falha não cria aviso.
* [x] Evento desligado não chega; reativar volta a chegar; desligar não apaga o histórico; eventos são independentes.
* [x] Remarcação e cancelamento avisam (com horário antigo/novo e origem); com bloqueio criado, avisa uma vez.
* [x] Ler e marcar (um e todos) só mexe nos próprios avisos; aviso alheio responde 404; clínicas isoladas; tabela com RLS e sem acesso público.
* [x] Resumo diário: desligado por padrão, uma vez por dia depois das 07:30, escopo por papel, ignora canceladas, usa o dia da clínica, sem dado clínico.

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
