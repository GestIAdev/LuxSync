/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: Liquid Profiles — Re-exports + Registry
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type { ILiquidProfile } from './ILiquidProfile'
export { TECHNO_PROFILE } from './techno'

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE REGISTRY — SeleneLux usa esto para hot-swap por vibe
// Cada key matchea contra vibeNormalized.includes(key)
// ═══════════════════════════════════════════════════════════════════════════

import type { ILiquidProfile } from './ILiquidProfile'
import { TECHNO_PROFILE } from './techno'

export const PROFILE_REGISTRY: Record<string, ILiquidProfile> = {
  'techno':  TECHNO_PROFILE,
  'electro': TECHNO_PROFILE,
  // Futuro: 'rock': ROCK_PROFILE, 'latino': LATINO_PROFILE, 'chill': CHILL_PROFILE
}

/** Perfil default cuando ningún vibe matchea */
export const DEFAULT_LIQUID_PROFILE: ILiquidProfile = TECHNO_PROFILE
