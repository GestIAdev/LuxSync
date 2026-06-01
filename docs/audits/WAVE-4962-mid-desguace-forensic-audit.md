# WAVE 4962: MID-DESGUACE REALITY CHECK & FORENSIC AUDIT

> **Auditor:** Kimi / DeepSeek V4 (Forensic Auditor & Core Architect)
> **Target:** `TitanOrchestrator.ts` post-Phases 1-6
> **Date:** 2026-06-01
> **File Size:** ~3,006 LOC (reduced from ~3,555 original)
> **Status:** ZERO CODE GENERATION — Audit & Blueprint Only

---

## 1. Estado de Delegación Actual

### 1.1 Managers Inyectados vía Context Proxies (Confirmados)

| Manager | Field | Inyección | Context Type |
|---------|-------|-----------|--------------|
| `TacticalLogManager` | `logManager` | Inline field + new | N/A (self-contained) |
| `StateManager` | `stateManager` | Inline field + new | N/A (self-contained) |
| `VibeLifecycleManager` | `vibeManager` | Inline field + new | Recibe `stateManager` + `logManager` |
| `FixtureProfileResolver` | `profileResolver` | Inline field + new | N/A (pure functions) |
| `StageBoundsManager` | `stageBoundsManager` | Inline field + new | Recibe `_aetherStageBounds` + `_physicsPostProcessor` |
| `FixtureHydrationEngine` | `hydrationEngine` | Constructor | `HydrationContext` con **~20 getters/setters proxy** |
| `BroadcastManager` | `broadcastManager` | Constructor | `BroadcastManagerContext` con getters proxy |
| `HardwareDispatcher` | `hardwareDispatcher` | Constructor | `HardwareDispatcherContext` con getters proxy |

**Observación Crítica:** El constructor actual (~líneas 791-866) contiene **~75 líneas de Context Proxy boilerplate** para `hydrationEngine`, `broadcastManager` y `hardwareDispatcher`. Esto es "grasa de pegamento" generada para mantener compilación mientras se extraen dominios. Es técnicamente correcto pero visualmente ruidoso.

### 1.2 Métodos que YA son Delegadores de 1 Línea

| Method | Line | Delegates To |
|--------|------|-------------|
| `setFixtures()` | 2888 | `this.hydrationEngine.setFixtures(...)` |
| `registerAetherDevice()` | 532 | `this.hydrationEngine.registerAetherDevice(...)` |
| `unregisterAetherDevice()` | 605 | `this.hydrationEngine.unregisterAetherDevice(...)` |
| `getAetherArbiter()` | 540 | `this.hydrationEngine.ensureAetherMatrixInitialized()` |

**Nota:** `_updateAetherStageBounds`, `_syncFixturesToAether` y todos los helpers de perfil (`_resolveFixtureDefinitionForAether`, `_normalizeFixtureDefinitionForAether`, `_buildFixtureV2ForAether`, etc.) fueron purgados exitosamente en la sesión anterior (~400 LOC eliminadas).

---

## 2. Mapa de la "Grasa" Restante (The Monolith Remnants)

### 2.1 El Leviatán: `processFrame()` (~1,266 LOC, líneas 1218-2484)

Este método es el **80% del problema restante**. No es un método, es un sistema operativo embebido.

#### Sub-bloques identificados dentro de `processFrame`:

**A. Audio Staleness & Metrics Pipeline (~líneas 1225-1320, ~95 LOC)**
- `Date.now()` staleness check con Omni-source threshold dinámico
- `lastAudioData` reset en silencio
- `hasRealAudio` flip logic
- `SyncSmoother.smooth()` invocation
- **Acoplamiento:** muta `this.lastAudioData`, `this.hasRealAudio`, `this.lastAudioTimestamp`.

**B. BeatDetector / PLL / Freewheel Logic (~líneas 1322-1399, ~77 LOC)**
- `beatDetector.tick(now)`
- Worker BPM → PLL injection (WAVE 2112)
- Freewheel memory (WAVE 2179): `lastStableWorkerBpm`, `lastStableWorkerBpmFrame`
- Console telemetry cada 60 frames
- **Acoplamiento:** muta `lastStableWorkerBpm`, `lastStableWorkerBpmFrame`, lee `lastAudioData`.

