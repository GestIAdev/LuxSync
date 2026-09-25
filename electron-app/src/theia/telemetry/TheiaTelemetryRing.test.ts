/**
 * 🔮 WAVE 8226 — EUCLID ORACLE · Fase E0: Telemetry Ring Core
 *
 * Certificación del anillo de telemetría de 256 B (seqlock):
 *  - Layout exacto: 64 slots × 4 B, header Int32 [0..3] + payload F32 [4..63],
 *    schema declarativo contiguo sin huecos ni colisiones.
 *  - Round-trip writer→reader de TODOS los slots del schema.
 *  - Seqlock: SEQ impar durante escritura, par al commit; el reader descarta
 *    lecturas rasgadas (SEQ impar sostenido y tearing a mitad de copia) y
 *    cae al último scratch válido.
 *  - ZERO-ALLOC: `read()` devuelve SIEMPRE el mismo `scratch` pre-asignado;
 *    `publish()` escribe sobre la vista del propio anillo (fill callback).
 */

import { describe, it, expect } from 'vitest'
import {
  createTelemetryRing,
  packEnums,
  SCHEMA_VERSION,
  SLOT_ENUMS,
  SLOT_FLAGS,
  SLOT_PAYLOAD_BASE,
  SLOT_SEQ,
  SLOT_TICK_ID,
  TELEMETRY_RING_BYTES,
  TELEMETRY_RING_SLOTS,
  TELEMETRY_SCHEMA,
  TELEMETRY_SLOT,
  TelemetryReader,
  TelemetryWriter,
  telFlag,
  TEL_FLAG,
  unpackEnums,
} from './TheiaTelemetryRing'

/** Writer que interrumpe la copia del reader a mitad de camino (1 vez). */
class MidCopyTearReader extends TelemetryReader {
  private injectTear = true
  constructor(
    sab: SharedArrayBuffer | ArrayBuffer,
    private readonly writer: TelemetryWriter,
  ) {
    super(sab)
  }
  protected copyPayload(): void {
    if (this.injectTear) {
      this.injectTear = false
      // El writer publica MIENTRAS el reader copia → s1 !== s2 al re-chequear.
      this.writer.publish(999, 0, 0, (p) => {
        p[TELEMETRY_SLOT.BPM] = 200
      })
    }
    super.copyPayload()
  }
}

describe('🔮 WAVE 8226 — TheiaTelemetryRing: layout y schema', () => {
  it('256 B exactos, 64 slots, vistas Int32+Float32 sobre el mismo backing', () => {
    const sab = createTelemetryRing()
    expect(sab.byteLength).toBe(TELEMETRY_RING_BYTES)
    expect(TELEMETRY_RING_SLOTS).toBe(64)
    expect(new Int32Array(sab).length).toBe(64)
    expect(new Float32Array(sab).length).toBe(64)
  })

  it('el schema cubre slots 4..63 contiguos, sin duplicados, índice por nombre', () => {
    expect(TELEMETRY_SCHEMA.length).toBe(TELEMETRY_RING_SLOTS - SLOT_PAYLOAD_BASE)
    const seen = new Set<number>()
    for (const d of TELEMETRY_SCHEMA) {
      expect(d.slot).toBeGreaterThanOrEqual(SLOT_PAYLOAD_BASE)
      expect(d.slot).toBeLessThan(TELEMETRY_RING_SLOTS)
      expect(seen.has(d.slot)).toBe(false)
      seen.add(d.slot)
      expect(TELEMETRY_SLOT[d.name]).toBe(d.slot)
    }
    // Puntos críticos del blueprint §2.3/§3.5
    expect(TELEMETRY_SLOT.BPM).toBe(5)
    expect(TELEMETRY_SLOT.SUB_BASS).toBe(10)
    expect(TELEMETRY_SLOT.KICK_ENERGY).toBe(26)
    expect(TELEMETRY_SLOT.SEL_ETA_MS).toBe(32)
    expect(TELEMETRY_SLOT.MORPH_FACTOR).toBe(38)
    expect(TELEMETRY_SLOT.CHROMA_0).toBe(44)
    expect(TELEMETRY_SLOT.CHROMA_11).toBe(55)
  })

  it('packEnums/unpackEnums round-trip 4×8 bits', () => {
    const packed = packEnums({
      schemaVersion: SCHEMA_VERSION,
      predictionType: 1,
      huntState: 3,
      energyZone: 2,
    })
    const out = unpackEnums(packed, {
      schemaVersion: 0,
      predictionType: 0,
      huntState: 0,
      energyZone: 0,
    })
    expect(out).toEqual({ schemaVersion: 1, predictionType: 1, huntState: 3, energyZone: 2 })
    expect(telFlag(1 << TEL_FLAG.KICK, TEL_FLAG.KICK)).toBe(true)
    expect(telFlag(1 << TEL_FLAG.KICK, TEL_FLAG.SNARE)).toBe(false)
  })
})

