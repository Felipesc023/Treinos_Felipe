import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/** Só no servidor: usa a service role (RLS bloqueia qualquer outro acesso). */
export const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

export interface RaceRow {
  id: string; name: string; race_date: string; distance_m: number;
  goal_type: 'pr' | 'terminar' | 'ambos'; goal_time_seconds: number | null; priority: 'A' | 'B' | 'C';
}
export interface PrRow { id: string; distance_m: number; time_seconds: number; achieved_on: string | null; source: string }
export interface ExecRow {
  id: string; executed_on: string; source: string; name: string | null; sport: string | null;
  distance_m: number | null; duration_s: number | null; avg_pace_s_km: number | null; avg_hr: number | null;
}
