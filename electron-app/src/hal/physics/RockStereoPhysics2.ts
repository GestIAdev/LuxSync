/**
 * ============================================================================
 * 🎸 ROCK STEREO PHYSICS 2.0 - UNIFIED ARCHITECTURE
 * ============================================================================
 * 
 * WAVE 1011.5 "THE DAM" - LOBOTOMIZED EDITION
 * 
 * FILOSOFÍA: El rock es rock. No hay METAL, no hay INDIE, no hay PROG.
 * Pink Floyd es Rock. Metallica es Rock. Arctic Monkeys es Rock.
 * 
 * La diferencia NO está en cambiar de modo/config, sino en cómo las
 * métricas espectrales MODULAN LINEALMENTE los parámetros base.
 * 
 * ARQUITECTURA UNIFICADA:
 * - harshness: Modula ganancia BackPar (más sucio = más luz de fondo)
 * - flatness: Modula spread de Movers (más plano = movimientos más amplios)
 * - centroidHz: Modula velocidad (frecuencias altas = respuestas más rápidas)
 * - Los 4 canales (Front/Back/MoverL/MoverR) reciben las mismas reglas físicas
 * 
 * 4 BANDAS REALES (Hz):
 * - Sub-Bass: 20-80Hz (kick drum, floor tom)
 * - Low-Mid: 80-400Hz (bass guitar, snare body)
 * - High-Mid: 400-2500Hz (guitar crunch, vocals)
 * - Presence: 2500-8000Hz (cymbal attack, guitar harmonics)
 * 
 * ============================================================================
 */

// ===========================================================================
// TYPES - INPUT/OUTPUT INTERFACES
// ===========================================================================

export interface RockPhysicsInput {
  // Bandas de audio normalizadas (0-1)
  bass: number;
  mid: number;
  treble: number;
  
  // Bandas detalladas (si disponibles desde FFT)
  subBass?: number;     // 20-80Hz
  lowMid?: number;      // 80-400Hz  
  highMid?: number;     // 400-2500Hz
  
  // Métricas espectrales (para modulación lineal)
  harshness?: number;          // 0-1, cuán "sucio" es el sonido
  flatness?: number;           // 0-1, cuán "plano" vs tonal
  spectralCentroidHz?: number; // Centro espectral en Hz
  
  // Contexto
  bpm: number;
  melodyThreshold: number;
  isRealSilence: boolean;
  isAGCTrap: boolean;
  sectionType?: string;
}

export interface RockPhysicsResult {
  // Intensidades por zona (0-1)
  frontParIntensity: number;
  backParIntensity: number;
  moverIntensityL: number;
  moverIntensityR: number;
  moverIntensity: number;  // Legacy: max(L, R)
  
  // Estados
  moverActive: boolean;
  
  // Posiciones de movers (0-1)
  moverPositionL: number;
  moverPositionR: number;
  
  // Meta
  physicsApplied: 'rock';
  
  // Debug
  modulators?: {
    harshness: number;
    flatness: number;
    centroid: number;
  };
}

// ===========================================================================
// CONFIGURACIÓN UNIFICADA DE ROCK - WAVE 1011.8 "THE GOLDILOCKS ZONE"
// ===========================================================================

/**
 * Una sola configuración. Sin modos. Sin switches. Sin drama.
 * Los multiplicadores son BASE y las métricas los escalan linealmente.
 * 
 * 🎯 WAVE 1015: ROCK DETOX - ELIMINATING PANIC BOOSTS
 * - Gains reducidos para evitar saturación constante con metal
 * - Gates dinámicos que SUBEN con harshness (no al revés)
 * - Front: SubBass puro + curva exponencial para PUNCH
 * - Movers: LowMid para L, HighMid+Presence para R (estéreo real)
 */
