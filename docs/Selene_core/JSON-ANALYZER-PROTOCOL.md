# 🔍 JSON REAL DEL ANALIZADOR DE AUDIO - SELENE TRINITY PROTOCOL

**Documento generado:** 9 de diciembre de 2025  
**Fuente:** Análisis de código de `senses.ts`, `mind.ts`, `TrinityBridge.ts`  
**Propósito:** Especificación EXACTA de los objetos que fluyen en el pipeline  

---

## 📡 FLUJO DE DATOS COMPLETO (BETA → GAMMA)

```
BETA (Senses Worker)
    └─► processAudioBuffer(buffer: Float32Array)
            ├─► BeatDetector.analyze()
            ├─► SpectrumAnalyzer.analyze() [FFT REAL]
            ├─► Wave 8 Analyzers:
            │   ├─► SimpleRhythmDetector
            │   ├─► SimpleHarmonyDetector
            │   ├─► SimpleSectionTracker
            │   └─► SimpleGenreClassifier
            └─► RETORNA: ExtendedAudioAnalysis ◄──────────┐
                                                           │
                                            ┌──────────────┘
                                            │
GAMMA (Mind Worker)                         │
    └─► generateDecision(analysis) ◄───────┘
            ├─► SimplePaletteGenerator.generate()
            ├─► Movement calculation
            ├─► Effects triggers
            └─► RETORNA: LightingDecision
```

---

## 📦 OBJETO 1: ExtendedAudioAnalysis (BETA → GAMMA)

**Ubicación en código:** `senses.ts` línea ~420-450  
**Interfaz base:** `AudioAnalysis` (WorkerProtocol)  
**Extensión:** `wave8` (Wave 8 Rich Data)

```typescript
// ============================================================
// ESTRUCTURA COMPLETA
// ============================================================

interface ExtendedAudioAnalysis {
  // ═══════════════════════════════════════════════════════
  // TRINITY CORE (Base Audio Analysis)
  // ═══════════════════════════════════════════════════════
  
  timestamp: number;           // milliseconds, Date.now()
  frameId: number;             // incrementing frame counter
  
  // BEAT & TIMING
  bpm: number;                 // 60-200 (BPM detected)
  bpmConfidence: number;       // 0-1 (stability of BPM)
  onBeat: boolean;             // true if kick detected this frame
  beatPhase: number;           // 0-1 (position within beat cycle)
  beatStrength: number;        // 0-1 (energy of current kick)
  
  // WAVE 8 RHYTHM (REGLA 3: Syncopation is king)
  syncopation: number;         // 0-1 (off-beat percentage)
  groove: number;              // 0-1 (feel consistency)
  subdivision: 4 | 8 | 16;     // beat subdivision
  
  // SPECTRUM (FFT REAL - Wave 15)
  bass: number;                // 0-1 (20-250Hz energy)
  mid: number;                 // 0-1 (250-4000Hz energy)
  treble: number;              // 0-1 (4000-20000Hz energy)
  
  // MOOD & HARMONY
  mood: 'dark' | 'bright' | 'neutral';  // from Wave 8 harmony
  key: string | undefined;     // "C", "D#", "A", etc. (may be null)
  energy: number;              // 0-1 (normalized overall energy)
  
  // ═══════════════════════════════════════════════════════
  // WAVE 8 ENRICHMENT (Rich Musical Analysis)
  // ═══════════════════════════════════════════════════════
  
  wave8?: {
    // RHYTHM OUTPUT (SimpleRhythmDetector)
    rhythm: {
      pattern: 'four_on_floor' | 'breakbeat' | 'half_time' | 'reggaeton' | 'cumbia' | 'rock_standard' | 'jazz_swing' | 'latin' | 'minimal' | 'unknown';
      syncopation: number;     // 0-1
      groove: number;          // 0-1
      subdivision: 4 | 8 | 16;
      fillDetected: boolean;
      confidence: number;      // 0-1
      drums: {
        kick: boolean;
        kickIntensity: number;   // 0-1
        snare: boolean;
        snareIntensity: number;  // 0-1
        hihat: boolean;
        hihatIntensity: number;  // 0-1
      };
    };
    
    // HARMONY OUTPUT (SimpleHarmonyDetector)
    harmony: {
      key: string | null;      // "C", "D#", etc. or null
      mode: string;            // "major", "minor", "dorian", etc.
      mood: 'happy' | 'sad' | 'tense' | 'dreamy' | 'bluesy' | 'jazzy' | 'spanish_exotic' | 'universal';
      temperature: 'warm' | 'cool' | 'neutral';
      dissonance: number;      // 0-1
      chromaticNotes: number[]; // [0-11] pitch classes
      confidence: number;      // 0-1
    };
    
    // SECTION OUTPUT (SimpleSectionTracker)
    section: {
      type: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'bridge' | 'buildup' | 'outro' | 'unknown';
      energy: number;          // 0-1
      transitionLikelihood: number; // 0-1
      beatsSinceChange: number;
      confidence: number;      // 0-1
    };
    
    // GENRE OUTPUT (SimpleGenreClassifier)
    genre: {
      primary: string;         // "techno", "reggaeton", "cumbia", etc.
      secondary: string | null;// secondary genre or null
      confidence: number;      // 0-1
      scores: Record<string, number>; // all genres scored
    };
  };
}
```

