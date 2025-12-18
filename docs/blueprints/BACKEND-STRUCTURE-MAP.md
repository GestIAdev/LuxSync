# 🏗️ LuxSync Backend Structure Map
**Selene Lux Core Architecture**  
Mapeo completo de `/electron-app/src` (excluyendo `/components`)

---

## 📂 Estructura General

```
src/
├── main/                          # ⚙️ Core Backend + Workers
├── hooks/                         # 🔌 React Hooks
├── providers/                     # 🎁 Context Providers
├── stores/                        # 📦 State Management (Zustand)
└── styles/                        # 🎨 Global Styles
```

---

## 📋 Detalle por Directorio

### 1️⃣ `/main` - Core & Workers

#### 1.1 `/main/selene-lux-core` - 🧠 SELENE CORE ENGINE

```
selene-lux-core/
├── SeleneLux.ts                   # 🎯 MAIN CONTROLLER (processAudioFrame, last colors)
├── types.ts                       # 📝 Type definitions
├── docs/                          # 📖 Documentation
│
├── engines/                       # 🔧 Processing Engines
│   ├── audio/
│   │   ├── BeatDetector.ts        # 🥁 Beat detection algorithm
│   │   ├── PatternRecognizer.ts   # 🎼 Pattern recognition
│   │   └── index.ts
│   │
│   ├── consciousness/             # 🌟 CONSCIOUSNESS LAYER (Emotional Intelligence)
│   │   ├── SeleneLuxConscious.ts  # 🦁 Main consciousness engine
│   │   ├── SeleneEvolutionEngine.ts # 📈 Evolution tracking
│   │   ├── AudioToMusicalMapper.ts # 🎵 Audio→Music mapping
│   │   ├── ConsciousnessToLightMapper.ts # 💡 Consciousness→Light
│   │   ├── DreamForgeEngine.ts    # 💭 Dream/imagination
│   │   ├── EvolutionEngine.ts     # 🔄 Evolution logic
│   │   ├── FibonacciPatternEngine.ts # 🌀 Fibonacci patterns
│   │   ├── HuntOrchestrator.ts    # 🎭 Hunt orchestration
│   │   ├── MoodSynthesizer.ts     # 😊 Mood synthesis
│   │   ├── MusicalHarmonyValidator.ts # ✅ Harmony validation
│   │   ├── NocturnalVisionEngine.ts # 🌙 Night vision
│   │   ├── PrecisionJumpEngine.ts # 🚀 Jump prediction
│   │   ├── PreyRecognitionEngine.ts # 👁️ Prey recognition
│   │   ├── SelfAnalysisEngine.ts  # 🔍 Self analysis
│   │   ├── StalkingEngine.ts      # 🐾 Stalking logic
│   │   ├── StrikeMomentEngine.ts  # ⚡ Strike timing
│   │   ├── UltrasonicHearingEngine.ts # 🔊 Ultrasonic hearing
│   │   ├── ZodiacAffinityCalculator.ts # ♈ Zodiac affinity
│   │   ├── index.ts
│   │   └── __tests__/
│   │       ├── EvolutionEngines.test.ts
│   │       └── HuntOrchestrator.test.ts
│   │
│   ├── musical/                   # 🎵 MUSICAL INTELLIGENCE
│   │   ├── SeleneMusicalBrain.ts  # 🧠 Main musical processor
│   │   ├── types.ts               # 📝 Musical types
│   │   ├── index.ts
│   │   │
│   │   ├── analysis/              # 📊 Music Analysis
│   │   │   ├── HarmonyDetector.ts # 🎼 Detect chords/harmony
│   │   │   ├── RhythmAnalyzer.ts  # 🥁 Rhythm analysis
│   │   │   ├── SectionTracker.ts  # 📍 Track song sections
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── HarmonyAnalysis.test.ts
│   │   │       ├── RhythmAnalyzer.test.ts
│   │   │       └── SectionTracker.test.ts
│   │   │
│   │   ├── classification/        # 🏷️ Genre Classification
│   │   │   ├── GenreClassifier.ts # 🎭 Classify genres (TECHNO, CUMBIA, etc)
│   │   │   ├── GenreClassifier.ts.bak-wave19 # 📦 Backup from WAVE19
│   │   │   ├── ScaleIdentifier.ts # 🎼 Identify scales
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── GenreClassifier.test.ts
│   │   │       └── GenreClassifier.test.ts.bak-wave19
│   │   │
│   │   ├── context/               # 🎯 Musical Context
│   │   │   ├── MusicalContextEngine.ts # 🧭 Main context processor
│   │   │   ├── PredictionMatrix.ts # 🔮 Predict next sections
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── MusicalContextEngine.test.ts
│   │   │       └── PredictionMatrix.test.ts
│   │   │
│   │   ├── learning/              # 📚 Memory/Learning
│   │   │   ├── SeleneMemoryManager.ts # 💾 Learning engine
│   │   │   ├── schema.sql         # 🗄️ Database schema
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── SeleneMemoryManager.test.ts
│   │   │
│   │   ├── mapping/               # 🎨 Music→Light Mapping
│   │   │   ├── MusicToLightMapper.ts # 🎨 Main mapping logic
│   │   │   ├── PaletteManager.ts  # 🎭 Palette management
│   │   │   ├── ProceduralPaletteGenerator.ts # 🎲 Generate colors
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── MusicToLightMapper.test.ts
│   │   │       └── ProceduralPaletteGenerator.test.ts
│   │   │
│   │   ├── docs/                  # 📖 Documentation
│   │   │   ├── WAVE8-FASE7-INTEGRATION-REPORT.md
│   │   │   └── WAVE8-FASE8-NUCLEAR-INTEGRATION-REPORT.md
│   │   │   └── WAVE8-MUSICAL-INTELLIGENCE-ROADMAP.md
│   │   │
│   │   └── __tests__/
│   │       └── SeleneMusicalBrain.test.ts
│   │
│   ├── telemetry/                 # 📡 Telemetry & Logging
│   │   ├── SeleneTelemetryCollector.ts # 📊 Collect metrics
│   │   └── index.ts
│   │
│   └── visual/                    # 🎨 COLOR & MOVEMENT
│       ├── SeleneColorEngine.ts   # 🌈 Procedural color generation
│       ├── ColorEngine.ts         # 🎨 Color utilities
│       ├── MovementEngine.ts      # 🔄 Pan/Tilt patterns
│       ├── EffectsEngine.ts       # ✨ Strobe/Beam/Prism effects
│       ├── index.ts
│       └── __tests__/
│           └── SeleneColorEngine.test.ts
│
├── hardware/                      # 🔌 DMX/Fixture Control
│   ├── DMXDriver.ts               # 📡 DMX protocol driver
│   ├── FixtureManager.ts          # 🎯 Patch/assign fixtures
│   ├── FixturePhysicsDriver.ts    # ⚙️ Physics simulation
│   └── index.ts
│
└── tests/                         # 🧪 Integration Tests
    └── MetaConsciousness.test.ts
```

