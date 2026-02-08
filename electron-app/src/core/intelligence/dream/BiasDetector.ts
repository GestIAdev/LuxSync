/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 500 - PROJECT GENESIS: BIAS DETECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * El PSICOANALISTA de Selene.
 * 
 * "Conócete a ti mismo" - Selene debe detectar sus propios sesgos
 * para evitar caer en patrones repetitivos. Una IA que no se analiza
 * a sí misma está condenada a la monotonía.
 * 
 * Sesgos que detectamos:
 * - Hue Bias: Preferencia excesiva por ciertos colores
 * - Energy Bias: Respuesta predecible a ciertos niveles de energía
 * - Temporal Bias: Patrones temporales repetitivos
 * - Risk Aversion: Miedo excesivo a cambios dramáticos
 * - Strategy Lock: Aferrarse a la misma estrategia de color
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ConsciousnessOutput, ConsciousnessColorDecision } from '../../protocol/ConsciousnessOutput'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de sesgos detectables
 */
export type BiasType =
  | 'hue_preference'       // Preferencia excesiva por ciertos hues
  | 'energy_response'      // Respuesta predecible a energía
  | 'temporal_pattern'     // Patrones temporales repetitivos
  | 'risk_aversion'        // Evitar cambios dramáticos
  | 'strategy_lock'        // Aferrarse a una estrategia
  | 'saturation_habit'     // Siempre usar misma saturación
  | 'change_frequency'     // Cambiar demasiado o muy poco

/**
 * Severidad del sesgo
 */
export type BiasSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Un sesgo detectado
 */
export interface DetectedBias {
  /** Tipo de sesgo */
  type: BiasType
  
  /** Severidad (0-1 normalizado) */
  severity: number
  
  /** Clasificación de severidad */
  severityLevel: BiasSeverity
  
  /** Descripción humana del sesgo */
  description: string
  
  /** Evidencia del sesgo */
  evidence: string
  
  /** Recomendación para corregir */
  recommendation: string
  
  /** Timestamp de detección */
  timestamp: number
}

/**
 * Resultado del análisis de sesgos
 */
export interface BiasAnalysis {
  /** Sesgos detectados */
  biases: DetectedBias[]
  
  /** ¿Hay sesgos críticos? */
  hasCriticalBias: boolean
  
  /** Puntuación de salud cognitiva (0-1, 1 = sin sesgos) */
  cognitiveHealth: number
  
  /** Número de decisiones analizadas */
  sampleSize: number
  
  /** Timestamp del análisis */
  timestamp: number
}

/**
 * Configuración del detector
 */
export interface BiasDetectorConfig {
  /** Tamaño de ventana de decisiones a analizar */
  windowSize: number
  
  /** Umbral para detectar preferencia de hue (0-1) */
  huePreferenceThreshold: number
  
  /** Umbral para detectar aversión al riesgo (0-1) */
  riskAversionThreshold: number
  
  /** Umbral para detectar lock de estrategia (0-1) */
  strategyLockThreshold: number
  
  /** Frecuencia mínima de cambio saludable */
  minHealthyChangeRate: number
  
