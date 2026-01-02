/**
 * 🌉 TRINITY BRIDGE - Adaptador Wave 8 ↔ Trinity Workers
 * 
 * Convierte entre:
 * - WorkerProtocol types (Trinity)
 * - Musical Engine types (Wave 8)
 * 
 * Este archivo permite que los workers usen los motores de Wave 8
 * sin modificar sus interfaces originales.
 */

import type {
  AudioAnalysis as TrinityAudioAnalysis,
  LightingDecision as TrinityLightingDecision,
  RGBColor as TrinityRGBColor,
  MovementPattern as TrinityMovementPattern,
} from './WorkerProtocol';

// Re-export Trinity types for clarity
export type { TrinityAudioAnalysis, TrinityLightingDecision };

// ============================================
// WAVE 8 TYPE DEFINITIONS (inline to avoid import issues in workers)
// ============================================

/**
 * Audio metrics from main thread (simplified for workers)
 */
export interface AudioMetrics {
  bass: number;        // 0-1
  mid: number;         // 0-1
  treble: number;      // 0-1
  volume: number;      // 0-1
  bpm: number;
  bpmConfidence: number;
  onBeat: boolean;
  beatPhase: number;   // 0-1
  timestamp: number;
  // 🎵 WAVE 15.5: Para Key detection
  dominantFrequency?: number; // Hz
  // 🤖 WAVE 50.1: Texture-based detection para Skrillex/DnB
  subBass?: number;           // 0-1 (20-60Hz sub-woofer range)
  harshness?: number;         // 0-1 (ratio 2-5kHz harsh synths)
  spectralFlatness?: number;  // 0-1 (0=tonal, 1=ruido/noise)
  spectralCentroid?: number;  // Hz (brillo tonal)
}

/**
 * Rhythm Analysis Output (from RhythmAnalyzer)
 */
export interface RhythmOutput {
  pattern: 'four_on_floor' | 'breakbeat' | 'half_time' | 'reggaeton' | 'cumbia' | 'rock_standard' | 'jazz_swing' | 'latin' | 'minimal' | 'unknown';
  syncopation: number;     // 0-1 (CRITICAL for genre detection)
  groove: number;          // 0-1 (feel consistency)
  subdivision: 4 | 8 | 16;
  fillDetected: boolean;
  confidence: number;
  drums: {
    kick: boolean;
    kickIntensity: number;
    snare: boolean;
    snareIntensity: number;
    hihat: boolean;
    hihatIntensity: number;
  };
}

/**
 * Harmony Analysis Output (from HarmonyDetector)
 */
export interface HarmonyOutput {
  key: string | null;           // "C", "D#", etc.
  mode: string;                 // "major", "minor", "dorian", etc.
  mood: 'happy' | 'sad' | 'tense' | 'dreamy' | 'bluesy' | 'jazzy' | 'spanish_exotic' | 'universal';
  temperature: 'warm' | 'cool' | 'neutral';
  dissonance: number;           // 0-1
  chromaticNotes: number[];     // Detected pitch classes (0-11)
  confidence: number;
}

/**
 * Section Analysis Output (from SectionTracker)
 */
export interface SectionOutput {
  type: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'bridge' | 'buildup' | 'outro' | 'unknown';
  energy: number;               // 0-1
  transitionLikelihood: number; // 0-1 (probability of section change)
  beatsSinceChange: number;
  confidence: number;
}

/**
 * Genre Classification Output (from GenreClassifier)
 * 🔧 WAVE 55.1: Extended to include GenreAnalysis fields for senses.ts compatibility
 */
export interface GenreOutput {
  primary: string;              // e.g., "ELECTRONIC_4X4" or "LATINO_TRADICIONAL"
  secondary: string | null;     // Always null in binary system
  confidence: number;
  scores: Record<string, number>;
  // 🔧 WAVE 55.1: GenreAnalysis compatibility fields
  genre?: 'ELECTRONIC_4X4' | 'LATINO_TRADICIONAL';
  subgenre?: 'none';
  features?: {
    bpm: number;
    syncopation: number;
    hasFourOnFloor: boolean;
    hasDembow: boolean;
    trebleDensity: number;
    has808Bass: boolean;
    avgEnergy: number;
  };
  mood?: 'energetic' | 'chill' | 'dark' | 'festive';
}

/**
 * Complete Musical Context (orchestrated output)
 */
export interface MusicalContext {
  timestamp: number;
  frameId: number;
  
  // Raw audio
  audio: AudioMetrics;
  
  // Analyzed layers
  rhythm: RhythmOutput;
  harmony: HarmonyOutput;
  section: SectionOutput;
  genre: GenreOutput;
  
  // Synthesized
  globalEnergy: number;         // 0-1
  globalMood: string;
  operationMode: 'reactive' | 'intelligent';
  combinedConfidence: number;
}

/**
 * Selene Palette (from ProceduralPaletteGenerator)
 */
export interface SelenePalette {
  primary: HSLColor;
  secondary: HSLColor;
  accent: HSLColor;
  ambient: HSLColor;
  contrast: HSLColor;
  metadata: {
    strategy: 'analogous' | 'triadic' | 'complementary';
    transitionSpeed: number;
    confidence: number;
    description: string;
  };
}

export interface HSLColor {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

// ============================================
// CONVERSION FUNCTIONS
// ============================================

/**
 * Convert HSL to Trinity RGB
 * 
 * @deprecated WAVE 17.2 - Reemplazado por SeleneColorEngine.hslToRgb()
 * Esta función permanece SOLO para compatibilidad con createReactiveDecision (modo fallback).
 * Para modo INTELLIGENT, usa SeleneColorEngine.generateRgb() directamente.
 */
export function hslToTrinityRgb(hsl: HSLColor): TrinityRGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
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
    b: Math.round(b * 255)
  };
}

/**
 * Convert Trinity AudioAnalysis to AudioMetrics (for Wave 8 engines)
 */
export function trinityToAudioMetrics(analysis: TrinityAudioAnalysis): AudioMetrics {
  return {
    bass: analysis.bass,
    mid: analysis.mid,
    treble: analysis.treble,
    volume: analysis.energy,
    bpm: analysis.bpm,
    bpmConfidence: analysis.bpmConfidence,
    onBeat: analysis.onBeat,
    beatPhase: analysis.beatPhase,
    timestamp: analysis.timestamp,
  };
}

