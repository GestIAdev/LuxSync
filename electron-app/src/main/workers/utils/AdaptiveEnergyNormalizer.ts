/**
 * 🧬 ADAPTIVE ENERGY NORMALIZER
 * ══════════════════════════════════════════════════════════════════════════
 * WAVE 16.2: Rolling Peak para Auto-Ajuste de Sensibilidad
 * 
 * Selene recuerda el PICO MÁXIMO de los últimos 15 segundos.
 * Energía Normalizada = Energía Actual / Pico Máximo Rodante
 * 
 * RESULTADO:
 * - Canción bajita → Selene SUBE sensibilidad automáticamente
 * - Canción fuerte → Selene BAJA sensibilidad automáticamente
 * - Siempre: Rango dinámico completo (0-1) sin ajustes manuales
 * 
 * "La sensibilidad de Selene se ajusta al volumen del momento" - Wave 16 Pro
 * ══════════════════════════════════════════════════════════════════════════
 */

export class AdaptiveEnergyNormalizer {
  // Ventana rodante de 15 segundos @ 30fps
  private rollingMaxWindow: number[] = [];
  private readonly WINDOW_SIZE: number;
  private readonly MIN_PEAK: number;      // Valor mínimo protector
  private readonly INITIAL_PEAK: number;  // Pico inicial mientras se llena la ventana
  
  private currentPeakMax: number;
  private frameCount: number = 0;
  
  // Estadísticas para debug
  private lastRawEnergy: number = 0;
  private lastNormalizedEnergy: number = 0;
  
  /**
   * Constructor
   * @param windowSeconds - Tamaño de ventana en segundos (default: 15s)
   * @param fps - Frames por segundo del análisis (default: 30fps)
   * @param minPeak - Valor mínimo del pico para evitar división por cero (default: 0.05)
   * @param initialPeak - Pico inicial mientras se llena la ventana (default: 0.15)
   */
  constructor(
    windowSeconds: number = 15,
    fps: number = 30,
    minPeak: number = 0.05,
    initialPeak: number = 0.15
  ) {
    this.WINDOW_SIZE = Math.round(windowSeconds * fps);
    this.MIN_PEAK = minPeak;
    this.INITIAL_PEAK = initialPeak;
    this.currentPeakMax = initialPeak;
  }
  
  /**
   * 🧬 NORMALIZA ENERGÍA CON ROLLING PEAK
   * 
   * @param rawEnergy - Energía bruta (0-1, típicamente 0.05-0.50 en la realidad)
   * @returns Energía normalizada (0-1, rango dinámico completo)
   */
  normalize(rawEnergy: number): number {
    this.frameCount++;
    this.lastRawEnergy = rawEnergy;
    
    // 1. Agregar energía actual a la ventana rodante
    this.rollingMaxWindow.push(rawEnergy);
    
    // 2. Mantener tamaño de ventana
    if (this.rollingMaxWindow.length > this.WINDOW_SIZE) {
      this.rollingMaxWindow.shift();
    }
    
    // 3. Calcular pico máximo en la ventana
    // Usamos reduce para eficiencia en lugar de spread operator
    let maxInWindow = this.MIN_PEAK;
    for (let i = 0; i < this.rollingMaxWindow.length; i++) {
      if (this.rollingMaxWindow[i] > maxInWindow) {
        maxInWindow = this.rollingMaxWindow[i];
      }
    }
    
    // 4. Durante el llenado inicial, usar el pico inicial como referencia
    // para evitar sobre-sensibilidad cuando arranca
    if (this.rollingMaxWindow.length < this.WINDOW_SIZE / 3) {
      maxInWindow = Math.max(maxInWindow, this.INITIAL_PEAK);
    }
    
    this.currentPeakMax = maxInWindow;
    
    // 5. Normalizar: energía actual / pico máximo
    let normalized = rawEnergy / this.currentPeakMax;
    
    // 6. Aplicar curva de suavizado (power law para percepción logarítmica)
    // Las variaciones pequeñas importan más en niveles bajos
    // pow(x, 0.9) = curva suave que expande el rango bajo
    normalized = Math.pow(normalized, 0.85);
    
    // 7. Clamear a [0, 1]
    normalized = Math.min(1.0, Math.max(0, normalized));
    
    this.lastNormalizedEnergy = normalized;
    
    // 8. Debug log cada ~5 segundos (150 frames @ 30fps)
    if (this.frameCount % 150 === 0) {
      console.log(`[AdaptiveNorm] Raw=${rawEnergy.toFixed(3)} Peak=${this.currentPeakMax.toFixed(3)} → Normalized=${normalized.toFixed(3)} (window: ${this.rollingMaxWindow.length}/${this.WINDOW_SIZE})`);
    }
    
    return normalized;
  }
  
  /**
   * 🔄 RESET - Llamar cuando cambia la canción o fuente de audio
   */
  reset(): void {
    this.rollingMaxWindow = [];
    this.currentPeakMax = this.INITIAL_PEAK;
    this.frameCount = 0;
    console.log('[AdaptiveNorm] Reset - Ventana limpia, sensibilidad en default');
  }
  
  /**
   * 📊 OBTENER PICO ACTUAL - Para telemetría/debug
   */
  getCurrentPeak(): number {
    return this.currentPeakMax;
  }
  
  /**
   * 📊 OBTENER ÚLTIMA ENERGÍA RAW - Para telemetría/debug
   */
  getLastRawEnergy(): number {
    return this.lastRawEnergy;
  }
  
  /**
   * 📊 OBTENER ÚLTIMA ENERGÍA NORMALIZADA - Para telemetría/debug
   */
  getLastNormalizedEnergy(): number {
    return this.lastNormalizedEnergy;
  }
  
  /**
   * 📊 OBTENER ESTADÍSTICAS - Para telemetría
   */
  getStats(): {
    currentPeak: number;
    windowSize: number;
    windowFilled: number;
    lastRaw: number;
    lastNormalized: number;
    gainFactor: number;  // Cuánto amplifica (1/peak)
  } {
    return {
      currentPeak: this.currentPeakMax,
      windowSize: this.WINDOW_SIZE,
      windowFilled: this.rollingMaxWindow.length,
      lastRaw: this.lastRawEnergy,
      lastNormalized: this.lastNormalizedEnergy,
      gainFactor: 1 / this.currentPeakMax,
    };
  }
}

// Singleton para uso global en el Worker
let _instance: AdaptiveEnergyNormalizer | null = null;

export function getEnergyNormalizer(): AdaptiveEnergyNormalizer {
  if (!_instance) {
    _instance = new AdaptiveEnergyNormalizer();
    console.log('[AdaptiveNorm] 🧬 Instance created - Rolling Peak normalizer active');
  }
  return _instance;
}

export function resetEnergyNormalizer(): void {
  if (_instance) {
    _instance.reset();
  }
}
