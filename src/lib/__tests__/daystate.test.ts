import { describe, expect, it } from 'vitest';
import { dayState } from '../daystate';
import type { PlanDay } from '../plan';

const plan = (date: string, type: PlanDay['type']): PlanDay => ({
  date, type, title: type, intensity: 2, legLoad: 1, estMinutes: 45, rationale: '', phase: 'base', steps: [], detail: [],
});
const base = { zones: null, today: '2026-11-05' };
const run = (date: string) => ({ executed_on: date, sport: 'Run', distance_m: 6000, duration_s: 2200, avg_pace_s_km: 370 });

describe('dayState', () => {
  it('sem plano, descanso e prova: livre', () => {
    expect(dayState({ ...base, plan: undefined, execs: [], skipped: [] })).toBe('livre');
    expect(dayState({ ...base, plan: plan('2026-11-03', 'descanso'), execs: [], skipped: [] })).toBe('livre');
  });
  it('corrida no dia: feito; sem nada no passado: perdido; hoje ou futuro: pendente', () => {
    expect(dayState({ ...base, plan: plan('2026-11-03', 'leve'), execs: [run('2026-11-03')], skipped: [] })).toBe('feito');
    expect(dayState({ ...base, plan: plan('2026-11-03', 'leve'), execs: [], skipped: [] })).toBe('perdido');
    expect(dayState({ ...base, plan: plan('2026-11-06', 'leve'), execs: [], skipped: [] })).toBe('pendente');
  });
  it('"não fiz" vale mais que o Strava; com outra atividade no dia vira "outra"', () => {
    const skipped = [{ skipped_on: '2026-11-03', workout_type: 'leve' }];
    expect(dayState({ ...base, plan: plan('2026-11-03', 'leve'), execs: [], skipped })).toBe('nao_fiz');
    expect(dayState({ ...base, plan: plan('2026-11-03', 'leve'), execs: [{ executed_on: '2026-11-03', sport: 'Soccer', distance_m: 0, duration_s: 3000, avg_pace_s_km: null }], skipped })).toBe('outra');
  });
});