/**
 * Convert SelenePalette to Trinity LightingDecision palette
 */
export function paletteToTrinity(
  palette: SelenePalette,
  intensity: number
): TrinityLightingDecision['palette'] {
  return {
    primary: hslToTrinityRgb(palette.primary),
    secondary: hslToTrinityRgb(palette.secondary),
    accent: hslToTrinityRgb(palette.accent),
    intensity,
  };
}

/**
 * Map section type to movement pattern
 */
export function sectionToMovement(
  section: SectionOutput,
  energy: number,
  syncopation: number
): TrinityMovementPattern {
  // High energy sections
  if (section.type === 'drop' || section.type === 'chorus') {
    if (syncopation > 0.6) return 'figure8';
    if (energy > 0.8) return 'chase';
    return 'sweep';
  }
  
  // Building sections
  if (section.type === 'buildup') {
    return 'circle';
  }
  
  // Calm sections
  if (section.type === 'breakdown' || section.type === 'bridge') {
    return 'sweep';
  }
  
  // Intro/Outro
  if (section.type === 'intro' || section.type === 'outro') {
    return energy > 0.3 ? 'sweep' : 'static';
  }
  
  // Default based on energy
  if (energy > 0.7) return 'chase';
  if (energy > 0.4) return 'sweep';
  return 'static';
}

/**
 * Create a complete MusicalContext from Trinity AudioAnalysis
 * This is the main bridge function used by GAMMA worker
 */
export function createMusicalContextFromTrinity(
  analysis: TrinityAudioAnalysis,
  rhythm: RhythmOutput,
  harmony: HarmonyOutput,
  section: SectionOutput,
  genre: GenreOutput
): MusicalContext {
  // Calculate combined confidence (REGLA 2)
  // 🔧 WAVE 74: CONFIDENCE CRASH FIX - GenreClassifier fue eliminado (zombie muerto)
  // genre.confidence ahora siempre es 0, así que redistribuimos los pesos
  // ANTES: rhythm=0.35, harmony=0.20, section=0.20, genre=0.25 (máximo=0.75 sin genre)
  // AHORA: rhythm=0.45, harmony=0.30, section=0.25, genre=0 (máximo=1.0)
  const combinedConfidence = 
    rhythm.confidence * 0.45 +
    harmony.confidence * 0.30 +
    section.confidence * 0.25;
    // genre.confidence ya no se usa - GenreClassifier eliminado en WAVE 70+
  
  // Determine operation mode (REGLA 2)
  const operationMode = combinedConfidence >= 0.5 ? 'intelligent' : 'reactive';
  
  // Synthesize global energy
  const globalEnergy = (
    analysis.energy * 0.4 +
    section.energy * 0.3 +
    (analysis.onBeat ? analysis.beatStrength : 0) * 0.3
  );
  
  // Synthesize global mood
  let globalMood: string = harmony.mood;
  if (operationMode === 'reactive') {
    // In reactive mode, simplify mood based on energy
    globalMood = globalEnergy > 0.6 ? 'happy' : 'universal';
  }
  
  return {
    timestamp: analysis.timestamp,
    frameId: analysis.frameId,
    audio: trinityToAudioMetrics(analysis),
    rhythm,
    harmony,
    section,
    genre,
    globalEnergy,
    globalMood,
    operationMode,
    combinedConfidence,
  };
}

/**
 * Create fallback/reactive lighting decision
 * Used when confidence < 0.5 (V17 style direct mapping)
 * 
 * OPERATION PURGE: Now uses procedural palette generation
 * instead of hardcoded colors. Fallback is NEUTRAL procedural,
 * NOT a fixed array.
 */
export function createReactiveDecision(
  analysis: TrinityAudioAnalysis,
  frameId: number
): TrinityLightingDecision {
  // V17 style: Direct audio → light mapping BUT with procedural colors
  
  // === PROCEDURAL FALLBACK ===
  // Derive mood from audio characteristics (no Wave 8 data available)
  const derivedMood = analysis.energy > 0.6 
    ? (analysis.bass > analysis.treble ? 'happy' : 'tense')
    : (analysis.treble > analysis.mid ? 'dreamy' : 'universal');
  
  // Use SimplePaletteGenerator for reactive mode too
  const generator = new SimplePaletteGenerator();
  const palette = generator.generate(
    derivedMood as HarmonyOutput['mood'],
    analysis.energy,
    0, // Zero syncopation (unknown in reactive) - RESCUE DIRECTIVE: NO DEFAULTS
    null // No key detection in reactive mode
  );
  
  // Convert procedural palette to Trinity format
  const primary = hslToTrinityRgb(palette.primary);
  const secondary = hslToTrinityRgb(palette.secondary);
  const accent = hslToTrinityRgb(palette.accent);
  
  return {
    timestamp: Date.now(),
    frameId,
    decisionId: `reactive-${frameId}-${Date.now()}`,
    confidence: 0.3,  // Low confidence = reactive mode
    beautyScore: 0.5, // Neutral beauty
    source: 'fallback',
    palette: {
      primary,
      secondary,
      accent,
      intensity: analysis.energy,
    },
    movement: {
      pattern: 'sweep',
      speed: 0.3 + analysis.bpm / 300,
      range: analysis.bass,
      sync: analysis.bpmConfidence > 0.5 ? 'beat' : 'free',
    },
    effects: {
      strobe: analysis.onBeat && analysis.energy > 0.9,
      strobeRate: analysis.bpm > 140 ? analysis.bpm / 60 : undefined,
      fog: 0,
      laser: analysis.treble > 0.8,
    },
  };
}

// ============================================
// SIMPLIFIED ANALYZERS FOR WORKERS
// ============================================
// Note: These are simplified versions that run in workers.
// The full Wave 8 engines run in main thread with throttling.

/**
 * Simplified rhythm detection for workers
 * 🌊 WAVE 41.1: Agregado EMA para suavizar sincopación
 * 🔧 WAVE 45.1: Confidence mide consistencia real, no solo historial
 */
export class SimpleRhythmDetector {
  private phaseHistory: { phase: number; energy: number }[] = [];
  private readonly historySize = 32;
  
  // 🌊 WAVE 41.1: EMA para sincopación suavizada
  private smoothedSyncopation: number = 0.35; // Default neutral
  private readonly SYNC_ALPHA = 0.08; // Factor de suavizado (lento y estable)
  
