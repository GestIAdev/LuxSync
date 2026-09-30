/**
 * 🔮 WAVE 8228 — EUCLID ORACLE · Fase E2: Uniform Bridge & Smoother
 *
 * Certificación del reader wire + smoother del worker (Vitest, sin GPU):
 *  - TelemetryWireReader: lectura gen-guarded del wire mirror (256B),
 *    novedad por generation, flags/enums como bits Int32, scratch estable.
 *  - TelemetrySmoother: per-slot 'linear'/'circular'/'extrapolate'/'none'
 *    con corrección k' = 1−(1−k)^(dt·60) — curvas idénticas a 60/120/144 Hz.
 *  - Derivados §3.4: beatTime, kickPulse, snarePulse, predictiveEta,
 *    approach, impact — zero-alloc, escalares pre-asignados.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  SLOT_PAYLOAD_BASE,
  TELEMETRY_RING_BYTES,
  TELEMETRY_RING_SLOTS,
  TELEMETRY_SLOT,
  TEL_FLAG,
  TelemetryWireReader,
  packEnums,
} from './TheiaTelemetryRing'
import { TelemetrySmoother } from './TelemetrySmoother'

// ─────────────────────────── helpers ───────────────────────────

/** Escribe un frame wire completo en el SAB (layout pump: FC + payload +
 *  flags/enums bits). Respeta el orden del mirror: payload ANTES que gen. */
function writeWireFrame(
  sab: SharedArrayBuffer,
  gen: number,
  payload: Partial<Record<number, number>> = {},
  flags = 0,
  enums = 0,
  tickId = gen,
): void {
  const i32 = new Int32Array(sab)
  const f32 = new Float32Array(sab)
  i32[0] = tickId
  i32[1] = 1000 // tsLo
  i32[2] = 0 // tsHi
  for (const [k, v] of Object.entries(payload)) f32[Number(k)] = v
  i32[56] = flags
  i32[57] = enums
  Atomics.store(i32, 3, gen) // generation AL FINAL — commit barrier
}

/** Scratch Float32Array(128) para alimentar al smoother sin wire reader
 *  (página B incluida — índices absolutos de slot). */
function rawScratch(values: Partial<Record<number, number>> = {}): Float32Array {
  const s = new Float32Array(TELEMETRY_RING_SLOTS)
  for (const [k, v] of Object.entries(values)) s[Number(k)] = v
  return s
}

const BPM = TELEMETRY_SLOT.BPM
const BEAT_PHASE = TELEMETRY_SLOT.BEAT_PHASE
const ETA_MS = TELEMETRY_SLOT.SEL_ETA_MS
const ETA_BEATS = TELEMETRY_SLOT.SEL_ETA_BEATS
const PRED_PROB = TELEMETRY_SLOT.SEL_PRED_PROB
const CONF = TELEMETRY_SLOT.SEL_CONFIDENCE
const HUE = TELEMETRY_SLOT.CHROMA_HUE
const KICK_E = TELEMETRY_SLOT.KICK_ENERGY
const T_SEC = TELEMETRY_SLOT.T_SEC

const KICK_EDGE_BIT = 1 << TEL_FLAG.KICK_EDGE
const SNARE_BIT = 1 << TEL_FLAG.SNARE
const PRED_BIT = 1 << TEL_FLAG.PREDICTION_ACTIVE

// ─────────────────────────── TelemetryWireReader ───────────────────────────

