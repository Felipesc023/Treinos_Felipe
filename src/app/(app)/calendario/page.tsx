import Link from 'next/link';
import { addDays, weekdayOf, weekdayName } from '@/lib/planner';
import { loadState } from '@/lib/state';
import { TYPE_UI } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Soma meses a "YYYY-MM" (aritmética inteira, sem Date). */
const shift = (ym: string, n: number) => {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const s = await loadState();
  const ym = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : s.today.slice(0, 7);
  const first = `${ym}-01`;
  const lead = weekdayOf(first);
  const nextMonthFirst = `${shift(ym, 1)}-01`;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let x = first; x < nextMonthFirst; x = addDays(x, 1)) cells.push(x);
  const byDate = new Map(s.plan?.days.map((x) => [x.date, x]));
  const sel = d && d.startsWith(ym) ? d : ym === s.today.slice(0, 7) ? s.today : first;
  const selDay = byDate.get(sel);

  return (
    <>
      <div className="flex items-center justify-between">
        <Link href={`?m=${shift(ym, -1)}`} className="btn-ghost px-4" aria-label="Mês anterior">‹</Link>
        <h1 className="text-lg">{MONTHS[Number(ym.slice(5)) - 1]} {ym.slice(0, 4)}</h1>
        <Link href={`?m=${shift(ym, 1)}`} className="btn-ghost px-4" aria-label="Próximo mês">›</Link>
      </div>

      <div className="card">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-faint">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i}>{weekdayName(addDays('2026-11-01', i))[0]}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const w = byDate.get(c);
            const cls = c === s.today ? 'border-gold' : c === sel ? 'border-ink/60' : 'border-transparent';
            return (
              <Link key={c} href={`?m=${ym}&d=${c}`}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border ${cls} ${w?.type === 'prova' ? 'bg-gold/20' : ''}`}>
                <span className="text-sm text-ink">{Number(c.slice(8))}</span>
                {w && <span className={`mt-1 h-1.5 w-1.5 rounded-full ${TYPE_UI[w.type].dot}`} aria-label={TYPE_UI[w.type].label} />}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <p className="label">{weekdayName(sel)} {sel.slice(8)}/{sel.slice(5, 7)}</p>
        {selDay ? (
          <>
            <p className={`mt-1 font-medium ${TYPE_UI[selDay.type].color}`}>{selDay.title}</p>
            <ul className="mt-2 space-y-1 font-mono text-sm">{selDay.detail.map((l) => <li key={l}>{l}</li>)}</ul>
            <p className="mt-2 text-sm text-muted">{selDay.rationale}</p>
          </>
        ) : <p className="mt-1 text-muted">Sem treino planejado.</p>}
      </div>
    </>
  );
}
