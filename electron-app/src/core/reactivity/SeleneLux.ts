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
  ChillStereoPhysics,
  type RockPhysicsInput, // 🎸 WAVE 1011.5: Unified input type
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
} from '../../engine/consciousness/ConsciousnessOutput';

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
  
  // 🎸 WAVE 1011: Detección de transientes
  kickDetected?: boolean;
  snareDetected?: boolean;
  hihatDetected?: boolean;
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
 */
export interface SeleneLuxOutput {
  palette: {
    primary: RGB;
    secondary: RGB;
    ambient: RGB;
    accent: RGB;
  };
  /** 🎚️ WAVE 275: Intensidades por zona basadas en frecuencias */
  zoneIntensities: {
    front: number;   // 0-1: Bass → Front PARs (Kick/Graves)
    back: number;    // 0-1: Mid → Back PARs (Snare/Clap)
    mover: number;   // 0-1: Treble → Movers (Melodía/Voz) - LEGACY mono
    moverL?: number; // 🧪 WAVE 908: LEFT mover (Mid-dominant) - TECHNO only
    moverR?: number; // 🧪 WAVE 908: RIGHT mover (Treble-dominant) - TECHNO only
  };
  isStrobeActive: boolean;
  isFlashActive: boolean;
  isSolarFlare: boolean;
  dimmerOverride: number | null;
  forceMovement: boolean;
  physicsApplied: string;     // 'techno' | 'rock' | 'latino' | 'chill' | 'none'
  /** 🧠 WAVE 450: Indica si Energy Override está activo */
  energyOverrideActive: boolean;
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
  private chillPhysics: ChillStereoPhysics;
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
  private chillOverrides: { 
    front: number; 
    back: number; 
    mover: number;
  } | null = null;
  
  constructor(config: SeleneLuxConfig = {}) {
    this.debug = config.debug ?? false;
    
    // Inicializar físicas stateful
    this.latinoPhysics = new LatinoStereoPhysics();
    this.chillPhysics = new ChillStereoPhysics();
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
    
    console.log('[SeleneLux] 🌙 Nervous System initialized (WAVE 450 + Consciousness Integration)');
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
        sectionType: vibeContext.section,
        // 🎛️ WAVE 1012: Métricas espectrales para Acid/Noise modes
        harshness: audioMetrics.harshness ?? 0.45,      // Default más agresivo que Rock (Techno = duro)
        flatness: audioMetrics.spectralFlatness ?? 0.35  // Default para pads/atmos
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
      
      if (this.debug && isStrobeActive) {
        console.log('[SeleneLux] ⚡ TECHNO PHYSICS | Strobe ACTIVE');
      }
      
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
          normalizedHigh: audioMetrics.normalizedTreble, // 🆕 WAVE 288.7: Añadir treble (aunque no se usa)
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
      // 🌊✨ WAVE 316: COSMIC TWILIGHT - Sunset Argentino con Cocktails
      // ═══════════════════════════════════════════════════════════════════════
      // FILOSOFÍA: "Techno que se fumó un porro"
      // - Bass hits (djembes) → Front PARs pulse (+20%, 300ms decay)
      // - Pads sustained (treble) → Back PARs cross-fade glow (8 sec)
      // - Movers drift independientes (estrellas contrafase, 20 sec)
      // - Twilight breathing (20 sec, ±5% lightness, floor 0.50 SIEMPRE)
      // - Colores fríos/oceánicos: verde agua → violeta → índigo
      // - CERO oscuridad (cocktail-friendly), CERO velocidad, TODO orgánico
      // ═══════════════════════════════════════════════════════════════════════
      // 🕐 WAVE 318: Pasamos BPM para gravedad temporal
      const result = this.chillPhysics.apply(
        inputPalette,
        {
          normalizedBass: audioMetrics.normalizedBass,
          normalizedMid: audioMetrics.normalizedMid,
          normalizedTreble: audioMetrics.normalizedTreble,
          normalizedEnergy: audioMetrics.avgNormEnergy,
        },
        elementalMods,
        vibeContext.bpm  // 🆕 BPM para Chronos physics
      );
      
      outputPalette = result.palette;
      dimmerOverride = 0.70; // Chill siempre luminoso (cocktail party)
      physicsApplied = 'chill';
      debugInfo = result.debugInfo;
      
      // Extraer intensidades por zona (4 zonas → 3 overrides)
      const moverAvg = (result.zoneIntensities.moverL + result.zoneIntensities.moverR) / 2;
      this.chillOverrides = {
        front: result.zoneIntensities.front,
        back: result.zoneIntensities.back,
        mover: moverAvg,
      };
      // WAVE 316.1: Log eliminado de SeleneLux (ya lo hace ChillStereoPhysics internamente)
    } // Guardar estado
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
      
      // Limpiar overrides para el próximo frame
      this.latinoOverrides = null;
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
      
      // Limpiar overrides para el próximo frame
      this.technoOverrides = null;
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
      
      // Limpiar overrides para el próximo frame
      this.rockOverrides = null;
    } else if (this.chillOverrides && physicsApplied === 'chill') {
      // ═══════════════════════════════════════════════════════════════════════
      // 🌊 WAVE 315.3: CHILL - El Techno Pacífico (Olas Desfasadas)
      // ═══════════════════════════════════════════════════════════════════════
      // FILOSOFÍA: Movimiento LATERAL como el océano.
      // Front/Back/Mover tienen fases diferentes (0°/120°/240°)
      // Las intensidades YA vienen calculadas con floor de 0.35
      // ═══════════════════════════════════════════════════════════════════════
      frontIntensity = Math.min(0.85, this.chillOverrides.front * brightMod);
      backIntensity = Math.min(0.85, this.chillOverrides.back);
      moverIntensity = Math.min(0.85, this.chillOverrides.mover);
      
      // 🆕 WAVE 315.3: Log OLAS cada 15 frames (~250ms)
      if (this.frameCount % 15 === 0) {
        console.log(
          `[AGC TRUST 🌊CHILL] IN[F:${this.chillOverrides.front.toFixed(2)}, B:${this.chillOverrides.back.toFixed(2)}, M:${this.chillOverrides.mover.toFixed(2)}] → ` +
          `💡 OUT[Front:${frontIntensity.toFixed(2)}, Back:${backIntensity.toFixed(2)}, Mover:${moverIntensity.toFixed(2)}] (×brightMod:${brightMod.toFixed(2)})`
        );
      }
      
      // Limpiar overrides para el próximo frame
      this.chillOverrides = null;
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
      })
    };
    
    // Limpiar split temporal
    delete (this as any).technoMoverSplit;
    delete (this as any).latinoMoverSplit;  // 🎺 WAVE 1004.1
    delete (this as any).rockMoverSplit;    // 🎸 WAVE 1011
    
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
      debugInfo,
    };
    
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