describe('TelemetryWireReader — gen-guarded mirror read', () => {
  it('lee un frame consistente: payload verbatim + flags/enums como bits', () => {
    const sab = new SharedArrayBuffer(TELEMETRY_RING_BYTES)
    writeWireFrame(sab, 7, { [BPM]: 128, [ETA_MS]: 1500 }, 0b10110, packEnums({
      schemaVersion: 1, predictionType: 2, huntState: 3, energyZone: 1,
    }), 42)

    const r = new TelemetryWireReader(sab)
    expect(r.read()).toBe(true)
    expect(r.tickId).toBe(42)
    expect(r.timestampMs).toBe(1000)
    expect(r.generation).toBe(7)
    expect(r.flags).toBe(0b10110)
    expect(r.enums >>> 0).toBe(packEnums({
      schemaVersion: 1, predictionType: 2, huntState: 3, energyZone: 1,
    }) >>> 0)
    expect(r.scratch[BPM]).toBeCloseTo(128)
    expect(r.scratch[ETA_MS]).toBeCloseTo(1500)
    // Slots wire 56/57 transportan bits → el scratch los expone a 0.
    expect(r.scratch[56]).toBe(0)
    expect(r.scratch[57]).toBe(0)
  })

  it('sin cambio de generation → false; con bump → nuevo frame', () => {
    const sab = new SharedArrayBuffer(TELEMETRY_RING_BYTES)
    writeWireFrame(sab, 1, { [BPM]: 100 })
    const r = new TelemetryWireReader(sab)
    expect(r.read()).toBe(true)
    expect(r.read()).toBe(false) // misma gen — sin novedad
    // Payload mutado pero gen sin bump → NO se reporta (barrier semantics).
    new Float32Array(sab)[BPM] = 200
    expect(r.read()).toBe(false)
    // Commit: gen bump → el reader ve el payload nuevo.
    Atomics.store(new Int32Array(sab), 3, 2)
    expect(r.read()).toBe(true)
    expect(r.scratch[BPM]).toBeCloseTo(200)
  })

  it('resync descarta el frame pre-existente', () => {
    const sab = new SharedArrayBuffer(TELEMETRY_RING_BYTES)
    writeWireFrame(sab, 9, { [BPM]: 90 })
    const r = new TelemetryWireReader(sab)
    r.resync()
    expect(r.read()).toBe(false) // gen 9 ya "vista"
    writeWireFrame(sab, 10, { [BPM]: 95 })
    expect(r.read()).toBe(true)
    expect(r.scratch[BPM]).toBeCloseTo(95)
  })

  it('rechaza buffers de tamaño incorrecto', () => {
    expect(() => new TelemetryWireReader(new SharedArrayBuffer(128))).toThrow()
  })
})

// ─────────────────────────── Smoother — per-slot kinds ───────────────────────────

describe('TelemetrySmoother — smoothing por slot', () => {
  it("'none' pasa verbatim (T_SEC); identidad de `out` estable (zero-alloc)", () => {
    const sm = new TelemetrySmoother()
    const outRef = sm.out
    sm.step(rawScratch({ [T_SEC]: 12.5, [BPM]: 120 }), 0, 0, true, 16.7, 1000)
    expect(sm.out[T_SEC - SLOT_PAYLOAD_BASE]).toBeCloseTo(12.5)
    sm.step(rawScratch({ [T_SEC]: 13.0, [BPM]: 120 }), 0, 0, true, 16.7, 1017)
    expect(sm.out[T_SEC - SLOT_PAYLOAD_BASE]).toBeCloseTo(13.0)
    expect(sm.out).toBe(outRef) // el buffer jamás se reemplaza
  })

  it("'linear' converge con ataque/liberación asimétricos (KICK_ENERGY: attack 1.0)", () => {
    const sm = new TelemetrySmoother()
    const idx = KICK_E - SLOT_PAYLOAD_BASE
    // attack=1.0 → subida instantánea al target en un paso.
    sm.step(rawScratch({ [KICK_E]: 0.9 }), 0, 0, true, 16.7, 1000)
    expect(sm.out[idx]).toBeCloseTo(0.9, 5)
    // release=0.25 → bajada gradual (no instantánea).
    sm.step(rawScratch({ [KICK_E]: 0.0 }), 0, 0, true, 16.7, 1017)
    const afterOne = sm.out[idx]
    expect(afterOne).toBeGreaterThan(0.5)
    expect(afterOne).toBeLessThan(0.9)
  })

  it('corrección de dt: curvas idénticas a 60Hz y 144Hz', () => {
    // Misma distancia temporal: 60Hz×60 frames vs 144Hz×144 frames = 1s.
    const a = new TelemetrySmoother()
    const b = new TelemetrySmoother()
    const target = rawScratch({ [BPM]: 150 })
    let t = 0
    for (let i = 0; i < 60; i++) {
      t += 1000 / 60
      a.step(target, 0, 0, true, 1000 / 60, t)
    }
    t = 0
    for (let i = 0; i < 144; i++) {
      t += 1000 / 144
      b.step(target, 0, 0, true, 1000 / 144, t)
    }
    const va = a.out[BPM - SLOT_PAYLOAD_BASE]
    const vb = b.out[BPM - SLOT_PAYLOAD_BASE]
    // Ambas convergen ~igual (k' normalizado por dt·60).
    expect(Math.abs(va - vb)).toBeLessThan(0.02 * 150)
    expect(va).toBeGreaterThan(120) // convergió mayoritariamente
  })

  it("'circular' interpola por el camino corto (wrap 1→0)", () => {
    const sm = new TelemetrySmoother()
    const idx = HUE - SLOT_PAYLOAD_BASE
    // Semilla: hue cerca de 1.
    sm.step(rawScratch({ [HUE]: 0.95 }), 0, 0, true, 16.7, 0)
    // Ahora el target cruza el wrap: 0.05. El camino corto sube por 1.0,
    // no baja por 0.5 — comprobamos que el valor se mueve hacia 0.05 sin
    // visitar el rango medio.
    for (let i = 1; i <= 30; i++) {
      sm.step(rawScratch({ [HUE]: 0.05 }), 0, 0, true, 16.7, i * 16.7)
      const v = sm.out[idx]
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      if (i < 6) {
        // En tránsito debe estar cerca del wrap (arriba de 0.9 o ya cruzado).
        expect(v > 0.85 || v < 0.15).toBe(true)
      }
    }
    expect(sm.out[idx]).toBeCloseTo(0.05, 1)
  })

  it("'extrapolate' — SEL_ETA_MS cuenta atrás entre publicaciones y clamp a 0", () => {
    const sm = new TelemetrySmoother()
    const idx = ETA_MS - SLOT_PAYLOAD_BASE
    const raw = rawScratch({ [BPM]: 120, [ETA_MS]: 2000 })
    sm.step(raw, 0, 0, true, 16.7, 0)
    expect(sm.out[idx]).toBeCloseTo(2000)
    // 10 frames a 60Hz sin frame nuevo (stale) → −166.7ms.
    for (let i = 1; i <= 10; i++) sm.step(raw, 0, 0, false, 1000 / 60, i * (1000 / 60))
    expect(sm.out[idx]).toBeCloseTo(2000 - 1000 / 6, 0)
    // Forzar agotamiento → clamp a 0.
    for (let i = 0; i < 300; i++) sm.step(raw, 0, 0, false, 16.7, 3000 + i * 16.7)
    expect(sm.out[idx]).toBe(0)
    // Re-publicación → snap al nuevo valor autoritativo.
    sm.step(rawScratch({ [BPM]: 120, [ETA_MS]: 500 }), 0, 0, true, 16.7, 9000)
    expect(sm.out[idx]).toBeCloseTo(500)
  })

  it("'extrapolate' — BEAT_PHASE avanza con el tempo y envuelve [0,1)", () => {
    const sm = new TelemetrySmoother()
    const idx = BEAT_PHASE - SLOT_PAYLOAD_BASE
    const raw = rawScratch({ [BPM]: 120, [BEAT_PHASE]: 0.9 }) // 2 beats/s
    sm.step(raw, 0, 0, true, 16.7, 0)
    expect(sm.out[idx]).toBeCloseTo(0.9, 1)
    // 30 frames @60Hz = 500ms → +1.0 fase → wrap a ~0.9.
    for (let i = 1; i <= 30; i++) sm.step(raw, 0, 0, false, 1000 / 60, i * (1000 / 60))
    expect(sm.out[idx]).toBeGreaterThanOrEqual(0)
    expect(sm.out[idx]).toBeLessThan(1)
    expect(sm.out[idx]).toBeCloseTo(0.9, 1)
  })
})