  // 🔧 WAVE 45.1: Historial de sync para calcular varianza
  private syncHistory: number[] = [];
  
  analyze(audio: AudioMetrics): RhythmOutput {
    // Track energy at different beat phases
    this.phaseHistory.push({
      phase: audio.beatPhase,
      energy: audio.bass + audio.mid * 0.5,
    });
    
    if (this.phaseHistory.length > this.historySize) {
      this.phaseHistory.shift();
    }
    
    // Calculate syncopation (off-beat energy ratio)
    // 🎯 WAVE 16.5: WIDEN THE NET - Fix "Techno Syncopation Bug"
    // Ventana ampliada a 50% para capturar kicks largos completos
    let onBeatEnergy = 0;
    let offBeatEnergy = 0;
    
    for (const frame of this.phaseHistory) {
      // ANTES: frame.phase < 0.15 || frame.phase > 0.85 (30% ventana)
      // AHORA: frame.phase < 0.25 || frame.phase > 0.75 (50% ventana)
      // RAZÓN: Kicks de Techno duran ~200ms en beat de 500ms = 40% del ciclo
      const isOnBeat = frame.phase < 0.25 || frame.phase > 0.75;
      if (isOnBeat) {
        onBeatEnergy += frame.energy;
      } else {
        offBeatEnergy += frame.energy;
      }
    }
    
    const totalEnergy = onBeatEnergy + offBeatEnergy;
    const instantSync = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;
    
    // 🌊 WAVE 41.1: Aplicar EMA para suavizar sincopación
    // Evita saltos bruscos (0.03 → 1.00) que confunden al GenreClassifier
    this.smoothedSyncopation = (this.SYNC_ALPHA * instantSync) + ((1 - this.SYNC_ALPHA) * this.smoothedSyncopation);
    const syncopation = this.smoothedSyncopation;
    
    // 🔧 WAVE 45.1: Guardar historial de sync para calcular varianza
    this.syncHistory.push(syncopation);
    if (this.syncHistory.length > this.historySize) {
      this.syncHistory.shift();
    }
    
    // 🔧 WAVE 45.1: Calcular confidence basada en CONSISTENCIA real
    const syncVariance = this.calculateVariance(this.syncHistory);
    const rhythmQuality = Math.max(0, 1 - syncVariance * 4); // Varianza alta = baja calidad
    const coverage = Math.min(1, this.phaseHistory.length / this.historySize);
    const realConfidence = Math.min(0.95, coverage * rhythmQuality * 0.85 + 0.1); // Cap 0.95, min 0.10
    
    // Pattern detection (simplified)
    // 🔧 WAVE 45.1: Thresholds realistas basados en logs reales
    let pattern: RhythmOutput['pattern'] = 'unknown';
    if (syncopation < 0.40) pattern = 'four_on_floor';  // Era 0.2 (inalcanzable)
    else if (syncopation > 0.55) pattern = 'breakbeat'; // Era 0.5
    else if (audio.bpm >= 90 && audio.bpm <= 105 && syncopation > 0.25) pattern = 'reggaeton';
    
    return {
      pattern,
      syncopation,
      groove: 1 - Math.abs(syncopation - 0.3) * 2, // Groove peaks at moderate syncopation
      subdivision: audio.bpm > 140 ? 16 : audio.bpm > 100 ? 8 : 4,
      fillDetected: false,
      confidence: realConfidence,  // 🔧 WAVE 45.1: Ahora mide consistencia real
      drums: {
        kick: audio.bass > 0.6,
        kickIntensity: audio.bass,
        snare: audio.mid > 0.5 && audio.onBeat,
        snareIntensity: audio.mid,
        hihat: audio.treble > 0.4,
        hihatIntensity: audio.treble,
      },
    };
  }
  
