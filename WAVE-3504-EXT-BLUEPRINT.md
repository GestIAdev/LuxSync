# WAVE 3504-EXT — ENGINE & SENSES DECOUPLING BLUEPRINT

Estado: DISEÑO ARQUITECTÓNICO (EXTENSIÓN)
Rama objetivo: `v2-agnostic`
Predecesor: `WAVE-3504-BLUEPRINT.md` (Orchestrator + Arbiter)
Sucesor previsto: WAVE 3505 — Implementación V2 (Sub-Emisores / AgnosticEngine)
Alcance: refactor estructural de `TitanEngine` y `Senses`. NO toca Orchestrator, Arbiter ni HAL (ya cubiertos por WAVE 3504).

---

## 0) Principios rectores (heredados de WAVE 3504 + extensiones)

1. **SRP estricto** — cada clase tiene una sola razón para cambiar.
2. **Pure first** — toda matemática de DSP, color y curvas vive en módulos puros sin side-effects.
3. **Worker boundary = I/O boundary** — la comunicación con el Worker (SAB/IPC/parentPort) es una capa aislada que NO conoce la lógica de análisis musical.
4. **DI por constructor** — los singletons (`VibeManager.getInstance()`, `getEffectManager()`, `getChronosInjector()`, `vibeMovementManager`) se inyectan vía interfaces en el composition root, no desde dentro.
5. **No regresión funcional** — el contrato de `engine.update()` y `processAudioBuffer()` se mantiene byte-a-byte equivalente.
6. **Listos para Sub-Emisores** — los módulos de movimiento y color deben ser agnósticos a "fixture/canal" y operar sobre Capability Nodes.

---

## 1) TitanEngine — desacoplamiento

### 1.1 Auditoría de responsabilidades actuales

`TitanEngine.ts` (~2185 LOC, ~101 KB) concentra **7 dominios** en una sola clase:

| # | Dominio | LOC aprox. | Síntoma |
|---|---------|-----------|---------|
| 1 | **Stabilization Layer** — Key, Energy, Mood, Strategy Arbiters | ~120 | 4 instancias de stabilizer + pipeline secuencial de fusión |
| 2 | **Color Processing** — SeleneColorEngine, Interpolator, palette conversion, consciousness color | ~150 | `selenePaletteToColorPalette`, `applyConsciousnessColorDecision`, color override merge, constitution wiring |
| 3 | **Movement Generation** — VMM stereo, mechanics bypass, coordinate normalization | ~120 | `calculateMovement` con conversión -1..+1 → 0..1, gearbox budget, stereo pair generation |
| 4 | **Chronos Integration** — phantom buffer, playhead sync, overrides, heatmap lookup | ~150 | `setChronosInput/Heatmap/Playhead`, phantom injection en `update()`, effect sync |
| 5 | **Effect Arsenal** — manual strike, consciousness triggers, globalComposition blend, effect update | ~180 | Trigger logic, HTP merge, zone blending con globalComposition |
| 6 | **Consciousness Telemetry** — `getConsciousnessTelemetry` (~250 LOC), `emitConsciousnessLogs` (~130 LOC) | ~380 | Construcción de payload masivo para UI, council votes, dream history, ethics flags |
| 7 | **Zone/Intensity Calculation** — `calculateZoneIntents`, `calculateMasterIntensity`, noise gate | ~80 | Cálculos puros de intensidad por zona |

**Diagnóstico:** El Engine es simultáneamente motor de color, generador de movimiento, coordinador de timeline, despachador de efectos y proveedor de telemetría.

### 1.2 Estado final del Engine

Tras el refactor, `TitanEngine` queda reducido a **un único rol**:

- **Dispatcher puro de cálculos** — recibe `MusicalContext` + `EngineAudioMetrics`, orquesta la llamada a colaboradores especializados, y devuelve `LightingIntent`.

Sale del Engine: todo cálculo de color, movimiento, chronos lookup, effect triggering, telemetría de consciousness.

### 1.3 Nuevas clases — Engine side

