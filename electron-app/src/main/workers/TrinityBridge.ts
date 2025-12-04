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
    0.3, // Moderate syncopation (unknown in reactive)
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
 */
export class SimpleRhythmDetector {
  private phaseHistory: { phase: number; energy: number }[] = [];
  private readonly historySize = 32;
  
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
    let onBeatEnergy = 0;
    let offBeatEnergy = 0;
    
    for (const frame of this.phaseHistory) {
      const isOnBeat = frame.phase < 0.15 || frame.phase > 0.85;
      if (isOnBeat) {
        onBeatEnergy += frame.energy;
      } else {
        offBeatEnergy += frame.energy;
      }
    }
    
    const totalEnergy = onBeatEnergy + offBeatEnergy;
    const syncopation = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;
    
    // Pattern detection (simplified)
    let pattern: RhythmOutput['pattern'] = 'unknown';
    if (syncopation < 0.2) pattern = 'four_on_floor';
    else if (syncopation > 0.6) pattern = 'breakbeat';
    else if (audio.bpm >= 90 && audio.bpm <= 105 && syncopation > 0.3) pattern = 'reggaeton';
    
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
 * Simplified harmony detection for workers
 */
export class SimpleHarmonyDetector {
  private moodHistory: string[] = [];
  private readonly historySize = 10;
  
  analyze(audio: AudioMetrics): HarmonyOutput {
    // Simple mood detection based on spectral balance
    let mood: HarmonyOutput['mood'] = 'neutral' as any;
    let temperature: HarmonyOutput['temperature'] = 'neutral';
    
    const bassToTreble = audio.bass / (audio.treble + 0.01);
    
    if (bassToTreble > 2) {
      mood = 'sad';
      temperature = 'cool';
    } else if (bassToTreble < 0.5) {
      mood = 'happy';
      temperature = 'warm';
    } else if (audio.mid > 0.7) {
      mood = 'tense';
      temperature = 'neutral';
    } else {
      mood = 'universal';
      temperature = 'neutral';
    }
    
    // Track mood history for stability
    this.moodHistory.push(mood);
    if (this.moodHistory.length > this.historySize) {
      this.moodHistory.shift();
    }
    
    // Use most common mood
    const moodCounts = new Map<string, number>();
    for (const m of this.moodHistory) {
      moodCounts.set(m, (moodCounts.get(m) || 0) + 1);
    }
    
    let dominantMood: HarmonyOutput['mood'] = mood;
    let maxCount = 0;
    for (const [m, count] of moodCounts) {
      if (count > maxCount) {
        dominantMood = m as HarmonyOutput['mood'];
        maxCount = count;
      }
    }
    
    return {
      key: null,  // Would need FFT for real key detection
      mode: 'unknown',
      mood: dominantMood as HarmonyOutput['mood'],
      temperature,
      dissonance: Math.random() * 0.3, // Simplified
      chromaticNotes: [],
      confidence: this.moodHistory.length / this.historySize * 0.5, // Lower confidence for simplified
    };
  }
  
  reset(): void {
    this.moodHistory = [];
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
 */
export class SimpleGenreClassifier {
  private scoreHistory: Map<string, number[]> = new Map();
  private readonly historySize = 20;
  
  classify(rhythm: RhythmOutput, audio: AudioMetrics): GenreOutput {
    const scores: Record<string, number> = {
      edm: 0,
      house: 0,
      techno: 0,
      reggaeton: 0,
      cumbia: 0,
      hip_hop: 0,
      rock: 0,
      pop: 0,
      unknown: 0.1, // Base score
    };
    
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
    const primary = sorted[0][0];
    const secondary = sorted[1][1] > 0.2 ? sorted[1][0] : null;
    
    // Track history
    if (!this.scoreHistory.has(primary)) {
      this.scoreHistory.set(primary, []);
    }
    this.scoreHistory.get(primary)!.push(sorted[0][1]);
    
    // Calculate confidence from consistency
    const history = this.scoreHistory.get(primary) || [];
    const avgScore = history.length > 0 
      ? history.slice(-this.historySize).reduce((a, b) => a + b, 0) / Math.min(history.length, this.historySize)
      : sorted[0][1];
    
    return {
      primary,
      secondary,
      confidence: Math.min(1, avgScore),
      scores,
    };
  }
  
  reset(): void {
    this.scoreHistory.clear();
  }
}

/**
 * Simplified palette generator for workers
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
  
  generate(
    mood: HarmonyOutput['mood'],
    energy: number,
    syncopation: number,
    key: string | null
  ): SelenePalette {
    // Base hue from key or mood
    let baseHue: number;
    if (key && SimplePaletteGenerator.KEY_TO_HUE[key] !== undefined) {
      baseHue = SimplePaletteGenerator.KEY_TO_HUE[key];
    } else {
      // Mood-based hue
      const moodHues: Record<string, number> = {
        happy: 45,      // Orange
        sad: 220,       // Blue
        tense: 0,       // Red
        dreamy: 280,    // Purple
        bluesy: 30,     // Orange-brown
        jazzy: 260,     // Purple-blue
        spanish_exotic: 15, // Red-orange
        universal: 180, // Cyan
      };
      baseHue = moodHues[mood] ?? 180;
    }
    
    // Strategy based on energy
    const strategy: SelenePalette['metadata']['strategy'] = 
      energy > 0.7 ? 'complementary' :
      energy > 0.4 ? 'triadic' :
      'analogous';
    
    // Saturation based on syncopation
    const baseSaturation = 60 + syncopation * 30;
    
    // Lightness based on energy
    const baseLightness = 30 + energy * 30;
    
    // Generate palette
    const primary: HSLColor = { h: baseHue, s: baseSaturation, l: baseLightness };
    
    let secondary: HSLColor;
    let accent: HSLColor;
    
    if (strategy === 'complementary') {
      secondary = { h: (baseHue + 180) % 360, s: baseSaturation, l: baseLightness };
      accent = { h: (baseHue + 90) % 360, s: 90, l: 60 };
    } else if (strategy === 'triadic') {
      secondary = { h: (baseHue + 120) % 360, s: baseSaturation, l: baseLightness };
      accent = { h: (baseHue + 240) % 360, s: 90, l: 60 };
    } else {
      secondary = { h: (baseHue + 30) % 360, s: baseSaturation, l: baseLightness };
      accent = { h: (baseHue - 30 + 360) % 360, s: 90, l: 60 };
    }
    
    const ambient: HSLColor = { h: baseHue, s: baseSaturation * 0.5, l: baseLightness * 0.6 };
    const contrast: HSLColor = { h: (baseHue + 180) % 360, s: 20, l: 80 };
    
    return {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      metadata: {
        strategy,
        transitionSpeed: energy > 0.7 ? 100 : 300,
        confidence: 0.7,
        description: `${mood} mood with ${strategy} harmony`,
      },
    };
  }
}
