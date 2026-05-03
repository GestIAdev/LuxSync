# AETHER-MATRIX-STATE.md
## Radiografía Arquitectónica — Estado en Vivo
**Fecha de auditoría:** 2026-05-02  
**Auditor:** PunkOpus (Análisis estático — read-only)  
**Base de código:** Branch `v3`, WAVE corriente ~4524.3

---

## TABLA DE CONTENIDOS

1. [El Núcleo ECS (Core Matrix)](#1-el-núcleo-ecs-core-matrix)
2. [Los Adaptadores y Motores (Tentáculos Cognitivos)](#2-los-adaptadores-y-motores-tentáculos-cognitivos)
3. [Simbiosis con el Orquestador (Frame Loop)](#3-simbiosis-con-el-orquestador-frame-loop)
4. [El Output Visual y El Mirror](#4-el-output-visual-y-el-mirror)

---

## 1. El Núcleo ECS (Core Matrix)

### 1.1 Estructura de Directorios

```
src/core/aether/
├── types.ts                   ← Tipos primitivos (NodeId, DeviceId, NodeFamily, etc.)
├── capability-node.ts         ← Interfaces de datos por familia (IColorNodeData, etc.)
├── device.ts                  ← IDeviceDefinition, IDeviceCalibration
├── intent-bus.ts              ← Interfaces públicas (IIntentBus, INodeArbiter, etc.)
├── IntentBus.ts               ← Implementación zero-alloc del IntentBus (WAVE 3505.2)
├── NodeGraph.ts               ← Implementación del grafo de nodos (WAVE 3505.2)
├── NodeArbiter.ts             ← Implementación del árbitro multicapa (WAVE 3505.4)
├── node-graph.ts              ← Interfaces públicas del NodeGraph
├── index.ts                   ← Barrel export — única puerta de entrada al módulo
│
├── systems/
│   ├── BaseSystem.ts          ← Contrato + AudioMetrics, VibeProfile, MusicalContext
│   ├── ImpactSystem.ts        ← Física de intensidad reactiva al audio (WAVE 3505.3)
│   ├── ColorSystem.ts         ← Traducción paleta Vibe a nodos COLOR (WAVE 3505.3)
│   ├── KineticSystem.ts       ← Movimiento mecánico VMM patterns (WAVE 3505.3)
│   ├── BeamSystem.ts          ← Conformación de haz por sección musical (WAVE 3509)
│   ├── AtmosphereSystem.ts    ← Dispositivos atmosféricos con safety gates (WAVE 3509)
│   └── index.ts
│
├── adapters/
│   ├── ImpactAdapter.ts       ← L0: LiquidEngine → IMPACT nodes (WAVE 3516.3)
│   ├── ColorAdapter.ts        ← L1: SeleneLux palette → COLOR nodes (WAVE 4522.3)
│   ├── KineticAdapter.ts      ← L0: VMM holographic projection → KINETIC nodes (WAVE 4523.4)
│   ├── BeamAdapter.ts         ← L0: FrameContext → BEAM nodes with MECH hold (WAVE 3516.4)
│   ├── AtmosphereAdapter.ts   ← L0: FrameContext → ATMOSPHERE nodes con 3 gates (WAVE 3516.4)
│   ├── LiquidAetherAdapter.ts ← L0: ProcessedFrame+LiquidStereoResult → IMPACT+COLOR (WAVE 4521.2)
│   ├── selene-aether-adapter.ts ← L3: CombinedEffectOutput+ConsciousnessOutput (WAVE 4524.3)
│   ├── zoneUtils.ts           ← Helpers de routing zonal
│   ├── helpers/
│   │   └── zone-node-router.ts ← ZoneNodeRouter: zona canónica → NodeId[]
│   └── index.ts
│
├── ingestion/
│   ├── NodeExtractionPipeline.ts ← Traducción FixtureDefinition legacy → IDeviceDefinition (WAVE 3507/3517.1)
│   ├── SpatialRegistrar.ts    ← Inyección de Position3D + registro en NodeGraph
│   └── index.ts
│
├── resolver/
│   ├── NodeResolver.ts        ← ArbitratedNodeMap → DMXPackets (WAVE 3505.4/4522.4)
│   ├── PhysicsPostProcessor.ts ← Inercia para nodos KINETIC, entre Arbiter y Resolver (WAVE 4518.1)
│   ├── AetherUIProjector.ts   ← [ESPEJO] Proyecta NodeGraph → FixtureState[] legacy (WAVE 3513.3.2)
│   └── index.ts
│
└── __tests__/                 ← +12 suites de tests (>100 tests)
```

### 1.2 Los 5 Sistemas ECS — Estado Implementado

Todos los sistemas heredan de `BaseSystem<T>` y son **zero-alloc** en hot-path.

| Sistema | Familia | Wave | Responsabilidad | Prioridad L0 |
|---------|---------|------|----------------|-------------|
| `ImpactSystem` | `IMPACT` | 3505.3 | Dimmer+shutter reactivo al audio. Matriz de bandas × roles × curva exponencial | 10 |
| `ColorSystem` | `COLOR` | 3505.3 | Paleta Vibe → RGB/RGBW/CMY/wheel con LERP anti-flicker | 10 |
| `KineticSystem` | `KINETIC` | 3505.3 | Pan/tilt vía patrones VMM deterministas (sin Math.random()) | 10 |
| `BeamSystem` | `BEAM` | 3509 | Zoom/focus/gobo/prism/frost según sección musical, con MECHANICAL_HOLD | 10 |
| `AtmosphereSystem` | `ATMOSPHERE` | 3509 | Fog/haze/fan/spark/pyro con 3 safety gates (cooldown, max-continuo, interlock) | 10 |

**Nota importante:** Los sistemas originales (`ImpactSystem`, `ColorSystem`, `KineticSystem`, `BeamSystem`, `AtmosphereSystem`) están implementados y testeados, pero **no son los que corren en el pipeline activo del TitanOrchestrator**. El Orchestrator usa los **Adapters** (equivalentes especializados) que operan directamente con motores externos. Ver sección 2.

#### Interacción con el IntentBus

El flujo canónico de cada sistema en el frame loop:

```
1. Orchestrator → bus.clear()
2. System → bus.push(intent) × N nodos   [zero-alloc, O(1) por push]
3. Bus    → bus.buildIndex()              [O(N), reconstruye nodeId→range]
4. Arbiter → bus.getIntentsForNode(id)   [O(1) lookup]
```

**IntentBus** pre-alloca `4096` slots (DEFAULT_CAPACITY). Cada slot es un objeto de forma estable reutilizado in-place. Los `values: Record<string, number>` tienen un `_valuePool` propio para cero allocaciones por frame.

### 1.3 NodeGraph — Registro y Almacenamiento de Nodos

El `NodeGraph` usa **Data-Oriented Design**: un `FamilyStore<T>` (dense array plano) por cada una de las 5 familias.

**Índices construidos en patch-time (no en hot-path):**
- `_slotIndex: Map<NodeId, INodeSlotLocation>` → O(1) lookup por NodeId (familia + índice)
- `_zoneIndex: Map<ZoneId, NodeId[]>` → O(1) lookup geográfico
- `_roleIndex: Map<NodeRole, NodeId[]>` → O(1) lookup por rol semántico
- `_deviceIndex: Map<DeviceId, NodeId[]>` → O(1) lookup por Device (para unregister)
- Cinco `NodeView<T>` pre-creados (una por familia) → `getView()` es O(1), sin `new`

**Ciclo de vida de un nodo:**
1. **Patch time** — `NodeExtractionPipeline.extract(fixtureDef)` descompone canales en `IDeviceDefinition`
2. `SpatialRegistrar.register()` inyecta `Position3D` desde `FixtureV2`
3. `TitanOrchestrator.registerAetherDevice(definition)` llama a `NodeGraph.registerDevice()` + `NodeResolver.registerUniverse()`
4. **Frame time (44 Hz)** — los índices son read-only; solo `node.state` (Float64Array) y campos mutable se mutan

### 1.4 NodeArbiter — Capas de Prioridad

El `NodeArbiter` implementa el siguiente stack multicapa (menor a mayor prioridad):

| Capa | Nombre | Set via | Estrategia |
|------|--------|---------|-----------|
| L0 | System Intents (IntentBus) | `setSystemIntents(bus)` | LTP / HTP por canal |
| L1 | Selene IA Overrides | `setSeleneOverrides(intents)` | LTP (dominan sobre L0) |
| LP | Chronos Playback | `setPlaybackIntents(intents)` | LTP (entre L1 y L3) |
| L3 | Effect Intents (LiveFXEngine) | `setEffectIntents(intents)` | LTP |
| L2 | Manual Overrides (MIDI/OSC/UI) | `setManualOverride(nodeId, ch)` | escritura directa |
| L4 | Blackout | `setBlackout(true)` | colapsa todo a 0, retorna mapa vacío |

**Estrategia HTP:** canales `dimmer`, `strobe`, `shutter` → Highest Takes Precedence  
**Estrategia LTP:** todo lo demás → Latest Takes Precedence (capa mayor prioridad dicta)  
**Grand Master (0-1):** multiplica todos los canales HTP tras el merge

---

## 2. Los Adaptadores y Motores (Tentáculos Cognitivos)

Los adapters son el puente entre los motores externos y la Aether Matrix. Son los que realmente corren en el pipeline activo.

### 2.1 LiquidAetherAdapter — Físicas Fotónicas (L0)

**Motor fuente:** `LiquidEngineBase` / `liquidEngine71`  
**Wave:** WAVE 4521.2  
**Prioridad:** `L0_PRIORITY = 0` (base absoluta, la capa más baja)  
**Familias:** IMPACT (dimmer zonal + strobe) + COLOR (brightness/mood)

**Pipeline de ingesta:**
```
liquidEngine71.lastFrame + liquidEngine71.lastResult
  → LiquidAetherAdapter.ingest(frame, result, bus)
    → _routeImpactNodes()   → dimmer por zona con falloff de distancia
    → _routeStrobeNodes()   → shutter + strobeRate para IMPACT con shutter
    → _routeMoodToColorIntensity() → brightness (no RGB) para COLOR nodes
```

**Cálculo de falloff:**
```
dist    = sqrt((node.x - epi.x)² + (node.y - epi.y)² + (node.z - epi.z)²)
falloff = clamp01(1 - dist / maxRadiusM)   // DEFAULT_MAX_RADIUS_M = 12.0m
dimmer  = zoneIntensity × falloff × vibe.intensity
```

**Inyección en el Orchestrator:** El `liquidEngine71` ya fue invocado en el mismo frame por el pipeline legacy. `lastFrame` y `lastResult` son frescos.

---

### 2.2 ColorAdapter — SeleneColorEngine / SeleneLux (L1)

**Motor fuente:** `SeleneLuxOutput` / `engine.getLastColorPalette()`  
**Wave:** WAVE 4522.3  
**Prioridad:** `INTENT_PRIORITY = 10` (L1 en la jerga del adapter, idéntico numéricamente a L0 de sistemas)  
**Familia:** COLOR

**Contrato de ingesta:**
```ts
colorAdapter.setIngress(engine.getLastColorPalette())  // antes de process()
colorAdapter.process(view, ctx, bus)
```

**Paleta soportada:**
- `primary` → palette[0] → nodos con `role = 'primary'`
- `secondary` → palette[1] → nodos `secondary`
- `accent` → palette[2] → nodos `accent`
- `ambient` → palette[3] → nodos `ambient`

**Invariantes:** Solo emite `r`, `g`, `b` normalizados (0-1). NUNCA `dimmer`, `brightness`, ni CMY. La conversión a hardware es responsabilidad del `NodeResolver`.

---

### 2.3 KineticAdapter — VMM + IK Holográfico (L0)

**Motor fuente:** `VibeMovementManager` + `InverseKinematicsEngine`  
**Wave:** WAVE 4523.4 "THE HOLOGRAPHIC ADAPTER"  
**Prioridad:** `INTENT_PRIORITY = 10`  
**Familia:** KINETIC

**Cambio radical vs VMMAdapter legacy:**
- VMMAdapter emitía `pan`/`tilt` normalizados (0-1)
- KineticAdapter proyecta al espacio 3D y emite `targetX`, `targetY`, `targetZ` en **metros**

**Proyección holográfica:**
```
TargetX = vmmX × (STAGE_WIDTH / 2)          = vmmX × 4.0  m
TargetY = STAGE_CENTER_Y + vmmY × (STAGE_HEIGHT / 2) = 1.5 + vmmY × 2.0  m
TargetZ = STAGE_DEPTH                         = 2.0  m  (constante)
```

El `NodeResolver` luego invoca `InverseKinematicsEngine.solve()` para convertir `(targetX, targetY, targetZ)` + perfil IK del fixture → ángulos DMX reales.

**Mapeo VibeProfile.name → VMM vibeId:**
Mapa estático `VIBE_ID_MAP` con aliases (`'techno'` → `'techno-club'`, etc.). Fallback = `'techno-club'`.

---

### 2.4 SeleneAetherAdapter — Selene Lux IA (L3 Cognitivo)

**Motor fuente:** `getEffectManager().getCombinedOutput()` (CombinedEffectOutput) + `this.lastConsciousnessOutput` (ConsciousnessOutput)  
**Wave:** WAVE 4524.3  
**Prioridad:** `L3_PRIORITY = 300` (L3 Effects range: 300-399)  
**Fuente en bus:** `'effect'`

**Pipeline de ingesta:**
```
ConsciousnessOutput + CombinedEffectOutput
  → SeleneAetherAdapter.ingest(consciousness, effectOutput, deltaMs, bus)
    → Disassembler (campos semánticos → canales DMX 0-1)
    → ZoneNodeRouter (zona canónica → NodeId[])
    → bus.push() × nodos afectados por efectos
```

**Regla absoluta de movimiento:** El adapter L3 está **BLOQUEADO** de emitir `targetX`, `targetY`, `targetZ`, `pan`, `tilt`. Estos canales son territorio exclusivo del KineticAdapter (L0) y no pueden ser sobrescritos por efectos cognitivos.

**Threshold de activación:** Si `globalComposition < 0.01` → early return (el efecto es invisible).

---

### 2.5 ImpactAdapter — LiquidEngine71 (L0)

**Motor fuente:** `liquidEngine71` (singleton, hereda de `LiquidEngineBase`)  
**Wave:** WAVE 3516.3  
**Prioridad:** `INTENT_PRIORITY = 10`  
**Familia:** IMPACT

Computa `LiquidStereoInput` a partir del `FrameContext`, lo pasa a `liquidEngine71.applyBands()`, y usa el `LiquidStereoResult` para asignar dimmer por zona (frontL/R, backL/R, moverL/R) con falloff radial.

> **Nota:** `LiquidAetherAdapter` (WAVE 4521.2) es una versión refactorizada de este adapter que consume directamente `lastFrame`/`lastResult` del engine ya procesado. En el Orchestrator real se usa `LiquidAetherAdapter`, mientras `ImpactAdapter` (exportado como `LiquidImpactAdapter`) sigue presente para compatibilidad pero podría estar en proceso de deprecación.

---

### 2.6 BeamAdapter (L0) y AtmosphereAdapter (L0)

**Waves:** WAVE 3516.4  
**Prioridad:** `INTENT_PRIORITY = 10` ambos

**BeamAdapter:** Genera intents de zoom, focus, gobo, gobo_rotation, prism, prism_rotation por sección musical. Protección mecánica: `GOBO_HOLD_MS = 2000`, `PRISM_HOLD_MS = 1500`. Tracks del último cambio en `Map<nodeId, lastChangeMs>` pre-allocated.

**AtmosphereAdapter:** Controla fog, haze, fan, spark, pyro con 3 safety gates:
- **Gate 1 (Cooldown):** fog=5000ms, haze=2000ms, spark=8000ms, pyro=30000ms
- **Gate 2 (Max continuo):** fog bloqueado tras 180s continuos de activación
- **Gate 3 (Interlock spark):** solo si `energy > 0.80` AND `section === 'drop'`

---

### 2.7 Tabla Resumen de Adaptadores

| Adapter | WAVE | Motor fuente | Familia | Prioridad | Capa |
|---------|------|-------------|---------|----------|------|
| `LiquidAetherAdapter` | 4521.2 | `liquidEngine71` (lastFrame/lastResult) | IMPACT + COLOR | 0 | L0 base |
| `ImpactAdapter` (LiquidImpactAdapter) | 3516.3 | `liquidEngine71` (applyBands) | IMPACT | 10 | L0 |
| `ColorAdapter` | 4522.3 | `SeleneLuxOutput.getLastColorPalette()` | COLOR | 10 | L1 |
| `KineticAdapter` (usa `VMMAdapter` en Orchestrator) | 4523.4 | `VibeMovementManager` + IK | KINETIC | 10 | L0 |
| `BeamAdapter` | 3516.4 | `FrameContext` (audio+vibe) | BEAM | 10 | L0 |
| `AtmosphereAdapter` | 3516.4 | `FrameContext` (audio+vibe) | ATMOSPHERE | 10 | L0 |
| `SeleneAetherAdapter` | 4524.3 | `CombinedEffectOutput` + `ConsciousnessOutput` | ALL (sin KINETIC) | 300 | L3 |

---

## 3. Simbiosis con el Orquestador (Frame Loop)

### 3.1 Instanciación en TitanOrchestrator

El Orchestrator instancia y posee todos los componentes Aether:

```typescript
// ─── NÚCLEO ECS ──────────────────────────────────────────────────────────
private readonly _aetherGraph         = new NodeGraph()
private readonly _aetherBus           = new IntentBus(4096)
private readonly _aetherArbiter       = new NodeArbiter()
private readonly _aetherResolver      = new NodeResolver(this._aetherGraph)
private readonly _physicsPostProcessor = new PhysicsPostProcessor()

// ─── ADAPTERS ─────────────────────────────────────────────────────────────
private readonly _impactAdapter       = new LiquidImpactAdapter()      // L0
private readonly _colorAdapter        = new ColorAdapter()              // L1 (SeleneLux)
private readonly _kineticAdapter      = new VMMAdapter()                // L0 (VMM legacy — NO KineticAdapter holográfico)
private readonly _beamAdapter         = new BeamAdapter()               // L0
private readonly _atmosphereAdapter   = new AtmosphereAdapter()         // L0
private readonly _liquidAetherAdapter = new LiquidAetherAdapter(this._aetherGraph)   // L0 base
private readonly _zoneNodeRouter      = new ZoneNodeRouter(this._aetherGraph)
private readonly _seleneAetherAdapter = new SeleneAetherAdapter(this._zoneNodeRouter) // L3

// ─── CONTEXTO PRE-ALLOCATED ────────────────────────────────────────────────
private readonly _aetherAudio:   AudioMetrics
private readonly _aetherMusical: MusicalContext
private readonly _aetherVibe:    VibeProfile
private readonly _aetherCtx:     FrameContext    // ← Combina los tres
```

**Flag de activación:**
```typescript
private _aetherHasDevices = false
// Se setea en registerAetherDevice(). Si false → el bloque Aether en processFrame() es no-op.
```

### 3.2 Secuencia de Ejecución (44 Hz)

El bloque Aether corre **DESPUÉS** del pipeline legacy completo, al final de `processFrame()`:

```
processFrame(now, deltaMs):
  │
  ├─ [LEGACY PIPELINE]
  │   ├─ GodEar DSP + BrainEngine
  │   ├─ masterArbiter.arbitrate()
  │   ├─ hal.renderFromTarget(arbitratedTarget)     → FixtureState[]
  │   ├─ Post-HAL mutations (Heph, Chronos protection, stereo movement)
  │   ├─ Broadcast UI (selene:truth) — ANTES del DMX flush
  │   └─ hal.flushToDriver(fixtureStates)           ← ⚡ ADUANA LEGACY (paso a hardware)
  │
  └─ [AETHER PIPELINE]  ← si _aetherHasDevices && this.hal
      │
      │  ── STEP A: Construir FrameContext in-place (zero-alloc) ──────
      │     Mutación directa de _aetherAudio, _aetherMusical, _aetherVibe
      │     desde engineAudioMetrics, context.section, intent.palette
      │
      │  ── STEP 1: Limpiar bus ───────────────────────────────────────
      ├─ this._aetherBus.clear()
      │
      │  ── STEP 2: Ingesta L0 base (LiquidAetherAdapter) ────────────
      ├─ liquidEngine71.lastFrame + lastResult
      │   → this._liquidAetherAdapter.ingest(frame, result, bus)
      │
      │  ── STEP 3: Todos los Adapters escriben al bus ────────────────
      ├─ this._impactAdapter.process(view:IMPACT, ctx, bus)
      ├─ colorAdapter.setIngress(engine.getLastColorPalette())
      ├─ this._colorAdapter.process(view:COLOR, ctx, bus)
      ├─ this._kineticAdapter.process(view:KINETIC, ctx, bus)   ← VMMAdapter (legacy)
      ├─ this._beamAdapter.process(view:BEAM, ctx, bus)
      ├─ this._atmosphereAdapter.process(view:ATMOSPHERE, ctx, bus)
      │
      │  ── STEP 4 (L3): Selene-Aether Adapter (cognitivo) ───────────
      ├─ this._seleneAetherAdapter.ingest(consciousnessOutput, effectOutput, deltaMs, bus)
      │
      │  ── STEP 5: Arbitraje multicapa ──────────────────────────────
      ├─ this._aetherArbiter.setSystemIntents(bus)
      ├─ arbitrated = this._aetherArbiter.arbitrate()
      │
      │  ── STEP 6: Physics Post-Processor (inercia KINETIC) ──────────
      ├─ this._physicsPostProcessor.process(arbitrated, graph, deltaMs, vibe.name)
      │
      │  ── STEP 7: Resolución a DMX ──────────────────────────────────
      ├─ this._aetherResolver.setResolveContext(bpm, beatConfidence)
      ├─ this._aetherResolver.resolve(arbitrated)
      │   (incluye: IK para KINETIC, ColorTranslator, HarmonicQuantizer, TransferCurve)
      │
      │  ── STEP 8: Envío al hardware ─────────────────────────────────
      └─ for universe in aetherResolver.registeredUniverses:
             hal.sendUniverseRaw(universe, rawBuffer)   ← ⚡ ADUANA AETHER
```

### 3.3 Convivencia Legacy — Qué Sigue Vivo en Paralelo

El pipeline legacy sigue corriendo completo e independiente. Los dos pipelines coexisten **sin compartir estado** (excepto el HAL como destino):

| Componente Legacy | Estado | Descripción |
|------------------|--------|-------------|
| `BrainEngine` + GodEar DSP | ✅ Activo | Audio analysis, vibe detection, section detection |
| `ArbitrationDirector` (masterArbiter) | ✅ Activo | Arbitraje legacy L0-L4 + Chronos overlay |
| `TitanEngine` (V1, interno) | ✅ Activo | Motor de render legacy, EffectManager |
| `HAL.renderFromTarget()` | ✅ Activo | Traducción legacy a `FixtureState[]` |
| `HAL.flushToDriver()` | ✅ Activo | **La Aduana** — DMX flush legacy hacia hardware |
| `TimelineEngine` (Chronos) | ✅ Activo | `masterArbiter.setPlaybackFrame()` en el tick |
| `HephaestusRuntime` (Diamond Data) | ✅ Activo | Curvas .lfx evaluadas en main process |
| `FixturePhysicsDriver` | ✅ Activo | Inercia pan/tilt legacy (fixtures NO registrados en Aether) |
| `EffectManager` / `BaseEffect` | ✅ Activo | Efectos del sistema V1 |
| Chronos Stage Commands IPC | ✅ Activo | `chronos:setVibe`, `chronos:triggerFX`, etc. |

**Separación de fixtures:** Un fixture solo puede estar en **uno** de los dos pipelines. Los fixtures registrados en `_aetherGraph` reciben datos via `hal.sendUniverseRaw()`. Los no registrados pasan por `hal.flushToDriver()`.

### 3.4 Detección de Anomalía: VMMAdapter vs KineticAdapter

El Orchestrator instancia `new VMMAdapter()` (WAVE 3508, adapter legacy) en `_kineticAdapter`, **no** `new KineticAdapter()` (WAVE 4523.4, holográfico). El `KineticAdapter` holográfico existe en `adapters/KineticAdapter.ts` pero no está wired en el frame loop activo. Esto significa que los nodos KINETIC aún reciben `pan`/`tilt` normalizados (0-1) en lugar de `targetX/Y/Z` en metros, y el IK del `NodeResolver` para esos canales queda inactivo.

---

## 4. El Output Visual y El Mirror

### 4.1 NodeResolver — Traducción Final a DMX

El `NodeResolver` (WAVE 3505.4/4522.4) es el último guardián antes del hardware para el pipeline Aether.

**Pipeline de resolución por nodo:**
```
ArbitratedNodeMap
  ↓
  Para cada nodo arbitrado:
  1. IDeviceDefinition via NodeGraph.getDevice()
  2. Si nodo COLOR + canales abstractos (r,g,b):
       → ColorTranslator.translate() según mixingType:
         · rgb   → directo r,g,b → red,green,blue
         · rgbw  → extrae White component (WHITE_EXTRACTION_THRESHOLD)
         · cmy   → sustractivo: C=1-R, M=1-G, Y=1-B
         · wheel → HarmonicQuantizer → nearest-neighbor Lab en slots
  3. Si nodo KINETIC + canales espaciales (targetX,Y,Z):
       → IKEngine.solve(profile, target) → ángulos pan/tilt
       → Calibración: invertPan, tiltLimits, panOffset
  4. Para todos los canales:
       → Aplicar TransferCurve
       → Escalar a DMX (0-255)
       → Clamp a [0, constraints.maxValue]
  5. Escribir en Uint8Array(512) del universo
  ↓
IDMXPacket[] (buffers pre-allocated, zero-copy)
  ↓
hal.sendUniverseRaw(universe, rawBuffer)
```

**Garantías zero-alloc:**
- `_universeBuffers: Map<universe, Uint8Array(512)>` — crece en `registerDevice()`, estable en frame-time
- `_outputPackets` (pool de MutableDMXPackets) — reutilizados frame a frame
- `_rgbScratch: {r, g, b}` — único objeto para conversiones cromáticas

### 4.2 AetherUIProjector — Estado Actual (El Espejo)

El `AetherUIProjector` es un **adaptador de lectura** que proyecta el estado Aether sobre el array `FixtureState[]` legacy para que la UI y el preview de Hyperion sigan funcionando sin saber que Aether existe.

**Código activo (WAVE 3513.3.2):**
```typescript
project(fixtures: FixtureState[], graph: NodeGraph): void
  // Itera fixtures legacy
  // Busca nodos Aether via graph.getDeviceNodes(fixture.fixtureId ?? fixture.name)
  // Solo proyecta familia KINETIC (pan/tilt/rotation)
  // Las familias COLOR, IMPACT, BEAM están marcadas como "Futuro" — no proyectadas
```

**Estado actual — Bug conocido (WAVE-3524.1):**  
El Projector busca nodos por `fixture.fixtureId ?? fixture.name`, pero el `NodeGraph` registra nodos usando `fixture.id` como `DeviceId` canónico. Esta discrepancia produce un mismatch: `getDeviceNodes()` retorna vacío para todos los fixtures → el projector escribe cero datos en `FixtureState[]`.

**Estado de llamada:** `AetherUIProjector` tiene implementación pero **no se llama desde `TitanOrchestrator.processFrame()`**. No existe ninguna instancia (`_uiProjector`) en el Orchestrator activo. El espejo está construido pero desconectado del frame loop.

### 4.3 Flujo de Datos hacia la UI (The Mirror — Estado real)

La UI recibe los estados de fixtures por dos canales:

```
CANAL 1 — Pipeline Legacy (activo para todos los fixtures):
  hal.renderFromTarget() → FixtureState[] (pan/tilt/color/dimmer legacy)
    → Broadcast IPC (selene:truth @ ~7Hz)
      → Renderer: Hyperion preview / TacticalCanvas

CANAL 2 — Pipeline Aether (activo para fixtures registrados):
  NodeResolver.resolve() → Uint8Array(512)
    → hal.sendUniverseRaw(universe, rawBuffer)
      → HAL (ArtNet/sACN/simulado)
      → [NO hay retorno visual desde aquí — no pasa por FixtureState[]]
```

**Brecha identificada:** El pipeline Aether envía DMX real directo al HAL sin alimentar el sistema de preview (`FixtureState[]`). La UI NO refleja los valores calculados por Aether a menos que el AetherUIProjector sea: (a) instanciado en el Orchestrator, (b) corregido el bug de DeviceId, y (c) llamado antes del broadcast.

### 4.4 Aislamiento del Hardware Real (La Aduana / DMX)

| Aspecto | Estado |
|---------|--------|
| Pipeline legacy → HAL | `hal.flushToDriver(fixtureStates)` — activo, envía al ArtNet driver real si está conectado |
| Pipeline Aether → HAL | `hal.sendUniverseRaw(universe, rawBuffer)` — **activo y funcional**, envía al mismo driver |
| Simulación frontend | El HAL puede estar en modo simulado (sin driver ArtNet real) — ambos pipelines envían datos reales, el HAL decide si va al hardware o al simulador |
| Guard de activación | `if (this._aetherHasDevices && this.hal)` — si no hay devices registrados en Aether, el bloque completo es no-op |

**Conclusión de aislamiento:** Aether NO está bridgeado ni desactivado — su output físico está **completamente operativo**. Los datos van al hardware real si el HAL tiene un driver ArtNet conectado. El "puente" o "inactividad" de Aether depende exclusivamente de que `registerAetherDevice()` sea llamado durante el patch con fixtures reales. Sin ese registro, el pipeline es no-op silencioso.

---

## RESUMEN EJECUTIVO — Vector de Estado

### Lo que Está Activo y Funcional
- ✅ **ECS core completo:** NodeGraph, IntentBus (4096 slots, zero-alloc), NodeArbiter (6 capas), NodeResolver (IK + ColorTranslator + HarmonicQuantizer)
- ✅ **Los 5 sistemas implementados y testeados** (+12 suites, >100 tests)
- ✅ **6 adapters activos en el frame loop** (LiquidAether L0, Impact L0, Color L1, Kinetic L0, Beam L0, Atmosphere L0)
- ✅ **SeleneAetherAdapter L3** — Puente cognitivo a efectos Selene Lux IA
- ✅ **PhysicsPostProcessor** — Inercia real para motores KINETIC (WAVE 4518.1)
- ✅ **Salida DMX Aether via `sendUniverseRaw()`** — completamente funcional
- ✅ **NodeExtractionPipeline + SpatialRegistrar** — ingesta de fixtures legacy disponible

### Deuda Técnica Identificada

| ID | Componente | Problema | Severidad |
|----|-----------|---------|----------|
| D1 | `_kineticAdapter` en Orch. | Usa `VMMAdapter` (legacy, pan/tilt 0-1) en lugar de `KineticAdapter` (holográfico, targetX/Y/Z + IK) | Media |
| D2 | `AetherUIProjector` | No instanciado en `TitanOrchestrator` — el espejo UI está desconectado | Alta |
| D3 | `AetherUIProjector` | Bug DeviceId: busca `fixture.fixtureId ?? fixture.name` pero NodeGraph usa `fixture.id` | Alta |
| D4 | `AetherUIProjector` | Solo proyecta familia KINETIC — COLOR, IMPACT, BEAM marcados como "Futuro" | Media |
| D5 | Integración Chronos | `NodeArbiter.setPlaybackIntents()` existe pero nadie lo llama — Chronos aún va al `masterArbiter` legacy | Alta (para WAVE 4600) |

### Puntos de Acoplamiento Pendientes (para Chronos + Aduana)
1. **Chronos → Aether:** `NodeArbiter.setPlaybackIntents(intents)` es el slot LP pre-diseñado. Se necesita un `ChronosAetherAdapter` que convierta `FixtureTarget[]` de `TimelineEngine` en `INodeIntent[]` correctos.
2. **La Aduana Aether:** `sendUniverseRaw()` ya existe y funciona. El trabajo pendiente es garantizar que los universos Aether no colisionen con los universos del pipeline legacy (routing por universo).
3. **El Espejo:** Corregir D2+D3+D4 antes de la integración final para que la UI refleje fielmente el estado Aether en el preview.

---

*Documento generado por análisis estático — sin modificaciones al código fuente.*
