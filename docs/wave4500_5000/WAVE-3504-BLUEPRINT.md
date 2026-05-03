# WAVE 3504 — THE CORE DECOUPLING BLUEPRINT

Estado: DISEÑO ARQUITECTÓNICO (PRE-CÓDIGO)
Rama objetivo: `v2-agnostic`
Predecesor: `CORE-MONOLITH-MAP.md` (WAVE 3503)
Sucesor previsto: WAVE 3505 — Implementación V2 (Sub-Emisores / AgnosticEngine)
Alcance: refactor estructural de `TitanOrchestrator` y `MasterArbiter`. NO toca `TitanEngine`, `Senses`, ni HAL.

---

## 0) Principios rectores del rediseño

1. **SRP estricto** — cada clase tiene una sola razón para cambiar.
2. **Pure first** — toda lógica matemática/composicional se aísla en módulos puros (sin estado de larga vida, sin event bus, sin singletons).
3. **Owner of state, not God of state** — el estado vive en *managers* explícitos; ni el Orchestrator ni el Arbiter mantienen mapas de fixtures, overrides o métricas EMA.
4. **DI por constructor** — los singletons (`masterArbiter`, `getEffectManager`, `vibeMovementManager`, `MoodController`) se inyectan vía interfaces, no se importan desde dentro.
5. **No regresión funcional** — el contrato del frame (`processFrame`) se mantiene byte-a-byte equivalente; sólo se redistribuyen responsabilidades.
6. **Listos para Sub-Emisores** — todas las nuevas interfaces deben ser agnósticas a "fixture/canal" y trabajar sobre el concepto de *Capability Node* del `AgnosticEngine`.

---

## 1) TitanOrchestrator — desacoplamiento

### 1.1 Estado final del Orchestrator

Tras el refactor, `TitanOrchestrator` queda reducido a **dos roles**:

- **Tick Master / Scheduler** — `setInterval` 23 ms, guardia `isProcessingFrame`, gobierno del ciclo de vida (`start/stop/pause`).
- **Gateway I/O** — punto único de entrada de audio (frontend → buffer/bands) y de salida de telemetría (`hot-frame`, `selene-truth`) hacia el renderer.

Todo lo demás (ritmo, smoothing, composición de intents, overlays) sale del archivo.

### 1.2 Nuevas clases — Orchestrator side

| Clase | Tipo | Responsabilidad única | Estado interno permitido |
|---|---|---|---|
| `FrameScheduler` | Servicio | Mantener el reloj de 23 ms, invocar el pipeline en orden, garantizar no-overlap. | `isProcessingFrame`, `tickHandle`, `frameCount`. |
| `AudioIngressGateway` | Servicio | Recibir buffers crudos y bandas del frontend, enrutar a `trinity.feedAudioBuffer` o a `lastAudioData`. | Buffer de fusión `lastAudioData`. |
| `MusicalContextProvider` | Servicio | Suscribirse a `brain.on('audio-levels')` y exponer `getCurrentContext()` normalizado al pipeline. | Último contexto recibido + timestamp. |
| `RhythmFusionService` | **Puro** | Fusionar Worker BPM + freewheel + tick PLL + override `onBeat`; calcular staleness por fuente y umbrales Omni. | Memoria freewheel (encapsulada). |
| `AudioMetricsSmoother` | **Puro** | EMA de bandas/métricas, peakHold, derivadas. Reemplaza `smoothedMetrics` y `peakHoldMap` del Orchestrator. | Coeficientes EMA + buffer. |
| `SyncSmoother` | **Puro** | Suavizado fino de `beatPhase`/syncopation; entrega una fase monotónica al Engine. | Estado PLL local. |
| `EngineMetricsComposer` | **Puro** | Tomar salida de `RhythmFusionService` + `AudioMetricsSmoother` + `SyncSmoother` y producir el `EngineAudioMetrics` que consume `TitanEngine.update`. | Ninguno. |
| `IntentComposer` | **Puro** | Tomar `EffectManager.getCombinedOutput()`, resolver zona→fixture con `ZoneResolver`, fusionar HTP entre efectos solapados, construir `EffectIntentMap` listo para el Arbiter. | Ninguno. |
| `ZoneResolver` | **Puro** | Resolver `zoneId → fixtureIds[]` con fallback wildcard. Extraído desde el Arbiter (ver §2). Compartido. | Ninguno. |
| `ColorSpaceUtils` | **Puro** | `hslToRgb`, `rgbToHsl`, gamma, etc. Saca `hslToRgb` del Orchestrator. | Ninguno. |
| `HephaestusOverlayApplier` | Servicio | Aplicar overlay post-HAL sobre `fixtureStates` por fixture/zona. Encapsula la regla de tier. | Pools de overlay. |
| `TruthBroadcaster` | Servicio | Construir `hot-frame` y `selene-truth` y publicarlos al renderer. | Cache de payloads + diffing. |
| `OrchestratorPipeline` | Coordinador | Orquesta el orden de invocación por frame (ver §1.4). NO calcula nada. | Referencias a colaboradores. |

