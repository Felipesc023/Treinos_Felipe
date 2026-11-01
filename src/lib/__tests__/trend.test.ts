import { describe, expect, it } from 'vitest';
import { generatePlan } from '../plan';
import { weekTrend } from '../trend';

const prs = [{ distanceM: 5000, timeSeconds: 1500 }];
const past = generatePlan({ today: '2026-11-01', prs }).days;
const today = '2026-11-15';
const runDays = past.filter((d) => ['leve', 'longao', 'intervalado', 'tempo'].includes(d.type) && d.date < today);
const ran = (d: (typeof runDays)[number]) => ({
  executed_on: d.date, sport: 'Run', distance_m: (d.spec?.km ?? 5) * 1000, duration_s: 2400, avg_pace_s_km: 400,
});

describe('weekTrend', () => {
  it('fez tudo: mantém o plano', () => {
    const t = weekTrend({ past, execs: runDays.map(ran), zones: null, today })!;
    expect(t.factor).toBe(1);
    expect(t.done).toBe(t.planned);
  });
  it('fez menos da metade: reduz 20%', () => {
    const t = weekTrend({ past, execs: runDays.slice(0, 1).map(ran), zones: null, today })!;
    expect(t.factor).toBe(0.8);
    expect(t.message).toContain('20%');
  });
  it('treino "não deu" não conta contra', () => {
    const handled = runDays.map((d) => ({ date: d.date, type: d.type }));
    expect(weekTrend({ past, execs: [], zones: null, today, handled })).toBeNull();
  });
  it('pouco dado: sem decisão', () => {
    expect(weekTrend({ past: [], execs: [], zones: null, today })).toBeNull();
  });
});

describe('loadFactor no plano', () => {
  it('reduz o volume das duas primeiras semanas e só elas', () => {
    const sum = (days: { date: string; estMinutes: number }[], a: string, b: string) =>
      days.filter((d) => d.date >= a && d.date <= b).reduce((n, d) => n + d.estMinutes, 0);
    const base = generatePlan({ today, prs }).days;
    const cut = generatePlan({ today, prs, loadFactor: 0.8 }).days;
    expect(sum(cut, '2026-11-15', '2026-11-21')).toBeLessThan(sum(base, '2026-11-15', '2026-11-21'));
    expect(sum(cut, '2026-11-29', '2026-12-05')).toBe(sum(base, '2026-11-29', '2026-12-05'));
  });
});