| Clase | Tipo | Responsabilidad única | Estado interno |
|---|---|---|---|
| `StabilizationPipeline` | Servicio | Secuenciar los 4 Stabilizers (Key → Energy → Mood → Strategy) y exponer `StabilizedState`. Encapsula toda la lógica de fusión de estabilizadores. | Instancias de los 4 stabilizers + `lastStabilizedState`. |
| `ColorProcessor` | Servicio | Generar paleta via `SeleneColorEngine` + `SeleneColorInterpolator`, convertir `SelenePalette → ColorPalette`, aplicar consciousness color decision, y merge color override de efectos. | `SeleneColorInterpolator` instance, `lastPalette`. |
| `MovementGenerator` | Servicio | Generar `MovementIntent` via VMM stereo (L/R pair), manejar mechanics bypass, y normalizar coordenadas al protocolo 0..1. | Referencia a `vibeMovementManager`. |
| `ChronosAdapter` | Servicio | Gestionar phantom buffer (heatmap), playhead sync, overrides de Chronos, e inyectar audio metrics sintéticas cuando hay playback sin audio vivo. | `chronosHeatmap`, `chronosPlayheadMs`, `chronosOverrides`, `chronosEnabled`. |
| `EffectDispatcher` | Servicio | Procesar manual strikes, consciousness triggers, y coordinar `effectManager.update()` + `getCombinedOutput()`. Manejar globalComposition zone blending. | `manualStrikePending`, referencia a `EffectManager`. |
| `ConsciousnessTelemetryProvider` | Servicio | Construir el payload de telemetría para UI (hunt state, council votes, dream history, ethics flags, energy zone). Extrae ~380 LOC del Engine. | `dreamHistoryBuffer`, `lastEthicsFlags`, caches de telemetría. |
| `ZoneIntentCalculator` | **Puro** | `calculateZoneIntents` + `calculateMasterIntensity` + noise gate. Sin estado. | Ninguno. |
| `PaletteConverter` | **Puro** | `selenePaletteToColorPalette`, `applyConsciousnessColorDecision`, `applyConsciousnessPhysicsModifier`. Funciones de transformación de paleta. | Ninguno. |
| `SectionNormalizer` | **Puro** | `normalizeSectionType`. Mapeo de strings de sección a enum tipado. | Ninguno. |
| `EngineDispatcher` | Coordinador | El "nuevo TitanEngine" minimalista. Cablea el pipeline de `update()` sin calcular nada. | Referencias a colaboradores + `EngineState` mínimo (frameCount, lastFrameTime). |

### 1.4 Interfaces clave

```ts
interface IStabilizationPipeline {
  process(context: MusicalContext, energy: number): StabilizedState;
  reset(): void;
  getState(): StabilizedState;
}

interface IColorProcessor {
  generate(
    audio: ExtendedAudioAnalysis,
    stabilized: StabilizedState,
    vibeId: string,
    isDropActive: boolean
  ): { selenePalette: SelenePalette; colorPalette: ColorPalette };
  forceImmediate(palette: SelenePalette): void;
}

interface IMovementGenerator {
  generate(
    audio: EngineAudioMetrics,
    context: MusicalContext,
    vibeId: string,
    nervousMechanics: MechanicsOutput | null
  ): MovementIntent;
}

interface IChronosAdapter {
  isActive(): boolean;
  isPlaybackActive(): boolean;
  setInput(overrides: ChronosOverrides | null): void;
  setHeatmap(heatmap: HeatmapData | null): void;
  setPlayhead(timeMs: number, isPlaying: boolean): void;
  clearInput(): void;
  /** Inyecta heatmap bands en audio metrics si hay phantom playback activo */
  injectPhantomAudio(audio: EngineAudioMetrics, context: MusicalContext): {
    audio: EngineAudioMetrics;
    context: MusicalContext;
  };
  /** Aplica overrides de Chronos al contexto musical */
  applyOverrides(context: MusicalContext): MusicalContext;
}

interface IEffectDispatcher {
  queueStrike(config: ForceStrikeConfig): void;
  processFrame(
    consciousness: ConsciousnessOutput,
    stabilized: StabilizedState,
    context: MusicalContext,
    vibeId: string
  ): CombinedEffectOutput;
}

interface IConsciousnessTelemetryProvider {
  getTelemetry(
    output: ConsciousnessOutput | null,
    stabilized: StabilizedState,
    selene: SeleneTitanConscious
  ): ConsciousnessTelemetry;
  emitLogs(output: ConsciousnessOutput, energy: number, frameCount: number): void;
}

interface IZoneIntentCalculator {
  calculateZones(audio: EngineAudioMetrics, context: MusicalContext): ZoneIntentMap;
  calculateMasterIntensity(audio: EngineAudioMetrics, vibeProfile: DimmerProfile): number;
  applyNervousOverride(
    zones: ZoneIntentMap,
    nervousOutput: NervousOutput,
    audio: EngineAudioMetrics
  ): ZoneIntentMap;
}
```