**Nota:** `RhythmFusionService`, `AudioMetricsSmoother`, `SyncSmoother`, `EngineMetricsComposer`, `IntentComposer`, `ZoneResolver`, `ColorSpaceUtils` son **funciones puras o clases sin side-effects observables**. Son testeables en aislamiento (snapshot tests).

### 1.3 Interfaces clave

```ts
interface IRhythmFusionService {
  fuse(input: RhythmInputs): FusedRhythm; // BPM, beatPhase, onBeat, syncopation, staleness
}

interface IAudioMetricsSmoother {
  push(raw: RawAudioBands): SmoothedBands;
  reset(): void;
}

interface ISyncSmoother {
  smooth(rhythm: FusedRhythm, dt: number): SmoothedSync;
}

interface IEngineMetricsComposer {
  compose(ctx: MusicalContext, rhythm: FusedRhythm, sync: SmoothedSync, bands: SmoothedBands): EngineAudioMetrics;
}

interface IIntentComposer {
  compose(effectOutputs: EffectOutput[], fixtures: FixtureSnapshot[]): EffectIntentMap;
}

interface IHephaestusOverlayApplier {
  apply(fixtureStates: FixtureStateMap, clips: HephaestusClip[]): FixtureStateMap;
}

interface ITruthBroadcaster {
  publish(frame: FrameSnapshot): void;
}
```

### 1.4 Nuevo `processFrame` — orden conceptual

El `OrchestratorPipeline` ejecuta, sin ninguna matemática inline:

1. `ctx = musicalContextProvider.getCurrentContext()`
2. `rhythm = rhythmFusion.fuse(...)`
3. `sync = syncSmoother.smooth(rhythm, dt)`
4. `bands = audioSmoother.push(rawBands)`
5. `metrics = engineMetricsComposer.compose(ctx, rhythm, sync, bands)`
6. `titanIntent = engine.update(ctx, metrics)`
7. `arbiter.setTitanIntent(titanIntent)`
8. `effectMap = intentComposer.compose(effectManager.getCombinedOutput(), fixtures)`
9. `arbiter.setEffectIntents(effectMap)`
10. `target = arbiter.arbitrate()`
11. `fixtureStates = hal.renderFromTarget(target, fixtures, halMetrics)`
12. `fixtureStates = hephaestusOverlay.apply(fixtureStates, hephClips)`
13. `truthBroadcaster.publish({ ctx, metrics, target, fixtureStates })`
14. `hal.flushToDriver(fixtureStates)`

El Orchestrator pasa de **~2300 líneas con lógica heterogénea** a **~300 líneas que solo cablean colaboradores**.

---

## 2) MasterArbiter — despiece

### 2.1 Estado final del Arbiter

Tras el refactor, `MasterArbiter` queda reducido a **un único rol**:

- **Director / Compositor de Capas** — recibe intents por capa (Titan L0, Manual L2, Effects L3) y delega a colaboradores el cálculo real de qué capa gana en qué canal y cómo se mezcla.

