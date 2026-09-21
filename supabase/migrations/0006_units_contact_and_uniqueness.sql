-- Cadastro completo de unidades e consultórios (Configurações da plataforma, só admin).
--  * telefone e e-mail de contato da unidade (o horário de funcionamento NÃO é da unidade:
--    o expediente é definido por cada nutricionista em "Minha Agenda");
--  * nomes únicos (sem diferenciar maiúsculas) por clínica e por unidade, para o admin não
--    cadastrar a mesma unidade ou sala duas vezes.

alter table units
  add column phone text,
  add column email text;

create unique index units_clinic_name_key on units (clinic_id, lower(name));
create unique index rooms_unit_name_key on rooms (unit_id, lower(name));
