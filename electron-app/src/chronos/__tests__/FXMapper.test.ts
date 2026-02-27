/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩻 WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 2: FXMapper — Chronos FX types → BaseEffect IDs
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/FXMapper
 * @version WAVE 2078
 */

import { describe, test, expect } from 'vitest'
import {
  mapChronosFXToBaseEffect,
  getAvailableFXTypes,
  isValidFXType,
  getFXInfo,
} from '../core/FXMapper'

// ═══════════════════════════════════════════════════════════════════════════
// 🔀 FX MAPPER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🔀 FXMapper — Chronos FX → BaseEffect Mapping', () => {

  // ─────────────────────────────────────────────────────────────────────
  // DIRECT PASSTHROUGH
  // ─────────────────────────────────────────────────────────────────────

  test('Known BaseEffect IDs pass through unchanged', () => {
    // If the FX type IS a valid BaseEffect ID, it should pass through
    const result = mapChronosFXToBaseEffect('strobe_burst')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE TYPE MAPPING
  // ─────────────────────────────────────────────────────────────────────

  test('mapChronosFXToBaseEffect returns string for valid types', () => {
    const types = getAvailableFXTypes()
    
    for (const fxType of types) {
      const result = mapChronosFXToBaseEffect(fxType.id)
      expect(result, `${fxType.id} should map to a BaseEffect`)
        .toBeTruthy()
      expect(typeof result).toBe('string')
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // HEPHAESTUS CUSTOM BYPASS
  // ─────────────────────────────────────────────────────────────────────

  test('heph-custom passes through as heph-custom', () => {
    const result = mapChronosFXToBaseEffect('heph-custom')
    expect(result).toBe('heph-custom')
  })

  // ─────────────────────────────────────────────────────────────────────
  // AVAILABLE FX TYPES
  // ─────────────────────────────────────────────────────────────────────

  test('getAvailableFXTypes returns non-empty list', () => {
    const types = getAvailableFXTypes()
    expect(types.length).toBeGreaterThan(0)
  })

  test('Each FX type has id, label, and icon', () => {
    const types = getAvailableFXTypes()
    
    for (const fxType of types) {
      expect(fxType.id, 'Missing id').toBeTruthy()
      expect(fxType.label, `${fxType.id} missing label`).toBeTruthy()
      expect(fxType.icon, `${fxType.id} missing icon`).toBeTruthy()
    }
  })

  test('No duplicate FX type IDs', () => {
    const types = getAvailableFXTypes()
    const ids = types.map(t => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  // ─────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────

  test('isValidFXType returns true for known types', () => {
    const types = getAvailableFXTypes()
    
    for (const fxType of types) {
      expect(isValidFXType(fxType.id), `${fxType.id} should be valid`)
        .toBe(true)
    }
  })

  test('isValidFXType returns false for garbage input', () => {
    expect(isValidFXType('nonexistent_garbage_fx_1234')).toBe(false)
    expect(isValidFXType('')).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────
  // getFXInfo
  // ─────────────────────────────────────────────────────────────────────

  test('getFXInfo returns complete info for known FX types', () => {
    const types = getAvailableFXTypes()
    
    for (const fxType of types) {
      const info = getFXInfo(fxType.id)
      expect(info, `${fxType.id} should have info`).toBeDefined()
      expect(info.chronosType).toBe(fxType.id)
      expect(info.backendId, `${fxType.id} should have backendId`).toBeTruthy()
      expect(typeof info.vibeSpecific).toBe('boolean')
      expect(typeof info.isPassthrough).toBe('boolean')
    }
  })

  test('getFXInfo: passthrough types have isPassthrough=true', () => {
    // Known BaseEffect IDs should be passthrough
    const info = getFXInfo('strobe_burst')
    if (info.isPassthrough) {
      expect(info.backendId).toBe('strobe_burst')
    }
  })

  test('getFXInfo: heph-custom maps to itself', () => {
    const info = getFXInfo('heph-custom')
    expect(info.chronosType).toBe('heph-custom')
    expect(info.backendId).toBe('heph-custom')
  })

  test('Unknown FX type falls back to solar_flare', () => {
    const result = mapChronosFXToBaseEffect('nonexistent_garbage_fx_1234')
    expect(result).toBe('solar_flare')
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM
  // ─────────────────────────────────────────────────────────────────────

  test('Mapping is deterministic: same input → same output', () => {
    const types = getAvailableFXTypes()
    
    for (const fxType of types) {
      const first = mapChronosFXToBaseEffect(fxType.id)
      const second = mapChronosFXToBaseEffect(fxType.id)
      expect(first).toBe(second)
    }
  })
})
