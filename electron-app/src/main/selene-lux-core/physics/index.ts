/**
 * 🔬 PHYSICS MODULE - WAVE 141-142
 * ============================================================================
 * Módulos de física reactiva extraídos de SeleneLux.
 * Cada módulo encapsula la lógica de reactividad específica de un género.
 * 
 * ARQUITECTURA:
 * - Cada physics module recibe una paleta y métricas de audio
 * - Modifica SOLO aspectos reactivos (strobe, brillo, efectos)
 * - NO modifica la generación de color base (HUE)
 * ============================================================================
 */

export { TechnoStereoPhysics } from './TechnoStereoPhysics';
export type { 
  TechnoPalette, 
  TechnoAudioMetrics, 
  TechnoPhysicsResult,
  RGB 
} from './TechnoStereoPhysics';

export { RockStereoPhysics } from './RockStereoPhysics';
export type {
  RockPalette,
  RockAudioMetrics,
  RockPhysicsResult
} from './RockStereoPhysics';