  // 🔧 WAVE 45.1: Calcular varianza para medir consistencia
  private calculateVariance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(x => (x - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  reset(): void {
    this.phaseHistory = [];
    this.syncHistory = [];  // 🔧 WAVE 45.1
  }
}

/**
 * 🧮 WAVE 15: Harmony detection with dynamic thresholds
 * 
 * Mejorado para trabajar con datos FFT reales.
 * Los umbrales se ajustan según el nivel de energía global.
 * 
 * 🎵 WAVE 15.5: Añadido Key detection basado en frecuencia dominante
 * 🎵 WAVE 15.6: Estabilización de Key/Mood (anti-epilepsia)
 */
/**
 * 🎵 WAVE 16 PRO: SimpleHarmonyDetector con VOTACIÓN PONDERADA POR ENERGÍA
 * 
 * MEJORA PRO #2: Los votos para Key/Mood se ponderan por energía:
 *   peso = energia^1.2
 * 
 * Esto significa que los momentos de alta energía (drops, chorus)
 * tienen 3-4x más influencia que las partes quietas (intros).
 * 
 * RESULTADO: Key y Mood detectados reflejan las partes "importantes"
 * de la canción, no las partes silenciosas.
 */
export class SimpleHarmonyDetector {
  // 🎯 WAVE 16: Votación ponderada por energía
  private moodWeightedVotes: Map<string, number> = new Map();
  private temperatureWeightedVotes: Map<string, number> = new Map();
  
  // Legacy history para fallback
  private moodHistory: string[] = [];
  private temperatureHistory: string[] = [];
  private readonly historySize = 32; // WAVE 15.6: Era 16, ahora 32 (~2 seg) para estabilidad
  
  // Historial de ratios para detección de cambios
  private bassToTrebleHistory: number[] = [];
  private readonly ratioHistorySize = 16; // WAVE 15.6: Era 8, ahora 16
  
  // 🎵 WAVE 15.5: Key detection
  // 🎵 WAVE 15.6: Aumentado historial para estabilidad
  // 🎯 WAVE 16: Ahora con votación ponderada
  // 🔧 WAVE 272: AJUSTADO PARA 10FPS (era calibrado para 30-60fps)
  private noteWeightedVotes: Map<string, number> = new Map();
  private noteHistory: string[] = [];
  private readonly noteHistorySize = 32; // 🔧 WAVE 272: Era 64, ahora 32 (~3 seg @ 10fps)
  private lastDetectedKey: string | null = null;
  private keyStabilityCounter = 0; // WAVE 15.6: Contador de estabilidad
  private readonly keyStabilityThreshold = 15; // 🔧 WAVE 272: Era 90, ahora 15 (~1.5 seg @ 10fps)
  
  // 🎯 WAVE 16: Tracking de energía para ponderación
  private totalWeightAccumulated = 0;
  private readonly WEIGHT_DECAY = 0.997; // Decaimiento exponencial suave
  private readonly ENERGY_POWER = 1.2;   // Exponente para peso: energia^1.2
  
  // Notas musicales ordenadas (A4 = 440Hz como referencia)
  private readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  /**
   * 🎵 Convertir frecuencia a nota musical
   * Usa A4 = 440Hz como referencia
   */
  private frequencyToNote(freq: number): string | null {
    // Ignorar frecuencias muy bajas (sub-bass) o muy altas (ruido)
    if (freq < 65 || freq > 4000) return null;
    
    const A4 = 440;
    // Calcular cuántos semitonos desde A4
    const semitonesFromA4 = 12 * Math.log2(freq / A4);
    // A4 es índice 9 (A), así que calculamos el índice en el array
    const noteIndex = Math.round(semitonesFromA4 + 9) % 12;
    
    return this.NOTE_NAMES[(noteIndex + 12) % 12]; // Handle negative
  }
  
  /**
   * 🎵 Detectar Key basándose en votación ponderada por energía
   * WAVE 16 PRO: Votos ponderados - momentos de alta energía pesan más
   * WAVE 15.6: Lógica de estabilidad anti-epilepsia
   * 🔧 WAVE 272: Ajustado para 10fps (antes era 30-60fps)
   * 🔧 WAVE 272: CORREGIDO BUG - Primera Key nunca se detectaba
   */
  private detectKey(): string | null {
    // 🔧 WAVE 272: Reducido de 16 a 5 frames (~0.5 seg @ 10fps) para empezar a detectar
    if (this.noteHistory.length < 5) return this.lastDetectedKey;
    
    // 🎯 WAVE 16: Usar votos ponderados si hay suficiente peso acumulado
    if (this.totalWeightAccumulated > 1.0) {
      // Encontrar la nota con más peso ponderado
      let dominantNote = '';
      let maxWeight = 0;
      let totalWeight = 0;
      
      for (const [note, weight] of this.noteWeightedVotes) {
        totalWeight += weight;
        if (weight > maxWeight) {
          dominantNote = note;
          maxWeight = weight;
        }
      }
      
      // 🔧 WAVE 272: Threshold reducido de 0.30 a 0.20 para más sensibilidad
      const threshold = 0.20;
      const dominanceRatio = totalWeight > 0 ? maxWeight / totalWeight : 0;
      
      if (totalWeight > 0 && dominanceRatio >= threshold) {
        // 🔧 WAVE 272: FIX CRÍTICO - Si no hay Key previa, aceptar la primera dominante
        if (this.lastDetectedKey === null) {
          this.lastDetectedKey = dominantNote;
          console.log(`[Harmony 🎵] Initial Key: ${dominantNote} (${(dominanceRatio * 100).toFixed(0)}% dominance)`);
          return this.lastDetectedKey;
        }
        
        if (dominantNote !== this.lastDetectedKey) {
          this.keyStabilityCounter++;
          
          // Solo cambiar si ha sido estable por suficientes frames
          if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
            const oldKey = this.lastDetectedKey;
            this.lastDetectedKey = dominantNote;
            this.keyStabilityCounter = 0;
            console.log(`[Harmony 🎵] Key Change: ${oldKey} → ${dominantNote} (${(dominanceRatio * 100).toFixed(0)}% dominance)`);
          }
        } else {
          this.keyStabilityCounter = 0;
        }
        
        return this.lastDetectedKey;
      }
    }
    
    // === FALLBACK: Método original por conteo simple ===
    // Contar ocurrencias de cada nota
    const noteCounts = new Map<string, number>();
    for (const note of this.noteHistory) {
      noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
    }
    
    // Encontrar la nota más común
    let dominantNote = '';
    let maxCount = 0;
    for (const [note, count] of noteCounts) {
      if (count > maxCount) {
        dominantNote = note;
        maxCount = count;
      }
    }
    
    // WAVE 15.6: Lógica de estabilidad anti-epilepsia
    // Solo cambiar Key si la nueva nota dominante es clara (>35%) Y estable
    // 🔧 WAVE 272: Reducido threshold de 0.35 a 0.25 para mejor detección
    const threshold = 0.25;
    
    if (maxCount > this.noteHistory.length * threshold) {
      // 🔧 WAVE 272: FIX CRÍTICO - Si no hay Key previa, aceptar la primera dominante
      if (this.lastDetectedKey === null) {
        this.lastDetectedKey = dominantNote;
        console.log(`[Harmony 🎵] Initial Key (fallback): ${dominantNote} (${(maxCount / this.noteHistory.length * 100).toFixed(0)}%)`);
        return this.lastDetectedKey;
      }
      
      if (dominantNote === this.lastDetectedKey) {
        // Misma nota, resetear contador
        this.keyStabilityCounter = 0;
      } else {
        // Nueva nota candidata
        this.keyStabilityCounter++;
        
        // Solo cambiar si ha sido estable por suficientes frames
        if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
          const oldKey = this.lastDetectedKey;
          this.lastDetectedKey = dominantNote;
          this.keyStabilityCounter = 0;
          console.log(`[Harmony 🎵] Key Change (fallback): ${oldKey} → ${dominantNote}`);
        }
      }
    } else {
      // No hay nota dominante clara, no cambiar
      this.keyStabilityCounter = 0;
    }
    
    return this.lastDetectedKey;
  }
  
