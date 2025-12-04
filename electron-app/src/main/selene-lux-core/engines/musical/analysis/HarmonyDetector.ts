/**
 * 🎸 HARMONY DETECTOR
 * ============================================================
 * Motor de análisis armónico para Wave 8 - El Alma de la Fiesta
 * 
 * Fuente: HarmonyEngine.ts + ScaleUtils.ts (Aura Forge)
 * 
 * Concepto:
 * - Detectar TONALIDAD (Key): ¿Es Do Mayor o La Menor?
 * - Detectar MODO/MOOD: Major→Happy, Minor→Sad, Phrygian→Exotic
 * - Detectar DISONANCIA: Si las frecuencias chocan (tritono) → Tension
 * 
 * ⚠️ REGLA 1: Este análisis es PESADO
 * - Ejecutar con Throttling (cada 200-500ms)
 * - NO en cada frame de 30ms
 * - La armonía no cambia tan rápido como el ritmo
 * 
 * @author LuxSync Team
 * @version 1.0.0 - Wave 8 FASE 2
 */

import { EventEmitter } from 'events';
import { 
  HarmonyAnalysis, 
  ModalScale, 
  HarmonicMood,
  AudioAnalysis 
} from '../types.js';
import { 
  ScaleIdentifier, 
  ScaleMatch, 
  NOTE_NAMES,
  createScaleIdentifier 
} from '../classification/ScaleIdentifier.js';

// ============================================================
// 📐 CONSTANTES - MAPEO MODO → MOOD
// ============================================================

/**
 * Mapeo de escala → mood emocional
 * 
 * Esto es lo que decide si pones luces AZULES o NARANJAS
 * ¡El Alma de la Fiesta!
 */
export const MODE_TO_MOOD: Record<ModalScale, HarmonicMood> = {
  // === MODOS FELICES (Cálidos) ===
  major:            'happy',       // Brillante, alegre → Naranjas, amarillos
  lydian:           'dreamy',      // Etéreo, flotante → Púrpuras, azul claro
  mixolydian:       'bluesy',      // Rock, blues feliz → Naranjas cálidos

  // === MODOS TRISTES (Fríos) ===
  minor:            'sad',         // Melancólico → Azules profundos
  dorian:           'jazzy',       // Sofisticado, jazz → Azules jazz, morados
  harmonic_minor:   'tense',       // Dramático → Rojos oscuros
  melodic_minor:    'jazzy',       // Jazz avanzado → Morados

  // === MODOS TENSOS/EXÓTICOS (Especiales) ===
  phrygian:         'spanish_exotic', // Spanish, flamenco → Rojos, negros
  locrian:          'tense',          // Muy inestable → Rojos, strobes

  // === PENTATÓNICAS (Universales) ===
  pentatonic_major: 'universal',   // Folk, simple → Colores naturales
  pentatonic_minor: 'bluesy',      // Blues rock → Azul oscuro

  // === ESPECIALES ===
  blues:            'bluesy',      // Blues → Azul profundo
  chromatic:        'tense',       // Atonal → Caótico, strobes
};

/**
 * Niveles de temperatura de color por mood
 * Usado para decidir si la iluminación debe ser cálida o fría
 */
export const MOOD_TEMPERATURE: Record<HarmonicMood, 'warm' | 'cool' | 'neutral'> = {
  happy:           'warm',    // Naranjas, amarillos
  dreamy:          'cool',    // Púrpuras suaves
  bluesy:          'warm',    // Naranjas rock
  sad:             'cool',    // Azules profundos
  jazzy:           'cool',    // Azules sofisticados
  spanish_exotic:  'warm',    // Rojos flamenco
  tense:           'neutral', // Puede ser cualquiera, intenso
  universal:       'neutral', // Adaptable
};

/**
 * Intervalos disonantes (en semitonos)
 * Estos intervalos crean tensión matemática
 */