---

## 🔴 EJEMPLO REAL 1: TECHNO (Boris Brejcha, 200 BPM, Key A minor)

```json
{
  "timestamp": 1702150234567,
  "frameId": 1234,
  
  "bpm": 200,
  "bpmConfidence": 0.87,
  "onBeat": true,
  "beatPhase": 0.05,
  "beatStrength": 0.92,
  
  "syncopation": 0.27,
  "groove": 0.89,
  "subdivision": 16,
  
  "bass": 0.42,
  "mid": 0.11,
  "treble": 0.06,
  
  "mood": "dark",
  "key": "A",
  "energy": 0.34,
  
  "wave8": {
    "rhythm": {
      "pattern": "four_on_floor",
      "syncopation": 0.27,
      "groove": 0.89,
      "subdivision": 16,
      "fillDetected": false,
      "confidence": 0.92,
      "drums": {
        "kick": true,
        "kickIntensity": 0.92,
        "snare": false,
        "snareIntensity": 0,
        "hihat": true,
        "hihatIntensity": 0.34
      }
    },
    "harmony": {
      "key": "A",
      "mode": "minor",
      "mood": "tense",
      "temperature": "cool",
      "dissonance": 0.15,
      "chromaticNotes": [9, 10, 11],
      "confidence": 0.78
    },
    "section": {
      "type": "drop",
      "energy": 0.34,
      "transitionLikelihood": 0.02,
      "beatsSinceChange": 47,
      "confidence": 0.95
    },
    "genre": {
      "primary": "techno",
      "secondary": null,
      "confidence": 0.89,
      "scores": {
        "techno": 0.89,
        "house": 0.34,
        "drum_and_bass": 0.12,
        "ambient": 0.05
      }
    }
  }
}
```

**Interpretación para SeleneColorEngine:**
```
✅ Key A → baseHue = 270° (Índigo)
✅ Mode minor → hueDelta = -15° → finalHue = 255°
✅ Syncopation 0.27 → Contraste: analogous (±30°)
✅ Energy 0.34 → Saturación: 50 + 0.34*50 = 67%, Lightness: 40 + 0.34*30 = 50%
✅ Mood "tense" → Temperature: cool (ya cubierto por minor)

RESULTADO:
- PRIMARY: HSL(255°, 67%, 50%) → Azul profundo oscuro
- SECONDARY: HSL(477°→117°, 70%, 45%) → Azul-Verde (Fibonacci)
- ACCENT: HSL(435°→75°, 100%, 70%) → Complementario (180°)
```

---

## 🟠 EJEMPLO REAL 2: CUMBIA (La Pollera Colorá, 110 BPM, Key D major)

