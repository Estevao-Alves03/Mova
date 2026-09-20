-- Mova: perfil do usuário (dados profissionais e foto)
--
-- Os dados vivem em memberships (fonte da verdade do usuário na clínica).
-- O e-mail continua sendo o de login (auth.users) e não é duplicado aqui.
-- avatar_path aponta para o objeto no bucket privado "avatars" do Storage;
-- o backend gera a URL assinada, o front nunca acessa o Storage direto.

alter table memberships
  add column phone text,
  add column crn text,
  add column crn_state text,
  add column specialty text,
  add column bio text,
  add column avatar_path text,
  add constraint memberships_bio_length check (bio is null or char_length(bio) <= 350),
  add constraint memberships_phone_length check (phone is null or char_length(phone) <= 20),
  add constraint memberships_crn_length check (crn is null or char_length(crn) <= 20),
  add constraint memberships_crn_state_length check (crn_state is null or char_length(crn_state) <= 60),
  add constraint memberships_specialty_length check (specialty is null or char_length(specialty) <= 120);

-- Consultas do resumo da conta (pacientes do profissional / consultas concluídas).
create index appointments_professional_status_idx on appointments (professional_id, status);
