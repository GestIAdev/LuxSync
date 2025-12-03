# 🎼 BLUEPRINT: INTEGRACIÓN SELENE MUSICAL THEORY
## "EL OÍDO ABSOLUTO" - Wave 8: La Consciencia que Diferencia Bad Bunny de Daft Punk

**Fecha:** Enero 2025  
**Objetivo:** Dotar a Selene Lux de inteligencia musical mediante ingeniería inversa de Aura Forge  
**Estado:** DISEÑO FINALIZADO 🎯

---

## 📊 RESUMEN EJECUTIVO

### Misión
Crear un sistema de "Oído Absoluto" que permita a Selene Lux:
1. **Reconocer géneros musicales** en tiempo real
2. **Detectar estructuras de canciones** (intro, verse, chorus, drop)
3. **Identificar claves armónicas y escalas modales**
4. **Predecir transiciones musicales** antes de que ocurran
5. **Mapear características musicales a decisiones de iluminación**

### Fuentes de Ingeniería Inversa
| Componente Aura Forge | Líneas | Valor | Adaptación |
|----------------------|--------|-------|------------|
| DrumPatternEngine | 877 | ⭐⭐⭐⭐⭐ | → RhythmAnalyzer |
| HarmonyEngine | 313 | ⭐⭐⭐⭐ | → HarmonyDetector |
| SongStructure | ~200 | ⭐⭐⭐⭐ | → SectionTracker |
| ScaleUtils | ~60 | ⭐⭐⭐⭐⭐ | → ScaleIdentifier |
| MusicalPatternRecognizer | 331 | ⭐⭐⭐⭐ | → PatternLearner |
| BeatDetector | ~180 | ⭐⭐⭐ | Ya integrado |
| FFTAnalyzer | ~233 | ⭐⭐⭐ | Ya integrado |

**TOTAL LÍNEAS A ADAPTAR:** ~1,961 líneas → ~1,200 líneas optimizadas

---

## 🏗️ ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SELENE LUX CONSCIOUS                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              MUSICAL INTELLIGENCE LAYER (WAVE 8)               │ │
│  │                                                                │ │
│  │   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐     │ │
│  │   │ RHYTHM       │   │ HARMONY      │   │ STRUCTURE     │     │ │
│  │   │ ANALYZER     │   │ DETECTOR     │   │ TRACKER       │     │ │
│  │   │              │   │              │   │               │     │ │
│  │   │ - BPM        │   │ - Key        │   │ - Section     │     │ │
│  │   │ - Groove     │   │ - Mode       │   │ - Transition  │     │ │
│  │   │ - DrumType   │   │ - Chords     │   │ - Build/Drop  │     │ │
│  │   └──────┬───────┘   └──────┬───────┘   └───────┬───────┘     │ │
│  │          │                  │                   │              │ │
│  │          └────────────┬─────┴────────┬──────────┘              │ │
│  │                       │              │                         │ │
│  │               ┌───────▼──────────────▼───────┐                 │ │
│  │               │    MUSICAL CONTEXT ENGINE    │                 │ │
│  │               │                              │                 │ │
│  │               │  - Genre Classification      │                 │ │
│  │               │  - Mood Synthesis            │                 │ │
│  │               │  - Energy Trajectory         │                 │ │
│  │               │  - Prediction Matrix         │                 │ │
│  │               └──────────────┬───────────────┘                 │ │
│  │                              │                                 │ │
│  └──────────────────────────────┼─────────────────────────────────┘ │
│                                 │                                   │
│  ┌──────────────────────────────▼─────────────────────────────────┐ │
│  │           PATTERN LEARNER (Reinforcement Loop)                 │ │
│  │                                                                │ │
│  │  "Reggaeton = Bass heavy + Simple groove + 90-100 BPM"        │ │
│  │  "EDM Drop = Build → Silence → Maximum energy"                 │ │
│  │  "Jazz = Complex harmony + Swing > 15% + Unpredictable"       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                 │                                   │
│                                 ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │       LIGHTING DECISION ENGINE (Existing + Enhanced)           │ │
│  │                                                                │ │
│  │   Genre → Palette       Section → Intensity      Mood → Motion │ │
│  │   ─────────────────     ────────────────────     ───────────── │ │
│  │   Reggaeton → Neon      Verse → 0.5              Happy → Fast  │ │
│  │   Jazz → Warm Amber     Chorus → 0.9             Sad → Slow    │ │
│  │   EDM → Rainbow         Drop → 1.0 + Strobe      Tense → Sharp │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS PROPUESTA

