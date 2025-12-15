# 🌙 WAVE 25: UNIVERSAL TRUTH PROTOCOL
**Fecha:** 2025-12-11  
**Arquitecto:** Raúl Acate  
**Estado:** 📐 DISEÑADO

---

## 📋 RESUMEN EJECUTIVO

WAVE 25 define el **"Universal Truth Protocol"** - un contrato único entre Backend y Frontend.

### 🎯 Problema Identificado
El Frontend (React) es **legacy** y usa stores/translators obsoletos, mientras el Backend tiene:
- **Consciencia avanzada** (DreamForge, Zodiac, Evolution) → La UI no lo sabe
- **Física de fixtures** (inercia, gravedad) → Canvas muestra interpolación lineal
- **Predicción** (drops, secciones, hunt) → La UI solo ve el presente

### ✨ Solución: SeleneBroadcast
Una **única interfaz TypeScript** que representa TODO el estado del sistema a 30fps.

```typescript
interface SeleneBroadcast {
  sensory: SensoryData;          // Audio crudo
  cognitive: CognitiveData;      // Consciencia, sueños, zodiac
  musicalDNA: MusicalDNAData;    // Análisis musical profundo
  visualDecision: VisualDecisionData; // Colores, movimiento, efectos
  hardwareState: HardwareStateData;   // DMX, fixtures
  system: SystemMetadata;        // Performance, timing
}
```

---

## 🏗️ ARQUITECTURA DEL PROTOCOLO

### Capas Jerárquicas

```
┌─────────────────────────────────────────────────────────────────┐
│                       SELENE BROADCAST                          │
│                    (30fps → Frontend)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  SENSORY    │  │  COGNITIVE  │  │      MUSICAL DNA        │ │
│  │  ────────   │  │  ─────────  │  │      ───────────        │ │
│  │  audio {}   │  │  mood       │  │  key, mode              │ │
│  │  fft []     │  │  evolution  │  │  genre { primary, ... } │ │
│  │  beat {}    │  │  dream {}   │  │  rhythm { syncopation } │ │
│  │  input {}   │  │  zodiac {}  │  │  section { current }    │ │
│  │             │  │  beauty {}  │  │  prediction { drop }    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐│
│  │    VISUAL DECISION      │  │       HARDWARE STATE          ││
│  │    ───────────────      │  │       ──────────────          ││
│  │  palette { primary,     │  │  dmxOutput [512]              ││
│  │    secondary, accent,   │  │  fixtures []                  ││
│  │    ambient, contrast }  │  │  dmx { connected, driver }    ││
│  │  movement { pan, tilt,  │  │  fixturesActive               ││
│  │    speed, physics }     │  │                               ││
│  │  effects { strobe, ... }│  │                               ││
│  └─────────────────────────┘  └───────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      SYSTEM                                  ││
│  │  frameNumber, timestamp, deltaTime, performance, workers    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 MAPEO BACKEND → PROTOCOLO

### 1. SENSORY (Audio Crudo)
| Campo | Source | Archivo |
|-------|--------|---------|
| `audio.energy` | AudioMetrics | `useAudioCapture.ts` |
| `audio.bass/mid/high` | FFT Analysis | `senses.ts` worker |
| `fft[]` | Raw FFT bins | `FFT.ts` |
| `beat.bpm` | BeatDetector | `BeatDetector.ts` |
| `beat.onBeat` | BeatState | `BeatDetector.ts` |

### 2. COGNITIVE (Consciencia)
| Campo | Source | Archivo |
|-------|--------|---------|
| `mood` | ConsciousnessState | `SeleneLux.ts` |
| `evolution.stage` | ConsciousnessState | `SeleneEvolutionEngine.ts` |
| `dream.currentThought` | DreamResult | `DreamForgeEngine.ts` |
| `dream.projectedBeauty` | DreamComponents | `DreamForgeEngine.ts` |
| `zodiac.element` | ZodiacInfo | `ZodiacAffinityCalculator.ts` |
| `zodiac.affinity` | ZodiacAffinityResult | `ZodiacAffinityCalculator.ts` |
| `beauty.components` | BeautyComponents | `SeleneEvolutionEngine.ts` |

### 3. MUSICAL DNA (Análisis Musical)
| Campo | Source | Archivo |
|-------|--------|---------|
| `key` | HarmonyAnalysis | `HarmonyDetector.ts` |
| `mode.scale` | ModalScale | `HarmonyDetector.ts` |
| `genre.primary` | MacroGenre | `GenreClassifier.ts` |
| `rhythm.syncopation` | GrooveAnalysis | `RhythmAnalyzer.ts` |
| `rhythm.pattern` | DrumPatternType | `RhythmAnalyzer.ts` |
| `section.current` | SectionType | `SectionTracker.ts` |
| `prediction.nextSection` | PredictionMatrix | `PredictionMatrix.ts` |
| `prediction.huntStatus` | HuntState | `HuntOrchestrator.ts` |

### 4. VISUAL DECISION (Colores & Movimiento)
| Campo | Source | Archivo |
|-------|--------|---------|
| `palette.*` | SelenePalette | `SeleneColorEngine.ts` |
| `palette.strategy` | PaletteMeta | `SeleneColorEngine.ts` |
| `movement.*` | MovementOutput | `MovementEngine.ts` |
| `movement.physics` | PhysicsState | `FixturePhysicsDriver.ts` |
| `effects.*` | EffectsState | `EffectsEngine.ts` |

### 5. HARDWARE STATE (DMX)
| Campo | Source | Archivo |
|-------|--------|---------|
| `dmxOutput[]` | Universe array | `DMXDriver.ts` |
| `fixtures[]` | PatchedFixtures | `FixtureManager.ts` |
| `dmx.connected` | DriverState | `DMXDriver.ts` |

### 6. SYSTEM (Metadata)
| Campo | Source | Archivo |
|-------|--------|---------|
| `frameNumber` | SeleneLux.frameCount | `SeleneLux.ts` |
| `performance.*` | BrainOutput.performance | `SeleneMusicalBrain.ts` |
| `workers.*` | WorkerHealth | `TrinityOrchestrator.ts` |

---

## 🎨 UNIFIED COLOR - Fin de la Confusión HSL/RGB

```typescript
interface UnifiedColor {
  // HSL (para UI/human readability)
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
  
