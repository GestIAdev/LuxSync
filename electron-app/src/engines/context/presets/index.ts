/**
 * 🎛️ VIBE PRESETS INDEX
 * 
 * Exporta todos los presets disponibles y el registro central.
 */

import { VIBE_TECHNO_CLUB } from './TechnoClubProfile';
import { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile';
import { VIBE_POP_ROCK } from './PopRockProfile';
import { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile';
import type { VibeId, VibeProfile } from '../../../types/VibeProfile';

// Re-export individual presets
export { VIBE_TECHNO_CLUB } from './TechnoClubProfile';
export { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile';
export { VIBE_POP_ROCK } from './PopRockProfile';
export { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile';

/**
 * Registro central de todos los Vibes disponibles
 */
export const VIBE_REGISTRY: Map<VibeId, VibeProfile> = new Map([
  ['techno-club', VIBE_TECHNO_CLUB],
  ['fiesta-latina', VIBE_FIESTA_LATINA],
  ['pop-rock', VIBE_POP_ROCK],
  ['chill-lounge', VIBE_CHILL_LOUNGE],
]);

/**
 * Array de todos los Vibe IDs disponibles
 */
export const AVAILABLE_VIBES: VibeId[] = [
  'techno-club',
  'fiesta-latina',
  'pop-rock',
  'chill-lounge',
];

/**
 * Vibe por defecto (el más balanceado)
 */
export const DEFAULT_VIBE: VibeId = 'pop-rock';

/**
 * Obtiene un preset por ID de forma segura
 */
export function getVibePreset(id: VibeId): VibeProfile | undefined {
  return VIBE_REGISTRY.get(id);
}

/**
 * Verifica si un ID de vibe es válido
 */
export function isValidVibeId(id: string): id is VibeId {
  return AVAILABLE_VIBES.includes(id as VibeId);
}
