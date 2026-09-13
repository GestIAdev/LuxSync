/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: Liquid Profiles — Re-exports + Registry
 * ═══════════════════════════════════════════════════════════════════════════
 */
export { TECHNO_PROFILE } from './techno';
export { LATINO_PROFILE } from './latino';
export { POPROCK_PROFILE } from './poprock';
export { CHILL_PROFILE } from './chilllounge';
export { RAVE_PROFILE } from './rave';
import { TECHNO_PROFILE } from './techno';
import { LATINO_PROFILE } from './latino';
import { POPROCK_PROFILE } from './poprock';
import { CHILL_PROFILE } from './chilllounge';
import { RAVE_PROFILE } from './rave';
export const PROFILE_REGISTRY = {
    'techno-club': TECHNO_PROFILE,
    'fiesta-latina': LATINO_PROFILE,
    'pop-rock': POPROCK_PROFILE,
    'chill-lounge': CHILL_PROFILE, // WAVE 2470: Perfil oceánico real
    'idle': TECHNO_PROFILE, // FASE 2: preserva fallback histórico
    'rave': RAVE_PROFILE, // FASE 4: clon techno, id='rave-highfreq'
};
/** Perfil default cuando ningún vibe matchea */
export const DEFAULT_LIQUID_PROFILE = TECHNO_PROFILE;
