/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 MTC PARSER — WAVE 2501: MIDI TIME CODE RECEIVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Parses MIDI Time Code (MTC) Quarter-Frame messages (status 0xF1) to
 * reconstruct absolute timecode (HH:MM:SS:FF) and convert it to
 * milliseconds for ChronosEngine synchronization.
 *
 * MTC PROTOCOL (MIDI 1.0 Spec — MMA):
 * - Full timecode is transmitted via 8 sequential Quarter-Frame messages
 * - Each message carries 4 bits (nibble) of the timecode
 * - Message format: 0xF1 0nnn_dddd
 *   - nnn = piece number (0-7)
 *   - dddd = data nibble
 *
 * Piece assignment:
 *   0 = Frame count LS nibble
 *   1 = Frame count MS nibble
 *   2 = Seconds LS nibble
 *   3 = Seconds MS nibble
 *   4 = Minutes LS nibble
 *   5 = Minutes MS nibble
 *   6 = Hours LS nibble
 *   7 = Hours MS nibble + frame rate (bits 5-6)
 *
 * Frame rate encoding (piece 7, bits 5-6):
 *   00 = 24 fps
 *   01 = 25 fps
 *   10 = 29.97 fps (drop-frame)
 *   11 = 30 fps
 *
 * A complete timecode is assembled after receiving all 8 pieces
 * (2 MIDI frames = 1 full timecode update at normal speed).
 *
 * Full-frame SysEx (0xF0 0x7F 0x7F 0x01 0x01 ... 0xF7):
 *   Instant position update (used on locate/cue).
 *
 * ARCHITECTURE:
 * - Uses Web MIDI API (same as useMIDIClock)
 * - Zero external dependencies
 * - Converts timecode to absolute milliseconds for Chronos
 * - Stateful reassembly of 8 quarter-frame pieces
 *
 * @module chronos/protocols/MTCParser
 * @version WAVE 2501
 */

import {
  BaseClockSource,
  type SMPTEFrameRate,
  type SMPTETimecode,
  smpteToMs,
} from '../core/ClockSource'
import type { TimeMs } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MTC Quarter-Frame status byte */
const MTC_QUARTER_FRAME = 0xF1

/** SysEx start */
const SYSEX_START = 0xF0

/** Full-frame SysEx sub-IDs */
const SYSEX_REALTIME = 0x7F
const MTC_FULL_FRAME_SUB_ID_1 = 0x01
const MTC_FULL_FRAME_SUB_ID_2 = 0x01

/** Signal timeout (ms) — no quarter-frame for this long = lost */
const MTC_SIGNAL_TIMEOUT_MS = 500

