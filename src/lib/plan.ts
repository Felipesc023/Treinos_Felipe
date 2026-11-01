import {
  DEFAULT_CONFIG, addDays, allocatePhases, assessGoal, blockForPhase, buildGymSession, diffDays, formatPace,
  DEFAULT_FITNESS, DEFAULT_SETTINGS, formatTime, makeRequest, referencePace5k, repSeconds, returnFactor, returnWeeks, riegel, scaleSpec,
  scheduleWeek, weekDates, weekRequests, weekStartSunday, weekdayOf, zonesFrom,
  type CoachPhase, type CoachSettings, type Fitness,
  type DayTemplate, type DroppedSession, type GoalAssessment, type HealthRestriction, type ISODate, type PersonalRecordInput,
  type PlannedWorkout, type WorkoutType, type ZoneName,
} from '@/lib/planner';

export type Phase = CoachPhase | 'retomada';
/** Uma linha do treino: rótulo à esquerda, ritmo/séries à direita (`strong` = a parte principal). */
export interface Step { label: string; sub?: string; right?: string; strong?: boolean }
export interface PlanDay extends PlannedWorkout {
  phase: Phase;
  steps: Step[];
  /** Mesmas linhas em texto corrido. */
  detail: string[];
  /** Orientação da semana na academia (referência, volume ou força). */
  note?: string;
}

export const stepText = (s: Step) => `${s.label}${s.sub ? ` (${s.sub})` : ''}${s.right ? ` · ${s.right}` : ''}`;
export interface PlanResult { days: PlanDay[]; dropped: DroppedSession[]; phaseByWeek: Map<ISODate, Phase>; warnings: string[] }

/** `to` = último dia sem treinar (a retomada começa no dia seguinte). */
export interface HealthInput { kind: 'afastamento' | 'dor'; from: ISODate; to: ISODate; mode: 'seguir_restrito' | 'parar'; region?: string }
export interface SkippedInput { date: ISODate; type: WorkoutType }

/** Quantos dias de treinos anteriores o agendador precisa enxergar (maior janela das regras: perna ↔ corrida forte). */
const CONTEXT_DAYS = 7;
const KEY_TYPES: WorkoutType[] = ['intervalado', 'tempo', 'longao'];
const isBlocking = (h: HealthInput) => h.kind === 'afastamento' || h.mode === 'parar';
const br = (d: ISODate) => `${d.slice(8)}/${d.slice(5, 7)}`;

/** Padrão inicial: domingo e quarta de descanso; sábado com mais tempo (longão). */
export const DEFAULT_TEMPLATE: DayTemplate[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isRest: weekday === 0 || weekday === 3,
  maxMinutes: weekday === 6 ? 120 : 75,
}));

/** Disponibilidade semanal a partir dos dias de descanso escolhidos (0 = domingo); sábado tem mais tempo (longão). */
export const templateFrom = (restDays: number[]): DayTemplate[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, isRest: restDays.includes(weekday), maxMinutes: weekday === 6 ? 120 : 75 }));

export interface RaceInput { name: string; date: ISODate; distanceM: number }

const range = (z: readonly [number, number]) => `${formatPace(z[0])}–${formatPace(z[1])} /km`;

interface Detail { steps: Step[]; note?: string }

function detailFor(w: PlannedWorkout, phase: Phase, p5k: number | null, volumeFactor = 1, avoidRegions: string[] = [], variant = 0): Detail {
  if (w.type === 'academia_inferior' || w.type === 'academia_superior') {
    const g = buildGymSession(w.type === 'academia_inferior' ? 'inferior' : 'superior', blockForPhase(phase === 'manutencao' ? 'base' : phase),
      { volumeFactor: (phase === 'taper' ? 0.67 : 1) * volumeFactor, restrictions: { avoidRegions }, variant });
    return {
      steps: g.items.map((i) => ({ label: i.name, ...(i.tempo ? { sub: i.tempo } : {}), right: `${i.sets}×${i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}`, strong: true })),
      ...(g.note ? { note: g.note } : {}),
    };
  }
  if (w.type === 'prova' || w.type === 'externo' || w.type === 'descanso') return { steps: [] };
  return { steps: runSteps(w, p5k === null ? null : zonesFrom(p5k)) };
}

