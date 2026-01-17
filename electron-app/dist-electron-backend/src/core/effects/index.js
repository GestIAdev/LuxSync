/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧨 EFFECTS MODULE - PUBLIC API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 600: EFFECT ARSENAL
 *
 * Exporta todo lo necesario para usar el sistema de efectos.
 *
 * @module core/effects
 * @version WAVE 600
 */
// Effect Manager
export { EffectManager, getEffectManager, resetEffectManager } from './EffectManager';
// Effect Library
export { SolarFlare, createSolarFlare, SOLAR_FLARE_DEFAULT_CONFIG } from './library/SolarFlare';
