import Link from 'next/link';
import { CalendarDays, Home, Trophy, User } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Hoje', Icon: Home },
  { href: '/calendario', label: 'Calendário', Icon: CalendarDays },
  { href: '/provas', label: 'Provas', Icon: Trophy },
  { href: '/perfil', label: 'Perfil', Icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-xl pb-24">
      <main className="space-y-4 p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href} className="flex-1">
              <Link href={href} className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs text-muted hover:text-ink">
                <Icon size={20} aria-hidden /> {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
