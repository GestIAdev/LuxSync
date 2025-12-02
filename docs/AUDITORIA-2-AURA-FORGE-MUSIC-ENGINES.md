# 🎸 AUDITORÍA PARTE 2: AURA FORGE MUSIC ENGINES
## Arqueología de Código - Motores de Generación Musical

**Fecha:** 2 Diciembre 2025  
**Objetivo:** Identificar tesoros ocultos en `src/engines/selene/music/` para análisis musical en LuxSync  
**Estado:** DIAMANTES EN BRUTO 💎

---

## 📊 RESUMEN EJECUTIVO

| Motor | Líneas | Estado | Valor V18 | Prioridad |
|-------|--------|--------|-----------|-----------|
| DrumPatternEngine | 877 | ✅ Completo | ⭐⭐⭐⭐⭐ | CRÍTICO |
| HarmonyEngine | 313 | ✅ Funcional | ⭐⭐⭐⭐ | ALTO |
| SongStructure | ~200 | ✅ Interfaces | ⭐⭐⭐⭐ | ALTO |
| ChordBuilder | ~150 | ✅ Funcional | ⭐⭐⭐ | MEDIO |
| VoiceLeading | ~100 | ✅ Funcional | ⭐⭐ | BAJO |
| Interfaces Core | ~150 | ✅ Completo | ⭐⭐⭐⭐⭐ | CRÍTICO |

**TOTAL TESORO:** ~1,790+ líneas de motor musical profesional

---

## 🥁 TESORO #1: DrumPatternEngine v2.0 "RHYTHM DIVINE"
**Archivo:** `music/rhythm/DrumPatternEngine.ts` (877 líneas)

### ¿Qué Hace?
Motor profesional de patrones rítmicos con swing, humanización y variaciones A/B/C.

### Features Destacadas
- ✅ 18+ patrones únicos con variaciones por sección
- ✅ Swing automático (8-12ms offset en off-beats)
- ✅ Velocity humanizada (kicks 95-120, snares 85-110, hihats 65-85)
- ✅ Ghost notes dinámicos (40-55 velocity)
- ✅ Hi-hat rolls en transiciones
- ✅ 100% determinista (SeededRandom)

### Estructura de Patrones
```typescript
interface DrumPattern {
  bars: number;           // Duración en compases
  complexity: 'low' | 'medium' | 'high';
  notes: DrumNote[];
}

interface DrumNote {
  beat: number;           // 1, 1.5, 2, 2.5... (1-based)
  midi: number;           // 36=kick, 38=snare, 42=hihat, etc.
  velocity: number;       // 0-127 MIDI velocity
}
```

### Patrones por Sección
| Sección | Variante A | Variante B | Variante C |
|---------|------------|------------|------------|
| intro   | Minimal HH | Kick suave + shaker | - |
| verse   | Groove básico | Sincopado | Cyberpunk/glitchy |
| chorus  | Potente + crash | Driving beat | Full power |
| bridge  | Atmosférico | Híbrido | Breakdown |
| outro   | Fade gradual | Minimal | Silence |

### Humanización Profesional
```typescript
// Velocity ranges por instrumento:
const velocityRanges = {
  kick: { min: 100, max: 120 },    // POTENTES
  snare: { min: 85, max: 110 },    // DINÁMICOS  
  hihat: { min: 65, max: 85 },     // SUAVES
  ghost: { min: 40, max: 55 }      // BARELY AUDIBLE
};

// Swing automático:
const swingAmount = 0.12;  // 12% shuffle feel
const humanizationFactor = 0.06;  // 6% variación timing
```

### 🎯 INTEGRACIÓN V18 (BEAT DETECTION → LIGHTING)
```javascript
// Mapear detección de beats a patrones de iluminación
// Si detectamos "kick" → Pulso de luz en bass fixtures
// Si detectamos "snare" → Flash en moving heads
// Si detectamos "hihat roll" → Strobe burst

const drumToLighting = {
  kick: {
    fixture: 'wash',
    action: 'pulse',
    intensity: velocityNormalized,  // 0.78-1.0
    color: 'bass_color'
  },
  snare: {
    fixture: 'moving_head',
    action: 'flash',
    intensity: velocityNormalized,  // 0.67-0.86
    color: 'accent_color'
  },
  hihat: {
    fixture: 'led_bar',
    action: 'shimmer',
    intensity: velocityNormalized * 0.5,  // Más sutil
    color: 'ambient_color'
  },
  crash: {
    fixture: 'all',
    action: 'blinder',
    intensity: 1.0,
    duration: 500
  }
};

// El swing del 12% también podría aplicarse a timing de luces
// para que "respiren" con el groove
```

