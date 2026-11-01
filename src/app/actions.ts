'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { COOKIE, makeSession, safeEqual } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { isValidISODate, parseTime } from '@/lib/planner';
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
  const raw = Object.fromEntries(form);
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
  const distance_m = z.coerce.number().int().positive().parse(form.get('distance_m'));
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
  await backfill(60);
  revalidatePath('/', 'layout');
}
