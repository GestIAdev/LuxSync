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
import { BaseClockSource, smpteToMs, } from '../core/ClockSource';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Standard Art-Net UDP port */
export const ARTNET_PORT = 6454;
/** Art-Net magic header "Art-Net\0" */
const ARTNET_HEADER = [0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00];
/** OpTimeCode opcode (little-endian: 0x0097 → bytes 0x97, 0x00) */
const OP_TIMECODE_LO = 0x97;
const OP_TIMECODE_HI = 0x00;
/** Frame rate type → SMPTEFrameRate */
const ARTNET_FRAMERATE_MAP = {
    0: 24, // Film
    1: 25, // EBU
    2: 29.97, // DF (Drop Frame)
    3: 30, // SMPTE
};
/** Signal timeout */
const ARTNET_SIGNAL_TIMEOUT_MS = 2000;
/**
 * Validate and parse an Art-Net Timecode packet from raw UDP buffer.
 * Returns null if not a valid OpTimeCode packet.
 *
 * This is a PURE FUNCTION — no I/O, no side effects.
 * Usable in both Node.js and browser environments for testing.
 */
export function parseArtNetTimecodePacket(buffer) {
    // Minimum packet size for OpTimeCode
    if (buffer.length < 19)
        return null;
    // Validate "Art-Net\0" header
    for (let i = 0; i < ARTNET_HEADER.length; i++) {
        if (buffer[i] !== ARTNET_HEADER[i])
            return null;
    }
    // Validate OpCode (little-endian)
    if (buffer[8] !== OP_TIMECODE_LO || buffer[9] !== OP_TIMECODE_HI)
        return null;
    // Extract timecode fields
    const frames = buffer[14];
    const seconds = buffer[15];
    const minutes = buffer[16];
    const hours = buffer[17];
    const typeField = buffer[18];
    const frameRate = ARTNET_FRAMERATE_MAP[typeField];
    if (frameRate === undefined)
        return null;
    // Sanity checks
    if (frames >= 30 || seconds >= 60 || minutes >= 60 || hours >= 24)
        return null;
    const tc = { hours, minutes, seconds, frames, frameRate };
    const timeMs = smpteToMs(tc);
    return { frames, seconds, minutes, hours, frameRate, timeMs };
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
export function createArtNetMainProcessListener(ipcSend) {
    // Dynamic require — this code only runs in Node.js / Electron main
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let dgram;
    try {
        dgram = require('dgram');
    }
    catch {
        console.error('[ArtNetTC] ❌ dgram not available (not running in Node.js?)');
        return { close: () => { } };
    }
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('message', (msg) => {
        const packet = parseArtNetTimecodePacket(new Uint8Array(msg));
        if (packet) {
            ipcSend('artnet:timecode', packet);
        }
    });
    socket.on('error', (err) => {
        console.error('[ArtNetTC] ❌ Socket error:', err.message);
    });
    socket.bind(ARTNET_PORT, () => {
        console.log(`[ArtNetTC] 📡 Listening on UDP port ${ARTNET_PORT}`);
    });
    return {
        close: () => {
            try {
                socket.close();
                console.log('[ArtNetTC] 📡 Socket closed');
            }
            catch { /* already closed */ }
        },
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ RENDERER SIDE — ClockSource Proxy
// ═══════════════════════════════════════════════════════════════════════════
//
// The renderer can't open UDP sockets directly. This class listens to IPC
// events from the main process and acts as an IClockSource for ChronosEngine.
// ═══════════════════════════════════════════════════════════════════════════
export class ArtNetTimecodeReceiver extends BaseClockSource {
    constructor() {
        super(...arguments);
        this.type = 'artnet-tc';
        this.name = 'Art-Net Timecode';
        this.currentTimeMs = 0;
        this.lastPacketTime = 0;
        this.timeoutHandle = null;
        this.ipcCleanup = null;
        // REV. 2: Pre-allocated event payloads — zero allocation per emit
        this._syncPayload = { timeMs: 0, source: 'artnet-tc' };
        this._statusPayload = {
            connected: false,
            quality: 'none',
            source: 'artnet-tc',
        };
    }
    async start() {
        // Guard: only works in browser/Electron renderer
        if (typeof window === 'undefined') {
            this.emit('error', {
                error: new Error('ArtNetTimecodeReceiver requires a browser/Electron renderer environment'),
                source: 'artnet-tc',
            });
            return;
        }
        // WAVE 7102: Primary path — luxsync.artnet.onTimecode (preload bridge)
        const luxsyncAPI = window.luxsync;
        if (luxsyncAPI?.artnet?.onTimecode) {
            this.ipcCleanup = luxsyncAPI.artnet.onTimecode((packet) => this.handlePacket(packet));
        }
        else {
            // Fallback: raw ipcRenderer
            const ipcRenderer = window.electronAPI?.ipcRenderer ??
                window.electron?.ipcRenderer;
            if (ipcRenderer?.on) {
                const handler = (_event, packet) => this.handlePacket(packet);
                ipcRenderer.on('artnet:timecode', handler);
                this.ipcCleanup = () => ipcRenderer.removeListener('artnet:timecode', handler);
            }
            else {
                this.emit('error', {
                    error: new Error('No IPC bridge available. Ensure Art-Net listener is running in main process.'),
                    source: 'artnet-tc',
                });
                return;
            }
        }
        // WAVE 7102: No artnet:start IPC — the Art-Net DMX driver already manages the UDP socket.
        // Timecode packets are multiplexed on the same socket via opcode routing.
        this.connected = false; // will become true on first packet
        this._statusPayload.connected = false;
        this._statusPayload.quality = 'none';
        this.emit('status', this._statusPayload);
        console.log('[ArtNetTC] 📡 Renderer proxy started, waiting for packets...');
    }
    stop() {
        if (this.ipcCleanup) {
            this.ipcCleanup();
            this.ipcCleanup = null;
        }
        // WAVE 7102: No artnet:stop IPC — the UDP socket is shared with Art-Net DMX driver.
        // Only clean up the renderer-side IPC listener.
        this.clearTimeout();
        this.connected = false;
        this._statusPayload.connected = false;
        this._statusPayload.quality = 'none';
        this.emit('status', this._statusPayload);
        console.log('[ArtNetTC] 📡 Renderer proxy stopped');
    }
    getTimeMs() {
        return this.connected ? this.currentTimeMs : null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE
    // ═══════════════════════════════════════════════════════════════════════
    handlePacket(packet) {
        this.currentTimeMs = packet.timeMs;
        this.lastPacketTime = performance.now();
        if (!this.connected) {
            this.connected = true;
            this._statusPayload.connected = true;
            this._statusPayload.quality = 'stable';
            this.emit('status', this._statusPayload);
            console.log(`[ArtNetTC] ✅ First packet received: ` +
                `${packet.hours}:${String(packet.minutes).padStart(2, '0')}:` +
                `${String(packet.seconds).padStart(2, '0')}:` +
                `${String(packet.frames).padStart(2, '0')} @${packet.frameRate}fps`);
        }
        this._syncPayload.timeMs = this.currentTimeMs;
        this.emit('sync', this._syncPayload);
        this.resetTimeout();
    }
    resetTimeout() {
        this.clearTimeout();
        this.timeoutHandle = setTimeout(() => {
            this.connected = false;
            this._statusPayload.connected = false;
            this._statusPayload.quality = 'none';
            this.emit('status', this._statusPayload);
            console.log('[ArtNetTC] ⚠️ Art-Net Timecode signal lost (timeout)');
        }, ARTNET_SIGNAL_TIMEOUT_MS);
    }
    clearTimeout() {
        if (this.timeoutHandle !== null) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
    }
}
