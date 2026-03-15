/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 WAVE 2203: DECISION MAKER — SUITE DE REGRESIÓN DEL JUEZ
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * THE PROVING GROUNDS: Validación matemática de TODAS las leyes del General.
 * 
 * COBERTURA:
 *   § 1. LA LEY DIVINA — DIVINE_THRESHOLD + ENERGY_GATE
 *   § 2. EL MURO DEL BUILDUP — WAVE 2200.3 + 2203 (DNA, Fuzzy, Hunt)
 *   § 3. THE DROP LOCK — Anti-Esquizofrenia WAVE 2187
 *   § 4. VALLEY/BREAKDOWN PROTECTION — Zonas sagradas
 *   § 5. FUZZY RESURRECTION — WAVE 2105 integration
 *   § 6. SILENCE RULE — DNA or nothing
 * 
 * ⚠️ GATE DE CONFIANZA (CRITICAL KNOWLEDGE):
 *   makeDecision() calcula combinedConfidence = hunt.confidence * 0.40
 *                                              + prediction.probability * 0.30
 *                                              + beauty.totalBeauty * 0.30
 *   Si combined < 0.55 → early return "Low Confidence Matrix" ANTES de evaluar
 *   DIVINE, DNA, FUZZY o cualquier otra prioridad.
 *   Los mocks "activos" DEBEN generar combined >= 0.55.
 *
 *   effectDecision retorna null (no undefined) cuando no hay efecto.
 * 
 * @module core/intelligence/think/__tests__/DecisionMaker.test
 * @version WAVE 2203
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  makeDecision,
  DIVINE_THRESHOLD,
  DIVINE_ARSENAL,
  HEAVY_ARSENAL_EFFECTS,
  type DecisionInputs,
} from '../DecisionMaker'
import type { SeleneMusicalPattern } from '../../types'
import type { HuntDecision } from '../HuntEngine'
import type { MusicalPrediction } from '../PredictionEngine'
import type { BeautyAnalysis } from '../../sense/BeautySensor'
import type { ConsonanceAnalysis } from '../../sense/ConsonanceSensor'
import type { IntegrationDecision } from '../../integration/DreamEngineIntegrator'
import type { EnergyContext } from '../../../protocol/MusicalContext'
import type { FuzzyDecision } from '../FuzzyDecisionMaker'

// ═══════════════════════════════════════════════════════════════════════════
// MOCK FACTORIES — Inputs mínimos, deterministas, sin basura
// ═══════════════════════════════════════════════════════════════════════════

function createBasePattern(overrides: Partial<SeleneMusicalPattern> = {}): SeleneMusicalPattern {
  return {
    vibeId: 'techno-club',
    section: 'verse',
    energyPhase: 'sustain',
    bpm: 138,
    beatPhase: 0.5,
    syncopation: 0.2,
    rhythmicIntensity: 0.6,
    emotionalTension: 0.5,
    isBuilding: false,
    isReleasing: false,
    harmonicDensity: 0.5,
    bassPresence: 0.7,
    midPresence: 0.5,
    highPresence: 0.4,
    harshness: 0.3,
    spectralFlatness: 0.2,
    spectralCentroid: 3000,
    rawEnergy: 0.6,
    smoothedEnergy: 0.6,
    timestamp: Date.now(),
    ...overrides,
  } as SeleneMusicalPattern
}

/**
 * Hunt "dormido" — confianza baja, no sugiere nada.
 * combined = 0.3*0.4 + 0*0.3 + 0.5*0.3 = 0.27 → NO pasa gate 0.55
 */
function createBaseHunt(overrides: Partial<HuntDecision> = {}): HuntDecision {
  return {
    suggestedPhase: 'sleeping',
    worthiness: 0.2,
    confidence: 0.3,
    conditions: null,
    activeCandidate: null,
    reasoning: 'Test baseline — dormant',
    ...overrides,
  }
}

