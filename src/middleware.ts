import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifySession } from '@/lib/auth';

const PUBLIC = ['/login', '/api/strava/webhook'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  if (!process.env.APP_PIN || !secret) {
    // Sem PIN o app abre direto: serve só para desenvolver. Em produção, esquecer a variável não pode expor os dados.
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('Servidor sem APP_PIN/SESSION_SECRET configurados.', { status: 503 });
  }
  if (await verifySession(req.cookies.get(COOKIE)?.value, secret)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-icon.png|manifest.webmanifest).*)'] };
