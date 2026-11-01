import { describe, expect, it } from 'vitest';
import { weekdayOf } from '../dates';
import { makeRequest, scheduleWeek } from '../schedule';
import { TEMPLATE, soccer, w, withMax } from './fixtures';

const SUN = '2026-10-18'; // semana de 18 a 24/10
const dayOf = (ws: ReturnType<typeof scheduleWeek>['workouts'], type: string) =>
  ws.find((x) => x.type === type);

const standardRequests = () => [
  makeRequest('longao', 6, { title: 'Longão' }),
  makeRequest('intervalado', 4, { title: 'Intervalado' }),
  makeRequest('academia_inferior', 1, { title: 'Academia A' }),
  makeRequest('academia_superior', 5, { title: 'Academia B' }),
  makeRequest('leve', 2, { title: 'Corrida leve' }),
];

describe('agendador semanal', () => {
  it('semana normal: cada sessão cai no dia preferido, sem violações', () => {
    const r = scheduleWeek({ weekStart: SUN, template: TEMPLATE, requests: standardRequests() });
    expect(r.dropped).toHaveLength(0);
    expect(r.violations).toHaveLength(0);
    const byType = Object.fromEntries(r.workouts.map((x) => [x.type, weekdayOf(x.date)]));
    expect(byType).toEqual({
      academia_inferior: 1, leve: 2, intervalado: 4, academia_superior: 5, longao: 6,
    });
  });

  it('é determinístico', () => {
    const a = scheduleWeek({ weekStart: SUN, template: TEMPLATE, requests: standardRequests(), fixed: [soccer('2026-10-24')] });
    const b = scheduleWeek({ weekStart: SUN, template: TEMPLATE, requests: standardRequests(), fixed: [soccer('2026-10-24')] });
    expect(a).toEqual(b);
  });

  describe('T2: futebol no sábado', () => {
    const r = scheduleWeek({
      weekStart: SUN, template: TEMPLATE, requests: standardRequests(), fixed: [soccer('2026-10-24')],
    });
    it('o longão é descartado, com motivo', () => {
      expect(r.dropped).toHaveLength(1);
      expect(r.dropped[0]!.request.type).toBe('longao');
      expect(r.dropped[0]!.reason).toContain('Dois dias seguidos de esforço forte');
    });
    it('o resto da semana fica intacto e sem violações', () => {
      expect(r.violations).toHaveLength(0);
      expect(weekdayOf(dayOf(r.workouts, 'intervalado')!.date)).toBe(4);
      expect(weekdayOf(dayOf(r.workouts, 'academia_inferior')!.date)).toBe(1);
    });
  });

  describe('T5: tiro não cabe na quinta e sexta é véspera do futebol', () => {
    const requests = [
      makeRequest('intervalado', 4, { title: 'Intervalado', estMinutes: 60 }),
      makeRequest('academia_superior', 5, { title: 'Academia B', estMinutes: 30 }),
    ];
    const r = scheduleWeek({
      weekStart: SUN, template: withMax(4, 35), requests, fixed: [soccer('2026-10-24')],
    });
    it('o tiro vai para a sexta em versão reduzida (×0,67, intensidade 3)', () => {
      const t = dayOf(r.workouts, 'intervalado')!;
      expect(weekdayOf(t.date)).toBe(5);
      expect(t.reduced).toBe(true);
      expect(t.intensity).toBe(3);
      expect(t.estMinutes).toBe(40);
    });
    it('a academia superior assume a quinta e nada é descartado', () => {
      expect(weekdayOf(dayOf(r.workouts, 'academia_superior')!.date)).toBe(4);
      expect(r.dropped).toHaveLength(0);
      expect(r.violations).toHaveLength(0);
    });
  });

  it('o contexto de outra semana é respeitado (futebol no sábado anterior)', () => {
    // Longão no sábado 17/10 + perna no domingo seria R2; o agendador nunca deve pôr perna colada.
    const context = [w('2026-10-17', 'longao')];
    const r = scheduleWeek({
      weekStart: SUN, template: TEMPLATE, context,
      requests: [makeRequest('academia_inferior', 1)],
    });
    expect(r.violations).toHaveLength(0);
    expect(r.workouts[0]!.date).toBe('2026-10-19');
  });

  it('prova na semana: sem perna a menos de 5 dias nem esforço forte nos 3 dias antes', () => {
    const race = { ...w('2026-10-24', 'prova'), intensity: 5, title: 'Prova' };
    const r = scheduleWeek({
      weekStart: SUN, template: TEMPLATE, fixed: [race], raceDate: '2026-10-24',
      requests: [
        makeRequest('intervalado', 4, { reducible: false }),
        makeRequest('academia_inferior', 1),
        makeRequest('leve', 2),
      ],
    });
    expect(r.violations).toHaveLength(0);
    const t = dayOf(r.workouts, 'intervalado');
    expect(t === undefined || t.date <= '2026-10-21').toBe(true);
  });
});
