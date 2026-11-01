import { diffDays, formatPace, formatTime } from '@/lib/planner';
import { assessRaceGoal } from '@/lib/plan';
import { loadData } from '@/lib/state';
import { dayMonth, distLabel, monthName } from '@/lib/ui';
import { DangerButton, Submit } from '@/components/forms';
import { createRace, deleteRace } from '../../actions';

export const dynamic = 'force-dynamic';

const GOALS: Record<string, string> = { pr: 'Bater PR', terminar: 'Terminar', ambos: 'PR + base' };

/** Grupo de opções (radio escondido + rótulo): selecionado fica escuro; funciona sem JavaScript. */
function Chips({ name, options, def, cols }: { name: string; options: [string, string][]; def: string; cols: number }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} defaultChecked={v === def} className="peer sr-only" />
          <span className="chip">{l}</span>
        </label>
      ))}
    </div>
  );
}

export default async function Provas() {
  const s = await loadData();
  const prs = s.prs.map((p) => ({ distanceM: p.distance_m, timeSeconds: p.time_seconds }));
  return (
    <>
      <header className="flex items-end justify-between pt-2">
        <h1 className="display m-0 text-[34px] leading-[1.05]">Provas</h1>
        <span className="text-xs text-muted">{s.races.length} futura{s.races.length === 1 ? '' : 's'}</span>
      </header>

      {s.races.length === 0 && <p className="card m-0 text-sm text-muted">Nenhuma prova cadastrada. Cadastre a primeira para o plano mirar nela.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {s.races.map((r) => {
          const g = r.goal_time_seconds
            ? assessRaceGoal({ today: s.today, raceDate: r.race_date, distanceM: r.distance_m, goalSeconds: r.goal_time_seconds, prs })
            : null;
          const guide = s.nextRace?.id === r.id;
          return (
            <li key={r.id} className={`flex flex-col gap-2 rounded-2xl bg-surface p-3.5 ${guide ? 'border-2 border-ink' : 'border border-line'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex w-[52px] shrink-0 flex-col items-center rounded-[10px] py-1.5 ${guide ? 'bg-accent2 text-white' : 'bg-soft text-ink'}`}>
                  <span className="display text-2xl leading-none">{Number(r.race_date.slice(8))}</span>
                  <span className="text-[11px] font-semibold uppercase">{monthName(r.race_date).slice(0, 3)}</span>
                </span>
                <span className="flex flex-1 flex-col gap-[3px]">
                  <span className="text-[15px] font-bold">{distLabel(r.distance_m)} · {r.name}</span>
                  <span className="text-xs text-muted">
                    {GOALS[r.goal_type]}{r.goal_time_seconds ? ` · meta ${formatTime(r.goal_time_seconds)} (${formatPace(r.goal_time_seconds / (r.distance_m / 1000))} /km)` : ''}
                  </span>
                  {guide && <span className="text-xs font-semibold text-accent2">Guia o plano ativo · faltam {diffDays(r.race_date, s.today)} dias</span>}
                </span>
                <span className={`whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-bold ${r.priority === 'A' ? 'bg-ink text-white' : 'bg-soft text-ink'}`}>Prioridade {r.priority}</span>
              </div>
              {g && <p className="m-0 text-xs leading-snug text-muted"><b className="text-ink">{g.level}.</b> {g.message}</p>}
              <form action={deleteRace}><input type="hidden" name="id" value={r.id} /><DangerButton confirmText={`Excluir a prova ${r.name}? O plano será recalculado.`}>Excluir prova</DangerButton></form>
            </li>
          );
        })}
      </ul>

      <form action={createRace} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4">
        <h2 className="m-0 text-base font-bold">Nova prova</h2>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Nome
          <input name="name" placeholder="Ex.: Corrida da Cidade" className="input" required maxLength={80} />
        </label>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">Distância</legend>
          <Chips name="distance_m" cols={4} def="5000" options={[['5000', '5 km'], ['10000', '10 km'], ['21097', 'Meia'], ['42195', 'Maratona']]} />
          <input name="km_custom" type="number" inputMode="decimal" step="0.1" min="0.4" max="200" placeholder="Outra distância (km) — vale no lugar da escolha acima" className="input" />
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Data
            <input name="race_date" type="date" className="input" required />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Tempo-alvo
            <input name="goal_time" placeholder="hh:mm:ss" className="input" />
          </label>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">Objetivo</legend>
          <Chips name="goal_type" cols={3} def="ambos" options={[['pr', 'PR'], ['terminar', 'Terminar'], ['ambos', 'Ambos']]} />
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">Prioridade</legend>
          <Chips name="priority" cols={3} def="A" options={[['A', 'A · Alvo'], ['B', 'B · Média'], ['C', 'C · Treino']]} />
          <ul className="mb-0 mt-2 list-none space-y-0.5 p-0 text-xs leading-snug text-muted">
            <li><b>A:</b> prova-alvo. O plano inteiro é periodizado para ela.</li>
            <li><b>B:</b> entra no plano com mini-taper, sem quebrar a fase atual.</li>
            <li><b>C:</b> tratada como treino forte; sem taper.</li>
          </ul>
        </fieldset>
        <Submit className="btn w-full" pendingText="Gerando plano…">Salvar e gerar plano</Submit>
      </form>
    </>
  );
}
