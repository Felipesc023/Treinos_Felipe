'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Hoje', icon: 'home' },
  { href: '/calendario', label: 'Calendário', icon: 'calendar' },
  { href: '/provas', label: 'Provas', icon: 'flag' },
  { href: '/perfil', label: 'Perfil', icon: 'user' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[max(18px,env(safe-area-inset-bottom))] pt-1.5">
        {ITEMS.map(({ href, label, icon }) => {
          const on = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={`group relative flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] no-underline transition-colors duration-150 ${on ? 'font-bold text-ink' : 'font-medium text-muted'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out group-active:scale-90 ${on ? 'bg-tint text-accent2' : ''}`}>
                <Icon name={icon} width={on ? 2.2 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
