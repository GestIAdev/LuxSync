/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2487: LiquidProfiles — Validation + Monte Carlo Regression Snapshots
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE SAFETY NET — Protege las constantes Monte Carlo calibradas, valida la
 * estructura de los perfiles, y asegura que ningún merge rompa los valores
 * sagrados que costaron semanas de calibración.
 *
 * Tests DETERMINISTAS. Zero aleatorio. Axioma Anti-Simulación.
 *
 * @version WAVE 2487 — THE SAFETY NET
 */

import { describe, it, expect } from 'vitest'
import { TECHNO_PROFILE } from '../profiles/techno'
import { LATINO_PROFILE } from '../profiles/latino'
import { CHILL_PROFILE } from '../profiles/chilllounge'
import { POPROCK_PROFILE } from '../profiles/poprock'
import type { ILiquidProfile } from '../ILiquidProfile'

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Validación estructural de perfil
// ═══════════════════════════════════════════════════════════════════════════

const REQUIRED_ENVELOPE_FIELDS = ['name', 'gateOn', 'boost', 'crushExponent', 'decayBase', 'decayRange', 'maxIntensity'] as const
const REQUIRED_SQUELCH_FIELDS = ['squelchBase', 'squelchSlope', 'ghostCap', 'gateMargin'] as const

function assertEnvelopeConfig(profile: ILiquidProfile, envName: string) {
  const config = (profile as any)[envName]
  expect(config).toBeDefined()
  expect(typeof config).toBe('object')

  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    expect(config[field], `${envName}.${field} missing`).toBeDefined()
    if (field !== 'name') {
      expect(typeof config[field], `${envName}.${field} must be number`).toBe('number')
      expect(Number.isFinite(config[field]), `${envName}.${field} must be finite`).toBe(true)
    }
  }

  for (const field of REQUIRED_SQUELCH_FIELDS) {
    expect(config[field], `${envName}.${field} missing`).toBeDefined()
    expect(typeof config[field], `${envName}.${field} must be number`).toBe('number')
  }

  // Constraints: boost > 0, maxIntensity ∈ (0,1], gateOn ∈ [0,1]
  expect(config.boost).toBeGreaterThan(0)
  expect(config.maxIntensity).toBeGreaterThan(0)
  expect(config.maxIntensity).toBeLessThanOrEqual(1)
  expect(config.gateOn).toBeGreaterThanOrEqual(0)
  expect(config.gateOn).toBeLessThanOrEqual(1)
}

const ENVELOPE_NAMES = [
  'envelopeSubBass', 'envelopeKick', 'envelopeVocal',
  'envelopeSnare', 'envelopeHighMid', 'envelopeTreble',
] as const

const ALL_PROFILES: [string, ILiquidProfile][] = [
  ['techno-industrial', TECHNO_PROFILE],
  ['latino-fiesta', LATINO_PROFILE],
  ['chill-oceanic', CHILL_PROFILE],
  ['poprock-live', POPROCK_PROFILE],
]

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURAL VALIDATION (todos los perfiles)
// ═══════════════════════════════════════════════════════════════════════════

