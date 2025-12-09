/**
 * 📊 SECTION TRACKER - Detector de Secciones Musicales
 * =====================================================
 * Wave 8 - FASE 3: Clasificación
 * 
 * Detecta en qué sección de la canción estamos:
 * - intro, verse, buildup, drop, breakdown, chorus, outro
 * 
 * ALGORITMO:
 * 1. Analizar tendencia de energía (rising/falling/stable)
 * 2. Detectar cambios bruscos de intensidad
 * 3. Correlacionar con fills de batería
 * 4. Predecir próxima sección
 * 
 * ⚠️ REGLA 1: Throttled 500ms (Worker Thread o Main con cache)
 * ⚠️ REGLA 2: Retorna 'confidence' para fallback
 * 
 * @module engines/musical/analysis/SectionTracker
 */

import { EventEmitter } from 'events';
import {
  SectionAnalysis,
  SectionType,
  RhythmAnalysis,
  HarmonyAnalysis,
} from '../types.js';

// ============================================================
// 📊 CONSTANTES Y CONFIGURACIÓN
// ============================================================

/**
 * Perfiles de energía típicos por sección
 * 
 * Cada sección tiene un rango de energía y características típicas
 */
export const SECTION_PROFILES: Record<SectionType, {
  energyRange: [number, number];
  typicalDuration: [number, number];  // [min, max] en segundos
  characteristics: string[];
}> = {
  intro: {
    energyRange: [0.1, 0.4],
    typicalDuration: [8, 32],
    characteristics: ['low_energy', 'building', 'sparse'],
  },
  verse: {
    energyRange: [0.3, 0.6],
    typicalDuration: [16, 64],
    characteristics: ['moderate_energy', 'steady', 'melodic'],
  },
  pre_chorus: {
    energyRange: [0.5, 0.7],
    typicalDuration: [8, 16],
    characteristics: ['rising_energy', 'anticipation'],
  },
  chorus: {
    energyRange: [0.6, 0.9],
    typicalDuration: [16, 32],
    characteristics: ['high_energy', 'full_instrumentation'],
  },
  bridge: {
    energyRange: [0.4, 0.6],
    typicalDuration: [8, 16],
    characteristics: ['different_texture', 'contrast'],
  },
  buildup: {
    energyRange: [0.5, 0.95],
    typicalDuration: [8, 32],
    characteristics: ['rising_energy', 'tension', 'snare_roll', 'filter_sweep'],
  },
  drop: {
    energyRange: [0.8, 1.0],
    typicalDuration: [16, 64],
    characteristics: ['peak_energy', 'bass_heavy', 'full_impact'],
  },
  breakdown: {
    energyRange: [0.2, 0.5],
    typicalDuration: [8, 32],
    characteristics: ['low_energy', 'stripped_back', 'atmospheric'],
  },
  outro: {
    energyRange: [0.1, 0.4],
    typicalDuration: [8, 32],
    characteristics: ['falling_energy', 'fading', 'sparse'],
  },
  unknown: {
    energyRange: [0.0, 1.0],
    typicalDuration: [4, 120],
    characteristics: [],
  },
};

/**
 * Transiciones típicas entre secciones
 * Sección actual → Posibles siguientes secciones con probabilidad
 */
export const SECTION_TRANSITIONS: Record<SectionType, Array<{
  to: SectionType;
  probability: number;
}>> = {
  intro: [
    { to: 'verse', probability: 0.5 },
    { to: 'buildup', probability: 0.3 },
    { to: 'drop', probability: 0.2 },
  ],
  verse: [
    { to: 'pre_chorus', probability: 0.4 },
    { to: 'chorus', probability: 0.3 },
    { to: 'buildup', probability: 0.2 },
    { to: 'bridge', probability: 0.1 },
  ],
  pre_chorus: [
    { to: 'chorus', probability: 0.7 },
    { to: 'buildup', probability: 0.2 },
    { to: 'drop', probability: 0.1 },
  ],
  chorus: [
    { to: 'verse', probability: 0.3 },
    { to: 'breakdown', probability: 0.25 },
    { to: 'bridge', probability: 0.2 },
    { to: 'buildup', probability: 0.15 },
    { to: 'outro', probability: 0.1 },
  ],
  bridge: [
    { to: 'chorus', probability: 0.5 },
    { to: 'buildup', probability: 0.3 },
    { to: 'breakdown', probability: 0.2 },
  ],
  buildup: [
    { to: 'drop', probability: 0.8 },
    { to: 'chorus', probability: 0.15 },
    { to: 'breakdown', probability: 0.05 },
  ],
  drop: [
    { to: 'breakdown', probability: 0.4 },
    { to: 'buildup', probability: 0.3 },
    { to: 'verse', probability: 0.15 },
    { to: 'outro', probability: 0.15 },
  ],
  breakdown: [
    { to: 'buildup', probability: 0.5 },
    { to: 'verse', probability: 0.25 },
    { to: 'drop', probability: 0.15 },
    { to: 'outro', probability: 0.1 },
  ],
  outro: [
    { to: 'unknown', probability: 1.0 },  // Fin de canción
  ],
  unknown: [
    { to: 'intro', probability: 0.5 },
    { to: 'verse', probability: 0.3 },
    { to: 'drop', probability: 0.2 },
  ],
};

