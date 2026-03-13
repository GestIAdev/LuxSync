/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔊 LTC / SMPTE AUDIO DECODER — WAVE 2501: THE HACKER OPTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Decodes Linear Timecode (LTC) from an audio input (Line-In or microphone)
 * in real-time using the Web Audio API (AudioWorklet).
 *
 * LTC ENCODING (SMPTE 12M / IEC 60461):
 * - 80 bits per frame, transmitted as bi-phase mark modulation
 * - Bi-phase mark: a transition at every bit boundary,
 *   PLUS a mid-bit transition for binary '1' (no extra for '0')
 * - Self-clocking: the decoder extracts the bit clock from transitions
 * - Sync word: 0011 1111 1111 1101 (bits 64-79) marks frame end
 * - Bits 0-3:   Frame units (BCD)
 * - Bits 8-9:   Frame tens (BCD)
 * - Bits 10-15: Unused / flags (drop-frame, color-frame, etc.)
 * - Bits 16-19: Seconds units (BCD)
 * - Bits 24-26: Seconds tens (BCD)
 * - Bits 32-35: Minutes units (BCD)
 * - Bits 40-42: Minutes tens (BCD)
 * - Bits 48-51: Hours units (BCD)
 * - Bits 56-57: Hours tens (BCD)
 *
 * ARCHITECTURE:
 * ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
 * │  Audio Input     │───▶│  AudioWorklet    │───▶│  LTCDecoder      │
 * │  (Line-In/Mic)   │    │  (real-time DSP) │    │  (ClockSource)   │
 * │                  │    │  bi-phase decode  │    │  → ChronosEngine │
 * └──────────────────┘    └──────────────────┘    └──────────────────┘
 *
 * The AudioWorklet runs on the audio thread (real-time, low latency).
 * It detects zero-crossings, measures pulse widths, and decodes the
 * bi-phase mark signal. Decoded bits are assembled into 80-bit frames.
 * When the sync word is found, the frame is posted to the main thread.
 *
 * @module chronos/protocols/LTCDecoder
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

/** The 16-bit sync word that marks the end of an LTC frame */
const LTC_SYNC_WORD = 0b0011111111111101  // 0x3FFD

/** Number of bits in an LTC frame */
const LTC_FRAME_BITS = 80

/** Signal timeout */
const LTC_SIGNAL_TIMEOUT_MS = 1000

/** Worklet processor name */
const LTC_WORKLET_NAME = 'ltc-decoder-processor'

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 AUDIO WORKLET PROCESSOR CODE (runs on audio thread)
// ═══════════════════════════════════════════════════════════════════════════
//
// This is inline because AudioWorklet requires a separate module URL.
// We create a Blob URL from this string at runtime.
// ═══════════════════════════════════════════════════════════════════════════

