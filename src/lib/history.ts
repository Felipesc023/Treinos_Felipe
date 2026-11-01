import type { PlanDay, Step } from './plan';
import { SESSION_DEFAULTS, type WorkoutType } from './planner';

export interface HistoryRow { date: string; type: string; title: string; detail: unknown }

/** Um dia do plano que o atleta realmente seguiu (tabela `planned_history`), no mesmo formato do plano gerado. */
export function historyDay(r: HistoryRow): PlanDay {
  const type = r.type as WorkoutType;
  const d = type in SESSION_DEFAULTS ? SESSION_DEFAULTS[type as keyof typeof SESSION_DEFAULTS] : { intensity: 0, legLoad: 0, estMinutes: 0 };
  const lines = Array.isArray(r.detail) ? (r.detail as string[]) : [];
  const steps: Step[] = lines.map((label) => ({ label }));
  return { date: r.date, type, title: r.title, ...d, rationale: '', phase: 'base', steps, detail: lines };
}
