import Link from 'next/link';
import { Icon } from '@/components/icons';
import { BODY_REGIONS, healthEventSchema } from '@/lib/health';
import type { PlanDay } from '@/lib/plan';
import { DEFAULT_CONFIG, returnWeeks, diffDays, weekdayName } from '@/lib/planner';
import { diffPlans } from '@/lib/replan';
import { buildPlan, loadState } from '@/lib/state';
import { dayMonth, workoutHeadline, workoutSub } from '@/lib/ui';
import { confirmHealthEvent } from '../../../actions';

export const dynamic = 'force-dynamic';

const KIND = {
  removed: ['REMOVIDO', 'bg-soft text-body'],
  added: ['NOVO', 'bg-bluetint text-blueink'],
  changed: ['ALTERADO', 'bg-tint text-accent3'],
  reduced: ['REDUZIDO', 'bg-bluetint text-blueink'],
} as const;

const label = (d: PlanDay) => `${workoutHeadline(d)} · ${workoutSub(d)}`;
const when = (d: PlanDay) => `${weekdayName(d.date).slice(0, 3)}, ${dayMonth(d.date)}`;

function Change({ day, kind, from, to }: { day: string; kind: keyof typeof KIND; from?: string; to: string }) {
  const [text, cls] = KIND[kind];
  return (
    <li className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold">{day}</span>
        <span className={`rounded-full px-2 py-[3px] text-[11px] font-bold tracking-wide ${cls}`}>{text}</span>
      </div>
      <div className="flex flex-col gap-1">
        {from && <span className="text-[13px] text-muted line-through">{from}</span>}
        <span className="text-sm font-semibold">{to}</span>
      </div>
    </li>
  );
}

export default async function Confirmar({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const parsed = healthEventSchema.safeParse(await searchParams);
  if (!parsed.success) {
    return (
      <>
        <header className="pt-2"><h1 className="display m-0 text-[34px] leading-[1.05]">Saúde</h1></header>
        <p role="alert" className="card m-0 text-bad">{parsed.error.issues[0]?.message}</p>
        <Link href="/saude" className="btn-ghost w-full no-underline">Voltar</Link>
      </>
    );
  }
  const e = parsed.data;
  const s = await loadState();
  const before = buildPlan(s);
  const after = buildPlan(s, [{ kind: e.kind, from: e.from, to: e.to, mode: e.mode, ...(e.region ? { region: e.region } : {}) }]);
  const d = diffPlans(before.days, after.days);
  const total = d.removed.length + d.added.length + d.changed.length;
  const region = BODY_REGIONS.find(([v]) => v === e.region)?.[1];

  const title = e.kind === 'afastamento'
    ? `Afastamento · ${dayMonth(e.from)} a ${dayMonth(e.to)}`
    : `Dor${region ? ` · ${region}` : ''} · intensidade ${e.severity ?? '?'}/5`;
  const reason = e.kind === 'afastamento'
    ? `Os treinos pausam até ${dayMonth(e.to)}. Na volta entra uma retomada de ${returnWeeks(diffDays(e.to, e.from) + 1)} semanas: ~${Math.round(DEFAULT_CONFIG.returnStartFactor * 100)}% do volume, só ritmo leve, subindo cerca de ${Math.round(DEFAULT_CONFIG.returnWeeklyStep * 100)}% por semana.`
    : e.mode === 'parar'
      ? `Os treinos pausam até ${dayMonth(e.to)}.`
      : `Até ${dayMonth(e.to)} ficam só treinos leves (intensidade até ${DEFAULT_CONFIG.restrictedMaxIntensity}).`;
  const poupa = region ? ` A academia poupa ${region.toLowerCase()} até ${DEFAULT_CONFIG.regionAvoidAfterDays} dias depois.` : '';

  return (
    <>
      <header className="flex items-center gap-2 pt-2">
        <Link href="/saude" aria-label="Voltar" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink"><Icon name="left" size={18} /></Link>
        <div className="flex flex-col">
          <h1 className="display m-0 text-[28px] leading-[1.05]">Proposta de ajuste</h1>
          <span className="text-xs text-muted">Nada foi salvo ainda. Confira e confirme.</span>
        </div>
      </header>

      <section aria-label="Motivo" className="flex gap-3 rounded-2xl border border-tintline bg-tint p-3.5">
        <Icon name="warn" className="shrink-0 text-accent2" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold">{title}</span>
          <span className="text-[13px] leading-snug text-body">{reason}{poupa}</span>
        </div>
      </section>

      {after.warnings.map((w) => <p key={w} role="alert" className="m-0 rounded-2xl border border-tintline bg-tint p-3.5 text-[13px] font-semibold text-accent3">{w}</p>)}

      <section aria-label="O que muda" className="flex flex-col gap-2">
        <h2 className="m-0 text-[15px] font-bold">O que muda ({total} {total === 1 ? 'treino' : 'treinos'})</h2>
        {total === 0 && <p className="card m-0 text-sm text-muted">Esse evento não muda nenhum treino planejado.</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {d.removed.map((x) => <Change key={`r${x.date}${x.type}`} day={when(x)} kind="removed" from={label(x)} to="Sem treino" />)}
          {d.changed.map((c) => (
            <Change key={`c${c.after.date}${c.after.type}`} day={when(c.after)} kind={c.after.estMinutes < c.before.estMinutes ? 'reduced' : 'changed'} from={label(c.before)} to={label(c.after)} />
          ))}
          {d.added.map((x) => <Change key={`a${x.date}${x.type}`} day={when(x)} kind="added" to={label(x)} />)}
        </ul>
      </section>

      <form action={confirmHealthEvent} className="grid grid-cols-2 gap-2">
        {Object.entries(e).map(([k, v]) => (v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
        <Link href="/saude" className="btn-ghost min-h-[52px] no-underline">Cancelar</Link>
        <button className="btn min-h-[52px]">Confirmar</button>
      </form>
    </>
  );
}
