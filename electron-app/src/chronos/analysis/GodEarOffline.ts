/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ GODEAR OFFLINE - THE CARTOGRAPHER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2002: THE SYNAPTIC BRIDGE (Original)
 * WAVE 2077: THE TRANSPLANT — Real GodEarFFT Integration
 * 
 * Análisis offline de audio para el timeline de Chronos.
 * Extrae waveform, beat grid, secciones, y heatmap energético.
 * 
 * WAVE 2077 CHANGES:
 * - extractEnergyHeatmap() ahora usa GodEarAnalyzer REAL (Cooley-Tukey FFT)
 * - 7 bandas tácticas con Linkwitz-Riley LR4 (zero overlap)
 * - Blackman-Harris windowing (-92dB sidelobes)
 * - Spectral centroid + flatness per frame
 * - detectBeats() alimentado con subBass+bass reales
 * - detectTransients() con slope-based onset detection
 * - Legacy bass/high fields mantenidos para compatibilidad
 * 
 * NOTA: Este NO es el GodEar en tiempo real. Es la versión batch
 * para procesar archivos completos de una sola vez.
 * El GodEarFFT real (workers/GodEarFFT.ts) corre en Senses Worker.
 * 
 * @module chronos/analysis/GodEarOffline
 * @version 2077.0.0
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

import { GodEarAnalyzer } from '../../workers/GodEarFFT'

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
  
  // 🛡️ WAVE 2005.2: Helper to yield to event loop periodically
  const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0))
  
  // Obtener samples mono (mezcla de todos los canales)
  const monoSamples = getMonoSamples(buffer)
  const sampleRate = buffer.sampleRate
  const duration = buffer.duration
  
  // 🛡️ WAVE 2005.2: Yield after getting mono samples (heavy operation)
  await yieldToEventLoop()
  
  // ─────────────────────────────────────────────────────────────────────────
  // 1. WAVEFORM - Extracción de picos
  // ─────────────────────────────────────────────────────────────────────────
  report('waveform', 0, 'Extrayendo waveform...')
  const waveform = extractWaveform(monoSamples, sampleRate, cfg)
  report('waveform', 100, 'Waveform extraída')
  await yieldToEventLoop()
  
  // ─────────────────────────────────────────────────────────────────────────
  // 2. ENERGY HEATMAP - Análisis espectral simplificado
  // ─────────────────────────────────────────────────────────────────────────
  report('energy', 0, 'Analizando energía espectral...')
  const energyHeatmap = extractEnergyHeatmap(monoSamples, sampleRate, cfg)
  report('energy', 100, 'Heatmap generado')
  await yieldToEventLoop()
  
  // ─────────────────────────────────────────────────────────────────────────
  // 3. BEAT DETECTION - Detección de BPM y beat grid
  // ─────────────────────────────────────────────────────────────────────────
  report('beats', 0, 'Detectando beats...')
  const beatGrid = detectBeats(monoSamples, sampleRate, energyHeatmap, cfg)
  report('beats', 100, 'Beat grid detectado')
  await yieldToEventLoop()
  
  // ─────────────────────────────────────────────────────────────────────────
  // 4. SECTION DETECTION - Análisis estructural
  // ─────────────────────────────────────────────────────────────────────────
  report('sections', 0, 'Detectando secciones...')
  const sections = detectSections(energyHeatmap, beatGrid, duration, cfg)
  report('sections', 100, 'Secciones detectadas')
  await yieldToEventLoop()
  
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
 * 🩻 WAVE 2077: Extrae heatmap de energía con GodEarFFT REAL
 * 
 * Reemplaza el zero-crossing rate fake con:
 * - Cooley-Tukey Radix-2 FFT (4096 bins)
 * - Blackman-Harris 4-term windowing (-92dB sidelobes)
 * - Linkwitz-Riley 4th order digital crossovers (24dB/oct)
 * - 7 bandas tácticas con ZERO overlap
 * - Spectral centroid + flatness per frame
 */
