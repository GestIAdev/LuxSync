/**
 * 🏎️ WAVE 1013 / WAVE 2091 / WAVE 2307: AUDIO RING BUFFER
 *
 * Encapsula la lógica de acumulación de samples de audio en el Worker BETA.
 * Desacoplado de senses.ts para ser reutilizable y testeable de forma aislada.
 *
 * Responsbilidades:
 *   - Escritura circular de samples entrantes en un buffer de 4096 posiciones
 *   - Linearización zero-alloc del snapshot para FFT (WAVE 2091)
 *   - Reloj determinístico de samples acumulados (WAVE 2307)
 *   - Flush completo del estado interno en reset/hot-swap (WAVE 3432)
 *
 * Worker-agnostic: cero dependencias de parentPort, workerData o IPC.
 */

// ============================================
// CONSTANTES
// ============================================

/** Tamaño del ring buffer. Debe coincidir con el tamaño de FFT de GodEarFFT. */
const RING_SIZE = 4096;

// ============================================
// INTERFACES PÚBLICAS
// ============================================

/**
 * Resultado de writeAndSnapshot():
 *   - `ready`:    true cuando el buffer ya acumuló >= RING_SIZE samples y el
 *                 snapshot es válido para FFT.
 *   - `snapshot`: vista directa al buffer interno linearizado (ZERO-ALLOC).
 *                 Solo válido cuando ready === true.
 *   - `deterministicTimestampMs`: reloj monótono basado en samples acumulados.
 *                 Siempre crece; nunca retrocede. (WAVE 2307)
 */
export interface WriteResult {
  readonly ready: boolean;
  readonly snapshot: Float32Array;
  readonly deterministicTimestampMs: number;
}

// ============================================
// AUDIO RING BUFFER
// ============================================

/**
 * Buffer circular de audio de 4096 samples para el Worker BETA.
 *
 * Uso:
 * ```ts
 * const ringBuffer = new AudioRingBuffer(44100);
 * const result = ringBuffer.writeAndSnapshot(incomingBuffer);
 * if (result.ready) {
 *   const spectrum = spectrumAnalyzer.analyze(result.snapshot, sampleRate);
 * }
 * ```
 */
export class AudioRingBuffer {
  // 🏎️ WAVE 1013: Ring buffer circular
  private readonly _ring: Float32Array = new Float32Array(RING_SIZE);
  private _writeIndex: number = 0;
  private _filled: boolean = false;

  // 🏎️ WAVE 2091: ZERO-ALLOC SNAPSHOT — reutilizado cada frame
  private readonly _snapshot: Float32Array = new Float32Array(RING_SIZE);

  // ⏱️ WAVE 2307: Acumulador de samples — never decrements, never wraps
  private _totalSamplesProcessed: number = 0;

  private readonly _sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this._sampleRate = sampleRate;
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  /**
   * Escribe los samples entrantes en el ring, lineariza el snapshot y
   * devuelve el resultado.
   *
   * WAVE 1013 / WAVE 2091 / WAVE 2307: Hot path — sin allocations.
   */
  writeAndSnapshot(incoming: Float32Array): WriteResult {
    const incomingLength = incoming.length;

    // ⏱️ WAVE 2307: Acumulación monótona de samples
    this._totalSamplesProcessed += incomingLength;

    // === Escritura circular ===
    for (let i = 0; i < incomingLength; i++) {
      this._ring[this._writeIndex] = incoming[i];
      this._writeIndex = (this._writeIndex + 1) % RING_SIZE;
    }

    // Marcar como lleno cuando se hayan acumulado suficientes samples reales
    if (!this._filled && this._totalSamplesProcessed >= RING_SIZE) {
      this._filled = true;
    }

    const deterministicTimestampMs = (this._totalSamplesProcessed / this._sampleRate) * 1000;

    if (!this._filled) {
      return {
        ready: false,
        snapshot: this._snapshot,
        deterministicTimestampMs,
      };
    }

    // 🏎️ WAVE 2091: Linearización zero-alloc del snapshot (oldest → newest)
    for (let i = 0; i < RING_SIZE; i++) {
      const readIndex = (this._writeIndex + i) % RING_SIZE;
      this._snapshot[i] = this._ring[readIndex];
    }

    return {
      ready: true,
      snapshot: this._snapshot,
      deterministicTimestampMs,
    };
  }

  /**
   * WAVE 3432: Flush completo del estado interno.
   * Llamar en RESET_PACEMAKER / hot-swap de fuente de audio.
   */
  flush(): void {
    this._ring.fill(0);
    this._snapshot.fill(0);
    this._writeIndex = 0;
    this._filled = false;
    this._totalSamplesProcessed = 0;
  }

  /**
   * Reloj monótono en milisegundos basado en samples acumulados.
   * Coincide con el campo `deterministicTimestampMs` de WriteResult.
   */
  get deterministicTimestampMs(): number {
    return (this._totalSamplesProcessed / this._sampleRate) * 1000;
  }

  /** Total de samples escritos desde el último flush(). */
  get totalSamplesProcessed(): number {
    return this._totalSamplesProcessed;
  }

  /** true si el buffer ya ha acumulado suficientes samples para un primer snapshot FFT. */
  get isFilled(): boolean {
    return this._filled;
  }
}
