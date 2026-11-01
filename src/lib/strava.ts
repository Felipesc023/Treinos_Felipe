import { decrypt, encrypt } from './crypto';
import { db } from './db';
import { env } from './env';
import { stravaPrs, type EffortRow } from './prs';

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
  best_efforts?: { name: string; elapsed_time: number }[];
  calories?: number; // só no detalhe da atividade, não na lista resumida
  splits_metric?: { distance: number; moving_time: number; average_heartrate?: number }[];
}

async function fetchActivity(id: string, token?: string): Promise<Activity> {
  const r = await fetch(`${API}/activities/${id}`, { headers: { Authorization: `Bearer ${token ?? (await accessToken())}` } });
  if (!r.ok) throw new Error(`Strava atividade ${r.status}`);
  return r.json() as Promise<Activity>;
}

const toSplits = (a: Activity) => (a.splits_metric ?? []).map(({ distance, moving_time, average_heartrate }) => ({
  distance, moving_time, ...(average_heartrate && { average_heartrate }),
}));

const toRow = (a: Activity) => {
  const km = a.distance / 1000;
  return {
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
    ...(a.laps && { laps: a.laps }), // a lista resumida não traz laps nem calorias; não sobrescreve os que já existem
    ...(a.calories !== undefined && { calories: Math.round(a.calories) }),
    ...(a.splits_metric && { splits: toSplits(a) }),
  };
};

export async function importActivity(id: string) {
  const { error } = await db().from('workout_executions').upsert(toRow(await fetchActivity(id)), { onConflict: 'source,external_id' });
  if (error) throw new Error(error.message);
  await db().from('integrations').update({ last_synced_at: new Date().toISOString() }).eq('provider', 'strava');
}

/** Busca o detalhe (calorias, e best_efforts + laps + parciais por km nas corridas) das atividades ainda sem ele: 1 chamada cada, então em lotes (limite do Strava: 100/15 min). */
async function loadEfforts(max: number) {
  const sb = db();
  const { data } = await sb.from('workout_executions').select('id,external_id,sport')
    .eq('source', 'strava').or('calories.is.null,and(sport.ilike.*run*,splits.is.null)')
    .order('executed_on', { ascending: false }).limit(max);
  const rows = data ?? [];
  if (!rows.length) return;
  const token = await accessToken();
  for (let i = 0; i < rows.length; i += 5) {
    const results = await Promise.allSettled(rows.slice(i, i + 5).map(async (r) => {
      const a = await fetchActivity(r.external_id, token);
      await sb.from('workout_executions').update({
        calories: Math.round(a.calories ?? 0),
        ...(/run/i.test(r.sport ?? '') && { best_efforts: (a.best_efforts ?? []).map(({ name, elapsed_time }) => ({ name, elapsed_time })), splits: toSplits(a) }),
        ...(a.laps && { laps: a.laps }),
      }).eq('id', r.id);
    }));
    if (results.some((x) => x.status === 'rejected')) break; // limite de taxa: o resto fica para a próxima sync
  }
}

/** Recalcula os recordes de origem Strava a partir dos melhores esforços; os manuais (provas) não são tocados. */
async function refreshPrs() {
  const sb = db();
  const { data } = await sb.from('workout_executions').select('executed_on,best_efforts').eq('source', 'strava').not('best_efforts', 'is', null);
  const prs = stravaPrs((data ?? []) as EffortRow[]);
  await sb.from('personal_records').delete().eq('source', 'strava');
  if (prs.length) {
    const { error } = await sb.from('personal_records').insert(prs.map((p) => ({ ...p, source: 'strava' })));
    if (error) throw new Error(error.message);
  }
}

/** Importa tudo desde `after` (epoch s; 0 = histórico inteiro). Usa a lista resumida: 1 chamada por 200 atividades. */
export async function backfill(after = 0, maxEfforts = 90) {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  let n = 0;
  for (let page = 1; ; page++) {
    const r = await fetch(`${API}/athlete/activities?after=${after}&per_page=200&page=${page}`, { headers });
    if (!r.ok) throw new Error(`Strava lista ${r.status}`);
    const list = (await r.json()) as Activity[];
    if (!list.length) break;
    const { error } = await db().from('workout_executions').upsert(list.map(toRow), { onConflict: 'source,external_id' });
    if (error) throw new Error(error.message);
    n += list.length;
  }
  await loadEfforts(maxEfforts);
  await refreshPrs();
  await db().from('integrations').update({ last_synced_at: new Date().toISOString() }).eq('provider', 'strava');
  return n;
}

/** Sync automático ao abrir o app: incremental, no máx. a cada 15 min. Sem webhook (precisa de URL pública). */
export async function syncIfStale() {
  const { data } = await db().from('integrations').select('status,last_synced_at').eq('provider', 'strava').maybeSingle();
  if (!data || data.status !== 'ativa') return;
  const last = data.last_synced_at ? new Date(data.last_synced_at).getTime() : 0;
  if (Date.now() - last < 15 * 60_000) return;
  await backfill(last ? Math.floor(last / 1000) - 86_400 : 0, 15); // lote pequeno: não travar a abertura da tela
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