// ============================================================
// ⚙️ CONFIGURACIÓN
// ============================================================

export interface SectionTrackerConfig {
  /** Intervalo de throttling en ms (por defecto 500ms) */
  throttleMs: number;
  /** Tamaño del buffer de energía para trend */
  energyHistorySize: number;
  /** Umbral de cambio de energía para detectar transición */
  energyChangeThreshold: number;
  /** Mínima duración de sección en ms */
  minSectionDuration: number;
}

const DEFAULT_CONFIG: SectionTrackerConfig = {
  throttleMs: 500,              // REGLA 1: Throttled
  energyHistorySize: 20,        // ~10 segundos de historial
  energyChangeThreshold: 0.25,  // Cambio del 25% = transición
  minSectionDuration: 4000,     // Mínimo 4 segundos por sección
};

// ============================================================
// 📊 SECTION TRACKER CLASS
// ============================================================

interface EnergyFrame {
  energy: number;
  bass: number;
  intensity: number;
  timestamp: number;
}

/**
 * Tracker de secciones musicales
 * 
 * Detecta intro, verse, buildup, drop, breakdown, chorus, outro
 * y predice la siguiente sección basado en patrones típicos
 */
export class SectionTracker extends EventEmitter {
  private config: SectionTrackerConfig;
  
  // Estado interno
  private currentSection: SectionType = 'unknown';
  private sectionStartTime: number = 0;
  private lastAnalysisTime: number = 0;
  private cachedAnalysis: SectionAnalysis | null = null;
  
  // Historial de energía para detectar trends
  private energyHistory: EnergyFrame[] = [];
  
  // Contadores para estabilizar detección
  private sectionVotes: Map<SectionType, number> = new Map();
  private consecutiveSection: number = 0;
  