**C. Engine Update & Context Construction (~líneas 1400-1523, ~123 LOC)**
- `brain.getCurrentContext()`
- `engine.update(context, engineAudioMetrics)` → produce `intent`
- `engineAudioMetrics` object construction (WAVE 1011.5, WAVE 2112)
- `halAudioMetrics` object construction
- `SeleneTheiaBridge.notify()` call
- **Acoplamiento:** lee `lastAudioData`, `syncSmoother.currentSmoothed`, `beatState`.

**D. Legacy HAL Pipeline — Pre-HAL (~líneas 1525-1606, ~81 LOC)**
- `EffectManager.getCombinedOutput()`
- `timelineEngine.getLastPlaybackFrame()` (Chronos protection)
- `fixtureStates` pre-alloc array initialization
- `HAL.renderFromTarget()` call
- **Acoplamiento:** produce `fixtureStates` mutable array consumido por todo lo posterior.

**E. Hephaestus Post-HAL Mutation (~líneas 1656-1782, ~126 LOC)**
- `HephaestusRuntime.tick(now)` → `hephOutputs`
- Pre-allocated buffer routing (`_hephByFixtureId`, `_hephByZone`, `_hephOutputPool`)
- Zone-matcher loop con `fixtureMatchesZone`
- In-place mutation de `fixtureStates[index]`
- **Acoplamiento:** muta `fixtureStates` in-place. Es el único mutador post-HAL legítimo.

**F. Hot-Frame Broadcast (~líneas 1825-1894, ~69 LOC)**
- `emitHotFrame()` closure
- `peakHoldMap` accumulation (líneas 1829-1836)
- `onHotFrame` callback invocation
- AudioMatrix telemetry piggyback
- **Acoplamiento:** lee `fixtureStates`, muta `peakHoldMap`.

**G. Full Truth Broadcast (SeleneTruth) (~líneas 2256-2453, ~197 LOC)**
- Massive inline object construction: `SeleneTruth`
- `system`, `sensory`, `spectrumBands`, `consciousness`, `context`, `intent`, `hardware`, `fixtures` mapping
- `peakHoldMap` read + reset
- `onBroadcast(truth)` invocation
- **Acoplamiento:** lee `fixtureStates`, `intent`, `context`, `engineAudioMetrics`.

**H. Aether Matrix Pipeline (~líneas 1900-2248, ~348 LOC)**
- FrameContext in-place mutation (`_aetherAudio`, `_aetherMusical`, `_aetherVibe`, `_aetherCtx`)
- IntentBus clear (`_aetherBus`, `_seleneBus`, `_effectBus`)
- L0 Adapters: `LiquidAetherAdapter`, `ColorAdapter`, `VMMAdapter`, `BeamAdapter`, `AtmosphereAdapter`
- L3 Adapters: `SeleneAetherAdapter`, `ChronosAetherAdapter`, `HephaestusAetherAdapter`
- Kinetic Engine: `aetherKineticEngine.tick()`
- PixelMap: `PixelMapAetherAdapter.ingest()`, `TheiaVideoRenderer.tick()`
- Arbiter: `setSystemIntents`, `setEffectIntents`, `arbitrate()`
- Physics Post-Processor: `process(arbitrated, ...)`
- Safety Middleware: `applyOutputGate()`, `setManualNodeIds()`
- NodeResolver: `resolve()`, `setForgeFrameContext()`
- UI Projector: `project(fixtureStates, _aetherGraph, arbitrated, blackoutActive)`
- Universe Egress Loop: `registeredUniverses` iteration, `getUniverseBuffer()`, `getSoftBlackoutUniverseBuffer()`, Golden Nuke bypass, DMX Sniffer, `sendUniverseRaw()`, `flushAetherEgress()`
- Safety telemetry logging
- **Acoplamiento:** lee/escribe objetos pre-allocados del orquestador.

**I. OSC Publishing (~líneas 2462-2483, ~21 LOC)**
- `oscProvider.publishState()` cada 3 frames

---

### 2.2 Bloques Monolíticos Restantes Fuera de processFrame

