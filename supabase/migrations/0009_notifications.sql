-- Notificações do sino (in-app), geradas a partir dos eventos configuráveis em Configurações > Notificações.
-- Cada linha pertence a UM destinatário (a preferência dele é conferida na hora de gerar).
-- O texto não leva dado clínico (sem objetivo nem observações), só o que a agenda já mostra.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  membership_id uuid not null references memberships(id) on delete cascade,
  -- identificador do catálogo (appointment_created, appointment_cancelled, daily_summary...)
  event text not null,
  -- para appointment_cancelled: 'cancelled' ou 'rescheduled'
  kind text,
  title text not null,
  body text not null,
  appointment_id uuid references appointments(id) on delete set null,
  -- dia (no fuso da clínica) para abrir a agenda ao clicar
  target_date date,
  -- evita duplicar avisos gerados sob demanda (ex.: resumo diário: "daily:2026-09-21")
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (membership_id, created_at desc);
create index notifications_unread_idx on notifications (membership_id) where read_at is null;
create unique index notifications_dedupe_key on notifications (membership_id, dedupe_key) where dedupe_key is not null;

alter table notifications enable row level security;
revoke all on notifications from anon, authenticated;
