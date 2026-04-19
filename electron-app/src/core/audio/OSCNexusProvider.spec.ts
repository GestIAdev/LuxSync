// WAVE 3401: Unit Tests -- OSCNexusProvider OSC Parser + Builder
//
// Coverage requirements (from WAVE 3401.1 directive):
//   - Inyectar buffers de bytes crudos simulando paquetes UDP malformados o incompletos
//   - El parser manual RFC 6295 debe descartarlos silenciosamente sin causar crash
//   - Validar roundtrip válido para todos los tipos OSC: f, i, s, b
//   - Fuzzing básico: bytes aleatorios no deben causar throw (deterministico)
//
// parseOSCMessage and buildOSCMessage are re-exported from OSCNexusProvider.ts
// for testability. No UDP socket required -- pure function tests.

import { describe, it, expect } from 'vitest'
import { parseOSCMessage, buildOSCMessage } from './OSCNexusProvider'
import type { OSCArgument } from './OmniInputTypes'

// ============================================
// HELPERS
// ============================================

function parseBuffer(hexOrArray: number[]): Buffer {
  return Buffer.from(hexOrArray)
}

// OSC 4-byte alignment helper (for crafting manual packets)
function oscStr(s: string): Buffer {
  const raw = Buffer.from(s + '\0', 'ascii')
  const padded = (raw.length + 3) & ~3
  const out = Buffer.alloc(padded)
  raw.copy(out)
  return out
}

function float32BEToBytes(v: number): number[] {
  const b = Buffer.alloc(4)
  b.writeFloatBE(v, 0)
  return [...b]
}

function int32BEToBytes(v: number): number[] {
  const b = Buffer.alloc(4)
  b.writeInt32BE(v, 0)
  return [...b]
}

// ============================================
// MALFORMED PACKETS -- must discard silently (return null / partial)
// ============================================

describe('parseOSCMessage -- malformed + incomplete input', () => {
  it('empty buffer returns null', () => {
    expect(parseOSCMessage(Buffer.alloc(0))).toBeNull()
  })

  it('buffer of 1 byte returns null', () => {
    expect(parseOSCMessage(Buffer.from([0x2f]))).toBeNull()
  })

  it('buffer of 3 bytes returns null (len < 4)', () => {
    expect(parseOSCMessage(Buffer.from([0x2f, 0x61, 0x00, 0x00]).slice(0, 3))).toBeNull()
  })

  it('buffer not starting with "/" (0x2f) returns null', () => {
    expect(parseOSCMessage(Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBeNull()
    expect(parseOSCMessage(Buffer.from([0x41, 0x42, 0x43, 0x44]))).toBeNull()
    expect(parseOSCMessage(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]))).toBeNull()
  })

  it('valid address only (no type tag section) returns address with empty args', () => {
    // "/a" + null + padding = 4 bytes exactly, no ',' for type tag
    const buf = oscStr('/a')
    const result = parseOSCMessage(buf)
    expect(result).not.toBeNull()
    expect(result!.address).toBe('/a')
    expect(result!.args).toHaveLength(0)
  })

  it('address with type tag but no argument data -- partial parse, no crash', () => {
    // "/a\0\0" + ",f\0\0" -- float arg promised but 0 extra bytes provided
    const addr = oscStr('/a')
    const typetag = oscStr(',f')
    const buf = Buffer.concat([addr, typetag]) // no float data after

    // Must not throw
    let result: ReturnType<typeof parseOSCMessage> = undefined as any
    expect(() => { result = parseOSCMessage(buf) }).not.toThrow()

    // Either null or address with empty args (truncated before arg data)
    if (result !== null) {
      expect(result.address).toBe('/a')
      // args may be empty (truncated) -- must not contain garbage
    }
  })

  it('truncated float argument (only 2 bytes instead of 4) -- no crash', () => {
    const addr = oscStr('/trunc')
    const typetag = oscStr(',f')
    // Only 2 bytes of float data instead of 4
    const truncated = Buffer.concat([addr, typetag, Buffer.from([0x3f, 0x80])])
    expect(() => parseOSCMessage(truncated)).not.toThrow()
  })

  it('unknown type tag -- parsed silently (no throw)', () => {
    const addr = oscStr('/test')
    const typetag = oscStr(',x')  // 'x' is not f/i/s/b
    const padding = Buffer.alloc(4) // 4 bytes skipped for unknown type
    const buf = Buffer.concat([addr, typetag, padding])
    let result: ReturnType<typeof parseOSCMessage> = undefined as any
    expect(() => { result = parseOSCMessage(buf) }).not.toThrow()
    // Address should be parseable
    if (result !== null) {
      expect(result.address).toBe('/test')
    }
  })

  it('multiple unknown type tags -- all skipped, no throw', () => {
    const addr = oscStr('/xyz')
    const typetag = oscStr(',xyz') // x, y, z all unknown
    const padding = Buffer.alloc(12) // 4 bytes x 3 unknown types
    const buf = Buffer.concat([addr, typetag, padding])
    expect(() => parseOSCMessage(buf)).not.toThrow()
  })

  it('null bytes only (zero-filled buffer of 8 bytes) -- returns null', () => {
    expect(parseOSCMessage(Buffer.alloc(8))).toBeNull()
  })

  it('type tag comma present but empty type list (",\\0\\0\\0") returns empty args', () => {
    const addr = oscStr('/empty')
    const typetag = oscStr(',')
    const buf = Buffer.concat([addr, typetag])
    const result = parseOSCMessage(buf)
    expect(result).not.toBeNull()
    expect(result!.args).toHaveLength(0)
  })
})

