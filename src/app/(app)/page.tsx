import Link from 'next/link';
import { diffDays, formatPace, formatTime, weekDates, weekStartSunday, weekdayName } from '@/lib/planner';
import { assessRaceGoal } from '@/lib/plan';
import { loadState } from '@/lib/state';
import { PHASE_PT, TYPE_UI, km } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function Hoje() {
  const s = await loadState();
  const race = s.nextRace;
  const todays = s.plan?.days.find((d) => d.date === s.today);
  const week = weekDates(weekStartSunday(s.today));
  const days = new Set(s.plan?.days.map((d) => d.date));
  const done = new Set(s.execs.map((e) => e.executed_on));
  const goal = race?.goal_time_seconds
    ? assessRaceGoal({ today: s.today, raceDate: race.race_date, distanceM: race.distance_m, goalSeconds: race.goal_time_seconds,
        prs: s.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds })) })
    : null;
  const phase = s.plan?.phaseByWeek.get(weekStartSunday(s.today));

  return (
    <>
      <p className="label"><span className="text-gold">{weekdayName(s.today)} {s.today.slice(8)}/{s.today.slice(5, 7)} · hoje</span></p>

      {race ? (
        <section className="card">
          <p className="label">{race.name} · {race.race_date.slice(8)}/{race.race_date.slice(5, 7)}</p>
          <p className="font-mono text-4xl text-gold">{diffDays(race.race_date, s.today)} <span className="text-base text-muted">dias</span></p>
          {phase && <p className="text-sm text-muted">Fase: {PHASE_PT[phase]}</p>}
          {goal && <p className="mt-2 text-sm text-muted">Meta {formatTime(race.goal_time_seconds!)}: <b className="text-ink">{goal.level}</b>. {goal.message}</p>}
        </section>
      ) : (
        <section className="card">
          <p>Nenhuma prova cadastrada.</p>
          <Link href="/provas" className="btn mt-3">Cadastrar a primeira prova</Link>
        </section>
      )}

      {race && (
        <section className="card">
          {todays ? (() => {
            const ui = TYPE_UI[todays.type];
            return (
              <>
                <p className={`flex items-center gap-2 font-medium ${ui.color}`}><ui.Icon size={18} aria-hidden /> {todays.title}</p>
                <ul className="mt-2 space-y-1 font-mono text-sm">{todays.detail.map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="mt-2 text-sm text-muted">{todays.rationale}</p>
              </>
            );
          })() : <p className="text-muted">Hoje é dia de descanso. Aproveite.</p>}
        </section>
      )}

      <section className="card">
        <p className="label mb-2">Semana</p>
        <div className="grid grid-cols-7 text-center text-xs text-muted">
          {week.map((d) => (
            <div key={d} className={d === s.today ? 'text-gold' : ''}>
              {weekdayName(d)[0]}
              <div className="mt-1 text-lg" aria-label={done.has(d) ? 'feito' : days.has(d) ? 'planejado' : 'livre'}>
                {done.has(d) ? '●' : d === s.today ? '◉' : days.has(d) ? '○' : '·'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {s.execs[0] && (
        <section className="card">
          <p className="label">Último treino importado</p>
          <p className="font-mono">
            {s.execs[0].source} · {km(s.execs[0].distance_m)} · {s.execs[0].avg_pace_s_km ? `${formatPace(s.execs[0].avg_pace_s_km)} /km` : '—'}
          </p>
        </section>
      )}
    </>
  );
}
