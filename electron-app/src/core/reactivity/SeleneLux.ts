/**
 * 🌙 WAVE 274: SELENE LUX - THE NERVOUS SYSTEM
 * ============================================================================
 * 
 * Sistema Nervioso de LuxSync. Recibe órdenes de TitanEngine y las traduce
 * a impulsos físicos específicos por género (StereoPhysics).
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Recibir updateFromTitan() con paleta base + vibe + elementalMods
 * - Despachar a los micromotores físicos (Techno, Rock, Latino, Chill)
 * - Devolver la paleta procesada con reactividad aplicada
 * 
 * FILOSOFÍA:
 * - NO conoce audio directamente (lo recibe de TitanEngine)
 * - NO genera colores (los recibe ya calculados)
 * - SOLO aplica física de reactividad según el género
 * 
 * 📜 WAVE 450 ENMIENDA: ENERGY OVERRIDE
 * Si energy > 0.85, los modificadores de consciencia son IGNORADOS.
 * La física tiene VETO TOTAL en los drops/clímax.
 * "En los drops, la física manda. En los valles, Selene piensa."
 * 
 * @layer CORE (Sistema Nervioso)
 * @version WAVE 450 - Consciousness Integration
 */

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

import { 
  TechnoStereoPhysics,
  technoStereoPhysics,
  RockStereoPhysics2,    // 🎸 WAVE 1011.5: UNIFIED ARCHITECTURE (Lobotomized)
  rockPhysics2,          // 🎸 WAVE 1011.5: Singleton instance
  LatinoStereoPhysics, 
  calculateChillStereo,
  type RockPhysicsInput, // 🎸 WAVE 1011.5: Unified input type
  // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Physics
  LaserPhysics,
  laserPhysics,
  type LaserPhysicsInput,
  WasherPhysics,
  washerPhysics,
  type WasherPhysicsInput,
} from '../../hal/physics';

import { 
  ElementalModifiers, 
  getModifiersFromKey 
} from '../../engine/physics/ElementalModifiers';

import type { ColorPalette } from '../protocol/LightingIntent';

import {
  type ConsciousnessPhysicsModifier,
  ENERGY_OVERRIDE_THRESHOLD,
  isEnergyOverrideActive,
  applyEnergyOverride,
} from '../protocol/ConsciousnessOutput';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * RGB simple para procesamiento interno
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Métricas de audio normalizadas que recibimos de TitanEngine
 * 🎸 WAVE 1011: Extended con métricas espectrales para RockStereoPhysics2
 * 🔮 WAVE 1026: ROSETTA STONE - ultraAir for lasers/scanners
 * 🟢🎨 WAVE 1031: THE PHOTON WEAVER - texture for spectral routing
 */
export interface SeleneLuxAudioMetrics {
  normalizedBass: number;     // 0-1
  normalizedMid: number;      // 0-1
  normalizedTreble: number;   // 0-1
  avgNormEnergy: number;      // 0-1
  
  // 🎸 WAVE 1011: Métricas espectrales avanzadas (FFT.ts)
  subBass?: number;           // 0-1 (20-60Hz kicks profundos)
  lowMid?: number;            // 0-1 (250-500Hz)
  highMid?: number;           // 0-1 (2000-4000Hz)
  harshness?: number;         // 0-1 (ratio 2-5kHz vs total)
  spectralFlatness?: number;  // 0-1 (0=tonal, 1=noise)
  spectralCentroid?: number;  // Hz (brillo tonal)
  
  // 🔮 WAVE 1018+1026: Clarity for production quality detection
  clarity?: number;           // 0-1 (0=ruidoso, 1=limpio)
  
  // 🔮 WAVE 1026: ROSETTA STONE - Ultra Air band for lasers/scanners
  ultraAir?: number;          // 0-1 (16-22kHz shimmer/sparkle)
  
  // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Texture for spectral routing
  texture?: 'clean' | 'warm' | 'harsh' | 'noisy';  // Audio texture classification
  
  // 🎸 WAVE 1011: Detección de transientes
  kickDetected?: boolean;
  snareDetected?: boolean;
  hihatDetected?: boolean;

  // ⏱️ WAVE 2305: THE INFALLIBLE METRONOME (Hardware-agnostic trigger)
  isPLLBeat?: boolean;
  // 💥 WAVE 2347: crestFactor — relación pico/RMS espectral
  crestFactor?: number;
}

/**
 * Contexto del Vibe actual
 */
export interface SeleneLuxVibeContext {
  activeVibe: string;         // 'techno', 'rock', 'latino', 'chill', etc.
  primaryHue: number;         // 0-360 - Hue base para efectos de color
  stableKey: string | null;   // Key musical estabilizada (C, D, E...)
  bpm?: number;               // BPM para subgénero latino
  section?: string;           // 🆕 WAVE 290: 'verse' | 'chorus' | 'drop' | 'break' - Para White Puncture
}

/**
 * Resultado del procesamiento físico
 * 
 * 🌊 WAVE 1035: Expandido para soportar 7-Zone Stereo Architecture
 */