// ─────────────────────────── Derivados del oráculo (§3.4) ───────────────────────────

describe('TelemetrySmoother — derivados §3.4', () => {
  it('u_kickPulse — exp(−t/τ) desde el flanco KICK_EDGE (τ=0.25·msPerBeat)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 }) // msPerBeat=500, τ=125ms
    sm.step(raw, 0, 0, true, 16.7, 1000)
    expect(sm.kickPulse).toBe(0)
    // Flanco ascendente.
    sm.step(raw, KICK_EDGE_BIT, 0, true, 16.7, 1017)
    expect(sm.kickPulse).toBeCloseTo(1, 2)
    // +125ms (1 τ) → e^-1 ≈ 0.368.
    sm.step(raw, 0, 0, false, 125, 1142)
    expect(sm.kickPulse).toBeCloseTo(Math.exp(-1), 2)
    // Semántica de edge: el writer publica el bit SOLO en el tick del evento
    // → cada frame FRESCO con el bit ES un flanco nuevo (no se de-duplica).
    sm.step(raw, KICK_EDGE_BIT, 0, true, 16.7, 1160)
    expect(sm.kickPulse).toBeGreaterThan(0.9)
  })

  it('u_snarePulse — flanco SNARE con la misma envolvente', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, SNARE_BIT, 0, true, 16.7, 1000)
    expect(sm.snarePulse).toBeCloseTo(1, 2)
    sm.step(raw, 0, 0, false, 250, 1250) // 2τ → e^-2
    expect(sm.snarePulse).toBeCloseTo(Math.exp(-2), 2)
  })

  it('u_predictiveETA — ETA/1000 − elapsed, fluido entre ticks, clamp ≥0', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120, [ETA_MS]: 3000 })
    sm.step(raw, PRED_BIT, 0, true, 16.7, 0)
    expect(sm.predictiveEtaSec).toBeCloseTo(3.0, 2)
    // 1 segundo de frames stale → eta cae ~1s en tiempo real.
    for (let i = 1; i <= 60; i++) sm.step(raw, 0, 0, false, 1000 / 60, i * (1000 / 60))
    expect(sm.predictiveEtaSec).toBeCloseTo(2.0, 1)
    // Agotado → 0.
    for (let i = 0; i < 200; i++) sm.step(raw, 0, 0, false, 16.7, 2000 + i * 16.7)
    expect(sm.predictiveEtaSec).toBe(0)
  })

  it('u_approach — (1−clamp(etaBeats/8,0,1))·predProb·confidence, horizonte 8 beats', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({
      [BPM]: 120,          // 2 beats/s → horizonte 8 beats = 4s
      [ETA_MS]: 2000,      // etaBeats = 4 → rampa base 0.5
      [PRED_PROB]: 0.8,
      [CONF]: 0.5,         // → target = 0.5·0.8·0.5 = 0.2
    })
    // Converge la rampa suavizada hacia 0.2 — el stream real republica a
    // 44Hz manteniendo el ETA (fresh cada frame aquí, mismo efecto).
    for (let i = 0; i <= 240; i++) sm.step(raw, PRED_BIT, 0, true, 1000 / 60, i * (1000 / 60))
    expect(sm.approach).toBeCloseTo(0.2, 1)
    // ETA→0 (predicción inminente, republicado) → rampa → prob·conf = 0.4.
    const raw2 = rawScratch({ [BPM]: 120, [ETA_MS]: 0, [PRED_PROB]: 0.8, [CONF]: 0.5 })
    for (let i = 0; i <= 240; i++) {
      sm.step(raw2, PRED_BIT, 0, true, 1000 / 60, 5000 + i * (1000 / 60))
    }
    expect(sm.approach).toBeCloseTo(0.4, 1)
    // Sin predicción → decae a 0.
    for (let i = 0; i <= 240; i++) {
      sm.step(raw2, 0, 0, true, 1000 / 60, 10000 + i * (1000 / 60))
    }
    expect(sm.approach).toBeLessThan(0.05)
  })

  it('u_impact — ETA cruza 0 con predicción activa → pulso exp', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120, [ETA_MS]: 500, [PRED_PROB]: 0.9, [CONF]: 0.9 })
    sm.step(raw, PRED_BIT, 0, true, 16.7, 0)
    // Dejar que el ETA extrapolado llegue a 0 (~500ms + frames).
    let now = 0
    for (let i = 0; i < 120; i++) {
      now += 1000 / 60
      sm.step(raw, PRED_BIT, 0, false, 1000 / 60, now)
    }
    // El cruce de 0 disparó el impacto: el pulso ya está decayendo (>0).
    expect(sm.impact).toBeGreaterThan(0)
    expect(sm.impact).toBeLessThanOrEqual(1)
  })

  it('u_impact — KICK_EDGE con PREDICTION_ACTIVE también dispara', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, KICK_EDGE_BIT | PRED_BIT, 0, true, 16.7, 1000)
    expect(sm.impact).toBeCloseTo(1, 2)
  })

  // ⏱️ WAVE 8404 — u_beatTime/u_time ya NO se integran aquí: el pump los
  // publica absolutos (slots 100/101) y el smoother es dumb reader con
  // extrapolación acotada por tasa observada.
  const ABS_TIME = TELEMETRY_SLOT.ABS_SHADER_TIME
  const ABS_BEAT = TELEMETRY_SLOT.ABS_BEAT_TIME

  it('u_beatTime/u_time — dumb reader: snap al valor absoluto del pump', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({
      [BPM]: 120, [ABS_TIME]: 123.456, [ABS_BEAT]: 789.25,
    })
    sm.step(raw, 0, 0, true, 16.7, 1000)
    expect(sm.shaderTimeSec).toBeCloseTo(123.456)
    expect(sm.beatTime).toBeCloseTo(789.25)
    // Re-publicación → snap al nuevo absoluto (no se suma ni deriva).
    const raw2 = rawScratch({
      [BPM]: 120, [ABS_TIME]: 124.0, [ABS_BEAT]: 790.0,
    })
    sm.step(raw2, 0, 0, true, 16.7, 1022)
    expect(sm.shaderTimeSec).toBeCloseTo(124.0)
    expect(sm.beatTime).toBeCloseTo(790.0)
  })

  it('u_beatTime — extrapola con la tasa observada ENTRE publicaciones', () => {
    const sm = new TelemetrySmoother()
    // ~8 publicaciones del pump (~22ms) con beatTime avanzando a 2 b/s —
    // dejan la EMA de tasa convergida (~2 beats/s).
    let t = 1000
    for (let i = 0; i <= 8; i++) {
      sm.step(
        rawScratch({ [BPM]: 120, [ABS_BEAT]: 10.0 + i * 0.044 }),
        0, 0, true, 16.7, t,
      )
      t += 22
    }
    // Frames stale: el campo avanza por la tasa observada.
    const before = sm.beatTime
    for (let i = 1; i <= 30; i++) {
      sm.step(
        rawScratch({ [BPM]: 120, [ABS_BEAT]: 10.352 }),
        0, 0, false, 1000 / 60, t + i * (1000 / 60),
      )
    }
    // 500ms extrapolados → ~+1 beat (tasa observada ≈ 2 b/s).
    expect(sm.beatTime).toBeGreaterThan(before + 0.5)
    expect(sm.beatTime).toBeLessThan(before + 1.5)
    // Y el siguiente snap vuelve al absoluto — nunca deriva.
    sm.step(rawScratch({ [BPM]: 120, [ABS_BEAT]: 11.0 }), 0, 0, true, 16.7, t + 2000)
    expect(sm.beatTime).toBeCloseTo(11.0)
  })

  it('u_time — el wrap del pump hace snap limpio sin contaminar la tasa', () => {
    const sm = new TelemetrySmoother()
    // Tasa ya establecida (~1 s/s) antes del wrap.
    let t = 1000
    for (let i = 0; i <= 8; i++) {
      sm.step(
        rawScratch({ [BPM]: 120, [ABS_TIME]: 100.0 + i * 0.022 }),
        0, 0, true, 16.7, t,
      )
      t += 22
    }
    // Wrap 3600→0 del pump: salto negativo enorme → snap limpio, la EMA
    // de tasa NO se contamina (guarda de salto).
    sm.step(rawScratch({ [BPM]: 120, [ABS_TIME]: 0.2 }), 0, 0, true, 16.7, t + 22)
    expect(sm.shaderTimeSec).toBeCloseTo(0.2)
    for (let i = 1; i <= 30; i++) {
      sm.step(
        rawScratch({ [BPM]: 120, [ABS_TIME]: 0.2 }),
        0, 0, false, 16.7, t + 22 + i * 16.7,
      )
    }
    expect(sm.shaderTimeSec).toBeGreaterThan(0.4) // sigue avanzando
    expect(sm.shaderTimeSec).toBeLessThan(2.0)
  })

  it('enums empaquetados se exponen descompuestos; scratch null → derived decay safe', () => {
    const sm = new TelemetrySmoother()
    const enums = packEnums({ schemaVersion: 1, predictionType: 2, huntState: 3, energyZone: 1 })
    sm.step(rawScratch({ [BPM]: 128 }), KICK_EDGE_BIT, enums, true, 16.7, 1000)
    expect(sm.flags).toBe(KICK_EDGE_BIT)
    expect(sm.schemaVersion).toBe(1)
    expect(sm.predictionType).toBe(2)
    expect(sm.huntState).toBe(3)
    expect(sm.energyZone).toBe(1)
    // scratch null (pre-first-frame) → no crash, derivados a 0.
    const sm2 = new TelemetrySmoother()
    sm2.step(null, 0, 0, false, 16.7, 0)
    sm2.step(null, 0, 0, false, 16.7, 17)
    expect(sm2.kickPulse).toBe(0)
    expect(sm2.approach).toBe(0)
  })
})

