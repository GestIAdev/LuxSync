# WAVE 4538 — THE VOXEL CONSTRUCTOR BLUEPRINT

> **Blueprint de Refactorización: StageConstructor 2.5D → Voxel Constructor (Minecraft Paradigm)**
> Estado: DISEÑO ARQUITECTÓNICO — PROHIBIDO ESCRIBIR CÓDIGO HASTA APROBACIÓN
> Precedente: WAVE 4527 (2.5D top-down) — **SUPERADO Y REEMPLAZADO**
> Autores: Lead System Architect (PunkOpus) + Radwulf

---

## 0. POST-MORTEM DEL 2.5D (POR QUÉ MURIÓ)

| # | Fallo | Impacto |
|---|-------|---------|
| F1 | **Ortho top-down oculta el eje Y** | Drop lines invisibles, VolumetricGrid colapsa a un plano, el técnico no ve la diferencia entre Floor y Truss High |
| F2 | **HeightLayers = abstracción innecesaria** | Indirection layer sobre `position.y`. El técnico piensa en metros, no en capas con nombres arbitrarios |
| F3 | **GridHelpers apilados → Moiré** | Grids horizontales a distintas alturas se superponen en top-down = noise visual |
| F4 | **Pivote isométrico (WAVE 4537) parcheó pero no resolvió** | OrbitControls + cylinder tokens mejoran la vista pero el modelo de datos sigue basado en capas abstractas |
| F5 | **normalizeZone eliminado pero no reemplazado** | Las zonas manuales son correctas, pero falta un sistema de posicionamiento preciso y visual |

**Veredicto**: El modelo 2.5D con HeightLayers fue un callejón sin salida. La solución es un espacio 3D real con posicionamiento discretizado (voxel grid).

---

## 1. VISIÓN DE DISEÑO: "EL ESPACIO MINECRAFT"

### 1.1 Filosofía

El StageConstructor Voxel es un **editor de bloques 3D** discretizado a 25cm. La metáfora es Minecraft creativo: el técnico ve un espacio volumétrico real, coloca fixtures en posiciones exactas con snap magnético, y puede rotar la cámara libremente para inspeccionar la estructura desde cualquier ángulo.

**Regla Matemática Innegociable**: El voxel base es **0.25m × 0.25m × 0.25m** (25cm³). A una distancia media de 8 metros, un error de 0.25m produce un desvío angular de ~1.8°, dentro del margen aceptable de ~2° para apuntado de movers.

### 1.2 Conceptos fundamentales

| Concepto | Definición |
|----------|-----------|
| **Voxel** | Unidad mínima de posicionamiento: cubo de 0.25m³. Toda coordenada X, Y, Z es múltiplo de 0.25. |
| **Crystal Box** | El volumen edificable de la sala: `width × depth × height`. Límites duros. |
| **Ghost Cursor** | Wireframe de 0.25m que sigue al ratón, haciendo snap al grid 3D. Indica dónde caerá el próximo fixture. |
| **FixtureBlock** | Representación visual de un fixture: cilindro sólido o cubo de ≤0.25m que ocupa su voxel. |
| **Floor Plane** | El plano Y=0. Base de referencia para todo posicionamiento. |

### 1.3 Paleta visual

```
Fondo:                  #0a0a12 (casi negro, ligeramente azul)
Grid suelo (1m):        #1a1a2e (líneas principales del floor)
Grid suelo (0.25m):     #12121f (subdivisiones, solo en zoom alto)
Crystal Box edges:      #22d3ee @ 30% (cyan, wireframe del volumen edificable)
Ghost Cursor:           #22d3ee @ 60% (cyan wireframe parpadeante)
Ghost Cursor stacking:  #4ade80 @ 60% (verde cuando apila sobre fixture)
Ghost Cursor invalid:   #ef4444 @ 60% (rojo cuando fuera de Crystal Box)
FixtureBlock:           Color por tipo (existente FIXTURE_TYPE_COLOR)
FixtureBlock selected:  #22d3ee (cyan, borde brillante)
Drop lines:             Color del tipo @ 45% (conectan fixture con floor)
Floor projection:       Color del tipo @ 25% (ring en Y=0)
Coordinate labels:      #22d3ee @ 55% (en bordes de la Crystal Box)
```

### 1.4 Referencia visual (ASCII art — vista isométrica)

```
          ┌───────────────────────────────┐ ← Crystal Box ceiling (Y=height)
         /│                              /│
        / │    ■ MH-01    ■ MH-02      / │
       /  │    ╎          ╎           /  │
      /   │    ╎          ╎          /   │   H = 6m
     /    │    ╎          ╎         /    │
    ┌─────│────╎──────────╎────────┐     │
    │     │    +          +        │     │
    │     │  ● PAR-01   ● PAR-02  │     │
    │     └────────────────────────│─────┘
    │    /                         │    /
    │   /          ☐ ← Ghost      │   /    D = 8m
    │  /            Cursor         │  /
    │ /                            │ /
    └──────────────────────────────┘
                W = 12m

    ■ = FixtureBlock (moving-head, elevated)
    ╎ = Drop line (Y > 0 → Y = 0)
    + = Floor projection (shadow ring)
    ● = FixtureBlock (par, floor level)
    ☐ = Ghost Cursor (wireframe, follows mouse)
```

---

## 2. AUDITORÍA: QUÉ SE DESTRUYE

### 2.1 Código a eliminar

