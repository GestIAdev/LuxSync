/**
 * 🏎️ WAVE 52: ENERGY STABILIZER - "El Motor"
 * 
 * PROBLEMA: La energía cruda causa parpadeo visual
 *           porque cada kick causa un pico instantáneo.
 * 
 * SOLUCIÓN: Rolling average de 2 segundos para "smoothedEnergy"
 *           que representa la "vibe" de la sección, más
 *           detección de silencio para reset.
 * 
 * OUTPUTS:
 * - smoothedEnergy: Vibe general (2s rolling average) → para Sat/Light base
 * - instantEnergy: Golpe actual → para efectos/strobes
 * - isSilence: true si <0.02 por >3 segundos
 * 
 * EFECTO VISUAL: La sala "respira" con la música
 * - Breakdowns → colores lavados, oscuros
 * - Drops → neón saturado, brillante
 * 
 * 🎢 WAVE 57.5: DROP STATE MACHINE
 * - Evita el "ametralladora" de drops rápidos
 * - Estados: IDLE → ATTACK → SUSTAIN → RELEASE → COOLDOWN
 * 
 * @author GitHub Copilot (Claude) para GestIAdev
 * @version WAVE 57.5 - "Drop State Machine"
 */

/**
 * 🎢 WAVE 57.5: DROP STATE MACHINE
 * Estados del ciclo de vida del Drop
 */
export type DropState = 'IDLE' | 'ATTACK' | 'SUSTAIN' | 'RELEASE' | 'COOLDOWN';

/**
 * Configuración de la máquina de estados Drop
 */
export interface DropStateMachineConfig {
  /** Frames en ATTACK antes de ir a SUSTAIN (default: 30 = 0.5s) */
  attackFrames: number;
  
  /** Frames mínimos en SUSTAIN (default: 120 = 2s) */
  minSustainFrames: number;
  
  /** Frames máximos en SUSTAIN si energía sigue alta (default: 480 = 8s) */
  maxSustainFrames: number;
  
  /** Frames en RELEASE (fade out) (default: 60 = 1s) */
  releaseFrames: number;
  
  /** Frames en COOLDOWN antes de poder triggear otro drop (default: 180 = 3s) */
  cooldownFrames: number;
}

/**
 * Configuración del estabilizador de energía
 */
export interface EnergyStabilizerConfig {
  /** Tamaño del buffer para smoothing (default: 120 = 2 segundos @ 60fps) */
  smoothingWindowFrames: number;
  
  /** Umbral de silencio (default: 0.02) */
  silenceThreshold: number;
  
  /** Frames de silencio para trigger reset (default: 180 = 3 segundos) */
  silenceResetFrames: number;
  
  /** Factor de suavizado EMA para instant → smooth (default: 0.95) */
  emaFactor: number;
}

/**
 * Salida del estabilizador de energía
 */
export interface EnergyOutput {
  /** Energía suavizada (rolling average 2s) - para Sat/Light base */
  smoothedEnergy: number;
  
  /** Energía instantánea (frame actual) - para efectos/strobes */
  instantEnergy: number;
  
  /** ¿Estamos en silencio? (>3s bajo umbral) */
  isSilence: boolean;
  
  /** Frames en silencio */
  silenceFrames: number;
  
  /** ¿Se disparó un reset este frame? */
  resetTriggered: boolean;
  
  /** Delta de energía (para detectar transientes) */
  energyDelta: number;
  
  /** Pico reciente (máximo en últimos 30 frames) */
  recentPeak: number;
  
  /** 📉 WAVE 55: ¿Es un DROP RELATIVO? (instant > smoothed + threshold) */
  isRelativeDrop: boolean;
  
  /** 📉 WAVE 55: ¿Es un BREAKDOWN RELATIVO? (instant < smoothed - threshold) */
  isRelativeBreakdown: boolean;
}

/**
 * Callback para cuando se detecta reset por silencio
 */
export type SilenceResetCallback = () => void;

/**
 * 🏎️ WAVE 52: ENERGY STABILIZER
 * 
 * Suaviza la energía para evitar parpadeo visual y detecta silencios
 * para resetear el sistema entre canciones.
 * 
 * 🎢 WAVE 57.5: Incluye DROP STATE MACHINE para evitar "ametralladora"
 */