describe('🔮 WAVE 8226 — TheiaTelemetryRing: seqlock', () => {
  it('publish: SEQ termina par y avanzado +2; header y payload legibles', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const i32 = new Int32Array(sab)

    writer.publish(7, 1 << TEL_FLAG.AUDIO_LIVE, packEnums({
      schemaVersion: SCHEMA_VERSION, predictionType: 0, huntState: 0, energyZone: 0,
    }), (p) => {
      p[TELEMETRY_SLOT.BPM] = 128.5
    })

    expect(i32[SLOT_SEQ]).toBe(2)
    expect(i32[SLOT_SEQ] & 1).toBe(0)
    expect(i32[SLOT_TICK_ID]).toBe(7)
    expect(i32[SLOT_FLAGS]).toBe(1)
  })

  it('round-trip de TODOS los slots del schema', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)

    writer.publish(1, 0, 0, (p) => {
      for (const d of TELEMETRY_SCHEMA) p[d.slot] = d.slot * 0.5 + 0.25
    })

    const snap = reader.read()
    expect(snap).not.toBeNull()
    for (const d of TELEMETRY_SCHEMA) {
      expect(snap![d.slot]).toBeCloseTo(d.slot * 0.5 + 0.25, 5)
    }
  })

  it('novedad por SEQ: read() retorna null si el seqlock no avanzó', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)

    writer.publish(1, 0, 0, (p) => { p[TELEMETRY_SLOT.ENERGY] = 0.9 })
    expect(reader.read()).not.toBeNull()
    expect(reader.read()).toBeNull() // sin nuevo publish → sin copia

    writer.publish(2, 0, 0, (p) => { p[TELEMETRY_SLOT.ENERGY] = 0.4 })
    const snap = reader.read()
    expect(snap).not.toBeNull()
    expect(snap![TELEMETRY_SLOT.ENERGY]).toBeCloseTo(0.4, 5)
  })

  it('TEARING — SEQ sostenido en impar: descarta y cae al último scratch válido', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)
    const i32 = new Int32Array(sab)
    const f32 = new Float32Array(sab)

    writer.publish(1, 0, 0, (p) => { p[TELEMETRY_SLOT.BPM] = 120 })
    expect(reader.read()![TELEMETRY_SLOT.BPM]).toBeCloseTo(120, 5)

    // El writer muere a mitad de escritura: SEQ queda impar y el payload
    // lleva datos basura parciales. El reader NO debe tragarlos.
    Atomics.store(i32, SLOT_SEQ, Atomics.load(i32, SLOT_SEQ) + 1) // impar
    f32[TELEMETRY_SLOT.BPM] = -666 // escritura rasgada

    const snap = reader.read() // 3 intentos ven SEQ impar → fallback
    expect(snap).not.toBeNull()
    expect(snap![TELEMETRY_SLOT.BPM]).toBeCloseTo(120, 5) // último válido, no basura
  })

  it('TEARING — writer interrumpe a mitad de copia: reintento devuelve datos consistentes', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new MidCopyTearReader(sab, writer)

    writer.publish(1, 0, 0, (p) => { p[TELEMETRY_SLOT.BPM] = 120 })

    // Primera lectura: el writer publica BPM=200 a mitad de la copia.
    // s1 !== s2 → la copia rasgada se descarta; el reintento lee 120→200
    // consistente. Lo que NUNCA puede salir es una mezcla.
    const snap = reader.read()
    expect(snap).not.toBeNull()
    const i32 = new Int32Array(sab)
    expect(i32[SLOT_TICK_ID]).toBe(999) // el publish inyectado commiteó
    expect(snap![TELEMETRY_SLOT.BPM]).toBeCloseTo(200, 5)
  })

  it('ZERO-ALLOC: read() devuelve siempre el MISMO scratch; publish escribe in-place', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)

    // El fill callback recibe la vista Float32 DEL ANILLO — sin staging.
    writer.publish(1, 0, 0, (p) => {
      expect(p.buffer).toBe(sab)
      p[TELEMETRY_SLOT.BPM] = 130
    })

    const s1 = reader.read()
    expect(s1).toBe(reader.scratch)

    writer.publish(2, 0, 0, (p) => { p[TELEMETRY_SLOT.BPM] = 140 })
    const s2 = reader.read()
    expect(s2).toBe(reader.scratch)
    expect(s2).toBe(s1) // identidad — ningún Float32Array nuevo nació

    // Scratch aislado del anillo: mutar el ring no corrompe lo leído.
    writer.publish(3, 0, 0, (p) => { p[TELEMETRY_SLOT.BPM] = 150 })
    expect(s1![TELEMETRY_SLOT.BPM]).toBeCloseTo(140, 5)
  })
})