| Elemento | Archivo(s) | Motivo |
|----------|-----------|--------|
| `HeightLayer` interface | `ShowFileV2.ts:30-41` | Abstracción muerta. Coordenadas Y directas la reemplazan. |
| `DEFAULT_HEIGHT_LAYERS` constant | `ShowFileV2.ts:44-49` | Ya no hay capas predefinidas. |
| `heightLayers` en `StageStoreState` | `stageStore.ts:113` | Sin capas, sin estado de capas. |
| `activeLayerId` en `StageStoreState` | `stageStore.ts:116` | Muere con las capas. |
| `addHeightLayer()` action | `stageStore.ts:934-942` | Acción de capa. |
| `updateHeightLayer()` action | `stageStore.ts:944-954` | Acción de capa. |
| `removeHeightLayer()` action | `stageStore.ts:956-969` | Acción de capa. |
| `setFixtureLayer()` action | `stageStore.ts:971-986` | Acción de capa. |
| `setActiveLayerId()` action | `stageStore.ts:930-932` | Acción de capa. |
| `selectHeightLayers` selector | `stageStore.ts:1033` | Selector de capa. |
| `selectActiveLayerId` selector | `stageStore.ts:1034` | Selector de capa. |
| `selectActiveLayer` selector | `stageStore.ts:1035-1036` | Selector de capa. |
| `selectFixturesByLayer` selector | `stageStore.ts:1037-1038` | Selector de capa. |
| `HeightLayerManager` component | `StageConstructorView.tsx:517-562` | UI de capas muerta. |
| `VisualizationToggles` component | `StageConstructorView.tsx:568-592` | Se reconstruye para el nuevo paradigma. |
| `VolumetricGrid` component | `StageGrid3D.tsx:313-333` | GridHelpers apilados mueren. |
| `CoordinateRulers` component | `StageGrid3D.tsx:339-396` | Se reconstruye sobre la Crystal Box (3D, no solo floor). |
| `GridFloor25D` component | `StageGrid3D.tsx:521-541` | Se reemplaza por `VoxelFloorGrid`. |
| `StageOutline` component | `StageGrid3D.tsx:455-470` | Se reemplaza por `CrystalBox` (wireframe 3D completo). |
| `activeLayerId` en `ConstructorContext` | `StageConstructorView.tsx:108-110` | Muere con las capas. |
| `showVolumetricGrid` en `ConstructorContext` | `StageConstructorView.tsx:112-116` | Se reconstruye. |
| `layerId` migration en `_syncDerivedState` | `stageStore.ts:383-394` | Migración de capas muerta. |

### 2.2 Código que SOBREVIVE (refactorizado)

| Elemento | Cambio |
|----------|--------|
| `FixtureSprite25D` → `FixtureBlock` | Cylinder token se mantiene, se mueve a `position.y` real (no forzado a floor). |
| `TransformGizmo` | Se re-habilita eje Y (`showY={true}`). Snap = 0.25 en los 3 ejes. |
| `OffsetPanel` | Se mantiene, valores forzados a snap 0.25 en onChange. |
| `ContextMenu` submenús | "MOVER A CAPA" muere. "ASIGNAR ZONA" sobrevive. Se añade "MOVER A Y..." (input numérico directo). |
| `DimensionSliders` | Se extiende con slider de Altura (H). |
| `OrbitControls` (WAVE 4537) | Se mantiene. maxPolarAngle se mantiene. |
| `OrthographicCamera` | Se mantiene (isométrica ortográfica). |
| `showDropLines` toggle | Sobrevive, se re-cablea al nuevo `FixtureBlock`. |
| `StageDimensions` interface | Ya tiene `height`. Se usa como límite de la Crystal Box. |
| `FixtureV2.position` | Ya es `Position3D {x, y, z}`. Se fuerza snap a 0.25 en store actions. |
| `FixtureV2.layerId` | Campo se depreca pero no se elimina (backward compat). Ignorado por el nuevo código. |

---

## 3. ARQUITECTURA DE COMPONENTES (NUEVO)

### 3.1 Árbol de componentes

```
StageConstructorView.tsx
├── FixtureLibrarySidebar            (existente — sin cambios)
├── StageGrid3D.tsx                   ← REFACTORIZADO COMPLETO
│   ├── <Canvas>
│   │   ├── OrthographicCamera       (existente — isométrica, WAVE 4537)
│   │   ├── OrbitControls            (existente — rotación libre, WAVE 4537)
│   │   ├── VoxelFloorGrid           ← NUEVO (grid discreto en Y=0)
│   │   ├── CrystalBox               ← NUEVO (wireframe 3D del volumen edificable)
│   │   ├── CrystalBoxRulers         ← NUEVO (labels de metros en los 3 ejes)
│   │   ├── GhostCursor              ← NUEVO (voxel fantasma que sigue al mouse)
│   │   ├── FixtureBlock[]           ← NUEVO (reemplaza FixtureSprite25D)
│   │   ├── TransformGizmo           (existente — snap 0.25 en XYZ, showY=true)
│   │   ├── CameraBridge             (existente)
│   │   └── WebGLContextHandler      (existente)
│   ├── BoxSelectionOverlay           (existente)
│   ├── ContextMenu                   (existente — adaptado)
│   ├── OffsetPanel                   (existente — snap 0.25 forzado)
│   └── DropZoneIndicator             (existente)
├── DimensionSliders                  ← EXTENDIDO (ahora W + D + H)
├── VoxelViewToggles                  ← NUEVO (reemplaza VisualizationToggles + HeightLayerManager)
└── PropertiesContent                 (existente)
```

### 3.2 Componentes eliminados

| Componente | Sustituto |
|------------|-----------|
| `HeightLayerManager` | Nada. El concepto de capas muere. |
| `VisualizationToggles` | `VoxelViewToggles` (nuevo, más simple). |
| `VolumetricGrid` | La Crystal Box ya es la referencia volumétrica. |
| `CoordinateRulers` | `CrystalBoxRulers` (labels en los 3 ejes de la caja). |
| `GridFloor25D` | `VoxelFloorGrid` (grid discreto con subdivisiones de 0.25m). |
| `StageOutline` | `CrystalBox` (wireframe 3D completo). |
| `FixtureSprite25D` | `FixtureBlock` (cilindro 3D posicionado a Y real). |

---

## 4. MODELO DE DATOS

### 4.1 Cambios en `ShowFileV2.ts`

#### 4.1.1 `StageDimensions` — sin cambios estructurales

