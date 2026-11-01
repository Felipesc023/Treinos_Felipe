'use client';

import { useActionState } from 'react';
import { Icon } from '@/components/icons';
import { login } from '../actions';

export default function Login() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-8 p-4">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-ink text-peach"><Icon name="flag" size={24} /></span>
        <h1 className="display m-0 text-[44px] leading-[0.95]">Treinos<br />do Felipe</h1>
        <p className="m-0 text-sm text-muted">Corrida e academia, no seu ritmo.</p>
      </header>
      <form action={action} className="card flex flex-col gap-3 p-5">
        <label className="label" htmlFor="pin">Digite seu PIN</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus
          className="input text-center text-xl tracking-[0.5em]" required />
        {error && <p role="alert" className="m-0 text-sm text-bad">{error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