  // RGB (para DMX/hardware)
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  
  // HEX (para CSS)
  hex: string;  // #RRGGBB
}
```

**Impacto:**
- UI Palette puede mostrar HSL nativamente
- Canvas puede usar RGB directamente
- CSS puede usar HEX
- **Cero conversiones en el Frontend**

---

## 🔮 FEATURES DESPERDICIADAS → EXPUESTAS

### 1. Dream Forge (Ya no invisible)
```typescript
cognitive.dream: {
  isActive: boolean;           // "¿Selene está soñando?"
  currentThought: string;      // "Imaginando un drop azul..."
  projectedBeauty: number;     // "67% de belleza proyectada"
  lastRecommendation: string;  // "execute" | "abort"
}
```

**UI Potencial:**
- Tooltip: "🔮 Selene sueña: 'Cambio a paleta fría...' (75% belleza)"
- Indicador de actividad cerebral

### 2. Zodiac Affinity (Ya no oculto)
```typescript
cognitive.zodiac: {
  element: 'fire' | 'earth' | 'air' | 'water';
  sign: string;     // "Leo ♌"
  affinity: number; // 0.82
  description: string; // "El soberano radiante..."
}
```

**UI Potencial:**
- Badge zodiacal animado
- Descripción poética del momento
- Compatibilidad con elementos de color

### 3. Hunt Orchestrator (Predicción visible)
```typescript
musicalDNA.prediction.huntStatus: {
  phase: 'stalking' | 'tracking' | 'locked' | 'striking';
  lockPercentage: number;  // 80%
  targetType: string;      // "drop"
}
```

**UI Potencial:**
- Barra de progreso: "🎯 Hunting: DROP [████████░░] 80%"
- Countdown: "Drop in 4 bars..."

### 4. Physics Simulation (Movimiento realista)
```typescript
visualDecision.movement.physics: {
  inertia: number;       // Factor de inercia
  gravity: number;       // Influencia gravitacional
  acceleration: number;  // Curva de aceleración
} | null;
```

**UI Potencial:**
- Canvas 3D con movimiento físico real
- Fixtures que aceleran/desaceleran realísticamente

---

## 🚀 IMPLEMENTACIÓN SUGERIDA

### Fase 1: Backend Broadcaster
```typescript
// SeleneLux.ts
getBroadcast(): SeleneBroadcast {
  return {
    sensory: this.buildSensoryData(),
    cognitive: this.buildCognitiveData(),
    musicalDNA: this.buildMusicalDNA(),
    visualDecision: this.buildVisualDecision(),
    hardwareState: this.buildHardwareState(),
    system: this.buildSystemMetadata()
  };
}
```

### Fase 2: IPC Channel
```typescript
// main.ts
setInterval(() => {
  const broadcast = selene.getBroadcast();
  mainWindow.webContents.send('selene:broadcast', broadcast);
}, 1000 / 30); // 30 FPS
```

### Fase 3: Frontend Consumer
```typescript
// App.tsx
const [state, setState] = useState<SeleneBroadcast>(createDefaultBroadcast());