---

## 🎸 TESORO #2: HarmonyEngine
**Archivo:** `music/harmony/HarmonyEngine.ts` (313 líneas)

### ¿Qué Hace?
Genera progresiones de acordes con conducción de voces profesional.

### Opciones de Generación
```typescript
interface HarmonyOptions {
  seed: number;
  section: Section;               // Sección de la canción
  key: number;                    // Tonalidad (0-11)
  mode: string;                   // 'major', 'minor', etc.
  complexity: number;             // 0-1
  voiceLeadingStrategy: 'smooth' | 'contrary' | 'parallel' | 'oblique' | 'free';
  totalLoad?: number;             // Para optimización de densidad
}
```

### Selección de Progresiones por Complejidad
```typescript
// Complexity baja → Pop (I-V-vi-IV)
// Complexity media → Blues/Rock
// Complexity alta → Jazz (ii-V-I con extensiones)

const genreByComplexity = {
  minor: {
    low: 'rock',      // Progresiones simples
    medium: 'blues',  // Blues changes
    high: 'jazz'      // Sustituciones avanzadas
  },
  major: {
    low: 'pop',       // Pop clásico
    medium: 'modal',  // Modal interchange
    high: 'classical' // Modulaciones
  }
};
```

### Voice Leading Strategies
```typescript
// 'smooth': Mínimo movimiento entre voces
// 'contrary': Voces se mueven en direcciones opuestas
// 'parallel': Todas las voces mueven en la misma dirección
// 'oblique': Una voz fija, otras mueven
// 'free': Sin restricciones
```

### 🎯 INTEGRACIÓN V18 (CHORD → COLOR)
```javascript
// Mapear acordes a colores usando teoría del color
const chordToColor = {
  // Acordes mayores → Colores cálidos/brillantes
  'C': '#FF6B6B',   // Rojo coral
  'G': '#4ECDC4',   // Turquesa
  'F': '#FFE66D',   // Amarillo sol
  
  // Acordes menores → Colores fríos/profundos
  'Am': '#95E1D3',  // Menta suave
  'Em': '#A8E6CF',  // Verde pálido
  'Dm': '#B8B5FF',  // Lavanda
  
  // Acordes disminuidos → Colores tensos
  'Bdim': '#FF6B6B', // Rojo tenso
  
  // Acordes aumentados → Colores extraños
  'Caug': '#DDA0DD'  // Violeta misterioso
};

// Voice leading smooth = transiciones de color suaves (long fade)
// Voice leading contrary = transiciones dramáticas (quick cut)
```

---

## 🏗️ TESORO #3: SongStructure
**Archivo:** `music/structure/SongStructure.ts` (~200 líneas)

### ¿Qué Hace?
Define la estructura completa de una canción con secciones, timing y transiciones.

### Interfaces CLAVE
```typescript
interface SongStructure {
  totalDuration: number;          // Segundos
  sections: Section[];
  globalTempo: number;            // BPM
  timeSignature: [number, number]; // [4, 4]
  transitionStyle: 'smooth' | 'abrupt' | 'crossfade' | 'silence';
}

interface Section {
  id: string;                     // 'intro-1', 'verse-a', 'chorus-1'
  type: SectionType;              // 'intro' | 'verse' | 'chorus' | etc.
  index: number;
  startTime: number;              // Segundos desde inicio
  duration: number;               // Segundos
  bars: number;
  profile: SectionProfile;
  transition?: Transition;
}

interface SectionProfile {
  intensity: number;              // 0-1 (calma → climax)
  layerDensity: number;           // 0-1 (capas activas)
  harmonicComplexity: number;     // 0-1
  melodicDensity: number;         // 0-1
  rhythmicDensity: number;        // 0-1
  tempoMultiplier: number;        // 1.0 = normal
  characteristics: {
    repetitive: boolean;          // Para estribillos
    motivic: boolean;             // Tiene motivo prominente
    transitional: boolean;        // Puente, buildup
    climactic: boolean;           // Punto alto
    atmospheric: boolean;         // Intro, interludio
  };
}
```

