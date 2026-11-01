import { DEFAULT_CONFIG, type PlannerConfig } from './config';

/** Semanas de retomada: 1 a cada `returnDaysPerWeek` dias parados, limitado a [min, max]. */
export function returnWeeks(daysAway: number, cfg: PlannerConfig = DEFAULT_CONFIG): number {
  return Math.min(cfg.returnMaxWeeks, Math.max(cfg.returnMinWeeks, Math.ceil(daysAway / cfg.returnDaysPerWeek)));
}

/** Fator de volume na semana `weekIdx` (0 = primeira) da retomada. */
export function returnFactor(weekIdx: number, cfg: PlannerConfig = DEFAULT_CONFIG): number {
  return Math.min(1, Math.round((cfg.returnStartFactor + cfg.returnWeeklyStep * weekIdx) * 100) / 100);
}
