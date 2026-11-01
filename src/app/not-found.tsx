import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-4 p-4 text-center">
      <h1 className="display m-0 text-[44px] leading-none">Página não encontrada</h1>
      <Link href="/" className="btn no-underline text-white">Ir para Hoje</Link>
    </main>
  );
}
