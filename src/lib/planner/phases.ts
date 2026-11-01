import type { PlannerConfig } from './config';

export type CycleType = 'longo' | 'padrao' | 'curto' | 'manutencao';

export interface PhaseAllocation {
  cycleType: CycleType;
  base: number;
  speed: number;
  peak: number;
  taper: number;
  /** Semanas só de manutenção (ciclos muito curtos). */
  maintenance: number;
}

export function classifyCycle(weeks: number): CycleType {
  if (weeks >= 12) return 'longo';
  if (weeks >= 6) return 'padrao';
  if (weeks >= 3) return 'curto';
  return 'manutencao';
}

export function allocatePhases(
  weeks: number,
  distanceM: number,
  cfg: Pick<PlannerConfig, 'taperWeeks' | 'baseShare'>,
): PhaseAllocation {
  const w = Math.max(0, Math.floor(weeks));
  const cycleType = classifyCycle(w);
  const taperTarget = cfg.taperWeeks[distanceM] ?? 1;
  const taper = Math.min(w, taperTarget);
  const remaining = w - taper;

  if (cycleType === 'manutencao') {
    return { cycleType, base: 0, speed: 0, peak: 0, taper, maintenance: remaining };
  }
  if (cycleType === 'curto') {
    // Sem base nova: um bloco de qualidade + taper.
    return { cycleType, base: 0, speed: remaining, peak: 0, taper, maintenance: 0 };
  }
  const peak = remaining >= 6 ? 1 : 0;
  const rest = remaining - peak;
  const share = cfg.baseShare[distanceM] ?? 0.5;
  const base = Math.ceil(rest * share);
  return { cycleType, base, speed: rest - base, peak, taper, maintenance: 0 };
}
