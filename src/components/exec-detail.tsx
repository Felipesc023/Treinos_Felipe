import type { ExecRow } from '@/lib/db';
import { formatPace, formatTime } from '@/lib/planner';

interface Lap { distance: number; moving_time: number; average_heartrate?: number }

const isRun = (s: string | null) => /run/i.test(s ?? '');
const km = (m: number, d = 2) => (m / 1000).toFixed(d).replace('.', ',');

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-alt px-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="display text-[26px] leading-none tabular-nums">
        {value}{unit && <span className="ml-1 font-sans text-xs font-medium text-muted">{unit}</span>}
      </span>
    </div>
  );
}

/** Um treino feito (Strava ou marcado à mão): resumo, frequência cardíaca e parciais por volta. */
export function ExecDetail({ e }: { e: ExecRow }) {
  const run = isRun(e.sport);
  const laps = ((e.laps ?? []) as Lap[]).filter((l) => l.distance > 0);
  const speeds = laps.map((l) => l.distance / l.moving_time);
  const top = Math.max(...speeds, 0);
  const stats = [
    run && e.distance_m ? { label: 'Distância', value: km(e.distance_m), unit: 'km' } : null,
    e.duration_s ? { label: 'Tempo', value: formatTime(e.duration_s) } : null,
    run && e.avg_pace_s_km ? { label: 'Ritmo', value: formatPace(e.avg_pace_s_km), unit: '/km' } : null,
    e.calories ? { label: 'Calorias', value: String(e.calories), unit: 'kcal' } : null,
  ].filter((s) => s !== null);
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
        {e.name ?? e.sport}
        <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-medium text-muted">{e.source === 'strava' ? 'Strava' : 'marcado por você'}</span>
      </p>
      {stats.length > 0 && (
        <div className={`grid gap-2 ${stats.length >= 3 ? 'grid-cols-2' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {stats.map((s) => <Stat key={s.label} {...s} />)}
        </div>
      )}
      {e.avg_hr ? (
        <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
          <span className="size-2 rounded-full bg-bad" aria-hidden />
          FC média <b className="font-semibold text-ink tabular-nums">{e.avg_hr}</b> bpm
          {e.max_hr ? <> · máx <b className="font-semibold text-ink tabular-nums">{e.max_hr}</b></> : null}
        </p>
      ) : null}
      {laps.length > 1 && (
        <details>
          <summary className="press cursor-pointer text-xs font-semibold text-muted">Parciais por volta ({laps.length})</summary>
        <div role="table" aria-label="Parciais por volta" className="mt-2 text-[13px] tabular-nums">
          <div role="row" className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-x-2 border-b border-soft pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span role="columnheader">#</span><span role="columnheader">Dist.</span><span role="columnheader">Tempo</span><span role="columnheader">Ritmo</span><span role="columnheader" className="text-right">FC</span>
          </div>
          {laps.slice(0, 30).map((l, i) => (
            <div key={i} role="row" className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-x-2 border-b border-soft py-2 last:border-b-0">
              <span role="cell" className="text-muted">{i + 1}</span>
              <span role="cell">{km(l.distance)} <span className="text-xs text-muted">km</span></span>
              <span role="cell">{formatTime(l.moving_time)}</span>
              <span role="cell" className="flex flex-col gap-1">
                <span className="font-semibold">{formatPace(l.moving_time / (l.distance / 1000))}</span>
                <span className="h-1 rounded-full bg-soft" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((l.distance / l.moving_time / top) * 100)}%` }} />
                </span>
              </span>
              <span role="cell" className="text-right text-muted">{l.average_heartrate ? Math.round(l.average_heartrate) : '–'}</span>
            </div>
          ))}
        </div>
        </details>
      )}
    </div>
  );
}
