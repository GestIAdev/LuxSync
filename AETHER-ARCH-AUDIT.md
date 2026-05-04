# AETHER HOLISTIC AUDIT — WAVE 4547

> Auditoría arquitectónica del ecosistema LuxSync post-Voxel + Aether.
> Fecha: 2026-05-04 | Auditor: Cascade

---

## 0. RESUMEN EJECUTIVO

| Área | Estado | Riesgo | Tope |
|------|--------|--------|------|
| **Core Organs Wiring** | 🟢 Funcional | 🟡 Medio | Pipeline duplicado (Legacy + Aether) en cada frame @44Hz. Lazy-init no aplicada. |
| **Spatial Duality** | 🟡 Desacoplado | 🔴 Alto | `KineticAdapter` usa `STAGE_WIDTH=8`, `HEIGHT=4`, `DEPTH=2`, `CENTER_Y=1.5` **hardcodeados**. Ignora `stageStore.stage` completamente. |
| **Legacy Debt** | 🟡 Parcial | 🟡 Medio | `HeightLayer` deprecado en tipo pero `activeLayerId` aún vive en `ConstructorContext`. `ZoneOverlay.tsx` existe en disco. |
| **Node Refactor** | 🔴 No listo | 🔴 Alto | `FixtureForgeEmbedded` tiene 7 acoplamientos críticos con el modelo lineal de canales. Migración a nodos rompe `FixtureDefinition`, DMX Ribbon, capabilities y export JSON. |

**Recomendación prioritaria**: Unificar dimensiones espaciales (Voxel ↔ IK Virtual Plane) antes de cualquier refactor de Forge.

---

## 1. SISTEMA NERVIOSO: LOS 6 ÓRGANOS

### 1.1 Organograma de Conexiones

```
TitanOrchestrator (frame loop @ 44Hz)
│
├─► TrinityBrain ──► TitanEngine
│   ├─► SeleneColorEngine ──┐
│   ├─► SeleneLux (Nervous)─┼─► LightingIntent ──► masterArbiter ──► HAL (LEGACY)
│   └─► VMM-IK ─────────────┘
│
├─► Aether Matrix (PARALELO, mismo HAL)
│   ├─► NodeGraph + IntentBus + NodeArbiter + NodeResolver
│   ├─► Adapters: LiquidAetherAdapter (L0), ColorAdapter (L1), KineticAdapter (L0)
│   ├─► SeleneAetherAdapter (L3), ChronosAetherAdapter, HephaestusAetherAdapter (L3+)
│   └─► NodeResolver ──► HAL.sendUniverseRaw()
│
├─► HephaestusRuntime ──► .lfx curves ──► NodeResolver
└─► ChronosEngine (AudioContext clock) ──► ChronosInjector ──► clips
```

### 1.2 Estado por Órgano

#### LIQUID ENGINE

- **Archivos**: `hal/physics/LiquidEngineBase.ts` (784L), `LiquidEngine71.ts` (251L), `LiquidEngine41.ts`
- **Perfiles**: TECHNO / LATINO / CHILL / POP-ROCK inyectados vía `setActiveProfile()`
- **Salida**: `LiquidStereoResult` (7 zonas + floor + ambient + air)
- **Conexión**: `SeleneLux.ts:534-648` → `liquidEngine71.applyBands()` → cache `this.liquidStereoOverrides`
- **Aether Bridge**: `LiquidAetherAdapter` inyecta intensidades al IntentBus como L0 priority=10
- **Deuda**: `LiquidEngine41` + `LiquidEngine71` + `latinoEngine41Telemetry` coexisten. Branching innecesario en `SeleneLux:629-631`.
- **Rendimiento**: 🟢 Zero-alloc envelopes pre-instanciados.

#### VMM-IK (VibeMovementManager + InverseKinematicsEngine)

