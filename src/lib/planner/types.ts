import type { ISODate } from './dates';

export type WorkoutType =
  | 'leve' | 'longao' | 'intervalado' | 'tempo' | 'ativacao'
  | 'academia_inferior' | 'academia_superior'
  | 'prova' | 'descanso' | 'externo';

/** Estrutura de um treino de corrida (km, tiros, tempo contínuo…), para o detalhe e a comparação com o realizado. */
export interface SessionSpec {
  /** Distância total estimada (inclui aquecimento/desaquecimento nos treinos de qualidade). */
  km?: number;
  reps?: number; repM?: number; recM?: number;
  zone?: 'rep400' | 'rep600' | 'rep800' | 'rep1000';
  /** Minutos contínuos em ritmo de tempo. */
  steadyMin?: number;
  /** Aceleradas de 100 m no fim do leve. */
  strides?: number;
  /** Longão com final em ritmo mais forte. */
  progressive?: boolean;
  fartlekMin?: number;
}

export interface PlannedWorkout {
  date: ISODate;
  type: WorkoutType;
  title: string;
  /** 0–5. Base das regras de recuperação. */
  intensity: number;
  /** 0–3. Carga nas pernas. */
  legLoad: number;
  estMinutes: number;
  rationale: string;
  reduced?: boolean;
  spec?: SessionSpec;
}

/** Disponibilidade por dia da semana (0 = domingo). */
export interface DayTemplate {
  weekday: number;
  isRest: boolean;
  maxMinutes: number;
}

export interface HealthRestriction {
  from: ISODate;
  to: ISODate;
  label: string;
  noImpact?: boolean;
  maxIntensity?: number;
}

export interface SessionRequest {
  type: Exclude<WorkoutType, 'prova' | 'descanso' | 'externo'>;
  title: string;
  intensity: number;
  legLoad: number;
  estMinutes: number;
  /** Dia da semana preferido (0 = domingo). */
  preferredWeekday: number;
  /** Pode virar versão reduzida (×preEventVolumeFactor) se não couber inteira. */
  reducible?: boolean;
  /** Não pode cair antes desta data (reencaixe de treino perdido). */
  notBefore?: ISODate;
  spec?: SessionSpec;
  rationale: string;
}

export type RuleId = 'R0' | 'R1' | 'R2' | 'R3' | 'R5' | 'R6' | 'R7' | 'R8';

export interface Violation {
  rule: RuleId;
  dates: ISODate[];
  message: string;
}

export interface DroppedSession {
  request: SessionRequest;
  reason: string;
}
