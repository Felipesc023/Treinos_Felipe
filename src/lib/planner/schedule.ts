import { DEFAULT_CONFIG, type PlannerConfig } from './config';
import { addDays, weekDates, weekdayOf, weekdayName, type ISODate } from './dates';
import { validatePlan } from './rules';
import { scaleSpec } from './spec';
import type {
  DayTemplate, DroppedSession, HealthRestriction, PlannedWorkout, SessionRequest, Violation,
} from './types';

export interface ScheduleInput {
  /** Domingo da semana a montar. */
  weekStart: ISODate;
  template: DayTemplate[];
  /** Eventos externos (futebol) e a própria prova, se cair na semana. */
  fixed?: PlannedWorkout[];
  /** Treinos de semanas vizinhas, para as regras cruzarem a fronteira da semana. */
  context?: PlannedWorkout[];
  /** Em ordem de prioridade (o primeiro é o mais importante). */
  requests: SessionRequest[];
  raceDate?: ISODate;
  restrictions?: HealthRestriction[];
  config?: PlannerConfig;
}

export interface ScheduleResult {
  workouts: PlannedWorkout[];
  dropped: DroppedSession[];
  /** Violações restantes (devem ser vazias em condições normais). */
  violations: Violation[];
}

interface Placed { req: SessionRequest; workout: PlannedWorkout }

/**
 * Agenda UMA semana respeitando as regras duras.
 * Determinístico: mesmas entradas → mesmo resultado.
 */
export function scheduleWeek(input: ScheduleInput): ScheduleResult {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const fixed = input.fixed ?? [];
  const context = input.context ?? [];
  const days = weekDates(input.weekStart);
  const vctx = { template: input.template, raceDate: input.raceDate, restrictions: input.restrictions, config: cfg };

  const base = (): PlannedWorkout[] => [...context, ...fixed];

  const toWorkout = (req: SessionRequest, date: ISODate, reduced: boolean): PlannedWorkout => ({
    date,
    type: req.type,
    title: reduced ? `${req.title} (reduzido)` : req.title,
    intensity: reduced ? Math.max(1, req.intensity - 1) : req.intensity,
    legLoad: req.legLoad,
    estMinutes: reduced ? Math.round(req.estMinutes * cfg.preEventVolumeFactor) : req.estMinutes,
    rationale: reduced
      ? `${req.rationale} Volume reduzido (×${cfg.preEventVolumeFactor}) para respeitar a recuperação.`
      : req.rationale,
    ...(reduced ? { reduced: true } : {}),
    ...(req.spec ? { spec: reduced ? scaleSpec(req.spec, cfg.preEventVolumeFactor) : req.spec } : {}),
  });

  /** Dias candidatos: dentro de ±maxShiftDays do dia preferido, na própria semana. */
  const candidateDays = (req: SessionRequest): ISODate[] =>
    days
      .filter((d) => Math.abs(weekdayOf(d) - req.preferredWeekday) <= cfg.maxShiftDays && (!req.notBefore || d >= req.notBefore))
      .sort((a, b) =>
        Math.abs(weekdayOf(a) - req.preferredWeekday) - Math.abs(weekdayOf(b) - req.preferredWeekday)
        || a.localeCompare(b));

  const violationsOn = (all: PlannedWorkout[], date: ISODate): Violation[] =>
    validatePlan(all, vctx).filter((v) => v.dates.includes(date));

  /** Primeiro candidato sem violação, na ordem de preferência. Também devolve os motivos das recusas. */
  const findSlot = (
    req: SessionRequest, reduced: boolean, placed: Placed[], exclude?: ISODate,
  ): { workout?: PlannedWorkout; reasons: string[] } => {
    const reasons: string[] = [];
    for (const date of candidateDays(req)) {
      if (date === exclude) continue;
      const w = toWorkout(req, date, reduced);
      const vs = violationsOn([...base(), ...placed.map((p) => p.workout), w], date);
      if (vs.length === 0) return { workout: w, reasons };
      reasons.push(...vs.map((v) => v.message));
    }
    return { reasons };
  };

  const placed: Placed[] = [];
  const dropped: DroppedSession[] = [];

  for (const req of input.requests) {
    let slot = findSlot(req, false, placed);
    const allReasons = [...slot.reasons];

    if (!slot.workout && req.reducible) {
      const r = findSlot(req, true, placed);
      slot = r;
      allReasons.push(...r.reasons);
    }

    // Backtracking de 1 nível: tenta realocar uma sessão já encaixada para abrir espaço.
    if (!slot.workout) {
      outer: for (let i = placed.length - 1; i >= 0; i--) {
        const prev = placed[i]!;
        const rest = placed.filter((_, k) => k !== i);
        for (const reduced of req.reducible ? [false, true] : [false]) {
          for (const date of candidateDays(req)) {
            const w = toWorkout(req, date, reduced);
            if (violationsOn([...base(), ...rest.map((p) => p.workout), w], date).length) continue;
            const withReq: Placed[] = [...rest, { req, workout: w }];
            const moved = findSlot(prev.req, !!prev.workout.reduced, withReq, prev.workout.date);
            if (moved.workout) {
              placed.splice(0, placed.length, ...withReq, { req: prev.req, workout: moved.workout });
              slot = { workout: w, reasons: [] };
              break outer;
            }
          }
        }
      }
    }

    if (slot.workout) {
      if (!placed.some((p) => p.req === req)) placed.push({ req, workout: slot.workout });
    } else {
      const uniq = [...new Set(allReasons)];
      dropped.push({
        request: req,
        reason: `Nenhum dia viável perto de ${weekdayName(addDays(input.weekStart, req.preferredWeekday))}: ${uniq.join(' | ')}`,
      });
    }
  }

  const workouts = [...fixed, ...placed.map((p) => p.workout)]
    .sort((a, b) => a.date.localeCompare(b.date));
  const violations = validatePlan([...context, ...workouts], vctx)
    .filter((v) => v.dates.some((d) => days.includes(d)));

  return { workouts, dropped, violations };
}

/** Atalhos com valores-padrão de intensidade, carga de perna e duração por tipo de sessão. */
export const SESSION_DEFAULTS = {
  longao: { intensity: 4, legLoad: 2, estMinutes: 75 },
  intervalado: { intensity: 4, legLoad: 2, estMinutes: 60 },
  tempo: { intensity: 4, legLoad: 2, estMinutes: 55 },
  leve: { intensity: 2, legLoad: 1, estMinutes: 45 },
  ativacao: { intensity: 1, legLoad: 0, estMinutes: 25 },
  academia_inferior: { intensity: 3, legLoad: 3, estMinutes: 50 },
  academia_superior: { intensity: 2, legLoad: 0, estMinutes: 45 },
} as const;

export function makeRequest(
  type: SessionRequest['type'],
  preferredWeekday: number,
  extra: Partial<Omit<SessionRequest, 'type' | 'preferredWeekday'>> & { title?: string } = {},
): SessionRequest {
  const d = SESSION_DEFAULTS[type];
  return {
    type,
    preferredWeekday,
    title: extra.title ?? type,
    intensity: extra.intensity ?? d.intensity,
    legLoad: extra.legLoad ?? d.legLoad,
    estMinutes: extra.estMinutes ?? d.estMinutes,
    reducible: extra.reducible ?? (type === 'intervalado' || type === 'tempo'),
    rationale: extra.rationale ?? '',
    ...(extra.spec ? { spec: extra.spec } : {}),
    ...(extra.notBefore ? { notBefore: extra.notBefore } : {}),
  };
}
