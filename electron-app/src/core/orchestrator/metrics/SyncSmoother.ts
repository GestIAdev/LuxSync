/**
 * WAVE 3504.4 — ORCHESTRATOR MATH EXTRACTION
 * SyncSmoother — Pure audio-rhythm smoothing.
 *
 * Extracted from TitanOrchestrator.ts (WAVE 1011.5 + WAVE 2094 + WAVE 2179).
 * This module is STATEFUL by design: the Orchestrator creates ONE instance and
 * calls its methods each frame. The state lives INSIDE this object, not in the
 * Orchestrator field soup.
 *
 * ─── WHAT LIVES HERE ────────────────────────────────────────────────────────
 *  • EMA smoothing of spectral bands   (was: applyEMASmoothing)
 *  • Syncopation estimation            (was: estimateSyncopation)
 *  • Worker → Freewheel → Pacemaker BPM priority chain  (was: inline in processFrame)
 *
 * ─── WHAT DOES NOT LIVE HERE ────────────────────────────────────────────────
 *  • No IPC. No EventEmitter. No imports from singletons.
 *  • No DMX. No HAL. No Arbiter.
 *  • All external data enters through method parameters.
 */

import type {
  RawAudioBands,
  RawRhythmInput,
  BeatDetectorState,
  SmoothedBands,
  FusedRhythm,
  Syncopation,
} from './types'

import { DEFAULT_SMOOTHED_BANDS } from './types'

// ─── EMA CONSTANTS ────────────────────────────────────────────────────────────

/**
 * FAST alpha: reactive metrics (harshness, transients, sub-bass, lowMid, highMid, crestFactor).
 * Settles in ~4 frames (~133 ms at 30 fps).
 */
const EMA_ALPHA_FAST = 0.25

/**
 * SLOW alpha: ambient context (spectralFlatness, spectralCentroid).
 * Settles in ~12 frames (~400 ms at 30 fps).
 */
const EMA_ALPHA_SLOW = 0.08

/**
 * OMNI path EMA (VirtualWire / USB).
 * Smooths bass/mid/high/energy from the Worker (~10 fps) to prevent
 * visible oscillation during silent inter-frame gaps.
 */
const EMA_ALPHA_OMNI = 0.35

// ─── SYNCOPATION CONSTANTS ───────────────────────────────────────────────────

/**
 * History window for syncopation estimation (WAVE 2094 / SimpleRhythmDetector parity).
 * 32 frames ≈ 1–2 bars at typical BPMs.
 */
const SYNC_HISTORY_SIZE = 32

/**
 * EMA alpha for syncopation smoothing — same factor as Worker for parity.
 */
const SYNC_EMA_ALPHA = 0.08

// ─── STATE ────────────────────────────────────────────────────────────────────

interface SyncSmootherState {
  smoothed: SmoothedBands
  syncopationHistory: ReadonlyArray<{ phase: number; energy: number }>
  smoothedSyncopation: Syncopation
}

// ─── CLASS ────────────────────────────────────────────────────────────────────

/**
 * Pure audio-rhythm smoother for the Orchestrator pipeline.
 *
 * Encapsulates the EMA filter bank and the syncopation estimator.
 * Instantiate once per Orchestrator; call `smooth()` and
 * `estimateSyncopation()` each frame.
 *
 * @example
 * ```ts
 * const smoother = new SyncSmoother()
 *
 * // Each frame:
 * const bands = smoother.smooth(rawAudioBands)
 * const sync  = smoother.estimateSyncopation(beatPhase, bass, mid)
 * const fused = SyncSmoother.fuseRhythm(rawRhythm, pllState)
 * ```
 */
