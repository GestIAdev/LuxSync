/**
 * 🌊 WAVE 8215 — THEIA TELEMETRY PUMP (Glass Bridge · Modo B)
 *
 * Corre en el MAIN process. Publica snapshots de telemetría (~256B) hacia
 * CADA renderer suscrito a ~44Hz sobre `MessagePortMain`s dedicados:
 *
 *   pump ──postMessage({type,seq,buffer})──────────────▶ renderer
 *        CLONE serializado (ver nota 8216 abajo) — el renderer copia el
 *        payload a su ring local (intra-proceso, legal)
 *   pump ◀─postMessage({ack,seq})───────────────────── renderer
 *        CRÉDITO de vuelo (WAVE 8253): los transferables renderer→main
 *        son despojados por mojo — el ack ya no devuelve buffer; solo
 *        decrementa `inFlight` para la backpressure.
 *
 * 🩹 WAVE 8216 — TRANSFER FIX: `MessagePortMain` (Node/mojo side) NO
 * acepta ArrayBuffers en su array `transfer` — solo `MessagePortMain`s
 * ("Port at index 0 is not a valid port"). La dirección main→renderer es
 * pues structured-clone: 256B × 44Hz ≈ 11KB/s, coste despreciable.
 *
 * 🩹 WAVE 8253 — ACK FIX: la dirección renderer→main TAMPOCO transfiere
 * buffers — el `ArrayBuffer` en el transfer list llegaba como `undefined`
 * (despojado en silencio por mojo), el pool del link se secaba tras 3
 * ticks y el canal moría hasta que el watchdog lo resucitaba (~6s de
 * ciclo — el `tick gap=212` eterno). Como main→renderer ya es CLONE, el
 * buffer del pump jamás abandona main: se sustituye el pool por un
 * único `scratch` reutilizable + contador `inFlight` por link para la
 * backpressure (máx 3 clones sin ack en vuelo).
 *
 * Fan-out: un link independiente por consumidor — la ventana principal
 * (ThetaOrchestrator, espeja el ring para theta.worker) y la futura
 * TheiaOutputView en Modo B (shader propio + mismo ring, blueprint §6).
 * Un solo setInterval sirve a todos los links: la escritura del snapshot es
 * una copia de ≤256B por link por tick.
 *
 * Wire layout (blueprint amendment 8215 + 🔮 WAVE 8227 · E1):
 *   slots 0..3  → FrameContextRing verbatim (tickId, tsLo, tsHi, gen) —
 *                 el reloj maestro viaja en la cabecera del mismo buffer.
 *   slots 4..63 → payload Float32 del `TheiaTelemetryRing` Euclid (256B,
 *                 schema v1: Selene/Cassandra · GodEar V3 · Omniliquid).
 *   slot  56    → FLAGS Euclid como bits Int32 (WIRE_FLAGS).
 *   slot  57    → ENUMS Euclid como bits Int32 (WIRE_ENUMS).
 * La copia del payload usa `snapshotTelemetryPayload` — seqlock-verificada;
 * si los 3 intentos colisionan con una escritura del TickEngine el link
 * omite el tick (contenido rasgado descartado, buffer devuelto al pool).
 *
 * La consistencia intra-buffer usa el patrón seqlock-lite ya documentado en
 * FrameContextRing: el consumidor compara `generation` para descartar reads
 * intermedios (un read rasgado produce gen viejo → readIfChanged lo ignora).
 */
