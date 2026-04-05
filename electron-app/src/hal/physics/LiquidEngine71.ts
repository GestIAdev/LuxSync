/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2435: LiquidEngine71 — Motor 7.1 (Asymmetric Split de 7 zonas)
 * WAVE 2466: Desvinculado de TECHNO_PROFILE — perfil agnóstico al género.
 *            El singleton recibe su perfil vía SeleneLux.setActiveProfile()
 *            → PROFILE_REGISTRY[vibeKey] → liquidEngine71.setProfile().
 * WAVE 2468: Matriz Espacial Latino 7.1 — routeZones bifurcado por profile.id.
 *            Latino usa ruteo semántico asimétrico. Techno mantiene el layout
 *            simétrico original. Zero alteraciones a los overrides41 del perfil.
 * WAVE 2470: Descenso Oceánico — routeZones bifurcado para 'chill-oceanic'.
 *            Chill asigna vocales al Mover L y bioluminiscencia al Mover R.
 *            Análogo al Latino en filosofía: cuerpo en front, textura en back,
 *            expresión en movers. El morphFactor llega de la tide hidrostática.
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
 * LAYOUT CHILL (WAVE 2470 — profile.id === 'chill-oceanic'):
 *   Front L → envSubBass   (El Pulso del Abismo — bass continuo, latido de ballena)
 *   Front R → envKick      (La Corriente — pulsaciones suaves de bajo)
 *   Back L  → envHighMid   (Las Algas — tejido continuo de pad/synth mid)
 *   Back R  → envSnare     (El Destello — brush/shaker, micro-transitories)
 *   Mover L → envVocal     (La Voz del Mar — pads flotantes, voces etéreas)
 *   Mover R → envTreble    (La Bioluminiscencia — shimmer puntual, brillo esporádico)
 *   Canal 7 → 0.0 (Blackout — reservado para fog/hazer)
 *
 * @module hal/physics/LiquidEngine71
 * @version WAVE 2470 — OCEANIC DESCENT
 */

import { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
import type { LiquidStereoResult } from './LiquidStereoPhysics'
import type { ILiquidProfile } from './profiles/ILiquidProfile'

// IDs de perfiles con ruteo semántico especial
const LATINO_PROFILE_ID = 'latino-fiesta'
const CHILL_PROFILE_ID  = 'chill-oceanic'

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
    // WAVE 2468 + 2470: BIFURCACIÓN ESPACIAL POR PERFIL
    //
    // La Base calcula estas señales con el ADN del perfil activo:
    //   frontLeft  = envSubBass.process()          — El TÚN / El Océano / El Pulso del Abismo
    //   frontRight = envKick.process()             — El Francotirador / La Corriente
    //   backLeft   = envHighMid.process()          — El Tumbao / El Coro / Las Algas
    //   backRight  = envSnare.process()            — El TAcka / El Látigo / El Destello
    //   moverLeft  = envTreble.process(moverLInput) — cross-filter tonal
    //   moverRight = envVocal.process(moverRInput)  — cleanMid vocal
    //
    // TECHNO (default):  moverL=envTreble (El Melodista), moverR=envVocal (El Alma)
    // LATINO (WAVE 2468): swap físico — Mover L fijo recibe envVocal (El Galán = voces)
    //                     Mover R fijo recibe envTreble (La Dama = güira/metales)
    // CHILL (WAVE 2470):  semántica oceánica — Mover L recibe envVocal (La Voz del Mar)
    //                     Mover R recibe envTreble (La Bioluminiscencia)
    //
    // Latino y Chill comparten el mismo swap físico (vocal→L, treble→R) pero por
    // razones semánticas distintas. Latino es ritmo asimétrico. Chill es profundidad.
    //
    // IMPORTANTE: 'strict-split' (techno) usa WAVE 911 en la Base —
    //   moverLeft y moverRight son el resultado del bloque WAVE 911, no de
    //   envTreble/envVocal. El swap no afecta ese path.
    // ─────────────────────────────────────────────────────────────────

    const profileId = this.profile.id
    const isLatino = profileId === LATINO_PROFILE_ID
    const isChill  = profileId === CHILL_PROFILE_ID

    // Latino y Chill: vocal → Mover L físico (expresión), treble → Mover R físico (brillo)
    // Techno/Rock: envTreble → Mover L (El Melodista), envVocal → Mover R (El Alma)
    const outMoverL = (isLatino || isChill) ? moverRight : moverLeft
    const outMoverR = (isLatino || isChill) ? moverLeft  : moverRight

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
