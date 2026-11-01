import { describe, expect, it } from 'vitest';
import { makeSession, safeEqual, verifySession } from '../auth';

describe('sessão por PIN', () => {
  it('cookie válido passa; adulterado, de outro segredo, vazio ou expirado não', async () => {
    const { value } = await makeSession('segredo');
    expect(await verifySession(value, 'segredo')).toBe(true);
    expect(await verifySession(value, 'outro')).toBe(false);
    expect(await verifySession(`${value}0`, 'segredo')).toBe(false);
    expect(await verifySession(undefined, 'segredo')).toBe(false);
    expect(await verifySession('', 'segredo')).toBe(false);
    const [, sig] = value.split('.');
    expect(await verifySession(`1.${sig}`, 'segredo')).toBe(false);
  });
  it('safeEqual compara tamanho e conteúdo', () => {
    expect(safeEqual('123456', '123456')).toBe(true);
    expect(safeEqual('123456', '123457')).toBe(false);
    expect(safeEqual('123', '1234')).toBe(false);
  });
});
