// WAVE 3401: SHARED RING BUFFER -- SPSC Lock-Free Audio Transport
//
// Single Producer, Single Consumer ring buffer backed by SharedArrayBuffer.
// Producer: AudioMatrix (main process) writes incoming PCM samples.
// Consumer: BETA Worker (senses.ts) reads snapshots for GodEarFFT.
//
// Memory layout:
//   [0..15]  Int32Array metadata: writeHead, readHead, sampleRate, channels
//   [16..32783] Float32Array audio data: 8192 samples circular
//
// Lock-free guarantees:
//   - Only producer calls write() and advances writeHead
//   - Only consumer calls read() and advances readHead
//   - Atomics.store/load provide cross-thread visibility (memory fences)
//   - No mutex, no spinlock, no contention
//
// Overflow: producer overwrites oldest data (consumer too slow = lost old samples)
// Underflow: consumer gets fewer samples than requested (returns actual count)

import { ISharedRingBuffer, OMNI_CONSTANTS, META } from './OmniInputTypes'

const { RING_SIZE, METADATA_SLOTS, DEFAULT_SAMPLE_RATE, DEFAULT_CHANNELS } = OMNI_CONSTANTS

// Total SAB size: 4 Int32 metadata (16 bytes) + 8192 Float32 data (32768 bytes)
const SAB_TOTAL_BYTES = METADATA_SLOTS * 4 + RING_SIZE * 4

// ============================================
// PRODUCER SIDE (Main Process / AudioMatrix)
// ============================================

export class SharedRingBufferWriter implements ISharedRingBuffer {
  readonly buffer: SharedArrayBuffer
  private readonly meta: Int32Array
  private readonly data: Float32Array

  constructor(sab?: SharedArrayBuffer) {
    if (sab) {
      this.buffer = sab
    } else {
      this.buffer = new SharedArrayBuffer(SAB_TOTAL_BYTES)
    }

    this.meta = new Int32Array(this.buffer, 0, METADATA_SLOTS)
    this.data = new Float32Array(this.buffer, METADATA_SLOTS * 4, RING_SIZE)

    // Initialize metadata only when creating a new SAB
    if (!sab) {
      Atomics.store(this.meta, META.WRITE_HEAD, 0)
      Atomics.store(this.meta, META.READ_HEAD, 0)
      Atomics.store(this.meta, META.SAMPLE_RATE, DEFAULT_SAMPLE_RATE)
      Atomics.store(this.meta, META.CHANNEL_COUNT, DEFAULT_CHANNELS)
    }
  }

  write(samples: Float32Array): void {
    const len = samples.length
    if (len === 0) return

    let head = Atomics.load(this.meta, META.WRITE_HEAD)

    // Write samples into circular buffer
    // Two-pass copy handles the wrap-around case without modulo per sample
    const firstChunk = Math.min(len, RING_SIZE - head)
    this.data.set(samples.subarray(0, firstChunk), head)

    if (firstChunk < len) {
      // Wrapped around -- copy remainder from index 0
      this.data.set(samples.subarray(firstChunk), 0)
    }

    // Advance write head atomically
    const newHead = (head + len) % RING_SIZE
    Atomics.store(this.meta, META.WRITE_HEAD, newHead)
  }

  read(_output: Float32Array, _maxSamples: number): number {
    // Producer side should not read. This exists only to satisfy ISharedRingBuffer.
    // Use SharedRingBufferReader in the consumer thread.
    return 0
  }

  get available(): number {
    const wHead = Atomics.load(this.meta, META.WRITE_HEAD)
    const rHead = Atomics.load(this.meta, META.READ_HEAD)
    return (wHead - rHead + RING_SIZE) % RING_SIZE
  }

  get fillLevel(): number {
    return this.available / RING_SIZE
  }

  reset(): void {
    Atomics.store(this.meta, META.WRITE_HEAD, 0)
    Atomics.store(this.meta, META.READ_HEAD, 0)
  }

  setSampleRate(rate: number): void {
    Atomics.store(this.meta, META.SAMPLE_RATE, rate)
  }
}

// ============================================
// CONSUMER SIDE (BETA Worker / senses.ts)
// ============================================

export class SharedRingBufferReader implements ISharedRingBuffer {
  readonly buffer: SharedArrayBuffer
  private readonly meta: Int32Array
  private readonly data: Float32Array

  constructor(sab: SharedArrayBuffer) {
    this.buffer = sab
    this.meta = new Int32Array(sab, 0, METADATA_SLOTS)
    this.data = new Float32Array(sab, METADATA_SLOTS * 4, RING_SIZE)
  }

  write(_samples: Float32Array): void {
    // Consumer side should not write. This exists only to satisfy ISharedRingBuffer.
  }

  read(output: Float32Array, maxSamples: number): number {
    const wHead = Atomics.load(this.meta, META.WRITE_HEAD)
    const rHead = Atomics.load(this.meta, META.READ_HEAD)

    const avail = (wHead - rHead + RING_SIZE) % RING_SIZE
    if (avail === 0) return 0

    const toRead = Math.min(avail, maxSamples, output.length)

    // Two-pass copy handles wrap-around
    const firstChunk = Math.min(toRead, RING_SIZE - rHead)
    output.set(this.data.subarray(rHead, rHead + firstChunk))

    if (firstChunk < toRead) {
      const secondChunk = toRead - firstChunk
      output.set(this.data.subarray(0, secondChunk), firstChunk)
    }

    // Advance read head atomically
    const newHead = (rHead + toRead) % RING_SIZE
    Atomics.store(this.meta, META.READ_HEAD, newHead)

    return toRead
  }

  get available(): number {
    const wHead = Atomics.load(this.meta, META.WRITE_HEAD)
    const rHead = Atomics.load(this.meta, META.READ_HEAD)
    return (wHead - rHead + RING_SIZE) % RING_SIZE
  }

  get fillLevel(): number {
    return this.available / RING_SIZE
  }

  get sampleRate(): number {
    return Atomics.load(this.meta, META.SAMPLE_RATE)
  }

  reset(): void {
    Atomics.store(this.meta, META.WRITE_HEAD, 0)
    Atomics.store(this.meta, META.READ_HEAD, 0)
  }
}

// ============================================
// FACTORY
// ============================================

export function createSharedRingBuffer(): {
  writer: SharedRingBufferWriter
  reader: SharedRingBufferReader
  sab: SharedArrayBuffer
} {
  const writer = new SharedRingBufferWriter()
  const reader = new SharedRingBufferReader(writer.buffer)
  return { writer, reader, sab: writer.buffer }
}

export { SAB_TOTAL_BYTES }
