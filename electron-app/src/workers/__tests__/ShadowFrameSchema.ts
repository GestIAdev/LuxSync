/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 WAVE 2172: SHADOW FRAME SCHEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shared type for the Shadow Logger dump and the data-driven replay test.
 * The Shadow Logger in senses.ts writes an array of these frames to disk.
 * The replay test loads them and feeds `needle` (or recalculates it from
 * raw fluxes) to the IntervalBPMTracker.
 *
 * @wave 2172
 */

export interface ShadowFrame {
  /** Deterministic musical clock timestamp (ms) — frame-perfect, monotonic */
  timestampMs: number

  /** Sub-bass flux (20-60Hz rising edge only) */
  rawLowFlux: number

  /** Mid-range flux (250-2kHz rising edge only) */
  rawMidFlux: number

  /** Full bass flux = rawLowFlux + bassOnlyFlux (20-250Hz onset) */
  rawBassFlux: number

  /** Spectral centroid in Hz — energy center of gravity */
  centroid: number

  /** Final gated value fed to the IntervalBPMTracker.
   *  This is rawBassFlux after the Centroid Gate + Sniper.
   *  needle=0 means the frame was blocked by the gate. */
  needle: number
}
