import { MessagePortMain } from 'electron'
import { FIX_DATA_FLOATS } from './layout'

const FIX_DATA_BYTES = FIX_DATA_FLOATS * 4

const POOL_SIZE = 3

/**
 * Gestiona un pool de ArrayBuffers transferibles para la Vía UI (Espejo Fluido).
 * Patrón ping-pong: el Main presta buffers, el Renderer los devuelve.
 * Zero-allocation en el hot-path (44Hz).
 */
export class BufferPoolManager {
  private readonly pool: ArrayBuffer[]
  private port: MessagePortMain | null = null

  // Telemetría
  private framesSent = 0
  private framesDropped = 0
  private inFlight = 0

  constructor() {
    // Pre-asignación única al boot
    this.pool = Array.from({ length: POOL_SIZE }, () => new ArrayBuffer(FIX_DATA_BYTES))
  }

  /**
   * Conecta el puerto durable del Glass Bridge y arranca la escucha de ACKs.
   */
  public attach(port: MessagePortMain): void {
    this.port = port
    
    // Escuchar la devolución de los buffers desde el Renderer
    this.port.on('message', (e: { data: { type: string; buffer?: ArrayBuffer } }) => {
      if (e.data?.type === 'ack' && e.data.buffer instanceof ArrayBuffer) {
        this.recycle(e.data.buffer)
      }
    })
    
    // CRÍTICO: sin start() el puerto de Node no emite eventos
    this.port.start()
  }

  /**
   * Llamado en cada tick (44Hz).
   * Copia el estado maestro a un buffer libre y transfiere el ownership al Renderer.
   * Si no hay buffers libres, skipea el frame intencionalmente (backpressure mitigation).
   */
  public pushFrame(sabView: Float32Array): void {
    if (!this.port) return

    const buffer = this.pool.pop()
    
    if (!buffer) {
      // FRAME DROP INTENCIONAL: El Renderer va lento y no ha devuelto buffers.
      // Descartamos este frame para que la UI siempre converja al estado más reciente.
      this.framesDropped++
      return
    }

    // Copia rápida (único coste: ~5µs para 128KB)
    new Float32Array(buffer).set(sabView)

    this.inFlight++
    this.framesSent++

    // Zero-copy: Transferencia de ownership (buffer queda neutered aquí)
    this.port.postMessage({ type: 'glass-state', buffer })
  }

  /**
   * Recicla un buffer devuelto por el Renderer.
   */
  private recycle(buffer: ArrayBuffer): void {
    this.inFlight--
    this.pool.push(buffer)
  }

  public getMetrics() {
    return {
      framesSent: this.framesSent,
      framesDropped: this.framesDropped,
      inFlight: this.inFlight,
      poolFree: this.pool.length,
    }
  }
}
