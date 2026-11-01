import { after } from 'next/server';
import { Nav } from '@/components/nav';
import { syncIfStale } from '@/lib/strava';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Strava: no máx. a cada 15 min e depois de enviar a página (o que chegar aparece na próxima abertura).
  after(() => syncIfStale().catch((e) => console.error('sync strava:', e)));
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <main className="flex flex-col gap-4 px-4 pt-6">{children}</main>
      <Nav />
    </div>
  );
}
