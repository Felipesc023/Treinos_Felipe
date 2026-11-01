import { z } from 'zod';
import { addDays, isValidISODate, type ISODate } from '@/lib/planner';
import type { HealthEventRow } from './db';
import type { HealthInput } from './plan';

/** Linha do banco → entrada do motor. `to` = último dia sem treinar; sem fim previsto, dor dura 14 dias a partir de hoje. */
export function toHealthInput(e: HealthEventRow, today: ISODate): HealthInput {
  return {
    kind: e.kind,
    from: e.started_on,
    to: e.ended_on ?? e.expected_end_on ?? addDays(today, 14),
    mode: e.mode,
    ...(e.body_region ? { region: e.body_region } : {}),
  };
}

/** Evento que impede treinar na data (afastamento, ou dor em modo "parar"). */
export function blockingAt(inputs: HealthInput[], date: ISODate): HealthInput | undefined {
  return inputs.find((h) => (h.kind === 'afastamento' || h.mode === 'parar') && date >= h.from && date <= h.to);
}

/** Partes do corpo oferecidas nos formulários (precisam bater com `stressesRegions` dos exercícios). */
export const BODY_REGIONS = [
  ['abdomen', 'Abdômen'], ['panturrilha', 'Panturrilha'], ['tornozelo', 'Tornozelo'], ['joelho', 'Joelho'],
  ['coxa', 'Coxa'], ['quadril', 'Quadril / virilha'], ['lombar', 'Lombar'], ['ombro', 'Ombro'],
] as const;
const REGION_IDS = BODY_REGIONS.map(([id]) => id) as [string, ...string[]];

const empty = (v: unknown) => (v === '' ? undefined : v);

/** Formulário de afastamento/dor (também usado para validar a tela de proposta). */
export const healthEventSchema = z.object({
  kind: z.enum(['afastamento', 'dor']),
  mode: z.enum(['seguir_restrito', 'parar']),
  from: z.string().refine(isValidISODate, 'Data de início inválida.'),
  to: z.string().refine(isValidISODate, 'Data de fim inválida.'),
  region: z.preprocess(empty, z.enum(REGION_IDS).optional()),
  severity: z.preprocess(empty, z.coerce.number().int().min(1).max(5).optional()),
}).refine((v) => v.to >= v.from, { message: 'A data de fim não pode ser antes do início.', path: ['to'] });