/** Frame rate lookup */
const FRAME_RATE_MAP: Record<number, SMPTEFrameRate> = {
  0b00: 24,
  0b01: 25,
  0b10: 29.97,
  0b11: 30,
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎹 MTC PARSER
// ═══════════════════════════════════════════════════════════════════════════

export class MTCParser extends BaseClockSource {
  readonly type = 'mtc' as const
  readonly name = 'MTC (MIDI Time Code)'

  // ── MIDI Access ──
  private midiAccess: MIDIAccess | null = null
  private selectedInputId: string | null = null

  // ── Quarter-Frame reassembly buffer ──
  private pieces: number[] = new Array(8).fill(0)
  private receivedPieces = 0  // bitmask of received pieces
  private lastPieceIndex = -1

  // ── Decoded timecode ──
  private currentTimecode: SMPTETimecode = {
    hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25,
  }
  private currentTimeMs: TimeMs = 0

  // ── Direction detection (for shuttle/rewind) ──
  private direction: 'forward' | 'reverse' = 'forward'

  // ── Signal timeout ──
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private lastReceiveTime = 0

  // ── Bound handler ref (for cleanup) ──
  private boundHandler: ((e: Event) => void) | null = null

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.emit('error', {
        error: new Error('Web MIDI API not available'),
        source: 'mtc',
      })
      return
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true })
      this.wireInputs()

      // Hot-plug support
      this.midiAccess.onstatechange = () => this.wireInputs()

      console.log('[MTCParser] 🎹 MTC receiver started')
    } catch (err) {
      this.emit('error', {
        error: err instanceof Error ? err : new Error('MIDI access denied'),
        source: 'mtc',
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
    this.connected = false
    this.receivedPieces = 0
    this.lastPieceIndex = -1

    this.emit('status', { connected: false, quality: 'none', source: 'mtc' })
    console.log('[MTCParser] 🎹 MTC receiver stopped')
  }

  getTimeMs(): TimeMs | null {
    return this.connected ? this.currentTimeMs : null
  }

  /**
   * Select a specific MIDI input port (null = all)
   */
  selectInput(deviceId: string | null): void {
    this.selectedInputId = deviceId
    if (this.midiAccess) this.wireInputs()
  }

  /**
   * List available MIDI inputs
   */
  getInputs(): Array<{ id: string; name: string }> {
    if (!this.midiAccess) return []
    const result: Array<{ id: string; name: string }> = []
    this.midiAccess.inputs.forEach(input => {
      result.push({ id: input.id, name: input.name || input.id })
    })
    return result
  }

  /**
   * Last decoded SMPTE timecode
   */
  getTimecode(): SMPTETimecode {
    return { ...this.currentTimecode }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MIDI WIRING
  // ═══════════════════════════════════════════════════════════════════════

  private wireInputs(): void {
    this.unwireInputs()
    if (!this.midiAccess) return

    this.boundHandler = (e: Event) => this.handleMIDIMessage(e as MIDIMessageEvent)

    let wired = 0
    this.midiAccess.inputs.forEach(input => {
      if (this.selectedInputId === null || input.id === this.selectedInputId) {
        input.addEventListener('midimessage', this.boundHandler!)
        wired++
      }
    })

    if (wired > 0) {
      console.log(`[MTCParser] 🔌 Listening on ${wired} MIDI input(s)`)
    }
  }

  private unwireInputs(): void {
    if (!this.midiAccess || !this.boundHandler) return
    this.midiAccess.inputs.forEach(input => {
      input.removeEventListener('midimessage', this.boundHandler!)
    })
    this.boundHandler = null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MESSAGE PARSING
  // ═══════════════════════════════════════════════════════════════════════

  private handleMIDIMessage(event: MIDIMessageEvent): void {
    const data = event.data
    if (!data || data.length === 0) return

    const status = data[0]

    if (status === MTC_QUARTER_FRAME && data.length >= 2) {
      this.handleQuarterFrame(data[1])
    } else if (status === SYSEX_START && data.length >= 10) {
      this.handleFullFrameSysEx(data)
    }
  }

  /**
   * Parse a Quarter-Frame message.
   *
   * data byte format: 0nnn_dddd
   *   nnn  = piece index (0-7)
   *   dddd = data nibble
   */
  private handleQuarterFrame(dataByte: number): void {
    const pieceIndex = (dataByte >> 4) & 0x07
    const nibble = dataByte & 0x0F

    this.pieces[pieceIndex] = nibble

    // Direction detection: forward = pieces arrive 0→7, reverse = 7→0
    if (this.lastPieceIndex >= 0) {
      if (pieceIndex === (this.lastPieceIndex + 1) % 8) {
        this.direction = 'forward'
      } else if (pieceIndex === (this.lastPieceIndex - 1 + 8) % 8) {
        this.direction = 'reverse'
      }
    }
    this.lastPieceIndex = pieceIndex

    // Mark this piece as received
    this.receivedPieces |= (1 << pieceIndex)

    // Reset signal timeout
    this.lastReceiveTime = performance.now()
    this.resetTimeout()

    // Signal quality update
    if (!this.connected) {
      this.connected = true
      this.emit('status', { connected: true, quality: 'weak', source: 'mtc' })
    }

    // Full frame assembled when all 8 pieces received
    // (forward: assemble on piece 7, reverse: assemble on piece 0)
    const assembleOn = this.direction === 'forward' ? 7 : 0
    if (pieceIndex === assembleOn && this.receivedPieces === 0xFF) {
      this.assembleTimecode()
      this.receivedPieces = 0
    }
  }

  /**
   * Assemble the 8 nibbles into a full SMPTE timecode.
   */
  private assembleTimecode(): void {
    const frames   = (this.pieces[0]) | ((this.pieces[1] & 0x01) << 4)
    const seconds  = (this.pieces[2]) | ((this.pieces[3] & 0x03) << 4)
    const minutes  = (this.pieces[4]) | ((this.pieces[5] & 0x03) << 4)
    const hourLow  = this.pieces[6]
    const hourHigh = this.pieces[7]

    const hours = (hourLow) | ((hourHigh & 0x01) << 4)

    // Frame rate is in bits 5-6 of piece 7 (the MS nibble of hours byte)
    const rateFlags = (hourHigh >> 1) & 0x03
    const frameRate = FRAME_RATE_MAP[rateFlags] ?? 25

    this.currentTimecode = { hours, minutes, seconds, frames, frameRate }
    this.currentTimeMs = smpteToMs(this.currentTimecode)

    this.emit('sync', { timeMs: this.currentTimeMs, source: 'mtc' })
    this.emit('status', { connected: true, quality: 'stable', source: 'mtc' })
  }

  /**
   * Handle Full-Frame SysEx: F0 7F 7F 01 01 hr mn sc fr F7
   * Instant locate — used when transport jumps to a new position.
   */
  private handleFullFrameSysEx(data: Uint8Array): void {
    // Validate: F0 7F 7F 01 01 ...data... F7
    if (
      data[1] !== SYSEX_REALTIME ||
      data[2] !== SYSEX_REALTIME ||
      data[3] !== MTC_FULL_FRAME_SUB_ID_1 ||
      data[4] !== MTC_FULL_FRAME_SUB_ID_2 ||
      data.length < 10
    ) {
      return
    }

    const hrByte = data[5]
    const rateFlags = (hrByte >> 5) & 0x03
    const hours = hrByte & 0x1F
    const minutes = data[6] & 0x3F
    const seconds = data[7] & 0x3F
    const frames = data[8] & 0x1F
    const frameRate = FRAME_RATE_MAP[rateFlags] ?? 25

    this.currentTimecode = { hours, minutes, seconds, frames, frameRate }
    this.currentTimeMs = smpteToMs(this.currentTimecode)

    // Reset quarter-frame state (full frame overrides)
    this.receivedPieces = 0
    this.lastPieceIndex = -1

    this.connected = true
    this.lastReceiveTime = performance.now()
    this.resetTimeout()

    this.emit('sync', { timeMs: this.currentTimeMs, source: 'mtc' })
    this.emit('status', { connected: true, quality: 'stable', source: 'mtc' })

    console.log(
      `[MTCParser] 📍 Full-frame locate: ` +
      `${hours}:${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}:` +
      `${String(frames).padStart(2, '0')} @${frameRate}fps ` +
      `= ${this.currentTimeMs.toFixed(1)}ms`
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — TIMEOUT
  // ═══════════════════════════════════════════════════════════════════════

  private resetTimeout(): void {
    this.clearTimeout()
    this.timeoutHandle = setTimeout(() => {
      this.connected = false
      this.emit('status', { connected: false, quality: 'none', source: 'mtc' })
      console.log('[MTCParser] ⚠️ MTC signal lost (timeout)')
    }, MTC_SIGNAL_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }
}
