/**
 * 🎛️ PALETTE MANAGER
 * ===================
 * Gestor de paletas con histéresis anti-flicker
 * 
 * PROBLEMA QUE RESUELVE:
 * Si el detector de tonalidad duda un segundo, las luces no deben
 * cambiar de color y volver. Necesitamos estabilidad profesional.
 * 
 * SOLUCIÓN:
 * - Histéresis con tiempos mínimos entre cambios
 * - Interpolación suave entre paletas
 * - Triggers inteligentes de regeneración
 * 
 * @module engines/musical/mapping/PaletteManager
 */

import { EventEmitter } from 'events';
import {
  ProceduralPaletteGenerator,
  SelenePalette,
  MusicalDNA,
  HSLColor,
} from './ProceduralPaletteGenerator';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

/**
 * Configuración del PaletteManager
 */
export interface PaletteManagerConfig {
  /** Tiempo mínimo entre cambios de paleta (ms) */
  minPaletteChangeInterval: number;
  
  /** Tiempo mínimo entre cambios de key (ms) */
  minKeyChangeInterval: number;
  
  /** Umbral de cambio de energía para regenerar */
  energyChangeThreshold: number;
  
  /** Duración por defecto de transiciones (ms) */
  defaultTransitionDuration: number;
  
  /** Habilitar interpolación suave */
  enableSmoothing: boolean;
}

/**
 * Estado de transición entre paletas
 */
export interface PaletteTransition {
  from: SelenePalette;
  to: SelenePalette;
  startedAt: number;
  duration: number;
  progress: number;  // 0-1
}

/**
 * Razón del cambio de paleta
 */
export type PaletteChangeReason =
  | 'key_change'        // Cambió la tonalidad (nueva canción)
  | 'mode_change'       // Cambió el modo (major/minor)
  | 'energy_shift'      // Cambio significativo de energía
  | 'section_change'    // Cambio de sección
  | 'forced'            // Forzado por el usuario
  | 'initial';          // Primera paleta

// ============================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================

const DEFAULT_CONFIG: PaletteManagerConfig = {
  minPaletteChangeInterval: 5000,   // 5 segundos mínimo entre cambios
  minKeyChangeInterval: 10000,       // 10 segundos para cambios de key
  energyChangeThreshold: 0.3,        // 30% de cambio de energía
  defaultTransitionDuration: 1000,   // 1 segundo de transición
  enableSmoothing: true,
};

// ============================================================
// CLASE PRINCIPAL
// ============================================================

/**
 * 🎛️ PALETTE MANAGER
 * 
 * Gestiona las transiciones entre paletas con estabilidad profesional.
 * 
 * Eventos:
 * - 'palette-change': { palette, reason, transition }
 * - 'transition-progress': { progress, current }
 * - 'transition-complete': { palette }
 */
export class PaletteManager extends EventEmitter {
  private generator: ProceduralPaletteGenerator;
  private config: PaletteManagerConfig;
  
  // Estado actual
  private currentPalette: SelenePalette | null = null;
  private currentDNA: MusicalDNA | null = null;
  private currentTransition: PaletteTransition | null = null;
  
  // Timestamps para histéresis
  private lastPaletteChange: number = 0;
  private lastKeyChange: number = 0;
  private _lastModeChange: number = 0;  // Prefijo _ para indicar reservado
  
  // Animación
  private animationFrameId: number | null = null;
  
  constructor(config: Partial<PaletteManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.generator = new ProceduralPaletteGenerator();
    
    // Suscribirse a eventos del generador
    this.generator.on('palette-generated', (_palette: SelenePalette) => {
      // El generador emite, nosotros gestionamos la transición
    });
    
    console.log('🎛️ [PALETTE-MANAGER] Initialized with anti-flicker hysteresis');
  }

  // ============================================================
  // EVALUACIÓN DE CAMBIOS
  // ============================================================

