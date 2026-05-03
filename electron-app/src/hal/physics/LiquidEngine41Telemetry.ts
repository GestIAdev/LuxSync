/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2434: LATINO 4.1 TELEMETRY INJECTOR
 * WAVE 2457: ENVELOPE-DRIVEN MOVERS — El Galán + La Dama activos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Inyecta un logger frame-a-frame (20fps) sobre LiquidEngine41 con
 * LATINO_PROFILE activo. La telemetría se emite por consola en formato
 * parseable para el script Monte Carlo de Wave 2434.
 *
 * WAVE 2457: El motor ahora recibe moverLeft/moverRight calculados por el
 * sistema de envolventes parametrizado del LATINO_PROFILE (no WAVE 911):
 *   Mover L = El Galán: envTreble.process(highMid×0.80 + treble×0.20, morph)
 *               gate: 0.14 (override41), boost: 4.5 (override41)
 *               tonal gate: flatness < 0.60 (anti-autotune, override41)
 *   Mover R = La Dama: envVocal.process(mid - bass×subtractFactor - treble×0.10, morph)
 *               gate: 0.15, boost: 4.0
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
 * @version WAVE 2457 — EL GALAN + LA DAMA VIVOS
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { LATINO_PROFILE } from './profiles/latino'
import type { LiquidEnvelopeConfig } from './LiquidEnvelope'

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
  kickRaw: number       // señal cruda de kick antes del envKick
  kickDynGate: number
  kickSquelch: number
  kickPower: number
  kickGatePassed: boolean
  kickIgnited: boolean
  isKick: boolean
  isKickEdge: boolean
  snareInput: number
  snareDynGate: number
  snareSquelch: number
  snarePower: number
  snareGatePassed: boolean
  snareIgnited: boolean
  highMidInput: number
  highMidDynGate: number
  highMidSquelch: number
  highMidPower: number
  highMidGatePassed: boolean
  highMidIgnited: boolean
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

interface LiquidEnvelopeProbeState {
  avgSignal: number
  avgSignalPeak: number
  lastFireTime: number
  lastSignal: number
  wasAttacking: boolean
}

interface LiquidEnvelopeProbeResult {
  dynamicGate: number
  squelch: number
  kickPower: number
  gatePassed: boolean
  ignited: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// TELEMETRY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidEngine41Telemetry extends LiquidEngineBase {

  private _telemetryEnabled = false
  private _frameCount = 0
  private _lastTrebleForDelta = 0

  // Buffer circular para análisis posterior sin escribir a disco en hot path
  // 600 frames = 30s de telemetría a 20fps
  private static readonly BUFFER_SIZE = 600
  private _buffer: Latino41TelemetryRecord[] = []
  private _bufferHead = 0
  private _kickProbe: LiquidEnvelopeProbeState = LiquidEngine41Telemetry.freshProbeState()
  private _snareProbe: LiquidEnvelopeProbeState = LiquidEngine41Telemetry.freshProbeState()
  private _highMidProbe: LiquidEnvelopeProbeState = LiquidEngine41Telemetry.freshProbeState()

  constructor(profile: ILiquidProfile = LATINO_PROFILE) {
    super(profile, '4.1')
  }

  private static freshProbeState(): LiquidEnvelopeProbeState {
    return {
      avgSignal: 0,
      avgSignalPeak: 0,
      lastFireTime: 0,
      lastSignal: 0,
      wasAttacking: false,
    }
  }

