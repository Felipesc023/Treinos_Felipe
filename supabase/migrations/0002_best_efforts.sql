-- null = detalhe ainda não buscado no Strava; [] = buscado, sem melhores esforços
alter table workout_executions add column best_efforts jsonb;
