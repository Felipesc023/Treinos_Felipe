import type { PlannerConfig } from './config';

export interface PersonalRecordInput {
  distanceM: number;
  timeSeconds: number;
}

/** Fórmula de Riegel: T2 = T1 × (D2/D1)^1,06 */
export function riegel(t1: number, d1: number, d2: number, exponent = 1.06): number {
  return t1 * Math.pow(d2 / d1, exponent);
}

export function paceSecPerKm(timeSeconds: number, distanceM: number): number {
  return timeSeconds / (distanceM / 1000);
}

export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatTime(seconds: number): string {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Pace de referência (s/km) = melhor 5 km projetado entre todos os PRs.
 * Usa o MELHOR resultado, para um PR antigo/fraco numa distância não puxar as zonas para baixo.
 */
export function referencePace5k(prs: PersonalRecordInput[]): number {
  if (prs.length === 0) throw new Error('Informe pelo menos um recorde pessoal.');
  const best5kSeconds = Math.min(...prs.map((p) => riegel(p.timeSeconds, p.distanceM, 5000)));
  return paceSecPerKm(best5kSeconds, 5000);
}

/** Offsets (s/km) sobre o pace de 5 km. Quanto mais curta a repetição, mais rápido. */
export const ZONE_OFFSETS = {
  leve: [72, 92],
  longao: [62, 82],
  tempo: [15, 25],
  rep1000: [-8, 2],
  rep800: [-12, -2],
  rep600: [-18, -8],
  rep400: [-22, -10],
} as const satisfies Record<string, readonly [number, number]>;

export type ZoneName = keyof typeof ZONE_OFFSETS;
/** [mais rápido, mais lento] em s/km */
export type PaceRange = readonly [number, number];

export function zonesFrom(p5k: number): Record<ZoneName, PaceRange> {
  const out = {} as Record<ZoneName, PaceRange>;
  for (const name of Object.keys(ZONE_OFFSETS) as ZoneName[]) {
    const [a, b] = ZONE_OFFSETS[name];
    out[name] = [p5k + a, p5k + b];
  }
  return out;
}

/** Tempo de uma repetição (segundos) para um pace e distância. */
export function repSeconds(paceSecPerKm: number, repMeters: number): number {
  return (paceSecPerKm * repMeters) / 1000;
}

export type GoalLevel = 'realista' | 'ambiciosa' | 'inviavel';

export interface GoalAssessment {
  level: GoalLevel;
  neededPct: number;
  allowedPct: number;
  message: string;
}

/**
 * Compara a melhora exigida com a melhora plausível no tempo efetivo de treino.
 * Heurística (configurável), não lei: 0,8%/semana, teto de 6% por ciclo.
 */
export function assessGoal(
  prSeconds: number,
  goalSeconds: number,
  effectiveWeeks: number,
  cfg: Pick<PlannerConfig, 'improvementPerWeek' | 'maxImprovementPerCycle'>,
): GoalAssessment {
  const needed = (prSeconds - goalSeconds) / prSeconds;
  const allowed = Math.min(
    cfg.maxImprovementPerCycle,
    Math.max(0, effectiveWeeks) * cfg.improvementPerWeek,
  );
  const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;

  if (needed <= allowed) {
    return { level: 'realista', neededPct: needed, allowedPct: allowed,
      message: `Meta exige ${pct(Math.max(needed, 0))} de melhora; o plano comporta até ${pct(allowed)}.` };
  }
  if (needed <= allowed * 1.5) {
    return { level: 'ambiciosa', neededPct: needed, allowedPct: allowed,
      message: `Meta exige ${pct(needed)} de melhora; o plano comporta cerca de ${pct(allowed)}. Possível, mas exige ciclo sem interrupções.` };
  }
  return { level: 'inviavel', neededPct: needed, allowedPct: allowed,
    message: `Meta exige ${pct(needed)} de melhora; no tempo disponível o plano comporta cerca de ${pct(allowed)}. Sugestão: correr para terminar, com largada conservadora.` };
}