export class EnergyStabilizer {
  // Configuración
  private readonly config: EnergyStabilizerConfig;
  
  // Buffer circular para rolling average
  private energyBuffer: number[] = [];
  private bufferIndex = 0;
  
  // EMA para smoothing adicional
  private emaEnergy = 0;
  
  // Detección de silencio
  private silenceFrameCount = 0;
  private lastResetFrame = 0;
  
  // Para detectar transientes
  private previousEnergy = 0;
  
  // Pico reciente
  private peakBuffer: number[] = [];
  private peakBufferIndex = 0;
  private readonly PEAK_WINDOW = 30; // 0.5 segundos
  
  // 🔌 WAVE 65: Histéresis para BREAKDOWN - evita falsas detecciones en pausas cortas
  private lowEnergyFrameCount = 0;
  private readonly BREAKDOWN_HYSTERESIS_FRAMES = 150;  // 2.5 segundos de baja energía sostenida
  
  // Callbacks para reset
  private onSilenceReset: SilenceResetCallback[] = [];
  
  // Métricas
  private frameCount = 0;
  private lastLogFrame = 0;
  private totalResets = 0;
  
  // 🎢 WAVE 57.5: DROP STATE MACHINE
  private dropState: DropState = 'IDLE';
  private dropStateFrames = 0;
  private readonly dropConfig: DropStateMachineConfig = {
    attackFrames: 30,       // 0.5s de build
    minSustainFrames: 120,  // 2s mínimo de drop
    maxSustainFrames: 480,  // 8s máximo de drop
    releaseFrames: 60,      // 1s de fade out
    cooldownFrames: 180,    // 3s antes de otro drop
  };
  
  /** 🎢 WAVE 57.5: PUBLIC - ¿Está el DROP activo para la UI? */
  public isDropActive = false;
  
  // Default config
  private static readonly DEFAULT_CONFIG: EnergyStabilizerConfig = {
    smoothingWindowFrames: 120,  // 2 segundos @ 60fps
    silenceThreshold: 0.02,      // Prácticamente silencio
    silenceResetFrames: 720,     // 🔌 WAVE 65: 12 segundos de silencio = reset (era 180 = 3s)
    // 🔥 WAVE 67.5: 98% histórico = EMA más perezoso (era 0.95)
    // Representa la energía de la SECCIÓN, no del compás
    // Música latina tiene energía alta constante (0.5-0.6), esto evita falsos drops
    emaFactor: 0.98,
  };
  
  constructor(config: Partial<EnergyStabilizerConfig> = {}) {
    this.config = { ...EnergyStabilizer.DEFAULT_CONFIG, ...config };
    
    // Inicializar buffers
    this.energyBuffer = new Array(this.config.smoothingWindowFrames).fill(0);
    this.peakBuffer = new Array(this.PEAK_WINDOW).fill(0);
    
    // 🧹 WAVE 63: Log init comentado - solo vibes importan
    // console.log(`[EnergyStabilizer] 🏎️ Initialized: smoothing=${this.config.smoothingWindowFrames} frames (~${(this.config.smoothingWindowFrames / 60).toFixed(1)}s), silence=${this.config.silenceResetFrames} frames`);
  }
  