  /** Frecuencia máxima de cambio saludable */
  maxHealthyChangeRate: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: BiasDetectorConfig = {
  windowSize: 100,              // Últimas 100 decisiones
  huePreferenceThreshold: 0.4,  // Si >40% de decisiones usan mismo rango de hue
  riskAversionThreshold: 0.8,   // Si >80% de decisiones son de bajo riesgo
  strategyLockThreshold: 0.6,   // Si >60% usan misma estrategia
  minHealthyChangeRate: 0.2,    // Al menos 20% de frames con cambios
  maxHealthyChangeRate: 0.7     // No más de 70% de frames con cambios
}

/**
 * Rangos de hue para agrupar preferencias
 * Cada rango representa una "familia" de colores
 */
const HUE_FAMILIES: Array<{ name: string; min: number; max: number }> = [
  { name: 'reds',    min: 0,   max: 30  },
  { name: 'oranges', min: 30,  max: 60  },
  { name: 'yellows', min: 60,  max: 90  },
  { name: 'greens',  min: 90,  max: 150 },
  { name: 'cyans',   min: 150, max: 190 },
  { name: 'blues',   min: 190, max: 250 },
  { name: 'purples', min: 250, max: 290 },
  { name: 'magentas',min: 290, max: 330 },
  { name: 'reds2',   min: 330, max: 360 }
]

// ═══════════════════════════════════════════════════════════════════════════
// STATE - Historial de decisiones
// ═══════════════════════════════════════════════════════════════════════════

interface DecisionRecord {
  timestamp: number
  hue: number | null
  strategy: string | null
  confidence: number
  hadChange: boolean
}

let decisionHistory: DecisionRecord[] = []
let lastAnalysis: BiasAnalysis | null = null
let analysisCount = 0

// ═══════════════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra una decisión para análisis futuro
 */
export function recordDecision(decision: ConsciousnessOutput): void {
  const colorDecision = decision.colorDecision
  
  const record: DecisionRecord = {
    timestamp: decision.timestamp,
    hue: colorDecision?.suggestedHue ?? null,
    strategy: colorDecision?.suggestedStrategy ?? null,
    confidence: decision.confidence,
    hadChange: colorDecision !== null && (
      colorDecision.suggestedHue !== undefined ||
      colorDecision.suggestedStrategy !== undefined ||
      (colorDecision.saturationMod !== undefined && colorDecision.saturationMod !== 1.0) ||
      (colorDecision.brightnessMod !== undefined && colorDecision.brightnessMod !== 1.0)
    )
  }
  
  decisionHistory.push(record)
  
  // Mantener ventana deslizante
  if (decisionHistory.length > DEFAULT_CONFIG.windowSize * 2) {
    decisionHistory = decisionHistory.slice(-DEFAULT_CONFIG.windowSize)
  }
}

/**
 * Analiza el historial en busca de sesgos
 */
export function analyzeBiases(config: Partial<BiasDetectorConfig> = {}): BiasAnalysis {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const biases: DetectedBias[] = []
  const now = Date.now()
  
  // Obtener ventana de análisis
  const window = decisionHistory.slice(-cfg.windowSize)
  
  if (window.length < 10) {
    // No hay suficientes datos
    return {
      biases: [],
      hasCriticalBias: false,
      cognitiveHealth: 1.0,
      sampleSize: window.length,
      timestamp: now
    }
  }
  
  // Detectar cada tipo de sesgo
  const hueBias = detectHuePreference(window, cfg)
  if (hueBias) biases.push(hueBias)
  
  const strategyBias = detectStrategyLock(window, cfg)
  if (strategyBias) biases.push(strategyBias)
  
  const changeRateBias = detectChangeFrequencyBias(window, cfg)
  if (changeRateBias) biases.push(changeRateBias)
  
  const riskBias = detectRiskAversion(window, cfg)
  if (riskBias) biases.push(riskBias)
  
  const temporalBias = detectTemporalPattern(window)
  if (temporalBias) biases.push(temporalBias)
  
  // Calcular salud cognitiva
  const hasCriticalBias = biases.some(b => b.severityLevel === 'critical')
  const totalSeverity = biases.reduce((sum, b) => sum + b.severity, 0)
  const cognitiveHealth = Math.max(0, 1 - (totalSeverity / Math.max(biases.length, 1)))
  
  const analysis: BiasAnalysis = {
    biases,
    hasCriticalBias,
    cognitiveHealth,
    sampleSize: window.length,
    timestamp: now
  }
  
  lastAnalysis = analysis
  analysisCount++
  
  return analysis
}

/**
 * Obtiene los sesgos detectados como strings (para debugInfo)
 */
export function getBiasStrings(): string[] {
  if (!lastAnalysis) return []
  return lastAnalysis.biases.map(b => `${b.type}:${b.severityLevel}`)
}

/**
 * Obtiene último análisis
 */
export function getLastAnalysis(): BiasAnalysis | null {
  return lastAnalysis
}

/**
 * Estadísticas del detector
 */
export function getBiasStats(): { 
  totalDecisionsRecorded: number
  totalAnalyses: number
  lastAnalysis: BiasAnalysis | null 
} {
  return {
    totalDecisionsRecorded: decisionHistory.length,
    totalAnalyses: analysisCount,
    lastAnalysis
  }
}

/**
 * Reset para tests
 */
export function resetBiasDetector(): void {
  decisionHistory = []
  lastAnalysis = null
  analysisCount = 0
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function detectHuePreference(
  window: DecisionRecord[],
  cfg: BiasDetectorConfig
): DetectedBias | null {
  // Contar decisiones con hue por familia
  const familyCounts: Record<string, number> = {}
  let decisionsWithHue = 0
  
  for (const record of window) {
    if (record.hue !== null) {
      decisionsWithHue++
      const family = getHueFamily(record.hue)
      familyCounts[family] = (familyCounts[family] ?? 0) + 1
    }
  }
  
  if (decisionsWithHue < 10) return null
  
  // Encontrar familia dominante
  let maxFamily = ''
  let maxCount = 0
  
  for (const [family, count] of Object.entries(familyCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxFamily = family
    }
  }
  
  const preference = maxCount / decisionsWithHue
  
  if (preference > cfg.huePreferenceThreshold) {
    const severity = (preference - cfg.huePreferenceThreshold) / (1 - cfg.huePreferenceThreshold)
    
    return {
      type: 'hue_preference',
      severity,
      severityLevel: getSeverityLevel(severity),
      description: `Preferencia excesiva por ${maxFamily}`,
      evidence: `${(preference * 100).toFixed(0)}% de decisiones usan hues ${maxFamily}`,
      recommendation: `Explorar más hues fuera de la familia ${maxFamily}`,
      timestamp: Date.now()
    }
  }
  
  return null
}

function detectStrategyLock(
  window: DecisionRecord[],
  cfg: BiasDetectorConfig
): DetectedBias | null {
  const strategyCounts: Record<string, number> = {}
  let decisionsWithStrategy = 0
  
  for (const record of window) {
    if (record.strategy !== null) {
      decisionsWithStrategy++
      strategyCounts[record.strategy] = (strategyCounts[record.strategy] ?? 0) + 1
    }
  }
  
  if (decisionsWithStrategy < 10) return null
  
  let maxStrategy = ''
  let maxCount = 0
  
  for (const [strategy, count] of Object.entries(strategyCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxStrategy = strategy
    }
  }
  
  const lock = maxCount / decisionsWithStrategy
  
  if (lock > cfg.strategyLockThreshold) {
    const severity = (lock - cfg.strategyLockThreshold) / (1 - cfg.strategyLockThreshold)
    
    return {
      type: 'strategy_lock',
      severity,
      severityLevel: getSeverityLevel(severity),
      description: `Aferrado a estrategia "${maxStrategy}"`,
      evidence: `${(lock * 100).toFixed(0)}% de decisiones usan "${maxStrategy}"`,
      recommendation: `Explorar otras estrategias: triadic, complementary, split-complementary`,
      timestamp: Date.now()
    }
  }
  
  return null
}

function detectChangeFrequencyBias(
  window: DecisionRecord[],
  cfg: BiasDetectorConfig
): DetectedBias | null {
  const changesCount = window.filter(r => r.hadChange).length
  const changeRate = changesCount / window.length
  
  if (changeRate < cfg.minHealthyChangeRate) {
    // Muy pocos cambios - estancamiento
    const severity = (cfg.minHealthyChangeRate - changeRate) / cfg.minHealthyChangeRate
    
    return {
      type: 'change_frequency',
      severity,
      severityLevel: getSeverityLevel(severity),
      description: 'Estancamiento visual - muy pocos cambios',
      evidence: `Solo ${(changeRate * 100).toFixed(0)}% de frames tienen cambios (mínimo recomendado: ${(cfg.minHealthyChangeRate * 100).toFixed(0)}%)`,
      recommendation: 'Aumentar la frecuencia de exploración y cambios sutiles',
      timestamp: Date.now()
    }
  }
  
  if (changeRate > cfg.maxHealthyChangeRate) {
    // Demasiados cambios - epiléptico
    const severity = (changeRate - cfg.maxHealthyChangeRate) / (1 - cfg.maxHealthyChangeRate)
    
    return {
      type: 'change_frequency',
      severity,
      severityLevel: getSeverityLevel(severity),
      description: 'Hiperactividad visual - demasiados cambios',
      evidence: `${(changeRate * 100).toFixed(0)}% de frames tienen cambios (máximo recomendado: ${(cfg.maxHealthyChangeRate * 100).toFixed(0)}%)`,
      recommendation: 'Reducir frecuencia de cambios, valorar más la consonancia',
      timestamp: Date.now()
    }
  }
  
  return null
}

function detectRiskAversion(
  window: DecisionRecord[],
  cfg: BiasDetectorConfig
): DetectedBias | null {
  // Medir "riesgo" por magnitud de cambios de hue
  const hueChanges: number[] = []
  let prevHue: number | null = null
  
  for (const record of window) {
    if (record.hue !== null) {
      if (prevHue !== null) {
        const diff = Math.abs(record.hue - prevHue)
        const normalizedDiff = Math.min(diff, 360 - diff) / 180
        hueChanges.push(normalizedDiff)
      }
      prevHue = record.hue
    }
  }
  
  if (hueChanges.length < 10) return null
  
  const avgChange = hueChanges.reduce((a, b) => a + b, 0) / hueChanges.length
  const smallChangeRate = hueChanges.filter(c => c < 0.1).length / hueChanges.length
  
  if (smallChangeRate > cfg.riskAversionThreshold) {
    const severity = (smallChangeRate - cfg.riskAversionThreshold) / (1 - cfg.riskAversionThreshold)
    
    return {
      type: 'risk_aversion',
      severity,
      severityLevel: getSeverityLevel(severity),
      description: 'Aversión al riesgo - cambios siempre pequeños',
      evidence: `${(smallChangeRate * 100).toFixed(0)}% de cambios son menores a 18° (avg: ${(avgChange * 180).toFixed(1)}°)`,
      recommendation: 'Explorar cambios más dramáticos ocasionalmente (triádicos, complementarios)',
      timestamp: Date.now()
    }
  }
  
  return null
}

function detectTemporalPattern(window: DecisionRecord[]): DetectedBias | null {
  // Detectar si hay patrones periódicos en los cambios
  // Usamos autocorrelación simplificada
  
  const changes = window.map(r => r.hadChange ? 1 : 0)
  if (changes.length < 20) return null
  
  // Buscar periodicidad en ventanas de 4, 8, 16 beats
  const periods = [4, 8, 16]
  
  for (const period of periods) {
    let correlation = 0
    let count = 0
    
    for (let i = period; i < changes.length; i++) {
      if (changes[i] === changes[i - period]) {
        correlation++
      }
      count++
    }
    
    const correlationRate = correlation / count
    
    if (correlationRate > 0.85) {
      const severity = (correlationRate - 0.85) / 0.15
      
      return {
        type: 'temporal_pattern',
        severity,
        severityLevel: getSeverityLevel(severity),
        description: `Patrón temporal repetitivo detectado (período ~${period})`,
        evidence: `${(correlationRate * 100).toFixed(0)}% de correlación con período ${period}`,
        recommendation: 'Introducir variabilidad temporal, romper patrones predecibles',
        timestamp: Date.now()
      }
    }
  }
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getHueFamily(hue: number): string {
  for (const family of HUE_FAMILIES) {
    if (hue >= family.min && hue < family.max) {
      return family.name
    }
  }
  return 'reds'  // Fallback para 360
}

function getSeverityLevel(severity: number): BiasSeverity {
  if (severity >= 0.8) return 'critical'
  if (severity >= 0.5) return 'high'
  if (severity >= 0.25) return 'medium'
  return 'low'
}
