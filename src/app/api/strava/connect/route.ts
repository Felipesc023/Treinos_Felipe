import { NextResponse } from 'next/server';
import { authorizeUrl } from '@/lib/strava';

/** Guarda um `state` aleatório num cookie: o retorno da Strava só vale se trouxer o mesmo (evita ligar a conta de outra pessoa). */
export const GET = () => {
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set('strava_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/strava' });
  return res;
};
