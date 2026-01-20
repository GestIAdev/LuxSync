/**
 * ---------------------------------------------------------------------------
 * ?? WAVE 770: TECHNO STEREO PHYSICS - THE BLADE
 * ---------------------------------------------------------------------------
 * 
 * FILOSOFÍA: Convertir la física reactiva en un arma blanca.
 * Eliminar suavizado, maximizar agresión. El techno no perdona.
 * 
 * DIFERENCIAS CON OTROS VIBES:
 * - NO HAY INTENSITY_SMOOTHING (fue erradicado)
 * - Decay instantáneo (1-2 frames, no gradual)
 * - "The Slap": BACK_PAR multiplicador 1.8x + Gate alto
 * - Spectral integration (harshness, flatness)
 * 
 * ARQUITECTURA ZONE:
 * - FRONT PARs = BASS (Bombo 4x4, el corazón del techno)
 * - BACK PARs = MID con "The Slap" (snare/clap, bofetada brutal)
 * - MOVERS = TREBLE vitaminado (leads sintetizados, acid lines)
 * 
 * SPECTRAL FEATURES:
 * - context.spectral.harshness ? Acid colors (0.6+ = toxic green)
 * - context.spectral.flatness ? CO2/White Noise detection (0.7+ = strobe)
 * 
 * * CAMBIOS WAVE 906:
 * - ?? BASS ROIDS: Multiplicador x2.5 post-gate en FrontPars.
 * - ?? STEREO SPLIT: Movers L (Mids) vs Movers R (Treble).
 * - ?? BACK PAR SNIPER: Gate alto para aislar Snares de Melod�as.
 * 
 * @module hal/physics/TechnoStereoPhysics
 * @version WAVE 770 - THE BLADE
 */

import { hslToRgb } from '../../engine/color/SeleneColorEngine';
import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

// ===========================================================================
// TYPES - LEGACY API (Colores/Strobe)
// ===========================================================================

interface TechnoPalette {
  primary: { r: number; g: number; b: number };
  secondary: { r: number; g: number; b: number };
  accent: { r: number; g: number; b: number };
}

interface TechnoAudioMetrics {
  normalizedTreble: number;
  normalizedBass: number;
}

interface TechnoLegacyResult {
  palette: TechnoPalette;
  isStrobeActive: boolean;
  debugInfo: Record<string, unknown>;
}

// ===========================================================================
// TYPES - NEW API (Zonas/Intensidades)
// ===========================================================================

export interface TechnoPhysicsInput {
  bass: number
  mid: number
  treble: number
  bpm: number
  melodyThreshold: number
  isRealSilence: boolean
  isAGCTrap: boolean
  sectionType?: string
  harshness?: number
  flatness?: number
}

export interface TechnoPhysicsResult {
  strobeActive: boolean
  strobeIntensity: number
  frontParIntensity: number
  backParIntensity: number
  // ?? STEREO SPLIT: Intensidades separadas
  moverIntensityL: number  // Mids (Voces)
  moverIntensityR: number  // Treble (Melodías)
  moverIntensity: number   // Legacy fallback (Max L/R)
  moverActive: boolean
  physicsApplied: 'techno'
  acidMode: boolean
  noiseMode: boolean
}

// ===========================================================================
// ?? WAVE 906: TECHNO STEREO PHYSICS ENGINE
// ===========================================================================

export class TechnoStereoPhysics {
  // LEGACY CONSTANTS
  private static readonly STROBE_BASE_THRESHOLD = 0.6;
  private static readonly STROBE_HUE = 300;
  private static readonly STROBE_SATURATION = 100;
  private static readonly STROBE_LIGHTNESS = 85;

  // =========================================================================
  // 🛡️ WAVE 913: PARANOIA GATE - AGC Rebound Protection
  // =========================================================================

  // 🔊 FRONT (BASS) - Dry & Punchy (Corte militar)
  private readonly FRONT_PAR_GATE_ON = 0.48   // ⬆️ Más estricto (evita Sidechain accidental)
  private readonly FRONT_PAR_GATE_OFF = 0.35  // ⬆️ Corte alto (Secar el bajo)
  private readonly BASS_VITAMIN_BOOST = 1.8

