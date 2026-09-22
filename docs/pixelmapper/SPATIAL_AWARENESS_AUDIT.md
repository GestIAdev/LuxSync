# 🗺️ SPATIAL AWARENESS AUDIT — Topología 3D de LuxSync

**Ticket:** Auditoría forense de conciencia espacial — preparación Pixel Mapper Inverso (`.lfx`)
**Modo:** Solo lectura. Cero modificaciones de producción.
**Fecha:** Análisis sobre branch `v4` (post `0c880ed3`)

---

## TL;DR para el Pixel Mapper

| Pregunta | Respuesta |
|---|---|
| ¿Formato de coordenada? | `Position3D { x, y, z }` — **metros absolutos**, no normalizados |
| ¿Dónde vive la verdad UI? | `useStageStore.getState().fixtures` → `FixtureV2.position` (persistida en ShowFileV2) |
| ¿Dónde vive la verdad nodo? | `ICapabilityNode.position` en el `NodeGraph` (backend) — enriquecida por `SpatialRegistrar` |
| ¿Existe endpoint IPC para `NodeId → position`? | **NO** — ningún handler `lux:*` expone la tabla de posiciones de nodos |
| ¿Ya existe un pixel-mapper? | **Sí** — `PixelMapAetherAdapter` + `AetherCanvasManager` (WAVE 4812), ya proyecta `position → UV` |
| ¿Proyección 3D→2D canónica? | `_worldToUV(pos, rect, w, h)` — plano XZ top-down, Y ignorada |

---

## 1. EL NÚCLEO ESPACIAL — `SpatialRegistrar`

**Archivo:** `electron-app/src/core/aether/ingestion/SpatialRegistrar.ts`

Es el puente entre el Stagebuilder (mundo UI/persistencia) y el NodeGraph (mundo engine). Cruza los `ICapabilityNode` extraídos por `NodeExtractionPipeline` con la `Position3D` del fixture y registra el `IDeviceDefinition` enriquecido en `TitanOrchestrator`.

### 1.1 Flujo de registro (`register()`, L241-259)

```
FixtureV2 (stageStore, metros)
   │  + IDeviceDefinition (NodeExtractionPipeline)
   ▼
SpatialRegistrar.register(deviceDef, stagePosition, target, isPlaced?)
   │
   ├─ isPlaced === false → GUERRILLA BYPASS (L251-255)
   │     Registra el device RAW — sin position en nodos (IK skip, layout fallback)
   │
   └─ isPlaced !== false → _enrichWithSpatialData() (L256)
         target.registerAetherDevice(enriched) → NodeGraph.registerDevice()
```

### 1.2 Distribución de posición por familia (`_enrichWithSpatialData`, L522-565)

Regla de reparto de la posición del fixture (`center`) entre nodos:

| Familia del nodo | Posición asignada |
|---|---|
| `COLOR` en fixture **single-emitter** | Centro del aparato (herencia directa) |
| `COLOR` en fixture **multi-emitter** (>1 nodo COLOR) | **Pétalos radiales sintéticos** — ver §1.3 |
| `KINETIC` | Centro (el motor vive en el eje) |
| `BEAM` / `IMPACT` / `ATMOSPHERE` | Centro |

### 1.3 Pétalos multi-emitter (`_calculatePetalPositions`, L577-597)

```ts
// Radio default 0.15m, ángulo base 90°, distribución uniforme 360°/N en plano XZ
x: center.x + radius * cos(angle)
y: center.y            // los pétalos NO varían en altura
z: center.z + radius * sin(angle)
```

⚠️ **Importante para el Pixel Mapper:** las posiciones de pétalo son **sintéticas** (anillo ideal de 15cm), no la geometría real del emisor. Existen **solo en el NodeGraph del backend** — `stageStore` nunca las ve.

### 1.4 Mutación de posición (`updateDevicePosition`, L295-312)

`ICapabilityNode.position` es `readonly` → el ciclo es **unregister → re-enrich → register** completo del device. O(K) por device, patch-time only (nunca a 44Hz).

### 1.5 Grafo de vecindad (`rebuildNeighborGraph`, L335-390)

