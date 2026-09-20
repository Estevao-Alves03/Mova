# Mova — Documento de Produto

## 1. Visão do produto

O **Mova** é uma plataforma web de gestão nutricional e acompanhamento clínico.

O sistema centraliza a operação da clínica em um único ambiente, permitindo administrar pacientes, profissionais, agendamentos e registros clínicos ao longo do acompanhamento nutricional.

O produto possui duas áreas distintas:

* **Área administrativa/clínica (`/app`)** — utilizada pela equipe da clínica.
* **Portal do paciente (`/me`)** — destinado ao acesso do paciente aos próprios dados.

A demo atual será utilizada com **dados exclusivamente fictícios**.

---

## 2. Objetivo

O objetivo do Mova é organizar o fluxo de atendimento nutricional desde o cadastro e primeiro agendamento até o acompanhamento clínico.

O sistema deve permitir que a equipe:

* cadastre pacientes;
* associe cada paciente a um nutricionista responsável;
* organize os agendamentos;
* registre a anamnese;
* registre avaliações corporais;
* consulte o histórico das avaliações;
* acompanhe a evolução do paciente ao longo do tempo;
* visualize informações operacionais relevantes por meio de dashboards.

O sistema deve separar claramente:

* **dados cadastrais do paciente**;
* **dados clínicos**;
* **agenda e atendimento**;
* **histórico de avaliações**;
* **evolução clínica**.

---

## 3. Usuários do sistema

O Mova possui quatro papéis:

### 3.1 Recepção

Responsável principalmente pela operação administrativa.

Pode:

* cadastrar pacientes;
* editar dados cadastrais;
* selecionar o nutricionista responsável durante o cadastro;
* criar agendamentos;
* agendar pacientes para qualquer profissional;
* remarcar consultas;
* visualizar pacientes e informações permitidas;
* visualizar a agenda.

A recepção não registra dados clínicos de pacientes.

---

### 3.2 Nutricionista

Responsável pelo acompanhamento clínico dos pacientes sob sua responsabilidade.

Pode:

* visualizar seus pacientes;
* consultar o cadastro do paciente em modo somente leitura;
* visualizar sua própria agenda;
* alterar o status de suas próprias consultas;
* registrar anamnese;
* registrar avaliação corporal;
* consultar histórico de avaliações;
* acompanhar a evolução clínica.

O nutricionista:

* não cria pacientes;
* não edita o cadastro do paciente;
* não altera o nutricionista responsável;
* não cria agendamentos;
* não remarca consultas;
* não acessa pacientes de outro nutricionista.

---

### 3.3 Admin

Possui as permissões administrativas da clínica.

Pode:

* cadastrar pacientes;
* editar dados cadastrais;
* selecionar o nutricionista responsável;
* reatribuir pacientes entre nutricionistas;
* criar agendamentos;
* agendar para qualquer profissional;
* remarcar consultas;
* registrar dados clínicos;
* consultar pacientes e suas informações;
* administrar as funcionalidades permitidas ao papel administrativo.

Não existe um perfil de **super admin** no produto.

---

### 3.4 Paciente

O paciente possui uma área própria do sistema.

O portal será acessado por `/me` e deverá permitir ao paciente visualizar somente seus próprios dados.

A implementação das telas do portal está **fora da demo atual**.

O mecanismo de ativação da conta do paciente ainda não foi definido e não deve ser implementado.

---

# 4. Fluxo principal do produto

O fluxo conceitual do Mova é:

```text
Cadastro do paciente
        ↓
Agendamento da primeira consulta
        ↓
Primeira consulta
        ↓
Anamnese
        ↓
Avaliação corporal
        ↓
Acompanhamento
        ↓
Novas avaliações
        ↓
Histórico + Evolução
        ↓
Possível ativação do acesso do paciente
```

O cadastro do paciente e a anamnese são processos distintos.

