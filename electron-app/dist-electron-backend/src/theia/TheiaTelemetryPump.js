/**
 * 🌊 WAVE 8215 — THEIA TELEMETRY PUMP (Glass Bridge · Modo B)
 *
 * Corre en el MAIN process. Publica snapshots de telemetría (~256B) hacia
 * CADA renderer suscrito a ~44Hz sobre `MessagePortMain`s dedicados:
 *
 *   pump ──postMessage({type,seq,buffer})──────────────▶ renderer
 *        CLONE serializado (ver nota 8216 abajo) — el renderer copia el
 *        payload a su ring local (intra-proceso, legal)
 *   pump ◀─postMessage({ack,seq,buffer}, [buffer])───── renderer
 *        DOM MessagePort SÍ transfiere ArrayBuffer — el buffer vuelve al
 *        pool por ownership move (backpressure real).
 *
 * 🩹 WAVE 8216 — TRANSFER FIX: `MessagePortMain` (Node/mojo side) NO
 * acepta ArrayBuffers en su array `transfer` — solo `MessagePortMain`s
 * ("Port at index 0 is not a valid port"). La dirección main→renderer es
 * pues structured-clone: 256B × 44Hz ≈ 11KB/s, coste despreciable. El
 * circuito ping-pong NO se toca: el pump sigue consumiendo `ack`s (sigue
 * siendo obligatorio drenar el canal y da backpressure cuando el
 * consumidor va lento) y el pool permanece acotado a 3 buffers por link —
 * el buffer clonado sale del pool al enviarse y el del ack lo repone.
 *
 * Fan-out: un link independiente por consumidor — la ventana principal
 * (ThetaOrchestrator, espeja el ring para theta.worker) y la futura
 * TheiaOutputView en Modo B (shader propio + mismo ring, blueprint §6).
 * Un solo setInterval sirve a todos los links: la escritura del snapshot es
 * una copia de ≤256B por link por tick.
 *
 * Hoy el payload son los 16 bytes del FrameContextRing (tickId/ts/gen) —
 * los primeros 4 Int32 del buffer. El resto de los 256B está reservado para
 * el `TheiaTelemetryRing` del blueprint Euclid (WAVE 8208): cuando llegue,
 * este mismo pump lo transportará sin cambiar el contrato.
 *
 * La consistencia intra-buffer usa el patrón seqlock-lite ya documentado en
 * FrameContextRing: el consumidor compara `generation` para descartar reads
 * intermedios (un read rasgado produce gen viejo → readIfChanged lo ignora).
 */
/** Bytes por buffer de telemetría (Euclid ring size). */
export const TELEMETRY_BUFFER_BYTES = 256;
/** Pool de buffers transferibles por link — nunca crece tras el attach. */
const TELEMETRY_POOL_SIZE = 3;
/** Cadencia de publicación (ms) — espejo del TickEngine 44Hz. */
const TELEMETRY_INTERVAL_MS = 22;
/** Bytes útiles hoy: el FrameContextRing (4×Int32). El resto va a cero. */
const FRAME_CONTEXT_BYTES = 16;
/** Mensaje pump→renderer sobre el port de telemetría. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry';
export class TheiaTelemetryPump {
    constructor(getSnapshot) {
        this.interval = null;
        this.links = new Map();
        this.seq = 0;
        this.getSnapshot = getSnapshot;
    }
    /**
     * Conecta un nuevo consumidor. Idempotente por port: re-attach del mismo
     * port re-crea su link (y su pool). Cada renderer pide su propio channel
     * vía `theia:request-telemetry` — incluida la output window (Modo B).
     */
    attach(port) {
        this.detach(port);
        const link = { port, pool: [], dropped: 0 };
        while (link.pool.length < TELEMETRY_POOL_SIZE) {
            link.pool.push(new ArrayBuffer(TELEMETRY_BUFFER_BYTES));
        }
        port.on('message', (event) => {
            const data = event?.data;
            if (data?.ack && data.buffer instanceof ArrayBuffer) {
                // Ping-pong return — el buffer vuelve al pool para el siguiente tick.
                link.pool.push(data.buffer);
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
        const src = this.getSnapshot();
        this.seq = (this.seq + 1) | 0;
        for (const link of this.links.values()) {
            const buffer = link.pool.pop();
            if (!buffer) {
                // Pool agotado: consumidor lento → drop (el próximo snapshot lo reemplaza).
                link.dropped++;
                continue;
            }
            // Snapshot FrameContextRing (16B) al frente del buffer. Escritura en el
            // proceso emisor — la copia de 16B es trivial y garantiza consistencia:
            // el buffer no se reutiliza hasta que el ack lo devuelve al pool.
            const dst = new Int32Array(buffer);
            dst.fill(0);
            if (src) {
                const srcView = new Int32Array(src, 0, FRAME_CONTEXT_BYTES / 4);
                dst.subarray(0, FRAME_CONTEXT_BYTES / 4).set(srcView);
            }
            try {
                // 🩹 WAVE 8216: SIN array de transferencia — `MessagePortMain`
                // rechaza ArrayBuffers ("Port at index 0 is not a valid port").
                // El buffer sale por structured-clone (copia 256B): el emisor pierde
                // su slot del pool igualmente y el consumidor devuelve SU copia por
                // `ack` (transfer DOM→main válido en el retorno).
                link.port.postMessage({ type: THEIA_TELEMETRY_MSG, seq: this.seq, buffer });
            }
            catch (err) {
                // Port muerto (renderer recargando): recupera el buffer y retira el link.
                link.pool.push(buffer);
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
