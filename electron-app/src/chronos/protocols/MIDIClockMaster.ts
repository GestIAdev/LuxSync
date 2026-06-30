/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 MIDI CLOCK MASTER — WAVE 7103: IPC PROXY (RENDERER)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renderer-side proxy for the MIDI Clock Master. All pulse generation
 * has been migrated to the Main Process (electron/midi/MidiMasterClock.ts)
 * using process.hrtime.bigint() for jitter < ±0.5ms.
 *
 * This class is now a thin IPC proxy that:
 * 1. Forwards start/stop/setBpm commands to the Main Process
 * 2. Receives pulse callbacks from Main Process and sends 0xF8 to MIDI outputs
 * 3. Retains Web MIDI output management (device enumeration, selection)
 *
 * @module chronos/protocols/MIDIClockMaster
 * @version WAVE 7103
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MIDI_CLOCK = 0xF8
const MIDI_START = 0xFA
const MIDI_CONTINUE = 0xFB
const MIDI_STOP = 0xFC

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
  isRunning: boolean
  bpm: number
  selectedOutputIds: string[]
  availableOutputs: MIDIOutputInfo[]
  isSupported: boolean
  pulsesSent: number
  error: string | null
}

export type MIDIClockMasterEventHandler = (event: MIDIClockMasterEvent) => void

export interface MIDIClockMasterEvent {
  type: 'started' | 'stopped' | 'bpm-changed' | 'error' | 'output-changed'
  bpm?: number
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC BRIDGE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface MidiMasterIPC {
  start: (fromZero: boolean) => void
  stop: () => void
  setBpm: (bpm: number) => void
  onPulse: (callback: (midiByte: number) => void) => () => void
  onTransport: (callback: (midiByte: number) => void) => () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDI CLOCK MASTER — IPC PROXY
// ═══════════════════════════════════════════════════════════════════════════

export class MIDIClockMaster {
  private midiAccess: MIDIAccess | null = null
  private selectedOutputIds: string[] = []
  private isRunning = false
  private currentBpm = 120
  private pulsesSent = 0
  private error: string | null = null

  private ipc: MidiMasterIPC | null = null
  private ipcPulseCleanup: (() => void) | null = null
  private ipcTransportCleanup: (() => void) | null = null

  private listeners = new Set<MIDIClockMasterEventHandler>()

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.error = 'Web MIDI API not available'
      this.emitEvent({ type: 'error', error: this.error })
      return
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false })
      this.midiAccess.onstatechange = () => {
        this.emitEvent({ type: 'output-changed' })
      }
      this.error = null
      console.log('[MIDIClockMaster] 🥁 MIDI access granted (IPC proxy mode)')
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'MIDI access denied'
      this.emitEvent({ type: 'error', error: this.error })
      console.error('[MIDIClockMaster] ❌', this.error)
    }

    this.connectIPC()
  }

  start(fromZero = true): void {
    if (this.isRunning) return
    if (!this.midiAccess) {
      console.warn('[MIDIClockMaster] ⚠️ Not initialized. Call initialize() first.')
      return
    }

    this.isRunning = true
    this.pulsesSent = 0

    const msg = fromZero ? MIDI_START : MIDI_CONTINUE
    this.sendToOutputs(new Uint8Array([msg]))

    this.ipc?.start(fromZero)

    this.emitEvent({ type: 'started', bpm: this.currentBpm })
    console.log(`[MIDIClockMaster] ▶️ ${fromZero ? 'START' : 'CONTINUE'} @${this.currentBpm} BPM (IPC proxy)`)
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false

    this.sendToOutputs(new Uint8Array([MIDI_STOP]))
    this.ipc?.stop()

    this.emitEvent({ type: 'stopped' })
    console.log(`[MIDIClockMaster] ⏹️ STOP (${this.pulsesSent} pulses sent)`)
  }

  tick(_bpm: number): void {
    // WAVE 7103: No-op — pulse generation is now in Main Process.
    // Kept for ChronosEngine API compatibility.
  }

  dispose(): void {
    this.stop()
    this.ipcPulseCleanup?.()
    this.ipcTransportCleanup?.()
    this.ipcPulseCleanup = null
    this.ipcTransportCleanup = null
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null
      this.midiAccess = null
    }
    this.listeners.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  setOutputs(deviceIds: string[]): void {
    this.selectedOutputIds = [...deviceIds]
    this.emitEvent({ type: 'output-changed' })
  }

  setBpm(bpm: number): void {
    this.currentBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))
    this.ipc?.setBpm(this.currentBpm)
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
  // PRIVATE — IPC BRIDGE
  // ═══════════════════════════════════════════════════════════════════════

  private connectIPC(): void {
    const luxsyncAPI = (window as any).luxsync
    const midiMasterAPI = luxsyncAPI?.midiMaster

    if (!midiMasterAPI) {
      console.warn('[MIDIClockMaster] ⚠️ No IPC bridge for midi-master. Renderer-only fallback.')
      return
    }

    this.ipc = {
      start: (fromZero: boolean) => midiMasterAPI.start(fromZero),
      stop: () => midiMasterAPI.stop(),
      setBpm: (bpm: number) => midiMasterAPI.setBpm(bpm),
      onPulse: (cb: (midiByte: number) => void) => midiMasterAPI.onPulse(cb),
      onTransport: (cb: (midiByte: number) => void) => midiMasterAPI.onTransport(cb),
    }

    this.ipcPulseCleanup = this.ipc.onPulse((midiByte: number) => {
      if (midiByte === MIDI_CLOCK) {
        this.sendToOutputs(new Uint8Array([MIDI_CLOCK]))
        this.pulsesSent++
      }
    })

    this.ipcTransportCleanup = this.ipc.onTransport((midiByte: number) => {
      this.sendToOutputs(new Uint8Array([midiByte]))
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — MIDI OUTPUT
  // ═══════════════════════════════════════════════════════════════════════

  private sendToOutputs(data: Uint8Array): void {
    if (!this.midiAccess) return

    this.midiAccess.outputs.forEach(output => {
      if (
        this.selectedOutputIds.length > 0 &&
        !this.selectedOutputIds.includes(output.id)
      ) {
        return
      }

      try {
        output.send(data)
      } catch (err) {
        console.warn(`[MIDIClockMaster] ⚠️ Failed to send to ${output.name}:`, err)
      }
    })
  }
}
