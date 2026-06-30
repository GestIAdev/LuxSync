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

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MIDI System Real-Time messages */
const MIDI_CLOCK = 0xF8
const MIDI_START = 0xFA
const MIDI_CONTINUE = 0xFB
const MIDI_STOP = 0xFC

/** Pulses Per Quarter Note (MIDI standard) */
const PPQ = 24

/** Sliding window for BPM calculation (beats) */
const BPM_WINDOW_SIZE = 8

/** Minimum BPM change to trigger update (hysteresis) */
const BPM_HYSTERESIS = 0.5

/** Valid BPM range */
const BPM_MIN = 20
const BPM_MAX = 300

/** Signal timeout — no clock pulse for 2 seconds = signal lost */
const SIGNAL_TIMEOUT_MS = 2000

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
  private clockTimestamps: number[] = []
  private beatIntervals: number[] = []
  private lastReportedBpm = 0

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

    const beatDurationMs = 60000 / this.currentBpm
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

    switch (status) {
      case MIDI_CLOCK: {
        const now = performance.now()
        this.pulseCount++
        this.clockTimestamps.push(now)

        // Keep enough timestamps for BPM_WINDOW_SIZE beats
        const maxClocks = PPQ * BPM_WINDOW_SIZE + 1
        if (this.clockTimestamps.length > maxClocks) {
          this.clockTimestamps.shift()
        }

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
        this.clockTimestamps = []
        this.beatIntervals = []
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
    const timestamps = this.clockTimestamps
    if (timestamps.length < PPQ + 1) return

    const beatInterval = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 1 - PPQ]
    this.beatIntervals.push(beatInterval)
    if (this.beatIntervals.length > BPM_WINDOW_SIZE) {
      this.beatIntervals.shift()
    }

    if (this.beatIntervals.length >= 2) {
      const avgInterval = this.beatIntervals.reduce((a, b) => a + b, 0) / this.beatIntervals.length
      const calculatedBpm = 60000 / avgInterval
      const clampedBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, calculatedBpm))
      const roundedBpm = Math.round(clampedBpm * 10) / 10

      if (Math.abs(roundedBpm - this.lastReportedBpm) >= BPM_HYSTERESIS) {
        this.lastReportedBpm = roundedBpm
        this.currentBpm = roundedBpm
      }
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