- **Archivos**: `engine/movement/VibeMovementManager.ts` (1044L), `InverseKinematicsEngine.ts` (626L), `core/aether/systems/KineticSystem.ts` (373L)
- **Patrones**: 16 GoldenPatterns deterministas (scan_x, square, diamond, figure8, ballyhoo, circle_big, cancan, dual_sweep, drift, sway, breath, slow_pan, tilt_nod, figure_of_4, chase_position, botstep)
- **Fase**: Monotonic phase accumulator con `smoothedBPM` (factor 0.05, convergencia 20 frames). Periodos fijos por patrón (8-256 beats).
- **Conexión Legacy**: `TitanEngine.ts:347` → `vibeMovementManager.generateIntent()` → `MovementIntent {x,y}` → `buildMechanicsBypassIntent()`
- **Conexión Aether**: `KineticAdapter.ts` → proyección holográfica `targetX/Y/Z` (metros) → IntentBus → `NodeResolver.ts:58` → `solve()` del IKEngine
- **Rendimiento**: 🟢 Frame-once guard (WAVE 2086.1) previene doble cálculo L/R.
- **🔴 PROBLEMA CRÍTICO**: `KineticAdapter` usa constantes hardcodeadas:
  ```typescript
  STAGE_WIDTH    = 8.0   // metros
  STAGE_HEIGHT   = 4.0   // metros
  STAGE_DEPTH    = 2.0   // metros
  STAGE_CENTER_Y = 1.5   // metros
  ```
  **No lee `stageStore.stage` en ningún punto.** Si el usuario cambia W/D/H en el StageConstructor, el IK sigue proyectando sobre un plano virtual de 8×4m. Un patrón `scan_x` con x=1.0 genera targetX=4.0m, no W/2.

#### SELENE COLOR ENGINE

- **Archivos**: `engine/color/SeleneColorEngine.ts` (2343L) + `ColorProcessors.ts` + estabilizadores (KeyStabilizer, EnergyStabilizer, MoodArbiter, StrategyArbiter)
- **Fundamento**: KEY_TO_HUE (Circle of Fifths), MODE_MODIFIERS (temperatura), energía → saturación/brillo (nunca hue).
- **Salida**: `SelenePalette` {primary, secondary, accent, ambient, contrast} en HSL
- **Conexión**: `TitanEngine.ts:707` → `selenePaletteToColorPalette()` → `ColorPalette` RGB → LightingIntent
- **Aether Bridge**: `ColorAdapter.ts` (WAVE 4522.3) ingiere paleta via `setIngress()` y emite `r/g/b` al IntentBus
- **Deuda**: `setIngress()` es mutación global. Dificulta testing unitario y puede causar race conditions si se llama desde múltiples threads/contextos.
- **Rendimiento**: 🟡 `SeleneColorInterpolator` mantiene estado LERP inter-frame. Sin alloc en steady state.

#### SELENE LUX IA (Sistema Nervioso)

- **Archivos**: `core/reactivity/SeleneLux.ts` (1317L)
- **Responsabilidad**: Fusión de física por género. Overrides de intensidad por zona.
- **Overrides**: 4 clases con estructuras **inconsistentes**:
  - `technoOverrides`: {front, back, mover} (3 campos)
  - `latinoOverrides`: {front, back, mover, moverL, moverR} (5 campos)
  - `chillOverrides`: {front, back, mover, moverL, moverR, frontL, frontR, backL, backR, air} (10 campos)
  - `rockOverrides`: {front, back, moverLeft, moverRight, subgenre} (5 campos)
- **Conexión**: `TitanEngine.ts:738-780` → `seleneLux.updateFromTitan(basePalette, audioMetrics, elementalMods)` → `SeleneLuxOutput`
- **🔴 Riesgo**: `SeleneLux` muta `this.lastOutput` in-place. `TitanEngine` lo consume directamente sin copia defensiva. Si downstream muta el objeto, corrompe el estado del nervous system.
- **Rendimiento**: 🟡 4 branches de overrides con mapas de campos distintos = branching penalty en hot-path.

