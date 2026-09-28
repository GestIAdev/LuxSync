/**
 * 🌊 WAVE 8215 — THEIA TELEMETRY RING (Glass Bridge · Modo B, consumer side)
 *
 * Contrato de los buffers de 512B (v2 · WAVE 8278 · F1) que
 * `TheiaTelemetryPump` (main) envía por `MessagePort` a cada renderer
 * suscrito, en ping-pong:
 *
 *   pump ──{type:'theia:telemetry', seq, buffer}──▶ consumer
 *          structured-clone — `MessagePortMain` NO transfiere
 *          ArrayBuffers (WAVE 8216 fix: "Port at index 0 is not a valid port")
 *   consumer ──{ack:true, seq}─────────▶ pump      (ackFrame — crédito de
 *          vuelo: WAVE 8253 demostró que el ArrayBuffer en el transfer list
 *          renderer→main llegaba como `undefined` — mojo lo despojaba en
 *          silencio y el pool del pump moría tras 3 ticks)
 *
 * El consumidor NUNCA retiene el buffer: copia los 512B a su ring LOCAL
 * (`SharedArrayBuffer`/`ArrayBuffer` intra-proceso — legal bajo el veto
 * WAVE 8215, que solo aplica a la frontera Main↔Renderer) y acusa recibo
 * en el mismo handler. El ack es solo un crédito — la backpressure del
 * pump vive en `inFlight`, no en devoluciones de buffers.
 *
 * Layout compartido (espejo de `TheiaTelemetryPump`):
 *   [0..16)    FrameContextRing verbatim — Int32[4]: tickId, tsLo, tsHi, gen
 *   [16..512)  payload del Euclid `TheiaTelemetryRing` (WAVE 8208):
 *              telemetría Selene/Cassandra · GodEar FFT V3 · Omniliquid.
 *   🔮 WAVE 8278 · F1 — el wire es v2 (512B); los consumidores toleran un
 *   frame legado v1 (256B): la página B queda a 0 y `schemaVersion` = 1.
 *
 * Consumidores actuales:
 *   - ThetaOrchestrator (ventana principal): espeja al ring que pasa al
 *     worker como `frameContextSAB` — su primera página de 16B es el reloj.
 *   - TheiaOutputView (Modo B): ring local para el futuro shader propio.
 */
import {
    TELEMETRY_RING_BYTES as EUCLID_RING_BYTES,
    TELEMETRY_RING_BYTES_V1 as EUCLID_RING_BYTES_V1,
    TELEMETRY_RING_SLOTS as EUCLID_RING_SLOTS,
} from './telemetry/TheiaTelemetryRing';
/** Bytes del ring Euclid — una línea de caché ×8 (v2: 512B). */
export const TELEMETRY_RING_BYTES = EUCLID_RING_BYTES;
/** Tamaño legado v1 (256B) — tolerado por mirror/reader/guard. */
export const TELEMETRY_RING_BYTES_V1 = EUCLID_RING_BYTES_V1;
export const TELEMETRY_RING_INT32_LENGTH = EUCLID_RING_SLOTS; // 128
/** Slot Int32 donde vive `generation` (barrera lógica — escribir ÚLTIMO). */
const SLOT_GENERATION = 3;
/** Mensaje pump→consumer. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry';
/** Crea el ring LOCAL de un consumidor (intra-proceso, una sola vez). */
export function createTelemetryRing() {
    return new SharedArrayBuffer(TELEMETRY_RING_BYTES);
}
/**
 * 🌊 WAVE 8250 — ring LOCAL para consumidores de hilo único (Modo B).
 * `Atomics.load/store` operan igual sobre una `Int32Array` respaldada por
 * `ArrayBuffer` estándar (solo `wait`/`notify` exigen memoria compartida),
 * así que la ventana de salida — donde el mirror corre en `port.onmessage`
 * y el reader en `rAF`, ambos en el mismo hilo — no necesita
 * `crossOriginIsolated` ni SAB: el ring vive aunque la página cargue por
 * `file://`.
 */
