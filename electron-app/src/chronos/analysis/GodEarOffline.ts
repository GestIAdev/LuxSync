/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ GODEAR OFFLINE - THE CARTOGRAPHER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2002: THE SYNAPTIC BRIDGE
 * 
 * Análisis offline de audio para el timeline de Chronos.
 * Extrae waveform, beat grid, secciones, y heatmap energético.
 * 
 * DISEÑO:
 * - Corre en Web Worker para no bloquear la UI
 * - Usa algoritmos simplificados para velocidad
 * - Devuelve AnalysisData para pintar el timeline
 * 
 * NOTA: Este NO es el GodEar en tiempo real. Es una versión optimizada
 * para procesar archivos completos de una sola vez.
 * 
 * @module chronos/analysis/GodEarOffline
 * @version 2002.0.0
 */

import type {
  AnalysisData,
  WaveformData,
  HeatmapData,
  BeatGridData,
  DetectedSection,
  SectionType,
  TimeMs,
  NormalizedValue,
} from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface OfflineAnalysisConfig {
  /** Samples por segundo para waveform overview */
  waveformSamplesPerSecond: number
  
  /** Resolución del heatmap en ms */
  heatmapResolutionMs: TimeMs
  
  /** Tamaño de ventana para FFT (potencia de 2) */
  fftWindowSize: number
  
  /** Overlap entre ventanas FFT (0-1) */
  fftOverlap: number
  
  /** Sensibilidad de detección de beats (0-1) */
  beatSensitivity: number
  
  /** Umbral de energía para detección de secciones */
  sectionThreshold: number
}

