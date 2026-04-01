/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine41 — Motor 4.1 (Setup compacto)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Compacta las 7 zonas en 4 + strobe para rigs pequeños:
 *
 *   frontPar  = max(frontLeft, frontRight) — Un solo par frontal
 *   backPar   = max(backLeft, backRight)   — Un solo par trasero
 *   moverL    = moverLeft                  — El Galán
 *   moverR    = moverRight                 — La Dama
 *   strobe    = strobe binario
 *
 * @module hal/physics/LiquidEngine41
 * @version WAVE 2435 — OMNILIQUID OVERRIDES
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
    } = frame

    // Compactar: max de cada hemisferio para los PARs simétricos
    const frontPar = Math.max(frontLeft, frontRight)
    const backPar = Math.max(backLeft, backRight)

    return {
      // En 4.1, Front L y R reciben la misma intensidad (compactada)
      frontLeftIntensity: frontPar,
      frontRightIntensity: frontPar,
      // Back L y R reciben la misma intensidad (compactada)
      backLeftIntensity: backPar,
      backRightIntensity: backPar,
      // Movers mantienen separación L/R (Galán y Dama)
      moverLeftIntensity: moverLeft,
      moverRightIntensity: moverRight,
      strobeActive,
      strobeIntensity,

      // Legacy compat
      frontParIntensity: frontPar,
      backParIntensity: backPar,
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
export const liquidEngine41 = new LiquidEngine41()
