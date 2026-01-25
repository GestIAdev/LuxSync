/**
 * WAVE 297: FIESTA LATINA COMPLETA 🎉🍾
 * ============================================================================
 * 
 * MISIÓN CUMPLIDA - De "roto" a "sublime" en 7 WAVEs (291-297)
 * 
 * 🔥 WAVE 1004.1: STEREO SPLIT & FAT BASS
 *   - Movers divididos: L (Mid/Voz) vs R (Treble/Trompetas)
 *   - Front Pars: Peak Hold "Gordo" (bombo latino ≠ click metal)
 * 
 * ARQUITECTURA FINAL:
 *   FRONT PARs → BASS (Gate 0.55, FAT HOLD 0.85) = BOMBO "BOOM" (gordo)
 *   BACK PARs  → TREBLE (Gate 0.22, Decay 0.25) = SNARE "tacka"
 *   MOVER L    → MID PURO (Gate 0.22, Decay 0.60) = VOZ/MELODÍA (El Galán)
 *   MOVER R    → TREBLE (Gate 0.18, Decay 0.40) = TROMPETAS/GÜIRA (La Dama)
 * 
 * CALIBRACIÓN (Análisis estadístico 200+ muestras):
 *   - Beat loss: ~4% (solo silencios arquitectónicos reales)
 *   - Delta < 0.10: 90% del flujo = CINTURA DE BAILARINA
 *   - Delta > 0.20: 9 casos = PUNCHES INTENCIONALES (drops/entradas)
 * 
 * GÉNEROS VALIDADOS:
 *   ✅ Reggaetón (TÚN-tacka-TÚN-tacka)
 *   ✅ Cumbia (ritmo de acordeón)
 *   ✅ Cumbiatón (híbrido)
 *   ✅ Remixes de DJ con EQ cuestionable
 * 
 * PRESUPUESTO: $0 y dos gatos 🐱🐱
 * COMPETENCIA: GrandMA3 = $$$$$$$  |  LuxSync = $800
 * 
 * "Lo espectacular es el 95%. Lo sublime es el 100%." - Radwulf (Virgo)
 * "La luz que respira, no parpadea." - PunkOpus
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
  // 🔥 WAVE 1004.1: STEREO SPLIT
  moverIntensityL: number;  // Mid (Congas/Voz) - "El Galán"
  moverIntensityR: number;  // Treble (Trompetas/Güira) - "La Dama"
  debugInfo: any;
}

export class LatinoStereoPhysics {
  // SOLAR FLARE
  private static readonly KICK_THRESHOLD = 0.55;
  private static readonly BASS_DELTA_THRESHOLD = 0.08;
  private static readonly DECAY_RATE = 0.08;
  
  // MOVERS (WAVE 760 - HIGH-FRAMERATE PRECISION)
  // El nuevo FFT elimina jitter → podemos usar decay más agresivo
  // Análisis estadístico de 200+ muestras de cumbia:
  //   - ~11.5% de beats perdidos con gate 0.24
  //   - Zona 0.20-0.24 tiene voces/melodías rescatables
  //   - Gate 0.22 rescata la mayoría sin meter ruido
  //   - Decay 0.60 (antes 0.75) para respuesta más robot, menos ghost
  private static readonly MOVER_ATTACK = 0.65;             // Subida rápida
  private static readonly MOVER_DECAY_FACTOR = 0.60;       // 🔧 WAVE 760: Bajado de 0.75 (más robot, menos ghost)
  private static readonly MOVER_GATE = 0.22;               // Sin cambio (rescatar zona 0.22-0.24)
  private static readonly MOVER_GAIN = 1.50;               // 🔧 WAVE 760: Subido de 1.30 (compensar decay más rápido)
  private static readonly MOVER_HYSTERESIS = 0.25;         // Piso de relleno
  private static readonly MOVER_TREBLE_REJECTION = 0.30;   // 🏆 ORO PURO - Voces autotune tienen treble
  
  // 🔥 WAVE 1004.1: STEREO SPLIT - MOVERS COMO PAREJA DE BAILE
  // LEFT (El Galán / Mid / Conga / Voz) - Hereda lógica "Mid Puro"
  private static readonly MOVER_L_GATE = 0.22;
  private static readonly MOVER_L_ATTACK = 0.65;
  private static readonly MOVER_L_DECAY = 0.60;
  
  // RIGHT (La Dama / Treble / Brass / Güira) - Nueva lógica "Brillo"
  private static readonly MOVER_R_GATE = 0.18;    // Más sensible a agudos
  private static readonly MOVER_R_ATTACK = 0.80;  // Ataque rápido (trompetazo)
  private static readonly MOVER_R_DECAY = 0.40;   // Decay rápido (shaker/güira)
  private static readonly MOVER_R_GAIN = 2.0;     // Boost para que brille
  
  // BACK PARs - WAVE 760: SURGICAL SNARE (solo snare y hi-hat puros)
  // Treble típico: 0.13-0.22. Gate subido para eliminar voces de fondo completamente
  // Attack instantáneo para respuesta quirúrgica
  private static readonly BACK_PAR_GATE = 0.22;            // 🔧 WAVE 760: Subido de 0.16 (solo snare/hi-hat puros)
  private static readonly BACK_PAR_ATTACK = 0.85;          // 🔧 WAVE 760: Subido de 0.70 (instantáneo)
  private static readonly BACK_PAR_DECAY = 0.25;           // Sin cambio (bofetada rápida)
  private static readonly BACK_PAR_GAIN = 1.9;             // Sin cambio
  
  // FRONT PARs (WAVE 760 - KILL THE BRICK)
  // Decay exponencial más agresivo para aprovechar motor sin jitter
  private static readonly FRONT_PAR_GATE = 0.55;           // 🔧 WAVE 760: Subido de 0.48 (solo bombos reales)
  private static readonly FRONT_PAR_ATTACK = 0.70;         // Sin cambio
  private static readonly FRONT_PAR_DECAY_LINEAR = 0.12;   // 🔧 WAVE 760: Subido de 0.05 (más del doble de rápido)
  private static readonly FRONT_PAR_GAIN = 1.7;            // Sin cambio
  
  // 🔥 WAVE 1004.1: FAT BASS (Peak Hold)
  // El bombo latino NO es "click" (metal), es "BOOM" (resonancia del parche)
  // Hold sostiene el pico visual unos milisegundos para dar PESO
  private static readonly BASS_HOLD_DECAY = 0.85;          // Caída más lenta = Bombo más gordo
  
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
  
  // 🔥 WAVE 1004.1: STEREO SPLIT & FAT BASS STATE
  private currentMoverIntensityL = 0;  // El Galán (Mid/Voz)
  private currentMoverIntensityR = 0;  // La Dama (Treble/Trompetas)
  private frontParPeak = 0;            // Fat Bass Peak Hold

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
    
    // MOVERS (WAVE 296 - MID PURO con Treble Rejection)
    // TREBLE_REJECTION 0.30 - las voces con autotune tienen armónicos agudos
    const midPuro = Math.max(0, mid - treble * LatinoStereoPhysics.MOVER_TREBLE_REJECTION);
    const moverTarget = midPuro;
    
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
    
    // ════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 1004.1: STEREO SPLIT - "LA PAREJA DE BAILE"
    // ════════════════════════════════════════════════════════════════════════
    
    // --- LEFT CHANNEL (El Galán / MID PURO - Voz/Congas) ---
    // Hereda lógica probada de Wave 296 (Mid - Treble Rejection)
    if (midPuro > LatinoStereoPhysics.MOVER_L_GATE) {
      const target = Math.min(1.0, midPuro * LatinoStereoPhysics.MOVER_GAIN);
      this.currentMoverIntensityL += (target - this.currentMoverIntensityL) * LatinoStereoPhysics.MOVER_L_ATTACK;
    } else {
      this.currentMoverIntensityL *= LatinoStereoPhysics.MOVER_L_DECAY;
    }
    
    // Histéresis para Left (Voz) - Mantiene el "suelo" para que no parpadee en frases
    if (this.currentMoverIntensityL > LatinoStereoPhysics.MOVER_HYSTERESIS && 
        this.currentMoverIntensityL < LatinoStereoPhysics.MOVER_HYSTERESIS * 1.5) {
      this.currentMoverIntensityL = LatinoStereoPhysics.MOVER_HYSTERESIS;
    } else if (this.currentMoverIntensityL < 0.05) {
      this.currentMoverIntensityL = 0;
    }
    
    // --- RIGHT CHANNEL (La Dama / TREBLE - Trompetas/Güira) ---
    // Escucha PURA de agudos, ignorando el mid. Más nerviosa y brillante.
    const brilloPuro = treble;
    
    if (brilloPuro > LatinoStereoPhysics.MOVER_R_GATE) {
      const target = Math.min(1.0, brilloPuro * LatinoStereoPhysics.MOVER_R_GAIN);
      this.currentMoverIntensityR += (target - this.currentMoverIntensityR) * LatinoStereoPhysics.MOVER_R_ATTACK;
    } else {
      this.currentMoverIntensityR *= LatinoStereoPhysics.MOVER_R_DECAY;
    }
    // SIN histéresis en Right - queremos que sea "picante" y rápido (güira/shaker)
    if (this.currentMoverIntensityR < 0.05) {
      this.currentMoverIntensityR = 0;
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 1004.1: FAT BASS - "EL GORDO" (Peak Hold)
    // ════════════════════════════════════════════════════════════════════════
    // El bombo latino NO es "click" (metal), es "BOOM" (resonancia del parche)
    // Peak Hold sostiene el pico visual, llenando el hueco entre bombos
    const frontTarget = bass;
    
    // Fase 1: Detección y Ataque
    if (frontTarget > LatinoStereoPhysics.FRONT_PAR_GATE) {
      const normalized = (frontTarget - LatinoStereoPhysics.FRONT_PAR_GATE) / (1 - LatinoStereoPhysics.FRONT_PAR_GATE);
      const boosted = Math.min(1.0, normalized * LatinoStereoPhysics.FRONT_PAR_GAIN);
      
      // Si el nuevo golpe es más fuerte que el pico actual → TOMAR (Ataque)
      if (boosted > this.frontParPeak) {
        this.frontParPeak = boosted;
      }
    }
    
    // Fase 2: Peak Hold & Decay ("El Gordo")
    // Decay al pico acumulado, NO a la señal cruda → rellena el hueco visual
    this.frontParPeak *= LatinoStereoPhysics.BASS_HOLD_DECAY;
    
    // Limpieza de ruido de fondo
    if (this.frontParPeak < 0.05) this.frontParPeak = 0;
    
    // Usar el pico sostenido como intensidad (no el valor instantáneo)
    const frontParIntensity = this.frontParPeak;
    
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
      moverIntensity: Math.max(this.currentMoverIntensityL, this.currentMoverIntensityR), // Fallback para efectos legacy
      frontParIntensity,
      isWhitePuncture,
      whitePunctureColor,
      // 🔥 WAVE 1004.1: STEREO SPLIT OUTPUT
      moverIntensityL: this.currentMoverIntensityL,  // El Galán (Mid/Voz)
      moverIntensityR: this.currentMoverIntensityR,  // La Dama (Treble/Trompetas)
      debugInfo: { 
        bass, mid, treble, bassDelta, 
        flareIntensity: this.currentFlareIntensity, 
        detectedBpm,
        whitePuncturePhase: this.whitePuncturePhase,
        sectionType: currentSection,
        // 🔥 WAVE 1004.1: Debug stereo
        moverL: this.currentMoverIntensityL,
        moverR: this.currentMoverIntensityR,
        fatBassPeak: this.frontParPeak,
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
    // 🔥 WAVE 1004.1: Reset stereo & fat bass state
    this.currentMoverIntensityL = 0;
    this.currentMoverIntensityR = 0;
    this.frontParPeak = 0;
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