#### HEPHAESTUS (La Forja de Curvas)

- **Archivos**: `core/hephaestus/types.ts` (608L), `runtime/HephaestusRuntime.ts` (889L), `CurveEvaluator.ts`, `PhaseDistributor.ts`
- **Formato**: `.lfx` con `HephAutomationClip` = `Map<paramId, HephCurve>`. 17 parámetros. Keyframes con interpolación hold/linear/bezier.
- **Fase**: `PhaseConfig` {spread, symmetry, wings, direction} pre-calculada en `play()` time.
- **Conexión**: `ChronosInjector` dispara clips con `hephCurves` → `HephaestusRuntime.tick(currentTimeMs)` → `HephFixtureOutput[]` → NodeResolver
- **Aether Bridge**: `HephaestusAetherAdapter` (WAVE 3521) inyecta outputs DMX-ready al IntentBus como L3+ priority
- **Deuda**: `HephAutomationClip.curves` es `Map<>` en runtime pero `Record<>` para IPC. Deserialización crea `new Map()` por clip activo — GC pressure si hay >10 clips simultáneos.
- **Rendimiento**: 🟢 Zero-alloc routing buffers (WAVE 3190). `_hephByFixtureId`, `_hephByZone`, `_hephOutputPool` pre-allocated.

#### CHRONOS (El Tiempo)

- **Archivos**: `chronos/core/ChronosEngine.ts` (1528L), `ChronosInjector.ts` (321L), `ChronosStageDispatcher.ts`
- **Clock**: `AudioContext` como reloj maestro. `requestAnimationFrame` para UI.
- **Tracks**: Vibe, FX, Automation (intensity, color, zone). Lanes con `AutomationPoint[]`.
- **Optimización**: WAVE 2500 `sortedPointsCache` (WeakMap) — sort solo en edición. WAVE 3190 zero-alloc routing.
- **Conexión**: `ChronosInjector` emite `StageCommand` (vibe-change, fx-trigger, intensity-change) → `TitanOrchestrator.processFrame()` los consume
- **Aether Bridge**: `ChronosAetherAdapter` inyecta overrides al IntentBus
- **Deuda**: Estado mutable (`playbackState`, `currentTimeMs`) sin inmutabilidad estructural. Diffing de clips usa `prevState` manual en `ChronosInjector` — propenso a desync si se pierde un evento.
- **Rendimiento**: 🟢 Cache de puntos ordenados elimina 1,200 sorts/seg a 60fps.

### 1.3 Pipeline Duplicado: El Elefante en la Habitación

```
TitanOrchestrator.processFrame() @ 44Hz
│
├─► LEGACY PIPELINE
│    1. TitanEngine.update() → LightingIntent
│    2. masterArbiter.merge() → FinalLightingTarget
│    3. HAL.sendUniverse()
│
└─► AETHER PIPELINE
     1. 6 Adapters process nodes → IntentBus
     2. NodeArbiter.merge() → ArbitratedNodeMap
     3. NodeResolver.resolve() → DMXPackets (incl. IK solve)
     4. HAL.sendUniverseRaw()
```

**Problema**: Ambos pipelines computan la **misma lógica** en paralelo. Con 100 fixtures, el trabajo se duplica.

**Mitigación actual**: `NodeResolver` solo envía si `_aetherHasDevices === true`. Pero los **6 adapters se instancian SIEMPRE** en el constructor de `TitanOrchestrator` (~300L de inicialización), consumiendo memoria y setup time.

**Recomendación**: Lazy-init del Aether Matrix. No instanciar adapters hasta el primer `registerAetherDevice()`. A largo plazo: migrar todo al pipeline Aether y deprecar `masterArbiter`.

---

## 2. DUALIDAD ESPACIAL: VOXEL ↔ IK

### 2.1 Flujo de Datos de un Fixture

