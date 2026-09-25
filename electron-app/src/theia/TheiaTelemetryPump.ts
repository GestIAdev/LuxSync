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

import type { MessagePortMain } from 'electron'
import { snapshotTelemetryPayload } from './telemetry/TheiaTelemetryRing'

/** Bytes por buffer de telemetría (Euclid ring size). */
export const TELEMETRY_BUFFER_BYTES = 256

/** Pool de buffers transferibles por link — nunca crece tras el attach. */
const TELEMETRY_POOL_SIZE = 3

/** Cadencia de publicación (ms) — espejo del TickEngine 44Hz. */
const TELEMETRY_INTERVAL_MS = 22

/** Bytes útiles de la cabecera: el FrameContextRing (4×Int32). */
const FRAME_CONTEXT_BYTES = 16

/** Mensaje pump→renderer sobre el port de telemetría. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry'

/**
 * Fuentes del wire buffer: el FrameContextRing (reloj, 16B en cabecera) y
 * el TheiaTelemetryRing Euclid (payload 240B + FLAGS/ENUMS en 56/57).
 * Ambos null-tolerant: sin fuente el slot va a cero.
 */
export interface TelemetrySources {
  fc: SharedArrayBuffer | null
  tel: SharedArrayBuffer | null
}

export type TelemetrySourcesFn = () => TelemetrySources

/**
 * Estado de un consumidor: su port y su pool privado de transferibles.
 * El pool solo se rellena en `attach()` — los buffers en vuelo vuelven por
 * `ack` y los que mueren con un link roto simplemente se pierden (el pool
 * queda más pequeño hasta el próximo attach — degradación acotada, jamás
 * alloc en hot path).
 */
interface TelemetryLink {
  port: MessagePortMain
  pool: ArrayBuffer[]
  dropped: number
}

export class TheiaTelemetryPump {
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly links = new Map<MessagePortMain, TelemetryLink>()
  private readonly getSources: TelemetrySourcesFn
  private seq = 0

  constructor(getSources: TelemetrySourcesFn) {
    this.getSources = getSources
  }

  /**
   * Conecta un nuevo consumidor. Idempotente por port: re-attach del mismo
   * port re-crea su link (y su pool). Cada renderer pide su propio channel
   * vía `theia:request-telemetry` — incluida la output window (Modo B).
   */
  attach(port: MessagePortMain): void {
    this.detach(port)
    const link: TelemetryLink = { port, pool: [], dropped: 0 }
    while (link.pool.length < TELEMETRY_POOL_SIZE) {
      link.pool.push(new ArrayBuffer(TELEMETRY_BUFFER_BYTES))
    }
    port.on('message', (event: { data?: { ack?: boolean; buffer?: ArrayBuffer } }) => {
      const data = event?.data
      if (data?.ack && data.buffer instanceof ArrayBuffer) {
        // Ping-pong return — el buffer vuelve al pool para el siguiente tick.
        link.pool.push(data.buffer)
      }
    })
    // El renderer cerró su extremo (reload, ventana destruida, stop()) —
    // el link muere con él. Los buffers en vuelo se pierden (acotado).
    port.on('close', () => {
      this.links.delete(port)
      if (this.links.size === 0) this.stop()
    })
    port.start()
    this.links.set(port, link)
    this.start()
    // eslint-disable-next-line no-console
    console.log(`[TheiaTelemetryPump] 🛰️ consumer attached (links=${this.links.size}) — publishing @44Hz over MessagePort`)
  }

  detach(port: MessagePortMain): void {
    const link = this.links.get(port)
    if (!link) return
    this.links.delete(port)
    try { port.close() } catch { /* already closed */ }
    if (this.links.size === 0) this.stop()
  }

  /** Cierra todos los links (shutdown del main process). */
  detachAll(): void {
    this.stop()
    for (const link of this.links.values()) {
      try { link.port.close() } catch { /* noop */ }
    }
    this.links.clear()
  }

  private start(): void {
    if (this.interval !== null) return
    this.interval = setInterval(() => this.tick(), TELEMETRY_INTERVAL_MS)
    this.interval.unref?.()
  }

  private stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private tick(): void {
    if (this.links.size === 0) return
    const sources = this.getSources()
    this.seq = (this.seq + 1) | 0

    for (const link of this.links.values()) {
      const buffer = link.pool.pop()
      if (!buffer) {
        // Pool agotado: consumidor lento → drop (el próximo snapshot lo reemplaza).
        link.dropped++
        continue
      }

      // Cabecera: FrameContextRing (16B) verbatim — el reloj maestro viaja
      // en la cabecera del wire buffer (amendment 8215).
      const dst = new Int32Array(buffer)
      dst.fill(0)
      if (sources.fc) {
        const srcView = new Int32Array(sources.fc, 0, FRAME_CONTEXT_BYTES / 4)
        dst.subarray(0, FRAME_CONTEXT_BYTES / 4).set(srcView)
      }

      // Payload: anillo Euclid (240B) + FLAGS/ENUMS en slots 56/57 — copia
      // seqlock-verificada. Si colisiona con una escritura del TickEngine en
      // los 3 intentos, el link omite el tick (nunca se envía data rasgada).
      if (sources.tel && !snapshotTelemetryPayload(sources.tel, buffer)) {
        link.pool.push(buffer)
        link.dropped++
        continue
      }

      try {
        // 🩹 WAVE 8216: SIN array de transferencia — `MessagePortMain`
        // rechaza ArrayBuffers ("Port at index 0 is not a valid port").
        // El buffer sale por structured-clone (copia 256B): el emisor pierde
        // su slot del pool igualmente y el consumidor devuelve SU copia por
        // `ack` (transfer DOM→main válido en el retorno).
        link.port.postMessage({ type: THEIA_TELEMETRY_MSG, seq: this.seq, buffer })
      } catch (err) {
        // Port muerto (renderer recargando): recupera el buffer y retira el link.
        link.pool.push(buffer)
        this.links.delete(link.port)
        try { link.port.close() } catch { /* noop */ }
        // eslint-disable-next-line no-console
        console.warn('[TheiaTelemetryPump] postMessage failed, link dropped:', err)
      }
    }

    if (this.links.size === 0) this.stop()
  }

  /** Diagnóstico: ticks descartados por pool starvation (suma de links). */
  get droppedTicks(): number {
    let total = 0
    for (const link of this.links.values()) total += link.dropped
    return total
  }

  /** Diagnóstico: consumidores activos. */
  get linkCount(): number {
    return this.links.size
  }
}
