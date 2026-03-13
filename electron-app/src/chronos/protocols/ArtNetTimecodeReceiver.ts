/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📡 ART-NET TIMECODE RECEIVER — WAVE 2501
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Receives Art-Net Timecode packets (OpTimeCode, opcode 0x9700) on
 * UDP port 6454 and converts the SMPTE timecode to milliseconds
 * for ChronosEngine synchronization.
 *
 * ART-NET TIMECODE PACKET (Art-Net 4 Protocol, §14):
 * ┌──────────────────────────────────────────────────────────┐
 * │ Offset │ Field      │ Size │ Description                │
 * │      0 │ ID         │    8 │ "Art-Net\0" (0x41 72 ...)  │
 * │      8 │ OpCode     │    2 │ 0x9700 (little-endian)     │
 * │     10 │ ProtVerHi  │    1 │ 0x00                       │
 * │     11 │ ProtVerLo  │    1 │ 14 (0x0E)                  │
 * │     12 │ Filler1    │    1 │ 0x00                       │
 * │     13 │ Filler2    │    1 │ 0x00                       │
 * │     14 │ Frames     │    1 │ 0-29                       │
 * │     15 │ Seconds    │    1 │ 0-59                       │
 * │     16 │ Minutes    │    1 │ 0-59                       │
 * │     17 │ Hours      │    1 │ 0-23                       │
 * │     18 │ Type       │    1 │ 0=Film(24), 1=EBU(25),     │
 * │        │            │      │ 2=DF(29.97), 3=SMPTE(30)   │
 * └──────────────────────────────────────────────────────────┘
 *
 * ARCHITECTURE:
 * - Runs in Electron main process (Node.js dgram UDP socket)
 * - Communicates with renderer via IPC
 * - Renderer-side class acts as proxy → IClockSource
 *
 * This file contains BOTH the main-process handler AND
 * the renderer-side proxy class, separated by clear sections.
 *
 * @module chronos/protocols/ArtNetTimecodeReceiver
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

/** Standard Art-Net UDP port */
export const ARTNET_PORT = 6454

/** Art-Net magic header "Art-Net\0" */
const ARTNET_HEADER = [0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00]

/** OpTimeCode opcode (little-endian: 0x0097 → bytes 0x97, 0x00) */
const OP_TIMECODE_LO = 0x97
const OP_TIMECODE_HI = 0x00

/** Frame rate type → SMPTEFrameRate */
const ARTNET_FRAMERATE_MAP: Record<number, SMPTEFrameRate> = {
  0: 24,      // Film
  1: 25,      // EBU
  2: 29.97,   // DF (Drop Frame)
  3: 30,      // SMPTE
}

/** Signal timeout */
const ARTNET_SIGNAL_TIMEOUT_MS = 2000

// ═══════════════════════════════════════════════════════════════════════════
// 🖥️ MAIN PROCESS — Art-Net UDP Listener (Node.js)
// ═══════════════════════════════════════════════════════════════════════════
//
// This function is meant to be called from the Electron main process.
// It creates a dgram UDP socket on port 6454 and forwards decoded
// timecode to the renderer via IPC.
//
// Usage in main.ts / electron entry:
//   import { createArtNetListener } from './protocols/ArtNetTimecodeReceiver'
//   const listener = createArtNetListener(mainWindow)
//   // listener.close() on app quit
// ═══════════════════════════════════════════════════════════════════════════

export interface ArtNetTimecodePacket {
  frames: number
  seconds: number
  minutes: number
  hours: number
  frameRate: SMPTEFrameRate
  timeMs: TimeMs
}

/**
 * Validate and parse an Art-Net Timecode packet from raw UDP buffer.
 * Returns null if not a valid OpTimeCode packet.
 *
 * This is a PURE FUNCTION — no I/O, no side effects.
 * Usable in both Node.js and browser environments for testing.
 */
export function parseArtNetTimecodePacket(
  buffer: Uint8Array
): ArtNetTimecodePacket | null {
  // Minimum packet size for OpTimeCode
  if (buffer.length < 19) return null

  // Validate "Art-Net\0" header
  for (let i = 0; i < ARTNET_HEADER.length; i++) {
    if (buffer[i] !== ARTNET_HEADER[i]) return null
  }

  // Validate OpCode (little-endian)
  if (buffer[8] !== OP_TIMECODE_LO || buffer[9] !== OP_TIMECODE_HI) return null

  // Extract timecode fields
  const frames = buffer[14]
  const seconds = buffer[15]
  const minutes = buffer[16]
  const hours = buffer[17]
  const typeField = buffer[18]

  const frameRate = ARTNET_FRAMERATE_MAP[typeField]
  if (frameRate === undefined) return null

  // Sanity checks
  if (frames >= 30 || seconds >= 60 || minutes >= 60 || hours >= 24) return null

  const tc: SMPTETimecode = { hours, minutes, seconds, frames, frameRate }
  const timeMs = smpteToMs(tc)

  return { frames, seconds, minutes, hours, frameRate, timeMs }
}

/**
 * Creates an Art-Net UDP listener for the Electron main process.
 *
 * Call this from your main process entry point. It will:
 * 1. Bind a UDP socket on port 6454
 * 2. Parse incoming OpTimeCode packets
 * 3. Forward decoded timecodes to the renderer via IPC channel 'artnet:timecode'
 *
 * @example
 * ```typescript
 * // In electron/main.ts:
 * import { createArtNetMainProcessListener } from '../protocols/ArtNetTimecodeReceiver'
 * const listener = createArtNetMainProcessListener(mainWindow)
 * app.on('will-quit', () => listener.close())
 * ```
 */