| Bloque | Líneas | LOC | Descripción |
|--------|--------|-----|-------------|
| **Constructor + Context Proxies** | 791-866 | ~75 | 3 bloques de `const self = this` + getters/setters |
| **`init()`** | 844-1078 | ~234 | Brain + Trinity + Audio Providers + BeatDetector + HAL + Hephaestus bridge wiring + **massive `brain.on('audio-levels')` handler (~138 LOC)** |
| **`start()`** | 1083-1139 | ~56 | Scheduler + Cardiograma + universalDMX wiring |
| **`stop()`** | 1155-1211 | ~56 | Blackout + Provider cleanup + VMM reset |
| **`setVibe()`** | 2491-2538 | ~47 | Propagación a Engine → Trinity → HAL → Pacemaker Reset → Profile Swap → Clean Slate |
| **`processAudioFrame()`** | 2766-2814 | ~48 | Frontend audio merge + hasRealAudio detection |
| **`processAudioBuffer()`** | 2824-2878 | ~54 | Float32Array → Trinity + Two Masters Guard + Sonda telemetry |
| **Theia Bridge (attach/detach)** | 764-839 | ~75 | TheiaVideoRenderer + PixelMapAdapter binding |
| **Lifecycle Setters** | 2539-2665 | ~126 | setMood, setLiquidStereo, setLiquidLayout, setMode, setUseBrain, setConsciousnessEnabled, etc. |
| **Golden Nuke** | 548-598 | ~50 | resolveTungstenNodeIds, applyGoldenNuke, clearGoldenNukeLock |
| **Broadcast/Log Callbacks** | 2717-2759 | ~42 | setBroadcastCallback, setHotFrameCallback, setLogCallback, log() |
| **State Getters** | 2896-2977 | ~81 | Output gate, fixture queries, getState |
| **Field Declarations** | 214-473 | ~259 | Todas las variables privadas del orquestador |

---

### 2.3 Código "Pegamento" Identificado

**Context Proxy Boilerplate (~75 LOC en constructor):**
Los bloques `const self = this` con múltiples `get`/`set` en `HydrationContext`, `BroadcastManagerContext` y `HardwareDispatcherContext` son correctos arquitectónicamente pero constituyen "grasa visual" que debería abstraerse.

**Recomendación futura:** Un helper `createMutableProxy(target, keys)` podría reducir esto a ~10 LOC.

---

## 3. Nuevo Plan de Ataque (Estrategia Extract-Then-Purge)

> **Directiva:** Primero creamos los archivos nuevos copiando la lógica intacta. Solo al final purgamos el Orquestador.
>
> **Invariante de Hot-Path:** Las variables mutadas por el audio pipeline y leídas por el tick engine DEBEN pasarse por referencia (objeto contenedor o proxy) para evitar condiciones de carrera.

### 3.1 Fase 7: AudioPipelineManager (Extracción prioritaria)

**Archivo propuesto:** `src/core/orchestrator/audio/AudioPipelineManager.ts`

**Responsabilidad:** Todo lo relacionado con ingestión de audio, staleness, beat detection y métricas FFT.

**Código a extraer:**
- `processAudioFrame()` (líneas 2766-2814)
- `processAudioBuffer()` (líneas 2824-2878)
- `brain.on('audio-levels')` handler completo (líneas 878-1015, actualmente dentro de `init()`)
- Staleness detection block (líneas 1257-1287, dentro de `processFrame`)
- BeatDetector / PLL / Freewheel block (líneas 1322-1399, dentro de `processFrame`)

**Variables de estado a encapsular:**
| Variable | Tipo | Mutable por | Leída por | Estrategia de Pasaje |
|----------|------|-------------|-----------|---------------------|
| `lastAudioData` | Object | AudioPipelineManager | TickEngine (engineAudioMetrics), Aether (FrameContext) | **Referencia directa** en context |
| `hasRealAudio` | boolean | AudioPipelineManager | TickEngine (silence path), Broadcast (truth.active) | **Referencia directa** en context |
| `lastAudioTimestamp` | number | AudioPipelineManager | TickEngine (staleness check) | **Referencia directa** en context |
| `syncSmoother` | SyncSmoother | AudioPipelineManager | TickEngine (engineAudioMetrics read) | Instancia pasada por ref |
| `beatDetector` | BeatDetector | AudioPipelineManager | TickEngine (no directo, solo AudioPipeline lo muta) | Instancia pasada por ref |
| `lastStableWorkerBpm` | number | AudioPipelineManager | TickEngine (freewheel check) | **Referencia directa** en context |
| `lastStableWorkerBpmFrame` | number | AudioPipelineManager | TickEngine | **Referencia directa** en context |