export interface SeleneLuxOutput {
  palette: {
    primary: RGB;
    secondary: RGB;
    ambient: RGB;
    accent: RGB;
  };
  /** 🎚️ WAVE 275: Intensidades por zona basadas en frecuencias */
  /** 🌊 WAVE 1035: Añadido soporte para Front/Back L/R stereo */
  zoneIntensities: {
    front: number;   // 0-1: Bass → Front PARs (Kick/Graves) - LEGACY mono
    back: number;    // 0-1: Mid → Back PARs (Snare/Clap) - LEGACY mono
    mover: number;   // 0-1: Treble → Movers (Melodía/Voz) - LEGACY mono
    moverL?: number; // 🧪 WAVE 908: LEFT mover (Mid-dominant)
    moverR?: number; // 🧪 WAVE 908: RIGHT mover (Treble-dominant)
    // 🌊 WAVE 1035: 7-Zone Stereo Architecture (Chill Pilot)
    frontL?: number; // Front Left PARs
    frontR?: number; // Front Right PARs
    backL?: number;  // Back Left PARs
    backR?: number;  // Back Right PARs
    // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - New spectral zones
    laser?: number;  // 0-1: UltraAir → Lasers (16-22kHz shimmer)
    washer?: number; // 0-1: SubBass → Washers (20-60Hz atmosphere)
  };
  isStrobeActive: boolean;
  isFlashActive: boolean;
  isSolarFlare: boolean;
  dimmerOverride: number | null;
  forceMovement: boolean;
  physicsApplied: string;     // 'techno' | 'rock' | 'latino' | 'chill' | 'none'
  /** 🧠 WAVE 450: Indica si Energy Override está activo */
  energyOverrideActive: boolean;
  // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Extended physics info
  laserPhysics?: {
    mode: string;
    beamWidth: number;
    scanSpeed: number;
    safetyTriggered: boolean;
  };
  washerPhysics?: {
    mode: string;
    colorTransitionSpeed: number;
    impactActive: boolean;
    breathingFactor: number;
  };
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 1046: THE MECHANICS BYPASS
  // Coordenadas de movimiento calculadas por la física (THE DEEP FIELD)
  // Si existen, TitanEngine las usa EN VEZ DEL VMM
  // 🌊 WAVE 1072: colorOverride REMOVED - now uses oceanicModulation in SeleneColorEngine
  // ═══════════════════════════════════════════════════════════════════════════
  mechanics?: {
    moverL: { pan: number; tilt: number; intensity: number };  // 0-1 normalized
    moverR: { pan: number; tilt: number; intensity: number };  // 0-1 normalized
    // colorOverride: DEPRECATED in WAVE 1072
    source: string;  // 'THE_DEEP_FIELD' | 'CELESTIAL_MOVERS' etc
  };
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1070.6: THE LIVING OCEAN - Oceanic Creature Triggers
  // Flags for TitanEngine to dispatch oceanic effects via EffectManager
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎭 WAVE 1074: MICRO-FAUNA INTEGRATION - Extended with 4 ambient fillers
  oceanicTriggers?: {
    // MAJOR EFFECTS (45-90s cooldowns)
    solarCaustics: boolean;      // SHALLOWS (0-1000m)
    schoolOfFish: boolean;       // OCEAN (1000-3000m)
    whaleSong: boolean;          // TWILIGHT (3000-6000m)
    abyssalJellyfish: boolean;   // MIDNIGHT (6000+m)
    // MICRO-FAUNA FILLERS (18-35s cooldowns)
    surfaceShimmer: boolean;     // SHALLOWS (0-1000m) - Subtle light play
    planktonDrift: boolean;      // OCEAN (1000-3000m) - Ambient particles
    deepCurrentPulse: boolean;   // TWILIGHT (3000-6000m) - Flow patterns
    bioluminescentSpore: boolean; // MIDNIGHT (6000+m) - Organic glow
  };
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Musical Context
  // Modulation hints for SeleneColorEngine when in Chill vibe
  // ═══════════════════════════════════════════════════════════════════════════
  oceanicContext?: {
    hueInfluence: number;          // Suggested hue (degrees 0-360)
    hueInfluenceStrength: number;  // How strongly to apply (0-1)
    saturationMod: number;         // Saturation modifier (-30 to +30)
    lightnessMod: number;          // Lightness modifier (-20 to +20)
    translatedSection: string;     // 'intro'|'verse'|'bridge'|'breakdown'|'ambient'
    translatedEnergy: number;      // Energy (0-1)
    translatedEmotion: string;     // 'serene'|'contemplative'|'melancholic'|'ethereal'
    depth: number;                 // Current depth in meters
    zone: string;                  // 'SHALLOWS'|'OCEAN'|'TWILIGHT'|'MIDNIGHT'
    tidePhase: number;             // Tide phase (0-1)
    breathingFactor: number;       // Audio-modulated breathing (0.85-1.15)
  };
  debugInfo?: Record<string, unknown>;
}

/**
 * Configuración de SeleneLux
 */
export interface SeleneLuxConfig {
  debug?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SELENE LUX CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌙 SELENE LUX - Sistema Nervioso de Iluminación
 * 
 * Transforma paletas estáticas en paletas reactivas aplicando
 * física de género (strobes, flashes, solar flares, breathing).
 */
export class SeleneLux {
  private debug: boolean;
  private frameCount = 0;
  
  // Instancias de física stateful (Latino, Chill y Rock necesitan estado)
  private latinoPhysics: LatinoStereoPhysics;
  // 🟢 WAVE 1043.2: Chill uses functional approach (calculateChillStereo)
  // 🎸 WAVE 1011: HIGH VOLTAGE - RockStereoPhysics2 con 4 bandas + subgéneros
  // ❌ BORRADO: private rockPhysics: RockStereoPhysics (legacy Frankenstein)
  
  // Estado del último frame
  private lastOutput: SeleneLuxOutput;
  private lastStrobeActive = false;
  private lastForceMovement = false;
  
  // 🆕 WAVE 288.1: Throttling de logs para latino
  private lastLatinoLogTime = 0;           // Timestamp último log
  private lastLatinoFlavor: string | null = null;  // Último flavor loguado
  private readonly LOG_THROTTLE_MS = 2000;  // 2 segundos mínimo entre logs
  
  // 🆕 WAVE 288.7: Overrides de intensidad calculados por motor Latino
  private latinoOverrides: { 
    front: number; 
    back: number; 
    mover: number;
    moverL?: number;  // 🎺 WAVE 1004.1: Split L channel (Mid - El Galán)
    moverR?: number;  // 🎺 WAVE 1004.1: Split R channel (Treble - La Dama)
  } | null = null;
  
  // 🆕 WAVE 290.3: Overrides de intensidad calculados por motor Techno
  private technoOverrides: { 
    front: number; 
    back: number; 
    mover: number;
    moverL?: number;  // 🧪 WAVE 908: Split L channel
    moverR?: number;  // 🧪 WAVE 908: Split R channel
  } | null = null;
  
  // � WAVE 1011: HIGH VOLTAGE ROCK - Overrides con L/R split para Movers
  private rockOverrides: { 
    front: number; 
    back: number; 
    moverLeft: number;   // 🎸 WAVE 1011: The Body (riffs, wall of sound)
    moverRight: number;  // 🎸 WAVE 1011: The Shine (solos, platos)
    subgenre: string;    // 🎸 WAVE 1011: Subgénero detectado (metal/indie/prog/classic)
  } | null = null;
  
