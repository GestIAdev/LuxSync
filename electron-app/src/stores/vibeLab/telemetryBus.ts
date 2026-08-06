/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📡 telemetryBus.ts — CANAL B (TELEMETRÍA, ALTA FRECUENCIA)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bus de telemetría del Vibe Lab. Vive FUERA de React/Zustand para evitar
 * re-renders a 60 Hz. Los canvas del Mutation Scope leen el buffer directamente
 * en su rAF loop, sin `setState`.
 *
 * ── ARQUITECTURA DOUBLE-BUFFERED ───────────────────────────────────────────
 * Dos `Float32Array` de 27 slots:
 *   - `writeBuffer`: el motor escribe aquí cada tick (vía IPC).
 *   - `readBuffer`: los canvas leen aquí.
 *
 * Cada swap atómico (intercambio de referencias) ocurre al final del tick.
 * Esto garantiza que un canvas nunca lee un buffer a medio escribir.
 *
 * ── LOS 27 SLOTS ───────────────────────────────────────────────────────────
 * Índices fijos para que los canvas sepan exactamente dónde leer:
 *   0-6:   intensidad de las 7 zonas (Front L/R, Mover L/R, Back L/R, Ambient)
 *   7-11:  5 colores de la paleta (Primary, Secondary, Ambient, Accent, Strobe) — H
 *   12-16: 5 colores — S
 *   17-21: 5 colores — L
 *   22:    pan position (normalizada -1..1)
 *   23:    tilt position (normalizada -1..1)
 *   24:    morphFactor (0..1)
 *   25:    beat phase (0..1)
 *   26:    energy (0..1)
 *
 * @module stores/vibeLab/telemetryBus
 * @version FASE 1B — The Fusion Core
 */

/** Tamaño del buffer de telemetría. */
export const TELEMETRY_BUFFER_SIZE = 27 as const

/** Índices de los slots del buffer. */
export const TELEMETRY_INDICES = {
  // Zone intensities (7)
  zoneFrontL: 0,
  zoneFrontR: 1,
  zoneMoverL: 2,
  zoneMoverR: 3,
  zoneBackL: 4,
  zoneBackR: 5,
  zoneAmbient: 6,
  // Palette H (5)
  palettePrimaryH: 7,
  paletteSecondaryH: 8,
  paletteAmbientH: 9,
  paletteAccentH: 10,
  paletteStrobeH: 11,
  // Palette S (5)
  palettePrimaryS: 12,
  paletteSecondaryS: 13,
  paletteAmbientS: 14,
  paletteAccentS: 15,
  paletteStrobeS: 16,
  // Palette L (5)
  palettePrimaryL: 17,
  paletteSecondaryL: 18,
  paletteAmbientL: 19,
  paletteAccentL: 20,
  paletteStrobeL: 21,
  // Kinematics (5)
  panPosition: 22,
  tiltPosition: 23,
  morphFactor: 24,
  beatPhase: 25,
  energy: 26,
} as const

/** Listener del bus: se invoca tras cada swap con la referencia al readBuffer. */
export type TelemetryListener = (readBuffer: Float32Array) => void

// ═══════════════════════════════════════════════════════════════════════════
// BUS SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

class VibeLabTelemetryBus {
  private writeBuffer: Float32Array = new Float32Array(TELEMETRY_BUFFER_SIZE)
  private readBuffer: Float32Array = new Float32Array(TELEMETRY_BUFFER_SIZE)
  private listeners = new Set<TelemetryListener>()
  private swapped = false

  /**
   * Escribe un valor en el writeBuffer. Llamado desde el IPC handler del
   * motor a 44-60 Hz. NO dispara listeners (el swap lo hace al final).
   */
  write(index: number, value: number): void {
    if (index < 0 || index >= TELEMETRY_BUFFER_SIZE) return
    this.writeBuffer[index] = Number.isFinite(value) ? value : 0
  }

  /**
   * Escribe un lote de valores de una vez. Más eficiente que múltiples
   * `write` individuales.
   */
  writeBatch(values: Array<[number, number]>): void {
    for (const [index, value] of values) {
      if (index >= 0 && index < TELEMETRY_BUFFER_SIZE) {
        this.writeBuffer[index] = Number.isFinite(value) ? value : 0
      }
    }
  }

  /**
   * Intercambia writeBuffer y readBuffer atómicamente y notifica listeners.
   * Llamado una vez por tick del motor, después de todas las escrituras.
   */
  swap(): void {
    const temp = this.writeBuffer
    this.writeBuffer = this.readBuffer
    this.readBuffer = temp
    this.swapped = true
    for (const listener of this.listeners) {
      listener(this.readBuffer)
    }
  }

  /**
   * Lee el readBuffer actual. Usado por los canvas en su rAF loop.
   * Devuelve una referencia directa (no copia) — el caller NO debe mutar.
   */
  read(): Float32Array {
    return this.readBuffer
  }

  /**
   * Suscribe un listener que se invoca tras cada swap.
   * @returns función de desuscripción.
   */
  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Resetea ambos buffers a cero. Usado al cambiar de vibe o cerrar el lab.
   */
  reset(): void {
    this.writeBuffer.fill(0)
    this.readBuffer.fill(0)
    this.swapped = false
  }

  /** `true` si al menos un swap ha ocurrido desde el reset. */
  get hasData(): boolean {
    return this.swapped
  }
}

/** Singleton del bus de telemetría. */
export const vibeLabTelemetryBus = new VibeLabTelemetryBus()