export const DISSONANT_INTERVALS = [1, 2, 6, 10, 11]; // semitono, tono, tritono, 7ª menor, 7ª mayor

/**
 * El TRITONO (6 semitonos) - El diablo en la música
 * Históricamente llamado "diabolus in musica"
 */
export const TRITONE_INTERVAL = 6;

// ============================================================
// 🎯 INTERFACES
// ============================================================

export interface HarmonyDetectorConfig {
  /** Intervalo de throttling en ms (por defecto 500ms) */
  throttleMs: number;
  /** Umbral de confianza mínimo para considerar válido el análisis */
  minConfidence: number;
  /** Habilitar detección de disonancia */
  detectDissonance: boolean;
  /** Tamaño del buffer de historial para smoothing */
  historySize: number;
}

export interface ChromaAnalysis {
  /** Chromagrama normalizado [0-1] para cada pitch class */
  chroma: number[];
  /** Nota dominante (pitch class 0-11) */
  dominantPitch: number;
  /** Energía total del espectro */
  totalEnergy: number;
}

export interface DissonanceAnalysis {
  /** Nivel de disonancia 0-1 */
  level: number;
  /** Si hay tritono presente */
  hasTritone: boolean;
  /** Intervalos disonantes detectados */
  disonantIntervals: number[];
  /** Sugiere preparar efectos de tensión */
  suggestTension: boolean;
}

export interface ChordEstimate {
  root: string | null;
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | null;
  confidence: number;
}

const DEFAULT_CONFIG: HarmonyDetectorConfig = {
  throttleMs: 500,        // REGLA 1: Throttled, no cada 30ms
  minConfidence: 0.3,
  detectDissonance: true,
  historySize: 5,
};

// ============================================================
// 🎸 HARMONY DETECTOR CLASS
// ============================================================

/**
 * Detector de armonía musical
 * 
 * ⚠️ REGLA 1: Ejecutar throttled (500ms) en Worker Thread
 * ⚠️ REGLA 2: Retorna confidence para fallback
 */
export class HarmonyDetector extends EventEmitter {
  private config: HarmonyDetectorConfig;
  private scaleIdentifier: ScaleIdentifier;
  
  // Estado interno
  private lastAnalysis: HarmonyAnalysis | null = null;
  private lastAnalysisTime: number = 0;
  private history: HarmonyAnalysis[] = [];
  
  // Cache de chromagrama para smoothing
  private chromaHistory: number[][] = [];
  
  constructor(config: Partial<HarmonyDetectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scaleIdentifier = createScaleIdentifier();
  }

  // ============================================================
  // 📊 MÉTODO PRINCIPAL - ANALYZE
  // ============================================================

