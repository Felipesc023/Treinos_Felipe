import { diffDays, formatTime } from '@/lib/planner';
import { assessRaceGoal } from '@/lib/plan';
import { loadState } from '@/lib/state';
import { DIST_LABEL } from '@/lib/ui';
import { createRace, deleteRace } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function Provas() {
  const s = await loadState();
  const prs = s.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds }));
  return (
    <>
      <h1 className="text-lg">Provas</h1>
      {s.races.length === 0 && <p className="card text-muted">Nenhuma prova cadastrada. Cadastre a primeira para gerar seu plano.</p>}
      {s.races.map((r) => {
        const g = r.goal_time_seconds
          ? assessRaceGoal({ today: s.today, raceDate: r.race_date, distanceM: r.distance_m, goalSeconds: r.goal_time_seconds, prs })
          : null;
        return (
          <article key={r.id} className="card space-y-1">
            <p className="flex justify-between"><b>{r.name}</b><span className="rounded bg-alt px-2 text-xs">Prioridade {r.priority}</span></p>
            <p className="font-mono text-sm text-muted">
              {r.race_date.split('-').reverse().join('/')} · {DIST_LABEL[r.distance_m] ?? `${r.distance_m / 1000} km`} · {diffDays(r.race_date, s.today)} dias
            </p>
            {r.goal_time_seconds && <p className="text-sm">Meta {formatTime(r.goal_time_seconds)} {g && <b>({g.level})</b>}</p>}
            {g && <p className="text-sm text-muted">{g.message}</p>}
            <form action={deleteRace}><input type="hidden" name="id" value={r.id} /><button className="text-sm text-red underline">Excluir</button></form>
          </article>
        );
      })}

      <form action={createRace} className="card space-y-3">
        <p className="label">Nova prova</p>
        <input name="name" placeholder="Nome" className="input" required />
        <input name="race_date" type="date" className="input" required />
        <select name="distance_m" className="input" defaultValue="5000">
          <option value="5000">5 km</option><option value="10000">10 km</option>
          <option value="21097">21 km</option><option value="42195">42 km</option>
        </select>
        <select name="goal_type" className="input" defaultValue="ambos">
          <option value="pr">Bater PR</option><option value="terminar">Terminar</option><option value="ambos">Os dois</option>
        </select>
        <input name="goal_time" placeholder="Meta (mm:ss ou h:mm:ss) — opcional" className="input font-mono" />
        <select name="priority" className="input" defaultValue="A">
          <option value="A">Prioridade A (alvo principal)</option><option value="B">B</option><option value="C">C</option>
        </select>
        <button className="btn w-full">Salvar e gerar plano</button>
      </form>
    </>
  );
}
