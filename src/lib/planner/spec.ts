import type { SessionSpec } from './types';

/** Aplica um fator de volume ao detalhe do treino (retomada, treinos perdidos, versão reduzida). */
export function scaleSpec(s: SessionSpec | undefined, f: number): SessionSpec | undefined {
  if (!s || f >= 1) return s;
  return {
    ...s,
    ...(s.km ? { km: Math.max(2, Math.round(s.km * f * 2) / 2) } : {}),
    ...(s.reps ? { reps: Math.max(2, Math.round(s.reps * f)) } : {}),
    ...(s.steadyMin ? { steadyMin: Math.max(10, Math.round(s.steadyMin * f)) } : {}),
    ...(s.fartlekMin ? { fartlekMin: Math.max(8, Math.round(s.fartlekMin * f)) } : {}),
  };
}
