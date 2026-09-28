/**
 * 🌊 WAVE 8215 — THEIA TELEMETRY PUMP (Glass Bridge · Modo B)
 *
 * Corre en el MAIN process. Publica snapshots de telemetría (~512B) hacia
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
 * pues structured-clone: 512B × 44Hz ≈ 22KB/s, coste despreciable.
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
 * una copia de ≤512B por link por tick.
 *
 * Wire layout (blueprint amendment 8215 + 🔮 WAVE 8227 · E1):
 *   slots 0..3  → FrameContextRing verbatim (tickId, tsLo, tsHi, gen) —
 *                 el reloj maestro viaja en la cabecera del mismo buffer.
 *   slots 4..127 → payload Float32 del `TheiaTelemetryRing` Euclid (512B,
 *                 schema v2: Selene/Cassandra · GodEar V3 · Omniliquid
 *                 · página B Liquid DSP (reservada hasta F3).
 *   slot  56    → FLAGS Euclid como bits Int32 (WIRE_FLAGS).
 *   slot  57    → ENUMS Euclid como bits Int32 (WIRE_ENUMS).
 * La copia del payload usa `TelemetrySnapshotter` — seqlock-verificada;
 * si los 3 intentos colisionan con una escritura del TickEngine el link
 * omite el tick (contenido rasgado descartado, buffer devuelto al pool).
 *
 * La consistencia intra-buffer usa el patrón seqlock-lite ya documentado en
 * FrameContextRing: el consumidor compara `generation` para descartar reads
 * intermedios (un read rasgado produce gen viejo → readIfChanged lo ignora).
 */

import type { MessagePortMain } from 'electron'
import {
  TelemetrySnapshotter,
  TELEMETRY_RING_BYTES,
} from './telemetry/TheiaTelemetryRing'

/** Bytes por buffer de telemetría — 🔮 WAVE 8278 · F1: unificado con el
 *  tamaño del anillo Euclid (512B v2), sin constante local duplicada. */
export const TELEMETRY_BUFFER_BYTES = TELEMETRY_RING_BYTES

/** Máximo de clones sin ack en vuelo por link — backpressure real. */
const TELEMETRY_MAX_IN_FLIGHT = 3

/** Cadencia de publicación (ms) — espejo del TickEngine 44Hz. */
const TELEMETRY_INTERVAL_MS = 22

/** Bytes útiles de la cabecera: el FrameContextRing (4×Int32). */
const FRAME_CONTEXT_BYTES = 16

/** Mensaje pump→renderer sobre el port de telemetría. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry'

/**
 * Fuentes del wire buffer: el FrameContextRing (reloj, 16B en cabecera) y
 * el TheiaTelemetryRing Euclid (payload 496B + FLAGS/ENUMS en 56/57).
 * Ambos null-tolerant: sin fuente el slot va a cero.
 */
export interface TelemetrySources {
  fc: SharedArrayBuffer | null
  tel: SharedArrayBuffer | null
}

export type TelemetrySourcesFn = () => TelemetrySources

/**
 * Estado de un consumidor: su port y su crédito de vuelo.
 * WAVE 8253: el pool de ArrayBuffers murió — los acks llegan sin buffer
 * (mojo despoja los transferables renderer→main), así que la backpressure
 * se mide en `inFlight`, no en devoluciones. El scratch de 512B es
 * compartido: `postMessage` clona síncronamente al enviar.
 */
interface TelemetryLink {
  port: MessagePortMain
  inFlight: number
  dropped: number
  /** 🩺 WAVE 8253 — diagnóstico: acks recibidos de vuelta. */
  acksSeen: number
}