Sale del Arbiter: routing zonal, IK, patrones de movimiento, playback híbrido, release fades, fixture registry.

### 2.2 Nuevas clases — Arbiter side

| Clase | Tipo | Responsabilidad única | Estado interno permitido |
|---|---|---|---|
| `LayerStateManager` | Servicio | Mantener el estado vivo de cada capa: qué intent tiene, su edad, su prioridad, si está activa o en release. Reemplaza `layer2_manualOverrides`, `layer3_effectIntents`, etc. | `Map<LayerId, LayerEntry>`. |
| `MergeStrategyResolver` | **Puro** | Dado N candidatos por canal y la política del canal (HTP/LTP/ADD/MAX), devolver el valor final. Recibe la matemática que hoy vive en `arbitrate()` y `arbitrateFixture()`. | Ninguno. |
| `FixtureRegistry` | Servicio | Owner único del `Map<fixtureId, Fixture>`. Reemplaza el `fixtures` map del Arbiter. Lo consultan IntentComposer, Arbiter, IK. | `Map<fixtureId, Fixture>`. |
| `ZoneResolver` | **Puro** | (compartido con Orchestrator). Sustituye `getFixtureIdsByZone()`. | Ninguno. |
| `SpatialTargetResolver` | Servicio | Aplica IK (`InverseKinematicsEngine`) y resuelve targets espaciales → pan/tilt. Saca `applySpatialTarget` del Arbiter. | Cache de soluciones IK. |
| `MovementPatternEngine` | Servicio | Patrones cinéticos (waves, chases, fan) y su evolución por tick. Saca patrones de movimiento del Arbiter. | Estado de patrón. |
| `PositionReleaseFader` | Servicio | Postprocesado de release fade pan/tilt. Hoy vive en `arbitrateFixture`. | `positionReleaseFades` map. |
| `PlaybackBlender` | Servicio | El ex-"modo playback híbrido". Mezcla `currentPlaybackFrame` con las capas vivas y devuelve un intent virtual hacia el Arbiter como una capa más. | `currentPlaybackFrame`. |
| `CrossfadeEngine` | Existente | Se mantiene, pero lo consume el Arbiter vía interfaz, no por instanciación interna. | (sin cambios) |
| `ArbitrationDirector` | Coordinador | El "nuevo MasterArbiter" minimalista. Recibe capas, pregunta a `LayerStateManager`, delega merge a `MergeStrategyResolver`, devuelve `ArbitratedTarget`. | Referencias a colaboradores. |

### 2.3 Interfaces clave

```ts
interface ILayerStateManager {
  setLayer(id: LayerId, intent: LayerIntent): void;
  getActiveLayers(channelKey: ChannelKey): LayerEntry[];
  tick(dt: number): void; // edad, release, expiración
}

interface IMergeStrategyResolver {
  resolve(channel: ChannelKey, candidates: LayerCandidate[]): ChannelValue;
}

interface IFixtureRegistry {
  get(id: FixtureId): Fixture | undefined;
  all(): Fixture[];
  upsert(fixture: Fixture): void;
}

interface IZoneResolver {
  resolve(zoneId: ZoneId): FixtureId[];
}

interface ISpatialTargetResolver {
  resolve(target: SpatialTarget, fixture: Fixture): PanTilt;
}

interface IPlaybackBlender {
  blendIntoLayers(layerMgr: ILayerStateManager): void;
}
```

### 2.4 Nuevo `arbitrate()` — orden conceptual

El `ArbitrationDirector` ejecuta:

1. `layerMgr.tick(dt)`
2. `playbackBlender.blendIntoLayers(layerMgr)` // el playback se trata como otra capa
3. Para cada `fixture` de `fixtureRegistry.all()`:
   1. Para cada `channelKey` del fixture:
      1. `candidates = layerMgr.getActiveLayers(channelKey)`
      2. `value = mergeResolver.resolve(channelKey, candidates)`
   2. `panTilt = spatialResolver.resolve(target, fixture)` (si aplica)
   3. `panTilt = positionReleaseFader.apply(fixture, panTilt)`
4. Devuelve `ArbitratedTarget`.