  // 🆕 WAVE 315: CHILL BREATHING - Overrides de bioluminiscencia
  // 🔥 WAVE 1032.9: Agregado moverL/moverR para burbujas independientes
  // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R para oscilación lateral
  // 🌌 WAVE 1044: THE DEEP FIELD - Air zone para futuro láser cósmico
  private chillOverrides: { 
    front: number; 
    back: number; 
    mover: number;   // Legacy: promedio para compatibilidad
    moverL: number;  // 🫧 WAVE 1032.9: Burbuja izquierda
    moverR: number;  // 🫧 WAVE 1032.9: Burbuja derecha
    // 🌊 WAVE 1035: 7-Zone Stereo Architecture
    frontL?: number; // Front Left Pars
    frontR?: number; // Front Right Pars
    backL?: number;  // Back Left Pars
    backR?: number;  // Back Right Pars
    // 🌌 WAVE 1044: THE DEEP FIELD - Reservado para láser cósmico
    air?: number;    // Canal atmosférico (láser/haze)
  } | null = null;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement coordinates from physics
  // 🌊 WAVE 1072: colorOverride REMOVED - now uses oceanicModulation
  // ═══════════════════════════════════════════════════════════════════════
  private deepFieldMechanics: {
    moverL: { pan: number; tilt: number; intensity: number };
    moverR: { pan: number; tilt: number; intensity: number };
    // colorOverride removed in WAVE 1072 - ocean colors flow through SeleneColorEngine
  } | null = null;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1070.6: THE LIVING OCEAN - Oceanic Creature Triggers
  // 🎭 WAVE 1074: MICRO-FAUNA INTEGRATION - Extended with 4 ambient fillers
  // ═══════════════════════════════════════════════════════════════════════
  private oceanicTriggersState: {
    // MAJOR EFFECTS
    solarCaustics: boolean;
    schoolOfFish: boolean;
    whaleSong: boolean;
    abyssalJellyfish: boolean;
    // MICRO-FAUNA FILLERS
    surfaceShimmer: boolean;
    planktonDrift: boolean;
    deepCurrentPulse: boolean;
    bioluminescentSpore: boolean;
  } | null = null;

  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Musical Context
  // Permite a SeleneColorEngine modular paletas basándose en profundidad
  // ═══════════════════════════════════════════════════════════════════════
  private oceanicContextState: {
    hueInfluence: number;
    hueInfluenceStrength: number;
    saturationMod: number;
    lightnessMod: number;
    translatedSection: string;
    translatedEnergy: number;
    translatedEmotion: string;
    depth: number;
    zone: string;
    tidePhase: number;
    breathingFactor: number;
  } | null = null;

  // ═══════════════════════════════════════════════════════════════════════
  // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Physics State
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🟢 LASER: Intensidad y metadata del último frame
  private laserResult: {
    intensity: number;
    mode: string;
    beamWidth: number;
    scanSpeed: number;
    safetyTriggered: boolean;
  } | null = null;
  
  // 🎨 WASHER: Intensidad y metadata del último frame
  private washerResult: {
    intensity: number;
    mode: string;
    colorTransitionSpeed: number;
    impactActive: boolean;
    breathingFactor: number;
  } | null = null;
  
