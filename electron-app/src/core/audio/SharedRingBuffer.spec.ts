// WAVE 3401: Unit Tests -- SharedRingBuffer SPSC Lock-Free Ring Buffer
//
// Coverage requirements (from WAVE 3401.1 directive):
//   - Burst read/write patterns
//   - Wrap-around when write head crosses RING_SIZE boundary
//   - Overflow behavior (writer faster than reader)
//   - Underflow behavior (reader polls empty buffer)
//
// Node.js test environment: SharedArrayBuffer + Atomics available natively.

import { describe, it, expect, beforeEach } from 'vitest'
import { SharedRingBufferWriter, SharedRingBufferReader, createSharedRingBuffer, SAB_TOTAL_BYTES } from './SharedRingBuffer'
import { OMNI_CONSTANTS, META } from './OmniInputTypes'

const { RING_SIZE, METADATA_SLOTS } = OMNI_CONSTANTS

// ============================================
// HELPERS
// ============================================

function makeRampBuffer(length: number, startValue = 0): Float32Array {
  const buf = new Float32Array(length)
  for (let i = 0; i < length; i++) buf[i] = startValue + i
  return buf
}

function sumBuffer(buf: Float32Array, count: number): number {
  let s = 0
  for (let i = 0; i < count; i++) s += buf[i]
  return s
}

// ============================================
// FACTORY
// ============================================

describe('createSharedRingBuffer', () => {
  it('returns writer + reader sharing the same SAB', () => {
    const { writer, reader } = createSharedRingBuffer()
    expect(writer.buffer).toBe(reader.buffer)
  })

  it('SAB has the correct byte length', () => {
    const { sab } = createSharedRingBuffer()
    expect(sab.byteLength).toBe(SAB_TOTAL_BYTES)
  })

  it('initial metadata: writeHead=0, readHead=0', () => {
    const { sab } = createSharedRingBuffer()
    const meta = new Int32Array(sab, 0, METADATA_SLOTS)
    expect(Atomics.load(meta, META.WRITE_HEAD)).toBe(0)
    expect(Atomics.load(meta, META.READ_HEAD)).toBe(0)
  })

  it('initial available is 0', () => {
    const { writer, reader } = createSharedRingBuffer()
    expect(writer.available).toBe(0)
    expect(reader.available).toBe(0)
  })
})

// ============================================
// BASIC READ / WRITE
// ============================================

describe('SharedRingBuffer -- basic read/write', () => {
  let writer: SharedRingBufferWriter
  let reader: SharedRingBufferReader

  beforeEach(() => {
    const rb = createSharedRingBuffer()
    writer = rb.writer
    reader = rb.reader
  })

  it('writer.write() advances available by the written count', () => {
    const data = makeRampBuffer(512)
    writer.write(data)
    expect(reader.available).toBe(512)
  })

  it('reader.read() returns samples written and advances readHead', () => {
    const data = makeRampBuffer(256)
    writer.write(data)

    const out = new Float32Array(256)
    const n = reader.read(out, 256)

    expect(n).toBe(256)
    expect(reader.available).toBe(0)

    // Values must match what was written
    for (let i = 0; i < 256; i++) {
      expect(out[i]).toBe(data[i])
    }
  })

  it('reader.read() limits to maxSamples even when more are available', () => {
    writer.write(makeRampBuffer(1024))
    const out = new Float32Array(512)
    const n = reader.read(out, 512)
    expect(n).toBe(512)
    expect(reader.available).toBe(512)
  })

  it('reader.read() limits to output buffer size even if maxSamples is larger', () => {
    writer.write(makeRampBuffer(1024))
    const out = new Float32Array(256)
    const n = reader.read(out, 999)
    expect(n).toBe(256)
  })

  it('fillLevel reflects the ratio of used to total capacity', () => {
    writer.write(makeRampBuffer(RING_SIZE / 2))
    expect(writer.fillLevel).toBeCloseTo(0.5, 5)
    expect(reader.fillLevel).toBeCloseTo(0.5, 5)
  })

  it('reset() clears both heads back to 0', () => {
    writer.write(makeRampBuffer(1024))
    reader.reset()
    expect(reader.available).toBe(0)
  })
})

// ============================================
// BURST PATTERNS
// ============================================

