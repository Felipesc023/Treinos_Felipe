-- App single-user. Acesso só pelo servidor (service role); RLS ligado e sem policies = anon/authenticated não leem nada.

create table races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  race_date date not null,
  distance_m int not null check (distance_m > 0),
  goal_type text not null default 'ambos' check (goal_type in ('pr','terminar','ambos')),
  goal_time_seconds int check (goal_time_seconds > 0),
  priority char(1) not null default 'A' check (priority in ('A','B','C')),
  created_at timestamptz not null default now()
);
create index on races (race_date);

create table personal_records (
  id uuid primary key default gen_random_uuid(),
  distance_m int not null check (distance_m > 0),
  time_seconds int not null check (time_seconds > 0),
  achieved_on date,
  source text not null default 'manual' check (source in ('manual','strava')),
  created_at timestamptz not null default now()
);

create table integrations (
  provider text primary key check (provider in ('strava')),
  external_athlete_id text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  scope text,
  status text not null default 'ativa' check (status in ('ativa','revogada','erro')),
  last_synced_at timestamptz
);

create table workout_executions (
  id uuid primary key default gen_random_uuid(),
  executed_on date not null,
  source text not null check (source in ('manual','strava')),
  external_id text not null,
  name text,
  sport text,
  distance_m int check (distance_m >= 0),
  duration_s int check (duration_s >= 0),
  avg_pace_s_km int,
  avg_hr smallint,
  max_hr smallint,
  laps jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index on workout_executions (executed_on desc);

create table ingestion_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  external_id text not null,
  payload jsonb not null,
  status text not null default 'recebido' check (status in ('recebido','processado','erro')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table races enable row level security;
alter table personal_records enable row level security;
alter table integrations enable row level security;
alter table workout_executions enable row level security;
alter table ingestion_events enable row level security;
