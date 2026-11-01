import { describe, expect, it } from 'vitest';
import type { HealthEventRow } from '../db';
import { blockingAt, healthEventSchema, toHealthInput } from '../health';

const row = (o: Partial<HealthEventRow>): HealthEventRow => ({
  id: 'x', kind: 'afastamento', body_region: null, severity: null, mode: 'parar',
  started_on: '2026-10-28', expected_end_on: null, ended_on: null, status: 'ativo', ...o,
});

describe('toHealthInput', () => {
  it('afastamento ativo usa a previsão de volta', () => {
    expect(toHealthInput(row({ expected_end_on: '2027-01-04' }), '2026-11-01'))
      .toEqual({ kind: 'afastamento', from: '2026-10-28', to: '2027-01-04', mode: 'parar' });
  });
  it('liberado: ended_on vence a previsão', () => {
    expect(toHealthInput(row({ expected_end_on: '2027-01-04', ended_on: '2027-01-03', status: 'resolvido' }), '2027-01-04').to)
      .toBe('2027-01-03');
  });
  it('dor ativa sem fim previsto dura 14 dias a partir de hoje', () => {
    expect(toHealthInput(row({ kind: 'dor', mode: 'seguir_restrito' }), '2026-11-01').to).toBe('2026-11-15');
  });
  it('região vira region', () => {
    expect(toHealthInput(row({ kind: 'dor', mode: 'seguir_restrito', body_region: 'panturrilha' }), '2026-11-01').region).toBe('panturrilha');
  });
});

describe('healthEventSchema', () => {
  const ok = { kind: 'afastamento', mode: 'parar', from: '2026-10-28', to: '2027-01-04', region: '', severity: '' };
  it('aceita afastamento válido; campos vazios viram indefinidos', () => {
    const r = healthEventSchema.safeParse(ok);
    expect(r.success && r.data).toMatchObject({ from: '2026-10-28', to: '2027-01-04', region: undefined, severity: undefined });
  });
  it('rejeita fim antes do início e datas inválidas', () => {
    const r = healthEventSchema.safeParse({ ...ok, to: '2026-10-01' });
    expect(!r.success && r.error.issues[0]?.message).toBe('A data de fim não pode ser antes do início.');
    expect(healthEventSchema.safeParse({ ...ok, from: '' }).success).toBe(false);
  });
  it('intensidade fora de 1–5 é rejeitada', () => {
    expect(healthEventSchema.safeParse({ ...ok, kind: 'dor', severity: '9' }).success).toBe(false);
    expect(healthEventSchema.safeParse({ ...ok, kind: 'dor', severity: '3' }).success).toBe(true);
  });
});

describe('blockingAt', () => {
  const inputs = [
    { kind: 'dor' as const, from: '2026-11-01', to: '2026-11-10', mode: 'seguir_restrito' as const },
    { kind: 'afastamento' as const, from: '2026-10-28', to: '2027-01-04', mode: 'parar' as const },
  ];
  it('só afastamento e dor em modo parar bloqueiam', () => {
    expect(blockingAt(inputs, '2026-11-05')?.kind).toBe('afastamento');
    expect(blockingAt(inputs, '2027-01-05')).toBeUndefined();
    expect(blockingAt([inputs[0]!], '2026-11-05')).toBeUndefined();
  });
});
