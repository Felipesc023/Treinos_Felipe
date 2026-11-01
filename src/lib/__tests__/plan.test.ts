import { describe, expect, it } from 'vitest';
import { addDays, diffDays, validatePlan, weekStartSunday } from '@/lib/planner';
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

const sum = (days: { date: string; estMinutes: number }[], from: string, to: string) =>
  days.filter((d) => d.date >= from && d.date <= to).reduce((n, d) => n + d.estMinutes, 0);

describe('generatePlan: saúde, treino perdido e modo sem prova', () => {
  const race = { name: '5 km', date: '2026-12-20', distanceM: 5000 };
  const prs = [{ distanceM: 5000, timeSeconds: 1500 }];
  const surgery = [{ kind: 'afastamento' as const, from: '2026-10-28', to: '2027-01-04', mode: 'parar' as const }];

  it('cirurgia sem prova: nada até a liberação e depois retomada leve', () => {
    const p = generatePlan({ today: '2026-11-01', prs: [], health: surgery });
    const base = generatePlan({ today: '2027-01-03', prs: [] });
    expect(p.days.length).toBeGreaterThan(0);
    expect(p.days.every((d) => d.date > '2027-01-04')).toBe(true);
    const wk = (n: number) => addDays(weekStartSunday('2027-01-05'), n * 7);
    for (let k = 0; k < 5; k++) {
      const wd = p.days.filter((d) => d.date >= wk(k) && d.date < wk(k + 1));
      expect(wd.length).toBeGreaterThan(0);
      expect(wd.every((d) => d.phase === 'retomada' && d.type !== 'intervalado' && d.type !== 'tempo')).toBe(true);
    }
    const ratio = sum(p.days, wk(0), addDays(wk(1), -1)) / sum(base.days, wk(0), addDays(wk(1), -1));
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
    expect(p.days.filter((d) => d.date >= wk(5)).every((d) => d.phase !== 'retomada')).toBe(true);
  });

  it('dor com restrição: nada acima da intensidade 2 no período', () => {
    const health = [{ kind: 'dor' as const, from: '2026-11-09', to: '2026-11-22', mode: 'seguir_restrito' as const, region: 'panturrilha' }];
    const p = generatePlan({ today: '2026-11-01', race, prs, health });
    expect(p.days.filter((d) => d.date >= '2026-11-09' && d.date <= '2026-11-22').every((d) => d.intensity <= 2)).toBe(true);
    const v = validatePlan(p.days, { template: DEFAULT_TEMPLATE, raceDate: race.date,
      restrictions: [{ from: '2026-11-09', to: '2026-11-22', label: 'Dor', maxIntensity: 2 }] });
    expect(v).toEqual([]);
  });

  it('treino-chave perdido: reencaixado de hoje em diante ou descartado com motivo', () => {
    const base = generatePlan({ today: '2026-11-01', race, prs });
    const key = base.days.find((d) => d.type === 'intervalado' || d.type === 'tempo')!;
    const today = addDays(key.date, 1);
    const p = generatePlan({ today, race, prs, skipped: [{ date: key.date, type: key.type }] });
    const week = weekStartSunday(today);
    const placed = p.days.find((d) => d.type === key.type && d.date >= week && d.date < addDays(week, 7));
    if (placed) expect(placed.date >= today).toBe(true);
    else expect(p.dropped.some((x) => x.request.type === key.type && x.reason.length > 0)).toBe(true);
  });

  it('perdeu vários: reduz o volume das 2 próximas semanas, depois volta ao normal', () => {
    const skipped = ['2026-10-20', '2026-10-22', '2026-10-25'].map((date) => ({ date, type: 'leve' as const }));
    const base = generatePlan({ today: '2026-11-01', race, prs });
    const p = generatePlan({ today: '2026-11-01', race, prs, skipped });
    expect(sum(p.days, '2026-11-01', '2026-11-07')).toBeLessThan(sum(base.days, '2026-11-01', '2026-11-07'));
    expect(sum(p.days, '2026-11-15', '2026-11-21')).toBe(sum(base.days, '2026-11-15', '2026-11-21'));
  });

  it('prova dentro do afastamento: mantém a prova e avisa', () => {
    const health = [{ kind: 'afastamento' as const, from: '2026-12-10', to: '2026-12-31', mode: 'parar' as const }];
    const p = generatePlan({ today: '2026-11-01', race, prs, health });
    expect(p.days.some((d) => d.type === 'prova')).toBe(true);
    expect(p.warnings.some((w) => w.includes('dentro do afastamento'))).toBe(true);
  });

  it('eventos sobrepostos não quebram nem duplicam treinos', () => {
    const health = [
      { kind: 'afastamento' as const, from: '2026-11-03', to: '2026-11-20', mode: 'parar' as const },
      { kind: 'dor' as const, from: '2026-11-15', to: '2026-11-30', mode: 'seguir_restrito' as const, region: 'joelho' },
    ];
    const p = generatePlan({ today: '2026-11-01', race, prs, health });
    const keys = p.days.map((d) => `${d.date}|${d.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sem prova e sem recordes: plano de manutenção, sem dia de prova', () => {
    const p = generatePlan({ today: '2026-11-01', prs: [] });
    expect(p.days.length).toBeGreaterThan(0);
    expect(p.days.every((d) => d.phase === 'manutencao' && d.type !== 'prova')).toBe(true);
  });

  it('região afetada: a academia poupa a parte do corpo durante o evento e por 21 dias depois', () => {
    const withRegion = generatePlan({ today: '2026-11-01', prs: [], health: [{ ...surgery[0]!, region: 'abdomen' }] });
    const without = generatePlan({ today: '2026-11-01', prs: [], health: surgery });
    const text = (p: typeof withRegion, from: string, to: string) =>
      p.days.filter((d) => d.date >= from && d.date <= to).flatMap((d) => d.detail).join(' ');
    expect(text(without, '2027-01-05', '2027-01-25')).toMatch(/abdominal/i);
    expect(text(withRegion, '2027-01-05', '2027-01-25')).not.toMatch(/abdominal/i);
    expect(text(withRegion, '2027-01-26', '2027-02-28')).toMatch(/abdominal/i);
  });

  it('prova a 20 semanas: plano válido e calculado rápido (antes cada semana revalidava o plano inteiro)', () => {
    const long = { name: 'Meia', date: '2027-03-21', distanceM: 21097 };
    const t0 = performance.now();
    const p = generatePlan({ today: '2026-11-01', race: long, prs });
    expect(performance.now() - t0).toBeLessThan(400);
    expect(validatePlan(p.days, { template: DEFAULT_TEMPLATE, raceDate: long.date })).toEqual([]);
    expect(p.days.at(-1)?.type).toBe('prova');
  });
});
