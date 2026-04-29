/**
 * WAVE 3504.4 — ORCHESTRATOR MATH EXTRACTION
 * Types for the metrics pipeline (pure, stateless).
 *
 * These types describe the data contracts between SyncSmoother
 * and the rest of the orchestrator pipeline. No runtime or singleton
 * dependencies — safe to import from anywhere.
 */
/**
 * Default/initial state for SmoothedBands (steady-state prior before any audio).
 */
export const DEFAULT_SMOOTHED_BANDS = {
    harshness: 0,
    spectralFlatness: 0.5,
    spectralCentroid: 2000,
    subBass: 0,
    lowMid: 0,
    highMid: 0,
    crestFactor: 0,
    rawTreble: 0,
    ultraAir: 0,
    bass: 0,
    mid: 0,
    high: 0,
    energy: 0,
};
