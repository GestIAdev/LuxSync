/**
 * 🔋 WAVE 931: ENERGY CONSCIOUSNESS ENGINE
 * ================================================================
 * 
 * Motor de Consciencia Energética para Selene.
 * 
 * PROPÓSITO:
 * Proporcionar contexto de energía ABSOLUTA a Selene, no solo Z-Scores.
 * Esto evita el "Síndrome del Grito en la Biblioteca" donde un pico
 * relativo en silencio (Z=4.0, E=0.15) dispara efectos épicos.
 * 
 * DISEÑO ASIMÉTRICO (Edge Case del "Fake Drop"):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ENTRAR en zona baja (silence/valley): LENTO (500ms avg)    │
 * │  SALIR de zona baja:                   INSTANTÁNEO (0ms)    │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * Esto permite que cuando un DJ corta todo súbitamente antes de un drop,
 * Selene detecte INSTANTÁNEAMENTE el drop sin quedarse bloqueada en
 * "modo silencio" durante los primeros 200ms críticos.
 * 
 * @module core/intelligence/EnergyConsciousnessEngine
 * @version 1.0.0 - WAVE 931
 */

import { EnergyContext, EnergyZone } from '../protocol/MusicalContext.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export interface EnergyConsciousnessConfig {
  /** Umbrales para cada zona energética */
  zoneThresholds: {
    silence: number    // < este valor = SILENCE
    valley: number     // < este valor = VALLEY
    ambient: number    // < este valor = AMBIENT
    gentle: number     // < este valor = GENTLE
    active: number     // < este valor = ACTIVE
    intense: number    // < este valor = INTENSE
    // >= intense = PEAK
  }
  
  /** 
   * Factor de suavizado para ENTRAR en zonas bajas (0-1)
   * Más alto = más lento para entrar en silencio
   */
  smoothingFactorDown: number
  
  /**
   * Factor de suavizado para SALIR de zonas bajas (0-1)
   * Más bajo = más rápido para detectar el drop
   */
  smoothingFactorUp: number
  
  /** Tiempo (ms) para considerar "energía sostenida baja" */
  sustainedLowThresholdMs: number
  
  /** Tiempo (ms) para considerar "energía sostenida alta" */
  sustainedHighThresholdMs: number
  
  /** Umbral para sustained low */
  sustainedLowEnergyThreshold: number
  
  /** Umbral para sustained high */
  sustainedHighEnergyThreshold: number
  
  /** Tamaño del historial para cálculo de percentil */
  historySize: number
  
  /** Tamaño de ventana para cálculo de tendencia */
  trendWindowSize: number
}