#### 1.2 `/main/workers` - 🧵 WORKER THREADS

```
workers/
├── mind.ts                        # 🧠 Main worker - Trinity Brain
├── senses.ts                      # 👁️ Audio perception worker
├── FFT.ts                         # 📊 Fast Fourier Transform
├── TrinityBridge.ts               # 🌉 Worker↔Main communication
├── TrinityOrchestrator.ts         # 🎼 Coordinate Trinity workers
├── WorkerProtocol.ts              # 📋 Type-safe protocol
├── index.ts
│
└── utils/                         # 🔧 Worker Utilities
    ├── AdaptiveEnergyNormalizer.ts # ⚙️ Normalize audio energy
    ├── HysteresisTrigger.ts        # 🔀 Smooth state transitions
    └── index.ts
```

---

### 2️⃣ `/hooks` - 🔌 React Hooks

```
hooks/
├── useAudioCapture.ts             # 🎤 Capture microphone/line-in
├── useSelene.ts                   # 🧠 Hook to Selene engine
└── index.ts
```

---

### 3️⃣ `/providers` - 🎁 Context Providers

```
providers/
├── KeyboardProvider.tsx           # ⌨️ Keyboard shortcut provider
├── TrinityProvider.tsx            # 🧬 Trinity worker provider
```

---

### 4️⃣ `/stores` - 📦 State Management (Zustand)

```
stores/
├── audioStore.ts                  # 🎵 Audio capture state
├── dmxStore.ts                    # 📡 DMX values & fixtures
├── effectsStore.ts                # ✨ Active effects
├── luxsyncStore.ts                # 🌟 Main app state
├── navigationStore.ts             # 🧭 UI navigation
├── seleneStore.ts                 # 🧠 Selene brain state
├── telemetryStore.ts              # 📊 Metrics & telemetry
└── index.ts
```

---

### 5️⃣ `/styles` - 🎨 Global Styles

```
styles/
└── globals.css                    # 🎨 Global CSS
```

---

## 🔄 Data Flow Architecture

### 1. Audio Capture Pipeline
```
🎤 Microphone/Line-in
  ↓ useAudioCapture hook
  ↓ audioStore (state)
  ↓ SeleneLux.processAudioFrame()
  ↓ workers/FFT.ts (frequency analysis)
  ↓ workers/senses.ts (perception)
```