export function createArtNetMainProcessListener(
  ipcSend: (channel: string, data: ArtNetTimecodePacket) => void
): { close: () => void } {
  // Dynamic require — this code only runs in Node.js / Electron main
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let dgram: typeof import('dgram')
  try {
    dgram = require('dgram')
  } catch {
    console.error('[ArtNetTC] ❌ dgram not available (not running in Node.js?)')
    return { close: () => {} }
  }

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socket.on('message', (msg: Buffer) => {
    const packet = parseArtNetTimecodePacket(new Uint8Array(msg))
    if (packet) {
      ipcSend('artnet:timecode', packet)
    }
  })

  socket.on('error', (err) => {
    console.error('[ArtNetTC] ❌ Socket error:', err.message)
  })

  socket.bind(ARTNET_PORT, () => {
    console.log(`[ArtNetTC] 📡 Listening on UDP port ${ARTNET_PORT}`)
  })

  return {
    close: () => {
      try {
        socket.close()
        console.log('[ArtNetTC] 📡 Socket closed')
      } catch { /* already closed */ }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ RENDERER SIDE — ClockSource Proxy
// ═══════════════════════════════════════════════════════════════════════════
//
// The renderer can't open UDP sockets directly. This class listens to IPC
// events from the main process and acts as an IClockSource for ChronosEngine.
// ═══════════════════════════════════════════════════════════════════════════

export class ArtNetTimecodeReceiver extends BaseClockSource {
  readonly type = 'artnet-tc' as const
  readonly name = 'Art-Net Timecode'

  private currentTimeMs: TimeMs = 0
  private lastPacketTime = 0
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private ipcCleanup: (() => void) | null = null

  async start(): Promise<void> {
    // Guard: only works in browser/Electron renderer
    if (typeof window === 'undefined') {
      this.emit('error', {
        error: new Error('ArtNetTimecodeReceiver requires a browser/Electron renderer environment'),
        source: 'artnet-tc',
      })
      return
    }

    // Listen to IPC channel from main process
    const ipcRenderer = (window as any).electronAPI?.ipcRenderer ??
                        (window as any).lux?.ipc

    if (!ipcRenderer?.on) {
      // Fallback: try window.lux.chronos.onArtNetTimecode
      const chronosAPI = (window as any).lux?.chronos
      if (chronosAPI?.onArtNetTimecode) {
        this.ipcCleanup = chronosAPI.onArtNetTimecode(
          (packet: ArtNetTimecodePacket) => this.handlePacket(packet)
        )
      } else {
        this.emit('error', {
          error: new Error(
            'No IPC bridge available. Ensure Art-Net listener is running in main process.'
          ),
          source: 'artnet-tc',
        })
        return
      }
    } else {
      const handler = (_event: any, packet: ArtNetTimecodePacket) =>
        this.handlePacket(packet)
      ipcRenderer.on('artnet:timecode', handler)
      this.ipcCleanup = () => ipcRenderer.removeListener('artnet:timecode', handler)
    }

    // Ask main process to start the UDP listener
    const ipcSend = (window as any).electronAPI?.send ??
                    (window as any).lux?.ipc?.send
    if (ipcSend) {
      ipcSend('artnet:start')
    }

    this.connected = false // will become true on first packet
    this.emit('status', { connected: false, quality: 'none', source: 'artnet-tc' })
    console.log('[ArtNetTC] 📡 Renderer proxy started, waiting for packets...')
  }

  stop(): void {
    if (this.ipcCleanup) {
      this.ipcCleanup()
      this.ipcCleanup = null
    }

    // Ask main process to stop the UDP listener
    const ipcSend = typeof window !== 'undefined'
      ? ((window as any).electronAPI?.send ?? (window as any).lux?.ipc?.send)
      : undefined
    if (ipcSend) {
      ipcSend('artnet:stop')
    }

    this.clearTimeout()
    this.connected = false
    this.emit('status', { connected: false, quality: 'none', source: 'artnet-tc' })
    console.log('[ArtNetTC] 📡 Renderer proxy stopped')
  }

  getTimeMs(): TimeMs | null {
    return this.connected ? this.currentTimeMs : null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  private handlePacket(packet: ArtNetTimecodePacket): void {
    this.currentTimeMs = packet.timeMs
    this.lastPacketTime = performance.now()

    if (!this.connected) {
      this.connected = true
      this.emit('status', { connected: true, quality: 'stable', source: 'artnet-tc' })
      console.log(
        `[ArtNetTC] ✅ First packet received: ` +
        `${packet.hours}:${String(packet.minutes).padStart(2, '0')}:` +
        `${String(packet.seconds).padStart(2, '0')}:` +
        `${String(packet.frames).padStart(2, '0')} @${packet.frameRate}fps`
      )
    }

    this.emit('sync', { timeMs: this.currentTimeMs, source: 'artnet-tc' })
    this.resetTimeout()
  }

  private resetTimeout(): void {
    this.clearTimeout()
    this.timeoutHandle = setTimeout(() => {
      this.connected = false
      this.emit('status', { connected: false, quality: 'none', source: 'artnet-tc' })
      console.log('[ArtNetTC] ⚠️ Art-Net Timecode signal lost (timeout)')
    }, ARTNET_SIGNAL_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }
}
