import { describe, expect, it } from 'vitest';
import { offPlanLoad, substituted } from '../actual';
import { generatePlan } from '../plan';

const prs = [{ distanceM: 5000, timeSeconds: 1500 }];

describe('offPlanLoad', () => {
  const soccer = { executed_on: '2026-11-03', sport: 'Soccer', duration_s: 3074 };
  it('futebol vira evento externo forte; bike curta, academia e dia com corrida não entram', () => {
    const r = offPlanLoad([
      soccer,
      { executed_on: '2026-11-02', sport: 'Ride', duration_s: 426 },
      { executed_on: '2026-11-02', sport: 'WeightTraining', duration_s: 3000 },
      { executed_on: '2026-11-01', sport: 'Soccer', duration_s: 3000 },
      { executed_on: '2026-11-01', sport: 'Run', duration_s: 1800 },
    ], '2026-11-03');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ date: '2026-11-03', type: 'externo', intensity: 4, legLoad: 3, estMinutes: 51 });
  });
  it('ignora o que está fora da janela', () => {
    expect(offPlanLoad([{ executed_on: '2026-10-20', sport: 'Soccer', duration_s: 3000 }], '2026-11-03')).toEqual([]);
  });
});

describe('substituted', () => {
  it('treino-chave sem corrida e com outra atividade no dia vira "não deu"', () => {
    const base = generatePlan({ today: '2026-11-01', prs });
    const key = base.days.find((d) => ['intervalado', 'tempo', 'longao'].includes(d.type))!;
    const actual = offPlanLoad([{ executed_on: key.date, sport: 'Soccer', duration_s: 3000 }], key.date, 0);
    expect(substituted(base.days, actual, [{ executed_on: key.date, sport: 'Soccer', duration_s: 3000 }], '2026-12-31'))
      .toEqual([{ date: key.date, type: key.type }]);
  });
});

describe('generatePlan com atividade fora do plano', () => {
  it('futebol hoje tira o esforço forte do dia seguinte', () => {
    const base = generatePlan({ today: '2026-11-01', prs });
    const hard = base.days.find((d) => d.intensity >= 4 && d.date > '2026-11-02')!;
    const today = new Date(Date.parse(hard.date) - 86_400_000).toISOString().slice(0, 10);
    const normal = generatePlan({ today, prs });
    expect(normal.days.some((d) => d.date === hard.date && d.intensity >= 4)).toBe(true);
    const actual = offPlanLoad([{ executed_on: today, sport: 'Soccer', duration_s: 3000 }], today);
    const after = generatePlan({ today, prs, actual });
    expect(after.days.some((d) => d.date === hard.date && d.intensity >= 4)).toBe(false);
  });
});