  /**
   * Evalúa si se debe regenerar la paleta
   * Esta es la función clave del anti-flicker
   */
  shouldRegeneratePalette(newDNA: MusicalDNA): {
    shouldRegenerate: boolean;
    reason: PaletteChangeReason | null;
  } {
    const now = Date.now();
    
    // Si no hay paleta actual, siempre generar
    if (!this.currentPalette || !this.currentDNA) {
      return { shouldRegenerate: true, reason: 'initial' };
    }
    
    const timeSinceLastChange = now - this.lastPaletteChange;
    const timeSinceKeyChange = now - this.lastKeyChange;
    
    // 1. CAMBIO DE KEY (cambio de canción probable)
    if (newDNA.key !== this.currentDNA.key && newDNA.key !== null) {
      if (timeSinceKeyChange > this.config.minKeyChangeInterval) {
        return { shouldRegenerate: true, reason: 'key_change' };
      }
    }
    
    // 2. CAMBIO DE MODO (cambio emocional)
    if (newDNA.mode !== this.currentDNA.mode) {
      if (timeSinceLastChange > this.config.minPaletteChangeInterval) {
        return { shouldRegenerate: true, reason: 'mode_change' };
      }
    }
    
    // 3. CAMBIO DE ENERGÍA SIGNIFICATIVO
    const energyDelta = Math.abs(newDNA.energy - this.currentDNA.energy);
    if (energyDelta > this.config.energyChangeThreshold) {
      if (timeSinceLastChange > this.config.minPaletteChangeInterval) {
        return { shouldRegenerate: true, reason: 'energy_shift' };
      }
    }
    
    // No regenerar
    return { shouldRegenerate: false, reason: null };
  }

  // ============================================================
  // GESTIÓN DE PALETAS
  // ============================================================

  /**
   * Procesa nuevo DNA musical y decide si cambiar paleta
   * Este es el método principal que se llama desde MusicalContextEngine
   */
  process(dna: MusicalDNA): SelenePalette {
    const { shouldRegenerate, reason } = this.shouldRegeneratePalette(dna);
    
    if (shouldRegenerate && reason) {
      return this.regeneratePalette(dna, reason);
    }
    
    // Si no regeneramos, aplicar variación de sección si cambió
    if (this.currentPalette && dna.section !== this.currentDNA?.section) {
      return this.applySectionVariation(dna.section);
    }
    
    // Retornar paleta actual (interpolada si hay transición)
    return this.getCurrentPalette();
  }

  /**
   * Regenera la paleta con nueva DNA
   */
  private regeneratePalette(dna: MusicalDNA, reason: PaletteChangeReason): SelenePalette {
    const now = Date.now();
    const newPalette = this.generator.generatePalette(dna);
    
    // Si hay paleta anterior y smoothing habilitado, iniciar transición
    if (this.currentPalette && this.config.enableSmoothing) {
      this.startTransition(this.currentPalette, newPalette, reason);
    } else {
      // Sin transición, cambio inmediato
      this.currentPalette = newPalette;
      this.emit('palette-change', { 
        palette: newPalette, 
        reason, 
        transition: null 
      });
    }
    
    // Actualizar timestamps según razón
    this.lastPaletteChange = now;
    if (reason === 'key_change') {
      this.lastKeyChange = now;
    }
    if (reason === 'mode_change') {
      this._lastModeChange = now;
    }
    
    this.currentDNA = dna;
    
    console.log(`🎛️ [PALETTE] Changed: ${reason} → ${newPalette.metadata.description}`);
    
    return newPalette;
  }

  /**
   * Aplica variación de sección sin regenerar paleta completa
   */
  private applySectionVariation(section: string): SelenePalette {
    if (!this.currentPalette) {
      // No hay paleta, generar una básica
      return this.regeneratePalette(
        { ...this.currentDNA!, section },
        'section_change'
      );
    }
    
    const variedPalette = this.generator.applySectionVariation(
      this.currentPalette,
      section
    );
    
    // NO actualizamos currentPalette aquí porque la variación es temporal
    // Solo emitimos el evento con la variación
    this.emit('section-variation', { 
      section, 
      palette: variedPalette 
    });
    
    return variedPalette;
  }

  // ============================================================
  // TRANSICIONES SUAVES
  // ============================================================

  /**
   * Inicia una transición suave entre paletas
   */
  private startTransition(
    from: SelenePalette,
    to: SelenePalette,
    reason: PaletteChangeReason
  ): void {
    // Calcular duración basada en razón
    let duration = this.config.defaultTransitionDuration;
    if (reason === 'key_change') {
      duration = 2000; // Transición más larga para cambio de canción
    } else if (reason === 'energy_shift') {
      duration = to.metadata.transitionSpeed; // Usar la sugerida por la paleta
    }
    
    this.currentTransition = {
      from,
      to,
      startedAt: Date.now(),
      duration,
      progress: 0,
    };
    
    this.emit('palette-change', {
      palette: to,
      reason,
      transition: this.currentTransition,
    });
    
    // Iniciar animación
    this.animateTransition();
  }

