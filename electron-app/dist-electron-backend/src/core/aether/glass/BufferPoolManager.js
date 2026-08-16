import { FIX_DATA_FLOATS } from './layout';
const FIX_DATA_BYTES = FIX_DATA_FLOATS * 4;
const POOL_SIZE = 3;
/**
 * Gestiona un pool de ArrayBuffers transferibles para la Vía UI (Espejo Fluido).
 * Patrón ping-pong: el Main presta buffers, el Renderer los devuelve.
 * Zero-allocation en el hot-path (44Hz).
 */
export class BufferPoolManager {
    constructor() {
        this.port = null;
        // Telemetría
        this.framesSent = 0;
        this.framesDropped = 0;
        this.inFlight = 0;
        // Pre-asignación única al boot
        this.pool = Array.from({ length: POOL_SIZE }, () => new ArrayBuffer(FIX_DATA_BYTES));
    }
    /**
     * Conecta el puerto durable del Glass Bridge y arranca la escucha de ACKs.
     */
    attach(port) {
        this.port = port;
        // Escuchar la devolución de los buffers desde el Renderer
        this.port.on('message', (e) => {
            if (e.data?.type === 'ack' && e.data.buffer instanceof ArrayBuffer) {
                this.recycle(e.data.buffer);
            }
        });
        // CRÍTICO: sin start() el puerto de Node no emite eventos
        this.port.start();
    }
    /**
     * Llamado en cada tick (44Hz).
     * Copia el estado maestro a un buffer libre y transfiere el ownership al Renderer.
     * Si no hay buffers libres, skipea el frame intencionalmente (backpressure mitigation).
     */
    pushFrame(sabView) {
        if (!this.port)
            return;
        const buffer = this.pool.pop();
        if (!buffer) {
            // FRAME DROP INTENCIONAL: El Renderer va lento y no ha devuelto buffers.
            // Descartamos este frame para que la UI siempre converja al estado más reciente.
            this.framesDropped++;
            return;
        }
        // Copia rápida (único coste: ~5µs para 128KB)
        new Float32Array(buffer).set(sabView);
        this.inFlight++;
        this.framesSent++;
        // Zero-copy: Transferencia de ownership (buffer queda neutered aquí)
        this.port.postMessage({ type: 'glass-state', buffer });
    }
    /**
     * Recicla un buffer devuelto por el Renderer.
     */
    recycle(buffer) {
        this.inFlight--;
        this.pool.push(buffer);
    }
    getMetrics() {
        return {
            framesSent: this.framesSent,
            framesDropped: this.framesDropped,
            inFlight: this.inFlight,
            poolFree: this.pool.length,
        };
    }
}
