import { db, type ExecRow, type HealthEventRow, type PrRow, type RaceRow, type SettingsRow, type SkippedRow } from '@/lib/db';
import { toHealthInput } from '@/lib/health';
import { DEFAULT_SETTINGS, addDays, type PlannedWorkout, fitnessFrom, referencePace5k, weekDates, weekStartSunday, zonesFrom, type Fitness, type ISODate, type WorkoutType } from '@/lib/planner';
import type { Zones } from '@/lib/evaluate';
import { generatePlan, templateFrom, type HealthInput, type PlanDay, type PlanResult, type SkippedInput } from '@/lib/plan';
import { offPlanLoad, substituted } from '@/lib/actual';
import { estimateMaxHr } from '@/lib/hr';
import { weekTrend, type Trend } from '@/lib/trend';
import { missedCandidates } from '@/lib/replan';
import { todayISO } from '@/lib/today';

export interface AppState {
  today: string;
  races: RaceRow[];
  nextRace: RaceRow | null;
  prs: PrRow[];
  execs: ExecRow[];
  health: HealthEventRow[];
  skipped: SkippedRow[];
  settings: SettingsRow;
  fitness: Fitness;
  /** Plano da semana atual inteira (inclui dias já passados, para comparar com o feito) e o que foi feito nela. */
  weekPlan: PlanDay[];
  weekExecs: ExecRow[];
  zones: Zones;
  /** Treinos de corrida de ontem sem corrida no Strava e sem "não deu". */
  missed: PlanDay[];
  strava: { status: string; lastSyncedAt: string | null } | null;
  plan: PlanResult | null;
  /** Atividades fora do plano dos últimos dias (futebol, bike…), já convertidas em carga. */
  actual: PlannedWorkout[];
  /** Treinos-chave trocados por outra atividade: tratados como "não deu". */
  autoSkipped: SkippedInput[];
  /** O que as últimas semanas dizem sobre as próximas (null = pouco dado ou afastado). */
  trend: Trend | null;
  /** Dias com alguma atividade registrada (Strava ou à mão): um "não fiz" nesses dias foi troca, não falta. */
  replacedDates: ReadonlySet<string>;
  /** FC máxima estimada pelo histórico do Strava (null = poucas corridas com FC). */
  maxHr: number | null;
}

type PlanInputs = Pick<AppState, 'today' | 'nextRace' | 'prs' | 'health' | 'skipped' | 'settings' | 'fitness'> & Partial<Pick<AppState, 'actual' | 'autoSkipped' | 'trend' | 'replacedDates'>>;

export const DEFAULT_SETTINGS_ROW: SettingsRow = { runs_per_week: DEFAULT_SETTINGS.runsPerWeek, gym_per_week: DEFAULT_SETTINGS.gymPerWeek, rest_days: [0, 3] };

/** Plano do estado + eventos hipotéticos (`extra`, para a tela de proposta). `today` permite olhar um dia passado. */
export function buildPlan(s: PlanInputs, extra: HealthInput[] = [], today: ISODate = s.today): PlanResult {
  const r = s.nextRace;
  return generatePlan({
    today,
    ...(r ? { race: { name: r.name, date: r.race_date, distanceM: r.distance_m } } : {}),
    prs: s.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds })),
    health: [...s.health.map((e) => toHealthInput(e, s.today)), ...extra],
    skipped: [...s.skipped.map((k) => ({ date: k.skipped_on, type: k.workout_type as WorkoutType, ...(s.replacedDates?.has(k.skipped_on) && { replaced: true }) })), ...(s.autoSkipped ?? [])],
    // só o plano "de hoje" enxerga o que foi feito; os planos de dias passados (comparação) ficam como eram
    ...(today === s.today && s.actual?.length ? { actual: s.actual } : {}),
    fitness: s.fitness,
    ...(s.trend && today === s.today ? { loadFactor: s.trend.factor } : {}),
    settings: { runsPerWeek: s.settings.runs_per_week, gymPerWeek: s.settings.gym_per_week },
    template: templateFrom(s.settings.rest_days),
  });
}

const EXEC_COLS = 'id,executed_on,source,name,sport,distance_m,duration_s,avg_pace_s_km,avg_hr,max_hr,calories';
const isRun = (sport: string | null) => /run/i.test(sport ?? '');