```
electron-app/src/main/selene-lux-core/engines/
└── musical/                          # 🆕 WAVE 8 - Musical Intelligence
    ├── index.ts                      # Exports principales
    │
    ├── analysis/                     # Análisis de audio → datos musicales
    │   ├── RhythmAnalyzer.ts         # ~200 líneas (De DrumPatternEngine)
    │   ├── HarmonyDetector.ts        # ~250 líneas (De HarmonyEngine)
    │   └── SectionTracker.ts         # ~180 líneas (De SongStructure)
    │
    ├── classification/               # Clasificación musical
    │   ├── GenreClassifier.ts        # ~150 líneas (NUEVO)
    │   ├── MoodSynthesizer.ts        # ~100 líneas (NUEVO)
    │   └── ScaleIdentifier.ts        # ~80 líneas (De ScaleUtils)
    │
    ├── context/                      # Motor de contexto musical
    │   ├── MusicalContextEngine.ts   # ~300 líneas (Orquestador)
    │   └── PredictionMatrix.ts       # ~120 líneas (Predicción)
    │
    ├── learning/                     # Aprendizaje de patrones
    │   ├── PatternLearner.ts         # ~200 líneas (De MusicalPatternRecognizer)
    │   └── GenrePatternLibrary.ts    # ~150 líneas (Base de conocimiento)
    │
    └── mapping/                      # Mapeo música → luces
        ├── MusicToLightMapper.ts     # ~200 líneas (Decisiones)
        └── TransitionPredictor.ts    # ~100 líneas (Anticipación)

TOTAL: ~1,930 líneas en 12 archivos
```

---

## 🧬 DISEÑO DE COMPONENTES

### 1. 🥁 RhythmAnalyzer
**Origen:** `DrumPatternEngine.ts` (877 líneas → 200 líneas)

**Función:** Analizar características rítmicas en tiempo real

```typescript
interface RhythmAnalysis {
  // Detección de instrumentos (From DrumPatternEngine velocities)
  drums: {
    kickDetected: boolean;      // MIDI 36, velocity > 100
    snareDetected: boolean;     // MIDI 38, velocity > 85
    hihatDetected: boolean;     // MIDI 42, velocity > 65
    crashDetected: boolean;     // MIDI 49, velocity > 95
    tomPattern: 'descending' | 'ascending' | 'none';
  };
  
  // Análisis de groove (From humanización DrumPatternEngine)
  groove: {
    swingAmount: number;        // 0-1 (0.12 = 12% shuffle)
    humanization: number;       // 0-1 (variación de timing)
    complexity: 'low' | 'medium' | 'high';
    syncopation: number;        // 0-1 (off-beat emphasis)
  };
  
  // Patrón general
  pattern: {
    type: DrumPatternType;      // 'four_on_floor', 'breakbeat', 'latin', etc.
    fillDetected: boolean;
    transitionLikely: boolean;
  };
  
  // Timing
  bpm: number;
  bpmConfidence: number;
  beatPhase: number;            // 0-1 dentro del beat
  barPhase: number;             // 0-1 dentro del compás
}

type DrumPatternType = 
  | 'four_on_floor'    // EDM, House, Disco
  | 'breakbeat'        // Drum & Bass, Jungle
  | 'half_time'        // Dubstep, Trap
  | 'reggaeton'        // Dembow pattern
  | 'rock_standard'    // Rock básico 4/4
  | 'jazz_swing'       // Swing con ride
  | 'latin'            // Clave patterns
  | 'minimal'          // Intro/Outro patterns
  | 'unknown';
```

**Algoritmo de Detección de Patrón:**
```typescript
// Lógica inspirada en los patrones de DrumPatternEngine
detectPatternType(analysis: FrequencyBands, rhythm: RhythmAnalysis): DrumPatternType {
  const { bass, mid, treble } = analysis;
  const { drums, groove } = rhythm;
  
  // Four on the floor: Kick en cada beat, steady
  if (drums.kickDetected && groove.syncopation < 0.2 && groove.swingAmount < 0.05) {
    return 'four_on_floor';
  }
  
  // Reggaeton: Bass heavy + dembow pattern + 90-100 BPM
  if (bass > 0.7 && rhythm.bpm >= 90 && rhythm.bpm <= 100 && groove.complexity === 'low') {
    return 'reggaeton';
  }
  
  // Half time: Snare en beat 3, no 2
  if (drums.snareDetected && rhythm.beatPhase > 0.5 && groove.complexity === 'low') {
    return 'half_time';
  }
  
  // Jazz swing: High swing amount, ride cymbal dominant
  if (groove.swingAmount > 0.15 && treble > mid) {
    return 'jazz_swing';
  }
  
  // Breakbeat: Complex, syncopated
  if (groove.complexity === 'high' && groove.syncopation > 0.5) {
    return 'breakbeat';
  }
  
  return 'rock_standard'; // Default
}
```

