/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌿 VibeGraftRegistry.test.ts — THE GRAFTING LAYER TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests del registry de injertos: valida que graft/ungraft modifican los
 * registries canónicos correctamente, y que ungraft restaura el estado
 * original — especialmente el backup/restore de PATTERN_CONFIG (global).
 *
 * SECCIONES:
 *   §1  Graft básico — la key aparece en los 7 registries
 *   §2  Ungraft — la key desaparece y los registries vuelven a su estado
 *   §3  PATTERN_CONFIG backup/restore — el global se restaura exacto
 *   §4  Múltiples injertos — varias keys conviven
 *   §5  Re-graft — re-injertar una key ya injertada actualiza
 *   §6  Anti-contaminación — ungraftAll limpia todo
 *
 * @module engine/vibe/custom/__tests__/VibeGraftRegistry
 * @version FASE 1B — The Fusion Core
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { graft, ungraft, ungraftAll, listGrafted, isGrafted, getGraftRecord } from '../VibeGraftRegistry'
import { resolveCustomVibe } from '../VibeFusionResolver'
import { createEmptyCustomVibe } from '../../../../types/CustomVibe'
import type { CustomVibeOverride, BaseDNA, FusedVibeBundle } from '../../../../types/CustomVibe'

import { VIBE_REGISTRY } from '../../../vibe/profiles/index'
import { normalizeVibeId } from '../../../vibe/profiles/index'
import { PROFILE_REGISTRY } from '../../../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../../color/colorConstitutions'
import { VIBE_CONFIG, STEREO_CONFIG, TILT_OFFSET_BY_VIBE, PATTERN_CONFIG } from '../../../movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../../movement/VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const TEST_BASE: BaseDNA = 'techno-club'

function makeBundle(key: string, base: BaseDNA = TEST_BASE, mutations?: (doc: CustomVibeOverride) => void): FusedVibeBundle {
  const doc = createEmptyCustomVibe(key as never, base, 'Test Vibe')
  if (mutations) mutations(doc)
  const result = resolveCustomVibe(doc)
  if (!result.ok || !result.bundle) {
    throw new Error(`resolveCustomVibe failed: ${JSON.stringify(result.diagnostics)}`)
  }
  return result.bundle
}

function snapshotAll() {
  return {
    vibe: { ...VIBE_REGISTRY },
    profile: { ...PROFILE_REGISTRY },
    color: { ...COLOR_CONSTITUTIONS },
    vibeConfig: { ...VIBE_CONFIG },
    stereo: { ...STEREO_CONFIG },
    presets: { ...MOVEMENT_PRESETS },
    tilt: { ...TILT_OFFSET_BY_VIBE },
    patternConfig: JSON.parse(JSON.stringify(PATTERN_CONFIG)),
  }
}