  analyze(audio: AudioMetrics): HarmonyOutput {
    // 🧮 WAVE 15: Umbrales dinámicos basados en energía global
    const energyLevel = audio.volume;
    
    // 🎯 WAVE 16 PRO: Calcular peso para votación ponderada
    // peso = energia^1.2 (drops tienen 3-4x más influencia)
    const weight = Math.pow(Math.max(0.01, energyLevel), this.ENERGY_POWER);
    
    // Aplicar decaimiento a votos anteriores (evita que el pasado lejano domine)
    this.applyDecayToVotes();
    this.totalWeightAccumulated = this.totalWeightAccumulated * this.WEIGHT_DECAY + weight;
    
    // Con más energía, los umbrales son más estrictos (la música está clara)
    // Con menos energía, los umbrales son más relajados (evitar defaults constantes)
    const bassThresholdHigh = energyLevel > 0.3 ? 2.0 : 1.4;
    const bassThresholdLow = energyLevel > 0.3 ? 0.5 : 0.7;
    const midThreshold = energyLevel > 0.3 ? 0.6 : 0.4;
    
    const bassToTreble = audio.bass / (audio.treble + 0.001); // Más precisión
    
    // Tracking del ratio para detectar cambios significativos
    this.bassToTrebleHistory.push(bassToTreble);
    if (this.bassToTrebleHistory.length > this.ratioHistorySize) {
      this.bassToTrebleHistory.shift();
    }
    
    // Calcular varianza del ratio (cambio = música dinámica)
    const avgRatio = this.bassToTrebleHistory.reduce((a, b) => a + b, 0) / this.bassToTrebleHistory.length;
    const ratioVariance = this.bassToTrebleHistory.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / this.bassToTrebleHistory.length;
    
    // Determinar mood y temperature
    let mood: HarmonyOutput['mood'];
    let temperature: HarmonyOutput['temperature'];
    
    // 🎭 Lógica de mood mejorada con más estados
    if (bassToTreble > bassThresholdHigh) {
      // Mucho bass, poco treble = oscuro/profundo
      mood = audio.mid > midThreshold ? 'bluesy' : 'sad';
      temperature = 'cool';
    } else if (bassToTreble < bassThresholdLow) {
      // Poco bass, mucho treble = brillante/alegre
      mood = audio.mid > midThreshold ? 'happy' : 'dreamy';
      temperature = 'warm';
    } else if (audio.mid > midThreshold * 1.2) {
      // Medios dominantes = tensión/presencia
      mood = audio.bass > 0.4 ? 'tense' : 'jazzy';
      temperature = 'neutral';
    } else if (audio.treble > 0.5 && audio.bass > 0.5) {
      // Bass y treble altos, mids bajos = "scooped" sound (electrónica)
      mood = 'happy';
      temperature = 'warm';
    } else if (ratioVariance > 0.3) {
      // Alta varianza = música dinámica/exótica
      mood = 'spanish_exotic';
      temperature = 'warm';
    } else {
      // Default: depende de la energía
      mood = energyLevel > 0.5 ? 'happy' : 'universal';
      temperature = energyLevel > 0.5 ? 'warm' : 'neutral';
    }
    
    // 🎯 WAVE 16 PRO: Votación ponderada para Mood y Temperature
    const currentMoodWeight = this.moodWeightedVotes.get(mood) || 0;
    this.moodWeightedVotes.set(mood, currentMoodWeight + weight);
    
    const currentTempWeight = this.temperatureWeightedVotes.get(temperature) || 0;
    this.temperatureWeightedVotes.set(temperature, currentTempWeight + weight);
    
    // Track mood history for stability (legacy fallback)
    this.moodHistory.push(mood);
    if (this.moodHistory.length > this.historySize) {
      this.moodHistory.shift();
    }
    
    this.temperatureHistory.push(temperature);
    if (this.temperatureHistory.length > this.historySize) {
      this.temperatureHistory.shift();
    }
    
    // 🎯 WAVE 16: Usar votos ponderados para dominante (si hay suficiente peso)
    let dominantMood = this.getMostCommon(this.moodHistory) as HarmonyOutput['mood'];
    let dominantTemp = this.getMostCommon(this.temperatureHistory) as HarmonyOutput['temperature'];
    let moodDominance = 0.5; // 🔧 WAVE 45.1: Track dominancia para confidence
    
    if (this.totalWeightAccumulated > 0.5) {
      const moodResult = this.getWeightedDominantWithDominance(this.moodWeightedVotes, 'universal');
      dominantMood = moodResult.winner as HarmonyOutput['mood'];
      moodDominance = moodResult.dominance;
      dominantTemp = this.getWeightedDominant(this.temperatureWeightedVotes, 'neutral') as HarmonyOutput['temperature'];
    }
    
    // 🎵 WAVE 15.5 + WAVE 16: Key detection con votación ponderada
    // 🔧 WAVE 272: Debugging verboso para diagnóstico
    if (audio.dominantFrequency && audio.dominantFrequency > 0) {
      const note = this.frequencyToNote(audio.dominantFrequency);
      if (note) {
        // 🎯 WAVE 16: Votación ponderada para Key
        const currentNoteWeight = this.noteWeightedVotes.get(note) || 0;
        this.noteWeightedVotes.set(note, currentNoteWeight + weight);
        
        this.noteHistory.push(note);
        if (this.noteHistory.length > this.noteHistorySize) {
          this.noteHistory.shift();
        }
      } else {
        // 📝 WAVE 272: La frecuencia está fuera de rango (<65Hz o >4000Hz)
        // Log cada ~60 frames para no spamear
        if (Math.random() < 0.02) {
          console.log(`[Harmony ⚠️] Freq ${audio.dominantFrequency.toFixed(0)}Hz fuera de rango musical`);
        }
      }
    }
    const detectedKey = this.detectKey();
    
    // Determinar mode basándose en mood (heurística)
    const mode: HarmonyOutput['mode'] = 
      (dominantMood === 'sad' || dominantMood === 'bluesy' || dominantMood === 'tense') 
        ? 'minor' 
        : (dominantMood === 'happy' || dominantMood === 'dreamy') 
          ? 'major' 
          : 'unknown';
    
    // 🔧 WAVE 45.1: Confidence basada en dominancia real, no solo historial
    const coverage = Math.min(1, this.moodHistory.length / this.historySize);
    const realConfidence = Math.min(0.95, coverage * moodDominance * 0.9 + 0.05); // Cap 0.95, min 0.05
    
    return {
      key: detectedKey,  // 🎵 WAVE 15.5: Ahora detecta Key real
      mode: mode,
      mood: dominantMood,
      temperature: dominantTemp,
      dissonance: Math.min(1, ratioVariance), // Usar varianza como proxy de disonancia
      chromaticNotes: [],
      confidence: realConfidence,  // 🔧 WAVE 45.1: Ahora mide dominancia real
    };
  }
  
