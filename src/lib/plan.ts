import {
  DEFAULT_CONFIG, addDays, allocatePhases, assessGoal, blockForPhase, buildGymSession, diffDays, formatPace,
  makeRequest, referencePace5k, riegel, scheduleWeek, weekStartSunday, weekdayOf, zonesFrom,
  type DayTemplate, type DroppedSession, type GoalAssessment, type ISODate, type PersonalRecordInput,
  type PlannedWorkout, type SessionRequest, type ZoneName,
} from '@/lib/planner';

export type Phase = 'base' | 'velocidade' | 'pico' | 'taper' | 'manutencao';
export interface PlanDay extends PlannedWorkout { phase: Phase; detail: string[] }
export interface PlanResult { days: PlanDay[]; dropped: DroppedSession[]; phaseByWeek: Map<ISODate, Phase> }

/** Padrão inicial: domingo e quarta de descanso; sábado com mais tempo (longão). */
export const DEFAULT_TEMPLATE: DayTemplate[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isRest: weekday === 0 || weekday === 3,
  maxMinutes: weekday === 6 ? 120 : 75,
}));

export interface RaceInput { name: string; date: ISODate; distanceM: number }

const range = (z: readonly [number, number]) => `${formatPace(z[0])}–${formatPace(z[1])} /km`;

function requestsFor(phase: Phase, weekIdx: number, eve: ISODate | undefined, weekStart: ISODate): SessionRequest[] {
  const q = (t: SessionRequest['type'], wd: number, title: string, rationale: string) =>
    makeRequest(t, wd, { title, rationale });
  const out: SessionRequest[] = [];
  if (phase === 'base') {
    out.push(
      q('longao', 6, 'Longão', 'Construção de base aeróbica.'),
      q('academia_inferior', 1, 'Academia inferior', 'Força de base para suportar o volume.'),
      q('leve', 2, 'Corrida leve', 'Volume fácil.'),
      q('academia_superior', 4, 'Academia superior', 'Manutenção do tronco e postura.'),
      q('leve', 5, 'Corrida leve', 'Volume fácil.'),
    );
  } else if (phase === 'velocidade' || phase === 'pico') {
    out.push(
      q(weekIdx % 2 === 0 ? 'intervalado' : 'tempo', 4, weekIdx % 2 === 0 ? 'Intervalado' : 'Tempo run',
        phase === 'pico' ? 'Específico para o ritmo de prova.' : 'Desenvolvimento de velocidade.'),
      q('longao', 6, 'Longão', 'Resistência.'),
      q('academia_inferior', 1, 'Academia inferior', 'Força, dois dias antes da qualidade.'),
      q('academia_superior', 5, 'Academia superior', 'Manutenção do tronco.'),
      q('leve', 2, 'Corrida leve', 'Recuperação ativa.'),
    );
  } else if (phase === 'taper') {
    out.push(
      q('leve', 2, 'Corrida leve', 'Taper: volume reduzido, pernas frescas.'),
      q('leve', 4, 'Corrida leve curta', 'Taper: soltar as pernas.'),
      q('academia_superior', 1, 'Academia superior', 'Mantém o estímulo sem fadigar as pernas.'),
    );
  } else {
    out.push(
      q('leve', 2, 'Corrida leve', 'Manutenção: ciclo curto.'),
      q('academia_superior', 4, 'Academia superior', 'Manutenção.'),
      q('leve', 5, 'Corrida leve', 'Manutenção.'),
    );
  }
  if (eve && eve >= weekStart && eve <= addDays(weekStart, 6)) {
    out.unshift(q('ativacao', weekdayOf(eve), 'Ativação curta', 'Véspera da prova: soltar sem cansar.'));
  }
  return out;
}

function detailFor(w: PlannedWorkout, phase: Phase, p5k: number | null): string[] {
  if (w.type === 'academia_inferior' || w.type === 'academia_superior') {
    const g = buildGymSession(w.type === 'academia_inferior' ? 'inferior' : 'superior', blockForPhase(phase === 'manutencao' ? 'base' : phase),
      { volumeFactor: phase === 'taper' ? 0.67 : 1 });
    return g.items.map((i) => `${i.name} — ${i.sets}×${i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}`);
  }
  if (w.type === 'prova' || w.type === 'externo' || w.type === 'descanso') return [];
  const z = p5k === null ? null : zonesFrom(p5k);
  const zone = (n: ZoneName) => (z ? ` · ${range(z[n])}` : '');
  const min = `~${w.estMinutes} min`;
  switch (w.type) {
    case 'leve': return [`Corrida leve ${min}${zone('leve')}`];
    case 'ativacao': return [`Trote curto ${min} + 4 aceleradas de 100 m`];
    case 'longao': return [`Longão ${min}${zone('longao')}`];
    case 'tempo': return ['Aquecimento 10 min leve', `20 min contínuos${zone('tempo')}`, 'Desaquecimento 10 min'];
    case 'intervalado': return phase === 'pico'
      ? ['Aquecimento 10 min leve', `4 × 1000 m${zone('rep1000')}`, 'Recuperação 3 min de trote', 'Desaquecimento 10 min']
      : ['Aquecimento 10 min leve', `6 × 600 m${zone('rep600')}`, 'Recuperação 90 s de trote', 'Desaquecimento 10 min'];
    default: return [];
  }
}

/** Gera o plano do próximo ciclo até a prova. Puro e determinístico: recalcular = chamar de novo. */
export function generatePlan(opts: {
  today: ISODate; race: RaceInput; prs: PersonalRecordInput[]; template?: DayTemplate[];
}): PlanResult {
  const { today, race } = opts;
  const template = opts.template ?? DEFAULT_TEMPLATE;
  const p5k = opts.prs.length ? referencePace5k(opts.prs) : null;
  const firstWeek = weekStartSunday(today);
  const totalWeeks = Math.max(1, diffDays(weekStartSunday(race.date), firstWeek) / 7 + 1);
  const a = allocatePhases(totalWeeks, race.distanceM, DEFAULT_CONFIG);
  const seq: Phase[] = [
    ...Array<Phase>(a.maintenance).fill('manutencao'), ...Array<Phase>(a.base).fill('base'),
    ...Array<Phase>(a.speed).fill('velocidade'), ...Array<Phase>(a.peak).fill('pico'),
    ...Array<Phase>(a.taper).fill('taper'),
  ];
  const eve = addDays(race.date, -1);
  const raceDay: PlannedWorkout = {
    date: race.date, type: 'prova', title: race.name, intensity: 5, legLoad: 3, estMinutes: 60,
    rationale: 'Dia da prova.',
  };

  const all: PlanDay[] = [];
  const dropped: DroppedSession[] = [];
  const phaseByWeek = new Map<ISODate, Phase>();
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7);
    const phase = seq[i] ?? 'taper';
    phaseByWeek.set(weekStart, phase);
    const r = scheduleWeek({
      weekStart, template, raceDate: race.date,
      fixed: race.date >= weekStart && race.date <= addDays(weekStart, 6) ? [raceDay] : [],
      context: all, requests: requestsFor(phase, i, eve, weekStart),
    });
    dropped.push(...r.dropped);
    for (const w of r.workouts) all.push({ ...w, phase, detail: detailFor(w, phase, p5k) });
  }
  return { days: all.filter((d) => d.date >= today && d.date <= race.date), dropped, phaseByWeek };
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
