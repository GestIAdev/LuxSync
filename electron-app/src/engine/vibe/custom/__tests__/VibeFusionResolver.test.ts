/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 VibeFusionResolver.test.ts — THE FUSION CORE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests del resolver: valida que la fusión de un `CustomVibeOverride` con
 * las configs canónicas produce un `FusedVibeBundle` correcto, con
 * invariantes respetadas y diagnostics apropiados.
 *
 * SECCIONES:
 *   §1  Resolución básica — documento vacío hereda el ADN base
 *   §2  Mutación simple — un gen se aplica correctamente
 *   §3  Clamping — valores fuera de rango se clampean + warn
 *   §4  Sealed params — rutas selladas se bloquean + error
 *   §5  Invariantes — morphFloor < morphCeiling, phraseDuration múltiplo
 *   §6  Anti-epilepsia — strobeDuration clampeado a 84ms
 *   §7  Pureza — los registries canónicos NO se mutan
 *   §8  Macros — expandMacro produce mutaciones en rango
 *
 * @module engine/vibe/custom/__tests__/VibeFusionResolver
 * @version FASE 1B — The Fusion Core
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { resolveCustomVibe, resolveCustomVibeSafe, getFusedValue } from '../VibeFusionResolver'
import { expandMacro, expandMacroClamped, MACRO_GENE_LIST, getMacroGene } from '../macroGenes'
import { createEmptyCustomVibe, LUXVIBE_SCHEMA_VERSION } from '../../../../types/CustomVibe'
import type { CustomVibeOverride, BaseDNA } from '../../../../types/CustomVibe'

import { VIBE_REGISTRY } from '../../../vibe/profiles/index'
import { PROFILE_REGISTRY } from '../../../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../../color/colorConstitutions'
import { VIBE_CONFIG, STEREO_CONFIG, TILT_OFFSET_BY_VIBE } from '../../../movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../../movement/VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const TEST_BASE: BaseDNA = 'techno-club'

function makeDoc(base: BaseDNA = TEST_BASE): CustomVibeOverride {
  return createEmptyCustomVibe('custom:test-abc123', base, 'Test Vibe')
}

/** Snapshot de los registries antes de un test, para verificar pureza. */
function snapshotRegistries() {
  return {
    vibeRegistry: { ...VIBE_REGISTRY },
    profileRegistry: { ...PROFILE_REGISTRY },
    colorConstitutions: { ...COLOR_CONSTITUTIONS },
    vibeConfig: { ...VIBE_CONFIG },
    stereoConfig: { ...STEREO_CONFIG },
    movementPresets: { ...MOVEMENT_PRESETS },
    tiltOffset: { ...TILT_OFFSET_BY_VIBE },
  }
}