  /**
   * 🎯 WAVE 16: Aplica decaimiento exponencial a todos los votos ponderados
   * Esto evita que el pasado lejano domine la votación
   */
  private applyDecayToVotes(): void {
    for (const [key, value] of this.moodWeightedVotes) {
      this.moodWeightedVotes.set(key, value * this.WEIGHT_DECAY);
    }
    for (const [key, value] of this.temperatureWeightedVotes) {
      this.temperatureWeightedVotes.set(key, value * this.WEIGHT_DECAY);
    }
    for (const [key, value] of this.noteWeightedVotes) {
      this.noteWeightedVotes.set(key, value * this.WEIGHT_DECAY);
    }
  }
  
  /**
   * 🎯 WAVE 16: Obtiene el valor con mayor peso acumulado
   */
  private getWeightedDominant(votes: Map<string, number>, defaultValue: string): string {
    return this.getWeightedDominantWithDominance(votes, defaultValue).winner;
  }
  
  // 🔧 WAVE 45.1: Versión que también devuelve dominancia para confidence real
  private getWeightedDominantWithDominance(votes: Map<string, number>, defaultValue: string): { winner: string; dominance: number } {
    let maxKey = defaultValue;
    let maxWeight = 0;
    let totalWeight = 0;
    
    for (const [key, weight] of votes) {
      totalWeight += weight;
      if (weight > maxWeight) {
        maxKey = key;
        maxWeight = weight;
      }
    }
    
    // Dominancia = qué tan dominante es el ganador (0.0 a 1.0)
    const dominance = totalWeight > 0 ? maxWeight / totalWeight : 0.5;
    return { winner: maxKey, dominance };
  }
  
