/**
 * ⚡ DROP BRIDGE — V3 PHASE 3.3.B: ROUTING ONLY
 * ═══════════════════════════════════════════════════════════════════════════
 * V3.3.B: Static threshold checks extirpated. V3 Liquid Cognition's
 * `epicness` and `T(t)` handle drop gating natively. This module
 * now only provides arsenal routing: if V3 dictates a massive drop,
 * the pipeline selects from Divine or Heavy arsenal.
 *
 * @module core/intelligence/think/DropBridge
 */

import type { SectionType } from '../../../engine/types'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export interface DropBridgeInput {
  /** Z-Score de energía (-4 a +4 típicamente) */
  energyZScore: number
  /** Tipo de sección actual */
  sectionType: SectionType
  /** Energía raw normalizada (0-1) */
  rawEnergy: number
  /** ¿Se detectó un kick en este frame? */
  hasKick: boolean
  /** ¿Se detectó un snare en este frame? */
  hasSnare?: boolean
  /** Harshness espectral opcional (0-1) */
  harshness?: number
  /** Vibe actual para consciencia de género */
  vibeId?: string
}

/**
 * Resultado del Drop Bridge — V3.3.B: Routing telemetry only.
 * shouldForceStrike is always false; V3 ignite is the sole authority.
 */
export interface DropBridgeResult {
  /** V3.3.B: Always false — V3 ignite is the sole firing authority */
  shouldForceStrike: boolean
  /** Intensidad derivada del epicness (0-1) */
  intensity: number
  /** Razón legible */
  reason: string
  /** Nivel de alerta: none, watching, imminent, activated */
  alertLevel: 'none' | 'watching' | 'imminent' | 'activated'
  /** Métricas para debug */
  metrics: {
    zScore: number
    section: SectionType
    energy: number
    threshold: number
    conditionsMet: string[]
  }
}

export interface DropBridgeConfig {
  /** Secciones que califican como "peak" for arsenal routing */
  peakSections: SectionType[]
  /** Z-Score para nivel "watching" (telemetry) */
  watchingThreshold: number
  /** Z-Score para nivel "imminent" (telemetry) */
  imminentThreshold: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: DropBridgeConfig = {
  peakSections: ['drop', 'chorus'],
  watchingThreshold: 2.0,
  imminentThreshold: 2.5,
}

// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL — V3.3.B: Routing only, no threshold gating
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V3.3.B: Evaluúa el estado para telemetría y routing de arsenal.
 * No gatea el disparo — V3 Liquid Cognition decide eso.
 */
export function checkDropBridge(
  input: DropBridgeInput,
  config: Partial<DropBridgeConfig> = {}
): DropBridgeResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const { energyZScore, sectionType, rawEnergy } = input

  const isPeakSection = cfg.peakSections.includes(sectionType)
  const conditionsMet: string[] = []

  if (isPeakSection) {
    conditionsMet.push(`section=${sectionType}∈peak`)
  }
  if (input.hasKick) {
    conditionsMet.push('KICK')
  }

  // V3.3.B: shouldForceStrike is always false — V3 ignite is the authority
  const shouldForceStrike = false

  // Intensity derived from z-score for routing (not gating)
  const intensity = isPeakSection
    ? Math.min(1.0, Math.max(0, (energyZScore - 1) / 3))
    : 0

  const alertLevel = determineAlertLevel(energyZScore, cfg)
  const reason = generateReason(isPeakSection, conditionsMet, energyZScore, sectionType, cfg)

  return {
    shouldForceStrike,
    intensity,
    reason,
    alertLevel,
    metrics: {
      zScore: energyZScore,
      section: sectionType,
      energy: rawEnergy,
      threshold: cfg.imminentThreshold,
      conditionsMet,
    },
  }
}

function determineAlertLevel(
  zScore: number,
  cfg: DropBridgeConfig,
): DropBridgeResult['alertLevel'] {
  if (zScore >= cfg.imminentThreshold) return 'imminent'
  if (zScore >= cfg.watchingThreshold) return 'watching'
  return 'none'
}

function generateReason(
  isPeakSection: boolean,
  conditionsMet: string[],
  zScore: number,
  section: SectionType,
  cfg: DropBridgeConfig,
): string {
  if (isPeakSection && zScore >= cfg.imminentThreshold) {
    return `Drop Bridge ROUTING: ${conditionsMet.join(' + ')} → Divine/Heavy arsenal eligible`
  }
  return `Drop Bridge STANDBY: section=${section}, z=${zScore.toFixed(2)}σ`
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

export class DropBridge {
  private config: DropBridgeConfig
  private consecutiveHighZScores: number = 0
  private readonly HIGH_Z_PERSISTENCE = 3

  constructor(config: Partial<DropBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  check(input: DropBridgeInput): DropBridgeResult {
    if (input.energyZScore >= this.config.imminentThreshold) {
      this.consecutiveHighZScores++
    } else {
      this.consecutiveHighZScores = 0
    }
    return checkDropBridge(input, this.config)
  }

  getConsecutiveHighZScores(): number {
    return this.consecutiveHighZScores
  }

  isHighAlert(): boolean {
    return this.consecutiveHighZScores >= this.HIGH_Z_PERSISTENCE
  }

  getTimeSinceLastActivation(): number {
    return 0
  }

  reset(): void {
    this.consecutiveHighZScores = 0
  }

  updateConfig(config: Partial<DropBridgeConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

export function zScoreToProbability(zScore: number): number {
  const absZ = Math.abs(zScore)
  const a1 =  0.254829592
  const a2 = -0.284496736
  const a3 =  1.421413741
  const a4 = -1.453152027
  const a5 =  1.061405429
  const p  =  0.3275911
  const t = 1.0 / (1.0 + p * absZ / Math.sqrt(2))
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2)
  const cdf = 0.5 * (1 + (zScore >= 0 ? erf : -erf))
  return 1 - cdf
}

export function describeZScore(zScore: number): string {
  const absZ = Math.abs(zScore)
  if (absZ < 1.0) return 'Normal (68%)'
  if (absZ < 1.5) return 'Ligeramente inusual'
  if (absZ < 2.0) return 'Inusual (5%)'
  if (absZ < 2.5) return 'Notable (2.5%)'
  if (absZ < 3.0) return 'Muy raro (1%)'
  if (absZ < 3.5) return '🔥 EXTREMO (0.3%)'
  return '⚡ ÉPICO (0.05%)'
}