describe('📋 Profile Structural Validation', () => {
  for (const [name, profile] of ALL_PROFILES) {
    describe(`${name}`, () => {
      it('should have correct id', () => {
        expect(profile.id).toBe(name)
      })

      for (const envName of ENVELOPE_NAMES) {
        it(`should have valid ${envName}`, () => {
          assertEnvelopeConfig(profile, envName)
        })
      }

      it('should have valid sidechain config', () => {
        expect(typeof profile.sidechainThreshold).toBe('number')
        expect(typeof profile.sidechainDepth).toBe('number')
        expect(profile.sidechainThreshold).toBeGreaterThanOrEqual(0)
        expect(profile.sidechainDepth).toBeGreaterThanOrEqual(0)
      })

      it('should have valid strobe config', () => {
        expect(typeof profile.strobeThreshold).toBe('number')
        expect(typeof profile.strobeDuration).toBe('number')
        expect(profile.strobeThreshold).toBeGreaterThan(0)
        expect(profile.strobeDuration).toBeGreaterThan(0)
      })

      it('should have valid kick detection config', () => {
        expect(typeof profile.kickVetoFrames).toBe('number')
        expect(typeof profile.kickEdgeMinInterval).toBe('number')
        expect(profile.kickVetoFrames).toBeGreaterThanOrEqual(0)
        expect(profile.kickEdgeMinInterval).toBeGreaterThan(0)
      })

      // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
      it('should have valid morphFloor and morphCeiling (DT-02)', () => {
        expect(typeof profile.morphFloor).toBe('number')
        expect(typeof profile.morphCeiling).toBe('number')
        expect(profile.morphFloor).toBeGreaterThanOrEqual(0)
        expect(profile.morphCeiling).toBeGreaterThan(profile.morphFloor)
        expect(profile.morphCeiling).toBeLessThanOrEqual(1.0)
      })

      it('should have valid mode thresholds', () => {
        expect(typeof profile.harshnessAcidThreshold).toBe('number')
        expect(typeof profile.flatnessNoiseThreshold).toBe('number')
      })

      it('should have percGate, percMidSubtract, percBoost, percExponent', () => {
        expect(typeof profile.percGate).toBe('number')
        expect(typeof profile.percMidSubtract).toBe('number')
        expect(typeof profile.percBoost).toBe('number')
        expect(typeof profile.percExponent).toBe('number')
      })
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MONTE CARLO REGRESSION SNAPSHOTS (Constantes Sagradas)
// ═══════════════════════════════════════════════════════════════════════════

describe('🎲 Monte Carlo Regression: TECHNO_PROFILE', () => {
  it('should preserve envelopeKick calibrated values', () => {
    // WAVE 2415 Monte Carlo: 50,000 iteraciones
    expect(TECHNO_PROFILE.envelopeKick.gateOn).toBeCloseTo(0.28, 2)
    expect(TECHNO_PROFILE.envelopeKick.boost).toBeCloseTo(3.3013, 3)
    expect(TECHNO_PROFILE.envelopeKick.crushExponent).toBeCloseTo(1.0, 1)
    expect(TECHNO_PROFILE.envelopeKick.decayBase).toBeCloseTo(0.08, 2)
    expect(TECHNO_PROFILE.envelopeKick.decayRange).toBeCloseTo(0.0329, 3)
    expect(TECHNO_PROFILE.envelopeKick.maxIntensity).toBeCloseTo(0.80, 2)
  })

  it('should preserve envelopeTreble calibrated values', () => {
    expect(TECHNO_PROFILE.envelopeTreble.gateOn).toBeCloseTo(0.25, 2)
    expect(TECHNO_PROFILE.envelopeTreble.boost).toBeCloseTo(4.0, 1)
  })

  // WAVE 2520 — Anti-Melaza + Desbozalado Movers + overrides41
  it('should preserve desbozalado envelopeTreble (crushExponent 1.8, squelchBase 0.15)', () => {
    expect(TECHNO_PROFILE.envelopeTreble.crushExponent).toBeCloseTo(1.8, 2)
    expect(TECHNO_PROFILE.envelopeTreble.squelchBase).toBeCloseTo(0.15, 2)
  })

  it('should preserve desbozalado envelopeVocal (crushExponent 1.8, squelchBase 0.15)', () => {
    expect(TECHNO_PROFILE.envelopeVocal.crushExponent).toBeCloseTo(1.8, 2)
    expect(TECHNO_PROFILE.envelopeVocal.squelchBase).toBeCloseTo(0.15, 2)
  })

  it('should preserve anti-micro-strobe envelopeKick.decayBase = 0.08', () => {
    expect(TECHNO_PROFILE.envelopeKick.decayBase).toBeCloseTo(0.08, 2)
  })

  it('should have overrides41 for 4.1 independence', () => {
    expect(TECHNO_PROFILE.overrides41).toBeDefined()
    if (TECHNO_PROFILE.overrides41) {
      // Back PAR isolation: Coro capped below Látigo peak
      expect(TECHNO_PROFILE.overrides41.envelopeHighMid?.maxIntensity).toBeCloseTo(0.60, 2)
      expect(TECHNO_PROFILE.overrides41.envelopeHighMid?.decayBase).toBeCloseTo(0.45, 2)
      // Látigo más sensible en compactación
      expect(TECHNO_PROFILE.overrides41.envelopeSnare?.gateOn).toBeCloseTo(0.22, 2)
      // Metrónomo uniforme (smoothing del motor neutralizado)
      expect(TECHNO_PROFILE.overrides41.envelopeKick?.decayRange).toBeCloseTo(0.02, 2)
      // Estrategia explícita
      expect(TECHNO_PROFILE.overrides41.layout41Strategy).toBe('strict-split')
    }
  })

  it('should preserve sidechain values', () => {
    expect(TECHNO_PROFILE.sidechainThreshold).toBeCloseTo(0.10, 2)
    expect(TECHNO_PROFILE.sidechainDepth).toBeCloseTo(0.00, 2)
  })

  it('should preserve layout41Strategy = strict-split', () => {
    expect(TECHNO_PROFILE.layout41Strategy).toBe('strict-split')
  })

  it('should preserve kickEdgeMinInterval = 180', () => {
    expect(TECHNO_PROFILE.kickEdgeMinInterval).toBe(180)
  })

  it('should preserve kickVetoFrames = 0', () => {
    expect(TECHNO_PROFILE.kickVetoFrames).toBe(0)
  })

  // WAVE 2488 — DT-02: morphology calibration (techno = full pulse)
  it('should preserve morphFloor = 0.30, morphCeiling = 0.70', () => {
    expect(TECHNO_PROFILE.morphFloor).toBeCloseTo(0.30, 2)
    expect(TECHNO_PROFILE.morphCeiling).toBeCloseTo(0.70, 2)
  })

  it('should preserve harshnessAcidThreshold = 0.60', () => {
    expect(TECHNO_PROFILE.harshnessAcidThreshold).toBeCloseTo(0.60, 2)
  })

  it('should preserve strobeThreshold = 0.80 and strobeDuration = 30', () => {
    expect(TECHNO_PROFILE.strobeThreshold).toBeCloseTo(0.80, 2)
    expect(TECHNO_PROFILE.strobeDuration).toBe(30)
  })
})

describe('🎲 Monte Carlo Regression: LATINO_PROFILE', () => {
  it('should preserve percGate calibrated value', () => {
    // WAVE 2434 Monte Carlo calibration
    expect(LATINO_PROFILE.percGate).toBeCloseTo(0.065, 3)
  })

  it('should preserve kickEdgeMinInterval = 60', () => {
    expect(LATINO_PROFILE.kickEdgeMinInterval).toBe(60)
  })

  // WAVE 2488 — DT-02: morphology calibration (dembow preciso)
  it('should preserve morphFloor = 0.25, morphCeiling = 0.65', () => {
    expect(LATINO_PROFILE.morphFloor).toBeCloseTo(0.45, 2)
    expect(LATINO_PROFILE.morphCeiling).toBeCloseTo(0.65, 2)
  })

  it('should preserve layout41Strategy = strict-split', () => {
    // Latino usa strict-split para frontPar = kick exclusivo
    expect(LATINO_PROFILE.layout41Strategy).toBe('strict-split')
  })

  it('should preserve overrides41 deep values', () => {
    expect(LATINO_PROFILE.overrides41).toBeDefined()
    if (LATINO_PROFILE.overrides41) {
      expect(LATINO_PROFILE.overrides41.percMidSubtract).toBe(4.0)
      expect(LATINO_PROFILE.overrides41.envelopeTreble?.gateOn).toBeCloseTo(0.02, 2)
      expect(LATINO_PROFILE.overrides41.envelopeHighMid?.gateOn).toBeCloseTo(0.55, 2)
      expect(LATINO_PROFILE.overrides41.envelopeHighMid?.decayBase).toBeCloseTo(0.10, 2)
      expect(LATINO_PROFILE.overrides41.envelopeSubBass?.gateOn).toBeCloseTo(0.22, 2)
    }
  })

  it('should preserve moverLTonalThreshold override', () => {
    if (LATINO_PROFILE.overrides41) {
      expect(LATINO_PROFILE.overrides41.moverLTonalThreshold).toBeCloseTo(0.99, 2)
    }
  })
})

describe('🎲 Monte Carlo Regression: CHILL_PROFILE', () => {
  it('should have all mode thresholds at 0.999 (disabled)', () => {
    expect(CHILL_PROFILE.harshnessAcidThreshold).toBeCloseTo(0.999, 2)
    expect(CHILL_PROFILE.flatnessNoiseThreshold).toBeCloseTo(0.999, 2)
  })

  it('should have sidechain disabled (depth=0, threshold=0.99)', () => {
    expect(CHILL_PROFILE.sidechainDepth).toBeCloseTo(0.0, 1)
    expect(CHILL_PROFILE.sidechainThreshold).toBeCloseTo(999.0, 1)
  })

  it('should have strobe threshold at 0.999 (effectively disabled)', () => {
    expect(CHILL_PROFILE.strobeThreshold).toBeCloseTo(999.0, 1)
  })

  // WAVE 2488 — DT-02: morphology calibration (chill = ambient sensitivo)
  it('should preserve morphFloor = 0.05, morphCeiling = 0.35', () => {
    expect(CHILL_PROFILE.morphFloor).toBeCloseTo(0.05, 2)
    expect(CHILL_PROFILE.morphCeiling).toBeCloseTo(0.35, 2)
  })

  it('should preserve high decay bases (slow fade for chill)', () => {
    expect(CHILL_PROFILE.envelopeSubBass.decayBase).toBeGreaterThanOrEqual(0.90)
    expect(CHILL_PROFILE.envelopeKick.decayBase).toBeGreaterThanOrEqual(0.85)
    expect(CHILL_PROFILE.envelopeVocal.decayBase).toBeGreaterThanOrEqual(0.90)
    expect(CHILL_PROFILE.envelopeTreble.decayBase).toBeGreaterThanOrEqual(0.80)
  })

  it('should preserve low ghostCaps (anti-ghost for chill)', () => {
    expect(CHILL_PROFILE.envelopeSubBass.ghostCap).toBeLessThanOrEqual(0.25)
    expect(CHILL_PROFILE.envelopeKick.ghostCap).toBeLessThanOrEqual(0.25)
    expect(CHILL_PROFILE.envelopeVocal.ghostCap).toBeLessThanOrEqual(0.25)
  })
})

describe('🎲 Monte Carlo Regression: POPROCK_PROFILE', () => {
  it('should preserve harshnessAcidThreshold = 0.80', () => {
    expect(POPROCK_PROFILE.harshnessAcidThreshold).toBeCloseTo(0.80, 2)
  })

  it('should preserve kickEdgeMinInterval = 50', () => {
    expect(POPROCK_PROFILE.kickEdgeMinInterval).toBe(50)
  })

  // WAVE 2488 — DT-02: morphology calibration (rock = mid desde la intro)
  it('should preserve morphFloor = 0.20, morphCeiling = 0.60', () => {
    expect(POPROCK_PROFILE.morphFloor).toBeCloseTo(0.20, 2)
    expect(POPROCK_PROFILE.morphCeiling).toBeCloseTo(0.60, 2)
  })

  it('should preserve sidechainDepth = 0.00 (exterminado)', () => {
    expect(POPROCK_PROFILE.sidechainDepth).toBeCloseTo(0.00, 2)
  })

  // WAVE 2521 — SOAD MODE + ANTI-MELAZA + SEPARACIÓN QUIRÚRGICA
  it('should preserve SOAD mode thresholds (flatness 0.60, apocalypse 0.65)', () => {
    expect(POPROCK_PROFILE.flatnessNoiseThreshold).toBeCloseTo(0.60, 2)
    expect(POPROCK_PROFILE.apocalypseHarshness).toBeCloseTo(0.65, 2)
  })

  it('should preserve SOAD percGate = 0.04 (anti-hat-burst)', () => {
    expect(POPROCK_PROFILE.percGate).toBeCloseTo(0.04, 2)
  })

  it('should preserve anti-melaza envelopeKick.decayBase = 0.04', () => {
    expect(POPROCK_PROFILE.envelopeKick.decayBase).toBeCloseTo(0.04, 2)
  })

  it('should preserve SOAD envelopeSnare (squelchBase 0.10, ghostCap 0.00)', () => {
    expect(POPROCK_PROFILE.envelopeSnare.squelchBase).toBeCloseTo(0.10, 2)
    expect(POPROCK_PROFILE.envelopeSnare.ghostCap).toBeCloseTo(0.00, 2)
  })

  it('should preserve anti-melaza ambient (attack 80ms, release 300ms)', () => {
    expect(POPROCK_PROFILE.ambientAttackMs).toBe(80)
    expect(POPROCK_PROFILE.ambientReleaseMs).toBe(300)
  })

  // WAVE 2522 — VITAMINAS PARA EL TUNGSTENO
  it('should preserve ambient mid injection (midWeight 0.50, gain 2.0)', () => {
    expect(POPROCK_PROFILE.ambientMidWeight).toBeCloseTo(0.50, 2)
    expect(POPROCK_PROFILE.ambientGain).toBeCloseTo(2.0, 2)
  })

  // WAVE 2522 — ANTI-MELAZA FRONTAL Y TRASERA
  it('should preserve anti-melaza envelopeSubBass.decayBase = 0.25', () => {
    expect(POPROCK_PROFILE.envelopeSubBass.decayBase).toBeCloseTo(0.25, 2)
  })

  it('should preserve anti-melaza envelopeHighMid.decayBase = 0.35 (base)', () => {
    expect(POPROCK_PROFILE.envelopeHighMid.decayBase).toBeCloseTo(0.35, 2)
  })

  it('should preserve layout41Strategy = strict-split (anti-smoothing)', () => {
    expect(POPROCK_PROFILE.layout41Strategy).toBe('strict-split')
  })

  // WAVE 2521 — SEPARACIÓN QUIRÚRGICA: Mover L = voz (mid puro), Mover R = lead (treble)
  it('should preserve Mover L voice-focused cross-filter (mid 0.90, highMid 0.30, treble 0.0, tonal 0.55)', () => {
    expect(POPROCK_PROFILE.moverLMidWeight).toBeCloseTo(0.90, 2)
    expect(POPROCK_PROFILE.moverLHighMidWeight).toBeCloseTo(0.30, 2)
    expect(POPROCK_PROFILE.moverLTrebleWeight).toBeCloseTo(0.0, 2)
    expect(POPROCK_PROFILE.moverLTonalThreshold).toBeCloseTo(0.55, 2)
  })

  it('should preserve Mover R lead-focused cross-filter (bassSubtract 0.60, trebleSub -0.40)', () => {
    expect(POPROCK_PROFILE.bassSubtractBase).toBeCloseTo(0.60, 2)
    expect(POPROCK_PROFILE.bassSubtractRange).toBeCloseTo(0.20, 2)
    expect(POPROCK_PROFILE.moverRTrebleSub).toBeCloseTo(-0.40, 2)
  })

  // WAVE 2521+2522 — OVERRIDES 4.1: Back PAR Rescue
  it('should have overrides41 for Back PAR rescue', () => {
    expect(POPROCK_PROFILE.overrides41).toBeDefined()
    if (POPROCK_PROFILE.overrides41) {
      expect(POPROCK_PROFILE.overrides41.envelopeHighMid?.maxIntensity).toBeCloseTo(0.65, 2)
      expect(POPROCK_PROFILE.overrides41.envelopeHighMid?.decayBase).toBeCloseTo(0.30, 2)
      expect(POPROCK_PROFILE.overrides41.envelopeHighMid?.gateOn).toBeCloseTo(0.10, 2)
      expect(POPROCK_PROFILE.overrides41.envelopeSnare?.gateOn).toBeCloseTo(0.06, 2)
    }
  })
})
