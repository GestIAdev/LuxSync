# WAVE 4958 — ORCHESTRATOR TOPOLOGY & DESGUACE BLUEPRINT
**Target:** DEEPSEEK V4 PRO / KIMI (Read-Only Core Architect)
**File:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts` (3542 lines)
**Status:** READ-ONLY ANALYSIS — ZERO CODE GENERATION

---

## 1. GRAFO DE DEPENDENCIAS

### 1.1 Acoplamiento Externo (critico → menor)

| Modulo | Tipo | Riesgo | Lineas |
|---|---|---|---|
| `NodeArbiter` | Fuerte (bi-dir: getAetherArbiter expone al IPC) | ALTO | 403,548,620,636,2119,2162 |
| `NodeResolver` | Fuerte (zero-copy DMX buffers) | ALTO | 405,641,2191,2240 |
| `NodeGraph` | Fuerte (device/node registry) | ALTO | 396,506,573,613,3034 |
| `IntentBus` | Fuerte (3 buses: L0/L1/L3) | ALTO | 397-402,2050-2056 |
| `TitanEngine` | Fuerte (update + palette + vibe) | ALTO | 251,1129,1600,2040 |
| `HardwareAbstraction` | Fuerte (DMX send + mover reg) | ALTO | 252,1146,2296 |
| `TrinityOrchestrator` | Fuerte (audio matrix, SAB clock) | ALTO | 253,932,975,1308 |
| `TrinityBrain` | Medio (getCurrentContext) | MEDIO | 250,927,1324 |
| `HephaestusRuntime` | Medio (tick + play) | MEDIO | 48,782,1744 |
| `EffectManager` | Medio (getCombinedOutput) | MEDIO | 36,1608,2116 |
| `BeatDetector` | Medio (PLL/freewheel) | MEDIO | 263,1436,1477 |
| `SyncSmoother` | Debil (EMA state interno) | BAJO | 383,985,1394 |
| `AetherSafetyMiddleware` | Fuerte (output gate, F0/F1/F2) | ALTO | 472,2182-2325 |
| `FrameScheduler` | Debil (delega stampede guard) | BAJO | 284,1172,1247 |
| `EventRouter` | Debil (singleton getEventRouter) | BAJO | 254,764 |
| `IntentComposer` | Debil (legacy, no Aether path) | BAJO | 384 |
| `LiquidAetherAdapter` | Medio (L0 bridge) | MEDIO | 421,653,2069 |
| `SeleneAetherAdapter` | Medio (L3 cognitive bridge) | MEDIO | 426,662,2121 |
| `ChronosAetherAdapter` | Medio (timeline bridge) | MEDIO | 427,2129 |
| `HephaestusAetherAdapter` | Medio (L3+ diamond) | MEDIO | 429,2139 |
| `PixelMapAetherAdapter` | Medio (canvas ingest) | MEDIO | 432,2159 |
| `ZoneNodeRouter` | Fuerte (cache zone→nodeIds) | ALTO | 425,660,3118 |
| `PhysicsPostProcessor` | Medio (inertia) | MEDIO | 406,2166 |
| `AetherUIProjector` | Medio (FixtureState[] legacy) | MEDIO | 411,2227 |
| `NodeExtractionPipeline` | Medio (fixture→device) | MEDIO | 409,3028 |
| `ForgeGraphCompiler` | Debil (patch-time compile) | BAJO | 77,530 |
| `TheiaVideoRenderer` | Medio (SAB bridge) | MEDIO | 435,851,2156 |
| `SeleneTheiaBridge` | Debil (observer pasivo) | BAJO | 437,907,1590 |
| `MoodController` | Debil (singleton) | BAJO | 42,2641 |
| `BeatDetector` | Medio (PLL) | MEDIO | 39,263 |
| `OSCNexusProvider` | Debil (sidecar) | BAJO | 62,257,2542 |
| `VirtualWireProvider` | Debil (sidecar) | BAJO | 64,259,1115 |
| `USBDirectLinkProvider` | Debil (sidecar) | BAJO | 65,260,1119 |
| `universalDMX` | Fuerte (zombie killer flush) | ALTO | 121,1239 |
| `aetherKineticEngine` | Medio (L2 manual patterns) | MEDIO | 123,2148 |
| `vibeMovementManager` | Debil (resetTime on stop) | BAJO | 126,1279 |
| `ZoneMapper` | Debil (fixtureMatchesZone) | BAJO | 129,1805,3488 |
| `timelineEngine` | Debil (singleton import) | BAJO | 118,1611,2129 |

### 1.2 Fuentes de Audio (3 vias concurrentes)
```
Frontend WebAudio IPC → processAudioFrame() → lastAudioData.bass/mid/high/energy (60fps)
Worker FFT           → brain.on('audio-levels') → extended FFT + BPM + transients (10fps)
Omni (VW/USB/OSC)    → brain.on('audio-levels') → omniPath=true → ALL bands (10fps)
```
Condicion de carrera: `processAudioFrame` y `brain.on('audio-levels')` mutan
`lastAudioData` concurrentemente (frontend path vs worker path).

---

## 2. IDENTIFICACION DE DOMINIOS (Las Fronteras)

### DOMINIO A: State & Lifecycle (Lineas ~250-320, ~720-760, 820-900, 1160-1290, 2560-2760)
**Responsabilidad:** Inicializacion, play/pause/stop, cambios de vibe/modo, guillotina a manual puro.

**Propiedades:**
- `isInitialized`, `isRunning`, `mode`, `useBrain`, `consciousnessEnabled`
- `config`, `frameCount`, `_licenseTier`
- `_outputEnabled`, `_goldenNukeLocks`
- `cardiogramaInterval` (comentado pero vivo)

**Metodos:**
- `init()` (921) — Brain + Trinity + Engine + HAL + providers
- `start()` (1160) — scheduler.start() + cardiograma setup + DMX warnings
- `stop()` (1232) — blackout → universalDMX.blackout() → scheduler.stop() → provider cleanup → VMM.resetTime() → beatDetector.reset()
- `setVibe()` (2568) — engine.setVibe → propagate Trinity + HAL + reset pacemaker + clean slate L2
- `setMode()` (2676), `setUseBrain()` (2690), `setConsciousnessEnabled()` (2705)
- `setLicenseTier()` (823), `setOutputEnabled()` (3432), `toggleOutputEnabled()` (3447)
- `getState()` (3499)

**Acoplamientos internos cruzados:** `stop()` toca VMM, beatDetector, scheduler, providers, HAL. `setVibe()` toca engine, trinity, HAL, pacemaker, y menciona limpieza de L2 (comentado post-WAVE 4703).

### DOMINIO B: Data Hydration (Lineas ~315, ~960-1020, ~2960-3120, ~3240-3430)
**Responsabilidad:** Carga de fixtures, mapeo de zonas, resolucion de perfiles, inyeccion en NodeGraph/Aether.

**Propiedades:**
- `fixtures: any[]` (315)
- `_aetherPipeline: NodeExtractionPipeline | null` (409)
- `_aetherHasDevices` (407)

**Metodos:**
- `setFixtures()` (2965) — normaliza address → HAL.invalidateProfileCache → auto-detect layout → register movers → `_syncFixturesToAether()`
- `_syncFixturesToAether()` (3026) — unregister all → pipeline.extract → registerAetherDevice → rebuild ZoneNodeRouter + SeleneAetherAdapter
- `_resolveFixtureDefinitionForAether()` (3125) — cascade de resolucion de perfil
- `_normalizeFixtureDefinitionForAether()` (3158) — 0→1-based migration, dedup indices, V2 bypass
- `_buildFixtureV2ForAether()` (3240) — construye FixtureV2 para pipeline
- `_resolveFixtureProfileId()` (3276), `_normalizeFixtureChannelIndex()` (3281), `_normalizeFixtureChannelType()` (3296), `_inferFixtureChannelTypeFromName()` (3334), `_resolveAetherChannelDefaultValue()` (3349), `_normalizeFixtureType()` (3361), `_normalizeAetherZone()` (3385)
- `_updateAetherStageBounds()` (3390) — calcula centerY desde fixtures, propaga a PhysicsPostProcessor
- `registerAetherDevice()` (497) — NodeGraph.registerDevice → rebuild chronos index → resolver.registerUniverse/registerDevice → register kinetic nodes → safety middleware → Forge compile → `_refreshAetherMoverShieldMap()`
- `unregisterAetherDevice()` (613)
- `_ensureAetherMatrixInitialized()` (620) — lazy-init de arbiter + resolver + 6 adapters
- `_refreshAetherMoverShieldMap()` (670) — detecta movers, protege COLOR con wheel fisica
- `getFixtureIds()` (3463), `getFixturesForZoneMapping()` (3472), `getFixtureIdsByZone()` (3486), `getFixturesCount()` (3455)

**Nota:** Este dominio es el MAS FRAGIL para extraer. El pipeline de fixture hydration tiene 15+ metodos privados con logica de migracion de formatos (WAVE 4735.7, WAVE 4610-B, WAVE 4674). Cualquier movimiento rompe el patch bridge.

### DOMINIO C: Execution Loop / Tick (Lineas ~280, 1290-2560)
**Responsabilidad:** El hot-path de 44Hz. Brain → Engine → Effects → Aether Pipeline → HAL → Broadcast.

**Propiedades:**
- `scheduler: FrameScheduler` (284) — posee el interval
- `frameCount` (277)
- `lastAudioData` (337) — MUTADA por 3 fuentes concurrentes
- `lastAudioTimestamp` (710)
- `hasRealAudio` (370)
- `EMPTY_FFT_BUFFER` (300)
- `peakHoldMap: Map<string, number>` (747)
- `_hephByFixtureId`, `_hephByZone`, `_hephOutputPool` (305-309)
- `_effectIntentBuf: EffectIntentMap` (311)
- `_forgeFrameCtx`, `_forgeAudioBands` (475-485)
- `_aetherCtx`, `_aetherAudio`, `_aetherMusical`, `_aetherVibe`, `_aetherStageBounds` (440-469)
- `_lastLoggedEngine` (278)
- `warlogHeartbeatFrame` (718)

**Metodos:**
- `processFrame()` (1295) — el monolito de ~1250 lineas. Contiene TODO el hot-path.
  - SAB clock advance (1308)
  - Staleness detection (1330-1364)
  - Audio metrics construction (1366-1380)
  - SyncSmoother (1385-1397)
  - BeatDetector / PLL / Freewheel (1406-1530)
  - BPM priority chain (1484-1515)
  - Engine update (1600)
  - EffectManager output (1607)
  - Chronos protection (1611-1614)
  - Warlog heartbeat (1636-1653)
  - FixtureStates inicializacion (1663-1682)
  - Hephaestus merge legacy (1744-1859)
  - HotFrame broadcast (1916-1963) — CONDICIONAL: solo si !_aetherHasDevices
  - AETHER PIPELINE completo (1988-2326):
    - FrameContext mutate in-place (2010-2047)
    - Bus clear (2050-2056)
    - L0: LiquidAetherAdapter (2058-2071)
    - Systems: Impact/Color/Kinetic/Beam/Atmosphere (2075-2107)
    - L3: SeleneAetherAdapter (2110-2126)
    - Chronos Aether (2129-2133)
    - Hephaestus Aether (2135-2143)
    - L2: KineticEngine (2145-2150)
    - TheiaVideoRenderer tick (2156-2158)
    - PixelMap ingest (2159)
    - Arbitrate (2162-2164)
    - Physics Post-Processor (2166-2173)
    - Safety FASE 0 (2182-2188)
    - Resolver FASE 1 (2191-2216)
    - UI Projector (2219-2227)
    - HotFrame emit (2228) — CONDICIONAL: solo si _aetherHasDevices
    - Egress FASE 2 (2237-2309)
    - Flush (2314)
    - Safety telemetry (2317-2325)
  - Full Truth broadcast (2333-2560) — SeleneTruth assembly
  - OSC publish (2542-2560)

**Este dominio debe dividirse en sub-dominios:**
1. **TickScheduler** — FrameScheduler + processFrame entry point
2. **AudioPipeline** — staleness, beat detection, sync smoother, audio metrics
3. **LegacyRenderEngine** — Engine.update, fixtureStates init, Hephaestus merge, HAL renderFromTarget
4. **AetherRenderEngine** — todo el bloque L0→L1→L2→L3→arbitrate→resolve→egress
5. **BroadcastEngine** — hotFrame + fullTruth + OSC

### DOMINIO D: Effect Routing / L3 Injection (Lineas ~35-50, ~770-820, ~1740-1860, ~2110-2145)
**Responsabilidad:** Puente de inyeccion de efectos L3: Hephaestus, Selene, Chronos, LiveFX.

**Propiedades:**
- `_hephByFixtureId`, `_hephByZone`, `_hephOutputPool` (305-309)
- `_effectIntentBuf` (311)
- `lastConsciousnessOutput` (376)

**Metodos:**
- Constructor wiring: `bridge.setPlayHook()` (775-787), `bridge.setRenderHook()` (811-814)
- `forceStrikeNextFrame()` (2767) — delega a engine
- Hephaestus merge block (1744-1859) — tick runtime → sort outputs → apply in-place a fixtureStates
- SeleneAetherAdapter.ingest() (2121)
- ChronosAetherAdapter.ingest() (2129)
- HephaestusAetherAdapter.ingest() / .clear() (2139-2143)
- `setGoldenNukeLock()` / `clearGoldenNukeLock()` (592-605)
- `getTungstenNodeIds()` (563)

### DOMINIO E: Theia / Video Bridge (Lineas ~830-920)
**Responsabilidad:** Twin-output bridge THETA → AetherCanvas.

**Propiedades:**
- `_theiaVideoRenderer` (435)
- `_seleneThetaBridge` (437)

**Metodos:**
- `attachTheiaRenderer()` (841) — crea renderer + bind samplers
- `detachTheiaRenderer()` (888) — stop + unbind + release
- `attachSeleneTheiaBridge()` (906) — observer pasivo
- `detachSeleneTheiaBridge()` (912)

### DOMINIO F: Audio Input Handlers (Lineas ~840-960, ~2840-2960)
**Responsabilidad:** Recepcion de audio desde 3 fuentes.

**Metodos:**
- `processAudioFrame()` (2843) — Frontend IPC path (60fps)
- `processAudioBuffer()` (2901) — Raw Float32Array → Trinity Worker
- Brain `on('audio-levels')` handler (955-1091) — Worker path + Omni path

### DOMINIO G: Logging & Callbacks (Lineas ~720-760, ~2790-2840)
**Responsabilidad:** Tactical Log, broadcast callbacks, hot-frame.

**Propiedades:**
- `onBroadcast`, `onHotFrame`, `onLog` (722,728,813)
- `hasLoggedFirstAudio`, `lastLoggedVibe`, `lastLoggedMood`, `lastLoggedBrainState` (714-717)

**Metodos:**
- `setBroadcastCallback()` (2795), `setHotFrameCallback()` (2805), `setLogCallback()` (2815)
- `log()` (2825)

### DOMINIO H: Configuration & Physics (Lineas ~2560-2760)
**Responsabilidad:** Mood, palette, liquid stereo/layout, chronos heatmap.

**Metodos:**
- `setMood()` (2638), `getMood()` (2651)
- `setLiquidStereo()` (2720), `setLiquidLayout()` (2731), `getLiquidLayout()` (2740)
- `forcePaletteSync()` (2623)
- `setChronosHeatmap()` (2659), `setChronosPlayhead()` (2669)
- `setInputGain()` (2785)

---

## 3. BLUEPRINT DEL DIRECTORIO (src/core/orchestrator/)

```
src/core/orchestrator/
├── index.ts                          # Re-export public API (backward compat)
├── TitanOrchestrator.ts              # FACADE/COORDINADOR (~400 lines)
│   # Solo: constructor wiring, init/start/stop, domain delegation,
│   #         getter expuestos al IPC (getAetherArbiter, getState, etc.)
│   #         callback setters (broadcast, hotFrame, log)
│
├── lifecycle/
│   ├── VibeLifecycleManager.ts       # setVibe, setMode, setConsciousnessEnabled,
│   │   # setLiquidStereo, setLiquidLayout, setMood, forcePaletteSync,
│   │   # amnesia protocol, pacemaker reset, clean slate L2
│   └── StateManager.ts               # isInitialized, isRunning, _outputEnabled,
│       # _licenseTier, mode, useBrain, consciousnessEnabled, getState
│
├── hydration/
│   ├── FixtureHydrationEngine.ts     # setFixtures, _syncFixturesToAether,
│   │   # registerAetherDevice, unregisterAetherDevice,
│   │   # _ensureAetherMatrixInitialized, _refreshAetherMoverShieldMap
│   ├── FixtureProfileResolver.ts     # _resolveFixtureDefinitionForAether,
│   │   # _normalizeFixtureDefinitionForAether, _buildFixtureV2ForAether,
│   │   # _resolveFixtureProfileId, _normalizeFixtureChannel*, _infer*,
│   │   # _resolveAetherChannelDefaultValue, _normalizeFixtureType, _normalizeAetherZone
│   └── StageBoundsManager.ts         # _updateAetherStageBounds
│
├── tick/
│   ├── TickScheduler.ts              # FrameScheduler ownership, processFrame entry,
│   │   # frameCount, start/stop delegation, SAB clock advance
│   ├── AudioPipeline.ts              # processAudioFrame, processAudioBuffer,
│   │   # brain.on('audio-levels') handler, staleness detection,
│   │   # SyncSmoother delegation, beatDetector/PLL, BPM priority chain,
│   │   # audio metrics assembly (engineAudioMetrics, halAudioMetrics)
│   ├── LegacyRenderEngine.ts         # Engine.update, fixtureStates init,
│   │   # Hephaestus merge legacy block, HAL renderFromTarget (if any legacy),
│   │   # EffectManager.getCombinedOutput, Chronos protection
│   ├── AetherRenderEngine.ts         # Aether pipeline COMPLETO:
│   │   # FrameContext mutate, bus clear, L0-L1-L2-L3 ingestion,
│   │   # arbitrate, physics post-processor, safety FASE 0,
│   │   # resolver FASE 1 (resolve), UI projector, egress FASE 2,
│   │   # flush, ForgeFrameContext populate, Golden Nuke injection
│   └── BroadcastEngine.ts            # emitHotFrame, full Truth assembly,
│       # peakHold logic, OSC publish, warlog heartbeat
│
├── effects/
│   ├── EffectRouter.ts               # forceStrikeNextFrame, Hephaestus merge,
│   │   # _hephByFixtureId/_hephByZone/_hephOutputPool management,
│   │   # applyOutputs in-place mutation
│   └── L3InjectionCoordinator.ts     # SeleneAetherAdapter, ChronosAetherAdapter,
│       # HephaestusAetherAdapter, KineticEngine tick coordination,
│       # MoverShield VIP pass, lastConsciousnessOutput
│
├── theia/
│   └── TheiaBridgeManager.ts         # attach/detach TheiaVideoRenderer,
│       # attach/detach SeleneTheiaBridge, canvas binding/unbinding
│
├── logging/
│   └── TacticalLogManager.ts         # log(), setLogCallback, setBroadcastCallback,
│       # setHotFrameCallback, warlog state, hasLoggedFirstAudio
│
└── types.ts                          # TitanConfig, ForceStrikeConfig, StageBoundsInput,
    # VibeId, y todos los interfaces exportados