const ROCK_UNIFIED_CONFIG = {
  // 🎸 Ganancias base por zona - WAVE 1015.10: Front BOOST + Mover R BOOST
  gains: {
    frontPar: 2.2,      // SUBIDO de 1.5 - necesita EXAGERAR diferencias para PULSO
    backPar: 1.8,       // ✅ PERFECTO - NO TOCAR (HighMid hits fuerte)
    moverLeft: 1.3,     // ✅ PERFECTO - NO TOCAR (LowMid controlado)
    moverRight: 2.0,    // SUBIDO de 1.4 - necesita cuerpo para guitarras
  },
  
  // 🚪 Gates - WAVE 1015.9: ALTOS para Front/ML (filtrar base constante)
  gates: {
    frontPar: 0.15,     // ✅ PERFECTO - SubBass controlado
    backPar: 0.08,      // ✅ PERFECTO - NO TOCAR
    moverLeft: 0.15,    // ✅ PERFECTO - LowMid controlado
    moverRight: 0.05,   // Presence: brillo reactivo
  },
  
  // ⚡ Decay speeds - WAVE 1015.10: Front MUY RÁPIDO para PULSO
  decay: {
    frontPar: 0.25,     // REDUCIDO de 0.35 - PULSO RÁPIDO (pump effect)
    backPar: 0.68,      // ✅ PERFECTO - atmósfera que respira
    moverLeft: 0.60,    // ✅ PERFECTO - riffs con presencia
    moverRight: 0.55,   // ✅ PERFECTO - cymbals con ataque limpio
  },
  
  // 🎸 Modulación por harshness - WAVE 1015: INVERTIDA (gate up, not gain up)
  harshnessModulation: {
    backParBoost: 0.0,      // ELIMINADO! harshness ya NO amplifica gain
    moverIntensity: 0.2,    // Reducido de 0.4
    gateBoost: 0.25,        // NUEVO: harshness 1.0 = +25% gate (filtra más)
  },
  
  // 🌊 Modulación por flatness (Pink Floyd territory)
  flatnessModulation: {
    moverSpreadBoost: 0.35,
    decayStretch: 0.25,
  },
  
  // 🎯 Modulación por centroidHz
  centroidModulation: {
    minHz: 800,
    maxHz: 6000,
    decayScale: 0.20,
  },
};

// ===========================================================================
// 🎸 ROCK STEREO PHYSICS 2.0 - LOBOTOMIZED
// ===========================================================================

export class RockStereoPhysics2 {
  // Estado interno de intensidades (con smoothing propio)
  private frontIntensity = 0;
  private backIntensity = 0;
  private moverLeftIntensity = 0;
  private moverRightIntensity = 0;
  
  // Estado de movers (posición para movimiento fluido)
  private moverLeftPosition = 0.5;
  private moverRightPosition = 0.5;
  
  // Historial para detección de transients
  private lastBands = { subBass: 0, lowMid: 0, highMid: 0, presence: 0 };
  
  // Frame counter para debug
  private frameCount = 0;
  
  constructor() {
    console.log('[RockStereoPhysics2] 🎸 UNIFIED ARCHITECTURE initialized (WAVE 1011.5)');
  }
  
  // ==========================================================================
  // CORE PROCESSING - SIN SUBGÉNEROS, SIN MODOS
  // ==========================================================================
  
