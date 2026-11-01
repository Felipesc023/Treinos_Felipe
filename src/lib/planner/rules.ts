import type { PlannerConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { addDays, diffDays, weekdayName, weekdayOf, type ISODate } from './dates';
import type {
  DayTemplate, HealthRestriction, PlannedWorkout, Violation, WorkoutType,
} from './types';

const RUN_TYPES: WorkoutType[] = ['leve', 'longao', 'intervalado', 'tempo', 'ativacao', 'prova'];
const HARD_RUN_TYPES: WorkoutType[] = ['longao', 'intervalado', 'tempo'];

export const isLegGym = (w: PlannedWorkout) => w.type === 'academia_inferior';

/** R4: evento externo de perna e carga alta (futebol) conta como corrida forte. */
export const isHardRun = (w: PlannedWorkout) =>
  HARD_RUN_TYPES.includes(w.type) ||
  (w.type === 'externo' && w.legLoad >= 3 && w.intensity >= 4);

const isRun = (w: PlannedWorkout) => RUN_TYPES.includes(w.type);

export interface ValidationContext {
  template: DayTemplate[];
  raceDate?: ISODate;
  restrictions?: HealthRestriction[];
  config?: PlannerConfig;
}

const label = (d: ISODate) => `${weekdayName(d)} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Valida um conjunto de treinos (de qualquer período) contra as regras duras.
 * "Intervalo" = dias INTEIROS entre as sessões → diferença de datas ≥ intervalo + 1.
 */
export function validatePlan(workouts: PlannedWorkout[], ctx: ValidationContext): Violation[] {
  const cfg = ctx.config ?? DEFAULT_CONFIG;
  const ws = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const out: Violation[] = [];

  // R0 — no máximo uma sessão por dia
  const byDate = new Map<ISODate, PlannedWorkout[]>();
  for (const w of ws) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  for (const [date, list] of byDate) {
    if (list.length > 1) {
      out.push({ rule: 'R0', dates: [date],
        message: `${label(date)} já tem outra sessão (${list.map((x) => x.title).join(' + ')}).` });
    }
  }

  const legs = ws.filter(isLegGym);
  const hards = ws.filter(isHardRun);

  // R1 — perna → corrida forte: ≥ N dias inteiros
  for (const L of legs) {
    for (const H of hards) {
      const d = diffDays(H.date, L.date);
      if (d > 0 && d < cfg.minDaysBetweenLegAndHardRun + 1) {
        const between = d - 1;
        out.push({ rule: 'R1', dates: [L.date, H.date],
          message: `Perna em ${label(L.date)} e corrida forte em ${label(H.date)}: só ${between} ${plural(between, 'dia inteiro', 'dias inteiros')} de intervalo (mínimo ${cfg.minDaysBetweenLegAndHardRun}).` });
      }
    }
  }

  // R2 — corrida forte → perna: ≥ N dias inteiros
  for (const H of hards) {
    for (const L of legs) {
      const d = diffDays(L.date, H.date);
      if (d > 0 && d < cfg.minDaysBetweenHardRunAndLeg + 1) {
        const between = d - 1;
        out.push({ rule: 'R2', dates: [H.date, L.date],
          message: `Corrida forte em ${label(H.date)} e perna em ${label(L.date)}: só ${between} ${plural(between, 'dia inteiro', 'dias inteiros')} de intervalo (mínimo ${cfg.minDaysBetweenHardRunAndLeg}).` });
      }
    }
  }

  // R3 — nunca dois dias seguidos com intensidade ≥ 4
  for (let i = 0; i < ws.length; i++) {
    for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i]!, b = ws[j]!;
      if (diffDays(b.date, a.date) === 1 && a.intensity >= 4 && b.intensity >= 4) {
        out.push({ rule: 'R3', dates: [a.date, b.date],
          message: `Dois dias seguidos de esforço forte: ${label(a.date)} (${a.title}) e ${label(b.date)} (${b.title}).` });
      }
    }
  }

  const free = (w: PlannedWorkout) => w.type === 'externo' || w.type === 'prova' || w.type === 'descanso';

  // R5 — descanso fixo do padrão semanal
  for (const w of ws) {
    if (free(w)) continue;
    const t = ctx.template.find((x) => x.weekday === weekdayOf(w.date));
    if (t?.isRest) {
      out.push({ rule: 'R5', dates: [w.date],
        message: `${label(w.date)} é dia de descanso do seu padrão semanal.` });
    }
  }

  // R6 — proximidade da prova
  if (ctx.raceDate) {
    const race = ctx.raceDate;
    for (const w of ws) {
      if (w.type === 'prova' || w.type === 'descanso') continue;
      const toRace = diffDays(race, w.date);
      if (toRace === 1 && !(w.type === 'ativacao' && w.estMinutes <= 30)) {
        out.push({ rule: 'R6', dates: [w.date],
          message: `${label(w.date)} é a véspera da prova: só descanso ou ativação curta.` });
      }
      if (isLegGym(w) && toRace > 0 && toRace < cfg.lastLegGymDaysBeforeRace) {
        out.push({ rule: 'R6', dates: [w.date],
          message: `Perna em ${label(w.date)} está a ${toRace} dias da prova (mínimo ${cfg.lastLegGymDaysBeforeRace}).` });
      }
      if (w.intensity >= 4 && toRace > 0 && toRace <= cfg.noHardWithinDaysOfRace) {
        out.push({ rule: 'R6', dates: [w.date],
          message: `Esforço forte em ${label(w.date)} a ${toRace} dia(s) da prova.` });
      }
    }
  }

  // R7 — tempo disponível no dia
  for (const w of ws) {
    if (free(w)) continue;
    const t = ctx.template.find((x) => x.weekday === weekdayOf(w.date));
    if (t && !t.isRest && w.estMinutes > t.maxMinutes) {
      out.push({ rule: 'R7', dates: [w.date],
        message: `${label(w.date)}: ${w.title} leva ~${w.estMinutes} min, mas você tem ${t.maxMinutes} min nesse dia.` });
    }
  }

  // R8 — restrições de saúde ativas
  for (const r of ctx.restrictions ?? []) {
    for (const w of ws) {
      if (w.date < r.from || w.date > r.to || w.type === 'descanso') continue;
      if (r.noImpact && (isRun(w) || w.type === 'externo')) {
        out.push({ rule: 'R8', dates: [w.date],
          message: `${label(w.date)}: restrição "${r.label}" (sem impacto).` });
      } else if (r.maxIntensity !== undefined && w.intensity > r.maxIntensity) {
        out.push({ rule: 'R8', dates: [w.date],
          message: `${label(w.date)}: restrição "${r.label}" limita a intensidade a ${r.maxIntensity}.` });
      }
    }
  }

  return out.sort((a, b) => a.dates[0]!.localeCompare(b.dates[0]!) || a.rule.localeCompare(b.rule));
}

export { addDays };
