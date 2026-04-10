/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ WAVE 2543.4: ZONEMAPPER CERTIFICATION TEST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests for the centralized ZoneMapper module.
 * Every function is deterministic — no Math.random(), no mocks.
 * Same input → Same output, always.
 *
 * @module core/zones/__tests__/ZoneMapper.test
 * @version WAVE 2543.4
 */

import { describe, test, expect } from 'vitest'
import {
  normalizeTagsToCanonical,
  resolveZoneTags,
  resolveZone,
  fixtureMatchesZone,
  getActiveZones,
  getTargetCanonicalZones,
  isClipZoneCompatible,
  type ZoneMappableFixture,
} from '../ZoneMapper'

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES — Deterministic 12-fixture rig
// ═══════════════════════════════════════════════════════════════════════════

const FIXTURES: ZoneMappableFixture[] = [
  // Front PARs (3 left, 3 right)
  { id: 'f1', zone: 'front', position: { x: -3 } },
  { id: 'f2', zone: 'front', position: { x: -1 } },
  { id: 'f3', zone: 'front', position: { x: 0 } },
  { id: 'f4', zone: 'front', position: { x: 1 } },
  { id: 'f5', zone: 'front', position: { x: 3 } },
  // Back PARs
  { id: 'b1', zone: 'back', position: { x: -2 } },
  { id: 'b2', zone: 'back', position: { x: 2 } },
  // Floor PARs
  { id: 'fl1', zone: 'floor', position: { x: -1 } },
  { id: 'fl2', zone: 'floor', position: { x: 1 } },
  // Movers
  { id: 'm1', zone: 'movers-left', position: { x: -4 } },
  { id: 'm2', zone: 'movers-right', position: { x: 4 } },
  // Disabled fixture (should be excluded)
  { id: 'x1', zone: 'front', position: { x: 0 }, enabled: false },
]

// ═══════════════════════════════════════════════════════════════════════════
// normalizeTagsToCanonical
// ═══════════════════════════════════════════════════════════════════════════

