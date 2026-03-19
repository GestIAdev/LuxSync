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
  isKick?: boolean
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

  // 🔊 FRONT (BASS) - EL CERROJO ORGÁNICO
  private readonly FRONT_PAR_GATE_ON = 0.50   // 💥 Bajamos un poco para cazar más kicks
  private readonly FRONT_PAR_GATE_OFF = 0.35  // 🔪 Suelo razonable para el decay
  private readonly BASS_VITAMIN_BOOST = 3.0   // 🚀 Empuje para el cuerpo de la luz
  private readonly FRONT_MAX_INTENSITY = 0.80 // 🚨 EL TECHO DEL 80%

  // 🛡️ PARANOIA GATE (Para el rebote del AGC)
  // Durante la recuperación post-silencio, exigimos un 80% de señal para encender
  // Esto filtra el ruido de fondo inflado, pero deja pasar el Drop (100%)
  private readonly RECOVERY_GATE_ON = 0.80    // 🚨 Gate paranoico post-silencio
  private readonly RECOVERY_GATE_OFF = 0.60   // 🚨 Gate off proporcionalmente alto
  private readonly RECOVERY_DURATION = 2000   // 2 segundos de desconfianza

  // 🥁 BACK (SNARE SNIPER) - Resurrección
  private readonly BACK_PAR_GATE = 0.35       // 📉 Bajamos el gate para que pase la señal
  private readonly BACK_PAR_SLAP_MULT = 3.0   // Multiplicador razonable

  // 👯 MOVERS (STEREO SPLIT)
  
  // LEFT (Mid/Voces) - "The Body"
  private readonly MOVER_L_GATE = 0.20
  private readonly MOVER_L_BOOST = 4.0

  // RIGHT (Treble/Hats) - "SCHWARZENEGGER MODE" 🤖
  private readonly MOVER_R_GATE = 0.14        // 📉 Hypersensitive (confirmado)
  private readonly MOVER_R_BOOST = 8.0       // 💪 TERMINATOR BOOST (confirmado)

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
  private lastBass = 0
  private kickEnvelope = 0

  // 🕵️‍♂️ WAVE 913: PARANOIA STATE (AGC Rebound Protection)
  private lastSilenceTime = 0
  private inSilence = false
  

  constructor() {
    // WAVE 2098: Boot silence
  }

  // ... (LEGACY apply STATIC METHOD MANTENIDO IGUAL) ...
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics,
    mods?: ElementalModifiers
  ): TechnoLegacyResult {
      // (Mismo codigo legacy para compatibilidad de colores)
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
    // 🔥 WAVE 1012: Defaults inteligentes para métricas espectrales
    // Sin estos, acidMode/noiseMode/atmosphericFloor quedan MUERTOS
    const { 
      bass, 
      mid, 
      treble, 
      isRealSilence, 
      isAGCTrap, 
      isKick = false,
      harshness = 0.45,  // 🎛️ Default agresivo (Techno = duro)
      flatness = 0.35    // 🎛️ Default para pads/atmos
    } = input
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

    //  FRONT PAR: TRIGGER DIRECTO DEL FFT
    if (isKick) {
      this.kickEnvelope = 1.0;
    } else {
      // Decay artificial rápido (corta la cola muerta en ~3 frames)
      this.kickEnvelope *= 0.70;
    }

    let frontParIntensity = 0
    // Cortamos en 0.15 para asegurar un blackout total rápido en el hardware
    if (this.kickEnvelope > 0.15) {
      frontParIntensity = this.kickEnvelope * this.FRONT_MAX_INTENSITY;
    }

    // 💊 WAVE 2187: LAS VITAMINAS REFORMULADAS (Resurrección del Snare)
    // 💊 WAVE 2187: LAS VITAMINAS REFORMULADAS (Recorte de grasa)
    // 🥁 WAVE 2187.2: SNARE ISOLATION (Muerte a los hi-hats huérfanos)
    // 🥁 WAVE 2187.2: SNARE ISOLATION (Muerte a los hi-hats huérfanos)
    // Un snare tiene CUERPO (mid) y LATIGAZO (treble). Un hi-hat solo treble.
    // Al requerir la multiplicación de ambos, los hi-hats se filtran.
    const snareAndSynthPower = Math.min(1.0, 
      (mid * 0.25) +               // Un poco de presencia base
      (mid * treble * 1.8)         // 🪄 LA MAGIA: Si no hay mid, el treble pesado vale cero.
    );
    let backParIntensity = this.calculateBackPar(snareAndSynthPower)

    // 👯 STEREO ALCHEMY
    
    // LEFT: Mid Dominante - "The Body"
    const rawLeft = Math.max(0, mid - (treble * 0.3))
    let moverL = this.calculateMoverChannel(rawLeft, this.MOVER_L_GATE, this.MOVER_L_BOOST)

    // RIGHT: Treble "The Sparkle"
    const rawRight = Math.max(0, treble - (mid * 0.2))
    let moverR = this.calculateMoverChannel(rawRight, this.MOVER_R_GATE, this.MOVER_R_BOOST)

    // 🔥 WAVE 1014.5: ATMOSPHERIC FLOOR ELIMINADO
    // Causaba "hilito permanente" - Los Movers ahora se apagan cuando deben, como los PARs

    // 🔥 WAVE 916: APOCALYPSE DETECTION
    // Si hay mucha distorsión (harshness) Y mucho ruido blanco (flatness),
    // asumimos que es un Riser/Upswing aunque no haya bajos.
    const isApocalypse = harshness > 0.5 && flatness > 0.5

    // 🚑 WAVE 916: APOCALYPSE OVERRIDE
    // Si estamos en el apocalipsis, NO nos importa si no hay bajo.
    // Usamos la energía del ruido (treble/mid) para encender TODAS LAS LUCES.
    if (isApocalypse) {
      // Calculamos la "Energía del Caos"
      const chaosEnergy = Math.max(mid, treble)
      
      // EXENTO: El Front PAR (Bombo) es sagrado, no lo tocamos.
      
      // Solo encendemos el resto con el caos
      backParIntensity = Math.max(backParIntensity, chaosEnergy)
      moverL = Math.max(moverL, chaosEnergy)
      moverR = Math.max(moverR, chaosEnergy)
      
      // NOTA: Al forzar esto, el "Ghost Kick" (sidechain) queda anulado implícitamente
      // porque estamos sobrescribiendo los valores al final.
    } else {
      // 🔪 LÓGICA TECHNO: THE SIDECHAIN GUILLOTINE
      // Siempre que el Front PAR (Bombo) dispare, aplastamos el resto de luces.
      // Esto crea el "Espacio Negativo" necesario para el Techno.
      if (frontParIntensity > 0.1) {
        // Ducking Extremo: Un bombo al 100% apaga las demás luces en un 80%
        const ducking = 1.0 - (frontParIntensity * 0.8);
        
        backParIntensity *= ducking
        moverL *= ducking
        moverR *= ducking
      }
    }

    // Strobe (Treble peaks + Noise)
    const strobeResult = this.calculateStrobe(treble, noiseMode)

    // Guardamos el nivel actual de bass para el siguiente frame (Transient detection)
    this.lastBass = bass

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
    this.kickEnvelope = 0
  }

  // =========================================================================
  // PRIVATE CALCULATIONS
  // =========================================================================

  private handleSilence(acidMode: boolean, noiseMode: boolean): TechnoPhysicsResult {
    // A clean silence resets the sidechain envelope to avoid ghosting.
    this.kickEnvelope = 0

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

    // 📉 Curva x^1.5 (El x^3 era un agujero negro que se tragaba la luz)
    const intensity = Math.pow(gated, 1.5) * this.BACK_PAR_SLAP_MULT

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

