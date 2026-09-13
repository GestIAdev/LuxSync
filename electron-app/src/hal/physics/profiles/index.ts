/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: Liquid Profiles — Re-exports + Registry
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type { ILiquidProfile } from './ILiquidProfile'
export { TECHNO_PROFILE } from './techno'
export { LATINO_PROFILE } from './latino'
export { POPROCK_PROFILE } from './poprock'
export { CHILL_PROFILE } from './chilllounge'

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE REGISTRY — SeleneLux usa esto para hot-swap por vibe
//
// 🎭 VIBE CANON FASE 2: los 14 aliases cortos ('techno', 'latino', 'reggaeton',
// etc.) que vivían aquí se eliminaron — los resuelve `resolveVibeId()` del
// Canon ANTES del lookup (ver SeleneLux.setActiveProfile). El registro queda
// tipado `Record<VibeId, ILiquidProfile>`: el compilador exige completitud
// canónica, y las claves `custom:*` injertadas por VibeGraftRegistry siguen
// siendo posibles en runtime (acceso via cast / lookupVibeMap).
//
// 'idle' → TECHNO_PROFILE preserva el comportamiento histórico: antes el
// lookup de 'idle' caía al `?? DEFAULT_LIQUID_PROFILE` (techno), y TitanEngine
// cortocircuita el modo idle ANTES de que la física líquida se consuma.
// ═══════════════════════════════════════════════════════════════════════════

import type { VibeId } from '../../../core/vibe/VibeCanon'
import type { ILiquidProfile } from './ILiquidProfile'
import { TECHNO_PROFILE } from './techno'
import { LATINO_PROFILE } from './latino'
import { POPROCK_PROFILE } from './poprock'
import { CHILL_PROFILE } from './chilllounge'

export const PROFILE_REGISTRY: Record<VibeId, ILiquidProfile> = {
  'techno-club':    TECHNO_PROFILE,
  'fiesta-latina':  LATINO_PROFILE,
  'pop-rock':       POPROCK_PROFILE,
  'chill-lounge':   CHILL_PROFILE,    // WAVE 2470: Perfil oceánico real
  'idle':           TECHNO_PROFILE,  // FASE 2: preserva fallback histórico
}

/** Perfil default cuando ningún vibe matchea */
export const DEFAULT_LIQUID_PROFILE: ILiquidProfile = TECHNO_PROFILE