### 2. Musical Intelligence Pipeline
```
🎵 Audio Data
  ↓ SeleneMusicalBrain.process()
  ├─ HarmonyDetector → chord detection
  ├─ RhythmAnalyzer → tempo/beat
  ├─ SectionTracker → song structure
  ├─ GenreClassifier → genre classification
  └─ MusicalContextEngine → context & prediction
  ↓ BrainOutput (genre, beauty, movement)
```

### 3. Color Generation Pipeline
```
📊 Musical Analysis + Genre
  ↓ SeleneColorEngine.generate()
  ├─ ProceduralPaletteGenerator
  └─ Procedural color system (HSL)
  ↓ paletteToRgb() conversion
  ↓ RGB values for DMX/Canvas
```

### 4. DMX Output Pipeline
```
🌈 Color + Movement
  ↓ SeleneLux.lastColors (RGB)
  ↓ FixtureManager → Assign to fixtures
  ↓ DMXDriver → Serial/USB transmission
  ↓ 🔴 Physical DMX Lights
```

---

## 🔑 Key Files Summary

| Archivo | Propósito | Criticidad |
|---------|-----------|-----------|
| `SeleneLux.ts` | Controller principal, audio processing loop | 🔴 CRÍTICO |
| `SeleneMusicalBrain.ts` | Inteligencia musical central | 🔴 CRÍTICO |
| `SeleneColorEngine.ts` | Generador procedural de colores | 🔴 CRÍTICO |
| `WorkerProtocol.ts` | Protocol tipado worker↔main | 🟠 IMPORTANTE |
| `mind.ts` | Trinity brain worker | 🟠 IMPORTANTE |
| `DMXDriver.ts` | Control DMX hardware | 🟠 IMPORTANTE |
| `FixtureManager.ts` | Gestión de fixtures | 🟡 NORMAL |
| `GenreClassifier.ts` | Clasificación de géneros | 🟡 NORMAL |
| `HarmonyDetector.ts` | Detección de armonía | 🟡 NORMAL |
| `RhythmAnalyzer.ts` | Análisis de ritmo | 🟡 NORMAL |

---

## 📊 Module Dependencies

### Core Dependencies
```
SeleneLux
├── SeleneMusicalBrain
│   ├── GenreClassifier
│   ├── HarmonyDetector
│   ├── RhythmAnalyzer
│   └── MusicalContextEngine
├── SeleneColorEngine
│   └── ProceduralPaletteGenerator
├── DMXDriver
└── FixtureManager

workers/mind
├── SeleneMusicalBrain
└── WorkerProtocol

workers/senses
├── FFT
└── AdaptiveEnergyNormalizer
```

---

## 🧪 Test Coverage

```
__tests__/
├── consciousness/
│   ├── EvolutionEngines.test.ts
│   └── HuntOrchestrator.test.ts
├── musical/
│   ├── analysis/
│   │   ├── HarmonyAnalysis.test.ts
│   │   ├── RhythmAnalyzer.test.ts
│   │   └── SectionTracker.test.ts
│   ├── classification/
│   │   └── GenreClassifier.test.ts
│   ├── context/
│   │   ├── MusicalContextEngine.test.ts
│   │   └── PredictionMatrix.test.ts
│   ├── learning/
│   │   └── SeleneMemoryManager.test.ts
│   ├── mapping/
│   │   ├── MusicToLightMapper.test.ts
│   │   └── ProceduralPaletteGenerator.test.ts
│   └── SeleneMusicalBrain.test.ts
├── visual/
│   └── SeleneColorEngine.test.ts
└── tests/
    └── MetaConsciousness.test.ts
```

---

## 🎯 WAVE 24.5 Implementation Status

### Archivos Modificados
- ✅ `SeleneLux.ts` - ANTI-FLICKER en Output Guard
- ✅ `SeleneColorEngine.ts` - Dinámica de luz ampliada

### Estado de Compilación
- ✅ 0 errores en código de producción
- ⚠️ 54 errores en tests (pre-existentes)
- ⚠️ 1 warning código muerto (línea 419)

---

## 📌 Convenciones

### Naming
- `*Engine.ts` - Processing engines
- `*Processor.ts` - Data processors
- `*Manager.ts` - Resource management
- `*Detector.ts` - Detection algorithms
- `*Store.ts` - Zustand state
- `*.test.ts` - Unit tests

### Imports Pattern
```typescript
// Internal imports
import { SeleneLux } from '@/main/selene-lux-core'
import { BeatDetector } from '@/main/selene-lux-core/engines/audio'
import { useDMXStore } from '@/stores'

// Type imports
import type { BrainOutput, AudioAnalysis } from '@/main/workers/WorkerProtocol'
```

---

**Última actualización:** 2025-12-11  
**WAVE:** 24.5 (Stabilization)  
**Status:** ✅ Production Ready
