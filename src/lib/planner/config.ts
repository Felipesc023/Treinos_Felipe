/** Todos os parâmetros do motor. Heurísticas iniciais de treino amador — calibrar com dados reais. */
export interface PlannerConfig {
  /** Dias INTEIROS entre uma perna e a corrida forte seguinte. */
  minDaysBetweenLegAndHardRun: number;
  /** Dias INTEIROS entre uma corrida forte e a perna seguinte. */
  minDaysBetweenHardRunAndLeg: number;
  /** Última academia inferior: no mínimo N dias antes da prova. */
  lastLegGymDaysBeforeRace: number;
  /** Nada com intensidade ≥ 4 nos N dias antes da prova. */
  noHardWithinDaysOfRace: number;
  /** Quantos dias uma sessão pode "andar" do dia preferido ao ser encaixada. */
  maxShiftDays: number;
  /** Fator de volume da versão reduzida. */
  preEventVolumeFactor: number;
  improvementPerWeek: number;
  maxImprovementPerCycle: number;
  taperWeeks: Record<number, number>;
  baseShare: Record<number, number>;
  /** Retomada após afastamento: volume inicial, passo semanal e duração (1 semana a cada N dias parados). */
  returnStartFactor: number;
  returnWeeklyStep: number;
  returnMinWeeks: number;
  returnMaxWeeks: number;
  returnDaysPerWeek: number;
  /** Intensidade máxima com dor em modo "seguir com restrição". */
  restrictedMaxIntensity: number;
  /** Treinos perdidos: a partir de N na janela de D dias, o volume das 2 próximas semanas cai para o fator. */
  missedManyThreshold: number;
  missedManyWindowDays: number;
  missedManyFactor: number;
  /** Sem prova cadastrada: semanas de plano de manutenção além do último afastamento. */
  maintenanceHorizonWeeks: number;
  /** Dias, depois do fim de um afastamento/dor, em que a academia ainda evita a região afetada. */
  regionAvoidAfterDays: number;
}

export const DEFAULT_CONFIG: PlannerConfig = {
  minDaysBetweenLegAndHardRun: 2,
  minDaysBetweenHardRunAndLeg: 1,
  lastLegGymDaysBeforeRace: 5,
  noHardWithinDaysOfRace: 3,
  maxShiftDays: 1,
  preEventVolumeFactor: 0.67,
  improvementPerWeek: 0.008,
  maxImprovementPerCycle: 0.06,
  taperWeeks: { 5000: 1, 10000: 1, 21097: 2, 42195: 3 },
  baseShare: { 5000: 0.5, 10000: 0.5, 21097: 0.6, 42195: 0.65 },
  returnStartFactor: 0.5,
  returnWeeklyStep: 0.1,
  returnMinWeeks: 2,
  returnMaxWeeks: 8,
  returnDaysPerWeek: 14,
  restrictedMaxIntensity: 2,
  missedManyThreshold: 3,
  missedManyWindowDays: 14,
  missedManyFactor: 0.85,
  maintenanceHorizonWeeks: 4,
  regionAvoidAfterDays: 21,
};