```typescript
// Ya existe, se usa tal cual:
export interface StageDimensions {
  width: number    // X axis (meters)
  depth: number    // Z axis (meters)
  height: number   // Y axis (meters) — AHORA ES LÍMITE DE CRYSTAL BOX
  gridSize: number // 0.25 forzado por el nuevo paradigma
}
```

**Acción**: Cambiar el default de `gridSize` en `createEmptyShowFile()`:

```typescript
// ANTES:
stage: { width: 12, depth: 8, height: 5, gridSize: 0.5 }

// DESPUÉS:
stage: { width: 12, depth: 8, height: 6, gridSize: 0.25 }
```

#### 4.1.2 `FixtureV2` — campo `layerId` deprecado

```typescript
export interface FixtureV2 {
  // ... todo lo existente se mantiene ...
  
  /** @deprecated WAVE 4538: Height layers eliminadas. Campo ignorado.
   *  Kept for backward compatibility with old show files. */
  layerId?: string
  
  // position: Position3D — ya existe, ahora forzado a snap 0.25
}
```

**NO se elimina** `layerId` del tipo (backward compat con archivos existentes). Simplemente se ignora.

#### 4.1.3 `HeightLayer` — se marca como deprecated

```typescript
/** @deprecated WAVE 4538: Voxel paradigm replaces height layers.
 *  Kept for backward compatibility with show files created before WAVE 4538. */
export interface HeightLayer { /* ... sin cambios ... */ }

/** @deprecated WAVE 4538 */
export const DEFAULT_HEIGHT_LAYERS: HeightLayer[] = [ /* ... sin cambios ... */ ]
```

**NO se borran** (archivos viejos tienen `heightLayers`). Simplemente se ignoran en el runtime.

#### 4.1.4 Nueva utility: `snapToVoxel()`

```typescript
/** WAVE 4538: Snap coordinate to nearest voxel boundary (0.25m grid) */
export const VOXEL_SIZE = 0.25

export function snapToVoxel(value: number): number {
  return Math.round(value / VOXEL_SIZE) * VOXEL_SIZE
}

export function snapPosition(pos: Position3D): Position3D {
  return {
    x: snapToVoxel(pos.x),
    y: snapToVoxel(Math.max(0, pos.y)),  // Clamp Y >= 0 (no sub-floor)
    z: snapToVoxel(pos.z),
  }
}

/** Clamp position inside the Crystal Box bounds */
export function clampToCrystalBox(
  pos: Position3D,
  stage: StageDimensions
): Position3D {
  const halfW = stage.width / 2
  const halfD = stage.depth / 2
  return {
    x: snapToVoxel(Math.max(-halfW, Math.min(halfW, pos.x))),
    y: snapToVoxel(Math.max(0, Math.min(stage.height, pos.y))),
    z: snapToVoxel(Math.max(-halfD, Math.min(halfD, pos.z))),
  }
}
```

### 4.2 Cambios en `stageStore.ts`

#### 4.2.1 State — eliminar campos de capas

```typescript
interface StageStoreState {
  // ❌ ELIMINAR:
  // heightLayers: HeightLayer[]
  // activeLayerId: string
  
  // ✅ Todo lo demás se mantiene
}
```

#### 4.2.2 Actions — eliminar acciones de capas, añadir snap enforcement

```typescript
interface StageStoreActions {
  // ❌ ELIMINAR:
  // setActiveLayerId
  // addHeightLayer
  // updateHeightLayer
  // removeHeightLayer
  // setFixtureLayer
  
  // ✅ MANTENER (con snap enforcement):
  updateFixturePosition: (id: string, position: Position3D) => void
  // Implementación interna: position = snapPosition(position)
  
  // ✅ MANTENER:
  updateStageDimensions: (dims: Partial<StageDimensions>) => void
  // Nota: dims.gridSize se ignora — siempre 0.25
  
  // ✅ Todo lo demás se mantiene
}
```

#### 4.2.3 `updateFixturePosition` — snap enforcement

```typescript
updateFixturePosition: (id, position) => {
  const { showFile } = get()
  if (!showFile) return
  
  const fixture = showFile.fixtures.find(f => f.id === id)
  if (!fixture) return
  
  // 🧱 WAVE 4538: Force snap to voxel grid
  const stage = showFile.stage ?? { width: 12, depth: 8, height: 6, gridSize: 0.25 }
  fixture.position = clampToCrystalBox(
    { x: position.x, y: position.y, z: position.z },
    stage
  )
  
  get()._syncDerivedState()
  get()._setDirty()
},
```

#### 4.2.4 `_syncDerivedState` — eliminar migración de capas

```typescript
_syncDerivedState: () => {
  const { showFile } = get()
  if (!showFile) { /* ... keep null-safety ... */ return }
  
  // ❌ ELIMINAR todo el bloque de heightLayers migration
  // ❌ ELIMINAR todo el bloque de layerId migration (WAVE 4536 E18)
  
  // ✅ NUEVO: Force gridSize to 0.25 if legacy file has different value
  if (showFile.stage && showFile.stage.gridSize !== 0.25) {
    showFile.stage.gridSize = 0.25
  }
  
  // ✅ NUEVO: Snap all fixture positions to voxel grid (migration)
  for (const fixture of showFile.fixtures) {
    const snapped = snapPosition(fixture.position)
    if (snapped.x !== fixture.position.x || 
        snapped.y !== fixture.position.y || 
        snapped.z !== fixture.position.z) {
      fixture.position = snapped
    }
  }
  
  set({
    fixtures: [...showFile.fixtures],
    groups: showFile.groups,
    scenes: showFile.scenes,
    stage: showFile.stage,
    visuals: showFile.visuals,
    // ❌ ELIMINAR: heightLayers: [...]
  })
},
```

#### 4.2.5 Selectors — eliminar selectores de capas

```typescript
// ❌ ELIMINAR:
// selectHeightLayers
// selectActiveLayerId
// selectActiveLayer
// selectFixturesByLayer

// ✅ Todo lo demás se mantiene
```

### 4.3 Cambios en `ConstructorContext`

