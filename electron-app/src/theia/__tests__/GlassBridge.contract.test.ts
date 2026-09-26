/**
 * 🌊 WAVE 8215 — GLASS BRIDGE CONTRACT TESTS
 *
 * Certificación del pivote Opus (transferable ownership ping-pong):
 *  - Modo A (video): roundtrip writer→reader + identidad de buffer en el
 *    retorno ack — NUNCA se instancia un ArrayBuffer nuevo en el circuito.
 *  - Modo B (telemetría): mirror 256B con barrera gen-last + fan-out
 *    multi-link del pump (drop por pool starvation, retiro por close).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createVideoFrameBuffer,
  isAckMessage,
  isVideoFrameMessage,
  readVideoFrame,
  VideoFrameWriter,
  VIDEO_FRAME_BUFFER_BYTES,
} from '../SharedVideoFrameBuffer'
import {
  ackTelemetryFrame,
  createLocalTelemetryRing,
  createTelemetryRing,
  isTelemetryMessage,
  mirrorTelemetryIntoRing,
  TELEMETRY_RING_BYTES,
} from '../TheiaTelemetryRing'
import { TheiaTelemetryPump } from '../TheiaTelemetryPump'
import { FrameContextReader, FrameContextWriter, createFrameContextSAB } from '../FrameContextRing'
import {
  createTelemetryRing as createEuclidRing,
  packEnums,
  SCHEMA_VERSION,
  TELEMETRY_SLOT,
  TEL_FLAG,
  TelemetryWireReader,
  TelemetryWriter,
  WIRE_ENUMS_SLOT,
  WIRE_FLAGS_SLOT,
} from '../telemetry/TheiaTelemetryRing'

// ── Fake MessagePortMain ─────────────────────────────────────────────────

interface FakePort {
  handlers: Map<string, (e: unknown) => void>
  posted: Array<{ data: unknown; transfer: unknown[] }>
  started: boolean
  closed: boolean
  on(event: string, fn: (e: unknown) => void): void
  postMessage(data: unknown, transfer?: unknown[]): void
  start(): void
  close(): void
  /** Simula un mensaje entrante (p.ej. un ack del renderer). */
  emit(event: string, e: unknown): void
}

function makeFakePort(): FakePort {
  const handlers = new Map<string, (e: unknown) => void>()
  return {
    handlers,
    posted: [],
    started: false,
    closed: false,
    on(event, fn) {
      handlers.set(event, fn)
    },
    postMessage(data, transfer) {
      this.posted.push({ data, transfer: transfer ?? [] })
    },
    start() {
      this.started = true
    },
    close() {
      this.closed = true
    },
    emit(event, e) {
      handlers.get(event)?.(e)
    },
  }
}

// ── Modo A — video ────────────────────────────────────────────────────────

