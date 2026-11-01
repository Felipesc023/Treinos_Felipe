'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { COOKIE, makeSession, safeEqual } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { healthEventSchema } from '@/lib/health';
import { addDays, isValidISODate, parseTime } from '@/lib/planner';
import { backfill } from '@/lib/strava';
import { todayISO } from '@/lib/today';

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const pin = String(form.get('pin') ?? '');
  if (!safeEqual(pin, env('APP_PIN'))) {
    await new Promise((r) => setTimeout(r, 1500)); // freia tentativa em série
    return 'PIN incorreto.';
  }
  const s = await makeSession(env('SESSION_SECRET'));
  (await cookies()).set(COOKIE, s.value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: s.maxAge, path: '/' });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect('/login');
}

const raceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  race_date: z.string().refine(isValidISODate).refine((d) => d >= todayISO(), 'A data deve ser futura.'),
  distance_m: z.coerce.number().int().positive().max(200_000),
  goal_type: z.enum(['pr', 'terminar', 'ambos']),
  priority: z.enum(['A', 'B', 'C']),
});

export async function createRace(form: FormData) {
  const raw: Record<string, FormDataEntryValue> = Object.fromEntries(form);
  const custom = String(raw.km_custom ?? '').replace(',', '.').trim();
  if (custom) raw.distance_m = String(Math.round(Number(custom) * 1000)); // "outra distância" vale no lugar do chip
  const parsed = raceSchema.parse(raw);
  const goal = String(raw.goal_time ?? '').trim();
  const goal_time_seconds = goal ? parseTime(goal) : null;
  if (goal && !goal_time_seconds) throw new Error('Meta de tempo inválida (use mm:ss).');
  const { error } = await db().from('races').insert({ ...parsed, goal_time_seconds });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteRace(form: FormData) {
  await db().from('races').delete().eq('id', z.string().uuid().parse(form.get('id')));
  revalidatePath('/', 'layout');
}

export async function addPr(form: FormData) {
  const distance_m = Math.round(z.coerce.number().min(0.4).max(200).parse(String(form.get('km')).replace(',', '.')) * 1000);
  const time_seconds = parseTime(String(form.get('time') ?? ''));
  if (!time_seconds) throw new Error('Tempo inválido (use mm:ss).');
  const { error } = await db().from('personal_records').insert({ distance_m, time_seconds, achieved_on: todayISO() });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deletePr(form: FormData) {
  await db().from('personal_records').delete().eq('id', z.string().uuid().parse(form.get('id')));
  revalidatePath('/', 'layout');
}

export async function syncStrava() {
  await backfill();
  revalidatePath('/', 'layout');
}

export async function confirmHealthEvent(form: FormData) {
  const e = healthEventSchema.parse(Object.fromEntries(form));
  const { error } = await db().from('health_events').insert({
    kind: e.kind, mode: e.mode, body_region: e.region ?? null, severity: e.severity ?? null,
    started_on: e.from, expected_end_on: e.to, status: 'ativo',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  redirect('/calendario');
}

/** "Estou liberado/recuperado": o último dia afastado passa a ser ontem, e a retomada começa hoje. */
export async function endHealthEvent(form: FormData) {
  const id = z.string().uuid().parse(form.get('id'));
  const { error } = await db().from('health_events').update({ ended_on: addDays(todayISO(), -1), status: 'resolvido' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

const skipSchema = z.object({
  date: z.string().refine(isValidISODate),
  type: z.enum(['leve', 'longao', 'intervalado', 'tempo', 'ativacao', 'academia_inferior', 'academia_superior']),
  reason: z.enum(['sem_tempo', 'dor', 'doenca']),
});

/** Idempotente: marcar duas vezes o mesmo treino não duplica. */
export async function skipWorkout(form: FormData) {
  const s = skipSchema.parse(Object.fromEntries(form));
  const { error } = await db().from('skipped_workouts')
    .upsert({ skipped_on: s.date, workout_type: s.type, reason: s.reason }, { onConflict: 'skipped_on,workout_type', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

const OTHER = {
  leve: ['Corrida leve', 'Run'], forte: ['Corrida forte', 'Run'], futebol: ['Futebol', 'Soccer'], quadra: ['Esporte de quadra', 'Volleyball'],
  bike: ['Bicicleta', 'Ride'], natacao: ['Natação', 'Swim'], academia: ['Academia', 'WeightTraining'], nada: null,
} as const;
const otherSchema = z.object({
  date: z.string().refine(isValidISODate),
  type: skipSchema.shape.type.or(z.literal('descanso')),
  kind: z.enum(Object.keys(OTHER) as [keyof typeof OTHER, ...(keyof typeof OTHER)[]]),
  minutes: z.coerce.number().int().min(5).max(300).default(45),
});

/** "Fiz outra coisa": o treino planejado conta como não feito (o plano se reencaixa) e a atividade entra na carga dos próximos dias. */
export async function didOther(form: FormData) {
  const o = otherSchema.parse(Object.fromEntries(form));
  if (o.date > todayISO()) throw new Error('Não dá para registrar um dia que ainda não chegou.');
  const sb = db();
  if (o.type !== 'descanso') {
    const { error } = await sb.from('skipped_workouts')
      .upsert({ skipped_on: o.date, workout_type: o.type, reason: 'sem_tempo' }, { onConflict: 'skipped_on,workout_type', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const what = OTHER[o.kind];
  if (what) {
    const { error } = await sb.from('workout_executions').upsert(
      { executed_on: o.date, source: 'manual', external_id: `${o.date}-outro`, name: `Outra: ${what[0]}`, sport: what[1], duration_s: o.minutes * 60 },
      { onConflict: 'source,external_id' },
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath('/', 'layout');
}

/** Desfaz o que foi marcado à mão no dia ("fiz", "não fiz" ou "outra coisa"); o Strava não é tocado. */
export async function clearDay(form: FormData) {
  const s = otherSchema.pick({ date: true, type: true }).parse(Object.fromEntries(form));
  const sb = db();
  await sb.from('skipped_workouts').delete().eq('skipped_on', s.date).eq('workout_type', s.type);
  await sb.from('workout_executions').delete().eq('source', 'manual').in('external_id', [`${s.date}-${s.type}`, `${s.date}-outro`]);
  revalidatePath('/', 'layout');
}

const settingsSchema = z.object({
  runs: z.coerce.number().int().min(1).max(4),
  gym: z.coerce.number().int().min(0).max(2),
  rest: z.array(z.coerce.number().int().min(0).max(6)),
});

export async function saveSettings(form: FormData) {
  const s = settingsSchema.parse({ runs: form.get('runs'), gym: form.get('gym'), rest: form.getAll('rest') });
  // os treinos precisam caber nos dias livres
  if (s.runs + s.gym > 7 - new Set(s.rest).size) redirect('/perfil?cfg=erro');
  const { error } = await db().from('athlete_settings')
    .upsert({ id: 1, runs_per_week: s.runs, gym_per_week: s.gym, rest_days: [...new Set(s.rest)] });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  redirect('/perfil?cfg=ok');
}

/** Marca um treino planejado como feito à mão (útil na academia, que o Strava não traz). Idempotente. */
export async function markDone(form: FormData) {
  const s = skipSchema.pick({ date: true, type: true }).parse(Object.fromEntries(form));
  if (s.date > todayISO()) throw new Error('Não dá para registrar um dia que ainda não chegou.');
  const gym = s.type.startsWith('academia');
  const { error } = await db().from('workout_executions').upsert(
    { executed_on: s.date, source: 'manual', external_id: `${s.date}-${s.type}`, name: gym ? 'Academia' : 'Corrida', sport: gym ? 'WeightTraining' : 'Run' },
    { onConflict: 'source,external_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}
