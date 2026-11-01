import { evaluateWorkout, type ExecLike, type Zones } from './evaluate';
import type { PlanDay } from './plan';
import type { ISODate } from './planner';

/** Como o dia está: feito, não feito, trocado por outra atividade, ainda por vir, esquecido ou sem treino planejado. */
export type DayState = 'feito' | 'nao_fiz' | 'outra' | 'pendente' | 'perdido' | 'livre';

/** Visual de cada estado (calendário e semana): texto curto, classes da pílula e o que significa. */
export const STATE_UI: Record<Exclude<DayState, 'livre'>, { label: string; short: string; cls: string; hint: string }> = {
  feito: { label: 'Feito', short: 'Feito', cls: 'bg-[#E3F3EA] text-ok', hint: 'Você fez' },
  nao_fiz: { label: 'Não fiz', short: 'Não fiz', cls: 'bg-[#FBE4E1] text-bad', hint: 'Marcado como não feito' },
  outra: { label: 'Outra coisa', short: 'Outra', cls: 'bg-[#FDEBC8] text-[#8A5A00]', hint: 'Você fez outra coisa no lugar' },
  pendente: { label: '', short: '', cls: '', hint: 'Ainda por vir' },
  perdido: { label: 'Sem registro', short: 'Pend.', cls: 'border border-dashed border-line2 bg-white text-muted', hint: 'Passou e não vi o treino: marque abaixo' },
};

/** Registro do atleta ("não fiz" / "fiz outra coisa") vale mais que o Strava para dizer se o treino planejado foi cumprido. */
export function dayState(o: {
  plan: PlanDay | undefined; execs: ExecLike[]; skipped: { skipped_on: string; workout_type: string }[];
  zones: Zones; today: ISODate; maxHr?: number | null;
}): DayState {
  const w = o.plan;
  if (!w || w.type === 'descanso' || w.type === 'externo' || w.type === 'prova') return 'livre';
  if (o.skipped.some((k) => k.skipped_on === w.date && k.workout_type === w.type)) {
    return o.execs.some((e) => e.executed_on === w.date) ? 'outra' : 'nao_fiz';
  }
  const s = evaluateWorkout(w, o.execs, o.zones, o.today, o.maxHr).status;
  return s === 'feito' || s === 'parcial' ? 'feito' : s;
}
