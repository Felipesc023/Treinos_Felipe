import {
  DEFAULT_GYM_PREFS, EXERCISE_LIBRARY, eligibleExercises,
  type AthleteGymPrefs, type Exercise, type GymRestrictions, type MovementPattern,
} from './exercises';

/** Bloco 1 = base · Bloco 2 = força/potência (fase de velocidade) · Bloco 3 = pico/taper (volume reduzido). */
export type GymBlock = 1 | 2 | 3;
export type GymKind = 'inferior' | 'superior';

interface Scheme { sets: number; reps: [number, number] }

const PATTERNS: Record<GymBlock, Record<GymKind, MovementPattern[]>> = {
  1: {
    inferior: ['leg_press', 'knee_ext', 'knee_flex', 'calf', 'core', 'lumbar'],
    superior: ['push_h', 'pull_v', 'shoulder_press', 'adductor', 'abductor', 'core'],
  },
  2: {
    inferior: ['leg_press', 'knee_ext', 'knee_flex', 'calf', 'hip_thrust_machine', 'core'],
    superior: ['push_h', 'pull_v', 'pull_h', 'shoulder_press', 'adductor', 'abductor'],
  },
  3: {
    inferior: ['leg_press', 'knee_ext', 'knee_flex', 'calf', 'core'],
    superior: ['push_h', 'pull_v', 'shoulder_press', 'adductor', 'abductor'],
  },
};

const SCHEME: Record<GymBlock, Partial<Record<MovementPattern, Scheme>>> = {
  1: {
    leg_press: { sets: 4, reps: [10, 10] }, knee_ext: { sets: 3, reps: [12, 12] },
    knee_flex: { sets: 3, reps: [12, 12] }, calf: { sets: 4, reps: [15, 15] },
    core: { sets: 3, reps: [15, 15] }, lumbar: { sets: 3, reps: [12, 12] },
    push_h: { sets: 3, reps: [10, 10] }, pull_v: { sets: 3, reps: [10, 10] },
    shoulder_press: { sets: 3, reps: [10, 10] }, adductor: { sets: 3, reps: [12, 12] },
    abductor: { sets: 3, reps: [12, 12] },
  },
  2: {
    leg_press: { sets: 4, reps: [8, 8] }, knee_ext: { sets: 3, reps: [10, 10] },
    knee_flex: { sets: 3, reps: [10, 10] }, calf: { sets: 4, reps: [12, 12] },
    hip_thrust_machine: { sets: 3, reps: [12, 12] }, core: { sets: 3, reps: [15, 15] },
    push_h: { sets: 3, reps: [8, 8] }, pull_v: { sets: 3, reps: [8, 8] },
    pull_h: { sets: 3, reps: [10, 10] }, shoulder_press: { sets: 3, reps: [10, 10] },
    adductor: { sets: 3, reps: [12, 12] }, abductor: { sets: 3, reps: [12, 12] },
  },
  3: {}, // herda do bloco 1
};

export interface GymItem {
  exerciseId: string;
  name: string;
  pattern: MovementPattern;
  sets: number;
  repsMin: number;
  repsMax: number;
}

export interface GymSession {
  kind: GymKind;
  block: GymBlock;
  items: GymItem[];
  /** Padrões de movimento sem exercício elegível (ex.: lesão) — nada é inventado para preencher. */
  skippedPatterns: MovementPattern[];
}

export interface BuildGymOptions {
  prefs?: AthleteGymPrefs;
  restrictions?: GymRestrictions;
  library?: Exercise[];
  /** Fator de volume nas séries (taper: 0,5–0,7). */
  volumeFactor?: number;
}

export function buildGymSession(kind: GymKind, block: GymBlock, opts: BuildGymOptions = {}): GymSession {
  const prefs = opts.prefs ?? DEFAULT_GYM_PREFS;
  const eligible = eligibleExercises(opts.library ?? EXERCISE_LIBRARY, prefs, opts.restrictions);
  const factor = opts.volumeFactor ?? 1;
  const schemeFor = (p: MovementPattern): Scheme =>
    SCHEME[block][p] ?? SCHEME[1][p] ?? { sets: 3, reps: [10, 10] };

  const items: GymItem[] = [];
  const skippedPatterns: MovementPattern[] = [];

  for (const pattern of PATTERNS[block][kind]) {
    const chosen = eligible.find((e) => e.pattern === pattern);
    if (!chosen) { skippedPatterns.push(pattern); continue; }
    const s = schemeFor(pattern);
    items.push({
      exerciseId: chosen.id, name: chosen.name, pattern,
      sets: factor === 1 ? s.sets : Math.max(2, Math.round(s.sets * factor)),
      repsMin: s.reps[0], repsMax: s.reps[1],
    });
  }
  return { kind, block, items, skippedPatterns };
}

/** Bloco de academia segundo a fase da corrida. */
export function blockForPhase(phase: 'retomada' | 'base' | 'velocidade' | 'pico' | 'taper'): GymBlock {
  if (phase === 'velocidade') return 2;
  if (phase === 'pico' || phase === 'taper') return 3;
  return 1;
}

/**
 * Dupla progressão: sobe a carga só quando TODAS as séries bateram o topo das repetições
 * com esforço ≤ 8/10 em 2 sessões seguidas. Voltando de doença/lesão, retoma a 60–70%.
 */
export function nextLoadKg(opts: {
  lastLoadKg: number;
  hitTopRepsAllSetsLast2Sessions: boolean;
  rpeLast: number;
  stepPct?: number; // 0.025 – 0.05
  returningFromHealthEvent?: boolean;
}): number {
  if (opts.returningFromHealthEvent) return roundToPlate(opts.lastLoadKg * 0.65);
  if (opts.hitTopRepsAllSetsLast2Sessions && opts.rpeLast <= 8) {
    return roundToPlate(opts.lastLoadKg * (1 + (opts.stepPct ?? 0.03)));
  }
  return opts.lastLoadKg;
}

const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;