// ─────────────────── 🧠 WAVE 8275 — Cognitive payload (Selene V3) ───────────────────

const EPICNESS = TELEMETRY_SLOT.EPICNESS
const VAPOR = TELEMETRY_SLOT.VAPOR_PRESSURE
const PERC = TELEMETRY_SLOT.PERCUSSIVENESS
const MELO = TELEMETRY_SLOT.MELODICITY
const CRATE = TELEMETRY_SLOT.CREST_RATE

const CREST_BIT = 1 << TEL_FLAG.CREST_EVENT
const STROBE_BIT = 1 << TEL_FLAG.STROBE_ACTIVE
const SOVEREIGN_BIT = 1 << TEL_FLAG.SOVEREIGN_COUNTDOWN
const GLASS_BIT = 1 << TEL_FLAG.GLASS_BREAK

describe('TelemetrySmoother — WAVE 8275 cognitive payload', () => {
  it('slots 43/60-63 se decodifican y suavizan como u_tel', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({
      [EPICNESS]: 0.8, [VAPOR]: 0.6, [PERC]: 0.9, [MELO]: 0.4, [CRATE]: 3.2,
    })
    // EPICNESS attack=0.4 — primer paso sube parte del camino.
    sm.step(raw, 0, 0, true, 16.7, 0)
    expect(sm.out[EPICNESS - SLOT_PAYLOAD_BASE]).toBeGreaterThan(0.1)
    expect(sm.out[EPICNESS - SLOT_PAYLOAD_BASE]).toBeLessThan(0.8)
    // Convergencia tras ~2s de republicación.
    for (let i = 1; i <= 120; i++) sm.step(raw, 0, 0, true, 1000 / 60, i * (1000 / 60))
    expect(sm.out[EPICNESS - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.8, 1)
    expect(sm.out[VAPOR - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.6, 1)
    expect(sm.out[PERC - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.9, 1)
    expect(sm.out[MELO - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.4, 1)
    // crestRate es unidades/seg (>1 legal — no se clampa a [0,1]).
    expect(sm.out[CRATE - SLOT_PAYLOAD_BASE]).toBeCloseTo(3.2, 1)
  })

  it('u_crestPulse — flanco CREST_EVENT con τ=110ms (rápido, no tempo-bound)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, 0, 0, true, 16.7, 1000)
    expect(sm.crestPulse).toBe(0)
    sm.step(raw, CREST_BIT, 0, true, 16.7, 1017)
    expect(sm.crestPulse).toBeCloseTo(1, 2)
    // +110ms → e^-1 ≈ 0.368 (independiente del bpm — a 60BPM igual que a 174).
    sm.step(raw, 0, 0, false, 110, 1127)
    expect(sm.crestPulse).toBeCloseTo(Math.exp(-1), 2)
  })

  it('u_glassBreak — flanco GLASS_BREAK con τ=380ms (ruptura visible)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, GLASS_BIT, 0, true, 16.7, 5000)
    expect(sm.glassBreak).toBeCloseTo(1, 2)
    sm.step(raw, 0, 0, false, 380, 5380)
    expect(sm.glassBreak).toBeCloseTo(Math.exp(-1), 2)
    // El writer sostiene el bit ~250ms → re-armar dentro de la ventana es legal.
    sm.step(raw, GLASS_BIT, 0, true, 16.7, 5450)
    expect(sm.glassBreak).toBeGreaterThan(0.9)
  })

  it('u_strobeGate — nivel binario persistente (gate, no pulso)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, STROBE_BIT, 0, true, 16.7, 0)
    expect(sm.strobeGate).toBe(1)
    // Persiste entre publicaciones stale — es un estado, no un flanco.
    for (let i = 1; i <= 30; i++) sm.step(raw, 0, 0, false, 16.7, i * 16.7)
    expect(sm.strobeGate).toBe(1)
    // El siguiente frame FRESCO sin el bit lo apaga.
    sm.step(raw, 0, 0, true, 16.7, 1000)
    expect(sm.strobeGate).toBe(0)
  })

  it('flags 13-16 viajan por el wire sin colisión con los bits existentes', () => {
    const sab = new SharedArrayBuffer(TELEMETRY_RING_BYTES)
    writeWireFrame(sab, 3, { [BPM]: 120 }, CREST_BIT | STROBE_BIT | SOVEREIGN_BIT | GLASS_BIT | KICK_EDGE_BIT)
    const r = new TelemetryWireReader(sab)
    expect(r.read()).toBe(true)
    expect(r.flags & CREST_BIT).toBe(CREST_BIT)
    expect(r.flags & STROBE_BIT).toBe(STROBE_BIT)
    expect(r.flags & SOVEREIGN_BIT).toBe(SOVEREIGN_BIT)
    expect(r.flags & GLASS_BIT).toBe(GLASS_BIT)
    expect(r.flags & KICK_EDGE_BIT).toBe(KICK_EDGE_BIT)
    // Bits 0-12 sin tocar → AUDIO_LIVE (bit 0) sigue apagado.
    expect(r.flags & (1 << TEL_FLAG.AUDIO_LIVE)).toBe(0)
  })

  it('zero-alloc: out/buffer estables, sin objetos en step()', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120, [EPICNESS]: 0.5 })
    sm.step(raw, CREST_BIT | GLASS_BIT, 0, true, 16.7, 0)
    const outRef = sm.out
    for (let i = 1; i <= 10; i++) sm.step(raw, 0, 0, false, 16.7, i * 16.7)
    expect(sm.out).toBe(outRef)
  })
})

