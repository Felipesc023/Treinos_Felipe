import { db, type ExecRow, type PrRow, type RaceRow } from '@/lib/db';
import { generatePlan, type PlanResult } from '@/lib/plan';
import { todayISO } from '@/lib/today';

export interface AppState {
  today: string;
  races: RaceRow[];
  nextRace: RaceRow | null;
  prs: PrRow[];
  execs: ExecRow[];
  strava: { status: string; lastSyncedAt: string | null } | null;
  plan: PlanResult | null;
}

/** Lê tudo de uma vez e gera o plano da próxima prova A (ou a mais próxima). */
export async function loadState(): Promise<AppState> {
  const today = todayISO();
  const sb = db();
  const [races, prs, execs, strava] = await Promise.all([
    sb.from('races').select('*').gte('race_date', today).order('race_date'),
    sb.from('personal_records').select('*').order('distance_m'),
    sb.from('workout_executions').select('*').order('executed_on', { ascending: false }).limit(10),
    sb.from('integrations').select('status,last_synced_at').eq('provider', 'strava').maybeSingle(),
  ]);
  for (const r of [races, prs, execs]) if (r.error) throw new Error(r.error.message);

  const raceRows = (races.data ?? []) as RaceRow[];
  const prRows = (prs.data ?? []) as PrRow[];
  const nextRace = raceRows.find((r) => r.priority === 'A') ?? raceRows[0] ?? null;
  const plan = nextRace
    ? generatePlan({
        today,
        race: { name: nextRace.name, date: nextRace.race_date, distanceM: nextRace.distance_m },
        prs: prRows.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds })),
      })
    : null;
  return {
    today, races: raceRows, nextRace, prs: prRows, execs: (execs.data ?? []) as ExecRow[], plan,
    strava: strava.data ? { status: strava.data.status, lastSyncedAt: strava.data.last_synced_at } : null,
  };
}
