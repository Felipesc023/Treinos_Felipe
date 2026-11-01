import { describe, expect, it } from 'vitest';
import type { PlanDay } from '../plan';
import { diffPlans, missedCandidates } from '../replan';

const day = (date: string, type: PlanDay['type'], estMinutes = 45, title: string = type): PlanDay => ({
  date, type, title, intensity: 2, legLoad: 1, estMinutes, rationale: '', phase: 'base', steps: [], detail: [],
});

describe('diffPlans', () => {
  it('separa removidos, adicionados e alterados; iguais ficam de fora', () => {
    const before = [day('2026-11-02', 'leve'), day('2026-11-03', 'longao', 75), day('2026-11-04', 'leve', 45)];
    const after = [day('2026-11-02', 'leve'), day('2026-11-03', 'longao', 40), day('2026-11-05', 'tempo')];
    const d = diffPlans(before, after);
    expect(d.removed.map((x) => x.date)).toEqual(['2026-11-04']);
    expect(d.added.map((x) => x.date)).toEqual(['2026-11-05']);
    expect(d.changed.map((x) => [x.before.estMinutes, x.after.estMinutes])).toEqual([[75, 40]]);
  });
});

describe('missedCandidates', () => {
  const planned = [day('2026-11-03', 'tempo')];
  it('treino de corrida planejado sem execução é candidato', () => {
    expect(missedCandidates({ planned, execs: [], skipped: [] })).toHaveLength(1);
  });
  it('execução de corrida na mesma data anula', () => {
    expect(missedCandidates({ planned, execs: [{ executed_on: '2026-11-03', sport: 'Run' }], skipped: [] })).toEqual([]);
  });
  it('musculação não conta como corrida', () => {
    expect(missedCandidates({ planned, execs: [{ executed_on: '2026-11-03', sport: 'WeightTraining' }], skipped: [] })).toHaveLength(1);
  });
  it('outra atividade do Strava no dia (futebol…) explica o dia: não pergunta', () => {
    expect(missedCandidates({ planned, execs: [{ executed_on: '2026-11-03', sport: 'Soccer' }], skipped: [] })).toEqual([]);
  });
  it('já marcado como "não deu" não reaparece', () => {
    expect(missedCandidates({ planned, execs: [], skipped: [{ date: '2026-11-03', type: 'tempo' }] })).toEqual([]);
  });
  it('academia nunca é candidata', () => {
    expect(missedCandidates({ planned: [day('2026-11-03', 'academia_inferior')], execs: [], skipped: [] })).toEqual([]);
  });
});
