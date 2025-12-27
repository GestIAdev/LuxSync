/**
 * ⚡ WAVE 151: TECHNO NEON STROBE
 * ============================================================================
 * Módulo blindado para la lógica de reactividad del género Techno.
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Detectar "drops" basándose en la relación Bass/Treble
 * - Aplicar STROBE MAGENTA NEÓN cuando se detecta un drop
 * - NO modifica HUE (color base) - solo aplica strobe en accent
 * 
 * ORIGEN DE LA CALIBRACIÓN:
 * - WAVE 129: White-Hot Threshold (primer intento)
 * - WAVE 132: Dynamic Noise Floor (piso dinámico)
 * - WAVE 133: Saturation Breaker (factor 0.6)
 * - WAVE 151: Neon Strobe (Magenta 300° l:85 en lugar de Blanco)
 * 
 * PRINCIPIO: "EXTRAER, NO MODIFICAR"
 * Todos los valores numéricos son EXACTAMENTE los de Wave 133.
 * ============================================================================
 */

import { hslToRgb } from '../engines/visual/SeleneColorEngine';

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
export interface TechnoPalette {
  primary: RGB;
  secondary: RGB;
  ambient: RGB;
  accent: RGB;
}

/**
 * Métricas de audio necesarias para el cálculo de física
 */
export interface TechnoAudioMetrics {
  normalizedTreble: number;  // 0.0 - 1.0
  normalizedBass: number;    // 0.0 - 1.0
}

/**
 * Resultado de la aplicación de física
 */
export interface TechnoPhysicsResult {
  palette: TechnoPalette;
  isStrobeActive: boolean;
  debugInfo: {
    rawTreble: number;
    dynamicFloor: number;
    treblePulse: number;
    bassEnergy: number;
  };
}

/**
 * TechnoStereoPhysics - Módulo de Reactividad para Techno/Club
 * 
 * Esta clase encapsula la lógica de detección de drops y strobe
 * calibrada en las Waves 129-133.
 */
export class TechnoStereoPhysics {
  // =========================================================================
  // 🔒 CONFIGURACIÓN INMUTABLE (Extraída de Wave 133 - NO TOCAR)
  // =========================================================================
  
  /**
   * Factor de escalado del piso dinámico.
   * A mayor bass, mayor piso (más difícil disparar strobe).
   * @wave 133 - Subido de 0.5 → 0.6 para "Saturation Breaker"
   */
  private static readonly DYNAMIC_FLOOR_FACTOR = 0.6;
  
  /**
   * Piso base mínimo de treble.
   * Incluso en silencio total, ignoramos treble < 0.15.
   * @wave 132 - Introducido como "base floor"
   */
  private static readonly BASE_FLOOR = 0.15;
  
  /**
   * Umbral de disparo para el pulso limpio.
   * Solo si (treble - floor) > umbral consideramos un "golpe real".
   * @wave 129 - Calibrado original 0.25
   * @wave 148 - Subido a 0.30 para evitar strobes permanentes con señales saturadas
   */
  private static readonly TRIGGER_THRESHOLD = 0.30;
  
  /**
   * Mínimo de bass requerido para permitir strobe.
   * Evita strobes en breaks suaves o silencios.
   * @wave 129 - Contexto energético requerido
   */
  private static readonly MIN_BASS_FOR_STROBE = 0.80;

  // =========================================================================
  // 🎯 API PÚBLICA
  // =========================================================================

  /**
   * Aplica la física de Techno sobre la paleta actual.
   * 
   * NO cambia el HUE (Color base), solo aplica STROBE MAGENTA NEÓN en el accent
   * cuando detecta un drop válido.
   * 
   * @param palette - Paleta actual con primary, secondary, ambient, accent
   * @param audio - Métricas de audio con treble y bass normalizados
   * @returns Paleta procesada + metadata de debug
   * 
   * @example
   * ```typescript
   * const result = TechnoStereoPhysics.apply(
   *   { primary, secondary, ambient, accent },
   *   { normalizedTreble: 0.85, normalizedBass: 0.92 }
   * );
   * if (result.isStrobeActive) {
   *   // El accent ahora es Magenta Neón (300° l:85)
   * }
   * ```
   */
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics
  ): TechnoPhysicsResult {
    const rawTreble = audio.normalizedTreble ?? 0.0;
    const bassEnergy = audio.normalizedBass ?? 0.0;

    // ⚡ WAVE 132: PISO DINÁMICO
    // Si Bass = 1.0 → Floor = 0.75 → Ignoramos 75% de la señal aguda como "ruido"
    const dynamicFloor = this.BASE_FLOOR + (bassEnergy * this.DYNAMIC_FLOOR_FACTOR);

    // Calculamos el pulso REAL por encima del piso elevado
    const treblePulse = Math.max(0, rawTreble - dynamicFloor);

    // ⚡ WAVE 129: GATILLO DUAL
    // Pulso limpio supera umbral + contexto de energía
    const isStrobeActive = (treblePulse > this.TRIGGER_THRESHOLD) && 
                           (bassEnergy > this.MIN_BASS_FOR_STROBE);

    // Construir resultado
    let processedPalette: TechnoPalette;

    if (isStrobeActive) {
      // ⚡ WAVE 151: MAGENTA NEÓN NUCLEAR
      // Antes: Blanco aburrido { r: 255, g: 255, b: 255 }
      // Ahora: Magenta Neón 300° con l:85 (ultra brillante pero con color)
      // Contraste "Joker": Verde vs Magenta - quema la retina pero con estilo
      const neonMagenta = hslToRgb({ h: 300, s: 100, l: 85 });
      
      processedPalette = {
        ...palette,
        accent: neonMagenta
      };
    } else {
      // Paleta intacta
      processedPalette = palette;
    }

    return {
      palette: processedPalette,
      isStrobeActive,
      debugInfo: {
        rawTreble,
        dynamicFloor,
        treblePulse,
        bassEnergy
      }
    };
  }

  // =========================================================================
  // 🔧 MÉTODOS AUXILIARES (Para diagnóstico)
  // =========================================================================

  /**
   * Obtiene los umbrales actuales de configuración.
   * Útil para logging y diagnóstico.
   */
  public static getThresholds(): {
    dynamicFloorFactor: number;
    baseFloor: number;
    triggerThreshold: number;
    minBassForStrobe: number;
  } {
    return {
      dynamicFloorFactor: this.DYNAMIC_FLOOR_FACTOR,
      baseFloor: this.BASE_FLOOR,
      triggerThreshold: this.TRIGGER_THRESHOLD,
      minBassForStrobe: this.MIN_BASS_FOR_STROBE
    };
  }

  /**
   * Calcula el piso dinámico para un nivel de bass dado.
   * Útil para visualización/debug.
   */
  public static calculateDynamicFloor(bassEnergy: number): number {
    return this.BASE_FLOOR + (bassEnergy * this.DYNAMIC_FLOOR_FACTOR);
  }

  /**
   * Evalúa si un par de valores triggearía strobe (sin aplicar).
   * Útil para tests y predicción.
   */
  public static wouldTriggerStrobe(treble: number, bass: number): boolean {
    const dynamicFloor = this.calculateDynamicFloor(bass);
    const treblePulse = Math.max(0, treble - dynamicFloor);
    return (treblePulse > this.TRIGGER_THRESHOLD) && (bass > this.MIN_BASS_FOR_STROBE);
  }
}
