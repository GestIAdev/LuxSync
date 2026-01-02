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
 * @layer CORE (Sistema Nervioso)
 * @version WAVE 274 - Organ Harvest
 */

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

import { 
  TechnoStereoPhysics, 
  RockStereoPhysics, 
  LatinoStereoPhysics, 
  ChillStereoPhysics 
} from '../../hal/physics';

import { 
  ElementalModifiers, 
  getModifiersFromKey 
} from '../../engine/physics/ElementalModifiers';

import type { ColorPalette } from '../protocol/LightingIntent';

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
 */
export interface SeleneLuxAudioMetrics {
  normalizedBass: number;     // 0-1
  normalizedMid: number;      // 0-1
  normalizedTreble: number;   // 0-1
  avgNormEnergy: number;      // 0-1
}

/**
 * Contexto del Vibe actual
 */
export interface SeleneLuxVibeContext {
  activeVibe: string;         // 'techno', 'rock', 'latino', 'chill', etc.
  primaryHue: number;         // 0-360 - Hue base para efectos de color
  stableKey: string | null;   // Key musical estabilizada (C, D, E...)
  bpm?: number;               // BPM para subgénero latino
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
    front: number;  // 0-1: Bass → Front PARs (Kick/Graves)
    back: number;   // 0-1: Mid → Back PARs (Snare/Clap)
    mover: number;  // 0-1: Treble → Movers (Melodía/Voz)
  };
  isStrobeActive: boolean;
  isFlashActive: boolean;
  isSolarFlare: boolean;
  dimmerOverride: number | null;
  forceMovement: boolean;
  physicsApplied: string;     // 'techno' | 'rock' | 'latino' | 'chill' | 'none'
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
  
  // Instancias de física stateful (Latino y Chill necesitan estado)
  private latinoPhysics: LatinoStereoPhysics;
  private chillPhysics: ChillStereoPhysics;
  
  // Estado del último frame
  private lastOutput: SeleneLuxOutput;
  private lastStrobeActive = false;
  private lastForceMovement = false;
  
  constructor(config: SeleneLuxConfig = {}) {
    this.debug = config.debug ?? false;
    
    // Inicializar físicas stateful
    this.latinoPhysics = new LatinoStereoPhysics();
    this.chillPhysics = new ChillStereoPhysics();
    
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
    };
    
    console.log('[SeleneLux] 🌙 Nervous System initialized (WAVE 274 + WAVE 275 FREQ MAPPING)');
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
      
      if (this.debug && isStrobeActive) {
        console.log('[SeleneLux] ⚡ TECHNO PHYSICS | Strobe ACTIVE');
      }
      
    } else if (vibeNormalized.includes('rock') || vibeNormalized.includes('pop')) {
      // 🎸 ROCK: Snare Crack + Kick Punch
      const result = RockStereoPhysics.apply(
        inputPalette,
        {
          normalizedMid: audioMetrics.normalizedMid,
          normalizedBass: audioMetrics.normalizedBass,
          avgNormEnergy: audioMetrics.avgNormEnergy,
        },
        vibeContext.primaryHue,
        elementalMods
      );
      
      outputPalette.accent = result.palette.accent;
      isFlashActive = result.isSnareHit || result.isKickHit;
      physicsApplied = 'rock';
      debugInfo = { snare: result.isSnareHit, kick: result.isKickHit, ...result.debugInfo };
      
      if (this.debug && isFlashActive) {
        console.log(`[SeleneLux] 🎸 ROCK PHYSICS | Snare:${result.isSnareHit} Kick:${result.isKickHit}`);
      }
      
    } else if (
      vibeNormalized.includes('latin') || 
      vibeNormalized.includes('fiesta') ||
      vibeNormalized.includes('reggae') || 
      vibeNormalized.includes('cumbia') ||
      vibeNormalized.includes('salsa') || 
      vibeNormalized.includes('bachata')
    ) {
      // ☀️ LATINO: Solar Flare + Machine Gun Blackout
      const result = this.latinoPhysics.apply(
        inputPalette,
        {
          normalizedBass: audioMetrics.normalizedBass,
          normalizedEnergy: audioMetrics.avgNormEnergy,
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
      
      if (this.debug && isSolarFlare) {
        console.log(`[SeleneLux] ☀️ LATINO PHYSICS | Solar Flare ACTIVE | Flavor:${result.flavor}`);
      }
      
    } else if (
      vibeNormalized.includes('chill') || 
      vibeNormalized.includes('ambient') ||
      vibeNormalized.includes('lounge') || 
      vibeNormalized.includes('jazz') ||
      vibeNormalized.includes('classical')
    ) {
      // 🌊 CHILL: Breathing Pulse (Sin Strobe Jamás)
      const result = this.chillPhysics.apply(
        inputPalette,
        { normalizedEnergy: audioMetrics.avgNormEnergy },
        elementalMods
      );
      
      outputPalette = result.palette;
      dimmerOverride = result.dimmerModulation + 0.5; // Centrar en 0.5
      physicsApplied = 'chill';
      debugInfo = result.debugInfo;
      
      if (this.debug && this.frameCount % 60 === 0) {
        console.log(`[SeleneLux] 🌊 CHILL PHYSICS | Breath Phase:${result.breathPhase.toFixed(2)}`);
      }
    }
    
    // Guardar estado
    this.lastStrobeActive = isStrobeActive;
    this.lastForceMovement = forceMovement;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 👓 WAVE 276: AGC TRUST - El AGC ya hizo el trabajo duro. No lo rompas.
    // ═══════════════════════════════════════════════════════════════════════
    // FRONT PARs (El Empujón):   Bass con techo para dejar espacio a Backs
    // BACK PARs (La Bofetada):   Mid con curva exponencial para limpiar ruido
    // MOVERS (El Alma):          Treble expandido para ver los picos
    // ═══════════════════════════════════════════════════════════════════════
    
    const brightMod = elementalMods?.brightnessMultiplier ?? 1.0;
    const bass = audioMetrics.normalizedBass;
    const mid = audioMetrics.normalizedMid;
    const treble = audioMetrics.normalizedTreble;
    
    // 1. FRONT PARS (Bass - El Empujón)
    // 🎯 WAVE 278: Compressor - curva suave para evitar saturación constante
    // Techno: Techo en 0.8 para dejar espacio a los Back Pars
    const isTechno = vibeContext.activeVibe.toLowerCase().includes('techno');
    const frontCeiling = isTechno ? 0.80 : 0.95;
    const compressedBass = Math.pow(bass, 1.2);  // Suaviza la entrada
    const frontIntensity = Math.min(frontCeiling, compressedBass * brightMod);
    
    // 2. BACK PARS (Mid/Snare - La Bofetada)
    // 🔥 WAVE 279.4: ZOMBIE STEROIDS - mid^1.5 × 1.8 en lugar de mid^3 × 1.5
    // La curva cúbica APLASTABA el audio normalizado (0.25^3 = 0.015 invisible)
    // Curva 1.5: mid=0.25 → 0.125 × 1.8 = 0.225 (visible!)
    //            mid=0.40 → 0.253 × 1.8 = 0.456 (ruge!)
    const backRaw = Math.pow(mid, 1.5) * 1.8;
    const backGateThreshold = isTechno ? 0.10 : 0.06;
    const backGated = backRaw < backGateThreshold ? 0 : backRaw;
    const backIntensity = Math.min(0.95, backGated);
    
    // 3. MOVERS (Treble - El Alma)
    // Curva ^2 para expandir rango dinámico + boost 1.8x porque agudos tienen menos energía
    // Esto da picos visuales claros cuando hay melodía/voz
    const moverIntensity = Math.min(1.0, Math.pow(treble, 2) * 1.8);
    
    const zoneIntensities = {
      front: frontIntensity,
      back: backIntensity,
      mover: moverIntensity,
    };
    
    // 👓 WAVE 276: Log AGC TRUST cada 30 frames (~1 segundo)
    if (this.frameCount % 30 === 0) {
      console.log(`[AGC TRUST] � IN[${bass.toFixed(2)}, ${mid.toFixed(2)}, ${treble.toFixed(2)}] -> 💡 OUT[Front:${frontIntensity.toFixed(2)}, Back:${backIntensity.toFixed(2)}, Mover:${moverIntensity.toFixed(2)}]`);
    }
    
    this.lastOutput = {
      palette: outputPalette,
      zoneIntensities,
      isStrobeActive,
      isFlashActive,
      isSolarFlare,
      dimmerOverride,
      forceMovement,
      physicsApplied,
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
