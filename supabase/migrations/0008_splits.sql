-- parciais por km da corrida (splits_metric do Strava): null = detalhe ainda não buscado; [] = buscado, sem parciais
alter table workout_executions add column if not exists splits jsonb;
