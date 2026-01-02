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
  sectionType?: string;  // 🆕 WAVE 290: 'verse'|'chorus'|'drop'|'break' para White Puncture
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
  // 🔥 WAVE 290: White Puncture - Flash blanco en entrada de DROP
  isWhitePuncture: boolean;
  whitePunctureColor: RGB | null;  // null = usar paleta normal, RGB = forzar blanco
  debugInfo: any;
}

/**
 * LatinoStereoPhysics - WAVE 290: "Latino Tuning & Drop Impact"
 * FISICA UNIFICADA - Solar Flare respeta la paleta de Selene
 * 
 * WAVE 290 CAMBIOS:
 * - MOVER_LERP: 0.08 → 0.04 ("Caderas de cumbia" - movimiento líquido)
 * - Back PARs: Mid^1.5 → Bass Gated (solo golpes de bombo, no voces)
 * - White Puncture: Dimmer Dip + Flash blanco en entrada de DROP
 */
export class LatinoStereoPhysics {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN - WAVE 290: Latino Tuning
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Solar Flare
  private static readonly KICK_THRESHOLD = 0.65;
  private static readonly BASS_DELTA_THRESHOLD = 0.12;
  private static readonly DECAY_RATE = 0.08;
  
  // 🔥 WAVE 290: MOVER_LERP reducido para "caderas de cumbia"
  // 0.04 = alcanza 90% del target en ~57 frames (~950ms) → movimiento LÍQUIDO
  private static readonly MOVER_LERP = 0.03; // 🔧 WAVE 290.2: Aún más suave
  private static readonly MOVER_GATE = 0.20; // 🔧 WAVE 290.2: Gate más alto para evitar parpadeo
  private static readonly MOVER_DECAY = 0.92; // 🔧 WAVE 290.2: Decay más agresivo
  
  // 🔥 WAVE 290: Back PARs ahora escuchan BASS (bombo), no MID (voces)
  private static readonly BACK_PAR_GATE = 0.30;   // 🔧 WAVE 290.2: Bajado de 0.45 para más reactividad
  private static readonly BACK_PAR_DECAY = 0.15;  // 🔧 WAVE 290.2: Un poco más lento
  
  // Front PARs - 🔧 WAVE 290.2: Reducido para que respire
  private static readonly FRONT_PAR_BASE = 0.35;  // Era 0.65, ahora más dinámico
  private static readonly FRONT_PAR_BASS_MULT = 0.50; // Más influencia del bass
  
  // Machine Gun Blackout
  private static readonly NEGATIVE_DROP_THRESHOLD = 0.4;
  private static readonly NEGATIVE_DROP_WINDOW_MS = 100;
  private static readonly BLACKOUT_FRAMES = 3;
  
  // 🔥 WAVE 290: White Puncture (DROP Impact)
  private static readonly WHITE_PUNCTURE_DIP_FRAMES = 2;    // Frames de oscuridad antes del flash
  private static readonly WHITE_PUNCTURE_FLASH_FRAMES = 1;  // Frame de flash blanco
  private static readonly WHITE_PUNCTURE_DIP_LEVEL = 0.30;  // Dimmer al 30% durante dip

  // ESTADO INTERNO
  private blackoutFramesRemaining = 0;
  private lastEnergy = 0;
  private lastBass = 0;
  private lastFrameTime = Date.now();
  private lastBpm = 0;
  private currentFlareIntensity = 0;
  private currentMoverIntensity = 0;
  private currentBackParIntensity = 0;
  
  // 🔥 WAVE 290: Estado White Puncture
  private lastSectionType: string = 'verse';
  private whitePuncturePhase: 'idle' | 'dip' | 'flash' = 'idle';
  private whitePunctureFramesRemaining = 0;

