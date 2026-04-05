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
 *            HOTFIX: PARs generados con osciladores de números primos (asíncronos).
 *            Los envelopes rítmicos son incorrectos para chill — los PARs respiran.
 *            Los Movers siguen siendo reactivos a la música (destellos esporádicos).
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
 * LAYOUT CHILL (WAVE 2470 HOTFIX — profile.id === 'chill-oceanic'):
 *   Los PARs NO usan envelopes rítmicos — respiran con osciladores de números primos.
 *   Los períodos asíncronos garantizan que ningún par de PARs esté en fase.
 *   breathDepth = 0.25 × morphFactor (tide machine: superficie=1.0, abismo=0.0)
 *   baseFloor = 0.35 (nunca a oscuras — el océano siempre tiene luz ambiental)
 *   Front L → sin(t/3659) × breathDepth + baseFloor  (El Pulso del Abismo)
 *   Front R → cos(t/3023) × breathDepth + baseFloor  (La Corriente)
 *   Back L  → sin(t/4007) × breathDepth + baseFloor  (Las Algas)
 *   Back R  → cos(t/3511) × breathDepth + baseFloor  (El Destello fantasma)
 *   Mover L → envVocal (La Voz del Mar — reactivo a la música)
 *   Mover R → envTreble (La Bioluminiscencia — destellos esporádicos)
 *   strobeActive = false (el océano no hace strobe)
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

    // ─────────────────────────────────────────────────────────────────
    // WAVE 2470 HOTFIX — RESURRECCIÓN GENERATIVA
    //
    // El diagnóstico: los envelopes rítmicos (envKick, envSnare, envSubBass,
    // envHighMid) están diseñados para responder a transientes. En chill no
    // hay transientes — hay pads continuos. Resultado: los PARs flashean
    // lentamente en los transientes del bass pad y se quedaban planos en
    // el ghostCap entre ellos. No eran mareas, eran pulsos lentos.
    //
    // La solución: para chill, los 4 PARs se generan con osciladores de
    // números primos asíncronos — respiración orgánica independiente del
    // contenido de audio. Los Movers SÍ mantienen reactividad musical
    // para capturar los destellos esporádicos de la Bioluminiscencia.
    //
    // Los períodos son números primos (ms) para garantizar que ningún
    // par de PARs esté nunca en fase — máxima asincronía orgánica:
    //   Front L: 3659ms  ~3.7s  — El Pulso del Abismo (más lento: sub)
    //   Front R: 3023ms  ~3.0s  — La Corriente (ligeramente más rápido)
    //   Back L:  4007ms  ~4.0s  — Las Algas (el período más largo: tejido)
    //   Back R:  3511ms  ~3.5s  — El Destello (entremedio: shaker fantasma)
    //
    // breathDepth escala con morphFactor (tide machine):
    //   Superficie (morphFactor=1.0) → breathDepth=0.25 (máxima respiración)
    //   Abismo     (morphFactor=0.0) → breathDepth=0.0  (todo estático)
    //   La presión hidrostática aplasta las olas.
    // ─────────────────────────────────────────────────────────────────

    if (isChill) {
      const t = frame.now  // tiempo real en ms — determinista, no RNG
      const breathDepth = 0.25 * frame.morphFactor  // morphFactor = 1-depth/MAX_DEPTH
      const baseFloor   = 0.35  // Nunca a oscuras: el océano siempre tiene luz ambiental

      const chillFrontL = baseFloor + Math.sin(t / 3659) * breathDepth
      const chillFrontR = baseFloor + Math.cos(t / 3023) * breathDepth
      const chillBackL  = baseFloor + Math.sin(t / 4007) * breathDepth
      const chillBackR  = baseFloor + Math.cos(t / 3511) * breathDepth

      // Movers: reactivos a la música — envVocal captura pads, envTreble captura shimmer
      // frame.moverRight = envVocal (swap: vocal → L físico = La Voz del Mar)
      // frame.moverLeft  = envTreble (swap: treble → R físico = La Bioluminiscencia)
      const chillMoverL = moverRight  // La Voz del Mar
      const chillMoverR = moverLeft   // La Bioluminiscencia

      return {
        frontLeftIntensity:  chillFrontL,
        frontRightIntensity: chillFrontR,
        backLeftIntensity:   chillBackL,
        backRightIntensity:  chillBackR,
        moverLeftIntensity:  chillMoverL,
        moverRightIntensity: chillMoverR,
        strobeActive: false,      // El océano no hace strobe
        strobeIntensity: 0,

        // Legacy compat
        frontParIntensity: Math.max(chillFrontL, chillFrontR),
        backParIntensity:  Math.max(chillBackL, chillBackR),
        moverIntensityL:   chillMoverL,
        moverIntensityR:   chillMoverR,
        moverIntensity:    Math.max(chillMoverL, chillMoverR),
        moverActive:       chillMoverL > 0.1 || chillMoverR > 0.1,
        physicsApplied: 'liquid-stereo',
        acidMode: false,   // El abismo no tiene distorsión
        noiseMode: false,
      }
    }

    // Latino y Chill: vocal → Mover L físico (expresión), treble → Mover R físico (brillo)
    // Techno/Rock: envTreble → Mover L (El Melodista), envVocal → Mover R (El Alma)
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
