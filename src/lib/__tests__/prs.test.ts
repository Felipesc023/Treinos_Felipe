import { describe, expect, it } from 'vitest';
import { stravaPrs } from '../prs';

describe('stravaPrs', () => {
  it('lê nomes em maiúsculas do Strava e escolhe o melhor tempo e a data', () => {
    const r = stravaPrs([
      { executed_on: '2026-10-08', best_efforts: [{ name: '400m', elapsed_time: 94 }, { name: '5K', elapsed_time: 1600 }] },
      { executed_on: '2026-10-17', best_efforts: [{ name: '5K', elapsed_time: 1515 }, { name: '10K', elapsed_time: 3122 }] },
      { executed_on: '2026-10-21', best_efforts: null },
    ]);
    expect(r).toEqual([
      { distance_m: 5000, time_seconds: 1515, achieved_on: '2026-10-17' },
      { distance_m: 10000, time_seconds: 3122, achieved_on: '2026-10-17' },
    ]);
  });
  it('meia e maratona entram; esforços curtos não', () => {
    const r = stravaPrs([{ executed_on: '2026-11-01', best_efforts: [{ name: 'Half-Marathon', elapsed_time: 7000 }, { name: '1K', elapsed_time: 199 }] }]);
    expect(r.map((x) => x.distance_m)).toEqual([21097]);
  });
});
