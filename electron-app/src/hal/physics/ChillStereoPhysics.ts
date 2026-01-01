/**
 * 🌊 WAVE 146: CHILL STEREO PHYSICS ("The Jellyfish Breath")
 * ============================================================================
 * Módulo blindado para la lógica de reactividad del género Chill/Lounge.
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Generar BREATHING PULSE (onda senoidal lenta)
 * - IGNORAR todos los eventos agresivos (strobes, picos)
 * - Mantener la paz absoluta (bioluminiscencia)
 * 
 * WAVE 273: ELEMENTAL INJECTION
 * El elemento zodiacal modula la frecuencia y amplitud de la respiración:
 * - Fuego: Respiración más rápida (decayMod < 1)
 * - Tierra: Respiración normal, amplitud reducida
 * - Agua: Respiración ultra-lenta (decayMod > 1)
 * - Aire: Respiración con variación sutil
 * 
 * FILOSOFÍA: "NUNCA APAGAR, NUNCA GOLPEAR. FLUIR."
 * El Chill es agua: fluye, respira, ondula.
 * Nada puede romper la tranquilidad.
 * 
 * CONSTITUCIÓN CHILL (Wave 143):
 * - Zona Abisal: 200° - 260° (Azul Profundo → Índigo)
 * - Zona Medusa: 270° - 310° (Violeta → Magenta Suave)
 * - Zona Coral: 170° - 195° (Turquesa → Cian)
 * - Strobe: PROHIBIDO CONSTITUCIONALMENTE
 * 
 * @see docs/audits/WAVE-143-COLOR-CONSTITUTION.md § 2.4
 * ============================================================================
 */

