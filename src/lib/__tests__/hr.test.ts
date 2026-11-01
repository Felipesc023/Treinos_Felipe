import { describe, expect, it } from 'vitest';
import { estimateMaxHr } from '../hr';

const run = (max_hr: number | null) => ({ sport: 'Run', max_hr });

describe('estimateMaxHr', () => {
  it('poucas corridas com FC: não chuta', () => {
    expect(estimateMaxHr([run(190), run(195), run(200), run(null)])).toBeNull();
  });
  it('ignora o pico mais alto (sensor) em 10+ corridas', () => {
    const peaks = [230, 204, 200, 199, 199, 198, 196, 192, 191, 185];
    expect(estimateMaxHr(peaks.map(run))).toBe(204);
  });
  it('só conta corrida', () => {
    expect(estimateMaxHr([...[190, 191, 192, 193, 194].map(run), { sport: 'Soccer', max_hr: 220 }])).toBe(194);
  });
});
