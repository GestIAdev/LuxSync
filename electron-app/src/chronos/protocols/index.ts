/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📡 CHRONOS PROTOCOLS — WAVE 2501 BARREL EXPORT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Unified exports for all synchronization protocols.
 *
 * @module chronos/protocols
 * @version WAVE 2501
 */

// ── Clock Source Interface ──
export {
  type IClockSource,
  type ClockSourceType,
  type ClockSourceEvents,
  type ClockSourceEventHandler,
  type SMPTEFrameRate,
  type SMPTETimecode,
  BaseClockSource,
  smpteToMs,
  msToSmpte,
} from '../core/ClockSource'

// ── Protocol 1: MTC (MIDI Time Code) Parser ──
export { MTCParser } from './MTCParser'

// ── Protocol 2: Art-Net Timecode Receiver ──
export {
  ArtNetTimecodeReceiver,
  parseArtNetTimecodePacket,
  createArtNetMainProcessListener,
  ARTNET_PORT,
  type ArtNetTimecodePacket,
} from './ArtNetTimecodeReceiver'

// ── Protocol 3: MIDI Clock Master ──
export {
  MIDIClockMaster,
  type MIDIClockMasterState,
  type MIDIClockMasterEvent,
  type MIDIOutputInfo,
} from './MIDIClockMaster'

// ── Protocol 4: LTC / SMPTE Audio Decoder ──
export { LTCDecoder } from './LTCDecoder'

// ── Clock Source Manager ──
export { ClockSourceManager } from './ClockSourceManager'
