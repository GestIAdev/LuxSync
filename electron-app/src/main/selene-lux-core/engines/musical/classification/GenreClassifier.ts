/**
 * WAVE 50: BINARY BIAS CLASSIFIER - THE ARCHITECT'S PURGE
 * ===========================================================
 * 
 * "El genero es un 5% de la generacion de color. Llevamos 24 horas
 * perdiendo el tiempo. El Arquitecto ha hablado: STOP."
 * 
 * ANTES: 360 lineas de "The Senate Classifier" con votaciones,
 *        scores acumulativos, decadencia temporal, zonas muertas...
 * 
 * AHORA: Logica binaria pura.
 *        - 4x4 pattern detectado -> ELECTRONIC_4X4 (Cool Bias)
 *        - Todo lo demas -> LATINO_TRADICIONAL (Warm Bias)
 */

// Solo 2 generos: Cool (Electronic) vs Warm (Organic)
export type MacroGenre = 
  | 'ELECTRONIC_4X4'      // Cool bias: cyans, neones, frio
  | 'LATINO_TRADICIONAL'; // Warm bias: ambar, magenta, calido

export interface GenreAnalysis {
  genre: MacroGenre;
  subgenre: 'none';
  confidence: number;
  scores: Record<MacroGenre, number>;
  features: {
    bpm: number;
    syncopation: number;
    hasFourOnFloor: boolean;
    hasDembow: boolean;
    trebleDensity: number;
    has808Bass: boolean;
    avgEnergy: number;
  };
  mood: 'energetic' | 'chill' | 'dark' | 'festive';
}

interface RhythmInput {
  bpm?: number;
  syncopation?: number;
  pattern?: string | { type?: string; confidence?: number };
  groove?: { syncopation?: number };
  drums?: { kickIntensity?: number; snareIntensity?: number };
  confidence?: number;
}

interface AudioInput {
  energy?: number;
  bass?: number;
  mid?: number;
  treble?: number;
  bpm?: number;
}

export class GenreClassifier {
  private silenceFrames = 0;
  private readonly SILENCE_RESET_THRESHOLD = 180;
  private readonly SILENCE_ENERGY_MIN = 0.05;
  private frameCount = 0;
  private lastLogFrame = 0;
  private currentGenre: MacroGenre = 'ELECTRONIC_4X4';

  private hardReset(): void {
    console.log('[GenreClassifier] HARD RESET: Nueva cancion');
    this.silenceFrames = 0;
    this.frameCount = 0;
    this.lastLogFrame = 0;
    this.currentGenre = 'ELECTRONIC_4X4';
  }

  classify(rhythm: RhythmInput, audio: AudioInput): GenreAnalysis {
    this.frameCount++;

    const bpm = audio.bpm ?? rhythm.bpm ?? 120;
    const energy = audio.energy ?? 0.5;
    const treble = audio.treble ?? 0.1;
    const bass = audio.bass ?? 0.3;
    const kick = rhythm.drums?.kickIntensity ?? 0.5;
    const snare = rhythm.drums?.snareIntensity ?? 0.3;
    const sync = typeof rhythm.syncopation === 'number'
      ? rhythm.syncopation
      : (rhythm.groove?.syncopation ?? 0.35);
    
    // Extract pattern - puede ser string o objeto {type, confidence}
    let patternType = 'unknown';
    let patternConfidence = 0.5;
    if (typeof rhythm.pattern === 'string') {
      patternType = rhythm.pattern;
      patternConfidence = rhythm.confidence ?? 0.5;
    } else if (rhythm.pattern && typeof rhythm.pattern === 'object') {
      patternType = rhythm.pattern.type ?? 'unknown';
      patternConfidence = rhythm.pattern.confidence ?? 0.5;
    }

    // HARD RESET: Silencio prolongado = nueva cancion
    if (energy < this.SILENCE_ENERGY_MIN && bpm === 0) {
      this.silenceFrames++;
      if (this.silenceFrames >= this.SILENCE_RESET_THRESHOLD) {
        this.hardReset();
        return this.createAnalysis('ELECTRONIC_4X4', 0, bpm, sync, energy, treble, bass, kick, snare);
      }
    } else {
      this.silenceFrames = 0;
    }

    // DECISION BINARIA: 4x4 = ELECTRONIC, else = ORGANIC
    const isFourOnFloor = patternType === 'four_on_floor' && patternConfidence > 0.5;
    
    if (isFourOnFloor) {
      this.currentGenre = 'ELECTRONIC_4X4';
      if (this.frameCount - this.lastLogFrame > 300) {
        console.log('[GenreClassifier] ELECTRONIC (4x4, conf=' + patternConfidence.toFixed(2) + ')');
        this.lastLogFrame = this.frameCount;
      }
      return this.createAnalysis('ELECTRONIC_4X4', 0.9, bpm, sync, energy, treble, bass, kick, snare);
    }
    
    this.currentGenre = 'LATINO_TRADICIONAL';
    if (this.frameCount - this.lastLogFrame > 300) {
      console.log('[GenreClassifier] ORGANIC (pattern=' + patternType + ')');
      this.lastLogFrame = this.frameCount;
    }
    return this.createAnalysis('LATINO_TRADICIONAL', 0.8, bpm, sync, energy, treble, bass, kick, snare);
  }

  private createAnalysis(
    genre: MacroGenre,
    confidence: number,
    bpm: number,
    sync: number,
    energy: number,
    treble: number,
    bass: number,
    kick: number,
    snare: number
  ): GenreAnalysis {
    const mood: GenreAnalysis['mood'] = genre === 'ELECTRONIC_4X4' ? 'dark' : 'festive';
    
    return {
      genre,
      subgenre: 'none',
      confidence,
      scores: {
        'ELECTRONIC_4X4': genre === 'ELECTRONIC_4X4' ? 0.9 : 0.1,
        'LATINO_TRADICIONAL': genre === 'LATINO_TRADICIONAL' ? 0.8 : 0.2,
      },
      features: {
        bpm,
        syncopation: sync,
        hasFourOnFloor: genre === 'ELECTRONIC_4X4',
        hasDembow: genre === 'LATINO_TRADICIONAL' && sync > 0.25,
        trebleDensity: treble,
        has808Bass: bass > 0.6,
        avgEnergy: energy,
      },
      mood,
    };
  }

  getDebugState(): {
    current: MacroGenre;
    scores: Record<MacroGenre, number>;
    smoothedSync: number;
    frameCount: number;
    switchMargin: number;
  } {
    return {
      current: this.currentGenre,
      scores: {
        'ELECTRONIC_4X4': this.currentGenre === 'ELECTRONIC_4X4' ? 0.9 : 0.1,
        'LATINO_TRADICIONAL': this.currentGenre === 'LATINO_TRADICIONAL' ? 0.8 : 0.2,
      },
      smoothedSync: 0.35,
      frameCount: this.frameCount,
      switchMargin: 0
    };
  }

  reset(): void {
    this.hardReset();
  }
}

export default GenreClassifier;
