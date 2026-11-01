-- FC máxima informada pelo atleta (opcional); vazio = usa a maior FC vista no Strava
alter table athlete_settings add column if not exists max_hr smallint check (max_hr between 120 and 230);
