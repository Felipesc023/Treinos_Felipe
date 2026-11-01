import type { Evaluation } from '@/lib/evaluate';
import type { PlanDay } from '@/lib/plan';
import { TYPE_UI, workoutHeadline, workoutSub } from '@/lib/ui';

/** Etiqueta grande do tipo (INTERVALADO, LONGÃO…) com a cor do layout. */
export function TypeChip({ type }: { type: PlanDay['type'] }) {
  const u = TYPE_UI[type];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${u.cls}`}>{u.label.toUpperCase()}</span>;
}

/** Passos do treino (aquecimento, tiros, exercícios…) com o ritmo ou as séries à direita. */
export function Steps({ steps }: { steps: PlanDay['steps'] }) {
  if (!steps.length) return null;
  return (
    <ol className="m-0 flex list-none flex-col border-t border-soft p-0">
      {steps.map((s, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 border-b border-soft py-3 last:border-b-0">
          <span className="flex flex-col gap-0.5">
            <span className={`text-sm ${s.strong ? 'font-semibold' : 'font-medium'}`}>{s.label}</span>
            {s.sub && <span className="text-xs text-muted">{s.sub}</span>}
          </span>
          {s.right && (
            <span className={`whitespace-nowrap text-right tabular-nums ${s.strong ? 'text-[15px] font-bold text-accent2' : 'text-sm text-muted'}`}>{s.right}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Resultado da comparação planejado × feito. */
export function EvalNotes({ ev }: { ev: Evaluation }) {
  if (ev.status !== 'feito' && ev.status !== 'parcial') return null;
  return (
    <div className="space-y-1 text-sm">
      {ev.lines.map((l) => <p key={l} className="text-ok">{l}</p>)}
      {ev.flags.map((f) => <p key={f} className="text-accent2">{f}</p>)}
    </div>
  );
}

/** Bloco principal de um treino: título grande, resumo, passos e justificativa. */
export function WorkoutBody({ w }: { w: PlanDay }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="display m-0 text-[40px] leading-none">{workoutHeadline(w)}</h2>
        <span className="text-sm text-muted">{workoutSub(w)}</span>
      </div>
      <Steps steps={w.steps} />
      {w.note && <p className="m-0 rounded-xl bg-alt p-3 text-[13px] leading-snug text-body">{w.note}</p>}
      {w.rationale && <p className="m-0 text-[13px] leading-snug text-muted">{w.rationale}</p>}
    </>
  );
}