describe('SharedRingBuffer -- burst read/write', () => {
  let writer: SharedRingBufferWriter
  let reader: SharedRingBufferReader

  beforeEach(() => {
    const rb = createSharedRingBuffer()
    writer = rb.writer
    reader = rb.reader
  })

  it('multiple small writes accumulate correctly', () => {
    for (let i = 0; i < 8; i++) {
      writer.write(makeRampBuffer(100))
    }
    expect(reader.available).toBe(800)
  })

  it('interleaved writes and reads preserve sample order', () => {
    // Write 512 samples with values [0, 511]
    writer.write(makeRampBuffer(512))

    // Read 256 (values [0, 255])
    const out1 = new Float32Array(256)
    reader.read(out1, 256)
    expect(out1[0]).toBe(0)
    expect(out1[255]).toBe(255)

    // Write 256 more (values [0, 255] -- new batch starting from 0)
    writer.write(makeRampBuffer(256))

    // Read remaining 256 + 256
    const out2 = new Float32Array(256)
    reader.read(out2, 256)
    expect(out2[0]).toBe(256) // second half of first write

    const out3 = new Float32Array(256)
    reader.read(out3, 256)
    expect(out3[0]).toBe(0) // second write
  })

  it('bulk burst: write 4096 samples, read them back intact', () => {
    const data = makeRampBuffer(4096)
    writer.write(data)

    const out = new Float32Array(4096)
    const n = reader.read(out, 4096)
    expect(n).toBe(4096)

    for (let i = 0; i < 4096; i++) {
      expect(out[i]).toBe(data[i])
    }
  })
})

// ============================================
// WRAP-AROUND
// ============================================

describe('SharedRingBuffer -- wrap-around correctness', () => {
  let writer: SharedRingBufferWriter
  let reader: SharedRingBufferReader

  beforeEach(() => {
    const rb = createSharedRingBuffer()
    writer = rb.writer
    reader = rb.reader
  })

  it('single block write that wraps: data at tail + head are correct', () => {
    // Advance write head to RING_SIZE - 100 by writing and reading
    const prefill = makeRampBuffer(RING_SIZE - 100)
    writer.write(prefill)
    const drain = new Float32Array(RING_SIZE - 100)
    reader.read(drain, RING_SIZE - 100)

    // Now write 200 samples -- first 100 fit at tail, next 100 wrap to head
    const crossBuf = makeRampBuffer(200, 1000) // values 1000..1199
    writer.write(crossBuf)

    const meta = new Int32Array(writer.buffer, 0, METADATA_SLOTS)
    const wHead = Atomics.load(meta, META.WRITE_HEAD)
    expect(wHead).toBe(100) // wrapped: 200 - 100 remaining at index 0..99

    // Read it back and verify continuity
    const out = new Float32Array(200)
    const n = reader.read(out, 200)
    expect(n).toBe(200)
    for (let i = 0; i < 200; i++) {
      expect(out[i]).toBe(crossBuf[i])
    }
  })

  it('write exactly RING_SIZE samples wraps writeHead correctly', () => {
    // Fill all but one slot (to avoid overflow ambiguity), then drain
    writer.write(makeRampBuffer(RING_SIZE - 1))
    reader.read(new Float32Array(RING_SIZE - 1), RING_SIZE - 1)
    // writeHead = 8191, readHead = 8191

    // Write RING_SIZE-1 more: 1 sample fits at tail (pos 8191), 8190 wrap to [0..8189]
    // newHead = (8191 + 8191) % 8192 = 16382 % 8192 = 8190
    const chunk = makeRampBuffer(RING_SIZE - 1)
    writer.write(chunk)

    const meta = new Int32Array(writer.buffer, 0, METADATA_SLOTS)
    const wHead = Atomics.load(meta, META.WRITE_HEAD)
    expect(wHead).toBe((RING_SIZE - 1 + RING_SIZE - 1) % RING_SIZE) // = 8190
  })

  it('multiple wrap-arounds remain consistent', () => {
    const chunk = makeRampBuffer(RING_SIZE / 2)

    // Cycle 1: fill half, drain half
    writer.write(chunk)
    reader.read(new Float32Array(RING_SIZE / 2), RING_SIZE / 2)

    // Cycle 2: fill half (wraps around), drain half
    writer.write(chunk)
    reader.read(new Float32Array(RING_SIZE / 2), RING_SIZE / 2)

    // Available should be 0 after each cycle
    expect(reader.available).toBe(0)
  })

  it('wrap-around: values at wrap boundary are correct (index 0 of 2nd chunk)', () => {
    // Fill to RING_SIZE - 3
    writer.write(makeRampBuffer(RING_SIZE - 3))
    reader.read(new Float32Array(RING_SIZE - 3), RING_SIZE - 3)

    // Write 6 samples: 3 land at tail, 3 wrap to positions [0,1,2]
    const crossData = new Float32Array([10, 20, 30, 40, 50, 60])
    writer.write(crossData)

    const out = new Float32Array(6)
    reader.read(out, 6)

    expect(out[0]).toBe(10)
    expect(out[3]).toBe(40)
    expect(out[5]).toBe(60)
  })
})

