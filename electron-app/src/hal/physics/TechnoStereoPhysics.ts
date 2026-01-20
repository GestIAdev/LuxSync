/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔪 WAVE 770: TECHNO STEREO PHYSICS - THE BLADE
 * ═══════════════════════════════════════════════════════════════════════════
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
 * - context.spectral.harshness → Acid colors (0.6+ = toxic green)
 * - context.spectral.flatness → CO2/White Noise detection (0.7+ = strobe)
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
  /** 🔪 WAVE 770: Spectral harshness (0-1) - acid line detection */
  harshness?: number
  /** 🔪 WAVE 770: Spectral flatness (0-1) - noise/CO2 detection */
  flatness?: number
}

export interface TechnoPhysicsResult {
  strobeActive: boolean
  strobeIntensity: number
  frontParIntensity: number
  backParIntensity: number
  moverIntensity: number
  moverActive: boolean
  physicsApplied: 'techno'
  /** 🔪 WAVE 770: Acid mode detected (harshness > 0.6) */
  acidMode: boolean
  /** 🔪 WAVE 770: CO2/Noise mode detected (flatness > 0.7) */
  noiseMode: boolean
}

// ===========================================================================
// 🔪 WAVE 770: TECHNO STEREO PHYSICS ENGINE - THE BLADE
// ===========================================================================

export class TechnoStereoPhysics {
  // =========================================================================
  // LEGACY CONSTANTS (Colores/Strobe - WAVE 151)
  // =========================================================================
  
  private static readonly STROBE_BASE_THRESHOLD = 0.6;
  private static readonly STROBE_HUE = 300;           // Magenta neon
  private static readonly STROBE_SATURATION = 100;
  private static readonly STROBE_LIGHTNESS = 85;
  
  // =========================================================================
  // 🔪 WAVE 770: ZONE CONSTANTS - THE BLADE
  // 
  // FILOSOFÍA: Sin suavizado. Respuesta instantánea. Decay brutal.
  // =========================================================================
  
  // 🎯 MOVERS = TREBLE (Acid leads, synth stabs)
  private readonly TREBLE_VITAMIN = 2.5              // 🔪 SUBIDO de 2.2 (más agresivo)
  private readonly ACTIVATION_THRESHOLD = 0.12       // 🔪 BAJADO de 0.15 (más sensible)
  private readonly VISIBILITY_FLOOR = 0.15           // 🔪 BAJADO de 0.18 (menos floor)
  private readonly HYSTERESIS_MARGIN = 0.04          // 🔪 BAJADO de 0.06 (menos histéresis)
  // ❌ INTENSITY_SMOOTHING ERRADICADO - El techno no suaviza
  private readonly MIN_STABLE_FRAMES = 1             // 🔪 BAJADO de 2 (reacción más rápida)
  private readonly STROBE_THRESHOLD = 0.80           // 🔪 BAJADO de 0.85 (más strobo)
  private readonly STROBE_DURATION = 30              // 🔪 BAJADO de 40ms (flash más corto)
  
  // 🔊 FRONT PARS = BASS (Bombo 4x4, el corazón)
  // Gate BAJO para techno - el bombo es constante
  private readonly FRONT_PAR_GATE_ON = 0.30          // 🔪 BAJADO de 0.35 (más bombo)
  private readonly FRONT_PAR_GATE_OFF = 0.22         // 🔪 Histéresis estrecha
  
  // 🥁 BACK PARS = MID ("The Slap" - la bofetada de mamá)
  // Gate ALTO + Multiplicador BRUTAL = solo transientes
  private readonly BACK_PAR_GATE = 0.28              // 🔪 SUBIDO de 0.25 (solo picos)
  private readonly BACK_PAR_SLAP_MULT = 1.8          // 🔪 "The Slap" multiplicador
  
  // 🧪 SPECTRAL THRESHOLDS
  private readonly HARSHNESS_ACID_THRESHOLD = 0.60   // Umbral para modo ácido
  private readonly FLATNESS_NOISE_THRESHOLD = 0.70   // Umbral para modo noise/CO2
  