  process(input: RockPhysicsInput): RockPhysicsResult {
    this.frameCount++;
    
    // 🔬 WAVE 1015 DEBUG: Ver qué valores están entrando (TEMPORAL)
    if (this.frameCount % 120 === 0) {  // Cada 2 segundos
      console.log(
        `🔬 [RockPhysics2] INPUT DEBUG | ` +
        `Bass=${input.bass?.toFixed(3)} Mid=${input.mid?.toFixed(3)} Treble=${input.treble?.toFixed(3)} | ` +
        `SubBass=${input.subBass?.toFixed(3)} LowMid=${input.lowMid?.toFixed(3)} HighMid=${input.highMid?.toFixed(3)} | ` +
        `Silence=${input.isRealSilence} AGCTrap=${input.isAGCTrap}`
      );
    }
    
    // 1. Extraer bandas reales
    const bands = this.extractBands(input);
    
    // 🔬 WAVE 1015 DEBUG: Ver qué bandas se están usando (TEMPORAL)
    if (this.frameCount % 120 === 0) {
      console.log(
        `🔬 [RockPhysics2] BANDS EXTRACTED | ` +
        `SubBass=${bands.subBass.toFixed(3)} LowMid=${bands.lowMid.toFixed(3)} ` +
        `HighMid=${bands.highMid.toFixed(3)} Presence=${bands.presence.toFixed(3)}`
      );
    }
    
    // 2. Extraer métricas espectrales (con fallbacks seguros)
    const harshness = input.harshness ?? 0.35;
    const flatness = input.flatness ?? 0.40;
    const centroidHz = input.spectralCentroidHz ?? 2000;
    
    // 3. Calcular moduladores lineales
    const hMod = this.calculateHarshnessModulator(harshness);
    const fMod = this.calculateFlatnessModulator(flatness);
    const cMod = this.calculateCentroidModulator(centroidHz);
    
    // 4. Procesar cada zona
    this.processFrontPar(bands, cMod);
    this.processBackPar(bands, hMod, cMod);
    this.processMoverLeft(bands, hMod, fMod, cMod);
    this.processMoverRight(bands, hMod, fMod, cMod);
    
    // 🎯 WAVE 1015.2: STEREO DIFFERENTIAL GATING
    // Si L y R están muy cerca (< 20% diferencia), forzar al más bajo a apagarse
    this.applyStereoDifferentialGating();
    
    // 5. Actualizar posiciones de movers
    this.updateMoverPositions(bands, fMod);
    
    // 6. Guardar bandas para detección de transients
    this.lastBands = { ...bands };
    
    // Debug cada ~1 segundo
    if (this.frameCount % 60 === 0) {
      this.logDebug(bands, harshness, flatness, centroidHz, hMod, fMod, cMod);
    }
    
    // 7. Construir resultado
    return {
      frontParIntensity: this.frontIntensity,
      backParIntensity: this.backIntensity,
      moverIntensityL: this.moverLeftIntensity,
      moverIntensityR: this.moverRightIntensity,
      moverIntensity: Math.max(this.moverLeftIntensity, this.moverRightIntensity),
      
      moverActive: this.moverLeftIntensity > 0.1 || this.moverRightIntensity > 0.1,
      
      moverPositionL: this.moverLeftPosition,
      moverPositionR: this.moverRightPosition,
      
      physicsApplied: 'rock',
      
      modulators: {
        harshness: hMod,
        flatness: fMod,
        centroid: cMod,
      },
    };
  }
  
  // ==========================================================================
  // EXTRACCIÓN DE BANDAS REALES
  // ==========================================================================
  
