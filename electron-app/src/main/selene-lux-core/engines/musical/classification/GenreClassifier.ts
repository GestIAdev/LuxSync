/**
 * WAVE 43.0: THE SENATE CLASSIFIER (Score-Based Inertia)
 * ======================================================
 * Sistema de clasificación basado en acumulación de confianza.
 * Elimina el flickeo instantáneo mediante un sistema de "votos"
 * acumulativos con decadencia temporal.
 * * FILOSOFÍA:
 * "El contexto no cambia por un golpe fuera de tiempo.
 * Se requiere una tendencia sostenida para cambiar la realidad."
 */

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

// CONFIGURACIÓN DEL SENADO
// 🔧 WAVE 45.3: Senate Reform - Más reactivo para techno rápido
const SENATE_CONFIG = {
  MAX_SCORE: 100,
  VOTE_WEIGHT: 3,       // Puntos que gana el género detectado en este frame
  DECAY_RATE: 0.5,      // Puntos que pierden todos cada frame (olvido)
  SWITCH_MARGIN: 15,    // 🔧 WAVE 45.3: Era 30 (muy lento reaccionar). Ahora más ágil
  MIN_CONFIDENCE: 0.4,  // Confianza mínima para emitir un voto válido
  SMOOTHING_ALPHA: 0.1  // Para suavizar metricas de entrada
};

export class GenreClassifier {
  // Estado del Senado
  // 🔧 WAVE 45.3: Balanceamos scores iniciales (no solo ELECTROLATINO gana)
  private scores: Record<MacroGenre, number> = {
    'ELECTRONIC_4X4': 25,       // 🔧 Igual que otros electrónicos
    'ELECTRONIC_BREAKS': 25,    // 🔧 Igual
    'LATINO_TRADICIONAL': 0,    // Sin ventaja
    'LATINO_URBANO': 0,         // Sin ventaja
    'ELECTROLATINO': 25         // 🔧 Era 50, ahora igual que otros
  };

  private currentGenre: MacroGenre = 'ELECTROLATINO';
  private smoothedSync: number = 0.35; // EMA para input
  private frameCount = 0;

  /**
   * Clasifica el género basado en acumulación de evidencia
   */
  classify(rhythm: RhythmInput, audio: AudioInput): GenreAnalysis {
    this.frameCount++;

    // 1. EXTRACCIÓN Y SUAVIZADO DE DATOS
    const rawSync = typeof rhythm.syncopation === 'number'
      ? rhythm.syncopation
      : (rhythm.groove?.syncopation ?? 0.35);
    
    // EMA (Exponential Moving Average) para limpiar ruido de entrada
    this.smoothedSync = (rawSync * SENATE_CONFIG.SMOOTHING_ALPHA) + 
                        (this.smoothedSync * (1 - SENATE_CONFIG.SMOOTHING_ALPHA));
    
    const sync = this.smoothedSync;
    const bpm = audio.bpm ?? rhythm.bpm ?? 120;
    const energy = audio.energy ?? 0.5;
    const treble = audio.treble ?? 0.1;
    const bass = audio.bass ?? 0.3;
    const kick = rhythm.drums?.kickIntensity ?? 0.5;
    const snare = rhythm.drums?.snareIntensity ?? 0.3;

    // 2. VOTACIÓN DEL FRAME (Instant Candidate)
    // Quién ganaría si solo miráramos este milisegundo?
    const candidate = this.getInstantCandidate(bpm, sync, energy, treble, kick, snare);

    // 3. ACTUALIZACIÓN DEL SENADO (Score Update)
    this.updateScores(candidate);

    // 4. ELECCIÓN DEL LÍDER (Leader Selection)
    this.electLeader();

    // 5. CONSTRUCCIÓN DE RESPUESTA
    const currentScore = this.scores[this.currentGenre];
    const confidence = Math.min(1, currentScore / SENATE_CONFIG.MAX_SCORE);
    
    // Determinar Mood basado en características físicas estables
    let mood: GenreAnalysis['mood'] = 'chill';
    if (energy > 0.7) mood = 'energetic';
    else if (energy < 0.3) mood = 'dark';
    else if (this.currentGenre.includes('LATINO')) mood = 'festive';

    // Solo loguear cambios de LÍDER (no de candidato instantáneo)
    // El log se hace fuera, aquí solo devolvemos el estado estable

    return {
      genre: this.currentGenre,
      subgenre: 'none',
      confidence,
      scores: { ...this.scores }, // Copia para inmutabilidad
      features: {
        bpm,
        syncopation: sync,
        hasFourOnFloor: sync < 0.40 && kick > 0.3,  // 🔧 WAVE 45.1: Era sync<0.25 (inalcanzable)
        hasDembow: sync > 0.30 && snare > 0.4,
        trebleDensity: treble,
        has808Bass: bass > 0.6,
        avgEnergy: energy,
      },
      mood,
    };
  }