```
[1] NACIMIENTO (FixtureForgeEmbedded)
    └─► PhysicsProfile {motorType, maxAcceleration, maxVelocity, tiltLimits, orientation}
    └─► FixtureDefinition {channels[], capabilities, physics}
    └─► Guardado en libraryStore → stageStore.addFixture()

[2] INSTANCIACIÓN (stageStore)
    └─► FixtureV2 {position: {x,y,z}, rotation, physics, zone}
    └─► position SNAPEADO a 0.25m (WAVE 4538)
    └─► Almacenado en showFile.fixtures[]

[3] SPATIAL TARGET (KineticAdapter @ 44Hz)
    └─► VMM genera MovementIntent {x: [-1,+1], y: [-1,+1]}
    └─► Proyección Holográfica (HARDCODEADA):
        targetX = x * (8.0 / 2)      // 4m max
        targetY = 1.5 + y * (4.0/2)  // 0.5..3.5m
        targetZ = 2.0                  // fijo
    └─► IntentBus: canales 'targetX', 'targetY', 'targetZ'

[4] IK RESOLUTION (NodeResolver @ 44Hz)
    └─► Detecta CH_TARGET_X/Y/Z
    └─► `solve(target, fixtureProfile)` → pan/tilt DMX
    └─► Aplica calibración → buffer DMX
```

### 2.2 El Desacoplamiento Crítico

| Fuente | Valor | ¿Conectado a stageStore? |
|--------|-------|--------------------------|
| Voxel Stage Width | `stageStore.stage.width` (default 12m) | ✅ UI Slider |
| Voxel Stage Depth | `stageStore.stage.depth` (default 8m) | ✅ UI Slider |
| Voxel Stage Height | `stageStore.stage.height` (default 6m) | ✅ UI Slider |
| **IK Virtual Plane Width** | **8.0m hardcode** (`KineticAdapter.ts:77`) | ❌ **NO** |
| **IK Virtual Plane Height** | **4.0m hardcode** (`KineticAdapter.ts:78`) | ❌ **NO** |
| **IK Virtual Plane Depth** | **2.0m hardcode** (`KineticAdapter.ts:79`) | ❌ **NO** |
| **IK Virtual Center Y** | **1.5m hardcode** (`KineticAdapter.ts:80`) | ❌ **NO** |

**Impacto**: Sala de 20×15×10m construida en el Voxel Constructor → VMM proyecta targets sobre 8×4m. Los movers no cubren el escenario real. Patrón `scan_x` a x=1.0 solo barre 4m derecha, no 10m.

**¿IK calcula movimientos imposibles?** No directamente. `IKEngine.solve()` devuelve `reachable: boolean`. Si target fuera de rango mecánico (`panRangeDeg`, `tiltRangeDeg`), el solver **clampea silenciosamente** al ángulo más cercano. **No hay visualización de `reachable=false` en la UI.** El técnico no sabe que sus movers no alcanzan.

### 2.3 Recomendaciones

1. **Inyectar `StageDimensions` al `KineticAdapter`** vía `setResolveContext()` o constructor en `TitanOrchestrator`.
2. **Clampear targets a Crystal Box** antes de IntentBus: `targetX = clamp(targetX, -W/2, W/2)`.
3. **Exponer `reachable` en UI**: StageConstructor debería visualizar (ghost ray rojo) si un target VMM no es alcanzable desde la posición del fixture.
4. **Centrar plano virtual dinámicamente**: `STAGE_CENTER_Y` debería ser `fixture.position.y` (altura real del truss donde cuelga el mover), no 1.5m fijo.

---

## 3. DEUDA TÉCNICA LEGACY

### 3.1 Rastros del Sistema 2.5D