  private extractBands(input: RockPhysicsInput): {
    subBass: number;
    lowMid: number;
    highMid: number;
    presence: number;
  } {
    // 🎯 WAVE 1015 ROCK DETOX: PRIORIZAR bandas FFT reales si están disponibles
    // Si vienen pre-calculadas desde SeleneLux, usarlas DIRECTAMENTE
    // Si no, reconstruir desde bass/mid/treble (legacy path)
    
    const hasRealBands = (
      input.subBass !== undefined && 
      input.lowMid !== undefined && 
      input.highMid !== undefined
    );
    
    if (hasRealBands) {
      // ✅ Path 1: Usar bandas FFT reales + RENORMALIZACIÓN
      // 🎯 WAVE 1015.3: Las bandas vienen normalizadas (0.5-0.8 = música normal)
      // Necesitamos estirarlas a 0.0-1.0 para tener rango dinámico
      const rawSubBass = input.subBass ?? 0;
      const rawLowMid = input.lowMid ?? 0;
      const rawHighMid = input.highMid ?? 0;
      const rawPresence = input.treble ?? 0;
      
      // Renormalización con EXPANSIÓN (no compresión): (valor - floor) / (ceiling - floor)
      // 🎯 WAVE 1015.8: MODERATE EXPANSION - ni crush ni saturación
      const renormalize = (val: number, floor: number, ceiling: number, expansionPower = 0.8) => {
        if (val < floor) return 0;  // Hard cut bajo el floor
        const normalized = (val - floor) / (ceiling - floor);
        
        // 🎯 CURVA DE EXPANSIÓN MODERADA:
        // expansionPower = 0.80 → levanta suavemente sin saturar
        // Ejemplo: 0.5^0.80 = 0.57 (sube +14%), 0.3^0.80 = 0.39 (sube +30%)
        const expanded = Math.pow(normalized, expansionPower);
        
        return Math.min(1.0, expanded);
      };
      
      return {
        subBass: renormalize(rawSubBass, 0.42, 0.85, 0.82),   // Floor MUY ALTO (0.42) - SubBass es MUY potente
        lowMid: renormalize(rawLowMid, 0.42, 0.85, 0.84),     // Floor 0.42, casi lineal - LowMid constante
        highMid: renormalize(rawHighMid, 0.25, 0.75, 0.85),   // ✅ PERFECTO - NO TOCAR
        presence: renormalize(rawPresence, 0.15, 0.50, 0.88), // ✅ PERFECTO - NO TOCAR
      };
    }
    
    // ❌ Path 2: Legacy - Reconstruir desde bass/mid/treble
    // IMPORTANTE: Estos valores vienen del AGC y pueden estar inflados
    const bass = input.bass ?? 0;
    const mid = input.mid ?? 0;
    const treble = input.treble ?? 0;
    
    return {
      subBass: bass * 0.9,                    
      lowMid: bass * 0.5 + mid * 0.5,         
      highMid: mid * 0.6 + treble * 0.4,      
      presence: treble * 0.7 + mid * 0.3,     
    };
  }
  
  // ==========================================================================
  // CALCULADORES DE MODULACIÓN LINEAL
  // ==========================================================================
  
  /**
   * Harshness Modulator: Más harshness = más intensidad en BackPar y Movers
   * Rango: harshness 0→1.0, harshness 1→1.4 (con boost max de 0.4)
   */
  private calculateHarshnessModulator(harshness: number): number {
    const boost = harshness * ROCK_UNIFIED_CONFIG.harshnessModulation.backParBoost;
    return 1.0 + boost;
  }
  
  /**
   * Flatness Modulator: Más flatness = movimientos más amplios/suaves
   * Rango: flatness 0→1.0, flatness 1→1.3 (con boost max de 0.3)
   */
  private calculateFlatnessModulator(flatness: number): number {
    const boost = flatness * ROCK_UNIFIED_CONFIG.flatnessModulation.moverSpreadBoost;
    return 1.0 + boost;
  }
  
  /**
   * Centroid Modulator: Frecuencias altas = respuestas más rápidas (decay menor)
   * Rango: 1000Hz→1.0, 5000Hz→0.85 (más rápido)
   */
  private calculateCentroidModulator(centroidHz: number): number {
    const { minHz, maxHz, decayScale } = ROCK_UNIFIED_CONFIG.centroidModulation;
    
    // Normalizar centroid al rango [0, 1]
    const normalized = Math.max(0, Math.min(1, (centroidHz - minHz) / (maxHz - minHz)));
    
    // Centroid alto = decay más bajo (más rápido)
    return 1.0 - (normalized * decayScale);
  }
  