describe('normalizeTagsToCanonical', () => {
  test('empty array → "all"', () => {
    expect(normalizeTagsToCanonical([])).toBe('all')
  })

  test('single canonical zone passes through', () => {
    expect(normalizeTagsToCanonical(['front'])).toBe('front')
    expect(normalizeTagsToCanonical(['back'])).toBe('back')
    expect(normalizeTagsToCanonical(['movers-left'])).toBe('movers-left')
  })

  test('single composite passes through', () => {
    expect(normalizeTagsToCanonical(['all-pars'])).toBe('all-pars')
    expect(normalizeTagsToCanonical(['all-movers'])).toBe('all-movers')
  })

  test('"all" or "*" is exclusive — returns "all" regardless of other tags', () => {
    expect(normalizeTagsToCanonical(['all'])).toBe('all')
    expect(normalizeTagsToCanonical(['*'])).toBe('all')
    expect(normalizeTagsToCanonical(['front', 'all'])).toBe('all')
    expect(normalizeTagsToCanonical(['back', 'all-right', 'all'])).toBe('all')
  })

  test('target + modifier → compound string', () => {
    expect(normalizeTagsToCanonical(['back', 'all-right'])).toBe('back-right')
    expect(normalizeTagsToCanonical(['front', 'all-left'])).toBe('front-left')
    expect(normalizeTagsToCanonical(['floor', 'all-right'])).toBe('floor-right')
  })

  test('multiple targets + modifier → sorted compound', () => {
    const result = normalizeTagsToCanonical(['back', 'front', 'all-left'])
    expect(result).toBe('front-back-left')
  })

  test('modifier-only → all-modifier', () => {
    expect(normalizeTagsToCanonical(['all-left'])).toBe('all-left')
    expect(normalizeTagsToCanonical(['all-right'])).toBe('all-right')
  })

  test('multiple targets without modifier', () => {
    const result = normalizeTagsToCanonical(['back', 'front'])
    expect(result).toBe('front-back') // sorted by canonical order
  })

  test('case insensitive', () => {
    expect(normalizeTagsToCanonical(['BACK', 'ALL-RIGHT'])).toBe('back-right')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// resolveZone (single zone → fixture IDs)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveZone', () => {
  test('"all" returns all enabled fixtures', () => {
    const ids = resolveZone('all', FIXTURES)
    expect(ids).toHaveLength(11) // 12 - 1 disabled
    expect(ids).not.toContain('x1')
  })

  test('"*" wildcard works same as "all"', () => {
    const ids = resolveZone('*', FIXTURES)
    expect(ids).toHaveLength(11)
  })

  test('canonical zone returns exact matches', () => {
    const ids = resolveZone('front', FIXTURES)
    expect(ids).toEqual(['f1', 'f2', 'f3', 'f4', 'f5'])
  })

  test('composite "all-pars" returns front + back + floor', () => {
    const ids = resolveZone('all-pars', FIXTURES)
    expect(ids).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'b1', 'b2', 'fl1', 'fl2'])
  })

  test('composite "all-movers" returns movers-left + movers-right', () => {
    const ids = resolveZone('all-movers', FIXTURES)
    expect(ids).toEqual(['m1', 'm2'])
  })

  test('"all-left" returns fixtures with position.x < 0', () => {
    const ids = resolveZone('all-left', FIXTURES)
    expect(ids).toEqual(['f1', 'f2', 'b1', 'fl1', 'm1'])
  })

  test('"all-right" returns fixtures with position.x >= 0', () => {
    const ids = resolveZone('all-right', FIXTURES)
    expect(ids).toEqual(['f3', 'f4', 'f5', 'b2', 'fl2', 'm2'])
  })

  test('stereo sub-zone "frontl" returns front + left', () => {
    const ids = resolveZone('frontL', FIXTURES)
    expect(ids).toEqual(['f1', 'f2'])
  })

  test('stereo sub-zone "backr" returns back + right', () => {
    const ids = resolveZone('backR', FIXTURES)
    expect(ids).toEqual(['b2'])
  })

  test('disabled fixtures are excluded', () => {
    const ids = resolveZone('front', FIXTURES)
    expect(ids).not.toContain('x1')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// resolveZoneTags (multi-zone with Target+Modifier AND-intersection)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveZoneTags', () => {
  test('empty tags → all enabled fixtures', () => {
    const ids = resolveZoneTags([], FIXTURES)
    expect(ids).toHaveLength(11)
  })

  test('single target zone', () => {
    const ids = resolveZoneTags(['back'], FIXTURES)
    expect(ids).toEqual(['b1', 'b2'])
  })

  test('THE GHOST BUG FIX: ["back", "all-right"] → only back fixtures on right side', () => {
    const ids = resolveZoneTags(['back', 'all-right'], FIXTURES)
    // back fixtures: b1(x=-2), b2(x=2)
    // all-right filter: x >= 0
    // Result: only b2
    expect(ids).toEqual(['b2'])
  })

  test('["front", "all-left"] → only front fixtures on left side', () => {
    const ids = resolveZoneTags(['front', 'all-left'], FIXTURES)
    // front fixtures: f1(x=-3), f2(x=-1), f3(x=0), f4(x=1), f5(x=3)
    // all-left filter: x < 0
    // Result: f1, f2
    expect(ids).toEqual(['f1', 'f2'])
  })

  test('composite + modifier: ["all-pars", "all-right"]', () => {
    const ids = resolveZoneTags(['all-pars', 'all-right'], FIXTURES)
    // all-pars: front(5) + back(2) + floor(2) = 9 fixtures
    // all-right filter: x >= 0
    // Result: f3(0), f4(1), f5(3), b2(2), fl2(1)
    expect(ids).toEqual(['f3', 'f4', 'f5', 'b2', 'fl2'])
  })

  test('modifier-only: ["all-left"] → all enabled left fixtures', () => {
    const ids = resolveZoneTags(['all-left'], FIXTURES)
    expect(ids).toEqual(['f1', 'f2', 'b1', 'fl1', 'm1'])
  })

  test('multiple targets no modifier: ["front", "back"] → union', () => {
    const ids = resolveZoneTags(['front', 'back'], FIXTURES)
    expect(ids).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'b1', 'b2'])
  })

  test('"all" with other tags → all fixtures', () => {
    const ids = resolveZoneTags(['front', 'all'], FIXTURES)
    expect(ids).toHaveLength(11)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// fixtureMatchesZone
// ═══════════════════════════════════════════════════════════════════════════

describe('fixtureMatchesZone', () => {
  test('"all" matches everything', () => {
    expect(fixtureMatchesZone('front', 'all')).toBe(true)
    expect(fixtureMatchesZone('movers-left', 'all')).toBe(true)
  })

  test('direct canonical match', () => {
    expect(fixtureMatchesZone('front', 'front')).toBe(true)
    expect(fixtureMatchesZone('front', 'back')).toBe(false)
  })

  test('composite match', () => {
    expect(fixtureMatchesZone('front', 'all-pars')).toBe(true)
    expect(fixtureMatchesZone('back', 'all-pars')).toBe(true)
    expect(fixtureMatchesZone('floor', 'all-pars')).toBe(true)
    expect(fixtureMatchesZone('movers-left', 'all-pars')).toBe(false)
  })

  test('movers composite', () => {
    expect(fixtureMatchesZone('movers-left', 'all-movers')).toBe(true)
    expect(fixtureMatchesZone('movers-right', 'all-movers')).toBe(true)
    expect(fixtureMatchesZone('front', 'all-movers')).toBe(false)
  })

  test('stereo sub-zone with position', () => {
    expect(fixtureMatchesZone('front', 'frontL', -3)).toBe(true)
    expect(fixtureMatchesZone('front', 'frontL', 3)).toBe(false)
    expect(fixtureMatchesZone('front', 'frontR', 3)).toBe(true)
    expect(fixtureMatchesZone('back', 'frontL', -3)).toBe(false)
  })

  test('modifier zone with position', () => {
    expect(fixtureMatchesZone('front', 'all-left', -2)).toBe(true)
    expect(fixtureMatchesZone('front', 'all-left', 2)).toBe(false)
    expect(fixtureMatchesZone('front', 'all-right', 2)).toBe(true)
    expect(fixtureMatchesZone('front', 'all-right', -2)).toBe(false)
  })

  test('legacy normalizeZone integration', () => {
    // FRONT_PARS is legacy → normalizes to 'front' internally
    expect(fixtureMatchesZone('FRONT_PARS', 'front')).toBe(true)
    expect(fixtureMatchesZone('BACK_PARS', 'all-pars')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getActiveZones
// ═══════════════════════════════════════════════════════════════════════════

describe('getActiveZones', () => {
  test('returns unique canonical zones in canonical order', () => {
    const zones = getActiveZones(FIXTURES)
    expect(zones).toEqual(['front', 'back', 'floor', 'movers-left', 'movers-right'])
  })

  test('excludes "unassigned" zones', () => {
    const withUnassigned = [
      ...FIXTURES,
      { id: 'u1', zone: 'unassigned', position: { x: 0 } },
    ]
    const zones = getActiveZones(withUnassigned)
    expect(zones).not.toContain('unassigned')
  })

  test('excludes disabled fixtures', () => {
    const onlyDisabled: ZoneMappableFixture[] = [
      { id: 'd1', zone: 'air', enabled: false },
    ]
    const zones = getActiveZones(onlyDisabled)
    expect(zones).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2543.5: STRESS TEST — 200 fixtures × 60fps budget
// ═══════════════════════════════════════════════════════════════════════════

describe('STRESS TEST: 200 fixtures performance', () => {
  // Deterministic 200-fixture rig across 9 zones
  const ZONE_DEFS: Array<{ zone: string; count: number; xRange: [number, number] }> = [
    { zone: 'front',        count: 40,  xRange: [-5, 5]  },
    { zone: 'back',         count: 30,  xRange: [-4, 4]  },
    { zone: 'floor',        count: 30,  xRange: [-3, 3]  },
    { zone: 'movers-left',  count: 20,  xRange: [-6, -1] },
    { zone: 'movers-right', count: 20,  xRange: [1, 6]   },
    { zone: 'center',       count: 15,  xRange: [-1, 1]  },
    { zone: 'air',          count: 20,  xRange: [-4, 4]  },
    { zone: 'ambient',      count: 20,  xRange: [-5, 5]  },
    { zone: 'unassigned',   count: 5,   xRange: [0, 0]   },
  ]

  const STRESS_FIXTURES: ZoneMappableFixture[] = []
  let fixtureIdx = 0
  for (const def of ZONE_DEFS) {
    for (let i = 0; i < def.count; i++) {
      const t = def.count > 1 ? i / (def.count - 1) : 0.5
      const x = def.xRange[0] + t * (def.xRange[1] - def.xRange[0])
      STRESS_FIXTURES.push({
        id: `s${fixtureIdx++}`,
        zone: def.zone,
        position: { x: Math.round(x * 100) / 100 },
      })
    }
  }

  // 15 zone tag combinations simulating simultaneous tracks
  const ZONE_TAG_SETS: string[][] = [
    ['all'],
    ['front'],
    ['back'],
    ['floor'],
    ['all-pars'],
    ['all-movers'],
    ['movers-left'],
    ['movers-right'],
    ['front', 'all-left'],
    ['back', 'all-right'],
    ['front', 'back'],
    ['all-pars', 'all-left'],
    ['all-pars', 'all-right'],
    ['center'],
    ['air'],
  ]

  test(`200 fixtures × 15 tracks × 60fps stays under 2ms per frame`, () => {
    // Warm-up (JIT)
    for (let i = 0; i < 100; i++) {
      for (const tags of ZONE_TAG_SETS) {
        resolveZoneTags(tags, STRESS_FIXTURES)
      }
    }

    // Measurement: simulate 600 frames (10 seconds at 60fps)
    const FRAME_COUNT = 600
    const start = performance.now()

    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      for (const tags of ZONE_TAG_SETS) {
        resolveZoneTags(tags, STRESS_FIXTURES)
      }
    }

    const elapsed = performance.now() - start
    const msPerFrame = elapsed / FRAME_COUNT

    // Budget: 2ms per frame for ALL 15 zone resolutions combined
    expect(msPerFrame).toBeLessThan(2)
  })

  test('resolveZone handles each of 200 fixtures correctly', () => {
    // Verify correctness at scale — front zone should return exactly 40 fixtures
    const frontIds = resolveZone('front', STRESS_FIXTURES)
    expect(frontIds).toHaveLength(40)

    // all-pars = front(40) + back(30) + floor(30) = 100
    const allParsIds = resolveZone('all-pars', STRESS_FIXTURES)
    expect(allParsIds).toHaveLength(100)

    // all-movers = movers-left(20) + movers-right(20) = 40
    const allMoversIds = resolveZone('all-movers', STRESS_FIXTURES)
    expect(allMoversIds).toHaveLength(40)

    // all = everything enabled (200 - 0 disabled) = 200
    const allIds = resolveZone('all', STRESS_FIXTURES)
    expect(allIds).toHaveLength(200)
  })

  test('resolveZoneTags Target+Modifier at scale', () => {
    // front(40) + all-left: front fixtures with x < 0
    // Front has xRange [-5, 5], 40 fixtures, deterministic distribution
    // x < 0 means indices 0..19 (first 20 of 40)
    const frontLeft = resolveZoneTags(['front', 'all-left'], STRESS_FIXTURES)
    expect(frontLeft.length).toBeGreaterThan(0)
    expect(frontLeft.length).toBeLessThan(40) // Should be subset

    // all-pars + all-right: pars with x >= 0
    const parsRight = resolveZoneTags(['all-pars', 'all-right'], STRESS_FIXTURES)
    expect(parsRight.length).toBeGreaterThan(0)
    expect(parsRight.length).toBeLessThan(100) // Strict subset of 100 pars
  })

  test('fixtureMatchesZone throughput: 200 fixtures × 9 zones × 600 frames', () => {
    const ZONES_TO_CHECK = ['front', 'back', 'all-pars', 'all-movers', 'frontL', 'backR', 'all-left', 'all-right', 'all']
    const FRAME_COUNT = 600

    // Warm-up
    for (let i = 0; i < 100; i++) {
      for (const f of STRESS_FIXTURES) {
        for (const z of ZONES_TO_CHECK) {
          fixtureMatchesZone(f.zone, z, f.position?.x)
        }
      }
    }

    // Measurement
    const start = performance.now()
    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      for (const f of STRESS_FIXTURES) {
        for (const z of ZONES_TO_CHECK) {
          fixtureMatchesZone(f.zone, z, f.position?.x)
        }
      }
    }
    const elapsed = performance.now() - start
    const msPerFrame = elapsed / FRAME_COUNT

    // Budget: 200 fixtures × 9 zones = 1800 checks per frame, must be < 2ms
    expect(msPerFrame).toBeLessThan(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2544.1: GHOST EXORCISM — AND-gate certification & typo sanitization
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2544.1: Ghost Exorcism — AND-intersection correctness', () => {
  // Rig: 2 back-right, 2 back-left, 2 front-right, 2 front-left
  const RIG: ZoneMappableFixture[] = [
    { id: 'br1', zone: 'back',  position: { x:  1 } },
    { id: 'br2', zone: 'back',  position: { x:  3 } },
    { id: 'bl1', zone: 'back',  position: { x: -1 } },
    { id: 'bl2', zone: 'back',  position: { x: -3 } },
    { id: 'fr1', zone: 'front', position: { x:  1 } },
    { id: 'fr2', zone: 'front', position: { x:  3 } },
    { id: 'fl1', zone: 'front', position: { x: -1 } },
    { id: 'fl2', zone: 'front', position: { x: -3 } },
  ]

  test("['back', 'all-right'] → ONLY back-right fixtures (AND, not OR)", () => {
    const result = resolveZoneTags(['back', 'all-right'], RIG)
    expect(result.sort()).toEqual(['br1', 'br2'].sort())
    // Must NOT include front-right or back-left
    expect(result).not.toContain('fr1')
    expect(result).not.toContain('fr2')
    expect(result).not.toContain('bl1')
    expect(result).not.toContain('bl2')
  })

  test("['back', 'all-left'] → ONLY back-left fixtures", () => {
    const result = resolveZoneTags(['back', 'all-left'], RIG)
    expect(result.sort()).toEqual(['bl1', 'bl2'].sort())
  })

  test("['front', 'all-right'] → ONLY front-right fixtures", () => {
    const result = resolveZoneTags(['front', 'all-right'], RIG)
    expect(result.sort()).toEqual(['fr1', 'fr2'].sort())
  })

  test("OR-semantics ABSENT: ['back', 'front'] without modifier → union (both)", () => {
    // Targets without modifier → union (correct)
    const result = resolveZoneTags(['back', 'front'], RIG)
    expect(result).toHaveLength(8)
  })

  test("modifier-only ['all-right'] → all right-side fixtures across all zones", () => {
    const result = resolveZoneTags(['all-right'], RIG)
    expect(result.sort()).toEqual(['br1', 'br2', 'fr1', 'fr2'].sort())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2545: MAGNETIC DROP — getTargetCanonicalZones & isClipZoneCompatible
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2545: getTargetCanonicalZones — UI zone resolution (no fixtures needed)', () => {
  test('empty tags → all canonical zones (universal)', () => {
    const result = getTargetCanonicalZones([])
    expect(result).toEqual(expect.arrayContaining(['front', 'back', 'floor', 'movers-left', 'movers-right']))
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test("['front'] → only ['front']", () => {
    const result = getTargetCanonicalZones(['front'])
    expect(result).toEqual(['front'])
  })

  test("['back'] → only ['back']", () => {
    const result = getTargetCanonicalZones(['back'])
    expect(result).toEqual(['back'])
  })

  test("['all-pars'] → ['front', 'back', 'floor']", () => {
    const result = getTargetCanonicalZones(['all-pars'])
    expect(result).toEqual(['front', 'back', 'floor'])
  })

  test("['all-movers'] → ['movers-left', 'movers-right']", () => {
    const result = getTargetCanonicalZones(['all-movers'])
    expect(result).toEqual(['movers-left', 'movers-right'])
  })

  test("['all-right'] (modifier only) → all canonical zones", () => {
    const result = getTargetCanonicalZones(['all-right'])
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test("['back', 'all-right'] (target + modifier) → only ['back']", () => {
    const result = getTargetCanonicalZones(['back', 'all-right'])
    expect(result).toEqual(['back'])
  })

  test("['all'] → all canonical zones", () => {
    const result = getTargetCanonicalZones(['all'])
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test("['*'] → all canonical zones", () => {
    const result = getTargetCanonicalZones(['*'])
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test("['front', 'back'] → ['front', 'back'] (canonical order)", () => {
    const result = getTargetCanonicalZones(['front', 'back'])
    expect(result).toEqual(['front', 'back'])
  })

  test("typo 'allpars' normalized → ['front', 'back', 'floor']", () => {
    const result = getTargetCanonicalZones(['allpars'])
    expect(result).toEqual(['front', 'back', 'floor'])
  })

  test("typo 'right' normalized → modifier → all canonical zones", () => {
    const result = getTargetCanonicalZones(['right'])
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test("['front', 'all-movers'] → ['front', 'movers-left', 'movers-right']", () => {
    const result = getTargetCanonicalZones(['front', 'all-movers'])
    expect(result).toEqual(['front', 'movers-left', 'movers-right'])
  })
})

describe('WAVE 2545: isClipZoneCompatible — Magnetic Drop validation', () => {
  test('clip without zones → compatible with ANY track', () => {
    expect(isClipZoneCompatible(undefined, 'front')).toBe(true)
    expect(isClipZoneCompatible([], 'front')).toBe(true)
    expect(isClipZoneCompatible(undefined, 'back')).toBe(true)
  })

  test('track without targetZone (global) → compatible with ANY clip', () => {
    expect(isClipZoneCompatible(['front'], undefined)).toBe(true)
    expect(isClipZoneCompatible(['back', 'all-right'], undefined)).toBe(true)
  })

  test("clip ['front'] + track 'front' → compatible", () => {
    expect(isClipZoneCompatible(['front'], 'front')).toBe(true)
  })

  test("clip ['front'] + track 'back' → INCOMPATIBLE", () => {
    expect(isClipZoneCompatible(['front'], 'back')).toBe(false)
  })

  test("clip ['all-pars'] + track 'front' → compatible (front is a par)", () => {
    expect(isClipZoneCompatible(['all-pars'], 'front')).toBe(true)
  })

  test("clip ['all-pars'] + track 'movers-left' → INCOMPATIBLE", () => {
    expect(isClipZoneCompatible(['all-pars'], 'movers-left')).toBe(false)
  })

  test("clip ['all-movers'] + track 'movers-right' → compatible", () => {
    expect(isClipZoneCompatible(['all-movers'], 'movers-right')).toBe(true)
  })

  test("clip ['back', 'all-right'] + track 'back' → compatible", () => {
    expect(isClipZoneCompatible(['back', 'all-right'], 'back')).toBe(true)
  })

  test("clip ['back', 'all-right'] + track 'front' → INCOMPATIBLE", () => {
    expect(isClipZoneCompatible(['back', 'all-right'], 'front')).toBe(false)
  })

  test("clip ['all-right'] (modifier only) + track 'back' → compatible (no zone restriction)", () => {
    expect(isClipZoneCompatible(['all-right'], 'back')).toBe(true)
  })

  test("clip ['all'] + track 'floor' → compatible", () => {
    expect(isClipZoneCompatible(['all'], 'floor')).toBe(true)
  })
})

describe('WAVE 2544.1: Ghost Exorcism — typo sanitization', () => {
  const RIG: ZoneMappableFixture[] = [
    { id: 'br1', zone: 'back',  position: { x:  2 } },
    { id: 'bl1', zone: 'back',  position: { x: -2 } },
    { id: 'fr1', zone: 'front', position: { x:  2 } },
    { id: 'm1',  zone: 'movers-left',  position: { x: -4 } },
    { id: 'm2',  zone: 'movers-right', position: { x:  4 } },
    { id: 'p1',  zone: 'front', position: { x:  1 } },
    { id: 'p2',  zone: 'back',  position: { x:  1 } },
    { id: 'p3',  zone: 'floor', position: { x:  0 } },
  ]

  test("'allright' (no hyphen) sanitized → 'all-right' modifier", () => {
    // Should behave as ['allright'] → treats as all-right modifier → all x>=0
    const result = resolveZoneTags(['allright'], RIG)
    const byHyphen = resolveZoneTags(['all-right'], RIG)
    expect(result.sort()).toEqual(byHyphen.sort())
  })

  test("'allleft' sanitized → 'all-left' modifier", () => {
    const result = resolveZoneTags(['allleft'], RIG)
    const byHyphen = resolveZoneTags(['all-left'], RIG)
    expect(result.sort()).toEqual(byHyphen.sort())
  })

  test("'allpars' sanitized → 'all-pars' composite", () => {
    const result = resolveZoneTags(['allpars'], RIG)
    const byHyphen = resolveZoneTags(['all-pars'], RIG)
    expect(result.sort()).toEqual(byHyphen.sort())
  })

  test("'allmovers' sanitized → 'all-movers' composite", () => {
    const result = resolveZoneTags(['allmovers'], RIG)
    const byHyphen = resolveZoneTags(['all-movers'], RIG)
    expect(result.sort()).toEqual(byHyphen.sort())
  })

  test("'back' + 'allright' typo → still AND-intersection back∩right", () => {
    const typo   = resolveZoneTags(['back', 'allright'], RIG)
    const correct = resolveZoneTags(['back', 'all-right'], RIG)
    expect(typo.sort()).toEqual(correct.sort())
    // Strictly only back-right (br1, p2)
    expect(typo).not.toContain('fr1')
    expect(typo).not.toContain('bl1')
  })

  test("normalizeTagsToCanonical: 'allright' → 'all-right'", () => {
    expect(normalizeTagsToCanonical(['allright'])).toBe('all-right')
  })

  test("normalizeTagsToCanonical: ['back', 'allright'] → 'back-right'", () => {
    expect(normalizeTagsToCanonical(['back', 'allright'])).toBe('back-right')
  })

  test("normalizeTagsToCanonical: 'all_left' (underscore) → 'all-left'", () => {
    expect(normalizeTagsToCanonical(['all_left'])).toBe('all-left')
  })

  test("'right' (short) sanitized → 'all-right' modifier", () => {
    const result = resolveZoneTags(['right'], RIG)
    const byFull = resolveZoneTags(['all-right'], RIG)
    expect(result.sort()).toEqual(byFull.sort())
  })

  test("'left' (short) sanitized → 'all-left' modifier", () => {
    const result = resolveZoneTags(['left'], RIG)
    const byFull = resolveZoneTags(['all-left'], RIG)
    expect(result.sort()).toEqual(byFull.sort())
  })

  test("['back', 'right'] → same AND-intersection as ['back', 'all-right']", () => {
    const shortForm = resolveZoneTags(['back', 'right'], RIG)
    const fullForm  = resolveZoneTags(['back', 'all-right'], RIG)
    expect(shortForm.sort()).toEqual(fullForm.sort())
    // must contain only back-right fixtures (br1) and NOT front-right or back-left
    expect(shortForm).not.toContain('fr1')
    expect(shortForm).not.toContain('bl1')
  })

  test("normalizeTagsToCanonical: ['back', 'right'] → 'back-right'", () => {
    expect(normalizeTagsToCanonical(['back', 'right'])).toBe('back-right')
  })
})