const DEFAULT_CONFIG: OfflineAnalysisConfig = {
  waveformSamplesPerSecond: 100,
  heatmapResolutionMs: 50,
  fftWindowSize: 2048,
  fftOverlap: 0.5,
  beatSensitivity: 0.6,
  sectionThreshold: 0.15,
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 ANALYSIS RESULT
// ═══════════════════════════════════════════════════════════════════════════

export interface AnalysisProgress {
  phase: 'waveform' | 'energy' | 'beats' | 'sections' | 'transients' | 'complete'
  progress: number
  message: string
}

export type ProgressCallback = (progress: AnalysisProgress) => void

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ GODEAR OFFLINE - MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🗺️ ANALYZE AUDIO FILE
 * 
 * Análisis completo de un AudioBuffer para generar AnalysisData.
 * 
 * @param buffer AudioBuffer decodificado
 * @param config Configuración opcional
 * @param onProgress Callback de progreso
 * @returns AnalysisData para el timeline
 */
export async function analyzeAudioFile(
  buffer: AudioBuffer,
  config: Partial<OfflineAnalysisConfig> = {},
  onProgress?: ProgressCallback
): Promise<AnalysisData> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  const report = (phase: AnalysisProgress['phase'], progress: number, message: string) => {
    onProgress?.({ phase, progress, message })
  }
  
  // Obtener samples mono (mezcla de todos los canales)
  const monoSamples = getMonoSamples(buffer)
  const sampleRate = buffer.sampleRate
  const duration = buffer.duration
  
  // ─────────────────────────────────────────────────────────────────────────
  // 1. WAVEFORM - Extracción de picos
  // ─────────────────────────────────────────────────────────────────────────
  report('waveform', 0, 'Extrayendo waveform...')
  const waveform = extractWaveform(monoSamples, sampleRate, cfg)
  report('waveform', 100, 'Waveform extraída')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 2. ENERGY HEATMAP - Análisis espectral simplificado
  // ─────────────────────────────────────────────────────────────────────────
  report('energy', 0, 'Analizando energía espectral...')
  const energyHeatmap = extractEnergyHeatmap(monoSamples, sampleRate, cfg)
  report('energy', 100, 'Heatmap generado')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 3. BEAT DETECTION - Detección de BPM y beat grid
  // ─────────────────────────────────────────────────────────────────────────
  report('beats', 0, 'Detectando beats...')
  const beatGrid = detectBeats(monoSamples, sampleRate, energyHeatmap, cfg)
  report('beats', 100, 'Beat grid detectado')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 4. SECTION DETECTION - Análisis estructural
  // ─────────────────────────────────────────────────────────────────────────
  report('sections', 0, 'Detectando secciones...')
  const sections = detectSections(energyHeatmap, beatGrid, duration, cfg)
  report('sections', 100, 'Secciones detectadas')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 5. TRANSIENT DETECTION - Hits para snap
  // ─────────────────────────────────────────────────────────────────────────
  report('transients', 0, 'Detectando transientes...')
  const transients = detectTransients(monoSamples, sampleRate, cfg)
  report('transients', 100, 'Transientes detectados')
  
  report('complete', 100, 'Análisis completado')
  
  // Duration in milliseconds
  const durationMs = duration * 1000
  
  return {
    durationMs,
    waveform,
    energyHeatmap,
    beatGrid,
    sections,
    transients,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mezcla todos los canales a mono
 */
function getMonoSamples(buffer: AudioBuffer): Float32Array {
  const length = buffer.length
  const mono = new Float32Array(length)
  const numChannels = buffer.numberOfChannels
  
  // Obtener primer canal
  buffer.copyFromChannel(mono, 0)
  
  // Si hay más canales, promediar
  if (numChannels > 1) {
    const temp = new Float32Array(length)
    for (let ch = 1; ch < numChannels; ch++) {
      buffer.copyFromChannel(temp, ch)
      for (let i = 0; i < length; i++) {
        mono[i] += temp[i]
      }
    }
    // Normalizar
    for (let i = 0; i < length; i++) {
      mono[i] /= numChannels
    }
  }
  
  return mono
}

/**
 * Extrae waveform overview (picos y RMS)
 */
function extractWaveform(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): WaveformData {
  const samplesPerPoint = Math.floor(sampleRate / config.waveformSamplesPerSecond)
  const numPoints = Math.ceil(samples.length / samplesPerPoint)
  
  const peaks = new Array<number>(numPoints)
  const rms = new Array<number>(numPoints)
  
  for (let i = 0; i < numPoints; i++) {
    const start = i * samplesPerPoint
    const end = Math.min(start + samplesPerPoint, samples.length)
    
    let maxPeak = 0
    let sumSquares = 0
    
    for (let j = start; j < end; j++) {
      const val = Math.abs(samples[j])
      if (val > maxPeak) maxPeak = val
      sumSquares += samples[j] * samples[j]
    }
    
    peaks[i] = Math.min(1, maxPeak)
    rms[i] = Math.min(1, Math.sqrt(sumSquares / (end - start)))
  }
  
  return {
    samplesPerSecond: config.waveformSamplesPerSecond,
    peaks,
    rms,
  }
}

/**
 * Extrae heatmap de energía por bandas
 */
function extractEnergyHeatmap(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): HeatmapData {
  const resolutionSamples = Math.floor(sampleRate * config.heatmapResolutionMs / 1000)
  const numPoints = Math.ceil(samples.length / resolutionSamples)
  
  const energy = new Array<number>(numPoints)
  const bass = new Array<number>(numPoints)
  const high = new Array<number>(numPoints)
  const flux = new Array<number>(numPoints)
  
  // FFT simplificado: dividir en bandas sin FFT real
  // (Para FFT real necesitaríamos una librería externa)
  // Usamos aproximación temporal: bass = sample rate bajo, high = sample rate alto
  
  let prevEnergy = 0
  
  for (let i = 0; i < numPoints; i++) {
    const start = i * resolutionSamples
    const end = Math.min(start + resolutionSamples, samples.length)
    
    // Calcular energía RMS
    let sumSquares = 0
    let lowSum = 0
    let highSum = 0
    let prevSample = 0
    let zeroCrossings = 0
    
    for (let j = start; j < end; j++) {
      const val = samples[j]
      sumSquares += val * val
      
      // Aproximación de bass: samples grandes (baja frecuencia)
      lowSum += Math.abs(val)
      
      // Zero crossings → alta frecuencia
      if ((val >= 0 && prevSample < 0) || (val < 0 && prevSample >= 0)) {
        zeroCrossings++
      }
      prevSample = val
    }
    
    const blockSize = end - start
    const blockEnergy = Math.sqrt(sumSquares / blockSize)
    
    energy[i] = Math.min(1, blockEnergy * 3) // Escalar para visibilidad
    
    // Bass: energía con pocos zero crossings
    const zcRate = zeroCrossings / blockSize
    bass[i] = Math.min(1, blockEnergy * 3 * Math.max(0, 1 - zcRate * 50))
    
    // High: energía con muchos zero crossings
    high[i] = Math.min(1, blockEnergy * 3 * Math.min(1, zcRate * 20))
    
    // Flux: cambio de energía respecto al anterior
    flux[i] = Math.abs(blockEnergy - prevEnergy)
    prevEnergy = blockEnergy
  }
  
  // Normalizar flux
  const maxFlux = Math.max(...flux)
  if (maxFlux > 0) {
    for (let i = 0; i < flux.length; i++) {
      flux[i] /= maxFlux
    }
  }
  
  return {
    resolutionMs: config.heatmapResolutionMs,
    energy,
    bass,
    high,
    flux,
  }
}

/**
 * Detecta beats y construye beat grid
 */
function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  heatmap: HeatmapData,
  config: OfflineAnalysisConfig
): BeatGridData {
  // Usar onset detection simplificado sobre el heatmap
  const onsets: TimeMs[] = []
  const threshold = config.beatSensitivity
  
  // Detectar picos de flux (cambios de energía = onsets)
  for (let i = 1; i < heatmap.flux.length - 1; i++) {
    const curr = heatmap.flux[i]
    const prev = heatmap.flux[i - 1]
    const next = heatmap.flux[i + 1]
    
    // Es pico local y supera threshold
    if (curr > prev && curr > next && curr > threshold) {
      // Priorizar si coincide con bass
      const bassWeight = 1 + heatmap.bass[i] * 0.5
      if (curr * bassWeight > threshold) {
        onsets.push(i * heatmap.resolutionMs)
      }
    }
  }
  
  // Estimar BPM desde intervalos entre onsets
  const bpm = estimateBpm(onsets)
  
  // Construir beat grid desde el BPM estimado
  const msPerBeat = 60000 / bpm
  const durationMs = (samples.length / sampleRate) * 1000
  
  // Encontrar el primer beat (alinear con onset más cercano)
  let firstBeatMs = 0
  if (onsets.length > 0) {
    // Buscar onset que mejor alinee con la grilla
    let bestOffset = 0
    let bestScore = 0
    
    for (const onset of onsets.slice(0, 20)) {
      let score = 0
      for (const other of onsets) {
        const dist = (other - onset) % msPerBeat
        const alignDist = Math.min(dist, msPerBeat - dist)
        if (alignDist < msPerBeat * 0.1) {
          score++
        }
      }
      if (score > bestScore) {
        bestScore = score
        bestOffset = onset
      }
    }
    firstBeatMs = bestOffset % msPerBeat
  }
  
  // Generar beat grid
  const beats: TimeMs[] = []
  const downbeats: TimeMs[] = []
  
  for (let t = firstBeatMs; t < durationMs; t += msPerBeat) {
    beats.push(t)
    
    // Downbeat cada 4 beats (asumiendo 4/4)
    if ((beats.length - 1) % 4 === 0) {
      downbeats.push(t)
    }
  }
  
  // Calcular confianza basada en cuántos onsets alinean con la grilla
  let alignedOnsets = 0
  for (const onset of onsets) {
    const nearestBeat = beats.find(b => Math.abs(b - onset) < msPerBeat * 0.15)
    if (nearestBeat !== undefined) {
      alignedOnsets++
    }
  }
  const confidence = onsets.length > 0 ? alignedOnsets / onsets.length : 0.5
  
  return {
    bpm,
    firstBeatMs,
    timeSignature: 4,
    beats,
    downbeats,
    confidence,
  }
}

/**
 * Estima BPM desde intervalos entre onsets
 */
function estimateBpm(onsets: TimeMs[]): number {
  if (onsets.length < 4) {
    return 120 // Default
  }
  
  // Calcular intervalos
  const intervals: number[] = []
  for (let i = 1; i < onsets.length && i < 100; i++) {
    const interval = onsets[i] - onsets[i - 1]
    if (interval > 200 && interval < 2000) { // 30-300 BPM range
      intervals.push(interval)
    }
  }
  
  if (intervals.length < 3) {
    return 120
  }
  
  // Histograma de intervalos (cuantizado a 10ms)
  const histogram = new Map<number, number>()
  for (const interval of intervals) {
    const quantized = Math.round(interval / 10) * 10
    histogram.set(quantized, (histogram.get(quantized) || 0) + 1)
  }
  
  // Encontrar intervalo más común
  let mostCommonInterval = 500 // 120 BPM default
  let maxCount = 0
  for (const [interval, count] of histogram) {
    if (count > maxCount) {
      maxCount = count
      mostCommonInterval = interval
    }
  }
  
  // Convertir a BPM
  let bpm = 60000 / mostCommonInterval
  
  // Ajustar a rango razonable (80-180)
  while (bpm < 80) bpm *= 2
  while (bpm > 180) bpm /= 2
  
  return Math.round(bpm * 10) / 10
}

/**
 * Detecta secciones estructurales
 */
function detectSections(
  heatmap: HeatmapData,
  beatGrid: BeatGridData,
  durationSec: number,
  config: OfflineAnalysisConfig
): DetectedSection[] {
  const sections: DetectedSection[] = []
  const durationMs = durationSec * 1000
  
  // Calcular energía promedio por ventana de 8 beats (~4-8 segundos)
  const msPerBeat = 60000 / beatGrid.bpm
  const windowMs = msPerBeat * 8
  const windowPoints = Math.ceil(windowMs / heatmap.resolutionMs)
  
  const windowEnergies: { startMs: TimeMs; avgEnergy: number }[] = []
  
  for (let i = 0; i < heatmap.energy.length; i += windowPoints) {
    const endIdx = Math.min(i + windowPoints, heatmap.energy.length)
    let sum = 0
    for (let j = i; j < endIdx; j++) {
      sum += heatmap.energy[j]
    }
    const avg = sum / (endIdx - i)
    windowEnergies.push({
      startMs: i * heatmap.resolutionMs,
      avgEnergy: avg,
    })
  }
  
  // Clasificar secciones basándose en energía
  const globalAvgEnergy = windowEnergies.reduce((a, b) => a + b.avgEnergy, 0) / windowEnergies.length
  
  let currentSection: DetectedSection | null = null
  
  for (let i = 0; i < windowEnergies.length; i++) {
    const w = windowEnergies[i]
    const relativeEnergy = w.avgEnergy / globalAvgEnergy
    
    // Clasificar tipo
    let sectionType: SectionType
    if (relativeEnergy < 0.5) {
      sectionType = relativeEnergy < 0.3 ? 'breakdown' : 'bridge'
    } else if (relativeEnergy > 1.5) {
      sectionType = 'drop'
    } else if (relativeEnergy > 1.2) {
      sectionType = 'chorus'
    } else if (i === 0 && relativeEnergy < 0.8) {
      sectionType = 'intro'
    } else if (i === windowEnergies.length - 1 && relativeEnergy < 0.7) {
      sectionType = 'outro'
    } else {
      sectionType = 'verse'
    }
    
    // Detectar buildups (energía creciente)
    if (i > 0 && i < windowEnergies.length - 1) {
      const prevEnergy = windowEnergies[i - 1].avgEnergy
      const nextEnergy = windowEnergies[i + 1]?.avgEnergy ?? w.avgEnergy
      if (nextEnergy > w.avgEnergy * 1.3 && w.avgEnergy > prevEnergy * 1.1) {
        sectionType = 'buildup'
      }
    }
    
    const endMs = Math.min(w.startMs + windowMs, durationMs)
    
    // ¿Continuar sección anterior o crear nueva?
    if (currentSection && currentSection.type === sectionType) {
      // Extender sección actual
      currentSection.endMs = endMs
      currentSection.avgEnergy = (currentSection.avgEnergy + w.avgEnergy) / 2
    } else {
      // Cerrar anterior y crear nueva
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        type: sectionType,
        startMs: w.startMs,
        endMs,
        confidence: 0.7, // Confianza base
        avgEnergy: w.avgEnergy,
      }
    }
  }
  
  // Cerrar última sección
  if (currentSection) {
    sections.push(currentSection)
  }
  
  return sections
}

