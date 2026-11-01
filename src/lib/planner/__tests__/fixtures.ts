import type { DayTemplate, PlannedWorkout } from '../types';

/** Seu padrão: domingo e quarta de descanso; 60 min nos dias de semana e 90 min no sábado (longão). */
export const TEMPLATE: DayTemplate[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isRest: weekday === 0 || weekday === 3,
  maxMinutes: weekday === 6 ? 90 : 60,
}));

export const withMax = (weekday: number, maxMinutes: number): DayTemplate[] =>
  TEMPLATE.map((t) => (t.weekday === weekday ? { ...t, maxMinutes } : t));

export const soccer = (date: string): PlannedWorkout => ({
  date, type: 'externo', title: 'Futebol', intensity: 4, legLoad: 3, estMinutes: 90,
  rationale: 'Evento externo.',
});

export const w = (
  date: string, type: PlannedWorkout['type'], o: Partial<PlannedWorkout> = {},
): PlannedWorkout => ({
  date, type, title: o.title ?? type,
  intensity: o.intensity ?? (type === 'academia_inferior' ? 3 : ['longao', 'intervalado', 'tempo'].includes(type) ? 4 : 2),
  legLoad: o.legLoad ?? (type === 'academia_inferior' ? 3 : 1),
  estMinutes: o.estMinutes ?? 45,
  rationale: o.rationale ?? '',
});
