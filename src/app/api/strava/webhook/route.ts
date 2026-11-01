import { after, NextResponse, type NextRequest } from 'next/server';
import { safeEqual } from '@/lib/auth';
import { env } from '@/lib/env';
import { handleEvent, type WebhookEvent } from '@/lib/strava';

/** Validação da assinatura do webhook pela Strava. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = p.get('hub.verify_token') ?? '';
  if (p.get('hub.mode') !== 'subscribe' || !safeEqual(token, env('STRAVA_VERIFY_TOKEN'))) {
    return new NextResponse('forbidden', { status: 403 });
  }
  return NextResponse.json({ 'hub.challenge': p.get('hub.challenge') });
}

/** Responde 200 na hora; o processamento roda depois da resposta. */
export async function POST(req: NextRequest) {
  const ev = (await req.json().catch(() => null)) as WebhookEvent | null;
  if (ev && (ev.object_type === 'activity' || ev.object_type === 'athlete')) after(() => handleEvent(ev));
  return new NextResponse('ok', { status: 200 });
}
