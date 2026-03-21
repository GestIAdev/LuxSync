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
  isPLLBeat?: boolean // 🎯 WAVE 2305: LA ENTRADA DIVINA
  sectionType?: string
  harshness?: number
  flatness?: number
  crestFactor?: number // 🔍 WAVE 2340: Pico dinámico (Crest)/RMS para detectar boom vs compresión
  centroid?: number // 🔍 WAVE 2340: Centro de masa espectral (Hz), para frenar saturación aguda
  lowMid?: number // 🔍 WAVE 2340: Energía de medios-graves (808 / bajos sostenidos)
  spectralData?: {
    crestFactor?: number
    flatness?: number
    centroid?: number
  } // 🔍 WAVE 2343: Aggregate spectral metrics object
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

  // 🥁 BACK (SNARE SNIPER) - Resurrección (Importado de Latino)
  private readonly BACK_PAR_GATE = 0.50       // 🔪 Mantenemos el muro alto para que no entre basura
  private readonly BACK_PAR_SLAP_MULT = 5.0   // 🚀 BOOM. De 3.0 a 5.0 para bofetadas nucleares

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
  private lastLogTime = 0;
  private avgMidProfiler = 0.0;
  private lastFrontParFire = 0 // ⏱️ Memoria del cerrojo dinámico
  private kickEnvelope = 0
  private lastKickTrigger = false // 🔫 WAVE 2306: Memory del One-Shot Edge Detector

  // 🕵️‍♂️ WAVE 913: PARANOIA STATE (AGC Rebound Protection)
  private lastSilenceTime = 0
  private inSilence = false
  
  // 💥 WAVE 2341: FRONT PAR STATE (Autonomous decay & lockout)
  private bassThr = 0.0  // Auto-calibrating threshold
  private avgBass = 0.0  // 🌊 WAVE 2343: Moving average floor de graves (para detectar hits)
  private frontIntensity = 0.0  // Persistente intensity para decay orgánico
  private frontLockout = 0  // Frame counter para evitar re-triggers

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

    // =======================================================================
    // 🧬 1. MORFOLOGÍA LÍQUIDA: VISCOSIDAD ASIMÉTRICA (WAVE 2340)
    // =======================================================================
    
    // Inercia orgánica: Emoción rápida (Ataque 0.85), Caída densa (Decay 0.98)
    if (mid > this.avgMidProfiler) {
        this.avgMidProfiler = (this.avgMidProfiler * 0.85) + (mid * 0.15); 
    } else {
        this.avgMidProfiler = (this.avgMidProfiler * 0.98) + (mid * 0.02); 
    }
    
    // UMBRAL SAGRADO: Suelo en 0.30, techo en 0.70.
    const morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - 0.30) / 0.40));
    const dynamicSlapMult = this.BACK_PAR_SLAP_MULT * (1.0 - (morphFactor * 0.5));

    // GATES LÍQUIDOS: Bajamos los umbrales base para cazar el Melodic Techno
    // Front: de 0.55 (Hard) a 0.35 (Melodic)
    const currentFrontGate = 0.55 - (0.20 * morphFactor); 
    // Back: de 0.52 (Hard) a 0.28 (Melodic) -- Bajamos para rescatar claps sutiles
    const currentBackGate = 0.52 - (0.17 * morphFactor);

    // 🕵️‍♂️ MODOS Y SILENCIO
    const acidMode = harshness > this.HARSHNESS_ACID_THRESHOLD;
    const noiseMode = flatness > this.FLATNESS_NOISE_THRESHOLD;

    if (isRealSilence || isAGCTrap) {
      this.inSilence = true;
      this.lastSilenceTime = now;
      return this.handleSilence(acidMode, noiseMode);
    } else if (this.inSilence) {
      this.inSilence = false;
    }

    // =======================================================================
    // 💥 3. FRONT PAR: GOD EAR HUNTER (WAVE 2347 - El Tubo Arreglado)
    // =======================================================================
    
    // 1. TELEMETRÍA DE 4ª GENERACIÓN (Ahora sí, conectada y real)
    const currentCrestFactor = input.spectralData?.crestFactor ?? 0;
    const currentFlatness = input.spectralData?.flatness ?? 1.0;
    const currentCentroid = input.spectralData?.centroid ?? 0;

    // 2. EL SALTO PURO (Sin promedios ciegos)
    const bassSnap = Math.max(0, bass - (this.lastBass ?? 0));
    this.lastBass = bass;

    // 3. EL GATILLO ABSOLUTO
    const isBassHit = bassSnap > 0.05;

    // 4. LA INTELIGENCIA DEL CRESTFACTOR
    const isKickDetected = isBassHit && (currentCrestFactor > 10.0); 
    const isRollingBass = isBassHit && (currentCrestFactor <= 10.0) && (currentFlatness < 0.25);
    const centroidDucking = currentCentroid > 3500 ? 0.6 : 1.0; 

    // 5. CAÍDA LÍQUIDA (Garantiza el negro absoluto entre bombos a 140BPM)
    const frontDecay = 0.70 + (0.15 * morphFactor);
    this.frontIntensity = (this.frontIntensity ?? 0) * frontDecay; 

    // 6. CEREBRO Y CERROJO
    if ((this.frontLockout ?? 0) > 0) {
        this.frontLockout--; 
    } else if (isKickDetected) {
        // 🚀 BOMBO: Latigazo ciego. Sincronía 1:1.
        this.frontIntensity = Math.min(1.0, bass * (1.3 + 0.6 * morphFactor)) * centroidDucking;
        this.frontLockout = 5 + Math.floor(2 * morphFactor); 
    } else if (isRollingBass) {
        // 🌊 BAJO MELÓDICO: Glow envolvente.
        this.frontIntensity = Math.min(1.0, bass * 0.4) * centroidDucking;
        this.frontLockout = 3;
    }

    // 7. LIMPIEZA FINAL (Anti-minipulsos)
    let frontParIntensity = this.frontIntensity > 0.08 ? this.frontIntensity : 0;

    // =======================================================================
    // 🔍 MORPHOLOGÍA LÍQUIDA EXPANDIDA (Zona 0.30 - 0.70)
    // =======================================================================
    // (avgMidProfiler ya actualizado arriba)
    // 🛡️ LIMITADOR DE INTENSIDAD GLOBAL (Opción 1)
    // Si la morfología sube (Buildup/Melodic), bajamos el techo de luz
    // En Anyma/Psytrance, el multiplicador bajará de 5.0 a ~2.5 automáticamente.

    // =======================================================================
    // 2. BACK PAR: THE PROTECTED SNIPER (Con Vitamina Segura)
    // =======================================================================
    const transientImpact = Math.min(1.0, (treble * 1.3) + ((harshness ?? 0) * 0.8));
    
    // Filtro de voces original (Se mantiene idéntico, es seguro)
    const cleanMid = Math.max(0, mid - (1.0 - transientImpact) * mid * 0.7);
    
    // ⚡ LA VITAMINA SEGURA (El secreto que perdimos)
    // Multiplicar Harshness x Treble garantiza que NUNCA saltará con un bombo 
    // ni con una voz plana. Solo caza claps y snares, dándoles el empuje para cruzar la gate.
    const pureHarshness = (harshness ?? 0);
    const snareVitamin = pureHarshness * treble * (4.5 + 2.5 * morphFactor);

    const snarePower = Math.min(1.0, 
      (cleanMid * 0.05) +  // Ajustamos el cuerpo al 5% para que la luz sea rítmica y menos "lámpara"
      (transientImpact * (1.1 + 1.2 * morphFactor)) + // Base dinámica
      snareVitamin // 🚀 El latigazo que faltaba
    );

    let backParIntensity = 0;
    // Gate agresiva en modo Industrial (0.40), sensible en Melodic (0.20)
    const dynamicBackGate = 0.40 - (0.20 * morphFactor); 

    if (snarePower > dynamicBackGate) {
        const gated = (snarePower - dynamicBackGate) / (1.0 - dynamicBackGate);
        // Exponente 3.5: Cero miniflashes, solo latigazos
        backParIntensity = Math.pow(gated, 3.5) * dynamicSlapMult;
    }

