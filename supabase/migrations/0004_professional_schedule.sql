-- Mova: agenda do profissional (disponibilidade configurada pelo nutricionista)
--
-- * Uma faixa de atendimento por dia da semana + um almoço padrão por profissional.
-- * Duração da consulta por TIPO de atendimento (definida pelo nutricionista).
-- * Dias de folga e bloqueios (motivo pessoal nunca sai do backend para a recepção).
-- * Trava no banco: nenhuma consulta ativa pode existir fora da disponibilidade,
--   qualquer que seja o caminho que a crie (API, script, SQL).
-- Mudar a configuração NUNCA altera consultas existentes: a trava só olha a linha
-- que está sendo inserida ou movida.

create type appointment_type as enum ('first_consultation', 'return_consultation', 'assessment');
create type block_kind as enum ('day_off', 'time_block', 'cancellation_hold');
create type cancellation_source as enum ('client', 'internal');

-- Horário local da clínica (o banco guarda tudo em UTC).
alter table clinics add column timezone text not null default 'America/Sao_Paulo';

-- ---------------------------------------------------------------------------
-- Consultas: tipo de atendimento e origem do cancelamento
-- ---------------------------------------------------------------------------

alter table appointments
  add column appointment_type appointment_type not null default 'return_consultation',
  add column cancellation_source cancellation_source,
  add constraint appointments_cancellation_source_check
    check (cancellation_source is null or status = 'cancelled');
alter table appointments alter column appointment_type drop default;

-- ---------------------------------------------------------------------------
-- Configuração por profissional
-- ---------------------------------------------------------------------------

create table professional_schedule_settings (
  professional_id uuid primary key references memberships(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  -- Intervalo entre os horários de início oferecidos (grade alinhada ao início da faixa).
  start_step_minutes smallint not null default 30 check (start_step_minutes in (15, 30, 60)),
  lunch_start time,
  lunch_end time,
  updated_at timestamptz not null default now(),
  check ((lunch_start is null) = (lunch_end is null)),
  check (lunch_end is null or lunch_end > lunch_start)
);

create table professional_appointment_durations (
  professional_id uuid not null references memberships(id) on delete cascade,
  appointment_type appointment_type not null,
  minutes smallint not null check (minutes between 15 and 240 and minutes % 15 = 0),
  primary key (professional_id, appointment_type)
);

-- ---------------------------------------------------------------------------
-- Faixas por dia da semana: funde as faixas antigas (ex.: 08–12 e 14–18) em uma só
-- e guarda o intervalo entre elas como almoço padrão, sem alterar consultas.
-- ---------------------------------------------------------------------------

insert into professional_schedule_settings (professional_id, clinic_id, lunch_start, lunch_end)
select m.id, m.clinic_id, best.gap_start, best.gap_end
from memberships m
join (select distinct professional_id from professional_availability) p on p.professional_id = m.id
left join (
  select distinct on (professional_id) professional_id, gap_start, gap_end
  from (
    select professional_id, gap_start, gap_end, count(*) as n
    from (
      select professional_id, end_time as gap_start,
             lead(start_time) over (partition by professional_id, weekday order by start_time) as gap_end
      from professional_availability
    ) ordered
    where gap_end is not null and gap_end > gap_start
    group by professional_id, gap_start, gap_end
  ) gaps
  order by professional_id, n desc
) best on best.professional_id = m.id;

create temporary table _spans on commit drop as
select (array_agg(clinic_id))[1] as clinic_id, professional_id, weekday,
       (array_agg(unit_id order by start_time))[1] as unit_id,
       min(start_time) as start_time, max(end_time) as end_time
from professional_availability
group by professional_id, weekday;

delete from professional_availability;
alter table professional_availability drop column slot_minutes;

insert into professional_availability (clinic_id, professional_id, unit_id, weekday, start_time, end_time)
select clinic_id, professional_id, unit_id, weekday, start_time, end_time from _spans;

-- Faixas do mesmo profissional no mesmo dia não podem se sobrepor.
alter table professional_availability
  add constraint professional_availability_no_overlap
  exclude using gist (
    professional_id with =,
    weekday with =,
    int4range(
      (extract(epoch from start_time) / 60)::int,
      (extract(epoch from end_time) / 60)::int
    ) with &&
  );

-- ---------------------------------------------------------------------------
-- Bloqueios e folgas
-- `reason` é nota pessoal do nutricionista: a API NUNCA a devolve à recepção.
-- `cancellation_hold` é gerado pelo cancelamento interno que mantém o horário fechado.
-- ---------------------------------------------------------------------------

create table professional_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  professional_id uuid not null references memberships(id) on delete cascade,
  kind block_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 200),
  source_appointment_id uuid references appointments(id) on delete cascade,
  created_by uuid references memberships(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((kind = 'cancellation_hold') = (source_appointment_id is not null)),
  check (kind <> 'cancellation_hold' or reason is null)
);