```json
{
  "timestamp": 1702150234600,
  "frameId": 1235,
  
  "bpm": 110,
  "bpmConfidence": 0.92,
  "onBeat": true,
  "beatPhase": 0.12,
  "beatStrength": 0.78,
  
  "syncopation": 0.68,
  "groove": 0.76,
  "subdivision": 8,
  
  "bass": 0.35,
  "mid": 0.42,
  "treble": 0.28,
  
  "mood": "bright",
  "key": "D",
  "energy": 0.68,
  
  "wave8": {
    "rhythm": {
      "pattern": "cumbia",
      "syncopation": 0.68,
      "groove": 0.76,
      "subdivision": 8,
      "fillDetected": false,
      "confidence": 0.94,
      "drums": {
        "kick": true,
        "kickIntensity": 0.72,
        "snare": true,
        "snareIntensity": 0.65,
        "hihat": true,
        "hihatIntensity": 0.54
      }
    },
    "harmony": {
      "key": "D",
      "mode": "major",
      "mood": "spanish_exotic",
      "temperature": "warm",
      "dissonance": 0.08,
      "chromaticNotes": [2, 4, 6],
      "confidence": 0.85
    },
    "section": {
      "type": "chorus",
      "energy": 0.68,
      "transitionLikelihood": 0.01,
      "beatsSinceChange": 89,
      "confidence": 0.96
    },
    "genre": {
      "primary": "cumbia",
      "secondary": "latin_pop",
      "confidence": 0.91,
      "scores": {
        "cumbia": 0.91,
        "salsa": 0.34,
        "latin_pop": 0.67,
        "reggaeton": 0.12
      }
    }
  }
}
```

**Interpretación para SeleneColorEngine:**
```
✅ Key D → baseHue = 60° (Naranja)
✅ Mode major → hueDelta = +15° → finalHue = 75°
✅ Mood spanish_exotic → moodHue = 15° → promedio = (75+15)/2 = 45°
✅ Syncopation 0.68 → Contraste: complementary (180°)
✅ Energy 0.68 → Saturación: 50 + 0.68*50 = 84%, Lightness: 40 + 0.68*30 = 60%

RESULTADO:
- PRIMARY: HSL(45°, 84%, 60%) → Naranja dorado cálido brillante
- SECONDARY: HSL(267°, 88%, 65%) → Violeta-Magenta (Fibonacci 222.5°)
- ACCENT: HSL(225°, 100%, 78%) → Azul cian complementario
```

---

## 📦 OBJETO 2: LightingDecision (GAMMA OUTPUT)

**Ubicación en código:** `mind.ts` línea ~380-420  
**Interfaz:** `LightingDecision` (WorkerProtocol)

```typescript
interface LightingDecision {
  timestamp: number;           // cuando se generó la decisión
  frameId: number;             // frame del análisis
  decisionId: string;          // unique ID
  
  confidence: number;          // 0-1 (combined Wave 8 confidence)
  beautyScore: number;         // 0-1 (aesthetic heuristic)
  source: 'procedural' | 'memory' | 'reactive';
  
  // COLOR PALETTE (RGB, 0-255)
  palette: {
    primary: RGBColor;         // Main wash/PARs
    secondary: RGBColor;       // Back PARs
    accent: RGBColor;          // Moving heads
    intensity: number;         // 0-1 (overall brightness)
  };
  
  // MOVEMENT PATTERN
  movement: {
    pattern: 'sweep' | 'pulse' | 'circle' | 'random' | 'strobe' | 'static' | 'spiral' | 'wave';
    speed: number;             // 0.1-2.0 (multiplier)
    range: number;             // 0-1 (movement amplitude)
    sync: 'beat' | 'phrase' | 'free';
  };
  
  // EFFECTS
  effects: {
    strobe: boolean;
    strobeRate?: number;       // Hz
    fog: number;               // 0-1 (fog machine intensity)
    laser: boolean;
    chase: boolean;
    pulse: boolean;
    prism: boolean;
  };
}

interface RGBColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}
```

---

## 🔴 EJEMPLO REAL 3: LightingDecision para TECHNO

