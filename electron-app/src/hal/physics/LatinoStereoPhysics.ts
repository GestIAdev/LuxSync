/**
 *  WAVE 288.5: SANGRE LATINA - "One Flavor To Rule Them All"
 * ============================================================================
 * 
 * FILOSOFIA: "COMO TECHNO - UN COMPORTAMIENTO COJONUDO PARA TODO"
 * 
 * Siguiendo el exito de Techno (que funciona igual de bien para 
 * hard minimal, dubstep o neurofunk), Latino usa UN SOLO FLAVOR.
 * 
 * ¿POR QUE?
 * - El BPM detector es INESTABLE (60-200 BPM para la misma cancion)
 * - El 60% de "fiesta latina" es reggaeton anyway
 * - Los DJs mezclan estilos y quieren consistencia
 * - La paleta Caribe + Solar Flare ya se ve BRUTAL
 * 
 * COMPORTAMIENTO UNICO (fiesta-standard):
 * - Solar Flare: Ataque rapido, Decay lento (8%/frame)
 * - Machine Gun Blackout: Solo con drops REALES (energyDelta > 0.4)
 * - Movers: LERP suave en treble
 * - Back Pars: mid^1.5 con decay
 * - Front Pars: Ambar constante + pulso bass
 * 
 * VENTAJA: Los borrachos tienen su oscuridad para las caras 😂
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
// WAVE 288.5: Un solo tipo - fiesta-standard SIEMPRE
export type LatinoFlavor = 'fiesta-standard';

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
 * LatinoStereoPhysics - WAVE 288.7: "Color Liberation"
 * FISICA UNIFICADA - Solar Flare respeta la paleta de Selene
 */
export class LatinoStereoPhysics {
  // CONFIGURACIÓN - WAVE 288.7: Sin color hardcoded
  // ❌ ELIMINADO: SOLAR_FLARE_COLOR (el asesino del color)
  private static readonly KICK_THRESHOLD = 0.65;
  private static readonly BASS_DELTA_THRESHOLD = 0.12;
  private static readonly DECAY_RATE = 0.08;
  private static readonly MOVER_LERP = 0.08; // 🔧 Más suave para cintura latina
  private static readonly MOVER_GATE = 0.15; // 🔧 Gate: evita baile fantasma
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

    // DETECCION ELIMINADA - WAVE 288.5: Un solo flavor
    const flavor: LatinoFlavor = 'fiesta-standard';
    
    const resultPalette: LatinoPalette = {
      primary: { ...palette.primary },
      secondary: { ...palette.secondary },
      ambient: { ...palette.ambient },
      accent: { ...palette.accent },
    };
    
    // 🛡️ WAVE 288.9: GOLDEN RESCUE OMNIPRESENTE (Safety Net)
    // Si por CUALQUIER razón nos llega accent blanco/gris (sat < 30),
    // lo rescatamos a ORO ANTES de cualquier otro cálculo.
    // Esto es el CINTURÓN - SeleneColorEngine ya no debería mandar blanco,
    // pero por si acaso, aquí están los TIRANTES.
    const accentHsl = this.rgbToHsl(palette.accent);
    if (accentHsl.s < 30) {
      // ⚠️ Blanco/Gris detectado - inyectar ORO vibrante
      const goldenRescue = { h: 40, s: 100, l: 55 };
      const goldenRgb = this.hslToRgb(goldenRescue);
      resultPalette.accent = goldenRgb;
    }
    
    let isSolarFlare = false;
    let isMachineGunBlackout = false;
    let dimmerOverride: number | null = null;
    const forceMovement = true;
    
    const bass = metrics.normalizedBass;
    const mid = metrics.normalizedMid ?? metrics.normalizedEnergy;
    const treble = metrics.normalizedHigh ?? 0;
    const bassDelta = bass - this.lastBass;
    const energyDelta = previousEnergy - currentEnergy;
    
    // MACHINE GUN - WAVE 288.5: Solo con drops REALES (sin dependencia de flavor)
    // Esto da los blackouts que crean contraste y "oscuridad para los borrachos"
    const isNegativeDrop = (
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
        
        // 🔥 WAVE 288.9: Solar Flare SIMPLIFICADO
        // El Golden Rescue omnipresente (arriba) ya garantiza que resultPalette.accent
        // SIEMPRE tiene color vibrante. Solo hacemos boost aquí.
        const boostAmount = this.currentFlareIntensity * 20 * brightnessMod;
        resultPalette.accent = this.boostBrightness(resultPalette.accent, boostAmount);
        resultPalette.primary = this.boostBrightness(resultPalette.primary, boostAmount * 0.75);
      }
    }
    
    // BACK PARs: MID^1.5 con Decay
    const targetBackPar = Math.pow(mid, 1.5);
    if (targetBackPar > this.currentBackParIntensity) {
      this.currentBackParIntensity = targetBackPar;
    } else {
      this.currentBackParIntensity = this.currentBackParIntensity * (1 - LatinoStereoPhysics.DECAY_RATE * 2);
    }
    
    // 💃 MOVERS: WAVE 288.7 - MID (voces/melodía), no TREBLE (güiro/maracas)
    // El treble en latino es ruido constante (tiki-tiki-tiki), causa epilepsia
    // Los mids son las voces, trompetas, piano - eso tiene "cintura"
    const moverTarget = mid;
    
    // Gate: si la música está muy baja, movers quietos (evita baile fantasma)
    if (currentEnergy > LatinoStereoPhysics.MOVER_GATE) {
      this.currentMoverIntensity += (moverTarget - this.currentMoverIntensity) * LatinoStereoPhysics.MOVER_LERP;
    } else {
      // Decay suave hacia 0 cuando no hay suficiente energía
      this.currentMoverIntensity *= 0.95;
    }
    
    // FRONT PARs: Ambar fijo + pulso bass
    const bassPulse = bass * 0.15;
    const frontParIntensity = LatinoStereoPhysics.FRONT_PAR_BASE + bassPulse;
    
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
   * 🎵 WAVE 288.5: DETECCIÓN ELIMINADA
   * 
   * La detección de subgénero no aporta valor:
   * - BPM inestable (dobla/divide el tempo real)
   * - La física unificada funciona para TODO
   * - Como Techno: un comportamiento cojonudo para hard minimal, dubstep o neurofunk
   * 
   * SIEMPRE retorna 'fiesta-standard'
   */
  private detectFlavor(_bpm: number, _metrics: LatinoAudioMetrics): LatinoFlavor {
    return 'fiesta-standard';
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

  // 🆕 WAVE 288.8: Convertir RGB a HSL para detectar "blanco hospitalario"
  private rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    let h = 0;
    let s = 0;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
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