```

---

## 4. PUNTOS CRITICOS DE FRICCION (Riesgos de Refactorizacion)

### RIESGO CRITICO 1: `_aetherCtx` y Buffers Pre-Alloc (Zero-Alloc Hot-Path)
**Ubicacion:** Lineas 440-485, 2010-2216
**Descripcion:** `_aetherAudio`, `_aetherMusical`, `_aetherVibe`, `_aetherStageBounds`, `_aetherCtx`, `_forgeFrameCtx`, `_forgeAudioBands` son objetos/arrays pre-allocados mutados in-place cada frame. Separar el AetherRenderEngine requiere pasar estas referencias mutables por constructor o inyectarlas.
**Mitigacion:** Convertir a un `FrameContextPool` singleton inyectado en el constructor del AetherRenderEngine. NUNCA reconstruir estos objetos.

### RIESGO CRITICO 2: `lastAudioData` — Triple Escritura Concurrente
**Ubicacion:** Lineas 337-369, 955-1091, 2843-2891
**Descripcion:** `lastAudioData` es mutado por:
1. `processAudioFrame()` (frontend IPC, 60fps)
2. `brain.on('audio-levels')` (worker, 10fps) — OMNI path SOBREESCRIBE bass/mid/high/energy
3. `brain.on('audio-levels')` (worker, 10fps) — non-OMNI path SOLO actualiza extended metrics

Si separamos AudioPipeline, el `lastAudioData` debe convertirse en un `AudioState` mutable compartido con lock-free semantics (es single-threaded JS, pero async frame vs IPC callback puede intercalar).
**Mitigacion:** Usar un `AudioStateSnapshot` inmutable creado al inicio de cada `processFrame()`, no mutar `lastAudioData` desde handlers.

### RIESGO CRITICO 3: `fixtureStates` — Double Ownership
**Ubicacion:** Lineas 1663-1682, 1744-1859, 2227, 2338-2512
**Descripcion:** `fixtureStates` se inicializa en el LEGACY block (linea 1663), luego:
- Hephaestus lo muta in-place (1744-1859)
- UI projector lo muta (linea 2227, `_aetherUIProjector.project`)
- Full Truth lo lee (2338-2512)
- Hot Frame lo lee (1916-1963)

Si separamos LegacyRenderEngine y AetherRenderEngine, ambos necesitan leer/escribir `fixtureStates`.
**Mitigacion:** `fixtureStates` debe ser un `FrameOutput` mutable centralizado. LegacyRenderEngine escribe la base; AetherRenderEngine opcionalmente la sobreescribe si `_aetherHasDevices=true`.

### RIESGO CRITICO 4: Hephaestus Dual-Path (Legacy + Aether)
**Ubicacion:** Lineas 1744-1859 (legacy) y 2135-2143 (aether)
**Descripcion:** `hephOutputs` se computa UNA vez (linea 1745) pero se consume en DOS lugares:
1. Legacy block: muta `fixtureStates` in-place para fixtures NO en NodeGraph
2. Aether block: pasa a `_hephaestusAetherAdapter.ingest()` para fixtures EN NodeGraph

Si separamos los render engines, `hephOutputs` debe pasarse del Legacy al Aether como parametro.
**Mitigacion:** `HephaestusRuntime.tick()` debe llamarse UNA vez por frame en el coordinador, y el resultado `HephFixtureOutput[]` se distribuye a ambos engines.

### RIESGO CRITICO 5: ZoneNodeRouter Cache Invalidation
**Ubicacion:** Lineas 3114-3119
**Descripcion:** `_zoneNodeRouter` se reconstruye en `_syncFixturesToAether()` (patch-time). Pero `_seleneAetherAdapter` lo usa en el hot-path (linea 2121). Si separamos FixtureHydrationEngine y AetherRenderEngine, el adapter necesita referencia al router actualizado.
**Mitigacion:** ZoneNodeRouter debe ser observable o recargable. El AetherRenderEngine obtiene el router via getter, no cachea la referencia.

### RIESGO CRITICO 6: `getAetherArbiter()` Expuesto al IPC
**Ubicacion:** Lineas 548-554
**Descripcion:** `AetherIPCHandlers.ts` (visto en TS errors) llama `getTitanOrchestrator().getAetherArbiter()` para inyectar overrides L2. Si el arbiter vive en un modulo separado (AetherRenderEngine), el IPC handler necesita acceso directo.
**Mitigacion:** El facade TitanOrchestrator DELEGUE `getAetherArbiter()` al AetherRenderEngine. Nunca romper esta API de IPC.

### RIESGO ALTO 1: FrameScheduler Stampede Guard
**Ubicacion:** Linea 284
**Descripcion:** El `FrameScheduler` posee el interval y el stampede guard. `processFrame()` es async. Si separamos TickScheduler, la guard sigue funcionando, pero la delegacion async debe ser fire-and-forget (como ahora).
**Mitigacion:** Mantener el stampede guard DENTRO del scheduler, nunca moverlo al engine.

### RIESGO ALTO 2: `emitHotFrame()` Conditional DUAL
**Ubicacion:** Lineas 1969-1971 (legacy path) y 2228 (aether path)
**Descripcion:** HotFrame se emite en DOS lugares con condiciones mutuamente excluyentes (`!_aetherHasDevices` vs `_aetherHasDevices`). Si separamos engines, el coordinador debe decidir QUIEN emite.
**Mitigacion:** El coordinador (facade) orquesta la emision unica post-render.

### RIESGO ALTO 3: Golden Nuke / DMX Bypass
**Ubicacion:** Lineas 2253-2269
**Descripcion:** `_goldenNukeLocks` muta el `egressBuf` in-place justo antes de `sendUniverseRaw()`. Es un bypass de seguridad. Si se mueve al AetherRenderEngine, el coordinador pierde control del bypass.
**Mitigacion:** El AetherRenderEngine expone un `setBypassInjection(deviceId, buffer)` hook, o el coordinador inyecta un `EgressInterceptor`.

### RIESGO ALTO 4: Safety Telemetry Frame Skew
**Ubicacion:** Lineas 2317-2325
**Descripcion:** `aetherSafety.consumeTelemetry()` DEBE llamarse despues de resolver TODOS los universos. Si el AetherRenderEngine paraleliza (futuro), la telemetria se fragmenta.
**Mitigacion:** Mantener telemetry consumption en secuencia post-egress.

### RIESGO MEDIO 1: `_lastLoggedEngine` Throttle
**Ubicacion:** Lineas 2063-2066
**Descripcion:** Throttle de log por cambio de engine name. Estado mutable. Si se mueve a AetherRenderEngine, es su estado interno.
**Mitigacion:** Trivial, estado interno del engine.

### RIESGO MEDIO 2: `peakHoldMap` en Broadcast
**Ubicacion:** Lineas 1906-1913, 2469-2476
**Descripcion:** `peakHoldMap` acumula picos entre broadcasts y se resetea. Pertenece al BroadcastEngine, pero se lee del `fixtureStates` del legacy.
**Mitigacion:** Mover `peakHoldMap` al BroadcastEngine como estado interno.

---

## 5. SECUENCIA DE DESGUACE RECOMENDADA (por el agente Opus)

### Fase 1: Extraer Logging & Callbacks (bajo riesgo)
- Mover `TacticalLogManager` y callbacks a `logging/`
- TitanOrchestrator delega `log()`, `set*Callback()`

### Fase 2: Extraer Theia Bridge (bajo riesgo)
- Mover `TheiaBridgeManager` a `theia/`
- TitanOrchestrator delega attach/detach

### Fase 3: Extraer State & Lifecycle (bajo-medio riesgo)
- Mover `StateManager` + `VibeLifecycleManager` a `lifecycle/`
- TitanOrchestrator conserva getters expuestos al IPC

### Fase 4: Extraer Audio Pipeline (MEDIO riesgo)
- Mover `AudioPipeline` a `tick/AudioPipeline.ts`
- **CUIDADO:** `lastAudioData` triple escritura → usar snapshot inmutable

### Fase 5: Extraer Fixture Hydration (MEDIO-ALTO riesgo)
- Mover `FixtureHydrationEngine` + `FixtureProfileResolver` + `StageBoundsManager` a `hydration/`
- **CUIDADO:** 15+ metodos privados de migracion de formatos. No tocar logica, solo mover.

### Fase 6: Extraer Legacy Render Engine (ALTO riesgo)
- Mover `LegacyRenderEngine` a `tick/LegacyRenderEngine.ts`
- **CUIDADO:** `fixtureStates` double ownership. Definir contrato claro.

### Fase 7: Extraer Aether Render Engine (ALTO riesgo)
- Mover `AetherRenderEngine` a `tick/AetherRenderEngine.ts`
- **CUIDADO:** zero-alloc buffers pre-alloc (_aetherCtx, _forgeFrameCtx). Inyectar por constructor.

### Fase 8: Extraer Broadcast Engine (MEDIO riesgo)
- Mover `BroadcastEngine` a `tick/BroadcastEngine.ts`
- Unificar `emitHotFrame()` dual path en el coordinador

### Fase 9: Extraer Effect Router (MEDIO riesgo)
- Mover `EffectRouter` + `L3InjectionCoordinator` a `effects/`
- Unificar `hephOutputs` single-compute dual-consume

### Fase 10: TitanOrchestrator como Facade Puro
- Reducir a ~400 lineas: constructor wiring + delegation + IPC API
- Todos los dominios importados y delegados

---

## 6. LINEAS CLAVE A NO TOCAR (Invariantes del Hot-Path)

| Invariante | Linea | Razon |
|---|---|---|
| `_aetherBus.clear()` | 2050 | Cada frame empieza limpio |
| `_seleneBus.clear()` | 2054 | Silence Rule: si no hay efectos, L0 retoma |
| `_effectBus.clear()` | 2056 | L3 no debe persistir entre frames |
| `aetherArbiter.arbitrate()` | 2164 | Orden estricto: L0→L1→L2→L3 |
| `_physicsPostProcessor.process()` | 2168 | Post-arbitraje, pre-resolve |
| `aetherResolver.resolve()` | 2217 | FASE 1 safety corre AQUI dentro |
| `_aetherUIProjector.project()` | 2227 | Post-resolve para leer posiciones IK actuales |
| `hal.sendUniverseRaw()` | 2296 | Unico punto de salida DMX |
| `hal.flushAetherEgress()` | 2314 | Sincroniza worker DMX |

---

*Documento generado por WAVE 4958. NO contiene codigo de implementacion. Para uso del agente Opus en la fase de refactorizacion.*