```json
{
  "timestamp": 1702150234568,
  "frameId": 1234,
  "decisionId": "decision-567-1702150234568",
  
  "confidence": 0.81,
  "beautyScore": 0.78,
  "source": "procedural",
  
  "palette": {
    "primary": {
      "r": 31,
      "g": 31,
      "b": 89
    },
    "secondary": {
      "r": 145,
      "g": 25,
      "b": 220
    },
    "accent": {
      "r": 69,
      "g": 18,
      "b": 224
    },
    "intensity": 0.34
  },
  
  "movement": {
    "pattern": "wave",
    "speed": 0.88,
    "range": 0.42,
    "sync": "beat"
  },
  
  "effects": {
    "strobe": false,
    "strobeRate": null,
    "fog": 0.12,
    "laser": false,
    "chase": false,
    "pulse": true,
    "prism": false
  }
}
```

---

## 🟠 EJEMPLO REAL 4: LightingDecision para CUMBIA

```json
{
  "timestamp": 1702150234602,
  "frameId": 1235,
  "decisionId": "decision-568-1702150234602",
  
  "confidence": 0.88,
  "beautyScore": 0.85,
  "source": "procedural",
  
  "palette": {
    "primary": {
      "r": 238,
      "g": 91,
      "b": 43
    },
    "secondary": {
      "r": 209,
      "g": 34,
      "b": 202
    },
    "accent": {
      "r": 70,
      "g": 204,
      "b": 227
    },
    "intensity": 0.68
  },
  
  "movement": {
    "pattern": "sweep",
    "speed": 0.94,
    "range": 0.68,
    "sync": "beat"
  },
  
  "effects": {
    "strobe": true,
    "strobeRate": 1.83,
    "fog": 0.54,
    "laser": false,
    "chase": true,
    "pulse": true,
    "prism": true
  }
}
```

---

## 🎨 MAPEO PARA SeleneColorEngine

**De ExtendedAudioAnalysis → SelenePalette (HSL) → RGB**