const DEFAULT_CONFIG: EnergyConsciousnessConfig = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌋 WAVE 960: THE FLOOR IS LAVA - AGC Adaptation
  // ═══════════════════════════════════════════════════════════════════════════
  // 
  // PROBLEMA: El AGC amplifica el ruido de fondo hasta ~0.40
  // ANTES: Silencio = 0.05, Ambient = 0.15, Valley = 0.20
  // AHORA: El "silencio" del AGC = 0.40 → Los umbrales viejos detectaban
  //        "actividad" en lo que es solo ruido amplificado.
  // 
  // SOLUCIÓN: ZONE SHIFT - Mover TODOS los umbrales hacia arriba
  // El suelo ha subido → La portería también sube.
  // 
  // ═══════════════════════════════════════════════════════════════════════════
  zoneThresholds: {
    silence: 0.35,   // E < 0.35 = SILENCE (absorbe ruido AGC ~0.40)
    valley: 0.55,    // E < 0.55 = VALLEY (breakdowns reales)
    ambient: 0.70,   // E < 0.70 = AMBIENT (pads, voces suaves)
    gentle: 0.80,    // E < 0.80 = GENTLE (ritmos ligeros)
    active: 0.90,    // E < 0.90 = ACTIVE (techno normal)
    intense: 0.95,   // E < 0.95 = INTENSE (bombos reales)
                     // E >= 0.95 = PEAK (SOLO drops verdaderos)
  },
  
  // ASIMETRÍA TEMPORAL: Lento para bajar, rápido para subir
  smoothingFactorDown: 0.92,  // ~500ms para estabilizar en silencio
  smoothingFactorUp: 0.3,     // ~50ms para detectar spike (INSTANTÁNEO)
  
  sustainedLowThresholdMs: 5000,   // 5 segundos para "valle sostenido"
  sustainedHighThresholdMs: 3000,  // 3 segundos para "pico sostenido"
  
  sustainedLowEnergyThreshold: 0.4,
  sustainedHighEnergyThreshold: 0.7,
  
  historySize: 300,    // ~5 segundos @ 60fps
  trendWindowSize: 10, // ~160ms para calcular tendencia
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔋 ENERGY CONSCIOUSNESS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export class EnergyConsciousnessEngine {
  private config: EnergyConsciousnessConfig
  
  // Estado interno
  private smoothedEnergy: number = 0
  private currentZone: EnergyZone = 'silence'
  private previousZone: EnergyZone = 'silence'
  private lastZoneChange: number = Date.now()
  
  // Historial para percentil
  private energyHistory: number[] = []
  
  // Ventana para tendencia
  private trendWindow: number[] = []
  
  // Tracking de sostenibilidad
  private lastHighEnergyTime: number = 0
  private lastLowEnergyTime: number = Date.now()
  
  constructor(config: Partial<EnergyConsciousnessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 MÉTODO PRINCIPAL: PROCESS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Procesa la energía actual y retorna el contexto energético completo.
   * 
   * @param rawEnergy - Energía absoluta del audio (0-1)
   * @returns EnergyContext con toda la información para decisiones
   */
  process(rawEnergy: number): EnergyContext {
    const now = Date.now()
    
    // ═══════════════════════════════════════════════════════════════════
    // 1. SUAVIZADO ASIMÉTRICO - La magia del "Fake Drop"
    // ═══════════════════════════════════════════════════════════════════
    const smoothed = this.calculateAsymmetricSmoothing(rawEnergy)
    
    // ═══════════════════════════════════════════════════════════════════
    // 2. DETERMINAR ZONA
    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL: Para SALIR de zonas bajas, usamos energía RAW (instantánea)
    // Para ENTRAR en zonas bajas, usamos energía SMOOTHED (suavizada)
    const newZone = this.determineZone(rawEnergy, smoothed)
    
    // Detectar cambio de zona
    if (newZone !== this.currentZone) {
      this.previousZone = this.currentZone
      this.currentZone = newZone
      this.lastZoneChange = now
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3. ACTUALIZAR HISTORIAL Y CALCULAR PERCENTIL
    // ═══════════════════════════════════════════════════════════════════
    this.updateHistory(rawEnergy)
    const percentile = this.calculatePercentile(rawEnergy)
    
    // ═══════════════════════════════════════════════════════════════════
    // 4. CALCULAR TENDENCIA
    // ═══════════════════════════════════════════════════════════════════
    const trend = this.calculateTrend(rawEnergy)
    
    // ═══════════════════════════════════════════════════════════════════
    // 5. TRACKING DE SOSTENIBILIDAD
    // ═══════════════════════════════════════════════════════════════════
    const { sustainedLow, sustainedHigh } = this.updateSustainedTracking(rawEnergy, now)
    
    // ═══════════════════════════════════════════════════════════════════
    // 🌋 WAVE 960: FLASHBANG PROTOCOL
    // ═══════════════════════════════════════════════════════════════════
    // Detectar salto instantáneo de zona baja (silence/valley/ambient) a alta (intense/peak)
    const isFlashbang = this.detectFlashbang(this.previousZone, this.currentZone, now)
    
    // ═══════════════════════════════════════════════════════════════════
    // 6. CONSTRUIR CONTEXTO
    // ═══════════════════════════════════════════════════════════════════
    return {
      absolute: rawEnergy,
      smoothed: smoothed,
      percentile,
      zone: this.currentZone,
      previousZone: this.previousZone,
      sustainedLow,
      sustainedHigh,
      trend,
      lastZoneChange: this.lastZoneChange,
      isFlashbang,  // 🌋 WAVE 960
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔄 SUAVIZADO ASIMÉTRICO
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calcula el suavizado con asimetría temporal.
   * 
   * DISEÑO:
   * - Cuando la energía BAJA: Suavizado LENTO (500ms para estabilizar)
   *   → Evita que ruido/silencio momentáneo active modo silencio
   * 
   * - Cuando la energía SUBE: Suavizado RÁPIDO (casi instantáneo)
   *   → Detecta el DROP inmediatamente, no se queda "dormido"
   */
  private calculateAsymmetricSmoothing(rawEnergy: number): number {
    const isRising = rawEnergy > this.smoothedEnergy
    
    // ASIMETRÍA: Diferente velocidad según dirección
    const factor = isRising 
      ? this.config.smoothingFactorUp     // Subiendo: RÁPIDO
      : this.config.smoothingFactorDown   // Bajando: LENTO
    
    // Exponential Moving Average con factor asimétrico
    this.smoothedEnergy = this.smoothedEnergy * factor + rawEnergy * (1 - factor)
    
    return this.smoothedEnergy
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 DETERMINACIÓN DE ZONA
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Determina la zona energética actual.
   * 
   * REGLA CRÍTICA:
   * - Para ENTRAR en silence/valley: Usar smoothed (lento)
   * - Para SALIR de silence/valley: Usar raw (instantáneo)
   */
  private determineZone(raw: number, smoothed: number): EnergyZone {
    const t = this.config.zoneThresholds
    const currentIsLow = this.isLowZone(this.currentZone)
    
    // Si estamos en zona baja, usamos RAW para detectar subida INSTANTÁNEA
    if (currentIsLow) {
      // ¿La energía RAW indica que debemos subir?
      if (raw >= t.active) return 'active'
      if (raw >= t.gentle) return 'gentle'
      if (raw >= t.ambient) return 'ambient'
      if (raw >= t.valley) return 'valley'
      
      // Si no subimos, mantenemos zona actual (basado en smoothed)
      if (smoothed < t.silence) return 'silence'
      if (smoothed < t.valley) return 'valley'
      return this.currentZone
    }
    
    // Si estamos en zona alta, usamos SMOOTHED para bajar LENTAMENTE
    if (smoothed >= t.intense) return 'peak'
    if (smoothed >= t.active) return 'intense'
    if (smoothed >= t.gentle) return 'active'
    if (smoothed >= t.ambient) return 'gentle'
    if (smoothed >= t.valley) return 'ambient'
    if (smoothed >= t.silence) return 'valley'
    return 'silence'
  }
  
  /**
   * ¿Es esta una zona de baja energía?
   */
  private isLowZone(zone: EnergyZone): boolean {
    return zone === 'silence' || zone === 'valley' || zone === 'ambient'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📊 PERCENTIL HISTÓRICO
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Actualiza el historial de energía
   */
  private updateHistory(energy: number): void {
    this.energyHistory.push(energy)
    
    // Mantener tamaño máximo
    if (this.energyHistory.length > this.config.historySize) {
      this.energyHistory.shift()
    }
  }
  
  /**
   * Calcula en qué percentil está la energía actual.
   * 
   * Esto permite saber: "Estás en el 15% más bajo de la pista"
   */
  private calculatePercentile(energy: number): number {
    if (this.energyHistory.length < 10) return 50 // Warmup
    
    // Contar cuántos valores son menores que el actual
    const lowerCount = this.energyHistory.filter(e => e < energy).length
    
    return Math.round((lowerCount / this.energyHistory.length) * 100)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📈 CÁLCULO DE TENDENCIA
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calcula la tendencia de cambio de energía.
   * 
   * @returns -1 a 1, donde positivo = subiendo
   */
  private calculateTrend(energy: number): number {
    this.trendWindow.push(energy)
    
    if (this.trendWindow.length > this.config.trendWindowSize) {
      this.trendWindow.shift()
    }
    
    if (this.trendWindow.length < 3) return 0
    
    // Calcular pendiente simple
    const first = this.trendWindow.slice(0, Math.floor(this.trendWindow.length / 2))
    const second = this.trendWindow.slice(Math.floor(this.trendWindow.length / 2))
    
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length
    
    // Normalizar a -1, 1
    const rawTrend = (secondAvg - firstAvg) * 5 // Amplificar
    return Math.max(-1, Math.min(1, rawTrend))
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⏱️ TRACKING DE SOSTENIBILIDAD
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Actualiza el tracking de energía sostenida alta/baja
   */
  private updateSustainedTracking(energy: number, now: number): {
    sustainedLow: boolean
    sustainedHigh: boolean
  } {
    // Tracking de energía alta
    if (energy >= this.config.sustainedHighEnergyThreshold) {
      this.lastHighEnergyTime = now
    }
    
    // Tracking de energía baja
    if (energy < this.config.sustainedLowEnergyThreshold) {
      // Si es la primera vez que baja, registrar
      if (this.lastLowEnergyTime === 0) {
        this.lastLowEnergyTime = now
      }
    } else {
      this.lastLowEnergyTime = now // Reset cuando sube
    }
    
    // Calcular si es sostenido
    const sustainedLow = energy < this.config.sustainedLowEnergyThreshold &&
      (now - this.lastLowEnergyTime) >= this.config.sustainedLowThresholdMs
    
    const sustainedHigh = energy >= this.config.sustainedHighEnergyThreshold &&
      (now - this.lastHighEnergyTime) < this.config.sustainedHighThresholdMs
    
    return { sustainedLow, sustainedHigh }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌋 WAVE 960: FLASHBANG PROTOCOL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Detecta si hay un salto instantáneo de zona baja a zona alta (FLASHBANG).
   * 
   * FLASHBANG = Salto de Fe (puede ser Drop o Grito):
   * - Zona anterior: silence, valley, ambient (baja energía)
   * - Zona actual: intense, peak (alta energía)
   * - Tiempo desde cambio: < 100ms (prácticamente instantáneo)
   * 
   * OBJETIVO:
   * Si TRUE → Disparar SOLO efectos cortos (StrobeBurst) en el primer frame.
   * NO disparar efectos largos (Gatling, CyberDualism) hasta confirmar que
   * la energía se sostiene (no es un grito aislado).
   * 
   * @returns true si detecta Flashbang, false si es transición normal
   */
  private detectFlashbang(
    previousZone: EnergyZone,
    currentZone: EnergyZone,
    now: number
  ): boolean {
    // 1. ¿Es un cambio de zona reciente? (< 100ms)
    const timeSinceChange = now - this.lastZoneChange
    if (timeSinceChange > 100) return false  // Transición ya estabilizada
    
    // 2. ¿Venimos de zona BAJA?
    const isFromLow = previousZone === 'silence' || 
                      previousZone === 'valley' || 
                      previousZone === 'ambient'
    
    if (!isFromLow) return false
    
    // 3. ¿Vamos a zona ALTA?
    const isToHigh = currentZone === 'intense' || 
                     currentZone === 'peak'
    
    if (!isToHigh) return false
    
    // ✅ FLASHBANG DETECTED: Salto instantáneo de LOW → HIGH
    console.log(`[🌋 FLASHBANG] Detected: ${previousZone} → ${currentZone} (${timeSinceChange}ms)`)
    return true
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene la zona actual
   */
  getCurrentZone(): EnergyZone {
    return this.currentZone
  }
  
  /**
   * Obtiene la energía suavizada actual
   */
  getSmoothedEnergy(): number {
    return this.smoothedEnergy
  }
  
  /**
   * Reset del motor (para nueva canción)
   */
  reset(): void {
    this.smoothedEnergy = 0
    this.currentZone = 'silence'
    this.previousZone = 'silence'
    this.lastZoneChange = Date.now()
    this.energyHistory = []
    this.trendWindow = []
    this.lastHighEnergyTime = 0
    this.lastLowEnergyTime = Date.now()
  }
  
  /**
   * Actualiza configuración en runtime
   */
  updateConfig(config: Partial<EnergyConsciousnessConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  /**
   * 🎤 WAVE 936: VOCAL FILTER - Confianza de transición
   * 
   * Distingue entre drops reales y voces que saltan de golpe.
   * 
   * COMPORTAMIENTO:
   * - Drop real: Energía sube y se MANTIENE alta (>200ms) → confianza ALTA
   * - Voz: Energía sube y fluctúa/baja rápido (<200ms) → confianza BAJA
   * 
   * USO: Los consumidores pueden usar esta confianza para decidir
   * qué tan "pesado" debe ser el efecto que disparan.
   * 
   * @param context - El EnergyContext actual
   * @returns 0-1, donde 1 = muy confiable, 0 = probablemente ruido/voz
   */
  getTransitionConfidence(context: EnergyContext): number {
    const now = Date.now()
    const timeSinceChange = now - context.lastZoneChange
    
    // Si la transición es muy reciente (<100ms), baja confianza
    if (timeSinceChange < 100) {
      return 0.2 // Probablemente ruido transitorio
    }
    
    // Si la transición tiene 100-300ms, confianza media (podría ser voz)
    if (timeSinceChange < 300) {
      // Considerar también la tendencia: si está subiendo, más confianza
      const trendBonus = context.trend > 0.3 ? 0.2 : 0
      return 0.4 + trendBonus
    }
    
    // Si la transición tiene 300-500ms, confianza alta
    if (timeSinceChange < 500) {
      return 0.75
    }
    
    // Más de 500ms en la misma zona = muy confiable
    return 1.0
  }
  
  /**
   * 🎤 WAVE 936: ¿Es esta transición probablemente una voz?
   * 
   * Heurística simple: transición muy rápida + no sostenida + fluctuante
   */
  isProbablyVocalTransition(context: EnergyContext): boolean {
    const now = Date.now()
    const timeSinceChange = now - context.lastZoneChange
    
    // Si saltamos de silence/valley a una zona alta muy rápido
    const wasLow = context.previousZone === 'silence' || context.previousZone === 'valley'
    const isHighNow = context.zone === 'active' || context.zone === 'intense' || context.zone === 'peak'
    
    if (wasLow && isHighNow && timeSinceChange < 150) {
      // Transición muy rápida desde silencio → probablemente voz/grito
      return true
    }
    
    return false
  }
  
  /**
   * Obtiene estadísticas para debug
   */
  getStats(): {
    currentZone: EnergyZone
    smoothedEnergy: number
    historySize: number
    avgEnergy: number
  } {
    const avgEnergy = this.energyHistory.length > 0
      ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
      : 0
    
    return {
      currentZone: this.currentZone,
      smoothedEnergy: this.smoothedEnergy,
      historySize: this.energyHistory.length,
      avgEnergy,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea una instancia de EnergyConsciousnessEngine
 */
export function createEnergyConsciousnessEngine(
  config?: Partial<EnergyConsciousnessConfig>
): EnergyConsciousnessEngine {
  return new EnergyConsciousnessEngine(config)
}
