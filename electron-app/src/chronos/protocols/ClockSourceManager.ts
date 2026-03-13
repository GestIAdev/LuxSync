/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ CLOCK SOURCE MANAGER — WAVE 2501: THE SWITCHBOARD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Central manager that holds all available clock sources and provides
 * a clean API for ChronosEngine to:
 * 1. Switch between clock sources at runtime
 * 2. Query the active source for timecode
 * 3. React to external transport commands
 * 4. Manage MIDI Clock Master (outbound)
 *
 * ARCHITECTURE:
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │                    ClockSourceManager                         │
 * │                                                                │
 * │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐ │
 * │  │   MTC   │ │ Art-Net  │ │    LTC    │ │  MIDI Clk Master │ │
 * │  │ Parser  │ │ TC Recv  │ │  Decoder  │ │  (outbound)      │ │
 * │  └────┬────┘ └────┬─────┘ └────┬──────┘ └────────┬─────────┘ │
 * │       │           │            │                  │           │
 * │       └───────────┼────────────┘                  │           │
 * │                   ▼                               │           │
 * │         activeSource.getTimeMs()                  │           │
 * │                   │                  tick(bpm) ───┘           │
 * └───────────────────┼──────────────────────────────────────────┘
 *                     ▼
 *              ChronosEngine
 *
 * @module chronos/protocols/ClockSourceManager
 * @version WAVE 2501
 */

import type {
  IClockSource,
  ClockSourceType,
  ClockSourceEvents,
} from '../core/ClockSource'
import type { TimeMs } from '../core/types'
import { MTCParser } from './MTCParser'
import { ArtNetTimecodeReceiver } from './ArtNetTimecodeReceiver'
import { LTCDecoder } from './LTCDecoder'
import { MIDIClockMaster } from './MIDIClockMaster'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClockSourceInfo {
  type: ClockSourceType
  name: string
  connected: boolean
  quality: 'none' | 'weak' | 'stable'
}

export interface ClockSourceManagerEvents {
  /** Active source changed */
  'source:changed': { type: ClockSourceType; name: string }
  /** Time sync from external source */
  'sync': ClockSourceEvents['sync']
  /** Transport command from external source */
  'transport': ClockSourceEvents['transport']
  /** Source status changed */
  'status': ClockSourceEvents['status']
  /** Error */
  'error': ClockSourceEvents['error']
}

type ManagerEventHandler<K extends keyof ClockSourceManagerEvents> =
  (payload: ClockSourceManagerEvents[K]) => void

