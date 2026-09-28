/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️  WAVE 8269 — DMX GOVERNOR EVALUATOR TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Suite para applyDMXGovernors + buildGovernorLookupMap.
 *
 * Foco principal: la nueva acción `clampMax` (techo duro de byte),
 * su precedencia dentro del pipeline de acciones y su interacción
 * con forceByte / curve / mapToRange / clampMin.
 *
 * REGLAS DE ORO:
 * - Zero Math.random() — determinismo total.
 * - Governors construidos inline (los tipos vienen de core/aether/device.ts).
 *
 * @module core/aether/__tests__/dmx-governor-evaluator.test.ts
 * @version WAVE 8269
 */

import { describe, test, expect } from 'vitest'

import { applyDMXGovernors, buildGovernorLookupMap } from '../resolver/DMXGovernorEvaluator'
import type { IDMXGovernor, IGovernorRule } from '../device'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES — deterministas
// ═══════════════════════════════════════════════════════════════════════════

function rule(intentType: IGovernorRule['when']['intentType'], then: IGovernorRule['then'], min?: number, max?: number): IGovernorRule {
  return {
    when: { intentType, ...(min !== undefined && { min }), ...(max !== undefined && { max }) },
    then,
  }
}

function gov(channelIndex: number, rules: IGovernorRule[]): IDMXGovernor {
  return { channelIndex, rules }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🏛️ DMXGovernorEvaluator — cadena de reglas de última milla', () => {

  // ─────────────────────────────────────────────────────────────────────
  // §1 — Lookup map + passthrough
  // ─────────────────────────────────────────────────────────────────────

  describe('§1 — Lookup map y passthrough', () => {

    test('§1.1 — buildGovernorLookupMap indexa por channelIndex (0-based)', () => {
      const g = gov(11, [rule('fallback', { clampMax: 200 })])
      const map = buildGovernorLookupMap([g])
      expect(map[11]).toBe(g)
      expect(map[10]).toBeUndefined()
      expect(map[12]).toBeUndefined()
      expect(map.length).toBe(512)
    })

    test('§1.2 — Sin gobernador en el canal → computedByte pasa intacto', () => {
      const map = buildGovernorLookupMap([])
      expect(applyDMXGovernors(map, 5, 'dimmer', 0.8, 204)).toBe(204)
    })

    test('§1.3 — Gobernador presente pero ninguna regla hace match → passthrough', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('strobe', { forceByte: 255 })]),  // strobe no matchea 'dimmer'
      ])
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.8, 204)).toBe(204)
    })

    test('§1.4 — when.min/max filtran por input normalizado', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { forceByte: 100 }, 0.5, 1.0)]),
      ])
      // 'dimmer' → intentType 'intensity'
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.3, 77)).toBe(77)   // < min → no match
      expect(applyDMXGovernors(map, 0, 'dimmer', 1.0, 255)).toBe(255) // >= max (exclusivo) → no match
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.7, 179)).toBe(100) // en rango → match
    })

    test('§1.5 — intentType "fallback" hace match con cualquier canal', () => {
      const map = buildGovernorLookupMap([
        gov(3, [rule('fallback', { clampMax: 128 })]),
      ])
      // 'red' no está en CHANNEL_TO_INTENT → intentType 'fallback'
      expect(applyDMXGovernors(map, 3, 'red', 1.0, 255)).toBe(128)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §2 — clampMax (WAVE 8269)
  // ─────────────────────────────────────────────────────────────────────

  describe('§2 — clampMax (techo duro)', () => {

    test('§2.1 — clampMax capa un byte por encima del máximo', () => {
      const map = buildGovernorLookupMap([
        gov(12, [rule('fallback', { clampMax: 150 })]),
      ])
      expect(applyDMXGovernors(map, 12, 'red', 1.0, 255)).toBe(150)
    })

    test('§2.2 — Byte por debajo del cap queda intacto', () => {
      const map = buildGovernorLookupMap([
        gov(12, [rule('fallback', { clampMax: 200 })]),
      ])
      expect(applyDMXGovernors(map, 12, 'red', 0.5, 120)).toBe(120)
    })

    test('§2.3 — clampMax = 0 fuerza apagado total', () => {
      const map = buildGovernorLookupMap([
        gov(12, [rule('fallback', { clampMax: 0 })]),
      ])
      expect(applyDMXGovernors(map, 12, 'red', 1.0, 255)).toBe(0)
    })

    test('§2.4 — clampMin + clampMax en la misma regla: piso y techo coexisten', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { clampMin: 20, clampMax: 200 })]),
      ])
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.9, 230)).toBe(200) // techo
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.1, 10)).toBe(20)   // piso (result>0 && <20)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.0, 0)).toBe(0)     // 0 queda en 0 (clampMin no revive)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.5, 128)).toBe(128) // dentro del rango
    })

    test('§2.5 — clampMax se aplica DESPUÉS de mapToRange', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { mapToRange: [100, 255], clampMax: 180 })]),
      ])
      // normalized=1 → mapToRange da 255 → clampMax baja a 180
      expect(applyDMXGovernors(map, 0, 'dimmer', 1.0, 255)).toBe(180)
      // normalized=0.5 → mapToRange da ~178 → por debajo del cap
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.5, 178)).toBe(178)
    })

    test('§2.6 — clampMax se aplica DESPUÉS de curve', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { curve: { ceiling: 1.0, exponent: 2 }, clampMax: 100 })]),
      ])
      // curve(1.0) = 1·1² → 255 → clampMax → 100
      expect(applyDMXGovernors(map, 0, 'dimmer', 1.0, 255)).toBe(100)
    })

    test('§2.7 — forceByte tiene precedencia absoluta (clampMax no lo toca)', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { forceByte: 255, clampMax: 50 })]),
      ])
      // forceByte retorna inmediato — ignoramos clampMax (misma semántica que clampMin)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.9, 230)).toBe(255)
    })

    test('§2.8 — Primera regla que hace match gana (short-circuit)', () => {
      const map = buildGovernorLookupMap([
        gov(0, [
          rule('intensity', { clampMax: 100 }, 0.8),       // solo input ≥ 0.8
          rule('intensity', { clampMax: 200 }),            // resto
        ]),
      ])
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.9, 255)).toBe(100)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.5, 255)).toBe(200)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §3 — Regresión de acciones existentes
  // ─────────────────────────────────────────────────────────────────────

  describe('§3 — Regresión: acciones existentes intactas', () => {

    test('§3.1 — clampMin eleva pero no revive el 0', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { clampMin: 32 })]),
      ])
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.1, 10)).toBe(32)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.0, 0)).toBe(0)
      expect(applyDMXGovernors(map, 0, 'dimmer', 0.5, 128)).toBe(128)
    })

    test('§3.2 — mapToRange re-mapea input normalizado', () => {
      const map = buildGovernorLookupMap([
        gov(1, [rule('shutter', { mapToRange: [8, 216] })]),
      ])
      expect(applyDMXGovernors(map, 1, 'shutter', 0.0, 0)).toBe(8)
      expect(applyDMXGovernors(map, 1, 'shutter', 1.0, 255)).toBe(216)
      expect(applyDMXGovernors(map, 1, 'shutter', 0.5, 128)).toBe(112)
    })

    test('§3.3 — curve con ceiling < 1 capa el máximo', () => {
      const map = buildGovernorLookupMap([
        gov(0, [rule('intensity', { curve: { ceiling: 0.5, exponent: 1 } })]),
      ])
      // out = 0.5 · 1^1 → 128
      expect(applyDMXGovernors(map, 0, 'dimmer', 1.0, 255)).toBe(128)
    })
  })
})
