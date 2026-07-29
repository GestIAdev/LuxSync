/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2434: OMNI-41 TELEMETRY INJECTOR (WAS LATINO-41)
 * WAVE 2457: ENVELOPE-DRIVEN MOVERS — El Galán + La Dama activos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Inyecta un logger frame-a-frame (20fps) sobre LiquidEngine41 con
 * CUALQUIER PERFIL activo (Techno, Latino, etc.). La telemetría se emite
 * por consola en formato parseable para el script Monte Carlo de Wave 2434.
 *
 * ACTIVACIÓN: Desde SeleneLux.ts llama omniEngine41Telemetry.setTelemetryEnabled(true).
 * El motor se autoinyecta en el switch bifurcado de WAVE 2432 cuando telemetry está activo.
 *
 * FORMATO DE LOG:
 *   [PROFILE-41] sB:{subBass} mid:{mid} hMid:{highMid} tr:{treble} |
 *               morph:{morphFactor} tDelta:{trebleDelta} |
 *               fPar:{frontPar} bPar:{backPar} mL:{moverL} mR:{moverR} |
 *               sc:{sidechainFired} scDepth:{duckingApplied}
 *
 * @module hal/physics/LiquidEngine41Telemetry
 * @version WAVE 2457 — OMNI-41: PERFIL-AGNÓSTICO
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult, LiquidStereoInput } from './LiquidStereoPhysics'
import type { GodEarPhoton } from '../../workers/GodEarFFT'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { DEFAULT_LIQUID_PROFILE } from './profiles'
// LiquidEnvelopeConfig no longer needed — probe reads directly from envelope instances

// ═══════════════════════════════════════════════════════════════════════════
// LOG RECORD — Lo que se captura por frame
// ═══════════════════════════════════════════════════════════════════════════

export interface Omni41TelemetryRecord {
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
  frontLeft: number
  frontRight: number
  frontPar: number
  backPar: number
  moverL: number
  moverR: number
  // Photon strobe (FFT V3 StrobeEngine)
  photonStrobeActive: boolean
  photonStrobeRateHz: number
  photonStrobeDuty: number
  // Flags
  sidechainFired: boolean
  duckingApplied: number  // 1.0 = sin ducking, <1.0 = atenuación real
  isBreakdown: boolean
}

/** Alias backward-compatible para código legacy */
export type Latino41TelemetryRecord = Omni41TelemetryRecord