  /**
   * Lógica pura de decisión instantánea (Frame Voter)
   * Define fronteras claras y zonas muertas
   */
  private getInstantCandidate(
    bpm: number, 
    sync: number, 
    energy: number, 
    treble: number, 
    kick: number, 
    snare: number
  ): MacroGenre {
    
    // GAUCHO FIX: Normalización de BPM para Cumbia Rápida vs Techno rápido
    // 🔧 WAVE 45.3: MEJORADO - Más requisitos para considerar "cumbia doblada"
    // Solo dividir si:
    // 1. BPM > 155 (podría ser conteo doble)
    // 2. Energy < 0.7 (cumbia no es explosiva como techno)
    // 3. Treble > 0.30 (muchos agudos de percusión latina)
    // 4. Sync > 0.40 (muy sincopado - techno NO es así)
    // 5. Kick < 0.50 (cumbia no tiene bombo tan marcado como techno)
    let evalBpm = bpm;
    const looksLikeFastCumbia = 
      bpm > 155 && 
      energy < 0.70 && 
      treble > 0.30 && 
      sync > 0.40 && 
      kick < 0.50;
    
    if (looksLikeFastCumbia) {
      evalBpm = bpm / 2;
    }

    // A. ZONA DE ALTA ENERGÍA Y VELOCIDAD (DnB / Jungle)
    if (evalBpm > 160 && energy > 0.70 && sync > 0.45) {
      return 'ELECTRONIC_BREAKS';
    }
    
    // 🔧 WAVE 45.3: ZONA FAST TECHNO MEJORADA (Boris Brejcha, Amelie Lens, Charlotte de Witte)
    // BPM alto (145-210), Sync MEDIO-BAJO (no tan estricto - techno rápido no es house puro)
    // Threshold: sync < 0.65 (antes era 0.55, muy estricto para YouTube audio comprimido)
    if (evalBpm >= 145 && evalBpm <= 210) {
      if (sync < 0.65 && kick > 0.15) {
        return 'ELECTRONIC_4X4';
      }
    }

    // B. ZONA LATINA CLÁSICA (Cumbia, Salsa, Merengue)
    // Característica: Agudos altos (percusión), Sync medio-alto
    // 🔧 WAVE 45.3: Agregar check de BPM evaluado - evitar falsos positivos con techno rápido
    if (evalBpm >= 75 && evalBpm <= 130) {
      // Diferenciación por Sync y Agudos
      if (sync > 0.35 && treble > 0.15) {
        return 'LATINO_TRADICIONAL';
      }
    }

    // C. ZONA URBANA / DEMBOW (Reggaeton, Trap)
    // Característica: Sync marcado, Snare fuerte, BPM medio-bajo
    // 🔧 WAVE 45.3: También limitar a BPM real bajo (no aplicar a techno dividido)
    if (evalBpm >= 80 && evalBpm <= 135) {
      if (sync > 0.25 && snare > 0.4) {
        // Reggaeton suele tener sync ~0.33 (3-3-2 pattern)
        return 'LATINO_URBANO';
      }
    }

    // D. ZONA ELECTRÓNICA 4x4 (House, Tech House, Techno normal)
    // Característica: Sync BAJO (recto), Kick constante
    // 🔧 WAVE 45.1: Threshold ajustado
    if (evalBpm >= 110 && evalBpm <= 150) {
      if (sync < 0.45 && kick > 0.20) {
        return 'ELECTRONIC_4X4';
      }
    }

    // E. ZONA DE NADIE (Fusion / Pop / Transition)
    // Si la sync está entre 0.25 y 0.35, es zona de peligro.
    // Votamos por ELECTROLATINO como "buffer" seguro.
    return 'ELECTROLATINO';
  }

