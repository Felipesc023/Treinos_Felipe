import Link from 'next/link';
import { ExecDetail } from '@/components/exec-detail';
import { DayActions } from '@/components/forms';
import { Icon } from '@/components/icons';
import { Tag } from '@/components/tag';
import { EvalNotes, Steps } from '@/components/workout-card';
import { db, type ExecRow } from '@/lib/db';
import { historyDay, type HistoryRow } from '@/lib/history';
import { evaluateWorkout } from '@/lib/evaluate';
import { STATE_UI, dayState } from '@/lib/daystate';
import { blockingAt, toHealthInput } from '@/lib/health';
import type { PlanDay } from '@/lib/plan';
import { addDays, weekStartSunday, weekdayName, weekdayOf } from '@/lib/planner';
import { loadState } from '@/lib/state';
import { todayISO } from '@/lib/today';
import { PHASE_BAR, PHASE_PT, TYPE_UI, dayMonth, monthName, workoutHeadline, workoutSub } from '@/lib/ui';

export const dynamic = 'force-dynamic';

/** Soma meses a "YYYY-MM" (aritmética inteira, sem Date). */
const shift = (ym: string, n: number) => {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

const LEGEND = ['leve', 'longao', 'intervalado', 'academia_inferior', 'externo', 'descanso'] as const;

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const today = todayISO();
  const ym = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);
  const first = `${ym}-01`;
  const nextMonthFirst = `${shift(ym, 1)}-01`;
  const sel0 = d && d.startsWith(ym) ? d : ym === today.slice(0, 7) ? today : first;
  const sel = sel0;
  const monthDays: string[] = [];
  for (let x = first; x < nextMonthFirst; x = addDays(x, 1)) monthDays.push(x);
  const cells: (string | null)[] = [...Array<null>(weekdayOf(first)).fill(null), ...monthDays];

  // tudo numa ida só ao banco: o mês, o dia aberto e o estado geral não dependem uns dos outros
  const [s, exR, fullR, histR, skR] = await Promise.all([
    loadState(),
    db().from('workout_executions').select('id,executed_on,source,name,sport,distance_m,duration_s,avg_pace_s_km,avg_hr,max_hr,calories').gte('executed_on', first).lt('executed_on', nextMonthFirst).order('executed_on'),
    // voltas (JSON pesado) só do dia aberto
    db().from('workout_executions').select('*').eq('executed_on', sel0),
    // plano que você realmente seguiu (tem prioridade sobre o recalculado nas datas que cobre)
    db().from('planned_history').select('*').gte('date', first).lt('date', nextMonthFirst),
    db().from('skipped_workouts').select('skipped_on,workout_type').gte('skipped_on', first).lt('skipped_on', nextMonthFirst),
  ]);
  for (const r of [exR, fullR, histR, skR]) if (r.error) throw new Error(r.error.message);
  const { data: ex } = exR, { data: full } = fullR, { data: hist } = histR, { data: sk } = skR;
  const followed = new Map(((hist ?? []) as HistoryRow[]).map((h) => [h.date, historyDay(h)]));
  const done = new Map<string, ExecRow[]>();
  for (const e of (ex ?? []) as ExecRow[]) done.set(e.executed_on, [...(done.get(e.executed_on) ?? []), e]);

  const healthInputs = s.health.map((e) => toHealthInput(e, s.today));
  const byDate = new Map<string, PlanDay>([...s.weekPlan, ...(s.plan?.days ?? [])].map((x) => [x.date, x]));
  for (const [date, w] of followed) byDate.set(date, w);
  // dia afastado não cobra registro: o treino do calendário antigo não era possível
  const stateOf = (date: string) => (blockingAt(healthInputs, date) ? 'livre' : dayState({
    plan: byDate.get(date), execs: done.get(date) ?? [], skipped: sk ?? [], zones: s.zones, today: s.today, maxHr: s.maxHr,
  }));
  const selDay = byDate.get(sel);
  const isFollowed = followed.has(sel);
  const planEnd = s.plan?.days.at(-1)?.date ?? s.today; // depois disso não há plano: o dia fica sem etiqueta
  const away = blockingAt(healthInputs, sel);
  const selSt = stateOf(sel);
  const manualOn = (done.get(sel) ?? []).some((e) => e.source === 'manual');
  const ev = selDay && selDay.type !== 'descanso' && selDay.type !== 'externo' ? evaluateWorkout(selDay, done.get(sel) ?? [], s.zones, s.today, s.maxHr) : null;

  // faixa de fases do mês: dias consecutivos da mesma fase viram um segmento
  const phaseOf = (date: string) => (blockingAt(healthInputs, date) ? 'afastado' : (s.plan?.phaseByWeek.get(weekStartSunday(date)) ?? null));
  const segments: { phase: string | null; n: number }[] = [];
  for (const date of monthDays) {
    const p = phaseOf(date);
    const last = segments.at(-1);
    if (last && last.phase === p) last.n++; else segments.push({ phase: p, n: 1 });
  }
  const segLabel = (p: string | null) => (p === 'afastado' ? 'Afastado' : p ? PHASE_PT[p as keyof typeof PHASE_PT] : '');
  const segBar = (p: string | null) => (p === 'afastado' ? 'bg-line' : p ? PHASE_BAR[p as keyof typeof PHASE_BAR] : 'bg-transparent');
  const cols = segments.map((x) => `${x.n}fr`).join(' ');

  return (
    <>
      <header id="topo" className="flex scroll-mt-4 items-center justify-between pt-2">
        <Link href={`?m=${shift(ym, -1)}`} aria-label="Mês anterior" className="flex size-11 items-center justify-center press rounded-xl border border-line bg-surface text-ink"><Icon name="left" size={18} /></Link>
        <div className="flex flex-col items-center">
          <h1 className="display m-0 text-[30px] leading-none capitalize">{monthName(first)} {ym.slice(0, 4)}</h1>
          <span className="text-xs text-muted">{s.nextRace ? `Rumo a ${s.nextRace.name}` : 'Plano de evolução'}</span>
        </div>
        <Link href={`?m=${shift(ym, 1)}`} aria-label="Próximo mês" className="flex size-11 items-center justify-center press rounded-xl border border-line bg-surface text-ink"><Icon name="right" size={18} /></Link>
      </header>

      <section aria-label="Fases do plano" className="flex flex-col gap-1.5">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
          {segments.map((x, i) => <span key={i} className={`h-2 rounded ${segBar(x.phase)}`} />)}
        </div>
        <div className="grid gap-[3px] text-[11px] font-semibold text-muted" style={{ gridTemplateColumns: cols }}>
          {segments.map((x, i) => <span key={i} className="truncate">{x.n >= 4 ? segLabel(x.phase) : ''}</span>)}
        </div>
      </section>

      <section aria-label="Dias do mês" className="flex flex-col gap-1.5">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x, i) => <span key={i}>{x}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const w = byDate.get(c);
            const isRace = w?.type === 'prova';
            const past = c < s.today;
            const st = stateOf(c);
            const frame = c === sel ? 'border-2 border-ink' : past ? 'border border-soft bg-alt' : 'border border-line';
            return (
              <Link key={c} href={`?m=${ym}&d=${c}#dia`} aria-label={dayMonth(c)} aria-current={c === s.today ? 'date' : undefined}
                className={`press flex h-[58px] flex-col items-center justify-center gap-1 rounded-[10px] no-underline ${isRace ? 'border border-accent2 bg-accent2' : `bg-surface ${frame}`} ${c === s.today && c !== sel ? 'ring-2 ring-accent' : ''}`}>
                <span className={`text-[13px] font-bold ${isRace ? 'text-white' : 'text-ink'}`}>{Number(c.slice(8))}</span>
                {st === 'feito' || (st === 'livre' && done.has(c)) ? (
                  <span className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-[5px] px-1 py-0.5 text-[10px] font-bold ${STATE_UI.feito.cls}`}><Icon name="check" size={9} width={3} />Feito</span>
                ) : st === 'nao_fiz' || st === 'outra' || st === 'perdido' ? (
                  <span className={`whitespace-nowrap rounded-[5px] px-1 py-0.5 text-[10px] font-bold ${STATE_UI[st].cls}`}>{STATE_UI[st].short}</span>
                ) : w ? (
                  <Tag type={w.type} />
                ) : blockingAt(healthInputs, c) ? (
                  <span className="text-[10px] font-bold text-line2" aria-label="Afastado">–</span>
                ) : c <= planEnd ? (
                  <Tag type="descanso" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-label="Legenda" className="flex flex-col gap-2 text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['feito', 'nao_fiz', 'outra', 'perdido'] as const).map((k) => (
            <span key={k} className={`whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold ${STATE_UI[k].cls}`}>{STATE_UI[k].short}</span>
          ))}
          <span className="ml-1">Pend. = passou sem registro: toque no dia e marque.</span>
        </div>
        <details>
          <summary className="cursor-pointer font-semibold">Cores dos treinos</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEGEND.map((t) => (
              <span key={t} className="inline-flex items-center gap-1"><Tag type={t} />{TYPE_UI[t].label}</span>
            ))}
          </div>
        </details>
      </section>

      <section id="dia" aria-label="Dia selecionado" className="flex scroll-mt-4 flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[15px] font-bold">{weekdayName(sel).slice(0, 3)}, {dayMonth(sel)}{sel === s.today ? ' · hoje' : ''}</h2>
          <span className="flex items-center gap-2">
            {selSt !== 'livre' && selSt !== 'pendente' && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATE_UI[selSt].cls}`}>{STATE_UI[selSt].label}</span>}
            <Link href="#topo" aria-label="Voltar ao calendário" className="press flex size-8 items-center justify-center rounded-lg border border-line text-muted no-underline"><Icon name="up" size={14} /></Link>
          </span>
        </div>

        {selDay ? (
          <>
            <div className="flex items-center gap-3">
              <Tag type={selDay.type} className="flex h-10 min-w-12 items-center justify-center !rounded-[10px] !px-2 !text-xs" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold leading-tight">{isFollowed ? selDay.title : workoutHeadline(selDay)}</span>
                {!isFollowed && <span className="text-xs text-muted">{workoutSub(selDay)}</span>}
              </span>
            </div>
            {selDay.steps.length > 4 ? (
              <details className="rounded-xl border border-soft">
                <summary className="press cursor-pointer px-3 py-2.5 text-sm font-semibold">Ver {selDay.steps.length} exercícios</summary>
                <div className="px-3"><Steps steps={selDay.steps} /></div>
              </details>
            ) : <Steps steps={selDay.steps} />}
            {(selDay.note || selDay.rationale) && (
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-muted">Por que este treino</summary>
                {selDay.note && <p className="mb-0 mt-2 rounded-xl bg-alt p-3 text-[13px] leading-snug text-body">{selDay.note}</p>}
                {selDay.rationale && <p className="mb-0 mt-2 text-[13px] leading-snug text-muted">{selDay.rationale}</p>}
              </details>
            )}
            {selSt === 'feito' && ev && <EvalNotes ev={ev} />}
          </>
        ) : (
          <p className="m-0 text-sm text-muted">{away ? 'Afastado: sem treino.' : 'Sem treino planejado.'}</p>
        )}

        {sel <= s.today && !away && (
          <DayActions date={sel} type={selSt === 'livre' ? 'descanso' : selDay!.type} state={selSt}
            hasStrava={(done.get(sel) ?? []).some((e) => e.source === 'strava')}
            canUndo={selSt === 'nao_fiz' || selSt === 'outra' || manualOn} />
        )}

        {(done.get(sel) ?? []).length > 0 && (
          <div className="flex flex-col gap-3 border-t border-soft pt-3">
            <p className="label">O que você fez</p>
            {((full ?? []) as ExecRow[]).map((e) => <ExecDetail key={e.id} e={e} />)}
          </div>
        )}
      </section>
    </>
  );
}