// ═══════════════════════════════════════════════════════════════════════════
// TELEMETRY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidEngine41Telemetry extends LiquidEngineBase {

  private _telemetryEnabled = false
  private _frameCount = 0
  private _lastTrebleForDelta = 0
  private _frontParSmooth = 0
  private static readonly FRONTPAR_RELEASE = 0.88
  // WAVE 8005.2: Photon strobe capturado en applyBands para telemetría
  private _lastPhoton: GodEarPhoton | undefined

  // Buffer circular para análisis posterior sin escribir a disco en hot path
  // 600 frames = 30s de telemetría a 20fps
  private static readonly BUFFER_SIZE = 600
  private _buffer: Omni41TelemetryRecord[] = []
  private _bufferHead = 0
  constructor(profile: ILiquidProfile = DEFAULT_LIQUID_PROFILE) {
    super(profile, '4.1')
  }

  /** WAVE 8005.2: Override para capturar photon antes de routeZones. */
  override applyBands(input: LiquidStereoInput): LiquidStereoResult {
    this._lastPhoton = input.photon
    return super.applyBands(input)
  }

  reset(): void {
    super.reset()
    this._frontParSmooth = 0
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
  getBuffer(): readonly Omni41TelemetryRecord[] {
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

    const profileTag = this.profile.id.toUpperCase().replace(/-/g, '')
    // Construir el contenido completo en memoria (el buffer ya tiene todos los frames)
    const lines: string[] = [
      `# ${profileTag}-41 TELEMETRY — ${new Date().toISOString()}`,
      `# Frames capturados: ${this._buffer.length}`,
      `# Profile: ${this.profile.name} (${this.profile.id})`,
      `# Formato: [${profileTag}-41] bandas | morph/kick | frontProbe | backProbe | out`,
      '',
    ]

    for (const r of this._buffer) {
      lines.push(
        `[${profileTag}-41]` +
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
        ` | fL:${r.frontLeft.toFixed(3)}` +
        ` fR:${r.frontRight.toFixed(3)}` +
        ` fPar:${r.frontPar.toFixed(3)}` +
        ` bPar:${r.backPar.toFixed(3)}` +
        ` mL:${r.moverL.toFixed(3)}` +
        ` mR:${r.moverR.toFixed(3)}` +
        ` | strA:${r.photonStrobeActive ? 1 : 0}` +
        ` strHz:${r.photonStrobeRateHz.toFixed(1)}` +
        ` strDuty:${r.photonStrobeDuty.toFixed(2)}` +
        ` | sc:${r.sidechainFired ? 1 : 0}` +
        ` scDuck:${r.duckingApplied.toFixed(3)}`
      )
    }

    writeFileSync(resolvedPath, lines.join('\n'), 'utf-8')
    // Calibración activa: emitir por console.error para bypass del Gate A.
    const frameCount = this._buffer.length
    if (frameCount === 0) {
      console.error(`[${profileTag}-41 TELEMETRY] ⚠️ BUFFER VACÍO — 0 frames exportados → ${resolvedPath} (¿motor 7.1 activo o sin audio?)`)
    } else {
      console.error(`[${profileTag}-41 TELEMETRY] ${frameCount} frames exportados → ${resolvedPath}`)
    }
    return this._buffer.length
  }

  protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
    const {
      frontLeft, frontRight,
      backLeft, backRight,
      moverLeft, moverRight,
      strobeActive, strobeIntensity,
      acidMode, noiseMode,
      floorIntensity, ambientIntensity, airIntensity,
      bands,
      morphFactor,
      isBreakdown,
    } = frame

    // ── 4.1 COMPACTION ──────────────────────────────────────────────
    const isStrict = this.profile.layout41Strategy === 'strict-split'
    const frontParTarget = isStrict ? frontRight : Math.max(frontLeft, frontRight)
    this._frontParSmooth = Math.max(frontParTarget, this._frontParSmooth * LiquidEngine41Telemetry.FRONTPAR_RELEASE)
    const frontPar = this._frontParSmooth
    const backPar  = Math.max(backLeft, backRight) // FIX: strict-split solo afecta front; back siempre usa ambos canales

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
    const percRaw = this._lastHybridSnare

    // ── TELEMETRY RECORD ─────────────────────────────────────────────
    if (this._telemetryEnabled) {
      // DIAG: confirmar en consola que estamos capturando (solo 1 de cada 44 frames ~1s)
      if (this._buffer.length === 0 && this._frameCount === 0) {
        console.error(`[OMNI-41 TELEMETRY] CAPTURA INICIADA — profile=${this.profile.id}`)
      }
      // WAVE 8009.1: Direct probe reads from real envelope instances — zero re-evaluation.
      // The base class processAudio() already called envXxx.process() before routeZones(),
      // so .probe contains the exact values used for DMX output.
      const kickProbe = this.envKick.probe
      const snareProbe = this.envSnare.probe
      const highMidProbe = this.envHighMid.probe

      const kickRaw = kickProbe.signal
      const snareInput = snareProbe.signal
      const highMidInput = highMidProbe.signal

      const photonStrobe = this._lastPhoton?.strobe

      const record: Omni41TelemetryRecord = {
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
        frontLeft:      frontLeft,
        frontRight:     frontRight,
        frontPar,
        backPar,
        moverL:         mL,
        moverR:         mR,
        photonStrobeActive: photonStrobe?.active ?? false,
        photonStrobeRateHz: photonStrobe?.rateHz ?? 0,
        photonStrobeDuty: photonStrobe?.duty ?? 0,
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

      // 🔇 FRONT-TEL silenciado — ahora solo BACK-TEL para calibración de backs
      // console.log(
      //   `[FRONT-TEL]` +
      //   ` sB:${bands.subBass.toFixed(3)}` +
      //   ...
      // )

      // 🔇 BACK-TEL silenciado — calibración de backs completada
      // WAVE 8008: Reactivated frame-by-frame for snare/hihat envelope debugging
      console.log(
          `[BACK-TEL]` +
          ` sB:${bands.subBass.toFixed(3)}` +
          ` bass:${bands.bass.toFixed(3)}` +
          ` mid:${bands.mid.toFixed(3)}` +
          ` hM:${bands.highMid.toFixed(3)}` +
          ` tr:${bands.treble.toFixed(3)}` +
          ` | isK:${frame.isKick ? 1 : 0}` +
          ` isKE:${frame.isKickEdge ? 1 : 0}` +
          ` percRaw:${percRaw.toFixed(3)}` +
          ` | morph:${morphFactor.toFixed(3)}` +
          ` brk:${frame.isBreakdown ? 1 : 0}` +
          ` strict:${isStrict ? 1 : 0}` +
          ` | bL_in:${highMidInput.toFixed(3)}` +
          ` bL_gate:${highMidProbe.dynamicGate.toFixed(3)}` +
          ` bL_sq:${highMidProbe.squelch.toFixed(3)}` +
          ` bL_pow:${highMidProbe.kickPower.toFixed(3)}` +
          ` bL_ign:${highMidProbe.ignited ? 1 : 0}` +
          ` | bR_in:${snareInput.toFixed(3)}` +
          ` bR_gate:${snareProbe.dynamicGate.toFixed(3)}` +
          ` bR_sq:${snareProbe.squelch.toFixed(3)}` +
          ` bR_pow:${snareProbe.kickPower.toFixed(3)}` +
          ` bR_ign:${snareProbe.ignited ? 1 : 0}` +
          ` | outFL:${frontLeft.toFixed(3)}` +
          ` outFR:${frontRight.toFixed(3)}` +
          ` outFPar:${frontPar.toFixed(3)}` +
          ` outBL:${backLeft.toFixed(3)}` +
          ` outBR:${backRight.toFixed(3)}` +
          ` outPar:${backPar.toFixed(3)}` +
          ` | strA:${photonStrobe?.active ? 1 : 0}` +
          ` strHz:${(photonStrobe?.rateHz ?? 0).toFixed(1)}` +
          ` strDuty:${(photonStrobe?.duty ?? 0).toFixed(2)}`
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
      // WAVE 4702: Atmospheric Bridge — 4.1 también transporta zonas 9-zone.
      // Misma física de Base (incluye Disco Gate 3.5 + umbral 0.15 en ambient).
      floorIntensity,
      ambientIntensity,
      airIntensity,
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
export const omniEngine41Telemetry = new LiquidEngine41Telemetry()
omniEngine41Telemetry.setTelemetryEnabled(true)

/** Alias backward-compatible — apunta al mismo singleton */
export const latinoEngine41Telemetry = omniEngine41Telemetry

// ── WAVE 2434: IPC bridge expuesto en preload.ts → window.luxDebug.telemetry ──
// Llamar desde DevTools del renderer:
//   await window.luxDebug.telemetry.export()   → vuelca docs/logs/PROFILEcalib41.md
//   await window.luxDebug.telemetry.stop()     → detiene captura
//   await window.luxDebug.telemetry.flush()    → limpia el buffer
// Las IPC channels son: 'telemetry:lt41:export', 'telemetry:lt41:stop', 'telemetry:lt41:flush'
