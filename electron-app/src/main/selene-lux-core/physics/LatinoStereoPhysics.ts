/**
 * 🌴 WAVE 145: LATINO STEREO PHYSICS ("Solar Flare & Metralleta")
 * ============================================================================
 * Módulo blindado para la lógica de reactividad del género Latino/Tropical.
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Detectar KICKS fuertes → Solar Flare (destello dorado)
 * - Detectar NEGATIVE DROPS → Machine Gun Blackout (corte dramático)
 * - Mantener la vitalidad tropical (nunca apagar la fiesta)
 * 
 * FILOSOFÍA: "CALOR EXPLOSIVO Y CORTES DRAMÁTICOS"
 * El Latino es fuego: cuando explota, es ORO CEGADOR.
 * Cuando corta, es SILENCIO ABSOLUTO.
 * 
 * CONSTITUCIÓN LATINA (Wave 143):
 * - Zona Solar: 0° - 60° (Rojo → Naranja → Oro)
 * - Zona Selva: 120° - 180° (Verde Esmeralda → Turquesa)
 * - Zona Prohibida: 200° - 240° (Azul Metálico)
 * 
 * @see docs/audits/WAVE-143-COLOR-CONSTITUTION.md § 2.2
 * ============================================================================
 */

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
export interface LatinoPalette {
  primary: RGB;
  secondary: RGB;
  ambient: RGB;
  accent: RGB;
}

/**
 * Métricas de audio necesarias para el cálculo de física Latino
 */
export interface LatinoAudioMetrics {
  normalizedBass: number;      // 0.0 - 1.0 (Kick/Bombo)
  normalizedEnergy: number;    // 0.0 - 1.0 (Energía total)
  previousEnergy?: number;     // Energía del frame anterior (para detectar drops)
  deltaTime?: number;          // Tiempo desde último frame (ms)
}

/**
 * Resultado de la aplicación de física Latino
 */
export interface LatinoPhysicsResult {
  palette: LatinoPalette;
  isSolarFlare: boolean;
  isMachineGunBlackout: boolean;
  dimmerOverride: number | null;  // null = sin override, 0-1 = override de dimmer
  debugInfo: {
    bassPulse: number;
    energyDelta: number;
    isNegativeDrop: boolean;
    flareIntensity: number;
  };
}

/**
 * LatinoStereoPhysics - Módulo de Reactividad para Fiesta Latina
 * 
 * Esta clase encapsula la lógica de detección de efectos tropicales:
 * - SOLAR FLARE: Destello dorado en kicks fuertes
 * - MACHINE GUN: Blackout instantáneo en cortes de reggaeton
 */
export class LatinoStereoPhysics {
  // =========================================================================
  // 🔒 CONFIGURACIÓN INMUTABLE (Calibrada para Reggaeton/Cumbia/Salsa)
  // =========================================================================
  
  /**
   * Umbral de disparo para SOLAR FLARE (Bombo fuerte).
   * Cuando el bass supera este valor, disparamos destello dorado.
   * @calibration Reggaeton típico tiene kicks muy marcados
   */
  private static readonly KICK_THRESHOLD = 0.35;
  
  /**
   * Incremento de luminosidad para Solar Flare.
   * El accent sube a 95% L en el flare.
   */
  private static readonly FLARE_LIGHTNESS = 95;
  
  /**
   * Reducción de saturación para Solar Flare.
   * Para que parezca "luz blanca-dorada" reducimos saturación.
   */
  private static readonly FLARE_SATURATION_REDUCTION = 10;
  
  /**
   * Umbral de caída de energía para detectar "Negative Drop".
   * Si la energía cae más de este porcentaje, es un corte.
   */
  private static readonly NEGATIVE_DROP_THRESHOLD = 0.6;  // 60% de caída
  
  /**
   * Ventana de tiempo máxima para detectar Negative Drop (ms).
   * El corte debe ser RÁPIDO para ser dramático.
   */
  private static readonly NEGATIVE_DROP_WINDOW_MS = 100;
  
  /**
   * Duración del blackout en frames (aproximado).
   * El reggaeton usa cortes muy cortos (~2-4 frames @ 60fps).
   */
  private static readonly BLACKOUT_FRAMES = 3;
  
  /**
   * 🌞 WAVE 152: SOL AZTECA - Oro Líquido Saturado
   * 
   * ANTES: HSL(40, 10%, 95%) → Blanco sucio sin personalidad
   * AHORA: HSL(45, 100%, 80%) → Oro líquido que quema la retina
   * 
   * No es un "casi blanco", es un SOL ARDIENTE.
   */
  private static readonly SOLAR_FLARE_COLOR: HSL = {
    h: 45,    // Oro Azteca
    s: 100,   // Saturación TOTAL
    l: 80,    // Ultra brillante pero con color
  };

  // =========================================================================
  // 📊 ESTADO INTERNO
  // =========================================================================
  
  /** Contador de frames en blackout (para Machine Gun) */
  private blackoutFramesRemaining = 0;
  
