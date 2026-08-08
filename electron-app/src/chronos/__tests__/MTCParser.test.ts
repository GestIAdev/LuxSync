/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 MTC PARSER CONFORMANCE TESTS — OPERATION HEIMDALL (H-7)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Protocol conformance tests for MTCParser, specifically proving the
 * VALKYRIE H-1 fix: the +2 frame transmission-delay offset applied upon
 * full quarter-frame assembly.
 *
 * MTC PROTOCOL RECAP:
 *   A full timecode is transmitted via 8 quarter-frame messages. At normal
 *   speed, this takes exactly 2 frames of wall time. When piece 7 completes
 *   the assembly, real time has advanced 2 frames beyond the encoded value.
 *   A conformant receiver must add 2 frames to compensate.
 *
 * TEST STRATEGY:
 *   We bypass the Web MIDI API (unavailable in test env) and call the
 *   private handleQuarterFrame() directly via type assertion, simulating
 *   the 8-piece sequence. We then verify getTimecode() reflects the +2
 *   frame offset with correct wrap-around.
 *
 * @module chronos/__tests__/MTCParser.test
 * @version HEIMDALL H-7
 */

import { describe, test, expect } from 'vitest'
import { MTCParser } from '../protocols/MTCParser'
import { smpteToMs } from '../core/ClockSource'

// Type alias to access private members without `as any` everywhere.
type MTCParserInternals = MTCParser & {
  handleQuarterFrame(dataByte: number): void
  pieces: number[]
  receivedPieces: number
  direction: 'forward' | 'reverse'
}

