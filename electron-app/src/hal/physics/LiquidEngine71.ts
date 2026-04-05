/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine71 — Motor 7.1 (Asymmetric Split de 7 zonas)
 * WAVE 2466: Desvinculado de TECHNO_PROFILE — perfil agnóstico al género.
 *            El singleton recibe su perfil vía SeleneLux.setActiveProfile()
 *            → PROFILE_REGISTRY[vibeKey] → liquidEngine71.setProfile().
 * WAVE 2468: Matriz Espacial Latino 7.1 — routeZones bifurcado por profile.id.
 *            Latino usa ruteo semántico asimétrico. Techno mantiene el layout
 *            simétrico original. Zero alteraciones a los overrides41 del perfil.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hereda toda la matemática de LiquidEngineBase.
 * Solo implementa routeZones() — pasa las 7 señales procesadas a las zonas
 * físicas sin ningún max() de compactación (eso es territorio del 4.1).
 *
 * LAYOUT TECHNO (default):
 *   Front L → envSubBass   (El Océano — sub continuo)
 *   Front R → envKick      (El Francotirador)
 *   Back L  → envHighMid   (El Coro — mid synths)
 *   Back R  → envSnare     (El Látigo — transient shaper)
 *   Mover L → envTreble    (El Melodista — highMid+treble)
 *   Mover R → envVocal     (El Alma — treble puro)
 *
 * LAYOUT LATINO (WAVE 2468 — profile.id === 'latino-fiesta'):
 *   Front L → envSubBass   (El TÚN del dembow — decay staccato 0.50)
 *   Front R → envKick      (El Francotirador — bombo puro, BPM candado)
 *   Back L  → envHighMid   (El Tumbao — congas, bajo melódico, decay 0.92)
 *   Back R  → envSnare     (El TAcka — caja/clap dembow, disparo limpio)
 *   Mover L → envVocal     (El Galán — mid×0.80, voces, melodía, piano)
 *   Mover R → envTreble    (La Dama — treble, güira, metales altos, platillos)
 *   Canal 7 → 0.0 (Blackout — reservado para cinéticos/fans en v2.0)
 *
 * @module hal/physics/LiquidEngine71
 * @version WAVE 2468 — LATINO SPATIAL MATRIX
 */

import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'

// ID del perfil latino — single source of truth para la bifurcación
const LATINO_PROFILE_ID = 'latino-fiesta'

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
    } = frame

    // ─────────────────────────────────────────────────────────────────
    // WAVE 2468: BIFURCACIÓN ESPACIAL POR PERFIL
    //
    // La Base calcula estas señales con el ADN del perfil activo:
    //   frontLeft  = envSubBass.process()          — El TÚN / El Océano
    //   frontRight = envKick.process()             — El Francotirador
    //   backLeft   = envHighMid.process()          — El Tumbao / El Coro
    //   backRight  = envSnare.process()            — El TAcka / El Látigo
    //   moverLeft  = envTreble.process(moverLInput) — cross-filter tonal
    //   moverRight = envVocal.process(moverRInput)  — cleanMid vocal
    //
    // En Techno: moverLeft=highMid+treble (El Melodista), moverRight=treble (El Alma)
    // En Latino: moverLeft=mid×0.80 (envTreble con ADN latino = El Galán voces)
    //            moverRight=cleanMid-treble (envVocal con ADN latino = La Dama metales)
    //
    // La directiva 2468 invierte la asignación física de los movers en Latino:
    //   Zona física Mover L → recibe moverRight (envVocal: voces/melodía/mid)
    //   Zona física Mover R → recibe moverLeft  (envTreble: güira/treble/metales)
    //
    // IMPORTANTE: 'strict-split' (techno) usa WAVE 911 en la Base —
    //   moverLeft y moverRight son el resultado del bloque WAVE 911, no de
    //   envTreble/envVocal. El swap de Latino no afecta ese path.
    // ─────────────────────────────────────────────────────────────────

    const isLatino = this.profile.id === LATINO_PROFILE_ID

    const outMoverL = isLatino ? moverRight : moverLeft
    const outMoverR = isLatino ? moverLeft  : moverRight

    return {
      // 7 zonas independientes — Front/Back son idénticos en ambos perfiles
      frontLeftIntensity:  frontLeft,
      frontRightIntensity: frontRight,
      backLeftIntensity:   backLeft,
      backRightIntensity:  backRight,
      moverLeftIntensity:  outMoverL,
      moverRightIntensity: outMoverR,
      strobeActive,
      strobeIntensity,

      // Legacy compat
      frontParIntensity: Math.max(frontLeft, frontRight),
      backParIntensity:  Math.max(backLeft, backRight),
      moverIntensityL:   outMoverL,
      moverIntensityR:   outMoverR,
      moverIntensity:    Math.max(outMoverL, outMoverR),
      moverActive:       outMoverL > 0.1 || outMoverR > 0.1,
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