```typescript
interface ConstructorContextType {
  // ✅ MANTENER:
  snapEnabled: boolean
  setSnapEnabled: (enabled: boolean) => void
  snapDistance: number       // CAMBIAR default: 0.25 (era 0.5)
  snapRotation: number
  draggedFixtureType: string | null
  setDraggedFixtureType: (type: string | null) => void
  toolMode: 'select' | 'boxSelect'
  setToolMode: (mode: 'select' | 'boxSelect') => void
  showZones: boolean
  setShowZones: (show: boolean) => void
  openFixtureForge: (...) => void
  
  // ❌ ELIMINAR:
  // activeLayerId: string
  // setActiveLayerId: (id: string) => void
  // showVolumetricGrid: boolean
  // setShowVolumetricGrid: (v: boolean) => void
  
  // ✅ MANTENER (renombrar internamente):
  showDropLines: boolean
  setShowDropLines: (v: boolean) => void
  
  // ✅ NUEVO:
  showCrystalBox: boolean
  setShowCrystalBox: (v: boolean) => void
  showFloorGrid: boolean
  setShowFloorGrid: (v: boolean) => void
  ghostCursorEnabled: boolean
  setGhostCursorEnabled: (v: boolean) => void
}
```

---

## 5. COMPONENTES R3F: ESPECIFICACIONES

### 5.1 `VoxelFloorGrid` — Grid discreto en Y=0

Reemplaza `GridFloor25D`. Estructura de 3 capas idéntica pero con la subdivisión base de 0.25m.

```typescript
const VoxelFloorGrid: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const w = stage?.width ?? 12
  const d = stage?.depth ?? 8
  const size = Math.max(w, d)
  const fineRef = useRef<THREE.GridHelper>(null)
  
  // Auto-hide fine grid (0.25m) when zoomed out to prevent Moiré
  useFrame(({ camera }) => {
    if (fineRef.current) {
      const zoom = (camera as THREE.OrthographicCamera).zoom ?? 40
      fineRef.current.visible = zoom >= 50
    }
  })
  
  return (
    <group position={[0, 0, 0]}>
      {/* Layer 1: 5m sections (always visible) */}
      <gridHelper args={[size, Math.round(size / 5), '#2a2a44', '#2a2a44']} />
      {/* Layer 2: 1m grid (always visible) */}
      <gridHelper args={[size, Math.round(size), '#1a1a2e', '#1a1a2e']} />
      {/* Layer 3: 0.25m fine grid (zoom-dependent) */}
      <gridHelper ref={fineRef} args={[size, Math.round(size * 4), '#12121f', '#12121f']} />
    </group>
  )
}
```

### 5.2 `CrystalBox` — Wireframe 3D del volumen edificable

Reemplaza `StageOutline`. Dibuja un paralelepípedo wireframe que define los límites de construcción.

```typescript
const CrystalBox: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const w = stage?.width ?? 12
  const d = stage?.depth ?? 8
  const h = stage?.height ?? 6
  
  // Box centered in XZ, base at Y=0, top at Y=h
  const geo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    [w, d, h]
  )
  
  return (
    <lineSegments geometry={geo} position={[0, h / 2, 0]}>
      <lineBasicMaterial color="#22d3ee" opacity={0.3} transparent />
    </lineSegments>
  )
}
```

**Visual**: Un cubo cyan semi-transparente que encierra todo el espacio edificable. El suelo es `Y=0`, el techo es `Y=height`.

### 5.3 `CrystalBoxRulers` — Labels de metros en los 3 ejes

Reemplaza `CoordinateRulers`. Ahora etiquetas en **3 ejes** (X, Y, Z) a lo largo de las aristas de la Crystal Box.

```typescript
const CrystalBoxRulers: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const w = stage?.width ?? 12
  const d = stage?.depth ?? 8
  const h = stage?.height ?? 6
  const halfW = w / 2
  const halfD = d / 2
  
  const [visible, setVisible] = useState(true)
  useFrame(({ camera }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom ?? 40
    const show = zoom >= 25
    if (show !== visible) setVisible(show)
  })
  
  if (!visible) return null
  
  // X axis labels: along front-bottom edge (Z = +halfD, Y = 0)
  const xTicks = range(-Math.floor(halfW), Math.floor(halfW))
  // Y axis labels: along left-front vertical edge (X = -halfW, Z = +halfD)
  const yTicks = range(0, h)
  // Z axis labels: along left-bottom edge (X = -halfW, Y = 0)
  const zTicks = range(-Math.floor(halfD), Math.floor(halfD))
  
  return (
    <>
      {/* X axis (width) — along floor front edge */}
      {xTicks.map(x => (
        <Text key={`rx${x}`}
          position={[x, 0.05, halfD + 0.6]}
          fontSize={0.25} color="#22d3ee" fillOpacity={0.5}
          anchorX="center" anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
        >{`${x}m`}</Text>
      ))}
      
      {/* Y axis (height) — along left-front vertical edge */}
      {yTicks.map(y => (
        <Text key={`ry${y}`}
          position={[-(halfW + 0.6), y, halfD]}
          fontSize={0.25} color="#4ade80" fillOpacity={0.5}
          anchorX="center" anchorY="middle"
        >{`${y}m`}</Text>
      ))}
      
      {/* Z axis (depth) — along left floor edge */}
      {zTicks.map(z => (
        <Text key={`rz${z}`}
          position={[-(halfW + 0.6), 0.05, z]}
          fontSize={0.25} color="#22d3ee" fillOpacity={0.5}
          anchorX="center" anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
        >{`${z}m`}</Text>
      ))}
    </>
  )
}
```

**Novedad**: El eje Y tiene labels **verdes** (`#4ade80`) para diferenciarse visualmente de X/Z (que son cyan). Esto da pista visual inmediata de la dimensión de altura.

### 5.4 `GhostCursor` — El cursor 3D de Minecraft

**El componente estrella del nuevo paradigma.** Un wireframe de 0.25m³ que sigue al puntero del mouse y hace snap al grid voxel.

#### 5.4.1 Raycasting

