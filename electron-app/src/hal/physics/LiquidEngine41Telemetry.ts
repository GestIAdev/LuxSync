/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2434: LATINO 4.1 TELEMETRY INJECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Inyecta un logger frame-a-frame (20fps) sobre LiquidEngine41 con
 * LATINO_PROFILE activo. La telemetría se emite por consola en formato
 * parseable para el script Monte Carlo de Wave 2434.
 *
 * ACTIVACIÓN: Desde SeleneLux.ts llama latinoEngine41Telemetry.setTelemetryEnabled(true).
 * El motor se autoinyecta en el switch bifurcado de WAVE 2432 cuando telemetry está activo.
 *
 * FORMATO DE LOG:
 *   [LATINO-41] sB:{subBass} mid:{mid} hMid:{highMid} tr:{treble} |
 *               morph:{morphFactor} tDelta:{trebleDelta} |
 *               fPar:{frontPar} bPar:{backPar} mL:{moverL} mR:{moverR} |
 *               sc:{sidechainFired} scDepth:{duckingApplied}
 *
 * @module hal/physics/LiquidEngine41Telemetry
 * @version WAVE 2434 — LATINO CALIBRATION
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { LATINO_PROFILE } from './profiles/latino'

// ═══════════════════════════════════════════════════════════════════════════
// LOG RECORD — Lo que se captura por frame
// ═══════════════════════════════════════════════════════════════════════════

export interface Latino41TelemetryRecord {
  // Inputs crudos
  subBass: number
  mid: number
  highMid: number
  treble: number
  // Estado del motor
  morphFactor: number
  trebleDelta: number   // señal entregada al transient shaper ANTES de ×4
  percRaw: number       // rawRight = trebleDelta × 4 (input del envSnare)
  // Outputs 4.1 (post-routeZones, post-sidechain)
  frontPar: number
  backPar: number
  moverL: number
  moverR: number
  // Flags
  sidechainFired: boolean
  duckingApplied: number  // 1.0 = sin ducking, <1.0 = atenuación real
  isBreakdown: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// TELEMETRY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidEngine41Telemetry extends LiquidEngineBase {

  private _telemetryEnabled = true
  private _frameCount = 0
  private _lastTrebleForDelta = 0

  // Buffer circular para análisis posterior sin escribir a disco en hot path
  // 600 frames = 30s de telemetría a 20fps
  private static readonly BUFFER_SIZE = 600
  private _buffer: Latino41TelemetryRecord[] = []
  private _bufferHead = 0

  constructor(profile: ILiquidProfile = LATINO_PROFILE) {
    super(profile, '4.1')
  }

  /** Activa o desactiva el logging. En producción: siempre false. */
  setTelemetryEnabled(enabled: boolean): void {
    this._telemetryEnabled = enabled
    if (!enabled) this._frameCount = 0
  }

  /** Devuelve si la telemetría está activa — usado por SeleneLux para el switch bifurcado. */
  isTelemetryEnabled(): boolean {
    return this._telemetryEnabled
  }

  /** Devuelve el buffer circular completo para análisis (sin alloc extra). */
  getBuffer(): readonly Latino41TelemetryRecord[] {
    return this._buffer
  }

  /** Limpia el buffer y resetea contadores. */
  flushBuffer(): void {
    this._buffer = []
    this._bufferHead = 0
    this._frameCount = 0
  }

