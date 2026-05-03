# WAVE 3504 POST-MORTEM — CORE MODULAR MAP

Estado: Auditoria post-refactor WAVE 3504 (EXT.1–EXT.5)
Alcance: `src/core/arbiter/`, `src/core/orchestrator/`, `src/core/engine/`, `src/core/senses/`
Condicion: Cero modificaciones de codigo. Solo realidad del workspace.
Sucesor de: `CORE-MONOLITH-MAP.md` (WAVE 3503)

---

## 1) Nuevo Flujo de Frame Post-3504

### 1.1 Heartbeat — FrameScheduler (nuevo módulo extraído)

El bucle maestro ya **no vive inline** en `TitanOrchestrator`. Fue extraído a `FrameScheduler`.

- Instancia declarada en campo de clase: `private readonly scheduler = new FrameScheduler(23, () => this.processFrame())`
- 23 ms = ~44 Hz. Proteger contra overlap con `isProcessingFrame` (Async Stampede Guard WAVE 2211) es responsabilidad del scheduler, no del orchestrator.
- `start()` / `stop()` son los únicos controles de ciclo de vida expuestos.

Referencias:
- [Declaración scheduler](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L166)
- [FrameScheduler class](electron-app/src/core/orchestrator/scheduler/FrameScheduler.ts#L40)
- [Stampede Guard isProcessingFrame](electron-app/src/core/orchestrator/scheduler/FrameScheduler.ts#L49)

---

### 1.2 Ingesta de audio — dos caminos paralelos

**Camino A — Bandas ya procesadas desde frontend (30/60 fps)**

```
Frontend IPC → TitanOrchestrator.processAudioFrame() → lastAudioData
```

- Consumes `bass/mid/high/energy` del frontend sin pasar por worker.

Referencias:
- [processAudioFrame comentario de rutas](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L340)
- [processAudioFrame método](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1886)

**Camino B — Buffer crudo Float32Array → Worker Senses → Brain**

```
Frontend IPC
  → TitanOrchestrator.processAudioBuffer()
  → TrinityOrchestrator.feedAudioBuffer()
  → Worker Senses: SensesPipeline.processFrame(Float32Array)
      ↓ AudioRingBuffer → SpectrumAnalyzer → BPMService → SectionTracker → AnalysisResponseBuilder
      ↓ → ExtendedAudioAnalysis emitida como MessageType.AUDIO_ANALYSIS
  → TrinityOrchestrator recibe AUDIO_ANALYSIS
  → TrinityBrain construye MusicalContext + emite 'audio-levels'
  → TitanOrchestrator.on('audio-levels') → fusiona en lastAudioData
```

Referencias:
- [trinity.feedAudioBuffer](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1981)
- [SensesPipeline.processFrame](electron-app/src/core/senses/pipeline/SensesPipeline.ts#L94)
- [Worker shell → pipeline.processFrame (SAB poll)](electron-app/src/workers/senses.ts#L152)
- [Worker shell → pipeline.processFrame (buffer directo)](electron-app/src/workers/senses.ts#L276)
- [setBroadcastCallback](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1838)
- [setHotFrameCallback](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1848)

---

### 1.3 Cadena por frame principal: AudioRingBuffer → FinalLightingTarget

Secuencia exacta de `processFrame()` post-3504:

```
FrameScheduler tick (23ms)
  └─ TitanOrchestrator.processFrame()                            [L691]
       │
       ├─ 1. brain.getCurrentContext() → MusicalContext
       │
       ├─ 2. SyncSmoother.smooth(rawBands, rawRhythm) → SmoothedBands + FusedRhythm
       │      └─ engineAudioMetrics: {bpm, beatPhase, onBeat, syncopation, bands…}
       │                            (WAVE 3504.4 — extraído de Orchestrator a SyncSmoother)
       │
       ├─ 3. engine.update(context, engineAudioMetrics) → LightingIntent
       │
       ├─ 4. masterArbiter.setTitanIntent(titanLayer)           [L997]
       │      └─ ArbitrationDirector.setTitanIntent()
       │           └─ LayerStateManager.setTitanIntent()         [L197]
       │
       ├─ 5. IntentComposer.compose(effectOutput, fixtures, chronosIds)  [L1021]
       │      └─ produce EffectIntentMap (fixture-id → EffectIntent)
       │      └─ respeta ChronosProtectedIds (fixtures bajo playback)
       │
       ├─ 6. masterArbiter.setEffectIntents(intentMap)           [L1029]
       │      └─ ArbitrationDirector.setEffectIntents()          [L523]
       │           └─ strip movement; Mover Shield WAVE 3305/3307
       │           └─ LayerStateManager.setEffectIntents()       [L443]
       │
       ├─ 7. masterArbiter.arbitrate()                           [L1038]
       │      └─ ArbitrationDirector.arbitrate()                 [L767]
       │           ├─ Si playbackActive → híbrido Chronos/Titan (HTP/LTP/ADD)
       │           └─ Normal: por fixture → arbitrateFixture(id, now)
       │                └─ mergeChannelForFixture() × canal (dimmer/rgb/pan/tilt/zoom…)
       │                └─ Grand Master + InhibitLimit aplicados
       │                └─ Blackout L4 (dimmer=0 only, WAVE 3240)
       │                └─ clearEffectIntents() al final del frame  [L982]
       │           → FinalLightingTarget
       │
       ├─ 8. HAL.renderFromTarget(arbitratedTarget, fixtures, halAudioMetrics)  [L1094]
       │      → FixtureState[]
       │
       ├─ 9. Broadcast UI (ANTES de flush — WAVE 3065)           [L1307]
       │      setBroadcastCallback → SeleneTruth
       │      setHotFrameCallback  → hot-frame IPC
       │
       └─ 10. HAL.flushToDriver(fixtureStates)                   [L1374]
              └─ Aduana DMX + flush hardware físico
```

**Nota crítica WAVE 3065:** el broadcast de UI se emite ANTES de `flushToDriver`. Los valores enviados al frontend son la salida real del motor (post-arbitrage, pre-DMX).

---

### 1.4 Camino Chronos (TimelineEngine — senda lateral)

`TimelineEngine` es un motor de reproducción de timeline **ortogonal** al tick principal. No pasa por `processFrame()`.

```
TimelineEngine.tick()
  └─ evalúa fixtures en el frame de playback actual
  └─ masterArbiter.setPlaybackFrame(fixtureTargets)   [L376]
       └─ ArbitrationDirector.setPlaybackFrame()       [L719]
            └─ playbackActive = true
            └─ currentPlaybackFrame ← Map<fixtureId, FixtureLightingTarget>

  Cuando para:
  └─ masterArbiter.stopPlayback()                     [L410]
       └─ ArbitrationDirector.stopPlayback()          [L731]
            └─ playbackActive = false
```

En el siguiente tick del `FrameScheduler`, `arbitrate()` detecta `playbackActive = true` y mezcla Chronos sobre Titan en modo híbrido (HTP por defecto, LTP/ADD si `blendMode` lo especifica).

---

## 2) Topología de Acoplamiento Post-3504

### 2.1 Contratos entre módulos (interfaces reales)

#### TitanOrchestrator → ArbitrationDirector/MasterArbiter

| Llamada | Propósito | Línea (Orchestrator) |
|---|---|---|
| `masterArbiter.setTitanIntent(titanLayer)` | Inyectar L0 cada frame | L997 |
| `this.intentComposer.compose(...)` | Producir EffectIntentMap | L1021 |
| `masterArbiter.setEffectIntents(intentMap)` | Inyectar L3 cada frame | L1029 |
| `masterArbiter.arbitrate()` | Ejecutar composición multicapa | L1038 |

Tipo devuelto por `arbitrate()`:
```ts
FinalLightingTarget {
  fixtures: FixtureLightingTarget[]  // dimmer, rgb, pan, tilt, zoom, focus, speed, color_wheel, phantomChannels
  globalEffects: GlobalEffectsState
  timestamp: number
  frameNumber: number
  _layerActivity: LayerActivitySummary
}
```

#### ArbitrationDirector → ILayerStateManager

`ArbitrationDirector` inyecta por constructor un `ILayerStateManager`. El estado de las 5 capas (L0–L4) reside **en el manager**, el director solo coordina y aplica lógica de merge.

```ts
// ILayerStateManager (src/core/arbiter/state/LayerStateManager.ts#L75)
interface ILayerStateManager {
  setTitanIntent(intent: Layer0_Titan): void          // L77
  setManualOverride(override: Layer2_Manual): void
  setEffectIntents(intents: EffectIntentMap): void    // L103
  clearEffectIntents(): void                          // L106
  getTitanIntent(): Layer0_Titan | null
  getManualOverride(fixtureId: string): Layer2_Manual | undefined
  getEffectIntent(fixtureId: string): EffectIntent | undefined
  isBlackoutActive(): boolean
  // … (CRUD completo L429–L466)
}
```

**Punto de extensión clave:** `ILayerStateManager` es una **interfaz inyectada por DI** — permite sustituir la implementación sin modificar `ArbitrationDirector`.

Referencias:
- [ILayerStateManager interfaz](electron-app/src/core/arbiter/state/LayerStateManager.ts#L75)
- [ArbitrationDirector inyección por constructor](electron-app/src/core/arbiter/ArbitrationDirector.ts#L205)
- [campo layerState tipado](electron-app/src/core/arbiter/ArbitrationDirector.ts#L127)

#### IntentComposer (puro, sin estado)

`IntentComposer.compose()` es una función pura. No tiene singletons ni estado interno.

```ts
// Contrato de entrada/salida (src/core/orchestrator/intent/types.ts)
compose(
  effectOutput: CombinedEffectOutput,
  fixtures: FixtureSnapshot[],
  chronosProtectedIds: ChronosProtectedIds,
  intentBuf?: EffectIntentMap
): IntentCompositionResult {
  intentMap: EffectIntentMap   // Map<fixtureId, EffectIntent>
  intentCount: number
  mixBus: 'htp' | 'global'
  globalComposition: number
}
```

Referencias:
- [IntentComposer class](electron-app/src/core/orchestrator/intent/IntentComposer.ts#L54)
- [compose método](electron-app/src/core/orchestrator/intent/IntentComposer.ts#L65)
- [tipos entrada/salida](electron-app/src/core/orchestrator/intent/types.ts#L1)

#### SensesPipeline (puro, modular, inyectable)

```ts
// Contrato (src/core/senses/pipeline/SensesPipeline.ts#L44)
interface ISensesPipeline {
  processFrame(incoming: Float32Array): ExtendedAudioAnalysis
  setVibe(vibeId: string, params: VibeParams): void
  reset(): void
}
```

La pipeline interna en `processFrame()`:
```
Float32Array
  → AudioRingBuffer.push()
  → AudioRingBuffer.snapshot() → Float32Array (sin alloc)
  → SpectrumAnalyzer.analyze(snapshot) → SpectrumFrame
  → BPMService.processFrame(spectrum, timestampMs) → BPMOutput
  → SectionTracker.update(bpmOutput) → SectionInfo
  → AGCNormalizer / EnergyNormalizer
  → AnalysisResponseBuilder.build(...) → ExtendedAudioAnalysis
```

Referencias:
- [ISensesPipeline interfaz](electron-app/src/core/senses/pipeline/SensesPipeline.ts#L44)
- [SensesPipeline class](electron-app/src/core/senses/pipeline/SensesPipeline.ts#L61)
- [processFrame implementación](electron-app/src/core/senses/pipeline/SensesPipeline.ts#L94)
- [BPMService.processFrame en pipeline](electron-app/src/core/senses/pipeline/SensesPipeline.ts#L129)

#### Worker Shell (senses.ts) — delegación total

El worker ya **no tiene lógica de análisis**. Es transporte puro.

```
MessageType.AUDIO_BUFFER → pipeline.processFrame(buffer)  [L276]
                         → sendMessage(AUDIO_ANALYSIS, analysis)

SAB poll (21ms)          → pipeline.processFrame(slice)    [L152]
                         → sendMessage(AUDIO_ANALYSIS, analysis)

MessageType.SET_VIBE     → pipeline.setVibe(vibeId, params)
MessageType.RESET_PACEMAKER → pipeline.reset()
```

Referencias:
- [SAB poll → processFrame](electron-app/src/workers/senses.ts#L152)
- [AUDIO_BUFFER → processFrame](electron-app/src/workers/senses.ts#L276)

---

### 2.2 Acoplamiento residual (deuda conocida post-3504)

| Punto | Tipo | Descripción |
|---|---|---|
| `TitanOrchestrator` usa `masterArbiter` como import singleton | Singleton import | No inyectado; acoplamiento estático |
| `ArbiterIPCHandlers.ts` importa `getTitanOrchestrator()` | Circular potencial | IPC de arbiter vuelve a llamar orchestrator |
| `TimelineEngine.ts` importa `masterArbiter` singleton directamente | Singleton import | Bypass de la cadena orquestador-arbiter |
| `ArbitrationDirector` mezcla lógica de IK + patterns + playback | Responsabilidad múltiple | Nodo todavía más grande de lo ideal |

---

## 3) Hook Points para WAVE 3505 (AgnosticEngine + Sub-emitters)

### 3.1 Inserción de un AgnosticEngine en el pipeline de frame

**Punto de inserción:** entre `engine.update()` y `masterArbiter.setTitanIntent()`.

```
// TitanOrchestrator.ts L991–L997 (processFrame)
const titanLayer = titanIntent → Layer0_Titan

// [HOOK WAVE 3505]
// AgnosticEngine.emit(context, metrics) puede producir un Layer0_Titan alternativo
// o combinado antes de inyectarlo al arbiter.
masterArbiter.setTitanIntent(titanLayer)   // L997
```

Modo de extensión: `TitanOrchestrator` recibe `AgnosticEngine[]` por DI (igual que `IntentComposer`). Cada engine corre en paralelo y sus salidas se mezclan antes de `setTitanIntent`. No requiere modificar `ArbitrationDirector` ni `LayerStateManager`.

### 3.2 Sub-emitter de efectos por engine agnostic

**Punto de inserción:** entrada de `IntentComposer.compose()`.

```
// TitanOrchestrator.ts L1021
const { intentMap } = this.intentComposer.compose(
  effectOutput,        // ← aquí: CombinedEffectOutput puede venir de N engines
  fixtures,
  chronosProtectedIds,
  intentBuf
)
```

Cada sub-emitter produce un `CombinedEffectOutput` parcial. `IntentComposer` solo necesita que la interfaz `CombinedEffectOutput` sea pública (ya lo es, definida en `src/core/effects/types.ts`). Se pueden fusionar los outputs antes de pasar a `compose()` sin tocar el arbiter.

### 3.3 Capa L0 alternativa sin modificar ArbitrationDirector

`setTitanIntent(intent: Layer0_Titan)` en `ArbitrationDirector` [L289] ya acepta cualquier valor que cumpla `Layer0_Titan`. AgnosticEngine puede construir su propia versión del intent con la misma forma sin necesitar un nuevo layer.

```ts
// src/core/arbiter/ArbitrationDirector.ts#L289
setTitanIntent(intent: Layer0_Titan): void {
  this.layerState.setTitanIntent(intent)
}
```

No existe ningún guard de identidad aquí — el primero en escribir en el frame gana, o se puede pre-fusionar externamente.

### 3.4 Capa de estado propia para un engine agnostic (sin tocar LayerStateManager)

`ArbitrationDirector` acepta un `ILayerStateManager` inyectado [L205]. Un AgnosticEngine puede traer su propia implementación del manager, o un decorator del existente que añada subcanales sin modificar la clase `LayerStateManager`.

```ts
// Patrón: Decorator sobre la implementación real
class AgnosticLayerStateAdapter implements ILayerStateManager {
  constructor(private inner: ILayerStateManager) {}
  // Override solo los métodos necesarios, delega el resto
}
```

### 3.5 Resumen de hooks con localización exacta

| WAVE 3505 Hook | Archivo | Línea | Mecanismo |
|---|---|---|---|
| AgnosticEngine output → titanIntent pre-inject | `TitanOrchestrator.ts` | L991–L997 | DI de engines[] en Orchestrator |
| Sub-emitter output → effectIntentMap | `TitanOrchestrator.ts` | L1021 | Fusión CombinedEffectOutput antes de compose() |
| AgnosticEngine → setTitanIntent directo | `ArbitrationDirector.ts` | L289 | Acepta Layer0_Titan de cualquier fuente |
| LayerState extensible | `LayerStateManager.ts` | L75 | Decorator / nueva impl de ILayerStateManager |
| Chronos override | `TimelineEngine.ts` | L376 | setPlaybackFrame() sigue siendo el hook de playback |

---

## 4) Inventario de Módulos Core (Estado Real Post-3504)

### `src/core/senses/`

| Archivo | Clase/Interfaz | Responsabilidad única |
|---|---|---|
| `pipeline/SensesPipeline.ts` | `SensesPipeline` / `ISensesPipeline` | Coordinar pipeline DSP frame a frame |
| `io/AudioRingBuffer.ts` | `AudioRingBuffer` | Buffer circular sin alloc, snapshot determinista |
| `io/AnalysisResponseBuilder.ts` | `AnalysisResponseBuilder` | Ensamblar `ExtendedAudioAnalysis` |
| `services/BPMService.ts` | `BPMService` + `ShadowLogger` | Tracker rítmico + log diagnóstico |
| `services/SpectrumAnalyzer.ts` | `SpectrumAnalyzer` | FFT/bandas espectrales |
| `services/SectionTracker.ts` | `SectionTracker` | Segmentación estructural musical |

### `src/core/orchestrator/`

| Archivo | Clase/Interfaz | Responsabilidad única |
|---|---|---|
| `TitanOrchestrator.ts` | `TitanOrchestrator` | Frame coordinator — conecta todos los módulos |
| `scheduler/FrameScheduler.ts` | `FrameScheduler` | Tick 23ms + stampede guard |
| `intent/IntentComposer.ts` | `IntentComposer` | `CombinedEffectOutput → EffectIntentMap` (puro) |
| `intent/types.ts` | tipos | Contratos I/O de IntentComposer |
| `metrics/SyncSmoother.ts` | `SyncSmoother` | EMA de bandas + fusión Worker/PLL |
| `metrics/types.ts` | tipos | `RawAudioBands`, `FusedRhythm`, `SmoothedBands` |

### `src/core/arbiter/`

| Archivo | Clase/Interfaz | Responsabilidad única |
|---|---|---|
| `ArbitrationDirector.ts` | `ArbitrationDirector` | Frame arbitration + merge por fixture |
| `MasterArbiter.ts` | `MasterArbiter` | Facade de compatibilidad sobre Director |
| `state/LayerStateManager.ts` | `LayerStateManager` / `ILayerStateManager` | CRUD de capas L0–L4 (inyectable) |
| `merge/MergeStrategies.ts` | — | Implementaciones HTP/LTP/ADD/global |
| `merge/MergeStrategyResolver.ts` | — | Selección de estrategia por canal+intent |
| `types.ts` | tipos | `Layer0_Titan`, `Layer2_Manual`, `EffectIntentMap`, etc. |

### `src/core/engine/`

| Archivo | Clase/Interfaz | Responsabilidad única |
|---|---|---|
| `TimelineEngine.ts` | `TimelineEngine` | Playback de Chronos → `setPlaybackFrame()` |

---

## 5) Diferencias Clave vs CORE-MONOLITH-MAP (WAVE 3503)

| Aspecto | Antes (3503) | Después (3504) |
|---|---|---|
| Heartbeat | `setInterval` inline en `TitanOrchestrator` | `FrameScheduler` extraído, inyectado por campo |
| Cálculo rítmico/bandas | Inline en `processFrame()` (~200 líneas) | `SyncSmoother` módulo separado, contratos en `metrics/types.ts` |
| Composición de EffectIntentMap | Inline en `TitanOrchestrator` | `IntentComposer` módulo puro, contratos en `intent/types.ts` |
| Senses worker | God file (~1500 líneas) con todo el DSP | Shell delegante → `SensesPipeline` + servicios independientes |
| Arbiter state | Todo dentro de `MasterArbiter` | `ILayerStateManager` interfaz inyectable + `LayerStateManager` impl |
| Facade de compatibilidad | `MasterArbiter` era el arbiter real | `MasterArbiter` es facade sobre `ArbitrationDirector` |

---

*Documento generado desde código fuente real. Sin especulación. WAVE 3504 / Abril 2026.*
