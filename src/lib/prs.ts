/** Nome do melhor esforço no Strava (minúsculas) → distância do recorde. Só ≥ 5 km: esforços curtos distorcem a projeção do plano. */
export const PR_BY_NAME: Record<string, number> = {
  '5k': 5000, '10k': 10000, '15k': 15000, '10 mile': 16093, '20k': 20000, 'half-marathon': 21097, '30k': 30000, 'marathon': 42195,
};

export interface EffortRow { executed_on: string; best_efforts: { name: string; elapsed_time: number }[] | null }

/** Melhor tempo por distância entre todas as corridas. O Strava varia a caixa dos nomes ("5K", "Half-Marathon"). */
export function stravaPrs(rows: EffortRow[]): { distance_m: number; time_seconds: number; achieved_on: string }[] {
  const best = new Map<number, { time_seconds: number; achieved_on: string }>();
  for (const r of rows) {
    for (const e of r.best_efforts ?? []) {
      const distance_m = PR_BY_NAME[e.name.toLowerCase()];
      if (distance_m && e.elapsed_time < (best.get(distance_m)?.time_seconds ?? Infinity)) {
        best.set(distance_m, { time_seconds: e.elapsed_time, achieved_on: r.executed_on });
      }
    }
  }
  return [...best].map(([distance_m, v]) => ({ distance_m, ...v })).sort((a, b) => a.distance_m - b.distance_m);
}
