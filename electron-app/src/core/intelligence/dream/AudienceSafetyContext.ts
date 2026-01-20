/**
 * 🛡️ AUDIENCE SAFETY CONTEXT
 * "El contexto de seguridad y estado que alimenta las decisiones éticas"
 * 
 * WAVE 900.1 - Phase 1: Foundation
 * 
 * @module AudienceSafetyContext
 * @description Estructura de datos completa que describe el estado actual
 *              del sistema, audiencia, hardware y contexto musical para 
 *              decisiones éticas de efectos visuales.
 * 
 * RESPONSABILIDADES:
 * - Agregar estado de audiencia (tamaño, fatiga visual, epilepsia)
 * - Agregar estado de hardware (GPU load, luminosidad ambiente)
 * - Agregar contexto musical (vibe, energía, timestamp)
 * - Agregar historial de efectos recientes
 * - Agregar cooldowns activos
 * - Agregar insights del DreamEngine (warnings, bias reports)
 * 
 * FILOSOFÍA:
 * "No puedes tomar decisiones éticas sin conocer el contexto completo."
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */

import type { EffectHistoryEntry, EffectBiasAnalysis } from './EffectBiasTracker'

// ═══════════════════════════════════════════════════════════════
// AUDIENCE SAFETY CONTEXT
// ═══════════════════════════════════════════════════════════════

export interface AudienceSafetyContext {
  // ═══════════════════════════════════════════════════════════════
  // 👥 AUDIENCE STATE
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Tamaño estimado de la audiencia
   * 0-100 = club pequeño
   * 100-500 = club mediano
   * 500-1000 = club grande
   * 1000+ = festival/macro
   */
  crowdSize: number
  
  /**
   * Modo anti-epilepsia activo
   * true = bloquear strobes rápidos, reducir flickers
   * false = sin restricciones especiales
   */
  epilepsyMode: boolean
  
  /**
   * Fatiga visual acumulada de la audiencia
   * 0.0 = fresco, recién empezado
   * 0.5 = moderado, ~2 horas de show
   * 0.8 = alto, audiencia cansada
   * 1.0 = crítico, necesita descanso
   * 
   * Se acumula con efectos intensos y se reduce con efectos suaves
   */
  audienceFatigue: number
  
  // ═══════════════════════════════════════════════════════════════
  // 💡 HARDWARE STATE
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Luminosidad ambiente (luz exterior/ambiente)
   * 0.0 = oscuridad total (club cerrado)
   * 0.3 = tenue (club con algo de luz)
   * 0.7 = moderado (venue semi-abierto)
   * 1.0 = brillante (festival de día)
   * 
   * Afecta percepción de efectos
   */
  ambientLuminosity: number
  
  /**
   * Carga actual de GPU (0-1)
   * 0.0 = idle
   * 0.5 = carga moderada
   * 0.8 = carga alta
   * 1.0 = máxima capacidad (peligro)
   * 
   * Usado para circuit breaker
   */
  gpuLoad: number
  
  /**
   * Timestamp del último efecto intenso (intensity > 0.7)
   * Usado para rate limiting de efectos agresivos
   */
  lastIntenseEffect: number // ms desde epoch
  
  // ═══════════════════════════════════════════════════════════════
  // 🎭 CONTEXT STATE
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Vibe actual del sistema
   * Ejemplos: 'techno-club', 'fiesta-latina', 'chill-lounge'
   */
  vibe: string
  
  /**
   * Energía musical actual (0-1)
   * Del BeautySensor o análisis de audio
   */
  energy: number
  
  /**
   * Timestamp actual
   */
  timestamp: number
  
  // ═══════════════════════════════════════════════════════════════
  // 📊 HISTORY
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Historial de efectos recientes (últimos 20-30)
   * Usado para detectar monotonía y patrones
   */
  recentEffects: EffectHistoryEntry[]
  
  /**
   * Cooldowns activos
   * effect → ms restantes hasta disponible
   */
  activeCooldowns: Map<string, number>
  
