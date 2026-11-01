import { formatPace, formatTime, paceSecPerKm } from '@/lib/planner';
import { loadState } from '@/lib/state';
import { DIST_LABEL } from '@/lib/ui';
import { addPr, deletePr, logout, syncStrava } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function Perfil({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const { strava: flash } = await searchParams;
  const s = await loadState();
  return (
    <>
      <h1 className="text-lg">Perfil</h1>

      <section className="card space-y-2">
        <p className="label">Recordes pessoais</p>
        {s.prs.length === 0 && <p className="text-sm text-muted">Sem recordes. Eles definem seus ritmos de treino.</p>}
        {s.prs.map((p) => (
          <form key={p.id} action={deletePr} className="flex items-center justify-between font-mono text-sm">
            <span>{DIST_LABEL[p.distance_m] ?? `${p.distance_m} m`} · {formatTime(p.time_seconds)} · {formatPace(paceSecPerKm(p.time_seconds, p.distance_m))}/km</span>
            <input type="hidden" name="id" value={p.id} /><button className="text-red underline">remover</button>
          </form>
        ))}
        <form action={addPr} className="flex gap-2">
          <select name="distance_m" className="input" defaultValue="5000">
            <option value="5000">5 km</option><option value="10000">10 km</option>
            <option value="21097">21 km</option><option value="42195">42 km</option>
          </select>
          <input name="time" placeholder="mm:ss" className="input font-mono" required />
          <button className="btn">+</button>
        </form>
      </section>

      <section className="card space-y-2">
        <p className="label">Strava</p>
        {flash === 'ok' && <p className="text-sm text-emerald">Strava conectada.</p>}
        {flash === 'erro' && <p role="alert" className="text-sm text-red">Não foi possível conectar. Tente de novo e aceite a leitura de atividades.</p>}
        <p className="text-sm text-muted">
          {s.strava ? `Status: ${s.strava.status}${s.strava.lastSyncedAt ? ` · última sincronização ${new Date(s.strava.lastSyncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}` : 'Desconectada. Treinos do Apple Watch chegam via Strava.'}
        </p>
        <a href="/api/strava/connect" className="btn-ghost w-full">{s.strava ? 'Reconectar' : 'Conectar Strava'}</a>
        {s.strava?.status === 'ativa' && <form action={syncStrava}><button className="btn-ghost w-full">Importar últimos 60 dias</button></form>}
      </section>

      <form action={logout}><button className="btn-ghost w-full">Sair deste aparelho</button></form>
    </>
  );
}