  public apply(
    palette: LatinoPalette,
    metrics: LatinoAudioMetrics,
    bpm?: number,
    mods?: ElementalModifiers,
    sectionType?: string  // 🆕 WAVE 290: Sección musical para White Puncture
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
    
    // 🔥 WAVE 290: Detectar entrada en DROP para White Puncture
    const currentSection = sectionType ?? 'verse';
    const justEnteredDrop = currentSection === 'drop' && this.lastSectionType !== 'drop';
    this.lastSectionType = currentSection;
    
    // Iniciar secuencia White Puncture si acabamos de entrar en DROP
    if (justEnteredDrop) {
      this.whitePuncturePhase = 'dip';
      this.whitePunctureFramesRemaining = LatinoStereoPhysics.WHITE_PUNCTURE_DIP_FRAMES;
      console.log('[LatinoPhysics] 💥 WAVE 290: WHITE PUNCTURE iniciado - DROP detected!');
    }

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
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 290: BACK PARs - BASS GATED (Solo golpes de bombo, NO voces)
    // ═══════════════════════════════════════════════════════════════════════════
    // ANTES: Mid^1.5 (escuchaba voces → efecto karaoke)
    // AHORA: Bass con Gate 0.45 (solo golpes fuertes de bombo/bajo)
    const bassGated = bass > LatinoStereoPhysics.BACK_PAR_GATE 
      ? Math.pow(bass - LatinoStereoPhysics.BACK_PAR_GATE, 1.3) * 2 
      : 0;
    
    if (bassGated > this.currentBackParIntensity) {
      // Ataque instantáneo
      this.currentBackParIntensity = Math.min(1.0, bassGated);
    } else {
      // Decay rápido para "punch"
      this.currentBackParIntensity = Math.max(0, this.currentBackParIntensity - LatinoStereoPhysics.BACK_PAR_DECAY);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 💃 MOVERS: WAVE 290.2 - MID con LERP 0.03 y Gate 0.20
    // ═══════════════════════════════════════════════════════════════════════════
    // El treble en latino es ruido constante (tiki-tiki-tiki), causa epilepsia
    // Los mids son las voces, trompetas, piano - eso tiene "cintura"
    const moverTarget = mid;
    
    // 🔧 WAVE 290.2: Gate más estricto + decay más agresivo
    if (currentEnergy > LatinoStereoPhysics.MOVER_GATE && mid > 0.25) {
      // Solo se mueve si hay energía Y mid significativo
      this.currentMoverIntensity += (moverTarget - this.currentMoverIntensity) * LatinoStereoPhysics.MOVER_LERP;
    } else {
      // 🔧 WAVE 290.2: Decay más agresivo para que se apague
      this.currentMoverIntensity *= LatinoStereoPhysics.MOVER_DECAY;
      // Floor: evitar valores fantasma
      if (this.currentMoverIntensity < 0.05) {
        this.currentMoverIntensity = 0;
      }
    }
    
    // 🔧 WAVE 290.2: FRONT PARs más dinámicos - respiran con el bass
    // Base más baja + mayor influencia del bass = más contraste
    const bassPulse = bass * LatinoStereoPhysics.FRONT_PAR_BASS_MULT;
    const frontParIntensity = LatinoStereoPhysics.FRONT_PAR_BASE + bassPulse;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 290: WHITE PUNCTURE STATE MACHINE
    // ═══════════════════════════════════════════════════════════════════════════
    // Fase DIP: Oscurecer (dimmer 30%) para generar vacío
    // Fase FLASH: Blanco puro (255,255,255) + dimmer 100%
    // Fase IDLE: Normal
    let isWhitePuncture = false;
    let whitePunctureColor: RGB | null = null;
    
    if (this.whitePuncturePhase !== 'idle') {
      this.whitePunctureFramesRemaining--;
      
      if (this.whitePuncturePhase === 'dip') {
        // Fase DIP: Oscurecer
        dimmerOverride = LatinoStereoPhysics.WHITE_PUNCTURE_DIP_LEVEL;
        
        if (this.whitePunctureFramesRemaining <= 0) {
          // Transición a FLASH
          this.whitePuncturePhase = 'flash';
          this.whitePunctureFramesRemaining = LatinoStereoPhysics.WHITE_PUNCTURE_FLASH_FRAMES;
        }
      } else if (this.whitePuncturePhase === 'flash') {
        // Fase FLASH: Blanco puro
        isWhitePuncture = true;
        whitePunctureColor = { r: 255, g: 255, b: 255 };
        dimmerOverride = 1.0;  // Dimmer al 100%
        
        if (this.whitePunctureFramesRemaining <= 0) {
          // Fin de secuencia
          this.whitePuncturePhase = 'idle';
          console.log('[LatinoPhysics] 💥 WHITE PUNCTURE completado');
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
