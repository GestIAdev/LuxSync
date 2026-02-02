/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1000: HAL TRANSLATION MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Universal Translator - Converts artistic intentions to physical reality.
 *
 * COMPONENTS:
 * - FixtureProfiles: Define what each fixture CAN do (color wheel, speed limits)
 * - ColorTranslator: Convert RGB to nearest wheel color
 * - HardwareSafetyLayer: Protect mechanical parts from impossible demands
 *
 * @module hal/translation
 * @version WAVE 1000
 */
// ═══════════════════════════════════════════════════════════════════════════
// PROFILES - EL DICCIONARIO
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Pre-defined profiles
BEAM_2R_PROFILE, LED_PAR_RGB_PROFILE, LED_WASH_PROFILE, LED_STROBE_PROFILE, 
// API
getProfile, getProfileByModel, needsColorTranslation, isMechanicalFixture, registerProfile, listProfiles, } from './FixtureProfiles';
// ═══════════════════════════════════════════════════════════════════════════
// TRANSLATOR - EL INTÉRPRETE
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Class & singleton
ColorTranslator, getColorTranslator, } from './ColorTranslator';
// ═══════════════════════════════════════════════════════════════════════════
// SAFETY LAYER - EL BÚNKER
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Class & singleton
HardwareSafetyLayer, getHardwareSafetyLayer, } from './HardwareSafetyLayer';
// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTION - ONE-LINER TRANSLATION
// ═══════════════════════════════════════════════════════════════════════════
import { getProfile, getProfileByModel } from './FixtureProfiles';
import { getColorTranslator } from './ColorTranslator';
import { getHardwareSafetyLayer } from './HardwareSafetyLayer';
/**
 * 🎯 MASTER TRANSLATION FUNCTION
 *
 * Translates an RGB color for a specific fixture, applying:
 * 1. Profile lookup (what can this fixture do?)
 * 2. Color translation (RGB → wheel color if needed)
 * 3. Safety filtering (debounce, latch, strobe delegation)
 *
 * @param fixtureId - Unique fixture identifier
 * @param targetRGB - Color that Selene wants
 * @param fixtureName - Name or model to detect profile (fallback if no profileId)
 * @param profileId - Explicit profile ID (optional, highest priority)
 * @param currentDimmer - Current dimmer value (for strobe pattern detection)
 * @returns Final color DMX value and metadata
 */
export function translateColor(fixtureId, targetRGB, fixtureName, profileId, currentDimmer = 255) {
    // 1. Get profile
    const profile = profileId
        ? getProfile(profileId)
        : getProfileByModel(fixtureName);
    // 2. Translate color
    const translator = getColorTranslator();
    const translation = translator.translate(targetRGB, profile);
    // 3. Apply safety filter
    const safety = getHardwareSafetyLayer();
    const safetyResult = safety.filter(fixtureId, translation.colorWheelDmx ?? 0, profile, currentDimmer);
    return {
        rgb: translation.outputRGB,
        colorWheelDmx: safetyResult.finalColorDmx,
        colorName: translation.colorName,
        wasTranslated: translation.wasTranslated,
        wasBlocked: safetyResult.wasBlocked,
        isInLatch: safetyResult.isInLatch,
        suggestedShutter: safetyResult.suggestedShutter,
        delegateToStrobe: safetyResult.delegateToStrobe,
    };
}
console.log('[HAL Translation] 🎨 WAVE 1000: HAL Genesis module loaded');
console.log('[HAL Translation]    Components: Profiles ✓ Translator ✓ SafetyLayer ✓');
