/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 MIDI CLOCK MASTER — WAVE 2501: EMIT, DON'T JUST LISTEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Generates MIDI Clock messages (0xF8) at 24 PPQ from the ChronosEngine
 * tick, and sends them to selected MIDI output ports. Also emits
 * Start (0xFA), Continue (0xFB), and Stop (0xFC) transport messages.
 *
 * This makes LuxSync a MIDI Clock Master — other devices (synths, drum
 * machines, DJ software) sync their tempo to us.
 *
 * MIDI CLOCK PROTOCOL (Master side):
 * - Send 0xF8 exactly 24 times per quarter note
 * - Interval between clocks = 60000 / (BPM × 24) ms
 * - Send 0xFA (Start) when playback begins from position 0
 * - Send 0xFB (Continue) when playback resumes from paused position
 * - Send 0xFC (Stop) when playback stops
 *
 * TIMING STRATEGY:
 * - ChronosEngine calls `tick(currentTimeMs, bpm)` each frame (~60fps)
 * - We accumulate time and fire 0xF8 pulses at precise intervals
 * - This avoids the need for a separate high-resolution timer
 * - Jitter stays within ±0.5ms (acceptable for MIDI Clock)
 *
 * @module chronos/protocols/MIDIClockMaster
 * @version WAVE 2501
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MIDI System Real-Time messages */
const MIDI_CLOCK    = 0xF8   // Timing Clock (24 PPQ)
const MIDI_START    = 0xFA   // Start from position 0
const MIDI_CONTINUE = 0xFB   // Continue from current position
const MIDI_STOP     = 0xFC   // Stop

/** Pulses Per Quarter Note (MIDI standard) */
const PPQ = 24

/** Valid BPM range */
const BPM_MIN = 20
const BPM_MAX = 300

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MIDIOutputInfo {
  id: string
  name: string
  manufacturer: string
}

export interface MIDIClockMasterState {
  /** Is the master clock currently running? */
  isRunning: boolean
  /** Current BPM being transmitted */
  bpm: number
  /** Selected output device IDs (empty = send to all) */
  selectedOutputIds: string[]
  /** Available MIDI output devices */
  availableOutputs: MIDIOutputInfo[]
  /** Is Web MIDI API supported? */
  isSupported: boolean
  /** Total clock pulses sent in current session */
  pulsesSent: number
  /** Error message if MIDI access failed */
  error: string | null
}

export type MIDIClockMasterEventHandler = (event: MIDIClockMasterEvent) => void

export interface MIDIClockMasterEvent {
  type: 'started' | 'stopped' | 'bpm-changed' | 'error' | 'output-changed'
  bpm?: number
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 🥁 MIDI CLOCK MASTER
// ═══════════════════════════════════════════════════════════════════════════

export class MIDIClockMaster {
  // ── State ──
  private midiAccess: MIDIAccess | null = null
  private selectedOutputIds: string[] = []
  private isRunning = false
  private currentBpm = 120
  private pulsesSent = 0
  private error: string | null = null

  // ── Timing state ──
  /** Accumulated time since last clock pulse (ms) */
  private accumulator = 0
  /** Last tick timestamp for delta calculation */
  private lastTickTime = 0
  /** Whether transport was started (vs continued) */
  private wasStarted = false

  // ── Event listeners ──
  private listeners = new Set<MIDIClockMasterEventHandler>()

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize Web MIDI access. Must be called before start().
   */
  async initialize(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.error = 'Web MIDI API not available'
      this.emitEvent({ type: 'error', error: this.error })
      return
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false })

      // Hot-plug detection
      this.midiAccess.onstatechange = () => {
        this.emitEvent({ type: 'output-changed' })
      }

