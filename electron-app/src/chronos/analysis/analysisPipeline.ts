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

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 7563: VARIABLE-TEMPO CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sliding-median window (in frames) applied to the raw per-frame Oracle BPM
 * before it becomes the tempo curve. MUST be odd so the window has a true
 * centre sample.
 *
 * At the default 50 ms heatmap resolution, 21 frames ≈ 1.05 s — long enough
 * to annihilate a single-frame octave flip (the Oracle's only failure mode
 * once NSDF + harmonic ladder have run), short enough to follow a genuine
 * ritardando or a DJ pitch-ride without lag.
 */
const TEMPO_MEDIAN_WINDOW = 21

/**
 * Fallback BPM when a track yields zero confident Oracle frames — ambient,
 * atonal, or purely textural material with no periodic bass content.
 * Mirrors `LUX_DEFAULT_BPM`; duplicated here to keep this module free of
 * `chronos/core` imports (it runs inside the Web Worker).
 */
const TEMPO_FALLBACK_BPM = 120

/**
 * Ellis DP transition tightness (the `α` in `−α·log²(τ/P)`).
 *
 * Controls how hard the tracker is punished for placing a beat interval away
 * from the local target period. 100 is Ellis's published default and assumes
 * a unit-variance onset envelope — which is exactly what `_normalizeOnsetEnv`
 * produces, so the constant transfers without retuning.
 *
 * Lower → the tracker follows the onset envelope more literally and will
 * happily double/halve on a syncopated bar. Higher → it becomes a metronome
 * and stops tracking real tempo drift. 100 is the tested compromise.
 *
 * @see D. Ellis, "Beat Tracking by Dynamic Programming", J. New Music
 *      Research 36(1), 2007, §2.2
 */
const DP_TIGHTNESS = 100

/**
 * Fraction of the median local-maximum cumulative score that a candidate
 * end-of-track beat must reach to be accepted as the backtrace seed.
 * Ellis uses 0.5; retained verbatim.
 */
const DP_ENDPOINT_THRESH = 0.5

/**
 * Meter-detection bias. A 3/4 hypothesis must beat the 4/4 hypothesis by this
 * multiplicative margin before the pipeline will report `timeSignature: 3`.
 *
 * Deliberately conservative: the overwhelming majority of the material this
 * system sees is 4/4, and a false 3/4 reading corrupts the downbeat grid for
 * the entire track. A true waltz clears 1.15 comfortably; a syncopated 4/4
 * bar that happens to score well at lag 3 does not.
 */
