import type { PlanDay } from '@/lib/plan';
import type { WorkoutType } from '@/lib/planner';

/** Etiqueta de cada tipo de treino: `tag` é a palavra curta que cabe na grade (sem siglas). */
export const TYPE_UI: Record<WorkoutType, { label: string; tag: string; cls: string }> = {
  leve: { label: 'Corrida leve', tag: 'Leve', cls: 'bg-bluetint text-blueink' },
  longao: { label: 'Longão', tag: 'Longão', cls: 'bg-blue text-white' },
  intervalado: { label: 'Intervalado', tag: 'Tiros', cls: 'bg-accent text-white' },
  tempo: { label: 'Tempo run', tag: 'Tempo', cls: 'border border-tintline bg-tint text-accent3' },
  ativacao: { label: 'Ativação', tag: 'Ativ.', cls: 'bg-bluetint text-blueink' },
  academia_inferior: { label: 'Academia inferior', tag: 'Acad.', cls: 'bg-ink text-white' },
  academia_superior: { label: 'Academia superior', tag: 'Acad.', cls: 'bg-ink text-white' },
  prova: { label: 'Dia da prova', tag: 'Prova', cls: 'bg-white text-accent2' },
  descanso: { label: 'Descanso', tag: 'Folga', cls: 'bg-soft text-muted' },
  externo: { label: 'Evento', tag: 'Evento', cls: 'border border-dashed border-muted bg-white text-ink' },
};

export const PHASE_PT = {
  base: 'Base', velocidade: 'Velocidade', pico: 'Pico', taper: 'Taper', manutencao: 'Manutenção', retomada: 'Retomada',
} as const;

/** Cor da faixa de fase no calendário. */
export const PHASE_BAR: Record<keyof typeof PHASE_PT, string> = {
  base: 'bg-blue', velocidade: 'bg-accent', pico: 'bg-accent2', taper: 'bg-peach', manutencao: 'bg-line2', retomada: 'bg-bluelight',
};

export const DIST_LABEL: Record<number, string> = {
  5000: '5 km', 10000: '10 km', 15000: '15 km', 16093: '10 milhas', 20000: '20 km',
  21097: 'Meia maratona', 30000: '30 km', 42195: 'Maratona',
};
export const distLabel = (m: number) => DIST_LABEL[m] ?? `${+(m / 1000).toFixed(2)} km`.replace('.', ',');

const kmTxt = (v: number) => String(v).replace('.', ',');

/** Título grande do treino: "6 × 600 m", "Longão 10 km"… */
export function workoutHeadline(w: PlanDay): string {
  const s = w.spec;
  switch (w.type) {
    case 'intervalado': return s?.reps && s.repM ? `${s.reps} × ${s.repM} m` : 'Intervalado';
    case 'tempo': return `${s?.steadyMin ?? 20} min em ritmo de tempo`;
    case 'leve': return s?.fartlekMin ? `Fartlek ${s.fartlekMin} min` : s?.km ? `${kmTxt(s.km)} km leve` : 'Corrida leve';
    case 'longao': return s?.km ? `Longão ${kmTxt(s.km)} km` : 'Longão';
    case 'ativacao': return s?.km ? `Ativação ${kmTxt(s.km)} km` : 'Ativação';
    default: return w.title;
  }
}

/** Linha de apoio: distância, duração e intensidade. */
export const workoutSub = (w: PlanDay): string =>
  [w.spec?.km ? `≈ ${kmTxt(w.spec.km)} km` : null, `${w.estMinutes} min`, `intensidade ${w.intensity}/5`].filter(Boolean).join(' · ');

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]!;
/** "3 nov" */
export const dayMonth = (iso: string) => `${Number(iso.slice(8))} ${monthName(iso).slice(0, 3)}`;
/** "3 de novembro" */
export const dayMonthLong = (iso: string) => `${Number(iso.slice(8))} de ${monthName(iso)}`;