  /**
   * Analizar armonía del audio
   * 
   * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param audio AudioAnalysis del frame actual
   * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
   * @returns HarmonyAnalysis con key, mode, mood, chord y confidence
   */
  analyze(audio: AudioAnalysis, forceAnalysis: boolean = false): HarmonyAnalysis {
    const now = Date.now();
    
    // THROTTLING: Retornar caché si no ha pasado suficiente tiempo
    if (!forceAnalysis && 
        this.lastAnalysis && 
        (now - this.lastAnalysisTime) < this.config.throttleMs) {
      return this.lastAnalysis;
    }

    // === CHECK SILENCIO PRIMERO ===
    // Verificar energía del audio ANTES de procesar
    const audioEnergy = this.calculateRawAudioEnergy(audio);
    if (audioEnergy < 0.05) {
      return this.createEmptyAnalysis(now);
    }

    // === PASO 1: Convertir FFT a Chromagrama ===
    const chromaAnalysis = this.extractChromagrama(audio);
    
    // Si el chromagrama no tiene información útil
    if (chromaAnalysis.totalEnergy < 0.1) {
      return this.createEmptyAnalysis(now);
    }

    // === PASO 2: Identificar Escala/Tonalidad ===
    const scaleMatch = this.scaleIdentifier.identifyScale(chromaAnalysis.chroma);
    
    // === PASO 3: Mapear a Mood ===
    const mood = MODE_TO_MOOD[scaleMatch.scale];
    
    // === PASO 4: Estimar Acorde Actual ===
    const chord = this.estimateChord(chromaAnalysis);
    
    // === PASO 5: Detectar Disonancia (opcional) ===
    let dissonance: DissonanceAnalysis | null = null;
    if (this.config.detectDissonance) {
      dissonance = this.detectDissonance(chromaAnalysis);
    }

    // === PASO 6: Construir Resultado ===
    const analysis: HarmonyAnalysis = {
      key: scaleMatch.rootName,
      mode: {
        scale: scaleMatch.scale,
        confidence: scaleMatch.confidence,
        mood,
      },
      currentChord: chord,
      confidence: this.calculateOverallConfidence(scaleMatch, chord, chromaAnalysis),
      timestamp: now,
    };

    // === PASO 7: Actualizar Estado ===
    this.updateHistory(analysis);
    this.lastAnalysis = analysis;
    this.lastAnalysisTime = now;

    // === PASO 8: Emitir Eventos ===
    this.emit('harmony', analysis);
    
    if (dissonance?.suggestTension) {
      this.emit('tension', dissonance);
    }

    // Detectar cambios de tonalidad
    if (this.history.length > 1) {
      const prevKey = this.history[this.history.length - 2]?.key;
      if (prevKey && prevKey !== analysis.key && analysis.confidence > 0.6) {
        this.emit('key-change', { from: prevKey, to: analysis.key, confidence: analysis.confidence });
      }
    }

    return analysis;
  }

  // ============================================================
  // 🎵 DETECCIÓN DE TONALIDAD (KEY)
  // ============================================================

  /**
   * Detectar tonalidad principal
   * Usa el historial para estabilizar la detección
   */
  detectKey(audio: AudioAnalysis): { key: string; confidence: number } {
    const chroma = this.extractChromagrama(audio);
    const match = this.scaleIdentifier.identifyScale(chroma.chroma);
    
    return {
      key: match.rootName,
      confidence: match.confidence,
    };
  }

  // ============================================================
  // 🎭 DETECCIÓN DE MODO/MOOD
  // ============================================================

  /**
   * Detectar modo y mapear a mood emocional
   */
  detectMode(audio: AudioAnalysis): { 
    scale: ModalScale; 
    mood: HarmonicMood; 
    confidence: number;
    temperature: 'warm' | 'cool' | 'neutral';
  } {
    const chroma = this.extractChromagrama(audio);
    const match = this.scaleIdentifier.identifyScale(chroma.chroma);
    const mood = MODE_TO_MOOD[match.scale];
    const temperature = MOOD_TEMPERATURE[mood];
    
    return {
      scale: match.scale,
      mood,
      confidence: match.confidence,
      temperature,
    };
  }

  // ============================================================
  // 🎸 ESTIMACIÓN DE ACORDES
  // ============================================================

  /**
   * Estimar el acorde actual basado en el chromagrama
   * 
   * Algoritmo simplificado:
   * 1. Encontrar las 3-4 notas más fuertes
   * 2. Determinar la raíz (nota más grave con energía significativa)
   * 3. Analizar intervalos para determinar quality
   */
  estimateChord(chromaAnalysis: ChromaAnalysis): ChordEstimate {
    const { chroma } = chromaAnalysis;
    
    // Encontrar las notas más fuertes
    const noteEnergies = chroma.map((energy, pitch) => ({ pitch, energy }))
      .filter(n => n.energy > 0.2)
      .sort((a, b) => b.energy - a.energy)
      .slice(0, 4);

    if (noteEnergies.length < 2) {
      return { root: null, quality: null, confidence: 0 };
    }

    // La nota más fuerte es probablemente la raíz
    const root = noteEnergies[0].pitch;
    const rootName = NOTE_NAMES[root];

    // Analizar intervalos desde la raíz
    const intervals = noteEnergies.slice(1).map(n => {
      let interval = n.pitch - root;
      if (interval < 0) interval += 12;
      return interval;
    });

    // Determinar quality
    const quality = this.determineChordQuality(intervals);
    
    // Calcular confianza basada en claridad del acorde
    const confidence = this.calculateChordConfidence(noteEnergies);

    return { root: rootName, quality, confidence };
  }

