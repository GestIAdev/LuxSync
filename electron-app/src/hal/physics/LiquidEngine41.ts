/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine41 — Motor 4.1 (Setup compacto)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Compacta las 7 zonas en 4 + strobe para rigs pequeños, con dos estrategias:
 *
 * ── 'default' ────────────────────────────────────────────────────────────
 *   frontPar  = max(subBass, kick)          — Océano + Francotirador
 *   backPar   = max(snare, highMid)         — Látigo + Sintetizadores
 *   moverL    = envTreble                   — Melodías
 *   moverR    = envVocal                    — Voces
 *
 * ── 'strict-split' (Metrónomo/Lienzo — Techno industrial) ─────────────
 *   frontPar  = envKick                     — Solo el Metrónomo
 *   backPar   = envSnare                    — Solo el Látigo
 *   moverL    = max(subBass, highMid, treble) — Lienzo L: muro atmosférico
 *   moverR    = max(subBass, highMid, vocal)  — Lienzo R: muro + aire vocal
 *
 * @module hal/physics/LiquidEngine41
 * @version WAVE 2439 — METRÓNOMO/LIENZO
 */

import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { TECHNO_PROFILE } from './profiles/techno'

export class LiquidEngine41 extends LiquidEngineBase {

  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    super(profile, '4.1')
  }

  protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
    const {
      frontLeft, frontRight,
      backLeft, backRight,
      moverLeft, moverRight,
      strobeActive, strobeIntensity,
      acidMode, noiseMode,
      isKickEdge,
    } = frame

    let frontPar: number
    let backPar: number
    let outMoverL: number
    let outMoverR: number

    if (this.profile.layout41Strategy === 'strict-split') {
      // ── METRÓNOMO / LIENZO ────────────────────────────────────────────────
      //
      // PARs: ritmo puro y militarmente separado.
      //   Front = solo Kick      → El Metrónomo. Parpadea con el bombo.
      //   Back  = solo Snare     → El Látigo. Percusión aguda sin contaminar.
      //
      // MOVERS: absorben TODO el muro de sonido continuo.
      //   envSubBass  = frontLeft   (El Océano rodante)
      //   envHighMid  = backLeft    (Sintetizadores medios)
      //   envTreble   = moverLeft   (Melodías tonales)
      //   envVocal    = moverRight  (Voces / aire)
      //
      frontPar  = frontRight                                          // envKick
      backPar   = backRight                                           // envSnare
      outMoverL = Math.max(frontLeft, backLeft, moverLeft)            // sB + hMid + treble
      outMoverR = Math.max(frontLeft, backLeft, moverRight)           // sB + hMid + vocal

    } else {
      // ── DEFAULT (legacy) ─────────────────────────────────────────────────
      frontPar  = Math.max(frontLeft, frontRight)
      backPar   = Math.max(backLeft, backRight)
      outMoverL = moverLeft
      outMoverR = moverRight
    }

    // ── [LAB-DATA] Telemetría unificada Sterile Lab (WAVE 2440.3) ─────────
    // Formato parseable por Monte Carlo. Expone ingredientes crudos + salidas finales.
    // cent=spectralCentroid(Hz) | isK=kick(0/1) | bass | trbD=snareAttack(pre-gate)
    // harsh=harshness | oF=frontPar | oB=backPar
    if (this.profile.id === 'techno-industrial') {
      const f = (n: number) => n.toFixed(3)
      const fi = (n: number) => Math.round(n).toString().padStart(4, ' ')
      console.log(
        `[LAB-DATA] cent:${fi(frame.bands.centroid)} | ` +
        `isK:${frame.isKick ? 1 : 0} bass:${f(frame.bands.bass)} | ` +
        `trbD:${f(frame.snareAttack)} harsh:${f(frame.harshness)} | ` +
        `oF:${f(frontPar)} oB:${f(backPar)}`
      )
    }

    return {
      frontLeftIntensity:  frontPar,
      frontRightIntensity: frontPar,
      backLeftIntensity:   backPar,
      backRightIntensity:  backPar,
      moverLeftIntensity:  outMoverL,
      moverRightIntensity: outMoverR,
      strobeActive,
      strobeIntensity,

      // Legacy compat
      frontParIntensity: frontPar,
      backParIntensity:  backPar,
      moverIntensityL:   outMoverL,
      moverIntensityR:   outMoverR,
      moverIntensity:    Math.max(outMoverL, outMoverR),
      moverActive:       outMoverL > 0.1 || outMoverR > 0.1,
      physicsApplied:    'liquid-stereo',
      acidMode,
      noiseMode,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Default TECHNO_PROFILE
// ═══════════════════════════════════════════════════════════════════════════
export const liquidEngine41 = new LiquidEngine41()

