/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONES — Barrel export
 * ═══════════════════════════════════════════════════════════════════════════
 * @module core/zones
 * @version WAVE 2543.4
 */
export {
  // Core resolution
  normalizeTagsToCanonical,
  resolveZoneTags,
  resolveZone,
  fixtureMatchesZone,
  getActiveZones,

  // Types
  type ZoneMappableFixture,

  // Re-exports from ShowFileV2
  normalizeZone,
  CANONICAL_ZONES,
  type CanonicalZone,
} from './ZoneMapper'
