import { describe, expect, it } from 'vitest';
import { returnFactor, returnWeeks } from '../recovery';

describe('retomada', () => {
  it('duração: 1 semana a cada 14 dias parados, entre 2 e 8', () => {
    expect(returnWeeks(69)).toBe(5);
    expect(returnWeeks(3)).toBe(2);
    expect(returnWeeks(400)).toBe(8);
  });

  it('volume: começa em 50% e sobe 10% por semana até 100%', () => {
    expect(returnFactor(0)).toBe(0.5);
    expect(returnFactor(4)).toBe(0.9);
    expect(returnFactor(5)).toBe(1);
    expect(returnFactor(20)).toBe(1);
  });
});