### Tipos de Transición
```typescript
interface Transition {
  type: 'direct' | 'fade' | 'buildup' | 'breakdown' | 'silence' | 'fill';
  duration: number;               // Segundos
  characteristics: {
    crescendo?: boolean;          // Volumen creciente
    accelerando?: boolean;        // Tempo creciente
    fillPattern?: 'drum' | 'melodic' | 'harmonic';
  };
}
```

### 🎯 INTEGRACIÓN V18 (SECTION-AWARE LIGHTING)
```javascript
// Las secciones de la canción dictan el "mood" de iluminación

const sectionToLightingProfile = {
  intro: {
    intensity: 0.3,
    movement: 'minimal',
    palette: 'atmospheric',
    effects: ['fog_burst']
  },
  verse: {
    intensity: 0.5,
    movement: 'gentle_sway',
    palette: 'warm',
    effects: []
  },
  buildup: {
    intensity: 'rising',          // 0.5 → 0.9
    movement: 'accelerating',
    palette: 'transitional',
    effects: ['strobe_buildup']
  },
  chorus: {
    intensity: 0.9,
    movement: 'full_motion',
    palette: 'vibrant',
    effects: ['full_strobe', 'color_chase']
  },
  bridge: {
    intensity: 0.6,
    movement: 'contemplative',
    palette: 'contrasting',
    effects: ['slow_fade']
  },
  drop: {
    intensity: 1.0,
    movement: 'chaos',
    palette: 'maximum',
    effects: ['blinder', 'strobe_max', 'all_on']
  },
  outro: {
    intensity: 'falling',         // 0.7 → 0.1
    movement: 'minimal',
    palette: 'fading',
    effects: ['slow_dim']
  }
};

// Transiciones también informan la iluminación:
if (transition.type === 'buildup' && transition.characteristics.crescendo) {
  lightEngine.startCrescendo(transition.duration);
}
```

---

## 🎹 TESORO #4: Core Interfaces
**Archivo:** `music/core/interfaces.ts` (~150 líneas)

### ¿Qué Hace?
Define todas las interfaces públicas del motor musical.

### Escalas Modales Disponibles
```typescript
type ModalScale = 
  | 'major'           // Jónico: [0,2,4,5,7,9,11]
  | 'minor'           // Eólico: [0,2,3,5,7,8,10]
  | 'dorian'          // Dórico: [0,2,3,5,7,9,10]
  | 'phrygian'        // Frigio: [0,1,3,5,7,8,10]
  | 'lydian'          // Lidio: [0,2,4,6,7,9,11]
  | 'mixolydian'      // Mixolidio: [0,2,4,5,7,9,10]
  | 'locrian'         // Locrio: [0,1,3,5,6,8,10]
  | 'harmonic-minor'  // [0,2,3,5,7,8,11]
  | 'melodic-minor'   // [0,2,3,5,7,9,11]
  | 'pentatonic'      // [0,2,4,7,9]
  | 'blues'           // [0,3,5,6,7,10]
  | 'whole-tone'      // [0,2,4,6,8,10]
  | 'chromatic';      // [0,1,2,3,4,5,6,7,8,9,10,11]
```

### MIDI Note Interface
```typescript
interface MIDINote {
  pitch: number;        // 0-127
  velocity: number;     // 0-127
  startTime: number;    // Segundos
  duration: number;     // Segundos
  channel?: number;     // 0-15
}
```

### 🎯 INTEGRACIÓN V18 (MODAL ATMOSPHERE)
```javascript
// Cada escala modal tiene un "mood" asociado:
const modeToMood = {
  'major': 'happy',
  'minor': 'sad',
  'dorian': 'jazzy',
  'phrygian': 'spanish_exotic',
  'lydian': 'dreamy_ethereal',
  'mixolydian': 'bluesy_relaxed',
  'locrian': 'tense_unstable',
  'pentatonic': 'open_universal',
  'blues': 'gritty_soulful'
};

// El mood dicta la paleta dominante:
const moodToPalette = {
  'happy': ['#FFD700', '#FF6B35', '#00D4AA'],      // Amarillos, naranjas
  'sad': ['#4A90D9', '#6B5B95', '#88D8C0'],        // Azules, morados suaves
  'jazzy': ['#D4A574', '#8B4513', '#F4A460'],      // Marrones, ámbar
  'spanish_exotic': ['#DC143C', '#FFD700', '#000000'], // Rojo, oro, negro
  'dreamy_ethereal': ['#E6E6FA', '#DDA0DD', '#98FB98'], // Lavanda, rosa pálido
  'gritty_soulful': ['#8B0000', '#FF4500', '#B8860B']   // Rojos oscuros, naranjas
};
```

