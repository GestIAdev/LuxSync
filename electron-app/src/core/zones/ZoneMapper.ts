/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONE MAPPER — WAVE 2543.4: THE CENTRALIZED BRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single Source of Truth para resolución de zonas en LuxSync.
 *
 * PROBLEMA RESUELTO:
 *   Antes existían 4+ implementaciones desperdigadas de zone-matching:
 *   - MasterArbiter.getFixtureIdsByZone() (COMPOSITE_ZONES local)
 *   - TitanOrchestrator.fixtureMatchesZone() (if-chain ad hoc)
 *   - TitanOrchestrator.fixtureMatchesZoneStereo() (if-chain + position.x)
 *   - useHephPreview.resolveFixtures() (ZONE_GROUP_MAP + MODIFIER_ZONES)
 *   - TimelineEngine.resolveFixtureIds() (delegaba al Arbiter)
 *
 *   Todas resolvían lo mismo con lógica duplicada e inconsistente.
 *   El resultado: un clip con zones=['back', 'all-right'] encendía 10 de 12.
 *
 * SOLUCIÓN:
 *   Un módulo puro (sin estado, sin side effects) que exporta funciones
 *   deterministas para traducir dialectos de UI a CanonicalZones y
 *   resolver fixture IDs con intersección AND para modifiers.
 *
 * CONSUMIDO POR:
 *   - TimelineEngine.resolveFixtureIds()  (Hyperion playback)
 *   - MasterArbiter.getFixtureIdsByZone() (DMX routing)
 *   - TitanOrchestrator.fixtureMatchesZone[Stereo]() (Selene live)
 *   - useHephPreview.resolveFixtures()    (Hephaestus radar)
 *   - ChronosProject.luxToChronos()       (track assignment)
 *   - TimelineCanvas.generateZoneTracks() (Chronos UI)
 *
 * @module core/zones/ZoneMapper
 * @version WAVE 2543.4
 */

