/**
 * ⚡ WAVE 668: DROP BRIDGE - El Puente del Trueno
 * ═══════════════════════════════════════════════════════════════════════════
 * "Cuando el universo se alinea, disparamos sin preguntar"
 * 
 * Esta es la CONDICIÓN DIVINA - un override de máxima prioridad que
 * cortocircuita toda la lógica fuzzy cuando el momento es ÉPICO.
 * 
 * CONDICIÓN:
 *   (energyZScore >= 3.0σ) AND (section ∈ {drop, chorus}) AND (energy >= 0.75)
 *   ⟹ FORCE_STRIKE con intensidad máxima
 * 
 * JUSTIFICACIÓN ESTADÍSTICA:
 * - Z-Score >= 3.0 significa que estamos a 3 desviaciones estándar del promedio
 * - Esto ocurre solo en el 0.15% de los frames (~2.7 por cada 1800 frames)
 * - Cuando coincide con un drop/chorus, es EL MOMENTO
 * 
 * ANATOMÍA DEL DROP:
 * 
 *   Energía
 *     │
 *   1.0│        ╱─────╲      ← Drop Zone (z > 3)
 *     │       ╱       ╲
 *   0.8│     ╱         ╲
 *     │    ╱           ╲
 *   0.6│   │ BUILDUP    │ RELEASE
 *     │   │             │
 *   0.4│──╱             ╲──
 *     │
 *     └──────────────────────→ Tiempo
 *         ↑
 *    Drop Bridge Fires Here
 * 
 * @module core/intelligence/think/DropBridge
 * @wave 668
 */

import type { SectionType } from '@/engine/types'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input para evaluar el Drop Bridge
 */
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
}

/**
 * Resultado de la evaluación del Drop Bridge
 */
export interface DropBridgeResult {
  /** ¿Debe activarse el force strike? */
  shouldForceStrike: boolean
  /** Intensidad del force strike (0.85-1.0) */
  intensity: number
  /** Razón legible */
  reason: string
  /** Nivel de alerta: none, watching, imminent, ACTIVATED */
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

/**
 * Configuración del Drop Bridge (tuneable)
 */
export interface DropBridgeConfig {
  /** Z-Score mínimo para activar (default: 3.0) */
  zScoreThreshold: number
  /** Secciones que califican como "peak" */
  peakSections: SectionType[]
  /** Energía mínima requerida (default: 0.75) */
  minEnergy: number
  /** ¿Requerir presencia de kick? (default: false) */
  requireKick: boolean
  /** Z-Score para nivel "watching" (default: 2.0) */
  watchingThreshold: number
  /** Z-Score para nivel "imminent" (default: 2.5) */
  imminentThreshold: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

/** Configuración por defecto del Drop Bridge */
const DEFAULT_CONFIG: DropBridgeConfig = {
  zScoreThreshold: 3.0,        // 3 sigma = 99.85 percentil
  peakSections: ['drop', 'chorus'],
  minEnergy: 0.75,
  requireKick: false,          // Kick es bonus, no requerido
  watchingThreshold: 2.0,      // Empezamos a prestar atención
  imminentThreshold: 2.5,      // Algo gordo viene
}

// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌩️ EVALUAR DROP BRIDGE
 * 
 * Verifica si el momento actual califica para un override divino.
 * 
 * @param input - Estado actual
 * @param config - Configuración opcional
 * @returns Resultado con decisión y métricas
 */
export function checkDropBridge(
  input: DropBridgeInput,
  config: Partial<DropBridgeConfig> = {}
): DropBridgeResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const { energyZScore, sectionType, rawEnergy, hasKick } = input
  
  // === EVALUAR CONDICIONES ===
  const conditionsMet: string[] = []
  
  // Condición 1: Z-Score épico
  const isEpicZScore = energyZScore >= cfg.zScoreThreshold
  if (isEpicZScore) {
    conditionsMet.push(`z=${energyZScore.toFixed(2)}≥${cfg.zScoreThreshold}`)
  }
  
  // Condición 2: Sección peak
  const isPeakSection = cfg.peakSections.includes(sectionType)
  if (isPeakSection) {
    conditionsMet.push(`section=${sectionType}∈peak`)
  }
  
  // Condición 3: Energía mínima
  const hasMinEnergy = rawEnergy >= cfg.minEnergy
  if (hasMinEnergy) {
    conditionsMet.push(`E=${rawEnergy.toFixed(2)}≥${cfg.minEnergy}`)
  }
  
  // Condición 4 (opcional): Kick presente
  const kickCondition = !cfg.requireKick || hasKick
  if (hasKick) {
    conditionsMet.push('KICK')
  }
  
  // === DECISIÓN DIVINA ===
  const shouldForceStrike = isEpicZScore && isPeakSection && hasMinEnergy && kickCondition
  
  // === CALCULAR INTENSIDAD ===
  // Base: 0.85, escala con z-score hasta 1.0
  // z=3.0 → 0.85, z=3.5 → 0.925, z=4.0 → 1.0
  let intensity = 0
  if (shouldForceStrike) {
    const zExcess = energyZScore - cfg.zScoreThreshold
    intensity = Math.min(1.0, 0.85 + zExcess * 0.15)
    
    // Bonus por kick detectado
    if (hasKick) {
      intensity = Math.min(1.0, intensity + 0.05)
    }
    
    // Bonus por harshness alta (synth agresivo)
    if (input.harshness && input.harshness > 0.7) {
      intensity = Math.min(1.0, intensity + 0.03)
    }
  }
  
