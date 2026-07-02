// ════════════════════════════════════════════════════════════════════════════
// 🎛️ WAVE 7120 — CALIBRATION SAB (L3++ Live Calibration Highway)
// ════════════════════════════════════════════════════════════════════════════
//
//  SharedArrayBuffer para transferencia zero-alloc de intents de calibración
//  desde el Phase Canvas de Hephaestus (renderer) hacia el NodeArbiter (main).
//
//  Producer = CalibrationSABWriter (renderer — useLiveCalibration hook)
//  Consumer = CalibrationSABReader (main process — TickEngine hot-path)
//
//  Layout:
//    Header (32 bytes = 8 × Int32):
//      [0] seq         — producer incrementa, consumer detecta novedad
//      [1] active      — 1 = hay datos válidos, 0 = inactivo
//      [2] intentCount — número de intents en este frame
//      [3-7] reserved  — futuro (timestamp, flags, etc.)
//
//    Body (max CALIB_MAX_INTENTS × CALIB_INTENT_BYTES):
//      Per intent (64 bytes):
//        [0-15]:  nodeId (UTF-16 char codes, zero-padded — max 8 chars)
//        [16-19]: channelCount (Uint32)
//        [20-23]: channelHash1 (Uint32 — FNV-1a hash of channel name)
//        [24-27]: channelValue1 (Float32 — normalized 0-1)
//        [28-31]: channelHash2
//        [32-35]: channelValue2
//        [36-39]: channelHash3
//        [40-43]: channelValue3
//        [44-47]: channelHash4
//        [48-51]: channelValue4
//        [52-55]: channelHash5
//        [56-59]: channelValue5
//        [60-63]: channelHash6 / channelValue6 (packed)
//
//  SPSC: Single Producer (renderer), Single Consumer (main process).
//  Isomorfo: válido en Node, renderer y Web Workers.
// ════════════════════════════════════════════════════════════════════════════
// ── Layout constants ──────────────────────────────────────────────────────────
export const CALIB_HEADER_INT32S = 8;
export const CALIB_HEADER_BYTES = CALIB_HEADER_INT32S * Int32Array.BYTES_PER_ELEMENT; // 32
export const CALIB_MAX_INTENTS = 512;
export const CALIB_MAX_CHANNELS_PER_INTENT = 6;
export const CALIB_INTENT_BYTES = 64;
export const CALIB_INTENT_FLOAT32S = CALIB_INTENT_BYTES / Float32Array.BYTES_PER_ELEMENT; // 16
export const CALIB_INTENT_UINT32S = CALIB_INTENT_BYTES / Uint32Array.BYTES_PER_ELEMENT; // 16
export const CALIB_BODY_BYTES = CALIB_MAX_INTENTS * CALIB_INTENT_BYTES; // 32768
export const CALIB_SAB_BYTE_LENGTH = CALIB_HEADER_BYTES + CALIB_BODY_BYTES; // 32800
// Header slot indices (Int32Array)
const HDR_SEQ = 0;
const HDR_ACTIVE = 1;
const HDR_INTENT_COUNT = 2;
// 3-7 reserved
// Per-intent layout (within Float32Array view for value access)
// nodeId occupies Uint32 slots [0..3] (16 bytes = 4 Uint32s = 8 UTF-16 chars max)
const INTENT_NODEID_UINT32S = 4;
const INTENT_CHANNEL_COUNT_OFFSET = 4; // Uint32 slot index within intent
const INTENT_CHANNEL_DATA_OFFSET = 5; // first channel hash+value pair starts here
// ── FNV-1a hash for channel names ─────────────────────────────────────────────
const FNV_OFFSET = 0x811c9dc5;
function fnv1aHash(str) {
    let h = FNV_OFFSET;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
// ── Channel hash → name resolution (consumer side) ────────────────────────────
const CHANNEL_HASH_MAP = new Map();
const KNOWN_CHANNELS = [
    'dimmer', 'strobe', 'shutter', 'master_brightness', 'brightness',
    'r', 'g', 'b', 'red', 'green', 'blue',
    'white', 'amber', 'uv', 'cyan', 'magenta', 'yellow',
    'pan', 'tilt', 'zoom', 'focus', 'iris', 'gobo', 'goboWheel',
    'prism', 'prismRotation', 'frost', 'colorWheel', 'color_wheel',
    'pan_base', 'tilt_base', 'pan_offset', 'tilt_offset',
    'rotation', 'speed', 'macro', 'reset',
    'haze', 'fog', 'fan', 'spark', 'pyro',
    'targetX', 'targetY', 'targetZ',
];
for (const ch of KNOWN_CHANNELS) {
    const h = fnv1aHash(ch);
    CHANNEL_HASH_MAP.set(h, ch);
}
/** Register a custom channel name for hash resolution. */
export function registerCalibrationChannel(channelName) {
    const h = fnv1aHash(channelName);
    if (!CHANNEL_HASH_MAP.has(h)) {
        CHANNEL_HASH_MAP.set(h, channelName);
    }
}
/** Resolve a channel hash back to its name. Returns undefined for unknown hashes. */
export function resolveChannelHash(hash) {
    return CHANNEL_HASH_MAP.get(hash >>> 0);
}
// ── Factory ───────────────────────────────────────────────────────────────────
export function createCalibrationSAB() {
    const sab = new SharedArrayBuffer(CALIB_SAB_BYTE_LENGTH);
    const meta = new Int32Array(sab, 0, CALIB_HEADER_INT32S);
    Atomics.store(meta, HDR_SEQ, 0);
    Atomics.store(meta, HDR_ACTIVE, 0);
    Atomics.store(meta, HDR_INTENT_COUNT, 0);
    return sab;
}
export class CalibrationSABWriter {
    constructor(sab) {
        if (sab.byteLength < CALIB_SAB_BYTE_LENGTH) {
            throw new RangeError(`CalibrationSABWriter: SAB too small (${sab.byteLength} < ${CALIB_SAB_BYTE_LENGTH})`);
        }
        this._meta = new Int32Array(sab, 0, CALIB_HEADER_INT32S);
        this._body = new Uint32Array(sab, CALIB_HEADER_BYTES, CALIB_BODY_BYTES / Uint32Array.BYTES_PER_ELEMENT);
    }
    /**
     * Publish calibration entries to the SAB. Zero-alloc: no arrays created.
     * Entries beyond CALIB_MAX_INTENTS are silently truncated.
     * Channels beyond CALIB_MAX_CHANNELS_PER_INTENT per entry are silently truncated.
     */
    publish(entries) {
        const count = entries.length > CALIB_MAX_INTENTS ? CALIB_MAX_INTENTS : entries.length;
        const body = this._body;
        for (let i = 0; i < count; i++) {
            const entry = entries[i];
            const baseUint32 = i * CALIB_INTENT_UINT32S;
            // Write nodeId as UTF-16 char codes packed into Uint32 slots (8 chars max)
            const nodeId = entry.nodeId;
            const maxChars = INTENT_NODEID_UINT32S * 2; // 4 Uint32s × 2 chars each = 8 UTF-16 chars
            for (let c = 0; c < maxChars; c++) {
                if (c < nodeId.length) {
                    const lo = nodeId.charCodeAt(c) & 0xFFFF;
                    let val = lo;
                    if (c + 1 < nodeId.length) {
                        val |= (nodeId.charCodeAt(c + 1) & 0xFFFF) << 16;
                    }
                    body[baseUint32 + (c >> 1)] = val >>> 0;
                    c++; // skip next char (already packed)
                }
                else {
                    body[baseUint32 + (c >> 1)] = 0;
                }
            }
            // Write channel count
            const chCount = entry.channels.length > CALIB_MAX_CHANNELS_PER_INTENT
                ? CALIB_MAX_CHANNELS_PER_INTENT
                : entry.channels.length;
            body[baseUint32 + INTENT_CHANNEL_COUNT_OFFSET] = chCount;
            // Write channel hash + value pairs
            // Each pair: 1 Uint32 (hash) + 1 Float32 (value) = 2 Uint32s
            for (let ch = 0; ch < chCount; ch++) {
                const pairOffset = baseUint32 + INTENT_CHANNEL_DATA_OFFSET + (ch * 2);
                const hash = fnv1aHash(entry.channels[ch].channel);
                body[pairOffset] = hash;
                // Write float as bits into the next Uint32 slot
                const floatView = new Float32Array(body.buffer, (pairOffset + 1) * 4, 1);
                floatView[0] = entry.channels[ch].value;
            }
        }
        // Publish: set count, mark active, bump seq (release fence)
        Atomics.store(this._meta, HDR_INTENT_COUNT, count);
        Atomics.store(this._meta, HDR_ACTIVE, 1);
        Atomics.add(this._meta, HDR_SEQ, 1);
    }
    /** Mark the buffer as inactive (calibration mode OFF). */
    clear() {
        Atomics.store(this._meta, HDR_ACTIVE, 0);
        Atomics.store(this._meta, HDR_INTENT_COUNT, 0);
        this._body.fill(0);
    }
}
// ── Reader (Main Process — TickEngine hot-path) ───────────────────────────────
export class CalibrationSABReader {
    constructor(sab) {
        this._lastSeq = -1;
        this._poolCursor = 0;
        if (sab.byteLength < CALIB_SAB_BYTE_LENGTH) {
            throw new RangeError(`CalibrationSABReader: SAB too small (${sab.byteLength} < ${CALIB_SAB_BYTE_LENGTH})`);
        }
        this._meta = new Int32Array(sab, 0, CALIB_HEADER_INT32S);
        this._body = new Uint32Array(sab, CALIB_HEADER_BYTES, CALIB_BODY_BYTES / Uint32Array.BYTES_PER_ELEMENT);
        this._floatView = new Float32Array(sab, CALIB_HEADER_BYTES, CALIB_BODY_BYTES / Float32Array.BYTES_PER_ELEMENT);
        // Pre-allocate intent pool
        this._intentPool = new Array(CALIB_MAX_INTENTS);
        for (let i = 0; i < CALIB_MAX_INTENTS; i++) {
            this._intentPool[i] = {
                nodeId: '',
                values: {},
                priority: 0,
            };
        }
    }
    get hasData() {
        return Atomics.load(this._meta, HDR_ACTIVE) === 1;
    }
    get intentCount() {
        return Atomics.load(this._meta, HDR_INTENT_COUNT);
    }
    /**
     * Reads the latest calibration intents from the SAB if there's a new frame.
     * Returns a readonly array of INodeIntent[] (pointing to pool — do NOT retain).
     * Returns null if no new data since last read.
     */
    readIfNew() {
        const seq = Atomics.load(this._meta, HDR_SEQ);
        if (seq === this._lastSeq)
            return null;
        this._lastSeq = seq;
        if (Atomics.load(this._meta, HDR_ACTIVE) !== 1)
            return null;
        const count = Atomics.load(this._meta, HDR_INTENT_COUNT);
        if (count === 0)
            return null;
        const body = this._body;
        const floatView = this._floatView;
        const pool = this._intentPool;
        this._poolCursor = 0;
        const result = [];
        for (let i = 0; i < count && i < CALIB_MAX_INTENTS; i++) {
            const baseUint32 = i * CALIB_INTENT_UINT32S;
            // Read nodeId from packed UTF-16 char codes
            let nodeId = '';
            for (let u = 0; u < INTENT_NODEID_UINT32S; u++) {
                const packed = body[baseUint32 + u];
                if (packed === 0)
                    break;
                const lo = packed & 0xFFFF;
                const hi = (packed >>> 16) & 0xFFFF;
                if (lo !== 0)
                    nodeId += String.fromCharCode(lo);
                if (hi !== 0)
                    nodeId += String.fromCharCode(hi);
            }
            // Read channel count
            const chCount = body[baseUint32 + INTENT_CHANNEL_COUNT_OFFSET];
            if (chCount === 0 || nodeId === '')
                continue;
            // Acquire intent from pool
            const intent = pool[this._poolCursor++];
            const values = intent.values;
            // Clear previous values
            for (const key in values)
                delete values[key];
            // Read channel hash + value pairs
            for (let ch = 0; ch < chCount && ch < CALIB_MAX_CHANNELS_PER_INTENT; ch++) {
                const pairOffsetUint32 = baseUint32 + INTENT_CHANNEL_DATA_OFFSET + (ch * 2);
                const hash = body[pairOffsetUint32];
                // Read float from the next slot using Float32Array view
                const floatOffset = pairOffsetUint32 + 1;
                const value = floatView[floatOffset];
                const channelName = resolveChannelHash(hash);
                if (channelName !== undefined && Number.isFinite(value)) {
                    values[channelName] = value;
                }
            }
            // Mutate the pool object (cast away readonly for pool reuse)
            const mutable = intent;
            mutable.nodeId = nodeId;
            mutable.values = values;
            mutable.priority = 0;
            result.push(intent);
        }
        return result.length > 0 ? result : null;
    }
    /** Force a re-read on next call (useful after reconnect). */
    resync() {
        this._lastSeq = -1;
    }
}