import { snapshotTelemetryPayload } from './telemetry/TheiaTelemetryRing';
/** Bytes por buffer de telemetría (Euclid ring size). */
export const TELEMETRY_BUFFER_BYTES = 256;
/** Máximo de clones sin ack en vuelo por link — backpressure real. */
const TELEMETRY_MAX_IN_FLIGHT = 3;
/** Cadencia de publicación (ms) — espejo del TickEngine 44Hz. */
const TELEMETRY_INTERVAL_MS = 22;
/** Bytes útiles de la cabecera: el FrameContextRing (4×Int32). */
const FRAME_CONTEXT_BYTES = 16;
/** Mensaje pump→renderer sobre el port de telemetría. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry';
export class TheiaTelemetryPump {
    constructor(getSources) {
        this.interval = null;
        this.links = new Map();
        this.seq = 0;
        /** 🩹 WAVE 8253 — scratch compartido: el clone es síncrono dentro de
         *  postMessage, reutilizable para el siguiente link/tick. */
        this.scratch = new ArrayBuffer(TELEMETRY_BUFFER_BYTES);
        this.scratchI32 = new Int32Array(this.scratch);
        this.getSources = getSources;
    }
    /**
     * Conecta un nuevo consumidor. Idempotente por port: re-attach del mismo
     * port re-crea su link (y su pool). Cada renderer pide su propio channel
     * vía `theia:request-telemetry` — incluida la output window (Modo B).
     */
    attach(port) {
        this.detach(port);
        const link = { port, inFlight: 0, dropped: 0, acksSeen: 0 };
        port.on('message', (event) => {
            const data = event?.data;
            // � WAVE 8253 — el ack ya NO devuelve buffer (mojo lo despoja): cada
            // ack es un CRÉDITO que libera un slot de vuelo. Eso es suficiente —
            // el clone no consume el scratch.
            link.acksSeen++;
            if (data?.ack) {
                link.inFlight = Math.max(0, link.inFlight - 1);
            }
        });
        // El renderer cerró su extremo (reload, ventana destruida, stop()) —
        // el link muere con él. Los buffers en vuelo se pierden (acotado).
        port.on('close', () => {
            this.links.delete(port);
            if (this.links.size === 0)
                this.stop();
        });
        port.start();
        this.links.set(port, link);
        this.start();
        // eslint-disable-next-line no-console
        console.log(`[TheiaTelemetryPump] 🛰️ consumer attached (links=${this.links.size}) — publishing @44Hz over MessagePort`);
    }
    detach(port) {
        const link = this.links.get(port);
        if (!link)
            return;
        this.links.delete(port);
        try {
            port.close();
        }
        catch { /* already closed */ }
        if (this.links.size === 0)
            this.stop();
    }
    /** Cierra todos los links (shutdown del main process). */
    detachAll() {
        this.stop();
        for (const link of this.links.values()) {
            try {
                link.port.close();
            }
            catch { /* noop */ }
        }
        this.links.clear();
    }
    start() {
        if (this.interval !== null)
            return;
        this.interval = setInterval(() => this.tick(), TELEMETRY_INTERVAL_MS);
        this.interval.unref?.();
    }
    stop() {
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    tick() {
        if (this.links.size === 0)
            return;
        const sources = this.getSources();
        this.seq = (this.seq + 1) | 0;
        for (const link of this.links.values()) {
            // 🩹 WAVE 8253 — crédito de vuelo: si el consumidor no ha acusado aún
            // MAX_IN_FLIGHT mensajes → drop del tick (backpressure real, sin
            // depender de buffers devueltos que mojo despoja).
            if (link.inFlight >= TELEMETRY_MAX_IN_FLIGHT) {
                link.dropped++;
                // 🩺 diagnóstico: primera saturación + cada ~2s sostenida.
                if (link.dropped === 1 || link.dropped % 88 === 0) {
                    // eslint-disable-next-line no-console
                    console.warn(`[TheiaTelemetryPump] ⚠️ link saturated — dropped=${link.dropped} inFlight=${link.inFlight} acksSeen=${link.acksSeen} links=${this.links.size}`);
                }
                continue;
            }
            // Cabecera: FrameContextRing (16B) verbatim — el reloj maestro viaja
            // en la cabecera del wire buffer (amendment 8215).
            const dst = this.scratchI32;
            dst.fill(0);
            if (sources.fc) {
                const srcView = new Int32Array(sources.fc, 0, FRAME_CONTEXT_BYTES / 4);
                dst.subarray(0, FRAME_CONTEXT_BYTES / 4).set(srcView);
            }
            // Payload: anillo Euclid (240B) + FLAGS/ENUMS en slots 56/57 — copia
            // seqlock-verificada. Si colisiona con una escritura del TickEngine en
            // los 3 intentos, el link omite el tick (nunca se envía data rasgada).
            if (sources.tel && !snapshotTelemetryPayload(sources.tel, this.scratch)) {
                link.dropped++;
                continue;
            }
            try {
                // structured-clone del scratch (síncrono) — el buffer nunca sale de
                // main; `inFlight` descuenta hasta que el consumidor acuse recibo.
                link.port.postMessage({ type: THEIA_TELEMETRY_MSG, seq: this.seq, buffer: this.scratch });
                link.inFlight++;
            }
            catch (err) {
                // Port muerto (renderer recargando): retira el link.
                this.links.delete(link.port);
                try {
                    link.port.close();
                }
                catch { /* noop */ }
                // eslint-disable-next-line no-console
                console.warn('[TheiaTelemetryPump] postMessage failed, link dropped:', err);
            }
        }
        if (this.links.size === 0)
            this.stop();
    }
    /** Diagnóstico: ticks descartados por pool starvation (suma de links). */
    get droppedTicks() {
        let total = 0;
        for (const link of this.links.values())
            total += link.dropped;
        return total;
    }
    /** Diagnóstico: consumidores activos. */
    get linkCount() {
        return this.links.size;
    }
}
