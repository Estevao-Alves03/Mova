-- Vínculo entre nutricionistas e unidades, definido pelo admin (Configurações > Unidades).
-- O nutricionista só configura atendimento (Minha Agenda) nas unidades em que está vinculado.
-- Recepção e admin não precisam de vínculo: enxergam todas as unidades.

create table unit_members (
  unit_id uuid not null references units(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  created_at timestamptz not null default now(),
  primary key (unit_id, membership_id)
);
create index unit_members_membership_idx on unit_members (membership_id);

-- Quem já atende numa unidade (janelas da agenda) continua vinculado: a mudança não quebra agendas existentes.
insert into unit_members (unit_id, membership_id, clinic_id)
select distinct a.unit_id, a.professional_id, a.clinic_id
from professional_availability a
on conflict do nothing;

alter table unit_members enable row level security;
revoke all on unit_members from anon, authenticated;