// ─────────────────── 🌊 WAVE 8279 · F4 — Liquid pulses (§2.3) ───────────────────

const VOID_HOLD = TELEMETRY_SLOT.VOID_HOLD
const VOCAL_SUSTAIN = TELEMETRY_SLOT.VOCAL_SUSTAIN
const SNARE_DRIVE = TELEMETRY_SLOT.SNARE_DRIVE
const RAW_MID = TELEMETRY_SLOT.RAW_MID_DELTA

const VOCAL_ONSET_BIT = 1 << TEL_FLAG.VOCAL_ONSET
const SNARE_TRUE_BIT = 1 << TEL_FLAG.SNARE_TRUE
const VOID_RELEASE_BIT = 1 << TEL_FLAG.VOID_RELEASE

describe('TelemetrySmoother — WAVE 8279 F4 liquid pulses', () => {
  it('u_vocalOnset — flanco VOCAL_ONSET con τ=600ms (aparición lenta)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 })
    sm.step(raw, 0, 0, true, 16.7, 1000)
    expect(sm.vocalOnset).toBe(0)
    sm.step(raw, VOCAL_ONSET_BIT, 0, true, 16.7, 1017)
    expect(sm.vocalOnset).toBeCloseTo(1, 2)
    // +600ms (1τ) → e^-1 ≈ 0.368 — independiente del tempo.
    sm.step(raw, 0, 0, false, 600, 1617)
    expect(sm.vocalOnset).toBeCloseTo(Math.exp(-1), 2)
  })

  it('u_snareTruePulse — flanco SNARE_TRUE con τ=¼beat (tempo-bound)', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120 }) // msPerBeat=500 → τ=125ms
    sm.step(raw, SNARE_TRUE_BIT, 0, true, 16.7, 2000)
    expect(sm.snareTruePulse).toBeCloseTo(1, 2)
    sm.step(raw, 0, 0, false, 125, 2125) // +1τ
    expect(sm.snareTruePulse).toBeCloseTo(Math.exp(-1), 2)
    // A 60 BPM el τ dobla (250ms) — mismo decay relativo.
    const sm2 = new TelemetrySmoother()
    const raw2 = rawScratch({ [BPM]: 60 })
    sm2.step(raw2, SNARE_TRUE_BIT, 0, true, 16.7, 0)
    sm2.step(raw2, 0, 0, false, 250, 250)
    expect(sm2.snareTruePulse).toBeCloseTo(Math.exp(-1), 2)
  })

  it('u_voidRelease — amplitud ∝ VOID_HOLD previo (hold 4s → A=0.5), τ=450ms', () => {
    const sm = new TelemetrySmoother()
    // El vacío se sostiene 4s — el smoother observa el hold ANTES del reset.
    sm.step(rawScratch({ [BPM]: 120, [VOID_HOLD]: 4 }), 0, 0, true, 16.7, 1000)
    // En el frame del flanco el host ya publica hold=0 → amplitud = pico previo.
    sm.step(rawScratch({ [BPM]: 120, [VOID_HOLD]: 0 }), VOID_RELEASE_BIT, 0, true, 16.7, 1017)
    expect(sm.voidRelease).toBeCloseTo(0.5, 2)
    // +450ms (1τ) → A·e^-1.
    sm.step(rawScratch({ [BPM]: 120 }), 0, 0, false, 450, 1467)
    expect(sm.voidRelease).toBeCloseTo(0.5 * Math.exp(-1), 2)
  })

  it('u_voidRelease — hold ≥8s satura A=1; hold <2s → piso A=0.25', () => {
    const smBig = new TelemetrySmoother()
    smBig.step(rawScratch({ [VOID_HOLD]: 12 }), 0, 0, true, 16.7, 0)
    smBig.step(rawScratch({ [VOID_HOLD]: 0 }), VOID_RELEASE_BIT, 0, true, 16.7, 17)
    expect(smBig.voidRelease).toBeCloseTo(1, 2)

    const smSmall = new TelemetrySmoother()
    smSmall.step(rawScratch({ [VOID_HOLD]: 1 }), 0, 0, true, 16.7, 0)
    smSmall.step(rawScratch({ [VOID_HOLD]: 0 }), VOID_RELEASE_BIT, 0, true, 16.7, 17)
    expect(smSmall.voidRelease).toBeCloseTo(0.25, 2)
  })

  it('u_voidRelease — sin VOID_RELEASE no hay pulso; hold residual no dispara', () => {
    const sm = new TelemetrySmoother()
    const raw = rawScratch({ [BPM]: 120, [VOID_HOLD]: 9 })
    sm.step(raw, 0, 0, true, 16.7, 0)
    sm.step(raw, 0, 0, true, 16.7, 17)
    expect(sm.voidRelease).toBe(0) // hold sin flanco de release → silencio
  })

  it('página B verbatim: slots kind:none (hold/time/drive/deltas) pasan crudos', () => {
    const sm = new TelemetrySmoother()
    sm.step(
      rawScratch({
        [VOID_HOLD]: 3.7,
        [TELEMETRY_SLOT.VOCAL_TIME]: 12.5,
        [SNARE_DRIVE]: 0.82,
        [RAW_MID]: 0.31,
      }),
      0, 0, true, 16.7, 0,
    )
    expect(sm.out[VOID_HOLD - SLOT_PAYLOAD_BASE]).toBeCloseTo(3.7)
    expect(sm.out[TELEMETRY_SLOT.VOCAL_TIME - SLOT_PAYLOAD_BASE]).toBeCloseTo(12.5)
    expect(sm.out[SNARE_DRIVE - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.82)
    expect(sm.out[RAW_MID - SLOT_PAYLOAD_BASE]).toBeCloseTo(0.31)
  })

  it('página B suavizada: VOCAL_SUSTAIN (linear a=0.7) converge sin saltar', () => {
    const sm = new TelemetrySmoother()
    const idx = VOCAL_SUSTAIN - SLOT_PAYLOAD_BASE
    sm.step(rawScratch({ [VOCAL_SUSTAIN]: 0.9 }), 0, 0, true, 16.7, 0)
    const first = sm.out[idx]
    expect(first).toBeGreaterThan(0.4) // attack 0.7 — rápido pero no snap
    expect(first).toBeLessThan(0.9)
    for (let i = 1; i <= 60; i++) {
      sm.step(rawScratch({ [VOCAL_SUSTAIN]: 0.9 }), 0, 0, true, 1000 / 60, i * (1000 / 60))
    }
    expect(sm.out[idx]).toBeCloseTo(0.9, 1)
  })
})

