/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💓 WAVE 1022: THE PACEMAKER - BEAT DETECTOR v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DIAGNÓSTICO DEL CÓDIGO ANTERIOR:
 * - Promedio simple de todos los intervalos → contaminación por sub-divisiones
 * - Media móvil 80/20 por frame → esquizofrenia BPM (120→180→80 en 3 frames)
 * - Cero histéresis → cambios de BPM cada frame
 * - Cero clustering → fills de batería = caos
 * 
 * SOLUCIÓN: THE PACEMAKER
 * 
 * A. 🧹 SMART INTERVAL SELECTOR (Clustering)
 *    - Agrupa intervalos similares (±25ms)
 *    - Usa el CLUSTER DOMINANTE (Moda), NO el promedio
 *    - Ignora sub-divisiones (intervalos < 55% del dominante) si son minoría
 * 
 * B. ⚓ HYSTERESIS ANCHOR (Estabilidad)
 *    - candidateBpm: lo que calculamos este frame
 *    - stableBpm: lo que USAMOS para las luces
 *    - Solo cambia stableBpm si candidateBpm persiste ±2.5 BPM durante 45 frames (~1.5s)
 *    - Excepción: primeros 16 beats → cambios rápidos permitidos (warm-up)
 * 
 * C. 🔒 OCTAVE PROTECTION (Anti-multiplicación)
 *    - Si BPM salta a 2x, 0.5x, 1.5x, o 0.66x → mantiene el actual
 *    - Solo acepta cambio de octava si confidence > 0.85 durante 90 frames (~3s)
 * 
 * Resultado: BPM clavado como ROCA aunque el baterista se vuelva loco.
 * 
 * @author PunkOpus
 * @wave 1022
 */

