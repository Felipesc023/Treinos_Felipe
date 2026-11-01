import { addDays, diffDays, weekdayOf, type ISODate } from './dates';
import { makeRequest } from './schedule';
import { zonesFrom, type ZoneName } from './paces';
import { scaleSpec } from './spec';
import type { SessionRequest, SessionSpec } from './types';

export { scaleSpec };

/** O que o atleta já aguenta, medido no Strava (últimos 120 dias). */
export interface Fitness { longRunKm: number; weeklyKm: number }
export const DEFAULT_FITNESS: Fitness = { longRunKm: 8, weeklyKm: 18 };

/** Preferências do atleta: quantos treinos por semana. */
export interface CoachSettings { runsPerWeek: number; gymPerWeek: number }
export const DEFAULT_SETTINGS: CoachSettings = { runsPerWeek: 3, gymPerWeek: 2 };

export type CoachPhase = 'base' | 'velocidade' | 'pico' | 'taper' | 'manutencao';

const LONG_CAP: Record<number, number> = { 5000: 12, 10000: 16, 21097: 22, 42195: 32 };
const DEFAULT_P5K = 330; // 5:30/km quando ainda não há recorde

export function fitnessFrom(runs: { executed_on: string; distance_m: number | null }[], today: ISODate): Fitness {
  const recent = runs.filter((r) => (r.distance_m ?? 0) > 1000 && diffDays(today, r.executed_on) >= 0 && diffDays(today, r.executed_on) <= 120);
  if (!recent.length) return DEFAULT_FITNESS;
  const km = recent.map((r) => r.distance_m! / 1000);
  return {
    longRunKm: Math.min(21, Math.max(...km)),
    weeklyKm: km.reduce((a, b) => a + b, 0) / (120 / 7),
  };
}

const QUALITY: Record<'velocidade' | 'pico', SessionSpec[]> = {
  velocidade: [
    { reps: 6, repM: 400, recM: 200, zone: 'rep400' },
    { reps: 5, repM: 600, recM: 200, zone: 'rep600' },
    { steadyMin: 20 },
    { reps: 8, repM: 400, recM: 200, zone: 'rep400' },
    { reps: 5, repM: 800, recM: 400, zone: 'rep800' },
    { steadyMin: 25 },
  ],
  pico: [
    { reps: 4, repM: 1000, recM: 400, zone: 'rep1000' },
    { reps: 5, repM: 800, recM: 400, zone: 'rep800' },
    { steadyMin: 25 },
    { reps: 6, repM: 600, recM: 300, zone: 'rep600' },
  ],
};

const avg = (r: readonly [number, number]) => (r[0] + r[1]) / 2;

/** Minutos de uma corrida contínua de `km` num pace (s/km). */
const minutes = (km: number, paceSec: number) => Math.round((km * paceSec) / 60);

/** Estimativa de km e minutos de um treino de qualidade (aquecimento e desaquecimento de 10 min incluídos). */
function qualityLoad(s: SessionSpec, p5k: number): { km: number; min: number } {
  const z = zonesFrom(p5k);
  const easy = avg(z.leve);
  if (s.steadyMin) {
    const km = 2 * (600 / easy) + (s.steadyMin * 60) / avg(z.tempo);
    return { km: Math.round(km * 2) / 2, min: 20 + s.steadyMin };
  }
  const rep = avg(z[s.zone as ZoneName]);
  const workSec = s.reps! * ((s.repM! / 1000) * rep) + s.reps! * ((s.recM! / 1000) * easy);
  const km = 2 * (600 / easy) + (s.reps! * (s.repM! + s.recM!)) / 1000;
  return { km: Math.round(km * 2) / 2, min: Math.round(20 + workSec / 60) };
}

export interface WeekInput {
  phase: CoachPhase;
  /** Semanas desde a semana atual (0 = esta). Dirige a progressão do longão. */
  i: number;
  /** Número estável por semana de calendário (rodízio dos treinos de qualidade). */
  seed: number;
  deload: boolean;
  fitness: Fitness;
  settings: CoachSettings;
  raceDistanceM?: number;
  p5k: number | null;
  /** Véspera da prova, se cair nesta semana. */
  eve?: ISODate;
  weekStart: ISODate;
}