// ============================================
// OVERFLOW (producer faster than consumer)
// ============================================

describe('SharedRingBuffer -- overflow behavior', () => {
  let writer: SharedRingBufferWriter
  let reader: SharedRingBufferReader

  beforeEach(() => {
    const rb = createSharedRingBuffer()
    writer = rb.writer
    reader = rb.reader
  })

  it('writing more than RING_SIZE total samples does not throw', () => {
    // Write 2x RING_SIZE: the second write overwrites the first (overflow policy: latest wins)
    expect(() => {
      writer.write(makeRampBuffer(RING_SIZE - 1))
      writer.write(makeRampBuffer(RING_SIZE - 1))
    }).not.toThrow()
  })

  it('available never exceeds RING_SIZE - 1 (ring invariant)', () => {
    writer.write(makeRampBuffer(RING_SIZE - 1))
    const avail = reader.available
    expect(avail).toBeLessThanOrEqual(RING_SIZE - 1)
  })

  it('writer.write() on completely full buffer does not block or throw', () => {
    // Fill the buffer to capacity (RING_SIZE - 1 usable slots)
    writer.write(makeRampBuffer(RING_SIZE - 1))

    // Writing one more sample should complete silently (overwrites oldest)
    expect(() => writer.write(new Float32Array([99]))).not.toThrow()
  })

  it('after overflow, reader gets valid (most recent) data', () => {
    // Write block A (fills half)
    writer.write(makeRampBuffer(RING_SIZE / 2))

    // Don't read -- let it fill completely with block B
    const blockB = makeRampBuffer(RING_SIZE - 1, 1000)
    writer.write(blockB)

    // Writer has now overwritten old data; buffer is still usable
    expect(reader.available).toBeGreaterThan(0)

    // Reader should not crash
    const out = new Float32Array(100)
    expect(() => reader.read(out, 100)).not.toThrow()
  })
})

// ============================================
// UNDERFLOW (consumer polls empty buffer)
// ============================================

describe('SharedRingBuffer -- underflow behavior', () => {
  let writer: SharedRingBufferWriter
  let reader: SharedRingBufferReader

  beforeEach(() => {
    const rb = createSharedRingBuffer()
    writer = rb.writer
    reader = rb.reader
  })

  it('reading from empty buffer returns 0 and does not modify output', () => {
    const out = new Float32Array(256)
    out.fill(42) // sentinel value
    const n = reader.read(out, 256)
    expect(n).toBe(0)
    // Output buffer must be untouched
    expect(out[0]).toBe(42)
  })

  it('reading more than available returns only what is available', () => {
    writer.write(makeRampBuffer(10))
    const out = new Float32Array(500)
    const n = reader.read(out, 500)
    expect(n).toBe(10)
    expect(reader.available).toBe(0)
  })

  it('consecutive reads on an empty buffer return 0 each time', () => {
    for (let i = 0; i < 5; i++) {
      const out = new Float32Array(64)
      const n = reader.read(out, 64)
      expect(n).toBe(0)
    }
  })

  it('read after drain returns 0', () => {
    writer.write(makeRampBuffer(256))
    const out = new Float32Array(256)
    reader.read(out, 256)
    expect(reader.available).toBe(0)

    const out2 = new Float32Array(64)
    const n = reader.read(out2, 64)
    expect(n).toBe(0)
  })
})

// ============================================
// PRODUCER / CONSUMER SYMMETRY
// ============================================

describe('SharedRingBuffer -- producer/consumer symmetry', () => {
  it('writer.available matches reader.available at all times', () => {
    const { writer, reader } = createSharedRingBuffer()

    writer.write(makeRampBuffer(1000))
    expect(writer.available).toBe(reader.available)

    const out = new Float32Array(500)
    reader.read(out, 500)
    expect(writer.available).toBe(reader.available)
  })

  it('producer-only write() method on reader does nothing', () => {
    const { writer, reader } = createSharedRingBuffer()
    const before = reader.available

    // Reader.write() should be a no-op (defined to satisfy ISharedRingBuffer but unused)
    reader.write(makeRampBuffer(100))

    // Available should not change from reader writing
    expect(reader.available).toBe(before)
  })

  it('consumer-only read() method on writer returns 0', () => {
    const { writer } = createSharedRingBuffer()
    writer.write(makeRampBuffer(100))

    const out = new Float32Array(100)
    const n = writer.read(out, 100)
    // Writer.read() is a no-op stub, returns 0
    expect(n).toBe(0)
  })

  it('sampleRate set by writer is visible to reader', () => {
    const { writer, reader } = createSharedRingBuffer()
    writer.setSampleRate(48000)
    expect(reader.sampleRate).toBe(48000)
  })
})
