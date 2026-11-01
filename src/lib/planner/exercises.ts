export type Equipment = 'maquina' | 'cabo' | 'livre' | 'peso_corporal';

export type MovementPattern =
  | 'leg_press' | 'knee_ext' | 'knee_flex' | 'calf' | 'core' | 'lumbar' | 'hip_thrust_machine'
  | 'push_h' | 'pull_v' | 'pull_h' | 'shoulder_press' | 'adductor' | 'abductor'
  | 'squat' | 'hinge' | 'lunge';

export interface Exercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  equipment: Equipment;
  unilateral: boolean;
  /** 0 = nenhum, 3 = exige muito equilíbrio (ex.: afundo búlgaro). */
  balanceDemand: 0 | 1 | 2 | 3;
  legLoad: 0 | 1 | 2 | 3;
  /** Regiões que o exercício sobrecarrega (para filtrar por lesão). */
  stressesRegions: string[];
}

export interface AthleteGymPrefs {
  machinesOnly: boolean;
  avoidUnilateral: boolean;
  maxBalanceDemand: 0 | 1 | 2 | 3;
}

export const DEFAULT_GYM_PREFS: AthleteGymPrefs = {
  machinesOnly: true,
  avoidUnilateral: true,
  maxBalanceDemand: 1,
};

const ex = (
  id: string, name: string, pattern: MovementPattern, equipment: Equipment,
  o: Partial<Pick<Exercise, 'unilateral' | 'balanceDemand' | 'legLoad' | 'stressesRegions'>> = {},
): Exercise => ({
  id, name, pattern, equipment,
  unilateral: o.unilateral ?? false,
  balanceDemand: o.balanceDemand ?? 0,
  legLoad: o.legLoad ?? 0,
  stressesRegions: o.stressesRegions ?? [],
});

