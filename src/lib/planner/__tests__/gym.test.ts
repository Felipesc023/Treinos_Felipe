import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, eligibleExercises, DEFAULT_GYM_PREFS } from '../exercises';
import { blockForPhase, buildGymSession, nextLoadKg } from '../gym';

describe('T6: musculação só com máquina, sem equilíbrio', () => {
  it('o perfil padrão nunca retorna afundo búlgaro, agachamento livre nem unilateral', () => {
    const names = eligibleExercises(EXERCISE_LIBRARY, DEFAULT_GYM_PREFS).map((e) => e.name);
    expect(names).not.toContain('Afundo búlgaro');
    expect(names).not.toContain('Agachamento livre');
    expect(names).not.toContain('Passada lateral com elástico');
    expect(names).not.toContain('Prancha');
    expect(names).toContain('Leg press 45°');
  });

  it('inferior bloco 1 = a lista que você já treina', () => {
    const s = buildGymSession('inferior', 1);
    expect(s.items.map((i) => `${i.name} ${i.sets}x${i.repsMin}`)).toEqual([
      'Leg press 45° 4x10',
      'Cadeira extensora 3x12',
      'Mesa flexora 3x12',
      'Panturrilha em pé na máquina 4x15',
      'Cadeira abdominal (máquina) 3x15',
      'Banco de extensão lombar (máquina) 3x12',
    ]);
  });

  it('bloco 2 troca o estímulo: mais carga/menos reps e exercício novo', () => {
    const inf = buildGymSession('inferior', 2);
    expect(inf.items[0]).toMatchObject({ name: 'Leg press 45°', sets: 4, repsMin: 8 });
    expect(inf.items.some((i) => i.pattern === 'hip_thrust_machine')).toBe(true);
    const sup = buildGymSession('superior', 2);
    expect(sup.items.some((i) => i.name === 'Remada sentada (cabo)')).toBe(true);
  });

  it('taper reduz séries (mínimo 2)', () => {
    const s = buildGymSession('inferior', 3, { volumeFactor: 0.5 });
    expect(s.items.every((i) => i.sets >= 2)).toBe(true);
    expect(s.items[0]!.sets).toBe(2);
  });

  it('dor lombar ativa remove exercícios que sobrecarregam a lombar', () => {
    const s = buildGymSession('inferior', 1, { restrictions: { avoidRegions: ['lombar'] } });
    expect(s.items.some((i) => i.pattern === 'lumbar')).toBe(false);
    expect(s.skippedPatterns).toContain('lumbar');
  });

  it('bloco de academia acompanha a fase da corrida', () => {
    expect(blockForPhase('base')).toBe(1);
    expect(blockForPhase('velocidade')).toBe(2);
    expect(blockForPhase('taper')).toBe(3);
  });

  describe('progressão de carga', () => {
    it('sobe ~3% só se bateu o topo em 2 sessões com esforço ≤ 8', () => {
      expect(nextLoadKg({ lastLoadKg: 100, hitTopRepsAllSetsLast2Sessions: true, rpeLast: 7 })).toBe(102.5);
      expect(nextLoadKg({ lastLoadKg: 100, hitTopRepsAllSetsLast2Sessions: true, rpeLast: 9 })).toBe(100);
      expect(nextLoadKg({ lastLoadKg: 100, hitTopRepsAllSetsLast2Sessions: false, rpeLast: 6 })).toBe(100);
    });
    it('voltando de doença retoma a ~65%', () => {
      expect(nextLoadKg({ lastLoadKg: 100, hitTopRepsAllSetsLast2Sessions: true, rpeLast: 6, returningFromHealthEvent: true })).toBe(65);
    });
  });
});