// ============================================
// DETERMINISTIC FUZZ -- fixed byte sequences that used to be edge cases in similar parsers
// ============================================

describe('parseOSCMessage -- deterministic fuzz vectors', () => {
  // Each vector is a byte sequence that must not throw
  const vectors: number[][] = [
    // All 0xff
    [0x2f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
    // Valid address, broken type tag
    [0x2f, 0x61, 0x00, 0x00, 0x2c, 0xff, 0x00, 0x00],
    // Very long address (tests readOSCString termination)
    [0x2f, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x00, 0x00],
    // Type tag with blob size larger than buffer
    [0x2f, 0x61, 0x00, 0x00, 0x2c, 0x62, 0x00, 0x00, 0x7f, 0xff, 0xff, 0xff],
    // Exactly 4 bytes, starts with '/' but has no null terminator
    [0x2f, 0x61, 0x62, 0x63],
    // Valid address with 'i' type but only 2 bytes of data
    [0x2f, 0x61, 0x00, 0x00, 0x2c, 0x69, 0x00, 0x00, 0x00, 0x00],
    // MaxInt32 as blob size
    [0x2f, 0x74, 0x00, 0x00, 0x2c, 0x62, 0x00, 0x00, 0x7F, 0xFF, 0xFF, 0xFF, 0x00, 0x01],
    // Negative blob size
    [0x2f, 0x74, 0x00, 0x00, 0x2c, 0x62, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x01],
  ]

  for (let i = 0; i < vectors.length; i++) {
    it(`fuzz vector #${i + 1} does not throw`, () => {
      const buf = Buffer.from(vectors[i])
      expect(() => parseOSCMessage(buf)).not.toThrow()
    })
  }
})

// ============================================
// VALID ROUNDTRIP -- buildOSCMessage -> parseOSCMessage
// ============================================

describe('parseOSCMessage + buildOSCMessage -- valid roundtrip', () => {
  it('float32 argument roundtrip', () => {
    const args: OSCArgument[] = [{ type: 'f', value: 1.5 }]
    const buf = buildOSCMessage('/test/f', args)
    const result = parseOSCMessage(buf)

    expect(result).not.toBeNull()
    expect(result!.address).toBe('/test/f')
    expect(result!.args).toHaveLength(1)
    expect(result!.args[0].type).toBe('f')
    expect((result!.args[0] as { type: 'f'; value: number }).value).toBeCloseTo(1.5, 4)
  })

  it('int32 argument roundtrip', () => {
    const args: OSCArgument[] = [{ type: 'i', value: 42 }]
    const buf = buildOSCMessage('/test/i', args)
    const result = parseOSCMessage(buf)

    expect(result!.args[0].type).toBe('i')
    expect((result!.args[0] as { type: 'i'; value: number }).value).toBe(42)
  })

  it('negative int32 roundtrip', () => {
    const args: OSCArgument[] = [{ type: 'i', value: -1 }]
    const buf = buildOSCMessage('/neg', args)
    const result = parseOSCMessage(buf)
    expect((result!.args[0] as { type: 'i'; value: number }).value).toBe(-1)
  })

  it('string argument roundtrip', () => {
    const args: OSCArgument[] = [{ type: 's', value: 'hello' }]
    const buf = buildOSCMessage('/test/s', args)
    const result = parseOSCMessage(buf)

    expect(result!.args[0].type).toBe('s')
    expect((result!.args[0] as { type: 's'; value: string }).value).toBe('hello')
  })

  it('blob argument roundtrip', () => {
    const blobData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const args: OSCArgument[] = [{ type: 'b', value: blobData }]
    const buf = buildOSCMessage('/test/b', args)
    const result = parseOSCMessage(buf)

    expect(result!.args[0].type).toBe('b')
    const parsedBlob = (result!.args[0] as { type: 'b'; value: Uint8Array }).value
    expect(parsedBlob.length).toBe(blobData.length)
    for (let i = 0; i < blobData.length; i++) {
      expect(parsedBlob[i]).toBe(blobData[i])
    }
  })

  it('multi-arg roundtrip: f + i + s', () => {
    const args: OSCArgument[] = [
      { type: 'f', value: 0.75 },
      { type: 'i', value: 12345 },
      { type: 's', value: 'vibe' },
    ]
    const buf = buildOSCMessage('/multi', args)
    const result = parseOSCMessage(buf)

    expect(result).not.toBeNull()
    expect(result!.address).toBe('/multi')
    expect(result!.args).toHaveLength(3)
    expect((result!.args[0] as { type: 'f'; value: number }).value).toBeCloseTo(0.75, 4)
    expect((result!.args[1] as { type: 'i'; value: number }).value).toBe(12345)
    expect((result!.args[2] as { type: 's'; value: string }).value).toBe('vibe')
  })

  it('zero args (address only) roundtrip', () => {
    const buf = buildOSCMessage('/luxsync/ping', [])
    const result = parseOSCMessage(buf)
    expect(result!.address).toBe('/luxsync/ping')
    expect(result!.args).toHaveLength(0)
  })

  it('LuxSync publishState message structure roundtrip', () => {
    // Matches what TitanOrchestrator sends via oscProvider.publishState()
    const args: OSCArgument[] = [
      { type: 'f', value: 0.82 },   // energy
      { type: 'f', value: 128.0 },  // bpm
      { type: 'i', value: 1 },      // onBeat
      { type: 's', value: 'verse' }, // section
    ]
    const buf = buildOSCMessage('/luxsync/state', args)
    const result = parseOSCMessage(buf)

    expect(result!.address).toBe('/luxsync/state')
    expect(result!.args).toHaveLength(4)
    expect((result!.args[1] as { type: 'f'; value: number }).value).toBeCloseTo(128.0, 1)
    expect((result!.args[2] as { type: 'i'; value: number }).value).toBe(1)
    expect((result!.args[3] as { type: 's'; value: string }).value).toBe('verse')
  })

  it('long address with nested path roundtrip', () => {
    const buf = buildOSCMessage('/luxsync/fixture/spot-01/dimmer', [{ type: 'f', value: 0.5 }])
    const result = parseOSCMessage(buf)
    expect(result!.address).toBe('/luxsync/fixture/spot-01/dimmer')
  })

  it('string with padding alignment preserved (length not multiple of 4)', () => {
    // 'ab' -> "ab\0" -> aligned to 4 -> "ab\0\0"
    // 'abc' -> "abc\0" -> already 4
    // 'abcde' -> "abcde\0" -> aligned to 8
    for (const s of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      const buf = buildOSCMessage('/s', [{ type: 's', value: s }])
      const result = parseOSCMessage(buf)
      expect((result!.args[0] as { type: 's'; value: string }).value).toBe(s)
    }
  })

  it('float32 precision: 0.0 and 1.0 roundtrip exactly', () => {
    for (const v of [0.0, 1.0, -1.0]) {
      const buf = buildOSCMessage('/f', [{ type: 'f', value: v }])
      const result = parseOSCMessage(buf)
      expect((result!.args[0] as { type: 'f'; value: number }).value).toBeCloseTo(v, 6)
    }
  })

  it('large blob (4096 bytes Float32) roundtrip', () => {
    // Simulate a PCM blob like the one AudioMatrix sends via /luxsync/audio/pcm
    const pcm = new Uint8Array(4096) // 1024 Float32 samples
    for (let i = 0; i < pcm.length; i++) pcm[i] = i % 256

    const buf = buildOSCMessage('/luxsync/audio/pcm', [{ type: 'b', value: pcm }])
    const result = parseOSCMessage(buf)

    const parsed = (result!.args[0] as { type: 'b'; value: Uint8Array }).value
    expect(parsed.length).toBe(4096)
    expect(parsed[0]).toBe(0)
    expect(parsed[255]).toBe(255)
    expect(parsed[256]).toBe(0) // wraps around mod 256
  })
})

// ============================================
// buildOSCMessage -- standalone structure validation
// ============================================

describe('buildOSCMessage -- output structure', () => {
  it('output starts with "/" (0x2f)', () => {
    const buf = buildOSCMessage('/test', [])
    expect(buf[0]).toBe(0x2f)
  })

  it('output length is a multiple of 4 (OSC alignment)', () => {
    for (const addr of ['/a', '/ab', '/abc', '/abcd', '/abcde']) {
      const buf = buildOSCMessage(addr, [])
      expect(buf.length % 4).toBe(0)
    }
  })

  it('type tag section starts with "," (0x2c)', () => {
    const buf = buildOSCMessage('/x', [{ type: 'f', value: 0 }])
    // Address is 4 bytes ("/x\0\0"), type tag starts at offset 4
    const typeTagStart = 4
    expect(buf[typeTagStart]).toBe(0x2c) // ','
  })

  it('empty args produces a "," type tag that is just ","', () => {
    const buf = buildOSCMessage('/empty', [])
    // Address: "/empty\0\0" = 8 bytes, type tag: ",\0\0\0" = 4 bytes
    const addrLen = 8 // alignTo4("/empty\0") = 8
    expect(buf[addrLen]).toBe(0x2c)
    expect(buf[addrLen + 1]).toBe(0x00) // null terminator after ','
  })
})
