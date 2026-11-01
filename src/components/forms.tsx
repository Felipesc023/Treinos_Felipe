'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { clearDay, didOther, markDone, skipWorkout } from '@/app/actions';

/** Botão de envio: desabilita e mostra "…" enquanto a ação roda (evita duplo toque). */
export function Submit({ className, children, pendingText = 'Salvando…' }: { className: string; children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-busy={pending} className={className}>{pending ? pendingText : children}</button>;
}

/** Ação destrutiva: o gatilho abre um <dialog> modal (foco preso, Esc fecha) e só o botão vermelho envia o formulário. */
export function DangerButton({ children, confirmText }: { children: React.ReactNode; confirmText: string }) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()}
        className="press -mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-semibold text-bad">{children}</button>
      <dialog ref={ref} aria-label={confirmText} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="dialog m-auto w-[calc(100%-2rem)] max-w-xs rounded-[18px] border border-line bg-surface p-5 text-ink shadow-xl">
        <p className="m-0 text-[15px] font-semibold leading-snug">{confirmText}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="btn-ghost">Cancelar</button>
          <button disabled={pending} className="btn !bg-bad">{pending ? 'Removendo…' : 'Excluir'}</button>
        </div>
      </dialog>
    </>
  );
}

/** "Fiz": marca o treino do dia como feito à mão (a academia nem sempre chega pelo Strava). */
export function DoneForm({ date, type }: { date: string; type: string }) {
  return (
    <form action={markDone}>
      <input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} />
      <Submit className="btn w-full">{type.startsWith('academia') ? 'Fiz a academia' : 'Fiz'}</Submit>
    </form>
  );
}

/** "Não deu": registra o motivo e deixa o plano se ajustar. */
export function SkipForm({ date, type }: { date: string; type: string }) {
  return (
    <form action={skipWorkout} className="flex gap-2">
      <input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} />
      <select name="reason" className="input" defaultValue="sem_tempo" aria-label="Motivo">
        <option value="sem_tempo">Sem tempo</option><option value="dor">Dor</option><option value="doenca">Doença</option>
      </select>
      <Submit className="btn-ghost whitespace-nowrap">Não deu</Submit>
    </form>
  );
}

const KINDS: [string, string][] = [
  ['leve', 'Corrida leve'], ['forte', 'Corrida forte'], ['futebol', 'Futebol'], ['quadra', 'Esporte de quadra'],
  ['bike', 'Bicicleta'], ['natacao', 'Natação'], ['academia', 'Academia'], ['nada', 'Não fiz nada'],
];

/** "Fiz outra coisa": o que foi, quanto tempo; o plano dos próximos dias se ajusta. */
function OtherForm({ date, type }: { date: string; type: string }) {
  return (
    <details className="group rounded-xl border border-line2 bg-white">
      <summary className="press flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
        Fiz outra coisa
        <span className="text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>⌄</span>
      </summary>
      <form action={didOther} className="flex flex-col gap-2 border-t border-soft p-3">
        <input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} />
        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <select name="kind" className="input" defaultValue="leve" aria-label="O que você fez">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="relative block">
            <input name="minutes" type="number" inputMode="numeric" min={5} max={300} defaultValue={45} className="input pr-11" aria-label="Duração em minutos" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted" aria-hidden>min</span>
          </label>
        </div>
        <Submit className="btn-ghost w-full">Salvar e ajustar o plano</Submit>
      </form>
    </details>
  );
}

/** Os três jeitos de registrar o dia (fiz, não fiz, fiz outra coisa) e o "desfazer" quando já foi marcado à mão. */
export function DayActions({ date, type, state, canUndo }: { date: string; type: string; state: string; canUndo: boolean }) {
  if (canUndo) {
    return (
      <form action={clearDay}>
        <input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} />
        <Submit className="btn-ghost w-full" pendingText="Desfazendo…">Desfazer o que marquei</Submit>
      </form>
    );
  }
  if (type === 'descanso') return <OtherForm date={date} type={type} />;
  if (state === 'feito') return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <DoneForm date={date} type={type} />
        <form action={skipWorkout}>
          <input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} /><input type="hidden" name="reason" value="sem_tempo" />
          <Submit className="btn-ghost !min-h-[50px] w-full !rounded-[14px] !text-[15px] !font-bold" pendingText="…">Não fiz</Submit>
        </form>
      </div>
      <OtherForm date={date} type={type} />
    </div>
  );
}
