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

  // ── Decoded timecode (mutated in place — REV. 2 zero-alloc) ──
  private currentTimecode: SMPTETimecode = {
    hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25,
  }
  // Pre-allocated return buffer for getTimecode() — avoids spread copy per call
  private _timecodeReturnBuf: SMPTETimecode = {
    hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25,
  }
  private currentTimeMs: TimeMs = 0

  // REV. 2: Pre-allocated event payloads — zero allocation per emit
  private _syncPayload = { timeMs: 0 as TimeMs, source: 'mtc' as const }
  private _statusPayload = { connected: true, quality: 'stable' as const, source: 'mtc' as const }

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
   * Last decoded SMPTE timecode.
   *
   * REV. 2: Returns a reference to a pre-allocated return buffer, not a spread
   * copy. The buffer is overwritten on the next call. Callers that need to
   * retain the value across calls should copy the fields explicitly.
   */
  getTimecode(): SMPTETimecode {
    const buf = this._timecodeReturnBuf
    buf.hours = this.currentTimecode.hours
    buf.minutes = this.currentTimecode.minutes
    buf.seconds = this.currentTimecode.seconds
    buf.frames = this.currentTimecode.frames
    buf.frameRate = this.currentTimecode.frameRate
    return buf
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
   *
   * P2.12 FIX: BCD range validation — if hours > 23, minutes > 59, or
   * seconds > 59, the frame is dropped and we wait for the next valid one.
   * This prevents wrong timecode displays from corrupted MIDI data.
   *
   * VALKYRIE H-1 FIX: ±2 frame offset. MTC transmits a full timecode across
   *   8 quarter-frame messages spanning exactly 2 frames of wall time. The
   *   value encoded in the nibbles describes the instant transmission BEGAN.
   *   When assembly completes on piece 7, real time has advanced 2 frames
   *   beyond the assembled value. A conformant receiver must add 2 frames so
   *   its output does not systematically lag the true timecode by 67–80 ms.
   *   Frame-rate wrap-around is handled (frames + 2 may carry into seconds,
   *   minutes, hours). The SysEx full-frame path is NOT offset — it is an
   *   instant locate, not a streaming assembly.
   *
   * VALKYRIE H-2 FIX: Reverse-direction offset. When the transport is
   *   shuttling backwards, quarter-frames arrive in reverse order (7→0) and
   *   assembly completes on piece 0. By that time real time has RETREATED 2
   *   frames from the assembled value, so the receiver must SUBTRACT 2 frames
   *   instead of adding them. The previous unconditional +2 produced a 4-frame
   *   error under reverse shuttle (2 frames too far forward). Negative
   *   wrap-around is handled (frames - 2 may borrow from seconds, minutes,
   *   hours).
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

    // P2.12 FIX: BCD range validation — drop invalid frames
    if (hours > 23 || minutes > 59 || seconds > 59 || frames >= frameRate) {
      console.warn(
        `[MTCParser] ⚠️ Invalid timecode dropped: ${hours}:${minutes}:${seconds}:${frames} ` +
        `(BCD range violation) — waiting for next valid frame`
      )
      return // Drop this frame, wait for the next valid one
    }

    // VALKYRIE H-1/H-2: ±2 frames to compensate for MTC transmission delay.
    // Forward: +2 (assembly completes 2 frames after transmission began).
    // Reverse: -2 (assembly completes 2 frames after transmission began,
    //           but transport is moving backwards, so true time is 2 frames
    //           BEFORE the assembled value).
    const nominalRate = Math.round(frameRate === 29.97 ? 30 : frameRate)
    const offset = this.direction === 'reverse' ? -2 : 2
    let adjFrames = frames + offset
    let adjSeconds = seconds
    let adjMinutes = minutes
    let adjHours = hours
    if (adjFrames >= nominalRate) {
      adjFrames -= nominalRate
      adjSeconds += 1
      if (adjSeconds >= 60) {
        adjSeconds = 0
        adjMinutes += 1
        if (adjMinutes >= 60) {
          adjMinutes = 0
          adjHours = (adjHours + 1) % 24
        }
      }
    } else if (adjFrames < 0) {
      adjFrames += nominalRate
      adjSeconds -= 1
      if (adjSeconds < 0) {
        adjSeconds = 59
        adjMinutes -= 1
        if (adjMinutes < 0) {
          adjMinutes = 59
          adjHours = (adjHours - 1 + 24) % 24
        }
      }
    }

    // REV. 2: Mutate currentTimecode in place — zero allocation
    const tc = this.currentTimecode
    tc.hours = adjHours
    tc.minutes = adjMinutes
    tc.seconds = adjSeconds
    tc.frames = adjFrames
    tc.frameRate = frameRate
    this.currentTimeMs = smpteToMs(tc)

    // REV. 2: Reuse pre-allocated event payloads — zero allocation
    this._syncPayload.timeMs = this.currentTimeMs
    this.emit('sync', this._syncPayload)
    this.emit('status', this._statusPayload)
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

    // P2.12 FIX: BCD range validation for SysEx full-frame — drop invalid
    if (hours > 23 || minutes > 59 || seconds > 59 || frames >= frameRate) {
      console.warn(
        `[MTCParser] ⚠️ Invalid SysEx timecode dropped: ${hours}:${minutes}:${seconds}:${frames} ` +
        `(BCD range violation)`
      )
      return
    }

    // REV. 2: Mutate currentTimecode in place — zero allocation
    const tc = this.currentTimecode
    tc.hours = hours
    tc.minutes = minutes
    tc.seconds = seconds
    tc.frames = frames
    tc.frameRate = frameRate
    this.currentTimeMs = smpteToMs(tc)

    // Reset quarter-frame state (full frame overrides)
    this.receivedPieces = 0
    this.lastPieceIndex = -1

    this.connected = true
    this.lastReceiveTime = performance.now()
    this.resetTimeout()

    // REV. 2: Reuse pre-allocated event payloads — zero allocation
    this._syncPayload.timeMs = this.currentTimeMs
    this.emit('sync', this._syncPayload)
    this.emit('status', this._statusPayload)

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