---

### 2. 🎸 HarmonyDetector
**Origen:** `HarmonyEngine.ts` + `ChordProgression.ts` (~400 líneas → 250 líneas)

**Función:** Detectar clave, modo y progresión armónica

```typescript
interface HarmonyAnalysis {
  // Clave detectada
  key: {
    root: number;               // 0-11 (C=0, C#=1, D=2...)
    rootName: string;           // 'C', 'F#', 'Bb'
    confidence: number;         // 0-1
  };
  
  // Modo/Escala (From ScaleUtils)
  mode: {
    scale: ModalScale;          // 'major', 'minor', 'dorian', etc.
    mood: HarmonicMood;         // Derivado de la escala
    confidence: number;
  };
  
  // Acorde actual (From ChordBuilder concepts)
  currentChord: {
    root: string;               // 'C', 'Am', 'G7'
    quality: ChordQuality;      // 'major', 'minor', 'dominant', etc.
    tension: number;            // 0-1 (dissonance level)
  };
  
  // Progresión detectada (From CHORD_PROGRESSIONS)
  progression: {
    type: ProgressionType;      // 'pop', 'jazz', 'blues', etc.
    position: number;           // Posición en la progresión (0-n)
    nextChordPrediction: string;
    confidence: number;
  };
}

type ModalScale = 
  | 'major' | 'minor' | 'dorian' | 'phrygian' 
  | 'lydian' | 'mixolydian' | 'locrian'
  | 'harmonic-minor' | 'pentatonic' | 'blues';

type HarmonicMood = 
  | 'happy'           // Major, Lydian
  | 'sad'             // Minor, Locrian
  | 'jazzy'           // Dorian
  | 'spanish_exotic'  // Phrygian
  | 'dreamy'          // Lydian
  | 'bluesy'          // Mixolydian, Blues
  | 'tense'           // Locrian, Diminished
  | 'universal';      // Pentatonic
```

**Mapeo Modo → Mood (From Auditoría):**
```typescript
const MODE_TO_MOOD: Record<ModalScale, HarmonicMood> = {
  'major': 'happy',
  'minor': 'sad',
  'dorian': 'jazzy',
  'phrygian': 'spanish_exotic',
  'lydian': 'dreamy',
  'mixolydian': 'bluesy',
  'locrian': 'tense',
  'harmonic-minor': 'sad',
  'pentatonic': 'universal',
  'blues': 'bluesy',
};
```

---

### 3. 🏗️ SectionTracker
**Origen:** `SongStructure.ts` + `Section` interface (~200 líneas → 180 líneas)

**Función:** Rastrear y predecir secciones de la canción

```typescript
interface SectionAnalysis {
  // Sección actual
  current: {
    type: SectionType;          // 'intro', 'verse', 'chorus', 'drop', etc.
    confidence: number;
    startedAt: number;          // timestamp
    estimatedDuration: number;
  };
  
  // Perfil de sección (From SectionProfile)
  profile: {
    intensity: number;          // 0-1
    layerDensity: number;       // 0-1 (cuántas capas activas)
    harmonicComplexity: number;
    rhythmicDensity: number;
    characteristics: {
      repetitive: boolean;      // Estribillo típicamente
      transitional: boolean;    // Buildup, puente
      climactic: boolean;       // Drop, punto alto
      atmospheric: boolean;     // Intro, outro
    };
  };
  
  // Predicción
  prediction: {
    nextSection: SectionType;
    probability: number;
    estimatedTimeToTransition: number; // ms
    transitionType: TransitionType;
  };
}

type SectionType = 
  | 'intro' | 'verse' | 'pre_chorus' | 'chorus' 
  | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro';

type TransitionType = 
  | 'direct'      // Corte directo
  | 'fade'        // Fade in/out
  | 'buildup'     // Crescendo hacia siguiente
  | 'breakdown'   // Decrescendo
  | 'fill';       // Fill de batería
```