  /**
   * Anima la transición entre paletas
   */
  private animateTransition(): void {
    if (!this.currentTransition) return;
    
    const { from, to, startedAt, duration } = this.currentTransition;
    const now = Date.now();
    const elapsed = now - startedAt;
    const progress = Math.min(1, elapsed / duration);
    
    this.currentTransition.progress = progress;
    
    // Interpolar paleta
    const interpolated = this.interpolatePalettes(from, to, this.easeInOutCubic(progress));
    
    this.emit('transition-progress', {
      progress,
      current: interpolated,
    });
    
    if (progress < 1) {
      // Continuar animación
      this.animationFrameId = requestAnimationFrame(() => this.animateTransition());
    } else {
      // Transición completa
      this.currentPalette = to;
      this.currentTransition = null;
      this.animationFrameId = null;
      
      this.emit('transition-complete', { palette: to });
    }
  }

  /**
   * Interpola dos paletas
   */
  private interpolatePalettes(
    from: SelenePalette,
    to: SelenePalette,
    t: number
  ): SelenePalette {
    return {
      primary: this.interpolateColor(from.primary, to.primary, t),
      secondary: this.interpolateColor(from.secondary, to.secondary, t),
      accent: this.interpolateColor(from.accent, to.accent, t),
      ambient: this.interpolateColor(from.ambient, to.ambient, t),
      contrast: this.interpolateColor(from.contrast, to.contrast, t),
      metadata: t < 0.5 ? from.metadata : to.metadata,
    };
  }

  /**
   * Interpola dos colores HSL
   */
  private interpolateColor(from: HSLColor, to: HSLColor, t: number): HSLColor {
    // Para hue, usar la ruta más corta en el círculo
    let hueDiff = to.h - from.h;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    
    return {
      h: (from.h + hueDiff * t + 360) % 360,
      s: from.s + (to.s - from.s) * t,
      l: from.l + (to.l - from.l) * t,
    };
  }

  /**
   * Función de easing (ease-in-out cubic)
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  /**
   * Obtiene la paleta actual (interpolada si hay transición)
   */
  getCurrentPalette(): SelenePalette {
    if (this.currentTransition) {
      const { from, to, progress } = this.currentTransition;
      return this.interpolatePalettes(from, to, this.easeInOutCubic(progress));
    }
    
    if (this.currentPalette) {
      return this.currentPalette;
    }
    
    // Si no hay paleta, generar una por defecto
    return this.generator.generatePalette();
  }

  /**
   * Fuerza un cambio de paleta (ignora histéresis)
   */
  forcePaletteChange(dna: MusicalDNA): SelenePalette {
    return this.regeneratePalette(dna, 'forced');
  }

  /**
   * Obtiene el generador subyacente
   */
  getGenerator(): ProceduralPaletteGenerator {
    return this.generator;
  }

  /**
   * Verifica si hay una transición en progreso
   */
  isTransitioning(): boolean {
    return this.currentTransition !== null;
  }

  /**
   * Obtiene el progreso de la transición actual
   */
  getTransitionProgress(): number {
    return this.currentTransition?.progress ?? 1;
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(config: Partial<PaletteManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): PaletteManagerConfig {
    return { ...this.config };
  }

  /**
   * Reset del estado
   */
  reset(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.currentPalette = null;
    this.currentDNA = null;
    this.currentTransition = null;
    this.lastPaletteChange = 0;
    this.lastKeyChange = 0;
    this._lastModeChange = 0;
    this.animationFrameId = null;
    
    this.generator.reset();
    
    console.log('🎛️ [PALETTE-MANAGER] Reset');
  }

  /**
   * Obtiene estadísticas
   */
  getStats(): {
    currentPaletteAge: number | null;
    timeSinceLastChange: number;
    isTransitioning: boolean;
    transitionProgress: number;
    generationCount: number;
  } {
    const now = Date.now();
    
    return {
      currentPaletteAge: this.currentPalette
        ? now - this.currentPalette.metadata.generatedAt
        : null,
      timeSinceLastChange: this.lastPaletteChange
        ? now - this.lastPaletteChange
        : 0,
      isTransitioning: this.isTransitioning(),
      transitionProgress: this.getTransitionProgress(),
      generationCount: this.generator.getGenerationCount(),
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

/**
 * Factory function
 */
export function createPaletteManager(
  config?: Partial<PaletteManagerConfig>
): PaletteManager {
  return new PaletteManager(config);
}