// ─────────── 🔬 WAVE 8281-RECON — monitor de diagnóstico (~10 Hz) ───────────

describe('TelemetrySmoother — WAVE 8281 TELDIAG monitor', () => {
  it('off por defecto: step() no logea sin __EUCLID_TEL_DIAG__', () => {
    const sm = new TelemetrySmoother()
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      for (let i = 0; i <= 30; i++) {
        sm.step(rawScratch({ [BPM]: 120 }), 0, 0, true, 16.7, i * 16.7)
      }
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('on: imprime ~10 Hz los valores UBO + réplica euTimbre + relojes', () => {
    const g = globalThis as { __EUCLID_TEL_DIAG__?: unknown }
    g.__EUCLID_TEL_DIAG__ = true
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const sm = new TelemetrySmoother()
      const raw = rawScratch({
        [BPM]: 120,
        [TELEMETRY_SLOT.VOCAL_ISOLATION]: 0.6,
        [TELEMETRY_SLOT.VOCAL_SUSTAIN]: 0.4,
        [TELEMETRY_SLOT.SYNTH_SUSTAIN]: 0.3,
        [TELEMETRY_SLOT.VOCAL_TIME]: 2.5,
        [VOID_HOLD]: 0,
      })
      // 1s a 60Hz → ~10 líneas (1 banner + ~10 data).
      for (let i = 0; i <= 60; i++) {
        sm.step(raw, VOCAL_ONSET_BIT, 0, true, 1000 / 60, i * (1000 / 60))
      }
      const lines = spy.mock.calls.map(c => String(c[0]))
      expect(lines[0]).toContain('8281-RECON')
      const data = lines.filter(l => l.includes('vIso'))
      expect(data.length).toBeGreaterThanOrEqual(8)
      expect(data.length).toBeLessThanOrEqual(12)
      // Columnas clave: raw→out vocal, euTimbre, reloj vocal, cadencia.
      expect(data[data.length - 1]).toContain('vIso 0.60→')
      expect(data[data.length - 1]).toContain('timbre v')
      expect(data[data.length - 1]).toContain('vT 2.50s')
      expect(data[data.length - 1]).toContain('VON')
      expect(data[data.length - 1]).toContain('tel ')
    } finally {
      spy.mockRestore()
      delete g.__EUCLID_TEL_DIAG__
    }
  })

  it('sin telemetría: reporta "sin frames" en vez de quedarse mudo', () => {
    const g = globalThis as { __EUCLID_TEL_DIAG__?: unknown }
    g.__EUCLID_TEL_DIAG__ = true
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const sm = new TelemetrySmoother()
      sm.step(null, 0, 0, false, 16.7, 0) // banner
      sm.step(null, 0, 0, false, 16.7, 200) // primera ventana de 100ms
      const lines = spy.mock.calls.map(c => String(c[0]))
      expect(lines.some(l => l.includes('sin frames'))).toBe(true)
    } finally {
      spy.mockRestore()
      delete g.__EUCLID_TEL_DIAG__
    }
  })
})