### 1.5 Nuevo `update()` — orden conceptual

El `EngineDispatcher` ejecuta sin lógica inline:

```
1.  { audio, context } = chronosAdapter.injectPhantomAudio(audio, context)
2.  vibeProfile = vibeManager.getActiveVibe()
3.  if (vibeProfile.id === 'idle') → return defaultIntent   // quirófano estéril
4.  processedContext = chronosAdapter.applyOverrides(context)
5.  stabilized = stabilizationPipeline.process(processedContext, audio.energy)
6.  { selenePalette, colorPalette } = colorProcessor.generate(audio, stabilized, vibeId, isDropActive)
7.  nervousOutput = nervousSystem.updateFromTitan(...)
8.  zones = zoneCalculator.calculateZones(audio, context)
9.  zones = zoneCalculator.applyNervousOverride(zones, nervousOutput, audio)
10. masterIntensity = zoneCalculator.calculateMasterIntensity(audio, vibeProfile)
11. movement = movementGenerator.generate(audio, context, vibeId, nervousOutput.mechanics)
12. effectOutput = effectDispatcher.processFrame(consciousnessOutput, stabilized, context, vibeId)
13. { finalPalette, finalZones, finalIntensity } = applyEffectBlending(...)
14. intent = assembleIntent(finalPalette, finalZones, finalIntensity, movement, optics, effects)
15. return intent
```

El Engine pasa de **~2185 líneas** a **~250 líneas de cableado + public API passthrough**.

---

## 2) Senses — desacoplamiento

### 2.1 Auditoría de responsabilidades actuales

`senses.ts` (~1596 LOC, ~75 KB) concentra **6 dominios** en un solo archivo procedural (no es ni una clase):

| # | Dominio | LOC aprox. | Síntoma |
|---|---------|-----------|---------|
| 1 | **Worker Transport** — SAB setup, parentPort, message handler, sendMessage, health reporting, state snapshot | ~300 | `handleMessage` switch con 10 cases, `pollSharedRingBuffer`, `sendMessage`, lifecycle |
| 2 | **Ring Buffer & FFT Pipeline** — ring buffer circular 4096, snapshot linearization, AGC ordering, FFT pre/post AGC | ~150 | `processAudioBuffer` primera mitad: ring buffer write, overflow detection, snapshot creation |
| 3 | **Spectrum Analysis** — `SpectrumAnalyzer` class wrapping `GodEarAnalyzer`, WebAudio polyfill, legacy adapter | ~170 | `SpectrumAnalyzer.analyze()` con psychoacoustic scaling, `toLegacyFormat`, `toWebAudioScaledLevel` |
| 4 | **BPM Detection Pipeline** — `IntervalBPMTracker`, adaptive bass floor, centroid gating, needle pipeline, shadow logger, pocket bounds | ~350 | Gated Needle pipeline (5 pasos), `updateAdaptiveFloor`, `getPocketBounds`, Dembow Ceiling |
| 5 | **Wave8 Analysis** — `rhythmDetector`, `harmonyDetector`, `sectionTracker`, `moodSynthesizer`, genre stub | ~120 | Instanciación de 4 analyzers Wave8, `audioMetrics` construction, cache de outputs |
| 6 | **Response Assembly** — `ExtendedAudioAnalysis` build, `calculateZeroCrossingRate`, final return | ~100 | Construcción del payload final de ~50 campos |

**Diagnóstico:** El worker es simultáneamente transport layer, pipeline de DSP, detector de BPM, analizador musical y ensamblador de payload.