  // ==========================================================================
  // PROCESAMIENTO POR ZONA
  // ==========================================================================
  /**
   * FRONT PAR: Responde a SUB-BASS puro - WAVE 1015 ROCK DETOX
   * El KICK es el rey. Curva exponencial para PUNCH que EXPLOTA.
   */
  private processFrontPar(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    centroidMod: number
  ): void {
    const config = ROCK_UNIFIED_CONFIG;
    
    // 🎯 WAVE 1015.11: BANDPASS FILTER - eliminar LowMid leak (voces/bajo)
    // Si LowMid > SubBass × 1.3 → probable leak de voces/bajo, reducir input
    const rawInput = bands.subBass;
    const leakDetection = bands.lowMid > (bands.subBass * 1.3);
    const filteredInput = leakDetection ? rawInput * 0.7 : rawInput;
    
    // Gate check
    if (filteredInput < config.gates.frontPar) {
      // Decay hacia 0
      this.frontIntensity *= config.decay.frontPar * centroidMod;
      if (this.frontIntensity < 0.01) this.frontIntensity = 0;
      return;
    }
    
    // 🎯 WAVE 1015.7: SIN CURVA - la renormalización ya tiene expansión x^0.65
    // Curvas adicionales (x^2, x^3) APLASTAN en vez de levantar
    // Ahora: input directo con gain alto
    const target = filteredInput * config.gains.frontPar;
    
    // Aplicar con decay asimétrico (attack rápido, release suave)
    if (target > this.frontIntensity) {
      // Attack: seguir inmediatamente
      this.frontIntensity = target;
    } else {
      // Release: decay gradual
      const decaySpeed = config.decay.frontPar * centroidMod;
      this.frontIntensity = this.frontIntensity * decaySpeed + target * (1 - decaySpeed);
    }
    
    // 🎯 WAVE 1015.11: SOFT LIMITER - comprimir suavemente por encima de 0.85
    if (this.frontIntensity > 0.85) {
      const excess = this.frontIntensity - 0.85;
      this.frontIntensity = 0.85 + (excess * 0.4);  // Comprimir exceso al 40%
    }
    
    // 🎯 Clamp a 1.0 - controlado
    this.frontIntensity = Math.max(0, Math.min(1.0, this.frontIntensity));
  }
  
  /**
   * BACK PAR: Responde a SUB-BASS + LOW-MID - WAVE 1015 ROCK DETOX
   * 🎯 NUEVA LÓGICA: Harshness sube el GATE, no el Gain.
   * Metal sucio = más selectivo, no más brillante
   */
  private processBackPar(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    harshnessMod: number,
    centroidMod: number
  ): void {
    const config = ROCK_UNIFIED_CONFIG;
    
    // 🎯 WAVE 1015.6: Input = HighMid (400-2500Hz = SNARE + RHYTHM GUITAR)
    // ¡PLAN ORIGINAL DE SONNET! Back debe estar en CONTRATIEMPO con Front
    // Front=SubBass(kick) → sincroniza con Mover L=LowMid(bajo)
    // Back=HighMid(snare) → contratiempo, crea ritmo visual
    const input = bands.highMid;
    
    // Gate check simple
    if (input < config.gates.backPar) {
      this.backIntensity *= config.decay.backPar * centroidMod;
      if (this.backIntensity < 0.01) this.backIntensity = 0;
      return;
    }
    
    // 🎯 WAVE 1015.6: Ganancia MODULADA por harshness (plan original)
    // Balada suave (harshness bajo) → Back suave
    // Metal agresivo (harshness alto) → Back POTENTE
    const harshnessBoost = (harshnessMod - 1.0) * 0.5;  // Max +50% con harshness=1.0
    const modulatedGain = config.gains.backPar * (1.0 + harshnessBoost);
    const target = input * modulatedGain;
    
    // Aplicar con decay
    if (target > this.backIntensity) {
      this.backIntensity = target;
    } else {
      const decaySpeed = config.decay.backPar * centroidMod;
      this.backIntensity = this.backIntensity * decaySpeed + target * (1 - decaySpeed);
    }
    
    // 🎯 Clamp a 1.0 - saturación controlada
    this.backIntensity = Math.max(0, Math.min(1.0, this.backIntensity));
  }
  
