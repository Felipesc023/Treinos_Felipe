import { describe, expect, it } from 'vitest';
import { evaluateWorkout, weekSummary, type ExecLike } from '../evaluate';
import type { PlanDay } from '../plan';
import { zonesFrom } from '../planner';

const day = (date: string, type: PlanDay['type'], km?: number): PlanDay => ({
  date, type, title: type, intensity: 2, legLoad: 1, estMinutes: 45, rationale: '', phase: 'base', steps: [], detail: [], ...(km ? { spec: { km } } : {}),
});
const run = (date: string, km: number, pace: number): ExecLike => ({
  executed_on: date, sport: 'Run', distance_m: km * 1000, duration_s: km * pace, avg_pace_s_km: pace,
});
const zones = zonesFrom(303); // leve ≈ 6:15–6:35
const TODAY = '2026-11-05';

describe('evaluateWorkout', () => {
  it('corrida no volume e no ritmo previstos: feito, sem alertas', () => {
    const r = evaluateWorkout(day('2026-11-03', 'leve', 6), [run('2026-11-03', 6.1, 380)], zones, TODAY);
    expect(r.status).toBe('feito');
    expect(r.flags).toEqual([]);
    expect(r.lines[0]).toBe('6,1 km feitos de 6 km planejados.');
  });
  it('volume abaixo de 85% é parcial; acima de 115% avisa', () => {
    expect(evaluateWorkout(day('2026-11-03', 'leve', 6), [run('2026-11-03', 3.3, 380)], zones, TODAY).status).toBe('parcial');
    expect(evaluateWorkout(day('2026-11-03', 'leve', 6), [run('2026-11-03', 8, 380)], zones, TODAY).flags).toContain('Passou do volume planejado.');
  });
  it('leve feito rápido demais gera alerta', () => {
    const r = evaluateWorkout(day('2026-11-03', 'leve', 6), [run('2026-11-03', 6, 320)], zones, TODAY);
    expect(r.flags.some((f) => f.includes('leve precisa ser leve'))).toBe(true);
  });
  it('leve com FC acima de 85% da máxima avisa; sem FC máxima ou abaixo do limite, não', () => {
    const hr = (bpm: number): ExecLike => ({ ...run('2026-11-03', 6, 380), avg_hr: bpm });
    const d = day('2026-11-03', 'leve', 6);
    expect(evaluateWorkout(d, [hr(186)], zones, TODAY, 204).flags.some((f) => f.startsWith('FC média alta') && f.includes('91%'))).toBe(true);
    expect(evaluateWorkout(d, [hr(165)], zones, TODAY, 204).flags).toEqual([]);
    expect(evaluateWorkout(d, [hr(186)], zones, TODAY).flags).toEqual([]);
  });
  it('sem execução: passado é perdido, hoje e futuro são pendentes', () => {
    expect(evaluateWorkout(day('2026-11-03', 'longao', 10), [], zones, TODAY).status).toBe('perdido');
    expect(evaluateWorkout(day(TODAY, 'longao', 10), [], zones, TODAY).status).toBe('pendente');
  });
  it('academia conta com qualquer treino que não seja corrida no dia; corrida não conta como academia', () => {
    const gym: ExecLike = { executed_on: '2026-11-02', sport: 'WeightTraining', distance_m: null, duration_s: 3000, avg_pace_s_km: null };
    expect(evaluateWorkout(day('2026-11-02', 'academia_inferior'), [gym], zones, TODAY).status).toBe('feito');
    expect(evaluateWorkout(day('2026-11-02', 'academia_inferior'), [run('2026-11-02', 5, 380)], zones, TODAY).status).toBe('perdido');
  });
  it('academia: mostra duração e FC; sessão curta gera alerta', () => {
    const g = (min: number): ExecLike => ({ executed_on: '2026-11-02', sport: 'WeightTraining', distance_m: null, duration_s: min * 60, avg_pace_s_km: null, avg_hr: 118 });
    const ok = evaluateWorkout(day('2026-11-02', 'academia_inferior'), [g(55)], zones, TODAY);
    expect(ok.lines[0]).toBe('Academia: 55 min · FC média 118 bpm.');
    expect(ok.flags).toEqual([]);
    expect(evaluateWorkout(day('2026-11-02', 'academia_inferior'), [g(20)], zones, TODAY).flags[0]).toMatch(/curta/);
  });
});

describe('weekSummary', () => {
  it('conta treinos planejados e feitos na semana de hoje e soma os km', () => {
    const plan = [day('2026-11-03', 'leve', 6), day('2026-11-05', 'intervalado', 7), day('2026-11-07', 'longao', 10), day('2026-11-02', 'academia_inferior')];
    const execs = [run('2026-11-03', 6, 380), run('2026-11-04', 3, 400)];
    expect(weekSummary(plan, execs, zones, TODAY)).toEqual({
      runsPlanned: 3, runsDone: 1, gymPlanned: 1, gymDone: 0, kmPlanned: 23, kmDone: 9,
    });
  });
});