### 2.2 Estado final de Senses

Tras el refactor, `senses.ts` queda reducido a **dos roles**:

- **Worker Shell** — ciclo de vida del worker thread (INIT/SHUTDOWN), routing de mensajes, SAB polling, health reporting.
- **Pipeline Coordinator** — invoca los módulos de análisis en orden y ensambla el `AudioAnalysis` final.

Sale de Senses: toda la matemática de FFT, BPM, gating, Wave8 y la lógica de ring buffer.

### 2.3 Nuevas clases — Senses side

| Clase | Tipo | Responsabilidad única | Estado interno |
|---|---|---|---|
| `WorkerTransport` | Servicio | Abstracción de `parentPort` / `sendMessage`. Maneja el protocolo de mensajes, heartbeat ack, health report, state snapshot/restore. Aislamiento total del canal de comunicación. | `parentPort` ref, `BetaState` de lifecycle (isRunning, startTime, messagesProcessed). |
| `SABConsumer` | Servicio | Poll de `SharedRingBufferReader`, despacho de slices al pipeline. Encapsula toda la lógica de `pollSharedRingBuffer` + peak telemetry. | `sabReader`, `sabPollInterval`, `sabReadBuffer`, peak counters. |
| `AudioRingBuffer` | Servicio | Ring buffer circular de 4096 samples, write index, linearización de snapshot, zero-alloc reuse. Reemplaza los campos `ringBuffer`, `ringBufferWriteIndex`, `ringBufferFilled`, `snapshotBuffer` del state global. | `ringBuffer: Float32Array(4096)`, `snapshotBuffer: Float32Array(4096)`, `writeIndex`, `filled`. |
| `SpectrumAnalyzer` | Existente (extraer) | Wrapping de `GodEarAnalyzer` + conversión a legacy format + psychoacoustic scaling (WebAudio polyfill). Ya es una clase; se mueve a su propio archivo sin cambios funcionales. | `godEar`, `prevEnergy`, `frameCount`, `lastGodEarResult`. |
| `PsychoacousticScaler` | **Puro** | `toWebAudioScaledLevel`, `clamp`. Funciones de transferencia dB → lineal para escalar bandas a rango [0,1] compatible WebAudio. | Ninguno. |
| `GatedNeedlePipeline` | **Puro** | Los 4 pasos del needle: bass flux computation, centroid gating, sniper guard, adaptive floor. Recibe spectrum raw → devuelve `needle: number`. | Ninguno (estado del floor se pasa como argumento). |
| `AdaptiveFloorTracker` | Servicio | Mantiene el buffer rolling de `rawBassFlux` peaks y calcula el floor adaptativo (40% mediana). Reemplaza `adaptiveFloorBuffer` + `adaptiveFloor` globales. | `floorBuffer: number[]`, `currentFloor`. |
| `BPMService` | Servicio | Coordina `IntervalBPMTracker` + `GatedNeedlePipeline` + `AdaptiveFloorTracker` + pocket bounds + Dembow Ceiling. Expone `{ bpm, confidence, beatPhase, kickDetected }`. | `IntervalBPMTracker` instance, `currentVibeId`, `prevSubEnergy/prevBassOnlyEnergy/prevMidEnergy`. |
| `ShadowLogger` | Servicio | Captura de telemetría offline (~46s, 1000 frames). Dump a disco una sola vez. Extraído del pipeline de BPM. | `shadowLog[]`, `shadowDumped`. |
| `Wave8AnalyzerSuite` | Servicio | Instancia y coordina `SimpleRhythmDetector`, `SimpleHarmonyDetector`, `SimpleSectionTracker`, `MoodSynthesizer`. Expone un `Wave8Output` compuesto. | Las 4 instancias de analyzers Wave8 + cached outputs. |
| `AnalysisResponseBuilder` | **Puro** | Ensambla el `ExtendedAudioAnalysis` final a partir de los outputs de Spectrum, BPM, Wave8, Energy. Incluye `calculateZeroCrossingRate`. | Ninguno. |
| `SensesPipeline` | Coordinador | El "nuevo processAudioBuffer". Invoca AudioRingBuffer → SpectrumAnalyzer → BPMService → Wave8Suite → ResponseBuilder en orden. Cero lógica propia. | `totalSamplesProcessed`. |

