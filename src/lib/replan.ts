import type { PlanDay, SkippedInput } from './plan';

const key = (d: PlanDay) => `${d.date}|${d.type}`;

/** O que muda entre dois planos, para mostrar antes de o atleta confirmar. */
export function diffPlans(before: PlanDay[], after: PlanDay[]) {
  const b = new Map(before.map((d) => [key(d), d]));
  const a = new Map(after.map((d) => [key(d), d]));
  return {
    removed: before.filter((d) => !a.has(key(d))),
    added: after.filter((d) => !b.has(key(d))),
    changed: after.flatMap((d) => {
      const o = b.get(key(d));
      return o && (o.estMinutes !== d.estMinutes || o.title !== d.title) ? [{ before: o, after: d }] : [];
    }),
  };
}

const RUN_TYPES = ['leve', 'longao', 'intervalado', 'tempo', 'ativacao'];

/** Treinos de corrida planejados (já filtrados para o dia analisado) sem corrida no Strava e sem "não deu". */
export function missedCandidates(o: {
  planned: PlanDay[]; execs: { executed_on: string; sport: string | null }[]; skipped: SkippedInput[];
}): PlanDay[] {
  return o.planned.filter((p) =>
    RUN_TYPES.includes(p.type)
    && !o.execs.some((e) => e.executed_on === p.date && /run/i.test(e.sport ?? ''))
    && !o.skipped.some((s) => s.date === p.date && s.type === p.type));
}
