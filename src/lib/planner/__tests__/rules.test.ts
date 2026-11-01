import { describe, expect, it } from 'vitest';
import { validatePlan } from '../rules';
import { TEMPLATE, soccer, w } from './fixtures';

const ctx = { template: TEMPLATE };
const rulesOf = (vs: ReturnType<typeof validatePlan>) => vs.map((v) => v.rule);

describe('validador de regras', () => {
  describe('T4: perna e corrida forte (R1/R2)', () => {
    it('perna na terça + intervalado na quinta VIOLA (só 1 dia inteiro)', () => {
      const vs = validatePlan([w('2026-10-20', 'academia_inferior'), w('2026-10-22', 'intervalado')], ctx);
      expect(rulesOf(vs)).toContain('R1');
      expect(vs.find((v) => v.rule === 'R1')!.message).toContain('1 dia inteiro');
    });
    it('perna na segunda + intervalado na quinta passa (2 dias inteiros)', () => {
      const vs = validatePlan([w('2026-10-19', 'academia_inferior'), w('2026-10-22', 'intervalado')], ctx);
      expect(vs.filter((v) => v.rule === 'R1')).toHaveLength(0);
    });
    it('perna na quarta + intervalado na quinta viola (o caso original que deu errado)', () => {
      const vs = validatePlan([w('2026-07-15', 'academia_inferior'), w('2026-07-16', 'intervalado')], ctx);
      expect(rulesOf(vs)).toContain('R1');
    });
    it('corrida forte na véspera de perna viola R2; com 1 dia inteiro passa', () => {
      expect(rulesOf(validatePlan([w('2026-10-19', 'longao'), w('2026-10-20', 'academia_inferior')], ctx))).toContain('R2');
      expect(rulesOf(validatePlan([w('2026-10-19', 'longao'), w('2026-10-21', 'academia_inferior')], ctx))).not.toContain('R2');
    });
    it('futebol conta como corrida forte (R4): perna 2 dias antes viola', () => {
      const vs = validatePlan([w('2026-10-22', 'academia_inferior'), soccer('2026-10-24')], ctx);
      expect(rulesOf(vs)).toContain('R1');
    });
  });

  describe('R3: dois dias seguidos de esforço forte', () => {
    it('intervalado + futebol no dia seguinte viola', () => {
      expect(rulesOf(validatePlan([w('2026-10-23', 'intervalado'), soccer('2026-10-24')], ctx))).toContain('R3');
    });
    it('versão reduzida (intensidade 3) ao lado do futebol passa', () => {
      const reduced = w('2026-10-23', 'intervalado', { intensity: 3 });
      expect(rulesOf(validatePlan([reduced, soccer('2026-10-24')], ctx))).not.toContain('R3');
    });
  });

  it('R0: duas sessões no mesmo dia', () => {
    expect(rulesOf(validatePlan([w('2026-10-20', 'leve'), w('2026-10-20', 'academia_superior')], ctx))).toContain('R0');
  });

  it('R5: treino em dia de descanso do padrão (domingo e quarta)', () => {
    expect(rulesOf(validatePlan([w('2026-10-21', 'leve')], ctx))).toContain('R5'); // quarta
    expect(rulesOf(validatePlan([w('2026-10-18', 'leve')], ctx))).toContain('R5'); // domingo
    expect(rulesOf(validatePlan([w('2026-10-20', 'leve')], ctx))).not.toContain('R5'); // terça
  });

  it('R5 não se aplica a evento externo nem à prova (domingo 15/11)', () => {
    const race = { ...w('2026-11-15', 'prova'), intensity: 5 };
    expect(rulesOf(validatePlan([soccer('2026-10-18'), race], ctx))).not.toContain('R5');
  });

  describe('R6: proximidade da prova (domingo 15/11)', () => {
    const raceCtx = { template: TEMPLATE, raceDate: '2026-11-15' };
    it('última perna ≥ 5 dias antes', () => {
      expect(rulesOf(validatePlan([w('2026-11-10', 'academia_inferior')], raceCtx))).not.toContain('R6'); // 5 dias
      expect(rulesOf(validatePlan([w('2026-11-12', 'academia_inferior')], raceCtx))).toContain('R6'); // 3 dias
    });
    it('véspera: intervalado viola; ativação de 25 min passa', () => {
      expect(rulesOf(validatePlan([w('2026-11-14', 'intervalado')], raceCtx))).toContain('R6');
      expect(rulesOf(validatePlan([w('2026-11-14', 'ativacao', { intensity: 1, estMinutes: 25 })], raceCtx))).not.toContain('R6');
    });
    it('nada forte nos 3 dias antes', () => {
      expect(rulesOf(validatePlan([w('2026-11-12', 'tempo')], raceCtx))).toContain('R6');
      expect(rulesOf(validatePlan([w('2026-11-10', 'tempo')], raceCtx))).not.toContain('R6');
    });
  });

  it('R7: sessão maior que o tempo disponível no dia', () => {
    const t = TEMPLATE.map((x) => (x.weekday === 4 ? { ...x, maxMinutes: 40 } : x));
    expect(rulesOf(validatePlan([w('2026-10-22', 'intervalado', { estMinutes: 60 })], { template: t }))).toContain('R7');
  });

  it('R8: doença "sem impacto" bloqueia corrida na janela, não fora dela', () => {
    const restrictions = [{ from: '2026-10-19', to: '2026-10-23', label: 'faringite', noImpact: true }];
    expect(rulesOf(validatePlan([w('2026-10-20', 'leve')], { template: TEMPLATE, restrictions }))).toContain('R8');
    expect(rulesOf(validatePlan([w('2026-10-27', 'leve')], { template: TEMPLATE, restrictions }))).not.toContain('R8');
  });
});
