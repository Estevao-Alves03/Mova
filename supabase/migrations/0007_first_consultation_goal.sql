-- Objetivo principal e observação inicial informados no cadastro do paciente ("Novo paciente &
-- primeira consulta"). Ficam com a CONSULTA (não com o cadastro básico): são informação clínica e o
-- modelo de metas do paciente continua indefinido.

create type consultation_goal as enum (
  'weight_loss',     -- Emagrecimento & Definição
  'muscle_gain',     -- Ganho de Massa Muscular
  'healthy_eating',  -- Reeducação Alimentar
  'clinical',        -- Saúde Clínica / Patologias
  'sports',          -- Performance Esportiva
  'other'            -- Outro Objetivo
);

alter table appointments
  add column goal consultation_goal,
  add column initial_notes text check (initial_notes is null or char_length(initial_notes) <= 300);
