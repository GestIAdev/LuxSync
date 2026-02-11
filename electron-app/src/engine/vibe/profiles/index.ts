/**
 * 🎭 WAVE 253: VIBE PROFILES INDEX
 * 
 * Barrel export para todos los perfiles de Vibe.
 * 
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */

import type { VibeProfile, VibeId } from '../../../types/VibeProfile'

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile'
export { VIBE_TECHNO_CLUB } from './TechnoClubProfile'
export { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile'
export { VIBE_POP_ROCK } from './PopRockProfile'
export { VIBE_IDLE } from './IdleProfile'

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT ALL PROFILES
// ═══════════════════════════════════════════════════════════════════════════

import { VIBE_FIESTA_LATINA } from './FiestaLatinaProfile'
import { VIBE_TECHNO_CLUB } from './TechnoClubProfile'
import { VIBE_CHILL_LOUNGE } from './ChillLoungeProfile'
import { VIBE_POP_ROCK } from './PopRockProfile'
import { VIBE_IDLE } from './IdleProfile'

// ═══════════════════════════════════════════════════════════════════════════
// VIBE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registro central de todos los vibes disponibles
 */
export const VIBE_REGISTRY: Record<VibeId, VibeProfile> = {
  'fiesta-latina': VIBE_FIESTA_LATINA,
  'techno-club': VIBE_TECHNO_CLUB,
  'chill-lounge': VIBE_CHILL_LOUNGE,
  'pop-rock': VIBE_POP_ROCK,
  'idle': VIBE_IDLE,
}

/**
 * 🔄 WAVE 2019.10: VIBE ALIAS MAP
 * 
 * Maps legacy vibe IDs to current valid IDs.
 * This allows old clips/projects to work with the new system.
 */
export const VIBE_ALIAS_MAP: Record<string, VibeId> = {
  // Legacy Chronos IDs → Current backend IDs
  'techno': 'techno-club',
  'chillout': 'chill-lounge',
  'rock': 'pop-rock',
  'ambient': 'chill-lounge',
  'electronic': 'techno-club',
  'ballad': 'chill-lounge',
  'hiphop': 'pop-rock',
  'latin': 'fiesta-latina',
  'fiesta': 'fiesta-latina',
  // Direct mappings (already valid)
  'fiesta-latina': 'fiesta-latina',
  'techno-club': 'techno-club',
  'chill-lounge': 'chill-lounge',
  'pop-rock': 'pop-rock',
  'idle': 'idle',
}

/**
 * 🔄 WAVE 2019.10: Normalizes a vibe ID (handles aliases)
 */
export function normalizeVibeId(vibeId: string): VibeId | null {
  // Check direct registry first
  if (vibeId in VIBE_REGISTRY) {
    return vibeId as VibeId
  }
  // Check alias map
  const mapped = VIBE_ALIAS_MAP[vibeId.toLowerCase()]
  if (mapped) {
    console.log(`[VibeManager] 🔄 Mapped legacy ID: '${vibeId}' → '${mapped}'`)
    return mapped
  }
  return null
}

/**
 * Vibe por defecto cuando no se ha seleccionado ninguno
 */
export const DEFAULT_VIBE: VibeId = 'fiesta-latina'

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene un preset de vibe por su ID
 */
export function getVibePreset(vibeId: VibeId): VibeProfile | undefined {
  return VIBE_REGISTRY[vibeId]
}

/**
 * Verifica si un ID de vibe es válido
 */
export function isValidVibeId(id: string): id is VibeId {
  return id in VIBE_REGISTRY
}

/**
 * Lista todos los IDs de vibes disponibles
 */
export function getAllVibeIds(): VibeId[] {
  return Object.keys(VIBE_REGISTRY) as VibeId[]
}

/**
 * Lista todos los vibes disponibles
 */
export function getAllVibes(): VibeProfile[] {
  return Object.values(VIBE_REGISTRY)
}
