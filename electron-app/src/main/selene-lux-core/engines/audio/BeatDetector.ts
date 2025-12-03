/**
 * 🥁 BEAT DETECTOR
 * Detecta BPM, beats y fases rítmicas
 * 
 * Basado en: DrumPatternEngine de Auditoría 2
 * - Detección de BPM en tiempo real
 * - Tracking de fase del beat
 * - Detección de kicks, snares, hihats
 */

import type {
  AudioMetrics,
  AudioConfig,
} from '../../types'

/**
 * Estado del detector de beats
 */
export interface BeatState {
  bpm: number
  confidence: number
  phase: number           // 0-1 (posición en el beat)
  onBeat: boolean
  beatCount: number
  lastBeatTime: number
  
  // Detección de instrumentos
  kickDetected: boolean
  snareDetected: boolean
  hihatDetected: boolean
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
 * 🥁 BeatDetector
 * Detecta y trackea el ritmo del audio
 */
export class BeatDetector {
  private state: BeatState
  private peakHistory: PeakHistory[] = []
  private readonly maxPeakHistory = 50
  
  // Configuración
  private readonly minBpm: number
  private readonly maxBpm: number
  
  // Umbrales de detección
  private kickThreshold = 0.7
  private snareThreshold = 0.6
  private hihatThreshold = 0.5
  
  // Energía previa para detección de transientes
  private prevBass = 0
  private prevMid = 0
  private prevTreble = 0
  
  constructor(config: AudioConfig) {
    this.minBpm = config.minBpm || 60
    this.maxBpm = config.maxBpm || 180
    
    this.state = {
      bpm: 120,           // Default BPM
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
    }
  }
  
  /**
   * Procesar frame de audio
   */
  process(metrics: AudioMetrics): BeatState {
    const now = metrics.timestamp
    
    // Detectar transientes (cambios bruscos)
    const bassTransient = metrics.bass - this.prevBass
    const midTransient = metrics.mid - this.prevMid
    const trebleTransient = metrics.treble - this.prevTreble
    
    // Detectar instrumentos
    this.state.kickDetected = bassTransient > this.kickThreshold && metrics.bass > 0.5
    this.state.snareDetected = midTransient > this.snareThreshold && metrics.mid > 0.4
    this.state.hihatDetected = trebleTransient > this.hihatThreshold && metrics.treble > 0.3
    
    // Registrar picos para análisis de BPM
    if (this.state.kickDetected || (bassTransient > 0.3 && metrics.bass > 0.6)) {
      this.recordPeak(now, metrics.energy, 'kick')
    }
    
    // Calcular BPM desde historial de picos
    this.updateBpm(now)
    
    // Actualizar fase del beat
    this.updatePhase(now)
    
    // Detectar si estamos "en el beat"
    this.state.onBeat = this.state.phase < 0.1 || this.state.phase > 0.9
    
    // Guardar valores anteriores
    this.prevBass = metrics.bass
    this.prevMid = metrics.mid
    this.prevTreble = metrics.treble
    
    return { ...this.state }
  }
  
  /**
   * Registrar un pico detectado
   */
  private recordPeak(time: number, energy: number, type: PeakHistory['type']): void {
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
   * Calcular BPM desde historial de picos
   */
  private updateBpm(now: number): void {
    // Necesitamos al menos 4 picos para calcular
    const kicks = this.peakHistory.filter(p => p.type === 'kick')
    if (kicks.length < 4) return
    
    // Calcular intervalos entre kicks
    const intervals: number[] = []
    for (let i = 1; i < kicks.length; i++) {
      const interval = kicks[i].time - kicks[i - 1].time
      // Filtrar intervalos razonables (200ms - 2000ms = 30-300 BPM)
      if (interval > 200 && interval < 2000) {
        intervals.push(interval)
      }
    }
    
    if (intervals.length < 3) return
    
    // Calcular media de intervalos
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const calculatedBpm = 60000 / avgInterval
    
    // Verificar que está en rango
    if (calculatedBpm >= this.minBpm && calculatedBpm <= this.maxBpm) {
      // Media móvil para suavizar
      this.state.bpm = this.state.bpm * 0.8 + calculatedBpm * 0.2
      
      // Calcular confianza basada en consistencia
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
      const stdDev = Math.sqrt(variance)
      this.state.confidence = Math.max(0, 1 - (stdDev / avgInterval))
    }
  }
  
  /**
   * Actualizar fase del beat (0-1)
   */
  private updatePhase(now: number): void {
    const beatDuration = 60000 / this.state.bpm // ms por beat
    const timeSinceLastBeat = now - this.state.lastBeatTime
    
    // Calcular fase (0-1)
    this.state.phase = (timeSinceLastBeat % beatDuration) / beatDuration
  }
  
  /**
   * Forzar BPM manualmente (para sync externo)
   */
  setBpm(bpm: number): void {
    if (bpm >= this.minBpm && bpm <= this.maxBpm) {
      this.state.bpm = bpm
      this.state.confidence = 1.0
    }
  }
  
  /**
   * Tap tempo - usuario marca el beat manualmente
   */
  tap(timestamp: number): void {
    this.recordPeak(timestamp, 1.0, 'kick')
    this.updateBpm(timestamp)
  }
  
  /**
   * Obtener estado actual
   */
  getState(): BeatState {
    return { ...this.state }
  }
  
  /**
   * Reset detector
   */
  reset(): void {
    this.peakHistory = []
    this.state = {
      bpm: 120,
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
    }
  }
}