useEffect(() => {
  return window.api.onBroadcast((data: SeleneBroadcast) => {
    setState(data); // That's it. Render this.
  });
}, []);

// Componentes simplemente leen del state:
<PaletteDisplay colors={state.visualDecision.palette} />
<BeatIndicator beat={state.sensory.beat} />
<DreamThought thought={state.cognitive.dream.currentThought} />
```

---

## 📐 MÉTRICAS DE ÉXITO

| Métrica | Antes | Después |
|---------|-------|---------|
| **Stores Zustand** | 8 stores separados | 1 único state |
| **Translation layers** | 4 (telemetryStore, dmxStore, etc.) | 0 |
| **Datos de consciencia expuestos** | 0% | 100% |
| **Predicción visible** | No | Sí (drops, sections, hunt) |
| **Conversión HSL↔RGB** | En frontend | En backend |
| **Física de fixtures** | Ignorada | Expuesta |

---

## 📁 ARCHIVO GENERADO

```
src/types/SeleneProtocol.ts
├── SensoryData          (audio, fft, beat, input)
├── CognitiveData        (mood, evolution, dream, zodiac, beauty)
├── MusicalDNAData       (key, mode, genre, rhythm, section, prediction, harmony)
├── VisualDecisionData   (palette, intensity, saturation, movement, effects)
├── HardwareStateData    (dmxOutput, fixtures, dmx)
├── SystemMetadata       (frame, timing, performance, workers)
├── UnifiedColor         (h,s,l,r,g,b,hex)
├── SeleneBroadcast      (THE UNIVERSAL TRUTH)
├── createDefaultBroadcast()
└── isSeleneBroadcast()
```

---

## 🏆 CONCLUSIÓN

WAVE 25 establece el **contrato definitivo** entre Backend y Frontend:

1. **Un objeto** → `SeleneBroadcast`
2. **Una verdad** → Backend calcula todo
3. **Un render** → Frontend solo muestra

El Frontend se convierte en un **"Dumb Renderer"** que simplemente visualiza el estado.
No más stores. No más adapters. No más confusión HSL/RGB.

**La consciencia de Selene finalmente será visible.** 🌙

---

**Próximos pasos:**
1. [ ] Implementar `getBroadcast()` en SeleneLux.ts
2. [ ] Crear canal IPC de broadcast
3. [ ] Refactorizar Frontend como consumer
4. [ ] Eliminar stores legacy
5. [ ] Crear nuevos componentes UI para consciencia/predicción

---

**Firma Digital:**
```
WAVE 25 - UNIVERSAL TRUTH PROTOCOL
Designed: 2025-12-11
Architect: Raúl Acate
Implementation: Claude Opus
Status: 📐 DESIGNED (Ready for Implementation)
```
