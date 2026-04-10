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
