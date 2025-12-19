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
  // 🔧 WAVE 47.1.4: ELECTROLATINO eliminado como default - ahora ELECTRONIC_4X4
  private scores: Record<MacroGenre, number> = {
    'ELECTRONIC_4X4': 25,       // 🔧 Default balanceado
    'ELECTRONIC_BREAKS': 25,    
    'LATINO_TRADICIONAL': 0,    
    'LATINO_URBANO': 0,         
    'ELECTROLATINO': 0          // 🔧 Ya no tiene ventaja inicial
  };

  private currentGenre: MacroGenre = 'ELECTRONIC_4X4'; // 🔧 WAVE 47.1.4: Default a Techno (no ELECTROLATINO)
  private lastGenre: MacroGenre = 'ELECTRONIC_4X4';    // 💫 WAVE 47.1.4: Para inercia en zona de incertidumbre
  private lastCandidateWasFallback: boolean = false;   // 💫 WAVE 47.1.5: Flag para democracy fix
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
    
    // 🔧 WAVE 47.1.7: MOOD BASADO EN GÉNERO, NO EN ENERGY INSTANTÁNEA
    // El mood de un DJ set no cambia cada segundo - es contextual al género.
    // La energía varía constantemente, pero Dark Techno sigue siendo "dark".
    let mood: GenreAnalysis['mood'] = 'chill';
    
    // Mood por TIPO de género (estable durante toda la sesión)
    if (this.currentGenre === 'ELECTRONIC_4X4') {
      // Techno/House: dark por defecto, energetic solo si energy MUY alta sostenida
      mood = 'dark';
    } else if (this.currentGenre === 'ELECTRONIC_BREAKS') {
      // DnB/Jungle: siempre energetic (es explosivo por naturaleza)
      mood = 'energetic';
    } else if (this.currentGenre === 'LATINO_TRADICIONAL' || this.currentGenre === 'LATINO_URBANO') {
      // Latino: siempre festive
      mood = 'festive';
    } else if (this.currentGenre === 'ELECTROLATINO') {
      // Electrolatino: festive con toque energetic
      mood = 'festive';
    }
    // El 'chill' queda como fallback para géneros desconocidos

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
   * 💫 WAVE 47.1.5: Setea lastCandidateWasFallback para democracy fix
   */
  private getInstantCandidate(
    bpm: number, 
    sync: number, 
    energy: number, 
    treble: number, 
    kick: number, 
    snare: number
  ): MacroGenre {
    
    // 💫 WAVE 47.1.5: Asumir detección legítima (no fallback)
    // Solo el último return (zona gris) lo setea en true
    this.lastCandidateWasFallback = false;
    
    // GAUCHO FIX: Normalización de BPM para Cumbia Rápida vs Techno rápido
    // 🔧 WAVE 47.1.5: GAUCHO SYNC GUARD - Proteger Minimal Techno
    // Solo dividir si:
    // 1. BPM > 155 (podría ser conteo doble)
    // 2. Energy < 0.7 (cumbia no es explosiva como techno)
    // 3. Treble > 0.30 (muchos agudos de percusión latina)
    // 4. Sync > 0.60 (🔧 Era 0.40, muy bajo. Minimal Techno tiene sync ~0.50)
    // 5. Kick < 0.50 (cumbia no tiene bombo tan marcado como techno)
    let evalBpm = bpm;
    const looksLikeFastCumbia = 
      bpm > 155 && 
      energy < 0.70 && 
      treble > 0.30 && 
      sync > 0.60 &&   // 🔧 WAVE 47.1.5: Era 0.40, ahora 0.60 para proteger Minimal Techno
      kick < 0.50;
    
    if (looksLikeFastCumbia) {
      evalBpm = bpm / 2;
    }

    // A. ZONA DE ALTA ENERGÍA Y VELOCIDAD (DnB / Jungle)
    // 🔧 WAVE 47.1.6: Subir threshold de energy a 0.80 para evitar falsos positivos con Techno
    // DnB real tiene energy sostenida muy alta (>0.80), Techno varía más
    if (evalBpm > 160 && energy > 0.80 && sync > 0.50) {
      return 'ELECTRONIC_BREAKS';
    }
    
    // 🔧 WAVE 47.1.6: ZONA FAST TECHNO EXPANDIDA (Boris Brejcha, Amelie Lens, Charlotte de Witte)
    // BPM alto (145-210), Sync flexible (puede variar mucho en breakdowns)
    // Eliminamos requisito de kick porque drums.kickIntensity no existe en los datos
    if (evalBpm >= 145 && evalBpm <= 210) {
      // Si sync es bajo-medio (<0.65), es techno recto
      // Si sync es medio-alto pero energy < 0.80, también es techno (no DnB)
      if (sync < 0.65 || (sync < 0.70 && energy < 0.80)) {
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
    // 🔧 WAVE 47.1.4: ELIMINACIÓN DEL FALLBACK ELECTROLATINO
    // Si la sync está en zona gris (no encaja en ningún perfil claro),
    // aplicamos INERCIA: mantener la decisión anterior.
    // Esto evita el flickeo Festive/Dark causado por inventar ELECTROLATINO.
    
    // Sub-caso: Urbano de alta sync pero BPM bajo (detección legítima, no fallback)
    if (sync > 0.6 && evalBpm < 140) {
      return 'LATINO_URBANO';
    }
    
    // 🛡️ PROTECCIÓN GENERAL: Si no sabemos qué es, NO INVENTAMOS.
    // 💫 WAVE 47.1.5: DEMOCRACY FIX - Marcar como fallback para NO VOTAR en updateScores
    this.lastCandidateWasFallback = true;  // 🚨 Señal para no sumar puntos
    return this.lastGenre;
  }

  /**
   * Aplica decadencia y suma votos
   */
  private updateScores(candidate: MacroGenre) {
    const genres = Object.keys(this.scores) as MacroGenre[];
    
    // 💫 WAVE 47.1.5: DEMOCRACY FIX
    // Si el candidato vino de fallback (zona gris), NO votamos.
    // Solo aplicamos decay, permitiendo que cualquier género sólido gane.
    const shouldVote = !this.lastCandidateWasFallback;
    
    for (const genre of genres) {
      // 1. Decadencia natural (Olvido) - SIEMPRE aplica
      this.scores[genre] -= SENATE_CONFIG.DECAY_RATE;
      
      // 2. Voto positivo - SOLO si no es fallback
      // 💫 WAVE 47.1.5: Evita dictadura (auto-voto perpetuo en breakdowns)
      if (shouldVote && genre === candidate) {
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
        // 💫 WAVE 47.1.4: Guardar género previo para inercia en zona gris
        this.lastGenre = this.currentGenre;
        
        // Golpe de estado exitoso
        console.info(`[GenreClassifier] 🏛️ CAMBIO DE MANDO: ${this.currentGenre} (${currentScore.toFixed(0)}) → ${bestGenre} (${bestScore.toFixed(0)})`);
        this.currentGenre = bestGenre;
      }
    } else {
      // 💫 WAVE 47.1.4: Si no hay cambio, también actualizar lastGenre (estabilidad)
      this.lastGenre = this.currentGenre;
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
    // 🔧 WAVE 47.1.4: Default a ELECTRONIC_4X4 (no más ELECTROLATINO)
    this.scores = {
      'ELECTRONIC_4X4': 25,
      'ELECTRONIC_BREAKS': 25,
      'LATINO_TRADICIONAL': 0,
      'LATINO_URBANO': 0,
      'ELECTROLATINO': 0  // 🔧 Ya no tiene ventaja inicial
    };
    this.currentGenre = 'ELECTRONIC_4X4';
    this.lastGenre = 'ELECTRONIC_4X4';
    this.lastCandidateWasFallback = false;  // 💫 WAVE 47.1.5
    this.smoothedSync = 0.35;
    this.frameCount = 0;
  }
}

export default GenreClassifier;