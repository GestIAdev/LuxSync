/**
 * 🎛️ VIBE PRESETS INDEX
 * 
 * Exporta todos los presets disponibles y el registro central.
 * 🔌 WAVE 64: Añadido VIBE_IDLE como estado neutro
 */

import { VIBE_IDLE } from './IdleProfile';
import { VIBE_TECHNO_CLUB } from './TechnoClubProfile';
import { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile';
import { VIBE_POP_ROCK } from './PopRockProfile';
import { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile';
import type { VibeId, VibeProfile } from '../../../types/VibeProfile';

// Re-export individual presets
export { VIBE_IDLE } from './IdleProfile';
export { VIBE_TECHNO_CLUB } from './TechnoClubProfile';
export { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile';
export { VIBE_POP_ROCK } from './PopRockProfile';
export { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile';

/**
 * Registro central de todos los Vibes disponibles
 * 🔌 WAVE 64: idle incluido para getVibePreset()
 */
export const VIBE_REGISTRY: Map<VibeId, VibeProfile> = new Map([
  ['idle', VIBE_IDLE],
  ['techno-club', VIBE_TECHNO_CLUB],
  ['fiesta-latina', VIBE_FIESTA_LATINA],
  ['pop-rock', VIBE_POP_ROCK],
  ['chill-lounge', VIBE_CHILL_LOUNGE],
]);

/**
 * Array de Vibe IDs seleccionables por el usuario (excluye idle)
 */
export const AVAILABLE_VIBES: VibeId[] = [
  'techno-club',
  'fiesta-latina',
  'pop-rock',
  'chill-lounge',
];

/**
 * Vibe por defecto cuando Selene se activa = IDLE (espera input)
 * 🔌 WAVE 64: Cambiado de 'pop-rock' a 'idle'
 */
export const DEFAULT_VIBE: VibeId = 'idle';

/**
 * Obtiene un preset por ID de forma segura
 */
export function getVibePreset(id: VibeId): VibeProfile | undefined {
  return VIBE_REGISTRY.get(id);
}

/**
 * Verifica si un ID de vibe es válido (incluye 'idle')
 * 🔌 WAVE 64: Ahora usa VIBE_REGISTRY para incluir idle
 */
export function isValidVibeId(id: string): id is VibeId {
  return VIBE_REGISTRY.has(id as VibeId);
}