  /**
   * Determinar la calidad del acorde basado en intervalos
   */
  private determineChordQuality(
    intervals: number[]
  ): 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | null {
    const hasInterval = (target: number) => intervals.includes(target);

    // Major: tiene 3ª mayor (4 semitonos) y 5ª justa (7)
    if (hasInterval(4) && hasInterval(7)) return 'major';
    
    // Minor: tiene 3ª menor (3 semitonos) y 5ª justa (7)
    if (hasInterval(3) && hasInterval(7)) return 'minor';
    
    // Diminished: 3ª menor (3) y 5ª disminuida (6)
    if (hasInterval(3) && hasInterval(6)) return 'diminished';
    
    // Augmented: 3ª mayor (4) y 5ª aumentada (8)
    if (hasInterval(4) && hasInterval(8)) return 'augmented';
    
    // Sus4: sin 3ª, tiene 4ª (5 semitonos)
    if (!hasInterval(3) && !hasInterval(4) && hasInterval(5)) return 'suspended';
    
    // Sus2: sin 3ª, tiene 2ª (2 semitonos)
    if (!hasInterval(3) && !hasInterval(4) && hasInterval(2)) return 'suspended';

    return null;
  }

  /**
   * Calcular confianza del acorde
   */
  private calculateChordConfidence(
    noteEnergies: { pitch: number; energy: number }[]
  ): number {
    if (noteEnergies.length < 3) return 0.3;

    // Confianza alta si las notas del acorde son mucho más fuertes que el ruido
    const topEnergy = noteEnergies.slice(0, 3).reduce((sum, n) => sum + n.energy, 0);
    const avgEnergy = topEnergy / 3;
    
    // Si las notas principales tienen buena energía, alta confianza
    return Math.min(1, avgEnergy * 1.5);
  }

  // ============================================================
  // 😈 DETECCIÓN DE DISONANCIA
  // ============================================================

  /**
   * Detectar disonancia en el audio
   * 
   * La disonancia indica TENSIÓN musical
   * Útil para preparar efectos de strobe o colores rojos
   */
  detectDissonance(chromaAnalysis: ChromaAnalysis): DissonanceAnalysis {
    const { chroma } = chromaAnalysis;
    
    // Encontrar notas presentes
    const presentNotes = chroma
      .map((energy, pitch) => ({ pitch, energy }))
      .filter(n => n.energy > 0.2);

    let dissonanceScore = 0;
    const detectedDissonance: number[] = [];
    let hasTritone = false;

    // Comparar cada par de notas
    for (let i = 0; i < presentNotes.length; i++) {
      for (let j = i + 1; j < presentNotes.length; j++) {
        let interval = Math.abs(presentNotes[j].pitch - presentNotes[i].pitch);
        if (interval > 6) interval = 12 - interval; // Inversión
        
        if (DISSONANT_INTERVALS.includes(interval)) {
          // Peso por la energía de las notas involucradas
          const weight = (presentNotes[i].energy + presentNotes[j].energy) / 2;
          dissonanceScore += weight;
          detectedDissonance.push(interval);
          
          if (interval === TRITONE_INTERVAL) {
            hasTritone = true;
            // El tritono es extra disonante
            dissonanceScore += weight * 0.5;
          }
        }
      }
    }

    // Normalizar score
    const normalizedDissonance = Math.min(1, dissonanceScore / 2);

    return {
      level: normalizedDissonance,
      hasTritone,
      disonantIntervals: [...new Set(detectedDissonance)],
      suggestTension: normalizedDissonance > 0.5 || hasTritone,
    };
  }