const LTC_WORKLET_CODE = `
/**
 * LTC Bi-Phase Mark Decoder — AudioWorklet Processor
 * 
 * Runs on the audio render thread at sample rate (typically 44100/48000 Hz).
 * Decodes bi-phase mark modulation into raw bits, assembles 80-bit frames,
 * and posts decoded timecode to the main thread.
 */
class LTCDecoderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    
    // ── State ──
    this.prevSample = 0           // Previous sample value (for zero-crossing)
    this.lastTransitionSample = 0 // Sample index of last zero-crossing
    this.sampleCounter = 0        // Global sample counter
    this.bitBuffer = []           // Accumulated bits
    this.lastPulseWidth = 0       // Width of previous pulse (samples)
    this.avgBitPeriod = 0         // Running average of a full bit period
    this.decoding = false         // Have we locked onto the signal?
    this.frameCount = 0           // Frames decoded since start
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || input.length === 0 || !input[0]) return true

    const samples = input[0] // mono channel
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      this.sampleCounter++

      // ── Zero-crossing detection ──
      // A transition occurs when the signal crosses zero
      if ((this.prevSample >= 0 && sample < 0) || (this.prevSample < 0 && sample >= 0)) {
        const pulseWidth = this.sampleCounter - this.lastTransitionSample
        this.lastTransitionSample = this.sampleCounter

        if (pulseWidth > 0) {
          this.processPulse(pulseWidth)
        }
      }

      this.prevSample = sample
    }

    return true // Keep processor alive
  }

  processPulse(width) {
    // Bootstrap: need at least one pulse to establish timing
    if (this.lastPulseWidth === 0) {
      this.lastPulseWidth = width
      return
    }

    // In bi-phase mark:
    // - A '0' bit = one long pulse (full bit period)
    // - A '1' bit = two short pulses (half bit period each)
    //
    // Strategy: compare current pulse width to previous.
    // Two consecutive short pulses ≈ one long pulse → '1' bit
    // One long pulse ≈ 2× short pulse → '0' bit

    if (!this.decoding) {
      // Locking phase: establish the bit period from long pulses
      // A long pulse (0-bit) is roughly 2× a short pulse (half of 1-bit)
      if (this.avgBitPeriod === 0) {
        // First estimate: assume this is a full bit period
        this.avgBitPeriod = Math.max(width, this.lastPulseWidth)
      }
      
      // After seeing a few pulses, try to start decoding
      const ratio = width / this.avgBitPeriod
      if (ratio > 0.3 && ratio < 2.5) {
        this.decoding = true
      }
    }

    if (this.decoding) {
      // Classify pulse as 'short' or 'long' relative to avgBitPeriod
      const threshold = this.avgBitPeriod * 0.75

      if (width > threshold) {
        // LONG pulse → '0' bit
        this.bitBuffer.push(0)
        // Update average (IIR filter)
        this.avgBitPeriod = this.avgBitPeriod * 0.95 + width * 0.05
      } else {
        // SHORT pulse — need two short pulses for a '1' bit
        // Pair with previous short pulse
        const combinedWidth = width + this.lastPulseWidth
        const combinedRatio = combinedWidth / this.avgBitPeriod

        if (combinedRatio > 0.6 && combinedRatio < 1.4) {
          // Two short pulses ≈ one bit period → '1' bit
          this.bitBuffer.push(1)
          this.avgBitPeriod = this.avgBitPeriod * 0.95 + combinedWidth * 0.05
          this.lastPulseWidth = 0
          return // Don't update lastPulseWidth, we consumed both
        }
      }

      // Check for sync word
      if (this.bitBuffer.length >= ${LTC_FRAME_BITS}) {
        this.checkForFrame()
      }

      // Prevent unbounded buffer growth
      if (this.bitBuffer.length > ${LTC_FRAME_BITS * 3}) {
        this.bitBuffer = this.bitBuffer.slice(-${LTC_FRAME_BITS * 2})
      }
    }

    this.lastPulseWidth = width
  }

  checkForFrame() {
    // Search for sync word in the last 80 bits
    const bits = this.bitBuffer
    const len = bits.length

    // The sync word is at bits 64-79 of a frame
    // So we need at least 80 bits and check the last 16
    if (len < ${LTC_FRAME_BITS}) return

    // Extract last 16 bits and check for sync word
    const syncCandidate = 
      (bits[len - 16] << 15) | (bits[len - 15] << 14) |
      (bits[len - 14] << 13) | (bits[len - 13] << 12) |
      (bits[len - 12] << 11) | (bits[len - 11] << 10) |
      (bits[len - 10] << 9)  | (bits[len - 9] << 8) |
      (bits[len - 8] << 7)   | (bits[len - 7] << 6) |
      (bits[len - 6] << 5)   | (bits[len - 5] << 4) |
      (bits[len - 4] << 3)   | (bits[len - 3] << 2) |
      (bits[len - 2] << 1)   | bits[len - 1]

    if (syncCandidate !== ${LTC_SYNC_WORD}) return

    // We found the sync word! Extract the 80-bit frame
    const frameBits = bits.slice(len - ${LTC_FRAME_BITS})
    
    // Parse BCD-encoded timecode fields
    const frameUnits = this.bcd(frameBits, 0, 4)    // bits 0-3
    const frameTens  = this.bcd(frameBits, 8, 2)     // bits 8-9
    const dropFrame  = frameBits[10]                  // bit 10
    const secUnits   = this.bcd(frameBits, 16, 4)    // bits 16-19
    const secTens    = this.bcd(frameBits, 24, 3)     // bits 24-26
    const minUnits   = this.bcd(frameBits, 32, 4)    // bits 32-35
    const minTens    = this.bcd(frameBits, 40, 3)     // bits 40-42
    const hourUnits  = this.bcd(frameBits, 48, 4)    // bits 48-51
    const hourTens   = this.bcd(frameBits, 56, 2)     // bits 56-57

    const frames  = frameTens * 10 + frameUnits
    const seconds = secTens * 10 + secUnits
    const minutes = minTens * 10 + minUnits
    const hours   = hourTens * 10 + hourUnits

    // Sanity checks
    if (hours < 24 && minutes < 60 && seconds < 60 && frames < 30) {
      this.port.postMessage({
        type: 'ltc-frame',
        hours,
        minutes,
        seconds,
        frames,
        dropFrame: dropFrame === 1,
        frameNumber: this.frameCount++,
      })
    }

    // Clear buffer after successful decode
    this.bitBuffer = []
  }

  /** Extract BCD value from bit array */
  bcd(bits, offset, length) {
    let value = 0
    for (let i = 0; i < length; i++) {
      value |= (bits[offset + i] & 1) << i
    }
    return value
  }
}

registerProcessor('${LTC_WORKLET_NAME}', LTCDecoderProcessor)
`

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 LTC DECODER (MAIN THREAD — ClockSource)
// ═══════════════════════════════════════════════════════════════════════════

