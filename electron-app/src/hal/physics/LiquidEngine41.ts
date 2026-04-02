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

  // WAVE 2436.2 TELEMETRÍA TEMPORAL — contador de frames para throttle
  private _telemFrame = 0

  // WAVE 2439 — KICK WINDOW: contador de frames desde el último kick
  private _kickWindowCounter = 0

  protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
    const {
      frontLeft, frontRight,
      backLeft, backRight,
      moverLeft, moverRight,
      strobeActive, strobeIntensity,
      acidMode, noiseMode,
      isKickEdge,
    } = frame

    // ── WAVE 2439: KICK WINDOW + KICK BOOST ─────────────────────────────────
    //
    // KICK WINDOW: fL (subBass) solo puede vivir en el frontPar durante
    // kickWindowFrames frames tras un kick. Fuera de esa ventana → fL = 0.
    // Esto elimina las melodías bajas y basses que se colaban entre bombo y bombo.
    //
    // KICK BOOST: en el frame exacto del kick, fR se amplifica para que el
    // pulso visual sea contundente y defina el ritmo por sí solo.
    let fL = frontLeft
    let fR = frontRight

    if (isKickEdge) {
      this._kickWindowCounter = this.profile.kickWindowFrames
    } else if (this._kickWindowCounter > 0) {
      this._kickWindowCounter--
    }

    // Ventana cerrada → subBass silenciado en el front
    if (this.profile.kickWindowFrames > 0 && this._kickWindowCounter === 0) {
      fL = 0
    }

    // Boost de impacto en el frame del kick
    if (isKickEdge && this.profile.kickBoost > 1.0) {
      fR = Math.min(1.0, fR * this.profile.kickBoost)
    }

    // ── WAVE 2438: GUILLOTINA 4.1 — Sidechain Interno Exclusivo + Aura Cap ──
    //
    // AURA CAP MORFOLÓGICO: En modo industrial (morphFactor ≈ 0), el subBass
    // no puede formar un muro de luz. El techo sube cuadráticamente con la
    // presencia melódica. A morphFactor=0 → auraCap=0 (kill total del océano).
    // A morphFactor=1 → auraCap=auraCapBase (techo alto, sin efecto práctico).
    if (this.profile.auraCapExponent > 0) {
      const auraCap = this.profile.auraCapBase * Math.pow(frame.morphFactor, this.profile.auraCapExponent)
      if (fL > auraCap) fL = auraCap
    }

    // SIDECHAIN INTERNO EXCLUSIVO (GUILLOTINA BINARIA):
    // Si el bombo dispara fuerte (fR > umbral), el subBass se calla.
    // No hay competencia en el max() — el kick siempre gana.
    if (this.profile.frontKickSidechainThreshold > 0 && fR > this.profile.frontKickSidechainThreshold) {
      fL = 0
    }

    // Compactar: max de cada hemisferio para los PARs simétricos
    const frontPar = Math.max(fL, fR)
    const backPar = Math.max(backLeft, backRight)

    // ── TELEMETRÍA FRONT PAR (WAVE 2436.2 + 2438 + 2439) — ~20fps (cada 3 frames a 60fps) ──
    if (this.profile.id === 'techno-industrial') {
      if (++this._telemFrame % 3 === 0) {
        const f = (n: number) => n.toFixed(3)
        const win = this._kickWindowCounter > 0 ? `W${this._kickWindowCounter}` : `W!`
        const kick = isKickEdge ? `KICK` : `----`
        console.log(
          `[TECHNO-FRONT] sB:${f(frame.bands.subBass)} kE:${f(frame.bands.bass)} | ` +
          `fL:${f(frontLeft)}->${f(fL)} fR:${f(frontRight)}->${f(fR)} | ` +
          `fPar:${f(frontPar)} | morph:${f(frame.morphFactor)} | ${kick} ${win}`
        )
      }
    }
    // ── FIN TELEMETRÍA ────────────────────────────────────────────────────────

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