```typescript
interface GhostCursorState {
  position: Position3D | null    // Posición snap del voxel
  mode: 'floor' | 'stack' | 'invalid' | 'hidden'
  stackTargetId?: string         // ID del fixture sobre el que apilamos
}

const GhostCursor: React.FC<{
  enabled: boolean
  isDragging: boolean  // Se activa cuando hay fixture en drag desde library
}> = ({ enabled, isDragging }) => {
  const stage = useStageStore(state => state.stage)
  const fixtures = useStageStore(state => state.fixtures)
  const [ghost, setGhost] = useState<GhostCursorState>({ position: null, mode: 'hidden' })
  
  const { camera, raycaster, pointer } = useThree()
  
  useFrame(() => {
    if (!enabled || !isDragging) {
      if (ghost.mode !== 'hidden') setGhost({ position: null, mode: 'hidden' })
      return
    }
    
    raycaster.setFromCamera(pointer, camera)
    
    // 1. Check intersection with existing fixtures (for stacking)
    // ... raycast against fixture bounding boxes ...
    // If hit: position = fixturePos + {0, 0.25, 0} (stack on top)
    //         mode = 'stack'
    
    // 2. Fallback: intersect floor plane (Y=0)
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane, intersection)
    
    if (intersection) {
      const snapped = snapPosition({
        x: intersection.x,
        y: 0,
        z: intersection.z,
      })
      
      // 3. Validate: is snapped position inside Crystal Box?
      const halfW = (stage?.width ?? 12) / 2
      const halfD = (stage?.depth ?? 8) / 2
      const insideBounds = Math.abs(snapped.x) <= halfW && Math.abs(snapped.z) <= halfD
      
      setGhost({
        position: snapped,
        mode: insideBounds ? 'floor' : 'invalid',
      })
    }
  })
  
  if (!ghost.position || ghost.mode === 'hidden') return null
  
  const color = ghost.mode === 'floor' ? '#22d3ee'
              : ghost.mode === 'stack' ? '#4ade80'
              : '#ef4444'
  
  return (
    <mesh position={[ghost.position.x, ghost.position.y + 0.125, ghost.position.z]}>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshBasicMaterial color={color} wireframe opacity={0.6} transparent />
    </mesh>
  )
}
```

#### 5.4.2 Stacking logic

El Ghost Cursor detecta fixtures existentes via bounding box raycast:

```
Si el rayo intersecta un FixtureBlock:
  1. Determinar la cara más cercana al punto de intersección
  2. Si cara = TOP    → stack Y+0.25 (apilar encima)
  3. Si cara = BOTTOM → stack Y-0.25 (apilar debajo, si Y > 0)
  4. Si cara = SIDES  → stack lateral (misma Y, desplazar en X o Z)
  5. Snap resultado al grid voxel
  6. Validar que la posición resultante está dentro de la Crystal Box
```

El stacking solo se activa si `isDragging` es true (durante drop desde la library).

#### 5.4.3 Drop integration

Cuando se completa el drop (mouse up):

```typescript
// En handleDrop / handleFixtureDrop:
const dropPosition = ghostCursorPosition  // Posición ya snappeada del ghost
// El fixture se crea en dropPosition exacto
// No hay activeLayer — la posición Y viene del ghost cursor directamente
```

### 5.5 `FixtureBlock` — Representación visual 3D de fixtures

Reemplaza `FixtureSprite25D`. Ahora es un cilindro sólido 3D posicionado a su Y real.

```typescript
interface FixtureBlockProps {
  fixture: FixtureV2
  isSelected: boolean
  isHovered: boolean
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (id: string | null) => void
  onDoubleClick: (id: string) => void
  showDropLines: boolean
}

const FixtureBlock: React.FC<FixtureBlockProps> = ({ ... }) => {
  const { x, y, z } = fixture.position
  const typeColor = FIXTURE_TYPE_COLOR[fixture.type] ?? '#6b7280'
  const color = isSelected ? '#22d3ee' : isHovered ? '#fbbf24' : typeColor
  const hasHeight = y > 0.1
  
  // Drop line geometry (fixture → floor)
  const dropLine = useMemo(() => {
    if (!hasHeight) return null
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x, 0, z)
    ])
    const mat = new THREE.LineBasicMaterial({
      color: typeColor, opacity: 0.45, transparent: true
    })
    return new THREE.Line(geo, mat)
  }, [x, y, z, hasHeight, typeColor])
  
  return (
    <group>
      {/* 🧱 WAVE 4538: Cylinder token at REAL Y position */}
      <mesh
        position={[x, y + 0.05, z]}  // +0.05 = half cylinder height
        onClick={(e) => { e.stopPropagation(); onSelect(fixture.id, e) }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(fixture.id) }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(fixture.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'default' }}
      >
        <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      
      {/* Selection ring at fixture height */}
      {(isSelected || isHovered) && (
        <mesh position={[x, y + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.20, 16]} />
          <meshBasicMaterial color={color} opacity={0.9} transparent />
        </mesh>
      )}
      
      {/* Label: name + height */}
      <Html position={[x + 0.3, y + 0.15, z]}
        zIndexRange={[0, 10]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="fixture-label-voxel">
          <span className="label-name">{fixture.name}</span>
          <span className="label-height">{y.toFixed(2)}m</span>
        </div>
      </Html>
      
      {/* Drop line + floor shadow */}
      {hasHeight && dropLine && showDropLines && (
        <>
          <primitive object={dropLine} />
          <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.12, 12]} />
            <meshBasicMaterial color={typeColor} opacity={0.25} transparent />
          </mesh>
        </>
      )}
    </group>
  )
}
```

**Diferencias clave vs FixtureSprite25D**:
- Posición Y es **real** (no forzada a floor en el render).
- Cilindro más pequeño (radio 0.12 vs 0.3) para caber en un voxel de 0.25.
- Label muestra altura con 2 decimales (precisión 0.25m).

### 5.6 `TransformGizmo` — Cambios