A anamnese **não faz parte do cadastro do paciente**.

---

# 5. Pacientes

O cadastro representa as informações básicas e administrativas do paciente.

Entre os dados cadastrais estão:

* nome completo;
* e-mail;
* telefone;
* data de nascimento;
* sexo;
* nutricionista responsável.

O nutricionista responsável é obrigatório na criação do paciente.

A definição do profissional responsável acontece durante o cadastro.

Depois da criação:

* Recepção não pode alterar o nutricionista responsável;
* Nutricionista não pode alterar o nutricionista responsável;
* somente Admin pode realizar a reatribuição.

Os dados clínicos não devem ser misturados ao cadastro básico.

---

# 6. Agenda

A agenda organiza os atendimentos da clínica.

Ela deve permitir visualização em:

* dia;
* semana;
* mês.

Os horários disponíveis de um profissional são determinados pela sua disponibilidade cadastrada e pelos agendamentos existentes.

Um horário ocupado por um agendamento ativo não pode ser utilizado novamente para o mesmo profissional.

Agendamentos cancelados liberam o horário.

Também não deve existir sobreposição de agendamentos no mesmo consultório.

### Responsabilidades

**Recepção e Admin:**

* criar agendamentos;
* escolher o profissional;
* escolher paciente;
* escolher unidade;
* escolher horário;
* remarcar consultas.

**Nutricionista:**

* visualizar somente sua agenda;
* não criar agendamentos;
* não remarcar consultas;
* alterar o status de suas próprias consultas.

Os status que o nutricionista pode registrar são:

* Em atendimento;
* Concluído.

---

# 7. Anamnese

A anamnese é um registro clínico realizado pelo nutricionista durante o acompanhamento inicial.

Ela possui oito etapas:

1. Dados clínicos
2. Medicamentos e condições
3. Hábitos e rotina
4. Comportamento alimentar
5. Histórico nutricional
6. Objetivos e expectativas
7. Observações clínicas
8. Revisão

A anamnese deve permitir:

* avançar entre etapas;
* voltar para etapas anteriores;
* salvar rascunho;
* continuar posteriormente;
* revisar os dados;
* finalizar o registro.

Enquanto estiver em `draft`, a anamnese pode ser editada.

Depois de finalizada, torna-se somente leitura.

A etapa de revisão faz parte da interface, mas não representa uma etapa independente de dados armazenados.

---

# 8. Avaliação corporal

A avaliação corporal é independente da anamnese.

Ela representa uma medição realizada em determinado momento do acompanhamento.

Pode conter:

* peso;
* altura;
* IMC;
* percentual de gordura;
* massa de gordura;
* massa muscular;
* massa magra;
* circunferências;
* dobras cutâneas;
* protocolo utilizado;
* equipamento utilizado;
* observações.

Os valores calculados devem ser obtidos a partir dos dados registrados na avaliação.

O sistema não deve assumir fórmulas clínicas sem uma referência validada.

O protótipo considera o protocolo de Pollock de 7 dobras, mas a fórmula definitiva precisa ser validada antes da implementação.

Sexo e data de nascimento do paciente são necessários para os cálculos que dependem dessas informações.

---

# 9. Histórico

O histórico representa os registros individuais de avaliação do paciente.

Cada avaliação corresponde a um momento específico.

Exemplo conceitual:

```text
Avaliação 01
10/01/2026
Peso: 82 kg

Avaliação 02
10/02/2026
Peso: 80 kg

Avaliação 03
10/03/2026
Peso: 78 kg
```

O histórico deve permitir consultar cada registro individualmente.

---

# 10. Evolução

Evolução é diferente de histórico.

Enquanto o histórico apresenta os registros individuais, a evolução apresenta a **tendência dos dados ao longo do tempo**.

Pode utilizar:

* gráficos;
* comparação entre avaliação inicial e atual;
* variações de peso;
* variações de composição corporal;
* outros indicadores disponíveis nas avaliações.

