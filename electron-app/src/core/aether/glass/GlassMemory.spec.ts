// ─────────────────────────────────────────────────────────────────────────────
// WAVE 6005 — GLASS MEMORY: Test suite exhaustiva (Vitest)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'

import {
  DMX_SAB_BYTES,
  DMX_HEADER_BYTES,
  MAX_UNIVERSES,
  CHANNELS_PER_UNI,
  FIX_SAB_BYTES,
  FIX_HEADER_BYTES,
  MAX_FIXTURES,
  FLOATS_PER_FIX,
  FIX_DATA_FLOATS,
  DmxHdr,
  FixHdr,
  FixField,
} from './layout'

import {
  DmxUniverseWriter,
  DmxUniverseReader,
  FixtureStateWriter,
  FixtureStateReader,
  createDmxSab,
  createFixtureSab,
} from './GlassMemory'

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 1: Verificación de tamaños en bytes (layout matemático)
// ═══════════════════════════════════════════════════════════════════════════

describe('Layout — tamaños de SharedArrayBuffer', () => {
  it('DMX_SAB_BYTES es exactamente 25 664 bytes', () => {
    expect(DMX_SAB_BYTES).toBe(25_664)
  })

  it('DMX: header ocupa exactamente 64 bytes', () => {
    expect(DMX_HEADER_BYTES).toBe(64)
  })

  it('DMX: data ocupa exactamente MAX_UNIVERSES × CHANNELS_PER_UNI bytes', () => {
    expect(DMX_SAB_BYTES - DMX_HEADER_BYTES).toBe(MAX_UNIVERSES * CHANNELS_PER_UNI)
  })

  it('FIX_SAB_BYTES es exactamente 131 200 bytes', () => {
    expect(FIX_SAB_BYTES).toBe(131_200)
  })

  it('FIX: header ocupa exactamente 128 bytes', () => {
    expect(FIX_HEADER_BYTES).toBe(128)
  })

  it('FIX: data ocupa exactamente MAX_FIXTURES × FLOATS_PER_FIX × 4 bytes', () => {
    const expectedDataBytes = MAX_FIXTURES * FLOATS_PER_FIX * 4
    expect(FIX_SAB_BYTES - FIX_HEADER_BYTES).toBe(expectedDataBytes)
  })

  it('FIX: cada fixture ocupa exactamente 64 bytes (FLOATS_PER_FIX = 16)', () => {
    expect(FLOATS_PER_FIX * 4).toBe(64)
  })

  it('FIX: FIX_DATA_FLOATS = MAX_FIXTURES × FLOATS_PER_FIX', () => {
    expect(FIX_DATA_FLOATS).toBe(MAX_FIXTURES * FLOATS_PER_FIX)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Factories crean SABs con el tamaño correcto
// ═══════════════════════════════════════════════════════════════════════════

describe('Factory helpers', () => {
  it('createDmxSab() produce un SAB del tamaño correcto', () => {
    const sab = createDmxSab()
    expect(sab).toBeInstanceOf(SharedArrayBuffer)
    expect(sab.byteLength).toBe(DMX_SAB_BYTES)
  })

  it('createFixtureSab() produce un SAB del tamaño correcto', () => {
    const sab = createFixtureSab()
    expect(sab).toBeInstanceOf(SharedArrayBuffer)
    expect(sab.byteLength).toBe(FIX_SAB_BYTES)
  })

  it('DmxUniverseWriter lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new DmxUniverseWriter(tiny)).toThrow(RangeError)
  })

  it('DmxUniverseReader lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new DmxUniverseReader(tiny)).toThrow(RangeError)
  })

  it('FixtureStateWriter lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new FixtureStateWriter(tiny)).toThrow(RangeError)
  })

  it('FixtureStateReader lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new FixtureStateReader(tiny)).toThrow(RangeError)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 3: DmxUniverseWriter / Reader — escritura y lectura correctas
// ═══════════════════════════════════════════════════════════════════════════

describe('DmxUniverseWriter + DmxUniverseReader — hot-path básico', () => {
  let sab: SharedArrayBuffer
  let writer: DmxUniverseWriter
  let reader: DmxUniverseReader
  let dest: Uint8Array

  beforeEach(() => {
    sab    = createDmxSab()
    writer = new DmxUniverseWriter(sab)
    reader = new DmxUniverseReader(sab)
    dest   = new Uint8Array(MAX_UNIVERSES * CHANNELS_PER_UNI)
  })

  it('seqlock empieza en 0 (estado par / estable)', () => {
    expect(writer.peekSeqlock()).toBe(0)
    expect(reader.peekSeqlock()).toBe(0)
  })

  it('commitFrame incrementa el seqlock en 2 (par→par)', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(42)
    writer.commitFrame(1, [u0], 1000)
    expect(writer.peekSeqlock()).toBe(2)
  })

  it('readCoherent devuelve el frameId correcto después de un commit', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(77)
    writer.commitFrame(5, [u0], 2000)
    const frameId = reader.readCoherent(dest, 0)
    expect(frameId).toBe(5)
  })

  it('readCoherent devuelve null si el frameId no cambió', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(77)
    writer.commitFrame(5, [u0], 2000)
    const frameId = reader.readCoherent(dest, 5)
    expect(frameId).toBeNull()
  })

  it('los datos del universo 0 se leen correctamente', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI)
    u0[0]   = 255
    u0[1]   = 128
    u0[511] = 33

    writer.commitFrame(1, [u0], 1000)
    reader.readCoherent(dest, 0)

    expect(dest[0]).toBe(255)
    expect(dest[1]).toBe(128)
    expect(dest[511]).toBe(33)
  })

  it('los datos del universo 49 se ubican en el offset correcto', () => {
    const universes: Array<null | Uint8Array> = Array(50).fill(null)
    universes[49] = new Uint8Array(CHANNELS_PER_UNI).fill(99)

    writer.commitFrame(1, universes, 1000)
    reader.readCoherent(dest, 0)

    const offset = 49 * CHANNELS_PER_UNI
    expect(dest[offset]).toBe(99)
    expect(dest[offset + 511]).toBe(99)
  })

  it('actualizar mismo SAB desde writer y reader produce datos coherentes en N frames', () => {
    for (let frame = 1; frame <= 100; frame++) {
      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(frame & 0xff)
      writer.commitFrame(frame, [u0], frame * 22)
      const gotFrame = reader.readCoherent(dest, frame - 1)
      expect(gotFrame).toBe(frame)
      expect(dest[0]).toBe(frame & 0xff)
    }
  })

  it('peekHeader devuelve activeUnis y maskLo correctos', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(1)
    const u2 = new Uint8Array(CHANNELS_PER_UNI).fill(2)
    writer.commitFrame(1, [u0, null, u2], 1000)

    const h = reader.peekHeader()
    expect(h.frameId).toBe(1)
    expect(h.activeUnis).toBe(2)
    // bit 0 y bit 2 activos
    expect(h.maskLo & 0b101).toBe(0b101)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 4: FixtureStateWriter / Reader — escritura y lectura correctas
// ═══════════════════════════════════════════════════════════════════════════

describe('FixtureStateWriter + FixtureStateReader — hot-path básico', () => {
  let sab: SharedArrayBuffer
  let writer: FixtureStateWriter
  let reader: FixtureStateReader
  let dest: Float32Array
  let fixtureData: Float32Array

  beforeEach(() => {
    sab         = createFixtureSab()
    writer      = new FixtureStateWriter(sab)
    reader      = new FixtureStateReader(sab)
    dest        = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)
    fixtureData = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)
  })

  it('seqlock empieza en 0', () => {
    expect(writer.peekSeqlock()).toBe(0)
  })

  it('commitFixtures incrementa seqlock en 2', () => {
    writer.commitFixtures(1, fixtureData, 1, 1000)
    expect(writer.peekSeqlock()).toBe(2)
  })

  it('readCoherent devuelve frameId y count correctos', () => {
    fixtureData[FixField.R] = 255
    fixtureData[FixField.G] = 128
    writer.commitFixtures(7, fixtureData, 10, 3000)

    const result = reader.readCoherent(dest, 0)
    expect(result).not.toBeNull()
    expect(result!.frameId).toBe(7)
    expect(result!.count).toBe(10)
  })

  it('readCoherent devuelve null si frameId no cambió', () => {
    writer.commitFixtures(7, fixtureData, 10, 3000)
    const r = reader.readCoherent(dest, 7)
    expect(r).toBeNull()
  })

  it('los campos de fixture 0 se leen correctamente', () => {
    fixtureData[FixField.R]      = 1.0
    fixtureData[FixField.G]      = 0.5
    fixtureData[FixField.B]      = 0.25
    fixtureData[FixField.DIMMER] = 0.8
    fixtureData[FixField.PAN]    = 128
    fixtureData[FixField.FLAGS]  = 1

    writer.commitFixtures(1, fixtureData, 1, 1000)
    reader.readCoherent(dest, 0)

    expect(dest[FixField.R]).toBeCloseTo(1.0)
    expect(dest[FixField.G]).toBeCloseTo(0.5)
    expect(dest[FixField.B]).toBeCloseTo(0.25)
    expect(dest[FixField.DIMMER]).toBeCloseTo(0.8)
    expect(dest[FixField.PAN]).toBe(128)
    expect(dest[FixField.FLAGS]).toBe(1)
  })

  it('los campos del fixture 2047 se ubican en el offset correcto', () => {
    const lastIdx = (MAX_FIXTURES - 1) * FLOATS_PER_FIX
    fixtureData[lastIdx + FixField.R] = 0.99
    fixtureData[lastIdx + FixField.G] = 0.11

    writer.commitFixtures(1, fixtureData, MAX_FIXTURES, 1000)
    reader.readCoherent(dest, 0)

    expect(dest[lastIdx + FixField.R]).toBeCloseTo(0.99)
    expect(dest[lastIdx + FixField.G]).toBeCloseTo(0.11)
  })

  it('readFixtureField retorna el valor correcto sin copiar buffer completo', () => {
    fixtureData[3 * FLOATS_PER_FIX + FixField.B] = 0.42
    writer.commitFixtures(1, fixtureData, 10, 1000)

    const val = reader.readFixtureField(3, FixField.B)
    expect(val).toBeCloseTo(0.42)
  })

  it('N frames consecutivos producen snapshots coherentes', () => {
    for (let frame = 1; frame <= 50; frame++) {
      fixtureData[FixField.DIMMER] = frame / 50
      writer.commitFixtures(frame, fixtureData, 4, frame * 22)
      const r = reader.readCoherent(dest, frame - 1)
      expect(r).not.toBeNull()
      expect(dest[FixField.DIMMER]).toBeCloseTo(frame / 50, 5)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 5: SEQLOCK — invariantes del protocolo de concurrencia
// ═══════════════════════════════════════════════════════════════════════════

describe('SEQLOCK — invariantes de concurrencia (single-realm simulado)', () => {
  /**
   * En JS de un solo hilo no podemos interrumpir mid-write, pero sí podemos:
   *  1. Verificar la paridad par/impar correcta antes/durante/después de commit.
   *  2. Simular un seqlock "congelado impar" con Atomics.store y verificar
   *     que tryReadIfStable devuelve null (lector rechaza tearing).
   *  3. Verificar que después de resolver el seqlock (par), tryReadIfStable
   *     entrega el dato correcto.
   */

  describe('DmxUniverseWriter — paridad SEQLOCK', () => {
    it('seqlock es par antes del commit, impar no observable post-commit (par final)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)

      // Antes: par (0)
      expect(writer.peekSeqlock() & 1).toBe(0)

      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(1)
      writer.commitFrame(1, [u0], 1000)

      // Después: par (2) — jamás termina en impar
      const seq = writer.peekSeqlock()
      expect(seq & 1).toBe(0)
      expect(seq).toBe(2)
    })

    it('N commits producen seqlock = 2N (siempre par)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const u0 = new Uint8Array(CHANNELS_PER_UNI)

      for (let n = 1; n <= 10; n++) {
        writer.commitFrame(n, [u0], n * 22)
        expect(writer.peekSeqlock()).toBe(n * 2)
        expect(writer.peekSeqlock() & 1).toBe(0)
      }
    })
  })

  describe('DmxUniverseReader — tryReadIfStable rechaza seqlock impar', () => {
    it('retorna null cuando seqlock es impar (simulación de escritura en curso)', () => {
      const sab    = createDmxSab()
      const reader = new DmxUniverseReader(sab)
      const dest   = new Uint8Array(MAX_UNIVERSES * CHANNELS_PER_UNI)

      // Simular seqlock congelado en impar (escritor interrumpido)
      const hdr = new Int32Array(sab, 0, 16)
      Atomics.store(hdr, DmxHdr.SEQLOCK, 1)  // ← seqlock impar

      expect(reader.peekSeqlock() & 1).toBe(1)

      const result = reader.tryReadIfStable(dest)
      expect(result).toBeNull()
    })

    it('retorna frameId cuando seqlock es par (escritura completa)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const reader = new DmxUniverseReader(sab)
      const dest   = new Uint8Array(MAX_UNIVERSES * CHANNELS_PER_UNI)

      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(55)
      writer.commitFrame(3, [u0], 1000)

      // seqlock debe ser par
      expect(reader.peekSeqlock() & 1).toBe(0)

      const frameId = reader.tryReadIfStable(dest)
      expect(frameId).toBe(3)
      expect(dest[0]).toBe(55)
    })

    it('resolver seqlock de impar a par permite lectura exitosa', () => {
      const sab    = createDmxSab()
      const reader = new DmxUniverseReader(sab)
      const dest   = new Uint8Array(MAX_UNIVERSES * CHANNELS_PER_UNI)

      // Escribir directamente el dato
      const data = new Uint8Array(sab, DMX_HEADER_BYTES)
      data[0] = 123
      const hdr = new Int32Array(sab, 0, 16)

      // Congelar en impar y verificar que tryReadIfStable falla
      Atomics.store(hdr, DmxHdr.SEQLOCK, 1)
      hdr[DmxHdr.FRAME_ID] = 9
      expect(reader.tryReadIfStable(dest)).toBeNull()

      // Resolver a par (simula finalización del escritor)
      Atomics.store(hdr, DmxHdr.SEQLOCK, 2)
      const frameId = reader.tryReadIfStable(dest)
      expect(frameId).toBe(9)
      expect(dest[0]).toBe(123)
    })
  })

  describe('FixtureStateReader — tryReadIfStable rechaza seqlock impar', () => {
    it('retorna null cuando seqlock es impar', () => {
      const sab    = createFixtureSab()
      const reader = new FixtureStateReader(sab)
      const dest   = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)

      const hdr = new Int32Array(sab, 0, 32)
      Atomics.store(hdr, FixHdr.SEQLOCK, 1)

      expect(reader.tryReadIfStable(dest)).toBeNull()
    })

    it('retorna datos cuando seqlock es par', () => {
      const sab    = createFixtureSab()
      const writer = new FixtureStateWriter(sab)
      const reader = new FixtureStateReader(sab)
      const dest   = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)

      const fixtureData = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)
      fixtureData[FixField.R] = 0.75
      writer.commitFixtures(11, fixtureData, 1, 5000)

      const result = reader.tryReadIfStable(dest)
      expect(result).not.toBeNull()
      expect(result!.frameId).toBe(11)
      expect(dest[FixField.R]).toBeCloseTo(0.75)
    })
  })

  describe('Integridad de datos bajo N commits rápidos consecutivos', () => {
    it('DMX: 1000 commits sin tearing de datos', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const reader = new DmxUniverseReader(sab)
      const dest   = new Uint8Array(MAX_UNIVERSES * CHANNELS_PER_UNI)

      for (let frame = 1; frame <= 1000; frame++) {
        const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(frame & 0xff)
        writer.commitFrame(frame, [u0], frame)
        const gotFrame = reader.readCoherent(dest, frame - 1)
        expect(gotFrame).toBe(frame)
        // Verificar coherencia: todos los bytes deben tener el mismo valor
        for (let ch = 0; ch < CHANNELS_PER_UNI; ch++) {
          if (dest[ch] !== (frame & 0xff)) {
            throw new Error(`Tearing detectado en frame ${frame}, canal ${ch}: valor ${dest[ch]}`)
          }
        }
      }
      // seqlock final = 2000 (siempre par)
      expect(writer.peekSeqlock()).toBe(2000)
    })

    it('FIX: 500 commits sin tearing de fixtures', () => {
      const sab    = createFixtureSab()
      const writer = new FixtureStateWriter(sab)
      const reader = new FixtureStateReader(sab)
      const dest   = new Float32Array(MAX_FIXTURES * FLOATS_PER_FIX)
      const src    = new Float32Array(FLOATS_PER_FIX * 4)

      for (let frame = 1; frame <= 500; frame++) {
        const val = frame / 500
        src[FixField.DIMMER]                 = val
        src[FLOATS_PER_FIX + FixField.DIMMER] = val
        writer.commitFixtures(frame, src, 2, frame)
        const r = reader.readCoherent(dest, frame - 1)
        expect(r).not.toBeNull()
        expect(dest[FixField.DIMMER]).toBeCloseTo(val, 5)
        expect(dest[FLOATS_PER_FIX + FixField.DIMMER]).toBeCloseTo(val, 5)
      }
    })
  })
})
