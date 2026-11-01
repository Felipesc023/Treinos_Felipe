import { NextResponse, type NextRequest } from 'next/server';
import { safeEqual } from '@/lib/auth';
import { connectWithCode } from '@/lib/strava';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const dest = (flag: string) => {
    const res = NextResponse.redirect(new URL(`/perfil?strava=${flag}`, req.url));
    res.cookies.delete({ name: 'strava_state', path: '/api/strava' });
    return res;
  };
  const code = p.get('code');
  const expected = req.cookies.get('strava_state')?.value;
  if (!code || p.get('error') || !expected || !safeEqual(p.get('state') ?? '', expected)) return dest('erro');
  try {
    await connectWithCode(code, p.get('scope'));
    return dest('ok');
  } catch (e) {
    console.error('strava callback:', e);
    return dest('erro');
  }
}
