import { decrypt, encrypt } from './crypto';
import { db } from './db';
import { env } from './env';

const API = 'https://www.strava.com/api/v3';

export const authorizeUrl = () =>
  'https://www.strava.com/oauth/authorize?' + new URLSearchParams({
    client_id: env('STRAVA_CLIENT_ID'),
    redirect_uri: `${env('APP_URL')}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });

interface TokenResponse {
  access_token: string; refresh_token: string; expires_at: number; scope?: string; athlete?: { id: number };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('STRAVA_CLIENT_ID'), client_secret: env('STRAVA_CLIENT_SECRET'), ...body }),
  });
  if (!r.ok) throw new Error(`Strava token ${r.status}`);
  return r.json() as Promise<TokenResponse>;
}

export async function connectWithCode(code: string, grantedScope: string | null) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' });
  const scope = grantedScope ?? t.scope ?? '';
  if (!scope.includes('activity:read')) throw new Error('Permissão de leitura de atividades não concedida.');
  const { error } = await db().from('integrations').upsert({
    provider: 'strava',
    external_athlete_id: String(t.athlete?.id ?? ''),
    access_token_enc: encrypt(t.access_token),
    refresh_token_enc: encrypt(t.refresh_token),
    expires_at: new Date(t.expires_at * 1000).toISOString(),
    scope,
    status: 'ativa',
  });
  if (error) throw new Error(error.message);
}

/** Token válido; renova se faltar < 5 min (tokens duram 6 h). */
async function accessToken(): Promise<string> {
  const { data } = await db().from('integrations').select('*').eq('provider', 'strava').maybeSingle();
  if (!data || data.status !== 'ativa') throw new Error('Strava não conectada.');
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60_000) return decrypt(data.access_token_enc);
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(data.refresh_token_enc) });
  await db().from('integrations').update({
    access_token_enc: encrypt(t.access_token),
    refresh_token_enc: encrypt(t.refresh_token),
    expires_at: new Date(t.expires_at * 1000).toISOString(),
  }).eq('provider', 'strava');
  return t.access_token;
}

interface Activity {
  id: number; name: string; sport_type?: string; type?: string; start_date_local: string;
  distance: number; moving_time: number; average_heartrate?: number; max_heartrate?: number;
  laps?: { distance: number; moving_time: number; average_heartrate?: number }[];
}

async function fetchActivity(id: string): Promise<Activity> {
  const r = await fetch(`${API}/activities/${id}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!r.ok) throw new Error(`Strava atividade ${r.status}`);
  return r.json() as Promise<Activity>;
}

export async function importActivity(id: string) {
  const a = await fetchActivity(id);
  const km = a.distance / 1000;
  const row = {
    executed_on: a.start_date_local.slice(0, 10),
    source: 'strava',
    external_id: String(a.id),
    name: a.name,
    sport: a.sport_type ?? a.type ?? null,
    distance_m: Math.round(a.distance),
    duration_s: a.moving_time,
    avg_pace_s_km: km > 0 ? Math.round(a.moving_time / km) : null,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    laps: a.laps ?? null,
  };
  const { error } = await db().from('workout_executions').upsert(row, { onConflict: 'source,external_id' });
  if (error) throw new Error(error.message);
  await db().from('integrations').update({ last_synced_at: new Date().toISOString() }).eq('provider', 'strava');
}

/** Backfill dos últimos N dias (lista resumida → detalhe de cada uma). */
export async function backfill(days = 60) {
  const after = Math.floor(Date.now() / 1000) - days * 86_400;
  const r = await fetch(`${API}/athlete/activities?after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!r.ok) throw new Error(`Strava lista ${r.status}`);
  const list = (await r.json()) as { id: number }[];
  for (const a of list) await importActivity(String(a.id));
  return list.length;
}

export interface WebhookEvent {
  object_type: 'activity' | 'athlete'; object_id: number; aspect_type: 'create' | 'update' | 'delete';
  owner_id: number; updates?: Record<string, string>;
}

/** Grava o evento (log/auditoria) e processa. O upsert por (source, external_id) torna repetições inofensivas. */
export async function handleEvent(ev: WebhookEvent) {
  const sb = db();
  const { data } = await sb.from('ingestion_events').insert({
    source: 'strava', event_type: `${ev.object_type}.${ev.aspect_type}`, external_id: String(ev.object_id), payload: ev,
  }).select('id').single();
  const finish = (status: 'processado' | 'erro', error?: string) =>
    sb.from('ingestion_events').update({ status, error: error ?? null, processed_at: new Date().toISOString() }).eq('id', data?.id ?? '');
  try {
    if (ev.object_type === 'athlete' && ev.updates?.authorized === 'false') {
      await sb.from('integrations').update({ status: 'revogada' }).eq('provider', 'strava');
    } else if (ev.object_type === 'activity' && ev.aspect_type === 'delete') {
      await sb.from('workout_executions').delete().eq('source', 'strava').eq('external_id', String(ev.object_id));
    } else if (ev.object_type === 'activity') {
      await importActivity(String(ev.object_id));
    }
    await finish('processado');
  } catch (e) {
    await finish('erro', e instanceof Error ? e.message : String(e));
  }
}
