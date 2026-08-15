// ─────────────────────────────────────────────────────────────────────────────
// DmxSabHandlers — Test suite exhaustiva (Vitest)
// Retargeted from GlassMemory.spec.ts to test the consolidated production API.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'

import {
  DMX_SAB_BYTES,
  DMX_HEADER_BYTES,
  MAX_UNIVERSES,
  CHANNELS_PER_UNI,
  DmxHdr,
} from './layout'

import {
  DmxUniverseWriter,
  DmxUniverseReader,
  createDmxSab,
} from './DmxSabHandlers'

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

  it('DmxUniverseWriter lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new DmxUniverseWriter(tiny)).toThrow(RangeError)
  })

  it('DmxUniverseReader lanza si el SAB es demasiado pequeño', () => {
    const tiny = new SharedArrayBuffer(4)
    expect(() => new DmxUniverseReader(tiny)).toThrow(RangeError)
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 3: DmxUniverseWriter / Reader — escritura y lectura correctas
// ═══════════════════════════════════════════════════════════════════════════

describe('DmxUniverseWriter + DmxUniverseReader — hot-path básico', () => {
  let sab: SharedArrayBuffer
  let writer: DmxUniverseWriter
  let reader: DmxUniverseReader

  beforeEach(() => {
    sab    = createDmxSab()
    writer = new DmxUniverseWriter(sab)
    reader = new DmxUniverseReader(sab)
  })

  it('seqlock empieza en 0 (estado par / estable)', () => {
    expect(writer.peekSeqlock()).toBe(0)
    expect(reader.peekSeqlock()).toBe(0)
  })

  it('commitFrame incrementa el seqlock en 2 (par→par)', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(42)
    writer.commitFrame(1, [u0], 1, 0)
    expect(writer.peekSeqlock()).toBe(2)
  })

  it('readCoherent devuelve el frameId correcto después de un commit', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(77)
    writer.commitFrame(5, [u0], 1, 0)
    const result = reader.readCoherent(0)
    expect(result).not.toBeNull()
    expect(result!.frameId).toBe(5)
  })

  it('readCoherent devuelve null si el frameId no cambió', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(77)
    writer.commitFrame(5, [u0], 1, 0)
    const result = reader.readCoherent(5)
    expect(result).toBeNull()
  })

  it('los datos del universo 0 se leen correctamente', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI)
    u0[0]   = 255
    u0[1]   = 128
    u0[511] = 33

    writer.commitFrame(1, [u0], 1, 0)
    const result = reader.readCoherent(0)
    expect(result).not.toBeNull()
    const data = result!.data

    expect(data[0]).toBe(255)
    expect(data[1]).toBe(128)
    expect(data[511]).toBe(33)
  })

  it('los datos del universo 49 se ubican en el offset correcto', () => {
    const universes: (Uint8Array | undefined)[] = new Array(MAX_UNIVERSES).fill(undefined)
    universes[49] = new Uint8Array(CHANNELS_PER_UNI).fill(99)

    // Universe 49 → bit 18 in maskHi (49 - 31 = 18)
    const maskHi = (1 << 18) >>> 0
    writer.commitFrame(1, universes, 0, maskHi)
    const result = reader.readCoherent(0)
    expect(result).not.toBeNull()
    const data = result!.data

    const offset = 49 * CHANNELS_PER_UNI
    expect(data[offset]).toBe(99)
    expect(data[offset + 511]).toBe(99)
  })

  it('actualizar mismo SAB desde writer y reader produce datos coherentes en N frames', () => {
    for (let frame = 1; frame <= 100; frame++) {
      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(frame & 0xff)
      writer.commitFrame(frame, [u0], 1, 0)
      const result = reader.readCoherent(frame - 1)
      expect(result).not.toBeNull()
      expect(result!.frameId).toBe(frame)
      expect(result!.data[0]).toBe(frame & 0xff)
    }
  })

  it('peekHeader devuelve maskLo y maskHi correctos', () => {
    const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(1)
    const u2 = new Uint8Array(CHANNELS_PER_UNI).fill(2)
    const universes: (Uint8Array | undefined)[] = new Array(3).fill(undefined)
    universes[0] = u0
    universes[2] = u2
    // bit 0 and bit 2 in maskLo
    const maskLo = 0b101
    writer.commitFrame(1, universes, maskLo, 0)

    const h = reader.peekHeader()
    expect(h.frameId).toBe(1)
    expect(h.maskLo & 0b101).toBe(0b101)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 5: SEQLOCK — invariantes del protocolo de concurrencia
// ═══════════════════════════════════════════════════════════════════════════

describe('SEQLOCK — invariantes de concurrencia (single-realm simulado)', () => {

  describe('DmxUniverseWriter — paridad SEQLOCK', () => {
    it('seqlock es par antes del commit, impar no observable post-commit (par final)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)

      expect(writer.peekSeqlock() & 1).toBe(0)

      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(1)
      writer.commitFrame(1, [u0], 1, 0)

      const seq = writer.peekSeqlock()
      expect(seq & 1).toBe(0)
      expect(seq).toBe(2)
    })

    it('N commits producen seqlock = 2N (siempre par)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const u0 = new Uint8Array(CHANNELS_PER_UNI)

      for (let n = 1; n <= 10; n++) {
        writer.commitFrame(n, [u0], 1, 0)
        expect(writer.peekSeqlock()).toBe(n * 2)
        expect(writer.peekSeqlock() & 1).toBe(0)
      }
    })
  })

  describe('DmxUniverseReader — tryReadIfStable rechaza seqlock impar', () => {
    it('retorna null cuando seqlock es impar (simulación de escritura en curso)', () => {
      const sab    = createDmxSab()
      const reader = new DmxUniverseReader(sab)

      const hdr = new Int32Array(sab, 0, 16)
      Atomics.store(hdr, DmxHdr.SEQLOCK, 1)

      expect(reader.peekSeqlock() & 1).toBe(1)
      expect(reader.tryReadIfStable(0)).toBeNull()
    })

    it('retorna frameId cuando seqlock es par (escritura completa)', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const reader = new DmxUniverseReader(sab)

      const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(55)
      writer.commitFrame(3, [u0], 1, 0)

      expect(reader.peekSeqlock() & 1).toBe(0)

      const result = reader.tryReadIfStable(0)
      expect(result).not.toBeNull()
      expect(result!.frameId).toBe(3)
      expect(result!.data[0]).toBe(55)
    })

    it('resolver seqlock de impar a par permite lectura exitosa', () => {
      const sab    = createDmxSab()
      const reader = new DmxUniverseReader(sab)

      const data = new Uint8Array(sab, DMX_HEADER_BYTES)
      data[0] = 123
      const hdr = new Int32Array(sab, 0, 16)

      Atomics.store(hdr, DmxHdr.SEQLOCK, 1)
      hdr[DmxHdr.FRAME_ID] = 9
      expect(reader.tryReadIfStable(0)).toBeNull()

      Atomics.store(hdr, DmxHdr.SEQLOCK, 2)
      const result = reader.tryReadIfStable(0)
      expect(result).not.toBeNull()
      expect(result!.frameId).toBe(9)
      expect(result!.data[0]).toBe(123)
    })
  })

  describe('Integridad de datos bajo N commits rápidos consecutivos', () => {
    it('DMX: 1000 commits sin tearing de datos', () => {
      const sab    = createDmxSab()
      const writer = new DmxUniverseWriter(sab)
      const reader = new DmxUniverseReader(sab)

      for (let frame = 1; frame <= 1000; frame++) {
        const u0 = new Uint8Array(CHANNELS_PER_UNI).fill(frame & 0xff)
        writer.commitFrame(frame, [u0], 1, 0)
        const result = reader.readCoherent(frame - 1)
        expect(result).not.toBeNull()
        expect(result!.frameId).toBe(frame)
        const data = result!.data
        for (let ch = 0; ch < CHANNELS_PER_UNI; ch++) {
          if (data[ch] !== (frame & 0xff)) {
            throw new Error(`Tearing detectado en frame ${frame}, canal ${ch}: valor ${data[ch]}`)
          }
        }
      }
      expect(writer.peekSeqlock()).toBe(2000)
    })

  })
})