export const EXERCISE_LIBRARY: Exercise[] = [
  // Inferior — máquinas
  ex('leg-press-45', 'Leg press 45°', 'leg_press', 'maquina', { legLoad: 3, stressesRegions: ['joelho', 'coxa', 'quadril'] }),
  ex('cadeira-extensora', 'Cadeira extensora', 'knee_ext', 'maquina', { legLoad: 2, stressesRegions: ['joelho', 'coxa'] }),
  ex('mesa-flexora', 'Mesa flexora', 'knee_flex', 'maquina', { legLoad: 2, stressesRegions: ['coxa'] }),
  ex('panturrilha-maquina', 'Panturrilha em pé na máquina', 'calf', 'maquina', { legLoad: 1, stressesRegions: ['tornozelo', 'panturrilha'] }),
  ex('hip-thrust-guiado', 'Elevação pélvica guiada (máquina/smith)', 'hip_thrust_machine', 'maquina', { legLoad: 2, stressesRegions: ['lombar', 'quadril'] }),
  ex('extensao-lombar', 'Banco de extensão lombar (máquina)', 'lumbar', 'maquina', { stressesRegions: ['lombar'] }),
  ex('abdominal-maquina', 'Cadeira abdominal (máquina)', 'core', 'maquina', { stressesRegions: ['abdomen'] }),
  // Superior — máquinas e cabo
  ex('supino-maquina', 'Supino reto na máquina (chest press)', 'push_h', 'maquina', { stressesRegions: ['ombro'] }),
  ex('puxador-alto', 'Puxador alto (pulldown)', 'pull_v', 'cabo'),
  ex('remada-sentada', 'Remada sentada (cabo)', 'pull_h', 'cabo', { stressesRegions: ['lombar'] }),
  ex('ombro-maquina', 'Desenvolvimento de ombro na máquina', 'shoulder_press', 'maquina', { stressesRegions: ['ombro'] }),
  ex('adutora', 'Cadeira adutora', 'adductor', 'maquina', { legLoad: 1, stressesRegions: ['quadril', 'coxa'] }),
  ex('abdutora', 'Cadeira abdutora', 'abductor', 'maquina', { legLoad: 1, stressesRegions: ['quadril'] }),
  // Variações (só máquina/cabo): o treino roda entre elas de semana em semana
  ex('leg-press-horizontal', 'Leg press horizontal', 'leg_press', 'maquina', { legLoad: 3, stressesRegions: ['joelho', 'coxa', 'quadril'] }),
  ex('hack-maquina', 'Agachamento hack (máquina)', 'leg_press', 'maquina', { legLoad: 3, stressesRegions: ['joelho', 'coxa', 'lombar'] }),
  ex('cadeira-flexora', 'Cadeira flexora (sentada)', 'knee_flex', 'maquina', { legLoad: 2, stressesRegions: ['coxa'] }),
  ex('panturrilha-sentado', 'Panturrilha sentado na máquina', 'calf', 'maquina', { legLoad: 1, stressesRegions: ['tornozelo', 'panturrilha'] }),
  ex('panturrilha-leg', 'Panturrilha no leg press', 'calf', 'maquina', { legLoad: 1, stressesRegions: ['tornozelo', 'panturrilha'] }),
  ex('gluteo-maquina', 'Glúteo na máquina (coice)', 'hip_thrust_machine', 'maquina', { legLoad: 2, stressesRegions: ['quadril'] }),
  ex('abdominal-cabo', 'Abdominal no cabo (corda)', 'core', 'cabo', { stressesRegions: ['abdomen'] }),
  ex('rotacao-cabo', 'Rotação de tronco no cabo', 'core', 'cabo', { stressesRegions: ['abdomen', 'lombar'] }),
  ex('peck-deck', 'Peck deck (voador)', 'push_h', 'maquina', { stressesRegions: ['ombro'] }),
  ex('supino-inclinado-maquina', 'Supino inclinado na máquina', 'push_h', 'maquina', { stressesRegions: ['ombro'] }),
  ex('puxada-triangulo', 'Puxada com triângulo', 'pull_v', 'cabo'),
  ex('barra-assistida', 'Barra assistida (máquina)', 'pull_v', 'maquina', { stressesRegions: ['ombro'] }),
  ex('remada-articulada', 'Remada articulada (máquina)', 'pull_h', 'maquina'),
  ex('elevacao-lateral-maquina', 'Elevação lateral na máquina', 'shoulder_press', 'maquina', { stressesRegions: ['ombro'] }),
  // Alternativas livres/unilaterais (NÃO entram no perfil "só máquina")
  ex('afundo-bulgaro', 'Afundo búlgaro', 'lunge', 'livre', { unilateral: true, balanceDemand: 3, legLoad: 3, stressesRegions: ['joelho'] }),
  ex('agachamento-livre', 'Agachamento livre', 'squat', 'livre', { balanceDemand: 2, legLoad: 3, stressesRegions: ['joelho', 'lombar'] }),
  ex('terra-romeno', 'Levantamento terra romeno', 'hinge', 'livre', { balanceDemand: 1, legLoad: 2, stressesRegions: ['lombar'] }),
  ex('passada-lateral', 'Passada lateral com elástico', 'lunge', 'peso_corporal', { unilateral: true, balanceDemand: 2, legLoad: 2 }),
  ex('prancha', 'Prancha', 'core', 'peso_corporal', { stressesRegions: ['abdomen'] }),
  ex('flexao', 'Flexão de braço', 'push_h', 'peso_corporal'),
];

export interface GymRestrictions {
  /** Regiões com dor/lesão ativa: exercícios que as sobrecarregam saem da lista. */
  avoidRegions: string[];
}

export function isEligible(
  e: Exercise, prefs: AthleteGymPrefs = DEFAULT_GYM_PREFS, restrictions: GymRestrictions = { avoidRegions: [] },
): boolean {
  if (prefs.machinesOnly && e.equipment !== 'maquina' && e.equipment !== 'cabo') return false;
  if (prefs.avoidUnilateral && e.unilateral) return false;
  if (e.balanceDemand > prefs.maxBalanceDemand) return false;
  if (e.stressesRegions.some((r) => restrictions.avoidRegions.includes(r))) return false;
  return true;
}

export function eligibleExercises(
  lib: Exercise[], prefs?: AthleteGymPrefs, restrictions?: GymRestrictions,
): Exercise[] {
  return lib.filter((e) => isEligible(e, prefs, restrictions));
}