/** Longão em km: parte de ~85% do que o atleta já fez e sobe 1 km/semana até o teto da prova; semana de descarga −20%. */
export function longRunKm(o: Pick<WeekInput, 'phase' | 'i' | 'deload' | 'fitness' | 'raceDistanceM'>): number {
  const cap = o.raceDistanceM ? (LONG_CAP[o.raceDistanceM] ?? 17) : Math.max(10, Math.round(o.fitness.longRunKm));
  const start = Math.min(cap, Math.max(6, Math.round(o.fitness.longRunKm * 0.85)));
  let km = Math.min(cap, start + (o.phase === 'manutencao' ? Math.min(o.i, 2) : o.i));
  if (o.phase === 'taper') km = Math.round(km * 0.6);
  if (o.deload) km = Math.round(km * 0.8);
  return Math.max(5, km);
}

/** Pedidos de treino da semana, já com distância/estrutura. A ordem é a prioridade (o agendador descarta a partir do fim). */
export function weekRequests(o: WeekInput): SessionRequest[] {
  const p5k = o.p5k ?? DEFAULT_P5K;
  const z = zonesFrom(p5k);
  const long = longRunKm(o);
  const easyKm = Math.min(9, Math.max(4, Math.round(long * 0.55)));
  const easyMin = minutes(easyKm, avg(z.leve));
  const stridesOn = o.phase === 'base' || o.phase === 'manutencao';

  const longReq = (): SessionRequest => {
    const progressive = (o.phase === 'velocidade' || o.phase === 'pico') && o.seed % 2 === 0 && !o.deload;
    return makeRequest('longao', 6, {
      title: 'Longão', estMinutes: minutes(long, avg(z.longao)),
      rationale: o.deload ? 'Semana de descarga: volume menor para absorver o treino.' : progressive ? 'Resistência, com final em ritmo mais forte.' : 'Resistência aeróbica.',
      spec: { km: long, ...(progressive ? { progressive: true } : {}) },
    });
  };
  const easyReq = (wd: number, strides: boolean): SessionRequest => makeRequest('leve', wd, {
    title: 'Corrida leve', estMinutes: easyMin,
    rationale: strides ? 'Volume fácil, fechando com aceleradas para manter a técnica.' : 'Volume fácil; recuperação ativa.',
    spec: { km: easyKm, ...(strides ? { strides: 6 } : {}) },
  });
  const qualityReq = (): SessionRequest => {
    if (o.phase === 'velocidade' || o.phase === 'pico') {
      const menu = QUALITY[o.phase];
      const s = menu[o.seed % menu.length]!;
      const load = qualityLoad(s, p5k);
      return makeRequest(s.steadyMin ? 'tempo' : 'intervalado', 4, {
        title: s.steadyMin ? 'Tempo run' : 'Intervalado', estMinutes: load.min, spec: { ...s, km: load.km },
        rationale: o.phase === 'pico' ? 'Específico para o ritmo de prova.' : 'Desenvolvimento de velocidade.',
      });
    }
    // base e manutenção: sem tiros, mas com estímulo variado
    const fartlek = o.seed % 2 === 0;
    return fartlek
      ? makeRequest('leve', 4, { title: 'Fartlek 24 min', estMinutes: 45, intensity: 3, rationale: 'Variações de ritmo sem a rigidez do tiro.',
          spec: { km: easyKm, fartlekMin: 24 } })
      : easyReq(4, true);
  };

  const out: SessionRequest[] = [];
  if (o.phase === 'taper') {
    out.push(
      easyReq(2, false), easyReq(4, false),
      makeRequest('academia_superior', 1, { title: 'Academia superior', rationale: 'Mantém o estímulo sem fadigar as pernas.' }),
    );
  } else {
    const runs: SessionRequest[] = [longReq(), qualityReq(), easyReq(2, stridesOn), easyReq(5, false)];
    out.push(...runs.slice(0, Math.min(4, Math.max(1, o.settings.runsPerWeek))));
    const gym: SessionRequest[] = [
      makeRequest('academia_inferior', 1, { title: 'Academia inferior', rationale: 'Força de base, dois dias antes da qualidade.' }),
      makeRequest('academia_superior', o.phase === 'base' || o.phase === 'manutencao' ? 4 : 5, { title: 'Academia superior', rationale: 'Manutenção do tronco e postura.' }),
    ];
    out.push(...gym.slice(0, Math.min(2, Math.max(0, o.settings.gymPerWeek))));
  }
  if (o.eve && o.eve >= o.weekStart && o.eve <= addDays(o.weekStart, 6)) {
    out.unshift(makeRequest('ativacao', weekdayOf(o.eve), {
      title: 'Ativação curta', rationale: 'Véspera da prova: soltar sem cansar.', spec: { km: 3 },
    }));
  }
  return out;
}
