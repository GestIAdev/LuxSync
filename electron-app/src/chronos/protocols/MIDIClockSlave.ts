/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ MIDI CLOCK SLAVE — WAVE 7103: INBOUND PLAYHEAD DRIVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements IClockSource as a MIDI Clock Slave. Accumulates incoming
 * 0xF8 timing clock pulses (24 PPQ) from an external MIDI master
 * (Ableton, Traktor, drum machine, grandMA3) and derives a canonical
 * temporal position in milliseconds.
 *
 * TRANSPORT:
 * - 0xFA (Start): Reset position to 0, begin accumulating
 * - 0xFB (Continue): Resume from current position
 * - 0xFC (Stop): Freeze position
 *
 * POSITION CALCULATION:
 * - Each 24 pulses = 1 beat
 * - beatDuration = 60000 / currentBpm (derived from pulse intervals)
 * - timeMs = totalBeats × beatDuration + partialPulses × (beatDuration / 24)
 * - BPM is derived from a sliding window of beat intervals
 *
 * @module chronos/protocols/MIDIClockSlave
 * @version WAVE 7103
 */

import {
  BaseClockSource,
  type ClockSourceType,
} from '../core/ClockSource'
import type { TimeMs } from '../core/types'
import {
  PPQ,
  BPM_WINDOW_SIZE,
  createBpmDerivationState,
  deriveBpm,
  resetBpmDerivation,
  type BpmDerivationState,
} from '../utils/bpmDerivation'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MIDI System Real-Time messages */
const MIDI_CLOCK = 0xF8
const MIDI_START = 0xFA
const MIDI_CONTINUE = 0xFB
const MIDI_STOP = 0xFC

/** VALKYRIE H-2: Song Position Pointer — 0xF2 (follow DAW playhead jumps). */
const MIDI_SPP = 0xF2
/** SPP measures 16th notes; each 16th = 6 MIDI clocks (24 PPQ / 4). */
const SPP_CLOCKS_PER_UNIT = 6

/** Signal timeout — no clock pulse for 2 seconds = signal lost */
const SIGNAL_TIMEOUT_MS = 2000

// ═══════════════════════════════════════════════════════════════════════════
// REV. 2 — ZERO-ALLOCATION CIRCULAR TIMESTAMP BUFFER
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the Array.push() + Array.shift() pattern that was O(N) per pulse
// (192 element moves at capacity). This circular buffer is O(1) push, O(1)
// beat-interval computation, zero allocations after construction.

class TimestampRing {
  private readonly _buf: Float64Array
  private _head = 0   // next write position
  private _count = 0  // number of valid elements
  private readonly _capacity: number

  constructor(capacity: number) {
    this._capacity = capacity
    this._buf = new Float64Array(capacity)
  }

  get length(): number {
    return this._count
  }

  /** Push a timestamp. O(1). Overwrites oldest if full. */
  push(value: number): void {
    this._buf[this._head] = value
    this._head = (this._head + 1) % this._capacity
    if (this._count < this._capacity) this._count++
  }

  /** Clear all entries. O(1). */
  clear(): void {
    this._head = 0
    this._count = 0
  }

