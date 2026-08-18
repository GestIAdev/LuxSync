/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 SHARED ANALYSIS PIPELINE — OPERATION GODEAR UNLEASHED (Phase 4)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extracted from GodEarOffline.ts and godear-offline.worker.ts to eliminate
 * 700 lines of duplicated analysis logic. Both the main-thread fallback path
 * and the Web Worker now import from this single source of truth.
 *
 * PHASE 1 FIX (GC Pressure): extractEnergyHeatmap() now pre-allocates a single
 * Float32Array window buffer OUTSIDE the loop and reuses it via .set() + .fill()
 * for zero-padding. This eliminates ~3,600 garbage allocations (~57 MB) for a
 * 3-minute song.
 *
 * @module chronos/analysis/analysisPipeline
 * @version GODEAR UNLEASHED
 */

import type {
  WaveformData,
  HeatmapData,
  BeatGridData,
  DetectedSection,
  SectionType,
  TimeMs,
  TransientEvent,
} from '../core/types'

import { GodEarAnalyzer } from '../../workers/GodEarFFT'
import { TempoOracle, CONF_FLOOR } from '../../core/senses/bpm/TempoOracle'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface OfflineAnalysisConfig {
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

export const DEFAULT_CONFIG: OfflineAnalysisConfig = {
  waveformSamplesPerSecond: 100,
  heatmapResolutionMs: 50,
  fftWindowSize: 2048,
  fftOverlap: 0.5,
  beatSensitivity: 0.6,
  sectionThreshold: 0.15,
}

/**
 * Optional progress callback for the worker to report progress to the main thread.
 * The main-thread fallback path leaves this undefined.
 */
export type ProgressCallback = (phase: string, progress: number, message: string) => void

/**
 * Result of extractEnergyHeatmap() — includes the heatmap data plus
 * instrument-classified transient events collected during the FFT loop.
 *
 * GODEAR UNLEASHED Phase 2: transient events are collected in the same
 * pass as the heatmap, eliminating the need for a separate detectTransients()
 * pass over the raw samples.
 */
export interface HeatmapExtractionResult {
  heatmap: HeatmapData
  /** 3-band instrument-classified transient events (kick/snare/hihat) */
  transientEvents: TransientEvent[]
  /** Legacy transient timestamps (timeMs of any transient event) */
  transients: TimeMs[]
  /**
   * CHRONOS PURE MEDIAN ANALYSER — definitive global BPM scalar.
   *
   * Computed by running the entire track through the standalone TempoOracle
   * (NSDF autocorrelation, sub-frame parabolic interpolation), accumulating
   * per-frame BPM estimates only when oracle.confidence > CONF_FLOOR, then
   * reducing the collected array via a confidence-weighted median at track
   * end. This yields a single rock-solid value (e.g. 126.04) identical in
   * spirit to Serato/VirtualDJ static analysis — no musical-pocket folding,
   * no live-runtime defense mechanisms. 0 when no frame cleared the gate.
   */
  oracleBpm: number
  /** Aggregate confidence of the oracle BPM (0-1). 0 when no samples collected. */
  oracleConfidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nearest power of 2 (for FFT size)
 */
export function nearestPowerOf2(n: number): number {
  let power = 1
  while (power * 2 <= n) {
    power *= 2
  }
  return power
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae waveform overview (picos y RMS)
 */
export function extractWaveform(
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
 * - LR4-equivalent magnitude-response band masks (frequency-domain, 24dB/oct)
 * - 7 bandas tácticas con ZERO overlap
 * - Spectral centroid + flatness per frame
 *
 * GODEAR UNLEASHED Phase 1: Pre-allocated window buffer — ZERO per-frame
 * allocation. The window Float32Array is created ONCE before the loop and
 * reused via .set() + .fill(0, copyLength) for zero-padding. This eliminates
 * ~3,600 garbage allocations (~57 MB for a 3-minute song).
 */
export function extractEnergyHeatmap(
  samples: Float32Array,
  sampleRate: number,
  config: OfflineAnalysisConfig,
  onProgress?: ProgressCallback,
): HeatmapExtractionResult {
  const resolutionSamples = Math.floor(sampleRate * config.heatmapResolutionMs / 1000)
  const numPoints = Math.ceil(samples.length / resolutionSamples)

  // 🩻 Instantiate GodEarFFT analyzer (LR4-equivalent band masks initialized once, reused)
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

  // ═══════════════════════════════════════════════════════════════════════
  // 🩻 GODEAR UNLEASHED Phase 3: Semantic enrichment telemetry arrays
  // ═══════════════════════════════════════════════════════════════════════
  const saturationArr = new Array<number>(numPoints)
  const whiteNoiseArr = new Array<number>(numPoints)
  const rhythmicVoidArr = new Array<number>(numPoints)
  const rolloffArr = new Array<number>(numPoints)

  // ═══════════════════════════════════════════════════════════════════════
  // 🩻 GODEAR UNLEASHED Phase 2: 3-band transient event collection
  // Collected in the same pass as the heatmap — no separate detectTransients()
  // pass needed. Events are debounced per-instrument to avoid duplicates.
  // ═══════════════════════════════════════════════════════════════════════
  const transientEvents: TransientEvent[] = []
  const transientsLegacy: TimeMs[] = []
  // Per-instrument debounce: last event timeMs (refractory ~80ms like GodEar's
  // SlopeBasedOnsetDetector, but scaled to heatmap resolution)
  const refractoryMs = 80
  let lastKickMs = -refractoryMs
  let lastSnareMs = -refractoryMs
  let lastHihatMs = -refractoryMs

  let prevTotalEnergy = 0

  // ═══════════════════════════════════════════════════════════════════════
  // GODEAR UNLEASHED Phase 1: PRE-ALLOCATED WINDOW BUFFER (zero per-frame GC)
  // ═══════════════════════════════════════════════════════════════════════
  // Before: `const window = new Float32Array(actualFftSize)` inside the loop
  //         → 3,600 allocations × 16 KB = 57.6 MB of garbage per 3-min song.
  // After:  One allocation, reused every frame via .set() + .fill(0, copyLen).
  // ═══════════════════════════════════════════════════════════════════════
  const windowBuffer = new Float32Array(actualFftSize)

  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 CHRONOS PURE MEDIAN ANALYSER — TempoOracle ingestion loop
  // ═══════════════════════════════════════════════════════════════════════
  // Replaces the IntervalBPMTracker bridge. Musical pockets are a LIVE
  // runtime defense mechanism; for the Chronos timeline we require a true
  // global static BPM analysis identical to Serato/VirtualDJ.
  //
  // The TempoOracle runs standalone: NSDF autocorrelation + harmonic ladder
  // + sub-frame parabolic interpolation, zero allocation on the hot path
  // (all buffers allocated once in the constructor). We feed it the
  // PRE-NORMALIZATION subBass + bassReal sum (20-250 Hz ODF proxy) each
  // frame with a deterministic timestamp as the offline clock.
  //
  // Per-frame BPM estimates are accumulated into pre-allocated Float64Array
  // buffers ONLY when oracle.confidence > CONF_FLOOR. At track end a
  // confidence-weighted median reduces the array to a single scalar.
  // ═══════════════════════════════════════════════════════════════════════
  const odfRateHz = 1000 / config.heatmapResolutionMs
  const oracle = new TempoOracle(odfRateHz)
  // Pre-allocated collection buffers — zero per-frame allocation.
  // Sized to numPoints (worst case: every frame clears the gate).
  const bpmSamples = new Float64Array(numPoints)
  const confSamples = new Float64Array(numPoints)
  let sampleCount = 0

  for (let i = 0; i < numPoints; i++) {
    const start = i * resolutionSamples
    const end = Math.min(start + actualFftSize, samples.length)

    // Reuse pre-allocated window buffer — zero out then copy new samples
    const copyLength = Math.min(actualFftSize, end - start)
    windowBuffer.fill(0, copyLength)
    windowBuffer.set(samples.subarray(start, start + copyLength))

    // 🩻 Run REAL FFT analysis through GodEarAnalyzer
    const spectrum = analyzer.analyze(windowBuffer)

    // Extract 7 tactical bands (already LR4-equivalent masked, zero overlap)
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

    // 🩻 GODEAR UNLEASHED Phase 3: Semantic enrichment telemetry
    // photon block is optional (undefined on V2 fallback) — guard with ?.
    saturationArr[i] = spectrum.photon?.saturation ?? 0
    whiteNoiseArr[i] = spectrum.photon?.whiteNoiseScore ?? 0
    rhythmicVoidArr[i] = spectrum.rhythmic?.rhythmic_void ?? 0
    rolloffArr[i] = spectrum.spectral.rolloff

    // 🩻 GODEAR UNLEASHED Phase 2: 3-band transient event collection
    // GodEar's SlopeBasedOnsetDetector already applies 80ms refractory
    // internally, so consecutive frames won't double-fire. We apply an
    // additional heatmap-resolution-aware debounce for safety.
    const frameTimeMs = i * config.heatmapResolutionMs

    // 🔮 CHRONOS PURE MEDIAN ANALYSER: Feed TempoOracle with the per-frame
    // ODF needle (subBass + bassReal = 20-250 Hz onset detection function
    // proxy). The Oracle runs NSDF autocorrelation + harmonic ladder +
    // sub-frame parabolic interpolation internally, zero allocation.
    // Deterministic timestamp = offline clock.
    oracle.process(
      spectrum.bands.subBass + spectrum.bands.bass,
      frameTimeMs,
    )

    // Accumulate BPM only when the Oracle's confidence exceeds CONF_FLOOR.
    // This rejects intro/outro silence and low-periodicity noise frames
    // from the statistical reduction at track end.
    if (oracle.confidence > CONF_FLOOR && oracle.bpm > 0) {
      bpmSamples[sampleCount] = oracle.bpm
      confSamples[sampleCount] = oracle.confidence
      sampleCount++
    }

    if (spectrum.transients.kick && frameTimeMs - lastKickMs >= refractoryMs) {
      transientEvents.push({ timeMs: frameTimeMs, type: 'kick', strength: spectrum.transients.strength })
      lastKickMs = frameTimeMs
    }
    if (spectrum.transients.snare && frameTimeMs - lastSnareMs >= refractoryMs) {
      transientEvents.push({ timeMs: frameTimeMs, type: 'snare', strength: spectrum.transients.strength })
      lastSnareMs = frameTimeMs
    }
    if (spectrum.transients.hihat && frameTimeMs - lastHihatMs >= refractoryMs) {
      transientEvents.push({ timeMs: frameTimeMs, type: 'hihat', strength: spectrum.transients.strength })
      lastHihatMs = frameTimeMs
    }
    // Legacy transients: any transient (for backwards compat with snap-to-hit)
    if (spectrum.transients.any) {
      const lastLegacy = transientsLegacy[transientsLegacy.length - 1]
      if (lastLegacy === undefined || frameTimeMs - lastLegacy >= 50) {
        transientsLegacy.push(frameTimeMs)
      }
    }

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

    // Report progress every ~5% (worker only — no-op on main thread)
    if (onProgress && i % Math.max(1, Math.ceil(numPoints / 20)) === 0) {
      onProgress('energy', Math.round((i / numPoints) * 100), `FFT analysis ${Math.round((i / numPoints) * 100)}%...`)
    }
  }

  // Normalize flux to 0-1
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
  const rawPeak = (arr: number[]): number => {
    let peak = 0
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
    }
    return peak
  }
  if (onProgress) {
    onProgress('energy', 95,
      `🩻 RAW PEAKS: subBass=${rawPeak(subBassArr).toFixed(6)} bass=${rawPeak(bassRealArr).toFixed(6)} ` +
      `lowMid=${rawPeak(lowMidArr).toFixed(6)} MID=${rawPeak(midArr).toFixed(6)} ` +
      `highMid=${rawPeak(highMidArr).toFixed(6)} treble=${rawPeak(trebleArr).toFixed(6)} ` +
      `ultraAir=${rawPeak(ultraAirArr).toFixed(6)}`
    )
  } else {
    // Main-thread path: log to console (preserves original GodEarOffline behavior)
    console.log(
      `[GodEarOffline] 🩻 RAW PEAKS: subBass=${rawPeak(subBassArr).toFixed(6)} bass=${rawPeak(bassRealArr).toFixed(6)} ` +
      `lowMid=${rawPeak(lowMidArr).toFixed(6)} MID=${rawPeak(midArr).toFixed(6)} ` +
      `highMid=${rawPeak(highMidArr).toFixed(6)} treble=${rawPeak(trebleArr).toFixed(6)} ultraAir=${rawPeak(ultraAirArr).toFixed(6)}`
    )
  }
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
  normalizeBand(subBassArr)
  normalizeBand(bassRealArr)
  normalizeBand(lowMidArr)
  normalizeBand(midArr)
  normalizeBand(highMidArr)
  normalizeBand(trebleArr)
  normalizeBand(ultraAirArr)

  // Reset analyzer (free pre-computed tables)
  analyzer.reset()

  const heatmap: HeatmapData = {
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
    // 🩻 GODEAR UNLEASHED Phase 3: Semantic enrichment telemetry
    saturation: saturationArr,
    whiteNoise: whiteNoiseArr,
    rhythmicVoid: rhythmicVoidArr,
    rolloff: rolloffArr,
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 SERATO-TIER RESOLVER — Confidence-Weighted Median
  // ═══════════════════════════════════════════════════════════════════════
  // At track end: reduce the collected BPM array to a single rock-solid
  // scalar. The median rejects intro/outro silent outliers and one-off
  // octave errors; confidence weighting ensures high-confidence frames
  // dominate the central tendency. No IntervalBPMTracker, no musical
  // pocket folding — pure statistical reduction.
  // ═══════════════════════════════════════════════════════════════════════
  const { bpm: oracleBpm, confidence: oracleConfidence } =
    computeConfidenceWeightedMedian(bpmSamples, confSamples, sampleCount)

  return {
    heatmap,
    transientEvents,
    transients: transientsLegacy,
    oracleBpm,
    oracleConfidence,
  }
}

/**
 * 🔮 SERATO-TIER RESOLVER — Confidence-Weighted Median
 *
 * Reduces the per-frame BPM collection to a single scalar. The median
 * rejects intro/outro silence outliers and sporadic octave errors;
 * confidence weighting ensures high-certainty frames dominate.
 *
 * Algorithm:
 * 1. Build (bpm, conf) pairs for the valid samples only.
 * 2. Sort by BPM ascending.
 * 3. Walk the sorted array accumulating confidence weights.
 * 4. The BPM at which cumulative weight crosses 50% of total weight
 *    is the confidence-weighted median.
 *
 * Falls back to 120 BPM (LUX_DEFAULT_BPM) when no frame cleared the
 * CONF_FLOOR gate — e.g. ambient tracks with no periodic bass content.
 *
 * @param bpmSamples  Pre-allocated Float64Array of per-frame BPM estimates.
 * @param confSamples Pre-allocated Float64Array of per-frame confidences.
 * @param count       Number of valid samples (only [0..count) are read).
 * @returns `{ bpm, confidence }` — the definitive scalar BPM and its
 *          aggregate confidence (mean of the collected confidences).
 */
function computeConfidenceWeightedMedian(
  bpmSamples: Float64Array,
  confSamples: Float64Array,
  count: number,
): { bpm: number; confidence: number } {
  if (count === 0) {
    return { bpm: 0, confidence: 0 }
  }

  // Collect valid (bpm, conf) pairs into a sortable array.
  // This allocation happens ONCE at track end — not in the hot loop.
  const pairs: Array<{ bpm: number; conf: number }> = new Array(count)
  let totalConf = 0
  for (let i = 0; i < count; i++) {
    const bpm = bpmSamples[i]
    const conf = confSamples[i]
    pairs[i] = { bpm, conf }
    totalConf += conf
  }

  if (totalConf <= 0) {
    // All-zero confidence edge case: unweighted median.
    pairs.sort((a, b) => a.bpm - b.bpm)
    const mid = count >> 1
    const medianBpm = count % 2 === 0
      ? (pairs[mid - 1].bpm + pairs[mid].bpm) / 2
      : pairs[mid].bpm
    return { bpm: medianBpm, confidence: 0 }
  }

  // Sort by BPM ascending — enables the weighted-median walk.
  pairs.sort((a, b) => a.bpm - b.bpm)

  // Walk until cumulative confidence crosses 50% of total.
  const halfConf = totalConf / 2
  let cumConf = 0
  let weightedMedianBpm = pairs[0].bpm
  for (let i = 0; i < count; i++) {
    cumConf += pairs[i].conf
    if (cumConf >= halfConf) {
      weightedMedianBpm = pairs[i].bpm
      break
    }
  }

  // Aggregate confidence = mean of collected confidences.
  const aggregateConfidence = totalConf / count

  return { bpm: weightedMedianBpm, confidence: aggregateConfidence }
}

/**
 * Estima BPM desde intervalos entre onsets.
 *
 * @deprecated CHRONOS PURE MEDIAN ANALYSER — replaced by the TempoOracle
 * (NSDF autocorrelation, harmonic ladder, sub-frame parabolic interpolation,
 * confidence-weighted median reduction). Retained as a last-resort fallback
 * for tracks where the Oracle produces zero confident frames (ambient,
 * atonal, or purely textural material with no periodic bass content).
 * Do not extend; new work should consume the Oracle.
 */
export function estimateBpm(onsets: TimeMs[]): number {
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
  // P1.3 FIX: Guard against mostCommonInterval=0 → Infinity or NaN
  if (!Number.isFinite(mostCommonInterval) || mostCommonInterval <= 0) {
    return 120 // Default
  }
  let bpm = 60000 / mostCommonInterval
  // P1.3 FIX: If bpm is not finite, fallback immediately (don't enter while loops)
  if (!Number.isFinite(bpm)) return 120

  // Ajustar a rango razonable (80-180) — with iteration cap to prevent infinite loops
  let iterations = 0
  while (bpm < 80 && iterations < 10) { bpm *= 2; iterations++ }
  iterations = 0
  while (bpm > 180 && iterations < 10) { bpm /= 2; iterations++ }

  return Math.round(bpm * 10) / 10
}

/**
 * 🩻 WAVE 2077: Detecta beats usando bandas FFT reales
 *
 * Mejoras sobre WAVE 2002:
 * - Usa subBass+bassReal (FFT LR4) en vez de bass fake (zero-crossing)
 * - Onset detection con flux espectral real
 * - Bass weighting con subBass real (20-60Hz = kicks)
 */
export function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  heatmap: HeatmapData,
  config: OfflineAnalysisConfig,
  /** Definitive scalar BPM from the TempoOracle confidence-weighted median. */
  oracleBpm: number,
  /** Aggregate confidence of the oracle BPM (0-1). */
  oracleConfidence: number,
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

  // 🔮 CHRONOS PURE MEDIAN ANALYSER: The oracleBpm is the single mathematical
  // truth — a confidence-weighted median of all per-frame NSDF estimates that
  // cleared CONF_FLOOR. No musical-pocket folding, no live-runtime defense.
  // Fall back to the deprecated estimateBpm() histogram only when the Oracle
  // produced zero confident frames (e.g. ambient/atonal material).
  const bpm = oracleBpm > 0 ? oracleBpm : estimateBpm(onsets)

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
  const onsetConfidence = onsets.length > 0 ? alignedOnsets / onsets.length : 0.5
  // 🔮 CHRONOS PURE MEDIAN ANALYSER: Blend the oracle's aggregate confidence
  // with the onset-alignment heuristic (max). A strong oracle reading is
  // never dragged down by a noisy onset set; a weak oracle reading does not
  // erase a clearly-aligned grid.
  const confidence = Math.max(onsetConfidence, oracleConfidence)

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
 * 🩻 WAVE 2077: Detecta secciones con métricas espectrales reales
 *
 * GODEAR UNLEASHED Phase 3: Now uses semantic enrichment telemetry:
 * - saturation: brickwall detection → confident 'drop' classification
 * - whiteNoise: broadband noise → 'buildup' / noise-heavy sections
 * - rhythmicVoid: percussion absence → 'breakdown' (even if energy is moderate)
 * - rolloff: brightness boundary → better verse/chorus distinction
 *
 * Mejoras originales:
 * - Usa spectral centroid para distinguir verse (bajo) vs chorus (brillante)
 * - Usa spectral flatness para detectar breakdowns (noise → tonal)
 * - Buildups detectados por centroid creciente + energía creciente
 */
export function detectSections(
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
  // 🩻 GODEAR UNLEASHED Phase 3: semantic enrichment availability flags
  const hasSaturation = heatmap.saturation && heatmap.saturation.length > 0
  const hasWhiteNoise = heatmap.whiteNoise && heatmap.whiteNoise.length > 0
  const hasRhythmicVoid = heatmap.rhythmicVoid && heatmap.rhythmicVoid.length > 0
  const hasRolloff = heatmap.rolloff && heatmap.rolloff.length > 0

  const windowEnergies: {
    startMs: TimeMs
    avgEnergy: number
    avgCentroid: number
    avgFlatness: number
    avgSubBass: number
    avgSaturation: number
    avgWhiteNoise: number
    avgRhythmicVoid: number
    avgRolloff: number
  }[] = []

  for (let i = 0; i < heatmap.energy.length; i += windowPoints) {
    const endIdx = Math.min(i + windowPoints, heatmap.energy.length)
    let sumEnergy = 0
    let sumCentroid = 0
    let sumFlatness = 0
    let sumSubBass = 0
    let sumSaturation = 0
    let sumWhiteNoise = 0
    let sumRhythmicVoid = 0
    let sumRolloff = 0
    const count = endIdx - i

    for (let j = i; j < endIdx; j++) {
      sumEnergy += heatmap.energy[j]
      if (hasCentroid) sumCentroid += heatmap.spectralCentroid![j]
      if (hasFlatness) sumFlatness += heatmap.spectralFlatness![j]
      if (hasSubBass) sumSubBass += heatmap.subBass![j]
      if (hasSaturation) sumSaturation += heatmap.saturation![j]
      if (hasWhiteNoise) sumWhiteNoise += heatmap.whiteNoise![j]
      if (hasRhythmicVoid) sumRhythmicVoid += heatmap.rhythmicVoid![j]
      if (hasRolloff) sumRolloff += heatmap.rolloff![j]
    }

    windowEnergies.push({
      startMs: i * heatmap.resolutionMs,
      avgEnergy: sumEnergy / count,
      avgCentroid: hasCentroid ? sumCentroid / count : 0,
      avgFlatness: hasFlatness ? sumFlatness / count : 0.5,
      avgSubBass: hasSubBass ? sumSubBass / count : 0,
      avgSaturation: hasSaturation ? sumSaturation / count : 0,
      avgWhiteNoise: hasWhiteNoise ? sumWhiteNoise / count : 0,
      avgRhythmicVoid: hasRhythmicVoid ? sumRhythmicVoid / count : 0,
      avgRolloff: hasRolloff ? sumRolloff / count : 0,
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
    let confidence = 0.7

    // ═══════════════════════════════════════════════════════════════════════
    // 🩻 GODEAR UNLEASHED Phase 3: Semantic-first classification
    //
    // Priority order (highest signal first):
    //   1. rhythmicVoid > 0.7  → breakdown (percussion absent, even if energy
    //      is moderate — e.g. ambient pad with no drums)
    //   2. saturation > 0.6 + high energy → drop (brickwalled loud section)
    //   3. whiteNoise > 0.4 + energy rising → buildup (noise sweep / riser)
    //   4. (fall through to legacy energy+centroid classification)
    // ═══════════════════════════════════════════════════════════════════════

    // 1. Rhythmic void → breakdown (highest priority — unambiguous signal)
    if (hasRhythmicVoid && w.avgRhythmicVoid > 0.7) {
      sectionType = 'breakdown'
      confidence = 0.9
    }
    // 2. Saturation + high energy → drop (brickwalled loud section)
    else if (hasSaturation && w.avgSaturation > 0.6 && relativeEnergy > 1.2) {
      sectionType = 'drop'
      confidence = 0.92
    }
    // 3. High white noise + rising energy → buildup (noise sweep / riser)
    else if (hasWhiteNoise && w.avgWhiteNoise > 0.4 && relativeEnergy > 0.8 && i > 0 && i < windowEnergies.length - 1) {
      const nextEnergy = windowEnergies[i + 1]?.avgEnergy ?? w.avgEnergy
      if (nextEnergy > w.avgEnergy * 1.15) {
        sectionType = 'buildup'
        confidence = 0.85
      } else {
        // High noise but not rising — classify by energy
        sectionType = relativeEnergy > 1.2 ? 'chorus' : 'verse'
        confidence = 0.7
      }
    }
    // 4. Legacy energy + centroid classification (fallback)
    else if (relativeEnergy < 0.5) {
      if (relativeEnergy < 0.3) {
        sectionType = 'breakdown'
        confidence = 0.8
      } else {
        sectionType = 'bridge'
      }
    } else if (relativeEnergy > 1.5) {
      // High energy — drop or chorus?
      // 🩻 Drop = high energy + high subBass (kicks pounding)
      // 🩻 GODEAR UNLEASHED: saturation confirms brickwall → higher confidence
      if (hasSubBass && w.avgSubBass > 0.3) {
        sectionType = 'drop'
        confidence = hasSaturation && w.avgSaturation > 0.5 ? 0.95 : 0.85
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
    // (only if not already classified as buildup by the noise-sweep rule above)
    if (sectionType !== 'buildup' && i > 0 && i < windowEnergies.length - 1) {
      const prevEnergy = windowEnergies[i - 1].avgEnergy
      const nextEnergy = windowEnergies[i + 1]?.avgEnergy ?? w.avgEnergy

      const energyRising = nextEnergy > w.avgEnergy * 1.3 && w.avgEnergy > prevEnergy * 1.1

      // If centroid is also rising → definite buildup (filter sweep effect)
      const centroidRising = hasCentroid && i > 0
        ? w.avgCentroid > windowEnergies[i - 1].avgCentroid * 1.15
        : false

      // 🩻 GODEAR UNLEASHED Phase 3: rolloff rising is also a buildup signal
      // (energy moving to higher frequencies = sweep/riser)
      const rolloffRising = hasRolloff && i > 0
        ? w.avgRolloff > windowEnergies[i - 1].avgRolloff * 1.15
        : false

      if (energyRising && (centroidRising || rolloffRising)) {
        sectionType = 'buildup'
        confidence = (centroidRising && rolloffRising) ? 0.95 : (centroidRising ? 0.9 : 0.8)
      } else if (energyRising) {
        sectionType = 'buildup'
        confidence = 0.75
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
 * @deprecated GODEAR UNLEASHED Phase 2 — Superseded by 3-band transient
 * collection in extractEnergyHeatmap(). This single-band slope detector
 * is retained for backwards compatibility but is NO LONGER called by
 * runAnalysisPipeline(). The new path uses GodEar V3's
 * SlopeBasedOnsetDetector with kick/snare/hihat isolation, collected
 * during the FFT loop (zero additional pass over raw samples).
 *
 * Mejoras originales sobre WAVE 2002:
 * - Usa sliding window con historia (no solo frame anterior)
 * - Slope-based: detecta TASA de cambio, no valor absoluto
 * - Threshold adaptativo basado en energía promedio local
 * - Más robusto contra crescendos graduales (no son transientes)
 */
export function detectTransients(
  samples: Float32Array,
  sampleRate: number,
  _config: OfflineAnalysisConfig
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
// 🧠 FULL PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result type for the full offline analysis pipeline.
 * Structurally identical to AnalysisData but defined here for worker use
 * without importing the full AnalysisData type (which includes TimeMs aliases).
 */
export interface AnalysisPipelineResult {
  durationMs: number
  waveform: WaveformData
  energyHeatmap: HeatmapData
  beatGrid: BeatGridData
  sections: DetectedSection[]
  /** Legacy transient timestamps (for backwards compat with snap-to-hit) */
  transients: TimeMs[]
  /** GODEAR UNLEASHED Phase 2: 3-band instrument-classified transient events */
  transientEvents?: TransientEvent[]
}

/**
 * Run the complete 5-phase offline analysis pipeline.
 *
 * Both the main-thread fallback and the Web Worker call this function.
 * The worker passes an `onProgress` callback to report progress via postMessage;
 * the main thread leaves it undefined (uses console.log for diagnostics).
 */
export function runAnalysisPipeline(
  monoSamples: Float32Array,
  sampleRate: number,
  duration: number,
  config: OfflineAnalysisConfig,
  onProgress?: ProgressCallback,
): AnalysisPipelineResult {
  // Phase 1: Waveform
  onProgress?.('waveform', 0, 'Extracting waveform...')
  const waveform = extractWaveform(monoSamples, sampleRate, config)
  onProgress?.('waveform', 100, 'Waveform extracted')

  // Phase 2: Energy Heatmap (FFT-heavy — the big one)
  // GODEAR UNLEASHED: now also collects 3-band transient events + semantic
  // enrichment telemetry (saturation, whiteNoise, rhythmicVoid, rolloff)
  // in the SAME pass — no separate transient detection pass needed.
  onProgress?.('energy', 0, 'FFT spectral analysis...')
  const heatmapResult = extractEnergyHeatmap(monoSamples, sampleRate, config, onProgress)
  const energyHeatmap = heatmapResult.heatmap
  onProgress?.('energy', 100, 'Heatmap generated')

  // Phase 3: Beat Detection
  // 🔮 CHRONOS PURE MEDIAN ANALYSER: Pass the TempoOracle's definitive scalar
  // BPM (confidence-weighted median) into detectBeats. The beat grid is built
  // as a perfectly linear, uniform grid from this single mathematical truth.
  onProgress?.('beats', 0, 'Detecting beats...')
  const beatGrid = detectBeats(
    monoSamples, sampleRate, energyHeatmap, config,
    heatmapResult.oracleBpm, heatmapResult.oracleConfidence,
  )
  onProgress?.('beats', 100, 'Beat grid detected')

  // Phase 4: Section Detection
  // GODEAR UNLEASHED Phase 3: detectSections now uses saturation,
  // whiteNoise, rhythmicVoid, and rolloff from the heatmap.
  onProgress?.('sections', 0, 'Detecting sections...')
  const sections = detectSections(energyHeatmap, beatGrid, duration, config)
  onProgress?.('sections', 100, 'Sections detected')

  // Phase 5: Transients — already collected during the heatmap pass.
  // The old standalone detectTransients() is deprecated.
  onProgress?.('transients', 0, 'Collecting transients...')
  onProgress?.('transients', 100, `Transients detected (${heatmapResult.transientEvents.length} events)`)

  const durationMs = duration * 1000

  return {
    durationMs,
    waveform,
    energyHeatmap,
    beatGrid,
    sections,
    transients: heatmapResult.transients,
    transientEvents: heatmapResult.transientEvents,
  }
}