El Arbiter pasa de **~3500 líneas mezcladas** a **~400 líneas de cableado**.

---

## 3) Estructura de carpetas V2

Árbol propuesto bajo `electron-app/src/core/`:

```
core/
├── orchestrator/
│   ├── TitanOrchestrator.ts            # Slim: scheduler + gateway only
│   ├── OrchestratorPipeline.ts         # Coordinador del frame
│   ├── scheduler/
│   │   └── FrameScheduler.ts
│   ├── ingress/
│   │   ├── AudioIngressGateway.ts
│   │   └── MusicalContextProvider.ts
│   ├── rhythm/                         # Puro
│   │   ├── RhythmFusionService.ts
│   │   ├── SyncSmoother.ts
│   │   └── types.ts
│   ├── metrics/                        # Puro
│   │   ├── AudioMetricsSmoother.ts
│   │   ├── EngineMetricsComposer.ts
│   │   └── types.ts
│   ├── intent/                         # Puro
│   │   ├── IntentComposer.ts
│   │   └── types.ts
│   ├── overlay/
│   │   └── HephaestusOverlayApplier.ts
│   ├── output/
│   │   └── TruthBroadcaster.ts
│   ├── ArbiterHandlers.ts              # (existente, sin tocar)
│   ├── EventRouter.ts                  # (existente, sin tocar)
│   ├── IPCHandlers.ts                  # (existente, sin tocar)
│   ├── __tests__/
│   └── index.ts
│
├── arbiter/
│   ├── MasterArbiter.ts                # Slim re-export → ArbitrationDirector
│   ├── ArbitrationDirector.ts          # Director minimalista
│   ├── layers/
│   │   ├── LayerStateManager.ts
│   │   └── types.ts
│   ├── merge/
│   │   ├── MergeStrategyResolver.ts    # Puro
│   │   ├── strategies/                 # HTP, LTP, ADD, MAX, …
│   │   │   ├── HTP.ts
│   │   │   ├── LTP.ts
│   │   │   ├── ADD.ts
│   │   │   └── index.ts
│   │   └── types.ts
│   ├── fixtures/
│   │   └── FixtureRegistry.ts
│   ├── zones/
│   │   └── ZoneResolver.ts             # compartido con orchestrator/intent
│   ├── spatial/
│   │   ├── SpatialTargetResolver.ts
│   │   └── PositionReleaseFader.ts
│   ├── movement/
│   │   └── MovementPatternEngine.ts
│   ├── playback/
│   │   └── PlaybackBlender.ts
│   ├── crossfade/
│   │   └── CrossfadeEngine.ts          # (movido desde arbiter/)
│   ├── ArbiterIPCHandlers.ts           # (existente, sin tocar)
│   ├── types.ts                        # (existente, dividir si crece)
│   ├── __tests__/
│   └── index.ts
│
└── shared/
    └── color/
        └── ColorSpaceUtils.ts          # Puro, compartido
```

**Justificación de subcarpetas:** cada subcarpeta es una *cápsula* con su `types.ts` propio y su test suite. Los puros (`rhythm/`, `metrics/`, `intent/`, `merge/`, `zones/`) viven separados de los con-estado (`scheduler/`, `ingress/`, `layers/`, `fixtures/`, `playback/`) para que el equipo identifique de un vistazo qué módulos son seguros de tocar sin riesgo de race conditions.

---

## 4) Inyección de dependencias

### 4.1 Construcción del Orchestrator (composition root)