function runSteps(w: PlannedWorkout, z: Record<ZoneName, readonly [number, number]> | null): Step[] {
  const sp = w.spec ?? {};
  const pace = (n: ZoneName) => (z ? range(z[n]) : undefined);
  const km = sp.km ? `${String(sp.km).replace('.', ',')} km` : `~${w.estMinutes} min`;
  const mmss = (sec: number) => formatTime(Math.round(sec));
  const warm: Step = { label: 'Aquecimento · 10 min', ...(pace('leve') ? { right: pace('leve')! } : {}) };
  const cool: Step = { label: 'Desaquecimento · 10 min', ...(pace('leve') ? { right: pace('leve')! } : {}) };
  const withPace = (st: Step, n: ZoneName): Step => (pace(n) ? { ...st, right: pace(n)! } : st);
  switch (w.type) {
    case 'leve':
      if (sp.fartlekMin) {
        return [{ label: 'Aquecimento · 10 min', ...(pace('leve') ? { right: pace('leve')! } : {}) },
          withPace({ label: `Fartlek · ${sp.fartlekMin} min`, sub: '1 min forte, 1 min leve', strong: true }, 'tempo'),
          { label: 'Desaquecimento · 5 min' }];
      }
      return [withPace({ label: `Corrida leve · ${km}`, strong: true }, 'leve'),
        ...(sp.strides ? [{ label: `${sp.strides}× aceleradas de 100 m`, sub: 'soltas, voltando caminhando' }] : [])];
    case 'longao':
      return [withPace({ label: `Longão · ${km}`, strong: true }, 'longao'),
        ...(sp.progressive ? [withPace({ label: 'Últimos 2 km', sub: 'em ritmo de tempo' }, 'tempo')] : [])];
    case 'ativacao': return [{ label: `Trote curto · ${km}`, strong: true }, { label: '4× aceleradas de 100 m' }];
    case 'tempo': return [warm, withPace({ label: `${sp.steadyMin ?? 20} min contínuos`, strong: true }, 'tempo'), cool];
    case 'intervalado': {
      if (!sp.reps || !sp.repM) return [warm, { label: 'Tiros em ritmo forte', strong: true }, cool];
      const zone = sp.zone ?? 'rep600';
      const t = z ? ` em ${mmss(repSeconds(z[zone][0], sp.repM))}–${mmss(repSeconds(z[zone][1], sp.repM))}` : '';
      return [warm, withPace({ label: `${sp.reps} × ${sp.repM} m${t}`, sub: `recuperação: ${sp.recM} m trote`, strong: true }, zone), cool];
    }
    default: return [];
  }
}

