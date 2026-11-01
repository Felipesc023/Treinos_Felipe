import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { allocatePhases, classifyCycle } from '../phases';

describe('T7: periodização', () => {
  it('ciclo de 8 semanas de 5 km = 3 base + 3 velocidade + 1 pico + 1 taper', () => {
    expect(allocatePhases(8, 5000, DEFAULT_CONFIG)).toMatchObject({
      cycleType: 'padrao', base: 3, speed: 3, peak: 1, taper: 1,
    });
  });
  it('as fases sempre somam as semanas disponíveis', () => {
    for (const dist of [5000, 10000, 21097, 42195]) {
      for (let weeks = 0; weeks <= 30; weeks++) {
        const p = allocatePhases(weeks, dist, DEFAULT_CONFIG);
        expect(p.base + p.speed + p.peak + p.taper + p.maintenance).toBe(weeks);
      }
    }
  });
  it('ciclo curto (≈16 dias) não cria base nova', () => {
    const p = allocatePhases(3, 10000, DEFAULT_CONFIG);
    expect(p.cycleType).toBe('curto');
    expect(p.base).toBe(0);
    expect(p.taper).toBe(1);
  });
  it('taper cresce com a distância', () => {
    expect(allocatePhases(16, 5000, DEFAULT_CONFIG).taper).toBe(1);
    expect(allocatePhases(16, 21097, DEFAULT_CONFIG).taper).toBe(2);
    expect(allocatePhases(16, 42195, DEFAULT_CONFIG).taper).toBe(3);
  });
  it('classificação por semanas', () => {
    expect([13, 8, 4, 1].map(classifyCycle)).toEqual(['longo', 'padrao', 'curto', 'manutencao']);
  });
});
