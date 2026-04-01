/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: Liquid Profiles — Re-exports + Registry
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type { ILiquidProfile } from './ILiquidProfile'
export { TECHNO_PROFILE } from './techno'
export { LATINO_PROFILE } from './latino'
export { POPROCK_PROFILE } from './poprock'

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE REGISTRY — SeleneLux usa esto para hot-swap por vibe
// Cada key matchea contra vibeNormalized.includes(key)
// ═══════════════════════════════════════════════════════════════════════════

import type { ILiquidProfile } from './ILiquidProfile'
import { TECHNO_PROFILE } from './techno'
import { LATINO_PROFILE } from './latino'
import { POPROCK_PROFILE } from './poprock'

export const PROFILE_REGISTRY: Record<string, ILiquidProfile> = {
  'techno':    TECHNO_PROFILE,
  'electro':   TECHNO_PROFILE,
  'latino':    LATINO_PROFILE,
  'reggaeton': LATINO_PROFILE,
  'salsa':     LATINO_PROFILE,
  'cumbia':    LATINO_PROFILE,
  'dembow':    LATINO_PROFILE,
  'rock':      POPROCK_PROFILE,
  'pop':       POPROCK_PROFILE,
  'indie':     POPROCK_PROFILE,
  'metal':     POPROCK_PROFILE,
}

/** Perfil default cuando ningún vibe matchea */
export const DEFAULT_LIQUID_PROFILE: ILiquidProfile = TECHNO_PROFILE