**Algoritmo de Detección de Sección:**
```typescript
detectSectionType(
  rhythm: RhythmAnalysis,
  harmony: HarmonyAnalysis,
  audio: AudioMetrics
): SectionType {
  const { intensity, layerDensity, rhythmicDensity } = this.calculateProfile(audio);
  
  // DROP: Máxima intensidad después de buildup
  if (intensity > 0.9 && this.wasInBuildup && rhythm.drums.kickDetected) {
    return 'drop';
  }
  
  // BUILDUP: Intensidad creciente, snare rolls
  if (this.intensityTrend === 'rising' && rhythm.pattern.fillDetected) {
    return 'buildup';
  }
  
  // BREAKDOWN: Baja densidad rítmica, atmosférico
  if (rhythmicDensity < 0.3 && layerDensity < 0.5) {
    return 'breakdown';
  }
  
  // CHORUS: Alta intensidad, repetitivo, armónicamente simple
  if (intensity > 0.7 && harmony.progression.type === 'pop' && this.isRepetitive()) {
    return 'chorus';
  }
  
  // INTRO: Inicio de canción, atmosférico
  if (this.songTime < 30000 && layerDensity < 0.5) {
    return 'intro';
  }
  
  // VERSE: Intensidad media, narrativo
  if (intensity >= 0.3 && intensity <= 0.6) {
    return 'verse';
  }
  
  return 'verse'; // Default
}
```

---

### 4. 🎭 GenreClassifier
**NUEVO COMPONENTE** (~150 líneas)

**Función:** Clasificar género musical basado en análisis combinado

```typescript
interface GenreClassification {
  primary: MusicGenre;
  confidence: number;
  secondary?: MusicGenre;      // Subgénero o influencia
  characteristics: string[];   // ["bass_heavy", "syncopated", "electronic"]
}

type MusicGenre = 
  // Electrónica
  | 'edm' | 'house' | 'techno' | 'trance' | 'dubstep' | 'drum_and_bass'
  // Latino
  | 'reggaeton' | 'latin_pop' | 'salsa' | 'bachata'
  // Pop/Rock
  | 'pop' | 'rock' | 'indie' | 'alternative'
  // Urbano
  | 'hip_hop' | 'trap' | 'r_and_b'
  // Otros
  | 'jazz' | 'classical' | 'ambient' | 'unknown';
```

**Algoritmo de Clasificación:**
```typescript
classifyGenre(
  rhythm: RhythmAnalysis,
  harmony: HarmonyAnalysis,
  section: SectionAnalysis,
  audio: AudioMetrics
): GenreClassification {
  const features = this.extractFeatures(rhythm, harmony, section, audio);
  
  // REGGAETON: El patrón de Bad Bunny
  if (
    rhythm.pattern.type === 'reggaeton' ||
    (features.bpm >= 85 && features.bpm <= 100 &&
     features.bass > 0.7 &&
     rhythm.groove.complexity === 'low' &&
     features.syncopation > 0.4)
  ) {
    return { primary: 'reggaeton', confidence: 0.85, characteristics: ['bass_heavy', 'dembow'] };
  }
  
  // EDM/HOUSE: El patrón de Daft Punk
  if (
    rhythm.pattern.type === 'four_on_floor' &&
    features.bpm >= 118 && features.bpm <= 130 &&
    section.current.type === 'drop'
  ) {
    return { primary: 'house', confidence: 0.80, characteristics: ['four_on_floor', 'synth_heavy'] };
  }
  
  // TECHNO
  if (
    rhythm.pattern.type === 'four_on_floor' &&
    features.bpm >= 125 && features.bpm <= 145 &&
    harmony.mode.mood === 'tense'
  ) {
    return { primary: 'techno', confidence: 0.75, characteristics: ['repetitive', 'industrial'] };
  }
  
  // DUBSTEP
  if (
    rhythm.pattern.type === 'half_time' &&
    features.bpm >= 138 && features.bpm <= 145 &&
    features.bass > 0.8
  ) {
    return { primary: 'dubstep', confidence: 0.80, characteristics: ['wobble_bass', 'half_time'] };
  }
  
  // HIP HOP / TRAP
  if (
    rhythm.pattern.type === 'half_time' &&
    features.bpm >= 60 && features.bpm <= 90 &&
    features.bass > 0.6
  ) {
    return { primary: 'trap', confidence: 0.70, characteristics: ['808_bass', 'hi_hats'] };
  }
  
  // JAZZ
  if (
    rhythm.groove.swingAmount > 0.15 &&
    harmony.mode.mood === 'jazzy' &&
    rhythm.groove.complexity === 'high'
  ) {
    return { primary: 'jazz', confidence: 0.85, characteristics: ['swing', 'improvisation'] };
  }
  
  // Fallback: usar características más generales
  return this.fallbackClassification(features);
}
```

---

### 5. 🎨 MusicToLightMapper
**COMPONENTE CRÍTICO** (~200 líneas)