### 2.4 Interfaces clave

```ts
interface IAudioRingBuffer {
  write(incoming: Float32Array): void;
  isFilled(): boolean;
  getSnapshot(): Float32Array;  // linearized 4096-sample view
  flush(): void;
  getTotalSamplesProcessed(): number;
}

interface IGatedNeedlePipeline {
  /** Recibe raw spectrum bands → devuelve needle value (0 = no kick, >0 = kick onset) */
  process(input: NeedleInput): NeedleOutput;
}

interface NeedleInput {
  rawSubBassEnergy: number;
  rawBassOnlyEnergy: number;
  rawMidEnergy: number;
  spectralCentroid: number;
  prevSubEnergy: number;
  prevBassOnlyEnergy: number;
  prevMidEnergy: number;
  currentFloor: number;
}

interface NeedleOutput {
  needle: number;
  rawLowFlux: number;
  rawMidFlux: number;
  rawBassFlux: number;
  newPrevSubEnergy: number;
  newPrevBassOnlyEnergy: number;
  newPrevMidEnergy: number;
}

interface IAdaptiveFloorTracker {
  update(rawBassFlux: number): number;  // returns current floor
  reset(): void;
}

interface IBPMService {
  process(spectrum: SpectrumResult, deterministicTimestampMs: number): BPMOutput;
  setVibe(vibeId: string): void;
  reset(): void;
}

interface BPMOutput {
  bpm: number;
  confidence: number;
  beatPhase: number;
  kickDetected: boolean;
  kickCount: number;
  lastBeatTime: number;
}

interface IWave8AnalyzerSuite {
  analyze(metrics: AudioMetrics): Wave8Output;
}

interface Wave8Output {
  rhythm: RhythmOutput;
  harmony: HarmonyOutput;
  section: SectionOutput;
  genre: GenreOutput;
  mood: MoodOutput;
}

interface IAnalysisResponseBuilder {
  build(
    spectrum: SpectrumResult,
    bpm: BPMOutput,
    wave8: Wave8Output,
    energy: number,
    agcGainFactor: number,
    frameId: number,
    inputTelemetry: { peakAbs: number; rms: number }
  ): ExtendedAudioAnalysis;
}

interface IWorkerTransport {
  send<T>(type: MessageType, target: string, payload: T, priority?: MessagePriority): void;
  onMessage(handler: (msg: WorkerMessage) => void): void;
  sendHealth(report: WorkerHealth): void;
}

interface ISABConsumer {
  start(intervalMs: number): void;
  stop(): void;
  onSamples(handler: (slice: Float32Array) => void): void;
}
```

### 2.5 Nuevo `processAudioBuffer` — orden conceptual

El `SensesPipeline` ejecuta:

```
1.  ringBuffer.write(incomingBuffer)
2.  inputTelemetry = measureInputPeak(incomingBuffer)
3.  totalSamples += incomingBuffer.length
4.  if (!ringBuffer.isFilled()) → return earlyExitAnalysis(inputTelemetry)
5.  snapshot = ringBuffer.getSnapshot()
6.  spectrum = spectrumAnalyzer.analyze(snapshot, sampleRate)
7.  agcResult = agc.processBuffer(snapshot)
8.  applyInputGain(snapshot, config.inputGain)
9.  deterministicTimestampMs = totalSamples / sampleRate * 1000
10. bpmOutput = bpmService.process(spectrum, deterministicTimestampMs)
11. energy = normalizeEnergy(spectrum)
12. wave8Output = wave8Suite.analyze(audioMetrics)
13. analysis = responseBuilder.build(spectrum, bpmOutput, wave8Output, energy, agcResult, ...)
14. return analysis
```

El nuevo `handleMessage` solo cablea:

```
case AUDIO_BUFFER:
  analysis = sensesPipeline.process(buffer)
  transport.send(AUDIO_ANALYSIS, 'alpha', analysis, ...)

case INIT:
  sabConsumer.start(21)
  transport.send(READY, 'alpha', ...)

case RESET_PACEMAKER:
  bpmService.reset()
  spectrumAnalyzer.reset()
  ringBuffer.flush()
  agc.reset()
```

