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
  /** Cadência/instrução de execução desta semana (muda no rodízio). */
  tempo?: string;
}

/** Ondas de 3 semanas: referência → volume (+2 reps, carga −5%) → força (−2 reps, carga maior). */
const WAVES = [
  { delta: 0, note: 'Semana de referência: pare com 2 repetições na reserva. Se fechou todas as séries no topo das repetições na semana passada, suba a carga.' },
  { delta: 2, note: 'Semana de volume: reduza a carga ~5% e some repetições, com técnica limpa.' },
  { delta: -2, note: 'Semana de força: carga mais alta, menos repetições e descanso de 2 min entre as séries.' },
] as const;
const TEMPOS = ['2 s para subir, 2 s para descer', 'pausa de 1 s no ponto de maior esforço', 'descida lenta, 3 s'] as const;
/** Padrões em que a onda não mexe nas repetições (volume alto por natureza). */
const FIXED_REPS: MovementPattern[] = ['calf', 'core', 'lumbar'];

export interface GymSession {
  kind: GymKind;
  block: GymBlock;
  items: GymItem[];
  /** Padrões de movimento sem exercício elegível (ex.: lesão) — nada é inventado para preencher. */
  skippedPatterns: MovementPattern[];
  /** Orientação da semana (referência, volume ou força). */
  note: string;
}

export interface BuildGymOptions {
  prefs?: AthleteGymPrefs;
  restrictions?: GymRestrictions;
  library?: Exercise[];
  /** Fator de volume nas séries (taper: 0,5–0,7). */
  volumeFactor?: number;
  /** Número da semana: gira o exercício de cada padrão, as repetições e a cadência. Sem ele, sempre a 1ª opção. */
  variant?: number;
}

export function buildGymSession(kind: GymKind, block: GymBlock, opts: BuildGymOptions = {}): GymSession {
  const prefs = opts.prefs ?? DEFAULT_GYM_PREFS;
  const eligible = eligibleExercises(opts.library ?? EXERCISE_LIBRARY, prefs, opts.restrictions);
  const factor = opts.volumeFactor ?? 1;
  const schemeFor = (p: MovementPattern): Scheme =>
    SCHEME[block][p] ?? SCHEME[1][p] ?? { sets: 3, reps: [10, 10] };

  const v = opts.variant;
  const wave = WAVES[Math.abs(v ?? 0) % WAVES.length]!;

  const items: GymItem[] = [];
  const skippedPatterns: MovementPattern[] = [];

  for (const pattern of PATTERNS[block][kind]) {
    const options = eligible.filter((e) => e.pattern === pattern);
    if (!options.length) { skippedPatterns.push(pattern); continue; }
    const chosen = options[v === undefined ? 0 : Math.abs(v) % options.length]!;
    const s = schemeFor(pattern);
    const delta = v === undefined || FIXED_REPS.includes(pattern) ? 0 : wave.delta;
    items.push({
      exerciseId: chosen.id, name: chosen.name, pattern,
      sets: factor === 1 ? s.sets : Math.max(2, Math.round(s.sets * factor)),
      repsMin: Math.max(6, s.reps[0] + delta), repsMax: Math.max(6, s.reps[1] + delta),
      ...(v === undefined ? {} : { tempo: TEMPOS[(Math.abs(v) + items.length) % TEMPOS.length] }),
    });
  }
  return { kind, block, items, skippedPatterns, note: v === undefined ? '' : wave.note };
}

/** Bloco de academia segundo a fase da corrida. */
export function blockForPhase(phase: 'retomada' | 'base' | 'velocidade' | 'pico' | 'taper'): GymBlock {
  if (phase === 'velocidade') return 2;
  if (phase === 'pico' || phase === 'taper') return 3;
  return 1;
}
