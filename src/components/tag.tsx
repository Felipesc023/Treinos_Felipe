import { TYPE_UI } from '@/lib/ui';
import type { WorkoutType } from '@/lib/planner';

/** Etiqueta pequena do tipo de treino (grade da semana e do mês). */
export function Tag({ type, className = '' }: { type: WorkoutType; className?: string }) {
  const u = TYPE_UI[type];
  return (
    <span className={`min-w-[18px] whitespace-nowrap rounded-md px-1 py-0.5 text-center text-[10px] leading-tight font-bold ${u.cls} ${className}`}>{u.tag}</span>
  );
}