export class TheiaTelemetryPump {
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly links = new Map<MessagePortMain, TelemetryLink>()
  private readonly getSources: TelemetrySourcesFn
  private seq = 0
  /** 🩹 WAVE 8253 — scratch compartido: el clone es síncrono dentro de
   *  postMessage, reutilizable para el siguiente link/tick. */
  private readonly scratch = new ArrayBuffer(TELEMETRY_BUFFER_BYTES)
  private readonly scratchI32 = new Int32Array(this.scratch)
  /**
   * 🔧 WAVE 8277 · F0 — mensaje REUTILIZADO: postMessage serializa por
   * structured-clone de forma síncrona, así que basta mutar `seq` antes de
   * cada envío. Elimina el objeto {type,seq,buffer} por tick×link.
   */
  private readonly msg = { type: THEIA_TELEMETRY_MSG, seq: 0, buffer: this.scratch }
  /**
   * 🔧 WAVE 8277 · F0 — vistas sobre las fuentes, cacheadas por IDENTIDAD
   * de SAB: solo se re-crean cuando `getSources()` devuelve un buffer
   * distinto (attach/resync del orquestador). En el steady-state @44Hz
   * `tick()` no ejecuta ningún `new`.
   */
  private fcSrc: SharedArrayBuffer | null = null
  private fcView: Int32Array | null = null
  private telSrc: SharedArrayBuffer | null = null
  private snapshotter: TelemetrySnapshotter | null = null

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
    const link: TelemetryLink = { port, inFlight: 0, dropped: 0, acksSeen: 0 }
    port.on('message', (event: { data?: { ack?: boolean } }) => {
      const data = event?.data
      // � WAVE 8253 — el ack ya NO devuelve buffer (mojo lo despoja): cada
      // ack es un CRÉDITO que libera un slot de vuelo. Eso es suficiente —
      // el clone no consume el scratch.
      link.acksSeen++
      if (data?.ack) {
        link.inFlight = Math.max(0, link.inFlight - 1)
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

    // 🔧 WAVE 8277 · F0 — re-crear vistas SOLO si el SAB fuente cambió de
    // identidad. En el camino estable esta rama no ejecuta ni un `new`.
    if (sources.fc !== this.fcSrc) {
      this.fcSrc = sources.fc
      this.fcView = sources.fc
        ? new Int32Array(sources.fc, 0, FRAME_CONTEXT_BYTES / 4)
        : null
    }
    if (sources.tel !== this.telSrc) {
      this.telSrc = sources.tel
      this.snapshotter = sources.tel
        ? new TelemetrySnapshotter(sources.tel, this.scratch)
        : null
    }

    const dst = this.scratchI32
    const msg = this.msg
    msg.seq = this.seq

    for (const link of this.links.values()) {
      // 🩹 WAVE 8253 — crédito de vuelo: si el consumidor no ha acusado aún
      // MAX_IN_FLIGHT mensajes → drop del tick (backpressure real, sin
      // depender de buffers devueltos que mojo despoja).
      if (link.inFlight >= TELEMETRY_MAX_IN_FLIGHT) {
        link.dropped++
        // 🩺 diagnóstico: primera saturación + cada ~2s sostenida.
        if (link.dropped === 1 || link.dropped % 88 === 0) {
          // eslint-disable-next-line no-console
          console.warn(`[TheiaTelemetryPump] ⚠️ link saturated — dropped=${link.dropped} inFlight=${link.inFlight} acksSeen=${link.acksSeen} links=${this.links.size}`)
        }
        continue
      }

      // Cabecera: FrameContextRing (16B) verbatim — el reloj maestro viaja
      // en la cabecera del wire buffer (amendment 8215). `fcView` cubre
      // exactamente los slots 0..3 → `set` los copia sin subarray.
      dst.fill(0)
      if (this.fcView) dst.set(this.fcView)

      // Payload: anillo Euclid (496B) + FLAGS/ENUMS en slots 56/57 — copia
      // seqlock-verificada sobre vistas fijas. Si colisiona con una
      // escritura del TickEngine en los 3 intentos, el link omite el tick
      // (nunca se envía data rasgada).
      if (this.snapshotter && !this.snapshotter.snapshot()) {
        link.dropped++
        continue
      }

      try {
        // structured-clone del scratch (síncrono) — el buffer nunca sale de
        // main; `inFlight` descuenta hasta que el consumidor acuse recibo.
        link.port.postMessage(msg)
        link.inFlight++
      } catch (err) {
        // Port muerto (renderer recargando): retira el link.
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
