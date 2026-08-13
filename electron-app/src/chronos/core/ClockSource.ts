/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ CLOCK SOURCE — WAVE 2501: THE SPITE-DRIVEN PROTOCOL SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Interfaz unificada para todas las fuentes de reloj externas.
 * ChronosEngine delega la sincronización temporal a un ClockSource
 * seleccionable en runtime: Internal, MIDI Clock, MTC, Art-Net TC, LTC/SMPTE.
 *
 * ARQUITECTURA:
 * ┌──────────────────────────────────────────┐
 * │             ChronosEngine                │
 * │   currentTimeMs ← clockSource.getTimeMs()│
 * └──────────────┬───────────────────────────┘
 *                │ implements IClockSource
 *    ┌───────────┼───────────┬──────────────┬──────────────┐
 *    ▼           ▼           ▼              ▼              ▼
 * Internal   MIDIClock    MTCParser   ArtNetTC Recv   LTC/SMPTE
 * (default)  (slave)      (position)  (UDP 6454)     (AudioWorklet)
 *
 * @module chronos/core/ClockSource
 * @version WAVE 2501
 */

import type { TimeMs } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 CLOCK SOURCE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identifiers for available clock source types.
 */
export type ClockSourceType =
  | 'internal'           // AudioContext / performance.now() (default)
  | 'midi-clock'         // MIDI Clock master (outbound, 24 PPQ)
  | 'midi-clock-slave'   // MIDI Clock slave (inbound, 24 PPQ — WAVE 7103)
  | 'mtc'                // MIDI Time Code (position-based, HH:MM:SS:FF)
  | 'artnet-tc'          // Art-Net Timecode (UDP 6454)
  | 'ltc-smpte'          // LTC / SMPTE (audio bi-phase mark decode)

/**
 * SMPTE frame-rate standards
 */
export type SMPTEFrameRate = 24 | 25 | 29.97 | 30

/**
 * Decoded SMPTE timecode value
 */
export interface SMPTETimecode {
  hours: number
  minutes: number
  seconds: number
  frames: number
  frameRate: SMPTEFrameRate
}

/**
 * Events emitted by a clock source
 */
export interface ClockSourceEvents {
  /** Time reference updated */
  'sync': { timeMs: TimeMs; source: ClockSourceType }
  /** External transport command */
  'transport': { command: 'play' | 'stop' | 'continue'; source: ClockSourceType }
  /** Signal status changed */
  'status': { connected: boolean; quality: 'none' | 'weak' | 'stable'; source: ClockSourceType }
  /** Error */
  'error': { error: Error; source: ClockSourceType }
}

export type ClockSourceEventHandler<K extends keyof ClockSourceEvents> =
  (payload: ClockSourceEvents[K]) => void

/**
 * 🔌 IClockSource
 *
 * Contract that every external clock source must implement.
 * ChronosEngine calls `getTimeMs()` each frame and listens to events
 * for transport commands and status changes.
 */
export interface IClockSource {
  /** Unique type identifier */
  readonly type: ClockSourceType

  /** Human-readable name */
  readonly name: string

  /** Start listening / activate */
  start(): Promise<void>

  /** Stop listening / deactivate.
   *  P2.14: May return a Promise (e.g. LTCDecoder awaits AudioContext.close()). */
  stop(): void | Promise<void>

  /**
   * Returns the current timecode as milliseconds.
   * Returns `null` if no valid signal is present — ChronosEngine
   * falls back to its internal clock in that case.
   */
  getTimeMs(): TimeMs | null

  /** Is this source currently receiving a valid signal? */
  isConnected(): boolean

  /** Subscribe to events */
  on<K extends keyof ClockSourceEvents>(
    event: K,
    handler: ClockSourceEventHandler<K>
  ): () => void

  /** Dispose all resources */
  dispose(): void
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convenience base class with event bus boilerplate.
 * Concrete sources only implement the transport-specific logic.
 */
export abstract class BaseClockSource implements IClockSource {
  abstract readonly type: ClockSourceType
  abstract readonly name: string

  protected connected = false
  protected listeners = new Map<
    keyof ClockSourceEvents,
    Set<ClockSourceEventHandler<any>>
  >()

  abstract start(): Promise<void>
  abstract stop(): void | Promise<void>
  abstract getTimeMs(): TimeMs | null

  isConnected(): boolean {
    return this.connected
  }

