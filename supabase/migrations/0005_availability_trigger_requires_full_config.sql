-- A trava do banco passa a exigir a mesma configuração completa que a API (todas as durações por
-- tipo + ao menos um dia de atendimento). Antes, uma configuração parcial deixava agendar direto no SQL.
-- Não altera consultas existentes: só consultas novas ou remarcadas passam pela função.

create or replace function enforce_appointment_availability() returns trigger
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
  configured_types int;
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

  -- Sem configuração completa (todas as durações + ao menos um dia de atendimento) ninguém agenda.
  select count(*) into configured_types
  from public.professional_appointment_durations d where d.professional_id = new.professional_id;
  if configured_types < array_length(enum_range(null::public.appointment_type), 1)
     or not exists (select 1 from public.professional_availability pa where pa.professional_id = new.professional_id) then
    raise exception 'availability:schedule_not_configured' using errcode = 'AV001';
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
