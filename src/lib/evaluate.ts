import type { PlanDay } from './plan';
import { weekDates, weekStartSunday, type ISODate, type PaceRange, type ZoneName } from './planner';

export interface ExecLike {
  executed_on: string; sport: string | null; distance_m: number | null; duration_s: number | null; avg_pace_s_km: number | null;
  avg_hr?: number | null;
}
export type Zones = Record<ZoneName, PaceRange> | null;

export interface Evaluation {
  status: 'feito' | 'parcial' | 'pendente' | 'perdido';
  /** Frases curtas para mostrar ao atleta. */
  lines: string[];
  /** Alertas: o treino foi diferente do planejado de um jeito que importa. */
  flags: string[];
}

/** Aviso de ritmo forte demais num treino que devia ser leve (a tendência semanal conta quantas vezes aconteceu). */
export const FLAG_TOO_FAST = 'Ritmo mais forte que o previsto para esse treino: o leve precisa ser leve.';

/** Prefixo do aviso de FC alta (a mensagem completa traz os números). */
export const FLAG_HIGH_HR = 'FC média alta';
/** Acima disso da FC máxima o treino deixa de ser leve (leve) ou de ser aeróbico confortável (longão). */
const HR_LIMIT = { leve: 0.85, longao: 0.88 } as const;

const isRun = (s: string | null) => /run/i.test(s ?? '');
const isRunType = (t: string) => ['leve', 'longao', 'intervalado', 'tempo', 'ativacao'].includes(t);
const isGymType = (t: string) => t.startsWith('academia');
const km1 = (m: number) => (m / 1000).toFixed(1).replace('.', ',');
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Apoio, não diagnóstico: compara o treino planejado com o que o Strava (ou o "fiz") registrou no mesmo dia. */
export function evaluateWorkout(w: PlanDay, execs: ExecLike[], zones: Zones, today: ISODate, maxHr?: number | null): Evaluation {
  const day = execs.filter((e) => e.executed_on === w.date);
  const missing: Evaluation = {
    status: w.date < today ? 'perdido' : 'pendente', lines: [], flags: [],
  };

  if (isGymType(w.type)) {
    const gym = day.filter((e) => !isRun(e.sport));
    if (!gym.length) return missing;
    const secs = gym.reduce((n, e) => n + (e.duration_s ?? 0), 0);
    const hr = gym.find((e) => e.avg_hr)?.avg_hr;
    return {
      status: 'feito',
      lines: [secs ? `Academia: ${Math.round(secs / 60)} min${hr ? ` · FC média ${hr} bpm` : ''}.` : 'Academia marcada como feita.'],
      flags: secs && secs < 30 * 60 ? ['Sessão curta (menos de 30 min): deu para fechar todos os exercícios?'] : [],
    };
  }
  if (!isRunType(w.type)) return missing;

  const runs = day.filter((e) => isRun(e.sport));
  if (!runs.length) return missing;

  const meters = runs.reduce((n, e) => n + (e.distance_m ?? 0), 0);
  const seconds = runs.reduce((n, e) => n + (e.duration_s ?? 0), 0);
  const lines: string[] = [];
  const flags: string[] = [];
  let status: Evaluation['status'] = 'feito';

  if (meters > 0) {
    const planned = w.spec?.km;
    lines.push(planned ? `${km1(meters)} km feitos de ${String(planned).replace('.', ',')} km planejados.` : `${km1(meters)} km feitos.`);
    if (planned) {
      const ratio = meters / 1000 / planned;
      if (ratio < 0.85) { status = 'parcial'; flags.push('Ficou abaixo do volume planejado.'); }
      else if (ratio > 1.15) flags.push('Passou do volume planejado.');
    }
    const pace = runs.length === 1 && runs[0]!.avg_pace_s_km ? runs[0]!.avg_pace_s_km : seconds / (meters / 1000);
    lines.push(`Ritmo médio ${mmss(pace)} /km.`);
    // só dá para julgar o ritmo médio em treinos contínuos
    const zone = w.type === 'leve' ? zones?.leve : w.type === 'longao' ? zones?.longao : undefined;
    if (zone && !w.spec?.fartlekMin) {
      if (pace < zone[0] - 15) flags.push(FLAG_TOO_FAST);
      else if (pace > zone[1] + 30) flags.push('Ritmo bem abaixo do previsto; sem problema se foi um dia pesado.');
    }
  } else {
    lines.push('Treino registrado, sem distância.');
  }
  const hr = runs.length === 1 ? runs[0]!.avg_hr : null;
  const limit = w.type === 'leve' && !w.spec?.fartlekMin ? HR_LIMIT.leve : w.type === 'longao' ? HR_LIMIT.longao : null;
  if (hr && maxHr && limit && hr > maxHr * limit) {
    flags.push(`${FLAG_HIGH_HR} para um treino ${w.type === 'leve' ? 'leve' : 'longo'}: ${hr} bpm, ${Math.round((hr / maxHr) * 100)}% da máxima (${maxHr}).`);
  }
  return { status, lines, flags };
}

export interface WeekSummary {
  runsPlanned: number; runsDone: number; gymPlanned: number; gymDone: number; kmPlanned: number; kmDone: number;
}

/** Resumo da semana (domingo a sábado) que contém `today`; `plan` precisa incluir os dias já passados da semana. */
export function weekSummary(plan: PlanDay[], execs: ExecLike[], zones: Zones, today: ISODate, maxHr?: number | null): WeekSummary {
  const week = new Set(weekDates(weekStartSunday(today)));
  const s: WeekSummary = { runsPlanned: 0, runsDone: 0, gymPlanned: 0, gymDone: 0, kmPlanned: 0, kmDone: 0 };
  for (const w of plan.filter((d) => week.has(d.date))) {
    const done = ['feito', 'parcial'].includes(evaluateWorkout(w, execs, zones, today, maxHr).status);
    if (isGymType(w.type)) { s.gymPlanned++; s.gymDone += done ? 1 : 0; }
    else if (isRunType(w.type)) { s.runsPlanned++; s.runsDone += done ? 1 : 0; s.kmPlanned += w.spec?.km ?? 0; }
  }
  s.kmDone = execs.filter((e) => week.has(e.executed_on) && isRun(e.sport)).reduce((n, e) => n + (e.distance_m ?? 0), 0) / 1000;
  return s;
}
