import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, eligibleExercises, DEFAULT_GYM_PREFS } from '../exercises';
import { blockForPhase, buildGymSession } from '../gym';

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
});

describe('rodízio do treino de academia', () => {
  const ids = (variant: number) => buildGymSession('inferior', 1, { variant }).items.map((i) => i.exerciseId).join(',');
  const reps = (variant: number) => buildGymSession('inferior', 1, { variant }).items.find((i) => i.pattern === 'leg_press')!.repsMax;

  it('semanas seguidas não repetem o mesmo treino', () => {
    expect(new Set([0, 1, 2, 3].map(ids)).size).toBeGreaterThanOrEqual(3);
    expect([reps(0), reps(1), reps(2)]).toEqual([10, 12, 8]);
  });
  it('sem variante, mantém a primeira opção (comportamento antigo)', () => {
    expect(buildGymSession('inferior', 1).items[0]!.exerciseId).toBe('leg-press-45');
  });
  it('a região poupada vale para todas as variantes', () => {
    for (const variant of [0, 1, 2, 3]) {
      const s = buildGymSession('inferior', 1, { variant, restrictions: { avoidRegions: ['abdomen'] } });
      expect(s.items.some((i) => i.pattern === 'core')).toBe(false);
    }
  });
  it('cada semana traz uma orientação (referência, volume ou força)', () => {
    expect(new Set([0, 1, 2].map((v) => buildGymSession('superior', 1, { variant: v }).note)).size).toBe(3);
  });
});