  // 🛡️ PARANOIA GATE (Para el rebote del AGC)
  // Durante la recuperación post-silencio, exigimos un 80% de señal para encender
  // Esto filtra el ruido de fondo inflado, pero deja pasar el Drop (100%)
  private readonly RECOVERY_GATE_ON = 0.80    // 🚨 Gate paranoico post-silencio
  private readonly RECOVERY_GATE_OFF = 0.60   // 🚨 Gate off proporcionalmente alto
  private readonly RECOVERY_DURATION = 2000   // 2 segundos de desconfianza

  // 🥁 BACK (SNARE SNIPER - GEOMETRIC MEAN + NOISE GATE)
  // Media geométrica + Curva supresora de ruido
  private readonly BACK_PAR_GATE = 0.30
  private readonly BACK_PAR_SLAP_MULT = 5.0   // ⬆️ Compensar curva supresora (4.0→6.0)

  // 👯 MOVERS (STEREO SPLIT)
  
  // LEFT (Mid/Voces) - "The Body"
  private readonly MOVER_L_GATE = 0.20
  private readonly MOVER_L_BOOST = 4.0

  // RIGHT (Treble/Hats) - "SCHWARZENEGGER MODE" 🤖
  private readonly MOVER_R_GATE = 0.14        // 📉 Hypersensitive (confirmado)
  private readonly MOVER_R_BOOST = 10.0       // 💪 TERMINATOR BOOST (confirmado)

  // STROBE & MODES
  private readonly STROBE_THRESHOLD = 0.80
  private readonly STROBE_DURATION = 30
  private readonly HARSHNESS_ACID_THRESHOLD = 0.60
  private readonly FLATNESS_NOISE_THRESHOLD = 0.70

  // =========================================================================
  // INTERNAL STATE
  // =========================================================================

  private strobeActive = false
  private strobeStartTime = 0
  private frontParActive = false

  // 🕵️‍♂️ WAVE 913: PARANOIA STATE (AGC Rebound Protection)
  private lastSilenceTime = 0
  private inSilence = false

  constructor() {
    console.log('[TechnoStereoPhysics] 🛡️ WAVE 913: PARANOIA GATE - AGC Rebound Protection - Initialized')
  }