export class LTCDecoder extends BaseClockSource {
  readonly type = 'ltc-smpte' as const
  readonly name = 'LTC / SMPTE (Audio Decode)'

  // ── Audio pipeline ──
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null

  // ── Decoded state ──
  private currentTimecode: SMPTETimecode = {
    hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25,
  }
  private currentTimeMs: TimeMs = 0
  private frameRate: SMPTEFrameRate = 25  // User-selectable
  private framesDecoded = 0

  // ── Signal timeout ──
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null

  // ── Device selection ──
  private selectedDeviceId: string | null = null

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set the expected frame rate before starting.
   * LTC doesn't always encode framerate reliably, so user selection
   * is the standard approach.
   */
  setFrameRate(rate: SMPTEFrameRate): void {
    this.frameRate = rate
  }

  /**
   * Set which audio input device to use (null = default).
   */
  setAudioInput(deviceId: string | null): void {
    this.selectedDeviceId = deviceId
  }

  /**
   * List available audio input devices.
   */
  async getAudioInputs(): Promise<Array<{ id: string; label: string }>> {
    try {
      // Need permission first to get labels
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ id: d.deviceId, label: d.label || `Input ${d.deviceId}` }))
    } catch {
      return []
    }
  }

  async start(): Promise<void> {
    try {
      // 1. Create AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 })

      // 2. Register the worklet processor from inline code
      const blob = new Blob([LTC_WORKLET_CODE], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)

      await (this.audioContext as any).audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      // 3. Get audio input stream
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {}),
        },
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      // 4. Connect audio pipeline
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

      this.workletNode = new AudioWorkletNode(this.audioContext, LTC_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 0,  // No audio output (analysis only)
        channelCount: 1,
        channelCountMode: 'explicit',
      })

      // 5. Listen for decoded frames from the worklet
      this.workletNode.port.onmessage = (event) => {
        const msg = event.data
        if (msg.type === 'ltc-frame') {
          this.handleDecodedFrame(msg)
        }
      }

      // 6. Connect: source → worklet
      this.sourceNode.connect(this.workletNode)

      console.log(
        `[LTCDecoder] 🔊 Started. Listening for LTC signal on ` +
        `${this.selectedDeviceId ?? 'default input'} @${this.frameRate}fps expected`
      )

      this.emit('status', { connected: false, quality: 'none', source: 'ltc-smpte' })

    } catch (err) {
      this.emit('error', {
        error: err instanceof Error ? err : new Error('Failed to start LTC decoder'),
        source: 'ltc-smpte',
      })
      console.error('[LTCDecoder] ❌', err)
    }
  }

  stop(): void {
    // Disconnect audio pipeline
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.clearTimeout()
    this.connected = false
    this.framesDecoded = 0

    this.emit('status', { connected: false, quality: 'none', source: 'ltc-smpte' })
    console.log('[LTCDecoder] 🔊 Stopped')
  }

  getTimeMs(): TimeMs | null {
    return this.connected ? this.currentTimeMs : null
  }

  /**
   * Last decoded SMPTE timecode
   */
  getTimecode(): SMPTETimecode {
    return { ...this.currentTimecode }
  }

  /**
   * Number of successfully decoded frames
   */
  getFramesDecoded(): number {
    return this.framesDecoded
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  private handleDecodedFrame(msg: {
    hours: number
    minutes: number
    seconds: number
    frames: number
    dropFrame: boolean
  }): void {
    const frameRate: SMPTEFrameRate = msg.dropFrame ? 29.97 : this.frameRate

    this.currentTimecode = {
      hours: msg.hours,
      minutes: msg.minutes,
      seconds: msg.seconds,
      frames: msg.frames,
      frameRate,
    }
    this.currentTimeMs = smpteToMs(this.currentTimecode)
    this.framesDecoded++

    if (!this.connected) {
      this.connected = true
      console.log(
        `[LTCDecoder] ✅ Locked onto LTC signal: ` +
        `${msg.hours}:${String(msg.minutes).padStart(2, '0')}:` +
        `${String(msg.seconds).padStart(2, '0')}:` +
        `${String(msg.frames).padStart(2, '0')}`
      )
    }

    this.emit('sync', { timeMs: this.currentTimeMs, source: 'ltc-smpte' })

    // Signal quality based on decode success rate
    const quality = this.framesDecoded > 10 ? 'stable' : 'weak'
    this.emit('status', { connected: true, quality, source: 'ltc-smpte' })

    this.resetTimeout()
  }

  private resetTimeout(): void {
    this.clearTimeout()
    this.timeoutHandle = setTimeout(() => {
      this.connected = false
      this.framesDecoded = 0
      this.emit('status', { connected: false, quality: 'none', source: 'ltc-smpte' })
      console.log('[LTCDecoder] ⚠️ LTC signal lost (timeout)')
    }, LTC_SIGNAL_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }
}