  /**
   * Vuelca el buffer circular completo a disco en formato [LATINO-41].
   * Crea el archivo si no existe, lo SOBREESCRIBE si ya existe (sesión nueva).
   * Llámalo desde IPC, DevTools console, o un botón en la UI de debug.
   *
   * @param outputPath  Ruta absoluta o relativa al cwd del proceso main.
   *                    Por defecto: <repo>/docs/logs/latinocalib41.md
   * @returns Número de frames escritos.
   */
  exportToFile(outputPath?: string): number {
    // process.cwd() en dev = electron-app/, en prod = resources/app/
    // La ruta relativa es suficiente para sesiones de calibración en dev.
    const resolvedPath = outputPath ??
      join(process.cwd(), '..', 'docs', 'logs', 'latinocalib41.md')

    // Garantizar que el directorio existe
    const dir = dirname(resolvedPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Construir el contenido completo en memoria (el buffer ya tiene todos los frames)
    const lines: string[] = [
      `# LATINO-41 TELEMETRY — ${new Date().toISOString()}`,
      `# Frames capturados: ${this._buffer.length}`,
      `# Formato: [LATINO-41] sB mid hMid tr | morph tDelta percRaw | fPar bPar mL mR | sc scDuck`,
      '',
    ]

    for (const r of this._buffer) {
      lines.push(
        `[LATINO-41]` +
        ` sB:${r.subBass.toFixed(3)}` +
        ` mid:${r.mid.toFixed(3)}` +
        ` hMid:${r.highMid.toFixed(3)}` +
        ` tr:${r.treble.toFixed(3)}` +
        ` | morph:${r.morphFactor.toFixed(3)}` +
        ` tDelta:${r.trebleDelta.toFixed(4)}` +
        ` percRaw:${r.percRaw.toFixed(3)}` +
        ` | fPar:${r.frontPar.toFixed(3)}` +
        ` bPar:${r.backPar.toFixed(3)}` +
        ` mL:${r.moverL.toFixed(3)}` +
        ` mR:${r.moverR.toFixed(3)}` +
        ` | sc:${r.sidechainFired ? 1 : 0}` +
        ` scDuck:${r.duckingApplied.toFixed(3)}`
      )
    }

    writeFileSync(resolvedPath, lines.join('\n'), 'utf-8')
    console.log(`[LATINO-41 TELEMETRY] ${this._buffer.length} frames exportados → ${resolvedPath}`)
    return this._buffer.length
  }

  protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
    const {
      frontLeft, frontRight,
      backLeft, backRight,
      moverLeft, moverRight,
      strobeActive, strobeIntensity,
      acidMode, noiseMode,
      bands,
      morphFactor,
      isBreakdown,
    } = frame

    // ── 4.1 COMPACTION ──────────────────────────────────────────────
    const frontPar = Math.max(frontLeft, frontRight)
    const backPar  = Math.max(backLeft,  backRight)

    // ── SIDECHAIN DETECTION (replicar lógica del Base para telemetría) ──
    const p = this.profile
    const frontMax = frontPar   // en 4.1, frontPar === frontMax
    const sidechainFired = frontMax > p.sidechainThreshold
    const duckingApplied = sidechainFired
      ? 1.0 - frontMax * p.sidechainDepth
      : 1.0

    // moverL y moverR ya vienen post-sidechain de la base, pero recalculamos
    // el flag para telemetría precisa
    const mL = moverLeft
    const mR = moverRight

    // ── TRANSIENT DELTA (para telemetría — la base ya lo calculó internamente) ──
    const currentTreble = bands.treble
    const trebleDelta = Math.max(0, currentTreble - this._lastTrebleForDelta)
    this._lastTrebleForDelta = currentTreble
    const percRaw = trebleDelta * 4.0

    // ── TELEMETRY RECORD ─────────────────────────────────────────────
    if (this._telemetryEnabled) {
      const record: Latino41TelemetryRecord = {
        subBass:        bands.subBass,
        mid:            bands.mid,
        highMid:        bands.highMid,
        treble:         bands.treble,
        morphFactor,
        trebleDelta,
        percRaw,
        frontPar,
        backPar,
        moverL:         mL,
        moverR:         mR,
        sidechainFired,
        duckingApplied,
        isBreakdown,
      }

      // Escribir en buffer circular (zero-alloc en steady state)
      if (this._buffer.length < LiquidEngine41Telemetry.BUFFER_SIZE) {
        this._buffer.push(record)
      } else {
        this._buffer[this._bufferHead] = record
        this._bufferHead = (this._bufferHead + 1) % LiquidEngine41Telemetry.BUFFER_SIZE
      }

      // Log a consola en formato parseable por wave2434-latino-montecarlo.ts
      console.log(
        `[LATINO-41]` +
        ` sB:${bands.subBass.toFixed(3)}` +
        ` mid:${bands.mid.toFixed(3)}` +
        ` hMid:${bands.highMid.toFixed(3)}` +
        ` tr:${bands.treble.toFixed(3)}` +
        ` | morph:${morphFactor.toFixed(3)}` +
        ` tDelta:${trebleDelta.toFixed(4)}` +
        ` percRaw:${percRaw.toFixed(3)}` +
        ` | fPar:${frontPar.toFixed(3)}` +
        ` bPar:${backPar.toFixed(3)}` +
        ` mL:${mL.toFixed(3)}` +
        ` mR:${mR.toFixed(3)}` +
        ` | sc:${sidechainFired ? 1 : 0}` +
        ` scDuck:${duckingApplied.toFixed(3)}`
      )

      this._frameCount++
    }

    return {
      frontLeftIntensity:  frontPar,
      frontRightIntensity: frontPar,
      backLeftIntensity:   backPar,
      backRightIntensity:  backPar,
      moverLeftIntensity:  mL,
      moverRightIntensity: mR,
      strobeActive,
      strobeIntensity,
      // Legacy compat
      frontParIntensity: frontPar,
      backParIntensity:  backPar,
      moverIntensityL:   mL,
      moverIntensityR:   mR,
      moverIntensity:    Math.max(mL, mR),
      moverActive:       mL > 0.1 || mR > 0.1,
      physicsApplied:    'liquid-stereo',
      acidMode,
      noiseMode,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Conectado a SeleneLux.ts. Activar con setTelemetryEnabled(true).
// Volcar datos con exportToFile() cuando hayas capturado suficiente material.
// ═══════════════════════════════════════════════════════════════════════════
export const latinoEngine41Telemetry = new LiquidEngine41Telemetry()

// ── WAVE 2434: IPC bridge expuesto en preload.ts → window.luxDebug.telemetry ──
// Llamar desde DevTools del renderer:
//   await window.luxDebug.telemetry.export()   → vuelca docs/logs/latinocalib41.md
//   await window.luxDebug.telemetry.stop()     → detiene captura
//   await window.luxDebug.telemetry.flush()    → limpia el buffer
// Las IPC channels son: 'telemetry:lt41:export', 'telemetry:lt41:stop', 'telemetry:lt41:flush'