| Hallazgo | Archivo | Estado | Acción |
|----------|---------|--------|--------|
| `HeightLayer` interface | `ShowFileV2.ts:30-41` | `@deprecated` WAVE 4538 | ✅ Mantener para backward compat |
| `DEFAULT_HEIGHT_LAYERS` | `ShowFileV2.ts:44-49` | `@deprecated` WAVE 4538 | ✅ Mantener |
| `layerId?: string` en `FixtureV2` | `ShowFileV2.ts:~653` | `@deprecated` WAVE 4538 | ✅ Ignorado en runtime |
| `heightLayers?: HeightLayer[]` en `ShowFileV2` | `ShowFileV2.ts:~965` | Opcional, preservado en JSON | ✅ No se lee en runtime |
| `activeLayerId` en `ConstructorContext` | `StageConstructorView.tsx:~108` | **Aún existe** | 🔴 **Eliminar del contexto** |
| `ZoneOverlay.tsx` | `components/views/StageConstructor/ZoneOverlay.tsx` | **5 referencias en disco** | 🟡 Verificar si se renderiza o es código muerto |
| `normalizeZone()` / `getZoneAtPosition()` | `core/zones/ZoneMapper.ts` (9 matches) | Usado por `HephaestusRuntime.ts:45` | 🟡 Hephaestus aún resuelve zonas por posición. Evaluar si se necesita en paradigma voxel. |
| `FixtureV2.zone` | `ShowFileV2.ts` | Campo obligatorio | 🟡 `zone` sigue siendo asignada manualmente. No hay auto-cálculo (eliminado en WAVE 4534). Esto es correcto. |

### 3.2 UI Legacy no migrada a Aether

| Componente | Archivo | Estado |
|------------|---------|--------|
| `HeightLayerManager` | `StageConstructorView.tsx:517-562` | 🔴 Aún renderizado. Debería haber sido eliminado en WAVE 4538. |
| `VisualizationToggles` | `StageConstructorView.tsx:568-592` | 🟡 Aún renderizado. Debería ser reemplazado por `VoxelViewToggles`. |
| `GridFloor25D` | `StageGrid3D.tsx` | 🟡 Nombre legacy ("25D"). Funcionalidad actualizada a voxel pero nombre confuso. |
| `FixtureSprite25D` | `StageGrid3D.tsx` | 🟡 Nombre legacy. Geometría actualizada a cylinder token pero nombre dice "sprite". |
| `StageOutline` | `StageGrid3D.tsx` | 🟡 Nombre legacy. Ahora debería ser `CrystalBox`. |

---

## 4. PREPARACIÓN NODE REFACTOR: FixtureForgeEmbedded

### 4.1 Arquitectura Actual del Channel Rack

```
FixtureForgeEmbedded.tsx (1278L)
│
├─► TAB: library      → LibraryTab (lista de fixtures existentes)
├─► TAB: general     → Cockpit layout (manufacturer, name, type, capabilities)
├─► TAB: channels    → **CHANNEL RACK** (el blanco del refactor)
│   ├─► Function Palette (izquierda): FUNCTION_PALETTE categorizado
│   │   ├── INTENSITY: dimmer, shutter, strobe
│   │   ├── COLOR: red, green, blue, white, amber, uv, color_wheel
│   │   ├── POSITION: pan, pan_fine, tilt, tilt_fine
│   │   ├── BEAM: gobo, prism, focus, zoom
│   │   ├── CONTROL: speed, macro, control
│   │   └── INGENIOS: rotation, custom, frost, gobo_rotation, prism_rotation, cyan, magenta, yellow
│   ├─► Channel Rack (centro): Array de slots indexados 0..N-1
│   │   ├── Column: Channel #
│   │   ├── Column: Function (drag-and-drop from palette)
│   │   ├── Column: MIN (solo dimmer)
│   │   ├── Column: Default Value
│   │   └── Column: Clear button
│   └─► Preview 3D (derecha): FixturePreview3D
├─► TAB: wheelsmith  → WheelSmithEmbedded (color wheels)
├─► TAB: physics     → PhysicsTuner (PhysicsProfile editor)
└─► TAB: export      → JSON preview + download
```

### 4.2 Acoplamientos Críticos a Romper