import type {
  AudioMetrics,
  AudioConfig,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del detector de beats
 */
export interface BeatState {
  bpm: number                 // BPM estable (THE TRUTH)
  confidence: number          // 0-1 (consistencia de intervalos)
  phase: number               // 0-1 (posición en el beat)
  onBeat: boolean             // ¿Estamos en el golpe?
  beatCount: number           // Número total de beats detectados
  lastBeatTime: number        // Timestamp del último beat
  
  // Detección de instrumentos
  kickDetected: boolean
  snareDetected: boolean
  hihatDetected: boolean
  
  // 💓 WAVE 1022: Nuevos campos de diagnóstico
  rawBpm: number              // BPM sin filtrar (para debug)
  isLocked: boolean           // ¿BPM está "locked" (high confidence)?
  lockFrames: number          // Frames que llevamos locked
}

/**
 * Historial de picos para detección
 */
interface PeakHistory {
  time: number
  energy: number
  type: 'kick' | 'snare' | 'hihat' | 'unknown'
}

/**
 * 💓 WAVE 1022: Cluster de intervalos
 */
interface IntervalCluster {
  centerMs: number            // Centro del cluster en ms
  count: number               // Cantidad de intervalos en este cluster
  intervals: number[]         // Los intervalos raw
  bpm: number                 // BPM correspondiente
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - THE PACEMAKER TUNING
// ═══════════════════════════════════════════════════════════════════════════
// 💀 WAVE 1158: CARDIAC TRANSPLANT
// El problema: detectábamos hi-hats y bass wobbles como kicks
// La solución: copiar la lógica de BETA que SÍ funciona
// ═══════════════════════════════════════════════════════════════════════════

/** Tolerancia para agrupar intervalos similares (ms) */
const CLUSTER_TOLERANCE_MS = 30  // Era 25 - Más tolerante para agrupar

/** Frames mínimos para aceptar cambio de BPM */
const HYSTERESIS_FRAMES = 30  // ~1s @ 30fps

/** BPM delta máximo para considerar "estable" */
const BPM_STABILITY_DELTA = 5

/** Beats iniciales con warm-up (cambios rápidos permitidos) */
const WARMUP_BEATS = 8

/** Confidence mínima para lock de octava */
const OCTAVE_LOCK_CONFIDENCE = 0.70

/** Frames mínimos para aceptar cambio de octava */
const OCTAVE_CHANGE_FRAMES = 45

/**
 * 💀 WAVE 1158: INTERVALO MÍNIMO = 200ms (300 BPM max)
 * A 160 BPM = 375ms/beat
 * A 200 BPM = 300ms/beat  
 * BETA usa 200ms y FUNCIONA. El problema no era este.
 */
const MIN_INTERVAL_MS = 200  // Era 300 - Igual que BETA

/** Intervalo máximo válido (ms) - 40bpm min */
const MAX_INTERVAL_MS = 1500

/** Ratio para detectar sub-división (beat → half-beat) */
const SUBDIVISION_RATIO = 0.55

/**
 * 💀 WAVE 1158: DEBOUNCE MÍNIMO ENTRE KICKS
 * A 200 BPM = 300ms entre kicks → debounce 200ms es seguro
 * BETA usa 200ms y FUNCIONA. Nosotros teníamos 80ms (LOCURA)
 */
const MIN_PEAK_SPACING_MS = 200  // Era 80 - Igual que BETA

// ═══════════════════════════════════════════════════════════════════════════
// THE PACEMAKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 💓 BeatDetector v2.0 - THE PACEMAKER
 * 
 * Detecta y trackea el ritmo del audio con estabilidad de hospital.
 */
export class BeatDetector {
  // State
  private state: BeatState
  private peakHistory: PeakHistory[] = []
  private readonly maxPeakHistory = 64
  
  // Configuration
  private readonly minBpm: number
  private readonly maxBpm: number
  
  // ═══════════════════════════════════════════════════════════════════════════
  // � WAVE 1162: THE BYPASS - RAW BASS CALIBRATION
  // 
  // ANTES (WAVE 1161): Audio normalizado por AGC → transients pequeños (0.05-0.18)
  // AHORA (WAVE 1162): Audio RAW sin AGC → transients GRANDES (0.1-0.5+)
  // 
  // La señal RAW del GOD EAR tiene MUCHA más dinámica:
  // - Silencio: ~0.01-0.05
  // - Bajo continuo: ~0.1-0.3  
  // - KICK: ~0.4-0.8+ (¡PICOS REALES!)
  // 
  // Los transientes (frame-to-frame delta) serán proporcionalmente mayores.
  // Un kick real puede generar transients de 0.2-0.5 (vs 0.05-0.15 con AGC)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🎚️ AUTO-GAIN: Media móvil del bass para calibración
  private bassHistory: number[] = []
  private readonly BASS_HISTORY_SIZE = 30  // ~1 segundo @ 30fps
  private bassAvg = 0.2  // Valor inicial para RAW (más bajo que AGC)
  
  // 🔥 WAVE 1162: Thresholds para audio RAW (sin AGC)
  // La señal RAW tiene MAYOR dinámica → umbrales más altos
  // PERO el GOD EAR rawBands ya está parcialmente normalizado
  // Formula: threshold = BASE + (bassAvg * MULTIPLIER)
  // bassAvg=0.15 → thresh=0.065 (música suave)
  // bassAvg=0.30 → thresh=0.095 (normal)
  // bassAvg=0.50 → thresh=0.125 (fuerte)
  // bassAvg=0.70 → thresh=0.155 (muy fuerte)
  private readonly KICK_THRESHOLD_BASE = 0.05
  private readonly KICK_THRESHOLD_MULTIPLIER = 0.15  // Reducido de 0.35 - rawBands ya normalizado
  
  // Transient detection thresholds (DINÁMICOS - estos son fallbacks)
  private kickThreshold = 0.12   // Se recalcula cada frame
  private snareThreshold = 0.10  
  private hihatThreshold = 0.08
  
  // Previous frame values (for transient detection)
  private prevBass = 0
  private prevMid = 0
  private prevTreble = 0
  
  // 💀 WAVE 1156: Diagnostic counters
  private diagnosticFrames = 0
  private kicksDetectedTotal = 0
  
  // 💓 WAVE 1022: THE PACEMAKER STATE
  private candidateBpm = 120          // BPM que estamos "probando"
  private candidateFrames = 0         // Frames que el candidato ha sido estable
  private octaveChangeFrames = 0      // Frames intentando cambio de octava
  private lastDominantInterval = 500  // Último intervalo dominante detectado
  
  constructor(config: AudioConfig) {
    this.minBpm = config.minBpm || 60
    this.maxBpm = config.maxBpm || 200
    
    this.state = this.createInitialState()
  }
  
  /**
   * Estado inicial
   */
  private createInitialState(): BeatState {
    return {
      bpm: 120,
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
      // WAVE 1022
      rawBpm: 120,
      isLocked: false,
      lockFrames: 0,
    }
  }
  
  /**
   * 🎯 Procesar frame de audio
   */
  process(metrics: AudioMetrics): BeatState {
    const now = metrics.timestamp
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 💀 WAVE 1160: AUTO-GAIN PACEMAKER - Calcular threshold dinámico
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 1. Actualizar historial de bass para media móvil
    this.bassHistory.push(metrics.bass)
    if (this.bassHistory.length > this.BASS_HISTORY_SIZE) {
      this.bassHistory.shift()
    }
    
    // 2. Calcular media móvil del bass
    if (this.bassHistory.length >= 5) {
      this.bassAvg = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length
    }
    
    // 3. Calcular threshold DINÁMICO
    // 💀 WAVE 1161: Recalibrado para audio AGC
    // Formula: threshold = BASE + (bassAvg * MULTIPLIER)
    // bassAvg=0.3 → threshold=0.086 (muy sensible)
    // bassAvg=0.6 → threshold=0.122 (normal - detecta kicks reales)
    // bassAvg=0.8 → threshold=0.146 (fuerte - ignora wobbles)
    this.kickThreshold = this.KICK_THRESHOLD_BASE + (this.bassAvg * this.KICK_THRESHOLD_MULTIPLIER)
    
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 4. Detectar transientes (cambios bruscos de energía)
    const bassTransient = metrics.bass - this.prevBass
    const midTransient = metrics.mid - this.prevMid
    const trebleTransient = metrics.treble - this.prevTreble
    
    // 5. Detectar instrumentos con threshold DINÁMICO
    // 💀 WAVE 1161: SOLO el transiente importa, sin condición secundaria
    // La condición "bass > bassAvg * 0.7" era redundante y restrictiva
    // Un transiente positivo grande YA indica que estamos en un pico
    this.state.kickDetected = bassTransient > this.kickThreshold
    this.state.snareDetected = midTransient > this.snareThreshold && metrics.mid > 0.15
    this.state.hihatDetected = trebleTransient > this.hihatThreshold && metrics.treble > 0.10
    
    // 💀 WAVE 1160/1162: Diagnostic logging con threshold dinámico
    // WAVE 1162: El bass que recibimos ahora es RAW (sin AGC)
    this.diagnosticFrames++
    if (this.diagnosticFrames % 60 === 0) {
      console.log(`[💓 PACEMAKER RAW] bass=${metrics.bass.toFixed(2)} avg=${this.bassAvg.toFixed(2)} thresh=${this.kickThreshold.toFixed(3)} trans=${bassTransient.toFixed(3)} | kicks=${this.kicksDetectedTotal} | bpm=${this.state.bpm.toFixed(0)} (raw:${this.state.rawBpm.toFixed(0)})`)
    }
    
    // 6. Registrar picos para análisis de BPM
    // 💀 WAVE 1158: Solo kicks reales pasan. El debounce de 200ms filtra el resto.
    if (this.state.kickDetected) {
      this.recordPeak(now, metrics.energy, 'kick')
      this.kicksDetectedTotal++
    }
    
    // 4. 💓 THE PACEMAKER: Calcular BPM con clustering + histéresis
    this.updateBpmWithPacemaker(now)
    
    // 5. Actualizar fase del beat
    this.updatePhase(now)
    
    // 6. Detectar si estamos "en el beat"
    this.state.onBeat = this.state.phase < 0.12 || this.state.phase > 0.88
    
    // 7. Guardar valores anteriores
    this.prevBass = metrics.bass
    this.prevMid = metrics.mid
    this.prevTreble = metrics.treble
    
    return { ...this.state }
  }
  
  /**
   * Registrar un pico detectado
   */
  private recordPeak(time: number, energy: number, type: PeakHistory['type']): void {
    // 💀 WAVE 1158: DEBOUNCE CRÍTICO
    // El bug era que 80ms permitía hi-hats como kicks
    // BETA usa 200ms y FUNCIONA PERFECTAMENTE
    const lastPeak = this.peakHistory[this.peakHistory.length - 1]
    if (lastPeak && (time - lastPeak.time) < MIN_PEAK_SPACING_MS) {
      return
    }
    
    this.peakHistory.push({ time, energy, type })
    
    // Mantener historial limitado
    if (this.peakHistory.length > this.maxPeakHistory) {
      this.peakHistory.shift()
    }
    
    // Actualizar contador de beats
    if (type === 'kick') {
      this.state.beatCount++
      this.state.lastBeatTime = time
    }
  }
  
  /**
   * 💓 WAVE 1022: THE PACEMAKER - BPM con clustering + histéresis
   */
  private updateBpmWithPacemaker(now: number): void {
    // Necesitamos suficientes kicks para analizar
    const kicks = this.peakHistory.filter(p => p.type === 'kick')
    if (kicks.length < 6) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 1: Calcular todos los intervalos válidos
    // ═══════════════════════════════════════════════════════════════════════
    const intervals: number[] = []
    let rejectedIntervals = 0
    for (let i = 1; i < kicks.length; i++) {
      const interval = kicks[i].time - kicks[i - 1].time
      if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
        intervals.push(interval)
      } else {
        rejectedIntervals++
      }
    }
    
    // 💀 WAVE 1158: Log intervals para diagnóstico (cada 4 segundos)
    if (this.diagnosticFrames % 120 === 0 && intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const minInterval = Math.min(...intervals)
      const maxInterval = Math.max(...intervals)
      // Mostrar los últimos 8 intervalos para debug
      const lastIntervals = intervals.slice(-8).map(i => `${i.toFixed(0)}ms`).join(', ')
      console.log(`[💓 INTERVALS] valid=${intervals.length} rejected=${rejectedIntervals} | avg=${avgInterval.toFixed(0)}ms (${(60000/avgInterval).toFixed(0)}bpm) | range=${minInterval.toFixed(0)}-${maxInterval.toFixed(0)}ms`)
      console.log(`[💓 LAST 8] ${lastIntervals}`)
    }
    
    if (intervals.length < 4) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 2: 🧹 CLUSTERING - Agrupar intervalos similares
    // ═══════════════════════════════════════════════════════════════════════
    const clusters = this.clusterIntervals(intervals)
    
    if (clusters.length === 0) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 3: Encontrar el CLUSTER DOMINANTE (Moda, no promedio)
    // ═══════════════════════════════════════════════════════════════════════
    const dominantCluster = this.findDominantCluster(clusters)
    
    if (!dominantCluster) return
    
    // Guardar para referencia
    this.lastDominantInterval = dominantCluster.centerMs
    
    // BPM crudo (sin filtrar)
    const rawBpm = dominantCluster.bpm
    this.state.rawBpm = rawBpm
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 4: 🔒 OCTAVE PROTECTION - Detectar saltos de octava falsos
    // 💀 WAVE 1157: Relajado para permitir cambios de canción
    // ═══════════════════════════════════════════════════════════════════════
    const currentBpm = this.state.bpm
    const isOctaveJump = this.isOctaveJump(rawBpm, currentBpm)
    
    if (isOctaveJump && this.state.beatCount > WARMUP_BEATS) {
      // Incrementar contador de frames intentando cambiar octava
      this.octaveChangeFrames++
      
      // 💀 WAVE 1157: Log cuando bloqueamos (cada 2 segundos)
      if (this.diagnosticFrames % 60 === 0) {
        const ratio = (rawBpm / currentBpm).toFixed(2)
        console.log(`[💓 OCTAVE BLOCK] ${currentBpm.toFixed(0)}→${rawBpm.toFixed(0)} BPM (ratio=${ratio}) | frames=${this.octaveChangeFrames}/${OCTAVE_CHANGE_FRAMES} | conf=${this.state.confidence.toFixed(2)}`)
      }
      
      // Solo aceptar cambio de octava si:
      // - Llevamos MUCHOS frames intentándolo
      // - La confianza es MUY alta
      if (this.octaveChangeFrames < OCTAVE_CHANGE_FRAMES || 
          this.state.confidence < OCTAVE_LOCK_CONFIDENCE) {
        // RECHAZAR cambio de octava - mantener BPM actual
        return
      }
      // 💀 WAVE 1157: Log cuando finalmente aceptamos
      console.log(`[💓 OCTAVE ACCEPT] ${currentBpm.toFixed(0)}→${rawBpm.toFixed(0)} BPM after ${this.octaveChangeFrames} frames`)
    } else {
      // Reset contador de octava si no es salto
      this.octaveChangeFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 5: ⚓ HYSTERESIS - Solo cambiar si el candidato persiste
    // ═══════════════════════════════════════════════════════════════════════
    const bpmDelta = Math.abs(rawBpm - this.candidateBpm)
    
    if (bpmDelta <= BPM_STABILITY_DELTA) {
      // BPM es similar al candidato anterior → incrementar estabilidad
      this.candidateFrames++
      
      // Refinar el candidato con media móvil suave
      this.candidateBpm = this.candidateBpm * 0.92 + rawBpm * 0.08
    } else {
      // BPM cambió significativamente → nuevo candidato
      this.candidateBpm = rawBpm
      this.candidateFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 6: Aplicar cambio SOLO si es estable
    // ═══════════════════════════════════════════════════════════════════════
    const isWarmup = this.state.beatCount < WARMUP_BEATS
    const requiredFrames = isWarmup ? 8 : HYSTERESIS_FRAMES
    
    if (this.candidateFrames >= requiredFrames) {
      // ¡El candidato es estable! Aplicar cambio
      this.state.bpm = Math.round(this.candidateBpm * 10) / 10  // 1 decimal
      this.state.isLocked = true
      this.state.lockFrames++
    } else {
      this.state.isLocked = false
      this.state.lockFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 7: Calcular confianza basada en consistencia del cluster dominante
    // ═══════════════════════════════════════════════════════════════════════
    this.state.confidence = this.calculateConfidence(dominantCluster, clusters)
  }
  
  /**
   * 🧹 Agrupar intervalos similares en clusters
   */
  private clusterIntervals(intervals: number[]): IntervalCluster[] {
    if (intervals.length === 0) return []
    
    // Ordenar intervalos
    const sorted = [...intervals].sort((a, b) => a - b)
    
    const clusters: IntervalCluster[] = []
    let currentCluster: IntervalCluster | null = null
    
    for (const interval of sorted) {
      if (!currentCluster) {
        // Primer cluster
        currentCluster = {
          centerMs: interval,
          count: 1,
          intervals: [interval],
          bpm: 60000 / interval,
        }
      } else if (Math.abs(interval - currentCluster.centerMs) <= CLUSTER_TOLERANCE_MS) {
        // Agregar al cluster actual
        currentCluster.intervals.push(interval)
        currentCluster.count++
        // Recalcular centro como promedio del cluster
        currentCluster.centerMs = currentCluster.intervals.reduce((a, b) => a + b, 0) / currentCluster.count
        currentCluster.bpm = 60000 / currentCluster.centerMs
      } else {
        // Nuevo cluster
        clusters.push(currentCluster)
        currentCluster = {
          centerMs: interval,
          count: 1,
          intervals: [interval],
          bpm: 60000 / interval,
        }
      }
    }
    
    // No olvidar el último cluster
    if (currentCluster) {
      clusters.push(currentCluster)
    }
    
    return clusters
  }
  
  /**
   * 🎯 Encontrar el cluster dominante (Moda)
   * 
   * Prioriza:
   * 1. El cluster con más intervalos
   * 2. Si hay empate, el que está más cerca del BPM actual (estabilidad)
   * 3. Ignora clusters de sub-división si hay uno de beat completo
   */
  private findDominantCluster(clusters: IntervalCluster[]): IntervalCluster | null {
    if (clusters.length === 0) return null
    if (clusters.length === 1) return clusters[0]
    
    // Ordenar por cantidad (más intervalos primero)
    const sorted = [...clusters].sort((a, b) => b.count - a.count)
    
    // El más grande
    const largest = sorted[0]
    
    // Verificar si hay otros clusters significativos
    const significant = sorted.filter(c => c.count >= largest.count * 0.6)
    
    if (significant.length === 1) {
      return largest
    }
    
    // Si hay múltiples clusters significativos, priorizar el más cercano al BPM actual
    // (estabilidad temporal)
    const currentBpm = this.state.bpm
    
    let best = largest
    let bestDistance = Math.abs(largest.bpm - currentBpm)
    
    for (const cluster of significant) {
      const distance = Math.abs(cluster.bpm - currentBpm)
      
      // Si está más cerca del BPM actual Y no es una sub-división obvia
      if (distance < bestDistance) {
        // Verificar que no sea sub-división del largest
        const ratio = cluster.centerMs / largest.centerMs
        const isSubdivision = ratio < SUBDIVISION_RATIO || (ratio > 1.8 && ratio < 2.2)
        
        if (!isSubdivision) {
          best = cluster
          bestDistance = distance
        }
      }
    }
    
    return best
  }
  
  /**
   * 🔒 Detectar si el cambio de BPM es un salto de octava (falso positivo)
   * 💀 WAVE 1157: Rangos más estrictos para no bloquear cambios legítimos
   */
  private isOctaveJump(newBpm: number, currentBpm: number): boolean {
    if (currentBpm === 0) return false
    
    const ratio = newBpm / currentBpm
    
    // Ratios peligrosos: SOLO doble y mitad (las octavas reales)
    // 💀 WAVE 1157: Eliminamos 1.5x y 0.66x porque bloquean cambios de canción
    // Ejemplo: 87 BPM (Dub) → 127 BPM (Techno) = 1.46x NO es octava
    const dangerousRatios = [
      { min: 1.90, max: 2.10 },   // Doble exacto (±5%)
      { min: 0.48, max: 0.52 },   // Mitad exacto (±4%)
    ]
    
    for (const range of dangerousRatios) {
      if (ratio >= range.min && ratio <= range.max) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * 📊 Calcular confianza basada en consistencia
   */
  private calculateConfidence(dominant: IntervalCluster, allClusters: IntervalCluster[]): number {
    // Base: qué porcentaje de intervalos están en el cluster dominante
    const totalIntervals = allClusters.reduce((sum, c) => sum + c.count, 0)
    const dominantRatio = dominant.count / totalIntervals
    
    // Varianza dentro del cluster dominante
    const mean = dominant.centerMs
    const variance = dominant.intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / dominant.count
    const stdDev = Math.sqrt(variance)
    const consistencyScore = Math.max(0, 1 - (stdDev / mean) * 2)
    
    // Combinar scores
    const confidence = (dominantRatio * 0.6) + (consistencyScore * 0.4)
    
    // Clamp 0-1
    return Math.max(0, Math.min(1, confidence))
  }
  
  /**
   * Actualizar fase del beat (0-1)
   */
  private updatePhase(now: number): void {
    const beatDuration = 60000 / this.state.bpm
    const timeSinceLastBeat = now - this.state.lastBeatTime
    
    // Calcular fase (0-1)
    this.state.phase = (timeSinceLastBeat % beatDuration) / beatDuration
  }
  
  /**
   * Forzar BPM manualmente (para sync externo o usuario)
   */
  setBpm(bpm: number): void {
    if (bpm >= this.minBpm && bpm <= this.maxBpm) {
      this.state.bpm = bpm
      this.candidateBpm = bpm
      this.candidateFrames = HYSTERESIS_FRAMES  // Forzar lock inmediato
      this.state.confidence = 1.0
      this.state.isLocked = true
    }
  }
  
  /**
   * Tap tempo - usuario marca el beat manualmente
   */
  tap(timestamp: number): void {
    this.recordPeak(timestamp, 1.0, 'kick')
    this.updateBpmWithPacemaker(timestamp)
  }
  
  /**
   * Obtener estado actual
   */
  getState(): BeatState {
    return { ...this.state }
  }
  
  /**
   * 💓 WAVE 1022: Obtener diagnóstico del Pacemaker
   */
  getDiagnostics(): {
    stableBpm: number
    rawBpm: number
    candidateBpm: number
    candidateFrames: number
    isLocked: boolean
    confidence: number
    octaveChangeFrames: number
    lastInterval: number
  } {
    return {
      stableBpm: this.state.bpm,
      rawBpm: this.state.rawBpm,
      candidateBpm: this.candidateBpm,
      candidateFrames: this.candidateFrames,
      isLocked: this.state.isLocked,
      confidence: this.state.confidence,
      octaveChangeFrames: this.octaveChangeFrames,
      lastInterval: this.lastDominantInterval,
    }
  }
  
  /**
   * Reset detector
   */
  reset(): void {
    this.peakHistory = []
    this.candidateBpm = 120
    this.candidateFrames = 0
    this.octaveChangeFrames = 0
    this.lastDominantInterval = 500
    this.prevBass = 0
    this.prevMid = 0
    this.prevTreble = 0
    // 💀 WAVE 1156: Reset diagnostic counters
    this.diagnosticFrames = 0
    this.kicksDetectedTotal = 0
    this.state = this.createInitialState()
  }
}
