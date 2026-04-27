/**
 * WAVE 3504.4 — ORCHESTRATOR MATH EXTRACTION
 * Types for the metrics pipeline (pure, stateless).
 *
 * These types describe the data contracts between SyncSmoother
 * and the rest of the orchestrator pipeline. No runtime or singleton
 * dependencies — safe to import from anywhere.
 */

// ─── INPUT ───────────────────────────────────────────────────────────────────

/**
 * Raw audio bands as they arrive from the audio subsystem (GodEar / Omni path).
 * All values are normalised 0-1 unless stated otherwise.
 */
export interface RawAudioBands {
  bass: number
  mid: number
  high: number
  energy: number
  harshness?: number
  spectralFlatness?: number
  spectralCentroid?: number   // Hz, e.g. 20–20000
  subBass?: number
  lowMid?: number
  highMid?: number
  crestFactor?: number
}

/**
 * Raw rhythmic data from Worker / Pacemaker.
 */
export interface RawRhythmInput {
  workerBpm: number
  workerBpmConfidence: number
  workerOnBeat: boolean
  workerBeatPhase: number
  /** Current freewheel memory BPM (last stable Worker BPM). 0 means no memory. */
  lastStableWorkerBpm: number
  /** Frames since the last stable Worker BPM was recorded. */
  framesSinceStable: number
  /** Maximum frames to hold freewheel memory before falling back to Pacemaker. */
  freewheelTimeoutFrames: number
}

/**
 * Tick output from BeatDetector (Pacemaker PLL).
 */
export interface BeatDetectorState {
  bpm: number
  phase: number
  beatCount: number
  onBeat: boolean
  confidence: number
  kickDetected: boolean
  snareDetected: boolean
  hihatDetected: boolean
  pllPhase: number
  pllOnBeat: boolean
  predictedNextBeatTime: number
  phaseError: number
  pllLocked: boolean
}

// ─── OUTPUT ──────────────────────────────────────────────────────────────────

/**
 * Smoothed spectral metrics produced by SyncSmoother.smooth().
 * All fields are EMA-filtered versions of the corresponding raw inputs.
 */
export interface SmoothedBands {
  harshness: number
  spectralFlatness: number
  spectralCentroid: number
  subBass: number
  lowMid: number
  highMid: number
  crestFactor: number
  /** EMA-smoothed bands for Omni path (VirtualWire/USB). */
  bass: number
  mid: number
  high: number
  energy: number
}

/**
 * Default/initial state for SmoothedBands (steady-state prior before any audio).
 */
export const DEFAULT_SMOOTHED_BANDS: Readonly<SmoothedBands> = {
  harshness: 0,
  spectralFlatness: 0.5,
  spectralCentroid: 2000,
  subBass: 0,
  lowMid: 0,
  highMid: 0,
  crestFactor: 0,
  bass: 0,
  mid: 0,
  high: 0,
  energy: 0,
}

/**
 * Fused rhythm output: the resolved BPM/phase/onBeat after the
 * Worker → Freewheel → Pacemaker priority chain.
 */
export interface FusedRhythm {
  /** Resolved BPM (Worker authority → freewheel → Pacemaker fallback). */
  bpm: number
  /** Beat phase 0-1. PLL phase when locked; Worker phase otherwise. */
  beatPhase: number
  /** True when the Worker (real detection) fired an onBeat this frame. */
  onBeat: boolean
  /** True when PLL is locked and predicted an onBeat. */
  isPLLBeat: boolean
  /** Worker confidence 0-1. */
  confidence: number
}

/**
 * Estimated syncopation value (0-1).
 * Produced by SyncSmoother.estimateSyncopation().
 */
export type Syncopation = number