export function createLocalTelemetryRing() {
    return new ArrayBuffer(TELEMETRY_RING_BYTES);
}
/**
 * 🔧 WAVE 8277 · Fase 0 (EUCLID_RING_EXPANSION_8276 §F0) — mirror con la
 * vista destino PRE-ASIGNADA. `dst` nace una vez por ring; `mirror()` solo
 * instancia la vista Int32 del mensaje entrante — inevitable: cada clone
 * structured del pump llega con un backing nuevo. Coste: 1 alloc/msg
 * (antes 6: 2 vistas + 4 subarrays).
 */
export class TelemetryMirror {
    constructor(ring) {
        /** Slots Int32 del ring local (128 en v2 · 64 en un ring legado v1). */
        this.dstSlots = Math.min(ring.byteLength >> 2, TELEMETRY_RING_INT32_LENGTH);
        /** Vista fija sobre el ring local. Null si el ring es demasiado pequeño. */
        this.dst =
            ring.byteLength >= TELEMETRY_RING_BYTES_V1
                ? new Int32Array(ring, 0, this.dstSlots)
                : null;
        /** La página B del ring contiene datos de frames v2 — al llegar un frame
         *  v1 (256B) se limpia UNA vez (transición de formato, no por mensaje). */
        this.pageBHot = false;
    }
    /**
     * Espeja un buffer de telemetría recibido dentro del ring local.
     * Copia verbatim min(src,dst) slots EXCEPTO `generation`, que se escribe
     * al final con `Atomics.store` para preservar la barrera lógica del
     * seqlock-lite: un reader que observe el gen nuevo garantiza que los
     * slots anteriores ya son coherentes (mismo contrato que
     * `FrameContextWriter.advance`).
     *
     * 🔮 WAVE 8278 · F1 — tolerancia v1/v2: un frame de 256B llena solo la
     * página A; si el ring había recibido datos v2, la página B residual se
     * pone a 0 una sola vez (ver `pageBHot`).
     */
    mirror(buffer) {
        const dst = this.dst;
        if (!dst ||
            buffer.byteLength < TELEMETRY_RING_BYTES_V1 ||
            (buffer.byteLength & 3) !== 0) {
            return;
        }
        const src = new Int32Array(buffer, 0, Math.min(buffer.byteLength >> 2, this.dstSlots));
        const n = src.length;
        for (let i = 0; i < n; i++) {
            if (i !== SLOT_GENERATION)
                dst[i] = src[i];
        }
        Atomics.store(dst, SLOT_GENERATION, Atomics.load(src, SLOT_GENERATION));
        if (n < this.dstSlots) {
            if (this.pageBHot) {
                dst.fill(0, n); // slots n..dstSlots — la página B residual de v2
                this.pageBHot = false;
            }
        }
        else {
            this.pageBHot = true;
        }
    }
}
/** Caché de mirrors por ring — la función libre hereda la misma economía. */
const MIRROR_CACHE = new WeakMap();
/**
 * Compat: espeja vía el `TelemetryMirror` cacheado para `ring`. Los hot
 * call-sites deberían poseer su propia instancia (evita la consulta al
 * WeakMap); esta envoltura existe para tests y callers ocasionales.
 */
export function mirrorTelemetryIntoRing(ring, buffer) {
    let m = MIRROR_CACHE.get(ring);
    if (!m) {
        m = new TelemetryMirror(ring);
        MIRROR_CACHE.set(ring, m);
    }
    m.mirror(buffer);
}
/** Type-guard laxo para telemetría entrante del port — acepta v1 (256B)
 *  y v2 (512B): cualquier buffer ≥ el mínimo legado. */
export function isTelemetryMessage(data) {
    const d = data;
    return (!!d &&
        d.type === THEIA_TELEMETRY_MSG &&
        d.buffer instanceof ArrayBuffer &&
        d.buffer.byteLength >= TELEMETRY_RING_BYTES_V1);
}
/**
 * `ackFrame()` — acuse de recibo al pump: libera un slot de `inFlight`.
 * El ÚNICO postMessage permitido por tick. WAVE 8253: ya NO se devuelve
 * el buffer — los transferables a `MessagePortMain` llegan despojados
 * (`buffer: undefined`), lo que mataba el link a los 3 ticks.
 */
export function ackTelemetryFrame(port, msg) {
    const ack = { ack: true, seq: msg.seq };
    port.postMessage(ack);
}