| # | Acoplamiento | Ubicación | Impacto de migrar a Nodos |
|---|-------------|-----------|---------------------------|
| **A1** | **Array lineal de canales** | `FixtureForgeEmbedded.tsx:519-539` | `fixture.channels: FixtureChannel[]` es un array plano indexado. Un node graph requiere un modelo de grafo (nodes + edges + ports). El formato JSON de `FixtureDefinition` cambiaría estructuralmente. |
| **A2** | **DMX Ribbon** | `FixtureForgeEmbedded.tsx:1009-1030` | El ribbon visual asume direccionamiento lineal CH1, CH2, CH3... Con nodos, la dirección DMX es una propiedad del nodo-output, no del índice de array. |
| **A3** | **Detección de capabilities** | `FixtureForgeEmbedded.tsx:621-636` | `deriveCapabilities(fixture.channels)` escanea el array buscando `ch.type === 'pan'`. Con nodos, la detección requiere traversar el grafo y encontrar nodos de tipo `KineticOutput`, `ColorMix`, etc. |
| **A4** | **Export/Import JSON** | `FixtureForgeEmbedded.tsx:724-733` | `JSON.stringify(fixture)` exporta el array de canales. Si cambiamos a node graph, todos los archivos `.json` existentes en la User Library se rompen. Necesita migración de schema. |
| **A5** | **FUNCTION_PALETTE estática** | `FixtureForgeEmbedded.tsx:121-164` | Las funciones son un catálogo cerrado. Un sistema de nodos requiere nodos dinámicos (ports de entrada/salida) donde cada nodo puede tener N entradas y M salidas, no solo "drop a function into a slot". |
| **A6** | **FixtureFactory.createEmpty()** | `FixtureForgeEmbedded.tsx:747` | Crea un fixture con 8 canales `unknown` pre-llenados. Un nodo graph empezaría vacío (0 nodos). |
| **A7** | **Save callback contract** | `FixtureForgeEmbedded.tsx:79-83` | `onSave(fixture: FixtureDefinition, physics: PhysicsProfile, patchData?)` asume que la definición tiene un `channels[]`. El contracto del padre (`StageConstructorView`) espera este formato. |

### 4.3 Diseño de Nodos Propuesto (Pre-diseño)

Para soportar lógica condicional ("INGENIOS"), el Channel Rack lineal debe evolucionar a un **Node Graph** donde:

- **Nodos de Entrada**: DMX Channel, Trigger (beat, BPM threshold, audio band), Timeline Event
- **Nodos de Procesamiento**: Math (add, multiply, map range), Condition (if energy > 0.5 then), LFO, Delay, Smooth
- **Nodos de Salida**: Pan, Tilt, Dimmer, Red, Green, Blue, Strobe, Gobo Wheel, Prism
- **Nodos Compuestos (INGENIOS)**: Fan Speed Controller, Fog Trigger, Mirror Ball Rotation, Pyro Sequence

**Ejemplo de INGENIO como subgraph:**

```
[Audio Energy] ──► [Threshold: >0.7] ──► [Trigger Node]
                                              │
[Beat Count] ──► [Modulo 4] ──► [AND Gate] ◄─┘
                                              │
                                    [Fan Rotation Speed]
                                              │
                                    [DMX Output: CH7]
```

### 4.4 Plan de Transición por Fases

| Fase | Descripción | Riesgo | Dependencias |
|------|-------------|--------|-------------|
| **N1** | Definir `INodeGraph` para fixtures (parallel a `FixtureChannel[]`) | 🟢 Bajo | Ninguna |
| **N2** | Implementar `NodeGraphBuilder` que convierte `FixtureChannel[]` → node graph (migración automática) | 🟡 Medio | N1 |
| **N3** | Actualizar `FixtureDefinition` para soportar ambos modos (`channels` OR `nodeGraph`) | 🟡 Medio | N2 |
| **N4** | Reemplazar Channel Rack UI por canvas de nodos (react-flow o custom) | 🔴 Alto | N3 |
| **N5** | Implementar `NodeEvaluator` en runtime (evalúa el grafo a DMX values por frame) | 🔴 Alto | N4 |
| **N6** | Deprecar `channels[]` y forzar node graph para nuevos fixtures | 🟡 Medio | N5 estable |

