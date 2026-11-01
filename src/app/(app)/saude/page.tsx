import { Submit } from '@/components/forms';
import { BODY_REGIONS } from '@/lib/health';
import { loadData } from '@/lib/state';
import { endHealthEvent } from '../../actions';

export const dynamic = 'force-dynamic';

const br = (d: string) => d.split('-').reverse().join('/');
const regionLabel = (id: string | null) => BODY_REGIONS.find(([v]) => v === id)?.[1];

function RegionSelect({ required, label }: { required?: boolean; label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">{label}
      <select name="region" className="input" defaultValue="" required={required}>
        <option value="" disabled={required}>{required ? 'Escolha…' : 'Nenhuma / não sei'}</option>
        {BODY_REGIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Chips({ name, options, def }: { name: string; options: [string, string][]; def: string }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} defaultChecked={v === def} className="peer sr-only" />
          <span className="chip text-xs">{l}</span>
        </label>
      ))}
    </div>
  );
}

export default async function Saude() {
  const s = await loadData();
  const ativos = s.health.filter((e) => e.status === 'ativo');
  return (
    <>
      <header className="flex flex-col gap-0.5 pt-2">
        <h1 className="display m-0 text-[34px] leading-[1.05]">Saúde</h1>
        <span className="text-xs text-muted">Antes de mudar o calendário, você vê o que muda e confirma.</span>
      </header>

      {ativos.map((e) => (
        <form key={e.id} action={endHealthEvent} className="flex flex-col gap-2 rounded-2xl border border-tintline bg-tint p-3.5">
          <span className="text-[15px] font-bold">{e.kind === 'afastamento' ? 'Afastado' : `Dor${e.body_region ? ` · ${regionLabel(e.body_region)}` : ''}`}</span>
          <span className="text-[13px] text-body">
            {e.kind === 'afastamento' && e.body_region ? `${regionLabel(e.body_region)} · ` : ''}Desde {br(e.started_on)}{e.expected_end_on ? ` · previsão até ${br(e.expected_end_on)}` : ''}
            {e.kind === 'dor' && ` · ${e.mode === 'parar' ? 'parado' : 'treinando com restrição'}`}
          </span>
          <input type="hidden" name="id" value={e.id} />
          <Submit className="btn-ghost w-full">{e.kind === 'afastamento' ? 'Estou liberado para voltar' : 'Estou recuperado'}</Submit>
        </form>
      ))}

      <form action="/saude/confirmar" method="get" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4">
        <h2 className="m-0 text-base font-bold">Estou afastado</h2>
        <p className="m-0 -mt-2 text-xs text-muted">Doença, cirurgia… Os treinos pausam e, na volta, entra uma retomada gradual.</p>
        <input type="hidden" name="kind" value="afastamento" />
        <input type="hidden" name="mode" value="parar" />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Início
            <input name="from" type="date" defaultValue={s.today} className="input" required />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Volta prevista
            <input name="to" type="date" className="input" required />
          </label>
        </div>
        <RegionSelect label="Parte do corpo afetada (a academia poupa por um tempo)" />
        <button className="btn w-full">Ver o que muda no calendário</button>
      </form>

      <form action="/saude/confirmar" method="get" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4">
        <h2 className="m-0 text-base font-bold">Estou com dor</h2>
        <input type="hidden" name="kind" value="dor" />
        <input type="hidden" name="from" value={s.today} />
        <RegionSelect required label="Onde dói?" />
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">Intensidade (1 leve · 5 não consigo treinar)</legend>
          <Chips name="severity" def="2" options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]} />
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-muted">O que fazer</legend>
          <Chips name="mode" def="seguir_restrito" options={[['seguir_restrito', 'Seguir leve'], ['parar', 'Parar uns dias']]} />
        </fieldset>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Até quando (último dia)
          <input name="to" type="date" className="input" required />
        </label>
        <button className="btn w-full">Ver o que muda no calendário</button>
      </form>
    </>
  );
}
