import { describe, expect, it } from 'vitest';
import { DEFAULT_FITNESS, fitnessFrom, longRunKm, weekRequests, type WeekInput } from '../coach';

const base: WeekInput = {
  phase: 'base', i: 0, seed: 0, deload: false, fitness: { longRunKm: 11, weeklyKm: 20 },
  settings: { runsPerWeek: 3, gymPerWeek: 2 }, p5k: 303, weekStart: '2026-11-01',
};

describe('longRunKm', () => {
  it('parte de ~85% do que o atleta já correu e sobe 1 km por semana até o teto da prova', () => {
    const km = (i: number) => longRunKm({ phase: 'base', i, deload: false, fitness: base.fitness, raceDistanceM: 5000 });
    expect([km(0), km(1), km(2)]).toEqual([9, 10, 11]);
    expect(km(10)).toBe(12);
  });
  it('semana de descarga reduz 20% e o taper reduz bem mais', () => {
    expect(longRunKm({ phase: 'base', i: 3, deload: true, fitness: base.fitness, raceDistanceM: 5000 })).toBe(10);
    expect(longRunKm({ phase: 'taper', i: 7, deload: false, fitness: base.fitness, raceDistanceM: 5000 })).toBeLessThan(8);
  });
});

describe('weekRequests', () => {
  const types = (o: Partial<WeekInput>) => weekRequests({ ...base, ...o }).map((r) => r.type);
  it('respeita quantos treinos por semana o atleta quer', () => {
    expect(types({}).filter((t) => t === 'longao' || t === 'leve')).toHaveLength(3);
    expect(types({ settings: { runsPerWeek: 2, gymPerWeek: 0 } })).toEqual(['longao', 'leve']);
    expect(types({ settings: { runsPerWeek: 4, gymPerWeek: 2 } }).filter((t) => t.startsWith('academia'))).toHaveLength(2);
  });
  it('os treinos de qualidade variam de uma semana para outra', () => {
    const q = (seed: number) => {
      const r = weekRequests({ ...base, phase: 'velocidade', seed }).find((x) => x.type === 'intervalado' || x.type === 'tempo')!;
      return JSON.stringify(r.spec);
    };
    expect(new Set([0, 1, 2, 3, 4, 5].map(q)).size).toBe(6);
  });
  it('todo treino de corrida carrega km e estimativa de minutos coerente', () => {
    for (const r of weekRequests({ ...base, phase: 'velocidade' }).filter((x) => !x.type.startsWith('academia'))) {
      expect(r.spec?.km).toBeGreaterThan(0);
      expect(r.estMinutes).toBeGreaterThan(15);
    }
  });
});

describe('fitnessFrom', () => {
  it('sem corridas recentes usa o padrão', () => {
    expect(fitnessFrom([], '2026-11-01')).toEqual(DEFAULT_FITNESS);
  });
  it('maior corrida vira o longão de referência; ignora corridas antigas', () => {
    const f = fitnessFrom([
      { executed_on: '2026-10-17', distance_m: 10272 }, { executed_on: '2026-10-21', distance_m: 6017 },
      { executed_on: '2025-01-01', distance_m: 30000 },
    ], '2026-11-01');
    expect(f.longRunKm).toBeCloseTo(10.27, 2);
  });
});
