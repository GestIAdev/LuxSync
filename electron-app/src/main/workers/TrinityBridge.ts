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
 */
export interface GenreOutput {
  primary: string;              // e.g., "reggaeton"
  secondary: string | null;     // e.g., "latin_pop"
  confidence: number;
  scores: Record<string, number>;
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
  const combinedConfidence = 
    rhythm.confidence * 0.35 +
    harmony.confidence * 0.20 +
    section.confidence * 0.20 +
    genre.confidence * 0.25;
  
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
 */
export class SimpleRhythmDetector {
  private phaseHistory: { phase: number; energy: number }[] = [];
  private readonly historySize = 32;
  
  // 🌊 WAVE 41.1: EMA para sincopación suavizada
  private smoothedSyncopation: number = 0.35; // Default neutral
  private readonly SYNC_ALPHA = 0.08; // Factor de suavizado (lento y estable)
  
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
    
    // Pattern detection (simplified)
    // 🎯 WAVE 16.5: Umbrales ajustados para ventana 50%
    let pattern: RhythmOutput['pattern'] = 'unknown';
    if (syncopation < 0.2) pattern = 'four_on_floor';
    else if (syncopation > 0.5) pattern = 'breakbeat'; // Era 0.6, ahora 0.5
    else if (audio.bpm >= 90 && audio.bpm <= 105 && syncopation > 0.25) pattern = 'reggaeton'; // Era 0.3, ahora 0.25
    