  /**
   * 🏎️ PROCESO PRINCIPAL
   * 
   * Recibe la energía cruda y retorna energía suavizada + estado de silencio.
   */
  update(instantEnergy: number): EnergyOutput {
    this.frameCount++;
    
    // Clamp energía a 0-1
    const energy = Math.max(0, Math.min(1, instantEnergy));
    
    // === PASO 1: Rolling Average ===
    this.energyBuffer[this.bufferIndex] = energy;
    this.bufferIndex = (this.bufferIndex + 1) % this.config.smoothingWindowFrames;
    
    const rollingAvg = this.energyBuffer.reduce((a, b) => a + b, 0) / this.config.smoothingWindowFrames;
    
    // === PASO 2: EMA Smoothing adicional ===
    this.emaEnergy = this.emaEnergy * this.config.emaFactor + rollingAvg * (1 - this.config.emaFactor);
    
    // === PASO 3: Peak tracking ===
    this.peakBuffer[this.peakBufferIndex] = energy;
    this.peakBufferIndex = (this.peakBufferIndex + 1) % this.PEAK_WINDOW;
    const recentPeak = Math.max(...this.peakBuffer);
    
    // === PASO 4: Delta (para transientes) ===
    const energyDelta = energy - this.previousEnergy;
    this.previousEnergy = energy;
    
    // === PASO 5: Detección de silencio ===
    let resetTriggered = false;
    
    if (energy < this.config.silenceThreshold) {
      this.silenceFrameCount++;
      
      // ¿Umbral de reset alcanzado?
      if (this.silenceFrameCount >= this.config.silenceResetFrames && 
          this.frameCount - this.lastResetFrame > this.config.silenceResetFrames * 2) {
        // ¡RESET!
        resetTriggered = true;
        this.lastResetFrame = this.frameCount;
        this.totalResets++;
        
        console.log(`[EnergyStabilizer] 🧹 SILENCE RESET triggered after ${this.silenceFrameCount} frames (~${(this.silenceFrameCount / 60).toFixed(1)}s). Total resets: ${this.totalResets}`);
        
        // Notificar callbacks
        for (const callback of this.onSilenceReset) {
          try {
            callback();
          } catch (e) {
            console.error('[EnergyStabilizer] Callback error:', e);
          }
        }
        
        // Reset interno parcial (no el buffer, solo contadores)
        this.silenceFrameCount = 0;
      }
    } else {
      // No silencio, resetear contador
      this.silenceFrameCount = 0;
    }
    
    const isSilence = this.silenceFrameCount > 30; // >0.5s es "en silencio"
    
    // === 📉 WAVE 55 + WAVE 65: DETECCIÓN RELATIVA DE DROP/BREAKDOWN ===
    // En lugar de umbral absoluto (>0.8), usamos RELATIVO al promedio
    // Si toda la canción está al 0.9, NADA será un Drop (correcto)
    // Solo los picos REALES por encima del promedio dispararán el efecto
    // 🔥 WAVE 67: Aumentado de 0.25 a 0.40 para DROP excepcional (40% de salto requerido)
    const DROP_RELATIVE_THRESHOLD = 0.40;  // instant debe ser smoothed + 0.40 (era 0.25)
    const BREAKDOWN_RELATIVE_THRESHOLD = 0.12;  // instant debe ser smoothed - 0.12
    
    // 🔥 WAVE 67.5: DROP ABSOLUTO requiere energía > 0.85 (era 0.6)
    // Si la canción no rompe el techo (0.85+), no es un Drop, es un Chorus intenso
    // Esto elimina falsos drops en música latina de alta energía constante
    const DROP_ABSOLUTE_MINIMUM = 0.85;
    const isRelativeDrop = energy > (this.emaEnergy + DROP_RELATIVE_THRESHOLD) && energy > DROP_ABSOLUTE_MINIMUM;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🩺 OPERATION OPEN HEART: PROBE EnergyStabilizer
    // 🗑️ WAVE 289.5: PROBE DESACTIVADO - Diagnóstico completado
    // ═══════════════════════════════════════════════════════════════════════
    /*
    if (this.frameCount % 30 === 0) {
      const passesRelative = energy > (this.emaEnergy + DROP_RELATIVE_THRESHOLD);
      const passesAbsolute = energy > DROP_ABSOLUTE_MINIMUM;
      console.log(
        `[STABILIZER-PROBE] 🏎️ E: ${energy.toFixed(2)} | ` +
        `EMA: ${this.emaEnergy.toFixed(2)} | ` +
        `Delta: ${(energy - this.emaEnergy).toFixed(2)}/${DROP_RELATIVE_THRESHOLD.toFixed(2)} | ` +
        `AbsMin: ${DROP_ABSOLUTE_MINIMUM} | ` +
        `isRelDrop: ${isRelativeDrop} | ` +
        `State: ${this.dropState} | ` +
        `Active: ${this.isDropActive} | ` +
        `[Rel:${passesRelative} Abs:${passesAbsolute}]`
      );
    }
    */
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🔌 WAVE 65: HISTÉRESIS PARA BREAKDOWN
    // La energía debe estar baja durante 2.5 segundos SOSTENIDOS antes de declarar breakdown
    // Esto evita que pausas musicales cortas (0.5-1s) disparen falsamente el override
    const instantBreakdownCondition = energy < (this.emaEnergy - BREAKDOWN_RELATIVE_THRESHOLD) && this.emaEnergy > 0.3;
    
    if (instantBreakdownCondition) {
      this.lowEnergyFrameCount++;
    } else {
      this.lowEnergyFrameCount = 0;  // Reset si la energía sube
    }
    
    // Solo es breakdown REAL si se sostiene por el tiempo requerido
    const isRelativeBreakdown = this.lowEnergyFrameCount >= this.BREAKDOWN_HYSTERESIS_FRAMES;
    
    // === 🎢 WAVE 57.5: DROP STATE MACHINE ===
    // Evita el "ametralladora" de drops rápidos con ciclo de vida controlado
    this.updateDropStateMachine(isRelativeDrop, isRelativeBreakdown, energy);
    
    // === PASO 6: Log periódico ===
    // 🧹 WAVE 63: Comentado - solo vibes importan
    // if (this.frameCount - this.lastLogFrame > 300) {  // Cada 5 segundos
    //   console.log(`[EnergyStabilizer] 🏎️ Instant=${energy.toFixed(2)} Smooth=${this.emaEnergy.toFixed(2)} Peak=${recentPeak.toFixed(2)} Silence=${this.silenceFrameCount}f Drop=${isRelativeDrop} Breakdown=${isRelativeBreakdown} DropState=${this.dropState} Active=${this.isDropActive}`);
    //   this.lastLogFrame = this.frameCount;
    // }
    
    return {
      smoothedEnergy: this.emaEnergy,
      instantEnergy: energy,
      isSilence,
      silenceFrames: this.silenceFrameCount,
      resetTriggered,
      energyDelta,
      recentPeak,
      isRelativeDrop,
      isRelativeBreakdown,
    };
  }
  