  // ============================================================
  // 🔧 MÉTODOS AUXILIARES
  // ============================================================

  /**
   * Extraer chromagrama del audio
   * Convierte el espectro FFT a 12 pitch classes
   */
  private extractChromagrama(audio: AudioAnalysis): ChromaAnalysis {
    // Si tenemos rawFFT, usarlo para chromagrama real
    // Si no, aproximar desde las bandas de frecuencia
    const chroma = new Array(12).fill(0);
    
    if (audio.rawFFT && audio.rawFFT.length > 0) {
      // Chromagrama real desde FFT
      this.fftToChroma(audio.rawFFT, chroma);
    } else {
      // Aproximación desde bandas de frecuencia
      // Esto es menos preciso pero funcional
      this.spectrumToChroma(audio.spectrum, chroma);
    }

    // Normalizar
    const maxEnergy = Math.max(...chroma, 0.001);
    const normalizedChroma = chroma.map(e => e / maxEnergy);
    
    // Encontrar nota dominante
    let dominantPitch = 0;
    let maxVal = 0;
    for (let i = 0; i < 12; i++) {
      if (normalizedChroma[i] > maxVal) {
        maxVal = normalizedChroma[i];
        dominantPitch = i;
      }
    }

    // Smoothing: Promediar con historial
    this.chromaHistory.push(normalizedChroma);
    if (this.chromaHistory.length > this.config.historySize) {
      this.chromaHistory.shift();
    }

    const smoothedChroma = this.averageChroma();

    return {
      chroma: smoothedChroma,
      dominantPitch,
      totalEnergy: normalizedChroma.reduce((sum, e) => sum + e, 0),
    };
  }

  /**
   * Convertir FFT real a chromagrama
   * 
   * Algoritmo:
   * - Mapear cada bin del FFT a su pitch class correspondiente
   * - Acumular energía por pitch class
   */
  private fftToChroma(fft: Float32Array, chroma: number[]): void {
    const sampleRate = 44100; // Asumir 44.1kHz
    const binSize = sampleRate / (fft.length * 2);

    for (let i = 1; i < fft.length / 2; i++) {
      const frequency = i * binSize;
      
      // Solo considerar frecuencias musicales (27.5Hz - 4186Hz, A0 - C8)
      if (frequency < 27.5 || frequency > 4186) continue;

      // Convertir frecuencia a número MIDI
      const midiNote = 12 * Math.log2(frequency / 440) + 69;
      
      if (midiNote >= 0 && midiNote < 128) {
        const pitchClass = Math.round(midiNote) % 12;
        const energy = Math.abs(fft[i]);
        chroma[pitchClass] += energy;
      }
    }
  }

  /**
   * Aproximar chromagrama desde bandas de frecuencia
   * Menos preciso pero funciona sin FFT raw
   */
  private spectrumToChroma(
    spectrum: { bass: number; lowMid: number; mid: number; highMid: number; treble: number },
    chroma: number[]
  ): void {
    // Aproximación muy simplificada:
    // Bass → notas graves (C, E, G típicas de bajo)
    // Mid → notas medias
    // Treble → armónicos
    
    const { bass, lowMid, mid, highMid, treble } = spectrum;
    
    // Bass suele tener C, E, G (I-III-V de la tónica)
    chroma[0] += bass * 0.5;   // C
    chroma[4] += bass * 0.3;   // E  
    chroma[7] += bass * 0.2;   // G
    
    // LowMid añade color
    chroma[2] += lowMid * 0.3;  // D
    chroma[5] += lowMid * 0.3;  // F
    chroma[9] += lowMid * 0.3;  // A
    
    // Mid es donde está la melodía principal
    // Distribuir uniformemente con algo de ruido
    for (let i = 0; i < 12; i++) {
      chroma[i] += mid * 0.1;
    }
    
    // HighMid y Treble son armónicos
    chroma[0] += highMid * 0.2;
    chroma[4] += highMid * 0.15;
    chroma[7] += highMid * 0.15;
    chroma[11] += treble * 0.1;
  }

