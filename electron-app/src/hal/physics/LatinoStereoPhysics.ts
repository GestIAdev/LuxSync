/**
 *  WAVE 288: SANGRE LATINA - "Unified Solar Physics"
 * ============================================================================
 * 
 * FILOSOFIA: "UN SISTEMA QUE SIEMPRE FUNCIONA, CON SABORES OPCIONALES"
 * 
 * La fisica unificada se basa en SOLAR FLARE como efecto principal:
 * - Ataque rapido (respuesta inmediata al bass)
 * - Decay lento (la luz "quema" y "respira")
 * - Funciona PERFECTO para todo: reggaeton, cumbia, salsa
 * 
 * DETECCION SIMPLE (3 lineas):
 * - Reggaeton: Mucho bass + BPM lento (80-105) o doble (155-200)
 * - Tropical: Treble > Bass * 1.2 (Guiro/Maracas dominan)
 * - Default: Unified (siempre se ve bien)
 * 
 * SI LA DETECCION FALLA: El modo Unified sigue viendose increible.
 * ============================================================================
 */

// WAVE 273: Elemental Modifiers
import { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

// Type definitions
export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }

// Interfaces
export interface LatinoPalette { primary: RGB; secondary: RGB; ambient: RGB; accent: RGB; }
export interface LatinoAudioMetrics { 
  normalizedBass: number; 
  normalizedMid?: number;
  normalizedEnergy: number; 
  normalizedHigh?: number; 
  previousEnergy?: number; 
  deltaTime?: number; 
}
export type LatinoFlavor = 'reggaeton' | 'tropical' | 'fiesta-standard';

export interface LatinoPhysicsResult {
  palette: LatinoPalette;
  isSolarFlare: boolean;
  isMachineGunBlackout: boolean;
  dimmerOverride: number | null;
  forceMovement: boolean;
  flavor: LatinoFlavor;
  backParIntensity: number;
  moverIntensity: number;
  frontParIntensity: number;
  debugInfo: any;
}

/**
 * LatinoStereoPhysics - WAVE 288: "Sangre Latina"
 * FISICA UNIFICADA con sabores opcionales.
 */
export class LatinoStereoPhysics {
  // CONFIGURACI�N INMUTABLE - WAVE 288
  private static readonly SOLAR_FLARE_COLOR: HSL = { h: 35, s: 100, l: 50 };
  private static readonly KICK_THRESHOLD = 0.65;
  private static readonly BASS_DELTA_THRESHOLD = 0.12;
  private static readonly DECAY_RATE = 0.08;
  private static readonly MOVER_LERP = 0.05;
  private static readonly FRONT_PAR_BASE = 0.65;
  private static readonly NEGATIVE_DROP_THRESHOLD = 0.4;
  private static readonly NEGATIVE_DROP_WINDOW_MS = 100;
  private static readonly BLACKOUT_FRAMES = 3;

  // ESTADO INTERNO
  private blackoutFramesRemaining = 0;
  private lastEnergy = 0;
  private lastBass = 0;
  private lastFrameTime = Date.now();
  private lastBpm = 0;
  private currentFlareIntensity = 0;
  private currentMoverIntensity = 0;
  private currentBackParIntensity = 0;