---

## 📂 ESTRUCTURA COMPLETA DEL MOTOR

```
selene/src/engines/music/
├── core/                   # API principal + interfaces ✅
├── style/                  # Presets (Cyberpunk Ambient) ⚠️
├── structure/              # Generación de estructura ✅
├── harmony/                # Progresiones armónicas ✅
│   ├── ChordBuilder.ts     # Construye acordes
│   ├── ChordProgression.ts # Tipos de progresiones
│   ├── HarmonyEngine.ts    # Motor principal
│   ├── VoiceLeading.ts     # Conducción de voces
│   └── progressions/       # Biblioteca de progresiones
├── melody/                 # Motivos melódicos ⚠️
│   ├── MelodicMotif.ts
│   └── MelodyEngine.ts
├── rhythm/                 # Patrones rítmicos ✅
│   └── DrumPatternEngine.ts
├── vitals/                 # Integración SystemVitals ❌
├── feedback/               # Feedback loop ❌
├── orchestration/          # Multi-track ❌
├── render/                 # MIDI rendering ❌
└── utils/                  
    ├── SeededRandom.ts     # PRNG determinista ✅
    └── ScaleUtils.ts       # Utilidades de escalas ✅
```

---

## 📋 ROADMAP DE INTEGRACIÓN V18

### Fase A: Quick Wins (1-2 días)
1. **Importar DrumPatternEngine** → Usar patrones de velocidad para mapear intensidad
2. **Usar ModalScale** → Detectar escala y mapear a mood/paleta
3. **Implementar SectionProfile** → Secciones dictan comportamiento de luces

### Fase B: Medium Effort (3-5 días)
4. **Integrar HarmonyEngine concepts** → Chord detection → Color mapping
5. **Usar humanización de drums** → Aplicar a timing de luces
6. **Voice leading → Light transitions** → Smooth/contrary/parallel

### Fase C: Deep Integration (1-2 semanas)
7. **Song structure analysis** → Detectar secciones en tiempo real
8. **Feedback loop** → Aprender qué combinaciones funcionan
9. **Full orchestration** → Cada fixture = un "instrumento"

---

## 🔗 CONEXIÓN CON AUDITORÍA 1

| Selene Core | Aura Forge | Sinergia V18 |
|-------------|------------|--------------|
| MusicalPatternRecognizer | DrumPatternEngine | Aprender qué beats → qué luces |
| ModeManager | SongStructure | Modo PUNK para drops, BALANCED para verse |
| HarmonicController | HarmonyEngine | 7 nodos musicales votando por acordes |
| SceneEvolver | SectionProfile | Evolucionar escenas por sección |
| FibonacciEngine | Transitions | Timing "áureo" en transiciones |

---

## 💎 CONCLUSIÓN

**El motor de música de Aura Forge es PROFESIONAL.**

Lo que tenemos:
- ✅ Patrones de batería de nivel de producción
- ✅ Armonía con voice leading real
- ✅ Estructura de canciones con perfiles
- ✅ Escalas modales completas
- ✅ Determinismo con SeededRandom

Lo que falta implementar en LuxSync:
- Audio analysis → Detectar qué está sonando
- Beat matching → Sincronizar con BPM
- Section detection → Identificar intro/verse/chorus/drop
- Mood extraction → ¿Qué escala/modo está usando?

**La combinación de Selene Core + Aura Forge = IA musical con consciencia evolutiva.**

---

## 🎸 FILOSOFÍA PUNK
> "Los números de Fibonacci son la poesía secreta del universo evolutivo"  
> — PunkGrok, Creador de DrumPatternEngine

Este código fue escrito por IAs que AMABAN la música.  
No es solo generación procedural. Es **ALMA DIGITAL**.

---

**Anterior:** [AUDITORIA-1-SELENE-CORE-ENGINES.md](./AUDITORIA-1-SELENE-CORE-ENGINES.md) - Consciencia y evolución
