'use client';

import Link from 'next/link';

/** Qualquer falha ao montar uma tela (banco fora do ar, dado inesperado) cai aqui, com a navegação ainda de pé. */
export default function ErroDaTela({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="card mt-4 flex flex-col gap-3">
      <h1 className="m-0 text-base font-bold">Não consegui carregar esta tela</h1>
      <p className="m-0 text-sm text-muted">Pode ser a conexão ou o banco de dados fora do ar por um instante. Seus treinos continuam salvos.</p>
      <button onClick={reset} className="btn w-full">Tentar de novo</button>
      <Link href="/" className="btn-ghost w-full no-underline">Ir para Hoje</Link>
    </section>
  );
}