function extractEnergyHeatmap(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): HeatmapData {
  const resolutionSamples = Math.floor(sampleRate * config.heatmapResolutionMs / 1000)
  const numPoints = Math.ceil(samples.length / resolutionSamples)
  
  // 🩻 Instantiate GodEarFFT analyzer (LR4 filters initialized once, reused)
  const fftSize = config.fftWindowSize > 0 ? config.fftWindowSize : 2048
  // Use power-of-2 FFT size, minimum 2048 for decent frequency resolution
  const actualFftSize = Math.max(2048, nearestPowerOf2(fftSize))
  const analyzer = new GodEarAnalyzer(sampleRate, actualFftSize)
  // Disable AGC for offline analysis — we want raw values for consistent heatmap
  analyzer.configure({ useAGC: false, useStereo: false })
  
  // Legacy arrays (backwards compatible)
  const energy = new Array<number>(numPoints)
  const bass = new Array<number>(numPoints)
  const high = new Array<number>(numPoints)
  const flux = new Array<number>(numPoints)
  
  // 🩻 WAVE 2077: Tactical 7-band arrays
  const subBassArr = new Array<number>(numPoints)
  const bassRealArr = new Array<number>(numPoints)
  const lowMidArr = new Array<number>(numPoints)
  const midArr = new Array<number>(numPoints)
  const highMidArr = new Array<number>(numPoints)
  const trebleArr = new Array<number>(numPoints)
  const ultraAirArr = new Array<number>(numPoints)
  
  // Spectral metrics per frame
  const centroidArr = new Array<number>(numPoints)
  const flatnessArr = new Array<number>(numPoints)
  
  let prevTotalEnergy = 0
  
  for (let i = 0; i < numPoints; i++) {
    const start = i * resolutionSamples
    const end = Math.min(start + actualFftSize, samples.length)
    
    // Extract window for FFT (pad with zeros if near end of file)
    const window = new Float32Array(actualFftSize)
    const copyLength = Math.min(actualFftSize, end - start)
    window.set(samples.subarray(start, start + copyLength))
    
    // 🩻 Run REAL FFT analysis through GodEarAnalyzer
    const spectrum = analyzer.analyze(window)
    
    // Extract 7 tactical bands (already LR4 filtered, zero overlap)
    subBassArr[i] = spectrum.bands.subBass
    bassRealArr[i] = spectrum.bands.bass
    lowMidArr[i] = spectrum.bands.lowMid
    midArr[i] = spectrum.bands.mid
    highMidArr[i] = spectrum.bands.highMid
    trebleArr[i] = spectrum.bands.treble
    ultraAirArr[i] = spectrum.bands.ultraAir
    
    // Spectral metrics
    centroidArr[i] = spectrum.spectral.centroid
    flatnessArr[i] = spectrum.spectral.flatness
    
    // Legacy fields (combine bands for backwards compatibility)
    // bass = subBass + bass (what the old zero-crossing tried to approximate)
    bass[i] = Math.min(1, (spectrum.bands.subBass + spectrum.bands.bass) * 2)
    // high = treble + ultraAir
    high[i] = Math.min(1, (spectrum.bands.treble + spectrum.bands.ultraAir) * 2)
    // total energy
    energy[i] = Math.min(1, spectrum.totalEnergy * 3)
    
    // Spectral flux — real change in total energy between frames
    flux[i] = Math.abs(spectrum.totalEnergy - prevTotalEnergy)
    prevTotalEnergy = spectrum.totalEnergy
  }
  
  // Normalize flux to 0-1
  const maxFlux = Math.max(...flux)
  if (maxFlux > 0) {
    for (let i = 0; i < flux.length; i++) {
      flux[i] /= maxFlux
    }
  }
  
  // Reset analyzer (free pre-computed tables)
  analyzer.reset()
  
  return {
    resolutionMs: config.heatmapResolutionMs,
    energy,
    bass,
    high,
    flux,
    // 🩻 WAVE 2077: Tactical bands
    subBass: subBassArr,
    bassReal: bassRealArr,
    lowMid: lowMidArr,
    mid: midArr,
    highMid: highMidArr,
    treble: trebleArr,
    ultraAir: ultraAirArr,
    spectralCentroid: centroidArr,
    spectralFlatness: flatnessArr,
  }
}

/**
 * Nearest power of 2 (for FFT size)
 */
function nearestPowerOf2(n: number): number {
  let power = 1
  while (power * 2 <= n) {
    power *= 2
  }
  return power
}

/**
 * 🩻 WAVE 2077: Detecta beats usando bandas FFT reales
 * 
 * Mejoras sobre WAVE 2002:
 * - Usa subBass+bassReal (FFT LR4) en vez de bass fake (zero-crossing)
 * - Onset detection con flux espectral real
 * - Bass weighting con subBass real (20-60Hz = kicks)
 */