  constructor(config: SeleneLuxConfig = {}) {
    this.debug = config.debug ?? false;
    
    // Inicializar físicas stateful
    this.latinoPhysics = new LatinoStereoPhysics();
    // 🟢 WAVE 1043.2: Chill is stateless functional
    // 🎸 WAVE 1011: RockStereoPhysics2 usa singleton (rockPhysics2)
    // ❌ BORRADO: this.rockPhysics = new RockStereoPhysics() (legacy Frankenstein)
    
    // Output por defecto
    this.lastOutput = {
      palette: {
        primary: { r: 128, g: 64, b: 64 },
        secondary: { r: 100, g: 50, b: 50 },
        ambient: { r: 80, g: 40, b: 40 },
        accent: { r: 150, g: 75, b: 75 },
      },
      // 🎚️ WAVE 275: Zone intensities por defecto
      zoneIntensities: {
        front: 0,
        back: 0,
        mover: 0,
      },
      isStrobeActive: false,
      isFlashActive: false,
      isSolarFlare: false,
      dimmerOverride: null,
      forceMovement: false,
      physicsApplied: 'none',
      energyOverrideActive: false,  // 🧠 WAVE 450
    };
    // WAVE 2098: Boot silence
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🧠 Recibe actualización desde TitanEngine y aplica física reactiva
   * 
   * @param vibeContext - Contexto del vibe activo
   * @param basePalette - Paleta calculada por SeleneColorEngine
   * @param audioMetrics - Métricas de audio normalizadas
   * @param elementalMods - Modificadores zodiacales (WAVE 273)
   */
  public updateFromTitan(
    vibeContext: SeleneLuxVibeContext,
    basePalette: ColorPalette,
    audioMetrics: SeleneLuxAudioMetrics,
    elementalMods?: ElementalModifiers
  ): SeleneLuxOutput {
    this.frameCount++;
    
    // Convertir ColorPalette a RGB interno
    const inputPalette = this.colorPaletteToRgb(basePalette);
    
    // Detectar género del vibe
    const vibeNormalized = vibeContext.activeVibe.toLowerCase();
    
    // Reset estado
    let isStrobeActive = false;
    let isFlashActive = false;
    let isSolarFlare = false;
    let dimmerOverride: number | null = null;
    let forceMovement = false;
    let physicsApplied = 'none';
    let outputPalette = { ...inputPalette };
    let debugInfo: Record<string, unknown> = {};
    
    // ─────────────────────────────────────────────────────────────────────
    // PHYSICS DISPATCH POR GÉNERO
    // ─────────────────────────────────────────────────────────────────────
    
    if (vibeNormalized.includes('techno') || vibeNormalized.includes('electro')) {
      // ⚡ TECHNO: Industrial Strobe Physics
      // 1. API Legacy para colores/strobe
      const result = TechnoStereoPhysics.apply(
        inputPalette,
        {
          normalizedTreble: audioMetrics.normalizedTreble,
          normalizedBass: audioMetrics.normalizedBass,
        },
        elementalMods
      );
      
      outputPalette.accent = result.palette.accent;
      isStrobeActive = result.isStrobeActive;
      physicsApplied = 'techno';
      debugInfo = result.debugInfo;
      
      // 2. WAVE 290.3: Nueva API para zonas/intensidades
      // 🔥 WAVE 1012: TECHNO NEEDS SPECTRAL DATA!
      // Sin harshness/flatness, Techno opera en modo degradado (acidMode=false, noiseMode=false)
      // Esto mata el atmosphericFloor y el Apocalypse Detection
      const zonesResult = technoStereoPhysics.applyZones({
        bass: audioMetrics.normalizedBass,
        mid: audioMetrics.normalizedMid,
        treble: audioMetrics.normalizedTreble,
        bpm: vibeContext.bpm ?? 120,
        melodyThreshold: 0.4,
        isRealSilence: audioMetrics.avgNormEnergy < 0.01,
        isAGCTrap: false,
        isKick: audioMetrics.kickDetected ?? false,
        isPLLBeat: audioMetrics.isPLLBeat ?? false,  // 🎯 WAVE 2305: EL CABLE CONECTADO
        sectionType: vibeContext.section,
        // 🎛️ WAVE 1012: Métricas espectrales para Acid/Noise modes
        harshness: audioMetrics.harshness ?? 0.45,      // Default más agresivo que Rock (Techno = duro)
        flatness: audioMetrics.spectralFlatness ?? 0.35,  // Default para pads/atmos
        // 💥 WAVE 2347: EL TUBO ARREGLADO — spectralData ahora llega a la física
        crestFactor: audioMetrics.crestFactor,  // RAW (sin EMA) - WAVE 2363
        sub: audioMetrics.subBass,              // 💥 WAVE 2363: SubBass RAW (20-60Hz) para rumble detector
        spectralData: {
          crestFactor: audioMetrics.crestFactor,
          flatness: audioMetrics.spectralFlatness,
          centroid: audioMetrics.spectralCentroid,
        }
      });
      
      // Guardar overrides para usar después
      // 🧪 WAVE 908: Guardar L/R separados para THE DUEL
      this.technoOverrides = {
        front: zonesResult.frontParIntensity,
        back: zonesResult.backParIntensity,
        mover: zonesResult.moverIntensity,  // Legacy fallback
        moverL: zonesResult.moverIntensityL, // Split L (Mid-dominant)
        moverR: zonesResult.moverIntensityR  // Split R (Treble-dominant)
      };
      
      // 🔥 WAVE 2212: Log de strobe eliminado — spameaba a 60fps bloqueando el logging útil
      
    } else if (vibeNormalized.includes('rock') || vibeNormalized.includes('pop')) {
      // ═══════════════════════════════════════════════════════════════════════
      // 🎸 WAVE 1011.5: UNIFIED ROCK PHYSICS (LOBOTOMIZED)
      // ═══════════════════════════════════════════════════════════════════════
      // ARQUITECTURA UNIFICADA - Sin subgéneros, modulación lineal:
      //   - Front: Low-Mid (guitar/bass fundamentals)
      //   - Back: Sub-Bass + harshness modulation (atmospheric depth)
      //   - MoverLeft: High-Mid (guitar crunch)
      //   - MoverRight: Presence (cymbal attacks, harmonics)
      // 
      // MODULADORES LINEALES:
      //   - harshness: Modula ganancia BackPar
      //   - flatness: Modula spread de Movers
      //   - centroidHz: Modula velocidad de decay
      // ═══════════════════════════════════════════════════════════════════════
      
      // Construir contexto para RockStereoPhysics2
      // 🔥 WAVE 1011.7: VITAMINAS PARA LOS PARS
      // Las bandas detalladas vienen muy atenuadas, usar bass/mid/treble directos
      const rockContext = {
        // Bandas tradicionales - USAR DIRECTAMENTE, sin atenuar
        bass: audioMetrics.normalizedBass,
        lowMid: audioMetrics.normalizedBass * 0.5 + audioMetrics.normalizedMid * 0.5,  // Mix gordo
        mid: audioMetrics.normalizedMid,
        highMid: audioMetrics.normalizedMid * 0.6 + audioMetrics.normalizedTreble * 0.4,  // Mix crujiente
        treble: audioMetrics.normalizedTreble,
        subBass: audioMetrics.normalizedBass * 0.9,  // Sub-bass = casi todo el bass
        
        // Métricas espectrales (con fallbacks conservadores)
        harshness: audioMetrics.harshness ?? 0.35,
        spectralFlatness: audioMetrics.spectralFlatness ?? 0.40,
        spectralCentroid: audioMetrics.spectralCentroid ?? 1500,
        
        // 🎭 WAVE 1018: Clarity for PROG ROCK detection
        clarity: audioMetrics.clarity ?? 0.85,
        
        // Transientes detectados
        kickDetected: audioMetrics.kickDetected ?? false,
        snareDetected: audioMetrics.snareDetected ?? false,
        hihatDetected: audioMetrics.hihatDetected ?? false,
        
        bpm: vibeContext.bpm ?? 120,
      };
      
      // 🎸 Usar singleton de RockStereoPhysics2 (UNIFIED)
      const rockResult = rockPhysics2.applyZones(rockContext);
      
      // Guardar overrides con L/R split
      this.rockOverrides = {
        front: rockResult.front,
        back: rockResult.back,
        moverLeft: rockResult.moverLeft,
        moverRight: rockResult.moverRight,
        subgenre: rockResult.subgenre,  // Siempre 'ROCK' ahora
      };
      
      // No hay cambio de paleta en Rock (usamos la entrada)
      // outputPalette permanece igual
      isFlashActive = false;  // Rock no usa flash binario, usa física analógica
      physicsApplied = 'rock';
      
      // Debug info con el nuevo formato
      debugInfo = { 
        front: rockResult.front, 
        back: rockResult.back, 
        moverL: rockResult.moverLeft,
        moverR: rockResult.moverRight,
        subgenre: rockResult.subgenre,
      };
      
    } else if (
      vibeNormalized.includes('latin') || 
      vibeNormalized.includes('fiesta') ||
      vibeNormalized.includes('reggae') || 
      vibeNormalized.includes('cumbia') ||
      vibeNormalized.includes('salsa') || 
      vibeNormalized.includes('bachata')
    ) {
      // ☀️ LATINO: Solar Flare + Machine Gun Blackout + White Puncture
      const result = this.latinoPhysics.apply(
        inputPalette,
        {
          normalizedBass: audioMetrics.normalizedBass,
          normalizedMid: audioMetrics.normalizedMid, // 🆕 WAVE 288.7: Añadir mid para movers
          normalizedEnergy: audioMetrics.avgNormEnergy,
          normalizedHigh: audioMetrics.normalizedTreble, // 🆕 WAVE 288.7: Añadir treble
          normalizedHighMid: audioMetrics.normalizedMid * 0.6 + audioMetrics.normalizedTreble * 0.4, // 🔥 WAVE 2192: 7-band cocktail
          sectionType: vibeContext.section,  // 🆕 WAVE 290: Sección para White Puncture
        },
        vibeContext.bpm,
        elementalMods
      );
      
      outputPalette.primary = result.palette.primary;
      outputPalette.accent = result.palette.accent;
      isSolarFlare = result.isSolarFlare;
      forceMovement = result.forceMovement;
      if (result.dimmerOverride !== null) {
        dimmerOverride = result.dimmerOverride;
      }
      physicsApplied = 'latino';
      debugInfo = { flavor: result.flavor, ...result.debugInfo };
      
      // 🆕 WAVE 288.7: Guardar overrides del motor Latino para usar en AGC TRUST
      // 🎺 WAVE 1004.1: Incluir L/R split para movers
      this.latinoOverrides = {
        front: result.frontParIntensity,
        back: result.backParIntensity,
        mover: result.moverIntensity,
        moverL: result.moverIntensityL,  // 🎺 WAVE 1004.1: El Galán (Mid)
        moverR: result.moverIntensityR,  // 🎺 WAVE 1004.1: La Dama (Treble)
      };
      
      // 🆕 WAVE 288.1: Log THROTTLED - Solo cuando cambia flavor O cada 2s
      if (this.debug && isSolarFlare) {
        const now = Date.now();
        const timeSinceLastLog = now - this.lastLatinoLogTime;
        const flavorChanged = result.flavor !== this.lastLatinoFlavor;
        
        // 🧹 WAVE 671.5: Silenced legacy Latino physics spam
        // if (flavorChanged || timeSinceLastLog >= this.LOG_THROTTLE_MS) {
        //   console.log(`[SeleneLux] ☀️ LATINO PHYSICS | Solar Flare ACTIVE | Flavor:${result.flavor}`);
        //   this.lastLatinoLogTime = now;
        //   this.lastLatinoFlavor = result.flavor;
        // }
      }
      
    } else if (
      vibeNormalized.includes('chill') || 
      vibeNormalized.includes('ambient') ||
      vibeNormalized.includes('lounge') || 
      vibeNormalized.includes('jazz') ||
      vibeNormalized.includes('classical')
    ) {
      // ═══════════════════════════════════════════════════════════════════════
      // � WAVE 1044: THE DEEP FIELD - Chill Lounge Generative Ecosystem
      // ═══════════════════════════════════════════════════════════════════════
      // 5 ORGANISMOS INDEPENDIENTES:
      // 1. THE BREATHING FLOOR - Ondas Fibonacci (Front/Back L/R)
      // 2. THE DRIFTING PLANKTON - Sparkles con números primos
      // 3. THE CELESTIAL MOVERS - Lissajous + Zodiac modulation
      // 4. THE TIDE SURGE - Evento raro cada 5-8 minutos
      // 5. THE CHROMATIC MIGRATION - Colores que fluyen
      // ═══════════════════════════════════════════════════════════════════════
      
      const now = Date.now() / 1000; // Continuous time in seconds
      
      // 🌊 WAVE 1070.6: Build GodEar metrics for oceanic physics
      const godEarMetrics = {
        clarity: audioMetrics.clarity ?? 0.5,
        spectralFlatness: audioMetrics.spectralFlatness ?? 0.5,
        centroid: audioMetrics.spectralCentroid ?? 800,
        // 🐟 Transient density: kick+snare+hihat + energy boost
        transientDensity: ((audioMetrics.kickDetected ? 0.4 : 0) + 
                          (audioMetrics.snareDetected ? 0.35 : 0) +
                          (audioMetrics.hihatDetected ? 0.25 : 0)) * 
                          (0.6 + audioMetrics.avgNormEnergy * 0.6),
        // 🐋 Bass energy: normalizedBass para whaleSong
        bassEnergy: audioMetrics.normalizedBass ?? 0,
        bass: audioMetrics.normalizedBass ?? 0,
      }
      
      const result = calculateChillStereo(
        now,
        audioMetrics.avgNormEnergy,     // Nutriente (modula velocidad, no dispara)
        audioMetrics.normalizedTreble,  // Air/Plankton probability modulator
        audioMetrics.kickDetected ?? false,  // Subtle surge boost
        godEarMetrics,  // 🌊 WAVE 1070: GodEar metrics for oceanic triggers
        vibeContext.bpm ?? 60  // 🩰 WAVE 1102: BPM para Elastic Time
      );
      
      // 🔍 LOG THE DEEP FIELD DEBUG INFO (Solo si hay cambio de profundidad >500m)
      if (result.debug.includes('[DEPTH CHANGE]')) {
        console.log(`[🌊 THE DEEP FIELD] ${result.debug}`);
      }
      
      // La paleta NO se modifica (respetamos TitanEngine/SeleneColorEngine)
      outputPalette = inputPalette; 
      dimmerOverride = 0.75; // Chill ambiental (cocktail sunset)
      forceMovement = true;  // Celestial Movers activos
      physicsApplied = 'chill';  // 🔧 CRITICAL: Must set this for AGC TRUST to apply overrides
      
      // Store calculated physics in overrides
      this.chillOverrides = {
        front: (result.frontL + result.frontR) / 2, // Legacy fallback
        back: (result.backL + result.backR) / 2,   // Legacy fallback
        mover: (result.moverL.intensity + result.moverR.intensity) / 2, // Legacy fallback
        
        // 🫧 WAVE 1032.9: Independent Bubbles
        moverL: result.moverL.intensity,
        moverR: result.moverR.intensity,
        
        // � WAVE 1044: Full 7-Zone Stereo Ecosystem
        frontL: result.frontL,
        frontR: result.frontR,
        backL: result.backL,
        backR: result.backR,
        
        // 🔦 AIR zone (future lasers)
        air: result.airIntensity,
      };

      // ═══════════════════════════════════════════════════════════════════════
      // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement coordinates only
      // 🌊 WAVE 1072: colorOverride REMOVED - now uses oceanicModulation in SeleneColorEngine
      // ═══════════════════════════════════════════════════════════════════════
      this.deepFieldMechanics = {
        moverL: { pan: result.moverL.pan, tilt: result.moverL.tilt, intensity: result.moverL.intensity },
        moverR: { pan: result.moverR.pan, tilt: result.moverR.tilt, intensity: result.moverR.intensity },
        // colorOverride: DEPRECATED - ocean colors now flow through SeleneColorEngine
      };

      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 1070: THE LIVING OCEAN - Store Oceanic Triggers
      // These will be dispatched to EffectManager by TitanEngine
      // ═══════════════════════════════════════════════════════════════════════
      this.oceanicTriggersState = result.oceanicTriggers;

      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Store Oceanic Musical Context
      // This allows SeleneColorEngine to modulate palettes based on depth
      // ═══════════════════════════════════════════════════════════════════════
      this.oceanicContextState = result.oceanicContext;

      // Pass movement data for Celestial Movers
      debugInfo = {
        internalDebug: result.debug,
        panL: result.moverL.pan,
        tiltL: result.moverL.tilt,
        panR: result.moverR.pan,
        tiltR: result.moverR.tilt,
        // 🌌 Deep Field ecosystem debug
        ecosystem: 'THE_DEEP_FIELD'
      };
      
    } // Guardar estado
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Routing
    // ═══════════════════════════════════════════════════════════════════════
    // ARQUITECTURA ESPECTRAL COMPLETA:
    // - Sub-Graves (Washers) = Sentimiento/Atmósfera (subBass 20-60Hz)
    // - Medios (Movers/PARs) = Ritmo/Baile (ya procesado por género)
    // - Ultra-Agudos (Láseres) = Detalle/Tecnología (ultraAir 16-22kHz)
    // 
    // Estos motores corren SIEMPRE, independientemente del género.
    // La física espectral es UNIVERSAL - todos los vibes tienen láseres y washers.
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🟢 LASER PHYSICS: UltraAir (16-22kHz) → Láseres
    // Los láseres responden a las frecuencias que los humanos CASI NO OYEN
    const laserInput: LaserPhysicsInput = {
      ultraAir: audioMetrics.ultraAir ?? 0,
      clarity: audioMetrics.clarity ?? 0.5,
      texture: audioMetrics.texture ?? 'clean',
      lowMid: audioMetrics.lowMid ?? audioMetrics.normalizedMid * 0.5,
      energy: audioMetrics.avgNormEnergy,
      bpm: vibeContext.bpm,
    };
    
    const laserOutput = laserPhysics.apply(laserInput);
    this.laserResult = {
      intensity: laserOutput.intensity,
      mode: laserOutput.mode,
      beamWidth: laserOutput.beamWidth,
      scanSpeed: laserOutput.scanSpeed,
      safetyTriggered: laserOutput.safetyTriggered,
    };
    
    // 🎨 WASHER PHYSICS: SubBass (20-60Hz) → Washers/Barras LED
    // Los washers responden donde la música se SIENTE, no se oye
    const washerInput: WasherPhysicsInput = {
      subBass: audioMetrics.subBass ?? audioMetrics.normalizedBass * 0.8,
      texture: audioMetrics.texture ?? 'warm',
      energy: audioMetrics.avgNormEnergy,
      bass: audioMetrics.normalizedBass,
      clarity: audioMetrics.clarity,
      bpm: vibeContext.bpm,
    };
    
    const washerOutput = washerPhysics.apply(washerInput);
    this.washerResult = {
      intensity: washerOutput.intensity,
      mode: washerOutput.mode,
      colorTransitionSpeed: washerOutput.colorTransitionSpeed,
      impactActive: washerOutput.impactActive,
      breathingFactor: washerOutput.breathingFactor,
    };
    
    // Log cada 60 frames (~1 segundo) si hay actividad significativa
    if (this.frameCount % 60 === 0 && (laserOutput.intensity > 0.1 || washerOutput.intensity > 0.3)) {
      console.log(
        `[SeleneLux 🟢🎨 PHOTON WEAVER] ` +
        `Laser:${laserOutput.mode}(${(laserOutput.intensity * 100).toFixed(0)}%) | ` +
        `Washer:${washerOutput.mode}(${(washerOutput.intensity * 100).toFixed(0)}%) | ` +
        `Safety:${laserOutput.safetyTriggered ? '⚠️TRIGGERED' : '✅OK'}`
      );
    }
    
    this.lastStrobeActive = isStrobeActive;
    this.lastForceMovement = forceMovement;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 👓 WAVE 288.7: AGC TRUST DEMOCRÁTICO
    // ═══════════════════════════════════════════════════════════════════════
    // Si un motor físico (Latino) tiene overrides calculados, los respetamos.
    // Si no hay overrides, usamos la lógica por defecto (Techno/Rock/Chill).
    // ESTO EVITA QUE EL ROUTER SOBRESCRIBA LO QUE EL MOTOR CALCULÓ.
    // ═══════════════════════════════════════════════════════════════════════
    
    const brightMod = elementalMods?.brightnessMultiplier ?? 1.0;
    const bass = audioMetrics.normalizedBass;
    const mid = audioMetrics.normalizedMid;
    const treble = audioMetrics.normalizedTreble;
    
    let frontIntensity: number;
    let backIntensity: number;
    let moverIntensity: number;
    
    // 🎺 WAVE 288.7: ¿Tenemos overrides de Latino?
    if (this.latinoOverrides && physicsApplied === 'latino') {
      // DEMOCRACIA: El motor Latino calculó sus intensidades. Respétalas.
      frontIntensity = Math.min(0.95, this.latinoOverrides.front * brightMod);
      backIntensity = Math.min(0.95, this.latinoOverrides.back);
      moverIntensity = Math.min(1.0, this.latinoOverrides.mover);  // Legacy fallback
      
      // 🎺 WAVE 1004.1: LATINO STEREO SPLIT - Si tenemos L/R separados, preparar para el output
      const latinoL = this.latinoOverrides.moverL ?? moverIntensity;  // El Galán (Mid)
      const latinoR = this.latinoOverrides.moverR ?? moverIntensity;  // La Dama (Treble)
      
      // Temporal: guardar en una variable para pasar al output
      (this as any).latinoMoverSplit = { moverL: latinoL, moverR: latinoR };
      
      // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
      // this.latinoOverrides = null;
      
    } else if (this.technoOverrides && physicsApplied === 'techno') {
      // ⚡ WAVE 290.3 + WAVE 908: El motor Techno calculó sus intensidades. Respétalas.
      // 🧪 WAVE 908: THE DUEL - Guardar L/R separados
      frontIntensity = Math.min(0.95, this.technoOverrides.front * brightMod);
      backIntensity = Math.min(0.95, this.technoOverrides.back);
      moverIntensity = Math.min(1.0, this.technoOverrides.mover);  // Legacy fallback
      
      // 🧪 WAVE 908: Si tenemos L/R separados, preparar para el output
      const technoL = this.technoOverrides.moverL ?? moverIntensity;
      const technoR = this.technoOverrides.moverR ?? moverIntensity;
      
      // Temporal: guardar en una variable para pasar al output
      (this as any).technoMoverSplit = { moverL: technoL, moverR: technoR };
      
      // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
      // this.technoOverrides = null;
      
    } else if (this.rockOverrides && physicsApplied === 'rock') {
      // ═══════════════════════════════════════════════════════════════════════
      // 🎸 WAVE 1011: HIGH VOLTAGE ROCK - 4 Bandas con L/R Split
      // ═══════════════════════════════════════════════════════════════════════
      // Front: Kicks + SubBass (The Pulse)
      // Back: Snares + Harsh Guitars (The Power)
      // MoverL: Body/Riffs/Wall of Sound (The Body)
      // MoverR: Solos/Platos/Shine (The Shine)
      // ═══════════════════════════════════════════════════════════════════════
      frontIntensity = Math.min(0.95, this.rockOverrides.front * brightMod);
      backIntensity = Math.min(0.95, this.rockOverrides.back);
      // Legacy fallback: promedio de L/R para compatibilidad
      moverIntensity = Math.min(1.0, (this.rockOverrides.moverLeft + this.rockOverrides.moverRight) / 2);
      
      // 🎸 WAVE 1011: Guardar L/R split para el output
      const rockL = this.rockOverrides.moverLeft;   // The Body (riffs)
      const rockR = this.rockOverrides.moverRight;  // The Shine (solos)
      
      // Temporal: guardar en una variable para pasar al output
      (this as any).rockMoverSplit = { moverL: rockL, moverR: rockR };
      
      // 🎸 WAVE 1011: Log HIGH VOLTAGE cada 30 frames con subgénero
      if (this.frameCount % 30 === 0) {
        console.log(
          `[AGC TRUST 🎸HIGH VOLTAGE] Subgenre:${this.rockOverrides.subgenre.toUpperCase()} | ` +
          `IN[B:${bass.toFixed(2)}, M:${mid.toFixed(2)}, T:${treble.toFixed(2)}] → ` +
          `💡 OUT[F:${frontIntensity.toFixed(2)}, Bk:${backIntensity.toFixed(2)}, ML:${rockL.toFixed(2)}, MR:${rockR.toFixed(2)}]`
        );
      }
      
      // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
      // this.rockOverrides = null;
      
    } else if (this.chillOverrides && physicsApplied === 'chill') {
      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 315.3: CHILL - El Techno Pacífico (Olas Desfasadas)
      // 🔥 WAVE 1032.8: BUBBLE FREEDOM - Removido ceiling 0.85 para permitir burbujas brillantes
      // 🫧 WAVE 1032.9: BUBBLE L/R SPLIT - Movers independientes como Rock/Latino
      // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R split para oscilación lateral
      // ═══════════════════════════════════════════════════════════════════════
      // FILOSOFÍA: Movimiento LATERAL como el océano.
      // Front/Back/MoverL/MoverR con burbujas independientes
      // 🫧 BURBUJAS: Pueden alcanzar 1.0 gracias al bypass POST-AGC
      // 🌊 WAVE 1035: Marea cruzada - cuando FrontL sube, FrontR baja ligeramente
      // ═══════════════════════════════════════════════════════════════════════
      frontIntensity = Math.min(1.0, this.chillOverrides.front * brightMod);
      backIntensity = Math.min(1.0, this.chillOverrides.back);
      
      // 🫧 WAVE 1032.9: Usar moverL/moverR individuales (burbujas independientes)
      const chillL = Math.min(1.0, this.chillOverrides.moverL);
      const chillR = Math.min(1.0, this.chillOverrides.moverR);
      moverIntensity = Math.min(1.0, (chillL + chillR) / 2);  // Promedio para legacy
      
      // 🫧 WAVE 1032.9: Guardar split L/R para incluir en zoneIntensities
      (this as any).chillMoverSplit = {
        moverL: chillL,
        moverR: chillR
      };
      
      // � WAVE 1035: 7-ZONE STEREO - Front/Back L/R split
      // Extraer las nuevas zonas stereo del chillOverrides
      const chillFrontL = this.chillOverrides.frontL ?? frontIntensity;
      const chillFrontR = this.chillOverrides.frontR ?? frontIntensity;
      const chillBackL = this.chillOverrides.backL ?? backIntensity;
      const chillBackR = this.chillOverrides.backR ?? backIntensity;
      
      // Guardar stereo split para incluir en zoneIntensities
      (this as any).chillStereoSplit = {
        frontL: chillFrontL,
        frontR: chillFrontR,
        backL: chillBackL,
        backR: chillBackR,
      };
      
      // �🆕 WAVE 315.3: Log OLAS cada 15 frames (~250ms)
      // 🫧 WAVE 1032.9: Mostrar L/R individuales
      // 🌊 WAVE 1035: Mostrar 7-zone stereo
      if (this.frameCount % 15 === 0) {
        console.log(
          `[AGC TRUST 🌊CHILL 7Z] FL:${chillFrontL.toFixed(2)} FR:${chillFrontR.toFixed(2)} | ` +
          `BL:${chillBackL.toFixed(2)} BR:${chillBackR.toFixed(2)} | ` +
          `ML:${chillL.toFixed(2)} MR:${chillR.toFixed(2)}`
        );
      }
      
      // 🔧 WAVE 1049: NO limpiar overrides aquí - se sobrescriben en próximo tick de Chill
      // Esto permite que el bloque "else if (this.chillOverrides ...)" funcione correctamente
      // this.chillOverrides = null;  ← REMOVED - was causing overrides to disappear
      
    } else {
      // LÓGICA POR DEFECTO: Techno/Rock/Chill (treble en movers, etc.)
      
      // 1. FRONT PARS (Bass - El Empujón)
      const isTechno = vibeContext.activeVibe.toLowerCase().includes('techno');
      const frontCeiling = isTechno ? 0.80 : 0.95;
      const compressedBass = Math.pow(bass, 1.2);
      frontIntensity = Math.min(frontCeiling, compressedBass * brightMod);
      
      // 2. BACK PARS (Mid/Snare - La Bofetada)
      const backRaw = Math.pow(mid, 1.5) * 1.8;
      const backGateThreshold = isTechno ? 0.10 : 0.06;
      const backGated = backRaw < backGateThreshold ? 0 : backRaw;
      backIntensity = Math.min(0.95, backGated);
      
      // 3. MOVERS (Treble - El Alma) - Solo para Techno/Rock
      moverIntensity = Math.min(1.0, Math.pow(treble, 2) * 1.8);
    }
    
    const zoneIntensities = {
      front: frontIntensity,
      back: backIntensity,
      mover: moverIntensity,
      // 🧪 WAVE 908: THE DUEL - Incluir L/R si vienen de Techno
      ...(((this as any).technoMoverSplit) && {
        moverL: (this as any).technoMoverSplit.moverL,
        moverR: (this as any).technoMoverSplit.moverR
      }),
      // 🎺 WAVE 1004.1: LATINO STEREO - Incluir L/R si vienen de Latino
      ...(((this as any).latinoMoverSplit) && {
        moverL: (this as any).latinoMoverSplit.moverL,
        moverR: (this as any).latinoMoverSplit.moverR
      }),
      // 🎸 WAVE 1011: HIGH VOLTAGE ROCK - Incluir L/R si vienen de Rock
      ...(((this as any).rockMoverSplit) && {
        moverL: (this as any).rockMoverSplit.moverL,
        moverR: (this as any).rockMoverSplit.moverR
      }),
      // 🫧 WAVE 1032.9: BUBBLE L/R SPLIT - Incluir L/R si vienen de Chill
      ...(((this as any).chillMoverSplit) && {
        moverL: (this as any).chillMoverSplit.moverL,
        moverR: (this as any).chillMoverSplit.moverR
      }),
      // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R si vienen de Chill
      ...(((this as any).chillStereoSplit) && {
        frontL: (this as any).chillStereoSplit.frontL,
        frontR: (this as any).chillStereoSplit.frontR,
        backL: (this as any).chillStereoSplit.backL,
        backR: (this as any).chillStereoSplit.backR,
      }),
      // ═══════════════════════════════════════════════════════════════════════
      // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Zones
      // ═══════════════════════════════════════════════════════════════════════
      // Estas intensidades vienen de los nuevos motores espectrales.
      // Son INDEPENDIENTES del género - la física espectral es universal.
      // ═══════════════════════════════════════════════════════════════════════
      laser: this.laserResult?.intensity ?? 0,
      washer: this.washerResult?.intensity ?? 0.15,  // Floor mínimo para washers
    };
    
    // Limpiar split temporal
    delete (this as any).technoMoverSplit;
    delete (this as any).latinoMoverSplit;  // 🎺 WAVE 1004.1
    delete (this as any).rockMoverSplit;    // 🎸 WAVE 1011
    delete (this as any).chillMoverSplit;   // 🫧 WAVE 1032.9
    delete (this as any).chillStereoSplit;  // 🌊 WAVE 1035: 7-ZONE STEREO
    
    // 🧹 WAVE 671.5: Silenced AGC TRUST spam (every 1s)
    // 👓 WAVE 276: Log AGC TRUST cada 30 frames (~1 segundo)
    // WAVE 300: Rock tiene su propio log con transientes (arriba)
    // WAVE 315: Chill tiene su propio log con breathing (arriba)
    // if (this.frameCount % 30 === 0 && physicsApplied !== 'rock' && physicsApplied !== 'chill') {
    //   const source = physicsApplied === 'latino' ? '🌴LATINO' : 
    //                  physicsApplied === 'techno' ? '⚡TECHNO' : '📡DEFAULT';
    //   console.log(`[AGC TRUST ${source}] IN[${bass.toFixed(2)}, ${mid.toFixed(2)}, ${treble.toFixed(2)}] -> 💡 OUT[Front:${frontIntensity.toFixed(2)}, Back:${backIntensity.toFixed(2)}, Mover:${moverIntensity.toFixed(2)}]`);
    // }
    
    // 🧠 WAVE 450: Detectar si Energy Override está activo
    const energyOverrideActive = isEnergyOverrideActive(audioMetrics.avgNormEnergy);
    
    this.lastOutput = {
      palette: outputPalette,
      zoneIntensities,
      isStrobeActive,
      isFlashActive,
      isSolarFlare,
      dimmerOverride,
      forceMovement,
      physicsApplied,
      energyOverrideActive,
      // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Extended physics metadata
      laserPhysics: this.laserResult ? {
        mode: this.laserResult.mode,
        beamWidth: this.laserResult.beamWidth,
        scanSpeed: this.laserResult.scanSpeed,
        safetyTriggered: this.laserResult.safetyTriggered,
      } : undefined,
      washerPhysics: this.washerResult ? {
        mode: this.washerResult.mode,
        colorTransitionSpeed: this.washerResult.colorTransitionSpeed,
        impactActive: this.washerResult.impactActive,
        breathingFactor: this.washerResult.breathingFactor,
      } : undefined,
      // ═══════════════════════════════════════════════════════════════════════
      // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement only
      // 🌊 WAVE 1072: colorOverride REMOVED from mechanics
      // ═══════════════════════════════════════════════════════════════════════
      mechanics: this.deepFieldMechanics ? {
        moverL: this.deepFieldMechanics.moverL,
        moverR: this.deepFieldMechanics.moverR,
        // colorOverride: DEPRECATED in WAVE 1072 - flows through SeleneColorEngine now
        source: 'THE_DEEP_FIELD',
      } : undefined,
      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 1070: THE LIVING OCEAN - Oceanic Creature Triggers
      // ═══════════════════════════════════════════════════════════════════════
      oceanicTriggers: this.oceanicTriggersState ?? undefined,
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Musical Context
      // Allows SeleneColorEngine to modulate based on oceanic depth/zone
      // ═══════════════════════════════════════════════════════════════════════
      oceanicContext: this.oceanicContextState ?? undefined,
      debugInfo,
    };
    
    // Clear deepFieldMechanics for next frame
    this.deepFieldMechanics = null;
    
    // 🌊 WAVE 1073.8: NO limpiar oceanicTriggers - se sobrescriben naturalmente
    // El problema era que se limpiaban ANTES de que TitanEngine los leyera
    // this.oceanicTriggersState = null;  // ❌ COMENTADO
    
    // 🌊 WAVE 1072: oceanicContext NO necesita limpiarse tampoco
    // this.oceanicContextState = null;   // ❌ COMENTADO
    
    return this.lastOutput;
  }
  
  /**
   * Obtiene el último estado calculado
   */
  public getLastOutput(): SeleneLuxOutput {
    return this.lastOutput;
  }
  
  /**
   * Estado del strobe para UI
   */
  public isStrobeActive(): boolean {
    return this.lastStrobeActive;
  }
  
  /**
   * Estado del movimiento forzado (Latino)
   */
  public isForceMovement(): boolean {
    return this.lastForceMovement;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Convierte ColorPalette (con HSL/hex) a RGB interno
   */
  private colorPaletteToRgb(palette: ColorPalette): {
    primary: RGB;
    secondary: RGB;
    ambient: RGB;
    accent: RGB;
  } {
    return {
      primary: this.hslToRgb(palette.primary.h, palette.primary.s, palette.primary.l),
      secondary: this.hslToRgb(palette.secondary.h, palette.secondary.s, palette.secondary.l),
      ambient: this.hslToRgb(palette.ambient.h, palette.ambient.s, palette.ambient.l),
      accent: this.hslToRgb(palette.accent.h, palette.accent.s, palette.accent.l),
    };
  }
  
  /**
   * HSL (0-1) → RGB (0-255)
   */
  private hslToRgb(h: number, s: number, l: number): RGB {
    let r: number, g: number, b: number;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

let instance: SeleneLux | null = null;

/**
 * Obtiene la instancia singleton de SeleneLux
 */
export function getSeleneLux(config?: SeleneLuxConfig): SeleneLux {
  if (!instance) {
    instance = new SeleneLux(config);
  }
  return instance;
}

/**
 * Reset para testing
 */
export function resetSeleneLux(): void {
  instance = null;
}
