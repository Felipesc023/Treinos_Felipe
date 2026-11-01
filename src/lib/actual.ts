import type { PlanDay, SkippedInput } from './plan';
import { addDays, type ISODate, type PlannedWorkout, type WorkoutType } from './planner';

export interface ActualExec { executed_on: string; sport: string | null; duration_s: number | null }

const isRun = (s: string | null) => /run/i.test(s ?? '');
const KEY_TYPES: WorkoutType[] = ['intervalado', 'tempo', 'longao'];

/** Esportes fora do plano e quanto pesam (intensidade 0–5, carga nas pernas 0–3). Academia e caminhada ficam de fora. */
const SPORTS: [RegExp, { label: string; intensity: number; legLoad: number } | null][] = [
  [/weight|workout|crossfit|hiit|yoga|pilates|walk|hike|stretch/i, null],
  [/soccer|football|futsal/i, { label: 'Futebol', intensity: 4, legLoad: 3 }],
  [/tennis|padel|pickle|squash|badminton|basket|volley|handball|rugby|racquet/i, { label: 'Esporte de quadra', intensity: 3, legLoad: 2 }],
  [/swim/i, { label: 'Natação', intensity: 2, legLoad: 0 }],
  [/ride|bike|cycl/i, { label: 'Bicicleta', intensity: 2, legLoad: 1 }],
];
const MIN_MINUTES = 20;

/**
 * Atividades dos últimos `windowDays` dias que o plano não conhecia (futebol, bike…) viram "eventos externos":
 * o motor já trata o futebol como corrida forte nas regras de recuperação. Dia com corrida não entra
 * (a corrida já ocupa o dia e já é avaliada contra o plano).
 */
export function offPlanLoad(execs: ActualExec[], today: ISODate, windowDays = 3): PlannedWorkout[] {
  const from = addDays(today, -windowDays);
  const runDays = new Set(execs.filter((e) => isRun(e.sport)).map((e) => e.executed_on));
  const byDate = new Map<ISODate, PlannedWorkout>();
  for (const e of execs) {
    if (e.executed_on < from || e.executed_on > today || runDays.has(e.executed_on) || isRun(e.sport)) continue;
    const min = Math.round((e.duration_s ?? 0) / 60);
    if (min < MIN_MINUTES) continue;
    const hit = SPORTS.find(([re]) => re.test(e.sport ?? ''));
    if (hit && hit[1] === null) continue;
    const s = hit?.[1] ?? { label: e.sport ?? 'Atividade', intensity: 2, legLoad: 1 };
    const short = min < 30 ? 1 : 0;
    const w: PlannedWorkout = {
      date: e.executed_on, type: 'externo', title: `${s.label} · ${min} min`,
      intensity: Math.max(1, s.intensity - short), legLoad: Math.max(0, s.legLoad - short), estMinutes: min,
      rationale: 'Atividade fora do plano registrada no Strava: conta na carga dos próximos dias.',
    };
    const prev = byDate.get(w.date);
    if (!prev || w.intensity > prev.intensity) byDate.set(w.date, w);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Treino-chave que ficou para trás porque o dia foi ocupado por outra atividade: conta como "não deu" e é reencaixado. */
export function substituted(weekPlan: PlanDay[], actual: PlannedWorkout[], execs: ActualExec[], today: ISODate): SkippedInput[] {
  const ran = new Set(execs.filter((e) => isRun(e.sport)).map((e) => e.executed_on));
  const other = new Set(actual.map((a) => a.date));
  return weekPlan
    .filter((p) => KEY_TYPES.includes(p.type) && p.date < today && !ran.has(p.date) && other.has(p.date))
    .map((p) => ({ date: p.date, type: p.type, replaced: true }));
}
