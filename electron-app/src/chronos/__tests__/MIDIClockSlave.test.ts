/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ MIDI CLOCK SLAVE CONFORMANCE TESTS — OPERATION HEIMDALL (H-7)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Protocol conformance tests for MIDIClockSlave, specifically proving the
 * VALKYRIE H-2 fix: Song Position Pointer (0xF2) handling.
 *
 * SPP PROTOCOL RECAP:
 *   Status byte: 0xF2
 *   Data byte 1: LSB (7 bits)
 *   Data byte 2: MSB (7 bits)
 *   Position in 16th notes = (MSB << 7) | LSB
 *   Each 16th note = 6 MIDI clocks (24 PPQ / 4)
 *   So pulse count = position × 6
 *
 * TEST STRATEGY:
 *   We bypass the Web MIDI API (unavailable in test env) and call the
 *   private handleMessage() directly via type assertion with a synthetic
 *   MIDIMessageEvent-like object. We then verify the internal pulse count
 *   and timeline position via getTimeMs().
 *
 * @module chronos/__tests__/MIDIClockSlave.test
 * @version HEIMDALL H-7
 */

import { describe, test, expect } from 'vitest'
import { MIDIClockSlave } from '../protocols/MIDIClockSlave'
import { PPQ } from '../utils/bpmDerivation'

// Minimal MIDIMessageEvent-like type for testing.
interface MockMIDIEvent {
  data: Uint8Array
}

// Type alias to access private members.
type MIDIClockSlaveInternals = MIDIClockSlave & {
  handleMessage(event: MockMIDIEvent): void
  pulseCount: number
  totalBeats: number
  currentBpm: number
  isExternalPlaying: boolean
  connected: boolean
}

describe('🎚️ MIDIClockSlave Conformance — VALKYRIE H-2 (Song Position Pointer)', () => {
  /**
   * Create a mock SPP MIDI event: 0xF2, LSB, MSB.
   */
  function makeSPPEvent(lsb: number, msb: number): MockMIDIEvent {
    return { data: new Uint8Array([0xF2, lsb & 0x7F, msb & 0x7F]) }
  }

  test('H-2: SPP updates pulse count to correct position', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // SPP value = 16 (16th notes) → 16 × 6 = 96 pulses = 4 beats
    slave.handleMessage(makeSPPEvent(16, 0))

    expect(slave.pulseCount).toBe(96)
    expect(slave.totalBeats).toBe(4) // 96 / 24 = 4
  })

  test('H-2: SPP with MSB > 0 (large position jump)', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // SPP value = (1 << 7) | 0 = 128 16th notes → 128 × 6 = 768 pulses = 32 beats
    slave.handleMessage(makeSPPEvent(0, 1))

    expect(slave.pulseCount).toBe(768)
    expect(slave.totalBeats).toBe(32) // 768 / 24 = 32
  })

  test('H-2: SPP value 0 resets to position 0', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // First jump to position 96 pulses
    slave.handleMessage(makeSPPEvent(16, 0))
    expect(slave.pulseCount).toBe(96)

    // Then SPP = 0 → reset to 0
    slave.handleMessage(makeSPPEvent(0, 0))
    expect(slave.pulseCount).toBe(0)
    expect(slave.totalBeats).toBe(0)
  })

  test('H-2: SPP updates getTimeMs() to reflect new position', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // SPP = 8 16th notes → 48 pulses = 2 beats
    // At 120 BPM: beatDuration = 60000/120 = 500ms → 2 beats = 1000ms
    slave.handleMessage(makeSPPEvent(8, 0))

    const timeMs = slave.getTimeMs()
    expect(timeMs).not.toBeNull()
    expect(timeMs).toBe(1000) // 2 beats × 500ms
  })

  test('H-2: SPP max value (16383 16th notes) does not overflow', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // SPP max = (127 << 7) | 127 = 16383 16th notes → 16383 × 6 = 98298 pulses
    slave.handleMessage(makeSPPEvent(127, 127))

    expect(slave.pulseCount).toBe(98298)
    expect(slave.totalBeats).toBe(Math.floor(98298 / PPQ)) // 4095 beats
  })

  test('H-2: SPP does not change BPM (it is a locate, not a tempo event)', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 140

    slave.handleMessage(makeSPPEvent(16, 0))

    // BPM should be unchanged — SPP is a position jump, not a tempo change
    expect(slave.getBpm()).toBe(140)
  })

  test('H-2: MIDI_START resets pulse count to 0', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.currentBpm = 120

    // Jump to position 96 first
    slave.handleMessage(makeSPPEvent(16, 0))
    expect(slave.pulseCount).toBe(96)

    // Send START (0xFA) — should reset to 0
    slave.handleMessage({ data: new Uint8Array([0xFA]) })

    expect(slave.pulseCount).toBe(0)
    expect(slave.totalBeats).toBe(0)
    expect(slave.isExternalPlaying).toBe(true)
  })

  test('H-2: SPP followed by MIDI_CLOCK pulses continues from new position', () => {
    const slave = new MIDIClockSlave() as MIDIClockSlaveInternals
    slave.connected = true
    slave.isExternalPlaying = true
    slave.currentBpm = 120

    // Locate to 48 pulses (2 beats)
    slave.handleMessage(makeSPPEvent(8, 0))
    expect(slave.pulseCount).toBe(48)

    // Send 48 clock pulses to reach pulse 96 (4 beats).
    // Note: totalBeats only increments when pulseCount % PPQ === 0 AND
    // clockTimestamps.length >= PPQ + 1 (25). SPP clears timestamps, so the
    // beat at pulse 72 (24 timestamps) is skipped — the guard needs 25.
    // The beat at pulse 96 (48 timestamps) satisfies the guard.
    for (let i = 0; i < 48; i++) {
      slave.handleMessage({ data: new Uint8Array([0xF8]) })
    }

    expect(slave.pulseCount).toBe(96) // 48 + 48
    expect(slave.totalBeats).toBe(3)  // beat at pulse 96, with 48 timestamps >= 25
  })
})