  /**
   * Registra un callback para cuando se detecta silencio prolongado
   */
  onReset(callback: SilenceResetCallback): void {
    this.onSilenceReset.push(callback);
  }
  
  /**
   * 🧹 HARD RESET manual
   */
  reset(): void {
    this.energyBuffer = new Array(this.config.smoothingWindowFrames).fill(0);
    this.peakBuffer = new Array(this.PEAK_WINDOW).fill(0);
    this.bufferIndex = 0;
    this.peakBufferIndex = 0;
    this.emaEnergy = 0;
    this.silenceFrameCount = 0;
    this.previousEnergy = 0;
    this.frameCount = 0;
    this.lastLogFrame = 0;
    this.lastResetFrame = 0;
    this.lowEnergyFrameCount = 0;  // 🔌 WAVE 65: Reset histéresis de breakdown
    
    console.log('[EnergyStabilizer] 🧹 Manual RESET: All buffers cleared');
  }
  
  /**
   * Obtiene la energía suavizada actual sin actualizar
   */
  getSmoothedEnergy(): number {
    return this.emaEnergy;
  }
  
  /**
   * Obtiene estadísticas para debug
   */
  getStats(): {
    smoothedEnergy: number;
    silenceFrames: number;
    totalResets: number;
    bufferFullness: number;
    dropState: DropState;
    isDropActive: boolean;
  } {
    const nonZeroEntries = this.energyBuffer.filter(e => e > 0).length;
    
    return {
      smoothedEnergy: this.emaEnergy,
      silenceFrames: this.silenceFrameCount,
      totalResets: this.totalResets,
      bufferFullness: nonZeroEntries / this.config.smoothingWindowFrames,
      dropState: this.dropState,
      isDropActive: this.isDropActive,
    };
  }
  