// WAVE 273: Elemental Modifiers
import { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

/**
 * Tipo RGB para colores (definido localmente para evitar dependencias circulares)
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Tipo HSL para colores (usado internamente)
 */
export interface HSL {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

/**
 * Interfaz para la paleta de colores que procesa esta física
 */
export interface ChillPalette {
  primary: RGB;
  secondary: RGB;
  ambient: RGB;
  accent: RGB;
}

/**
 * Métricas de audio necesarias para el cálculo de física Chill
 * (Nota: La mayoría son IGNORADAS - Chill no reacciona al audio agresivamente)
 */
export interface ChillAudioMetrics {
  normalizedEnergy: number;    // 0.0 - 1.0 (Solo para modular sutilmente)
  normalizedTreble?: number;   // IGNORADO - No queremos reactividad a agudos
}

/**
 * Resultado de la aplicación de física Chill
 */
export interface ChillPhysicsResult {
  palette: ChillPalette;
  breathPhase: number;          // 0.0 - 1.0 (fase actual del ciclo de respiración)
  isStrobe: false;              // SIEMPRE false - strobe prohibido
  dimmerModulation: number;     // Modulación del dimmer por la respiración (-0.15 a +0.15)
  debugInfo: {
    breathingValue: number;     // Valor actual de la onda senoidal
    cycleFrequency: number;     // Frecuencia en Hz
    lightnessModulation: number;
    saturationModulation: number;
  };
}

/**
 * ChillStereoPhysics - Módulo de Reactividad para Chill/Lounge
 * 
 * Esta clase encapsula la lógica de respiración bioluminiscente:
 * - BREATHING PULSE: Onda senoidal lenta que modula brillo y saturación
 * - SAFETY CLAMP: Ignora TODOS los eventos agresivos
 */
export class ChillStereoPhysics {
  // =========================================================================
  // 🔒 CONFIGURACIÓN INMUTABLE (Calibrada para paz absoluta)
  // =========================================================================
  
  /**
   * Frecuencia del ciclo de respiración en Hz.
   * 0.2 Hz = 5 segundos por ciclo completo (lento y meditativo)
   */
  private static readonly BREATH_FREQUENCY_HZ = 0.2;
  
  /**
   * Amplitud de modulación de luminosidad.
   * ±8% de variación en L para efecto sutil pero visible.
   */
  private static readonly LIGHTNESS_AMPLITUDE = 8;
  
  /**
   * Amplitud de modulación de saturación.
   * ±5% de variación en S (más sutil que L)
   */
  private static readonly SATURATION_AMPLITUDE = 5;
  
  /**
   * Amplitud de modulación del dimmer general.
   * ±15% de variación en intensidad total.
   */
  private static readonly DIMMER_AMPLITUDE = 0.15;
  
  /**
   * Dimmer mínimo constitucional.
   * NUNCA apagar completamente (bioluminiscencia siempre visible)
   */
  private static readonly DIMMER_FLOOR = 0.05;
  
  /**
   * Dimmer máximo constitucional.
   * Evitar brillo cegador (suavidad obligatoria)
   */
  private static readonly DIMMER_CEILING = 0.85;
  
  /**
   * Pi * 2 para cálculos de onda
   */
  private static readonly TWO_PI = Math.PI * 2;

  // =========================================================================
  // 📊 ESTADO INTERNO
  // =========================================================================
  
  /** Tiempo de inicio para el ciclo de respiración */
  private readonly startTime = Date.now();
  
  // =========================================================================
  // 🔧 MÉTODOS PÚBLICOS
  // =========================================================================
  
  /**
   * Aplica la física Chill a una paleta de colores.
   * 
   * WAVE 273: Acepta modificadores elementales para modular respiración:
   * - decayMultiplier: Modula la frecuencia (>1 = más lento, <1 = más rápido)
   * - brightnessMultiplier: Modula la amplitud de la respiración
   * 
   * @param palette - Paleta de colores actual (RGB)
   * @param metrics - Métricas de audio (mayormente ignoradas)
   * @param mods - Modificadores elementales (Fuego/Tierra/Aire/Agua)
   * @returns Paleta modificada con respiración aplicada
   */
  public apply(
    palette: ChillPalette,
    _metrics: ChillAudioMetrics,  // Prefijo _ porque mayormente ignoramos
    mods?: ElementalModifiers
  ): ChillPhysicsResult {
    // WAVE 273: Extraer multiplicadores elementales
    const decayMod = mods?.decayMultiplier ?? 1.0;
    const brightnessMod = mods?.brightnessMultiplier ?? 1.0;

    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    
    // =====================================================================
    // 1️⃣ BREATHING PULSE (Onda Senoidal Lenta)
    // WAVE 273: Frecuencia modulada por elemento (decay alto = respiración lenta)
    // =====================================================================
    const effectiveFrequency = ChillStereoPhysics.BREATH_FREQUENCY_HZ / decayMod;
    
    // Generar valor de onda senoidal: oscila entre -1 y +1
    const breathingValue = Math.sin(
      ChillStereoPhysics.TWO_PI * 
      effectiveFrequency * 
      elapsedSeconds
    );
    
    // Calcular fase del ciclo (0.0 - 1.0)
    const breathPhase = ((elapsedSeconds * effectiveFrequency) % 1);
    
    // =====================================================================
    // 2️⃣ MODULACIÓN DE COLORES
    // WAVE 273: Amplitudes moduladas por elemento
    // =====================================================================
    // Convertir RGB a HSL, modular, y convertir de vuelta
    const primaryHsl = this.rgbToHsl(palette.primary);
    const secondaryHsl = this.rgbToHsl(palette.secondary);
    const ambientHsl = this.rgbToHsl(palette.ambient);
    const accentHsl = this.rgbToHsl(palette.accent);
    
    // Calcular modulaciones - WAVE 273: amplitud modulada por brightness
    const effectiveLightnessAmp = ChillStereoPhysics.LIGHTNESS_AMPLITUDE * brightnessMod;
    const lightnessModulation = breathingValue * effectiveLightnessAmp;
    const saturationModulation = breathingValue * ChillStereoPhysics.SATURATION_AMPLITUDE;
    const dimmerModulation = breathingValue * ChillStereoPhysics.DIMMER_AMPLITUDE * brightnessMod;
    
    // Aplicar modulación a cada color
    const modulatedPrimary = this.modulateHsl(primaryHsl, lightnessModulation, saturationModulation);
    const modulatedSecondary = this.modulateHsl(secondaryHsl, lightnessModulation * 0.8, saturationModulation * 0.8);
    const modulatedAmbient = this.modulateHsl(ambientHsl, lightnessModulation * 1.2, saturationModulation);
    const modulatedAccent = this.modulateHsl(accentHsl, lightnessModulation * 0.5, saturationModulation * 0.5);
    
    // Crear paleta resultante
    const resultPalette: ChillPalette = {
      primary: this.hslToRgb(modulatedPrimary),
      secondary: this.hslToRgb(modulatedSecondary),
      ambient: this.hslToRgb(modulatedAmbient),
      accent: this.hslToRgb(modulatedAccent),
    };
    
    // =====================================================================
    // 3️⃣ SAFETY CLAMP (Ignorar Eventos Agresivos)
    // =====================================================================
    // NO hay detección de picos
    // NO hay strobes
    // El Chill es PAZ ABSOLUTA
    
    return {
      palette: resultPalette,
      breathPhase,
      isStrobe: false,  // SIEMPRE false - constitucional
      dimmerModulation,
      debugInfo: {
        breathingValue,
        cycleFrequency: ChillStereoPhysics.BREATH_FREQUENCY_HZ,
        lightnessModulation,
        saturationModulation,
      },
    };
  }
  
  /**
   * Calcula el dimmer efectivo con la respiración aplicada
   * @param baseDimmer - Dimmer base (0-1)
   * @returns Dimmer modulado respetando floor y ceiling
   */
  public getModulatedDimmer(baseDimmer: number): number {
    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    
    const breathingValue = Math.sin(
      ChillStereoPhysics.TWO_PI * 
      ChillStereoPhysics.BREATH_FREQUENCY_HZ * 
      elapsedSeconds
    );
    
    const modulation = breathingValue * ChillStereoPhysics.DIMMER_AMPLITUDE;
    const modulated = baseDimmer + modulation;
    
    // Clamp al rango constitucional
    return Math.max(
      ChillStereoPhysics.DIMMER_FLOOR,
      Math.min(ChillStereoPhysics.DIMMER_CEILING, modulated)
    );
  }
  
  /**
   * Reinicia el tiempo de inicio (para sincronizar con nueva escena)
   * Nota: No hay mucho que resetear en Chill, la respiración es continua
   */
  public reset(): void {
    // El startTime es readonly, así que simplemente continuamos
    // La respiración es eternal, como el océano
  }
  
  // =========================================================================
  // 🔧 MÉTODOS PRIVADOS (Utilidades de Color)
  // =========================================================================
  
  /**
   * Convierte RGB a HSL
   */
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
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }
  
  /**
   * Convierte HSL a RGB
   */
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
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }
  
  /**
   * Modula un color HSL con valores de respiración
   * @param hsl - Color original
   * @param lModulation - Modulación de luminosidad
   * @param sModulation - Modulación de saturación
   */
  private modulateHsl(hsl: HSL, lModulation: number, sModulation: number): HSL {
    return {
      h: hsl.h,  // Hue NUNCA cambia - estabilidad de color
      s: Math.max(0, Math.min(100, hsl.s + sModulation)),
      l: Math.max(35, Math.min(55, hsl.l + lModulation)),  // Clamp a rango constitucional
    };
  }
}

// Export default para compatibilidad
export default ChillStereoPhysics;
