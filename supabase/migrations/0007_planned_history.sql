-- Plano que o atleta realmente seguia (do calendario-corrida), dia a dia. Só leitura pelo app; RLS ligado, sem policies.
create table planned_history (
  date date primary key,
  type text not null,
  title text not null,
  detail jsonb not null default '[]'
);
alter table planned_history enable row level security;
