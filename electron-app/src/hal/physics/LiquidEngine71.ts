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
 *            HOTFIX V3: Ondas normalizadas (sin+sin*0.3+1.3)/2.6 → rango [0,1].
 *            Períodos reducidos a ~10s para visibilidad real de movimiento.
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
 * LAYOUT CHILL (WAVE 2470 HOTFIX V3 — profile.id === 'chill-oceanic'):
 *   Los PARs NO usan envelopes rítmicos — respiran con osciladores normalizados.
 *   Normalización: (sin(t/P1) + sin(t/P2)*0.3 + 1.3) / 2.6 → rango [0, 1] estricto.
 *   breathDepth = 0.20 + morphFactor*0.40 → [0.20, 0.60] (superficie respira al máximo)
 *   baseFloor = 0.05 (nunca negro — la bioluminiscencia mínima siempre existe)
 *   Front L → wave(1831, 1039)  (El Pulso del Abismo — ~10s ciclo principal)
 *   Front R → wave(1511, 1361)  (La Corriente — ligeramente más rápido)
 *   Back L  → wave(2003, 1201)  (Las Algas — el período más largo)
 *   Back R  → wave(1759, 1069)  (El Destello fantasma — entremedio)
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
    // WAVE 2470 — BIFURCACIÓN GENERATIVA PARA CHILL
    //
    // Los envelopes rítmicos (envKick, envSnare, etc.) son la herramienta
    // equivocada para chill — responden a transientes. Chill es continuo.
    // PARs: osciladores de números primos con armónicos de interferencia.
    // Movers: reactivos a la música (destellos de vocal/treble).
    // Detalle en el bloque isChill abajo.
    // ─────────────────────────────────────────────────────────────────

    if (isChill) {
      // ─────────────────────────────────────────────────────────────────
      // WAVE 2470 HOTFIX V2 — RESTAURACIÓN DE FLUIDOS
      //
      // Fix 1: Date.now() garantiza que t avanza en cada frame,
      //        independientemente del caching del pipeline de audio.
      //        frame.now puede ser el timestamp del processing — si el
      //        engine tiene frames cacheados o silencio, t se congela.
      //
      // Fix 2: Ondas de interferencia restauradas.
      //        main + 0.3×harmonic → patrón de batido no periódico.
      //        Los dos números primos de cada PAR nunca coinciden en fase.
      //
      // Fix 3: breathDepth nunca llega a 0 en el abismo.
      //        Rango [0.15, 0.35]: abismo respira mínimo, superficie al máximo.
      //        La presión aplasta las olas pero no las elimina.
      //
      // Fix 4: Swap de movers preservado del hotfix v1 (semántica chill):
      //        frame.moverRight = envVocal → Mover L físico (La Voz del Mar)
      //        frame.moverLeft  = envTreble → Mover R físico (La Bioluminiscencia)
      //        El blueprint v2 invertía esto — aquí se corrige.
      // ─────────────────────────────────────────────────────────────────

      const t = Date.now()  // siempre avanza, frame a frame, sin dependencia de caché

      const depthFactor = frame.morphFactor ?? 1.0  // 1.0 = superficie, 0.0 = abismo

      // Amplitud dramática: oscila desde 0.05 (casi apagado) hasta 0.65 (brillo elegante)
      // Superficie: breathDepth=0.60 — máximo movimiento
      // Abismo:     breathDepth=0.20 — quietud aplastada por la presión
      const breathDepth = 0.20 + (depthFactor * 0.40)
      const baseFloor   = 0.05  // suelo mínimo: el bioluminiscente siempre respira

      // Normalización perfecta al rango [0, 1]:
      // (sin(a) + sin(b)*0.3 + 1.3) / 2.6
      // Demostración: máx = (1.0 + 0.3 + 1.3) / 2.6 = 1.0
      //               mín = (-1.0 - 0.3 + 1.3) / 2.6 = 0.0
      // Períodos reducidos a la mitad (~10s ciclo) para visibilidad real de olas.
      // Primos asíncronos garantizan que ningún par de PARs esté en fase.
      const waveFL = (Math.sin(t / 1831) + Math.sin(t / 1039) * 0.3 + 1.3) / 2.6
      const chillFrontL = baseFloor + waveFL * breathDepth

      const waveFR = (Math.cos(t / 1511) + Math.sin(t / 1361) * 0.3 + 1.3) / 2.6
      const chillFrontR = baseFloor + waveFR * breathDepth

      const waveBL = (Math.sin(t / 2003) + Math.sin(t / 1201) * 0.3 + 1.3) / 2.6
      const chillBackL  = baseFloor + waveBL * breathDepth

      const waveBR = (Math.cos(t / 1759) + Math.sin(t / 1069) * 0.3 + 1.3) / 2.6
      const chillBackR  = baseFloor + waveBR * breathDepth

      // Movers: reactivos a la música
      // frame.moverRight = envVocal  (swap semántico: vocal → L físico = La Voz del Mar)
      // frame.moverLeft  = envTreble (swap semántico: treble → R físico = La Bioluminiscencia)
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