  public apply(
    palette: LatinoPalette,
    metrics: LatinoAudioMetrics,
    bpm?: number,
    mods?: ElementalModifiers
  ): LatinoPhysicsResult {
    const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
    const brightnessMod = mods?.brightnessMultiplier ?? 1.0;
    const now = Date.now();
    const deltaTime = metrics.deltaTime ?? (now - this.lastFrameTime);
    this.lastFrameTime = now;
    
    const previousEnergy = metrics.previousEnergy ?? this.lastEnergy;
    const currentEnergy = metrics.normalizedEnergy;
    const detectedBpm = bpm ?? this.lastBpm;
    if (bpm) this.lastBpm = bpm;

    // DETECCION HEURISTICA SIMPLE
    const flavor = this.detectFlavor(detectedBpm, metrics);
    
    const resultPalette: LatinoPalette = {
      primary: { ...palette.primary },
      secondary: { ...palette.secondary },
      ambient: { ...palette.ambient },
      accent: { ...palette.accent },
    };
    
    let isSolarFlare = false;
    let isMachineGunBlackout = false;
    let dimmerOverride: number | null = null;
    const forceMovement = true;
    
    const bass = metrics.normalizedBass;
    const mid = metrics.normalizedMid ?? metrics.normalizedEnergy;
    const treble = metrics.normalizedHigh ?? 0;
    const bassDelta = bass - this.lastBass;
    const energyDelta = previousEnergy - currentEnergy;
    
    // MACHINE GUN (Solo Reggaeton)
    const isNegativeDrop = flavor === 'reggaeton' && (
      energyDelta >= LatinoStereoPhysics.NEGATIVE_DROP_THRESHOLD &&
      deltaTime <= LatinoStereoPhysics.NEGATIVE_DROP_WINDOW_MS &&
      previousEnergy > 0.6
    );
    
    if (isNegativeDrop) {
      this.blackoutFramesRemaining = LatinoStereoPhysics.BLACKOUT_FRAMES;
    }
    
    if (this.blackoutFramesRemaining > 0) {
      isMachineGunBlackout = true;
      dimmerOverride = 0;
      this.blackoutFramesRemaining--;
    }
    
    // SOLAR FLARE (Ataque rapido, Decay lento)
    if (!isMachineGunBlackout) {
      const effectiveThreshold = LatinoStereoPhysics.KICK_THRESHOLD * thresholdMod;
      const effectiveDelta = LatinoStereoPhysics.BASS_DELTA_THRESHOLD * thresholdMod;
      const isKick = bass > effectiveThreshold && bassDelta > effectiveDelta;
      
      if (isKick) {
        const kickPower = (bass - effectiveThreshold) / (1 - effectiveThreshold);
        this.currentFlareIntensity = Math.min(1.0, kickPower * 1.5);
        isSolarFlare = true;
      } else {
        this.currentFlareIntensity = Math.max(0, this.currentFlareIntensity - LatinoStereoPhysics.DECAY_RATE);
      }
      
      if (this.currentFlareIntensity > 0.1) {
        isSolarFlare = true;
        const flareColor = {
          h: LatinoStereoPhysics.SOLAR_FLARE_COLOR.h,
          s: LatinoStereoPhysics.SOLAR_FLARE_COLOR.s,
          l: Math.min(100, LatinoStereoPhysics.SOLAR_FLARE_COLOR.l * brightnessMod),
        };
        const flareRgb = this.hslToRgb(flareColor);
        resultPalette.accent = this.blendRgb(palette.accent, flareRgb, this.currentFlareIntensity);
        resultPalette.primary = this.boostBrightness(resultPalette.primary, this.currentFlareIntensity * 15 * brightnessMod);
      }
    }
    
    // BACK PARs: MID^1.5 con Decay
    const targetBackPar = Math.pow(mid, 1.5);
    if (targetBackPar > this.currentBackParIntensity) {
      this.currentBackParIntensity = targetBackPar;
    } else {
      this.currentBackParIntensity = this.currentBackParIntensity * (1 - LatinoStereoPhysics.DECAY_RATE * 2);
    }
    
    // MOVERS: LERP Suave
    this.currentMoverIntensity += (treble - this.currentMoverIntensity) * LatinoStereoPhysics.MOVER_LERP;
    if (flavor === 'tropical' && treble > 0.7) {
      this.currentMoverIntensity += (Math.random() - 0.5) * 0.05;
      this.currentMoverIntensity = Math.max(0, Math.min(1, this.currentMoverIntensity));
    }
    
    // FRONT PARs: Ambar fijo
    const bassPulse = bass * 0.15;
    let frontParIntensity = LatinoStereoPhysics.FRONT_PAR_BASE + bassPulse;
    if (flavor === 'reggaeton' && isSolarFlare) {
      frontParIntensity = Math.min(0.95, frontParIntensity + 0.1);
    }
    
    this.lastEnergy = currentEnergy;
    this.lastBass = bass;
    
    return {
      palette: resultPalette,
      isSolarFlare,
      isMachineGunBlackout,
      dimmerOverride,
      forceMovement,
      flavor,
      backParIntensity: this.currentBackParIntensity,
      moverIntensity: this.currentMoverIntensity,
      frontParIntensity,
      debugInfo: { bass, mid, treble, bassDelta, flareIntensity: this.currentFlareIntensity, detectedBpm },
    };
  }

  /**
   * 🎵 WAVE 288.2: DETECCIÓN HEURÍSTICA CONSERVADORA
   * 
   * FILOSOFÍA: "Ante la duda, fiesta-standard (que siempre funciona)"
   * 
   * Solo detectamos reggaeton con ALTA confianza:
   * - Bass MUY alto (>0.75) - el dembow tiene bass prominente
   * - BPM específico (85-100 o doble 170-200) - el perreo tiene BPM fijo
   * - Sin metadata/ML no podemos hacer más - mejor default que falsos positivos
   */
  private detectFlavor(bpm: number, metrics: LatinoAudioMetrics): LatinoFlavor {
    const bass = metrics.normalizedBass;
    const treble = metrics.normalizedHigh ?? 0;
    
    // DEFAULT: fiesta-standard (funciona para TODO)
    let flavor: LatinoFlavor = 'fiesta-standard';
    
    // REGGAETON: Solo si estamos MUY seguros
    // Bass > 0.75 (muy alto) + BPM típico de dembow (85-100 o doble)
    const isReggaetonBpm = (bpm >= 85 && bpm <= 100) || (bpm >= 170 && bpm <= 200);
    if (bass > 0.75 && isReggaetonBpm) {
      flavor = 'reggaeton';
    }
    // TROPICAL: Cuando treble domina claramente (güiro, maracas, timbales)
    else if (treble > bass * 1.5 && treble > 0.4) {
      flavor = 'tropical';
    }
    
    return flavor;
  }

  public reset(): void {
    this.blackoutFramesRemaining = 0;
    this.lastEnergy = 0;
    this.lastBass = 0;
    this.lastFrameTime = Date.now();
    this.lastBpm = 0;
    this.currentFlareIntensity = 0;
    this.currentMoverIntensity = 0;
    this.currentBackParIntensity = 0;
  }

  private hslToRgb(hsl: HSL): RGB {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;
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
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  private boostBrightness(rgb: RGB, percent: number): RGB {
    const factor = 1 + (percent / 100);
    return {
      r: Math.min(255, Math.round(rgb.r * factor)),
      g: Math.min(255, Math.round(rgb.g * factor)),
      b: Math.min(255, Math.round(rgb.b * factor)),
    };
  }

  private blendRgb(from: RGB, to: RGB, factor: number): RGB {
    const f = Math.max(0, Math.min(1, factor));
    return {
      r: Math.round(from.r + (to.r - from.r) * f),
      g: Math.round(from.g + (to.g - from.g) * f),
      b: Math.round(from.b + (to.b - from.b) * f),
    };
  }
}

export default LatinoStereoPhysics;
