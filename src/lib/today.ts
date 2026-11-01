import type { ISODate } from '@/lib/planner';

/** "Hoje" sempre em America/Sao_Paulo (o servidor roda em UTC). */
export const todayISO = (): ISODate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