// =======================================================================
    // 📊 TELEMETRÍA LUXSYNC (Caja Negra)
    // Descomenta para capturar tus 10 segundos de gloria
    // =======================================================================
    
    if (now - this.lastLogTime > 33) { 
       console.log(
         `[F] B:${bass.toFixed(2)} Snap:${bassSnap.toFixed(3)} Kick:${isKick ? 'Y':'N'} OUT:${frontParIntensity.toFixed(2)} | ` +
         `[B] M:${mid.toFixed(2)} T:${treble.toFixed(2)} SnP:${snarePower.toFixed(2)} OUT:${backParIntensity.toFixed(2)} | ` +
         `[M] Morph:${morphFactor.toFixed(2)}`
       );
       this.lastLogTime = now;
    }
    

    const rawLeft = Math.max(0, mid - (treble * 0.3));
    let moverL = this.calculateMoverChannel(rawLeft, this.MOVER_L_GATE, this.MOVER_L_BOOST);

    const rawRight = Math.max(0, treble - (mid * 0.2));
    let moverR = this.calculateMoverChannel(rawRight, this.MOVER_R_GATE, this.MOVER_R_BOOST);

    

    // =======================================================================
    // 3. THE SIDECHAIN GUILLOTINE & APOCALYPSE MODE
    // =======================================================================
    if (frontParIntensity > 0.1) {
      // 🔪 LEY ABSOLUTA: Si el bombo existe, aplasta el 90% de todo lo demás
      const ducking = 1.0 - (frontParIntensity * 0.90);
      backParIntensity *= ducking;
      moverL *= ducking;
      moverR *= ducking;
    } else {
      // 🚨 APOCALIPSIS: Solo se permite cuando el bombo está en silencio (Buildups/Risers)
      const isApocalypse = harshness > 0.55 && flatness > 0.55;
      if (isApocalypse) {
        const chaosEnergy = Math.max(mid, treble);
        backParIntensity = Math.max(backParIntensity, chaosEnergy);
        moverL = Math.max(moverL, chaosEnergy);
        moverR = Math.max(moverR, chaosEnergy);
      }
    }

    // Strobe (Treble peaks + Noise)
    const strobeResult = this.calculateStrobe(treble, noiseMode)

    // Memoria para el siguiente frame
    this.lastBass = bass

    return {
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,
      frontParIntensity,
      backParIntensity,
      moverIntensityL: moverL,
      moverIntensityR: moverR,
      moverIntensity: Math.max(moverL, moverR),
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