  // ═══════════════════════════════════════════════════════════════
  // 🔮 DREAM INSIGHTS (opcional, si DreamEngine disponible)
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Warnings del DreamEngine sobre simulaciones
   * Ejemplo: ["approaching monotony", "risk level high"]
   */
  dreamWarnings?: string[]
  
  /**
   * Reporte de sesgos del BiasDetector
   * Análisis completo de patrones y monotonía
   */
  biasReport?: EffectBiasAnalysis
}

// ═══════════════════════════════════════════════════════════════
// BUILDER HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Builder para crear AudienceSafetyContext con defaults sensatos
 */
export class AudienceSafetyContextBuilder {
  private context: Partial<AudienceSafetyContext> = {}
  
  constructor() {
    // Defaults sensatos
    this.context = {
      crowdSize: 100,
      epilepsyMode: false,
      audienceFatigue: 0.0,
      ambientLuminosity: 0.0,
      gpuLoad: 0.0,
      lastIntenseEffect: 0,
      vibe: 'unknown',
      energy: 0.5,
      timestamp: Date.now(),
      recentEffects: [],
      activeCooldowns: new Map(),
      dreamWarnings: [],
      biasReport: undefined
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // AUDIENCE METHODS
  // ═══════════════════════════════════════════════════════════════
  
  withCrowdSize(size: number): this {
    this.context.crowdSize = Math.max(0, size)
    return this
  }
  
  withEpilepsyMode(enabled: boolean): this {
    this.context.epilepsyMode = enabled
    return this
  }
  
  withAudienceFatigue(fatigue: number): this {
    this.context.audienceFatigue = Math.max(0, Math.min(1, fatigue))
    return this
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HARDWARE METHODS
  // ═══════════════════════════════════════════════════════════════
  
  withAmbientLuminosity(luminosity: number): this {
    this.context.ambientLuminosity = Math.max(0, Math.min(1, luminosity))
    return this
  }
  
  withGpuLoad(load: number): this {
    this.context.gpuLoad = Math.max(0, Math.min(1, load))
    return this
  }
  
  withLastIntenseEffect(timestamp: number): this {
    this.context.lastIntenseEffect = timestamp
    return this
  }
  
  // ═══════════════════════════════════════════════════════════════
  // CONTEXT METHODS
  // ═══════════════════════════════════════════════════════════════
  
  withVibe(vibe: string): this {
    this.context.vibe = vibe
    return this
  }
  
  withEnergy(energy: number): this {
    this.context.energy = Math.max(0, Math.min(1, energy))
    return this
  }
  
  withTimestamp(timestamp: number): this {
    this.context.timestamp = timestamp
    return this
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HISTORY METHODS
  // ═══════════════════════════════════════════════════════════════
  
  withRecentEffects(effects: EffectHistoryEntry[]): this {
    this.context.recentEffects = effects
    return this
  }
  
  withActiveCooldowns(cooldowns: Map<string, number>): this {
    this.context.activeCooldowns = cooldowns
    return this
  }
  
  // ═══════════════════════════════════════════════════════════════
  // DREAM METHODS
  // ═══════════════════════════════════════════════════════════════
  
  withDreamWarnings(warnings: string[]): this {
    this.context.dreamWarnings = warnings
    return this
  }
  
  withBiasReport(report: EffectBiasAnalysis): this {
    this.context.biasReport = report
    return this
  }
  
  // ═══════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════
  
  build(): AudienceSafetyContext {
    // Validar campos requeridos
    if (!this.context.vibe) {
      throw new Error('AudienceSafetyContext: vibe is required')
    }
    
    return this.context as AudienceSafetyContext
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula fatiga visual basada en historial de efectos
 * 
 * Lógica:
 * - Efectos intensos (>0.7) aumentan fatiga rápidamente
 * - Efectos suaves (<0.3) reducen fatiga lentamente
 * - Fatiga decae naturalmente con el tiempo
 */
export function calculateAudienceFatigue(
  recentEffects: EffectHistoryEntry[],
  currentFatigue: number,
  decayRate: number = 0.01 // Por minuto
): number {
  const now = Date.now()
  const MINUTE_MS = 60000
  
  // Decay natural
  const minutesSinceLastEffect = recentEffects.length > 0 
    ? (now - recentEffects[recentEffects.length - 1].timestamp) / MINUTE_MS
    : 0
  
  let fatigue = currentFatigue - (decayRate * minutesSinceLastEffect)
  
  // Acumular fatiga de efectos recientes (últimos 5 minutos)
  const recentWindow = recentEffects.filter(e => 
    now - e.timestamp < 5 * MINUTE_MS
  )
  
  for (const effect of recentWindow) {
    if (effect.intensity > 0.7) {
      // Efecto intenso aumenta fatiga
      fatigue += 0.02 * effect.intensity
    } else if (effect.intensity < 0.3) {
      // Efecto suave reduce fatiga
      fatigue -= 0.01 * (1 - effect.intensity)
    }
  }
  
  return Math.max(0, Math.min(1, fatigue))
}

/**
 * Estima GPU load basado en efectos activos
 * 
 * Simplificado para Phase 1 (sin integración real con GPU)
 */
export function estimateGpuLoad(
  recentEffects: EffectHistoryEntry[]
): number {
  if (recentEffects.length === 0) return 0.0
  
  // Últimos 5 efectos
  const recent = recentEffects.slice(-5)
  
  // Efectos "pesados" conocidos
  const HEAVY_EFFECTS = new Set([
    'industrial_strobe',
    'laser_sweep',
    'rainbow_spiral'
  ])
  
  let load = 0.0
  
  for (const effect of recent) {
    if (HEAVY_EFFECTS.has(effect.effect)) {
      load += 0.15 * effect.intensity
    } else {
      load += 0.05 * effect.intensity
    }
  }
  
  return Math.min(1.0, load)
}

/**
 * Detecta si último efecto fue "intenso" (>0.7 intensity)
 */
export function getLastIntenseEffectTimestamp(
  recentEffects: EffectHistoryEntry[]
): number {
  for (let i = recentEffects.length - 1; i >= 0; i--) {
    if (recentEffects[i].intensity > 0.7) {
      return recentEffects[i].timestamp
    }
  }
  
  return 0 // Nunca hubo efecto intenso
}

/**
 * Crea un contexto "de emergencia" con defaults seguros
 * Usado cuando no hay datos suficientes
 */
export function createEmergencyContext(vibe: string = 'unknown'): AudienceSafetyContext {
  return new AudienceSafetyContextBuilder()
    .withVibe(vibe)
    .withEpilepsyMode(true) // SAFETY FIRST en emergencia
    .withAudienceFatigue(0.5) // Asumir fatiga moderada
    .withGpuLoad(0.3) // Asumir carga moderada
    .withEnergy(0.5)
    .build()
}

/**
 * Log del contexto para debugging
 */
export function logContext(context: AudienceSafetyContext): void {
  console.log('[SAFETY_CONTEXT] 🛡️ Current State:')
  console.log(`  👥 Crowd: ${context.crowdSize} | Fatigue: ${(context.audienceFatigue * 100).toFixed(1)}% | Epilepsy: ${context.epilepsyMode ? 'ON' : 'OFF'}`)
  console.log(`  💡 GPU: ${(context.gpuLoad * 100).toFixed(1)}% | Ambient: ${(context.ambientLuminosity * 100).toFixed(1)}%`)
  console.log(`  🎭 Vibe: ${context.vibe} | Energy: ${(context.energy * 100).toFixed(1)}%`)
  console.log(`  📊 Recent Effects: ${context.recentEffects.length} | Cooldowns: ${context.activeCooldowns.size}`)
  
  if (context.dreamWarnings && context.dreamWarnings.length > 0) {
    console.log(`  🔮 Dream Warnings: ${context.dreamWarnings.join(', ')}`)
  }
  
  if (context.biasReport) {
    console.log(`  🔬 Bias: Diversity=${(context.biasReport.diversityScore * 100).toFixed(1)}% | Critical=${context.biasReport.hasCriticalBias ? 'YES' : 'NO'}`)
  }
}