const METER_3_MARGIN = 1.15

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
  /**
   * 🌊 WAVE 7563: TEMPO CURVE — per-frame BPM aligned to the heatmap grid.
   *
   * The scalar `oracleBpm` above is a whole-track reduction. This curve is the
   * un-reduced signal: one BPM value per heatmap frame, gap-filled across
   * low-confidence regions and median-smoothed to reject octave flips.
   *
   * Index `i` corresponds to `i * config.heatmapResolutionMs`, so the curve is
   * directly co-indexable with every band array in `HeatmapData`. It is the
   * input to the Ellis DP beat tracker (which uses a time-varying target
   * period) and is persisted in `LuxAnalysisV3.tempoCurve` so Hephaestus can
   * phase-lock curve durations to LOCAL tempo instead of a global average.
   *
   * Always `numPoints` long. Never contains 0 or NaN — a track with zero
   * confident frames is filled entirely with the fallback BPM.
   */
  tempoCurve: number[]
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
  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 7564.6: DECOUPLED ORACLE RATE — The 20Hz Aliasing Fix
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 7564.5 diagnosed that coupling the Oracle to 50ms (20 Hz) placed
  // 150 BPM on an exact integer lag (8.0 frames), letting it unfairly beat
  // 126 BPM (9.52 frames) in the harmonic ladder. At 43 Hz neither tempo
  // lands on an integer lag (150 → 17.2, 126 → 20.48), so the Gaussian
  // smear + parabolic interpolation resolve both correctly.
  //
  // 43 Hz is the Oracle's designed operating point (see TempoOracle
  // blueprint: RING_SIZE/EVAL_INTERVAL/MAX_LAG all sized for it). The
  // persistent heatmap arrays stay at 50ms; only the Oracle's internal
  // loop accelerates. The FFT also runs at the internal rate so the ODF
  // needle the Oracle consumes is a genuine per-frame reading, not an
  // interpolation.
  // ═══════════════════════════════════════════════════════════════════════
  const ORACLE_INTERNAL_RATE_HZ = 43
  const internalResolutionSamples = Math.floor(sampleRate / ORACLE_INTERNAL_RATE_HZ)
  const internalResolutionMs = (1000 * internalResolutionSamples) / sampleRate
  const numInternalPoints = Math.ceil(samples.length / internalResolutionSamples)
  const oracleOdfRateHz = sampleRate / internalResolutionSamples
  const oracle = new TempoOracle(oracleOdfRateHz)
  // Pre-allocated collection buffers — zero per-frame allocation.
  // Sized to numInternalPoints (the Oracle now runs at the internal rate,
  // not the heatmap rate, so worst case is every internal frame clears gate).
  const bpmSamples = new Float64Array(numInternalPoints)
  const confSamples = new Float64Array(numInternalPoints)
  let sampleCount = 0

  // 🌊 WAVE 7563: TEMPO CURVE collection buffer.
  //
  // NOTE the difference from `bpmSamples` above: that array is PACKED — only
  // confident frames land in it, contiguously, so `bpmSamples[k]` has no
  // relationship to frame k. It exists purely to be reduced to a scalar.
  //
  // `tempoRaw` is SPARSE-BY-INDEX: `tempoRaw[i]` is the Oracle's reading at
  // heatmap frame i, or 0 if that frame failed the confidence gate. Preserving
  // the time axis is the whole point — a tempo curve that is not co-indexable
  // with the heatmap is useless to Hephaestus. It stays sized to numPoints
  // (50ms resolution) even though the Oracle runs faster internally.
  const tempoRaw = new Float64Array(numPoints)

  // 🌊 WAVE 7564.6: Heatmap frame cursor. The internal loop writes to the
  // persistent arrays only when the internal frame time crosses the next
  // 50ms boundary, keeping the .lux file size identical to pre-7564.6.
  let heatmapIdx = 0

  for (let i = 0; i < numInternalPoints; i++) {
    const start = i * internalResolutionSamples
    const end = Math.min(start + actualFftSize, samples.length)

    // Reuse pre-allocated window buffer — zero out then copy new samples
    const copyLength = Math.min(actualFftSize, end - start)
    windowBuffer.fill(0, copyLength)
    windowBuffer.set(samples.subarray(start, start + copyLength))

    // 🩻 Run REAL FFT analysis through GodEarAnalyzer
    const spectrum = analyzer.analyze(windowBuffer)

    // 🩻 GODEAR UNLEASHED Phase 2: 3-band transient event collection
    // GodEar's SlopeBasedOnsetDetector already applies 80ms refractory
    // internally, so consecutive frames won't double-fire. We apply an
    // additional heatmap-resolution-aware debounce for safety.
    // 🌊 WAVE 7564.6: Transients now collected at the internal frame rate
    // (43 Hz) for finer temporal resolution — the refractory debounce
    // still prevents duplicates.
    const frameTimeMs = i * internalResolutionMs

    // 🔮 CHRONOS PURE MEDIAN ANALYSER: Feed TempoOracle with the per-frame
    // ODF needle (subBass + bassReal = 20-250 Hz onset detection function
    // proxy). The Oracle runs NSDF autocorrelation + harmonic ladder +
    // sub-frame parabolic interpolation internally, zero allocation.
    // Deterministic timestamp = offline clock.
    // 🌊 WAVE 7564.6: Now fed at 43 Hz (internal rate), not 20 Hz. This is
    // the core fix — at 43 Hz the lag band has 2.15× more resolution and
    // neither 126 BPM nor 150 BPM falls on an integer lag.
    oracle.process(
      spectrum.bands.subBass + spectrum.bands.bass,
      frameTimeMs,
    )

    // Accumulate BPM only when the Oracle's confidence exceeds CONF_FLOOR.
    // This rejects intro/outro silence and low-periodicity noise frames
    // from the statistical reduction at track end.
    // 🌊 WAVE 7564.6: Accumulation now happens at the internal rate too,
    // giving the confidence-weighted median ~2.15× more samples to reduce.
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

    // 🌊 WAVE 7564.6: Write persistent arrays only when the internal frame
    // time crosses the next 50ms heatmap boundary. This keeps the .lux file
    // size identical — the arrays are still numPoints long at 50ms spacing.
    // The `while` handles the rare case where a single internal frame
    // straddles two heatmap boundaries (it can't at 43 Hz > 20 Hz, but the
    // guard is cheap and correct for any rate ratio).
    while (heatmapIdx < numPoints && frameTimeMs >= heatmapIdx * config.heatmapResolutionMs) {
      // Extract 7 tactical bands (already LR4-equivalent masked, zero overlap)
      subBassArr[heatmapIdx] = spectrum.bands.subBass
      bassRealArr[heatmapIdx] = spectrum.bands.bass
      lowMidArr[heatmapIdx] = spectrum.bands.lowMid
      midArr[heatmapIdx] = spectrum.bands.mid
      highMidArr[heatmapIdx] = spectrum.bands.highMid
      trebleArr[heatmapIdx] = spectrum.bands.treble
      ultraAirArr[heatmapIdx] = spectrum.bands.ultraAir

      // Spectral metrics
      centroidArr[heatmapIdx] = spectrum.spectral.centroid
      flatnessArr[heatmapIdx] = spectrum.spectral.flatness

      // 🩻 GODEAR UNLEASHED Phase 3: Semantic enrichment telemetry
      // photon block is optional (undefined on V2 fallback) — guard with ?.
      saturationArr[heatmapIdx] = spectrum.photon?.saturation ?? 0
      whiteNoiseArr[heatmapIdx] = spectrum.photon?.whiteNoiseScore ?? 0
      rhythmicVoidArr[heatmapIdx] = spectrum.rhythmic?.rhythmic_void ?? 0
      rolloffArr[heatmapIdx] = spectrum.spectral.rolloff

      // 🌊 WAVE 7563: Oracle reading stored against the heatmap TIME axis.
      tempoRaw[heatmapIdx] = oracle.bpm > 0 && oracle.confidence > CONF_FLOOR
        ? oracle.bpm
        : 0

      // Legacy fields (combine bands for backwards compatibility)
      // bass = subBass + bass (what the old zero-crossing tried to approximate)
      bass[heatmapIdx] = Math.min(1, (spectrum.bands.subBass + spectrum.bands.bass) * 2)
      // high = treble + ultraAir
      high[heatmapIdx] = Math.min(1, (spectrum.bands.treble + spectrum.bands.ultraAir) * 2)
      // total energy
      energy[heatmapIdx] = Math.min(1, spectrum.totalEnergy * 3)

      // Spectral flux — real change in total energy between heatmap frames
      flux[heatmapIdx] = Math.abs(spectrum.totalEnergy - prevTotalEnergy)
      prevTotalEnergy = spectrum.totalEnergy

      heatmapIdx++
    }

    // Report progress every ~5% (worker only — no-op on main thread)
    if (onProgress && i % Math.max(1, Math.ceil(numInternalPoints / 20)) === 0) {
      onProgress('energy', Math.round((i / numInternalPoints) * 100), `FFT analysis ${Math.round((i / numInternalPoints) * 100)}%...`)
    }
  }

  // 🌊 WAVE 7564.6: Fill any trailing heatmap frames that the internal loop
  // didn't reach (track length not an exact multiple of the 50ms grid).
  // Zero-fill is correct — these frames are past the audio end.
  while (heatmapIdx < numPoints) {
    subBassArr[heatmapIdx] = 0
    bassRealArr[heatmapIdx] = 0
    lowMidArr[heatmapIdx] = 0
    midArr[heatmapIdx] = 0
    highMidArr[heatmapIdx] = 0
    trebleArr[heatmapIdx] = 0
    ultraAirArr[heatmapIdx] = 0
    centroidArr[heatmapIdx] = 0
    flatnessArr[heatmapIdx] = 0
    saturationArr[heatmapIdx] = 0
    whiteNoiseArr[heatmapIdx] = 0
    rhythmicVoidArr[heatmapIdx] = 0
    rolloffArr[heatmapIdx] = 0
    tempoRaw[heatmapIdx] = 0
    bass[heatmapIdx] = 0
    high[heatmapIdx] = 0
    energy[heatmapIdx] = 0
    flux[heatmapIdx] = 0
    heatmapIdx++
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

  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 7563: TEMPO CURVE — gap-fill + median-smooth the per-frame track
  // ═══════════════════════════════════════════════════════════════════════
  // The scalar above answers "what tempo is this track?". The curve answers
  // "what tempo is this track RIGHT HERE?" — which is the question a beat
  // tracker, a ritardando, and a DJ pitch-ride all actually ask.
  const tempoCurve = buildTempoCurve(
    tempoRaw,
    numPoints,
    oracleBpm > 0 ? oracleBpm : TEMPO_FALLBACK_BPM,
  )

  return {
    heatmap,
    transientEvents,
    transients: transientsLegacy,
    oracleBpm,
    oracleConfidence,
    tempoCurve,
  }
}

