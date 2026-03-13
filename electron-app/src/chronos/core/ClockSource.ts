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
  | 'internal'       // AudioContext / performance.now() (default)
  | 'midi-clock'     // MIDI Clock slave (beat-based, 24 PPQ)
  | 'mtc'            // MIDI Time Code (position-based, HH:MM:SS:FF)
  | 'artnet-tc'      // Art-Net Timecode (UDP 6454)
  | 'ltc-smpte'      // LTC / SMPTE (audio bi-phase mark decode)

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

  /** Stop listening / deactivate */
  stop(): void

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
  abstract stop(): void
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
 */
export function smpteToMs(tc: SMPTETimecode): TimeMs {
  const totalFrames =
    tc.hours * 3600 * tc.frameRate +
    tc.minutes * 60 * tc.frameRate +
    tc.seconds * tc.frameRate +
    tc.frames

  // Handle 29.97 drop-frame approximation
  const effectiveRate = tc.frameRate === 29.97 ? 30000 / 1001 : tc.frameRate
  return (totalFrames / effectiveRate) * 1000
}

/**
 * Convert milliseconds to SMPTE timecode.
 *
 * Uses Math.round on totalFrames to avoid IEEE-754 floating-point truncation
 * (e.g. 5025.48 * 25 = 125636.999... instead of 125637). All field decomposition
 * is then derived from the integer frame count for perfect consistency.
 */
export function msToSmpte(ms: TimeMs, frameRate: SMPTEFrameRate): SMPTETimecode {
  const effectiveRate = frameRate === 29.97 ? 30000 / 1001 : frameRate
  const nominalRate = Math.round(effectiveRate) // 24, 25, 30
  const totalFrames = Math.round((ms / 1000) * effectiveRate)

  const frames = totalFrames % nominalRate
  const totalSeconds = Math.floor(totalFrames / nominalRate)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600) % 24

  return { hours, minutes, seconds, frames, frameRate }
}