function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  heatmap: HeatmapData,
  config: OfflineAnalysisConfig
): BeatGridData {
  // Usar onset detection sobre el heatmap
  const onsets: TimeMs[] = []
  const threshold = config.beatSensitivity
  
  // Detectar picos de flux (cambios de energía = onsets)
  for (let i = 1; i < heatmap.flux.length - 1; i++) {
    const curr = heatmap.flux[i]
    const prev = heatmap.flux[i - 1]
    const next = heatmap.flux[i + 1]
    
    // Es pico local y supera threshold
    if (curr > prev && curr > next && curr > threshold) {
      // 🩻 WAVE 2077: Usar subBass real (kicks sísmicos 20-60Hz) si disponible
      // Fallback a bass legacy si no hay bandas tácticas
      const kickWeight = heatmap.subBass
        ? 1 + (heatmap.subBass[i] + (heatmap.bassReal?.[i] ?? 0)) * 0.8
        : 1 + heatmap.bass[i] * 0.5
      
      if (curr * kickWeight > threshold) {
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
 * 🩻 WAVE 2077: Detecta secciones con métricas espectrales reales
 * 
 * Mejoras:
 * - Usa spectral centroid para distinguir verse (bajo) vs chorus (brillante)
 * - Usa spectral flatness para detectar breakdowns (noise → tonal)
 * - Buildups detectados por centroid creciente + energía creciente
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
  
  const hasCentroid = heatmap.spectralCentroid && heatmap.spectralCentroid.length > 0
  const hasFlatness = heatmap.spectralFlatness && heatmap.spectralFlatness.length > 0
  const hasSubBass = heatmap.subBass && heatmap.subBass.length > 0
  
  const windowEnergies: { 
    startMs: TimeMs
    avgEnergy: number
    avgCentroid: number
    avgFlatness: number
    avgSubBass: number
  }[] = []
  
  for (let i = 0; i < heatmap.energy.length; i += windowPoints) {
    const endIdx = Math.min(i + windowPoints, heatmap.energy.length)
    let sumEnergy = 0
    let sumCentroid = 0
    let sumFlatness = 0
    let sumSubBass = 0
    const count = endIdx - i
    
    for (let j = i; j < endIdx; j++) {
      sumEnergy += heatmap.energy[j]
      if (hasCentroid) sumCentroid += heatmap.spectralCentroid![j]
      if (hasFlatness) sumFlatness += heatmap.spectralFlatness![j]
      if (hasSubBass) sumSubBass += heatmap.subBass![j]
    }
    
    windowEnergies.push({
      startMs: i * heatmap.resolutionMs,
      avgEnergy: sumEnergy / count,
      avgCentroid: hasCentroid ? sumCentroid / count : 0,
      avgFlatness: hasFlatness ? sumFlatness / count : 0.5,
      avgSubBass: hasSubBass ? sumSubBass / count : 0,
    })
  }
  
  // Global averages for relative comparison
  const globalAvgEnergy = windowEnergies.reduce((a, b) => a + b.avgEnergy, 0) / windowEnergies.length
  const globalAvgCentroid = hasCentroid
    ? windowEnergies.reduce((a, b) => a + b.avgCentroid, 0) / windowEnergies.length
    : 0
  
  let currentSection: DetectedSection | null = null
  
  for (let i = 0; i < windowEnergies.length; i++) {
    const w = windowEnergies[i]
    const relativeEnergy = w.avgEnergy / globalAvgEnergy
    
    // 🩻 WAVE 2077: Enhanced classification with spectral metrics
    let sectionType: SectionType
    let confidence: NormalizedValue = 0.7
    
    if (relativeEnergy < 0.5) {
      if (relativeEnergy < 0.3) {
        sectionType = 'breakdown'
        confidence = 0.8
      } else {
        sectionType = 'bridge'
      }
    } else if (relativeEnergy > 1.5) {
      // High energy — drop or chorus?
      // 🩻 Drop = high energy + high subBass (kicks pounding)
      if (hasSubBass && w.avgSubBass > 0.3) {
        sectionType = 'drop'
        confidence = 0.85
      } else {
        sectionType = 'chorus'
        confidence = 0.75
      }
    } else if (relativeEnergy > 1.2) {
      // 🩻 Chorus vs Drop: chorus has higher centroid (brighter)
      if (hasCentroid && globalAvgCentroid > 0 && w.avgCentroid > globalAvgCentroid * 1.2) {
        sectionType = 'chorus'
        confidence = 0.8
      } else {
        sectionType = 'chorus'
      }
    } else if (i === 0 && relativeEnergy < 0.8) {
      sectionType = 'intro'
      confidence = 0.9
    } else if (i === windowEnergies.length - 1 && relativeEnergy < 0.7) {
      sectionType = 'outro'
      confidence = 0.9
    } else {
      sectionType = 'verse'
    }
    
    // 🩻 WAVE 2077: Buildup detection with spectral evolution
    if (i > 0 && i < windowEnergies.length - 1) {
      const prevEnergy = windowEnergies[i - 1].avgEnergy
      const nextEnergy = windowEnergies[i + 1]?.avgEnergy ?? w.avgEnergy
      
      const energyRising = nextEnergy > w.avgEnergy * 1.3 && w.avgEnergy > prevEnergy * 1.1
      
      // If centroid is also rising → definite buildup (filter sweep effect)
      const centroidRising = hasCentroid && i > 0
        ? w.avgCentroid > windowEnergies[i - 1].avgCentroid * 1.15
        : false
      
      if (energyRising || (energyRising && centroidRising)) {
        sectionType = 'buildup'
        confidence = centroidRising ? 0.9 : 0.75
      }
    }
    
    const endMs = Math.min(w.startMs + windowMs, durationMs)
    
    // ¿Continuar sección anterior o crear nueva?
    if (currentSection && currentSection.type === sectionType) {
      // Extender sección actual
      currentSection.endMs = endMs
      currentSection.avgEnergy = (currentSection.avgEnergy + w.avgEnergy) / 2
      // 🩻 WAVE 2077: Keep highest confidence
      currentSection.confidence = Math.max(currentSection.confidence, confidence)
    } else {
      // Cerrar anterior y crear nueva
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        type: sectionType,
        startMs: w.startMs,
        endMs,
        confidence,
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
 * 🩻 WAVE 2077: Detecta transientes con slope-based onset detection
 * 
 * Mejoras sobre WAVE 2002:
 * - Usa sliding window con historia (no solo frame anterior)
 * - Slope-based: detecta TASA de cambio, no valor absoluto
 * - Threshold adaptativo basado en energía promedio local
 * - Más robusto contra crescendos graduales (no son transientes)
 */
function detectTransients(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): TimeMs[] {
  const transients: TimeMs[] = []
  const windowSamples = Math.floor(sampleRate * 0.01) // 10ms window
  const hopSamples = Math.floor(windowSamples / 2)
  
  // Slope-based detection: circular history buffer
  const historyLength = 8
  const energyHistory = new Float32Array(historyLength)
  let historyIndex = 0
  
  for (let i = 0; i < samples.length - windowSamples; i += hopSamples) {
    let sum = 0
    for (let j = i; j < i + windowSamples; j++) {
      sum += samples[j] * samples[j]
    }
    const currentEnergy = Math.sqrt(sum / windowSamples)
    
    // Store in circular buffer
    energyHistory[historyIndex] = currentEnergy
    historyIndex = (historyIndex + 1) % historyLength
    
    // Calculate slopes (need at least a few frames of history)
    if (i >= hopSamples * 4) {
      const previous = energyHistory[(historyIndex + historyLength - 2) % historyLength]
      const older = energyHistory[(historyIndex + historyLength - 4) % historyLength]
      
      const shortTermSlope = currentEnergy - previous
      const longTermSlope = currentEnergy - older
      
      // Calculate average energy from history
      let avgEnergy = 0
      for (let h = 0; h < historyLength; h++) {
        avgEnergy += energyHistory[h]
      }
      avgEnergy /= historyLength
      
      // Adaptive threshold: onset = rapid positive slope above local average
      const slopeThreshold = Math.max(0.05, avgEnergy * 0.3)
      
      if (shortTermSlope > slopeThreshold && longTermSlope > slopeThreshold * 0.5) {
        const timeMs = (i / sampleRate) * 1000
        
        // Debounce 50ms
        if (transients.length === 0 || timeMs - transients[transients.length - 1] > 50) {
          transients.push(timeMs)
        }
      }
    }
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
