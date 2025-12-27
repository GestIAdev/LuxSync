/**
 * 🔬 PHYSICS MODULE - WAVE 141-146
 * ============================================================================
 * Módulos de física reactiva extraídos de SeleneLux.
 * Cada módulo encapsula la lógica de reactividad específica de un género.
 * 
 * ARQUITECTURA:
 * - Cada physics module recibe una paleta y métricas de audio
 * - Modifica SOLO aspectos reactivos (strobe, brillo, efectos)
 * - NO modifica la generación de color base (HUE)
 * 
 * LAS 4 PIEZAS DEL ROMPECABEZAS:
 * - TechnoStereoPhysics: Strobe blanco en drops (Wave 141)
 * - RockStereoPhysics: Tungsten flash en snare/kick (Wave 142)
 * - LatinoStereoPhysics: Solar Flare + Machine Gun Blackout (Wave 145)
 * - ChillStereoPhysics: Breathing Pulse bioluminiscente (Wave 146)
 * ============================================================================
 */

// WAVE 141: Techno Physics
export { TechnoStereoPhysics } from './TechnoStereoPhysics';
export type { 
  TechnoPalette, 
  TechnoAudioMetrics, 
  TechnoPhysicsResult,
  RGB 
} from './TechnoStereoPhysics';

// WAVE 142: Rock Physics
export { RockStereoPhysics } from './RockStereoPhysics';
export type {
  RockPalette,
  RockAudioMetrics,
  RockPhysicsResult
} from './RockStereoPhysics';

// WAVE 145: Latino Physics
export { LatinoStereoPhysics } from './LatinoStereoPhysics';
export type {
  LatinoPalette,
  LatinoAudioMetrics,
  LatinoPhysicsResult,
  HSL
} from './LatinoStereoPhysics';

// WAVE 146: Chill Physics
export { ChillStereoPhysics } from './ChillStereoPhysics';
export type {
  ChillPalette,
  ChillAudioMetrics,
  ChillPhysicsResult
} from './ChillStereoPhysics';