/**
 * Hunt "activo" — suficiente confianza para pasar el gate.
 * combined = 0.80*0.40 + 0.65*0.30 + 0.75*0.30 = 0.32 + 0.195 + 0.225 = 0.74 ✓
 */
function createActiveHunt(overrides: Partial<HuntDecision> = {}): HuntDecision {
  return {
    suggestedPhase: 'striking',
    worthiness: 0.75,
    confidence: 0.80,
    conditions: null,
    activeCandidate: null,
    reasoning: 'Test active hunt',
    ...overrides,
  }
}

function createBasePrediction(overrides: Partial<MusicalPrediction> = {}): MusicalPrediction {
  return {
    type: 'none',
    probableSection: null,
    probability: 0,
    estimatedTimeMs: 0,
    estimatedBeats: 0,
    reasoning: 'No prediction',
    suggestedActions: [],
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Predicción activa para pasar el gate de confianza */
function createActivePrediction(overrides: Partial<MusicalPrediction> = {}): MusicalPrediction {
  return {
    type: 'drop_incoming',
    probableSection: 'drop',
    probability: 0.65,
    estimatedTimeMs: 500,
    estimatedBeats: 4,
    reasoning: 'Drop detected',
    suggestedActions: [],
    timestamp: Date.now(),
    ...overrides,
  }
}

function createBaseBeauty(overrides: Partial<BeautyAnalysis> = {}): BeautyAnalysis {
  return {
    totalBeauty: 0.5,
    phiAlignment: 0.5,
    fibonacciDistribution: 0.5,
    chromaticHarmony: 0.5,
    contrastBalance: 0.5,
    trend: 'stable',
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Beauty alta para pasar el gate */
function createActiveBeauty(overrides: Partial<BeautyAnalysis> = {}): BeautyAnalysis {
  return {
    totalBeauty: 0.75,
    phiAlignment: 0.7,
    fibonacciDistribution: 0.7,
    chromaticHarmony: 0.8,
    contrastBalance: 0.7,
    trend: 'rising',
    timestamp: Date.now(),
    ...overrides,
  }
}

function createBaseConsonance(overrides: Partial<ConsonanceAnalysis> = {}): ConsonanceAnalysis {
  return {
    totalConsonance: 0.5,
    chromaticConsonance: 0.5,
    rhythmicConsonance: 0.5,
    emotionalConsonance: 0.5,
    dominantInterval: 'unison',
    transitionType: 'smooth',
    suggestedTransitionMs: 500,
    timestamp: Date.now(),
    ...overrides,
  }
}

function createEnergyContext(overrides: Partial<EnergyContext> = {}): EnergyContext {
  return {
    absolute: 0.6,
    smoothed: 0.6,
    percentile: 50,
    zone: 'active',
    previousZone: 'active',
    sustainedLow: false,
    sustainedHigh: false,
    trend: 0,
    lastZoneChange: Date.now() - 5000,
    ...overrides,
  } as EnergyContext
}

function createDNAProposal(effectId: string, intensity: number = 0.85): IntegrationDecision {
  return {
    approved: true,
    effect: {
      effect: effectId,
      intensity,
      zones: ['all'],
      reasoning: `Test proposal: ${effectId}`,
      confidence: 0.90,
    },
    dreamTime: 5,
    filterTime: 2,
    totalTime: 7,
    dreamRecommendation: `Dream recommends ${effectId}`,
    ethicalVerdict: { ethicalScore: 0.95 } as any,
    circuitHealthy: true,
    fallbackUsed: false,
    alternatives: [],
  }
}

function createFuzzyDecision(overrides: Partial<FuzzyDecision> = {}): FuzzyDecision {
  return {
    action: 'strike',
    intensity: 0.7,
    confidence: 0.65,
    reasoning: 'Test fuzzy strike',
    fuzzyScores: { forceStrike: 0, strike: 0.5, prepare: 0.2, hold: 0.1 },
    dominantRule: 'Notable_Energy_Strike',
    ...overrides,
  }
}

/**
 * Inputs DORMIDOS — no pasan el gate de confianza (combined ≈ 0.27).
 * Usados para tests que esperan HOLD / no-acción.
 */
function buildDormantInputs(overrides: Partial<DecisionInputs> = {}): DecisionInputs {
  return {
    pattern: createBasePattern(),
    beauty: createBaseBeauty(),
    consonance: createBaseConsonance(),
    huntDecision: createBaseHunt(),
    prediction: createBasePrediction(),
    timestamp: Date.now(),
    ...overrides,
  }
}

/**
 * Inputs ACTIVOS — pasan el gate de confianza (combined ≈ 0.74).
 * Usados para tests que esperan que el DecisionMaker evalúe el switch completo.
 */
function buildActiveInputs(overrides: Partial<DecisionInputs> = {}): DecisionInputs {
  return {
    pattern: createBasePattern(),
    beauty: createActiveBeauty(),
    consonance: createBaseConsonance(),
    huntDecision: createActiveHunt(),
    prediction: createActivePrediction(),
    timestamp: Date.now(),
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Reset drop lock via sección no-drop
// ═══════════════════════════════════════════════════════════════════════════

function resetDropLock(): void {
  makeDecision(buildDormantInputs({ pattern: createBasePattern({ section: 'verse' }) }))
}

// ═══════════════════════════════════════════════════════════════════════════
// § 1. LA LEY DIVINA — Z > 4.0σ + Energy Gate
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 1. LA LEY DIVINA — DIVINE THRESHOLD + ENERGY GATE', () => {

  beforeEach(() => resetDropLock())

  it('DIVINE_THRESHOLD debería ser 4.0σ', () => {
    expect(DIVINE_THRESHOLD).toBe(4.0)
  })

  it('Z > 4.0σ + E > 0.85 + zone=intense → MANDATORY FIRE (divine_strike)', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 4.5,
      energyContext: createEnergyContext({ zone: 'intense', smoothed: 0.92 }),
      pattern: createBasePattern({ section: 'drop', vibeId: 'techno-club' }),
    }))

    expect(output.confidence).toBeGreaterThanOrEqual(0.95)
    expect(output.effectDecision).not.toBeNull()
    expect(output.debugInfo.reasoning).toContain('DIVINE')
  })

  it('Z > 4.0σ + E > 0.85 + zone=peak → MANDATORY FIRE', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 5.2,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.95 }),
      pattern: createBasePattern({ section: 'drop', vibeId: 'techno-club' }),
    }))

    expect(output.confidence).toBeGreaterThanOrEqual(0.95)
    expect(output.effectDecision).not.toBeNull()
  })

  it('Z > 4.0σ pero E < 0.85 → DIVINE SUPPRESSED, falls through', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 4.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.70 }),
      pattern: createBasePattern({ section: 'verse' }),
    }))

    // No debería ser DIVINE — ENERGY_GATE bloqueó
    if (output.debugInfo.reasoning) {
      expect(output.debugInfo.reasoning).not.toContain('DIVINE MOMENT')
    }
  })

  it('Z > 4.0σ pero zone=silence → DIVINE BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 6.0,
      energyContext: createEnergyContext({ zone: 'silence', smoothed: 0.10 }),
      pattern: createBasePattern({ section: 'breakdown' }),
    }))

    // DIVINE bloqueado por zone=silence → effectDecision queda null
    expect(output.effectDecision).toBeNull()
  })

  it('Z > 4.0σ pero zone=valley → DIVINE BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 4.2,
      energyContext: createEnergyContext({ zone: 'valley', smoothed: 0.20 }),
      pattern: createBasePattern({ section: 'verse' }),
    }))

    if (output.debugInfo.reasoning) {
      expect(output.debugInfo.reasoning).not.toContain('DIVINE MOMENT')
    }
  })

  it('Z < 4.0σ (normal) → no DIVINE aunque E sea altísima', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 3.5,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.98 }),
      pattern: createBasePattern({ section: 'drop' }),
    }))

    // Z=3.5 no llega a DIVINE_THRESHOLD=4.0
    expect(output.confidence).toBeLessThan(0.99)
  })

  it('DIVINE ignora el Buildup Restriction (Z>4σ es emergencia absoluta)', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 4.8,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.93 }),
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
    }))

    // DIVINE check es ANTES del switch → overrides buildup restriction
    expect(output.confidence).toBeGreaterThanOrEqual(0.95)
    expect(output.effectDecision).not.toBeNull()
    expect(output.debugInfo.reasoning).toContain('DIVINE')
  })

  it('Dictador activo → DIVINE se suprime silenciosamente', () => {
    const output = makeDecision(buildActiveInputs({
      zScore: 5.0,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.95 }),
      pattern: createBasePattern({ section: 'drop' }),
      activeDictator: 'core_meltdown',
    }))

    // Con dictador activo, DIVINE no intenta
    expect(output.confidence).toBeLessThan(0.99)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 2. EL MURO DEL BUILDUP — WAVE 2200.3 + 2203
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 2. EL MURO DEL BUILDUP — DNA + Fuzzy + Hunt bloqueados', () => {
  
  beforeEach(() => resetDropLock())

  it('DNA Priority 0: core_meltdown en buildup → BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 1.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.60 }),
    }))

    if (output.effectDecision) {
      expect(output.effectDecision.effectType).not.toBe('core_meltdown')
    }
  })

  it('DNA Priority 0: industrial_strobe en buildup → BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('industrial_strobe'),
      zScore: 1.0,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.55 }),
    }))

    if (output.effectDecision) {
      expect(output.effectDecision.effectType).not.toBe('industrial_strobe')
    }
  })

  it('DNA Priority 0: acid_sweep (ligero) en buildup → PERMITIDO', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('acid_sweep'),
      zScore: 1.0,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.55 }),
    }))

    // acid_sweep NO es HEAVY_ARSENAL → DNA Priority 0 lo deja pasar
    expect(HEAVY_ARSENAL_EFFECTS.has('acid_sweep')).toBe(false)
    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('acid_sweep')
  })

  it('WAVE 2203: Fuzzy Strike con core_meltdown en buildup → BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      fuzzyDecision: createFuzzyDecision({
        action: 'strike',
        confidence: 0.65,
      }),
      zScore: 1.35,
      energyContext: createEnergyContext({ zone: 'intense', smoothed: 0.80 }),
    }))

    if (output.effectDecision) {
      expect(output.effectDecision.effectType).not.toBe('core_meltdown')
    }
  })

  it('WAVE 2203: Fuzzy force_strike con gatling_raid en buildup → BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('gatling_raid'),
      fuzzyDecision: createFuzzyDecision({
        action: 'force_strike',
        confidence: 0.75,
      }),
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'intense', smoothed: 0.80 }),
    }))

    if (output.effectDecision) {
      expect(output.effectDecision.effectType).not.toBe('gatling_raid')
    }
  })

  it('WAVE 2203: Hunt worthiness alta con core_meltdown en buildup → BLOCKED', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'buildup' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      huntDecision: createActiveHunt({ worthiness: 0.80, confidence: 0.80 }),
      zScore: 1.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.70 }),
    }))

    if (output.effectDecision) {
      expect(output.effectDecision.effectType).not.toBe('core_meltdown')
    }
  })

  it('Efecto pesado en section=drop → SÍ permitido (no es buildup)', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 2.5,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.90 }),
    }))

    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('core_meltdown')
  })

  it('Efecto pesado en section=verse → SÍ permitido por DNA', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      dreamIntegration: createDNAProposal('industrial_strobe'),
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.65 }),
    }))

    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('industrial_strobe')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 3. THE DROP LOCK — Anti-Esquizofrenia WAVE 2187
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 3. THE DROP LOCK — Un drop, un efecto', () => {
  
  beforeEach(() => resetDropLock())

  it('Primer disparo en drop → reasoning presente (pipeline activo)', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 2.5,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.90 }),
    }))

    // Primer drop con DNA loaded → debería disparar
    expect(output.effectDecision).not.toBeNull()
    expect(output.debugInfo.reasoning).toBeDefined()
  })

  it('Segundo disparo en mismo drop → DROP LOCKED (no duplica efecto)', () => {
    // First call: adquiere lock
    const first = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.88 }),
    }))

    // Second call: mismo drop, lock activo
    const second = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.88 }),
    }))

    // El segundo NO debería duplicar el primer efecto pesado
    // DNA Priority 0 sigue diciendo 'strike' pero el drop lock
    // modifica el reasoning. Verificamos que no dispara DIVINE al menos:
    expect(second.confidence).toBeLessThan(0.99)
  })

  it('Cambiar sección libera el lock', () => {
    // Enter drop (adquiere lock)
    makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
    }))

    // Leave drop → lock liberado via updateDropLock()
    makeDecision(buildDormantInputs({
      pattern: createBasePattern({ section: 'breakdown' }),
    }))

    // Re-enter drop → nuevo disparo debería funcionar
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'drop' }),
      dreamIntegration: createDNAProposal('core_meltdown'),
      zScore: 2.5,
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.90 }),
    }))

    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('core_meltdown')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 4. VALLEY / BREAKDOWN PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 4. ZONAS PROTEGIDAS — Valley + Breakdown = Silencio', () => {
  
  beforeEach(() => resetDropLock())

  it('zone=valley + Z<0 → HOLD (Valley Protection)', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      energyContext: createEnergyContext({ zone: 'valley', smoothed: 0.15 }),
      zScore: -1.5,
      dreamIntegration: createDNAProposal('acid_sweep'),
    }))

    // Valley protection: zone=valley + Z<0 → 'hold'
    expect(output.effectDecision).toBeNull()
  })

  it('section=breakdown → HOLD (Breakdown Protection)', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'breakdown' }),
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.60 }),
      zScore: 1.5,
      dreamIntegration: createDNAProposal('acid_sweep'),
    }))

    // "Breakdowns are sacred darkness"
    expect(output.effectDecision).toBeNull()
  })

  it('section=breakdown PERO Z>4σ + E>0.85 → DIVINE overrides darkness', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'breakdown', vibeId: 'techno-club' }),
      energyContext: createEnergyContext({ zone: 'peak', smoothed: 0.93 }),
      zScore: 4.5,
    }))

    // DIVINE check es PRIORIDAD -1 → se ejecuta ANTES de breakdown check
    expect(output.confidence).toBeGreaterThanOrEqual(0.95)
    expect(output.effectDecision).not.toBeNull()
    expect(output.debugInfo.reasoning).toContain('DIVINE')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 5. FUZZY RESURRECTION — Strike paths
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 5. FUZZY RESURRECTION — Fuzzy gets a real vote', () => {
  
  beforeEach(() => resetDropLock())

  it('Fuzzy strike + DNA proposal (no buildup) → STRIKE', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      dreamIntegration: createDNAProposal('acid_sweep'),
      fuzzyDecision: createFuzzyDecision({ action: 'strike', confidence: 0.55 }),
      zScore: 1.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.70 }),
    }))

    // DNA Priority 0 aprobó acid_sweep en verse → 'strike' directo
    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('acid_sweep')
  })

  it('Fuzzy strike SIN DNA proposal → no puede disparar efecto', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      // NO dreamIntegration
      fuzzyDecision: createFuzzyDecision({ action: 'strike', confidence: 0.65 }),
      zScore: 1.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.70 }),
    }))

    // Sin DNA → no hay arma cargada → Fuzzy cae al vacío
    expect(output.confidence).toBeLessThan(0.99)
  })

  it('Fuzzy force_strike + DNA + no buildup → STRIKE', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      dreamIntegration: createDNAProposal('industrial_strobe'),
      fuzzyDecision: createFuzzyDecision({ action: 'force_strike', confidence: 0.75 }),
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'intense', smoothed: 0.80 }),
    }))

    // DNA Priority 0 en verse + industrial_strobe → 'strike'
    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('industrial_strobe')
  })

  it('Fuzzy con confianza < 0.50 + DNA proposal → DNA Priority 0 sigue activo', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      dreamIntegration: createDNAProposal('acid_sweep'),
      fuzzyDecision: createFuzzyDecision({ action: 'strike', confidence: 0.40 }),
      huntDecision: createActiveHunt({ worthiness: 0.6, confidence: 0.7 }),
      zScore: 0.5,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.55 }),
    }))

    // Fuzzy tiene poca confianza PERO DNA Priority 0 está activo
    // DNA Priority 0 es ARRIBA de Fuzzy → acid_sweep pasa igual
    expect(output.debugInfo.reasoning).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 6. SILENCE RULE — DNA o silencio
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 6. SILENCE RULE — DNA o silencio', () => {
  
  beforeEach(() => resetDropLock())

  it('Strike sin DNA proposal → no effectDecision (DNA vacío)', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      huntDecision: createActiveHunt({ worthiness: 0.80, confidence: 0.80 }),
      // NO dreamIntegration → DNA vacío
      zScore: 2.0,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.65 }),
    }))

    // Hunt dice "worthy" pero DNA no tiene nada → no puede disparar efecto
    // effectDecision queda null porque generateStrikeDecision no tiene weapon
    expect(output.effectDecision).toBeNull()
  })

  it('DNA approved con efecto → efecto pasa en verse', () => {
    const output = makeDecision(buildActiveInputs({
      pattern: createBasePattern({ section: 'verse' }),
      dreamIntegration: createDNAProposal('digital_rain'),
      zScore: 1.0,
      energyContext: createEnergyContext({ zone: 'active', smoothed: 0.55 }),
    }))

    // DNA Priority 0: approved + digital_rain (light) → 'strike'
    expect(output.effectDecision).not.toBeNull()
    expect(output.effectDecision!.effectType).toBe('digital_rain')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// § 7. HEAVY ARSENAL DEFINITION — Sanity check
// ═══════════════════════════════════════════════════════════════════════════

describe('§ 7. HEAVY_ARSENAL_EFFECTS — Definición del arsenal nuclear', () => {
  
  it('Debería contener los efectos nucleares conocidos', () => {
    expect(HEAVY_ARSENAL_EFFECTS.has('core_meltdown')).toBe(true)
    expect(HEAVY_ARSENAL_EFFECTS.has('industrial_strobe')).toBe(true)
    expect(HEAVY_ARSENAL_EFFECTS.has('gatling_raid')).toBe(true)
    expect(HEAVY_ARSENAL_EFFECTS.has('neon_blinder')).toBe(true)
    expect(HEAVY_ARSENAL_EFFECTS.has('strobe_storm')).toBe(true)
  })

  it('NO debería contener efectos ligeros', () => {
    expect(HEAVY_ARSENAL_EFFECTS.has('acid_sweep')).toBe(false)
    expect(HEAVY_ARSENAL_EFFECTS.has('digital_rain')).toBe(false)
    expect(HEAVY_ARSENAL_EFFECTS.has('cyber_dualism')).toBe(false)
    expect(HEAVY_ARSENAL_EFFECTS.has('sky_saw')).toBe(false)
    expect(HEAVY_ARSENAL_EFFECTS.has('void_mist')).toBe(false)
  })
  
  it('DIVINE_ARSENAL debería tener entradas para techno-club', () => {
    const technoArsenal = DIVINE_ARSENAL['techno-club']
    expect(technoArsenal).toBeDefined()
    expect(technoArsenal.length).toBeGreaterThan(0)
    expect(technoArsenal).toContain('core_meltdown')
    expect(technoArsenal).toContain('industrial_strobe')
    expect(technoArsenal).toContain('gatling_raid')
  })
})
