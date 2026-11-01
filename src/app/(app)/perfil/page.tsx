import Link from 'next/link';
import { DangerButton, Submit } from '@/components/forms';
import { Icon } from '@/components/icons';
import { formatPace, formatTime, paceSecPerKm } from '@/lib/planner';
import { loadData } from '@/lib/state';
import { DIST_LABEL, distLabel } from '@/lib/ui';
import { addPr, deletePr, logout, saveSettings, syncStrava } from '../../actions';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const dynamic = 'force-dynamic';
/** "Importar histórico completo" roda como ação desta página e pode passar dos 10 s padrão. */
export const maxDuration = 60;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card flex flex-col gap-3">
    <h2 className="m-0 text-base font-bold">{title}</h2>
    {children}
  </section>
);

export default async function Perfil({ searchParams }: { searchParams: Promise<{ strava?: string; cfg?: string }> }) {
  const { strava: flash, cfg } = await searchParams;
  const s = await loadData();
  return (
    <>
      <header className="pt-2"><h1 className="display m-0 text-[34px] leading-[1.05]">Perfil</h1></header>

      <form action={saveSettings} className="card flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">Meu treino por semana</h2>
        {cfg === 'ok' && <p role="status" className="m-0 text-sm text-ok">Salvo. O calendário já foi ajustado.</p>}
        {cfg === 'erro' && <p role="alert" className="m-0 text-sm text-bad">Não cabe: corridas + academias precisam caber nos dias livres.</p>}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Corridas
            <select name="runs" defaultValue={s.settings.runs_per_week} className="input">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Academias
            <select name="gym" defaultValue={s.settings.gym_per_week} className="input">{[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">Dias de descanso</legend>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.map((d, i) => (
              <label key={d}>
                <input type="checkbox" name="rest" value={i} defaultChecked={s.settings.rest_days.includes(i)} className="peer sr-only" />
                <span className="chip min-h-[40px] text-xs">{d}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="m-0 text-xs leading-snug text-muted">O treinador decide os tipos, as distâncias e a variação dos exercícios a partir do que você já corre (Strava), dos seus recordes e da fase.</p>
        <Submit className="btn w-full">Salvar</Submit>
      </form>

      <Section title="Recordes pessoais">
        {s.prs.length === 0 && <p className="m-0 text-sm text-muted">Sem recordes. Eles definem seus ritmos de treino.</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {s.prs.map((p) => (
            <li key={p.id}>
              <form action={deletePr} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex flex-col">
                  <span className="font-semibold">{distLabel(p.distance_m)} · {formatTime(p.time_seconds)}</span>
                  <span className="text-xs text-muted">
                    {formatPace(paceSecPerKm(p.time_seconds, p.distance_m))} /km · {p.source === 'strava' ? 'Strava' : 'prova'}{p.achieved_on ? ` · ${p.achieved_on.split('-').reverse().join('/')}` : ''}
                  </span>
                </span>
                {p.source === 'manual' && <><input type="hidden" name="id" value={p.id} /><DangerButton confirmText="Remover este recorde?">Remover</DangerButton></>}
              </form>
            </li>
          ))}
        </ul>
        <form action={addPr} className="flex gap-2">
          <input name="km" type="number" inputMode="decimal" step="0.01" min="0.4" max="200" list="distancias" placeholder="km" aria-label="Distância em km" className="input w-20 shrink-0" required />
          <datalist id="distancias">
            {Object.entries(DIST_LABEL).map(([m, label]) => <option key={m} value={+m / 1000}>{label}</option>)}
          </datalist>
          <input name="time" placeholder="mm:ss ou h:mm:ss" aria-label="Tempo" className="input" required />
          <Submit className="btn min-h-[44px] whitespace-nowrap px-4" pendingText="…">Adicionar</Submit>
        </form>
        <p className="m-0 text-xs text-muted">Digite qualquer distância (8 km, 12 km…). Os recordes do Strava são calculados sozinhos.</p>
      </Section>

      <Section title="Strava">
        {flash === 'ok' && <p role="status" className="m-0 text-sm text-ok">Strava conectada.</p>}
        {flash === 'erro' && <p role="alert" className="m-0 text-sm text-bad">Não foi possível conectar. Tente de novo e aceite a leitura de atividades.</p>}
        <p className="m-0 flex items-center gap-2 text-sm text-muted">
          <span className={`size-2 shrink-0 rounded-full ${s.strava?.status === 'ativa' ? 'bg-ok' : 'bg-line2'}`} aria-hidden />
          {s.strava ? `Status: ${s.strava.status}${s.strava.lastSyncedAt ? ` · última sincronização ${new Date(s.strava.lastSyncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}` : 'Desconectada. Treinos do Apple Watch chegam via Strava.'}
        </p>
        {s.maxHr && <p className="m-0 text-xs leading-snug text-muted">FC máxima estimada pelo seu histórico: <b className="text-ink">{s.maxHr} bpm</b>. Serve para avisar quando um treino leve sai forte demais.</p>}
        <a href="/api/strava/connect" className="btn-ghost w-full no-underline">{s.strava ? 'Reconectar' : 'Conectar Strava'}</a>
        {s.strava?.status === 'ativa' && <form action={syncStrava}><Submit className="btn-ghost w-full" pendingText="Importando…">Importar histórico completo</Submit></form>}
      </Section>

      <Link href="/saude" className="card press flex items-center gap-3 no-underline">
        <Icon name="care" className="text-accent2" />
        <span className="flex flex-1 flex-col"><span className="text-[15px] font-semibold text-ink">Saúde</span><span className="text-xs text-muted">Afastamento, dor e retomada</span></span>
        <Icon name="right" size={18} className="text-muted" />
      </Link>

      {process.env.APP_PIN && <form action={logout}><button className="btn-ghost w-full">Sair deste aparelho</button></form>}
    </>
  );
}
