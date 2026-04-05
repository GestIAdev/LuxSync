/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine71 — Motor 7.1 (Asymmetric Split de 7 zonas)
 * WAVE 2466: Desvinculado de TECHNO_PROFILE — perfil agnóstico al género.
 *            El singleton recibe su perfil vía SeleneLux.setActiveProfile()
 *            → PROFILE_REGISTRY[vibeKey] → liquidEngine71.setProfile().
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Solo implementa routeZones() — pasa las 7 señales procesadas a las zonas
 * físicas sin ningún max() de compactación (eso es territorio del 4.1).
 *
 * ROLES POR PERFIL (se asignan semánticamente en la Base via el perfil activo):
 *   Front L → envSubBass   (El TÚN en latino / El Océano en techno)
 *   Front R → envKick      (El Francotirador — universal)
 *   Back L  → envHighMid   (El Tumbao en latino / El Coro en techno)
 *   Back R  → envSnare     (El TAcka en latino / El Látigo en techno)
 *   Mover L → envTreble    (El Galán en latino / El Melodista en techno)
 *   Mover R → envVocal     (La Dama en latino / El Alma en techno)
 *
 * @module hal/physics/LiquidEngine71
 * @version WAVE 2466 — PROFILE AGNOSTIC
 */

import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'

export class LiquidEngine71 extends LiquidEngineBase {

  constructor(profile?: ILiquidProfile) {
    // Sin default hardcodeado — la Base usa TECHNO_PROFILE como fallback
    // si no se pasa nada. El perfil real llega via setProfile() en SeleneLux.
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
// SINGLETON — Perfil agnóstico. Arranca con TECHNO_PROFILE (fallback de la Base).
// SeleneLux.setActiveProfile(vibeKey) invoca liquidEngine71.setProfile(profile)
// en cada cambio de género — el perfil correcto siempre llega antes del
// primer frame de audio del nuevo vibe. Zero hardcodeo en runtime.
// ═══════════════════════════════════════════════════════════════════════════
export const liquidEngine71 = new LiquidEngine71()
