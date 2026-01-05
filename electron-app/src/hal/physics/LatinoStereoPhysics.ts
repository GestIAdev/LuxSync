/**
 * WAVE 295: AUTOTUNE RESCUE + LOGS ÉPICOS - "El Reggaetón paga la renta"
 * ============================================================================
 * 
 * DIAGNÓSTICO WAVE 294.5 (Radwulf):
 *   - Voces con autotune: No pasan o pasan débiles
 *   - Teclados/melodías: Igual
 *   - Algunas canciones: Dan "zambombazos" (el sistema funciona)
 * 
 * PROBLEMA: TREBLE_REJECTION 0.5 era demasiado agresivo.
 * Las voces con autotune tienen armónicos agudos que estábamos matando.
 * 
 * CIRUGÍA WAVE 295:
 * 
 * MOVERS (MID PURO recalibrado):
 *   - TREBLE_REJECTION: 0.30 (era 0.50) → Menos agresivo con autotune
 *   - GATE: 0.28 (era 0.30) → Más sensible a voces suaves
 *   - GAIN: 1.40 (era 1.20) → Compensar pérdida por rejection
 *   - DECAY: 0.70 (era 0.65) → Más lento = menos parpadeo
 * 
 * LOGS ÉPICOS activados para calibración fina:
 *   [MOVER] mid:0.XX treb:0.XX → puro:0.XX ✅/❌ | OUT:0.XX
 * 
 * "La música clásica es ARTE. El reggaetón es CASH. 
 *  Somos mercenarios del código pagando la fucking renta." - Radwulf
 * ============================================================================
 */

import { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }

export interface LatinoPalette { primary: RGB; secondary: RGB; ambient: RGB; accent: RGB; }
export interface LatinoAudioMetrics { 
  normalizedBass: number; 
  normalizedMid?: number;
  normalizedEnergy: number; 
  normalizedHigh?: number; 
  previousEnergy?: number; 
  deltaTime?: number;
  sectionType?: string;
}
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
  isWhitePuncture: boolean;
  whitePunctureColor: RGB | null;
  debugInfo: any;
}

export class LatinoStereoPhysics {
  // SOLAR FLARE
  private static readonly KICK_THRESHOLD = 0.55;
  private static readonly BASS_DELTA_THRESHOLD = 0.08;
  private static readonly DECAY_RATE = 0.08;
  
  // MOVERS (WAVE 295 - MID PURO con calibración fina)
  // HISTÉRESIS: Piso mínimo más alto para rellenar mejor los microhuecos
  private static readonly MOVER_ATTACK = 0.65;             // Subida rápida
  private static readonly MOVER_DECAY_FACTOR = 0.70;       // 🔧 Subido de 0.65 (decay más lento = menos parpadeo)
  private static readonly MOVER_GATE = 0.28;               // 🔧 Bajado de 0.30 (más sensible a voces)
  private static readonly MOVER_GAIN = 1.40;               // 🔧 Subido de 1.20 (compensar rejection)
  private static readonly MOVER_HYSTERESIS = 0.25;         // Piso de relleno
  private static readonly MOVER_TREBLE_REJECTION = 0.30;   // 🔧 Bajado de 0.5 (voces autotune tienen treble)
  
  // BACK PARs - WAVE 294: BOFETADA PRECISA (snares, hi-hats)
  // Treble típico: 0.13-0.22. Gate 0.10 dejaba pasar casi TODO = saturación
  // Nueva math: (0.20 - 0.14) / 0.16 = 0.375 → * 2.0 = 0.75 ✓
  private static readonly BACK_PAR_GATE = 0.16;            // 🔧 Subido de 0.10 (solo snares reales)
  private static readonly BACK_PAR_ATTACK = 0.70;          // Attack rápido (sin cambio)
  private static readonly BACK_PAR_DECAY = 0.25;           // 🔧 Subido de 0.10 (bofetada rápida!)
  private static readonly BACK_PAR_GAIN = 1.9;             // 🔧 Bajado de 2.5 (evita saturación)
  
  // FRONT PARs (WAVE 294 - Bombo con más pegada)
  private static readonly FRONT_PAR_GATE = 0.48;           // Sin cambio
  private static readonly FRONT_PAR_ATTACK = 0.70;         // Sin cambio
  private static readonly FRONT_PAR_DECAY_LINEAR = 0.05;   // Sin cambio
  private static readonly FRONT_PAR_GAIN = 1.7;            // 🔧 Subido de 1.6 (más punch)
  