  on<K extends keyof ClockSourceEvents>(
    event: K,
    handler: ClockSourceEventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  protected emit<K extends keyof ClockSourceEvents>(
    event: K,
    payload: ClockSourceEvents[K]
  ): void {
    this.listeners.get(event)?.forEach(h => {
      try { h(payload) } catch (e) { console.error(`[${this.name}] event error:`, e) }
    })
  }

  dispose(): void {
    this.stop()
    this.listeners.clear()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧮 SMPTE UTILITIES (shared by MTC, Art-Net TC, LTC)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert SMPTE timecode components to milliseconds.
 *
 * For 29.97 fps, implements true SMPTE 12M drop-frame arithmetic: frames 00
 * and 01 are skipped at the start of every minute except minutes divisible by
 * 10. The nominal counting rate is 30 fps; the actual frame rate is 30000/1001.
 * This replaces the previous 30000/1001 rate-substitution approximation, which
 * produced ~360 ms of cumulative drift per hour against reference drop-frame
 * converters.
 *
 * For 24, 25, and 30 fps (non-drop), the conversion is a direct frame-to-ms
 * calculation.
 */
export function smpteToMs(tc: SMPTETimecode): TimeMs {
  // Non-drop-frame rates (24, 25, 30): direct frame-to-ms conversion.
  if (tc.frameRate !== 29.97) {
    const totalFrames =
      tc.hours * 3600 * tc.frameRate +
      tc.minutes * 60 * tc.frameRate +
      tc.seconds * tc.frameRate +
      tc.frames
    return (totalFrames / tc.frameRate) * 1000
  }

  // 29.97 drop-frame (SMPTE 12M):
  //   totalActualFrames = nominalFrames - droppedFrames
  //   where nominalFrames counts at 30 fps and droppedFrames accounts for
  //   the 2-frame skip at each minute boundary (except every 10th minute).
  //   Wall-clock ms = totalActualFrames / (30000/1001) * 1000.
  const NOMINAL_RATE = 30
  const ACTUAL_RATE = 30000 / 1001

  const totalMinutes = tc.hours * 60 + tc.minutes
  const droppedFrames = 2 * (totalMinutes - Math.floor(totalMinutes / 10))
  const totalActualFrames =
    (tc.hours * 3600 + tc.minutes * 60 + tc.seconds) * NOMINAL_RATE +
    tc.frames -
    droppedFrames

  return (totalActualFrames / ACTUAL_RATE) * 1000
}

/**
 * Convert milliseconds to SMPTE timecode.
 *
 * For 29.97 fps, reverses the SMPTE 12M drop-frame numbering: converts ms to
 * an actual frame index, then adds back the dropped frames to recover the
 * nominal (displayed) frame index, and decomposes into H:MM:SS:FF.
 *
 * Uses Math.round on frame counts to avoid IEEE-754 floating-point truncation
 * (e.g. 5025.48 * 25 = 125636.999... instead of 125637). All field decomposition
 * is then derived from the integer frame count for perfect consistency.
 */
export function msToSmpte(ms: TimeMs, frameRate: SMPTEFrameRate): SMPTETimecode {
  // Non-drop-frame rates (24, 25, 30): direct ms-to-frame conversion.
  if (frameRate !== 29.97) {
    const totalFrames = Math.round((ms / 1000) * frameRate)
    const frames = totalFrames % frameRate
    const totalSeconds = Math.floor(totalFrames / frameRate)
    const seconds = totalSeconds % 60
    const minutes = Math.floor(totalSeconds / 60) % 60
    const hours = Math.floor(totalSeconds / 3600) % 24
    return { hours, minutes, seconds, frames, frameRate }
  }

  // 29.97 drop-frame (SMPTE 12M) reverse:
  //   1. Convert ms to actual frame index at the true NTSC rate.
  //   2. Add back dropped frames to get the nominal (non-drop) frame index.
  //   3. Decompose the nominal index into H:MM:SS:FF at 30 fps.
  const NOMINAL_RATE = 30
  const ACTUAL_RATE = 30000 / 1001
  const DROP_FRAMES = 2
  const FRAMES_PER_MIN = NOMINAL_RATE * 60           // 1800
  const FRAMES_PER_10_MIN = FRAMES_PER_MIN * 10      // 18000
  const DF_FRAMES_PER_10_MIN = FRAMES_PER_10_MIN - DROP_FRAMES * 9  // 17982

  let totalActualFrames = Math.round((ms / 1000) * ACTUAL_RATE)

  // Reverse drop-frame: add back the dropped frames to obtain the nominal
  // (non-drop) frame index that corresponds to the displayed timecode.
  const d10 = Math.floor(totalActualFrames / DF_FRAMES_PER_10_MIN)
  const rem = totalActualFrames % DF_FRAMES_PER_10_MIN

  let nominalFrames: number
  if (rem > DROP_FRAMES) {
    nominalFrames = totalActualFrames
      + DROP_FRAMES * 9 * d10
      + DROP_FRAMES * Math.floor((rem - DROP_FRAMES) / (FRAMES_PER_MIN - DROP_FRAMES))
  } else {
    nominalFrames = totalActualFrames + DROP_FRAMES * 9 * d10
  }

  const frames = nominalFrames % NOMINAL_RATE
  const totalSeconds = Math.floor(nominalFrames / NOMINAL_RATE)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600) % 24

  return { hours, minutes, seconds, frames, frameRate }
}