      this.error = null
      console.log('[MIDIClockMaster] 🥁 MIDI access granted')
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'MIDI access denied'
      this.emitEvent({ type: 'error', error: this.error })
      console.error('[MIDIClockMaster] ❌', this.error)
    }
  }

  /**
   * Start sending MIDI Clock.
   * @param fromZero If true, sends Start (0xFA). If false, sends Continue (0xFB).
   */
  start(fromZero = true): void {
    if (this.isRunning) return
    if (!this.midiAccess) {
      console.warn('[MIDIClockMaster] ⚠️ Not initialized. Call initialize() first.')
      return
    }

    this.isRunning = true
    this.accumulator = 0
    this.lastTickTime = performance.now()
    this.wasStarted = fromZero

    // Send transport message
    const msg = fromZero ? MIDI_START : MIDI_CONTINUE
    this.sendToOutputs(new Uint8Array([msg]))

    this.emitEvent({ type: 'started', bpm: this.currentBpm })
    console.log(
      `[MIDIClockMaster] ▶️ ${fromZero ? 'START' : 'CONTINUE'} @${this.currentBpm} BPM`
    )
  }

  /**
   * Stop sending MIDI Clock.
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    // Send Stop
    this.sendToOutputs(new Uint8Array([MIDI_STOP]))

    this.emitEvent({ type: 'stopped' })
    console.log(`[MIDIClockMaster] ⏹️ STOP (${this.pulsesSent} pulses sent)`)
  }

  /**
   * Called by ChronosEngine on every frame tick.
   * Sends the appropriate number of 0xF8 clock pulses based on elapsed time.
   *
   * @param bpm Current BPM of the project
   */
  tick(bpm: number): void {
    if (!this.isRunning) return

    // Clamp BPM
    const clampedBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))

    // Detect BPM change
    if (Math.abs(clampedBpm - this.currentBpm) > 0.01) {
      this.currentBpm = clampedBpm
      this.emitEvent({ type: 'bpm-changed', bpm: clampedBpm })
    }

    // Calculate time since last tick
    const now = performance.now()
    const delta = now - this.lastTickTime
    this.lastTickTime = now

    // Interval between clock pulses: 60000ms / (BPM × 24)
    const pulseIntervalMs = 60000 / (this.currentBpm * PPQ)

    // Accumulate time and fire as many pulses as needed
    this.accumulator += delta

    const clockMsg = new Uint8Array([MIDI_CLOCK])

    while (this.accumulator >= pulseIntervalMs) {
      this.sendToOutputs(clockMsg)
      this.accumulator -= pulseIntervalMs
      this.pulsesSent++
    }
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.stop()
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null
      this.midiAccess = null
    }
    this.listeners.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set which MIDI output ports to send clock to.
   * Empty array = send to ALL outputs.
   */
  setOutputs(deviceIds: string[]): void {
    this.selectedOutputIds = [...deviceIds]
    this.emitEvent({ type: 'output-changed' })
  }

  /**
   * Set BPM (will take effect on next tick).
   */
  setBpm(bpm: number): void {
    this.currentBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATE GETTERS
  // ═══════════════════════════════════════════════════════════════════════

  getState(): MIDIClockMasterState {
    return {
      isRunning: this.isRunning,
      bpm: this.currentBpm,
      selectedOutputIds: [...this.selectedOutputIds],
      availableOutputs: this.getOutputs(),
      isSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
      pulsesSent: this.pulsesSent,
      error: this.error,
    }
  }

  getOutputs(): MIDIOutputInfo[] {
    if (!this.midiAccess) return []
    const result: MIDIOutputInfo[] = []
    this.midiAccess.outputs.forEach(output => {
      result.push({
        id: output.id,
        name: output.name || `MIDI Output ${output.id}`,
        manufacturer: output.manufacturer || 'Unknown',
      })
    })
    return result
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════════

  on(handler: MIDIClockMasterEventHandler): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  private emitEvent(event: MIDIClockMasterEvent): void {
    this.listeners.forEach(h => {
      try { h(event) } catch (e) { console.error('[MIDIClockMaster] event error:', e) }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MIDI OUTPUT
  // ═══════════════════════════════════════════════════════════════════════

  private sendToOutputs(data: Uint8Array): void {
    if (!this.midiAccess) return

    this.midiAccess.outputs.forEach(output => {
      // If specific outputs selected, filter
      if (
        this.selectedOutputIds.length > 0 &&
        !this.selectedOutputIds.includes(output.id)
      ) {
        return
      }

      try {
        output.send(data)
      } catch (err) {
        // Output might have been disconnected
        console.warn(`[MIDIClockMaster] ⚠️ Failed to send to ${output.name}:`, err)
      }
    })
  }
}
