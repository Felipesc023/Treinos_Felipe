import { Activity, Dumbbell, Moon, Timer, Trophy, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import type { WorkoutType } from '@/lib/planner';

export const TYPE_UI: Record<WorkoutType, { label: string; color: string; dot: string; Icon: LucideIcon }> = {
  leve: { label: 'Corrida leve', color: 'text-sky', dot: 'bg-sky', Icon: Timer },
  longao: { label: 'Longão', color: 'text-emerald', dot: 'bg-emerald', Icon: TrendingUp },
  intervalado: { label: 'Intervalado', color: 'text-red', dot: 'bg-red', Icon: Zap },
  tempo: { label: 'Tempo run', color: 'text-red', dot: 'bg-red', Icon: Zap },
  ativacao: { label: 'Ativação', color: 'text-sky', dot: 'bg-sky', Icon: Timer },
  academia_inferior: { label: 'Academia inferior', color: 'text-amber', dot: 'bg-amber', Icon: Dumbbell },
  academia_superior: { label: 'Academia superior', color: 'text-amber', dot: 'bg-amber', Icon: Dumbbell },
  prova: { label: 'Prova', color: 'text-gold', dot: 'bg-gold', Icon: Trophy },
  descanso: { label: 'Descanso', color: 'text-slate', dot: 'bg-slate', Icon: Moon },
  externo: { label: 'Evento', color: 'text-slate', dot: 'bg-slate', Icon: Activity },
};

export const PHASE_PT = {
  base: 'Base', velocidade: 'Velocidade', pico: 'Pico', taper: 'Taper', manutencao: 'Manutenção',
} as const;

export const km = (m: number | null) => (m == null ? '—' : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

export const DIST_LABEL: Record<number, string> = { 5000: '5 km', 10000: '10 km', 21097: '21 km', 42195: '42 km' };