  /**
   * MOVER LEFT: Responde a LOW-MID (bass body, low guitar riffs)
   * ¡PLAN ORIGINAL DE SONNET! El lado del PESO - sigue el bajo
   */
  private processMoverLeft(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    harshnessMod: number,
    flatnessMod: number,
    centroidMod: number
  ): void {
    const config = ROCK_UNIFIED_CONFIG;
    
    // 🎯 WAVE 1015.6: Input = LowMid (150-500Hz = BAJO + CUERPO)
    // ¡PLAN ORIGINAL! Mover L da peso, sincroniza con Front (kick+bajo)
    // Front=SubBass(kick), MoverL=LowMid(bajo) → sincronizan (base rítmica)
    // Back=HighMid(snare), MoverR=Presence(brillo) → contratiempo (ritmo visual)
    const input = bands.lowMid;
    
    // Gate check
    if (input < config.gates.moverLeft) {
      this.moverLeftIntensity *= config.decay.moverLeft * centroidMod;
      if (this.moverLeftIntensity < 0.01) this.moverLeftIntensity = 0;
      return;
    }
    
    // 🎯 WAVE 1015: Harshness boost REDUCIDO (de *2 a *1)
    const harshnessBoost = (harshnessMod - 1.0) * config.harshnessModulation.moverIntensity;
    const modulatedGain = config.gains.moverLeft * (1.0 + harshnessBoost);
    const target = input * modulatedGain;
    
    // Aplicar con decay (flatness aumenta el decay = más suave)
    if (target > this.moverLeftIntensity) {
      this.moverLeftIntensity = target;
    } else {
      const flatnessStretch = 1.0 + (flatnessMod - 1.0) * config.flatnessModulation.decayStretch;
      const decaySpeed = Math.min(0.95, config.decay.moverLeft * centroidMod * flatnessStretch);
      this.moverLeftIntensity = this.moverLeftIntensity * decaySpeed + target * (1 - decaySpeed);
    }
    
    // 🎯 Clamp a 1.0 - garra controlada
    this.moverLeftIntensity = Math.max(0, Math.min(1.0, this.moverLeftIntensity));
  }
  
  /**
   * MOVER RIGHT: Responde a PRESENCE + HIGH-MID - WAVE 1015 ROCK DETOX
   * 🎯 El lado "brillante" - cymbals, harmonics, guitarras agudas
   * SIN solapamiento con Mover L (separación estéreo real)
   */
  private processMoverRight(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    harshnessMod: number,
    flatnessMod: number,
    centroidMod: number
  ): void {
    const config = ROCK_UNIFIED_CONFIG;
    
    // 🎯 WAVE 1015.10: Input = HighMid (guitarras) + Presence (cymbals) BLEND
    // Las guitarras están en HighMid (400-2500Hz), NO en Presence!
    // Blend: 60% HighMid (guitarras) + 40% Presence (brillo/cymbals)
    const guitarBody = bands.highMid * 0.6;
    const brightness = bands.presence * 0.4;
    const rawInput = guitarBody + brightness;
    
    // 🎯 WAVE 1015.11: VOICE LEAK FILTER - si HighMid MUY alto vs Presence → voces
    // Guitarras tienen balance similar HighMid/Presence, voces son HighMid-heavy
    const voiceLeakDetection = bands.highMid > (bands.presence * 2.0);
    const filteredInput = voiceLeakDetection ? rawInput * 0.6 : rawInput;
    
    // Gate check
    if (filteredInput < config.gates.moverRight) {
      this.moverRightIntensity *= config.decay.moverRight * centroidMod;
      if (this.moverRightIntensity < 0.01) this.moverRightIntensity = 0;
      return;
    }
    
    // 🎯 WAVE 1015: Harshness boost REDUCIDO
    const harshnessBoost = (harshnessMod - 1.0) * config.harshnessModulation.moverIntensity;
    const modulatedGain = config.gains.moverRight * (1.0 + harshnessBoost);
    const target = filteredInput * modulatedGain;
    
    // Aplicar
    if (target > this.moverRightIntensity) {
      this.moverRightIntensity = target;
    } else {
      const flatnessStretch = 1.0 + (flatnessMod - 1.0) * config.flatnessModulation.decayStretch;
      const decaySpeed = Math.min(0.95, config.decay.moverRight * centroidMod * flatnessStretch);
      this.moverRightIntensity = this.moverRightIntensity * decaySpeed + target * (1 - decaySpeed);
    }
    
    // 🎯 WAVE 1015.11: SOFT LIMITER - comprimir suavemente por encima de 0.85
    if (this.moverRightIntensity > 0.85) {
      const excess = this.moverRightIntensity - 0.85;
      this.moverRightIntensity = 0.85 + (excess * 0.4);  // Comprimir exceso al 40%
    }
    
    // 🎯 Clamp a 1.0 - brillo controlado
    this.moverRightIntensity = Math.max(0, Math.min(1.0, this.moverRightIntensity));
  }
  