/**
 * Detecta transientes (hits) para snap
 */
function detectTransients(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): TimeMs[] {
  const transients: TimeMs[] = []
  const windowSamples = Math.floor(sampleRate * 0.01) // 10ms window
  const hopSamples = Math.floor(windowSamples / 2)
  
  let prevEnergy = 0
  
  for (let i = 0; i < samples.length - windowSamples; i += hopSamples) {
    let sum = 0
    for (let j = i; j < i + windowSamples; j++) {
      sum += samples[j] * samples[j]
    }
    const energy = Math.sqrt(sum / windowSamples)
    
    // Transiente si hay salto de energía significativo
    const ratio = prevEnergy > 0.001 ? energy / prevEnergy : 1
    if (ratio > 2.5 && energy > 0.05) {
      const timeMs = (i / sampleRate) * 1000
      
      // Evitar transientes muy cercanos (debounce 50ms)
      if (transients.length === 0 || timeMs - transients[transients.length - 1] > 50) {
        transients.push(timeMs)
      }
    }
    
    prevEnergy = energy
  }
  
  return transients
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧵 WEB WORKER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mensaje para enviar al Worker
 */
export interface GodEarOfflineMessage {
  type: 'analyze'
  audioData: ArrayBuffer
  sampleRate: number
  config?: Partial<OfflineAnalysisConfig>
}

/**
 * Respuesta del Worker
 */
export interface GodEarOfflineResponse {
  type: 'progress' | 'complete' | 'error'
  progress?: AnalysisProgress
  result?: AnalysisData
  error?: string
}

/**
 * Código del Worker como string (para inline worker)
 */
export const WORKER_CODE = `
// Este código se ejecuta en el Web Worker
// TODO: Mover las funciones de análisis aquí cuando se implemente el worker real
self.onmessage = async (e) => {
  const { type, audioData, sampleRate, config } = e.data;
  
  if (type === 'analyze') {
    try {
      // Por ahora, responder con error indicando que use la versión sincrónica
      self.postMessage({
        type: 'error',
        error: 'Worker not implemented yet. Use analyzeAudioFile directly.'
      });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
};
`

/**
 * Crea un Web Worker inline para análisis
 * 
 * NOTA: Por ahora solo es un placeholder. El análisis real se hace
 * en el hilo principal. Para implementar el worker:
 * 1. Mover las funciones de análisis al WORKER_CODE
 * 2. Usar transferable objects para AudioBuffer
 */
export function createOfflineWorker(): Worker {
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  return new Worker(url)
}
