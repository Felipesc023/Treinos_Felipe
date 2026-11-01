/**
 * Datas SEMPRE como string 'YYYY-MM-DD' e aritmética em UTC.
 * O dia da semana é DERIVADO da data — nunca digitado.
 * (Evita o tipo de erro "04/08 é sexta" que apareceu no planejamento manual.)
 */
export type ISODate = string;
/** 0 = domingo ... 6 = sábado */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_DAY = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKDAY_PT = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

function toMs(d: ISODate): number {
  if (!ISO_RE.test(d)) throw new Error(`Data inválida (esperado YYYY-MM-DD): ${d}`);
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, day);
  if (fromMs(ms) !== d) throw new Error(`Data inexistente: ${d}`);
  return ms;
}

function fromMs(ms: number): ISODate {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromMs(toMs(d) + n * MS_DAY);
}

/** a − b, em dias inteiros. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toMs(a) - toMs(b)) / MS_DAY);
}

export function weekdayOf(d: ISODate): Weekday {
  return new Date(toMs(d)).getUTCDay() as Weekday;
}

export function weekdayName(d: ISODate): string {
  return WEEKDAY_PT[weekdayOf(d)];
}

/** Domingo da semana que contém a data. */
export function weekStartSunday(d: ISODate): ISODate {
  return addDays(d, -weekdayOf(d));
}

export function weekDates(sunday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export function isValidISODate(d: string): boolean {
  try { toMs(d); return true; } catch { return false; }
}