```typescript
// CAMBIO 1: Re-enable Y axis
<TransformControls
  showY={true}              // ← ANTES: false
  translationSnap={0.25}    // ← ANTES: 0.25 condicional (snapEnabled)
  // ... resto igual ...
/>

// CAMBIO 2: On drag end, snap + clamp to Crystal Box
const handleDraggingChanged = (event: { value: boolean }) => {
  onDraggingChanged(event.value)
  if (!event.value && objectRef.current) {
    const pos = objectRef.current.position
    const stage = useStageStore.getState().stage
    const clamped = clampToCrystalBox(
      { x: pos.x, y: pos.y, z: pos.z },
      stage ?? { width: 12, depth: 8, height: 6, gridSize: 0.25 }
    )
    onPositionChange(fixture.id, clamped, null)
  }
}
```

---

## 6. UI COMPONENTS

### 6.1 `DimensionSliders` — Extendido con Altura

```typescript
const DimensionSliders: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const updateStageDimensions = useStageStore(state => state.updateStageDimensions)
  
  const width = stage?.width ?? 12
  const depth = stage?.depth ?? 8
  const height = stage?.height ?? 6
  
  return (
    <div className="dimension-sliders">
      <div className="dim-row">
        <span className="dim-label">W</span>
        <input type="range" min="4" max="30" step="0.5"
          value={width}
          onChange={(e) => updateStageDimensions({ width: parseFloat(e.target.value) })}
        />
        <span className="dim-value">{width}m</span>
      </div>
      <div className="dim-row">
        <span className="dim-label">D</span>
        <input type="range" min="4" max="30" step="0.5"
          value={depth}
          onChange={(e) => updateStageDimensions({ depth: parseFloat(e.target.value) })}
        />
        <span className="dim-value">{depth}m</span>
      </div>
      {/* 🧱 WAVE 4538: Height slider (NEW) */}
      <div className="dim-row">
        <span className="dim-label dim-label-h">H</span>
        <input type="range" min="3" max="15" step="0.5"
          value={height}
          onChange={(e) => updateStageDimensions({ height: parseFloat(e.target.value) })}
        />
        <span className="dim-value">{height}m</span>
      </div>
    </div>
  )
}
```

### 6.2 `VoxelViewToggles` — Reemplaza VisualizationToggles + HeightLayerManager

Panel flotante bottom-right del viewport. Más simple que su predecesor (no hay capas que gestionar).

```typescript
const VoxelViewToggles: React.FC = () => {
  const {
    showDropLines, setShowDropLines,
    showCrystalBox, setShowCrystalBox,
    showFloorGrid, setShowFloorGrid,
    ghostCursorEnabled, setGhostCursorEnabled,
  } = useConstructorContext()
  
  return (
    <div className="voxel-toggles">
      <span className="vt-label">VIEW</span>
      <button className={`vt-btn ${showFloorGrid ? 'active' : ''}`}
        onClick={() => setShowFloorGrid(!showFloorGrid)}>
        <span className="vt-dot" style={{ background: '#1a1a2e' }} />
        Grid
      </button>
      <button className={`vt-btn ${showCrystalBox ? 'active' : ''}`}
        onClick={() => setShowCrystalBox(!showCrystalBox)}>
        <span className="vt-dot" style={{ background: '#22d3ee' }} />
        Box
      </button>
      <button className={`vt-btn ${showDropLines ? 'active' : ''}`}
        onClick={() => setShowDropLines(!showDropLines)}>
        <span className="vt-dot" style={{ background: '#fbbf24' }} />
        Lines
      </button>
      <button className={`vt-btn ${ghostCursorEnabled ? 'active' : ''}`}
        onClick={() => setGhostCursorEnabled(!ghostCursorEnabled)}>
        <span className="vt-dot" style={{ background: '#4ade80' }} />
        Ghost
      </button>
    </div>
  )
}
```

### 6.3 Context Menu — Adaptaciones

```
┌──────────────────────────────┐
│ 🗺️ ASIGNAR ZONA              │  ← MANTENER (de WAVE 4534)
│   → FRONT                    │
│   → BACK                     │
│   → CENTER                   │
│   → MOVERS-LEFT              │
│   → MOVERS-RIGHT             │
│   → FLOOR                    │
│   → AIR                      │
│──────────────────────────────│
│ 📐 Posición exacta...        │  ← MANTENER (abre OffsetPanel)
│ ✏️ Edit                      │
│ 🗑️ Delete                    │
│──────────────────────────────│
│ ❌ ELIMINADO: "MOVER A CAPA" │  ← El concepto de capas muere
└──────────────────────────────┘
```

### 6.4 OffsetPanel — Snap enforcement

Añadir snap a 0.25m en los inputs numéricos:

```typescript
// En OffsetPanel.apply():
const apply = () => {
  const snapped = snapPosition({ x, y, z })
  updateFixturePosition(fixtureId, snapped)
  onClose()
}

// En onChange de cada input:
onChange={(e) => {
  const raw = parseFloat(e.target.value) || 0
  set(snapToVoxel(raw))  // Snap inmediato al escribir
}}
```

**Step del input**: cambiar de `0.01` a `0.25` para que las flechas del input incrementen/decrementen en voxels enteros.

---

## 7. DROP & PLACEMENT (El flujo nuevo)

### 7.1 Flujo completo

```
1. Técnico arrastra fixture desde la library sidebar
2. Al entrar al canvas:
   a. GhostCursor se activa (isDragging = true)
   b. Raycaster intersecta floor plane → obtiene worldX, worldZ
   c. Ghost snap: position = snapPosition({x: worldX, y: 0, z: worldZ})
   d. Ghost cambia de color:
      - Cyan  → floor placement válido
      - Verde → stacking sobre fixture existente
      - Rojo  → fuera de Crystal Box
3. Si el mouse pasa sobre un FixtureBlock existente:
   a. Ghost salta a Y+0.25 del fixture (apila encima)
   b. Ghost se muestra en verde
4. Al soltar (mouse up):
   a. Si ghost.mode === 'invalid' → cancelar drop
   b. Si ghost.mode === 'floor' || 'stack' → crear fixture en ghost.position
5. El fixture se crea con position = ghost.position (ya snappeada)
6. Drop line aparece si Y > 0
7. Snap de TransformGizmo en 3 ejes permite reposicionar después
```