- O(F × N²) euclidiano 3D (`dist²`, sin √) por familia — COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE.
- `maxNeighbors = 4` default → `Map<NodeId, NodeId[]>` pre-congelado.
- Consumido por Selene vía `getNeighbors(nodeId)` en O(1) — propaga intenciones espaciales ("ola de luz").
- **Nodos sin `position` quedan fuera del grafo de vecindad** (L357) — los guerrilla no participan en efectos de propagación.

### 1.6 Sincronización automática (`connectStageStoreToSpatialRegistrar`, L689-742)

`useStageStore.subscribe(state => state.fixtures)` → detecta diffs de `position` por referencia → `registrar.batch(() => { updateDevicePosition(...)×N + rebuildNeighborGraph() })` → un solo evento `topology_changed`.

### 1.7 Roles heurísticos (`_inferHeuristicRole`, L622-658)

`role` se infiere de `zone` + altura `y` en metros:
- `zone==='air'` o `y > 2.5` → `'accent'`
- `zone==='floor'` o `y < 0.5` → `'ambient'`
- `movers-left/right` → `'accent'`; `front/back/strobe` → `'primary'`
- `ATMOSPHERE`/`BEAM`/`KINETIC` → rol de Forja conservado

---

## 2. ESTRUCTURA DE DATOS — los DOS `Position3D`

Hay **dos tipos `Position3D`** con forma idéntica pero contratos semánticos distintos:

### 2.1 `Position3D` de Stage — `src/core/stage/ShowFileV2.ts:363`

```ts
export interface Position3D {
  x: number  // meters
  y: number  // meters
  z: number  // meters
}
```

**La verdad persistida.** Convenciones (Crystal Box, L68-100):
- **Metros absolutos** — `VOXEL_SIZE = 0.25` (snap cuántico), `Y ≥ 0` (sin subsuelo)
- `clampToCrystalBox`: `x ∈ [-width/2, +width/2]`, `y ∈ [0, height]`, `z ∈ [-depth/2, +depth/2]`
- Ejes: **X** izquierda(-)/derecha(+) · **Y** suelo(0)→arriba · **Z** centro(0), **+Z = front/downstage (audiencia)**

### 2.2 `Position3D` de Aether — `src/core/aether/types.ts:380`

```ts
export interface Position3D {
  readonly x: number
  readonly y: number
  readonly z: number
}
```

**La verdad del engine** (`ICapabilityNode.position`, `capability-node.ts:242`). El JSDoc dice *"Coordenadas normalizadas al espacio del venue"* — **el comentario miente**: `SpatialRegistrar` copia los metros del stage **1:1 sin transformación** (L532-536). El valor real es metros absolutos.

⚠️ **Discrepancia documental en Z:**
- `types.ts:378`: *"z → 0 = proscenio, Positivo = fondo del escenario"*
- `SpatialRegistrar:530` + `useFixtureData.ts:196-197`: **+Z = front/downstage** (abajo en canvas top-down)

La convención operativa real (tactical canvas, Crystal Box) es **+Z = hacia la audiencia**. El JSDoc de `types.ts` está desalineado — no guiar el Pixel Mapper por él.

### 2.3 Identificadores

```ts
NodeId   = `${deviceId}:${suffix}`        // suffix = aetherNodeId ?? family-inferido
DeviceId = string                          // = FixtureV2.id
```

Suffixes vistos: `color`, `impact`, `kinetic`, `beam`, `atmosphere`, `impact-20`, `wash-impact`, `beam-color`… (multi-cell usa el `aetherNodeId` declarado en Forge).

### 2.4 `FixtureV2` — campos espaciales (`ShowFileV2.ts:740-830`)

```ts
interface FixtureV2 {
  id: string
  position: Position3D                    // metros — persistido
  rotation: Rotation3D                    // {pitch,yaw,roll} grados
  orientation: InstallationOrientation    // 'ceiling'|'floor'|'totem'|'wall-*'|'truss-*'
  isPlaced?: boolean                      // legacy — sigue escribiéndose
  placementMode?: 'unplaced'|'planar'|'3d'// tri-estado WAVE 7179 (M2)
  rigId?: string                          // hereda Y+orientation del RigV2
  zone: FixtureZone                       // CanonicalZone + legacy strings
  layerId?: string                        // height layer (WAVE 4527)
  // ... + address, universe, profileId, physics, etc.
}
```