import {
  type CanonicalZone,
  CANONICAL_ZONES,
  normalizeZone,
} from '../stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal fixture shape — ZoneMapper only needs these fields */
export interface ZoneMappableFixture {
  id: string
  zone: string
  enabled?: boolean
  position?: { x: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE ZONE DICTIONARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Groups that expand to multiple canonical zones.
 * These are "type" selectors (WHAT fixtures), not spatial modifiers.
 */
const COMPOSITE_ZONES: Readonly<Record<string, readonly CanonicalZone[]>> = {
  'all-pars':   ['front', 'back', 'floor'],
  'pars':       ['front', 'back', 'floor'],
  'all-movers': ['movers-left', 'movers-right'],
  'movers':     ['movers-left', 'movers-right'],
}

/**
 * Modifier zones that filter by physical position (position.x).
 * These are spatial modifiers (WHERE on stage), applied as AND-intersection.
 *
 * Convention:
 *   position.x < 0  → LEFT  (stage left, audience perspective right)
 *   position.x >= 0  → RIGHT (stage right, audience perspective left)
 */
const MODIFIER_ZONES: ReadonlySet<string> = new Set(['all-left', 'all-right'])

/**
 * Typo normalization table for zone strings from saved shows.
 * Handles common omission-of-hyphen mistakes from old serializations.
 * Applied before any zone classification logic.
 */
const ZONE_TYPO_MAP: Readonly<Record<string, string>> = {
  'allright':  'all-right',
  'allleft':   'all-left',
  'allpars':   'all-pars',
  'allmovers': 'all-movers',
  'all_right': 'all-right',
  'all_left':  'all-left',
  'all_pars':  'all-pars',
  'all_movers':'all-movers',
  // Short aliases from SmartZoneSelector (MOD row emits 'left'/'right', not 'all-left'/'all-right')
  'right':     'all-right',
  'left':      'all-left',
  'movers':    'all-movers',
  'pars':      'all-pars',
}

/** Sanitize a single raw zone tag, correcting known typos. */
function sanitizeZoneTag(raw: string): string {
  const t = raw.toLowerCase().trim()
  return ZONE_TYPO_MAP[t] ?? t
}

/**
 * Stereo sub-zones: combine a canonical zone with a lateral position.
 * e.g. 'frontL' → fixtures in 'front' zone with position.x < 0
 */
const STEREO_ZONES: Readonly<Record<string, { canonical: CanonicalZone; side: 'left' | 'right' }>> = {
  'frontl':  { canonical: 'front', side: 'left' },
  'frontr':  { canonical: 'front', side: 'right' },
  'backl':   { canonical: 'back',  side: 'left' },
  'backr':   { canonical: 'back',  side: 'right' },
  'floorl':  { canonical: 'floor', side: 'left' },
  'floorr':  { canonical: 'floor', side: 'right' },
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Translate an array of UI-emitted zone tags into a single canonical zone string.
 *
 * The SmartZoneSelector emits arrays like ['back', 'all-right'].
 * This function decomposes that into:
 *   - TARGET zones: 'back' (what fixtures)
 *   - MODIFIER zones: 'all-right' (which side)
 * And produces the canonical compound string: 'back-right'
 *
 * Rules:
 *   - Single canonical zone → pass through ('front' → 'front')
 *   - Single composite → pass through ('all-pars' → 'all-pars')
 *   - Target + modifier → compound ('back' + 'all-right' → 'back-right')
 *   - Multiple targets + modifier → hyphenated ('front-back-right')
 *   - 'all' anywhere → 'all'
 *   - Empty → 'all'
 *
 * @param tags — Array of EffectZone strings from SmartZoneSelector / clip.zones
 * @returns Canonical compound zone string for track assignment and display
 */
export function normalizeTagsToCanonical(tags: string[]): string {
  if (tags.length === 0) return 'all'

  // 'all' is exclusive — if present, nothing else matters
  if (tags.some(t => t.toLowerCase() === 'all' || t === '*')) return 'all'

  const targets: string[] = []
  let modifier: 'left' | 'right' | null = null

  for (const tag of tags) {
    const t = sanitizeZoneTag(tag)

    if (t === 'all-left' || t === 'left') {
      modifier = 'left'
    } else if (t === 'all-right' || t === 'right') {
      modifier = 'right'
    } else {
      targets.push(t)
    }
  }

  // No targets but modifier only → e.g. ['all-left'] → 'all-left'
  if (targets.length === 0 && modifier) {
    return `all-${modifier}`
  }

  // No modifier → join targets or return single
  if (!modifier) {
    if (targets.length === 1) return targets[0]
    // Sort for determinism (canonical order)
    targets.sort((a, b) => {
      const ai = CANONICAL_ZONES.indexOf(a as CanonicalZone)
      const bi = CANONICAL_ZONES.indexOf(b as CanonicalZone)
      // Non-canonical zones sort after canonical ones
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return targets.join('-')
  }

  // Targets + modifier → compound (e.g. 'back-right', 'front-back-left')
  if (targets.length === 1) {
    return `${targets[0]}-${modifier}`
  }

  // Multiple targets + modifier
  targets.sort((a, b) => {
    const ai = CANONICAL_ZONES.indexOf(a as CanonicalZone)
    const bi = CANONICAL_ZONES.indexOf(b as CanonicalZone)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return `${targets.join('-')}-${modifier}`
}

/**
 * Resolve a single EffectZone tag to fixture IDs.
 * Handles canonical zones, composites, stereo sub-zones, and wildcards.
 *
 * Does NOT handle modifiers (all-left/all-right) — those require the
 * multi-tag version resolveZoneTags() which applies AND-intersection.
 */
export function resolveZone(zone: string, fixtures: readonly ZoneMappableFixture[]): string[] {
  const z = zone.toLowerCase().trim()

  // Wildcard
  if (z === 'all' || z === '*') {
    return fixtures.filter(f => f.enabled !== false).map(f => f.id)
  }

  // Stereo sub-zones (frontL, backR, etc.)
  const stereo = STEREO_ZONES[z]
  if (stereo) {
    return fixtures.filter(f =>
      f.enabled !== false &&
      normalizeZone(f.zone) === stereo.canonical &&
      (stereo.side === 'left' ? (f.position?.x ?? 0) < 0 : (f.position?.x ?? 0) >= 0)
    ).map(f => f.id)
  }

  // Modifier zones standalone (all-left / all-right)
  if (MODIFIER_ZONES.has(z)) {
    const isLeft = z === 'all-left'
    return fixtures.filter(f =>
      f.enabled !== false &&
      (isLeft ? (f.position?.x ?? 0) < 0 : (f.position?.x ?? 0) >= 0)
    ).map(f => f.id)
  }

  // Composite zones
  const compositeTargets = COMPOSITE_ZONES[z]
  if (compositeTargets) {
    return fixtures.filter(f =>
      f.enabled !== false &&
      compositeTargets.includes(normalizeZone(f.zone))
    ).map(f => f.id)
  }

  // Direct canonical match
  return fixtures.filter(f =>
    f.enabled !== false &&
    normalizeZone(f.zone) === z
  ).map(f => f.id)
}

/**
 * Resolve an array of zone tags to fixture IDs using the two-tier
 * Target + Modifier AND-intersection system.
 *
 * This is the primary entry point for multi-zone resolution.
 * Replaces all the scattered implementations in Arbiter, Titan, Preview, etc.
 *
 * Architecture:
 *   1. Classify tags into TARGET zones and MODIFIER zones
 *   2. Resolve target pool: UNION of all target zones' fixtures
 *   3. Apply modifiers: AND-intersection (filter pool by position.x)
 *   4. Deduplicate by fixture ID
 *
 * @param tags — Array of EffectZone strings (from clip.zones, SmartZoneSelector, etc.)
 * @param fixtures — Full fixture inventory from the show file
 * @returns Deduplicated array of fixture IDs
 */
export function resolveZoneTags(tags: string[], fixtures: readonly ZoneMappableFixture[]): string[] {
  if (tags.length === 0) return fixtures.filter(f => f.enabled !== false).map(f => f.id)

  // Wildcard shortcut
  if (tags.some(t => t.toLowerCase() === 'all' || t === '*')) {
    return fixtures.filter(f => f.enabled !== false).map(f => f.id)
  }

  // ── Step 1: Classify into targets and modifiers (with typo sanitization) ──
  const targetTags: string[] = []
  const modifiers: string[] = []

  for (const tag of tags) {
    const t = sanitizeZoneTag(tag)
    if (MODIFIER_ZONES.has(t)) {
      modifiers.push(t)
    } else {
      targetTags.push(t)
    }
  }

  // ── Step 2: Build target pool (UNION of all target zones) ──
  const enabledFixtures = fixtures.filter(f => f.enabled !== false)
  let pool: ZoneMappableFixture[]

  if (targetTags.length === 0) {
    // Only modifiers, no targets → pool = all enabled fixtures
    pool = [...enabledFixtures]
  } else {
    // Resolve each target tag and union the results
    const poolIds = new Set<string>()
    pool = []

    for (const tag of targetTags) {
      const t = tag.toLowerCase().trim()

      // Composite expansion
      const canonicalTargets = COMPOSITE_ZONES[t]
      if (canonicalTargets) {
        for (const f of enabledFixtures) {
          if (!poolIds.has(f.id) && canonicalTargets.includes(normalizeZone(f.zone))) {
            poolIds.add(f.id)
            pool.push(f)
          }
        }
        continue
      }

      // Direct canonical match
      for (const f of enabledFixtures) {
        if (!poolIds.has(f.id) && normalizeZone(f.zone) === t) {
          poolIds.add(f.id)
          pool.push(f)
        }
      }
    }
  }

  // ── Step 3: Apply modifier filters (AND-intersection) ──
  for (const mod of modifiers) {
    if (mod === 'all-left') {
      pool = pool.filter(f => (f.position?.x ?? 0) < 0)
    } else if (mod === 'all-right') {
      pool = pool.filter(f => (f.position?.x ?? 0) >= 0)
    }
  }

  return pool.map(f => f.id)
}

/**
 * Check if a single fixture matches a zone target.
 * Replacement for TitanOrchestrator.fixtureMatchesZone() and
 * fixtureMatchesZoneStereo().
 *
 * @param fixtureZone — The fixture's canonical zone (from fixture.zone)
 * @param targetZone — The zone target to check (from effect)
 * @param positionX — Optional fixture position.x for stereo resolution
 */
export function fixtureMatchesZone(
  fixtureZone: string,
  targetZone: string,
  positionX?: number,
): boolean {
  const fz = normalizeZone(fixtureZone)
  const tz = targetZone.toLowerCase().trim()

  // Wildcards
  if (tz === 'all' || tz === '*') return true

  // Stereo sub-zones (frontL, backR, etc.)
  const stereo = STEREO_ZONES[tz]
  if (stereo) {
    if (fz !== stereo.canonical) return false
    if (positionX === undefined) return true // no position data → assume match
    return stereo.side === 'left' ? positionX < 0 : positionX >= 0
  }

  // Modifier zones (all-left, all-right) — position-only
  if (MODIFIER_ZONES.has(tz)) {
    if (positionX === undefined) return true
    return tz === 'all-left' ? positionX < 0 : positionX >= 0
  }

  // Composite zones
  const compositeTargets = COMPOSITE_ZONES[tz]
  if (compositeTargets) {
    return compositeTargets.includes(fz)
  }

  // Direct canonical match
  return fz === tz
}

/**
 * Get all active (non-unassigned) canonical zones from a fixture inventory.
 * Used by TimelineCanvas to generate zone tracks.
 */
export function getActiveZones(fixtures: readonly ZoneMappableFixture[]): CanonicalZone[] {
  const zones = new Set<CanonicalZone>()
  for (const f of fixtures) {
    if (f.enabled === false) continue
    const canonical = normalizeZone(f.zone)
    if (canonical !== 'unassigned') {
      zones.add(canonical)
    }
  }
  // Maintain canonical order
  return CANONICAL_ZONES.filter(z => zones.has(z))
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════════════

export { normalizeZone, CANONICAL_ZONES, type CanonicalZone }