/**
 * 🌊 WAVE 7563: TEMPO CURVE BUILDER — gap fill + sliding median
 *
 * Turns the Oracle's sparse per-frame readings into a dense, continuous
 * tempo curve that is safe to differentiate, index, and persist.
 *
 * ── Stage 1: gap fill (zero-order hold, bidirectional) ───────────────────
 * Frames that failed `CONF_FLOOR` hold 0. These are not "tempo = 0", they are
 * "no opinion" — intro silence, a breakdown with no periodic bass, a noise
 * sweep. Interpolating across them would invent a tempo ramp that the music
 * does not contain, so we hold the last confident value forward instead, and
 * back-fill the head with the first confident value. A held tempo is the
 * correct prior: absent evidence, the tempo has not changed.
 *
 * ── Stage 2: sliding median (not a mean) ─────────────────────────────────
 * A mean would smear an octave flip across the whole window — one frame
 * reading 252 instead of 126 drags a 21-frame mean by +6 BPM. The median is
 * immune: a minority of outliers cannot move it at all. This is the same
 * reason the whole-track reducer is a median, applied locally.
 *
 * Cost: O(n · w²) with insertion sort on a 21-element scratch buffer. At
 * n = 3,600 frames that is ~1.6 M comparisons ≈ sub-millisecond — irrelevant
 * next to the FFT pass that produced the input, and not worth the complexity
 * of a two-heap streaming median.
 *
 * @param raw         Per-frame BPM, 0 marking "no confident estimate".
 * @param numPoints   Length of the frame axis.
 * @param fallbackBpm Value used when NO frame in the track was confident.
 * @returns Dense `number[]` of length `numPoints`. Never 0, never NaN.
 */