### 7.2 handleDrop — Integración con Ghost

```typescript
// ANTES (WAVE 4534):
const dropY = activeLayer?.height ?? 0
let fixtureData = { position: { x: worldX, y: dropY, z: worldZ }, layerId: activeLayer?.id }

// DESPUÉS (WAVE 4538):
const dropPos = ghostCursorRef.current?.position ?? snapPosition({ x: worldX, y: 0, z: worldZ })
let fixtureData = { position: dropPos }  // No hay layerId. Y viene del Ghost.
```

---

## 8. MIGRACIÓN DE SHOWFILE

### 8.1 Archivos antiguos con `heightLayers`

```typescript
// En _syncDerivedState:
// Los campos heightLayers en el showFile se IGNORAN (no se leen ni se escriben).
// El campo se mantiene en el archivo por backward compat — si el usuario vuelve
// a una versión antigua de LuxSync, las capas seguirán ahí.

// Fixtures con layerId: el campo se mantiene pero se ignora.
// Lo que importa es fixture.position.y (la verdad única).
```

### 8.2 Fixtures con posiciones no-snappeadas

```typescript
// En _syncDerivedState, al cargar:
for (const fixture of showFile.fixtures) {
  fixture.position = snapPosition(fixture.position)
}
// Esto convierte posiciones arbitrarias (ej: y=5.17) a snap 0.25 (y=5.25).
```

### 8.3 `gridSize` legacy

```typescript
// Si showFile.stage.gridSize !== 0.25, forzar:
if (showFile.stage) {
  showFile.stage.gridSize = 0.25
}
```

---

## 9. DECISIONES ARQUITECTÓNICAS

| # | Decisión | Alternativa rechazada | Razón |
|---|----------|----------------------|-------|
| D1 | **Voxel 0.25m³** como unidad base | 0.1m (demasiado fino), 0.5m (demasiado grueso) | 0.25m = ~1.8° de error a 8m. Compromiso entre precisión y usabilidad. Estándar de rigging. |
| D2 | **Eliminar HeightLayers** | Mantenerlas como "presets" | Indirection layer innecesaria. El técnico piensa en metros, no en capas. El Ghost Cursor + input directo es más rápido. |
| D3 | **Crystal Box wireframe** | Solo StageOutline 2D | La caja 3D da referencia visual de altura máxima. Desde cualquier ángulo se ve el límite. |
| D4 | **Ghost Cursor** para placement | Drop directo con cálculo de posición | El ghost da feedback visual ANTES del drop. El técnico sabe exactamente dónde caerá el fixture. |
| D5 | **Stacking** (Y+0.25 sobre fixture) | Solo floor placement | Permite construir "torres" de fixtures (strobe stacks, blinder arrays). UX natural tipo Minecraft. |
| D6 | **TransformGizmo showY=true** | Solo XZ movement + context menu Y | El técnico necesita mover fixtures en 3D directamente. El snap 0.25 en Y garantiza precisión. |
| D7 | **Snap forzado en store** (no solo UI) | Snap solo visual (TransformControls) | Si el store fuerza snap, es imposible tener coordenadas "sucias" incluso por bug o import. |
| D8 | **Mantener OrthographicCamera** | PerspectiveCamera | Ortho preserva proporciones reales. 1m en pantalla = 1m en mundo en todas las distancias. |
| D9 | **Mantener OrbitControls** (WAVE 4537) | Volver a MapControls | La vista isométrica rotable es fundamental para ver el volumen de las capas. |
| D10 | **`layerId` deprecated, no eliminado** | Borrar el campo | Backward compat. Archivos viejos no se rompen. |

---

## 10. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Ghost Cursor raycast falla con muchos fixtures | 🟡 Media | Usar bounding box simplificado (no mesh raycast). O limitar raycast a fixtures visibles. |
| Snap forzado causa "jumps" al arrastrar con gizmo | 🟢 Baja | `TransformControls.translationSnap = 0.25` ya suaviza el snap. |
| Moiré del grid 0.25m en zoom bajo | 🟡 Media | Auto-hide en zoom < 50 (ya implementado en GridFloor25D). |
| Stacking infinito (fixtures apilados hasta el infinito) | 🟢 Baja | `clampToCrystalBox()` limita Y al `stage.height`. Ghost se pone rojo si excede. |
| Archivos viejos con `layerId` cargan mal | 🟢 Baja | `layerId` se ignora en runtime. `position.y` es la verdad. Snap migration lo alinea. |
| OffsetPanel con step=0.25 es menos preciso que step=0.01 | 🟡 Media | Mantener step=0.01 en el input pero aplicar `snapToVoxel()` solo al confirmar. El técnico puede escribir 5.17 y se redondea a 5.25 al aplicar. |
| TransformGizmo con showY=true puede confundir si el técnico arrastra accidentalmente en Y | 🟡 Media | Añadir un toggle "Lock Y" que desactiva el eje Y temporalmente (futuro, no WAVE 4538). |

---

## 11. PLAN DE EJECUCIÓN (FASES)

### Fase 1 — DEMOLICIÓN (Store + Types)

| Paso | Descripción | Archivo | Complejidad |
|------|-------------|---------|-------------|
| **V1** | Añadir `snapToVoxel()`, `snapPosition()`, `clampToCrystalBox()`, `VOXEL_SIZE` a ShowFileV2.ts | `ShowFileV2.ts` | 🟢 Bajo |
| **V2** | Cambiar `gridSize` default a `0.25` en `createEmptyShowFile()` | `ShowFileV2.ts` | 🟢 Trivial |
| **V3** | Deprecar `HeightLayer` y `DEFAULT_HEIGHT_LAYERS` (JSDoc @deprecated, no borrar) | `ShowFileV2.ts` | 🟢 Trivial |
| **V4** | Eliminar `heightLayers`, `activeLayerId` del `StageStoreState` | `stageStore.ts` | 🟡 Medio |
| **V5** | Eliminar todas las layer actions + selectors del store | `stageStore.ts` | 🟡 Medio |
| **V6** | Modificar `updateFixturePosition()` para forzar `clampToCrystalBox()` | `stageStore.ts` | 🟢 Bajo |
| **V7** | Modificar `_syncDerivedState()`: eliminar migración de layers, añadir snap migration | `stageStore.ts` | 🟡 Medio |

