/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONES — Barrel export
 * ═══════════════════════════════════════════════════════════════════════════
 * @module core/zones
 * @version WAVE 2543.4
 */
export { 
// Core resolution
normalizeTagsToCanonical, resolveZoneTags, resolveZone, fixtureMatchesZone, getActiveZones, 
// Re-exports from ShowFileV2
normalizeZone, CANONICAL_ZONES, } from './ZoneMapper';
