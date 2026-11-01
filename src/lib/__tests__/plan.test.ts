import { describe, expect, it } from 'vitest';
import { diffDays, validatePlan } from '@/lib/planner';
import { DEFAULT_TEMPLATE, generatePlan } from '../plan';

describe('generatePlan', () => {
  const race = { name: '5 km', date: '2026-12-20', distanceM: 5000 };
  const plan = generatePlan({ today: '2026-11-01', race, prs: [{ distanceM: 5000, timeSeconds: 1500 }] });

  it('não viola nenhuma regra dura e termina na prova', () => {
    const v = validatePlan(plan.days, { template: DEFAULT_TEMPLATE, raceDate: race.date });
    expect(v).toEqual([]);
    expect(plan.days.at(-1)?.type).toBe('prova');
    expect(plan.days.filter((d) => d.type === 'prova')).toHaveLength(1);
  });

  it('não agenda nada antes de hoje nem depois da prova', () => {
    expect(plan.days.every((d) => d.date >= '2026-11-01' && diffDays(race.date, d.date) >= 0)).toBe(true);
  });

  it('funciona com prova na semana atual e sem PRs', () => {
    const p = generatePlan({ today: '2026-11-01', race: { ...race, date: '2026-11-04' }, prs: [] });
    expect(p.days.some((d) => d.type === 'prova')).toBe(true);
    expect(validatePlan(p.days, { template: DEFAULT_TEMPLATE, raceDate: '2026-11-04' })).toEqual([]);
  });
});