Conceitualmente:

```text
Histórico = registros individuais

Evolução = interpretação temporal desses registros
```

A evolução é calculada a partir das avaliações existentes e não possui uma tabela própria de evolução.

---

# 11. Dashboard

O dashboard apresenta informações resumidas e relevantes para o papel do usuário.

A informação exibida deve ser objetiva e adequada à função do usuário.

O dashboard não deve simplesmente reproduzir todos os dados existentes nos demais módulos.

A implementação definitiva dos indicadores depende das regras de cada papel e dos dados disponíveis.

---

# 12. Configurações

Existem funcionalidades administrativas relacionadas à configuração da clínica e do usuário.

Na demo atual, algumas dessas funcionalidades serão apenas visuais ou somente leitura.

Incluem:

* convite de usuários;
* configurações da plataforma;
* unidades e consultórios.

Não devem receber regras complexas de negócio enquanto não estiverem definidas.

As **preferências de notificação** de cada usuário também são funcionais (ver abaixo). Equipe e acesso, unidades e consultórios continuam somente visuais e restritos ao Admin.

O **perfil do usuário** é funcional. Cada usuário da equipe pode:

* editar nome, telefone e, quando profissional, CRN, estado do conselho e apresentação;
* enviar ou remover a foto (JPG, PNG ou WebP, até 2 MB);
* trocar a própria senha;
* ativar ou reconfigurar o 2FA por app autenticador (TOTP);
* ver e encerrar as próprias sessões ativas;
* sair da conta.

O e-mail de login não é editável. Usuário com 2FA ativo só acessa a API com o segundo fator confirmado.

Cada usuário (Admin, Nutricionista, Recepção e Paciente) configura as **próprias** notificações: quais eventos deseja receber, alertas sonoros (som e volume), silêncio durante o atendimento (só quem atende) e horário de silêncio. O que aparece depende do papel. O canal disponível é "No sistema"; e-mail e WhatsApp dependem de envio, que está fora de escopo.

---

# 13. Relação entre os principais conceitos

### Paciente × Usuário

Um paciente é uma pessoa cadastrada na clínica.

O paciente pode futuramente possuir uma conta de acesso ao portal, mas o mecanismo de ativação ainda não está definido.

Portanto:

```text
Paciente
   │
   └── pode possuir uma conta de usuário
```

A existência do cadastro do paciente não significa que o acesso ao portal esteja ativo.

---

### Cadastro × Dados clínicos

O cadastro contém informações administrativas e básicas do paciente.

Os dados clínicos são registrados em estruturas próprias.

```text
Paciente
├── Dados cadastrais
├── Agendamentos
├── Anamnese
└── Avaliações
```

---

### Anamnese × Avaliação

São registros diferentes.

**Anamnese:**
informações clínicas, hábitos, histórico, comportamento, objetivos e observações.

**Avaliação:**
medições corporais realizadas durante o acompanhamento.

Não devem ser transformadas em um único registro.

---

### Histórico × Evolução

**Histórico** mostra avaliações individuais.

**Evolução** mostra a tendência desses dados ao longo do tempo.

A evolução é derivada das avaliações.

---

# 14. Estrutura conceitual dos módulos

```text
Mova
│
├── Área Clínica / Administrativa
│   │
│   ├── Dashboard
│   ├── Pacientes / Clientes
│   │   ├── Cadastro
│   │   ├── Perfil
│   │   ├── Anamnese
│   │   ├── Avaliações
│   │   ├── Histórico
│   │   └── Evolução
│   │
│   ├── Agenda
│   │   ├── Dia
│   │   ├── Semana
│   │   └── Mês
│   │
│   └── Configurações
│
└── Portal do Paciente
    └── /me
```

---

# 15. Clínica, unidade e consultório

O produto considera uma estrutura em que uma clínica pode possuir:

* unidades;
* consultórios;
* profissionais;
* pacientes.

Embora a demo atual utilize uma única clínica, o domínio mantém `clinic_id` para que os dados permaneçam associados à clínica correspondente.

Os agendamentos podem estar associados a:

* paciente;
* profissional;
* unidade;
* consultório;
* horário;
* status.

---

# 16. Estados importantes

## Anamnese

```text
draft
  ↓
finalized
```

### Draft

Registro ainda em construção.

Pode ser salvo e editado posteriormente.

### Finalized

Registro concluído.

Não deve mais ser editado.

---

## Agendamento

Os agendamentos possuem estados definidos pelo sistema, incluindo:

* scheduled;
* confirmed;
* completed;
* cancelled;
* no_show.

A interface deve apresentar esses estados em português.

---

# 17. Princípios funcionais

O Mova deve seguir alguns princípios de produto:

### Separação de responsabilidades

Cada perfil deve possuir somente as ações necessárias à sua função.

### Dados clínicos separados do cadastro

Informações clínicas não devem ser tratadas como simples dados administrativos.

### Histórico preservado

Avaliações representam registros realizados em momentos específicos e devem permanecer disponíveis para consulta.

### Evolução derivada

A evolução deve ser construída a partir dos registros existentes, evitando duplicação desnecessária dos dados.

### Segurança por responsabilidade

O acesso aos dados deve respeitar a clínica e o profissional responsável pelo paciente.

### Não assumir regras clínicas

Quando uma regra clínica, fórmula ou comportamento não estiver definido, deve ser validado antes da implementação.

---

# 18. Escopo da demo

A demo deve contemplar, nesta ordem:

1. Base visual do produto.
2. Autenticação.
3. Banco de dados.
4. Controle de acesso por papel.
5. Pacientes.
6. Cadastro de paciente com agendamento.
7. Perfil do paciente.
8. Agenda.
9. Anamnese.
10. Avaliação corporal.
11. Histórico.
12. Evolução.
13. Dashboard por papel.

As funcionalidades abaixo podem permanecer apenas visuais ou somente leitura:

* convite de usuários;
* configurações da plataforma;
* unidades e consultórios.

---

# 19. Fora de escopo

Não fazem parte da demo atual:

* telas do portal do paciente;
* mecanismo de ativação da conta do paciente;
* super admin;
* dados reais de pacientes;
* implementação de LGPD;
* consentimento;
* política de privacidade;
* envio de e-mail;
* envio de WhatsApp;
* funcionalidades não definidas neste documento.

---

# 20. Regras ainda não definidas

Quando uma funcionalidade depender de uma decisão que ainda não foi definida, **não assumir um comportamento por convenção**.

Alguns exemplos atuais:

* mecanismo de ativação da conta do paciente;
* modelo de metas;
* fórmula definitiva dos cálculos corporais;
* regras de justificativa (motivos e obrigatoriedade) para cancelar ou remarcar consultas;
* funcionalidades futuras do portal do paciente;
* regras detalhadas de indicadores dos dashboards.

Nesses casos, a decisão deve ser definida antes da implementação.

---

# 21. Fonte de verdade

Este documento descreve **o produto e seu comportamento funcional**.

A responsabilidade dos demais documentos é:

* `CLAUDE.md` → regras gerais de desenvolvimento e execução do projeto;
* `docs/produto.md` → visão, conceitos e funcionamento do produto;
* `docs/permissoes.md` → permissões detalhadas por papel;
* `docs/design/DESIGN.md` → identidade visual e padrões de interface;
* `supabase/migrations/` → estrutura persistida do banco;
* `frontend/CLAUDE.md` → regras específicas do frontend;
* `backend/CLAUDE.md` → regras específicas do backend.

Quando uma decisão de produto estiver definida aqui, ela deve ser respeitada durante a implementação.

Quando algo não estiver definido, não deve ser inventado.