  constructor(config: Partial<SectionTrackerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================
  // 📊 MÉTODO PRINCIPAL - TRACK
  // ============================================================

  /**
   * Analizar y trackear sección actual
   * 
   * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param rhythm Análisis rítmico del frame actual
   * @param harmony Análisis armónico (puede ser null si no está disponible)
   * @param audio Métricas de audio del frame actual
   * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
   */
  track(
    rhythm: RhythmAnalysis,
    _harmony: HarmonyAnalysis | null, // Reserved for future genre-aware section detection
    audio: { energy: number; bass: number; mid: number; treble: number },
    forceAnalysis: boolean = false
  ): SectionAnalysis {
    const now = Date.now();
    
    // THROTTLING: Retornar caché si no ha pasado suficiente tiempo
    if (!forceAnalysis && 
        this.cachedAnalysis && 
        (now - this.lastAnalysisTime) < this.config.throttleMs) {
      return this.cachedAnalysis;
    }

    // === PASO 1: Actualizar historial de energía ===
    this.updateEnergyHistory(audio, now);
    
    // === PASO 2: Calcular intensidad actual ===
    const intensity = this.calculateIntensity(audio, rhythm);
    
    // === PASO 3: Detectar trend de energía ===
    const trend = this.detectEnergyTrend();
    
    // === PASO 4: Detectar sección actual ===
    const detectedSection = this.detectSection(intensity, trend, rhythm, audio);
    
    // === PASO 5: Verificar cambio de sección ===
    this.handleSectionChange(detectedSection, now);
    
    // === PASO 6: Predecir siguiente sección ===
    const prediction = this.predictNextSection(trend, rhythm);
    
    // === PASO 7: Calcular confianza ===
    const confidence = this.calculateConfidence(rhythm);
    
    // === PASO 8: Construir resultado ===
    const analysis: SectionAnalysis = {
      current: {
        type: this.currentSection,
        confidence: this.calculateSectionConfidence(),
        startedAt: this.sectionStartTime,
        duration: now - this.sectionStartTime,
      },
      predicted: prediction,
      intensity,
      intensityTrend: trend,
      confidence,
      timestamp: now,
    };
    
    // Actualizar cache y tiempo
    this.cachedAnalysis = analysis;
    this.lastAnalysisTime = now;
    
    // Emitir evento
    this.emit('section', analysis);
    
    return analysis;
  }

  // ============================================================
  // 🔋 CÁLCULO DE ENERGÍA E INTENSIDAD
  // ============================================================

  /**
   * Actualizar historial de energía
   */
  private updateEnergyHistory(
    audio: { energy: number; bass: number; mid: number; treble: number },
    timestamp: number
  ): void {
    const frame: EnergyFrame = {
      energy: audio.energy,
      bass: audio.bass,
      intensity: (audio.bass * 0.4 + audio.mid * 0.3 + audio.energy * 0.3),
      timestamp,
    };
    
    this.energyHistory.push(frame);
    
    // Mantener tamaño del buffer
    while (this.energyHistory.length > this.config.energyHistorySize) {
      this.energyHistory.shift();
    }
  }

  /**
   * Calcular intensidad actual (0-1)
   * 
   * Combina:
   * - Energía del audio (40%)
   * - Bass (30%)
   * - Actividad de drums (30%)
   */
  private calculateIntensity(
    audio: { energy: number; bass: number; mid: number; treble: number },
    rhythm: RhythmAnalysis
  ): number {
    const audioIntensity = audio.energy;
    const bassIntensity = audio.bass;
    const drumActivity = (
      (rhythm.drums.kickDetected ? rhythm.drums.kickIntensity : 0) * 0.4 +
      (rhythm.drums.snareDetected ? rhythm.drums.snareIntensity : 0) * 0.3 +
      (rhythm.drums.hihatDetected ? rhythm.drums.hihatIntensity : 0) * 0.3
    );
    
    return Math.min(1, audioIntensity * 0.4 + bassIntensity * 0.3 + drumActivity * 0.3);
  }

  /**
   * Detectar tendencia de energía
   * 
   * Analiza el historial para determinar si la energía está:
   * - rising: Subiendo (típico de buildup)
   * - falling: Bajando (típico de breakdown/outro)
   * - stable: Estable
   */
  private detectEnergyTrend(): 'rising' | 'falling' | 'stable' {
    if (this.energyHistory.length < 4) {
      return 'stable';
    }
    
    // Dividir historial en dos mitades
    const midPoint = Math.floor(this.energyHistory.length / 2);
    const firstHalf = this.energyHistory.slice(0, midPoint);
    const secondHalf = this.energyHistory.slice(midPoint);
    
    // Calcular promedio de cada mitad
    const avgFirst = firstHalf.reduce((sum, f) => sum + f.intensity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, f) => sum + f.intensity, 0) / secondHalf.length;
    
    const change = avgSecond - avgFirst;
    const threshold = this.config.energyChangeThreshold / 4;  // Más sensible para trend
    
    if (change > threshold) {
      return 'rising';
    } else if (change < -threshold) {
      return 'falling';
    }
    return 'stable';
  }

  // ============================================================
  // 🎯 DETECCIÓN DE SECCIÓN
  // ============================================================