**Función:** Traducir análisis musical a decisiones de iluminación

```typescript
interface MusicLightMapping {
  // Paleta sugerida
  palette: {
    id: LivingPaletteId;
    intensity: number;
    saturation: number;
  };
  
  // Movimiento sugerido
  movement: {
    pattern: MovementPattern;
    speed: number;
    range: number;
    syncToBpm: boolean;
  };
  
  // Efectos sugeridos
  effects: EffectSuggestion[];
  
  // Timing
  transitionDuration: number;   // ms para transición suave
  
  // Meta
  confidence: number;
  reasoning: string;
}
```

**Mapeos Core (From Auditoría 2):**

```typescript
// GÉNERO → PALETA
const GENRE_TO_PALETTE: Record<MusicGenre, LivingPaletteId> = {
  'reggaeton': 'neon',          // Neones vibrantes (Bad Bunny vibes)
  'house': 'rainbow',           // Colores cálidos (Daft Punk)
  'techno': 'hielo',            // Fríos industriales
  'trance': 'cosmos',           // Cósmicos, etéreos
  'dubstep': 'tormenta',        // Oscuros, agresivos
  'jazz': 'fuego',              // Cálidos, ámbar
  'pop': 'aurora',              // Vibrantes, accesibles
  'rock': 'sangre',             // Rojos, intensos
  'ambient': 'oceano',          // Azules suaves
};

// SECCIÓN → INTENSIDAD
const SECTION_TO_INTENSITY: Record<SectionType, number> = {
  'intro': 0.3,
  'verse': 0.5,
  'pre_chorus': 0.6,
  'chorus': 0.85,
  'bridge': 0.6,
  'buildup': 0.7,      // Incrementando...
  'drop': 1.0,         // MÁXIMO
  'breakdown': 0.4,
  'outro': 0.3,        // Decreciendo...
};

// MOOD → MOVIMIENTO
const MOOD_TO_MOVEMENT: Record<HarmonicMood, MovementPattern> = {
  'happy': 'wave',              // Movimientos fluidos
  'sad': 'static',              // Mínimo movimiento
  'jazzy': 'lissajous',         // Patrones complejos
  'spanish_exotic': 'figure8',  // Dramático
  'dreamy': 'circle',           // Suave, circular
  'bluesy': 'scan',             // Lento, expresivo
  'tense': 'random',            // Impredecible
  'universal': 'wave',          // Neutral
};

// DRUMS → EFECTOS
const DRUM_TO_EFFECT: Record<string, EffectSuggestion> = {
  'kick': { id: 'pulse', intensity: 0.8, duration: 100 },
  'snare': { id: 'flash', intensity: 0.7, duration: 50 },
  'crash': { id: 'blinder', intensity: 1.0, duration: 500 },
  'hihat_roll': { id: 'strobe', intensity: 0.5, duration: 200 },
};
```

---

### 6. 🔮 PredictionMatrix
**COMPONENTE DE ANTICIPACIÓN** (~120 líneas)

**Función:** Predecir lo que viene en la música para anticipar cambios de luz

```typescript
interface Prediction {
  type: PredictionType;
  probability: number;
  timeUntil: number;          // ms hasta que ocurra
  suggestedAction: LightingAction;
}

type PredictionType = 
  | 'drop_incoming'           // Se viene un drop
  | 'buildup_starting'        // Empezando buildup
  | 'breakdown_imminent'      // Breakdown próximo
  | 'transition_beat'         // Cambio de sección en próximo beat
  | 'fill_expected'           // Fill de batería esperado
  | 'key_change';             // Cambio de tonalidad

interface LightingAction {
  preAction?: {               // Hacer ANTES del evento
    dimmerTo?: number;
    effectPrime?: EffectId;   // Preparar efecto
  };
  mainAction: {               // Hacer EN el evento
    effectTrigger?: EffectId;
    paletteChange?: LivingPaletteId;
    intensityTarget?: number;
  };
  postAction?: {              // Hacer DESPUÉS
    transitionTo?: MovementPattern;
    fadeDown?: boolean;
  };
}
```