  /** Última energía conocida (para detectar caídas) */
  private lastEnergy = 0;
  
  /** Timestamp del último frame */
  private lastFrameTime = Date.now();
  
  // =========================================================================
  // 🔧 MÉTODOS PÚBLICOS
  // =========================================================================
  
  /**
   * Aplica la física Latino a una paleta de colores.
   * 
   * @param palette - Paleta de colores actual (RGB)
   * @param metrics - Métricas de audio del frame actual
   * @returns Paleta modificada con efectos aplicados
   */
  public apply(
    palette: LatinoPalette,
    metrics: LatinoAudioMetrics
  ): LatinoPhysicsResult {
    const now = Date.now();
    const deltaTime = metrics.deltaTime ?? (now - this.lastFrameTime);
    this.lastFrameTime = now;
    
    const previousEnergy = metrics.previousEnergy ?? this.lastEnergy;
    const currentEnergy = metrics.normalizedEnergy;
    
    // Calcular delta de energía
    const energyDelta = previousEnergy - currentEnergy;
    
    // Crear copia de la paleta para modificar
    const resultPalette: LatinoPalette = {
      primary: { ...palette.primary },
      secondary: { ...palette.secondary },
      ambient: { ...palette.ambient },
      accent: { ...palette.accent },
    };
    
    // Inicializar flags
    let isSolarFlare = false;
    let isMachineGunBlackout = false;
    let dimmerOverride: number | null = null;
    let flareIntensity = 0;
    
    // =====================================================================
    // 1️⃣ MACHINE GUN DETECTION (Negative Drop → Blackout)
    // =====================================================================
    // Detectar caída brusca de energía (típico corte de reggaeton)
    const isNegativeDrop = (
      energyDelta >= LatinoStereoPhysics.NEGATIVE_DROP_THRESHOLD &&
      deltaTime <= LatinoStereoPhysics.NEGATIVE_DROP_WINDOW_MS &&
      previousEnergy > 0.6  // Solo si veníamos de energía alta
    );
    
    if (isNegativeDrop) {
      // ¡METRALLETA! Iniciar blackout
      this.blackoutFramesRemaining = LatinoStereoPhysics.BLACKOUT_FRAMES;
    }
    
    // Si estamos en blackout, aplicar dimmer = 0
    if (this.blackoutFramesRemaining > 0) {
      isMachineGunBlackout = true;
      dimmerOverride = 0;  // BLACKOUT TOTAL
      this.blackoutFramesRemaining--;
    }
    
    // =====================================================================
    // 2️⃣ SOLAR FLARE DETECTION (Kick fuerte → Destello dorado)
    // =====================================================================
    // Solo aplicar Solar Flare si NO estamos en blackout
    if (!isMachineGunBlackout) {
      const bassPulse = metrics.normalizedBass;
      
      if (bassPulse > LatinoStereoPhysics.KICK_THRESHOLD) {
        isSolarFlare = true;
        flareIntensity = (bassPulse - LatinoStereoPhysics.KICK_THRESHOLD) / 
                         (1 - LatinoStereoPhysics.KICK_THRESHOLD);
        
        // Aplicar Solar Flare al accent (Back PARs)
        // El accent se convierte en un destello blanco-dorado
        resultPalette.accent = this.hslToRgb(LatinoStereoPhysics.SOLAR_FLARE_COLOR);
        
        // También aumentar ligeramente el brillo del primary
        // (efecto de "iluminación general" del escenario)
        resultPalette.primary = this.boostBrightness(
          resultPalette.primary,
          Math.min(flareIntensity * 20, 15)  // Max +15% brillo
        );
      }
    }
    
    // Actualizar estado para el próximo frame
    this.lastEnergy = currentEnergy;
    
    return {
      palette: resultPalette,
      isSolarFlare,
      isMachineGunBlackout,
      dimmerOverride,
      debugInfo: {
        bassPulse: metrics.normalizedBass,
        energyDelta,
        isNegativeDrop,
        flareIntensity,
      },
    };
  }
  
  /**
   * Reinicia el estado interno (para nueva canción/escena)
   */
  public reset(): void {
    this.blackoutFramesRemaining = 0;
    this.lastEnergy = 0;
    this.lastFrameTime = Date.now();
  }
  
  // =========================================================================
  // 🔧 MÉTODOS PRIVADOS (Utilidades de Color)
  // =========================================================================
  
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
   * Aumenta el brillo de un color RGB
   * @param rgb - Color original
   * @param percent - Porcentaje de aumento (0-100)
   */
  private boostBrightness(rgb: RGB, percent: number): RGB {
    const factor = 1 + (percent / 100);
    return {
      r: Math.min(255, Math.round(rgb.r * factor)),
      g: Math.min(255, Math.round(rgb.g * factor)),
      b: Math.min(255, Math.round(rgb.b * factor)),
    };
  }
}

// Export default para compatibilidad
export default LatinoStereoPhysics;
