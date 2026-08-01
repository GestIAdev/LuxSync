/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 9001: PASSIVE TELEMETRY OBSERVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replaces LiquidEngine41Telemetry as the telemetry capture mechanism.
 *
 * ARCHITECTURAL INVARIANTS:
 *  - This class does NOT extend LiquidEngineBase.
 *  - This class does NOT produce DMX. Ever.
 *  - This class reads engine.lastFrame, engine.lastResult, and engine.getEnvelopeProbes()
 *    AFTER the real motor has processed the frame.
 *  - The real motor (LiquidEngine41 or LiquidEngine71) is always the sole DMX producer.
 *  - Behavior is identical in dev and production — the observer is always attached,
 *    but only captures when setTelemetryEnabled(true) is called explicitly via IPC.
 *
 * @module hal/physics/LiquidTelemetryObserver
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { LiquidEngineBase, ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult, LiquidStereoInput } from './LiquidStereoPhysics'
import type { GodEarPhoton } from '../../workers/GodEarFFT'
import type { ILiquidProfile } from './profiles/ILiquidProfile'

// ═══════════════════════════════════════════════════════════════════════════
// LOG RECORD — Reuses the same structure as the legacy Omni41TelemetryRecord
// ═══════════════════════════════════════════════════════════════════════════

export interface Omni41TelemetryRecord {
  subBass: number
  mid: number
  highMid: number
  treble: number
  morphFactor: number
  trebleDelta: number
  percRaw: number
  kickRaw: number
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
  frontLeft: number
  frontRight: number
  frontPar: number
  backPar: number
  moverL: number
  moverR: number
  photonStrobeActive: boolean
  photonStrobeRateHz: number
  photonStrobeDuty: number
  sidechainFired: boolean
  duckingApplied: number
  isBreakdown: boolean
}

/** Alias backward-compatible */
export type Latino41TelemetryRecord = Omni41TelemetryRecord