  /**
   * Aplica decadencia y suma votos
   */
  private updateScores(candidate: MacroGenre) {
    const genres = Object.keys(this.scores) as MacroGenre[];
    
    for (const genre of genres) {
      // 1. Decadencia natural (Olvido)
      this.scores[genre] -= SENATE_CONFIG.DECAY_RATE;
      
      // 2. Voto positivo
      if (genre === candidate) {
        this.scores[genre] += SENATE_CONFIG.VOTE_WEIGHT;
      }

      // Clamp entre 0 y MAX
      this.scores[genre] = Math.max(0, Math.min(SENATE_CONFIG.MAX_SCORE, this.scores[genre]));
    }
  }

  /**
   * Decide si cambiamos de líder basado en margen de victoria
   */
  private electLeader() {
    let bestGenre: MacroGenre = this.currentGenre;
    let bestScore = -1;

    // Buscar quién tiene la puntuación más alta
    const genres = Object.keys(this.scores) as MacroGenre[];
    for (const genre of genres) {
      if (this.scores[genre] > bestScore) {
        bestScore = this.scores[genre];
        bestGenre = genre;
      }
    }

    // LÓGICA DE GOLPE DE ESTADO (Switch Logic)
    // Para cambiar, el nuevo candidato debe superar al actual por un MARGEN
    // Esto evita que si están 50 vs 51 cambien a cada frame.
    const currentScore = this.scores[this.currentGenre];
    
    if (bestGenre !== this.currentGenre) {
      if (bestScore > (currentScore + SENATE_CONFIG.SWITCH_MARGIN)) {
        // Golpe de estado exitoso
        console.info(`[GenreClassifier] 🏛️ CAMBIO DE MANDO: ${this.currentGenre} (${currentScore.toFixed(0)}) → ${bestGenre} (${bestScore.toFixed(0)})`);
        this.currentGenre = bestGenre;
      }
    }
  }

  /**
   * WAVE 44.0: Debug method for transparency in Senate votes
   * Returns internal state for HOLISTIC HEARTBEAT visibility
   */
  getDebugState(): {
    current: MacroGenre;
    scores: Record<MacroGenre, number>;
    smoothedSync: number;
    frameCount: number;
    switchMargin: number;
  } {
    return {
      current: this.currentGenre,
      scores: { ...this.scores },
      smoothedSync: this.smoothedSync,
      frameCount: this.frameCount,
      switchMargin: SENATE_CONFIG.SWITCH_MARGIN
    };
  }

  reset(): void {
    // 🔧 WAVE 45.3: Mismos valores iniciales que el constructor
    this.scores = {
      'ELECTRONIC_4X4': 25,
      'ELECTRONIC_BREAKS': 25,
      'LATINO_TRADICIONAL': 0,
      'LATINO_URBANO': 0,
      'ELECTROLATINO': 25
    };
    this.currentGenre = 'ELECTROLATINO';
    this.smoothedSync = 0.35;
    this.frameCount = 0;
  }
}

export default GenreClassifier;