`InstallationOrientation` infiere Y default cuando no hay rig — `DEFAULT_ORIENTATION_HEIGHT` (L217-225): `ceiling:4.0, totem:1.5, truss-*:3.5, wall-*:2.5, floor:0.1`.

### 2.5 `StageDimensions` (`ShowFileV2.ts:1073`) — el Crystal Box

```ts
interface StageDimensions {
  width: number    // metros (X)
  depth: number    // metros (Z)
  height: number   // metros (Y — techo/truss)
  gridSize: number // forzado a 0.25 en _syncDerivedState
}
```

Backend fallback si el show no envía bounds: `DEFAULT_AETHER_STAGE_BOUNDS = {width:8, height:4, depth:2, centerY:1.5}` (`TitanOrchestrator.ts:150-156`); `StageBoundsManager` actualiza bounds + `centerY` (media de `position.y` de los fixtures) en cada `setFixtures`.

---

## 3. PUNTOS DE CONSUMO — quién lee posiciones y cómo

### 3.1 React/UI — la verdad accesible desde el renderer

**`useStageStore`** (`src/stores/stageStore.ts`) — *"El Único Altar de la Verdad del Stage"*:

```ts
const fixtures = useStageStore(state => state.fixtures)  // FixtureV2[]
const stage    = useStageStore(state => state.stage)     // StageDimensions | null
// → array plano: fixture.id + fixture.position {x,y,z} en metros + fixture.zone
```

Mutadores espaciales (todos con snap 0.25m + clamp al Crystal Box):
- `updateFixturePosition(id, position)` — L817, XYZ completo
- `placeFixture2D(id, x, z, orientation, rigId?)` — L825, modo Blueprint (`computePlanarPlacement`, Y inferida o heredada de rig)
- `setFixtureElevation(id, y)` — L853, solo eje Y (`ElevationScrubber`)

Superficies de authoring: `ErebusShell` → `blueprint2d/DragDropController2D` (2D) y `studio3d` (3D + `dragPositionRef` para drag live).

### 3.2 Proyección fixture → canvas 2D (referencia para `.lfx`)

`useFixtureData.ts:192-208` — la proyección canónica top-down:

```ts
const rawX = position.x / stageW   // [-0.5,+0.5] nominal, SIN CLAMP (virtual camera)
const rawY = position.z / stageD   // +Z(front) → y alto (abajo en canvas)
fixture.x = rawX + 0.5             // → [0,1] UV
fixture.y = rawY + 0.5
```

Si el fixture **no tiene posición real** (`{0,3,0}` sentinel de default o `isPlaced===false`) → cae a `ZONE_LAYOUT_2D` (factores normalizados 0-1 por zona — `ZoneLayoutEngine.ts`), **no** a coordenadas reales.

### 3.3 Backend — la verdad a nivel NODO (la que el Pixel Mapper quiere)

```ts
// Solo alcanzable dentro del proceso principal (TitanOrchestrator._aetherGraph)
const view = nodeGraph.getView(NodeFamily.COLOR)   // INodeView — zero-alloc
view.forEach(node => {
  node.nodeId     // "deviceId:suffix"
  node.family     // NodeFamily.COLOR | IMPACT | KINETIC | BEAM | ATMOSPHERE
  node.position   // Position3D | undefined — metros, YA incluye offset de pétalo
  node.zoneId
})
```

Familias enumerables: `COLOR`, `IMPACT`, `KINETIC`, `BEAM`, `ATMOSPHERE` (`NodeFamily`, `aether/types.ts`). `graph.getDeviceNodes(deviceId)` da los NodeIds de un fixture.

### 3.4 La brecha IPC (⚠️ hallazgo clave)

**Ningún handler `lux:*` expone posiciones de nodos al renderer.** Los canales espaciales existentes son todos *inbound*:

- `lux:aether:applySpatialTarget` — recibe `fixturePositions` desde el frontend (`KineticsBridge.ts:689-717` lee `stageStore` y lo empaqueta — parche WAVE 4884 porque `orchestrator.fixtures` podía tener `{0,0,0}`).
- `lux:aether:setFixtures(fixtures, stageBounds)` — hidrata devices + bounds (`FixtureHydrationEngine.setFixtures`).
- `TitanOrchestrator.getFixturesForZoneMapping()` (L1194) — expone `{id, zone, position:{x}, channelZones}` pero solo para consumo interno del ZoneMapper.

**Implicación para el Pixel Mapper Inverso:** si el generador `.lfx` corre en el renderer, hoy solo puede leer `stageStore.fixtures` (nivel fixture, centro del aparato). Para geometría de pétalos/sub-celdas necesita o bien (a) un nuevo endpoint IPC que dump `getView().forEach(node → {nodeId, family, position})`, o bien (b) correr el sampling en el proceso principal donde el `NodeGraph` ya vive — que es exactamente lo que hace el Pixel Mapper existente.

### 3.5 El Pixel Mapper que YA EXISTE (WAVE 4812) — `src/core/aether/canvas/`

```
AetherCanvasManager      — VirtualFrameBuffer RGBA8 double-buffered (front/back,
                           flip(), max 4096², Oilpan guard)
PixelMapAetherAdapter    — bindWorldSamplers(): proyecta node.position(x,z) → UV
                           sobre un WorldRect en metros; ingest() @44Hz muestrea
                           píxeles → INodeIntent[] → capa L3 del NodeArbiter
TheiaBridgeManager       — cableado en TitanOrchestrator.ts:723
                           (canvasManager + adapter + _aetherGraph + _aetherStageBounds)
```

`_worldToUV()` (`PixelMapAetherAdapter.ts:417-436`) — **la proyección canónica mundo→píxel**:

```ts
fx = (pos.x - rect.x0) / (rect.x1 - rect.x0)   // clamp [0,1] → u ∈ [0..w-1]
fz = (pos.z - rect.z0) / (rect.z1 - rect.z0)   // clamp [0,1] → v ∈ [0..h-1]
// Y ignorada (top-down). Solo nodos COLOR + IMPACT, solo los que tienen position.
```

Existe también `_localCellToUV(cellIndex, rows, cols, w, h)` (L450+) para mapeo `'local'` por cellIndex de fixtures multi-cell.

### 3.6 Otros consumidores de `position` en el engine

| Consumidor | Uso |
|---|---|
| `computeEpicenterFalloff` (`zoneUtils.ts:128`) | Atenuación por distancia euclidiana 3D al epicentro (metros, `maxRadiusM`) — nodos sin posición → factor 1.0 |
| `applySpatialTarget` / `computeFanSubTargets` (`AetherIPCHandlers.ts:1059-1105`) | IK: sub-targets espaciales + `SpatialDistanceScale` (`D_REF=8m`, clamp [0.25,2.0]) |
| `StageBoundsManager.updateStageBounds` | `centerY` = media de `position.y` |
| `_inferHeuristicRole` (SpatialRegistrar) | `y > 2.5` → accent, `y < 0.5` → ambient |

---

## 4. MAPA DE FLUJO COMPLETO

```
AUTHORING (renderer)
  Erebus blueprint2d / studio3d / ElevationScrubber
        │ placeFixture2D · updateFixturePosition · setFixtureElevation
        ▼
  stageStore (Zustand) — FixtureV2.position en METROS, snap 0.25, Crystal Box
        │ debounce 2s ──► lux.stage.save ──► ShowFileV2 (.luxshow) en disco
        │
        │ subscribe (connectStageStoreToSpatialRegistrar, SpatialRegistrar.ts:689)
        ▼
SYNC (patch-time)
  SpatialRegistrar.updateDevicePosition / register
        │ unregister → _enrichWithSpatialData (centro | pétalos 0.15m XZ) → register
        ▼
ENGINE TRUTH (proceso principal)
  NodeGraph: ICapabilityNode.position {x,y,z} m — readonly, por NODO (no por fixture)
        │
        ├──► Selene: getNeighbors() (grafo vecindad O(1))
        ├──► Adapters: epicenter falloff, zone routing
        ├──► IK: applySpatialTarget (fixturePositions via IPC payload)
        └──► PixelMapAetherAdapter: position(x,z) → UV sampler → L3 intents → DMX
```

