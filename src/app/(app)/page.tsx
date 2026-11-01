import Link from 'next/link';
import { ExecDetail } from '@/components/exec-detail';
import { DayActions, SkipForm } from '@/components/forms';
import { Icon } from '@/components/icons';
import { Tag } from '@/components/tag';
import { EvalNotes, TypeChip, WorkoutBody } from '@/components/workout-card';
import { STATE_UI, dayState } from '@/lib/daystate';
import { evaluateWorkout, weekSummary } from '@/lib/evaluate';
import { blockingAt, toHealthInput } from '@/lib/health';
import { addDays, diffDays, formatTime, weekDates, weekStartSunday, weekdayName } from '@/lib/planner';
import { assessRaceGoal, type PlanDay } from '@/lib/plan';
import { db, type ExecRow } from '@/lib/db';
import { loadState } from '@/lib/state';
import { PHASE_PT, dayMonth, dayMonthLong } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const br = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export default async function Hoje() {
  // o último treino (com as voltas) vem na mesma ida ao banco que o resto: não depende do estado
  const [s, { data: lastRows }] = await Promise.all([
    loadState(),
    db().from('workout_executions').select('*').order('executed_on', { ascending: false }).limit(6),
  ]);
  // todas as atividades do dia mais recente (corrida + futebol, dois treinos…), não só uma
  const recent = (lastRows ?? []) as ExecRow[];
  const lastDay = recent[0]?.executed_on;
  const last = recent.filter((e) => e.executed_on === lastDay);
  const race = s.nextRace;
  const week = weekDates(weekStartSunday(s.today));
  const byDate = new Map<string, PlanDay>([...s.weekPlan, ...(s.plan?.days ?? [])].map((d) => [d.date, d]));
  const todays = byDate.get(s.today);
  const doneDays = new Set(s.weekExecs.map((e) => e.executed_on));
  const healthInputs = s.health.map((e) => toHealthInput(e, s.today));
  const away = blockingAt(healthInputs, s.today);
  const phase = s.plan?.phaseByWeek.get(weekStartSunday(s.today));
  const goal = race?.goal_time_seconds
    ? assessRaceGoal({ today: s.today, raceDate: race.race_date, distanceM: race.distance_m, goalSeconds: race.goal_time_seconds,
        prs: s.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds })) })
    : null;
  const ev = todays ? evaluateWorkout(todays, s.weekExecs, s.zones, s.today, s.maxHr) : null;
  const stateOf = (date: string, plan: PlanDay | undefined) => dayState({
    plan, execs: s.weekExecs.filter((e) => e.executed_on === date), skipped: s.skipped, zones: s.zones, today: s.today, maxHr: s.maxHr,
  });
  const todaySt = stateOf(s.today, todays);
  const kcal = s.weekExecs.reduce((n, e) => n + (e.calories ?? 0), 0);
  const sum = weekSummary(s.weekPlan, s.weekExecs, s.zones, s.today, s.maxHr);

  return (
    <>
      <header className="flex items-start justify-between pt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted">{weekdayName(s.today)}, {dayMonthLong(s.today)}</span>
          <h1 className="display m-0 text-[34px] leading-[1.05]">Hoje</h1>
        </div>
        {(away || phase) && <span className="rounded-full bg-ink px-2.5 py-1.5 text-xs font-semibold text-white">{away ? 'Afastado' : `Fase: ${PHASE_PT[phase!]}`}</span>}
      </header>

      {race ? (
        <Link href="/provas" aria-label={`Próxima prova: ${race.name}`} className="press flex flex-col gap-3 rounded-[18px] bg-ink p-4 text-white no-underline">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#C9CDD3]">Prova {race.priority} · {dayMonth(race.race_date)}</span>
              <span className="display text-[26px] leading-none">{race.name}</span>
              {race.goal_time_seconds && <span className="text-[13px] text-[#C9CDD3]">Meta: {formatTime(race.goal_time_seconds)}</span>}
            </div>
            <div className="flex flex-col items-end">
              <span className="display text-[52px] leading-[0.9] text-peach">{Math.max(0, diffDays(race.race_date, s.today))}</span>
              <span className="text-xs text-[#C9CDD3]">dias</span>
            </div>
          </div>
          {goal && <p className="m-0 text-xs leading-snug text-[#C9CDD3]">{goal.message}</p>}
        </Link>
      ) : (
        <section className="card flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Sem prova cadastrada</span>
            <span className="text-xs text-muted">O treinador monta o plano de evolução enquanto isso.</span>
          </div>
          <Link href="/provas" className="btn-ghost whitespace-nowrap no-underline">Cadastrar</Link>
        </section>
      )}

      {s.missed.map((m) => (
        <section key={m.type} className="flex flex-col gap-3 rounded-2xl border border-tintline bg-tint p-3.5">
          <div className="flex items-center gap-3">
            <Icon name="refresh" className="shrink-0 text-accent2" />
            <span className="text-sm font-semibold">Ontem havia {m.title.toLowerCase()} e não vi corrida no Strava. Não deu?</span>
          </div>
          <SkipForm date={m.date} type={m.type} />
        </section>
      ))}

      {s.actual.filter((a) => a.date >= addDays(s.today, -1)).map((a) => (
        <section key={a.date} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <Icon name="refresh" className="shrink-0 text-muted" />
          <span className="text-[13px] leading-snug text-body"><b className="font-semibold text-ink">{a.title}</b> ({a.date === s.today ? 'hoje' : 'ontem'}) não estava no plano. Contei como carga e ajustei os próximos treinos.</span>
        </section>
      ))}

      {!away && s.trend && (
        <section aria-label="Tendência" className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <Icon name="refresh" className="mt-0.5 shrink-0 text-muted" />
          <span className="text-[13px] leading-snug text-body">{s.trend.message}</span>
        </section>
      )}

      {away ? (
        <section className="card flex flex-col gap-1">
          <span className="text-[15px] font-semibold">Afastado até {br(away.to)}</span>
          <span className="text-[13px] text-muted">
            {away.kind === 'afastamento' ? `A retomada leve começa em ${br(addDays(away.to, 1))}. Sem cobrança até lá.` : 'Treinos pausados por causa da dor.'}
          </span>
        </section>
      ) : todays ? (
        <section aria-label="Treino do dia" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface px-4 py-[18px]">
          <div className="flex items-center justify-between">
            <TypeChip type={todays.type} />
            {todaySt === 'nao_fiz' || todaySt === 'outra' ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATE_UI[todaySt].cls}`}>{STATE_UI[todaySt].label}</span>
            ) : ev?.status === 'feito' || ev?.status === 'parcial' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok"><Icon name="check" size={14} width={2.4} />Feito</span>
            ) : todays.type !== 'prova' && !todays.type.startsWith('academia') ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Icon name="clock" size={14} />Aguardando Strava</span>
            ) : null}
          </div>
          <WorkoutBody w={todays} />
          {todaySt === 'feito' && ev && <EvalNotes ev={ev} />}
          {todays.type !== 'prova' && (
            <DayActions date={todays.date} type={todays.type} state={todaySt}
              hasStrava={s.weekExecs.some((e) => e.executed_on === todays.date && e.source === 'strava')}
              canUndo={todaySt === 'nao_fiz' || todaySt === 'outra' || s.weekExecs.some((e) => e.executed_on === todays.date && e.source === 'manual')} />
          )}
        </section>
      ) : (
        <section className="card flex items-center gap-3">
          <Tag type="descanso" />
          <span className="text-[15px] font-semibold">Hoje é dia de descanso. Aproveite.</span>
        </section>
      )}

      <section aria-label="Semana" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="m-0 text-[15px] font-semibold">Esta semana</h3>
          <Link href="/calendario" className="text-[13px] font-semibold no-underline">Ver mês</Link>
        </div>
        <p className="m-0 text-xs text-muted">
          Corridas {sum.runsDone}/{sum.runsPlanned} · Academia {sum.gymDone}/{sum.gymPlanned} · {sum.kmDone.toFixed(1).replace('.', ',')} de {sum.kmPlanned.toFixed(0)} km
          {kcal > 0 && ` · ${kcal.toLocaleString('pt-BR')} kcal`}
          {' · '}meta: {s.settings.runs_per_week} corrida{s.settings.runs_per_week > 1 ? 's' : ''} + {s.settings.gym_per_week} academia{s.settings.gym_per_week === 1 ? '' : 's'}
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const w = byDate.get(d);
            const isToday = d === s.today;
            const st = stateOf(d, w);
            const done = st === 'feito' || (st === 'livre' && doneDays.has(d));
            return (
              <Link key={d} href={`/calendario?m=${d.slice(0, 7)}&d=${d}`} aria-label={`${weekdayName(d)}, ${dayMonth(d)}`} aria-current={isToday ? 'date' : undefined}
                className={`press relative flex flex-col items-center gap-1 rounded-xl py-2 no-underline ${isToday ? 'bg-ink text-white' : d < s.today ? 'border border-line bg-alt text-ink' : 'border border-line bg-surface text-ink'}`}>
                <span className={`text-[11px] font-semibold ${isToday ? 'text-[#C9CDD3]' : 'text-muted'}`}>{weekdayName(d)[0]}</span>
                <span className="text-base font-bold">{Number(d.slice(8))}</span>
                <Tag type={w?.type ?? 'descanso'} />
                {done && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-ok text-white ring-2 ring-bg" aria-label="Feito"><Icon name="check" size={9} width={3.5} /></span>}
                {(st === 'nao_fiz' || st === 'outra') && <span className={`absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-bg ${st === 'nao_fiz' ? 'bg-bad text-white' : 'bg-[#E8A317] text-white'}`} aria-label={STATE_UI[st].label}>{st === 'nao_fiz' ? '×' : '↔'}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <Link href="/saude" className="btn-outline no-underline">
        <Icon name="care" size={20} />
        Estou com dor ou doente
      </Link>

      {last.length > 0 && (
        <section className="card flex flex-col gap-2">
          <p className="label">{last.length > 1 ? 'Últimos treinos' : 'Último treino'} · {br(last[0]!.executed_on)}</p>
          {last.map((e) => <ExecDetail key={e.id} e={e} />)}
        </section>
      )}
    </>
  );
}