  // =========================================================================
  // INTERNAL STATE (Zonas)
  // =========================================================================
  
  private moverIntensityBuffer = 0
  private moverState = false
  private stabilityCounter = 0
  private strobeActive = false
  private strobeStartTime = 0
  private frontParSmoothed = 0
  private backParSmoothed = 0
  private frontParActive = false  // Estado para histéresis anti-parpadeo
  
  constructor() {
    console.log('[TechnoStereoPhysics] 🔪 WAVE 770: THE BLADE - Initialized')
  }
  
  // =========================================================================
  // LEGACY API - STATIC (Compatibilidad SeleneLux)
  // =========================================================================
  
  /**
   * LEGACY: Apply Techno strobe physics to palette.
   * Detecta drops y aplica strobe magenta neon.
   */
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics,
    mods?: ElementalModifiers
  ): TechnoLegacyResult {
    const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
    const brightnessMod = mods?.brightnessMultiplier ?? 1.0;
    
    const normalizedTreble = audio.normalizedTreble ?? 0;
    const normalizedBass = audio.normalizedBass ?? 0;
    
    // Ratio Bass/Treble para detectar drops
    const dropRatio = normalizedBass / Math.max(0.01, normalizedTreble);
    const effectiveThreshold = this.STROBE_BASE_THRESHOLD * thresholdMod;
    
    // Detectar strobe
    const isStrobeActive = normalizedTreble > effectiveThreshold && dropRatio < 2.0;
    
    let outputPalette = { ...palette };
    
    if (isStrobeActive) {
      const modulatedLightness = Math.min(100, this.STROBE_LIGHTNESS * brightnessMod);
      const strobeRgb = hslToRgb({ h: this.STROBE_HUE, s: this.STROBE_SATURATION, l: modulatedLightness });
      outputPalette.accent = strobeRgb;
    }
    
    return {
      palette: outputPalette,
      isStrobeActive,
      debugInfo: {
        normalizedTreble,
        normalizedBass,
        dropRatio,
        effectiveThreshold,
        strobeTriggered: isStrobeActive
      }
    };
  }
  
  // =========================================================================
  // 🔪 WAVE 770: NEW API - THE BLADE (Zonas/Intensidades)
  // =========================================================================
  
  /**
   * 🔪 Apply Techno zone physics - THE BLADE
   * 
   * Sin suavizado. Respuesta instantánea. Decay brutal de 1-2 frames.
   * Returns zone intensities, strobe state, and spectral modes.
   */
  public applyZones(input: TechnoPhysicsInput): TechnoPhysicsResult {
    const { bass, mid, treble, isRealSilence, isAGCTrap, harshness = 0, flatness = 0 } = input
    
    // 🧪 Detectar modos espectrales
    const acidMode = harshness > this.HARSHNESS_ACID_THRESHOLD
    const noiseMode = flatness > this.FLATNESS_NOISE_THRESHOLD
    
    if (isRealSilence || isAGCTrap) {
      return this.handleSilence(acidMode, noiseMode)
    }
    
    // 🔪 WAVE 770: Física SIN SUAVIZADO
    // Front = BASS (bombo 4x4)
    // Back = MID con "The Slap" (snare/clap brutal)
    // Movers = TREBLE vitaminado (acid leads)
    const frontParIntensity = this.calculateFrontPar(bass)
    const backParIntensity = this.calculateBackPar(mid)
    const moverResult = this.calculateMover(treble, acidMode)
    const strobeResult = this.calculateStrobe(treble, noiseMode)
    
    return {
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,
      frontParIntensity,
      backParIntensity,
      moverIntensity: moverResult.intensity,
      moverActive: moverResult.active,
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }
  
  public reset(): void {
    this.moverIntensityBuffer = 0
    this.moverState = false
    this.stabilityCounter = 0
    this.strobeActive = false
    this.strobeStartTime = 0
    this.frontParSmoothed = 0
    this.backParSmoothed = 0
    this.frontParActive = false
    console.log('[TechnoStereoPhysics] 🔪 Reset complete')
  }
  
  // =========================================================================
  // 🔪 WAVE 770: PRIVATE - Zone Calculations (THE BLADE)
  // =========================================================================
  
  private handleSilence(acidMode: boolean, noiseMode: boolean): TechnoPhysicsResult {
    // 🔪 WAVE 770: Decay INSTANTÁNEO en silencio
    // Multiplicador 0.5 = cae a 0 en 2 frames (antes era 0.85)
    this.moverIntensityBuffer = 0
    this.moverState = false
    this.stabilityCounter = 0
    this.strobeActive = false
    this.frontParSmoothed *= 0.50  // 🔪 Brutal decay
    this.backParSmoothed *= 0.50   // 🔪 Brutal decay
    
    // Floor cut: si es muy bajo, cortar a 0 limpio
    if (this.frontParSmoothed < 0.05) this.frontParSmoothed = 0
    if (this.backParSmoothed < 0.05) this.backParSmoothed = 0
    
    return {
      strobeActive: false,
      strobeIntensity: 0,
      frontParIntensity: this.frontParSmoothed,
      backParIntensity: this.backParSmoothed,
      moverIntensity: 0,
      moverActive: false,
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }
  
  /**
   * 🔊 Front PAR = BASS (Bombo 4x4) - EL CORAZÓN DEL TECHNO
   * 
   * WAVE 770 UPGRADES:
   * - Gate más bajo (0.30) para capturar más bombo
   * - Histéresis estrecha (0.08) para respuesta rápida
   * - Cap 0.85 (más headroom que antes)
   */
  private calculateFrontPar(bass: number): number {
    if (this.frontParActive) {
      // Ya encendido - apagar si baja mucho
      if (bass < this.FRONT_PAR_GATE_OFF) {
        this.frontParActive = false
        return 0
      }
    } else {
      // Apagado - encender si sube suficiente
      if (bass < this.FRONT_PAR_GATE_ON) {
        return 0
      }
      this.frontParActive = true
    }
    
    // 🔪 WAVE 770: Normalizar desde gate de encendido
    const gated = (bass - this.FRONT_PAR_GATE_ON) / (1 - this.FRONT_PAR_GATE_ON)
    // Curva agresiva: exponente 0.5 = más sensible a valores bajos
    const intensity = Math.pow(Math.max(0, gated), 0.5)
    return Math.min(0.85, Math.max(0, intensity))  // Cap 0.85
  }
  
  /**
   * 🥁 Back PAR = MID ("The Slap") - LA BOFETADA DE MAMÁ
   * 
   * WAVE 770 UPGRADES:
   * - Gate 0.28 (subido para filtrar voces)
   * - Multiplicador "The Slap" 1.8x (brutal)
   * - Cap 0.98 - SIEMPRE por encima de Front
   */
  private calculateBackPar(mid: number): number {
    // 🔪 Gate para filtrar voces, solo capturar snare/clap
    if (mid < this.BACK_PAR_GATE) {
      return 0
    }
    
    // 🔪 Normalizar desde gate
    const gated = (mid - this.BACK_PAR_GATE) / (1 - this.BACK_PAR_GATE)
    
    // 🔪 "The Slap" - Multiplicador BRUTAL
    // exponente 0.6 para expandir valores débiles
    // multiplicador 1.8 para que DUELA
    const intensity = Math.pow(gated, 0.6) * this.BACK_PAR_SLAP_MULT
    
    return Math.min(0.98, Math.max(0, intensity))  // Cap 0.98
  }
  
  /**
   * 🎯 Movers = TREBLE (Acid leads, synth stabs)
   * 
   * WAVE 770 UPGRADES:
   * - Sin suavizado (INTENSITY_SMOOTHING erradicado)
   * - Decay brutal: 5% retención = 0 en 1-2 frames
   * - acidMode: +20% vitamina cuando harshness alto
   */
  private calculateMover(treble: number, acidMode: boolean = false): { intensity: number; active: boolean } {
    // 🔪 Vitamina extra en modo ácido
    const vitamin = acidMode ? this.TREBLE_VITAMIN * 1.2 : this.TREBLE_VITAMIN
    const audioSignal = treble * vitamin
    const prevIntensity = this.moverIntensityBuffer
    const deactivationThreshold = Math.max(0.06, this.ACTIVATION_THRESHOLD - this.HYSTERESIS_MARGIN)
    
    let rawTarget = 0
    let shouldBeOn = this.moverState
    
    if (audioSignal > this.ACTIVATION_THRESHOLD) {
      shouldBeOn = true
      // Rampa desde 0.20 hasta 1.0
      rawTarget = 0.20 + (audioSignal - this.ACTIVATION_THRESHOLD) * 0.80 / (1 - this.ACTIVATION_THRESHOLD)
    } else if (audioSignal > deactivationThreshold && this.moverState) {
      shouldBeOn = true
      // 🔪 Retención mínima: 30% (antes era 40%)
      rawTarget = prevIntensity * 0.30
    } else {
      shouldBeOn = false
      rawTarget = 0
    }
    
    let finalState = this.moverState
    if (shouldBeOn !== this.moverState) {
      if (shouldBeOn) {
        // 🔪 ENCENDER = INSTANTÁNEO (0 frames de espera)
        finalState = true
        this.stabilityCounter = 0
      } else if (this.stabilityCounter >= this.MIN_STABLE_FRAMES) {
        // 🔪 APAGAR = 1 frame de estabilidad (era 2)
        finalState = false
        this.stabilityCounter = 0
      } else {
        this.stabilityCounter++
        finalState = this.moverState
        if (this.moverState && rawTarget === 0) {
          // 🔪 Decay más brutal: 50% (era 70%)
          rawTarget = prevIntensity * 0.50
        }
      }
    } else {
      this.stabilityCounter = 0
    }
    
    // 🔪 WAVE 770: SIN SMOOTHING - Respuesta directa
    let finalIntensity: number
    if (rawTarget > prevIntensity) {
      // ATTACK = INSTANTÁNEO (igual que antes, el techno no espera)
      finalIntensity = rawTarget
    } else {
      // 🔪 DECAY BRUTAL - 5% retención = cae a 0 en 1-2 frames
      // Antes era 10%. Ahora es KATANA.
      finalIntensity = prevIntensity * 0.05 + rawTarget * 0.95
    }
    
    // 🔪 Floor más bajo para cortes más limpios
    const cleanedIntensity = finalIntensity < this.VISIBILITY_FLOOR ? 0 : Math.min(1, finalIntensity)
    this.moverIntensityBuffer = cleanedIntensity
    this.moverState = cleanedIntensity > 0 ? finalState : false
    
    return { intensity: cleanedIntensity, active: this.moverState }
  }
  
  /**
   * ⚡ Strobe = TREBLE peaks + noiseMode
   * 
   * WAVE 770 UPGRADES:
   * - Duración más corta (30ms vs 40ms)
   * - noiseMode: baja threshold 20% (más strobo cuando hay noise)
   */
  private calculateStrobe(treble: number, noiseMode: boolean = false): { active: boolean; intensity: number } {
    const now = Date.now()
    
    // Fin del strobe actual
    if (this.strobeActive && now - this.strobeStartTime > this.STROBE_DURATION) {
      this.strobeActive = false
    }
    
    // 🔪 Threshold dinámico: más bajo en noiseMode (más strobo)
    const effectiveThreshold = noiseMode 
      ? this.STROBE_THRESHOLD * 0.80  // 20% más sensible con noise
      : this.STROBE_THRESHOLD
    
    // Disparar nuevo strobe
    if (treble > effectiveThreshold && !this.strobeActive) {
      this.strobeActive = true
      this.strobeStartTime = now
    }
    
    return { active: this.strobeActive, intensity: this.strobeActive ? 1.0 : 0 }
  }
}

// ===========================================================================
// SINGLETON EXPORT (para zonas)
// ===========================================================================

export const technoStereoPhysics = new TechnoStereoPhysics()