function assertAllRestored(snap: ReturnType<typeof snapshotAll>) {
  expect(VIBE_REGISTRY).toEqual(snap.vibe)
  expect(PROFILE_REGISTRY).toEqual(snap.profile)
  expect(COLOR_CONSTITUTIONS).toEqual(snap.color)
  expect(VIBE_CONFIG).toEqual(snap.vibeConfig)
  expect(STEREO_CONFIG).toEqual(snap.stereo)
  expect(MOVEMENT_PRESETS).toEqual(snap.presets)
  expect(TILT_OFFSET_BY_VIBE).toEqual(snap.tilt)
  expect(JSON.parse(JSON.stringify(PATTERN_CONFIG))).toEqual(snap.patternConfig)
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('VibeGraftRegistry', () => {
  let snap: ReturnType<typeof snapshotAll>

  beforeEach(() => {
    ungraftAll()
    snap = snapshotAll()
  })

  afterEach(() => {
    ungraftAll()
  })

  // ── §1 GRAFT BÁSICO ──────────────────────────────────────────────────
  describe('§1 Graft básico', () => {
    test('injertar hace la key reconocible por normalizeVibeId', () => {
      const bundle = makeBundle('custom:graft-test-001')
      graft(bundle)

      expect(normalizeVibeId('custom:graft-test-001')).not.toBeNull()
    })

    test('injertar añade la key a los 7 registries', () => {
      const bundle = makeBundle('custom:graft-test-002')
      graft(bundle)

      expect(VIBE_REGISTRY['custom:graft-test-002' as never]).toBeDefined()
      expect(PROFILE_REGISTRY['custom:graft-test-002' as never]).toBeDefined()
      expect(COLOR_CONSTITUTIONS['custom:graft-test-002' as never]).toBeDefined()
      expect(VIBE_CONFIG['custom:graft-test-002' as never]).toBeDefined()
      expect(STEREO_CONFIG['custom:graft-test-002' as never]).toBeDefined()
      expect(MOVEMENT_PRESETS['custom:graft-test-002' as never]).toBeDefined()
      expect(TILT_OFFSET_BY_VIBE['custom:graft-test-002' as never]).toBeDefined()
    })

    test('isGrafted devuelve true para la key injertada', () => {
      const bundle = makeBundle('custom:graft-test-003')
      graft(bundle)

      expect(isGrafted('custom:graft-test-003')).toBe(true)
      expect(isGrafted('custom:no-existe')).toBe(false)
    })

    test('listGrafted incluye la key', () => {
      const bundle = makeBundle('custom:graft-test-004')
      graft(bundle)

      expect(listGrafted()).toContain('custom:graft-test-004')
    })

    test('key inválida (sin "custom:") devuelve false', () => {
      const bundle = makeBundle('custom:graft-test-005')
      // Mutamos la key a algo inválido
      ;(bundle as unknown as Record<string, unknown>).key = 'invalid-key'
      expect(graft(bundle as never)).toBe(false)
    })
  })

  // ── §2 UNGRAFT ───────────────────────────────────────────────────────
  describe('§2 Ungraft', () => {
    test('ungraft elimina la key de los 7 registries', () => {
      const bundle = makeBundle('custom:graft-test-010')
      graft(bundle)
      expect(isGrafted('custom:graft-test-010')).toBe(true)

      ungraft('custom:graft-test-010')
      expect(isGrafted('custom:graft-test-010')).toBe(false)
      expect(VIBE_REGISTRY['custom:graft-test-010' as never]).toBeUndefined()
    })

    test('ungraft restaura los registries a su estado original', () => {
      const bundle = makeBundle('custom:graft-test-011')
      graft(bundle)
      ungraft('custom:graft-test-011')

      assertAllRestored(snap)
    })

    test('ungraft de key no injertada devuelve false', () => {
      expect(ungraft('custom:no-existe')).toBe(false)
    })
  })

  // ── §3 PATTERN_CONFIG BACKUP/RESTORE ─────────────────────────────────
  describe('§3 PATTERN_CONFIG backup/restore', () => {
    test('mutar PATTERN_CONFIG vía graft y restaurar con ungraft', () => {
      const bundle = makeBundle('custom:graft-test-020', TEST_BASE, (doc) => {
        doc.movement = {
          scheduler: {
            scan_x: { cycleBeats: 32, phraseDuration: 128 },
          },
        }
      })
      const originalScanX = JSON.parse(JSON.stringify(PATTERN_CONFIG.scan_x))

      graft(bundle)
      // El PATTERN_CONFIG.scan_x debe reflejar la mutación
      expect(PATTERN_CONFIG.scan_x.cycleBeats).toBe(32)
      expect(PATTERN_CONFIG.scan_x.phraseDuration).toBe(128)

      ungraft('custom:graft-test-020')
      // Restaurado al estado original
      expect(PATTERN_CONFIG.scan_x.cycleBeats).toBe(originalScanX.cycleBeats)
      expect(PATTERN_CONFIG.scan_x.phraseDuration).toBe(originalScanX.phraseDuration)
    })

    test('patrones NO mutados no se restauran innecesariamente', () => {
      const bundle = makeBundle('custom:graft-test-021', TEST_BASE, (doc) => {
        doc.movement = {
          scheduler: {
            scan_x: { cycleBeats: 24 },
          },
        }
      })
      const originalSquare = JSON.parse(JSON.stringify(PATTERN_CONFIG.square))

      graft(bundle)
      // square no fue mutado, debe ser igual
      expect(PATTERN_CONFIG.square).toEqual(originalSquare)

      ungraft('custom:graft-test-021')
      expect(PATTERN_CONFIG.square).toEqual(originalSquare)
    })

    test('getGraftRecord contiene el backup de PatternConfig', () => {
      const bundle = makeBundle('custom:graft-test-022', TEST_BASE, (doc) => {
        doc.movement = {
          scheduler: {
            scan_x: { cycleBeats: 48 },
          },
        }
      })
      graft(bundle)

      const record = getGraftRecord('custom:graft-test-022')
      expect(record).toBeDefined()
      expect(record!.patternConfigBackup.has('scan_x')).toBe(true)
    })
  })

  // ── §4 MÚLTIPLES INJERTOS ────────────────────────────────────────────
  describe('§4 Múltiples injertos', () => {
    test('dos custom vibes pueden estar injertados simultáneamente', () => {
      const b1 = makeBundle('custom:multi-001')
      const b2 = makeBundle('custom:multi-002')

      graft(b1)
      graft(b2)

      expect(isGrafted('custom:multi-001')).toBe(true)
      expect(isGrafted('custom:multi-002')).toBe(true)
      expect(listGrafted()).toHaveLength(2)
    })

    test('ungraft de uno no afecta al otro', () => {
      const b1 = makeBundle('custom:multi-003')
      const b2 = makeBundle('custom:multi-004')

      graft(b1)
      graft(b2)
      ungraft('custom:multi-003')

      expect(isGrafted('custom:multi-003')).toBe(false)
      expect(isGrafted('custom:multi-004')).toBe(true)
      expect(VIBE_REGISTRY['custom:multi-004' as never]).toBeDefined()
    })
  })

  // ── §5 RE-GRAFT ──────────────────────────────────────────────────────
  describe('§5 Re-graft', () => {
    test('re-injertar una key ya injertada actualiza los valores', () => {
      const b1 = makeBundle('custom:regraft-001', TEST_BASE, (doc) => {
        doc.physics = { transient: { percBoost: 3.0 } }
      })
      graft(b1)
      expect(PROFILE_REGISTRY['custom:regraft-001' as never].percBoost).toBe(3.0)

      const b2 = makeBundle('custom:regraft-001', TEST_BASE, (doc) => {
        doc.physics = { transient: { percBoost: 7.0 } }
      })
      graft(b2)
      expect(PROFILE_REGISTRY['custom:regraft-001' as never].percBoost).toBe(7.0)
      // Sigue siendo una sola key injertada
      expect(listGrafted().filter((k) => k === 'custom:regraft-001')).toHaveLength(1)
    })
  })

  // ── §6 ANTI-CONTAMINACIÓN ────────────────────────────────────────────
  describe('§6 Anti-contaminación', () => {
    test('ungraftAll limpia todos los injertos', () => {
      const b1 = makeBundle('custom:clean-001')
      const b2 = makeBundle('custom:clean-002')
      const b3 = makeBundle('custom:clean-003')

      graft(b1)
      graft(b2)
      graft(b3)
      expect(listGrafted()).toHaveLength(3)

      ungraftAll()
      expect(listGrafted()).toHaveLength(0)
      assertAllRestored(snap)
    })
  })
})
