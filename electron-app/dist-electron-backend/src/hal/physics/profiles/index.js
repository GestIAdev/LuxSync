/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: Liquid Profiles — Re-exports + Registry
 * ═══════════════════════════════════════════════════════════════════════════
 */
export { TECHNO_PROFILE } from './techno';
export { LATINO_PROFILE } from './latino';
export { POPROCK_PROFILE } from './poprock';
export { CHILL_PROFILE } from './chilllounge';
import { TECHNO_PROFILE } from './techno';
import { LATINO_PROFILE } from './latino';
import { POPROCK_PROFILE } from './poprock';
import { CHILL_PROFILE } from './chilllounge';
export const PROFILE_REGISTRY = {
    // Full vibeIds (como llegan desde TitanOrchestrator → SeleneLux)
    'techno-club': TECHNO_PROFILE,
    'fiesta-latina': LATINO_PROFILE,
    'pop-rock': POPROCK_PROFILE,
    'chill-lounge': CHILL_PROFILE, // WAVE 2470: Perfil oceánico real
    // Aliases cortos (legacy, internos, Chronos)
    'techno': TECHNO_PROFILE,
    'electro': TECHNO_PROFILE,
    'latino': LATINO_PROFILE,
    'reggaeton': LATINO_PROFILE,
    'salsa': LATINO_PROFILE,
    'cumbia': LATINO_PROFILE,
    'dembow': LATINO_PROFILE,
    'rock': POPROCK_PROFILE,
    'pop': POPROCK_PROFILE,
    'indie': POPROCK_PROFILE,
    'metal': POPROCK_PROFILE,
    'chill': CHILL_PROFILE,
    'lounge': CHILL_PROFILE,
    'ambient': CHILL_PROFILE,
    'jazz': CHILL_PROFILE,
};
/** Perfil default cuando ningún vibe matchea */
export const DEFAULT_LIQUID_PROFILE = TECHNO_PROFILE;