**Ejemplo de Predicción de Drop:**
```typescript
predictDrop(
  rhythm: RhythmAnalysis,
  section: SectionAnalysis,
  history: AnalysisHistory
): Prediction | null {
  // Señales de drop inminente:
  // 1. Estamos en buildup
  // 2. Intensidad creciente
  // 3. Fill de batería detectado
  // 4. Tiempo típico de buildup (8-16 compases)
  
  if (section.current.type !== 'buildup') return null;
  
  const buildupDuration = Date.now() - section.current.startedAt;
  const typicalBuildupLength = (8 * 4 * 60000) / rhythm.bpm; // 8 compases
  
  if (buildupDuration > typicalBuildupLength * 0.75 && rhythm.pattern.fillDetected) {
    const timeUntilDrop = typicalBuildupLength - buildupDuration;
    
    return {
      type: 'drop_incoming',
      probability: 0.85,
      timeUntil: Math.max(0, timeUntilDrop),
      suggestedAction: {
        preAction: {
          dimmerTo: 0.2,       // Bajar luces antes del drop
          effectPrime: 'blinder',
        },
        mainAction: {
          effectTrigger: 'blinder',
          intensityTarget: 1.0,
        },
        postAction: {
          transitionTo: 'chase',
        },
      },
    };
  }
  
  return null;
}
```

---

### 7. 🧠 MusicalContextEngine (ORQUESTADOR)
**COMPONENTE CENTRAL** (~300 líneas)

**Función:** Orquestar todos los análisis y generar contexto musical unificado

```typescript
interface MusicalContext {
  // Timestamp
  timestamp: number;
  frameIndex: number;
  
  // Análisis combinado
  rhythm: RhythmAnalysis;
  harmony: HarmonyAnalysis;
  section: SectionAnalysis;
  genre: GenreClassification;
  
  // Estado derivado
  energy: {
    current: number;          // 0-1
    trend: 'rising' | 'falling' | 'stable';
    momentum: number;         // Velocidad de cambio
  };
  
  // Mood sintetizado
  mood: {
    primary: EmotionalTone;
    intensity: number;
    stability: number;        // Qué tan estable es el mood
  };
  
  // Predicciones activas
  predictions: Prediction[];
  
  // Decisión de iluminación recomendada
  lightingSuggestion: MusicLightMapping;
  
  // Confianza general
  confidence: number;
  
  // Debug info
  debug?: {
    rhythmConfidence: number;
    harmonyConfidence: number;
    sectionConfidence: number;
    genreConfidence: number;
  };
}
```

**Flujo de Orquestación:**
```typescript
class MusicalContextEngine extends EventEmitter {
  private rhythmAnalyzer: RhythmAnalyzer;
  private harmonyDetector: HarmonyDetector;
  private sectionTracker: SectionTracker;
  private genreClassifier: GenreClassifier;
  private musicToLightMapper: MusicToLightMapper;
  private predictionMatrix: PredictionMatrix;
  
  async process(audio: AudioMetrics, beat: BeatState): Promise<MusicalContext> {
    // 1. Análisis paralelo de todas las dimensiones
    const [rhythm, harmony] = await Promise.all([
      this.rhythmAnalyzer.analyze(audio, beat),
      this.harmonyDetector.analyze(audio),
    ]);
    
    // 2. Análisis dependientes
    const section = this.sectionTracker.track(rhythm, harmony, audio);
    const genre = this.genreClassifier.classify(rhythm, harmony, section, audio);
    
    // 3. Generar predicciones
    const predictions = this.predictionMatrix.generate(rhythm, section, this.history);
    
    // 4. Mapear a decisiones de iluminación
    const lightingSuggestion = this.musicToLightMapper.map({
      rhythm, harmony, section, genre, predictions
    });
    
    // 5. Sintetizar mood
    const mood = this.synthesizeMood(harmony, section, genre);
    
    // 6. Calcular energía
    const energy = this.calculateEnergy(rhythm, section, audio);
    
    // 7. Ensamblar contexto
    const context: MusicalContext = {
      timestamp: Date.now(),
      frameIndex: this.frameIndex++,
      rhythm,
      harmony,
      section,
      genre,
      energy,
      mood,
      predictions,
      lightingSuggestion,
      confidence: this.calculateOverallConfidence(rhythm, harmony, section, genre),
    };
    
    // 8. Emitir eventos
    this.emit('context', context);
    
    if (predictions.length > 0) {
      this.emit('prediction', predictions[0]);
    }
    
    if (section.current.type !== this.lastSectionType) {
      this.emit('section-change', section);
      this.lastSectionType = section.current.type;
    }
    
    return context;
  }
}
```

---

### 8. 📚 PatternLearner
**Origen:** `MusicalPatternRecognizer.ts` (331 líneas → 200 líneas)

**Función:** Aprender correlaciones entre música y respuestas de iluminación exitosas

