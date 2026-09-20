-- Mova: preferências de notificação por usuário
--
-- Uma linha por membership: cada usuário guarda somente as próprias preferências.
-- `preferences` é validado pela API (chaves conhecidas por papel); o banco só
-- garante que é um objeto. Segurança igual às demais tabelas: RLS ligado, sem
-- policies e sem privilégio para anon/authenticated (acesso só pelo backend).

create table notification_preferences (
  membership_id uuid primary key references memberships(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create index notification_preferences_clinic_idx on notification_preferences (clinic_id);

create trigger notification_preferences_set_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;
