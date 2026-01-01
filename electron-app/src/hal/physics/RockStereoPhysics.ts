/**
 * 🎸 WAVE 142: ROCK STEREO PHYSICS
 * 🔮 WAVE 273: ELEMENTAL MODIFIERS INJECTION
 * ============================================================================
 * Módulo blindado para la lógica de reactividad del género Pop/Rock.
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Detectar "hits" de SNARE (Medios) y KICK (Bajos)
 * - Aplicar FLASH TUNGSTENO en caja, GOLPE DE COLOR en bombo
 * - NO modifica HUE base - solo brillo y acento
 * 
 * ORIGEN DE LA CALIBRACIÓN:
 * - WAVE 135: Portnoy Protocol (primera versión)
 * - WAVE 136: Stadium Separation (paleta de alto contraste)
 * - WAVE 137: Analog Gain (sweet spot thresholds: 0.32/0.35)
 * - WAVE 273: Elemental modulation (Fire=all hits, Water=epic only)
 * 
 * PRINCIPIO: "EXTRAER, NO MODIFICAR"
 * Todos los valores numéricos base son EXACTAMENTE los de Wave 137.
 * Los elementos ESCALAN estos valores, no los reemplazan.
 * ============================================================================
 */

import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

/**
 * Tipo RGB para colores (definido localmente para evitar dependencias circulares)
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Interfaz para la paleta de colores que procesa esta física
 */
export interface RockPalette {
  primary: RGB;
  secondary: RGB;
  ambient: RGB;
  accent: RGB;
}

/**
 * Métricas de audio necesarias para el cálculo de física Rock
 */
export interface RockAudioMetrics {
  normalizedMid: number;    // 0.0 - 1.0 (Snare/Caja)
  normalizedBass: number;   // 0.0 - 1.0 (Kick/Bombo)
  avgNormEnergy: number;    // 0.0 - 1.0 (Energía promedio para piso dinámico)
}

/**
 * Resultado de la aplicación de física Rock
 */
export interface RockPhysicsResult {
  palette: RockPalette;
  isSnareHit: boolean;
  isKickHit: boolean;
  debugInfo: {
    midsPulse: number;
    bassPulse: number;
    avgMid: number;
    avgBass: number;
  };
}

/**
 * RockStereoPhysics - Módulo de Reactividad para Pop/Rock
 * 
 * Esta clase encapsula la lógica de detección de hits de batería
 * calibrada en las Waves 135-137 (Portnoy Protocol → Analog Gain).
 */
export class RockStereoPhysics {
  // =========================================================================
  // 🔒 CONFIGURACIÓN INMUTABLE (Extraída de Wave 137 - NO TOCAR)
  // =========================================================================
  
  /**
   * Umbral de disparo para SNARE (Caja).
   * @wave 135: 0.20 (epilepsia)
   * @wave 136: 0.45 (muerto)
   * @wave 137: 0.32 (sweet spot)
   */
  private static readonly SNARE_THRESHOLD = 0.32;
  
  /**
   * Umbral de disparo para KICK (Bombo).
   * @wave 135: 0.25 (epilepsia)
   * @wave 136: 0.40 (muerto)
   * @wave 137: 0.35 (sweet spot)
   */
  private static readonly KICK_THRESHOLD = 0.35;
  
  /**
   * Factor de proxy para estimar promedio de Mids desde energía.
   */
  private static readonly AVG_MID_FACTOR = 0.8;
  
  /**
   * Factor de proxy para estimar promedio de Bass desde energía.
   */
  private static readonly AVG_BASS_FACTOR = 0.9;
  
  /**
   * Configuración de Flash Tungsteno (Snare Hit).
   * Hue 40 = Naranja/Amarillo cálido
   * Sat 20 = Casi blanco (desaturado)
   * Light 95 = Brightness Unchained
   */
  private static readonly TUNGSTEN_FLASH = { h: 40, s: 20, l: 95 };
  
  /**
   * Configuración de Kick Hit.
   * Light 80 = Punch visual elevado
   */
  private static readonly KICK_BRIGHTNESS = 80;
  
  /**
   * Brillo base del accent cuando no hay hit.
   */
  private static readonly DEFAULT_ACCENT_BRIGHTNESS = 50;

  // =========================================================================
  // 🎯 API PÚBLICA
  // =========================================================================