export class SyncSmoother {
  private _state: SyncSmootherState = {
    smoothed: { ...DEFAULT_SMOOTHED_BANDS },
    syncopationHistory: [],
    smoothedSyncopation: 0.35, // WAVE 2094: neutral prior (same as Worker default)
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Apply Exponential Moving Average smoothing to raw FFT bands.
   *
   * WAVE 1011.5: THE DAM — Eliminates digital noise that causes PAR flickering.
   * Fast alpha for reactive metrics, slow for ambient context.
   * Omni path (VirtualWire/USB) uses its own alpha for bass/mid/high/energy.
   *
   * @param raw Raw audio bands from the last IPC frame.
   * @param omniPath When true, the bass/mid/high/energy fields are also smoothed
   *                 with OMNI alpha (for the low-fps Worker path).
   *                 When false, those fields are passed through untouched.
   * @returns Smoothed bands snapshot (shared reference — do not mutate).
   */
  smooth(raw: RawAudioBands, omniPath = false): SmoothedBands {
    const s = this._state.smoothed

    // ── Reactive (FAST) ──────────────────────────────────────────────────────

    if (typeof raw.harshness === 'number') {
      s.harshness = ema(s.harshness, raw.harshness, EMA_ALPHA_FAST)
    }
    if (typeof raw.subBass === 'number') {
      s.subBass = ema(s.subBass, raw.subBass, EMA_ALPHA_FAST)
    }
    if (typeof raw.lowMid === 'number') {
      s.lowMid = ema(s.lowMid, raw.lowMid, EMA_ALPHA_FAST)
    }
    if (typeof raw.highMid === 'number') {
      s.highMid = ema(s.highMid, raw.highMid, EMA_ALPHA_FAST)
    }
    if (typeof raw.crestFactor === 'number') {
      // WAVE 2347: crestFactor stays FAST — kick transients must be felt
      s.crestFactor = ema(s.crestFactor, raw.crestFactor, EMA_ALPHA_FAST)
    }
    // WAVE 3516: Raw 7-band GodEar treble/ultraAir for Aether pipeline
    if (typeof raw.rawTreble === 'number') {
      s.rawTreble = ema(s.rawTreble, raw.rawTreble, EMA_ALPHA_FAST)
    }
    if (typeof raw.ultraAir === 'number') {
      s.ultraAir = ema(s.ultraAir, raw.ultraAir, EMA_ALPHA_FAST)
    }

    // ── Ambient context (SLOW) ───────────────────────────────────────────────

    if (typeof raw.spectralFlatness === 'number') {
      s.spectralFlatness = ema(s.spectralFlatness, raw.spectralFlatness, EMA_ALPHA_SLOW)
    }
    if (typeof raw.spectralCentroid === 'number') {
      s.spectralCentroid = ema(s.spectralCentroid, raw.spectralCentroid, EMA_ALPHA_SLOW)
    }

    // ── Omni path bands (OMNI alpha, only when Worker is the audio source) ───

    if (omniPath) {
      // WAVE 3422: Without this, bass oscillates between 0 and the real value
      // on silent inter-frame gaps when running the VirtualWire/USB path at ~10 fps.
      s.bass   = ema(s.bass,   raw.bass,   EMA_ALPHA_OMNI)
      s.mid    = ema(s.mid,    raw.mid,    EMA_ALPHA_OMNI)
      s.high   = ema(s.high,   raw.high,   EMA_ALPHA_OMNI)
      s.energy = ema(s.energy, raw.energy, EMA_ALPHA_OMNI)
    }

    return s
  }

  /**
   * Estimate the syncopation value (0-1) for the current frame.
   *
   * WAVE 2094: PACEMAKER TRANSPLANT — main-thread syncopation estimator.
   * Mirror of SimpleRhythmDetector algorithm, now using the REAL Pacemaker
   * beatPhase instead of the stale beatPhase=0 that came from the Worker.
   *
   * Algorithm:
   *  - On-beat window:  phase < 0.25 OR phase > 0.75 (±25% around beat)
   *  - Off-beat window: everything else (the "and" of the beat)
   *  - Syncopation = offBeatEnergy / totalEnergy (EMA-smoothed)
   *
   * High syncopation → funk, breakbeat, afrobeats.
   * Low syncopation  → four-on-floor techno, house.
   *
   * @param beatPhase Current beat phase 0-1 from Pacemaker PLL.
   * @param bass      Raw bass band (pre-AGC, NOT smoothed — we need the raw envelope).
   * @param mid       Raw mid band.
   * @returns Smoothed syncopation estimate 0-1.
   */
  estimateSyncopation(beatPhase: number, bass: number, mid: number): Syncopation {
    const energy = bass + mid * 0.5

    // Mutable copy of the history (we control the mutation here)
    const hist = this._state.syncopationHistory as Array<{ phase: number; energy: number }>
    hist.push({ phase: beatPhase, energy })
    if (hist.length > SYNC_HISTORY_SIZE) hist.shift()

    let onBeatEnergy = 0
    let offBeatEnergy = 0

    for (const frame of hist) {
      const isOnBeat = frame.phase < 0.25 || frame.phase > 0.75
      if (isOnBeat) {
        onBeatEnergy += frame.energy
      } else {
        offBeatEnergy += frame.energy
      }
    }

    const totalEnergy = onBeatEnergy + offBeatEnergy
    const instantSync = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0

    this._state.smoothedSyncopation =
      SYNC_EMA_ALPHA * instantSync + (1 - SYNC_EMA_ALPHA) * this._state.smoothedSyncopation

    return this._state.smoothedSyncopation
  }

  /**
   * Resolve the BPM / beat-phase / onBeat from Worker + Freewheel + Pacemaker.
   *
   * WAVE 2179: FREEWHEEL MEMORY — Worker-BPM priority chain:
   *  1. Worker active (confidence > 0.2) → lock PLL to real BPM
   *  2. Worker silent + recent memory   → freewheel at last stable BPM
   *  3. Memory timeout / no memory      → fall back to Pacemaker internal
   *
   * This is a STATIC (pure) method because the priority logic is deterministic
   * given the inputs — it does not need the EMA history.
   *
   * @param rhythm  Raw rhythm data including Worker fields and freewheel memory.
   * @param pll     Current PLL state from BeatDetector.tick().
   * @returns Fused rhythm ready for MusicalContext injection.
   */
  static fuseRhythm(rhythm: RawRhythmInput, pll: BeatDetectorState): FusedRhythm {
    const {
      workerBpm,
      workerBpmConfidence,
      workerOnBeat,
      workerBeatPhase,
      lastStableWorkerBpm,
      framesSinceStable,
      freewheelTimeoutFrames,
    } = rhythm

    const workerActive    = workerBpm > 0 && workerBpmConfidence > 0.2
    const hasFreewheelMem = lastStableWorkerBpm > 0 && framesSinceStable <= freewheelTimeoutFrames

    if (workerActive) {
      // Priority 1: Worker is alive and confident — use its ground truth
      return {
        bpm:       workerBpm,
        beatPhase: pll.pllLocked ? (pll.pllPhase ?? pll.phase) : workerBeatPhase,
        onBeat:    workerOnBeat || (pll.pllLocked && pll.onBeat),
        isPLLBeat: pll.pllOnBeat,
        confidence: workerBpmConfidence,
      }
    }

    if (hasFreewheelMem) {
      // Priority 2: FREEWHEEL — the show continues at the real BPM.
      // The lights don't know about the break; the PLL spins on inertia.
      return {
        bpm:       lastStableWorkerBpm,
        beatPhase: pll.pllPhase ?? pll.phase,
        onBeat:    pll.pllLocked && pll.onBeat,
        isPLLBeat: pll.pllOnBeat,
        confidence: 0, // Worker is deaf — zero confidence for downstream guards
      }
    }

    // Priority 3: Pacemaker internal (last resort — no Worker memory)
    return {
      bpm:       pll.bpm > 0 ? pll.bpm : 120,
      beatPhase: pll.pllPhase ?? pll.phase,
      onBeat:    pll.pllLocked && pll.onBeat,
      isPLLBeat: pll.pllOnBeat,
      confidence: pll.confidence,
    }
  }

  /**
   * Reset smoother state (call when audio source changes or on hard stop).
   */
  reset(): void {
    this._state = {
      smoothed: { ...DEFAULT_SMOOTHED_BANDS },
      syncopationHistory: [],
      smoothedSyncopation: 0.35,
    }
  }

  // ─── ACCESSORS ──────────────────────────────────────────────────────────────

  /** Current smoothed bands snapshot (read-only reference). */
  get currentSmoothed(): Readonly<SmoothedBands> {
    return this._state.smoothed
  }

  /** Current smoothed syncopation value 0-1. */
  get currentSyncopation(): Syncopation {
    return this._state.smoothedSyncopation
  }
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

/**
 * Single-pole IIR low-pass filter (Exponential Moving Average).
 *
 * Formula: y[n] = (1 − α) · y[n−1] + α · x[n]
 *
 * @param prev    Previous smoothed value.
 * @param raw     New raw sample.
 * @param alpha   Smoothing coefficient (0 = no update, 1 = instantaneous).
 */
function ema(prev: number, raw: number, alpha: number): number {
  return (1 - alpha) * prev + alpha * raw
}
