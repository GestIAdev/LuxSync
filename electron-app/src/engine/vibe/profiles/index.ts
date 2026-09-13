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
 * 🎭 VIBE CANON FASE 2: la tabla se movió a `core/vibe/VibeCanon.ts`
 * (VIBE_ALIASES) — consolidada con los aliases que antes vivían duplicados en
 * PROFILE_REGISTRY (hal/physics), VIBE_ID_MAP (KineticAdapter) y
 * VibeSectionProfiles. Se re-exporta bajo el nombre histórico para no romper
 * los 3 consumidores existentes (DynamicEffectRegistry, EffectDreamSimulator,
 * VisualEthicalValues).
 *
 * @see core/vibe/VibeCanon.ts — VIBE_ALIASES
 */
export { VIBE_ALIASES as VIBE_ALIAS_MAP } from '../../../core/vibe/VibeCanon'

/**
 * 🔄 WAVE 2019.10: Normalizes a vibe ID (handles aliases)
 *
 * 🎭 VIBE CANON FASE 2: delega en `resolveVibeId()` del Canon pero PRESERVA
 * el contrato null-para-desconocido que VibeManager depende para su rechazo
 * 404 (P3: fallar visible, blueprints §2.2). Detalles del contrato:
 *
 *   · Clave en VIBE_REGISTRY (incluye custom:* injertadas en runtime por
 *     VibeGraftRegistry) → se devuelve tal cual. Esto es lo que hace que
 *     `isKeyNormalized()` del graft registry siga funcionando.
 *   · Alias ('techno' → 'techno-club') → canónico. Case-insensitive, igual
 *     que la implementación anterior.
 *   · Desconocido / custom:* no injertada → null (VibeManager rechaza 404).
 *
 * NOTA: el console.log por mapeo de alias se eliminó (disparaba en cada
 * llamada; el Canon ya emite un único warning por key desconocida).
 */
import { resolveVibeId } from '../../../core/vibe/VibeCanon'

export function normalizeVibeId(vibeId: string): VibeId | null {
  // El check `in` incluye claves custom:* injertadas en runtime — el Canon
  // no puede verlas porque VIBE_IDS es estático. Por eso este pre-check.
  if (vibeId in VIBE_REGISTRY) {
    return vibeId as VibeId
  }
  const resolution = resolveVibeId(vibeId)
  // Cuando source === 'alias', resolution.id es siempre un VibeId (el target
  // del alias). TS no puede inferir esta correlación, por eso el cast es seguro.
  return resolution.source === 'alias' ? (resolution.id as VibeId) : null
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