Senses pasa de **~1596 líneas procedurales** a **~150 líneas de shell + routing**.

---

## 3) Estructura de carpetas V2

### 3.1 Engine

```
engine/
├── TitanEngine.ts                        # Slim: EngineDispatcher + public API passthrough
├── dispatcher/
│   └── EngineDispatcher.ts               # Coordinador del pipeline update()
├── stabilization/
│   ├── StabilizationPipeline.ts          # Servicio: secuencia Key→Energy→Mood→Strategy
│   └── types.ts                          # StabilizedState, inputs/outputs
├── color/                                # (existente, se expande)
│   ├── SeleneColorEngine.ts              # (existente, sin tocar)
│   ├── SeleneColorInterpolator.ts        # (existente, referenciado por ColorProcessor)
│   ├── ColorProcessor.ts                 # Servicio: genera paleta end-to-end
│   ├── PaletteConverter.ts               # Puro: selenePalette → colorPalette, consciousness mods
│   ├── KeyStabilizer.ts                  # (existente)
│   ├── EnergyStabilizer.ts               # (existente)
│   ├── MoodArbiter.ts                    # (existente)
│   ├── StrategyArbiter.ts                # (existente)
│   └── colorConstitutions.ts             # (existente)
├── movement/                             # (existente, se expande)
│   ├── MovementGenerator.ts              # Servicio: VMM stereo + mechanics bypass
│   ├── VibeMovementManager.ts            # (existente)
│   ├── VibeMovementPresets.ts            # (existente)
│   └── ...                               # (existentes)
├── chronos/
│   └── ChronosAdapter.ts                 # Servicio: phantom buffer, playhead, overrides
├── effects/
│   └── EffectDispatcher.ts               # Servicio: manual strikes, consciousness triggers, globalComp
├── telemetry/
│   ├── ConsciousnessTelemetryProvider.ts  # Servicio: construye payload UI (~250 LOC extraídas)
│   └── EngineLogEmitter.ts               # Servicio: emitConsciousnessLogs (~130 LOC extraídas)
├── zones/
│   ├── ZoneIntentCalculator.ts           # Puro: calculateZoneIntents, masterIntensity, noise gate
│   └── SectionNormalizer.ts              # Puro: normalizeSectionType
├── physics/                              # (existente)
│   └── ElementalModifiers.ts             # (existente)
├── audio/                                # (existente)
├── musical/                              # (existente)
├── vibe/                                 # (existente)
├── types.ts                              # (existente, EngineAudioMetrics etc.)
├── __tests__/
└── index.ts
```

### 3.2 Senses (nueva ubicación: `src/core/senses/`)

Actualmente el código vive en `src/workers/senses.ts`. Proponemos:

- El **worker shell** permanece en `src/workers/senses.ts` (es el entry-point del Worker Thread — Node lo requiere como archivo standalone).
- La **lógica de análisis** se extrae a `src/core/senses/` como módulos importables.

```
core/
└── senses/
    ├── pipeline/
    │   ├── SensesPipeline.ts             # Coordinador: ring → spectrum → bpm → wave8 → response
    │   └── types.ts                      # SpectrumResult, PipelineConfig
    ├── buffer/
    │   ├── AudioRingBuffer.ts            # Servicio: ring buffer 4096 + snapshot
    │   └── SABConsumer.ts                # Servicio: SharedRingBuffer polling
    ├── spectrum/
    │   ├── SpectrumAnalyzer.ts           # Extraído de senses.ts (clase existente, movida)
    │   └── PsychoacousticScaler.ts       # Puro: toWebAudioScaledLevel, clamp
    ├── bpm/
    │   ├── BPMService.ts                 # Servicio: coordina tracker + needle + floor + pocket
    │   ├── GatedNeedlePipeline.ts        # Puro: los 4 pasos del needle
    │   ├── AdaptiveFloorTracker.ts       # Servicio: rolling buffer de floor adaptativo
    │   └── types.ts                      # BPMOutput, NeedleInput/Output
    ├── analyzers/
    │   └── Wave8AnalyzerSuite.ts         # Servicio: rhythm + harmony + section + mood
    ├── response/
    │   └── AnalysisResponseBuilder.ts    # Puro: ensambla ExtendedAudioAnalysis
    ├── telemetry/
    │   └── ShadowLogger.ts              # Servicio: captura offline de 1000 frames
    ├── transport/
    │   └── WorkerTransport.ts            # Servicio: abstracción de parentPort/sendMessage
    ├── __tests__/
    └── index.ts

workers/
├── senses.ts                             # Slim shell: imports pipeline, wires messages
├── GodEarFFT.ts                          # (existente, sin tocar)
├── IntervalBPMTracker.ts                 # (existente, consumido por BPMService)
├── TrinityBridge.ts                      # (existente)
├── TrinityOrchestrator.ts                # (existente)
├── WorkerProtocol.ts                     # (existente)
├── utils/                                # (existente)
│   ├── AdaptiveEnergyNormalizer.ts
│   └── AutomaticGainControl.ts
└── ...
```