---

## 5. GOTCHAS PARA EL PIXEL MAPPER INVERSO (`.lfx`)

1. **Dos Position3D, un solo contrato real:** metros absolutos, +Z = audiencia. El JSDoc "normalizado" de `aether/types.ts` y su semántica Z son vestigios desalineados — no confiar en ellos.
2. **Posiciones de pétalo invisibles para la UI:** el anillo de 0.15m existe solo en el NodeGraph. Un `.lfx` generado desde `stageStore` verá el centro del fixture; para sampler a nivel celda hay que pasar por el backend (o un IPC nuevo).
3. **`position` es opcional:** guerrilla/quick-add (`isPlaced===false`) registran nodos **sin** posición → invisibles para vecindad, epicenter falloff y `bindWorldSamplers`. El generador debe definir un fallback (¿zona? ¿centro del stage?) o excluirlos.
4. **Y no participa en pixel mapping** — `_worldToUV` proyecta solo XZ. Si `.lfx` quiere efectos verticales (olas de suelo a techo), necesita su propia proyección de Y.
5. **Unidades:** todo es metros reales. Un `WorldRect` incorrecto produce UVs clampeados a los bordes — el rect debe derivarse de `StageDimensions` (`±width/2 × ±depth/2`), no de un rect hardcodeado.
6. **Sentinel `{0,3,0}`:** `useFixtureData` y el stereo-split tratan la posición default `(0, 3, 0)` como "sin posición real" — heurística frágil pero prevalente; el `.lfx` debería usar `placementMode`/`isPlaced` como discriminador en su lugar.
7. **Voxel grid:** toda coordenada persistida es múltiplo de 0.25m — la resolución espacial útil mínima del mapper es 25cm; sub-voxel es ruido sintético (salvo pétalos, que son matemática pura).

---

## 6. ARCHIVOS CLAVE (referencia rápida)

| Capa | Archivo | Líneas clave |
|---|---|---|
| Tipos stage | `src/core/stage/ShowFileV2.ts` | Position3D:363 · FixtureV2:740 · StageDimensions:1073 · voxel:59-100 · zones:403 |
| Store UI | `src/stores/stageStore.ts` | fixtures:100 · updateFixturePosition:817 · placeFixture2D:825 · setFixtureElevation:853 |
| Núcleo espacial | `src/core/aether/ingestion/SpatialRegistrar.ts` | register:241 · enrich:522 · pétalos:577 · neighbors:335 · store-sync:689 |
| Tipos engine | `src/core/aether/types.ts` | Position3D:380 · NodeFamily |
| Nodo | `src/core/aether/capability-node.ts` | ICapabilityNode:232 (position:242) |
| Enumeración | `src/core/aether/node-graph.ts` | INodeView.forEach:94 · getView:240 |
| Pixel map | `src/core/aether/canvas/PixelMapAetherAdapter.ts` | bindWorldSamplers:183 · _worldToUV:417 |
| Canvas buffers | `src/core/aether/canvas/AetherCanvasManager.ts` | VirtualFrameBuffer:33 · acquire:76 |
| Proyección 2D UI | `src/components/hyperion/views/tactical/useFixtureData.ts` | x/z → UV:192-208 |
| Layout fallback | `src/components/hyperion/shared/ZoneLayoutEngine.ts` | ZONE_LAYOUT_2D · calculatePosition3D:369 |
| Bounds backend | `src/core/orchestrator/TitanOrchestrator.ts` | DEFAULT bounds:150 · StageBoundsManager:406 |
| IPC espacial | `src/core/aether/AetherIPCHandlers.ts` | applySpatialTarget:1024 (inbound only) |
| Bridge UI→IPC | `src/bridges/KineticsBridge.ts` | fixturePositions payload:689-727 |

---

*Generado por auditoría forense — solo lectura. Sin modificaciones de código de producción.*