  // ... (LEGACY apply STATIC METHOD MANTENIDO IGUAL) ...
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics,
    mods?: ElementalModifiers
  ): TechnoLegacyResult {
      // (Mismo c�digo legacy para compatibilidad de colores)
      const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
      const brightnessMod = mods?.brightnessMultiplier ?? 1.0;
      const normalizedTreble = audio.normalizedTreble ?? 0;
      const normalizedBass = audio.normalizedBass ?? 0;
      const dropRatio = normalizedBass / Math.max(0.01, normalizedTreble);
      const effectiveThreshold = this.STROBE_BASE_THRESHOLD * thresholdMod;
      const isStrobeActive = normalizedTreble > effectiveThreshold && dropRatio < 2.0;
      let outputPalette = { ...palette };
      if (isStrobeActive) {
        const modulatedLightness = Math.min(100, this.STROBE_LIGHTNESS * brightnessMod);
        const strobeRgb = hslToRgb({ h: this.STROBE_HUE, s: this.STROBE_SATURATION, l: modulatedLightness });
        outputPalette.accent = strobeRgb;
      }
      return { palette: outputPalette, isStrobeActive, debugInfo: { normalizedTreble, normalizedBass, dropRatio, effectiveThreshold, strobeTriggered: isStrobeActive } };
  }

  // =========================================================================
  // ?? WAVE 906: NEW API
  // =========================================================================

  public applyZones(input: TechnoPhysicsInput): TechnoPhysicsResult {
    const { bass, mid, treble, isRealSilence, isAGCTrap, harshness = 0, flatness = 0 } = input
    const now = Date.now()

    // ?? Modos
    const acidMode = harshness > this.HARSHNESS_ACID_THRESHOLD
    const noiseMode = flatness > this.FLATNESS_NOISE_THRESHOLD

    // 🕵️‍♂️ WAVE 913: DETECCIÓN DE TRANSICIÓN DE SILENCIO
    if (isRealSilence || isAGCTrap) {
      this.inSilence = true
      this.lastSilenceTime = now // Actualizamos mientras dure el silencio
      return this.handleSilence(acidMode, noiseMode)
    } else {
      // Si acabamos de salir del silencio, this.inSilence será true
      if (this.inSilence) {
        this.inSilence = false
        // Aquí empieza el contador de "Recovery" (lastSilenceTime se queda fijo)
      }
    }

    // 🛡️ WAVE 913: CÁLCULO DE PARANOIA
    // ¿Cuánto tiempo ha pasado desde que volvió la música?
    const timeSinceSilence = now - this.lastSilenceTime
    const isRecovering = timeSinceSilence < this.RECOVERY_DURATION

    // 🔊 FRONT PAR: LÓGICA DINÁMICA
    // Si estamos recuperando, usamos el Gate Paranoico (0.80). Si no, el normal (0.48).
    const effectiveGateOn = isRecovering ? this.RECOVERY_GATE_ON : this.FRONT_PAR_GATE_ON
    // También subimos el Gate Off proporcionalmente para evitar colas largas sucias
    const effectiveGateOff = isRecovering ? this.RECOVERY_GATE_OFF : this.FRONT_PAR_GATE_OFF

    const frontParIntensity = this.calculateFrontPar(bass, effectiveGateOn, effectiveGateOff)

    // 🥁 BACK: THE SNARE SNIPER (Geometric Mean)
    // 🎯 WAVE 910: Multiplicamos Mid * Treble
    // Solo si hay AMBOS (Cuerpo + Brillo = Snare/Drop) la señal será fuerte
    // - Voces solas (Mid alto, Treble bajo) → sqrt(0.8 * 0.1) = 0.28 → APAGADO ❌
    // - Hats solos (Mid bajo, Treble alto) → sqrt(0.1 * 0.8) = 0.28 → APAGADO ❌
    // - SNARE (Mid 0.6, Treble 0.6) → sqrt(0.36) = 0.60 → ENCENDIDO ✅
    const snareSignal = Math.sqrt(mid * treble)
    let backParIntensity = this.calculateBackPar(snareSignal)

    // 👯 STEREO ALCHEMY (Sin cambios, funciona perfecto)
    
    // LEFT: Mid Dominante - "The Body"
    const rawLeft = Math.max(0, mid - (treble * 0.3))
    let moverL = this.calculateMoverChannel(rawLeft, this.MOVER_L_GATE, this.MOVER_L_BOOST)

    // RIGHT: Treble "The Sparkle"
    const rawRight = Math.max(0, treble - (mid * 0.2))
    let moverR = this.calculateMoverChannel(rawRight, this.MOVER_R_GATE, this.MOVER_R_BOOST)

    // � WAVE 910: GHOST KICK (Logic Sidechain)
    // Si hay mucho ruido (Trance/DnB) O el bajo es brutal,
    // usamos el BOMBO para empujar hacia abajo el resto
    // Esto crea dinámica artificial en muros de sonido
    
    // Detectamos "Muro de Sonido" si flatness es alto o si todo está alto
    const wallOfSound = flatness > 0.6 || (bass > 0.6 && mid > 0.6 && treble > 0.6)

    if (wallOfSound && frontParIntensity > 0.5) {
      // Ducking Factor: Cuanto más fuerte el bombo, más agachamos lo demás
      // Invertimos el bombo: 1.0 (golpe) -> 0.4 (ducking del 60%)
      const ducking = 1.0 - (frontParIntensity * 0.6)
      
      backParIntensity *= ducking
      moverL *= ducking
      moverR *= ducking
    }

    // Strobe (Treble peaks + Noise)
    const strobeResult = this.calculateStrobe(treble, noiseMode)

    return {
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,
      frontParIntensity,
      backParIntensity,
      moverIntensityL: moverL,
      moverIntensityR: moverR,
      moverIntensity: Math.max(moverL, moverR), // Fallback mono (Legacy)
      moverActive: (moverL > 0.1 || moverR > 0.1),
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }

  public reset(): void {
    this.strobeActive = false
    this.strobeStartTime = 0
    this.frontParActive = false
  }

  // =========================================================================
  // PRIVATE CALCULATIONS
  // =========================================================================

  private handleSilence(acidMode: boolean, noiseMode: boolean): TechnoPhysicsResult {
    return {
      strobeActive: false,
      strobeIntensity: 0,
      frontParIntensity: 0, // ?? Silencio absoluto instantáneo
      backParIntensity: 0,
      moverIntensityL: 0,
      moverIntensityR: 0,
      moverIntensity: 0,
      moverActive: false,
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }

  /**
   * 🔊 FRONT PAR (BASS) - AHORA ACEPTA GATES DINÁMICOS
   * 🛡️ WAVE 913: Soporta Recovery Gates para AGC Rebound Protection
   * 
   * @param bass - Señal de bajo normalizada
   * @param gateOn - Umbral de activación (dinámico: 0.48 normal / 0.80 paranoia)
   * @param gateOff - Umbral de desactivación (dinámico: 0.35 normal / 0.60 paranoia)
   */
  private calculateFrontPar(bass: number, gateOn: number, gateOff: number): number {
    if (this.frontParActive) {
      // Usamos el gateOff dinámico
      if (bass < gateOff) {
        this.frontParActive = false
        return 0
      }
    } else {
      // Usamos el gateOn dinámico
      if (bass < gateOn) return 0
      this.frontParActive = true
    }

    // Normalizamos usando el gate actual para mantener la curva correcta
    const gated = (bass - gateOn) / (1 - gateOn)

    // ?? INYECCIÓN DE VITAMINAS (Gain post-gate)
    // Multiplicamos para saturar rápido. Si bass es decente, llegamos al 100%.
    const boosted = gated * this.BASS_VITAMIN_BOOST

    // 3. Curva de potencia para mantener contraste en la bajada
    // x^2.0 es un buen compromiso entre golpe y sustain
    const intensity = Math.pow(Math.max(0, boosted), 2.0)

    return Math.min(1.0, Math.max(0, intensity)) // Cap al 100%
  }

  /**
   * 🥁 BACK PAR - THE CLEANER (NOISE GATE MODE)
   * 🧹 WAVE 911: Media geométrica + Curva supresora de ruido
   * 
   * Matemática:
   * - Signal ya viene como sqrt(mid * treble) desde applyZones
   * - Solo valores altos (Snare completo) pasan el gate 0.25
   * - 📉 CURVA x^1.5 (exponencial) → SUPRIME ruido, mantiene potencia
   *   * Valores débiles (synth ruido) → Se hacen invisibles
   *   * Valores fuertes (Snare) → Se mantienen fuertes
   * - Mult x6.0 → Compensar la supresión
   * 
   * @param signal - Media geométrica de mid y treble
   */
  private calculateBackPar(signal: number): number {
    if (signal < this.BACK_PAR_GATE) return 0

    const gated = (signal - this.BACK_PAR_GATE) / (1 - this.BACK_PAR_GATE)

    // 📉 CAMBIO DE CURVA: De 0.5 (inflar) a 1.5 (suprimir)
    // Esto actúa como un "Noise Gate" suave. Lo débil se hace invisible.
    // Lo fuerte (Snare) se mantiene fuerte.
    const intensity = Math.pow(gated, 0.9) * this.BACK_PAR_SLAP_MULT

    return Math.min(1.0, Math.max(0, intensity))
  }

  /**
   * 👯 MOVER CHANNEL - GENERIC GATE + BOOST
   * 🧹 WAVE 911: THE CLEANER
   * 
   * @param signal - Señal ya procesada con sustracción:
   *                 LEFT: Mid - 30% Treble (The Body)
   *                 RIGHT: Treble - 20% Mid (SCHWARZENEGGER MODE 🤖)
   * @param gate - Umbral de activación (RIGHT: 0.14 hypersensitive)
   * @param boost - Multiplicador de ganancia (RIGHT: x10.0 TERMINATOR)
   * 
   * NOTA: En "Wall of Sound", estos valores se reducen por ducking (sidechain)
   */
  private calculateMoverChannel(signal: number, gate: number, boost: number): number {
    if (signal < gate) return 0

    const gated = (signal - gate) / (1 - gate)
    
    // Boost masivo y curva rápida
    const intensity = Math.pow(gated, 1.2) * boost

    return Math.min(1.0, Math.max(0, intensity))
  }

  private calculateStrobe(treble: number, noiseMode: boolean): { active: boolean; intensity: number } {
    const now = Date.now()
    if (this.strobeActive && now - this.strobeStartTime > this.STROBE_DURATION) {
      this.strobeActive = false
    }
    
    const effectiveThreshold = noiseMode ? this.STROBE_THRESHOLD * 0.80 : this.STROBE_THRESHOLD
    
    if (treble > effectiveThreshold && !this.strobeActive) {
      this.strobeActive = true
      this.strobeStartTime = now
    }
    return { active: this.strobeActive, intensity: this.strobeActive ? 1.0 : 0 }
  }
}

export const technoStereoPhysics = new TechnoStereoPhysics()

