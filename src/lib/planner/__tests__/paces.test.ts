import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import {
  assessGoal, formatPace, formatTime, referencePace5k, repSeconds, riegel, zonesFrom,
} from '../paces';

describe('ritmos e metas', () => {
  const prs = [
    { distanceM: 5000, timeSeconds: 24 * 60 },
    { distanceM: 10000, timeSeconds: 52 * 60 },
  ];

  it('Riegel: 5 km 24:00 projeta 10 km ≈ 50:02', () => {
    expect(formatTime(riegel(24 * 60, 5000, 10000))).toBe('50:02');
  });

  it('usa o MELHOR 5 km projetado como referência (288 s/km = 4:48)', () => {
    const p = referencePace5k(prs);
    expect(p).toBeCloseTo(288, 5);
    expect(formatPace(p)).toBe('4:48');
  });

  it('zonas batem com o plano usado na prática', () => {
    const z = zonesFrom(288);
    expect(z.leve.map(formatPace)).toEqual(['6:00', '6:20']);
    expect(z.longao.map(formatPace)).toEqual(['5:50', '6:10']);
    expect(z.rep1000.map(formatPace)).toEqual(['4:40', '4:50']);
  });

  it('tempo das repetições nas zonas padrão do app', () => {
    const z = zonesFrom(288);
    expect(repSeconds(z.rep400[0], 400)).toBeCloseTo(106.4, 1); // 1:46
    expect(formatTime(repSeconds(z.rep400[1], 400))).toBe('1:51');
    expect(formatTime(repSeconds(z.rep600[0], 600))).toBe('2:42');
    expect(formatTime(repSeconds(z.rep800[0], 800))).toBe('3:41');
    expect(formatTime(repSeconds(z.rep800[1], 800))).toBe('3:49');
  });

  describe('T3: avaliação de meta', () => {
    it('24:00 → 22:30 em 8 semanas é ambiciosa (6,25% > 6%)', () => {
      const a = assessGoal(1440, 1350, 8, DEFAULT_CONFIG);
      expect(a.level).toBe('ambiciosa');
      expect(a.neededPct).toBeCloseTo(0.0625, 4);
    });
    it('24:00 → 23:30 em 8 semanas é realista', () => {
      expect(assessGoal(1440, 1410, 8, DEFAULT_CONFIG).level).toBe('realista');
    });
    it('meta de 22:30 com ~0,5 semana efetiva (9 dias parado) é inviável', () => {
      const a = assessGoal(1440, 1350, 0.5, DEFAULT_CONFIG);
      expect(a.level).toBe('inviavel');
      expect(a.message).toContain('terminar');
    });
    it('meta mais lenta que o PR nunca é "inviável"', () => {
      expect(assessGoal(1440, 1500, 0, DEFAULT_CONFIG).level).toBe('realista');
    });
  });
});