**Justificación de la separación `core/senses/` vs `workers/`:**

- `workers/senses.ts` **debe** seguir siendo el entry-point del Worker Thread (Node requiere un archivo de script para `new Worker(...)`).
- Pero la **lógica pura** (DSP, BPM, gating, response assembly) es testeable sin necesidad de un Worker Thread. Al moverla a `core/senses/`, se pueden ejecutar tests unitarios directamente en el proceso principal, sin levantar workers.
- El shell en `workers/senses.ts` solo importa `SensesPipeline` y cablea `parentPort.on('message')`.

---

## 4) Inyección de dependencias

### 4.1 Engine composition root

```ts
// engine/index.ts
const vibeManager       = VibeManager.getInstance();
const effectManager     = getEffectManager();
const chronosInjector   = getChronosInjector();

const stabilization     = new StabilizationPipeline();
const paletteConverter  = new PaletteConverter();
const colorProcessor    = new ColorProcessor(paletteConverter, vibeManager);
const movementGenerator = new MovementGenerator(vibeMovementManager);
const chronosAdapter    = new ChronosAdapter(chronosInjector);
const effectDispatcher  = new EffectDispatcher(effectManager);
const zoneCalculator    = new ZoneIntentCalculator();
const nervousSystem     = new SeleneLux({ debug: false });
const selene            = new SeleneTitanConscious({ debug: false });
const telemetryProvider = new ConsciousnessTelemetryProvider();
const logEmitter        = new EngineLogEmitter();

const engine = new EngineDispatcher({
  vibeManager,
  stabilization,
  colorProcessor,
  movementGenerator,
  chronosAdapter,
  effectDispatcher,
  zoneCalculator,
  nervousSystem,
  selene,
  telemetryProvider,
  logEmitter,
});

// TitanEngine wrapper mantiene la API pública idéntica
export const titanEngine = new TitanEngine(engine);
```

### 4.2 Senses composition root

```ts
// workers/senses.ts (slim shell)
import { SensesPipeline } from '../core/senses/pipeline/SensesPipeline';
import { WorkerTransport } from '../core/senses/transport/WorkerTransport';
import { SABConsumer } from '../core/senses/buffer/SABConsumer';

const transport = new WorkerTransport(parentPort);
const sabConsumer = new SABConsumer(workerData?.sharedAudioBuffer);
const pipeline = new SensesPipeline(config);

sabConsumer.onSamples((slice) => {
  const analysis = pipeline.process(slice);
  transport.send(MessageType.AUDIO_ANALYSIS, 'alpha', analysis, ...);
});

transport.onMessage((msg) => {
  switch (msg.type) {
    case MessageType.INIT:
      sabConsumer.start(21);
      transport.send(MessageType.READY, 'alpha', { nodeId: 'beta' });
      break;
    case MessageType.AUDIO_BUFFER:
      if (sabConsumer.isActive()) return; // SAB GAG
      const analysis = pipeline.process(msg.payload);
      transport.send(MessageType.AUDIO_ANALYSIS, 'alpha', analysis, ...);
      break;
    case MessageType.RESET_PACEMAKER:
      pipeline.reset();
      break;
    case MessageType.SET_VIBE:
      pipeline.setVibe(msg.payload.vibeId);
      break;
    // ... rest of lifecycle handlers
  }
});
```