  /**
   * Detectar tipo de sección actual
   * 
   * Algoritmo:
   * 1. Analizar nivel de intensidad
   * 2. Analizar trend de energía
   * 3. Analizar características de drums
   * 4. Votar por sección más probable
   */
  private detectSection(
    intensity: number,
    trend: 'rising' | 'falling' | 'stable',
    rhythm: RhythmAnalysis,
    audio: { energy: number; bass: number; mid: number; treble: number }
  ): SectionType {
    // Resetear votos
    this.sectionVotes.clear();
    
    // === REGLAS DE DETECCIÓN ===
    
    // 🔥 DROP: Alta intensidad + bass pesado + drums activos
    if (intensity > 0.75 && audio.bass > 0.7 && rhythm.drums.kickDetected) {
      this.addVote('drop', 0.8);
    }
    
    // 📈 BUILDUP: Energía subiendo + posible riser/filter sweep
    if (trend === 'rising' && intensity > 0.4 && intensity < 0.9) {
      this.addVote('buildup', 0.7);
      
      // Bonus si hay fill de batería
      if (rhythm.fillInProgress) {
        this.addVote('buildup', 0.2);
      }
    }
    
    // 📉 BREAKDOWN: Baja energía después de alta + falling trend
    if (intensity < 0.4 && trend === 'falling') {
      this.addVote('breakdown', 0.6);
    }
    
    // 🎤 VERSE: Energía media + estable + sin bass dominante
    if (intensity >= 0.3 && intensity <= 0.6 && trend === 'stable') {
      this.addVote('verse', 0.5);
    }
    
    // 🎵 CHORUS: Alta energía + estable (ya pasó el buildup)
    if (intensity > 0.6 && intensity < 0.85 && trend === 'stable') {
      this.addVote('chorus', 0.6);
    }
    
    // 🎬 INTRO: Baja energía + principio (primeros 30 segundos implícitos)
    if (intensity < 0.35 && this.currentSection === 'unknown') {
      this.addVote('intro', 0.7);
    }
    
    // 👋 OUTRO: Baja energía + falling + después de drop/chorus
    if (intensity < 0.35 && trend === 'falling' && 
        (this.currentSection === 'drop' || this.currentSection === 'chorus')) {
      this.addVote('outro', 0.5);
    }
    
    // Obtener sección con más votos
    return this.getMostVotedSection();
  }

  /**
   * Añadir voto para una sección
   */
  private addVote(section: SectionType, weight: number): void {
    const current = this.sectionVotes.get(section) || 0;
    this.sectionVotes.set(section, current + weight);
  }