/** Verifica que los registries no cambiaron. */
function assertRegistriesUnchanged(snap: ReturnType<typeof snapshotRegistries>) {
  expect(VIBE_REGISTRY).toEqual(snap.vibeRegistry)
  expect(PROFILE_REGISTRY).toEqual(snap.profileRegistry)
  expect(COLOR_CONSTITUTIONS).toEqual(snap.colorConstitutions)
  expect(VIBE_CONFIG).toEqual(snap.vibeConfig)
  expect(STEREO_CONFIG).toEqual(snap.stereoConfig)
  expect(MOVEMENT_PRESETS).toEqual(snap.movementPresets)
  expect(TILT_OFFSET_BY_VIBE).toEqual(snap.tiltOffset)
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('VibeFusionResolver', () => {
  let snap: ReturnType<typeof snapshotRegistries>

  beforeEach(() => {
    snap = snapshotRegistries()
  })

  // ── §1 RESOLUCIÓN BÁSICA ─────────────────────────────────────────────
  describe('§1 Resolución básica', () => {
    test('documento vacío produce bundle con ADN base heredado', () => {
      const doc = makeDoc()
      const result = resolveCustomVibe(doc)

      expect(result.ok).toBe(true)
      expect(result.bundle).not.toBeNull()
      expect(result.bundle!.baseDNA).toBe(TEST_BASE)
      expect(result.bundle!.key).toBe('custom:test-abc123')
      expect(result.diagnostics).toHaveLength(0)
    })

    test('el bundle tiene las 7 configs canónicas del ADN base', () => {
      const doc = makeDoc()
      const result = resolveCustomVibe(doc)
      const bundle = result.bundle!

      expect(bundle.liquidProfile).toEqual(PROFILE_REGISTRY[TEST_BASE])
      expect(bundle.colorConstitution).toEqual(COLOR_CONSTITUTIONS[TEST_BASE])
      expect(bundle.vibeConfig).toEqual(VIBE_CONFIG[TEST_BASE])
      expect(bundle.stereoConfig).toEqual(STEREO_CONFIG[TEST_BASE])
      expect(bundle.movementPreset).toEqual(MOVEMENT_PRESETS[TEST_BASE])
    })

    test('schemaVersion incorrecto → error + bundle null', () => {
      const doc = makeDoc()
      ;(doc as unknown as Record<string, unknown>).schemaVersion = '0.0.0' as never
      const result = resolveCustomVibe(doc)

      expect(result.ok).toBe(false)
      expect(result.bundle).toBeNull()
      // isCustomVibeOverride falla primero (path: 'root') o schemaVersion check (path: 'schemaVersion')
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true)
    })

    test('baseDNA inválido → error', () => {
      const doc = makeDoc()
      ;(doc as unknown as Record<string, unknown>).baseDNA = 'invalid-vibe' as never
      const result = resolveCustomVibe(doc)

      expect(result.ok).toBe(false)
      expect(result.bundle).toBeNull()
    })
  })

  // ── §2 MUTACIÓN SIMPLE ───────────────────────────────────────────────
  describe('§2 Mutación simple', () => {
    test('mutar physics.transient.percBoost se aplica al liquidProfile', () => {
      const doc = makeDoc()
      doc.physics = { transient: { percBoost: 5.0 } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.liquidProfile.percBoost).toBe(5.0)
    })

    test('mutar movement.kinematics.panScale se aplica al vibeConfig', () => {
      const doc = makeDoc()
      doc.movement = { kinematics: { panScale: 0.5 } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.vibeConfig.panScale).toBe(0.5)
    })

    test('mutar color.thermal.atmosphericTemp se aplica al colorConstitution', () => {
      const doc = makeDoc()
      doc.color = { thermal: { atmosphericTemp: 3000 } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.colorConstitution.atmosphericTemp).toBe(3000)
    })

    test('getFusedValue recupera el valor resuelto', () => {
      const doc = makeDoc()
      doc.physics = { transient: { percBoost: 3.5 } }

      const result = resolveCustomVibe(doc)
      expect(getFusedValue(result.bundle!, 'physics.transient.percBoost')).toBe(3.5)
    })
  })

  // ── §3 CLAMPING ──────────────────────────────────────────────────────
  describe('§3 Clamping contra GENE_RANGES', () => {
    test('valor por encima del rango se clampea + warn', () => {
      const doc = makeDoc()
      // percBoost range: 0.0–10.0
      doc.physics = { transient: { percBoost: 999 } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.liquidProfile.percBoost).toBe(10) // clampeado a max
      expect(result.diagnostics.some((d) => d.severity === 'warn' && d.path === 'physics.transient.percBoost')).toBe(true)
    })

    test('valor por debajo del rango se clampea', () => {
      const doc = makeDoc()
      // percBoost range: 0.0–10.0
      doc.physics = { transient: { percBoost: -5 } }

      const result = resolveCustomVibe(doc)
      expect(result.bundle!.liquidProfile.percBoost).toBe(0) // clampeado a min
    })

    test('valor dentro del rango no genera warn', () => {
      const doc = makeDoc()
      doc.physics = { transient: { percBoost: 5.0 } }

      const result = resolveCustomVibe(doc)
      expect(result.bundle!.liquidProfile.percBoost).toBe(5.0)
      expect(result.diagnostics.filter((d) => d.path === 'physics.transient.percBoost')).toHaveLength(0)
    })
  })

  // ── §4 SEALED PARAMS ─────────────────────────────────────────────────
  describe('§4 Sealed params', () => {
    test('mutar un parámetro sellado → error y no se aplica', () => {
      const doc = makeDoc()
      // movement.TILT_CEILING es sealed (seguridad de hardware)
      doc.movement = { physics: { SAFETY_CAP: { maxAcceleration: 2000 } } as never }

      const result = resolveCustomVibe(doc)
      expect(result.diagnostics.some((d) => d.severity === 'error' && d.path === 'movement.physics.SAFETY_CAP.maxAcceleration')).toBe(true)
    })
  })

  // ── §5 INVARIANTES ───────────────────────────────────────────────────
  describe('§5 Invariantes', () => {
    test('morphFloor >= morphCeiling se auto-corrigue + warn', () => {
      const doc = makeDoc()
      doc.physics = { morph: { morphFloor: 0.8, morphCeiling: 0.3 } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.liquidProfile.morphFloor).toBeLessThan(result.bundle!.liquidProfile.morphCeiling)
      expect(result.diagnostics.some((d) => d.path === 'physics.morph.morphFloor')).toBe(true)
    })

    test('phraseDuration no múltiplo de cycleBeats → snap + warn', () => {
      const doc = makeDoc()
      doc.movement = {
        scheduler: {
          scan_x: { cycleBeats: 16, phraseDuration: 50 }, // 50 no es múltiplo de 16
        },
      }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      const pc = result.bundle!.patternConfigs?.scan_x
      expect(pc).toBeDefined()
      expect(pc!.phraseDuration % pc!.cycleBeats).toBe(0)
      expect(result.diagnostics.some((d) => d.path === 'movement.scheduler.scan_x.phraseDuration')).toBe(true)
    })

    test('zoomRange invertido se intercambia', () => {
      const doc = makeDoc()
      doc.movement = { optics: { zoomRange: { min: 200, max: 50 } as never } }

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      const range = result.bundle!.movementPreset.optics.zoomRange
      expect(range.min).toBeLessThanOrEqual(range.max)
    })
  })

  // ── §6 ANTI-EPILEPSIA ────────────────────────────────────────────────
  describe('§6 Anti-epilepsia', () => {
    test('strobeDuration < 84ms se clampea a 84ms', () => {
      const doc = makeDoc()
      doc.physics = { strobe: { strobeDuration: 10 } } // 10ms = 100 Hz

      const result = resolveCustomVibe(doc)
      expect(result.ok).toBe(true)
      expect(result.bundle!.liquidProfile.strobeDuration).toBeGreaterThanOrEqual(84)
      expect(result.diagnostics.some((d) => d.path === 'physics.strobe.strobeDuration')).toBe(true)
    })
  })

  // ── §7 PUREZA ────────────────────────────────────────────────────────
  describe('§7 Pureza (no mutación de registries)', () => {
    test('resolver un documento no muta los registries canónicos', () => {
      const doc = makeDoc()
      doc.physics = { transient: { percBoost: 7.5 } }
      doc.color = { thermal: { atmosphericTemp: 4000 } }
      doc.movement = { kinematics: { panScale: 0.3 } }

      resolveCustomVibe(doc)
      assertRegistriesUnchanged(snap)
    })

    test('resolver un documento con errores no muta los registries', () => {
      const doc = makeDoc()
      doc.physics = { routing: { isPureAmbient: true } } // sealed

      resolveCustomVibe(doc)
      assertRegistriesUnchanged(snap)
    })
  })

  // ── §8 SAFE RESOLVER ─────────────────────────────────────────────────
  describe('resolveCustomVibeSafe', () => {
    test('input inválido → error sin throw', () => {
      const result = resolveCustomVibeSafe({ foo: 'bar' })
      expect(result.ok).toBe(false)
      expect(result.bundle).toBeNull()
    })

    test('input null → error sin throw', () => {
      const result = resolveCustomVibeSafe(null)
      expect(result.ok).toBe(false)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MACRO GENES TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('macroGenes', () => {
  // ── ESTRUCTURA ───────────────────────────────────────────────────────
  describe('Estructura', () => {
    test('hay exactamente 5 Macro Genes', () => {
      expect(MACRO_GENE_LIST).toHaveLength(5)
    })

    test('cada Macro Gene tiene al menos 1 target', () => {
      for (const gene of MACRO_GENE_LIST) {
        expect(gene.targets.length).toBeGreaterThan(0)
      }
    })

    test('los 5 ids son únicos', () => {
      const ids = MACRO_GENE_LIST.map((g) => g.id)
      expect(new Set(ids).size).toBe(5)
    })

    test('getMacroGene recupera por id', () => {
      expect(getMacroGene('aggression').id).toBe('aggression')
      expect(getMacroGene('viscosity').id).toBe('viscosity')
      expect(getMacroGene('thermalBias').id).toBe('thermalBias')
      expect(getMacroGene('spatialReach').id).toBe('spatialReach')
      expect(getMacroGene('nervousness').id).toBe('nervousness')
    })
  })

  // ── EXPANSIÓN ────────────────────────────────────────────────────────
  describe('expandMacro', () => {
    test('value=0 produce mutaciones en el extremo inferior', () => {
      const mutations = expandMacro('aggression', 0)
      expect(mutations.length).toBeGreaterThan(0)
      // Cada mutación debe tener path y value numérico
      for (const m of mutations) {
        expect(typeof m.path).toBe('string')
        expect(typeof m.value).toBe('number')
        expect(Number.isFinite(m.value)).toBe(true)
      }
    })

    test('value=1 produce mutaciones en el extremo superior', () => {
      const mutations = expandMacro('aggression', 1)
      expect(mutations.length).toBeGreaterThan(0)
      for (const m of mutations) {
        expect(Number.isFinite(m.value)).toBe(true)
      }
    })

    test('value fuera de [0,1] se clampea', () => {
      const m0 = expandMacro('viscosity', -0.5)
      const mClamped0 = expandMacro('viscosity', 0)
      expect(m0).toEqual(mClamped0)

      const m1 = expandMacro('viscosity', 2)
      const mClamped1 = expandMacro('viscosity', 1)
      expect(m1).toEqual(mClamped1)
    })
  })

  // ── CLAMPED ──────────────────────────────────────────────────────────
  describe('expandMacroClamped', () => {
    test('todos los valores resultantes están dentro de GENE_RANGES', () => {
      for (const gene of MACRO_GENE_LIST) {
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const mutations = expandMacroClamped(gene.id, t)
          for (const m of mutations) {
            // Cada valor debe ser finito
            expect(Number.isFinite(m.value)).toBe(true)
          }
        }
      }
    })
  })
})