  /**
   * Compute the beat interval (newest - PPQ-ago) directly from the ring.
   * O(1). Returns null if insufficient data (< PPQ+1 entries).
   *
   * This replaces the call to computeBeatInterval(timestamps) which required
   * Array-like bracket access. The ring computes the interval internally
   * using modular arithmetic on its Float64Array backing store.
   */
  beatInterval(ppq: number): number | null {
    if (this._count < ppq + 1) return null
    // newest is at (head - 1 + capacity) % capacity
    const newestIdx = (this._head - 1 + this._capacity) % this._capacity
    // PPQ-ago is at (head - 1 - PPQ + capacity) % capacity
    const oldIdx = (this._head - 1 - ppq + this._capacity * 2) % this._capacity
    return this._buf[newestIdx] - this._buf[oldIdx]
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDI CLOCK SLAVE
// ═══════════════════════════════════════════════════════════════════════════

export class MIDIClockSlave extends BaseClockSource {
  readonly type = 'midi-clock-slave' as ClockSourceType
  readonly name = 'MIDI Clock Slave'

  // ── MIDI access ──
  private midiAccess: MIDIAccess | null = null
  private selectedDeviceId: string | null = null

  // ── Pulse counting ──
  private pulseCount = 0
  private totalBeats = 0
  private isExternalPlaying = false

  // ── BPM derivation ──
  private currentBpm = 120
  // REV. 2: Circular buffer replaces number[] + shift(). O(1) per pulse.
  // Capacity = PPQ * BPM_WINDOW_SIZE + 1 = 193 (same as before).
  private clockTimestamps: TimestampRing = new TimestampRing(PPQ * BPM_WINDOW_SIZE + 1)
  private bpmState: BpmDerivationState = createBpmDerivationState()

  // ── Timeout ──
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null

  // ═══════════════════════════════════════════════════════════════════════
  // IClockSource IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.emit('error', {
        error: new Error('Web MIDI API not available'),
        source: this.type,
      })
      return
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false })
      this.wireInputs()
      this.midiAccess.onstatechange = () => this.wireInputs()
      this.connected = false
      this.emit('status', { connected: false, quality: 'none', source: this.type })
      console.log('[MIDIClockSlave] 🎚️ Started, listening for MIDI Clock...')
    } catch (err) {
      this.emit('error', {
        error: err instanceof Error ? err : new Error('MIDI access denied'),
        source: this.type,
      })
    }
  }

  stop(): void {
    this.unwireInputs()
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null
      this.midiAccess = null
    }
    this.clearTimeout()
    this.isExternalPlaying = false
    this.connected = false
    this.emit('status', { connected: false, quality: 'none', source: this.type })
    console.log('[MIDIClockSlave] 🎚️ Stopped')
  }

  getTimeMs(): TimeMs | null {
    if (!this.connected || !this.isExternalPlaying) return null

    // P1.2 FIX: Guard against BPM=0 or non-finite BPM producing Infinity/NaN
    const bpm = this.currentBpm
    if (!Number.isFinite(bpm) || bpm <= 0) return null

    const beatDurationMs = 60000 / bpm
    const pulseDurationMs = beatDurationMs / PPQ
    const partialPulses = this.pulseCount % PPQ

    return (this.totalBeats * beatDurationMs) + (partialPulses * pulseDurationMs)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /** Select a specific MIDI input device (null = listen to all) */
  selectDevice(deviceId: string | null): void {
    this.selectedDeviceId = deviceId
    if (this.midiAccess) this.wireInputs()
  }

  /** Get the current derived BPM */
  getBpm(): number {
    return this.currentBpm
  }

  /** Is external transport running */
  isExternalTransportRunning(): boolean {
    return this.isExternalPlaying
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MIDI INPUT WIRING
  // ═══════════════════════════════════════════════════════════════════════

  private wireInputs(): void {
    if (!this.midiAccess) return
    this.unwireInputs()

    this.midiAccess.inputs.forEach(input => {
      if (this.selectedDeviceId && input.id !== this.selectedDeviceId) return
      input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event)
    })
  }

  private unwireInputs(): void {
    if (!this.midiAccess) return
    this.midiAccess.inputs.forEach(input => {
      input.onmidimessage = null
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MESSAGE HANDLER
  // ═══════════════════════════════════════════════════════════════════════

  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data
    if (!data || data.length === 0) return

    const status = data[0]

    // VALKYRIE H-2: Song Position Pointer (0xF2) — 3 bytes: status, LSB, MSB.
    //   SPP encodes position in 16th-note units (6 MIDI clocks each). When a
    //   DAW locates to an arbitrary bar, it sends SPP so slaves can jump.
    //   We convert to pulse count and update the timeline position so Chronos
    //   follows the jump instead of resuming from the wrong place.
    if (status === MIDI_SPP && data.length >= 3) {
      const lsb = data[1] & 0x7F
      const msb = data[2] & 0x7F
      const sppUnits = (msb << 7) | lsb          // 0–16383 (16th notes)
      const targetPulses = sppUnits * SPP_CLOCKS_PER_UNIT
      this.pulseCount = targetPulses
      this.totalBeats = Math.floor(targetPulses / PPQ)
      // Clear BPM derivation timestamps — the locate is a discontinuity, not
      // a tempo change, so prior pulse intervals are no longer meaningful.
      this.clockTimestamps.clear()
      resetBpmDerivation(this.bpmState)
      this.emit('sync', { timeMs: this.getTimeMs() ?? 0, source: this.type })
      console.log(
        `[MIDIClockSlave] 📍 SPP locate: ${sppUnits} 16th-notes → ` +
        `pulse ${targetPulses} (beat ${this.totalBeats})`
      )
      return
    }

    switch (status) {
      case MIDI_CLOCK: {
        const now = performance.now()
        this.pulseCount++
        // REV. 2: O(1) circular buffer push — no shift(), no element moves
        this.clockTimestamps.push(now)

        // Every PPQ (24) pulses = 1 beat
        if (this.pulseCount % PPQ === 0 && this.clockTimestamps.length >= PPQ + 1) {
          this.totalBeats++
          this.updateBpm()
        }

        if (!this.connected) {
          this.connected = true
          this.emit('status', { connected: true, quality: 'stable', source: this.type })
        }

        this.emit('sync', { timeMs: this.getTimeMs() ?? 0, source: this.type })
        this.resetTimeout()
        break
      }

      case MIDI_START: {
        this.pulseCount = 0
        this.totalBeats = 0
        this.clockTimestamps.clear()
        resetBpmDerivation(this.bpmState)
        this.isExternalPlaying = true
        this.emit('transport', { command: 'play', source: this.type })
        break
      }

      case MIDI_CONTINUE: {
        this.isExternalPlaying = true
        this.emit('transport', { command: 'continue', source: this.type })
        break
      }

      case MIDI_STOP: {
        this.isExternalPlaying = false
        this.emit('transport', { command: 'stop', source: this.type })
        break
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — BPM DERIVATION
  // ═══════════════════════════════════════════════════════════════════════

  private updateBpm(): void {
    // REV. 2: Compute beat interval directly from the circular buffer.
    // No Array allocation, no index access — O(1) modular arithmetic.
    const beatInterval = this.clockTimestamps.beatInterval(PPQ)
    if (beatInterval === null) return

    const newBpm = deriveBpm(this.bpmState, beatInterval)
    if (newBpm !== null) {
      this.currentBpm = newBpm
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — TIMEOUT
  // ═══════════════════════════════════════════════════════════════════════

  private resetTimeout(): void {
    this.clearTimeout()
    this.timeoutHandle = setTimeout(() => {
      this.connected = false
      this.isExternalPlaying = false
      this.emit('status', { connected: false, quality: 'none', source: this.type })
      console.log('[MIDIClockSlave] ⚠️ Signal lost (timeout)')
    }, SIGNAL_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }
}