  /**
   * Aplica la física de Rock sobre la paleta actual.
   * 
   * Detecta hits de Snare y Kick, aplicando:
   * - FLASH TUNGSTENO (Snare): Casi blanco cálido
   * - GOLPE DE COLOR (Kick): Primary amplificado
   * 
   * WAVE 273: Inyección Elemental - Los modificadores zodiacales modulan
   * thresholds (sensibilidad) y brightness (intensidad del flash)
   * 
   * @param palette - Paleta actual con primary, secondary, ambient, accent
   * @param audio - Métricas de audio con mid, bass y energía normalizados
   * @param primaryHue - El hue del primary (para golpes de color en kick)
   * @param mods - Modificadores elementales opcionales (Fuego/Tierra/Aire/Agua)
   * @returns Paleta procesada + metadata de debug
   */
  public static apply(
    palette: RockPalette,
    audio: RockAudioMetrics,
    primaryHue: number = 0,
    mods?: ElementalModifiers
  ): RockPhysicsResult {
    // WAVE 273: Multiplicadores elementales (default = 1.0 = sin modificación)
    const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
    const brightnessMod = mods?.brightnessMultiplier ?? 1.0;

    const normalizedMid = audio.normalizedMid ?? 0.0;
    const normalizedBass = audio.normalizedBass ?? 0.0;
    const avgEnergy = audio.avgNormEnergy ?? 0.4;

    // Calcular promedios proxy
    const avgMid = avgEnergy * this.AVG_MID_FACTOR;
    const avgBass = avgEnergy * this.AVG_BASS_FACTOR;

    // Calcular pulsos relativos
    const midsPulse = Math.max(0, normalizedMid - avgMid);
    const bassPulse = Math.max(0, normalizedBass - avgBass);

    // Detectar hits - WAVE 273: thresholds modulados por elemento
    const effectiveSnareThreshold = this.SNARE_THRESHOLD * thresholdMod;
    const effectiveKickThreshold = this.KICK_THRESHOLD * thresholdMod;
    const isSnareHit = midsPulse > effectiveSnareThreshold;
    const isKickHit = bassPulse > effectiveKickThreshold;

    // Procesar accent según detección
    let processedPalette: RockPalette;

    if (isSnareHit) {
      // ⚡ FLASH TUNGSTENO (Wave 137) - WAVE 273: brightness modulado
      const modulatedLightness = Math.min(100, this.TUNGSTEN_FLASH.l * brightnessMod);
      const tungstenRgb = this.hslToRgb(
        this.TUNGSTEN_FLASH.h,
        this.TUNGSTEN_FLASH.s,
        modulatedLightness
      );
      processedPalette = {
        ...palette,
        accent: tungstenRgb
      };
    } else if (isKickHit) {
      // 🔴 GOLPE DE COLOR (Wave 137) - WAVE 273: brightness modulado
      const modulatedKickBrightness = Math.min(100, this.KICK_BRIGHTNESS * brightnessMod);
      const kickRgb = this.hslToRgb(primaryHue, 100, modulatedKickBrightness);
      processedPalette = {
        ...palette,
        accent: kickRgb
      };
    } else {
      // Sin hit - mantener paleta original
      processedPalette = palette;
    }

    return {
      palette: processedPalette,
      isSnareHit,
      isKickHit,
      debugInfo: {
        midsPulse,
        bassPulse,
        avgMid,
        avgBass
      }
    };
  }

  // =========================================================================
  // 🔧 MÉTODOS AUXILIARES
  // =========================================================================

  /**
   * Obtiene los umbrales actuales de configuración.
   */
  public static getThresholds(): {
    snareThreshold: number;
    kickThreshold: number;
  } {
    return {
      snareThreshold: this.SNARE_THRESHOLD,
      kickThreshold: this.KICK_THRESHOLD
    };
  }

  /**
   * Evalúa si un par de valores triggearía hits (sin aplicar).
   */
  public static wouldTrigger(
    mid: number,
    bass: number,
    avgEnergy: number
  ): { snare: boolean; kick: boolean } {
    const avgMid = avgEnergy * this.AVG_MID_FACTOR;
    const avgBass = avgEnergy * this.AVG_BASS_FACTOR;
    const midsPulse = Math.max(0, mid - avgMid);
    const bassPulse = Math.max(0, bass - avgBass);
    
    return {
      snare: midsPulse > this.SNARE_THRESHOLD,
      kick: bassPulse > this.KICK_THRESHOLD
    };
  }

  /**
   * Helper interno: HSL → RGB
   */
  private static hslToRgb(h: number, s: number, l: number): RGB {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }
}