  /**
   * Obtener sección con más votos
   */
  private getMostVotedSection(): SectionType {
    let maxVotes = 0;
    let winner: SectionType = this.currentSection;  // Default: mantener actual
    
    for (const [section, votes] of this.sectionVotes) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = section;
      }
    }
    
    return winner;
  }

  /**
   * Manejar cambio de sección
   */
  private handleSectionChange(detected: SectionType, now: number): void {
    // Verificar si es diferente a la actual
    if (detected !== this.currentSection) {
      // Verificar duración mínima de sección actual
      const duration = now - this.sectionStartTime;
      
      if (duration >= this.config.minSectionDuration || this.currentSection === 'unknown') {
        const oldSection = this.currentSection;
        this.currentSection = detected;
        this.sectionStartTime = now;
        this.consecutiveSection = 1;
        
        // Emitir evento de cambio
        this.emit('section-change', {
          from: oldSection,
          to: detected,
          timestamp: now,
        });
      }
    } else {
      this.consecutiveSection++;
    }
  }

  // ============================================================
  // 🔮 PREDICCIÓN DE SIGUIENTE SECCIÓN
  // ============================================================

  /**
   * Predecir la siguiente sección
   * 
   * Basado en:
   * 1. Transiciones típicas desde sección actual
   * 2. Trend de energía actual
   * 3. Señales de transición (fills, etc.)
   */
  private predictNextSection(
    trend: 'rising' | 'falling' | 'stable',
    rhythm: RhythmAnalysis
  ): SectionAnalysis['predicted'] {
    const transitions = SECTION_TRANSITIONS[this.currentSection];
    if (!transitions || transitions.length === 0) {
      return null;
    }
    
    // Ajustar probabilidades basado en trend
    const adjusted = transitions.map(t => {
      let probability = t.probability;
      
      // Si la energía está subiendo, más probable buildup/drop
      if (trend === 'rising') {
        if (t.to === 'buildup' || t.to === 'drop') {
          probability *= 1.5;
        }
        if (t.to === 'breakdown' || t.to === 'outro') {
          probability *= 0.5;
        }
      }
      
      // Si la energía está bajando, más probable breakdown/outro
      if (trend === 'falling') {
        if (t.to === 'breakdown' || t.to === 'outro') {
          probability *= 1.5;
        }
        if (t.to === 'buildup' || t.to === 'drop') {
          probability *= 0.5;
        }
      }
      
      // Si hay fill, probablemente viene un cambio
      if (rhythm.fillInProgress) {
        if (t.to === 'drop' || t.to === 'chorus') {
          probability *= 1.3;
        }
      }
      
      return { ...t, probability: Math.min(1, probability) };
    });
    
    // Normalizar probabilidades
    const total = adjusted.reduce((sum, t) => sum + t.probability, 0);
    const normalized = adjusted.map(t => ({
      ...t,
      probability: t.probability / total,
    }));
    
    // Obtener la más probable
    const best = normalized.reduce((a, b) => 
      a.probability > b.probability ? a : b
    );
    
    // Estimar tiempo hasta el cambio
    const sectionDuration = Date.now() - this.sectionStartTime;
    const profile = SECTION_PROFILES[this.currentSection];
    const avgDuration = ((profile.typicalDuration[0] + profile.typicalDuration[1]) / 2) * 1000;
    const estimatedIn = Math.max(1000, avgDuration - sectionDuration);
    
    return {
      type: best.to,
      probability: best.probability,
      estimatedIn,
    };
  }

  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA
  // ============================================================

  /**
   * Calcular confianza de la sección actual
   * 🔧 WAVE 14.6: Protección contra NaN
   */
  private calculateSectionConfidence(): number {
    // Basado en:
    // 1. Cantidad de frames en esta sección
    // 2. Consistencia de votos
    // 3. Match con perfil típico
    
    const now = Date.now();
    const duration = this.sectionStartTime > 0 ? now - this.sectionStartTime : 0;
    const durationFactor = Math.min(1, duration / 10000);  // Max confidence después de 10s
    
    const voteConfidence = Math.min(1, (this.consecutiveSection || 0) / 10);
    
    const result = durationFactor * 0.5 + voteConfidence * 0.5;
    
    // 🔧 WAVE 14.6: Protección contra NaN
    return Number.isFinite(result) ? result : 0;
  }

  /**
   * Calcular confianza general del análisis
   * 
   * ⚠️ REGLA 2: Si < 0.5, el orquestador usará fallback
   * 🔧 WAVE 14.6: Protección contra NaN
   */
  private calculateConfidence(rhythm: RhythmAnalysis): number {
    // Factores:
    // 1. Historial suficiente
    // 2. Confianza del análisis rítmico
    // 3. Estabilidad de sección
    
    const historyFactor = Math.min(1, (this.energyHistory.length || 0) / 10);
    const rhythmFactor = rhythm?.confidence ?? 0; // 🔧 Protección
    const stabilityFactor = this.calculateSectionConfidence();
    
    const result = historyFactor * 0.3 + rhythmFactor * 0.4 + stabilityFactor * 0.3;
    
    // 🔧 WAVE 14.6: Protección contra NaN
    return Number.isFinite(result) ? result : 0;
  }

  // ============================================================
  // 📤 GETTERS Y UTILIDADES
  // ============================================================

  /**
   * Obtener último análisis (caché)
   */
  getLastAnalysis(): SectionAnalysis | null {
    return this.cachedAnalysis;
  }

  /**
   * Obtener sección actual
   */
  getCurrentSection(): SectionType {
    return this.currentSection;
  }

  /**
   * Verificar si estamos en buildup (útil para preparar el drop)
   */
  isBuildup(): boolean {
    return this.currentSection === 'buildup';
  }

  /**
   * Verificar si estamos en drop (máxima energía)
   */
  isDrop(): boolean {
    return this.currentSection === 'drop';
  }

  /**
   * Reset del tracker
   */
  reset(): void {
    this.currentSection = 'unknown';
    this.sectionStartTime = 0;
    this.lastAnalysisTime = 0;
    this.cachedAnalysis = null;
    this.energyHistory = [];
    this.sectionVotes.clear();
    this.consecutiveSection = 0;
  }
}

// ============================================================
// 📤 FACTORY FUNCTION
// ============================================================

/**
 * Crear instancia de SectionTracker con config por defecto
 */
export function createSectionTracker(
  config?: Partial<SectionTrackerConfig>
): SectionTracker {
  return new SectionTracker(config);
}

// Export default instance for quick usage
export const defaultSectionTracker = new SectionTracker();