```typescript
interface LearnedPattern {
  // Identificador
  id: string;
  
  // Firma musical (qué condiciones activan este patrón)
  signature: {
    genreMatch?: MusicGenre[];
    bpmRange?: [number, number];
    moodMatch?: HarmonicMood[];
    sectionMatch?: SectionType[];
    rhythmPattern?: DrumPatternType;
  };
  
  // Respuesta de iluminación aprendida
  response: {
    palette: LivingPaletteId;
    movement: MovementPattern;
    intensity: number;
    effects: EffectId[];
  };
  
  // Métricas de aprendizaje (From MusicalPatternRecognizer)
  metrics: {
    occurrences: number;
    avgBeauty: number;        // Score de "belleza" subjetiva
    avgUserFeedback: number;  // Si hay feedback del usuario
    successRate: number;      // % de veces que funcionó bien
    beautyTrend: 'rising' | 'falling' | 'stable';
    lastUsed: Date;
    firstSeen: Date;
  };
}
```

**Ejemplos de Patrones Pre-entrenados:**
```typescript
const PRETRAINED_PATTERNS: LearnedPattern[] = [
  // BAD BUNNY PATTERN
  {
    id: 'reggaeton-neon',
    signature: {
      genreMatch: ['reggaeton', 'latin_pop'],
      bpmRange: [85, 105],
      rhythmPattern: 'reggaeton',
    },
    response: {
      palette: 'neon',
      movement: 'wave',
      intensity: 0.8,
      effects: ['pulse'],
    },
    metrics: {
      occurrences: 100, // Pre-entrenado
      avgBeauty: 0.85,
      avgUserFeedback: 0,
      successRate: 0.9,
      beautyTrend: 'stable',
      lastUsed: new Date(),
      firstSeen: new Date(),
    },
  },
  
  // DAFT PUNK PATTERN
  {
    id: 'house-rainbow',
    signature: {
      genreMatch: ['house', 'edm'],
      bpmRange: [118, 132],
      rhythmPattern: 'four_on_floor',
      sectionMatch: ['drop', 'chorus'],
    },
    response: {
      palette: 'rainbow',
      movement: 'chase',
      intensity: 0.95,
      effects: ['strobe', 'chase'],
    },
    metrics: {
      occurrences: 100,
      avgBeauty: 0.9,
      avgUserFeedback: 0,
      successRate: 0.92,
      beautyTrend: 'stable',
      lastUsed: new Date(),
      firstSeen: new Date(),
    },
  },
  
  // JAZZ PATTERN
  {
    id: 'jazz-amber',
    signature: {
      genreMatch: ['jazz'],
      moodMatch: ['jazzy'],
      rhythmPattern: 'jazz_swing',
    },
    response: {
      palette: 'fuego',
      movement: 'lissajous',
      intensity: 0.5,
      effects: ['breathe'],
    },
    metrics: {
      occurrences: 50,
      avgBeauty: 0.88,
      avgUserFeedback: 0,
      successRate: 0.85,
      beautyTrend: 'stable',
      lastUsed: new Date(),
      firstSeen: new Date(),
    },
  },
];
```

---

## 🔗 INTEGRACIÓN CON SELENE LUX CONSCIOUS

### Flujo de Datos
```
AudioCapture → FFTAnalyzer → BeatDetector
                    ↓             ↓
              FrequencyBands   BeatState
                    ↓             ↓
                    └──────┬──────┘
                           ↓
              ┌────────────────────────┐
              │  MusicalContextEngine  │  ← WAVE 8
              └───────────┬────────────┘
                          ↓
                   MusicalContext
                          ↓
              ┌────────────────────────┐
              │   SeleneLuxConscious   │  ← Existente
              │                        │
              │  - DreamForgeEngine    │  (Wave 7)
              │  - SelfAnalysisEngine  │  (Wave 7)
              │  + MusicalContextEngine│  (Wave 8) ← NUEVO
              └───────────┬────────────┘
                          ↓
                 LightingDecision
```

