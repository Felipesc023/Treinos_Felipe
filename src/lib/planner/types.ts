import type { ISODate } from './dates';

export type WorkoutType =
  | 'leve' | 'longao' | 'intervalado' | 'tempo' | 'ativacao'
  | 'academia_inferior' | 'academia_superior'
  | 'prova' | 'descanso' | 'externo';

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
