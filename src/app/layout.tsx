import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Mesmas fontes do layout, servidas localmente (sem pedir nada ao Google).
const inter = localFont({ src: './fonts/inter.woff2', weight: '400 700', variable: '--font-sans', display: 'swap' });
const barlow = localFont({ src: './fonts/barlow-condensed-700.woff2', weight: '700', variable: '--font-display', display: 'swap' });

export const metadata: Metadata = { title: 'Treinos do Felipe', description: 'Treino híbrido: corrida + musculação', appleWebApp: { capable: true, title: 'Treinos', statusBarStyle: 'default' } };
export const viewport: Viewport = { themeColor: '#F4F3EF', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlow.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