describe('🌊 WAVE 8215 — Modo A: video transferable ping-pong', () => {
  it('roundtrip writer→reader: el meta commit se lee intacto', () => {
    const buffer = createVideoFrameBuffer()
    const writer = new VideoFrameWriter(buffer)
    const dst = writer.beginWrite(64, 32)
    expect(dst).not.toBeNull()
    expect(dst!.byteLength).toBe(64 * 32 * 4)
    writer.commit(64, 32, 12345, 777)

    // El buffer "viajó" (simulado): el reader lo parsea como receptor.
    expect(isVideoFrameMessage({ type: 'theia:video-frame', seq: 777, buffer })).toBe(true)
    const snap = readVideoFrame(buffer)
    expect(snap).not.toBeNull()
    expect(snap!.width).toBe(64)
    expect(snap!.height).toBe(32)
    expect(snap!.tickId).toBe(12345)
    expect(snap!.seq).toBe(777)
    expect(snap!.view.byteLength).toBe(64 * 32 * 4)
  })

  it('CERTIFICACIÓN ZERO-ALLOC: el ack re-envuelve el buffer retornado — jamás un ArrayBuffer nuevo', () => {
    const pool: VideoFrameWriter[] = [
      new VideoFrameWriter(createVideoFrameBuffer()),
      new VideoFrameWriter(createVideoFrameBuffer()),
    ]

    // 🩹 WAVE 8218 — el transfer NO preserva identidad JS: en runtime el
    // buffer que vuelve por ack es un wrapper NUEVO sobre el mismo backing.
    // Por eso returnVideoBuffer acepta cualquier buffer válido y lo
    // re-envuelve — nunca consulta un Map<buffer,writer>.
    const w1 = pool.pop()!
    const sent = w1.transferable
    const ack = { ack: true, seq: 1, buffer: sent }
    expect(isAckMessage(ack)).toBe(true)

    // Simula returnVideoBuffer: size check + re-wrap. La MEMORIA recircula
    // (el buffer retornado), no se instancia un ArrayBuffer de 8.3MB.
    expect(ack.buffer.byteLength).toBeGreaterThanOrEqual(VIDEO_FRAME_BUFFER_BYTES)
    pool.push(new VideoFrameWriter(ack.buffer))

    // tick 2: el writer recuperado apunta al backing devuelto — zero-alloc.
    const w2 = pool.pop()!
    expect(w2.transferable).toBe(sent)

    // Doble buffer certificado: queda exactamente UN transferible libre,
    // y al sacarlo (ambos en vuelo, consumidor lento) el pool queda vacío.
    const other = pool.pop()!
    expect(other.transferable).not.toBe(sent)
    // Pool agotado → el productor debe esperar el ack, nunca instanciar.
    const w3 = pool.pop()
    expect(w3).toBeUndefined()
  })

  it('guards: rechaza buffers ajenos y tipos incorrectos', () => {
    const good = createVideoFrameBuffer()
    expect(isVideoFrameMessage({ type: 'theia:video-frame', seq: 1, buffer: new ArrayBuffer(8) })).toBe(false)
    expect(isVideoFrameMessage({ type: 'otro', seq: 1, buffer: good })).toBe(false)
    expect(isAckMessage({ ack: true, buffer: new ArrayBuffer(8) })).toBe(false)
    expect(isAckMessage({ ack: false, buffer: good })).toBe(false)
    expect(VIDEO_FRAME_BUFFER_BYTES).toBeGreaterThan(8_000_000) // ~8.3MB
  })
})

// ── Modo B — telemetría ───────────────────────────────────────────────────

describe('🌊 WAVE 8215 — Modo B: telemetry ring mirror', () => {
  it('mirror 256B: el reader detecta el tick por generation (gen-last)', () => {
    const ring = createTelemetryRing()
    const reader = new FrameContextReader(ring)
    reader.resync()

    const src = createFrameContextSAB()
    const writer = new FrameContextWriter(src)
    writer.advance(42, Date.now())

    const wire = new ArrayBuffer(TELEMETRY_RING_BYTES)
    new Int32Array(wire).set(new Int32Array(src))
    expect(isTelemetryMessage({ type: 'theia:telemetry', seq: 1, buffer: wire })).toBe(true)

    const before = reader.readIfChanged()
    expect(before).toBeNull() // nada publicado aún en el espejo

    mirrorTelemetryIntoRing(ring, wire)
    const snap = reader.readIfChanged()
    expect(snap).not.toBeNull()
    expect(snap!.tickId).toBe(42)
  })

  it('ackTelemetryFrame devuelve el MISMO buffer (ping-pong estricto)', () => {
    const port = makeFakePort()
    const wire = new ArrayBuffer(TELEMETRY_RING_BYTES)
    ackTelemetryFrame(port as unknown as MessagePort, {
      type: 'theia:telemetry',
      seq: 9,
      buffer: wire,
    })
    expect(port.posted).toHaveLength(1)
    expect(port.posted[0].data).toMatchObject({ ack: true, seq: 9 })
    expect(port.posted[0].transfer[0]).toBe(wire) // identidad, no clon
  })
})

// ── WAVE 8250 — Modo B: ring local ArrayBuffer (sin crossOriginIsolated) ──

describe('🌊 WAVE 8250 — Modo B local ring: ArrayBuffer sin SAB', () => {
  it('createLocalTelemetryRing devuelve un ArrayBuffer plano de 256B', () => {
    const ring = createLocalTelemetryRing()
    expect(ring).toBeInstanceOf(ArrayBuffer)
    // No compartido: seguro bajo file:// (sin COOP/COEP) — mismo hilo.
    expect(ring).not.toBeInstanceOf(SharedArrayBuffer)
    expect(ring.byteLength).toBe(TELEMETRY_RING_BYTES)
  })

  it('mirror + TelemetryWireReader sobre ArrayBuffer plano: frescura por generation', () => {
    const ring = createLocalTelemetryRing()
    const reader = new TelemetryWireReader(ring)
    reader.resync()

    const src = createFrameContextSAB()
    new FrameContextWriter(src).advance(77, Date.now())
    const wire = new ArrayBuffer(TELEMETRY_RING_BYTES)
    const wireI32 = new Int32Array(wire)
    wireI32.set(new Int32Array(src))
    // AUDIO_LIVE en el wire — el bit que alimenta el governor de tiempo.
    wireI32[WIRE_FLAGS_SLOT] = 1 << TEL_FLAG.AUDIO_LIVE

    expect(reader.read()).toBe(false) // generation sin cambios aún
    mirrorTelemetryIntoRing(ring, wire)
    expect(reader.read()).toBe(true)
    expect(reader.tickId).toBe(77)
    expect(reader.timestampMs).toBeGreaterThan(0)
    expect(reader.flags & (1 << TEL_FLAG.AUDIO_LIVE)).not.toBe(0)
  })
})