  /**
   * 🎢 WAVE 57.5: DROP STATE MACHINE
   * 
   * Ciclo de vida del DROP para evitar el efecto "ametralladora":
   * 
   * IDLE ─────(isRelativeDrop)────→ ATTACK
   *   │                               │
   *   │                        (attackFrames)
   *   │                               ↓
   *   │                            SUSTAIN ←──(energía sigue alta)──┐
   *   │                               │                             │
   *   │                        (min/maxFrames o breakdown)          │
   *   │                               ↓                             │
   *   │                            RELEASE                          │
   *   │                               │                             │
   *   │                        (releaseFrames)                      │
   *   │                               ↓                             │
   *   └────────────────────────── COOLDOWN ─────────────────────────┘
   *                                   │
   *                            (cooldownFrames)
   *                                   ↓
   *                                 IDLE
   */
  private updateDropStateMachine(isRelativeDrop: boolean, isRelativeBreakdown: boolean, energy: number): void {
    this.dropStateFrames++;
    
    const prevState = this.dropState;
    
    switch (this.dropState) {
      case 'IDLE':
        // Solo entramos en ATTACK si detectamos un drop relativo
        if (isRelativeDrop) {
          this.dropState = 'ATTACK';
          this.dropStateFrames = 0;
          // 🧹 WAVE 63.5: Log comentado - spam de state machine
          // console.log('[EnergyStabilizer] 🎢 DROP: IDLE → ATTACK');
        }
        this.isDropActive = false;
        break;
        
      case 'ATTACK':
        // Build-up del drop
        this.isDropActive = true;
        
        if (this.dropStateFrames >= this.dropConfig.attackFrames) {
          this.dropState = 'SUSTAIN';
          this.dropStateFrames = 0;
          // 🧹 WAVE 63.5: Log comentado - spam de state machine
          // console.log('[EnergyStabilizer] 🎢 DROP: ATTACK → SUSTAIN');
        }
        // Si la energía cae durante attack, abortar
        else if (isRelativeBreakdown || energy < 0.3) {
          this.dropState = 'RELEASE';
          this.dropStateFrames = 0;
          // 🧹 WAVE 63.5: Log comentado - spam de state machine
          // console.log('[EnergyStabilizer] 🎢 DROP: ATTACK → RELEASE (aborted)');
        }
        break;
        
      case 'SUSTAIN':
        // El corazón del drop - mantener mientras la energía sea alta
        this.isDropActive = true;
        
        // Salir de SUSTAIN si:
        // 1. Breakdown detectado
        // 2. Energía baja significativamente
        // 3. Llegamos al máximo de sustain
        const shouldRelease = 
          isRelativeBreakdown ||
          energy < 0.4 ||
          this.dropStateFrames >= this.dropConfig.maxSustainFrames;
        
        // Pero solo si hemos pasado el mínimo
        if (shouldRelease && this.dropStateFrames >= this.dropConfig.minSustainFrames) {
          this.dropState = 'RELEASE';
          this.dropStateFrames = 0;
          // 🧹 WAVE 63.5: Log comentado - spam de state machine
          // console.log(`[EnergyStabilizer] 🎢 DROP: SUSTAIN → RELEASE (after ${this.dropStateFrames} frames)`);
        }
        break;
        
      case 'RELEASE':
        // Fade out gradual
        // isDropActive baja gradualmente durante release (para transición suave)
        const releaseProgress = this.dropStateFrames / this.dropConfig.releaseFrames;
        this.isDropActive = releaseProgress < 0.5; // Activo solo primera mitad del release
        
        if (this.dropStateFrames >= this.dropConfig.releaseFrames) {
          this.dropState = 'COOLDOWN';
          this.dropStateFrames = 0;
          this.isDropActive = false;
          // 🧹 WAVE 63.5: Log comentado - spam de state machine
          // console.log('[EnergyStabilizer] 🎢 DROP: RELEASE → COOLDOWN');
        }
        break;
        
      case 'COOLDOWN':
        // Período refractario - NO SE PUEDE TRIGGEAR OTRO DROP
        this.isDropActive = false;
        
        if (this.dropStateFrames >= this.dropConfig.cooldownFrames) {
          this.dropState = 'IDLE';
          this.dropStateFrames = 0;
          // 🧹 WAVE 63.5: Log comentado
          // console.log('[EnergyStabilizer] 🎢 DROP: COOLDOWN → IDLE (ready for next drop)');
        }
        break;
    }
    
    // Log de transiciones importantes
    // 🧹 WAVE 63.5: Log comentado - spameaba cada transición
    // if (prevState !== this.dropState && this.dropState !== 'IDLE') {
    //   console.log(`[EnergyStabilizer] 🎢 State: ${prevState} → ${this.dropState}, Active: ${this.isDropActive}`);
    // }
  }
  
  /**
   * 🎢 WAVE 57.5: Obtiene el estado actual del drop
   */
  getDropState(): { state: DropState; framesInState: number; isActive: boolean } {
    return {
      state: this.dropState,
      framesInState: this.dropStateFrames,
      isActive: this.isDropActive,
    };
  }
}

// Export para uso en workers
export default EnergyStabilizer;
