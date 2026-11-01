/** Portão de PIN: cookie assinado (HMAC-SHA256). Roda no Edge (middleware) e no Node. */
export const COOKIE = 'hr_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;
const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** Comparação em tempo constante (mesmo tamanho → compara tudo). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function makeSession(secret: string): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  return { value: `${exp}.${await sign(String(exp), secret)}`, maxAge: MAX_AGE_S };
}

export async function verifySession(value: string | undefined, secret: string): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await sign(exp, secret));
}