  // ==========================================================================
  // STEREO DIFFERENTIAL GATING - WAVE 1015.2
  // ==========================================================================
  
  /**
   * Si Mover L y R están muy cerca (gemelos), forzar al más débil a apagarse
   * para crear separación estéreo REAL.
   */
  private applyStereoDifferentialGating(): void {
    const diff = Math.abs(this.moverLeftIntensity - this.moverRightIntensity);
    const avg = (this.moverLeftIntensity + this.moverRightIntensity) / 2;
    
    // Si la diferencia es < 20% del promedio → son gemelos
    if (avg > 0.1 && diff < avg * 0.20) {
      // Forzar al más débil a 0
      if (this.moverLeftIntensity < this.moverRightIntensity) {
        this.moverLeftIntensity *= 0.3;  // Fade out rápido
      } else {
        this.moverRightIntensity *= 0.3;  // Fade out rápido
      }
    }
  }
  
  // ==========================================================================
  // MOVER POSITION LOGIC
  // ==========================================================================
  
  private updateMoverPositions(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    flatnessMod: number
  ): void {
    // Detectar transients
    const transientL = Math.max(0, bands.highMid - this.lastBands.highMid);
    const transientR = Math.max(0, bands.presence - this.lastBands.presence);
    
    // Spread base modulado por flatness (rock atmosférico = más spread)
    const baseSpread = 0.25 * flatnessMod;
    
    // Mover Left: oscila hacia la izquierda con transients
    if (transientL > 0.05) {
      const delta = transientL * baseSpread;
      this.moverLeftPosition = Math.max(0.15, Math.min(0.85, 
        this.moverLeftPosition - delta
      ));
    } else {
      // Retorno gradual al centro
      this.moverLeftPosition += (0.5 - this.moverLeftPosition) * 0.03;
    }
    
    // Mover Right: oscila hacia la derecha con transients
    if (transientR > 0.05) {
      const delta = transientR * baseSpread;
      this.moverRightPosition = Math.max(0.15, Math.min(0.85,
        this.moverRightPosition + delta
      ));
    } else {
      // Retorno gradual al centro
      this.moverRightPosition += (0.5 - this.moverRightPosition) * 0.03;
    }
  }
  
  // ==========================================================================
  // DEBUG
  // ==========================================================================
  
