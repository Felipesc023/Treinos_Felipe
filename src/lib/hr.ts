const isRun = (s: string | null) => /run/i.test(s ?? '');

/** Quantas corridas com FC o histórico precisa ter para a estimativa valer (menos que isso: sem avisos de FC). */
const MIN_RUNS = 5;

/**
 * FC máxima estimada só pelo histórico do Strava: a FC máxima de cada corrida, ignorando os ~10% mais altos
 * (picos de sensor) e usando o próximo valor. Com poucas corridas não chuta: devolve null.
 */
export function estimateMaxHr(execs: { sport: string | null; max_hr: number | null }[]): number | null {
  const peaks = execs.filter((e) => isRun(e.sport) && (e.max_hr ?? 0) >= 120).map((e) => e.max_hr!).sort((a, b) => b - a);
  if (peaks.length < MIN_RUNS) return null;
  return peaks[Math.floor(peaks.length * 0.1)]!;
}