```ts
// electron-app/src/core/orchestrator/index.ts
const fixtureRegistry = new FixtureRegistry();
const zoneResolver    = new ZoneResolver(fixtureRegistry);

const layerMgr        = new LayerStateManager();
const mergeResolver   = new MergeStrategyResolver();
const spatialResolver = new SpatialTargetResolver(ikEngine);
const releaseFader    = new PositionReleaseFader();
const playbackBlender = new PlaybackBlender();

const arbiter = new ArbitrationDirector({
  fixtures: fixtureRegistry,
  layers: layerMgr,
  merge: mergeResolver,
  spatial: spatialResolver,
  releaseFader,
  playback: playbackBlender,
});

const rhythmFusion       = new RhythmFusionService();
const audioSmoother      = new AudioMetricsSmoother();
const syncSmoother       = new SyncSmoother();
const engineMetrics      = new EngineMetricsComposer();
const intentComposer     = new IntentComposer(zoneResolver);
const hephOverlay        = new HephaestusOverlayApplier(getHephaestusRuntime());
const truthBroadcaster   = new TruthBroadcaster(ipcBus);
const audioIngress       = new AudioIngressGateway(getTrinity());
const musicalCtxProvider = new MusicalContextProvider(brain);

const pipeline = new OrchestratorPipeline({
  rhythmFusion, audioSmoother, syncSmoother, engineMetrics,
  intentComposer, hephOverlay, truthBroadcaster,
  musicalCtxProvider, arbiter, engine, hal,
});

const scheduler = new FrameScheduler(23 /* ms */, () => pipeline.tickFrame());

export const titanOrchestrator = new TitanOrchestrator({
  scheduler, audioIngress, pipeline, /* lifecycle hooks */
});
```

### 4.2 Reglas de DI

- **Prohibido** importar singletons (`masterArbiter`, `getEffectManager`, `vibeMovementManager`, `MoodController`, `universalDMX`) desde dentro de cualquiera de las nuevas clases. Sólo se permiten en el composition root (`index.ts`).
- Toda nueva clase recibe sus colaboradores **vía constructor**, tipados por interfaz (no por clase concreta).
- Las clases **puras** no reciben ningún colaborador con estado; sólo datos por método.

---

## 5) Plan de migración (preview, no parte del entregable de código)

Sólo orientativo para WAVE 3505:

1. Crear el árbol de carpetas vacío y los `types.ts` de cada cápsula.
2. Extraer puros primero (`ColorSpaceUtils`, `MergeStrategyResolver`, `ZoneResolver`, `RhythmFusionService`, `AudioMetricsSmoother`, `SyncSmoother`, `EngineMetricsComposer`, `IntentComposer`) con tests de paridad numérica contra el monolito actual.
3. Extraer servicios con estado (`LayerStateManager`, `FixtureRegistry`, `PlaybackBlender`, `SpatialTargetResolver`, `PositionReleaseFader`, `HephaestusOverlayApplier`, `TruthBroadcaster`).
4. Crear `ArbitrationDirector` y reducir `MasterArbiter.ts` a un re-export.
5. Crear `OrchestratorPipeline` + `FrameScheduler` y reducir `TitanOrchestrator.ts` a su forma slim.
6. Eliminar imports de singletons internos.
7. Tests de regresión por frame: snapshot de `ArbitratedTarget` y `FixtureStateMap` contra capturas pre-refactor.

---

## 6) Métricas de éxito del blueprint

- `TitanOrchestrator.ts` ≤ 400 LOC (hoy ~2300+).
- `MasterArbiter.ts` ≤ 50 LOC (re-export). `ArbitrationDirector.ts` ≤ 500 LOC (hoy ~3500+).
- 0 imports de singletons fuera de los `index.ts` composition roots.
- 100% de los módulos en `rhythm/`, `metrics/`, `intent/`, `merge/`, `zones/`, `shared/color/` son funciones puras testeables sin mocks.
- Paridad bit-a-bit del `ArbitratedTarget` y `FixtureStateMap` durante 60 s de captura sintética antes/después.

---

## 7) Lo que este blueprint NO hace (fuera de alcance)

- No introduce el `AgnosticEngine` ni Sub-Emisores (eso es WAVE 3505+).
- No toca `TitanEngine`, `Senses`, `TrinityBrain`, `HardwareAbstraction`.
- No cambia el protocolo IPC ni la forma del `selene-truth` payload.
- No optimiza CPU/memoria; sólo redistribuye responsabilidades. La optimización es un side-effect esperable, no un objetivo declarado.

---

Fin del documento. Listo para revisión de Dirección de Arquitectura antes de pasar a código.