  // Machine Gun Blackout
  private static readonly NEGATIVE_DROP_THRESHOLD = 0.4;
  private static readonly NEGATIVE_DROP_WINDOW_MS = 100;
  private static readonly BLACKOUT_FRAMES = 3;
  
  // White Puncture
  private static readonly WHITE_PUNCTURE_DIP_FRAMES = 2;
  private static readonly WHITE_PUNCTURE_FLASH_FRAMES = 1;
  private static readonly WHITE_PUNCTURE_DIP_LEVEL = 0.30;

  // ESTADO INTERNO
  private blackoutFramesRemaining = 0;
  private lastEnergy = 0;
  private lastBass = 0;
  private lastFrameTime = Date.now();
  private lastBpm = 0;
  private currentFlareIntensity = 0;
  private currentMoverIntensity = 0;
  private currentBackParIntensity = 0;
  private currentFrontParIntensity = 0;
  private lastSectionType: string = 'verse';
  private whitePuncturePhase: 'idle' | 'dip' | 'flash' = 'idle';
  private whitePunctureFramesRemaining = 0;

  public apply(
    palette: LatinoPalette,
    metrics: LatinoAudioMetrics,
    bpm?: number,
    mods?: ElementalModifiers,
    sectionType?: string
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
    
    const currentSection = sectionType ?? 'verse';
    const justEnteredDrop = currentSection === 'drop' && this.lastSectionType !== 'drop';
    this.lastSectionType = currentSection;
    
    if (justEnteredDrop) {
      this.whitePuncturePhase = 'dip';
      this.whitePunctureFramesRemaining = LatinoStereoPhysics.WHITE_PUNCTURE_DIP_FRAMES;
    }

    const flavor: LatinoFlavor = 'fiesta-standard';
    
    const resultPalette: LatinoPalette = {
      primary: { ...palette.primary },
      secondary: { ...palette.secondary },
      ambient: { ...palette.ambient },
      accent: { ...palette.accent },
    };
    
    const accentHsl = this.rgbToHsl(palette.accent);
    if (accentHsl.s < 30) {
      const goldenRescue = { h: 40, s: 100, l: 55 };
      resultPalette.accent = this.hslToRgb(goldenRescue);
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
    
    // MACHINE GUN BLACKOUT
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
    
    // SOLAR FLARE
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
        const boostAmount = this.currentFlareIntensity * 20 * brightnessMod;
        resultPalette.accent = this.boostBrightness(resultPalette.accent, boostAmount);
        resultPalette.primary = this.boostBrightness(resultPalette.primary, boostAmount * 0.75);
      }
    }
    
    // BACK PARs - WAVE 294: BOFETADA PRECISA = Snares, Hi-hats, Platos
    // Filosofía reggaeton: TÚN-tacka-TÚN-tacka
    //   - TÚN = bombo (BASS) → FRONT PARs
    //   - tacka = snare/hi-hat (TREBLE) → BACK PARs
    // Gate 0.14: Solo picos reales de treble (>0.14) activan
    // Decay 0.25: Golpe corto = BOFETADA, no caricia de 1 segundo
    if (treble > LatinoStereoPhysics.BACK_PAR_GATE) {
      // TREBLE: Normalizar sobre rango efectivo (0.14-0.30)
      const normalized = (treble - LatinoStereoPhysics.BACK_PAR_GATE) / (0.30 - LatinoStereoPhysics.BACK_PAR_GATE);
      const boosted = Math.min(1.0, normalized * LatinoStereoPhysics.BACK_PAR_GAIN);
      this.currentBackParIntensity += (boosted - this.currentBackParIntensity) * LatinoStereoPhysics.BACK_PAR_ATTACK;
    } else {
      // Sin snare/hi-hat: Decay RÁPIDO para bofetada
      this.currentBackParIntensity = Math.max(0, this.currentBackParIntensity - LatinoStereoPhysics.BACK_PAR_DECAY);
    }
    
