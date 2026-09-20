-- Mova: esquema inicial
--
-- Segurança: RLS ligado em todas as tabelas SEM policies e sem privilégio para
-- anon/authenticated. O acesso é feito somente pelo backend (FastAPI), que conecta
-- com sua própria credencial. Autorização (papel, clínica, propriedade do dado)
-- é responsabilidade do FastAPI.
--
-- Multi-clínica: toda tabela tem clinic_id. O backend deve SEMPRE filtrar pelo
-- clinic_id do membership do usuário (não há FKs compostas entre clínicas).

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'nutritionist', 'receptionist', 'patient');
create type patient_sex as enum ('female', 'male');
create type appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
create type record_status as enum ('draft', 'finalized');

-- ---------------------------------------------------------------------------
-- Função de updated_at
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clínica, unidades e consultórios
-- ---------------------------------------------------------------------------

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  unit_id uuid not null references units(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membros (papel de cada usuário na clínica)
-- Fonte da verdade dos papéis. Nunca usar user_metadata para isso.
-- ---------------------------------------------------------------------------

create table memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clinic_id)
);

-- ---------------------------------------------------------------------------
-- Pacientes (dados cadastrais apenas; dados clínicos ficam em tabelas próprias)
-- ---------------------------------------------------------------------------

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  -- Conta do portal. Nulo até a ativação (mecanismo ainda não definido).
  user_id uuid unique references auth.users(id) on delete set null,
  -- Nutricionista responsável (membership com role = nutritionist; validar no serviço).
  nutritionist_id uuid references memberships(id),
  full_name text not null,
  email text,
  phone text,
  -- sexo e data de nascimento são necessários para os cálculos da avaliação;
  -- o backend deve exigi-los antes de criar uma avaliação.
  birth_date date,
  sex patient_sex,
  created_by uuid references memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Disponibilidade e agenda
-- ---------------------------------------------------------------------------

create table professional_availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  professional_id uuid not null references memberships(id),
  unit_id uuid not null references units(id),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 60 check (slot_minutes > 0), -- confirmar com a clínica
  check (end_time > start_time)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  professional_id uuid not null references memberships(id),
  unit_id uuid not null references units(id),
  room_id uuid references rooms(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  notes text,
  created_by uuid references memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Sem sobreposição para o mesmo profissional (agendamento cancelado libera o horário)
  constraint appointments_no_overlap_professional
    exclude using gist (
      professional_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (status <> 'cancelled'),
  -- Sem sobreposição no mesmo consultório
  constraint appointments_no_overlap_room
    exclude using gist (
      room_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (room_id is not null and status <> 'cancelled')
);

-- ---------------------------------------------------------------------------
-- Anamnese (dados clínicos)
-- data (jsonb) guarda uma chave por etapa: clinical, medications, habits,
-- eating_behavior, nutrition_history, goals, observations.
-- A etapa 8 (revisão) existe só na interface.
-- ---------------------------------------------------------------------------

create table anamneses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  professional_id uuid not null references memberships(id),
  appointment_id uuid references appointments(id),
  status record_status not null default 'draft',
  current_step smallint not null default 1 check (current_step between 1 and 8),
  data jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um rascunho por paciente
create unique index anamneses_one_draft_per_patient
  on anamneses (patient_id) where status = 'draft';

-- ---------------------------------------------------------------------------
-- Avaliação corporal (dados clínicos)
-- Campos calculados (bmi, body_fat_pct, fat_mass_kg, lean_mass_kg) são
-- preenchidos pelo backend a partir das entradas. Ver backend/CLAUDE.md.
-- ---------------------------------------------------------------------------

create table assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  professional_id uuid not null references memberships(id),
  assessed_at timestamptz not null default now(),
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  height_cm numeric(5,1) not null check (height_cm > 0),
  protocol text,
  equipment text,
  skinfolds jsonb,        -- mm por ponto de medição
  circumferences jsonb,   -- cm por ponto de medição
  bmi numeric(4,1),
  body_fat_pct numeric(4,1),
  fat_mass_kg numeric(5,2),
  muscle_mass_kg numeric(5,2),
  lean_mass_kg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auditoria de acesso e alteração (opcional na demo)
-- ---------------------------------------------------------------------------

create table audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references clinics(id),
  actor_id uuid references memberships(id),
  action text not null,   -- read | create | update | delete
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index memberships_clinic_role_idx on memberships (clinic_id, role);
create index patients_clinic_nutritionist_idx on patients (clinic_id, nutritionist_id) where deleted_at is null;
create index patients_clinic_name_idx on patients (clinic_id, full_name);
create index availability_professional_weekday_idx on professional_availability (professional_id, weekday);
create index appointments_clinic_starts_idx on appointments (clinic_id, starts_at);
create index appointments_patient_starts_idx on appointments (patient_id, starts_at);
create index anamneses_patient_idx on anamneses (patient_id);
create index assessments_patient_date_idx on assessments (patient_id, assessed_at desc);
create index audit_log_clinic_created_idx on audit_log (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------

create trigger memberships_set_updated_at before update on memberships
  for each row execute function set_updated_at();
create trigger patients_set_updated_at before update on patients
  for each row execute function set_updated_at();
create trigger appointments_set_updated_at before update on appointments
  for each row execute function set_updated_at();
create trigger anamneses_set_updated_at before update on anamneses
  for each row execute function set_updated_at();
create trigger assessments_set_updated_at before update on assessments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS ligado, sem policies, e sem privilégios para as roles públicas
-- Toda tabela nova deve repetir estes dois passos.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'clinics', 'units', 'rooms', 'memberships', 'patients',
    'professional_availability', 'appointments', 'anamneses',
    'assessments', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;