**API propuesta para TickEngine:**
```typescript
// AudioPipelineManager produce un "AudioSnapshot" cada frame
interface AudioSnapshot {
  bass: number; mid: number; high: number; energy: number;
  engineAudioMetrics: EngineAudioMetrics;
  halAudioMetrics: HALAudioMetrics;
  beatState: BeatState;
  hasRealAudio: boolean;
}
```

---

### 3.2 Fase 8: TickEngine (El Gran Divorcio)

**Archivo propuesto:** `src/core/orchestrator/tick/TickEngine.ts`

**Responsabilidad:** El cuerpo completo de `processFrame()`.

**Razón de ser:** A ~1,266 LOC, processFrame es demasiado grande para ser un método. Es un motor. Debe ser una clase con sus propios subsistemas.

**Sub-componentes internos (futura subdivisión, NO en esta fase):**

| Sub-componente | Código a encapsular | LOC estimado |
|----------------|---------------------|--------------|
| `LegacyHALPipeline` | Engine update → HAL.renderFromTarget → Hephaestus mutation | ~200 |
| `AetherPipeline` | FrameContext → Adapters → Arbiter → Physics → Safety → Resolver → Egress | ~350 |
| `BroadcastPipeline` | Hot-frame + Full Truth construction + peak hold | ~270 |

**Extract Strategy (Fase 8.0):**
1. Copiar `processFrame()` completo a `TickEngine.ts`.
2. `TickEngine` recibe en constructor:
   - `orchestratorRef` (para acceder a campos que aún no se extrajeron)
   - `audioPipeline: AudioPipelineManager`
   - `broadcastManager: BroadcastManager`
   - `hardwareDispatcher: HardwareDispatcher`
3. Reemplazar en Orquestador: `processFrame()` → `this.tickEngine.tick()`

**Ventaja:** Incluso si TickEngine sigue siendo grande internamente, el Orquestador se reduce a ~400-500 LOC.

---

### 3.3 Fase 9: SystemLifecycleManager

**Archivo propuesto:** `src/core/orchestrator/lifecycle/SystemLifecycleManager.ts`

**Responsabilidad:** `init()`, `start()`, `stop()`.

**Código a extraer:**
- `init()` completo (líneas 844-1078)
- `start()` (líneas 1083-1139)
- `stop()` (líneas 1155-1211)

**Desafío:** `init()` contiene el `brain.on('audio-levels')` handler masivo. Si Fase 7 (AudioPipelineManager) se completa primero, este handler se mueve allí y `init()` se reduce a ~80 LOC.

**Orden recomendado:** Fase 7 → Fase 9 (init reducido) → Fase 8 (TickEngine).

---

### 3.4 Fase 10: TheiaBridgeManager Expandido

**Archivo existente:** `src/core/orchestrator/theia/TheiaBridgeManager.ts` (creado en Fase 2 pero aún incompleto)

**Métodos a migrar del Orquestador:**
- `attachTheiaRenderer()` (líneas 764-805)
- `detachTheiaRenderer()` (líneas 811-821)
- `attachSeleneTheiaBridge()` (líneas 829-833)
- `detachSeleneTheiaBridge()` (líneas 835-839)

**Nota:** Estos métodos tocan `_aetherCanvasManager`, `_pixelMapAdapter`, `_aetherGraph`, `_aetherStageBounds`. Requieren context proxy similar al HydrationContext.

---

### 3.5 Fase 11: VibeLifecycleManager Expandido

**Archivo existente:** `src/core/orchestrator/lifecycle/VibeLifecycleManager.ts`

