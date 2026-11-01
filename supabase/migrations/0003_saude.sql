-- Eventos de saúde (afastamento/dor) e treinos que o atleta marcou como "não deu". RLS ligado, sem policies.
create table health_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('afastamento','dor')),
  body_region text,
  severity smallint check (severity between 1 and 5),
  mode text not null default 'parar' check (mode in ('seguir_restrito','parar')),
  started_on date not null,
  expected_end_on date,
  ended_on date,
  status text not null default 'ativo' check (status in ('ativo','resolvido')),
  created_at timestamptz not null default now()
);

create table skipped_workouts (
  id uuid primary key default gen_random_uuid(),
  skipped_on date not null,
  workout_type text not null,
  reason text not null check (reason in ('sem_tempo','dor','doenca')),
  created_at timestamptz not null default now(),
  unique (skipped_on, workout_type)
);

alter table health_events enable row level security;
alter table skipped_workouts enable row level security;