create unique index professional_blocks_one_hold_per_appointment
  on professional_blocks (source_appointment_id) where source_appointment_id is not null;
create index professional_blocks_professional_idx on professional_blocks (professional_id, starts_at);

-- ---------------------------------------------------------------------------
-- Trava: consulta ativa precisa caber na disponibilidade
-- ---------------------------------------------------------------------------

create function enforce_appointment_availability() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tz text;
  local_start timestamp;
  local_end timestamp;
  lunch_s time;
  lunch_e time;
  configured_minutes int;
begin
  -- Histórico e cancelados ficam de fora.
  if new.status not in ('scheduled', 'confirmed') then
    return new;
  end if;

  -- Mudar só o status (agendado -> confirmado) não reavalia a consulta: consultas
  -- existentes permanecem mesmo que a disponibilidade tenha mudado depois.
  if tg_op = 'UPDATE' and old.status in ('scheduled', 'confirmed')
     and (new.starts_at, new.ends_at, new.professional_id, new.unit_id, new.appointment_type)
         is not distinct from
         (old.starts_at, old.ends_at, old.professional_id, old.unit_id, old.appointment_type) then
    return new;
  end if;

  select c.timezone into tz from public.clinics c where c.id = new.clinic_id;
  local_start := new.starts_at at time zone tz;
  local_end := new.ends_at at time zone tz;

  if local_start::date <> (local_end - interval '1 microsecond')::date then
    raise exception 'availability:invalid_interval' using errcode = 'AV001';
  end if;

  if not exists (
    select 1 from public.professional_availability pa
    where pa.professional_id = new.professional_id
      and pa.unit_id = new.unit_id
      and pa.weekday = extract(dow from local_start)::smallint
      and pa.start_time <= local_start::time
      and pa.end_time >= local_end::time
  ) then
    raise exception 'availability:outside_working_hours' using errcode = 'AV001';
  end if;

  select s.lunch_start, s.lunch_end into lunch_s, lunch_e
  from public.professional_schedule_settings s where s.professional_id = new.professional_id;
  if lunch_s is not null and local_start::time < lunch_e and local_end::time > lunch_s then
    raise exception 'availability:lunch' using errcode = 'AV001';
  end if;

  if exists (
    select 1 from public.professional_blocks b
    where b.professional_id = new.professional_id
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'availability:blocked' using errcode = 'AV001';
  end if;

  select d.minutes into configured_minutes
  from public.professional_appointment_durations d
  where d.professional_id = new.professional_id and d.appointment_type = new.appointment_type;
  if configured_minutes is null then
    raise exception 'availability:schedule_not_configured' using errcode = 'AV001';
  end if;
  if extract(epoch from (new.ends_at - new.starts_at)) / 60 <> configured_minutes then
    raise exception 'availability:wrong_duration' using errcode = 'AV001';
  end if;

  return new;
end;
$$;

create trigger appointments_enforce_availability
  before insert or update on appointments
  for each row execute function enforce_appointment_availability();

create trigger professional_schedule_settings_set_updated_at before update on professional_schedule_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS ligado, sem policies, sem privilégios para as roles públicas
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'professional_schedule_settings', 'professional_appointment_durations', 'professional_blocks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
