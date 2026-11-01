import { FLAG_HIGH_HR, FLAG_TOO_FAST, evaluateWorkout, type ExecLike, type Zones } from './evaluate';
import type { PlanDay, SkippedInput } from './plan';
import { addDays, type ISODate } from './planner';

const RUN_TYPES = ['leve', 'longao', 'intervalado', 'tempo', 'ativacao'];
/** Menos corridas planejadas que isso na janela: pouco dado (ou afastado), a tendência não decide nada. */
const MIN_PLANNED = 3;

export interface Trend {
  planned: number; done: number; tooFast: number;
  /** Multiplicador de volume das próximas duas semanas (1 = manter). */
  factor: number;
  message: string;
}

/**
 * O que as duas últimas semanas dizem sobre as próximas: só corridas (a academia nem sempre chega pelo Strava).
 * Treino marcado como "não deu" ou trocado por outra atividade fica fora da conta: já foi tratado à parte.
 * `past` = o plano dessas semanas, recalculado (o app não guarda planos antigos).
 */
export function weekTrend(o: {
  past: PlanDay[]; execs: ExecLike[]; zones: Zones; maxHr?: number | null; today: ISODate; weeks?: number; handled?: SkippedInput[];
}): Trend | null {
  const from = addDays(o.today, -7 * (o.weeks ?? 2) - ((new Date(`${o.today}T00:00:00Z`).getUTCDay()) % 7));
  const handled = new Set((o.handled ?? []).map((h) => `${h.date}|${h.type}`));
  const runs = o.past.filter((p) => RUN_TYPES.includes(p.type) && p.date >= from && p.date < o.today && !handled.has(`${p.date}|${p.type}`));
  if (runs.length < MIN_PLANNED) return null;
  const evals = runs.map((p) => evaluateWorkout(p, o.execs, o.zones, o.today, o.maxHr));
  const done = evals.filter((e) => e.status === 'feito' || e.status === 'parcial').length;
  const tooFast = evals.filter((e) => e.flags.includes(FLAG_TOO_FAST) || e.flags.some((f) => f.startsWith(FLAG_HIGH_HR))).length;
  const rate = done / runs.length;
  const factor = rate < 0.5 ? 0.8 : rate < 0.75 ? 0.9 : 1;
  const head = `Você fez ${done} de ${runs.length} corridas planejadas nas últimas semanas.`;
  const volume = factor < 1 ? ` Reduzi o volume em ${Math.round((1 - factor) * 100)}% nas próximas duas semanas para reconstruir o ritmo.` : ' Plano mantido.';
  const pace = tooFast >= 2 ? ` Os treinos leves saíram fortes demais ${tooFast} vezes (ritmo ou frequência cardíaca): segure o esforço neles.` : '';
  return { planned: runs.length, done, tooFast, factor, message: head + volume + pace };
}
