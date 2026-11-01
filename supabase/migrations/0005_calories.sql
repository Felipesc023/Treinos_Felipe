-- null = detalhe ainda não buscado no Strava; 0 = buscado, sem dado de calorias
alter table workout_executions add column if not exists calories integer;
