/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine71 — Motor 7.1 (Asymmetric Split de 7 zonas)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Solo implementa routeZones() — el mapeo asimétrico calibrado hasta WAVE 2427.
 *
 * HEMISFERIO DERECHO (Ritmo + Elemento Humano):
 *   Front R → Kick edge (El Francotirador)
 *   Back R  → Transient Shaper (El Látigo)
 *   Mover R → Voces/Sizzle (El Alma)
 * HEMISFERIO IZQUIERDO (Armonía + Atmósfera):
 *   Front L → SubBass (El Océano)
 *   Back L  → Mid Synths (El Coro)
 *   Mover L → Melodías tonales (El Brillo)
 *
 * @module hal/physics/LiquidEngine71
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
 */

import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'
import { TECHNO_PROFILE } from './profiles/techno'

export class LiquidEngine71 extends LiquidEngineBase {

  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    super(profile, '7.1')
  }

  protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
    const {
      frontLeft, frontRight,
      backLeft, backRight,
      moverLeft, moverRight,
      strobeActive, strobeIntensity,
      acidMode, noiseMode,
      bands,
    } = frame

    // WAVE 2418: TELEMETRY — HUMAN-R DIAGNOSTIC
    const rawRight = frame.backRight  // ya procesado por envSnare
    const vocalInput = Math.max(0, (bands.treble * 0.6 + bands.highMid * 0.4) - (bands.lowMid * 0.25))
    if (rawRight > 0.05 || moverRight > 0.05 || bands.treble > 0.2) {
      console.log(`[HUMAN-R] hMid: ${bands.highMid.toFixed(3)} treble: ${bands.treble.toFixed(3)} mid: ${bands.mid.toFixed(3)} | rIn(Snare): ${rawRight.toFixed(3)} vIn(Vocal): ${vocalInput.toFixed(3)} || BR(Latigo): ${backRight.toFixed(2)} MR(Voz): ${moverRight.toFixed(2)} | veto: ${frame.isVetoed ? 1 : 0}`)
    }

    return {
      // 7 zonas independientes
      frontLeftIntensity: frontLeft,
      frontRightIntensity: frontRight,
      backLeftIntensity: backLeft,
      backRightIntensity: backRight,
      moverLeftIntensity: moverLeft,
      moverRightIntensity: moverRight,
      strobeActive,
      strobeIntensity,

      // Legacy compat
      frontParIntensity: Math.max(frontLeft, frontRight),
      backParIntensity: Math.max(backLeft, backRight),
      moverIntensityL: moverLeft,
      moverIntensityR: moverRight,
      moverIntensity: Math.max(moverLeft, moverRight),
      moverActive: moverLeft > 0.1 || moverRight > 0.1,
      physicsApplied: 'liquid-stereo',
      acidMode,
      noiseMode,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON — Default TECHNO_PROFILE
// ═══════════════════════════════════════════════════════════════════════════
export const liquidEngine71 = new LiquidEngine71()