// ═══════════════════════════════════════════════════════════════════════════
// 🎛️ CLOCK SOURCE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class ClockSourceManager {
  // ── Available sources (lazy-created) ──
  private sources = new Map<ClockSourceType, IClockSource>()

  // ── Active external source (null = internal) ──
  private activeSourceType: ClockSourceType = 'internal'

  // ── MIDI Clock Master (outbound, independent of active source) ──
  private midiMaster: MIDIClockMaster | null = null

  // ── Event listeners ──
  private listeners = new Map<
    keyof ClockSourceManagerEvents,
    Set<ManagerEventHandler<any>>
  >()

  // ── Cleanup handles ──
  private sourceCleanups = new Map<ClockSourceType, (() => void)[]>()

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set the active clock source.
   * Stops the previous source and starts the new one.
   * 'internal' means ChronosEngine uses its own AudioContext clock.
   */
  async setSource(type: ClockSourceType): Promise<void> {
    // Stop current external source
    if (this.activeSourceType !== 'internal') {
      const current = this.sources.get(this.activeSourceType)
      if (current) {
        current.stop()
        this.cleanupSource(this.activeSourceType)
      }
    }

    this.activeSourceType = type

    if (type === 'internal') {
      this.emit('source:changed', { type: 'internal', name: 'Internal (AudioContext)' })
      return
    }

    // Get or create the source
    const source = this.getOrCreateSource(type)
    this.wireSourceEvents(type, source)

    try {
      await source.start()
      this.emit('source:changed', { type, name: source.name })
      console.log(`[ClockSourceManager] 🎛️ Active source → ${source.name}`)
    } catch (err) {
      console.error(`[ClockSourceManager] ❌ Failed to start ${type}:`, err)
      // Fallback to internal
      this.activeSourceType = 'internal'
      this.emit('source:changed', { type: 'internal', name: 'Internal (AudioContext)' })
    }
  }

  /**
   * Get current time from the active external source.
   * Returns null if source is 'internal' or not connected.
   * ChronosEngine should fall back to its own clock when null.
   */
  getExternalTimeMs(): TimeMs | null {
    if (this.activeSourceType === 'internal') return null

    const source = this.sources.get(this.activeSourceType)
    return source?.getTimeMs() ?? null
  }

  /**
   * Get the active source type.
   */
  getActiveSourceType(): ClockSourceType {
    return this.activeSourceType
  }

  /**
   * Get status info for all sources.
   */
  getAllSourceInfo(): ClockSourceInfo[] {
    const types: ClockSourceType[] = [
      'internal', 'midi-clock', 'mtc', 'artnet-tc', 'ltc-smpte',
    ]

    return types.map(type => {
      if (type === 'internal') {
        return {
          type: 'internal',
          name: 'Internal (AudioContext)',
          connected: true,
          quality: 'stable' as const,
        }
      }

      const source = this.sources.get(type)
      return {
        type,
        name: source?.name ?? type,
        connected: source?.isConnected() ?? false,
        quality: source?.isConnected()
          ? 'stable' as const
          : 'none' as const,
      }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MIDI CLOCK MASTER (OUTBOUND)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the MIDI Clock Master instance (lazy-created).
   */
  getMIDIMaster(): MIDIClockMaster {
    if (!this.midiMaster) {
      this.midiMaster = new MIDIClockMaster()
    }
    return this.midiMaster
  }

  /**
   * Initialize and start sending MIDI Clock.
   */
  async startMIDIMaster(bpm: number, fromZero = true): Promise<void> {
    const master = this.getMIDIMaster()
    await master.initialize()
    master.setBpm(bpm)
    master.start(fromZero)
  }

  /**
   * Stop sending MIDI Clock.
   */
  stopMIDIMaster(): void {
    this.midiMaster?.stop()
  }

  /**
   * Tick the MIDI Clock Master (call from ChronosEngine per frame).
   */
  tickMIDIMaster(bpm: number): void {
    this.midiMaster?.tick(bpm)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROTOCOL-SPECIFIC ACCESS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Access the MTC Parser directly (for device selection, timecode display).
   */
  getMTC(): MTCParser {
    return this.getOrCreateSource('mtc') as MTCParser
  }

  /**
   * Access the Art-Net Timecode Receiver directly.
   */
  getArtNetTC(): ArtNetTimecodeReceiver {
    return this.getOrCreateSource('artnet-tc') as ArtNetTimecodeReceiver
  }

  /**
   * Access the LTC Decoder directly (for device/framerate selection).
   */
  getLTC(): LTCDecoder {
    return this.getOrCreateSource('ltc-smpte') as LTCDecoder
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════════

  on<K extends keyof ClockSourceManagerEvents>(
    event: K,
    handler: ManagerEventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  private emit<K extends keyof ClockSourceManagerEvents>(
    event: K,
    payload: ClockSourceManagerEvents[K]
  ): void {
    this.listeners.get(event)?.forEach(h => {
      try { h(payload) } catch (e) { console.error('[ClockSourceManager] event error:', e) }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DISPOSE
  // ═══════════════════════════════════════════════════════════════════════

  dispose(): void {
    // Stop and dispose all sources
    this.sources.forEach((source, type) => {
      source.dispose()
      this.cleanupSource(type)
    })
    this.sources.clear()

    // Dispose MIDI master
    this.midiMaster?.dispose()
    this.midiMaster = null

    this.listeners.clear()
    console.log('[ClockSourceManager] 🗑️ Disposed')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  private getOrCreateSource(type: ClockSourceType): IClockSource {
    let source = this.sources.get(type)
    if (source) return source

    switch (type) {
      case 'mtc':
        source = new MTCParser()
        break
      case 'artnet-tc':
        source = new ArtNetTimecodeReceiver()
        break
      case 'ltc-smpte':
        source = new LTCDecoder()
        break
      default:
        throw new Error(`Unknown clock source type: ${type}`)
    }

    this.sources.set(type, source)
    return source
  }

  private wireSourceEvents(type: ClockSourceType, source: IClockSource): void {
    const cleanups: (() => void)[] = []

    cleanups.push(
      source.on('sync', (payload) => this.emit('sync', payload))
    )
    cleanups.push(
      source.on('transport', (payload) => this.emit('transport', payload))
    )
    cleanups.push(
      source.on('status', (payload) => this.emit('status', payload))
    )
    cleanups.push(
      source.on('error', (payload) => this.emit('error', payload))
    )

    this.sourceCleanups.set(type, cleanups)
  }

  private cleanupSource(type: ClockSourceType): void {
    const cleanups = this.sourceCleanups.get(type)
    if (cleanups) {
      cleanups.forEach(fn => fn())
      this.sourceCleanups.delete(type)
    }
  }
}