**Métodos a migrar del Orquestador:**
- `setVibe()` (líneas 2491-2538) — El más grande. Propaga a Engine, Trinity, HAL, Pacemaker, Profile, Clean Slate.
- `setMood()` / `getMood()` (líneas 2561-2576)
- `setMode()` (líneas 2601-2606)
- `setUseBrain()` (líneas 2613-2617)
- `setConsciousnessEnabled()` (líneas 2628-2638)
- `setLiquidStereo()` (líneas 2643-2649)
- `setLiquidLayout()` / `getLiquidLayout()` (líneas 2654-2665)
- `forcePaletteSync()` (líneas 2546-2551)
- `setChronosHeatmap()` (líneas 2582-2586)
- `setChronosPlayhead()` (líneas 2592-2596)

---

### 3.6 Fase 12: Orchestrator Facade Final

Una vez completadas Fases 7-11, el Orquestador debería verse así:

```
TitanOrchestrator (~300-400 LOC)
├── Fields: brain, engine, hal, trinity, config, isInitialized, isRunning
├── Managers (ya inyectados):
│   ├── logManager, stateManager, vibeManager
│   ├── profileResolver, stageBoundsManager, hydrationEngine
│   ├── broadcastManager, hardwareDispatcher
│   ├── audioPipelineManager ← Fase 7
│   ├── tickEngine ← Fase 8
│   └── lifecycleManager ← Fase 9
├── Delegators de 1 línea (~15 métodos)
└── Getters/Setters expuestos a IPC (~10 métodos)
```

---

## 4. Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| `lastAudioData` mutado concurrentemente por `processAudioFrame` (IPC) y `brain.on('audio-levels')` (Worker callback) | **ALTA** | AudioPipelineManager debe serializar acceso o usar un `AudioFrame` inmutable como buffer de handoff |
| `fixtureStates` mutado por Hephaestus post-HAL y luego leído por Broadcast | **MEDIA** | TickEngine ya garantiza orden: Hephaestus → Broadcast → Aether Egress. Mantener este orden exacto |
| `processFrame` async: `await this.engine.update(...)` puede intercalarse con `processAudioFrame` | **ALTA** | `processAudioFrame` y `processAudioBuffer` deben ser NO-BLOCKING y solo mutar `lastAudioData`. No hay race real porque JS es single-threaded, pero el orden de ejecución entre IPC callbacks y `await` puede cambiar si se extrae mal |
| Context Proxies causan perf hit en hot-path | **BAJA** | Los getters/setters son calls nativas V8 optimizables. Pero `fixtureStates.forEach(...)` dentro de Broadcast construye closures que capturan `this`. Esto ya está optimizado. No cambiar el patrón de proxy sin benchmark |

---

## 5. Métricas Objetivo Post-Desguace

| Métrica | Actual | Objetivo Fase 12 |
|---------|--------|-----------------|
| `TitanOrchestrator.ts` LOC | ~3,006 | **< 500** |
| `processFrame` LOC | ~1,266 | **0** (en TickEngine.ts) |
| Managers inyectados | 8 | **12+** |
| Métodos delegadores de 1 línea | 4 | **> 25** |
| Context Proxy boilerplate en constructor | ~75 LOC | **< 20 LOC** (helper genérico) |

---

## 6. Conclusión del Auditor

La Fase 6 (Broadcast + HAL Dispatch) se completó correctamente con 0 errores de compilación nuevos. Sin embargo, el archivo sigue en ~3,000 LOC porque el verdadero elefante nunca fue `setFixtures` ni los broadcast callbacks: **es `processFrame()` con ~1,266 líneas de lógica de negocio embebida**.

**Recomendación ejecutiva:**
1. **No extraer más métodos sueltos** del Orquestador hasta que `processFrame` esté fuera.
2. **Primera prioridad:** Fase 7 (AudioPipelineManager) porque desbloquea la reducción de `init()`.
3. **Segunda prioridad:** Fase 8 (TickEngine) — copiar processFrame intacto a nuevo archivo, reemplazar en Orquestador por `this.tickEngine.tick()`.
4. **Tercera prioridad:** Expandir VibeLifecycleManager con setVibe y amigos.
5. **Final:** Purgar todos los fields y métodos huérfanos. Target: Orquestador < 500 LOC.

**El Orquestador no es un Dios. Es un Director de Orquesta. Su trabajo es levantar la batuta, no tocar todos los instrumentos.**

---

*End of Audit. ZERO code was generated in this document.*