  private getMostCommon(arr: string[]): string {
    const counts = new Map<string, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    let maxItem = arr[arr.length - 1] || 'universal';
    let maxCount = 0;
    
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxItem = item;
        maxCount = count;
      }
    }
    
    return maxItem;
  }
  
  reset(): void {
    this.moodHistory = [];
    this.temperatureHistory = [];
    this.bassToTrebleHistory = [];
    this.noteHistory = [];
    this.lastDetectedKey = null;
    this.keyStabilityCounter = 0; // WAVE 15.6
    
    // 🎯 WAVE 16: Limpiar votos ponderados
    this.moodWeightedVotes.clear();
    this.temperatureWeightedVotes.clear();
    this.noteWeightedVotes.clear();
    this.totalWeightAccumulated = 0;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 WAVE 289.5: VibeSectionTracker - VIBE-AWARE SECTION DETECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * El SimpleSectionTracker era ciego al género. Usaba constantes mágicas
 * que funcionaban bien para Techno (bassRatio > 1.35, energy > 0.75)
 * pero causaban falsos DROPs eternos en Latino donde la percusión siempre está alta.
 * 
 * SOLUCIÓN: Cada Vibe tiene su propio perfil de detección.
 * - TECHNO: Drops largos (30s), bass es rey, buildups obligatorios
 * - LATINO: Drops cortos (12s), mid-bass manda, transiciones libres, cooldowns
 * - ROCK: Estructura verso-estribillo, mid frequencies dominan
 * - CHILL: Casi sin drops, todo fluye suave
 * 
 * CAMBIOS CRÍTICOS vs SimpleSectionTracker:
 * 1. DROP tiene cooldown (no puede re-entrar inmediatamente)
 * 2. DROP tiene kill switch por energía (si baja, sale)
 * 3. DROP tiene duración máxima (no eternos)
 * 4. Umbrales adaptativos por vibe
 * 
 * "EL TRACKER DEBE SENTIR LA MÚSICA, NO MEDIRLA" - WAVE 289
 * 
 * @authors PunkOpus, Radwulf
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎛️ PERFILES VIBE-AWARE (copiados de VibeSectionProfiles.ts para Workers)
// ═══════════════════════════════════════════════════════════════════════════

interface VibeSectionProfile {
  dropEnergyRatio: number;
  maxDropDuration: number;
  dropAbsoluteThreshold: number;
  dropCooldown: number;
  dropEnergyKillThreshold: number;
  buildupDeltaThreshold: number;
  breakdownEnergyThreshold: number;
  frequencyWeights: {
    bass: number;
    midBass: number;
    mid: number;
    treble: number;
  };
}

const VIBE_PROFILES: Record<string, VibeSectionProfile> = {
  'techno': {
    dropEnergyRatio: 1.40,
    maxDropDuration: 30000,
    dropAbsoluteThreshold: 0.75,
    dropCooldown: 15000,
    dropEnergyKillThreshold: 0.55,
    buildupDeltaThreshold: 0.03,
    breakdownEnergyThreshold: 0.35,
    frequencyWeights: { bass: 0.50, midBass: 0.25, mid: 0.15, treble: 0.10 },
  },
  'latino': {
    dropEnergyRatio: 1.20,
    maxDropDuration: 12000,
    dropAbsoluteThreshold: 0.70,
    dropCooldown: 6000,
    dropEnergyKillThreshold: 0.50,
    buildupDeltaThreshold: 0.05,
    breakdownEnergyThreshold: 0.45,
    frequencyWeights: { bass: 0.30, midBass: 0.40, mid: 0.20, treble: 0.10 },
  },
  'fiesta-latina': {
    dropEnergyRatio: 1.20,
    maxDropDuration: 12000,
    dropAbsoluteThreshold: 0.70,
    dropCooldown: 6000,
    dropEnergyKillThreshold: 0.50,
    buildupDeltaThreshold: 0.05,
    breakdownEnergyThreshold: 0.45,
    frequencyWeights: { bass: 0.30, midBass: 0.40, mid: 0.20, treble: 0.10 },
  },
  'rock': {
    dropEnergyRatio: 1.50,
    maxDropDuration: 8000,
    dropAbsoluteThreshold: 0.80,
    dropCooldown: 20000,
    dropEnergyKillThreshold: 0.60,
    buildupDeltaThreshold: 0.04,
    breakdownEnergyThreshold: 0.40,
    frequencyWeights: { bass: 0.20, midBass: 0.25, mid: 0.40, treble: 0.15 },
  },
  'chill': {
    dropEnergyRatio: 2.00,
    maxDropDuration: 5000,
    dropAbsoluteThreshold: 0.85,
    dropCooldown: 30000,
    dropEnergyKillThreshold: 0.70,
    buildupDeltaThreshold: 0.02,
    breakdownEnergyThreshold: 0.50,
    frequencyWeights: { bass: 0.25, midBass: 0.25, mid: 0.25, treble: 0.25 },
  },
};

// Default profile (techno-compatible for backwards compatibility)
const DEFAULT_PROFILE: VibeSectionProfile = VIBE_PROFILES['techno'];

export class SimpleSectionTracker {
  private energyHistory: number[] = [];
  private bassHistory: number[] = [];
  private currentSection: SectionOutput['type'] = 'verse';
  private beatsSinceChange = 0;
  private readonly historySize = 64;
  
  // 🎯 WAVE 289.5: Estado temporal para DROP management
  private dropStartTime: number = 0;
  private lastDropEndTime: number = 0;
  private frameCount: number = 0;
  
  // 🎯 WAVE 289.5: Vibe profile
  private activeVibeId: string = 'techno';
  private profile: VibeSectionProfile = DEFAULT_PROFILE;
  
  /**
   * 🎯 WAVE 289.5: Cambiar el vibe activo
   * Llamado cuando TrinityOrchestrator propaga SET_VIBE a BETA
   */
  setVibe(vibeId: string): void {
    this.activeVibeId = vibeId;
    this.profile = VIBE_PROFILES[vibeId] || DEFAULT_PROFILE;
    console.log(`[SimpleSectionTracker] 🎯 WAVE 289.5: Vibe → ${vibeId} | DropThreshold: ${this.profile.dropAbsoluteThreshold} | Cooldown: ${this.profile.dropCooldown}ms`);
  }
  
  analyze(audio: AudioMetrics, rhythm: RhythmOutput): SectionOutput {
    this.frameCount++;
    const now = Date.now();
    const p = this.profile;
    
    // Acumular historial
    this.energyHistory.push(audio.volume);
    this.bassHistory.push(audio.bass);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
      this.bassHistory.shift();
    }
    
    if (audio.onBeat) {
      this.beatsSinceChange++;
    }
    
    // === MÉTRICAS CLAVE ===
    const hasKick = rhythm.drums?.kick && rhythm.drums.kickIntensity > 0.5;
    
    // 🎯 WAVE 289.5: Calcular energía PONDERADA por perfil
    const weightedEnergy = 
      (audio.bass * p.frequencyWeights.bass) +
      ((audio.bass + audio.mid) * 0.5 * p.frequencyWeights.midBass) +
      (audio.mid * p.frequencyWeights.mid) +
      (audio.treble * p.frequencyWeights.treble);
    
    // Promedios recientes vs históricos
    const recentEnergy = this.avg(this.energyHistory.slice(-16));
    const olderEnergy = this.avg(this.energyHistory.slice(0, 32));
    const recentBass = this.avg(this.bassHistory.slice(-16));
    const olderBass = this.avg(this.bassHistory.slice(0, 32)) || 0.1;
    
    const bassRatio = recentBass / olderBass;
    const energyDelta = recentEnergy - olderEnergy;
    
    // === DECISIÓN DE SECCIÓN CON PERFILES VIBE-AWARE ===
    let newSection = this.currentSection;
    
    // 🎯 WAVE 289.5: DROP con cooldown, duración máxima y kill switch
    const inCooldown = (now - this.lastDropEndTime) < p.dropCooldown;
    const dropDuration = this.currentSection === 'drop' ? (now - this.dropStartTime) : 0;
    const dropExpired = dropDuration > p.maxDropDuration;
    const energyKillSwitch = weightedEnergy < p.dropEnergyKillThreshold;
    
    if (this.currentSection === 'drop') {
      // ¿Deberíamos SALIR del drop?
      if (dropExpired || energyKillSwitch) {
        newSection = 'verse';
        this.lastDropEndTime = now;
        this.beatsSinceChange = 0;
        if (this.frameCount % 60 === 0 || dropExpired || energyKillSwitch) {
          console.log(`[SimpleSectionTracker] 🔴 DROP EXIT | expired=${dropExpired} | killSwitch=${energyKillSwitch} | duration=${dropDuration}ms | energy=${weightedEnergy.toFixed(2)}`);
        }
      }
    } else {
      // ¿Deberíamos ENTRAR en drop?
      if (!inCooldown && bassRatio > p.dropEnergyRatio && hasKick && weightedEnergy > p.dropAbsoluteThreshold) {
        newSection = 'drop';
        this.dropStartTime = now;
        this.beatsSinceChange = 0;
        console.log(`[SimpleSectionTracker] 🔴 DROP ENTER | vibe=${this.activeVibeId} | bassRatio=${bassRatio.toFixed(2)} | energy=${weightedEnergy.toFixed(2)}`);
      }
      // BUILDUP: Energía subiendo
      else if (energyDelta > p.buildupDeltaThreshold && weightedEnergy > 0.4 && bassRatio < 1.15) {
        newSection = 'buildup';
      }
      // BREAKDOWN: Caída de energía
      else if (energyDelta < -0.20 && weightedEnergy < p.breakdownEnergyThreshold) {
        newSection = 'breakdown';
        this.beatsSinceChange = 0;
      }
      // VERSE: Estado neutral después de 90 frames
      else if (this.beatsSinceChange > 90) {
        newSection = 'verse';
      }
    }
    
    this.currentSection = newSection;
    
    const transitionLikelihood = Math.min(1, 
      Math.abs(energyDelta) * 2 + 
      (rhythm.fillDetected ? 0.4 : 0) +
      (bassRatio > 1.1 && !hasKick ? 0.3 : 0)
    );
    
    return {
      type: this.currentSection,
      energy: recentEnergy,
      transitionLikelihood,
      beatsSinceChange: this.beatsSinceChange,
      confidence: Math.min(1, this.energyHistory.length / 32),
    };
  }
  
  private avg(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  
  reset(): void {
    this.energyHistory = [];
    this.bassHistory = [];
    this.currentSection = 'verse';
    this.beatsSinceChange = 0;
    this.dropStartTime = 0;
    this.lastDropEndTime = 0;
  }
}

// �️ WAVE 61: SimpleBinaryBias ELIMINADO
// La detección automática de género fue reemplazada por VibeManager.
// El DJ selecciona el contexto manualmente. Selene opera dentro de ese contexto.

/**
 * Simplified palette generator for workers
 * 🌊 WAVE 12.5: SELENE LIBRE - Colores de matemática pura
 * La música HABLA a través de sus números, no de etiquetas.
 * 
 * @deprecated WAVE 17.2 - Reemplazado por SeleneColorEngine
 * Esta clase permanece SOLO para compatibilidad con createReactiveDecision (modo fallback).
 * Para modo INTELLIGENT, usa SeleneColorEngine directamente.
 */
export class SimplePaletteGenerator {
  /**
   * Circle of Fifths → Chromatic Circle mapping
   * C=0° (Red), G=210°, D=60°, etc.
   */
  private static readonly KEY_TO_HUE: Record<string, number> = {
    'C': 0, 'G': 210, 'D': 60, 'A': 270, 'E': 120,
    'B': 330, 'F#': 180, 'Db': 30, 'Ab': 240, 'Eb': 90,
    'Bb': 300, 'F': 150,
  };
  
  /**
   * 🌊 WAVE 12.5: UI_PALETTE_MAP mantenido solo para cuando el USUARIO
   * elige manualmente una paleta. Selene ya no fuerza paletas por género.
   */
  private static readonly UI_PALETTE_MAP: Record<string, {
    primaryHue: number,    // PARs
    accentHue: number,     // Moving Heads (CONTRASTE)
    secondaryHue: number,
  }> = {
    'fuego': { primaryHue: 10, accentHue: 52, secondaryHue: 0 },
    'selva': { primaryHue: 120, accentHue: 320, secondaryHue: 90 },
    'hielo': { primaryHue: 210, accentHue: 185, secondaryHue: 240 },
    'neon': { primaryHue: 300, accentHue: 180, secondaryHue: 330 },
  };
  
  generate(
    mood: HarmonyOutput['mood'],
    energy: number,
    syncopation: number,
    key: string | null,
    uiPalette?: string  // Solo si el USUARIO elige manualmente
  ): SelenePalette {
    // 🎯 MAPEO DIRECTO SOLO SI EL USUARIO ELIGIÓ MANUALMENTE
    const uiMap = uiPalette ? SimplePaletteGenerator.UI_PALETTE_MAP[uiPalette.toLowerCase()] : null;
    
    let baseHue: number;
    let accentHue: number;
    let secondaryHue: number;
    
    if (uiMap) {
      // PALETA MANUAL: El usuario eligió una paleta específica
      baseHue = uiMap.primaryHue;
      accentHue = uiMap.accentHue;
      secondaryHue = uiMap.secondaryHue;
    } else if (key && SimplePaletteGenerator.KEY_TO_HUE[key] !== undefined) {
      // 🌊 WAVE 12.5: COLOR DESDE LA ARMONÍA (Key musical)
      // La tonalidad de la música determina el tono base
      baseHue = SimplePaletteGenerator.KEY_TO_HUE[key];
      
      // 🌊 SYNCOPATION modula el contraste del accent
      // Alta syncopation (latino) → Colores complementarios (máximo contraste)
      // Baja syncopation (electrónico) → Colores análogos (menor contraste)
      const contrastAngle = 90 + syncopation * 90;  // 90° a 180° según syncopation
      accentHue = (baseHue + contrastAngle) % 360;
      secondaryHue = (baseHue + 30 + syncopation * 30) % 360;
    } else {
      // 🌊 WAVE 12.5: Mood-based hue con MODULACIÓN por syncopation
      const moodHues: Record<string, number> = {
        happy: 45,      // Orange
        sad: 220,       // Blue
        tense: 0,       // Red
        dreamy: 280,    // Purple
        bluesy: 30,     // Warm orange
        jazzy: 260,     // Purple-blue
        spanish_exotic: 15, // Red-orange
        universal: 120, // Green
      };
      baseHue = moodHues[mood] ?? 120;
      
      // Syncopation modula hacia dónde va el accent
      const contrastAngle = 90 + syncopation * 90;
      accentHue = (baseHue + contrastAngle) % 360;
      secondaryHue = (baseHue + 30 + syncopation * 30) % 360;
    }
    
    // Strategy based on energy
    const strategy: SelenePalette['metadata']['strategy'] = 
      energy > 0.7 ? 'complementary' :
      energy > 0.4 ? 'triadic' :
      'analogous';
    
    // 🌊 WAVE 12.5: ENERGY → SATURACIÓN (más energía = más saturado)
    // 🌊 WAVE 12.5: SYNCOPATION → LIGHTNESS VARIATION (más sync = más contraste)
    const MIN_SATURATION = 70;
    const MIN_LIGHTNESS = 45;
    
    // Energy impulsa la saturación: E=0.3 → S=85%, E=0.9 → S=100%
    const baseSaturation = Math.max(MIN_SATURATION, 70 + energy * 30);
    
    // Energy también impulsa la luz: E=0.3 → L=50%, E=0.9 → L=70%
    const baseLightness = Math.max(MIN_LIGHTNESS, 45 + energy * 25);
    
    // PRIMARY (PARs) - Color base vibrante modulado por ENERGY
    const primary: HSLColor = { 
      h: baseHue, 
      s: baseSaturation, 
      l: baseLightness 
    };
    
    // SECONDARY - Variación del primary
    const secondary: HSLColor = { 
      h: secondaryHue, 
      s: Math.max(MIN_SATURATION, baseSaturation - 5), 
      l: Math.max(MIN_LIGHTNESS, baseLightness - 5) 
    };
    
    // � ACCENT (Moving Heads) - SYNCOPATION controla el contraste
    // Alta syncopation = accent MÁS brillante y saturado
    const accentBoost = 15 + syncopation * 15;  // 15-30% boost según syncopation
    const accent: HSLColor = { 
      h: accentHue, 
      s: 100,  // Siempre saturación máxima
      l: Math.max(55, baseLightness + accentBoost)
    };
    
    const ambient: HSLColor = { 
      h: baseHue, 
      s: Math.max(60, baseSaturation * 0.7), 
      l: Math.max(40, baseLightness * 0.8) 
    };
    
    const contrast: HSLColor = { 
      h: (baseHue + 180) % 360, 
      s: 40, 
      l: 75 
    };
    
    // 🌊 WAVE 12.5: Description muestra la matemática pura
    const mathDescription = `E:${energy.toFixed(2)} S:${syncopation.toFixed(2)} K:${key ?? mood}`;
    
    return {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      metadata: {
        strategy,
        transitionSpeed: energy > 0.7 ? 100 : 300,
        confidence: 0.8,
        description: uiPalette ? `UI:${uiPalette}` : mathDescription,
      },
    };
  }
}
