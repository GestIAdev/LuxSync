/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.4 — Liquid Telemetry Bridge & Black Box
 *
 * Caja Negra — Ring buffer pre-asignado de 2700 frames (~60s @ 44Hz).
 * Zero-allocation en hot path. Dump a JSONL para análisis offline (Monte Carlo).
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §12
 */

import type { LiquidVerdict } from './LiquidCognitionCore'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════

/** Tamaño del ring buffer — 2700 frames ≈ 60s @ 44Hz */
const BUFFER_SIZE = 2700

// ═══════════════════════════════════════════════════════════════════════════
// Estructura de un frame grabado — todos primitivos, sin referencias a objetos
// ═══════════════════════════════════════════════════════════════════════════

interface TelemetryFrame {
  timestamp: number
  ignite: boolean
  confidence: number
  squelch: number
  intensity: number
  epicness: number
  // Ψ(t)
  tension: number
  viscosity: number
  vaporPressure: number
  excitability: number
  temperature: number
  impact: number
  crestFactor: number
  // 7 sensores
  s_DNA: number
  s_Z: number
  s_E: number
  s_V: number
  s_X: number
  s_P: number
  s_B: number
  // 🥁 WAVE 8008: Rhythmic percussion isolated energies
  snare_energy: number
  hh_energy: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Recorder — ring buffer zero-alloc
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidTelemetryRecorder {
  // Ring buffer pre-asignado — Float64Array para máxima eficiencia de cache
  private readonly _timestamps: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _ignite: Uint8Array = new Uint8Array(BUFFER_SIZE)
  private readonly _confidence: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _squelch: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _intensity: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _epicness: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _tension: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _viscosity: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _vaporPressure: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _excitability: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _temperature: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _impact: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _crestFactor: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_DNA: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_Z: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_E: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_V: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_X: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_P: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _s_B: Float64Array = new Float64Array(BUFFER_SIZE)
  // WAVE 8008: Rhythmic percussion energies
  private readonly _snare_energy: Float64Array = new Float64Array(BUFFER_SIZE)
  private readonly _hh_energy: Float64Array = new Float64Array(BUFFER_SIZE)

  private _head: number = 0
  private _count: number = 0
  private _totalRecorded: number = 0

  /**
   * Graba un frame del LiquidVerdict en el ring buffer.
   * Hot path 44Hz — zero-alloc, solo escritura de primitivos en arrays tipados.
   */
  recordFrame(verdict: LiquidVerdict, now: number, snareEnergy?: number, hhEnergy?: number): void {
    const idx = this._head

    this._timestamps[idx] = now
    this._ignite[idx] = verdict.ignite ? 1 : 0
    this._confidence[idx] = verdict.confidence
    this._squelch[idx] = verdict.squelch
    this._intensity[idx] = verdict.intensity
    this._epicness[idx] = verdict.epicness
    this._tension[idx] = verdict.fluid.tension
    this._viscosity[idx] = verdict.fluid.viscosity
    this._vaporPressure[idx] = verdict.fluid.vaporPressure
    this._excitability[idx] = verdict.fluid.excitability
    this._temperature[idx] = verdict.fluid.temperature
    this._impact[idx] = verdict.fluid.impact
    this._crestFactor[idx] = verdict.fluid.crestFactor
    this._s_DNA[idx] = verdict.sensors.s_DNA
    this._s_Z[idx] = verdict.sensors.s_Z
    this._s_E[idx] = verdict.sensors.s_E
    this._s_V[idx] = verdict.sensors.s_V
    this._s_X[idx] = verdict.sensors.s_X
    this._s_P[idx] = verdict.sensors.s_P
    this._s_B[idx] = verdict.sensors.s_B
    this._snare_energy[idx] = snareEnergy ?? 0
    this._hh_energy[idx] = hhEnergy ?? 0

    // Avanzar cabeza del ring buffer
    this._head = (this._head + 1) % BUFFER_SIZE
    if (this._count < BUFFER_SIZE) this._count++
    this._totalRecorded++
  }

  /**
   * Número de frames válidos en el buffer.
   */
  get frameCount(): number {
    return this._count
  }

  /**
   * Total de frames grabados desde el inicio (incluye los sobrescritos).
   */
  get totalRecorded(): number {
    return this._totalRecorded
  }

  /**
   * Extrae el historial ordenado cronológicamente del ring buffer.
   * Construye un array de TelemetryFrame — solo llamar desde dumpToFile (no hot path).
   */
  private _extractFrames(): TelemetryFrame[] {
    const frames: TelemetryFrame[] = new Array(this._count)

    // El índice de inicio depende de si el buffer ya dio la vuelta
    const startIdx = this._count < BUFFER_SIZE
      ? 0
      : this._head  // _head apunta al slot más antiguo cuando está lleno

    for (let i = 0; i < this._count; i++) {
      const idx = (startIdx + i) % BUFFER_SIZE
      frames[i] = {
        timestamp: this._timestamps[idx],
        ignite: this._ignite[idx] === 1,
        confidence: this._confidence[idx],
        squelch: this._squelch[idx],
        intensity: this._intensity[idx],
        epicness: this._epicness[idx],
        tension: this._tension[idx],
        viscosity: this._viscosity[idx],
        vaporPressure: this._vaporPressure[idx],
        excitability: this._excitability[idx],
        temperature: this._temperature[idx],
        impact: this._impact[idx],
        crestFactor: this._crestFactor[idx],
        s_DNA: this._s_DNA[idx],
        s_Z: this._s_Z[idx],
        s_E: this._s_E[idx],
        s_V: this._s_V[idx],
        s_X: this._s_X[idx],
        s_P: this._s_P[idx],
        s_B: this._s_B[idx],
        snare_energy: this._snare_energy[idx],
        hh_energy: this._hh_energy[idx],
      }
    }

    return frames
  }

  /**
   * Dump del buffer a archivo JSONL en disco.
   * Limpia el buffer después del dump exitoso.
   *
   * @returns Ruta del archivo escrito, o null si no hay datos
   */
  async dumpToFile(): Promise<string | null> {
    if (this._count === 0) return null

    const frames = this._extractFrames()

    // Construir ruta: <userData>/LuxSync_Telemetry/liquid_<timestamp>.jsonl
    const userDataPath = app.getPath('userData')
    const outDir = path.join(userDataPath, 'LuxSync_Telemetry')
    const fileName = `liquid_${Date.now()}.jsonl`
    const filePath = path.join(outDir, fileName)

    // Asegurar que el directorio existe
    fs.mkdirSync(outDir, { recursive: true })

    // Escribir como JSONL (un objeto JSON por línea)
    const lines = frames.map(f => JSON.stringify(f))
    const content = lines.join('\n') + '\n'

    fs.writeFileSync(filePath, content, 'utf-8')

    // Log prominente con la ruta absoluta exacta
    console.log(`\n╔══════════════════════════════════════════════════════════╗
║  🌊 LIQUID TELEMETRY DUMP — ${frames.length} frames written
║  📂 ${filePath}
╚══════════════════════════════════════════════════════════╝\n`)

    // Limpiar buffer después del dump
    this._head = 0
    this._count = 0

    return filePath
  }

  /**
   * Snapshot del último frame grabado (para telemetría en tiempo real).
   * Zero-alloc — devuelve primitivos empaquetados en un objeto pre-asignado.
   */
  private readonly _lastFrameSnapshot: TelemetryFrame = {
    timestamp: 0, ignite: false, confidence: 0, squelch: 0, intensity: 0,
    epicness: 0, tension: 0, viscosity: 0, vaporPressure: 0, excitability: 0,
    temperature: 0, impact: 0, crestFactor: 0,
    s_DNA: 0, s_Z: 0, s_E: 0, s_V: 0, s_X: 0, s_P: 0, s_B: 0,
    snare_energy: 0, hh_energy: 0,
  }

  getLastFrame(): TelemetryFrame | null {
    if (this._count === 0) return null

    const idx = (this._head - 1 + BUFFER_SIZE) % BUFFER_SIZE
    const s = this._lastFrameSnapshot
    s.timestamp = this._timestamps[idx]
    s.ignite = this._ignite[idx] === 1
    s.confidence = this._confidence[idx]
    s.squelch = this._squelch[idx]
    s.intensity = this._intensity[idx]
    s.epicness = this._epicness[idx]
    s.tension = this._tension[idx]
    s.viscosity = this._viscosity[idx]
    s.vaporPressure = this._vaporPressure[idx]
    s.excitability = this._excitability[idx]
    s.temperature = this._temperature[idx]
    s.impact = this._impact[idx]
    s.crestFactor = this._crestFactor[idx]
    s.s_DNA = this._s_DNA[idx]
    s.s_Z = this._s_Z[idx]
    s.s_E = this._s_E[idx]
    s.s_V = this._s_V[idx]
    s.s_X = this._s_X[idx]
    s.s_P = this._s_P[idx]
    s.s_B = this._s_B[idx]
    s.snare_energy = this._snare_energy[idx]
    s.hh_energy = this._hh_energy[idx]

    return s
  }

  reset(): void {
    this._head = 0
    this._count = 0
    this._totalRecorded = 0
    // No need to zero-fill typed arrays — count tracking handles validity
  }
}