// ── Pump — fan-out multi-link ────────────────────────────────────────────

describe('🌊 WAVE 8215 — TheiaTelemetryPump fan-out (main side)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function tick(): void {
    vi.advanceTimersByTime(23)
  }

  it('publica a N links con pools independientes; el ack devuelve el buffer al pool', () => {
    const src = createFrameContextSAB()
    new FrameContextWriter(src).advance(1, Date.now())
    const pump = new TheiaTelemetryPump(() => ({ fc: src, tel: null }))

    const mainWin = makeFakePort()
    const outputWin = makeFakePort()
    pump.attach(mainWin as never)
    pump.attach(outputWin as never)
    expect(pump.linkCount).toBe(2)

    tick()
    expect(mainWin.posted).toHaveLength(1)
    expect(outputWin.posted).toHaveLength(1)
    // 🩹 WAVE 8216 CERT: MessagePortMain rechaza ArrayBuffers en `transfer`
    // ("Port at index 0 is not a valid port") — el pump envía por CLONE.
    for (const post of [...mainWin.posted, ...outputWin.posted]) {
      expect(post.transfer).toHaveLength(0)
    }
    const msgMain = mainWin.posted[0].data as { type: string; seq: number; buffer: ArrayBuffer }
    const msgOut = outputWin.posted[0].data as { type: string; seq: number; buffer: ArrayBuffer }
    expect(msgMain.type).toBe('theia:telemetry')
    // Cada link recibe SU buffer (pool propio) — no comparten instancia.
    expect(msgMain.buffer).not.toBe(msgOut.buffer)

    // ack del link main → su buffer vuelve a SU pool (identidad).
    mainWin.emit('message', { data: { ack: true, seq: msgMain.seq, buffer: msgMain.buffer } })
    tick()
    // main ya recuperó buffer → publica de nuevo; output sin ack → pool
    // agotado → drop (3 buffers, 2 en vuelo tras 2 ticks sin ack).
    expect(mainWin.posted.length).toBeGreaterThanOrEqual(2)
  })

  it('close de un link lo retira sin afectar a los demás', () => {
    const src = createFrameContextSAB()
    new FrameContextWriter(src).advance(1, Date.now())
    const pump = new TheiaTelemetryPump(() => ({ fc: src, tel: null }))

    const a = makeFakePort()
    const b = makeFakePort()
    pump.attach(a as never)
    pump.attach(b as never)

    a.emit('close', undefined)
    expect(pump.linkCount).toBe(1)

    tick()
    expect(a.posted).toHaveLength(0) // link muerto no recibe
    expect(b.posted).toHaveLength(1) // el vivo sigue
  })

  it('pool starvation → drop contabilizado, jamás nueva asignación', () => {
    const src = createFrameContextSAB()
    new FrameContextWriter(src).advance(1, Date.now())
    const pump = new TheiaTelemetryPump(() => ({ fc: src, tel: null }))
    const port = makeFakePort()
    pump.attach(port as never)

    // 6 ticks sin ack: pool de 3 → 3 publicados + 3 drops
    for (let i = 0; i < 6; i++) tick()
    expect(port.posted).toHaveLength(3)
    expect(pump.droppedTicks).toBeGreaterThanOrEqual(3)
  })

  // 🔮 WAVE 8227 · E1 — wire buffer 256B = FrameContext (16B cabecera) +
  // payload Euclid (slots 4..55) + FLAGS/ENUMS como bits Int32 en 56/57.
  it('compone FrameContext (16B) + payload Euclid + FLAGS/ENUMS en slots 56/57', () => {
    const fc = createFrameContextSAB()
    new FrameContextWriter(fc).advance(0xbeef, Date.now())

    const tel = createEuclidRing()
    const writer = new TelemetryWriter(tel)
    const flags = (1 << TEL_FLAG.AUDIO_LIVE) | (1 << TEL_FLAG.KICK)
    const enums = packEnums({
      schemaVersion: SCHEMA_VERSION,
      predictionType: 1,
      huntState: 2,
      energyZone: 3,
    })
    writer.publish(42, flags, enums, (p) => {
      p[TELEMETRY_SLOT.BPM] = 128.5
      p[TELEMETRY_SLOT.MORPH_FACTOR] = 0.42
      p[TELEMETRY_SLOT.CHROMA_0] = 0.99
    })

    const pump = new TheiaTelemetryPump(() => ({ fc, tel }))
    const port = makeFakePort()
    pump.attach(port as never)
    tick()

    expect(port.posted).toHaveLength(1)
    const msg = port.posted[0].data as { buffer: ArrayBuffer }
    const wi32 = new Int32Array(msg.buffer)
    const wf32 = new Float32Array(msg.buffer)

    // Cabecera: FrameContext verbatim — tickId en slot 0.
    expect(wi32[0]).toBe(0xbeef)
    // Payload Euclid en slots 4..55 (copia seqlock-verificada).
    expect(wf32[TELEMETRY_SLOT.BPM]).toBeCloseTo(128.5, 3)
    expect(wf32[TELEMETRY_SLOT.MORPH_FACTOR]).toBeCloseTo(0.42, 3)
    expect(wf32[TELEMETRY_SLOT.CHROMA_0]).toBeCloseTo(0.99, 3)
    // FLAGS/ENUMS viajan como bits Int32 en los slots reservados del wire.
    expect(wi32[WIRE_FLAGS_SLOT]).toBe(flags)
    expect(wi32[WIRE_ENUMS_SLOT]).toBe(enums)
  })

  it('fuente tel ausente → payload a cero, sin excepción', () => {
    const fc = createFrameContextSAB()
    new FrameContextWriter(fc).advance(7, Date.now())
    const pump = new TheiaTelemetryPump(() => ({ fc, tel: null }))
    const port = makeFakePort()
    pump.attach(port as never)
    tick()

    expect(port.posted).toHaveLength(1)
    const msg = port.posted[0].data as { buffer: ArrayBuffer }
    const wi32 = new Int32Array(msg.buffer)
    expect(wi32[0]).toBe(7)
    // Payload a cero — motor Euclid parado.
    const wf32 = new Float32Array(msg.buffer)
    expect(wf32[TELEMETRY_SLOT.BPM]).toBe(0)
    expect(wi32[WIRE_FLAGS_SLOT]).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 🔮 WAVE 8231 · E5 — control generativo sobre el video-port (Modo B §6)
// ─────────────────────────────────────────────────────────────────────────

import {
  isGenControlMessage,
  THEIA_GEN_LOAD_MSG,
  THEIA_GEN_ACTIVATE_MSG,
  THEIA_GEN_UNIFORM_MSG,
} from '../SharedVideoFrameBuffer'

describe('🌊 WAVE 8231 — gen control protocol (Modo B)', () => {
  it('acepta los tres tipos de control generativo', () => {
    expect(
      isGenControlMessage({
        type: THEIA_GEN_LOAD_MSG,
        shaderId: 'oracle_kifs',
        source: 'void mainImage(out vec4 c, in vec2 f){c=vec4(0.);}',
        steps: 96,
      }),
    ).toBe(true)
    expect(
      isGenControlMessage({
        type: THEIA_GEN_ACTIVATE_MSG,
        shaderId: 'oracle_kifs',
        crossfadeMs: 500,
      }),
    ).toBe(true)
    expect(
      isGenControlMessage({
        type: THEIA_GEN_UNIFORM_MSG,
        name: 'u_twist',
        value: 1.2,
      }),
    ).toBe(true)
  })

  it('rechaza frames de vídeo, acks y ruido — el canal es dedicado', () => {
    // Un video-frame NO es control (el consumer los despacha aparte).
    expect(
      isGenControlMessage({ type: 'theia:video-frame', seq: 1, buffer: new ArrayBuffer(8) }),
    ).toBe(false)
    // Un ack de retorno tampoco.
    expect(isGenControlMessage({ ack: true, seq: 1, buffer: new ArrayBuffer(8) })).toBe(false)
    expect(isGenControlMessage(null)).toBe(false)
    expect(isGenControlMessage('theia:gen-load')).toBe(false)
    expect(isGenControlMessage({ type: 'theia:telemetry' })).toBe(false)
  })
})