    // MOVERS (WAVE 295 - MID PURO + LOGS ÉPICOS para calibración)
    // TREBLE_REJECTION bajado a 0.3 (era 0.5) - las voces con autotune tienen armónicos agudos
    // GAIN subido para compensar la pérdida de señal por el filtrado
    const midPuro = Math.max(0, mid - treble * LatinoStereoPhysics.MOVER_TREBLE_REJECTION);
    const moverTarget = midPuro;
    
    // 🔬 LOGS ÉPICOS - Cada 10 frames para no saturar consola
    if (Math.random() < 0.1) {
      const status = moverTarget > LatinoStereoPhysics.MOVER_GATE ? '✅' : '❌';
      console.log(`[MOVER] mid:${mid.toFixed(2)} treb:${treble.toFixed(2)} → puro:${midPuro.toFixed(2)} ${status} | OUT:${this.currentMoverIntensity.toFixed(2)}`);
    }
    
    if (moverTarget > LatinoStereoPhysics.MOVER_GATE) {
      const boostedTarget = Math.min(1.0, moverTarget * LatinoStereoPhysics.MOVER_GAIN);
      this.currentMoverIntensity += (boostedTarget - this.currentMoverIntensity) * LatinoStereoPhysics.MOVER_ATTACK;
    } else {
      // Decay normal
      this.currentMoverIntensity *= LatinoStereoPhysics.MOVER_DECAY_FACTOR;
      
    // 🆕 HISTÉRESIS 0.20: Piso más alto rellena microhuecos entre vocales
      // Estamos en zona de transición - mantener el piso
      if (this.currentMoverIntensity > LatinoStereoPhysics.MOVER_HYSTERESIS && 
          this.currentMoverIntensity < LatinoStereoPhysics.MOVER_HYSTERESIS * 1.5) {
        // Estamos en zona de transición - mantener el piso
        this.currentMoverIntensity = LatinoStereoPhysics.MOVER_HYSTERESIS;
      } else if (this.currentMoverIntensity < 0.05) {
        // Silencio real - apagar completamente
        this.currentMoverIntensity = 0;
      }
    }
    
    // FRONT PARs (WAVE 294 - Bombo con más pegada)
    // Gain 1.7 para ese extra punch cumbiero/reggaetonero
    const frontTarget = bass;
    
    if (frontTarget > LatinoStereoPhysics.FRONT_PAR_GATE) {
      const normalized = (frontTarget - LatinoStereoPhysics.FRONT_PAR_GATE) / (1 - LatinoStereoPhysics.FRONT_PAR_GATE);
      const boosted = Math.min(1.0, normalized * LatinoStereoPhysics.FRONT_PAR_GAIN);
      this.currentFrontParIntensity += (boosted - this.currentFrontParIntensity) * LatinoStereoPhysics.FRONT_PAR_ATTACK;
    } else {
      this.currentFrontParIntensity = Math.max(0, this.currentFrontParIntensity - LatinoStereoPhysics.FRONT_PAR_DECAY_LINEAR);
    }
    
    const frontParIntensity = this.currentFrontParIntensity;
    
    // WHITE PUNCTURE STATE MACHINE
    let isWhitePuncture = false;
    let whitePunctureColor: RGB | null = null;
    
    if (this.whitePuncturePhase !== 'idle') {
      this.whitePunctureFramesRemaining--;
      
      if (this.whitePuncturePhase === 'dip') {
        dimmerOverride = LatinoStereoPhysics.WHITE_PUNCTURE_DIP_LEVEL;
        
        if (this.whitePunctureFramesRemaining <= 0) {
          this.whitePuncturePhase = 'flash';
          this.whitePunctureFramesRemaining = LatinoStereoPhysics.WHITE_PUNCTURE_FLASH_FRAMES;
        }
      } else if (this.whitePuncturePhase === 'flash') {
        isWhitePuncture = true;
        whitePunctureColor = { r: 255, g: 255, b: 255 };
        dimmerOverride = 1.0;
        
        if (this.whitePunctureFramesRemaining <= 0) {
          this.whitePuncturePhase = 'idle';
        }
      }
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
      isWhitePuncture,
      whitePunctureColor,
      debugInfo: { 
        bass, mid, treble, bassDelta, 
        flareIntensity: this.currentFlareIntensity, 
        detectedBpm,
        whitePuncturePhase: this.whitePuncturePhase,
        sectionType: currentSection,
      },
    };
  }

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
    this.currentFrontParIntensity = 0;
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