### Fase 2 — CONTEXTO + UI CONTROLS

| Paso | Descripción | Archivo | Complejidad |
|------|-------------|---------|-------------|
| **V8** | Eliminar `activeLayerId`, `showVolumetricGrid` del `ConstructorContext` | `StageConstructorView.tsx` | 🟡 Medio |
| **V9** | Añadir `showCrystalBox`, `showFloorGrid`, `ghostCursorEnabled` al `ConstructorContext` | `StageConstructorView.tsx` | 🟢 Bajo |
| **V10** | Eliminar `HeightLayerManager` component + CSS | `StageConstructorView.tsx` | 🟢 Bajo |
| **V11** | Reemplazar `VisualizationToggles` por `VoxelViewToggles` | `StageConstructorView.tsx` | 🟢 Bajo |
| **V12** | Extender `DimensionSliders` con slider H (height) | `StageConstructorView.tsx` | 🟢 Bajo |
| **V13** | Cambiar `snapDistance` default de `0.5` a `0.25` | `StageConstructorView.tsx` | 🟢 Trivial |

### Fase 3 — COMPONENTES R3F (El Canvas)

| Paso | Descripción | Archivo | Complejidad |
|------|-------------|---------|-------------|
| **V14** | Reemplazar `GridFloor25D` por `VoxelFloorGrid` | `StageGrid3D.tsx` | 🟢 Bajo |
| **V15** | Reemplazar `StageOutline` por `CrystalBox` (wireframe 3D) | `StageGrid3D.tsx` | 🟢 Bajo |
| **V16** | Reemplazar `CoordinateRulers` por `CrystalBoxRulers` (3 ejes) | `StageGrid3D.tsx` | 🟡 Medio |
| **V17** | Eliminar `VolumetricGrid` component | `StageGrid3D.tsx` | 🟢 Trivial |
| **V18** | Reemplazar `FixtureSprite25D` por `FixtureBlock` (Y real) | `StageGrid3D.tsx` | 🟡 Medio |
| **V19** | Modificar `TransformGizmo`: `showY={true}`, snap=0.25, clamp to Crystal Box | `StageGrid3D.tsx` | 🟢 Bajo |

### Fase 4 — GHOST CURSOR + DROP INTEGRATION

| Paso | Descripción | Archivo | Complejidad |
|------|-------------|---------|-------------|
| **V20** | Crear `GhostCursor` component (raycasting + snap + stacking) | `StageGrid3D.tsx` | 🔴 Alto |
| **V21** | Modificar `handleDrop` / `handleFixtureDrop`: usar ghost position, eliminar layer logic | `StageGrid3D.tsx` | 🟡 Medio |
| **V22** | Pasar ghost state al drop handlers (ref o callback) | `StageGrid3D.tsx` | 🟡 Medio |

### Fase 5 — CLEANUP

| Paso | Descripción | Archivo | Complejidad |
|------|-------------|---------|-------------|
| **V23** | Eliminar "MOVER A CAPA" del ContextMenu | `StageGrid3D.tsx` | 🟢 Trivial |
| **V24** | Actualizar `OffsetPanel`: step=0.25, snap on apply | `StageGrid3D.tsx` | 🟢 Bajo |
| **V25** | Limpiar imports no usados (HeightLayer, DEFAULT_HEIGHT_LAYERS del store) | Todos | 🟢 Bajo |
| **V26** | TypeScript check: `TS_EXIT=0` | Todos | 🟡 Medio |

### Orden sugerido

```
Fase 1 — DEMOLICIÓN:       V1 → V2 → V3 → V4 → V5 → V6 → V7
Fase 2 — CONTEXTO + UI:    V8 → V9 → V10 → V11 → V12 → V13
Fase 3 — CANVAS:           V14 → V15 → V16 → V17 → V18 → V19
Fase 4 — GHOST + DROP:     V20 → V21 → V22
Fase 5 — CLEANUP:          V23 → V24 → V25 → V26
```

**Estimación**: ~5 sesiones de Ejecutor (Sonnet). Fase 1+2 en una sesión, Fase 3 en una, Fase 4 en una o dos (Ghost es complejo), Fase 5 en una.

---

## 12. EXTENSIONES FUTURAS (NO IMPLEMENTAR EN WAVE 4538)

| Feature | Descripción |
|---------|-------------|
| **Lock Y toggle** | Botón que desactiva temporalmente el eje Y del TransformGizmo para edición planar. |
| **Multi-voxel fixtures** | Fixtures que ocupan más de 1 voxel (ej: bar = 4 voxels en fila). |
| **Truss rendering** | Líneas de truss entre fixtures a la misma Y que están alineados en X o Z. |
| **Copy/Paste position** | `Ctrl+C` copia posición de fixture seleccionado, `Ctrl+V` aplica a otro. |
| **Mirror tool** | Duplicar fixtures simétricos respecto al eje X=0 (L/R mirror). |
| **Keyboard nudge** | Arrow keys mueven fixture seleccionado ±0.25m en XZ. `Shift+Arrow` mueve en Y. |
| **Voxel heat map** | Colorear voxels según densidad de cobertura de beam (análisis de iluminación). |
| **Ghost preview stacking on ALL faces** | Stacking lateral (no solo top/bottom) cuando hay varios fixtures adyacentes. |

---

*Documento generado bajo directiva WAVE 4538 — THE VOXEL PIVOT*
*Blueprint completado. Sin código escrito. Listo para aprobación del Cónclave.*
