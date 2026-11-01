-- Preferências do atleta (uma linha): treinos por semana e dias de descanso (0 = domingo). RLS ligado, sem policies.
create table athlete_settings (
  id smallint primary key default 1 check (id = 1),
  runs_per_week smallint not null default 3 check (runs_per_week between 1 and 4),
  gym_per_week smallint not null default 2 check (gym_per_week between 0 and 2),
  rest_days smallint[] not null default '{0,3}'
);
alter table athlete_settings enable row level security;
insert into athlete_settings (id) values (1);
