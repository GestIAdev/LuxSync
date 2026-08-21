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
 *   - ChronosProject.luxToChronosV2()     (track assignment)
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
import type { EnergyZone } from '../protocol/MusicalContext'
import type { CognitiveDNA } from '../arsenal/lfxTypes'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal fixture shape — ZoneMapper only needs these fields */
export interface ZoneMappableFixture {
  id: string
  zone: string
  enabled?: boolean
  position?: { x: number }
  /** 🌊 WAVE 4951: Fixture type for capability-based dynamic zone resolution */
  type?: string
  /** 🌊 WAVE 4951: Fixture capabilities for dynamic composite zones (e.g., all-movers) */
  capabilities?: {
    hasMovementChannels?: boolean
  }
  /**
   * 🧩 COMPOUND FIXTURE SUPPORT: Zone IDs declared by individual internal channels
   * (derived from ICapabilityNode.zoneId in the NodeGraph). Populated by
   * TitanOrchestrator.getFixturesForZoneMapping() for fixtures whose parent
   * zone is 'unassigned' but whose internal channels target specific zones.
   * When present, zone matching falls back to these channel zones if the
   * parent fixture.zone does not match the target.
   */
  channelZones?: readonly string[]
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
 * 🌊 WAVE 4951: DYNAMIC COMPOSITE RESOLUTION — Capability-based zone matching.
 *
 * When a fixture is NOT tagged with the legacy fixture-type zones (e.g.,
 * 'movers-left'), but IS a mover by capability (hasMovementChannels=true
 * or type='moving-head'/'scanner'), it MUST still respond to 'all-movers'.
 *
 * This bridges the gap between spatial zoning (front-left, back-right)
 * and fixture-type zoning (movers, pars) that previously caused L3
 * effects like CorazonLatino to silently fail on spatially-zoned movers.
 */
const DYNAMIC_COMPOSITE_RESOLVERS: Readonly<
  Record<string, (f: ZoneMappableFixture) => boolean>
> = {
  'all-movers': f =>
    f.type === 'moving-head' ||
    f.type === 'scanner' ||
    f.type === 'spot' ||
    f.capabilities?.hasMovementChannels === true,
  'movers': f =>
    f.type === 'moving-head' ||
    f.type === 'scanner' ||
    f.type === 'spot' ||
    f.capabilities?.hasMovementChannels === true,
  'all-pars': f =>
    f.type === 'par' ||
    f.type === 'wash' ||
    f.type === 'bar',
  'pars': f =>
    f.type === 'par' ||
    f.type === 'wash' ||
    f.type === 'bar',
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

  // Composite zones (string match + WAVE 4951 dynamic fallback + compound fixture channel zones)
  const compositeTargets = COMPOSITE_ZONES[z]
  if (compositeTargets) {
    return fixtures.filter(f => {
      if (f.enabled === false) return false
      if (compositeTargets.includes(normalizeZone(f.zone))) return true
      if (DYNAMIC_COMPOSITE_RESOLVERS[z]?.(f) === true) return true
      // 🧩 COMPOUND FIXTURE: check internal channel zones
      if (f.channelZones && f.channelZones.length > 0) {
        for (let i = 0; i < f.channelZones.length; i++) {
          if (compositeTargets.includes(normalizeZone(f.channelZones[i]) as any)) return true
        }
      }
      return false
    }).map(f => f.id)
  }

  // Direct canonical match + compound fixture channel-zone fallback
  return fixtures.filter(f => {
    if (f.enabled === false) return false
    if (normalizeZone(f.zone) === z) return true
    // 🧩 COMPOUND FIXTURE: parent zone doesn't match — check internal channel zones
    if (f.channelZones && f.channelZones.length > 0) {
      for (let i = 0; i < f.channelZones.length; i++) {
        if (normalizeZone(f.channelZones[i]) === z) return true
      }
    }
    return false
  }).map(f => f.id)
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
    } else if (COMPOSITE_ZONES[t] || CANONICAL_ZONES.includes(t as CanonicalZone)) {
      targetTags.push(t)
    } else {
      // Non-spatial tag (e.g. energy zones like 'intense', 'peak') — skip, don't filter
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

      // Composite expansion (string match + WAVE 4951 dynamic fallback)
      const canonicalTargets = COMPOSITE_ZONES[t]
      if (canonicalTargets) {
        for (const f of enabledFixtures) {
          if (!poolIds.has(f.id) && canonicalTargets.includes(normalizeZone(f.zone))) {
            poolIds.add(f.id)
            pool.push(f)
          }
        }
        // 🌊 WAVE 4951: Dynamic capability-based fallback.
        // If a fixture wasn't matched by its zone tag but IS a mover/par by
        // type/capability, include it anyway for all-movers/all-pars.
        const dynamicPred = DYNAMIC_COMPOSITE_RESOLVERS[t]
        if (dynamicPred) {
          for (const f of enabledFixtures) {
            if (!poolIds.has(f.id) && dynamicPred(f)) {
              poolIds.add(f.id)
              pool.push(f)
            }
          }
        }
        continue
      }

      // Direct canonical match (parent zone) + compound fixture channel-zone fallback
      for (const f of enabledFixtures) {
        if (poolIds.has(f.id)) continue
        if (normalizeZone(f.zone) === t) {
          poolIds.add(f.id)
          pool.push(f)
          continue
        }
        // 🧩 COMPOUND FIXTURE: check internal channel zones
        if (f.channelZones && f.channelZones.length > 0) {
          for (let ci = 0; ci < f.channelZones.length; ci++) {
            if (normalizeZone(f.channelZones[ci]) === t) {
              poolIds.add(f.id)
              pool.push(f)
              break
            }
          }
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
  fixture?: ZoneMappableFixture,
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

  // Composite zones (string match + WAVE 4951 dynamic fallback)
  const compositeTargets = COMPOSITE_ZONES[tz]
  if (compositeTargets) {
    if (compositeTargets.includes(fz)) return true
    // 🌊 WAVE 4951: If string match fails, try capability-based match
    if (fixture && DYNAMIC_COMPOSITE_RESOLVERS[tz]?.(fixture) === true) return true
    return false
  }

  // Direct canonical match
  if (fz === tz) return true

  // 🧩 COMPOUND FIXTURE: parent zone doesn't match — check internal channel zones.
  // A compound fixture (e.g. Tungsten with zone='unassigned') can still respond
  // to a target zone if at least one of its internal channels is assigned to it.
  if (fixture?.channelZones && fixture.channelZones.length > 0) {
    for (let i = 0; i < fixture.channelZones.length; i++) {
      if (normalizeZone(fixture.channelZones[i]) === tz) return true
    }
  }

  return false
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
// WAVE 2545: ZONE COMPATIBILITY — For Magnetic Drop Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an array of zone tags to the canonical zones they target,
 * WITHOUT requiring a fixture list. Used by the UI drag validation layer
 * where we only need to know "does this clip MENTION this canonical zone?"
 *
 * Returns the set of CanonicalZone values that the tags cover.
 * - Canonical zones map 1:1 ('front' → ['front'])
 * - Composite zones expand ('all-pars' → ['front','back','floor'])
 * - Modifier zones (all-left/all-right) are position filters — they
 *   don't restrict to specific canonical zones, so we return ALL_CANONICAL
 *   to indicate they're compatible with any zone track.
 * - Wildcards ('all', '*') return ALL_CANONICAL.
 * - Empty array → ALL_CANONICAL (no zone restriction = global).
 */
export function getTargetCanonicalZones(tags: string[]): CanonicalZone[] {
  if (tags.length === 0) return [...CANONICAL_ZONES]

  const result = new Set<CanonicalZone>()
  let hasOnlyModifiers = true

  for (const raw of tags) {
    const t = (ZONE_TYPO_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim())

    // Wildcard
    if (t === 'all' || t === '*') return [...CANONICAL_ZONES]

    // Modifier (all-left / all-right) — doesn't restrict canonical zone
    if (MODIFIER_ZONES.has(t)) continue

    // Composite
    const compositeTargets = COMPOSITE_ZONES[t]
    if (compositeTargets) {
      hasOnlyModifiers = false
      for (const cz of compositeTargets) result.add(cz)
      continue
    }

    // Stereo sub-zone (e.g. 'frontL', 'backR')
    const stereo = STEREO_ZONES[t]
    if (stereo) {
      hasOnlyModifiers = false
      result.add(stereo.canonical)
      continue
    }

    // Direct canonical
    if (CANONICAL_ZONES.includes(t as CanonicalZone)) {
      hasOnlyModifiers = false
      result.add(t as CanonicalZone)
    }
  }

  // If only modifiers were present (e.g. ['all-right']), they apply to ALL zones
  if (hasOnlyModifiers) return [...CANONICAL_ZONES]

  return CANONICAL_ZONES.filter(z => result.has(z))
}

/**
 * Check if a clip with the given zone tags is compatible with a track
 * that targets a specific canonical zone. Pure function, no side effects.
 *
 * - Clip without zones (undefined/empty) → compatible with ANY track
 * - Track without targetZone → compatible with ANY clip (global fallback track)
 * - Otherwise: clip's canonical zone set must include the track's targetZone
 */
export function isClipZoneCompatible(
  clipZones: string[] | undefined,
  trackTargetZone: string | undefined
): boolean {
  // Global track (no specific zone) accepts everything
  if (!trackTargetZone) return true
  // Clip without zone restriction → compatible with any track
  if (!clipZones || clipZones.length === 0) return true
  // WAVE 7107-B: Direct string match first (handles energy zones like 'intense', 'peak')
  if (clipZones.includes(trackTargetZone)) return true
  // 'all' wildcard is compatible with ANY track (including energy zones)
  if (clipZones.some(z => z.toLowerCase() === 'all' || z === '*')) return true
  // Check if the clip's resolved canonical zones include this track's zone
  // But only if the track's zone is actually a canonical zone
  if (CANONICAL_ZONES.includes(trackTargetZone as CanonicalZone)) {
    return getTargetCanonicalZones(clipZones).includes(trackTargetZone as CanonicalZone)
  }
  // Track has a non-canonical zone (e.g. energy zone 'intense', 'peak')
  // and the clip doesn't explicitly mention it or use 'all' — not compatible
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 7565.3: THE TRUE DNA ROUTER — Primary Track Zone Resolver
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 7565.2 failed because it searched the flat `spatialZones` array for
// energy keywords. This caused false positives: 'ambient' appears in
// spatialZones as a HARDWARE zone (fixtures in the ambient zone, e.g.
// Tungsten fans targeting ambient+air+flash), but it was being parsed as
// an ENERGY zone (the musical context 'ambient' = soft/calm). A clip with
// cognitiveDNA.energyZone.max = 'peak' was routing to the AMBIENT energy
// track because 'ambient' appeared in its spatialZones.
//
// The .lfx schema separates these concerns cleanly:
//   - clip.spatialZones → WHERE (hardware zones: 'front', 'all-pars', 'ambient')
//   - clip.cognitiveDNA.energyZone → WHEN (energy context: 'peak', 'intense')
//
// The resolver now reads cognitiveDNA.energyZone.max FIRST — this is the
// absolute source of truth for which Energetic Track the clip belongs to.
// Only if cognitiveDNA is absent (legacy clips without DNA) does it fall
// back to parsing spatialZones through normalizeTagsToCanonical.
//
// Resolution priority:
//   1. cognitiveDNA.energyZone.max → return it (THE source of truth)
//   2. cognitiveDNA.energyZone.min → return it (fallback within DNA)
//   3. 'all' wildcard or empty spatialZones → 'global'
//   4. normalizeTagsToCanonical(spatialZones) → if single CanonicalZone, use it
//   5. Otherwise → 'global' (safe fallback, no phantom tracks)
// ═══════════════════════════════════════════════════════════════════════════

/** The set of valid EnergyZone strings, for fast lookup. */
const ENERGY_ZONE_SET: ReadonlySet<string> = new Set<string>([
  'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
])

/**
 * Input shape for the resolver — accepts the clip's cognitive DNA and
 * spatial zones separately to avoid the false-positive trap of WAVE 7565.2.
 */
export interface ClipZoneInput {
  /** The clip's cognitive DNA — the absolute source of truth for energy zone. */
  cognitiveDNA?: CognitiveDNA | null
  /** The clip's spatial zones (hardware targets: 'front', 'all-pars', 'ambient'). */
  spatialZones?: string[] | null
}

/**
 * Resolve a clip's DNA into a single valid `LuxTargetZone` for track
 * assignment. Reads `cognitiveDNA.energyZone` FIRST — this is the true
 * source of truth for which Energetic Track the clip belongs to.
 *
 * Only if `cognitiveDNA` is absent (legacy clips) does it fall back to
 * parsing `spatialZones` through `normalizeTagsToCanonical`.
 *
 * @param input — The clip's `cognitiveDNA` and `spatialZones`
 * @returns A valid `LuxTargetZone` string — never a composite like `'all-pars'`.
 */
export function resolvePrimaryTrackZone(
  input: ClipZoneInput | string[] | undefined | null,
): CanonicalZone | EnergyZone | 'global' {
  // ── Backwards compat: accept a raw string array (old callers) ──
  // If a string array is passed, treat it as spatialZones with no DNA.
  const cognitiveDNA: CognitiveDNA | null | undefined =
    Array.isArray(input) ? null : input?.cognitiveDNA
  const spatialZones: string[] | null =
    Array.isArray(input) ? input : input?.spatialZones ?? null

  // ── Priority 1: cognitiveDNA.energyZone.max — THE source of truth ──
  // This is the 'peak' in "this clip fires at peak energy". It comes from
  // the .lfx file's cognitiveDNA block, authored by Hephaestus/Genesis.
  // It is NEVER a spatial zone — the .lfx schema enforces separation
  // (LfxFileLoader rejects EnergyZoneId in spatialZones).
  const dnaMax = cognitiveDNA?.energyZone?.max
  if (dnaMax && ENERGY_ZONE_SET.has(dnaMax)) {
    return dnaMax as EnergyZone
  }

  // ── Priority 2: cognitiveDNA.energyZone.min — fallback within DNA ──
  // If max is missing/invalid but min is present, use min. This handles
  // edge cases where a clip's energy range is [ambient, ambient] (min only).
  const dnaMin = cognitiveDNA?.energyZone?.min
  if (dnaMin && ENERGY_ZONE_SET.has(dnaMin)) {
    return dnaMin as EnergyZone
  }

  // ── Priority 3: 'all' wildcard or empty spatialZones → 'global' ──
  if (!spatialZones || spatialZones.length === 0) return 'global'
  if (spatialZones.some(z => z.toLowerCase() === 'all' || z === '*')) return 'global'

  // ── Priority 4: Normalize spatialZones to a single canonical zone ──
  // This is the LEGACY fallback for clips without cognitiveDNA.
  // normalizeTagsToCanonical collapses composites like 'all-pars' → 'all-pars'
  // (NOT a single CanonicalZone). We check if the result is a valid single
  // canonical zone.
  //
  // IMPORTANT: We do NOT search spatialZones for energy keywords here.
  // 'ambient' in spatialZones means "fixtures in the ambient hardware zone"
  // (e.g. Tungsten fans), NOT "this clip belongs on the AMBIENT energy track".
  // Conflating them was the WAVE 7565.2 bug.
  const normalized = normalizeTagsToCanonical(spatialZones)

  if (CANONICAL_ZONES.includes(normalized as CanonicalZone)) {
    return normalized as CanonicalZone
  }

  // ── Priority 5: Composite/compound/modifier → 'global' ──
  // 'all-pars', 'front-back', 'all-left' etc. are not valid single track
  // zones. Fall back to 'global' so the clip lands on the GLOBAL track
  // instead of creating a phantom.
  return 'global'
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════════════

export { normalizeZone, CANONICAL_ZONES, type CanonicalZone }
