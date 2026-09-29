/**
 * 🔮 WAVE 8226 — EUCLID ORACLE · Fase E0: Telemetry Ring Core
 *
 * Certificación del anillo de telemetría de 512 B (seqlock · v2, WAVE 8278):
 *  - Layout exacto: 128 slots × 4 B, header Int32 [0..3] + payload F32
 *    [4..127] (página A [4..63] byte-idéntica a v1), schema declarativo
 *    contiguo sin huecos ni colisiones.
 *  - Tolerancia v1: readers aceptan anillos/buffers de 256 B (página B = 0,
 *    schemaVersion expuesto = 1); el writer permanece STRICT v2.
 *  - Round-trip writer→reader de TODOS los slots del schema.
 *  - Seqlock: SEQ impar durante escritura, par al commit; el reader descarta
 *    lecturas rasgadas (SEQ impar sostenido y tearing a mitad de copia) y
 *    cae al último scratch válido.
 *  - ZERO-ALLOC: `read()` devuelve SIEMPRE el mismo `scratch` pre-asignado;
 *    `publish()` escribe sobre la vista del propio anillo (fill callback).
 */

import { describe, it, expect } from 'vitest'
import {
  createIntegralClocks,
  createTelemetryRing,
  packEnums,
  stepIntegralClocks,
  SCHEMA_VERSION,
  SLOT_ENUMS,
  SLOT_FLAGS,
  SLOT_PAYLOAD_BASE,
  SLOT_SEQ,
  SLOT_TICK_ID,
  TELEMETRY_PAGE_B_BASE,
  TELEMETRY_PAYLOAD_SLOTS,
  TELEMETRY_PAYLOAD_SLOTS_V1,
  TELEMETRY_RING_BYTES,
  TELEMETRY_RING_BYTES_V1,
  TELEMETRY_RING_SLOTS,
  TELEMETRY_RING_SLOTS_V1,
  TELEMETRY_SCHEMA,
  TELEMETRY_SLOT,
  TelemetryReader,
  TelemetrySnapshotter,
  TelemetryWriter,
  telFlag,
  TEL_FLAG,
  unpackEnums,
  WIRE_ENUMS_SLOT,
  WIRE_FLAGS_SLOT,
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
  it('🔮 WAVE 8278 · F1: 512 B exactos, 128 slots, página B desde slot 64', () => {
    const sab = createTelemetryRing()
    expect(sab.byteLength).toBe(TELEMETRY_RING_BYTES)
    expect(TELEMETRY_RING_BYTES).toBe(512)
    expect(TELEMETRY_RING_SLOTS).toBe(128)
    expect(TELEMETRY_PAGE_B_BASE).toBe(64)
    expect(TELEMETRY_PAYLOAD_SLOTS).toBe(124)
    expect(TELEMETRY_RING_BYTES_V1).toBe(256)
    expect(TELEMETRY_RING_SLOTS_V1).toBe(64)
    expect(TELEMETRY_PAYLOAD_SLOTS_V1).toBe(60)
    expect(SCHEMA_VERSION).toBe(2)
    expect(new Int32Array(sab).length).toBe(128)
    expect(new Float32Array(sab).length).toBe(128)
  })

  it('el schema cubre slots 4..127 contiguos, sin duplicados, índice por nombre', () => {
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
    expect(out).toEqual({ schemaVersion: SCHEMA_VERSION, predictionType: 1, huntState: 3, energyZone: 2 })
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

// ───────────── 🔮 WAVE 8278 · F1 — tolerancia de versión v1/v2 ─────────────

describe('🔮 WAVE 8278 · F1 — anillo v2 + tolerancia legado v1 (256B)', () => {
  it('TelemetryReader tolera un anillo v1 (256B): página B del scratch a 0', () => {
    const sab = new SharedArrayBuffer(TELEMETRY_RING_BYTES_V1)
    const i32 = new Int32Array(sab)
    const f32 = new Float32Array(sab)
    i32[SLOT_SEQ] = 2 // commit par
    f32[TELEMETRY_SLOT.BPM] = 128.5

    const reader = new TelemetryReader(sab)
    const snap = reader.read()
    expect(snap).not.toBeNull()
    expect(snap!.length).toBe(TELEMETRY_RING_SLOTS)
    expect(snap![TELEMETRY_SLOT.BPM]).toBeCloseTo(128.5, 5)
    for (let i = TELEMETRY_PAGE_B_BASE; i < TELEMETRY_RING_SLOTS; i++) {
      expect(snap![i]).toBe(0)
    }
  })

  it('TelemetryWriter RECHAZA un anillo v1 — STRICT (OOB sería silencioso)', () => {
    expect(
      () => new TelemetryWriter(new SharedArrayBuffer(TELEMETRY_RING_BYTES_V1)),
    ).toThrow()
  })

  it('TelemetrySnapshotter tolera src v1: copia página A, página B a 0', () => {
    const src = new SharedArrayBuffer(TELEMETRY_RING_BYTES_V1)
    const si32 = new Int32Array(src)
    const sf32 = new Float32Array(src)
    si32[SLOT_SEQ] = 2
    si32[SLOT_FLAGS] = 0x0f0f
    si32[SLOT_ENUMS] = 0x01020304
    sf32[TELEMETRY_SLOT.SUB_BASS] = 0.66

    const wire = new ArrayBuffer(TELEMETRY_RING_BYTES)
    const snap = new TelemetrySnapshotter(src, wire)
    expect(snap.snapshot()).toBe(true)

    const wf32 = new Float32Array(wire)
    const wi32 = new Int32Array(wire)
    expect(wf32[TELEMETRY_SLOT.SUB_BASS]).toBeCloseTo(0.66, 5)
    expect(wi32[WIRE_FLAGS_SLOT]).toBe(0x0f0f)
    expect(wi32[WIRE_ENUMS_SLOT]).toBe(0x01020304)
    // Página B intacta a 0 — el frame v1 no la transporta.
    for (let i = TELEMETRY_PAGE_B_BASE; i < TELEMETRY_RING_SLOTS; i++) {
      expect(wf32[i]).toBe(0)
    }
  })
})

// ───────────────────── 🧬 WAVE 8233 · G1 — Integral Time ─────────────────────

describe('G1 — relojes integrales (u_energyTime / u_barCount)', () => {
  it('schema: slots 58/59 con alias u_energyTime/u_barCount, kind none', () => {
    const et = TELEMETRY_SCHEMA.find((d) => d.name === 'ENERGY_TIME')
    const bc = TELEMETRY_SCHEMA.find((d) => d.name === 'BAR_COUNT')
    expect(et?.slot).toBe(58)
    expect(et?.uniform).toBe('u_energyTime')
    expect(et?.kind).toBe('none')
    expect(bc?.slot).toBe(59)
    expect(bc?.uniform).toBe('u_barCount')
    expect(bc?.kind).toBe('none')
    expect(TELEMETRY_SLOT.ENERGY_TIME).toBe(58)
    expect(TELEMETRY_SLOT.BAR_COUNT).toBe(59)
  })

  it('∫energy·dt: el primer tick no suma (dt=0) y luego integra exacto', () => {
    const st = createIntegralClocks()
    stepIntegralClocks(st, 1000, 0.8, 0) // primer tick — no hay dt previo
    expect(st.energyTime).toBe(0)
    stepIntegralClocks(st, 1050, 0.8, 0) // 50 ms × 0.8
    expect(st.energyTime).toBeCloseTo(0.04, 6)
    stepIntegralClocks(st, 1075, 0.4, 0) // 25 ms × 0.4
    expect(st.energyTime).toBeCloseTo(0.05, 6)
  })

  it('monótono: reloj retrocediendo, energía negativa y stalls no lo rompen', () => {
    const st = createIntegralClocks()
    stepIntegralClocks(st, 1000, 0.5, 0)
    stepIntegralClocks(st, 1100, 0.5, 0)
    const t1 = st.energyTime
    stepIntegralClocks(st, 500, 1.0, 0) // NTP jump atrás — dt clamp a 0
    expect(st.energyTime).toBe(t1)
    stepIntegralClocks(st, 2000, -3.0, 0) // energía negativa → max(0,e)
    expect(st.energyTime).toBeGreaterThanOrEqual(t1)
    stepIntegralClocks(st, 60000, 1.0, 0) // stall 58 s → dt clamp a 0.5 s
    expect(st.energyTime).toBeCloseTo(t1 + 0.5, 6)
  })

  it('barCount: cruza en fronteras de compás y es monótono ante resets', () => {
    const st = createIntegralClocks()
    stepIntegralClocks(st, 1000, 0, 0)
    expect(st.barCount).toBe(0)
    stepIntegralClocks(st, 1100, 0, 3) // aún dentro del compás 0
    expect(st.barCount).toBe(0)
    stepIntegralClocks(st, 1200, 0, 4) // frontera → compás 1
    expect(st.barCount).toBe(1)
    stepIntegralClocks(st, 1300, 0, 11) // compás 2
    expect(st.barCount).toBe(2)
    // Tick retrasado: salta directo al valor absoluto (sin doble conteo).
    stepIntegralClocks(st, 1400, 0, 40)
    expect(st.barCount).toBe(10)
    // Respawn del pacemaker (beatCount=0): el ratchet NO retrocede.
    stepIntegralClocks(st, 1500, 0, 0)
    expect(st.barCount).toBe(10)
  })

  it('round-trip: writer publica slots 58/59 y el reader los recibe verbatim', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)
    writer.publish(7, 0, 0, (p) => {
      p[TELEMETRY_SLOT.ENERGY_TIME] = 12.345
      p[TELEMETRY_SLOT.BAR_COUNT] = 42
    })
    const snap = reader.read()
    expect(snap).not.toBeNull()
    expect(snap![TELEMETRY_SLOT.ENERGY_TIME]).toBeCloseTo(12.345, 5)
    expect(snap![TELEMETRY_SLOT.BAR_COUNT]).toBe(42)
  })
})

describe('🌊 WAVE 8279 · F3 — página B: schema físico Liquid/GodEar', () => {
  it('slots 64-92 tienen nombre real (no RESERVED) y u_tel4 alineados a vec4', () => {
    const pageB = TELEMETRY_SCHEMA.filter((d) => d.slot >= TELEMETRY_PAGE_B_BASE)
    // 64-92 nombrados + 83 reservado + 93-95 reserva + 96-99 FX (🔫 8287)
    // + 100-127 reserva generada
    const named = pageB.filter((d) => !d.name.startsWith('RESERVED_'))
    expect(named.length).toBe(32) // 64-92 menos RESERVED_83, más FX 96-99
    // Los grupos semánticos están alineados a frontera vec4 (idx%4==0):
    // vocal=64, void=68, snare=72, zoneA=76, zoneB=80, texture=84, delta=88,
    // master=92, fx=96
    for (const base of [64, 68, 72, 76, 80, 84, 88, 92, 96]) {
      expect((base - SLOT_PAYLOAD_BASE) % 4).toBe(0)
    }
    // Lookup nombre→slot
    expect(TELEMETRY_SLOT.VOCAL_SUSTAIN).toBe(64)
    expect(TELEMETRY_SLOT.VOCAL_ISOLATION).toBe(65)
    expect(TELEMETRY_SLOT.CLEAN_MID).toBe(66)
    expect(TELEMETRY_SLOT.SYNTH_SUSTAIN).toBe(67)
    expect(TELEMETRY_SLOT.RHYTHMIC_VOID).toBe(68)
    expect(TELEMETRY_SLOT.PERC_ABSENCE).toBe(69)
    expect(TELEMETRY_SLOT.VOID_HOLD).toBe(70)
    expect(TELEMETRY_SLOT.VOCAL_TIME).toBe(71)
    expect(TELEMETRY_SLOT.SNARE_DRIVE).toBe(72)
    expect(TELEMETRY_SLOT.SNARE_MOMENTUM).toBe(73)
    expect(TELEMETRY_SLOT.GATE_HEALTH).toBe(74)
    expect(TELEMETRY_SLOT.SNARE_CRACK).toBe(75)
    expect(TELEMETRY_SLOT.Z_FRONT_L).toBe(76)
    expect(TELEMETRY_SLOT.Z_MOVER_L).toBe(80)
    expect(TELEMETRY_SLOT.Z_SNARE_ATTACK).toBe(82)
    expect(TELEMETRY_SLOT.WHITE_NOISE).toBe(84)
    expect(TELEMETRY_SLOT.WALL_INTENSITY).toBe(85)
    expect(TELEMETRY_SLOT.SPECTRAL_DENSITY).toBe(86)
    expect(TELEMETRY_SLOT.FLUX_BASELINE_N).toBe(87)
    expect(TELEMETRY_SLOT.RAW_MID_DELTA).toBe(88)
    expect(TELEMETRY_SLOT.RAW_HH_DELTA).toBe(91)
    expect(TELEMETRY_SLOT.AGC_STRESS).toBe(92)
    // 🔫 WAVE 8287 — FX group (u_tel4[23]): Clean Shot parity channel
    expect(TELEMETRY_SLOT.ACTIVE_FX_ENERGY).toBe(96)
    expect(TELEMETRY_SLOT.ACTIVE_FX_AGE).toBe(97)
    expect(TELEMETRY_SLOT.ACTIVE_FX_ID).toBe(98)
    expect(TELEMETRY_SLOT.ACTIVE_FX_COUNT).toBe(99)
    const fx = pageB.filter((d) => d.slot >= 96 && d.slot <= 99)
    expect(fx.every((d) => d.kind === 'none')).toBe(true)
    expect(TEL_FLAG.EFFECT_ACTIVE).toBe(23)
  })

  it('flags página B 17-22 declarados + STROBE_ACTIVE sigue existiendo (deprecated)', () => {
    expect(TEL_FLAG.REAL_SILENCE).toBe(17)
    expect(TEL_FLAG.VOCAL_ONSET).toBe(18)
    expect(TEL_FLAG.NOISE_MODE).toBe(19)
    expect(TEL_FLAG.GATE_DEAD).toBe(20)
    expect(TEL_FLAG.SNARE_TRUE).toBe(21)
    expect(TEL_FLAG.VOID_RELEASE).toBe(22)
    expect(TEL_FLAG.STROBE_ACTIVE).toBe(14) // slot preservado, fijo a 0
  })

  it('relojes integrales VOID_HOLD/VOCAL_TIME son verbatim (kind none, sin smoother)', () => {
    const voidHold = TELEMETRY_SCHEMA.find((d) => d.slot === TELEMETRY_SLOT.VOID_HOLD)
    const vocalTime = TELEMETRY_SCHEMA.find((d) => d.slot === TELEMETRY_SLOT.VOCAL_TIME)
    expect(voidHold?.kind).toBe('none')
    expect(vocalTime?.kind).toBe('none')
    // Los deltas crudos tampoco se suavizan — interpolar un transitorio lo destruye
    for (const s of ['RAW_MID_DELTA', 'RAW_HIGHMID_DELTA', 'RAW_TREBLE_DELTA', 'RAW_HH_DELTA']) {
      expect(TELEMETRY_SCHEMA.find((d) => d.slot === TELEMETRY_SLOT[s])?.kind).toBe('none')
    }
  })

  it('round-trip: writer publica página B y el reader la recibe verbatim', () => {
    const sab = createTelemetryRing()
    const writer = new TelemetryWriter(sab)
    const reader = new TelemetryReader(sab)
    writer.publish(9, 1 << TEL_FLAG.REAL_SILENCE, 0, (p) => {
      p[TELEMETRY_SLOT.VOCAL_ISOLATION] = 0.77
      p[TELEMETRY_SLOT.VOID_HOLD] = 4.25
      p[TELEMETRY_SLOT.Z_SNARE_ATTACK] = 0.91
      p[TELEMETRY_SLOT.AGC_STRESS] = 0.66
    })
    const snap = reader.read()
    expect(snap).not.toBeNull()
    expect(snap![TELEMETRY_SLOT.VOCAL_ISOLATION]).toBeCloseTo(0.77, 5)
    expect(snap![TELEMETRY_SLOT.VOID_HOLD]).toBeCloseTo(4.25, 5)
    expect(snap![TELEMETRY_SLOT.Z_SNARE_ATTACK]).toBeCloseTo(0.91, 5)
    expect(snap![TELEMETRY_SLOT.AGC_STRESS]).toBeCloseTo(0.66, 5)
  })
})