  /**
   * Promediar chromagramas del historial para smoothing
   */
  private averageChroma(): number[] {
    if (this.chromaHistory.length === 0) {
      return new Array(12).fill(0);
    }

    const avg = new Array(12).fill(0);
    for (const chroma of this.chromaHistory) {
      for (let i = 0; i < 12; i++) {
        avg[i] += chroma[i];
      }
    }

    const count = this.chromaHistory.length;
    return avg.map(v => v / count);
  }

  /**
   * Calcular confianza general del análisis
   */
  private calculateOverallConfidence(
    scaleMatch: ScaleMatch,
    chord: ChordEstimate,
    chromaAnalysis: ChromaAnalysis
  ): number {
    // Factores de confianza:
    // 1. Confianza de la escala detectada (40%)
    // 2. Confianza del acorde (30%)
    // 3. Energía total (claridad de señal) (30%)
    
    const scaleConfidence = scaleMatch.confidence;
    const chordConfidence = chord.confidence;
    const energyConfidence = Math.min(1, chromaAnalysis.totalEnergy / 6);

    return (
      scaleConfidence * 0.4 +
      chordConfidence * 0.3 +
      energyConfidence * 0.3
    );
  }

  /**
   * Calcular energía raw del audio (antes de normalización)
   * Útil para detectar silencio
   */
  private calculateRawAudioEnergy(audio: AudioAnalysis): number {
    const { spectrum, energy } = audio;
    
    // Si tenemos energía calculada, usarla directamente
    if (energy && typeof energy.current === 'number') {
      return energy.current;
    }
    
    // Fallback: calcular desde spectrum
    const { bass, lowMid, mid, highMid, treble } = spectrum;
    return (bass + lowMid + mid + highMid + treble) / 5;
  }

  /**
   * Crear análisis vacío para cuando no hay señal
   */
  private createEmptyAnalysis(timestamp: number): HarmonyAnalysis {
    return {
      key: null,
      mode: {
        scale: 'chromatic',
        confidence: 0,
        mood: 'universal',
      },
      currentChord: {
        root: null,
        quality: null,
        confidence: 0,
      },
      confidence: 0,
      timestamp,
    };
  }

  /**
   * Actualizar historial de análisis
   */
  private updateHistory(analysis: HarmonyAnalysis): void {
    this.history.push(analysis);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  // ============================================================
  // 📤 GETTERS Y UTILIDADES
  // ============================================================

  /**
   * Obtener último análisis (del caché)
   */
  getLastAnalysis(): HarmonyAnalysis | null {
    return this.lastAnalysis;
  }

  /**
   * Obtener historial de análisis
   */
  getHistory(): HarmonyAnalysis[] {
    return [...this.history];
  }

  /**
   * Obtener temperatura de color sugerida para el mood actual
   */
  getSuggestedTemperature(): 'warm' | 'cool' | 'neutral' {
    if (!this.lastAnalysis) return 'neutral';
    return MOOD_TEMPERATURE[this.lastAnalysis.mode.mood];
  }

  /**
   * Resetear estado interno
   */
  reset(): void {
    this.lastAnalysis = null;
    this.lastAnalysisTime = 0;
    this.history = [];
    this.chromaHistory = [];
  }

  /**
   * Actualizar configuración
   */
  updateConfig(config: Partial<HarmonyDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================
// 📤 FACTORY FUNCTION
// ============================================================

/**
 * Crear instancia de HarmonyDetector con config por defecto
 */
export function createHarmonyDetector(
  config?: Partial<HarmonyDetectorConfig>
): HarmonyDetector {
  return new HarmonyDetector(config);
}

// Export default instance for quick usage
export const defaultHarmonyDetector = new HarmonyDetector();