  // === DETERMINAR NIVEL DE ALERTA ===
  const alertLevel = determineAlertLevel(energyZScore, cfg, shouldForceStrike)
  
  // === GENERAR RAZÓN ===
  const reason = generateReason(shouldForceStrike, conditionsMet, energyZScore, sectionType, cfg)
  
  return {
    shouldForceStrike,
    intensity,
    reason,
    alertLevel,
    metrics: {
      zScore: energyZScore,
      section: sectionType,
      energy: rawEnergy,
      threshold: cfg.zScoreThreshold,
      conditionsMet,
    },
  }
}

/**
 * Determina el nivel de alerta basado en el Z-Score
 */
function determineAlertLevel(
  zScore: number,
  cfg: DropBridgeConfig,
  activated: boolean
): DropBridgeResult['alertLevel'] {
  if (activated) return 'activated'
  if (zScore >= cfg.imminentThreshold) return 'imminent'
  if (zScore >= cfg.watchingThreshold) return 'watching'
  return 'none'
}

/**
 * Genera una razón legible para la decisión
 */
function generateReason(
  shouldFire: boolean,
  conditionsMet: string[],
  zScore: number,
  section: SectionType,
  cfg: DropBridgeConfig
): string {
  if (shouldFire) {
    return `🌩️ DROP BRIDGE ACTIVATED: ${conditionsMet.join(' + ')} → FORCE_STRIKE`
  }
  
  const missing: string[] = []
  if (zScore < cfg.zScoreThreshold) {
    missing.push(`z=${zScore.toFixed(2)}<${cfg.zScoreThreshold}`)
  }
  if (!cfg.peakSections.includes(section)) {
    missing.push(`section=${section}∉peak`)
  }
  
  if (missing.length === 0) {
    return `Drop Bridge: Conditions partially met [${conditionsMet.join(', ')}]`
  }
  
  return `Drop Bridge INACTIVE: Missing ${missing.join(', ')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌩️ DropBridge Class
 * 
 * Wrapper con estado para tracking histórico y cooldown
 */
export class DropBridge {
  private config: DropBridgeConfig
  private lastActivation: number = 0
  private consecutiveHighZScores: number = 0
  private readonly COOLDOWN_MS = 2000 // 2 segundos entre activaciones
  private readonly HIGH_Z_PERSISTENCE = 3 // Frames consecutivos con z alto
  
  constructor(config: Partial<DropBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * Evalúa si debe activarse el Drop Bridge
   */
  check(input: DropBridgeInput): DropBridgeResult {
    const now = Date.now()
    
    // Track z-scores altos consecutivos
    if (input.energyZScore >= this.config.imminentThreshold) {
      this.consecutiveHighZScores++
    } else {
      this.consecutiveHighZScores = 0
    }
    
    // Evaluación base
    const result = checkDropBridge(input, this.config)
    
    // Aplicar cooldown
    if (result.shouldForceStrike) {
      const timeSinceLastActivation = now - this.lastActivation
      
      if (timeSinceLastActivation < this.COOLDOWN_MS) {
        // Cooldown activo - suprimir activación
        return {
          ...result,
          shouldForceStrike: false,
          alertLevel: 'imminent',
          reason: `${result.reason} [COOLDOWN ${(this.COOLDOWN_MS - timeSinceLastActivation) / 1000}s remaining]`,
        }
      }
      
      // Activación válida
      this.lastActivation = now
    }
    
    return result
  }
  
  /**
   * Obtiene el número de frames consecutivos con z-score alto
   */
  getConsecutiveHighZScores(): number {
    return this.consecutiveHighZScores
  }
  
  /**
   * ¿Está el sistema en alerta alta? (Múltiples frames con z alto)
   */
  isHighAlert(): boolean {
    return this.consecutiveHighZScores >= this.HIGH_Z_PERSISTENCE
  }
  
  /**
   * Tiempo desde la última activación en ms
   */
  getTimeSinceLastActivation(): number {
    return Date.now() - this.lastActivation
  }
  
  /**
   * Reset del estado (cambio de canción)
   */
  reset(): void {
    this.lastActivation = 0
    this.consecutiveHighZScores = 0
  }
  
  /**
   * Actualiza la configuración
   */
  updateConfig(config: Partial<DropBridgeConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📊 Calcula la probabilidad estadística de un Z-Score
 * (Para documentación y debug)
 */
export function zScoreToProbability(zScore: number): number {
  // Aproximación de la CDF normal estándar
  // Usando la función de error (erf)
  const absZ = Math.abs(zScore)
  
  // Aproximación de Abramowitz and Stegun
  const a1 =  0.254829592
  const a2 = -0.284496736
  const a3 =  1.421413741
  const a4 = -1.453152027
  const a5 =  1.061405429
  const p  =  0.3275911
  
  const t = 1.0 / (1.0 + p * absZ / Math.sqrt(2))
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2)
  
  // CDF
  const cdf = 0.5 * (1 + (zScore >= 0 ? erf : -erf))
  
  // Probabilidad de ser >= zScore (cola derecha)
  return 1 - cdf
}

/**
 * Descripción legible de la rareza de un Z-Score
 */
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
