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
  /** Mínima duración de sección en ms - WAVE 47.2: Aumentado a 8s */
  minSectionDuration: number;
  /** WAVE 47.2: Tamaño del buffer para calcular baseline de energía */
  energyBaselineSize: number;
  /** WAVE 47.2: Umbral de confianza para cambiar de sección */
  transitionConfidenceThreshold: number;
  /** WAVE 47.2: Frames consecutivos necesarios para confirmar transición */
  transitionConfirmationFrames: number;
  /** 🌊 WAVE 70: Máxima duración de DROP en ms (evita DROPs eternos) */
  maxDropDuration: number;
  /** 🌊 WAVE 70: Tiempo de cooldown después de DROP en ms (evita re-entrada inmediata) */
  dropCooldownTime: number;
  /** 🌊 WAVE 70: Umbral de energía para kill switch de DROP (si baja de este valor, forzar salida) */
  dropEnergyKillThreshold: number;
}

const DEFAULT_CONFIG: SectionTrackerConfig = {
  throttleMs: 500,                      // REGLA 1: Throttled
  energyHistorySize: 20,                // ~10 segundos de historial
  energyChangeThreshold: 0.25,          // Cambio del 25% = transición
  minSectionDuration: 8000,             // WAVE 47.2: Mínimo 8 segundos por sección
  energyBaselineSize: 120,              // WAVE 47.2: ~60 segundos de baseline (120 frames a 500ms)
  transitionConfidenceThreshold: 0.65,  // WAVE 47.2: Mínimo 65% confianza para transición
  transitionConfirmationFrames: 6,      // WAVE 47.2: 6 frames = 3 segundos de confirmación
  // 🌊 WAVE 70: DROP timeout y cooldown para evitar DROPs eternos
  maxDropDuration: 30000,               // 30 segundos máximo de DROP (fiesta-latina puede ser 12s)
  dropCooldownTime: 5000,               // 5 segundos de cooldown después de DROP
  dropEnergyKillThreshold: 0.6,         // Si energía < 0.6, forzar salida de DROP
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
 * WAVE 47.2: Baseline de energía para cálculos relativos
 * Almacena percentiles calculados de toda la canción/sesión
 */
interface EnergyBaseline {
  p25: number;    // Percentil 25 (baja energía)
  p50: number;    // Mediana
  p75: number;    // Percentil 75 (alta energía)
  min: number;
  max: number;
  sampleCount: number;
}

/**
 * WAVE 47.2: Historial de transiciones para memoria narrativa
 */
interface SectionHistoryEntry {
  section: SectionType;
  timestamp: number;
  duration: number;
  avgIntensity: number;
}

/**
 * Tracker de secciones musicales
 * 
 * WAVE 47.2: Refactorizado con:
 * - Energía relativa (percentiles)
 * - Matriz de transición como gate
 * - Histéresis temporal aumentada
 * - Memoria narrativa
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
  
  // WAVE 47.2: Baseline de energía para cálculos relativos
  private energyBaseline: EnergyBaseline = {
    p25: 0.3, p50: 0.5, p75: 0.7, min: 0, max: 1, sampleCount: 0
  };
  private allEnergySamples: number[] = [];
  
  // WAVE 47.2: Acumulador de votos persistente (no se resetea cada frame)
  private sectionVotes: Map<SectionType, number> = new Map();
  private pendingTransition: SectionType | null = null;
  private pendingTransitionFrames: number = 0;
  
  // WAVE 47.2: Memoria narrativa - historial de secciones
  private sectionHistory: SectionHistoryEntry[] = [];
  
  // Contadores para estabilizar detección
  private consecutiveSection: number = 0;
  
  // 🌊 WAVE 70: DROP timeout y cooldown
  private dropStartTime: number = 0;         // Cuando empezó el DROP actual
  private lastDropEndTime: number = 0;       // Cuando terminó el último DROP
  private isDropCooldown: boolean = false;   // Estamos en período de cooldown?
  
  // 🌊 WAVE 70.5: Nuclear Kill Switch - fuerza salida inmediata de DROP
  private forceDropExit: boolean = false;    // Kill switch activado?
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 81: ENERGY DELTA MODEL
  // Física de energía pura para detección macroscópica de secciones
  // ═══════════════════════════════════════════════════════════════════════
  private avgEnergy: number = 0.5;           // Media móvil lenta (~2s inercia)
  private instantEnergy: number = 0.5;       // Media móvil rápida (~100ms inercia)
  private timeInLowEnergy: number = 0;       // Tiempo acumulado en energía baja
  private lastFrameTime: number = 0;         // Timestamp del último frame
  
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
   * WAVE 47.2: También actualiza baseline para cálculos relativos
   */
  private updateEnergyHistory(
    audio: { energy: number; bass: number; mid: number; treble: number },
    timestamp: number
  ): void {
    const rawIntensity = (audio.bass * 0.4 + audio.mid * 0.3 + audio.energy * 0.3);
    
    const frame: EnergyFrame = {
      energy: audio.energy,
      bass: audio.bass,
      intensity: rawIntensity,
      timestamp,
    };
    
    this.energyHistory.push(frame);
    
    // Mantener tamaño del buffer
    while (this.energyHistory.length > this.config.energyHistorySize) {
      this.energyHistory.shift();
    }
    
    // WAVE 47.2: Actualizar baseline de energía
    this.updateEnergyBaseline(rawIntensity);
  }

  /**
   * WAVE 47.2: Actualizar baseline de energía (percentiles)
   * Mantiene un buffer grande para calcular percentiles estables
   */
  private updateEnergyBaseline(intensity: number): void {
    this.allEnergySamples.push(intensity);
    
    // Limitar tamaño del buffer
    while (this.allEnergySamples.length > this.config.energyBaselineSize) {
      this.allEnergySamples.shift();
    }
    
    // Recalcular percentiles cada 10 muestras para eficiencia
    if (this.allEnergySamples.length % 10 === 0 && this.allEnergySamples.length >= 20) {
      const sorted = [...this.allEnergySamples].sort((a, b) => a - b);
      const len = sorted.length;
      
      this.energyBaseline = {
        p25: sorted[Math.floor(len * 0.25)],
        p50: sorted[Math.floor(len * 0.50)],
        p75: sorted[Math.floor(len * 0.75)],
        min: sorted[0],
        max: sorted[len - 1],
        sampleCount: len,
      };
    }
  }

  /**
   * Calcular intensidad actual (0-1)
   * 
   * WAVE 47.2: Ahora usa energía RELATIVA basada en percentiles
   * En lugar de umbrales absolutos, compara con el baseline de la canción
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
    // Calcular intensidad raw
    const audioIntensity = audio.energy;
    const bassIntensity = audio.bass;
    const drumActivity = (
      (rhythm.drums.kickDetected ? rhythm.drums.kickIntensity : 0) * 0.4 +
      (rhythm.drums.snareDetected ? rhythm.drums.snareIntensity : 0) * 0.3 +
      (rhythm.drums.hihatDetected ? rhythm.drums.hihatIntensity : 0) * 0.3
    );
    
    const rawIntensity = audioIntensity * 0.4 + bassIntensity * 0.3 + drumActivity * 0.3;
    
    // WAVE 47.2: Convertir a intensidad RELATIVA usando baseline
    // Si no hay suficientes muestras, usar valor raw normalizado
    if (this.energyBaseline.sampleCount < 20) {
      return Math.min(1, rawIntensity);
    }
    
    // Normalizar: 0 = P25 (baja), 0.5 = P50 (media), 1 = P75+ (alta)
    const range = this.energyBaseline.p75 - this.energyBaseline.p25;
    if (range < 0.05) {
      // Rango muy pequeño = canción muy plana, usar raw
      return Math.min(1, rawIntensity);
    }
    
    const relativeIntensity = (rawIntensity - this.energyBaseline.p25) / range;
    
    // Clamp entre 0 y 1, pero permitir valores > 1 para picos extremos
    return Math.max(0, Math.min(1.2, relativeIntensity));
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
   * WAVE 47.2: Refactorizado con:
   * - Intensidad RELATIVA (comparada con baseline de la canción)
   * - Votos ACUMULATIVOS (no se resetean, solo decaen)
   * - Validación de transición con matriz
   * 
   * Algoritmo:
   * 1. 🔥 WAVE 81: Energy Delta Model (prioridad)
   * 2. Decay de votos existentes (memoria temporal)
   * 3. Analizar nivel de intensidad RELATIVA
   * 4. Votar por sección más probable
   * 5. Validar transición con SECTION_TRANSITIONS
   */
  private detectSection(
    intensity: number,
    trend: 'rising' | 'falling' | 'stable',
    rhythm: RhythmAnalysis,
    audio: { energy: number; bass: number; mid: number; treble: number }
  ): SectionType {
    const now = Date.now();
    const e = audio.energy;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 81: ENERGY DELTA MODEL (FÍSICA PURA)
    // Este modelo tiene PRIORIDAD sobre el sistema de votos.
    // Si detecta un cambio macroscópico, retorna inmediatamente.
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. CÁLCULO DE ENERGÍA (Física Simple)
    // avgEnergy = Baseline lento (~2 seg inercia)
    // instantEnergy = Pico instantáneo (~100ms inercia)
    this.avgEnergy = this.avgEnergy * 0.98 + e * 0.02;
    this.instantEnergy = this.instantEnergy * 0.8 + e * 0.2;
    
    const delta = this.instantEnergy - this.avgEnergy;
    const ratio = this.instantEnergy / (this.avgEnergy + 0.01);
    
    // 🌴 WAVE 84: HIGH-ENERGY PHYSICS (Loudness War Tracks)
    // ═══════════════════════════════════════════════════════════════════════
    // Problema: Tracks "comprimidos" (reggaetón, EDM mastered hot) tienen avgEnergy > 0.7
    // permanente, haciendo imposible que ratio > 1.4 se cumpla (requiere salto de 0.7 → 0.98).
    // Solución: Umbrales dinámicos según el nivel de compresión del track.
    // ═══════════════════════════════════════════════════════════════════════
    const isHighEnergyTrack = this.avgEnergy > 0.7;
    
    // 🔥 WAVE 84: Umbrales adaptativos
    // - Track dinámico (avgEnergy ≤ 0.7): ratio 1.4, abs 0.75 (original)
    // - Track comprimido (avgEnergy > 0.7): ratio 1.15, abs 0.90 (más sensible)
    const dynamicRatio = isHighEnergyTrack ? 1.15 : 1.4;
    const dynamicAbsThreshold = isHighEnergyTrack ? 0.90 : 0.75;
    
    // 2. REGLAS DE DETECCIÓN MACROSCÓPICA (PRIORIDAD ALTA)
    
    // �️ WAVE 84.5: HARD COOLDOWN - 10 segundos de paz garantizada
    // Si hubo un drop hace menos de 10 segundos, PROHIBIDO detectar otro.
    // Esto evita la fatiga visual en canciones muy intensas.
    const timeSinceLastDrop = now - this.lastDropEndTime;
    const HARD_COOLDOWN_MS = 10000;  // 10 segundos de paz
    
    // �🚀 DETECCIÓN DE DROP (La Subida Explosiva)
    // 🌴 WAVE 84: Usar umbrales dinámicos en lugar de constantes
    if (ratio > dynamicRatio && this.instantEnergy > dynamicAbsThreshold) {
      if (this.currentSection !== 'drop') {
        // 🛡️ WAVE 84.5: Si estamos en cooldown, redirigir a CHORUS
        if (timeSinceLastDrop < HARD_COOLDOWN_MS) {
          // Energía de Drop pero en cooldown → marcar como CHORUS (energía alta estable)
          this.addVote('chorus', 1.5);
        } else if (!this.isDropCooldown && !this.forceDropExit) {
          // 🔥 WAVE 81: Transición real a DROP (fuera de cooldown)
          this.timeInLowEnergy = 0;
          this.lastFrameTime = now;
          // Votar fuertemente por DROP para que el sistema de votos lo valide
          this.addVote('drop', 2.5);
        }
      }
    }
    
    // 🛡️ DETECCIÓN DE BREAKDOWN (El Silencio)
    // Si la energía cae al suelo (< 0.4) y se queda ahí
    else if (this.avgEnergy < 0.4 && this.instantEnergy < 0.3) {
      const frameTime = this.lastFrameTime > 0 ? now - this.lastFrameTime : 16;
      this.timeInLowEnergy += frameTime;
      
      // Histéresis: esperar 2 segundos de silencio real
      if (this.timeInLowEnergy > 2000) {
        this.addVote('breakdown', 1.5);
      }
    } else {
      this.timeInLowEnergy = 0;
    }
    
    // 📈 DETECCIÓN DE BUILDUP (La Escalada)
    // Si la energía sube constantemente pero no ha explotado aún
    if (this.avgEnergy > 0.4 && delta > 0.05 && this.currentSection !== 'drop') {
      this.addVote('buildup', 0.8);
    }
    
    // 🎵 ALTA ENERGÍA SOSTENIDA = CHORUS (no DROP)
    if (this.avgEnergy > 0.6 && delta < 0.03 && delta > -0.03 && this.currentSection !== 'drop') {
      this.addVote('chorus', 0.6);
    }
    
    // Actualizar timestamp
    this.lastFrameTime = now;
    
    // ═══════════════════════════════════════════════════════════════════════
    // FIN WAVE 81 - Continúa con sistema de votos legacy
    // ═══════════════════════════════════════════════════════════════════════
    
    // WAVE 47.2: Decay de votos (memoria temporal, no reset total)
    const DECAY_FACTOR = 0.85;
    for (const [section, votes] of this.sectionVotes) {
      const decayed = votes * DECAY_FACTOR;
      if (decayed < 0.1) {
        this.sectionVotes.delete(section);
      } else {
        this.sectionVotes.set(section, decayed);
      }
    }
    
    // === REGLAS DE DETECCIÓN CON INTENSIDAD RELATIVA ===
    // intensity > 0.8 = por encima del P75 (energía alta para ESTA canción)
    // intensity < 0.3 = por debajo del P25 (energía baja para ESTA canción)
    
    // Calcular bass relativo también
    const bassRange = this.energyBaseline.p75 - this.energyBaseline.p25;
    const relativeBass = bassRange > 0.05 
      ? (audio.bass - this.energyBaseline.p25) / bassRange 
      : audio.bass;
    
    // 🌊 WAVE 70: DROP timeout y cooldown
    // (now ya está declarado arriba en Energy Delta Model)
    
    // Verificar si estamos en cooldown después de un DROP
    if (this.isDropCooldown) {
      const cooldownElapsed = now - this.lastDropEndTime;
      if (cooldownElapsed >= this.config.dropCooldownTime) {
        this.isDropCooldown = false;
        this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag al terminar cooldown
        // console.log('[SectionTracker] 🌊 DROP cooldown terminado');
      }
    }
    
    // 🌊 WAVE 70.5: NUCLEAR KILL SWITCH - Forzar salida INMEDIATA de DROP si:
    // 1. Duración excede maxDropDuration
    // 2. Energía cae por debajo del umbral
    if (this.currentSection === 'drop') {
      const dropDuration = now - this.dropStartTime;
      const shouldKillDrop = 
        dropDuration >= this.config.maxDropDuration ||
        intensity < this.config.dropEnergyKillThreshold;
      
      if (shouldKillDrop) {
        // 🌊 WAVE 70.5: NUCLEAR - Activar flag inmediatamente
        this.forceDropExit = true;
        this.lastDropEndTime = now;
        this.isDropCooldown = true;
        
        // 🌊 WAVE 70.5: LIMPIAR VOTOS DE DROP INMEDIATAMENTE
        // Evita que el sistema de votación lo reactive al siguiente frame
        this.sectionVotes.set('drop', 0);
        
        // Votar fuertemente por chorus/breakdown para forzar transición
        this.addVote('chorus', 3.0);      // 🌊 WAVE 70.5: Aumentado de 2.0 a 3.0
        this.addVote('breakdown', 2.0);   // 🌊 WAVE 70.5: Aumentado de 1.0 a 2.0
        
        // console.log(`[SectionTracker] 🌊 NUCLEAR DROP KILL: duration=${dropDuration}ms, intensity=${intensity.toFixed(2)}`);
      }
    }
    
    // 🔥 DROP: Intensidad muy por encima de la media + bass pesado + kick
    // 🌊 WAVE 70.5: BLOQUEADO si estamos en cooldown O si nuclear kill está activo
    if (!this.isDropCooldown && !this.forceDropExit) {
      if (intensity > 0.85 && relativeBass > 0.7 && rhythm.drums.kickDetected) {
        this.addVote('drop', 1.0);
      } else if (intensity > 0.75 && rhythm.drums.kickDetected && rhythm.drums.kickIntensity > 0.6) {
        this.addVote('drop', 0.6);
      }
    }
    
    // 📈 BUILDUP: Energía subiendo + zona media-alta
    if (trend === 'rising') {
      if (intensity > 0.4 && intensity < 0.85) {
        this.addVote('buildup', 0.8);
      }
      // Bonus si hay fill de batería
      if (rhythm.fillInProgress) {
        this.addVote('buildup', 0.4);
      }
    }
    
    // 📉 BREAKDOWN: Por debajo de la media + trend descendente
    if (intensity < 0.4 && trend === 'falling') {
      this.addVote('breakdown', 0.7);
    } else if (intensity < 0.3 && !rhythm.drums.kickDetected) {
      // Muy baja energía sin kick = definitivamente breakdown
      this.addVote('breakdown', 0.5);
    }
    
    // 🎤 VERSE: Zona media + estable
    if (intensity >= 0.35 && intensity <= 0.65 && trend === 'stable') {
      this.addVote('verse', 0.5);
    }
    
    // 🎵 CHORUS: Zona alta + estable (post-buildup)
    if (intensity > 0.65 && intensity < 0.85 && trend === 'stable') {
      this.addVote('chorus', 0.6);
    }
    
    // 🎬 INTRO: Baja energía al principio
    if (intensity < 0.35 && this.currentSection === 'unknown') {
      this.addVote('intro', 0.8);
    } else if (intensity < 0.4 && this.sectionHistory.length === 0) {
      this.addVote('intro', 0.5);
    }
    
    // 👋 OUTRO: Baja energía + falling + contexto narrativo
    if (intensity < 0.35 && trend === 'falling') {
      const wasHighEnergy = this.currentSection === 'drop' || this.currentSection === 'chorus';
      if (wasHighEnergy) {
        this.addVote('outro', 0.5);
      }
    }
    
    // WAVE 47.2: Bonus por consistencia con sección actual
    if (this.consecutiveSection > 3) {
      this.addVote(this.currentSection, 0.3);
    }
    
    // Obtener candidato con más votos
    const candidate = this.getMostVotedSection();
    
    // WAVE 47.2: Validar transición con matriz
    return this.validateTransition(candidate);
  }

  /**
   * WAVE 47.2: Validar que la transición sea lógica usando la matriz
   * Solo permite transiciones definidas en SECTION_TRANSITIONS
   */
  private validateTransition(candidate: SectionType): SectionType {
    // Si es la misma sección, siempre válido
    if (candidate === this.currentSection) {
      return candidate;
    }
    
    // Obtener transiciones válidas desde la sección actual
    const validTransitions = SECTION_TRANSITIONS[this.currentSection] || [];
    const isValidTransition = validTransitions.some(t => t.to === candidate);
    
    // Si la transición es válida, aceptarla
    if (isValidTransition) {
      return candidate;
    }
    
    // WAVE 47.2: Transición inválida - buscar camino alternativo
    // Ejemplo: intro → drop es inválido, pero intro → buildup → drop es válido
    // Por ahora, mantener sección actual si la transición no es válida
    
    // Log para debug (en producción se puede quitar)
    // console.log(`[SectionTracker] Blocked invalid transition: ${this.currentSection} → ${candidate}`);
    
    return this.currentSection;
  }

  /**
   * Añadir voto para una sección
   * WAVE 47.2: Ahora es acumulativo
   */
  private addVote(section: SectionType, weight: number): void {
    const current = this.sectionVotes.get(section) || 0;
    this.sectionVotes.set(section, current + weight);
  }

  /**
   * Obtener sección con más votos
   * WAVE 47.2: Requiere umbral mínimo de confianza para cambiar
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
    
    // WAVE 47.2: Calcular confianza del ganador
    const totalVotes = Array.from(this.sectionVotes.values()).reduce((a, b) => a + b, 0);
    const winnerConfidence = totalVotes > 0 ? maxVotes / totalVotes : 0;
    
    // Si el ganador no tiene suficiente confianza, mantener sección actual
    if (winnerConfidence < this.config.transitionConfidenceThreshold) {
      return this.currentSection;
    }
    
    return winner;
  }

  /**
   * Manejar cambio de sección
   * 
   * WAVE 47.2: Sistema de confirmación de frames
   * - No cambia inmediatamente cuando se detecta nueva sección
   * - Requiere N frames consecutivos confirmando la misma sección
   * - Previene flickeo en transiciones ambiguas
   */
  private handleSectionChange(detected: SectionType, now: number): void {
    // Verificar si es diferente a la actual
    if (detected !== this.currentSection) {
      // WAVE 47.2: Sistema de confirmación de transición pendiente
      if (this.pendingTransition === detected) {
        // Misma sección pendiente - incrementar contador
        this.pendingTransitionFrames++;
        
        // Verificar si tenemos suficientes frames de confirmación
        if (this.pendingTransitionFrames >= this.config.transitionConfirmationFrames) {
          // Verificar duración mínima de sección actual
          const duration = now - this.sectionStartTime;
          
          if (duration >= this.config.minSectionDuration || this.currentSection === 'unknown') {
            // WAVE 47.2: Guardar en historial narrativo antes de cambiar
            this.addToSectionHistory(now);
            
            const oldSection = this.currentSection;
            this.currentSection = detected;
            this.sectionStartTime = now;
            this.consecutiveSection = 1;
            
            // 🌊 WAVE 70: Registrar tiempos de DROP
            if (detected === 'drop') {
              this.dropStartTime = now;
              // console.log('[SectionTracker] 🌊 DROP iniciado');
            }
            if (oldSection === 'drop' && detected !== 'drop') {
              this.lastDropEndTime = now;
              this.isDropCooldown = true;
              this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag al salir del DROP
              // console.log('[SectionTracker] 🌊 DROP terminado, entrando en cooldown');
            }
            
            // Reset pendiente
            this.pendingTransition = null;
            this.pendingTransitionFrames = 0;
            
            // Emitir evento de cambio
            this.emit('section-change', {
              from: oldSection,
              to: detected,
              timestamp: now,
            });
          }
        }
      } else {
        // Nueva sección diferente - resetear contador
        this.pendingTransition = detected;
        this.pendingTransitionFrames = 1;
      }
    } else {
      // Sección igual a la actual - resetear pendiente
      this.pendingTransition = null;
      this.pendingTransitionFrames = 0;
      this.consecutiveSection++;
    }
  }

  /**
   * WAVE 47.2: Añadir sección actual al historial narrativo
   */
  private addToSectionHistory(now: number): void {
    const duration = now - this.sectionStartTime;
    
    // Calcular intensidad promedio durante esta sección
    const recentEnergy = this.energyHistory.slice(-10);
    const avgIntensity = recentEnergy.length > 0
      ? recentEnergy.reduce((sum, f) => sum + f.intensity, 0) / recentEnergy.length
      : 0.5;
    
    this.sectionHistory.push({
      section: this.currentSection,
      timestamp: this.sectionStartTime,
      duration,
      avgIntensity,
    });
    
    // Mantener solo las últimas 20 secciones
    while (this.sectionHistory.length > 20) {
      this.sectionHistory.shift();
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
   * WAVE 47.2: Obtener historial de secciones (memoria narrativa)
   */
  getSectionHistory(): SectionHistoryEntry[] {
    return [...this.sectionHistory];
  }

  /**
   * WAVE 47.2: Obtener baseline de energía actual
   */
  getEnergyBaseline(): EnergyBaseline {
    return { ...this.energyBaseline };
  }

  /**
   * Reset del tracker
   * WAVE 47.2: Incluye nuevos campos
   * WAVE 70: Incluye campos de DROP timeout
   */
  reset(): void {
    this.currentSection = 'unknown';
    this.sectionStartTime = 0;
    this.lastAnalysisTime = 0;
    this.cachedAnalysis = null;
    this.energyHistory = [];
    this.sectionVotes.clear();
    this.consecutiveSection = 0;
    
    // WAVE 47.2: Reset nuevos campos
    this.energyBaseline = { p25: 0.3, p50: 0.5, p75: 0.7, min: 0, max: 1, sampleCount: 0 };
    this.allEnergySamples = [];
    this.pendingTransition = null;
    this.pendingTransitionFrames = 0;
    this.sectionHistory = [];
    
    // 🌊 WAVE 70: Reset campos de DROP timeout
    this.dropStartTime = 0;
    this.lastDropEndTime = 0;
    this.isDropCooldown = false;
    this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag
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
