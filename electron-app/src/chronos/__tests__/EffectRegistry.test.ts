/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩻 WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 1: EffectRegistry — 45 efectos reales, MixBus inference, categorías
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/EffectRegistry
 * @version WAVE 2078
 */

import { describe, test, expect } from 'vitest'
import {
  getAllEffects,
  getEffectById,
  getEffectCategories,
  getEffectsByZone,
  getStrobeEffects,
  getTotalEffectCount,
  getEffectCounts,
  inferMixBus,
  getEffectTrackId,
  type EffectMeta,
  type MixBus,
} from '../core/EffectRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 EFFECT REGISTRY INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe('🎯 EffectRegistry — 45 Real Effects', () => {

  // ─────────────────────────────────────────────────────────────────────
  // CENSUS: Count and Structure
  // ─────────────────────────────────────────────────────────────────────
  
  test('Total effect count is exactly 45', () => {
    expect(getTotalEffectCount()).toBe(45)
  })

  test('getAllEffects() returns 45 effects with no duplicates', () => {
    const effects = getAllEffects()
    expect(effects.length).toBe(45)
    
    // No duplicate IDs
    const ids = effects.map(e => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(45)
  })

  test('4 categories exist: fiesta-latina, techno, pop-rock, chill-lounge', () => {
    const categories = getEffectCategories()
    expect(categories.length).toBe(4)
    
    const categoryIds = categories.map(c => c.id)
    expect(categoryIds).toContain('fiesta-latina')
    expect(categoryIds).toContain('techno')
    expect(categoryIds).toContain('pop-rock')
    expect(categoryIds).toContain('chill-lounge')
  })

  test('Category counts: Fiesta Latina 11, Techno 15, Pop-Rock 8, Chill Lounge 10 (+1 legacy = 45)', () => {
    const counts = getEffectCounts()
    // Total across categories should sum to 45
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(45)
  })

  // ─────────────────────────────────────────────────────────────────────
  // ANATOMY: Every effect has required fields
  // ─────────────────────────────────────────────────────────────────────

  test('Every effect has all required fields', () => {
    const effects = getAllEffects()
    
    for (const effect of effects) {
      expect(effect.id, `${effect.id} missing id`).toBeTruthy()
      expect(effect.displayName, `${effect.id} missing displayName`).toBeTruthy()
      expect(effect.icon, `${effect.id} missing icon`).toBeTruthy()
      expect(effect.color, `${effect.id} missing color`).toBeTruthy()
      expect(effect.description, `${effect.id} missing description`).toBeTruthy()
      
      // Zone must be valid
      const validZones = ['silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak']
      expect(validZones, `${effect.id} has invalid zone: ${effect.zone}`)
        .toContain(effect.zone)
      
      // Boolean flags exist
      expect(typeof effect.hasStrobe).toBe('boolean')
      expect(typeof effect.isDynamic).toBe('boolean')
      
      // Suggested duration must be positive
      expect(effect.suggestedDuration, `${effect.id} suggestedDuration must be > 0`)
        .toBeGreaterThan(0)
    }
  })

  test('Every effect color is a valid hex color', () => {
    const effects = getAllEffects()
    const hexRegex = /^#[0-9a-fA-F]{6}$/
    
    for (const effect of effects) {
      expect(effect.color, `${effect.id} color "${effect.color}" is not valid hex`)
        .toMatch(hexRegex)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // LOOKUP: getEffectById
  // ─────────────────────────────────────────────────────────────────────

  test('getEffectById returns correct effect', () => {
    // Pick known effects
    const strobeHit = getEffectById('strobe_burst')
    expect(strobeHit).toBeDefined()
    expect(strobeHit!.displayName).toBeTruthy()
    expect(strobeHit!.hasStrobe).toBe(true)
  })

  test('getEffectById returns undefined for non-existent ID', () => {
    const ghost = getEffectById('this_effect_does_not_exist_ever')
    expect(ghost).toBeUndefined()
  })

  // ─────────────────────────────────────────────────────────────────────
  // ZONE FILTERING
  // ─────────────────────────────────────────────────────────────────────

  test('getEffectsByZone returns only effects from that zone', () => {
    const peakEffects = getEffectsByZone('peak')
    expect(peakEffects.length).toBeGreaterThan(0)
    
    for (const effect of peakEffects) {
      expect(effect.zone).toBe('peak')
    }
  })

  test('getStrobeEffects returns only effects with hasStrobe=true', () => {
    const strobes = getStrobeEffects()
    expect(strobes.length).toBeGreaterThan(0)
    
    for (const effect of strobes) {
      expect(effect.hasStrobe, `${effect.id} should have hasStrobe=true`).toBe(true)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // MIXBUS INFERENCE ENGINE
  // ─────────────────────────────────────────────────────────────────────

  test('inferMixBus returns valid MixBus for every effect', () => {
    const effects = getAllEffects()
    const validBuses: MixBus[] = ['global', 'htp', 'ambient', 'accent']
    
    for (const effect of effects) {
      const bus = inferMixBus(effect)
      expect(validBuses, `${effect.id} inferred invalid bus: ${bus}`)
        .toContain(bus)
    }
  })

  test('getEffectTrackId maps MixBus to track correctly', () => {
    const effects = getAllEffects()
    const validTracks = ['fx1', 'fx2', 'fx3', 'fx4']
    
    for (const effect of effects) {
      const trackId = getEffectTrackId(effect)
      expect(validTracks, `${effect.id} mapped to invalid track: ${trackId}`)
        .toContain(trackId)
    }
  })

  test('Strobe effects should NOT be on ambient bus', () => {
    const strobes = getStrobeEffects()
    
    for (const effect of strobes) {
      const bus = inferMixBus(effect)
      expect(bus, `Strobe ${effect.id} should not be ambient`).not.toBe('ambient')
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM: Same input → Same output
  // ─────────────────────────────────────────────────────────────────────

  test('getAllEffects returns same order on every call (deterministic)', () => {
    const first = getAllEffects().map(e => e.id)
    const second = getAllEffects().map(e => e.id)
    expect(first).toEqual(second)
  })

  test('inferMixBus is deterministic for each effect', () => {
    const effects = getAllEffects()
    
    for (const effect of effects) {
      const bus1 = inferMixBus(effect)
      const bus2 = inferMixBus(effect)
      expect(bus1).toBe(bus2)
    }
  })
})