export function buildTempoCurve(
  raw: Float64Array,
  numPoints: number,
  fallbackBpm: number,
): number[] {
  const out = new Array<number>(numPoints)
  if (numPoints <= 0) return out

  // ── Locate the first confident frame ──────────────────────────────────
  let firstIdx = -1
  for (let i = 0; i < numPoints; i++) {
    if (raw[i] > 0) { firstIdx = i; break }
  }

  // Degenerate case: the Oracle never cleared the gate anywhere in the track.
  // Ambient/atonal material. Return a flat curve at the fallback so consumers
  // never have to special-case an empty or zero-filled array.
  if (firstIdx < 0) {
    for (let i = 0; i < numPoints; i++) out[i] = fallbackBpm
    return out
  }

  // ── Stage 1: forward hold, then back-fill the head ────────────────────
  let held = raw[firstIdx]
  for (let i = 0; i < numPoints; i++) {
    if (raw[i] > 0) held = raw[i]
    out[i] = held
  }
  for (let i = 0; i < firstIdx; i++) out[i] = raw[firstIdx]

  // ── Stage 2: sliding median ───────────────────────────────────────────
  // Window shorter than the track, and odd. A track of 3 frames gets a
  // 3-frame window, not a 21-frame one clamped into nonsense.
  let win = TEMPO_MEDIAN_WINDOW
  if (win > numPoints) win = numPoints % 2 === 1 ? numPoints : numPoints - 1
  if (win < 3) return out  // too short to smooth meaningfully

  const half = (win - 1) >> 1
  const scratch = new Float64Array(win)
  const smoothed = new Array<number>(numPoints)

  for (let i = 0; i < numPoints; i++) {
    // Clamp the window to the array bounds (edge frames see a shorter,
    // asymmetric window rather than reflected/padded data — padding would
    // fabricate tempo evidence at exactly the least reliable moments).
    let lo = i - half
    let hi = i + half
    if (lo < 0) lo = 0
    if (hi > numPoints - 1) hi = numPoints - 1
    const n = hi - lo + 1

    // Insertion sort into scratch — n ≤ 21, branch-predictable, no alloc.
    for (let k = 0; k < n; k++) {
      const v = out[lo + k]
      let j = k - 1
      while (j >= 0 && scratch[j] > v) {
        scratch[j + 1] = scratch[j]
        j--
      }
      scratch[j + 1] = v
    }
    smoothed[i] = n % 2 === 1
      ? scratch[(n - 1) >> 1]
      : (scratch[n / 2 - 1] + scratch[n / 2]) * 0.5
  }

  return smoothed
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
 * 🌊 WAVE 7563: ONSET ENVELOPE — half-wave-rectified, kick-weighted ODF
 *
 * Builds the detection function the Ellis DP tracker consumes.
 *
 * ── Why not reuse `heatmap.flux`? ────────────────────────────────────────
 * `flux` is computed as `|totalEnergy[i] − totalEnergy[i−1]|` — FULL-wave
 * rectified. An energy *collapse* (a drop landing, a filter slamming shut)
 * produces exactly the same flux spike as an energy *attack*. For peak
 * picking that mostly washes out; for a DP tracker that integrates the
 * envelope it is actively harmful, because it plants a phantom beat on every
 * release. Onsets are increases. We rectify half-wave and keep only those.
 *
 * ── Why weight the kick bands? ───────────────────────────────────────────
 * Broadband energy rises on pads, risers, and vocal entries — none of which
 * mark the beat. The 20–250 Hz transient does. Weighting `Δ(subBass+bassReal)`
 * at 0.8 alongside `Δenergy` biases the envelope toward the percussive layer
 * without discarding the broadband cue entirely (which would fail on
 * kick-less breakbeat sections).
 *
 * ── Unit-variance normalisation ──────────────────────────────────────────
 * Ellis's `tightness = 100` is calibrated against an onset envelope scaled to
 * unit standard deviation. Dividing by σ here is what lets `DP_TIGHTNESS`
 * stay a published constant instead of a magic number retuned per track.
 *
 * @returns Float64Array of length `numPoints`, σ ≈ 1, all values ≥ 0.
 */
function buildOnsetEnvelope(heatmap: HeatmapData, numPoints: number): Float64Array {
  const env = new Float64Array(numPoints)
  if (numPoints < 2) return env

  const energy = heatmap.energy
  const sub = heatmap.subBass
  const bassR = heatmap.bassReal
  const bassLegacy = heatmap.bass

  for (let i = 1; i < numPoints; i++) {
    // Broadband attack
    let d = energy[i] - energy[i - 1]
    if (d < 0) d = 0

    // Percussive (20–250 Hz) attack. Prefer the tactical LR4 bands; fall back
    // to the legacy combined bass when a V2 heatmap is being re-analysed.
    let k: number
    if (sub) {
      const now = sub[i] + (bassR ? bassR[i] : 0)
      const prev = sub[i - 1] + (bassR ? bassR[i - 1] : 0)
      k = now - prev
    } else {
      k = bassLegacy[i] - bassLegacy[i - 1]
    }
    if (k < 0) k = 0

    env[i] = d + k * 0.8
  }

  // Normalise to unit standard deviation (Ellis §2.1).
  let sum = 0
  for (let i = 0; i < numPoints; i++) sum += env[i]
  const mean = sum / numPoints
  let varSum = 0
  for (let i = 0; i < numPoints; i++) {
    const dv = env[i] - mean
    varSum += dv * dv
  }
  const std = Math.sqrt(varSum / numPoints)
  if (std > 1e-12) {
    const inv = 1 / std
    for (let i = 0; i < numPoints; i++) env[i] *= inv
  }

  return env
}

/**
 * 🌊 WAVE 7563: ELLIS DYNAMIC-PROGRAMMING BEAT TRACKER
 *
 * Replaces `for (t = firstBeat; t < end; t += msPerBeat)` — a metronome that
 * assumed the tempo it was handed was true for the entire track — with a
 * globally-optimal beat sequence recovered by dynamic programming.
 *
 * ── The objective ────────────────────────────────────────────────────────
 * Find the beat sequence `{bᵢ}` maximising
 *
 *     Σ O(bᵢ)  +  α · Σ −log²( (bᵢ − bᵢ₋₁) / P(bᵢ) )
 *
 * where `O` is the onset envelope, `P(t)` the LOCAL target period, and `α`
 * the tightness. The first term rewards putting beats on actual onsets; the
 * second punishes intervals that stray from the expected period. Neither
 * alone works — pure onset picking follows every syncopation, pure period
 * enforcement is the metronome we are replacing. The DP finds the sequence
 * that best satisfies both *over the whole track at once*, which is why it
 * recovers from a bar of silence or a fill that a greedy tracker would
 * derail on.
 *
 * ── Our deviation from the paper: time-varying P ─────────────────────────
 * Ellis uses a single global period estimate. We have something better — the
 * `TempoOracle`'s per-frame curve — so `P` is indexed at the current frame.
 * A ritardando, a DJ pitch-ride, or a live drummer drifting 4 BPM over a
 * chorus all move `P` with them, so the transition cost stops fighting the
 * music instead of merely tolerating it. This is the substantive difference
 * between "constant-tempo grid" and "tempo map".
 *
 * ── Recursion ────────────────────────────────────────────────────────────
 *     C[i] = O[i] + max over τ∈[P/2, 2P] of ( C[i−τ] − α·log²(τ/P) )
 *     B[i] = argmax
 *
 * Backtrace from the last strong local maximum of `C` yields the sequence.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────
 * O(n · 1.5P). At 50 ms frames and 120 BPM, P = 10 frames → ~16 lags/frame.
 * A 3-minute track is 3,600 frames ≈ 58 k inner iterations. Negligible
 * against the FFT pass. Two typed arrays allocated once (`C`, `B`); the hot
 * loop allocates nothing.
 *
 * @param onsetEnv     Unit-variance onset envelope from `buildOnsetEnvelope`.
 * @param tempoCurve   Per-frame BPM (the local target period).
 * @param numPoints    Frame count.
 * @param resolutionMs Frame duration in ms.
 * @returns Beat times in ms, sub-frame refined, strictly increasing.
 *          Empty when the track is too short to track.
 */
export function trackBeatsDP(
  onsetEnv: Float64Array,
  tempoCurve: number[],
  numPoints: number,
  resolutionMs: number,
): TimeMs[] {
  if (numPoints < 4) return []

  const cumscore = new Float64Array(numPoints)
  const backlink = new Int32Array(numPoints)

  // ── Forward pass ──────────────────────────────────────────────────────
  for (let i = 0; i < numPoints; i++) {
    const bpm = tempoCurve[i] > 0 ? tempoCurve[i] : TEMPO_FALLBACK_BPM
    const period = (60000 / bpm) / resolutionMs   // frames per beat

    let tauMin = Math.round(period * 0.5)
    let tauMax = Math.round(period * 2)
    if (tauMin < 1) tauMin = 1
    if (tauMax < tauMin) tauMax = tauMin

    let best = -Infinity
    let bestPrev = -1

    for (let tau = tauMin; tau <= tauMax; tau++) {
      const j = i - tau
      // τ ascends ⇒ j descends. Once we fall off the head, every remaining
      // candidate is also off the head.
      if (j < 0) break
      const lr = Math.log(tau / period)
      const score = cumscore[j] - DP_TIGHTNESS * lr * lr
      if (score > best) {
        best = score
        bestPrev = j
      }
    }

    if (bestPrev < 0) {
      // No admissible predecessor — this frame can only start a sequence.
      cumscore[i] = onsetEnv[i]
      backlink[i] = -1
    } else {
      cumscore[i] = onsetEnv[i] + best
      backlink[i] = bestPrev
    }
  }

  // ── Endpoint selection (Ellis §2.3) ───────────────────────────────────
  // Take the LAST local maximum of the cumulative score that still reaches
  // half the median local-max height. Choosing the global argmax instead
  // would truncate the track at whatever bar happened to score highest.
  let lmCount = 0
  for (let i = 1; i < numPoints - 1; i++) {
    if (cumscore[i] > cumscore[i - 1] && cumscore[i] >= cumscore[i + 1]) lmCount++
  }

  let endIdx = -1
  if (lmCount > 0) {
    const lmVals = new Float64Array(lmCount)
    let w = 0
    for (let i = 1; i < numPoints - 1; i++) {
      if (cumscore[i] > cumscore[i - 1] && cumscore[i] >= cumscore[i + 1]) {
        lmVals[w++] = cumscore[i]
      }
    }
    lmVals.sort()
    const medianLm = lmCount % 2 === 1
      ? lmVals[(lmCount - 1) >> 1]
      : (lmVals[lmCount / 2 - 1] + lmVals[lmCount / 2]) * 0.5

    // The threshold is only meaningful for a positive median. Transition
    // costs can drive the whole surface negative on a track with almost no
    // onset energy; in that regime "half the median" inverts and would
    // select noise, so we defer to the plain argmax below.
    if (medianLm > 0) {
      const thresh = medianLm * DP_ENDPOINT_THRESH
      for (let i = numPoints - 2; i >= 1; i--) {
        if (cumscore[i] > cumscore[i - 1] && cumscore[i] >= cumscore[i + 1] && cumscore[i] >= thresh) {
          endIdx = i
          break
        }
      }
    }
  }

  if (endIdx < 0) {
    let bestVal = -Infinity
    for (let i = 0; i < numPoints; i++) {
      if (cumscore[i] > bestVal) { bestVal = cumscore[i]; endIdx = i }
    }
  }
  if (endIdx < 0) return []

  // ── Backtrace ─────────────────────────────────────────────────────────
  const revFrames: number[] = []
  let cur = endIdx
  // `guard` bounds a corrupt backlink chain; a valid chain is strictly
  // decreasing so it can never exceed numPoints steps.
  let guard = numPoints + 1
  while (cur >= 0 && guard-- > 0) {
    revFrames.push(cur)
    cur = backlink[cur]
  }
  revFrames.reverse()
  if (revFrames.length < 2) return []

  // ── Sub-frame refinement ──────────────────────────────────────────────
  // The DP works on integer frames, so a raw beat carries ±½ frame (±25 ms
  // at the default resolution) of quantisation error. Where the beat sits on
  // a genuine envelope peak we recover the parabola vertex and reclaim that
  // precision — the same trick the TempoOracle uses on its NSDF surface.
  const beats: TimeMs[] = new Array(revFrames.length)
  for (let k = 0; k < revFrames.length; k++) {
    const f = revFrames[k]
    let delta = 0
    if (f > 0 && f < numPoints - 1) {
      const y0 = onsetEnv[f - 1]
      const y1 = onsetEnv[f]
      const y2 = onsetEnv[f + 1]
      const denom = y0 - 2 * y1 + y2
      // denom < 0 ⇔ concave ⇔ f is a true local maximum. On a rising slope
      // or a plateau the vertex is meaningless (or infinite) — leave it.
      if (denom < -1e-12) {
        const d = (y0 - y2) / (2 * denom)
        if (d > -0.5 && d < 0.5) delta = d
      }
    }
    beats[k] = (f + delta) * resolutionMs
  }

  return beats
}

/**
 * 🌊 WAVE 7563: SPECTRAL DOWNBEAT & METRE DETECTION
 *
 * Replaces `(beats.length − 1) % 4 === 0` — which did not detect anything, it
 * merely counted, and silently declared beat 1 to be wherever the tracker
 * happened to start.
 *
 * ── The cue ──────────────────────────────────────────────────────────────
 * In virtually all 4/4 popular music the kick anchors beats 1 and 3 and the
 * snare/clap answers on 2 and 4. That backbeat is the single most reliable
 * metrical marker in the idiom. So for each candidate phase we score the
 * CONTRAST the hypothesis predicts:
 *
 *     S(m, p) = ( E_kick[downbeats] − E_kick[others] )
 *             + ( E_snare[backbeats] − E_snare[downbeats] )
 *
 * Both terms are differences of means over the same peak-normalised bands, so
 * they share a scale and can be summed without weighting. A correct phase
 * makes both positive; a phase off by one makes the second term strongly
 * negative, which is what gives the estimator its discrimination.
 *
 * Contrast rather than raw energy matters: a track with a four-on-the-floor
 * kick has high kick energy at EVERY phase, so absolute energy is
 * uninformative. Only the difference between hypothesised strong and weak
 * positions carries the metre.
 *
 * ── Metre ────────────────────────────────────────────────────────────────
 * The same machinery run at m = 3 gives a waltz hypothesis. It must beat the
 * 4/4 score by `METER_3_MARGIN` to be adopted — see that constant for why the
 * asymmetry is deliberate rather than sloppy.
 *
 * ── Sampling ─────────────────────────────────────────────────────────────
 * Band energy is read as the max over a ±1-frame neighbourhood of the beat.
 * A kick transient's peak lands slightly after the notional beat instant and
 * the beat itself carries sub-frame refinement, so a single-frame probe would
 * alias. One frame of tolerance costs nothing and removes that failure mode.
 *
 * ── Known limit: half-bar ambiguity ──────────────────────────────────────
 * A perfectly symmetric kick|snare|kick|snare bar — identical kick weight on
 * beats 1 and 3 — makes phase `p` and phase `p+2` score IDENTICALLY. This is
 * not an estimator weakness; the information genuinely is not present in the
 * percussion. Real material breaks the tie with a heavier bar-start kick
 * (which this scorer then picks up automatically) or with harmonic rhythm
 * (which would need a chroma feature we do not currently persist). When the
 * pattern is exactly symmetric the returned phase is one of the two valid
 * bar starts and `confidence` reflects the reduced margin.
 */
export interface DownbeatResult {
  /** Timestamps (ms) of detected bar starts. */
  downbeats: TimeMs[]
  /** Detected metre: 4 (4/4) or 3 (3/4). */
  timeSignature: number
  /** Index within `beats` of the first downbeat (0 … timeSignature−1). */
  phase: number
  /** 0-1 — how decisively the winning phase beat the alternatives. */
  confidence: number
}

export function detectDownbeats(beats: TimeMs[], heatmap: HeatmapData): DownbeatResult {
  const nBeats = beats.length

  // Below two bars there is no periodicity to measure. Report the naive
  // answer but flag it honestly with zero confidence rather than pretending.
  if (nBeats < 8) {
    const downbeats: TimeMs[] = []
    for (let i = 0; i < nBeats; i += 4) downbeats.push(beats[i])
    return { downbeats, timeSignature: 4, phase: 0, confidence: 0 }
  }

  const res = heatmap.resolutionMs
  const nFrames = heatmap.energy.length
  const sub = heatmap.subBass
  const bassR = heatmap.bassReal
  const mid = heatmap.mid
  const lowMid = heatmap.lowMid

  // Per-beat band energies — two allocations, then pure arithmetic.
  const kick = new Float64Array(nBeats)
  const snare = new Float64Array(nBeats)

  for (let i = 0; i < nBeats; i++) {
    const centre = Math.round(beats[i] / res)
    let lo = centre - 1
    let hi = centre + 1
    if (lo < 0) lo = 0
    if (hi > nFrames - 1) hi = nFrames - 1

    let kMax = 0
    let sMax = 0
    for (let f = lo; f <= hi; f++) {
      // Kick proxy: 20–250 Hz. Mirrors GodEar's `kick ← subBass + bass×0.5`.
      const kv = sub
        ? sub[f] + (bassR ? bassR[f] * 0.5 : 0)
        : heatmap.bass[f]
      if (kv > kMax) kMax = kv
      // Snare proxy: 150 Hz–5 kHz. Mirrors `snare ← mid + lowMid×0.5`.
      const sv = mid
        ? mid[f] + (lowMid ? lowMid[f] * 0.5 : 0)
        : heatmap.high[f]
      if (sv > sMax) sMax = sv
    }
    kick[i] = kMax
    snare[i] = sMax
  }

  /** Scores one (metre, phase) hypothesis by metrical contrast. */
  const scorePhase = (m: number, p: number): number => {
    let downKick = 0, downKickN = 0
    let otherKick = 0, otherKickN = 0
    let downSnare = 0, downSnareN = 0
    let backSnare = 0, backSnareN = 0

    for (let i = 0; i < nBeats; i++) {
      const pos = ((i - p) % m + m) % m
      if (pos === 0) {
        downKick += kick[i]; downKickN++
        downSnare += snare[i]; downSnareN++
      } else {
        otherKick += kick[i]; otherKickN++
        // Backbeat = 2 and 4 in common time. In 3/4 there is no backbeat, so
        // every non-downbeat serves as the weak-position reference.
        if (m !== 4 || pos === 1 || pos === 3) {
          backSnare += snare[i]; backSnareN++
        }
      }
    }

    if (downKickN === 0 || otherKickN === 0 || downSnareN === 0 || backSnareN === 0) {
      return -Infinity
    }
    const kickContrast = downKick / downKickN - otherKick / otherKickN
    const snareContrast = backSnare / backSnareN - downSnare / downSnareN
    return kickContrast + snareContrast
  }

  /** Best phase for a given metre, plus the spread across phases. */
  const evalMeter = (m: number) => {
    let best = -Infinity, bestP = 0
    let min = Infinity, sum = 0, n = 0
    for (let p = 0; p < m; p++) {
      const s = scorePhase(m, p)
      if (!Number.isFinite(s)) continue
      if (s > best) { best = s; bestP = p }
      if (s < min) min = s
      sum += s
      n++
    }
    const mean = n > 0 ? sum / n : 0
    const spread = Number.isFinite(best) && Number.isFinite(min) ? best - min : 0
    return { best, bestP, mean, spread, valid: n > 0 }
  }

  const m4 = evalMeter(4)
  const m3 = evalMeter(3)

  let meter = 4
  let chosen = m4
  // Adopt 3/4 only on a clear win. Note the sign guard: comparing against
  // `m4.best * MARGIN` is only a stricter test when m4.best is positive; when
  // 4/4 scores negative the multiplication loosens it, so require positivity.
  if (m3.valid && m3.best > 0 && (!m4.valid || m4.best <= 0 || m3.best > m4.best * METER_3_MARGIN)) {
    meter = 3
    chosen = m3
  }

  if (!chosen.valid || !Number.isFinite(chosen.best)) {
    const downbeats: TimeMs[] = []
    for (let i = 0; i < nBeats; i += 4) downbeats.push(beats[i])
    return { downbeats, timeSignature: 4, phase: 0, confidence: 0 }
  }

  // Confidence = how far the winner sits above the average hypothesis,
  // scaled by the total spread. All phases equal ⇒ no evidence ⇒ 0.
  let confidence = 0
  if (chosen.spread > 1e-9) {
    confidence = (chosen.best - chosen.mean) / chosen.spread
    if (confidence < 0) confidence = 0
    if (confidence > 1) confidence = 1
  }

  const downbeats: TimeMs[] = []
  for (let i = chosen.bestP; i < nBeats; i += meter) downbeats.push(beats[i])

  return { downbeats, timeSignature: meter, phase: chosen.bestP, confidence }
}

/**
 * 🩻 WAVE 2077: Detecta beats usando bandas FFT reales
 * 🌊 WAVE 7563: VARIABLE-TEMPO — Ellis DP tracker + spectral downbeats
 *
 * The constant-tempo assumption is gone. The grid is no longer synthesised
 * from a scalar; it is TRACKED against the onset envelope with a time-varying
 * target period supplied by the TempoOracle's tempo curve.
 *
 * Pipeline:
 *   1. Build a half-wave-rectified, kick-weighted onset envelope.
 *   2. Ellis DP over that envelope, target period from `tempoCurve`.
 *   3. Spectral downbeat/metre detection from kick–snare contrast.
 *   4. Fall back to the legacy uniform grid if the DP cannot track.
 *
 * `bpm` in the returned grid remains the Oracle's whole-track scalar — it is
 * still the honest answer to "what tempo is this track?" and every existing
 * consumer (the UI, `LuxAnalysisV3.detectedBpm`) expects a scalar there. The
 * variable information lives in `beats[]` and `tempoCurve[]`.
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
  /** 🌊 WAVE 7563: per-frame tempo curve driving the DP target period. */
  tempoCurve: number[],
): BeatGridData {
  const numPoints = heatmap.energy.length
  const resolutionMs = heatmap.resolutionMs
  const durationMs = (samples.length / sampleRate) * 1000

  // ── Legacy onset peak list — retained for the confidence metric and for
  //    the uniform-grid fallback path. ──────────────────────────────────
  const onsets: TimeMs[] = []
  const threshold = config.beatSensitivity
  for (let i = 1; i < heatmap.flux.length - 1; i++) {
    const curr = heatmap.flux[i]
    const prev = heatmap.flux[i - 1]
    const next = heatmap.flux[i + 1]
    if (curr > prev && curr > next && curr > threshold) {
      const kickWeight = heatmap.subBass
        ? 1 + (heatmap.subBass[i] + (heatmap.bassReal?.[i] ?? 0)) * 0.8
        : 1 + heatmap.bass[i] * 0.5
      if (curr * kickWeight > threshold) {
        onsets.push(i * resolutionMs)
      }
    }
  }

  // 🔮 The oracleBpm remains the definitive scalar. Fall back to the
  // deprecated histogram only when the Oracle produced zero confident frames.
  const bpm = oracleBpm > 0 ? oracleBpm : estimateBpm(onsets)
  const msPerBeat = 60000 / bpm

  // ── 🌊 WAVE 7563: variable-tempo tracking ─────────────────────────────
  const onsetEnv = buildOnsetEnvelope(heatmap, numPoints)
  let beats = trackBeatsDP(onsetEnv, tempoCurve, numPoints, resolutionMs)

  // The DP needs real onset structure. Ambient, atonal, or near-silent
  // material yields an envelope with no periodic peaks and the backtrace
  // collapses. Rather than emit two beats and call it a grid, fall back to
  // the legacy uniform construction — a metronome is wrong, but an empty
  // grid breaks snapping entirely.
  let usedFallback = false
  const minExpectedBeats = Math.max(2, Math.floor(durationMs / msPerBeat * 0.5))
  if (beats.length < minExpectedBeats) {
    usedFallback = true
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
        if (score > bestScore) { bestScore = score; bestOffset = onset }
      }
      firstBeatMs = bestOffset % msPerBeat
    }
    beats = []
    for (let t = firstBeatMs; t < durationMs; t += msPerBeat) beats.push(t)
  }

  const firstBeatMs = beats.length > 0 ? beats[0] : 0

  // ── 🌊 WAVE 7563: spectral downbeats ──────────────────────────────────
  const db = detectDownbeats(beats, heatmap)

  // ── Confidence ────────────────────────────────────────────────────────
  // Two-pointer sweep over the (sorted) onset and beat arrays — the old
  // implementation ran `Array.find` per onset, which was O(onsets × beats).
  let alignedOnsets = 0
  const tol = msPerBeat * 0.15
  let bi = 0
  for (let oi = 0; oi < onsets.length; oi++) {
    const o = onsets[oi]
    while (bi + 1 < beats.length && beats[bi + 1] <= o) bi++
    const dPrev = Math.abs(o - beats[bi])
    const dNext = bi + 1 < beats.length ? Math.abs(beats[bi + 1] - o) : Infinity
    if (Math.min(dPrev, dNext) < tol) alignedOnsets++
  }
  const onsetConfidence = onsets.length > 0 ? alignedOnsets / onsets.length : 0.5
  const confidence = Math.max(onsetConfidence, oracleConfidence)

  return {
    bpm,
    firstBeatMs,
    timeSignature: db.timeSignature,
    beats,
    downbeats: db.downbeats,
    confidence,
    // 🌊 WAVE 7563: variable-tempo payload
    tempoCurve,
    tempoCurveResolutionMs: resolutionMs,
    downbeatPhase: db.phase,
    downbeatConfidence: db.confidence,
    variableTempo: !usedFallback,
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
  // 🔮 CHRONOS PURE MEDIAN ANALYSER: the Oracle's confidence-weighted median
  // remains the definitive scalar BPM.
  // 🌊 WAVE 7563: the tempo CURVE now rides alongside it. detectBeats no
  // longer synthesises a uniform grid from the scalar — it runs an Ellis DP
  // tracker whose target period follows the curve frame by frame, so the
  // emitted `beats[]` track ritardandos, pitch-rides, and live drift.
  onProgress?.('beats', 0, 'Tracking beats (Ellis DP)...')
  const beatGrid = detectBeats(
    monoSamples, sampleRate, energyHeatmap, config,
    heatmapResult.oracleBpm, heatmapResult.oracleConfidence,
    heatmapResult.tempoCurve,
  )
  onProgress?.('beats', 100, 'Beat grid detected')

  // 🐀 WAVE 7564.7: THE PHANTOM CHIVATO — log the final scalar BPM so we can
  // verify the 43Hz aliasing fix from the worker console. This is the single
  // number that propagates to LuxAnalysisV3.detectedBpm and the TransportBar.
  console.log(
    `[Phantom Worker] 🔮 FINAL OFFLINE BPM: ${heatmapResult.oracleBpm.toFixed(2)} ` +
    `(conf: ${heatmapResult.oracleConfidence.toFixed(2)}, ` +
    `samples: ${heatmapResult.tempoCurve.length} frames @ 50ms, ` +
    `variable: ${(beatGrid as any).variableTempo ?? false})`
  )

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