describe('🎹 MTCParser Conformance — VALKYRIE H-1 (+2 Frame Offset)', () => {
  /**
   * Send 8 quarter-frame pieces in forward order (0→7) to assemble a full
   * timecode. Each piece carries a 4-bit nibble.
   *
   * Piece layout:
   *   0 = frames LS    (data = low nibble of frames)
   *   1 = frames MS    (data = bit 0 of frames >> 4)
   *   2 = seconds LS   (data = low nibble of seconds)
   *   3 = seconds MS   (data = bits 0-1 of seconds >> 4)
   *   4 = minutes LS   (data = low nibble of minutes)
   *   5 = minutes MS   (data = bits 0-1 of minutes >> 4)
   *   6 = hours LS     (data = low nibble of hours)
   *   7 = hours MS     (data = bit 0 of hours + rate flags in bits 1-2)
   *
   * The dataByte format is: 0nnn_dddd (piece index in upper nibble, data in lower).
   */
  function sendFullTimecode(
    parser: MTCParserInternals,
    hours: number,
    minutes: number,
    seconds: number,
    frames: number,
    rateFlags: number, // 0=24fps, 1=25fps, 2=29.97, 3=30fps
  ): void {
    // Decompose into nibbles
    const framesLS = frames & 0x0F
    const framesMS = (frames >> 4) & 0x01
    const secondsLS = seconds & 0x0F
    const secondsMS = (seconds >> 4) & 0x03
    const minutesLS = minutes & 0x0F
    const minutesMS = (minutes >> 4) & 0x03
    const hoursLS = hours & 0x0F
    // Piece 7: bit 0 = hours MS, bits 1-2 = rate flags
    const hoursMS = ((hours >> 4) & 0x01) | ((rateFlags & 0x03) << 1)

    const nibbles = [framesLS, framesMS, secondsLS, secondsMS, minutesLS, minutesMS, hoursLS, hoursMS]

    for (let i = 0; i < 8; i++) {
      const dataByte = (i << 4) | (nibbles[i] & 0x0F)
      parser.handleQuarterFrame(dataByte)
    }
  }

  test('H-1: +2 frame offset applied on assembly (25fps, no wrap)', () => {
    const parser = new MTCParser() as MTCParserInternals
    // Mark as connected so getTimeMs() returns a value
    ;(parser as any).connected = true

    // Send timecode 01:02:03:10 @ 25fps (rateFlags = 1)
    // Expected after +2 offset: 01:02:03:12
    sendFullTimecode(parser, 1, 2, 3, 10, 1)

    const tc = parser.getTimecode()
    expect(tc.hours).toBe(1)
    expect(tc.minutes).toBe(2)
    expect(tc.seconds).toBe(3)
    expect(tc.frames).toBe(12) // 10 + 2 = 12
    expect(tc.frameRate).toBe(25)
  })

  test('H-1: +2 frame offset wraps into seconds (25fps)', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 00:00:00:24 @ 25fps — frames=24, +2 = 26 >= 25 → wrap to 00:00:01:01
    sendFullTimecode(parser, 0, 0, 0, 24, 1)

    const tc = parser.getTimecode()
    expect(tc.hours).toBe(0)
    expect(tc.minutes).toBe(0)
    expect(tc.seconds).toBe(1) // wrapped
    expect(tc.frames).toBe(1)  // 26 - 25 = 1
    expect(tc.frameRate).toBe(25)
  })

  test('H-1: +2 frame offset wraps seconds→minutes (30fps)', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 00:00:59:29 @ 30fps (rateFlags = 3) — +2 wraps to 00:01:00:01
    sendFullTimecode(parser, 0, 0, 59, 29, 3)

    const tc = parser.getTimecode()
    expect(tc.hours).toBe(0)
    expect(tc.minutes).toBe(1)  // seconds wrapped → minute increments
    expect(tc.seconds).toBe(0)
    expect(tc.frames).toBe(1)   // 31 - 30 = 1
    expect(tc.frameRate).toBe(30)
  })

  test('H-1: +2 frame offset wraps minutes→hours (24fps)', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 00:59:59:23 @ 24fps (rateFlags = 0) — +2 wraps to 01:00:00:01
    sendFullTimecode(parser, 0, 59, 59, 23, 0)

    const tc = parser.getTimecode()
    expect(tc.hours).toBe(1)    // minute wrapped → hour increments
    expect(tc.minutes).toBe(0)
    expect(tc.seconds).toBe(0)
    expect(tc.frames).toBe(1)   // 25 - 24 = 1
    expect(tc.frameRate).toBe(24)
  })

  test('H-1: +2 frame offset wraps hours→0 (24-hour cycle)', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 23:59:59:23 @ 24fps — +2 wraps to 00:00:00:01
    sendFullTimecode(parser, 23, 59, 59, 23, 0)

    const tc = parser.getTimecode()
    expect(tc.hours).toBe(0)    // 24 → 0 (24-hour wrap)
    expect(tc.minutes).toBe(0)
    expect(tc.seconds).toBe(0)
    expect(tc.frames).toBe(1)
    expect(tc.frameRate).toBe(24)
  })

  test('H-1: offset is exactly 2 frames in milliseconds (25fps)', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 00:00:00:00 @ 25fps
    sendFullTimecode(parser, 0, 0, 0, 0, 1)

    const tc = parser.getTimecode()
    const msWithOffset = parser.getTimeMs()
    expect(msWithOffset).not.toBeNull()

    // Without offset, 00:00:00:00 @ 25fps = 0ms.
    // With +2 frames: 2 frames / 25fps = 80ms.
    const expectedMs = smpteToMs({ hours: 0, minutes: 0, seconds: 0, frames: 2, frameRate: 25 })
    expect(msWithOffset).toBe(expectedMs)
    expect(tc.frames).toBe(2)
  })

  test('H-1: 29.97fps uses 30 as nominal rate for wrap-around', () => {
    const parser = new MTCParser() as MTCParserInternals
    ;(parser as any).connected = true

    // Send 00:00:00:29 @ 29.97fps (rateFlags = 2) — +2 = 31, nominal 30 → wrap to 00:00:01:01
    sendFullTimecode(parser, 0, 0, 0, 29, 2)

    const tc = parser.getTimecode()
    expect(tc.seconds).toBe(1)  // wrapped (nominal rate 30, not 29.97)
    expect(tc.frames).toBe(1)   // 31 - 30 = 1
    expect(tc.frameRate).toBe(29.97)
  })
})