/** Gera o plano do próximo ciclo (até a prova; sem prova, manutenção). Puro e determinístico: recalcular = chamar de novo. */
export function generatePlan(opts: {
  today: ISODate; race?: RaceInput; prs: PersonalRecordInput[]; template?: DayTemplate[];
  health?: HealthInput[]; skipped?: SkippedInput[]; fitness?: Fitness; settings?: CoachSettings;
  /** O que o atleta já fez fora do plano (futebol…): entra nas regras de recuperação dos dias seguintes. */
  actual?: PlannedWorkout[];
  /** Tendência das últimas semanas: multiplica o volume das duas primeiras semanas (1 = manter). */
  loadFactor?: number;
}): PlanResult {
  const { today, race } = opts;
  const cfg = DEFAULT_CONFIG;
  const template = opts.template ?? DEFAULT_TEMPLATE;
  const health = opts.health ?? [];
  const skipped = opts.skipped ?? [];
  const actual = (opts.actual ?? []).filter((a) => a.date <= today);
  const fitness = opts.fitness ?? DEFAULT_FITNESS;
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const blockers = health.filter(isBlocking);
  const p5k = opts.prs.length ? referencePace5k(opts.prs) : null;
  const firstWeek = weekStartSunday(today);
  // Sem prova: o calendário cobre o fim do último evento (e a retomada, se houver) + a janela de manutenção.
  const lastEnd = health.reduce((m, h) => {
    const end = h.kind === 'afastamento' ? addDays(h.to, returnWeeks(diffDays(h.to, h.from) + 1, cfg) * 7) : h.to;
    return end > m ? end : m;
  }, today);
  const totalWeeks = race
    ? Math.max(1, diffDays(weekStartSunday(race.date), firstWeek) / 7 + 1)
    : Math.min(40, Math.ceil(diffDays(addDays(lastEnd, cfg.maintenanceHorizonWeeks * 7), firstWeek) / 7));
  const seq: CoachPhase[] = race
    ? (() => {
        const a = allocatePhases(totalWeeks, race.distanceM, cfg);
        return [
          ...Array<CoachPhase>(a.maintenance).fill('manutencao'), ...Array<CoachPhase>(a.base).fill('base'),
          ...Array<CoachPhase>(a.speed).fill('velocidade'), ...Array<CoachPhase>(a.peak).fill('pico'),
          ...Array<CoachPhase>(a.taper).fill('taper'),
        ];
      })()
    : Array<CoachPhase>(totalWeeks).fill('manutencao');
  const eve = race ? addDays(race.date, -1) : undefined;
  const raceDay: PlannedWorkout | null = race
    ? { date: race.date, type: 'prova', title: race.name, intensity: 5, legLoad: 3, estMinutes: 60, rationale: 'Dia da prova.' }
    : null;

  const restrictions: HealthRestriction[] = health
    .filter((h) => h.kind === 'dor' && h.mode === 'seguir_restrito')
    .map((h) => ({ from: h.from, to: h.to, label: `Dor${h.region ? ` (${h.region})` : ''}`, maxIntensity: cfg.restrictedMaxIntensity }));
  /** Regiões a poupar na academia: durante o evento (afastamento ou dor) e por `regionAvoidAfterDays` depois. */
  const avoidAt = (date: ISODate) => health
    .filter((h) => h.region && date >= h.from && date <= addDays(h.to, cfg.regionAvoidAfterDays))
    .map((h) => h.region!);

  /** Índice (0 = primeira) da semana de retomada, ou null; com vários afastamentos vale a mais conservadora. */
  const returnIdx = (weekStart: ISODate): number | null => {
    let best: number | null = null;
    for (const h of health.filter((x) => x.kind === 'afastamento')) {
      const k = diffDays(weekStart, weekStartSunday(addDays(h.to, 1))) / 7;
      if (k >= 0 && k < returnWeeks(diffDays(h.to, h.from) + 1, cfg) && (best === null || k < best)) best = k;
    }
    return best;
  };
  const manyMissed = skipped.filter((x) => diffDays(today, x.date) >= 1 && diffDays(today, x.date) <= cfg.missedManyWindowDays).length
    >= cfg.missedManyThreshold;

  const warnings: string[] = [];
  if (race) {
    for (const h of blockers) {
      if (race.date >= h.from && race.date <= h.to) warnings.push(`Prova em ${br(race.date)} cai dentro do afastamento (${br(h.from)}–${br(h.to)}).`);
    }
    if (returnIdx(weekStartSunday(race.date)) !== null) warnings.push('Prova durante a retomada: considere ajustar a meta.');
  }

  const all: PlanDay[] = [];
  const dropped: DroppedSession[] = [];
  const phaseByWeek = new Map<ISODate, Phase>();
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7);
    const basePhase: CoachPhase = seq[i] ?? 'taper';
    const ret = returnIdx(weekStart);
    const phase: Phase = ret !== null && basePhase !== 'taper' ? 'retomada' : basePhase;
    phaseByWeek.set(weekStart, phase);
    const fixed = raceDay && race!.date >= weekStart && race!.date <= addDays(weekStart, 6) ? [raceDay] : [];

    const blockedDays = weekDates(weekStart).filter((d) => blockers.some((h) => d >= h.from && d <= h.to));
    if (blockedDays.length === 7) {
      for (const w of fixed) all.push({ ...w, phase, steps: [], detail: [] });
      continue;
    }
    const weekTemplate = blockedDays.length
      ? template.map((t) => (blockedDays.some((d) => weekdayOf(d) === t.weekday) ? { ...t, isRest: true } : t))
      : template;

    // Rodízio dos treinos de qualidade ancorado na prova (estável entre dias); sem prova, no calendário.
    const weeksToRace = race ? diffDays(weekStartSunday(race.date), weekStart) / 7 : null;
    const seed = weeksToRace ?? Math.floor(diffDays(weekStart, '2026-01-04') / 7);
    const deload = basePhase !== 'taper' && (weeksToRace !== null ? weeksToRace >= 4 && weeksToRace % 4 === 0 : i % 4 === 3);
    let requests = weekRequests({
      phase: basePhase, i, seed, deload, fitness, settings, p5k, eve, weekStart,
      ...(race ? { raceDistanceM: race.distanceM } : {}),
    });
    if (i === 0) {
      for (const sk of skipped) {
        if (!KEY_TYPES.includes(sk.type) || sk.date >= today || sk.date < weekStart) continue;
        const idx = requests.findIndex((r) => r.type === sk.type);
        if (idx < 0) continue;
        const req = requests[idx]!;
        requests[idx] = { ...req, notBefore: today, preferredWeekday: weekdayOf(today), reducible: true,
          rationale: `Reencaixe: ${req.title} não foi feito antes. ${req.rationale}` };
      }
    }
    if (ret !== null) {
      requests = requests.map((r) => (r.type === 'intervalado' || r.type === 'tempo'
        ? makeRequest('leve', r.preferredWeekday, {
            title: 'Corrida leve', estMinutes: Math.round(r.estMinutes * 0.7), rationale: 'Retomada: só ritmo fácil.',
            spec: { km: Math.max(3, Math.round((r.spec?.km ?? 6) * 0.7)) },
          })
        : r));
    }
    // faltas explícitas e tendência medem quase a mesma coisa: vale a mais conservadora, sem somar as duas
    const recent = i <= 1 ? Math.min(manyMissed ? cfg.missedManyFactor : 1, opts.loadFactor ?? 1) : 1;
    const factor = (ret !== null ? returnFactor(ret, cfg) : 1) * recent;
    if (factor < 1) {
      requests = requests.map((r) => ({ ...r, estMinutes: Math.round(r.estMinutes * factor), ...(r.spec ? { spec: scaleSpec(r.spec, factor) } : {}) }));
    }

    const r = scheduleWeek({
      weekStart, template: weekTemplate, raceDate: race?.date, fixed, requests,
      // as regras só olham alguns dias para trás: validar o plano inteiro a cada semana custava O(n²)
      context: [...actual.filter((a) => a.date >= addDays(weekStart, -CONTEXT_DAYS)), ...all.filter((d) => d.date >= addDays(weekStart, -CONTEXT_DAYS))],
      ...(restrictions.length ? { restrictions } : {}),
    });
    dropped.push(...r.dropped);
    for (const w of r.workouts) {
      const d = detailFor(w, phase, p5k, factor, avoidAt(w.date), seed);
      all.push({ ...w, phase, steps: d.steps, detail: d.steps.map(stepText), ...(d.note ? { note: d.note } : {}) });
    }
  }
  const days = all.filter((d) => d.date >= today && (!race || d.date <= race.date));
  return { days, dropped, phaseByWeek, warnings };
}

/** Meta × tempo disponível, projetando o melhor PR para a distância da prova. */
export function assessRaceGoal(opts: {
  today: ISODate; raceDate: ISODate; distanceM: number; goalSeconds: number; prs: PersonalRecordInput[];
}): GoalAssessment | null {
  if (!opts.prs.length) return null;
  const projected = Math.min(...opts.prs.map((p) => riegel(p.timeSeconds, p.distanceM, opts.distanceM)));
  const weeks = Math.max(0, diffDays(opts.raceDate, opts.today) / 7);
  return assessGoal(projected, opts.goalSeconds, weeks, DEFAULT_CONFIG);
}