  private evaluateEnvelopeProbe(
    signal: number,
    config: LiquidEnvelopeConfig,
    morphFactor: number,
    now: number,
    isBreakdown: boolean,
    state: LiquidEnvelopeProbeState,
  ): LiquidEnvelopeProbeResult {
    const velocity = signal - state.lastSignal
    state.lastSignal = signal

    const isRisingAttack = velocity >= -0.005
    const isGraceFrame = state.wasAttacking && velocity >= -0.03
    const isAttacking = isRisingAttack || isGraceFrame
    state.wasAttacking = isRisingAttack && velocity > 0.01

    if (signal > state.avgSignal) {
      state.avgSignal = state.avgSignal * 0.98 + signal * 0.02
    } else {
      state.avgSignal = state.avgSignal * 0.88 + signal * 0.12
    }

    const timeSinceLastFire = state.lastFireTime > 0 ? now - state.lastFireTime : 0
    const isDrySpell = timeSinceLastFire > 2000
    const peakDecay = isDrySpell ? 0.985 : 0.993
    if (state.avgSignal > state.avgSignalPeak) {
      state.avgSignalPeak = state.avgSignal
    } else {
      state.avgSignalPeak = state.avgSignalPeak * peakDecay + state.avgSignal * (1 - peakDecay)
    }

    const drySpellFloorDecay = timeSinceLastFire > 3000
      ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
      : 0
    const adaptiveFloor = config.gateOn - (0.12 * drySpellFloorDecay)
    const avgEffective = Math.max(state.avgSignal, state.avgSignalPeak * 0.55, adaptiveFloor)
    const dynamicGate = avgEffective + config.gateMargin

    const breakdownPenalty = isBreakdown ? 0.06 : 0
    let kickPower = 0
    const gatePassed = signal > dynamicGate && isAttacking && signal > 0.15
    if (gatePassed) {
      const requiredJump = 0.14 - 0.07 * morphFactor + breakdownPenalty
      let rawPower = (signal - dynamicGate) / requiredJump
      rawPower = Math.min(1.0, Math.max(0, rawPower))
      const crushExp = config.crushExponent + 0.3 * (1.0 - morphFactor)
      kickPower = Math.pow(rawPower, crushExp)
    }

    const squelch = Math.max(0.02, config.squelchBase - config.squelchSlope * morphFactor)
    const ignited = kickPower > squelch
    if (ignited) {
      state.lastFireTime = now
    }

    return {
      dynamicGate,
      squelch,
      kickPower,
      gatePassed,
      ignited,
    }
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
    this._kickProbe = LiquidEngine41Telemetry.freshProbeState()
    this._snareProbe = LiquidEngine41Telemetry.freshProbeState()
    this._highMidProbe = LiquidEngine41Telemetry.freshProbeState()
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
      `# Formato: [LATINO-41] bandas | morph/kick | frontProbe | backProbe | out`,
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
        ` kickRaw:${r.kickRaw.toFixed(3)}` +
        ` isKick:${r.isKick ? 1 : 0}` +
        ` isKEdge:${r.isKickEdge ? 1 : 0}` +
        ` | kGate:${r.kickDynGate.toFixed(3)}` +
        ` kSq:${r.kickSquelch.toFixed(3)}` +
        ` kPow:${r.kickPower.toFixed(3)}` +
        ` kPass:${r.kickGatePassed ? 1 : 0}` +
        ` kIgn:${r.kickIgnited ? 1 : 0}` +
        ` | snIn:${r.snareInput.toFixed(3)}` +
        ` snGate:${r.snareDynGate.toFixed(3)}` +
        ` snSq:${r.snareSquelch.toFixed(3)}` +
        ` snPow:${r.snarePower.toFixed(3)}` +
        ` snPass:${r.snareGatePassed ? 1 : 0}` +
        ` snIgn:${r.snareIgnited ? 1 : 0}` +
        ` hmIn:${r.highMidInput.toFixed(3)}` +
        ` hmGate:${r.highMidDynGate.toFixed(3)}` +
        ` hmSq:${r.highMidSquelch.toFixed(3)}` +
        ` hmPow:${r.highMidPower.toFixed(3)}` +
        ` hmPass:${r.highMidGatePassed ? 1 : 0}` +
        ` hmIgn:${r.highMidIgnited ? 1 : 0}` +
        ` | fPar:${r.frontPar.toFixed(3)}` +
        ` bPar:${r.backPar.toFixed(3)}` +
        ` mL:${r.moverL.toFixed(3)}` +
        ` mR:${r.moverR.toFixed(3)}` +
        ` | sc:${r.sidechainFired ? 1 : 0}` +
        ` scDuck:${r.duckingApplied.toFixed(3)}`
      )
    }

    writeFileSync(resolvedPath, lines.join('\n'), 'utf-8')
    // Calibración activa: emitir por console.error para bypass del Gate A.
    console.error(`[LATINO-41 TELEMETRY] ${this._buffer.length} frames exportados → ${resolvedPath}`)
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
      const kickLocked = this.profile.layout41Strategy === 'strict-split' && !frame.isKick
      const kickRaw = kickLocked ? 0 : (frame.isKickEdge ? bands.bass : 0)
      const snareInput = frame.snareAttack
      const highMidInput = Math.max(0,
        bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight
        - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
      )

      const kickProbe = this.evaluateEnvelopeProbe(
        kickRaw,
        p.envelopeKick,
        morphFactor,
        frame.now,
        frame.isBreakdown,
        this._kickProbe,
      )
      const snareProbe = this.evaluateEnvelopeProbe(
        snareInput,
        p.envelopeSnare,
        morphFactor,
        frame.now,
        frame.isBreakdown,
        this._snareProbe,
      )
      const highMidProbe = this.evaluateEnvelopeProbe(
        highMidInput,
        p.envelopeHighMid,
        morphFactor,
        frame.now,
        frame.isBreakdown,
        this._highMidProbe,
      )

      const record: Latino41TelemetryRecord = {
        subBass:        bands.subBass,
        mid:            bands.mid,
        highMid:        bands.highMid,
        treble:         bands.treble,
        morphFactor,
        trebleDelta,
        percRaw,
        kickRaw,
        kickDynGate: kickProbe.dynamicGate,
        kickSquelch: kickProbe.squelch,
        kickPower: kickProbe.kickPower,
        kickGatePassed: kickProbe.gatePassed,
        kickIgnited: kickProbe.ignited,
        isKick: frame.isKick,
        isKickEdge: frame.isKickEdge,
        snareInput,
        snareDynGate: snareProbe.dynamicGate,
        snareSquelch: snareProbe.squelch,
        snarePower: snareProbe.kickPower,
        snareGatePassed: snareProbe.gatePassed,
        snareIgnited: snareProbe.ignited,
        highMidInput,
        highMidDynGate: highMidProbe.dynamicGate,
        highMidSquelch: highMidProbe.squelch,
        highMidPower: highMidProbe.kickPower,
        highMidGatePassed: highMidProbe.gatePassed,
        highMidIgnited: highMidProbe.ignited,
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

      // [LATINO-41] WAVE 2459: Telemetría activa — 4 zonas para calibración en sala.
      // Formato legible: frontPar, backPar, moverL, moverR + señales crudas de diagnóstico.
      // Desactivar con setTelemetryEnabled(false) antes de producción estable.
      // console.error(
      //   `[MATH AUDIT][LATINO-41]` +
        ` sB:${bands.subBass.toFixed(3)}` +
        ` mid:${bands.mid.toFixed(3)}` +
        ` hMid:${bands.highMid.toFixed(3)}` +
        ` tr:${bands.treble.toFixed(3)}` +
        ` | morph:${morphFactor.toFixed(3)}` +
        ` tDelta:${trebleDelta.toFixed(4)}` +
        ` percRaw:${percRaw.toFixed(3)}` +
        ` kickRaw:${kickRaw.toFixed(3)}` +
        ` isKick:${frame.isKick ? 1 : 0}` +
        ` isKEdge:${frame.isKickEdge ? 1 : 0}` +
        ` | kGate:${kickProbe.dynamicGate.toFixed(3)}` +
        ` kSq:${kickProbe.squelch.toFixed(3)}` +
        ` kPow:${kickProbe.kickPower.toFixed(3)}` +
        ` kPass:${kickProbe.gatePassed ? 1 : 0}` +
        ` kIgn:${kickProbe.ignited ? 1 : 0}` +
        ` | snIn:${snareInput.toFixed(3)}` +
        ` snGate:${snareProbe.dynamicGate.toFixed(3)}` +
        ` snSq:${snareProbe.squelch.toFixed(3)}` +
        ` snPow:${snareProbe.kickPower.toFixed(3)}` +
        ` snPass:${snareProbe.gatePassed ? 1 : 0}` +
        ` snIgn:${snareProbe.ignited ? 1 : 0}` +
        ` hmIn:${highMidInput.toFixed(3)}` +
        ` hmGate:${highMidProbe.dynamicGate.toFixed(3)}` +
        ` hmSq:${highMidProbe.squelch.toFixed(3)}` +
        ` hmPow:${highMidProbe.kickPower.toFixed(3)}` +
        ` hmPass:${highMidProbe.gatePassed ? 1 : 0}` +
        ` hmIgn:${highMidProbe.ignited ? 1 : 0}` +
        ` | fPar:${frontPar.toFixed(3)}` +
        ` bPar:${backPar.toFixed(3)}` +
        ` mL:${mL.toFixed(3)}` +
        ` mR:${mR.toFixed(3)}` +
        ` | sc:${sidechainFired ? 1 : 0}` +
        ` scDuck:${duckingApplied.toFixed(3)}`
      // )

      this._frameCount++
    }

    return {
      frontLeftIntensity:  frontPar,
      frontRightIntensity: frontPar,
      backLeftIntensity:   backPar,
      backRightIntensity:  backPar,
      moverLeftIntensity:  mL,
      moverRightIntensity: mR,
      floorIntensity:      0,
      ambientIntensity:    0,
      airIntensity:        0,
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
// WAVE 2460: Telemetría siempre activa en desarrollo — se desactiva manualmente
// con window.luxDebug.telemetry.stop() o IPC 'telemetry:lt41:stop' antes de producción.
export const latinoEngine41Telemetry = new LiquidEngine41Telemetry()
latinoEngine41Telemetry.setTelemetryEnabled(true)

// ── WAVE 2434: IPC bridge expuesto en preload.ts → window.luxDebug.telemetry ──
// Llamar desde DevTools del renderer:
//   await window.luxDebug.telemetry.export()   → vuelca docs/logs/latinocalib41.md
//   await window.luxDebug.telemetry.stop()     → detiene captura
//   await window.luxDebug.telemetry.flush()    → limpia el buffer
// Las IPC channels son: 'telemetry:lt41:export', 'telemetry:lt41:stop', 'telemetry:lt41:flush'