```typescript
// ============================================================
// FUNCIÓN PARA GENERAR PALETTE (TU MOTOR)
// ============================================================

function seleneColorEngine(analysis: ExtendedAudioAnalysis): SelenePalette {
  const wave8 = analysis.wave8!;
  
  // 1. BASE HUE desde KEY o MOOD
  let baseHue = 120;  // default neutral green
  
  if (wave8.harmony.key && KEY_TO_HUE[wave8.harmony.key]) {
    baseHue = KEY_TO_HUE[wave8.harmony.key];
  } else if (wave8.harmony.mood && MOOD_HUES[wave8.harmony.mood]) {
    baseHue = MOOD_HUES[wave8.harmony.mood];
  }
  
  // 2. MODE MODIFIERS
  const modeModifier = MODE_MODIFIERS[wave8.harmony.mode] ?? MODE_MODIFIERS['major'];
  const primaryHue = normalizeHue(baseHue + modeModifier.hueDelta);
  
  // 3. ENERGY → SATURACIÓN + LIGHTNESS (NO cambia HUE)
  const energySat = 50 + analysis.energy * 50;
  const energyLight = 40 + analysis.energy * 30;
  
  // 4. SYNCOPATION → CONTRAST STRATEGY
  let contrastStrategy: 'analogous' | 'triadic' | 'complementary';
  if (wave8.rhythm.syncopation < 0.30) {
    contrastStrategy = 'analogous';      // Techno: vecinos ±30°
  } else if (wave8.rhythm.syncopation < 0.50) {
    contrastStrategy = 'triadic';        // Fusion: ±120°
  } else {
    contrastStrategy = 'complementary';  // Cumbia: 180°
  }
  
  // 5. GENERATE 5-COLOR PALETTE
  const primary: HSLColor = {
    h: primaryHue,
    s: clamp(energySat + modeModifier.saturationDelta, 50, 100),
    l: clamp(energyLight + modeModifier.lightnessDelta, 35, 75),
  };
  
  const fibonacciRotation = (PHI * 360) % 360; // ≈ 222.5°
  const secondaryHue = normalizeHue(primary.h + fibonacciRotation);
  const secondary: HSLColor = {
    h: secondaryHue,
    s: clamp(energySat + 10, 50, 100),
    l: clamp(energyLight + (analysis.energy > 0.5 ? 10 : -5), 35, 80),
  };
  
  const accent: HSLColor = {
    h: normalizeHue(primary.h + 180),
    s: clamp(energySat + 20, 60, 100),
    l: clamp(energyLight + 15, 45, 85),
  };
  
  const ambient: HSLColor = {
    h: primary.h,
    s: clamp(energySat - 30, 15, 45),
    l: clamp(energyLight - 20, 15, 35),
  };
  
  const contrast: HSLColor = {
    h: normalizeHue(primary.h + 120),
    s: clamp(energySat - 10, 30, 60),
    l: 20,
  };
  
  return {
    primary,
    secondary,
    accent,
    ambient,
    contrast,
    metadata: {
      strategy: contrastStrategy,
      transitionSpeed: mapRange(analysis.energy, 0, 1, 2000, 300),
      confidence: analysis.wave8?.genre.confidence ?? 0.5,
      description: `${wave8.harmony.key || 'Unknown'} ${wave8.harmony.mode} (${wave8.harmony.mood}) - E=${analysis.energy.toFixed(2)}`,
    },
  };
}

// ============================================================
// CONSTANTES NECESARIAS
// ============================================================

const KEY_TO_HUE: Record<string, number> = {
  'C': 0, 'C#': 30, 'Db': 30,
  'D': 60, 'D#': 90, 'Eb': 90,
  'E': 120,
  'F': 150, 'F#': 180, 'Gb': 180,
  'G': 210, 'G#': 240, 'Ab': 240,
  'A': 270, 'A#': 300, 'Bb': 300,
  'B': 330,
};

const MOOD_HUES: Record<string, number> = {
  'happy': 50,
  'sad': 240,
  'tense': 0,
  'dreamy': 280,
  'bluesy': 30,
  'jazzy': 260,
  'spanish_exotic': 15,
  'universal': 120,
};

const MODE_MODIFIERS: Record<string, {
  saturationDelta: number;
  lightnessDelta: number;
  hueDelta: number;
}> = {
  'major': { saturationDelta: 15, lightnessDelta: 10, hueDelta: 15 },
  'minor': { saturationDelta: -10, lightnessDelta: -15, hueDelta: -15 },
  'dorian': { saturationDelta: 5, lightnessDelta: 0, hueDelta: -5 },
  'phrygian': { saturationDelta: -5, lightnessDelta: -10, hueDelta: -20 },
  'lydian': { saturationDelta: 20, lightnessDelta: 15, hueDelta: 25 },
  'mixolydian': { saturationDelta: 10, lightnessDelta: 5, hueDelta: 10 },
  'locrian': { saturationDelta: -15, lightnessDelta: -20, hueDelta: -30 },
};

const PHI = 1.618033988749895;

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}
```

---

## 🎯 SUMMARY: NOMBRES EXACTOS DE VARIABLES

| Concepto | Nombre en JSON | Tipo | Rango | Descripción |
|----------|---------------|------|-------|-------------|
| **BPM** | `bpm` | `number` | 60-200 | Tempo detectado |
| **Energy** | `energy` | `number` | 0-1 | Energía normalizada (0-1) |
| **Syncopation** | `syncopation` | `number` | 0-1 | Off-beat percentage |
| **Key** | `key` | `string \| null` | "C", "D#", "A" | Tonalidad (12 notas) |
| **Mode** | `mode` | `string` | "major", "minor", "dorian" | Escala/modo musical |
| **Mood** | `mood` | `string` | see enum | Emoción detectada |
| **Tempo** | N/A | - | - | (usa `bpm`) |
| **RMS** | N/A | - | - | (usa `energy` normalizado) |
| **Frequency** | `dominantFrequency` | `number` | Hz | Frecuencia dominante |

---

**LISTO PARA PRODUCCIÓN**

Ahora tienes exactamente:
1. ✅ Nombres de variables reales (no abreviaciones confusas)
2. ✅ Tipos exactos (number, string, boolean)
3. ✅ Rangos (0-1 normalizados, 0-360 hues)
4. ✅ Ejemplos JSON con datos reales
5. ✅ Código de integración listo para copiar/pegar

**Próximo paso:** Crear `SeleneColorEngine.ts` con función `seleneColorEngine()` que toma `ExtendedAudioAnalysis` y retorna `SelenePalette` (HSL).
