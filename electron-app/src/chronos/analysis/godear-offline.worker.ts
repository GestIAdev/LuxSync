/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 WAVE 2080: GODEAR OFFLINE WEB WORKER — THE GHOST IN THE MACHINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Real Web Worker for offline audio analysis.
 * Runs GodEarAnalyzer (Cooley-Tukey FFT + LR4 filters) in a DEDICATED THREAD.
 * 
 * The main thread sends raw Float32Array audio samples via postMessage
 * with Transferable Objects (zero-copy). This worker processes the entire
 * pipeline (waveform → heatmap → beats → sections → transients) without
 * blocking the UI.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────┐     postMessage      ┌─────────────────────────┐
 * │   Main Thread       │  ──────────────────►  │  Web Worker (this file) │
 * │   (React/Renderer)  │  ◄──────────────────  │  GodEarAnalyzer + FFT   │
 * │   useAudioLoader    │   progress/result     │  LR4 filters + bands    │
 * └─────────────────────┘                       └─────────────────────────┘
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). Real FFT. Real DSP.
 * 
 * @module chronos/analysis/godear-offline.worker
 * @version WAVE 2080
 */

import { GodEarAnalyzer } from '../../workers/GodEarFFT'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TYPES (mirrored from GodEarOffline — worker can't share TS types at runtime)
// ═══════════════════════════════════════════════════════════════════════════

interface OfflineAnalysisConfig {
  waveformSamplesPerSecond: number
  heatmapResolutionMs: number
  fftWindowSize: number
  fftOverlap: number
  beatSensitivity: number
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

type SectionType = 
  | 'intro' | 'verse' | 'chorus' | 'bridge'
  | 'breakdown' | 'buildup' | 'drop' | 'outro' | 'unknown'

// ═══════════════════════════════════════════════════════════════════════════
// 📡 WORKER MESSAGE PROTOCOL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Messages FROM main thread TO worker
 */
interface WorkerInMessage {
  type: 'analyze'
  /** Raw mono Float32Array samples (transferred, not copied) */
  monoSamples: Float32Array
  sampleRate: number
  duration: number
  config: OfflineAnalysisConfig
}

/**
 * Messages FROM worker TO main thread
 */
type WorkerOutMessage = 
  | { type: 'progress'; phase: string; progress: number; message: string }
  | { type: 'complete'; result: AnalysisResult }
  | { type: 'error'; error: string }

interface AnalysisResult {
  durationMs: number
  waveform: {
    samplesPerSecond: number
    peaks: number[]
    rms: number[]
  }
  energyHeatmap: {
    resolutionMs: number
    energy: number[]
    bass: number[]
    high: number[]
    flux: number[]
    subBass: number[]
    bassReal: number[]
    lowMid: number[]
    mid: number[]
    highMid: number[]
    treble: number[]
    ultraAir: number[]
    spectralCentroid: number[]
    spectralFlatness: number[]
  }
  beatGrid: {
    bpm: number
    firstBeatMs: number
    timeSignature: number
    beats: number[]
    downbeats: number[]
    confidence: number
  }
  sections: Array<{
    type: SectionType
    startMs: number
    endMs: number
    confidence: number
    avgEnergy: number
  }>
  transients: number[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 📡 POST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function reportProgress(phase: string, progress: number, message: string) {
  const msg: WorkerOutMessage = { type: 'progress', phase, progress, message }
  self.postMessage(msg)
}

function reportComplete(result: AnalysisResult) {
  const msg: WorkerOutMessage = { type: 'complete', result }
  self.postMessage(msg)
}

function reportError(error: string) {
  const msg: WorkerOutMessage = { type: 'error', error }
  self.postMessage(msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 ANALYSIS FUNCTIONS (self-contained in worker)
// ═══════════════════════════════════════════════════════════════════════════

function nearestPowerOf2(n: number): number {
  let power = 1
  while (power * 2 <= n) {
    power *= 2
  }
  return power
}

/**
 * Extract waveform peaks and RMS
 */
function extractWaveform(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): AnalysisResult['waveform'] {
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
 * 🩻 Extract energy heatmap with GodEarFFT REAL
 */
function extractEnergyHeatmap(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig
): AnalysisResult['energyHeatmap'] {
  const resolutionSamples = Math.floor(sampleRate * config.heatmapResolutionMs / 1000)
  const numPoints = Math.ceil(samples.length / resolutionSamples)
  
  const fftSize = Math.max(2048, nearestPowerOf2(config.fftWindowSize > 0 ? config.fftWindowSize : 2048))
  const analyzer = new GodEarAnalyzer(sampleRate, fftSize)
  analyzer.configure({ useAGC: false, useStereo: false })
  
  const energy = new Array<number>(numPoints)
  const bass = new Array<number>(numPoints)
  const high = new Array<number>(numPoints)
  const flux = new Array<number>(numPoints)
  
  const subBass = new Array<number>(numPoints)
  const bassReal = new Array<number>(numPoints)
  const lowMid = new Array<number>(numPoints)
  const mid = new Array<number>(numPoints)
  const highMid = new Array<number>(numPoints)
  const treble = new Array<number>(numPoints)
  const ultraAir = new Array<number>(numPoints)
  const centroid = new Array<number>(numPoints)
  const flatness = new Array<number>(numPoints)
  
  let prevTotalEnergy = 0
  
  for (let i = 0; i < numPoints; i++) {
    const start = i * resolutionSamples
    const end = Math.min(start + fftSize, samples.length)
    
    const window = new Float32Array(fftSize)
    const copyLength = Math.min(fftSize, end - start)
    window.set(samples.subarray(start, start + copyLength))
    
    const spectrum = analyzer.analyze(window)
    
    subBass[i] = spectrum.bands.subBass
    bassReal[i] = spectrum.bands.bass
    lowMid[i] = spectrum.bands.lowMid
    mid[i] = spectrum.bands.mid
    highMid[i] = spectrum.bands.highMid
    treble[i] = spectrum.bands.treble
    ultraAir[i] = spectrum.bands.ultraAir
    
    centroid[i] = spectrum.spectral.centroid
    flatness[i] = spectrum.spectral.flatness
    
    bass[i] = Math.min(1, (spectrum.bands.subBass + spectrum.bands.bass) * 2)
    high[i] = Math.min(1, (spectrum.bands.treble + spectrum.bands.ultraAir) * 2)
    energy[i] = Math.min(1, spectrum.totalEnergy * 3)
    
    flux[i] = Math.abs(spectrum.totalEnergy - prevTotalEnergy)
    prevTotalEnergy = spectrum.totalEnergy
    
    // Report progress every ~5%
    if (i % Math.max(1, Math.ceil(numPoints / 20)) === 0) {
      reportProgress('energy', Math.round((i / numPoints) * 100), `FFT analysis ${Math.round((i / numPoints) * 100)}%...`)
    }
  }
  
  // Normalize flux
  const maxFlux = Math.max(...flux)
  if (maxFlux > 0) {
    for (let i = 0; i < flux.length; i++) {
      flux[i] /= maxFlux
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🩻 WAVE 2541.1: PEAK NORMALIZATION — Scale all bands to 0-1 range
  //
  // The GodEarAnalyzer with useAGC=false produces raw RMS values that are
  // typically in the 0.01-0.05 range. The TitanEngine (and EngineAudioMetrics
  // interface) expects ALL bands in 0-1 normalized range, matching what the
  // live AGC produces. Without this, phantom buffer injection feeds near-zero
  // values → Bass=0, Mids=0 in the heatmap → dead fixtures.
  //
  // Strategy: Per-band peak normalization across the entire track.
  // Each band's maximum becomes 1.0, preserving relative dynamics within
  // each band. This is deterministic (unlike live AGC) and produces
  // consistent results regardless of input level.
  
  // 🩻 WAVE 2541.3: RAW PEAK DIAGNOSTIC — Log raw peaks BEFORE normalization
  // This identifies any band that is genuinely zero in the raw FFT output.
  const rawPeak = (arr: number[]): number => {
    let peak = 0
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
    }
    return peak
  }
  reportProgress('energy', 95, 
    `🩻 RAW PEAKS: subBass=${rawPeak(subBass).toFixed(6)} bass=${rawPeak(bassReal).toFixed(6)} ` +
    `lowMid=${rawPeak(lowMid).toFixed(6)} MID=${rawPeak(mid).toFixed(6)} ` +
    `highMid=${rawPeak(highMid).toFixed(6)} treble=${rawPeak(treble).toFixed(6)} ` +
    `ultraAir=${rawPeak(ultraAir).toFixed(6)}`
  )
  // ═══════════════════════════════════════════════════════════════════════
  const normalizeBand = (arr: number[]): void => {
    let peak = 0
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
    }
    if (peak > 0) {
      const inv = 1 / peak
      for (let i = 0; i < arr.length; i++) {
        arr[i] *= inv
      }
    }
  }
  
  // Normalize legacy combined fields
  normalizeBand(energy)
  normalizeBand(bass)
  normalizeBand(high)
  
  // Normalize 7 tactical bands
  normalizeBand(subBass)
  normalizeBand(bassReal)
  normalizeBand(lowMid)
  normalizeBand(mid)
  normalizeBand(highMid)
  normalizeBand(treble)
  normalizeBand(ultraAir)
  
  analyzer.reset()
  
  return {
    resolutionMs: config.heatmapResolutionMs,
    energy,
    bass,
    high,
    flux,
    subBass,
    bassReal,
    lowMid,
    mid,
    highMid,
    treble,
    ultraAir,
    spectralCentroid: centroid,
    spectralFlatness: flatness,
  }
}

/**
 * Estimate BPM from onset intervals
 */
function estimateBpm(onsets: number[]): number {
  if (onsets.length < 4) return 120
  
  const intervals: number[] = []
  for (let i = 1; i < onsets.length && i < 100; i++) {
    const interval = onsets[i] - onsets[i - 1]
    if (interval > 200 && interval < 2000) {
      intervals.push(interval)
    }
  }
  
  if (intervals.length < 3) return 120
  
  const histogram = new Map<number, number>()
  for (const interval of intervals) {
    const quantized = Math.round(interval / 10) * 10
    histogram.set(quantized, (histogram.get(quantized) || 0) + 1)
  }
  
  let mostCommonInterval = 500
  let maxCount = 0
  for (const [interval, count] of histogram) {
    if (count > maxCount) {
      maxCount = count
      mostCommonInterval = interval
    }
  }
  
  let bpm = 60000 / mostCommonInterval
  while (bpm < 80) bpm *= 2
  while (bpm > 180) bpm /= 2
  
  return Math.round(bpm * 10) / 10
}

/**
 * 🩻 Detect beats using real FFT bands
 */
function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  heatmap: AnalysisResult['energyHeatmap'],
  config: OfflineAnalysisConfig
): AnalysisResult['beatGrid'] {
  const onsets: number[] = []
  const threshold = config.beatSensitivity
  
  for (let i = 1; i < heatmap.flux.length - 1; i++) {
    const curr = heatmap.flux[i]
    const prev = heatmap.flux[i - 1]
    const next = heatmap.flux[i + 1]
    
    if (curr > prev && curr > next && curr > threshold) {
      const kickWeight = 1 + (heatmap.subBass[i] + heatmap.bassReal[i]) * 0.8
      if (curr * kickWeight > threshold) {
        onsets.push(i * heatmap.resolutionMs)
      }
    }
  }
  
  const bpm = estimateBpm(onsets)
  const msPerBeat = 60000 / bpm
  const durationMs = (samples.length / sampleRate) * 1000
  
  let firstBeatMs = 0
  if (onsets.length > 0) {
    let bestOffset = 0
    let bestScore = 0
    
    for (const onset of onsets.slice(0, 20)) {
      let score = 0
      for (const other of onsets) {
        const dist = (other - onset) % msPerBeat
        const alignDist = Math.min(dist, msPerBeat - dist)
        if (alignDist < msPerBeat * 0.1) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestOffset = onset
      }
    }
    firstBeatMs = bestOffset % msPerBeat
  }
  
  const beats: number[] = []
  const downbeats: number[] = []
  
  for (let t = firstBeatMs; t < durationMs; t += msPerBeat) {
    beats.push(t)
    if ((beats.length - 1) % 4 === 0) downbeats.push(t)
  }
  
  let alignedOnsets = 0
  for (const onset of onsets) {
    const nearestBeat = beats.find(b => Math.abs(b - onset) < msPerBeat * 0.15)
    if (nearestBeat !== undefined) alignedOnsets++
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
 * 🩻 Detect sections with spectral metrics
 */
function detectSections(
  heatmap: AnalysisResult['energyHeatmap'],
  beatGrid: AnalysisResult['beatGrid'],
  durationSec: number,
  config: OfflineAnalysisConfig
): AnalysisResult['sections'] {
  const sections: AnalysisResult['sections'] = []
  const durationMs = durationSec * 1000
  
  const msPerBeat = 60000 / beatGrid.bpm
  const windowMs = msPerBeat * 8
  const windowPoints = Math.ceil(windowMs / heatmap.resolutionMs)
  
  const hasCentroid = heatmap.spectralCentroid && heatmap.spectralCentroid.length > 0
  const hasSubBass = heatmap.subBass && heatmap.subBass.length > 0
  
  const windowEnergies: Array<{
    startMs: number
    avgEnergy: number
    avgCentroid: number
    avgSubBass: number
  }> = []
  
  for (let i = 0; i < heatmap.energy.length; i += windowPoints) {
    const endIdx = Math.min(i + windowPoints, heatmap.energy.length)
    let sumEnergy = 0
    let sumCentroid = 0
    let sumSubBass = 0
    const count = endIdx - i
    
    for (let j = i; j < endIdx; j++) {
      sumEnergy += heatmap.energy[j]
      if (hasCentroid) sumCentroid += heatmap.spectralCentroid[j]
      if (hasSubBass) sumSubBass += heatmap.subBass[j]
    }
    
    windowEnergies.push({
      startMs: i * heatmap.resolutionMs,
      avgEnergy: sumEnergy / count,
      avgCentroid: hasCentroid ? sumCentroid / count : 0,
      avgSubBass: hasSubBass ? sumSubBass / count : 0,
    })
  }
  
  const globalAvgEnergy = windowEnergies.reduce((a, b) => a + b.avgEnergy, 0) / windowEnergies.length
  const globalAvgCentroid = hasCentroid
    ? windowEnergies.reduce((a, b) => a + b.avgCentroid, 0) / windowEnergies.length
    : 0
  
  let currentSection: AnalysisResult['sections'][0] | null = null
  
  for (let i = 0; i < windowEnergies.length; i++) {
    const w = windowEnergies[i]
    const relativeEnergy = w.avgEnergy / globalAvgEnergy
    
    let sectionType: SectionType
    let confidence = 0.7
    
    if (relativeEnergy < 0.5) {
      if (relativeEnergy < 0.3) {
        sectionType = 'breakdown'
        confidence = 0.8
      } else {
        sectionType = 'bridge'
      }
    } else if (relativeEnergy > 1.5) {
      if (hasSubBass && w.avgSubBass > 0.3) {
        sectionType = 'drop'
        confidence = 0.85
      } else {
        sectionType = 'chorus'
        confidence = 0.75
      }
    } else if (relativeEnergy > 1.2) {
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
    
    // Buildup detection
    if (i > 0 && i < windowEnergies.length - 1) {
      const prevEnergy = windowEnergies[i - 1].avgEnergy
      const nextEnergy = windowEnergies[i + 1]?.avgEnergy ?? w.avgEnergy
      
      const energyRising = nextEnergy > w.avgEnergy * 1.3 && w.avgEnergy > prevEnergy * 1.1
      const centroidRising = hasCentroid && i > 0
        ? w.avgCentroid > windowEnergies[i - 1].avgCentroid * 1.15
        : false
      
      if (energyRising || (energyRising && centroidRising)) {
        sectionType = 'buildup'
        confidence = centroidRising ? 0.9 : 0.75
      }
    }
    
    const endMs = Math.min(w.startMs + windowMs, durationMs)
    
    if (currentSection && currentSection.type === sectionType) {
      currentSection.endMs = endMs
      currentSection.avgEnergy = (currentSection.avgEnergy + w.avgEnergy) / 2
      currentSection.confidence = Math.max(currentSection.confidence, confidence)
    } else {
      if (currentSection) sections.push(currentSection)
      currentSection = {
        type: sectionType,
        startMs: w.startMs,
        endMs,
        confidence,
        avgEnergy: w.avgEnergy,
      }
    }
  }
  
  if (currentSection) sections.push(currentSection)
  
  return sections
}

/**
 * 🩻 Detect transients with slope-based onset detection
 */
function detectTransients(
  samples: Float32Array,
  sampleRate: number,
  _config: OfflineAnalysisConfig
): number[] {
  const transients: number[] = []
  const windowSamples = Math.floor(sampleRate * 0.01) // 10ms window
  const hopSamples = Math.floor(windowSamples / 2)
  
  const historyLength = 8
  const energyHistory = new Float32Array(historyLength)
  let historyIndex = 0
  
  for (let i = 0; i < samples.length - windowSamples; i += hopSamples) {
    let sum = 0
    for (let j = i; j < i + windowSamples; j++) {
      sum += samples[j] * samples[j]
    }
    const currentEnergy = Math.sqrt(sum / windowSamples)
    
    energyHistory[historyIndex] = currentEnergy
    historyIndex = (historyIndex + 1) % historyLength
    
    if (i >= hopSamples * 4) {
      const previous = energyHistory[(historyIndex + historyLength - 2) % historyLength]
      const older = energyHistory[(historyIndex + historyLength - 4) % historyLength]
      
      const shortTermSlope = currentEnergy - previous
      const longTermSlope = currentEnergy - older
      
      let avgEnergy = 0
      for (let h = 0; h < historyLength; h++) {
        avgEnergy += energyHistory[h]
      }
      avgEnergy /= historyLength
      
      const slopeThreshold = Math.max(0.05, avgEnergy * 0.3)
      
      if (shortTermSlope > slopeThreshold && longTermSlope > slopeThreshold * 0.5) {
        const timeMs = (i / sampleRate) * 1000
        
        if (transients.length === 0 || timeMs - transients[transients.length - 1] > 50) {
          transients.push(timeMs)
        }
      }
    }
  }
  
  return transients
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 MAIN PIPELINE — ORCHESTRATES ALL PHASES
// ═══════════════════════════════════════════════════════════════════════════

function runAnalysisPipeline(
  monoSamples: Float32Array,
  sampleRate: number,
  duration: number,
  config: OfflineAnalysisConfig
): AnalysisResult {
  // Phase 1: Waveform
  reportProgress('waveform', 0, 'Extracting waveform...')
  const waveform = extractWaveform(monoSamples, sampleRate, config)
  reportProgress('waveform', 100, 'Waveform extracted')
  
  // Phase 2: Energy Heatmap (FFT-heavy — the big one)
  reportProgress('energy', 0, 'FFT spectral analysis...')
  const energyHeatmap = extractEnergyHeatmap(monoSamples, sampleRate, config)
  reportProgress('energy', 100, 'Heatmap generated')
  
  // Phase 3: Beat Detection
  reportProgress('beats', 0, 'Detecting beats...')
  const beatGrid = detectBeats(monoSamples, sampleRate, energyHeatmap, config)
  reportProgress('beats', 100, 'Beat grid detected')
  
  // Phase 4: Section Detection
  reportProgress('sections', 0, 'Detecting sections...')
  const sections = detectSections(energyHeatmap, beatGrid, duration, config)
  reportProgress('sections', 100, 'Sections detected')
  
  // Phase 5: Transient Detection
  reportProgress('transients', 0, 'Detecting transients...')
  const transients = detectTransients(monoSamples, sampleRate, config)
  reportProgress('transients', 100, 'Transients detected')
  
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
// 👻 WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const { type, monoSamples, sampleRate, duration, config } = e.data
  
  if (type !== 'analyze') {
    reportError(`Unknown message type: ${type}`)
    return
  }
  
  try {
    const result = runAnalysisPipeline(monoSamples, sampleRate, duration, config)
    reportComplete(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    reportError(`Worker analysis failed: ${message}`)
  }
}