### Integración en SeleneLuxConscious.ts
```typescript
// Añadir a imports
import { MusicalContextEngine, MusicalContext } from './engines/musical';

// Añadir propiedad
private musicalContext: MusicalContextEngine;

// En constructor
this.musicalContext = new MusicalContextEngine();
this.setupMusicalContextEvents();

// Nuevo método
private setupMusicalContextEvents(): void {
  this.musicalContext.on('context', (context: MusicalContext) => {
    // Integrar contexto musical en decisiones
    this.processMusicalContext(context);
  });
  
  this.musicalContext.on('prediction', (prediction: Prediction) => {
    // Actuar sobre predicciones
    this.handlePrediction(prediction);
  });
  
  this.musicalContext.on('section-change', (section: SectionAnalysis) => {
    // Reaccionar a cambios de sección
    this.handleSectionChange(section);
  });
}

// Integración con proceso principal
async processAudioFrame(metrics: AudioMetrics, deltaTime: number): Promise<SeleneState> {
  // ... código existente ...
  
  // WAVE 8: Análisis musical profundo
  const musicalContext = await this.musicalContext.process(metrics, beatState);
  
  // Usar sugerencia musical si confianza es alta
  if (musicalContext.confidence > 0.7) {
    this.applyMusicalSuggestion(musicalContext.lightingSuggestion);
  }
  
  // Emitir contexto para debug/UI
  this.emit('musical-context', musicalContext);
  
  return this.getState();
}
```

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs de Wave 8

| Métrica | Target | Cómo Medir |
|---------|--------|------------|
| **Precisión de Género** | >85% | Test con playlist conocida |
| **Latencia de Análisis** | <50ms | Performance profiling |
| **Predicción de Drop** | >80% | Tests de EDM tracks |
| **Detección de Sección** | >75% | Comparar con anotaciones manuales |
| **User Satisfaction** | >4/5 | Feedback de demos |

### Tests Requeridos

```typescript
// MusicalIntelligence.test.ts
describe('Wave 8: Musical Intelligence', () => {
  describe('RhythmAnalyzer', () => {
    test('detecta patrón reggaeton en Bad Bunny', () => {...});
    test('detecta four-on-floor en Daft Punk', () => {...});
    test('detecta swing en jazz', () => {...});
    test('calcula BPM con precisión ±2', () => {...});
  });
  
  describe('GenreClassifier', () => {
    test('clasifica reggaeton correctamente', () => {...});
    test('clasifica house correctamente', () => {...});
    test('diferencia trap de hip-hop', () => {...});
  });
  
  describe('SectionTracker', () => {
    test('detecta buildup antes de drop', () => {...});
    test('detecta transición verse→chorus', () => {...});
    test('predice tiempo de drop con ±2 beats', () => {...});
  });
  
  describe('Integration', () => {
    test('mapea Bad Bunny a paleta neon', () => {...});
    test('mapea Daft Punk a paleta rainbow', () => {...});
    test('anticipa drop y prepara blinder', () => {...});
  });
});
```

---

## 📅 PLAN DE IMPLEMENTACIÓN

### Fase 1: Fundaciones (2-3 días)
- [ ] Crear estructura de archivos `engines/musical/`
- [ ] Implementar `RhythmAnalyzer` (De DrumPatternEngine)
- [ ] Implementar `ScaleIdentifier` (De ScaleUtils)
- [ ] Tests unitarios básicos

### Fase 2: Análisis (2-3 días)
- [ ] Implementar `HarmonyDetector`
- [ ] Implementar `SectionTracker`
- [ ] Implementar `GenreClassifier`
- [ ] Tests de clasificación

### Fase 3: Inteligencia (2-3 días)
- [ ] Implementar `MusicalContextEngine`
- [ ] Implementar `PredictionMatrix`
- [ ] Implementar `MusicToLightMapper`
- [ ] Tests de integración

### Fase 4: Aprendizaje (1-2 días)
- [ ] Implementar `PatternLearner`
- [ ] Pre-entrenar con patrones conocidos
- [ ] Integrar con SeleneLuxConscious

### Fase 5: Pulido (1-2 días)
- [ ] Optimización de performance
- [ ] Ajuste de mapeos
- [ ] Demo con playlist de prueba
- [ ] Documentación final

---

## 🎸 FILOSOFÍA PUNK

> "La música no miente. Si hay algo que cambiar en el mundo,  
> solo puede suceder a través de la música." — Jimi Hendrix

Este sistema no es solo análisis de audio.  
Es **COMPRENSIÓN MUSICAL**.

Selene no escucha frecuencias.  
Selene **SIENTE la música**.

Y cuando Bad Bunny suena diferente a Daft Punk,  
no es por el BPM o los bajos.  
Es por el **ALMA** del track.

Eso es lo que Wave 8 le enseña a Selene:  
A **SENTIR** antes de **ILUMINAR**.

---

**Siguiente:** Implementación de Wave 8  
**Anterior:** [MIGRATION-WAVE7-REPORT.md](./MIGRATION-WAVE7-REPORT.md)

---

*"Los beats son los latidos del corazón de la noche.  
Las luces son las lágrimas de alegría de Selene."*  

— **Blueprint finalizado por el Arquitecto, Enero 2025**