### 4.3 Reglas de DI (mismo standard WAVE 3504)

- **Prohibido** importar singletons desde dentro de las nuevas clases.
- Toda nueva clase recibe colaboradores **vía constructor**, tipados por interfaz.
- Las clases **puras** (`GatedNeedlePipeline`, `PsychoacousticScaler`, `PaletteConverter`, `ZoneIntentCalculator`, `AnalysisResponseBuilder`, `SectionNormalizer`) no reciben ningún colaborador; solo datos por método.

---

## 5) Plan de migración (orientativo para WAVE 3505)

### Engine (en orden)

1. Crear carpetas vacías + `types.ts` de cada cápsula.
2. **Puros primero:** Extraer `PaletteConverter`, `ZoneIntentCalculator`, `SectionNormalizer` con tests de paridad.
3. **Servicios internos:** Extraer `StabilizationPipeline` (wrap de los 4 stabilizers existentes), `ColorProcessor`, `MovementGenerator`.
4. **Servicios con dependencias externas:** `ChronosAdapter`, `EffectDispatcher`, `ConsciousnessTelemetryProvider`, `EngineLogEmitter`.
5. Crear `EngineDispatcher` y reducir `TitanEngine.ts` a un wrapper de API pública.
6. Tests de regresión: snapshot de `LightingIntent` contra capturas pre-refactor.

### Senses (en orden)

1. Crear `core/senses/` con carpetas vacías.
2. **Puros primero:** Extraer `GatedNeedlePipeline`, `PsychoacousticScaler`, `AnalysisResponseBuilder` con tests unitarios directos (sin Worker).
3. **Servicios de estado:** Extraer `AudioRingBuffer`, `AdaptiveFloorTracker`, `ShadowLogger`.
4. Mover `SpectrumAnalyzer` class a su propio archivo (ya es una clase, solo move).
5. Crear `BPMService` que coordina tracker + needle + floor + pocket.
6. Crear `Wave8AnalyzerSuite` que wrappea los 4 analyzers.
7. Crear `SensesPipeline` coordinador.
8. Crear `WorkerTransport` + `SABConsumer`.
9. Reducir `workers/senses.ts` a slim shell.
10. Tests de regresión: replay de `live_audio_dump.json` contra output pre-refactor.

---

## 6) Métricas de éxito

| Métrica | Target |
|---|---|
| `TitanEngine.ts` LOC | ≤ 350 (hoy ~2185) |
| `senses.ts` LOC | ≤ 200 (hoy ~1596) |
| Módulos puros testeables sin mocks | `GatedNeedlePipeline`, `PsychoacousticScaler`, `AnalysisResponseBuilder`, `PaletteConverter`, `ZoneIntentCalculator`, `SectionNormalizer` (6 módulos) |
| Imports de singletons fuera de composition roots | 0 |
| Paridad bit-a-bit `LightingIntent` Engine | 60s de captura sintética pre/post |
| Paridad bit-a-bit `AudioAnalysis` Senses | Replay de `live_audio_dump.json` pre/post |
| Tests de `GatedNeedlePipeline` | Replay de 1000 frames shadow dump con BPM ±2 de referencia |

---

## 7) Lo que este blueprint NO hace (fuera de alcance)

- No introduce `AgnosticEngine` ni Sub-Emisores (WAVE 3505+).
- No toca `GodEarFFT.ts`, `IntervalBPMTracker.ts`, `TrinityBridge.ts`, `TrinityOrchestrator.ts`.
- No toca los Stabilizers internos (`KeyStabilizer`, `EnergyStabilizer`, `MoodArbiter`, `StrategyArbiter`) — solo los wrappea en `StabilizationPipeline`.
- No toca `SeleneLux` (NervousSystem) ni `SeleneTitanConscious` (Consciousness) — solo se inyectan por constructor.
- No cambia el protocolo `WorkerProtocol.ts` ni la forma del `AudioAnalysis` payload.
- No optimiza rendimiento DSP; solo redistribuye responsabilidades.

---

Fin del documento. Listo para revisión de Dirección de Arquitectura antes de pasar a código.