// ═══════════════════════════════════════════════════════════════════════════
// PASSIVE OBSERVER
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidTelemetryObserver {

  private _enabled = false
  private _frameCount = 0
  private _lastTrebleForDelta = 0
  private _lastPhoton: GodEarPhoton | undefined

  private static readonly BUFFER_SIZE = 600
  private _buffer: Omni41TelemetryRecord[] = []
  private _bufferHead = 0

  /** The engine being observed — set by SeleneLux when the engine is selected. */
  private _engine: LiquidEngineBase | null = null

  /** The profile of the observed engine — kept in sync via setProfile(). */
  private _profile: ILiquidProfile | null = null

  setEngine(engine: LiquidEngineBase): void {
    this._engine = engine
    this._profile = engine.profile
  }

  setProfile(profile: ILiquidProfile): void {
    this._profile = profile
  }

  setTelemetryEnabled(enabled: boolean): void {
    this._enabled = enabled
    if (!enabled) this._frameCount = 0
  }

  isTelemetryEnabled(): boolean {
    return this._enabled
  }

  getBuffer(): readonly Omni41TelemetryRecord[] {
    return this._buffer
  }

  flushBuffer(): void {
    this._buffer = []
    this._bufferHead = 0
    this._frameCount = 0
  }

  /**
   * Capture photon reference from the input before the engine processes it.
   * Called by SeleneLux BEFORE applyBands(), so the photon is available
   * when capture() runs AFTER applyBands().
   */
  capturePhoton(input: LiquidStereoInput): void {
    this._lastPhoton = input.photon
  }

  /**
   * Passive capture — called AFTER engine.applyBands() has completed.
   * Reads engine.lastFrame and engine.lastResult to build the telemetry record.
   * Does NOT process any audio. Does NOT produce DMX. Zero side effects on the engine.
   */
  capture(input: LiquidStereoInput, result: LiquidStereoResult): void {
    if (!this._enabled || !this._engine || !this._engine.lastFrame) return

    const frame = this._engine.lastFrame
    const probes = this._engine.getEnvelopeProbes()
    const p = this._profile ?? this._engine.profile

    // Transient delta (for telemetry — same logic as legacy)
    const currentTreble = frame.bands.treble
    const trebleDelta = Math.max(0, currentTreble - this._lastTrebleForDelta)
    this._lastTrebleForDelta = currentTreble
    const percRaw = this._engine.lastHybridSnare

    const kickProbe = probes.kick
    const snareProbe = probes.snare
    const highMidProbe = probes.highMid

    const photonStrobe = this._lastPhoton?.strobe

    // Sidechain detection (replicated for telemetry)
    const isStrict = p.layout41Strategy === 'strict-split'
    const frontMax = isStrict ? frame.frontRight : Math.max(frame.frontLeft, frame.frontRight)
    const sidechainFired = frontMax > p.sidechainThreshold
    const duckingApplied = sidechainFired
      ? 1.0 - frontMax * p.sidechainDepth
      : 1.0

    const record: Omni41TelemetryRecord = {
      subBass:        frame.bands.subBass,
      mid:            frame.bands.mid,
      highMid:        frame.bands.highMid,
      treble:         frame.bands.treble,
      morphFactor:    frame.morphFactor,
      trebleDelta,
      percRaw,
      kickRaw:        kickProbe.signal,
      kickDynGate:    kickProbe.dynamicGate,
      kickSquelch:    kickProbe.squelch,
      kickPower:      kickProbe.kickPower,
      kickGatePassed: kickProbe.gatePassed,
      kickIgnited:    kickProbe.ignited,
      isKick:         frame.isKick,
      isKickEdge:     frame.isKickEdge,
      snareInput:     snareProbe.signal,
      snareDynGate:   snareProbe.dynamicGate,
      snareSquelch:   snareProbe.squelch,
      snarePower:     snareProbe.kickPower,
      snareGatePassed: snareProbe.gatePassed,
      snareIgnited:   snareProbe.ignited,
      highMidInput:   highMidProbe.signal,
      highMidDynGate: highMidProbe.dynamicGate,
      highMidSquelch: highMidProbe.squelch,
      highMidPower:   highMidProbe.kickPower,
      highMidGatePassed: highMidProbe.gatePassed,
      highMidIgnited: highMidProbe.ignited,
      frontLeft:      frame.frontLeft,
      frontRight:     frame.frontRight,
      frontPar:       result.frontParIntensity,
      backPar:        result.backParIntensity,
      moverL:         result.moverIntensityL,
      moverR:         result.moverIntensityR,
      photonStrobeActive: photonStrobe?.active ?? false,
      photonStrobeRateHz: photonStrobe?.rateHz ?? 0,
      photonStrobeDuty: photonStrobe?.duty ?? 0,
      sidechainFired,
      duckingApplied,
      isBreakdown:    frame.isBreakdown,
    }

    // Circular buffer
    if (this._buffer.length < LiquidTelemetryObserver.BUFFER_SIZE) {
      this._buffer.push(record)
    } else {
      this._buffer[this._bufferHead] = record
      this._bufferHead = (this._bufferHead + 1) % LiquidTelemetryObserver.BUFFER_SIZE
    }

    // Console log (same format as legacy BACK-TEL)
    // WAVE 3424: Temporarily disabled for seek diagnostics — re-enable after debugging
    /*
    console.log(
      `[BACK-TEL]` +
      ` sB:${frame.bands.subBass.toFixed(3)}` +
      ` bass:${frame.bands.bass.toFixed(3)}` +
      ` mid:${frame.bands.mid.toFixed(3)}` +
      ` hM:${frame.bands.highMid.toFixed(3)}` +
      ` tr:${frame.bands.treble.toFixed(3)}` +
      ` | isK:${frame.isKick ? 1 : 0}` +
      ` isKE:${frame.isKickEdge ? 1 : 0}` +
      ` percRaw:${percRaw.toFixed(3)}` +
      ` | morph:${frame.morphFactor.toFixed(3)}` +
      ` brk:${frame.isBreakdown ? 1 : 0}` +
      ` strict:${isStrict ? 1 : 0}` +
      ` | bL_in:${highMidProbe.signal.toFixed(3)}` +
      ` bL_gate:${highMidProbe.dynamicGate.toFixed(3)}` +
      ` bL_sq:${highMidProbe.squelch.toFixed(3)}` +
      ` bL_pow:${highMidProbe.kickPower.toFixed(3)}` +
      ` bL_ign:${highMidProbe.ignited ? 1 : 0}` +
      ` | bR_in:${snareProbe.signal.toFixed(3)}` +
      ` bR_gate:${snareProbe.dynamicGate.toFixed(3)}` +
      ` bR_sq:${snareProbe.squelch.toFixed(3)}` +
      ` bR_pow:${snareProbe.kickPower.toFixed(3)}` +
      ` bR_ign:${snareProbe.ignited ? 1 : 0}` +
      ` | outFL:${frame.frontLeft.toFixed(3)}` +
      ` outFR:${frame.frontRight.toFixed(3)}` +
      ` outFPar:${result.frontParIntensity.toFixed(3)}` +
      ` outBL:${frame.backLeft.toFixed(3)}` +
      ` outBR:${frame.backRight.toFixed(3)}` +
      ` outPar:${result.backParIntensity.toFixed(3)}` +
      ` | strA:${photonStrobe?.active ? 1 : 0}` +
      ` strHz:${(photonStrobe?.rateHz ?? 0).toFixed(1)}` +
      ` strDuty:${(photonStrobe?.duty ?? 0).toFixed(2)}` +
      ` strDrv:${(photonStrobe?.drive ?? 0).toFixed(3)}` +
      ` td:${(this._lastPhoton?.transientDensity ?? 0).toFixed(3)}` +
      ` wn:${(this._lastPhoton?.whiteNoiseScore ?? 0).toFixed(3)}` +
      ` flux:${(this._lastPhoton?.spectralFlux ?? 0).toFixed(4)}`
    )
    */

    this._frameCount++
  }

  exportToFile(outputPath?: string): number {
    const resolvedPath = outputPath ??
      join(process.cwd(), '..', 'docs', 'logs', 'latinocalib41.md')

    const dir = dirname(resolvedPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const profileTag = (this._profile?.id ?? 'unknown').toUpperCase().replace(/-/g, '')
    const lines: string[] = [
      `# ${profileTag}-41 TELEMETRY — ${new Date().toISOString()}`,
      `# Frames capturados: ${this._buffer.length}`,
      `# Profile: ${this._profile?.name ?? 'unknown'} (${this._profile?.id ?? 'unknown'})`,
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
    const frameCount = this._buffer.length
    if (frameCount === 0) {
      console.error(`[${profileTag}-41 TELEMETRY] ⚠️ BUFFER VACÍO — 0 frames exportados → ${resolvedPath}`)
    } else {
      console.error(`[${profileTag}-41 TELEMETRY] ${frameCount} frames exportados → ${resolvedPath}`)
    }
    return this._buffer.length
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Passive observer. Always attached, captures only when enabled.
// ═══════════════════════════════════════════════════════════════════════════
export const liquidTelemetryObserver = new LiquidTelemetryObserver()
liquidTelemetryObserver.setTelemetryEnabled(true)

/** Backward-compatible aliases */
export const omniEngine41Telemetry = liquidTelemetryObserver
export const latinoEngine41Telemetry = liquidTelemetryObserver