export type BaseData = Pick<AppState, 'today' | 'races' | 'nextRace' | 'prs' | 'health' | 'skipped' | 'settings' | 'fitness' | 'strava'> & { execs120: ExecRow[]; maxHr: number | null };

/** Só leituras do banco (sem montar plano): o que as telas simples (Provas, Perfil, Saúde) precisam. */
export async function loadData(): Promise<BaseData> {
  const today = todayISO();
  const sb = db();
  const [races, prs, execs, strava, health, skipped, settings] = await Promise.all([
    sb.from('races').select('*').gte('race_date', today).order('race_date'),
    sb.from('personal_records').select('*').order('distance_m'),
    // uma leitura só das execuções (120 dias, sem as voltas: o JSON das voltas é pesado e só a tela do treino usa)
    sb.from('workout_executions').select(EXEC_COLS).gte('executed_on', addDays(today, -120)).order('executed_on', { ascending: false }),
    sb.from('integrations').select('status,last_synced_at').eq('provider', 'strava').maybeSingle(),
    // ativos, ou resolvidos há pouco (a retomada continua depois do "liberado")
    sb.from('health_events').select('*').or(`status.eq.ativo,ended_on.gte.${addDays(today, -90)}`).order('started_on'),
    sb.from('skipped_workouts').select('*').gte('skipped_on', addDays(today, -30)),
    sb.from('athlete_settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  for (const r of [races, prs, execs, health, skipped, settings]) if (r.error) throw new Error(r.error.message);

  const raceRows = (races.data ?? []) as RaceRow[];
  const execs120 = (execs.data ?? []) as ExecRow[];
  return {
    today, races: raceRows, execs120, maxHr: estimateMaxHr(execs120),
    nextRace: raceRows.find((r) => r.priority === 'A') ?? raceRows[0] ?? null,
    prs: (prs.data ?? []) as PrRow[],
    health: (health.data ?? []) as HealthEventRow[],
    skipped: (skipped.data ?? []) as SkippedRow[],
    settings: (settings.data ?? DEFAULT_SETTINGS_ROW) as SettingsRow,
    fitness: fitnessFrom(execs120.filter((e) => isRun(e.sport)), today),
    strava: strava.data ? { status: strava.data.status, lastSyncedAt: strava.data.last_synced_at } : null,
  };
}

/** Tudo da semana atual e do plano (Hoje, Calendário, proposta de saúde). */
export async function loadState(): Promise<AppState> {
  const { execs120, maxHr, ...base } = await loadData();
  const { today } = base;
  const weekStart = weekStartSunday(today);
  const week = weekDates(weekStart);
  const weekPlan = buildPlan(base, [], weekStart).days.filter((d) => week.includes(d.date));
  const yesterday = addDays(today, -1);
  // ontem quase sempre está na semana já calculada; só no domingo é preciso um plano à parte
  const planned = (yesterday >= weekStart ? weekPlan : buildPlan(base, [], yesterday).days).filter((d) => d.date === yesterday);
  const actual = offPlanLoad(execs120, today);
  const autoSkipped = substituted(weekPlan, actual, execs120, today);
  const zones = base.prs.length ? zonesFrom(referencePace5k(base.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds })))) : null;
  // um plano recalculado desde 2 semanas atrás, só para comparar com o que foi feito
  const trend = weekTrend({ past: buildPlan(base, [], addDays(weekStart, -14)).days, execs: execs120, zones, maxHr, today, handled: autoSkipped.concat(base.skipped.map((k) => ({ date: k.skipped_on, type: k.workout_type as WorkoutType }))) });
  const replacedDates = new Set(execs120.map((e) => e.executed_on));
  const withActual = { ...base, actual, autoSkipped, trend, replacedDates };
  return {
    ...withActual,
    maxHr,
    execs: execs120.slice(0, 10),
    weekExecs: execs120.filter((e) => e.executed_on >= weekStart),
    plan: buildPlan(withActual),
    weekPlan,
    missed: missedCandidates({
      planned, execs: execs120,
      skipped: [...base.skipped.map((k) => ({ date: k.skipped_on, type: k.workout_type as WorkoutType })), ...autoSkipped],
    }),
    zones,
  };
}
