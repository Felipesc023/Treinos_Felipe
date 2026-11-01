'use client';

import { useActionState } from 'react';
import { login } from '../actions';

export default function Login() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-4 p-4">
      <h1 className="display m-0 text-center text-[34px]">Hybrid Run</h1>
      <form action={action} className="flex flex-col gap-3">
        <label className="label" htmlFor="pin">Digite seu PIN</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus
          className="input text-center text-xl tracking-[0.5em]" required />
        {error && <p role="alert" className="m-0 text-sm text-bad">{error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
