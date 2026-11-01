import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifySession } from '@/lib/auth';

const PUBLIC = ['/login', '/api/strava/webhook'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!process.env.APP_PIN) return NextResponse.next(); // sem APP_PIN = sem senha
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  const ok = await verifySession(req.cookies.get(COOKIE)?.value, process.env.SESSION_SECRET ?? '');
  if (ok) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-icon.png|manifest.webmanifest).*)'] };
