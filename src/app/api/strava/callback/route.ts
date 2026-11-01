import { NextResponse, type NextRequest } from 'next/server';
import { connectWithCode } from '@/lib/strava';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const dest = (flag: string) => NextResponse.redirect(new URL(`/perfil?strava=${flag}`, req.url));
  const code = p.get('code');
  if (!code || p.get('error')) return dest('erro');
  try {
    await connectWithCode(code, p.get('scope'));
    return dest('ok');
  } catch (e) {
    console.error('strava callback:', e);
    return dest('erro');
  }
}