    return {
      pattern,
      syncopation,
      groove: 1 - Math.abs(syncopation - 0.3) * 2, // Groove peaks at moderate syncopation
      subdivision: audio.bpm > 140 ? 16 : audio.bpm > 100 ? 8 : 4,
      fillDetected: false,
      confidence: Math.min(1, this.phaseHistory.length / this.historySize),
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
  
  reset(): void {
    this.phaseHistory = [];
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
  private noteWeightedVotes: Map<string, number> = new Map();
  private noteHistory: string[] = [];
  private readonly noteHistorySize = 64; // WAVE 15.6: Era 32, ahora 64 (~4 segundos)
  private lastDetectedKey: string | null = null;
  private keyStabilityCounter = 0; // WAVE 15.6: Contador de estabilidad
  private readonly keyStabilityThreshold = 8; // Necesita 8 frames consecutivos para cambiar
  
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
   */
  private detectKey(): string | null {
    if (this.noteHistory.length < 16) return this.lastDetectedKey; // WAVE 15.6: Era 8, ahora 16
    
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
      
      // Threshold: nota dominante debe tener >30% del peso total
      const threshold = 0.30;
      if (totalWeight > 0 && maxWeight > totalWeight * threshold) {
        if (dominantNote !== this.lastDetectedKey) {
          this.keyStabilityCounter++;
          
          // Solo cambiar si ha sido estable por suficientes frames
          if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
            this.lastDetectedKey = dominantNote;
            this.keyStabilityCounter = 0;
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
    const threshold = 0.35; // WAVE 15.6: Era 0.25, ahora 0.35
    
    if (maxCount > this.noteHistory.length * threshold) {
      if (dominantNote === this.lastDetectedKey) {
        // Misma nota, resetear contador
        this.keyStabilityCounter = 0;
      } else {
        // Nueva nota candidata
        this.keyStabilityCounter++;
        
        // Solo cambiar si ha sido estable por suficientes frames
        if (this.keyStabilityCounter >= this.keyStabilityThreshold) {
          this.lastDetectedKey = dominantNote;
          this.keyStabilityCounter = 0;
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
    
    if (this.totalWeightAccumulated > 0.5) {
      dominantMood = this.getWeightedDominant(this.moodWeightedVotes, 'universal') as HarmonyOutput['mood'];
      dominantTemp = this.getWeightedDominant(this.temperatureWeightedVotes, 'neutral') as HarmonyOutput['temperature'];
    }
    
    // 🎵 WAVE 15.5 + WAVE 16: Key detection con votación ponderada
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
    
    return {
      key: detectedKey,  // 🎵 WAVE 15.5: Ahora detecta Key real
      mode: mode,
      mood: dominantMood,
      temperature: dominantTemp,
      dissonance: Math.min(1, ratioVariance), // Usar varianza como proxy de disonancia
      chromaticNotes: [],
      confidence: Math.min(1, (this.moodHistory.length / this.historySize) * (energyLevel + 0.3)),
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
    let maxKey = defaultValue;
    let maxWeight = 0;
    
    for (const [key, weight] of votes) {
      if (weight > maxWeight) {
        maxKey = key;
        maxWeight = weight;
      }
    }
    
    return maxKey;
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
 * Simplified section tracker for workers
 */
export class SimpleSectionTracker {
  private energyHistory: number[] = [];
  private currentSection: SectionOutput['type'] = 'unknown';
  private beatsSinceChange = 0;
  private readonly historySize = 64;
  
  analyze(audio: AudioMetrics, rhythm: RhythmOutput): SectionOutput {
    this.energyHistory.push(audio.volume);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }
    
    if (audio.onBeat) {
      this.beatsSinceChange++;
    }
    
    // Calculate current and recent energy
    const currentEnergy = audio.volume;
    const recentEnergy = this.energyHistory.slice(-16).reduce((a, b) => a + b, 0) / 16;
    const olderEnergy = this.energyHistory.slice(0, 16).reduce((a, b) => a + b, 0) / Math.max(16, this.energyHistory.length);
    
    // Detect section changes
    const energyDelta = recentEnergy - olderEnergy;
    let newSection = this.currentSection;
    
    if (energyDelta > 0.3 && currentEnergy > 0.7) {
      newSection = 'drop';
      this.beatsSinceChange = 0;
    } else if (energyDelta > 0.15 && currentEnergy > 0.5) {
      newSection = 'buildup';
    } else if (energyDelta < -0.3) {
      newSection = 'breakdown';
      this.beatsSinceChange = 0;
    } else if (currentEnergy < 0.3) {
      newSection = this.beatsSinceChange < 32 ? 'intro' : 'outro';
    } else if (rhythm.fillDetected) {
      // After a fill, likely transitioning
      newSection = 'verse';
    }
    
    this.currentSection = newSection;
    
    // Transition likelihood
    const transitionLikelihood = Math.min(1, Math.abs(energyDelta) * 2 + (rhythm.fillDetected ? 0.3 : 0));
    
    return {
      type: this.currentSection,
      energy: recentEnergy,
      transitionLikelihood,
      beatsSinceChange: this.beatsSinceChange,
      confidence: Math.min(1, this.energyHistory.length / 32),
    };
  }
  
  reset(): void {
    this.energyHistory = [];
    this.currentSection = 'unknown';
    this.beatsSinceChange = 0;
  }
}

/**
 * Simplified genre classifier for workers
 * 🔥 WAVE 12.2: HISTÉRESIS + REGLA DE HIERRO
 * 🎯 WAVE 16.5: WIDEN THE NET - Umbrales ajustados
 * - Sync < 0.30 = ELECTRÓNICO (robótico)
 * - Sync > 0.30 = LATINO (con swing)
 * - HISTÉRESIS: Mantener género estable mínimo 2 segundos
 */
export class SimpleGenreClassifier {
  private scoreHistory: Map<string, number[]> = new Map();
  private readonly historySize = 20;
  private lastLogFrame = 0;
  private frameCount = 0;
  
  // 🔥 WAVE 12.2: HISTÉRESIS
  private currentStableGenre: string = 'unknown';
  private genreVotes: string[] = [];
  private readonly VOTE_THRESHOLD = 5;  // Necesita 5 votos para cambiar
  private lastGenreChangeFrame = 0;
  private readonly MIN_FRAMES_BETWEEN_CHANGES = 120;  // ~2 segundos a 60fps
  
  classify(rhythm: RhythmOutput, audio: AudioMetrics): GenreOutput {
    this.frameCount++;
    
    const scores: Record<string, number> = {
      edm: 0,
      house: 0,
      techno: 0,
      cyberpunk: 0,
      reggaeton: 0,
      cumbia: 0,
      latin_pop: 0,
      hip_hop: 0,
      rock: 0,
      pop: 0,
      unknown: 0.1,
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 12.1: REGLA DE HIERRO BIDIRECCIONAL
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 🤖 CAMINO ELECTRÓNICO: Sync < 0.30 = robótico
    if (rhythm.syncopation < 0.30) {
      if (audio.bpm >= 85 && audio.bpm <= 130) {
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[SimpleGenreClassifier] 🤖 REGLA DE HIERRO: Sync=${rhythm.syncopation.toFixed(2)} < 0.30 → CYBERPUNK`);
          this.lastLogFrame = this.frameCount;
        }
        return {
          primary: 'cyberpunk',
          secondary: 'techno',
          confidence: 0.85,
          scores: { ...scores, cyberpunk: 0.85, techno: 0.5 },
        };
      } else if (audio.bpm > 130) {
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[SimpleGenreClassifier] 🤖 REGLA DE HIERRO: Sync=${rhythm.syncopation.toFixed(2)} < 0.30, BPM=${audio.bpm.toFixed(0)} → TECHNO`);
          this.lastLogFrame = this.frameCount;
        }
        return {
          primary: 'techno',
          secondary: 'house',
          confidence: 0.85,
          scores: { ...scores, techno: 0.85, house: 0.5 },
        };
      }
    }
    
    // 💃 CAMINO LATINO: Sync > 0.30 = tiene swing
    // 🎯 WAVE 16.5: Umbral bajado de 0.35 a 0.30 por ventana ampliada
    if (rhythm.syncopation > 0.30 && audio.bpm >= 85 && audio.bpm <= 125) {
      // Treble > 0.15 = güiro presente → CUMBIA
      if (audio.treble > 0.15) {
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[SimpleGenreClassifier] 🪘 REGLA DE HIERRO: Sync=${rhythm.syncopation.toFixed(2)} > 0.30, Treble=${audio.treble.toFixed(2)} > 0.15 → CUMBIA`);
          this.lastLogFrame = this.frameCount;
        }
        return {
          primary: 'cumbia',
          secondary: 'reggaeton',
          confidence: 0.90,
          scores: { ...scores, cumbia: 0.90, reggaeton: 0.5 },
        };
      } else if (rhythm.pattern === 'reggaeton') {
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[SimpleGenreClassifier] 🎤 REGLA DE HIERRO: Sync=${rhythm.syncopation.toFixed(2)} > 0.30, Dembow=true → REGGAETON`);
          this.lastLogFrame = this.frameCount;
        }
        return {
          primary: 'reggaeton',
          secondary: 'cumbia',
          confidence: 0.85,
          scores: { ...scores, reggaeton: 0.85, cumbia: 0.5 },
        };
      } else {
        // Swing pero sin güiro ni dembow → LATIN_POP
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[SimpleGenreClassifier] 🎵 REGLA DE HIERRO: Sync=${rhythm.syncopation.toFixed(2)} > 0.30 → LATIN_POP`);
          this.lastLogFrame = this.frameCount;
        }
        return {
          primary: 'latin_pop',
          secondary: 'cumbia',
          confidence: 0.70,
          scores: { ...scores, latin_pop: 0.70, cumbia: 0.4 },
        };
      }
    }
    
    // === FALLBACK: Score-based para casos intermedios ===
    
    // BPM-based scoring
    if (audio.bpm >= 120 && audio.bpm <= 130) {
      scores.house += 0.3;
      scores.techno += 0.2;
    }
    if (audio.bpm >= 90 && audio.bpm <= 105) {
      scores.reggaeton += 0.4;
      scores.cumbia += 0.3;
    }
    if (audio.bpm >= 70 && audio.bpm <= 95) {
      scores.hip_hop += 0.3;
    }
    if (audio.bpm >= 135 && audio.bpm <= 150) {
      scores.techno += 0.3;
    }
    
    // Syncopation-based scoring
    if (rhythm.syncopation < 0.2) {
      scores.house += 0.3;
      scores.techno += 0.3;
      scores.edm += 0.2;
      scores.cyberpunk += 0.2;
    }
    if (rhythm.syncopation > 0.3 && rhythm.syncopation < 0.5) {
      scores.reggaeton += 0.3;
      scores.hip_hop += 0.2;
    }
    if (rhythm.syncopation > 0.5) {
      scores.cumbia += 0.2;
    }
    
    // Pattern-based scoring
    if (rhythm.pattern === 'four_on_floor') {
      scores.house += 0.4;
      scores.techno += 0.3;
    }
    if (rhythm.pattern === 'reggaeton') {
      scores.reggaeton += 0.5;
    }
    
    // Find top scores
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const detectedPrimary = sorted[0][0];
    const secondary = sorted[1][1] > 0.2 ? sorted[1][0] : null;
    
    // Track history
    if (!this.scoreHistory.has(detectedPrimary)) {
      this.scoreHistory.set(detectedPrimary, []);
    }
    this.scoreHistory.get(detectedPrimary)!.push(sorted[0][1]);
    
    // Calculate confidence from consistency
    const history = this.scoreHistory.get(detectedPrimary) || [];
    const avgScore = history.length > 0 
      ? history.slice(-this.historySize).reduce((a, b) => a + b, 0) / Math.min(history.length, this.historySize)
      : sorted[0][1];
    
    // 🔥 WAVE 12.2: HISTÉRESIS - Estabilizar género
    const stabilizedPrimary = this.stabilizeGenre(detectedPrimary, avgScore);
    
    return {
      primary: stabilizedPrimary,
      secondary,
      confidence: Math.min(1, avgScore),
      scores,
    };
  }
  
  /**
   * 🔥 WAVE 12.2: HISTÉRESIS - Estabiliza el género
   */
  private stabilizeGenre(detected: string, confidence: number): string {
    // Añadir voto
    this.genreVotes.push(detected);
    if (this.genreVotes.length > this.VOTE_THRESHOLD) {
      this.genreVotes.shift();
    }
    
    // Contar votos
    const voteCounts: Record<string, number> = {};
    for (const vote of this.genreVotes) {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    }
    
    // Encontrar género con mayoría
    let maxVotes = 0;
    let majorityGenre = detected;
    for (const [genre, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        majorityGenre = genre;
      }
    }
    
    // ¿El género mayoritario es diferente al estable actual?
    if (majorityGenre !== this.currentStableGenre) {
      // ¿Tiene suficientes votos Y ha pasado suficiente tiempo?
      const framesSinceChange = this.frameCount - this.lastGenreChangeFrame;
      const hasEnoughVotes = maxVotes >= Math.ceil(this.VOTE_THRESHOLD * 0.6);
      const canChange = framesSinceChange > this.MIN_FRAMES_BETWEEN_CHANGES;
      
      if (hasEnoughVotes && canChange && confidence > 0.5) {
        console.log(`[SimpleGenreClassifier] 🔄 CAMBIO ESTABLE: ${this.currentStableGenre} → ${majorityGenre} (votos: ${maxVotes}/${this.VOTE_THRESHOLD})`);
        this.currentStableGenre = majorityGenre;
        this.lastGenreChangeFrame = this.frameCount;
      }
    }
    
    return this.currentStableGenre !== 'unknown' ? this.currentStableGenre : detected;
  }
  
  reset(): void {
    this.scoreHistory.clear();
    this.frameCount = 0;
    this.lastLogFrame = 0;
    this.currentStableGenre = 'unknown';
    this.genreVotes = [];
    this.lastGenreChangeFrame = 0;
  }
}

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