**Recomendación**: No empezar N4-N6 hasta que la unificación espacial (§2.3) esté resuelta. El Node Refactor es destructivo; requiere una base estable.

---

## 5. RIESGOS Y HALLAZGOS ADICIONALES

### 5.1 Riesgos de Rendimiento

| Riesgo | Ubicación | Probabilidad | Mitigación |
|--------|-----------|-------------|------------|
| Doble pipeline @ 44Hz | `TitanOrchestrator.ts:290-325` | 🔴 Seguro | Lazy-init Aether Matrix. Evaluar métricas de CPU antes de migrar todo. |
| Map deserialización Hephaestus | `HephaestusRuntime.ts` | 🟡 Media | Reemplazar `Map<>` por `Record<>` en runtime también, no solo en IPC. |
| SeleneLux in-place mutation | `SeleneLux.ts:267` | 🟡 Media | Añadir `Object.freeze()` en modo debug. En prod, copia defensiva en `TitanEngine`. |
| `deriveCapabilities()` scan O(n) | `FixtureForgeEmbedded.tsx:621` | 🟢 Baja | n = channels (≤512). Negligible. Pero con nodos sería traversión de grafo. |

### 5.2 Hallazgos de Seguridad / Correctitud

| Hallazgo | Ubicación | Severidad |
|----------|-----------|-----------|
| `VMMAdapter` alias sin deprecación real | `KineticAdapter.ts:258-259` | 🟡 Media |
| `fixture.position` sin validación de NaN en `clampToCrystalBox` | `ShowFileV2.ts` (WAVE 4538) | 🟡 Media |
| `stage.gridSize` forzado a 0.25 en `_syncDerivedState` pero el tipo permite cualquier valor | `stageStore.ts` | 🟢 Baja |

---

## 6. CONCLUSIONES Y PRÓXIMOS PASOS

### 6.1 Prioridad 0 (Bloqueante para todo)

1. **Unificar Voxel Stage ↔ IK Virtual Plane**: Conectar `stageStore.stage.width/depth/height` a `KineticAdapter`. Eliminar las 4 constantes hardcodeadas. Clampear targets a bounds.

### 6.2 Prioridad 1 (Base estable)

2. **Eliminar pipeline duplicado**: Lazy-init Aether Matrix. Medir CPU usage antes/after.
3. **Deprecar HeightLayerManager + VisualizationToggles legacy**: Eliminar del render tree de `StageConstructorView`.
4. **Defensiva en SeleneLux**: Copia defensiva de `lastOutput` antes de pasar a downstream.

### 6.3 Prioridad 2 (Preparación Node Refactor)

5. **Diseñar `INodeGraph` para fixtures**: Schema de nodos, edges, ports. Backward compat con `channels[]`.
6. **Implementar migrador `channels[] → node graph`**: Garantiza que librerías existentes no se rompen.
7. **Diseñar `NodeEvaluator` runtime**: Evaluación determinista del grafo a valores DMX por frame. Soportar loops (feedback).

### 6.4 Prioridad 3 (Polish)

8. **Visualizar `reachable` en StageConstructor**: Ghost ray rojo cuando target IK excede capacidad mecánica del fixture.
9. **Renombrar componentes legacy**: `GridFloor25D` → `VoxelFloorGrid`, `FixtureSprite25D` → `FixtureBlock`, `StageOutline` → `CrystalBox`.
10. **Eliminar `ZoneOverlay.tsx`** si ya no se renderiza (verificar antes de borrar).

---

*Auditoría completada. Documento generado bajo directiva WAVE 4547.*
*Sin código implementado. Listo para aprobación del Cónclave.*