  private logDebug(
    bands: { subBass: number; lowMid: number; highMid: number; presence: number },
    harshness: number,
    flatness: number,
    centroidHz: number,
    hMod: number,
    fMod: number,
    cMod: number
  ): void {
    console.log(
      `🎸 RockPhysics2 [UNIFIED] | ` +
      `Bands: SB=${bands.subBass.toFixed(2)} LM=${bands.lowMid.toFixed(2)} ` +
      `HM=${bands.highMid.toFixed(2)} PR=${bands.presence.toFixed(2)} | ` +
      `Spectral: H=${harshness.toFixed(2)} F=${flatness.toFixed(2)} C=${centroidHz.toFixed(0)}Hz | ` +
      `Mods: H=${hMod.toFixed(2)} F=${fMod.toFixed(2)} C=${cMod.toFixed(2)} | ` +
      `Out: FP=${this.frontIntensity.toFixed(2)} BP=${this.backIntensity.toFixed(2)} ` +
      `ML=${this.moverLeftIntensity.toFixed(2)} MR=${this.moverRightIntensity.toFixed(2)}`
    );
  }
  
  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  
  getDebugInfo(): {
    engineType: string;
    frameCount: number;
    intensities: {
      front: number;
      back: number;
      moverLeft: number;
      moverRight: number;
    };
    moverPositions: {
      left: number;
      right: number;
    };
  } {
    return {
      engineType: 'RockStereoPhysics2-UNIFIED',
      frameCount: this.frameCount,
      intensities: {
        front: this.frontIntensity,
        back: this.backIntensity,
        moverLeft: this.moverLeftIntensity,
        moverRight: this.moverRightIntensity,
      },
      moverPositions: {
        left: this.moverLeftPosition,
        right: this.moverRightPosition,
      },
    };
  }
  
  /**
   * Reset del motor - útil para cambios de canción
   */
  reset(): void {
    this.frontIntensity = 0;
    this.backIntensity = 0;
    this.moverLeftIntensity = 0;
    this.moverRightIntensity = 0;
    
    this.moverLeftPosition = 0.5;
    this.moverRightPosition = 0.5;
    
    this.lastBands = { subBass: 0, lowMid: 0, highMid: 0, presence: 0 };
    this.frameCount = 0;
    
    console.log('[RockStereoPhysics2] 🔄 Reset complete');
  }
  
  // ==========================================================================
  // LEGACY API ADAPTER - Para compatibilidad con SeleneLux
  // ==========================================================================
  
  /**
   * applyZones: Adapter para SeleneLux que usa el contexto estructurado anterior.
   * Convierte el formato RockAudioContext → RockPhysicsInput y retorna RockZonesResult.
   */
  applyZones(context: {
    bass: number;
    lowMid?: number;
    mid: number;
    highMid?: number;
    treble: number;
    subBass?: number;
    harshness?: number;
    spectralFlatness?: number;
    spectralCentroid?: number;
    kickDetected?: boolean;
    snareDetected?: boolean;
    hihatDetected?: boolean;
    bpm?: number;
  }): {
    front: number;
    back: number;
    moverLeft: number;
    moverRight: number;
    subgenre: string;
  } {
    // Convertir al nuevo formato de input
    const input: RockPhysicsInput = {
      bass: context.bass,
      mid: context.mid,
      treble: context.treble,
      subBass: context.subBass,
      lowMid: context.lowMid,
      highMid: context.highMid,
      harshness: context.harshness,
      flatness: context.spectralFlatness,
      spectralCentroidHz: context.spectralCentroid,
      bpm: context.bpm ?? 120,
      melodyThreshold: 0.3,  // Default para rock
      isRealSilence: false,
      isAGCTrap: false,
    };
    
    // Procesar
    const result = this.process(input);
    
    // Retornar en el formato que SeleneLux espera
    // 🔥 WAVE 1011.6: Los valores internos pueden superar 1.0, pero la salida se clampea
    return {
      front: Math.min(1.0, result.frontParIntensity),
      back: Math.min(1.0, result.backParIntensity),
      moverLeft: Math.min(1.0, result.moverIntensityL),
      moverRight: Math.min(1.0, result.moverIntensityR),
      subgenre: 'ROCK',  // 🎸 UNIFIED - No hay subgéneros, solo ROCK
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/** Singleton instance for global use */
export const rockPhysics2 = new RockStereoPhysics2();
