/**
 * WAVE 20: THE GREAT RESET
 * 5 Categorias Fisicas | ~80 lineas | 0 subgeneros culturales
 * "Selene ya no PIENSA que cultura es. Ahora SIENTE que fisica tiene."
 * 
 * @author Selene AI Engineering
 * @version WAVE-20
 */

// TIPOS

export type MacroGenre = 
  | 'ELECTRONIC_4X4'
  | 'ELECTRONIC_BREAKS'
  | 'LATINO_TRADICIONAL'
  | 'LATINO_URBANO'
  | 'ELECTROLATINO';

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

// CLASIFICADOR

export class GenreClassifier {
  private lastGenre: MacroGenre = 'ELECTROLATINO';
  private lastSync: number = 0.35;  // WAVE 22: Guardar sync anterior para Anti-Glue
  private framesSinceChange = 0;
  private readonly STABILITY_FRAMES = 30;
  private frameCount = 0;
  private lastLogFrame = 0;

  classify(rhythm: RhythmInput, audio: AudioInput): GenreAnalysis {
    this.frameCount++;

    // WAVE 19.2 FIX: Extraer metricas con fallbacks
    const sync = typeof rhythm.syncopation === 'number'
      ? rhythm.syncopation
      : (rhythm.groove?.syncopation ?? 0.35);
    
    const bpm = audio.bpm ?? rhythm.bpm ?? 120;
    const treble = audio.treble ?? 0.1;
    const snare = rhythm.drums?.snareIntensity ?? 0.3;
    const kick = rhythm.drums?.kickIntensity ?? 0.5;
    const energy = audio.energy ?? 0.5;
    const bass = audio.bass ?? 0.3;

    // ARBOL DE DECISION FISICO
    let detectedGenre: MacroGenre;
    let confidence: number;
    let mood: GenreAnalysis['mood'] = 'energetic';

    // 🧴 WAVE 22: ANTI-GLUE (Quick Release)
    // Si el ritmo cambia drásticamente, romper el lock incluso en silencio
    const syncDelta = Math.abs(sync - this.lastSync);
    
    // 🛡️ WAVE 21.2: BREAKDOWN LOCK (Escudo Contextual) + ANTI-GLUE
    // Mantener lock SOLO si: energía baja Y ritmo NO ha cambiado drásticamente
    // Si syncDelta > 0.3, es que ha entrado un ritmo nuevo (ej: Techno→Cumbia)
    const isBreakdown = energy < 0.25 && syncDelta < 0.3;
    
    if (
      isBreakdown &&
      (this.lastGenre === 'ELECTRONIC_4X4' || this.lastGenre === 'ELECTRONIC_BREAKS')
    ) {
      // Estamos en un breakdown techno -> mantener el contexto
      detectedGenre = this.lastGenre;
      confidence = 0.75; // Confianza menor porque no detectamos energía, pero contexto es sólido
      mood = 'dark';
      // Log ocasional
      if (this.frameCount - this.lastLogFrame > 120) {
        console.log(`[GenreClassifier] BREAKDOWN LOCK: ${detectedGenre} (energy=${energy.toFixed(2)}, syncDelta=${syncDelta.toFixed(2)})`);
        this.lastLogFrame = this.frameCount;
      }
    }
    // 🇦🇷 WAVE 22: GAUCHO BPM FIX (Normalización Selectiva)
    // Detectar Cumbia Rápida (180 BPM) vs Breaks (DnB real)
    // Si BPM alto pero NO es potente (energy/kick bajos), es Cumbia -> Normalizar a evalBpm
    else {
      // Evaluar BPM: Si es muy rápido pero sin potencia de breaks, tratarlo como cumbia rápida
      let evalBpm = bpm;
      if (bpm > 155 && !(energy > 0.8 && kick > 0.7)) {
        // No es Breaks potente, es Cumbia Rápida -> Normalizar octava
        evalBpm = Math.floor(bpm / 2);  // 180 → 90, 170 → 85
        if (this.frameCount - this.lastLogFrame > 120) {
          console.log(`[GenreClassifier] GAUCHO FIX: BPM normalizado ${bpm} → ${evalBpm}`);
          this.lastLogFrame = this.frameCount;
        }
      }

      if (evalBpm > 155 && energy > 0.8 && kick > 0.7) {
        // ELECTRONIC_BREAKS: DnB/Breaks real con mucha potencia
        detectedGenre = 'ELECTRONIC_BREAKS';
        confidence = 0.85;
        mood = 'dark';
      }
      // WAVE 22.4: SMART SWING GATE (Darkness Check)
      else if (
        kick > 0.3 && 
        evalBpm > 110 && evalBpm <= 150 && 
        treble <= 0.45 &&  // Rechazar brillantes (Cumbia)
        (sync < 0.40 || (sync < 0.60 && treble < 0.35))  // Robo O (Groovy Y Oscuro)
      ) {
        detectedGenre = 'ELECTRONIC_4X4';
        confidence = treble < 0.35 ? 0.95 : 0.85;
        mood = energy > 0.6 ? 'energetic' : 'dark';
      }
      // TERCERO: Detectar electronic 4x4 por sync bajo (si no tenía kick fuerte)
      // WAVE 21.1: Solo es Electrónica si tiene energía o kick - silencio no es Techno
      else if (sync < 0.30 && (energy > 0.3 || kick > 0.2)) {
        detectedGenre = 'ELECTRONIC_4X4';
        confidence = 0.90;
        mood = energy > 0.6 ? 'energetic' : 'dark';
      }
      // CUARTO: Latino range (70-125 BPM evaluado)
      // WAVE 22.2: Bajamos de 85 a 70 BPM para atrapar Cumbia Rebajada y Reggaeton Lento
      // WAVE 21: Calibración para audio sucio (MP3/YouTube)
      else if (evalBpm >= 70 && evalBpm <= 125) {
        if (treble > 0.10) {  // WAVE 21: Bajamos de 0.15 a 0.10 (MP3 mata agudos)
          detectedGenre = 'LATINO_TRADICIONAL';
          confidence = 0.88;
          mood = 'festive';
        } else if (snare > 0.5) {
          detectedGenre = 'LATINO_URBANO';  // WAVE 21: Refugio para ritmo roto sin agudos
          confidence = 0.85;
          mood = 'dark';
        } else {
          detectedGenre = 'ELECTROLATINO';
          confidence = 0.70;
          mood = 'chill';
        }
      }
      // FALLBACK: Fuera de rangos conocidos
      // WAVE 22.2: Si sincopación es muy alta (> 0.6), es más probable Reggaeton/Urbano que Pop
      else {
        if (sync > 0.6 && evalBpm < 140) {
          // Ritmo lento y muy roto -> es Reggaeton/Dembow
          detectedGenre = 'LATINO_URBANO';
          confidence = 0.60;
          mood = 'dark';
        } else {
          detectedGenre = 'ELECTROLATINO';
          confidence = 0.50;
          mood = 'chill';
        }
      }
    }
    
    // Guardar sync actual para Anti-Glue en siguiente frame
    this.lastSync = sync;

    // HISTERESIS
    if (detectedGenre !== this.lastGenre) {
      this.framesSinceChange++;
      if (this.framesSinceChange < this.STABILITY_FRAMES) {
        detectedGenre = this.lastGenre;
      } else {
        if (this.frameCount - this.lastLogFrame > 60) {
          console.log(`[GenreClassifier] CAMBIO: ${this.lastGenre} -> ${detectedGenre} (sync=${sync.toFixed(2)}, bpm=${bpm.toFixed(0)})`);
          this.lastLogFrame = this.frameCount;
        }
        this.lastGenre = detectedGenre;
        this.framesSinceChange = 0;
      }
    } else {
      this.framesSinceChange = 0;
    }

    // LOG PERIODICO
    if (this.frameCount - this.lastLogFrame > 120) {
      console.log(`[GenreClassifier] ${detectedGenre} | sync=${sync.toFixed(2)} bpm=${bpm.toFixed(0)} treble=${treble.toFixed(2)}`);
      this.lastLogFrame = this.frameCount;
    }

    const scores: Record<MacroGenre, number> = {
      'ELECTRONIC_4X4': detectedGenre === 'ELECTRONIC_4X4' ? confidence : 0.1,
      'ELECTRONIC_BREAKS': detectedGenre === 'ELECTRONIC_BREAKS' ? confidence : 0.1,
      'LATINO_TRADICIONAL': detectedGenre === 'LATINO_TRADICIONAL' ? confidence : 0.1,
      'LATINO_URBANO': detectedGenre === 'LATINO_URBANO' ? confidence : 0.1,
      'ELECTROLATINO': detectedGenre === 'ELECTROLATINO' ? confidence : 0.1,
    };

    return {
      genre: detectedGenre,
      subgenre: 'none',
      confidence,
      scores,
      features: {
        bpm,
        syncopation: sync,
        hasFourOnFloor: sync < 0.20 && kick > 0.5,
        hasDembow: snare > 0.5 && sync > 0.30,
        trebleDensity: treble,
        has808Bass: bass > 0.6,
        avgEnergy: energy,
      },
      mood,
    };
  }

  reset(): void {
    this.lastGenre = 'ELECTROLATINO';
    this.lastSync = 0.35;  // WAVE 22: Reset sync tracking
    this.framesSinceChange = 0;
    this.frameCount = 0;
  }
}

// EXPORTS LEGACY
export type MusicGenre = MacroGenre;
export type MusicSubgenre = 'none';

export interface GenreFeatures {
  bpm: number;
  syncopation: number;
  hasFourOnFloor: boolean;
  hasDembow: boolean;
  trebleDensity: number;
  has808Bass: boolean;
  avgEnergy: number;
}

export type GenreMood = 'energetic' | 'chill' | 'dark' | 'festive';

export default GenreClassifier;
