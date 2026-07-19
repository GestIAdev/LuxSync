# WAVE 7178 — Auditoría del Pipeline Espacial, IK y Flujo 2D/2.5D → 3D

**Fecha:** 2026-07-19  
**Naturaleza:** Solo lectura y mapeo. Cero modificaciones de código.

---

## 1. Motor Espacial e IK — Arquitectura Matemática

### 1.1 Archivo núcleo

`@/electron-app/src/engine/movement/InverseKinematicsEngine.ts`

Motor **puro y determinista** — sin dependencias de React, Electron, IPC ni DOM. Mismo input → mismo output.

### 1.2 Sistema de coordenadas (ShowFileV2)

```
X: Left(-) ← → Right(+)   (perspectiva audiencia)
Y: Down(-)  ↕  Up(+)       0 = suelo
Z: Back(-)  ↔  Front(+)    0 = centro escenario
Unidad: metros
```

### 1.3 Interfaces TypeScript gobernantes

```typescript
// Target 3D — punto en el espacio donde el operador apunta
export interface Target3D {
  x: number  // metros
  y: number  // metros
  z: number  // metros
}

// Orientación de montaje combinada
export interface FixtureOrientation {
  installation: InstallationOrientation  // 'ceiling' | 'floor' | 'totem' | 'truss-front' | 'truss-back' | 'wall-left' | 'wall-right'
  rotation: Rotation3D  // rotación personalizada adicional
}

// Límites mecánicos físicos
export interface MechanicalLimits {
  panRangeDeg: number   // típico: 540
  tiltRangeDeg: number  // típico: 270
  tiltLimits?: { min: number; max: number }  // DMX 0-255
}

// Calibración mecánica
export interface FixtureCalibration {
  panOffset: number    // grados
  tiltOffset: number   // grados
  panInvert: boolean
  tiltInvert: boolean
}

// Perfil completo que el IK necesita
export interface IKFixtureProfile {
  id: string
  position: Position3D
  orientation: FixtureOrientation
  limits: MechanicalLimits
  calibration: FixtureCalibration
}

// Resultado del cálculo IK
export interface IKResult {
  pan: number           // DMX 0-255 (calibración aplicada)
  tilt: number          // DMX 0-255 (calibración aplicada)
  reachable: boolean
  antiFlipApplied: boolean
}

// Fan espacial
export type SpatialFanMode = 'converge' | 'line' | 'circle'

export interface IKFanResult extends IKResult {
  subTarget: Target3D  // sub-target calculado por fixture
}
```

### 1.4 Lógica matemática del solver (`solveInto`)

El pipeline matemático paso a paso:

1. **Delta posicional**: `dx = target.x - fixture.position.x` (ídem dy, dz)
2. **Rotación al frame local**: `rotateToLocalFrame(dx, dy, dz, totalPitchRad, totalYawRad, totalRollRad)` — combina `MOUNT_ANGLES[orientation]` + `fixture.orientation.rotation`
3. **Distancia horizontal**: `horizontalDist = sqrt(local.x² + local.z²)`
4. **Deflector anti-gimbal-lock**: Si `horizontalDist < 0.05m` (GIMBAL_LOCK_EPSILON), empuja `local.z -= 0.05` para evitar singularidad
5. **Pan**: `panDeg = atan2(local.x, -local.z) * RAD_TO_DEG`
6. **Tilt**: `tiltDeg = atan2(horizontalDist, -local.y) * RAD_TO_DEG`
7. **Calibración**: `calibratedPanDeg = panDeg + panOffset`, `calibratedTiltDeg = tiltDeg + tiltOffset`
8. **Conversión a DMX**: `panDMX = ((calibratedPanDeg + panRange/2) / panRange) * 255`
9. **Anti-flip shortest-path**: Si `currentPanDMX !== null`, resuelve camino más corto en el rango de 540°
10. **Inversión de ejes**: `panInvert ? (255 - panDMX) : panDMX`
11. **Safety clamp**: `panDMX = clamp(5, 250, panDMX)`, tiltLimits aplicados
12. **Redondeo final**: `Math.round()` a byte DMX

### 1.5 Tabla de ángulos de montaje (MOUNT_ANGLES)

| Orientation | Pitch | Yaw | Roll | Notas |
|---|---|---|---|---|
| `floor` | 0 | 0 | 0 | Identidad — local = dx, dy, dz |
| `totem` | 0 | 0 | 0 | Igual que floor |
| `ceiling` | 0 | 0 | 0 | Identidad — WAVE 4899 convergence |
| `truss-front` | 0 | 0 | 0 | Igual que ceiling |
| `truss-back` | 0 | 180 | 0 | Voltea frente↔espalda |
| `wall-left` | 0 | 90 | 0 | Solo yaw |
| `wall-right` | 0 | -90 | 0 | Solo yaw |

### 1.6 Fanning espacial

- **`computeLineFanOffsets`**: Distribuye fixtures equidistantes en línea perpendicular al vector centroide→target en plano XZ. Amplitud = metros punta-a-punta.
- **`computeCircleFanOffsets`**: Distribuye fixtures en circunferencia de radio `amplitude/2` alrededor del target. Ángulo inicial = 12h (Z-), sentido horario.
- **`solveGroupWithFan`**: Resuelve cada fixture con su sub-target. Modos: converge (sin offsets), line, circle.

---

## 2. Flujo de Datos del Constructor (2D / 2.5D → 3D)

### 2.1 Arquitectura de vistas

`@/electron-app/src/components/views/StageConstructorView.tsx`

El `StageConstructorView` es el contenedor principal. Toggle 3D/2D en toolbar:

```
viewMode === '3d' → <StageGrid3D />   (WebGL/R3F, TransformControls gizmo)
viewMode === '2d' → <StageCanvas2D /> (SVG puro, drag & drop HTML5)
```

### 2.2 Canvas 2D — Drag & Drop → Coordenadas

`@/electron-app/src/components/views/StageConstructor/StageCanvas2D.tsx`

**Conversión de coordenadas SVG ↔ metros:**

```typescript
// SVG → metros
const fromSVG = (px, py): [number, number] => {
  const xm = ((px - MARGIN) / stageW) * stageWidth - stageWidth / 2
  const zm = ((py - MARGIN) / stageH) * stageDepth - stageDepth / 2
  return [clamp(-W/2, W/2, xm), clamp(-D/2, D/2, zm)]
}

// Metros → SVG
const toSVG = (xm, zm): [number, number] => {
  const px = MARGIN + ((xm + stageWidth/2) / stageWidth) * stageW
  const py = MARGIN + ((zm + stageDepth/2) / stageDepth) * stageH
  return [px, py]
}
```

**Inferencia de Y desde orientación:**

```typescript
const ORIENTATION_HEIGHT: Record<InstallationOrientation, number> = {
  'ceiling':     4.0,
  'totem':       1.5,
  'truss-front': 3.5,
  'truss-back':  3.5,
  'wall-left':   2.5,
  'wall-right':  2.5,
  'floor':       0.1,
}
```

**Flujo de drop en 2D:**

1. Usuario arrastra fixture desde library (HTML5 DnD) o desde UnplacedTray
2. `onDrop` calcula posición en metros via `fromSVG(px, py)`
3. Y se infiere desde `ORIENTATION_HEIGHT[orientation]` (siempre `ceiling` para drops nuevos en 2D)
4. Zona se infiere desde posición fraccional via `inferZone(xFrac, zFrac)`
5. **CRÍTICO**: `isPlaced: false` — el fixture queda en universo "unplaced" (pan-tilt clásico, sin IK)
6. `updateFixture(id, { position: { x, y, z }, isPlaced: false })` → `stageStore`

### 2.3 Canvas 3D — Drag & Drop → Coordenadas

`@/electron-app/src/components/views/StageConstructor/StageGrid3D.tsx`

**Flujo de drop en 3D:**

1. Usuario arrastra fixture desde library
2. Raycast contra plano Y=0 del escenario 3D
3. `handleFixtureDrop(type, position, libraryId)`:
   - Posición: `{ ...position, y: 0 }` — siempre cae al suelo
   - Orientación: `'floor'` por defecto (Y=0 → floor)
   - **CRÍTICO**: `isPlaced: true` — el fixture queda en universo "placed" (IK espacial activo)
4. `addFixture(newFixture)` → `stageStore`
5. Usuario eleva con TransformControls gizmo (showY=true, translationSnap=0.25m)
6. En drag end: `clampToCrystalBox(rawPos, stage)` → `onPositionChange(fixture.id, finalPos)`

### 2.4 stageStore — Fuente de verdad posicional

`@/electron-app/src/stores/stageStore.ts`

```typescript
// Acciones relevantes
updateFixture(id, updates)           // merge parcial
updateFixturePosition(id, position)  // snap + clamp al Crystal Box
updateFixtureRotation(id, rotation)  // rotación base del fixture
```

**`isPlaced` es el flag binario que separa dos universos:**
- `isPlaced: true` → Fixture posicionado en 3D, IK espacial activo, visualizador usa posición authored
- `isPlaced: false` → Fixture en 2D/guerrilla, pan-tilt clásico, visualizador usa zone-layout fallback

### 2.5 Tipos TypeScript del modelo de stage

`@/electron-app/src/core/stage/ShowFileV2.ts`

```typescript
export interface Position3D {
  x: number  // metros
  y: number  // metros
  z: number  // metros
}

export interface Rotation3D {
  pitch: number  // grados, -90 a +90
  yaw: number    // grados, 0-360
  roll: number   // grados, -180 a +180
}

export type InstallationOrientation =
  | 'ceiling' | 'floor' | 'totem'
  | 'wall-left' | 'wall-right'
  | 'truss-front' | 'truss-back'

export interface StageDimensions {
  width: number   // metros
  depth: number   // metros
  height: number  // metros
  gridSize: number
}

export interface FixtureV2 {
  id: string
  // ... nombre, dirección, tipo, canales ...
  position: Position3D
  rotation?: Rotation3D
  orientation: InstallationOrientation  // WAVE 4573: root-level
  isPlaced?: boolean                     // WAVE 4573: guerrilla flag
  physics: PhysicsProfile
  zone: FixtureZone
  calibration?: {
    panOffset: number
    tiltOffset: number
    panInvert: boolean
    tiltInvert: boolean
  }
  panRangeDeg?: number
  tiltRangeDeg?: number
  // ...
}
```

---

## 3. Pipeline Completo: UI → IK → DMX

### 3.1 Ruta espacial (IK)

```
SpatialTargetPad (UI SVG)
  ↓ onChange(Target3D { x, y, z })
KineticsBridge._flushSpatial()
  ↓ Lee posiciones reales desde stageStore (useStageStore.getState().fixtures)
  ↓ Empaqueta fixturePositions + fixtureIKProfiles por fixture
  ↓ window.lux.aether.applySpatialTarget({ target, fixtureIds, fanMode, fanAmplitude, fixturePositions, fixtureIKProfiles })
AetherIPCHandlers (main process)
  ↓ buildProfile(id, position, rotation, installation, calibration, panRangeDeg, tiltRangeDeg, tiltLimits)
  ↓ Pre-computa Spatial Distance Scale (D_REF=8m / distancia)
  ↓ solveGroupWithFan(profiles, target, fanMode, fanAmplitude, currentPanDMXMap)
InverseKinematicsEngine.solveInto()
  → pan DMX 0-255, tilt DMX 0-255, reachable, antiFlipApplied
  ↓
AetherIPCHandlers → arbiter.setMotorKineticOverride(nodeId, { pan_base, tilt_base })
  ↓
NodeArbiter._applyRelativeOffsetFusion()
  → final = clamp01(base + offset * amp * aspect * distScale)
  ↓
NodeResolver._writeNodeIK()
  → solveInto() (re-solve con target del arbiter)
  → clampKineticVelocity + applyAirbag (AetherSafetyMiddleware)
  → buf[bufIdx] = panDMX / tiltDMX
  ↓
HardwareAbstraction → DMX físico
```

### 3.2 Ruta clásica (pan/tilt directo, sin IK)

```
RadarXY / Programmer sliders
  ↓ pan/tilt normalizado 0-1
KineticsBridge._flushClassic()
  ↓ window.lux.aether.applyClassicPanTilt()
AetherIPCHandlers → arbiter.setManualOverride(nodeId, { pan, tilt })
  ↓
NodeArbiter._applyIntent('manual')
  ↓
NodeResolver._writeNode() → CLASSIC PATH
  → TransferCurve + Calibration + invertClassicKineticAxes
  → clampKineticVelocity + applyAirbag
  → buf[bufIdx] = dmxValue
  ↓
HardwareAbstraction → DMX físico
```

### 3.3 Ruta del visualizador 3D (feedback loop)

```
transientStore (mutable ref, 30fps via IPC)
  ↓ getTransientFixture(fixtureId) — O(1) via Map index
HyperionMovingHead3D.useFrame()
  → Lee physicalPan, physicalTilt, dimmer, color, zoom
  → Exponential smoothing (VISUAL_SMOOTH=0.35)
  → panAngle = -(smoothPan - 0.5) * mechanicalPanRangeRad
  → tiltAngle = -(visualTilt - 0.5) * mechanicalTiltRangeRad
  → yokeQuat = setFromAxisAngle(Y_AXIS, panAngle)
  → headQuat = setFromAxisAngle(X_AXIS, tiltAngle)
  → baseQuat = MOUNT_QUATERNIONS[orientation] * offsetQuat(rotation)
  → Render: group.quaternion = baseQuat, yoke.quaternion = yokeQuat, head.quaternion = headQuat
```

---

## 4. Detección de Fricciones Estructurales

### 4.1 Fricción CRÍTICA — `isPlaced` como separador de universos

| Problema | Detalle |
|---|---|
| **Bifurcación 2D/3D** | El canvas 2D siempre setea `isPlaced: false`. El 3D siempre setea `isPlaced: true`. No hay transición fluida: un fixture colocado en 2D no tiene IK; uno colocado en 3D no puede usar radar clásico sin perder posicionamiento. |
| **Y inferida en 2D** | El canvas 2D infiere Y desde `ORIENTATION_HEIGHT` (ceiling=4m). Pero el operador no puede ajustar Y visualmente en 2D — solo X/Z. Si el fixture está a 3.2m reales, el IK calcula con Y=4.0m → error de 0.8m en tilt. |
| **Sin calibración visual** | El 2D no muestra la orientación del haz. El operador ve un triángulo pero no sabe hacia dónde apunta el fixture hasta que cambia al 3D. |

### 4.2 Fricción ALTA — Doble cálculo IK

| Problema | Detalle |
|---|---|
| **IK se calcula dos veces** | `AetherIPCHandlers.applySpatialTarget` llama `solveGroupWithFan()` → produce pan/tilt DMX → normaliza a 0-1 → `setMotorKineticOverride`. Luego `NodeResolver._writeNodeIK()` vuelve a llamar `solveInto()` con el target del arbiter. El primer cálculo es redundante — solo sirve para alimentar `currentPanDMX` al anti-flip. |
| **Perfil IK reconstruido** | `_getOrBuildIKProfile` en NodeResolver reconstruye el perfil desde el nodo cinético. Si los datos del fixture cambian entre el IPC y el resolve, el perfil puede ser diferente. |

### 4.3 Fricción ALTA — Desconexión de conciencia espacial 2D ↔ 3D

| Problema | Detalle |
|---|---|
| **2D no alimenta IK** | El canvas 2D setea `isPlaced: false`. El IK solo opera sobre fixtures con `isPlaced: true`. Un fixture colocado en 2D con posición {x:2, y:4, z:-3} tiene coordenadas 3D válidas pero el IK lo ignora. |
| **3D no muestra zonas canónicas** | El 3D usa `ZONE_LAYOUT_3D` para fixtures unplaced, pero los fixtures placed se posicionan por coordenadas authored. Las zonas del 2D (movers-left, back, front, etc.) no se visualizan en 3D de forma explícita. |
| **Crystal Box no existe en 2D** | El 2D clampea al stage border SVG. El 3D clampea via `clampToCrystalBox`. Si el stage tiene height=6m pero el 2D infiere Y=4m para ceiling, el clamp de Y no se aplica en 2D. |

### 4.4 Fricción MEDIA — Inversión de ejes visual vs hardware

| Problema | Detalle |
|---|---|
| **Tilt invertido en visualizador** | `HyperionMovingHead3D` aplica `visualTilt = isCeilingVisual ? (1 - smoothTilt) : smoothTilt` para ceiling/truss. El `NodeResolver` aplica `invertClassicKineticAxes` para floor/wall. La inversión ocurre en capas diferentes — visualizador invierte en espacio normalizado, resolver invierte en espacio DMX. |
| **Pan invertido en visualizador** | `panAngle = -(smoothPan - 0.5) * mechanicalPanRangeRad` — el negativo alinea con IK para ceiling. Pero el `NodeResolver` ruta clásica NO invierte pan para ceiling (solo tilt). Esto puede causar que el visualizador muestre pan opuesto al hardware en ruta clásica. |

### 4.5 Fricción MEDIA — MOUNT_ANGLES vs MOUNT_QUATERNIONS

| Problema | Detalle |
|---|---|
| **Dos fuentes de verdad para orientación** | `InverseKinematicsEngine.MOUNT_ANGLES` usa `{ pitch, yaw, roll }` en grados. `mountQuaternion.ts MOUNT_QUATERNIONS` usa cuaterniones Three.js. Ambos representan lo mismo matemáticamente pero son tablas separadas. Si una se actualiza y la otra no, el IK y el visualizador divergen silenciosamente. |
| **totem divergente** | `MOUNT_ANGLES['totem'] = { pitch: 0, yaw: 0, roll: 0 }` (identidad). `MOUNT_QUATERNIONS['totem'] = floor` (R_X(π)). El IK trata totem como floor (identidad), pero el visualizador lo trata como floor invertido. **BUG confirmado**: totem en IK no tiene rotación, pero en visualizador apunta hacia arriba. |

### 4.6 Fricción BAJA — SpatialTargetPad sin feedback 3D

| Problema | Detalle |
|---|---|
| **Target pad es SVG top-down** | El `SpatialTargetPad` muestra el escenario desde arriba con rayos SVG a fixtures. No hay visualización del target en el visor 3D principal (`VisualizerCanvas`). El operador debe cambiar mentalmente entre la vista top-down del pad y la vista 3D del visualizador. |
| **Sub-targets del fan no se dibujan en 3D** | Los `subTargets` del fan (line/circle) solo se renderizan en el SVG del pad. El visor 3D no muestra los puntos de convergencia. |

---

## 5. Inventario de Archivos Implicados

### 5.1 Motor IK y geometría

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/engine/movement/InverseKinematicsEngine.ts` | Solver IK puro | `solveInto()` L223-302, `MOUNT_ANGLES` L171-179, `solveGroupWithFan()` L447-497 |
| `@/electron-app/src/engine/movement/FixturePhysicsDriver.ts` | Física de inercia (ruta clásica) | `translateDMX()` L373-522, `translate()` L525-569 |
| `@/electron-app/src/components/hyperion/views/visualizer/utils/mountQuaternion.ts` | Cuaterniones de montaje para 3D | `MOUNT_QUATERNIONS` L38-66 |

### 5.2 Constructor de escenario

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/components/views/StageConstructorView.tsx` | Shell del constructor, toggle 2D/3D | L636-808 |
| `@/electron-app/src/components/views/StageConstructor/StageCanvas2D.tsx` | Canvas 2D SVG, drag & drop | `fromSVG` L194, `onDrop` L291-394, `ORIENTATION_HEIGHT` L22-30 |
| `@/electron-app/src/components/views/StageConstructor/StageGrid3D.tsx` | Canvas 3D R3F, TransformControls | `handleFixtureDrop` L1599-1668, drag end L517-531 |
| `@/electron-app/src/components/views/StageConstructor/StageConstructorContext.ts` | Context compartido (snap, tool mode, viewMode) | L4-39 |

### 5.3 Stores y estado

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/stores/stageStore.ts` | Fuente de verdad de fixtures y stage | `updateFixturePosition` L661-666, `clampToCrystalBox` |
| `@/electron-app/src/stores/movementStore.ts` | Estado del modo espacial/clásico | `spatialTarget`, `spatialFanMode`, `radarModeOverride` L47-86 |
| `@/electron-app/src/stores/transientStore.ts` | Estado dinámico 30fps para visualizador | `getTransientFixture()` L303-314 |

### 5.4 Pipeline espacial (UI → backend → DMX)

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/components/hyperion/controls/controls/SpatialTargetPad.tsx` | UI del target pad SVG | Props L42-88, target draggable |
| `@/electron-app/src/bridges/KineticsBridge.ts` | Bridge UI → IPC spatial | `_flushSpatial()` L668-756, lee stageStore para posiciones |
| `@/electron-app/src/core/aether/AetherIPCHandlers.ts` | Handler IPC, construye perfiles IK | `buildProfile()` L1030-1044, `solveGroupWithFan()` L1081-1087 |
| `@/electron-app/src/core/aether/NodeArbiter.ts` | Arbitraje L0/L2/L3, relative offset fusion | `setMotorKineticOverride()` L475, `_applyRelativeOffsetFusion()` L874-970 |
| `@/electron-app/src/core/aether/resolver/NodeResolver.ts` | Resuelve nodos a DMX buffer | `_writeNodeIK()` L1421-1512, `_writeNode()` classic L963-1298 |

### 5.5 Visualizador 3D

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx` | Render moving head 3D | `useFrame()` L201-349, baseQuat L168-181, pan/tilt → quaternion L303-309 |
| `@/electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts` | Hook: stageStore → Fixture3DData | Posición authored vs zone-layout L188-209, `resolveMechanicalRanges` L84-103 |
| `@/electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx` | Canvas R3F principal | Render movingHeads/pars/strobes L300-335 |
| `@/electron-app/src/components/hyperion/views/visualizer/types.ts` | Tipo `Fixture3DData` | — |

### 5.6 Modelo de datos

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/core/stage/ShowFileV2.ts` | Schema completo de show | `Position3D` L243, `Rotation3D` L256, `FixtureV2` L618, `InstallationOrientation` L112-119, `StageDimensions` L922, `clampToCrystalBox` L77-88 |

### 5.7 Seguridad cinemática

| Archivo | Rol | Líneas clave |
|---|---|---|
| `@/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts` | Velocity clamp, airbag, dark spin | `clampKineticVelocityInto()` L178-217, `VIBE_REV_LIMITS` |

---

## 6. Resumen de Fricciones para Blueprint de Autocalibrado

| # | Severidad | Fricción | Archivos afectados | Acción sugerida |
|---|---|---|---|---|
| F1 | CRÍTICA | `isPlaced` bifurca universos 2D/3D sin puente | `StageCanvas2D.tsx`, `StageGrid3D.tsx`, `useFixture3DData.ts` | Unificar: 2D debe poder activar IK, 3D debe poder usar radar clásico |
| F2 | CRÍTICA | Y inferida en 2D sin ajuste visual | `StageCanvas2D.tsx` (ORIENTATION_HEIGHT) | Slider de Y en 2D o proyección 2.5D con altura editable |
| F3 | ALTA | IK se calcula dos veces (IPC + resolver) | `AetherIPCHandlers.ts`, `NodeResolver._writeNodeIK` | Cachear resultado IK del IPC o eliminar re-solve en resolver |
| F4 | ALTA | 2D no alimenta IK (isPlaced=false) | `StageCanvas2D.tsx`, `KineticsBridge._flushSpatial` | Permitir IK para fixtures 2D con posición válida |
| F5 | ALTA | Crystal Box no se aplica en 2D | `StageCanvas2D.tsx` | Clamp Y al height del stage en canvas 2D |
| F6 | MEDIA | Inversión de ejes en capas diferentes | `HyperionMovingHead3D.tsx`, `NodeResolver._writeNode` | Unificar inversión en una sola capa (preferible: resolver) |
| F7 | MEDIA | MOUNT_ANGLES vs MOUNT_QUATERNIONS — fuentes duales | `InverseKinematicsEngine.ts`, `mountQuaternion.ts` | Fusionar en una sola fuente de verdad |
| F8 | MEDIA | `totem` divergente entre IK y visualizador | `InverseKinematicsEngine.MOUNT_ANGLES`, `mountQuaternion.MOUNT_QUATERNIONS` | Corregir totem: IK debe usar pitch=π (igual que floor invertido) |
| F9 | BAJA | SpatialTargetPad sin visualización en 3D | `SpatialTargetPad.tsx`, `VisualizerCanvas.tsx` | Marker 3D del target en VisualizerCanvas |
| F10 | BAJA | Sub-targets del fan no visibles en 3D | `SpatialTargetPad.tsx`, `VisualizerCanvas.tsx` | Markers 3D para sub-targets line/circle |

---

## 7. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONSTRUCTOR (Stage Setup)                     │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐    │
│  │  Canvas 2D   │     │  Canvas 3D   │     │  Fixture Library │    │
│  │  (SVG)       │     │  (R3F/WebGL) │     │  (DnD source)    │    │
│  │              │     │              │     │                  │    │
│  │ X/Z drag     │     │ XYZ gizmo    │     │ fixture-type     │    │
│  │ Y inferred   │     │ Y=0 drop     │     │ library-id       │    │
│  │ isPlaced=F   │     │ isPlaced=T   │     │                  │    │
│  └──────┬───────┘     └──────┬───────┘     └────────┬─────────┘    │
│         │                     │                      │              │
│         ▼                     ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                    stageStore (Zustand)                  │       │
│  │  fixtures: FixtureV2[] { position, rotation, orientation,│       │
│  │    isPlaced, calibration, panRangeDeg, tiltRangeDeg }   │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RUNTIME (Live Control)                            │
│                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐      │
│  │ SpatialPad  │     │  Radar XY   │     │  Selene L3 /     │      │
│  │ (SVG top)   │     │  (sliders)  │     │  Effect Engine   │      │
│  │ Target3D    │     │  pan/tilt   │     │  INodeIntent[]   │      │
│  └──────┬──────┘     └──────┬──────┘     └────────┬─────────┘      │
│         │                   │                      │                │
│         ▼                   ▼                      ▼                │
│  ┌───────────┐     ┌─────────────┐     ┌──────────────────┐       │
│  │KineticsBr │     │KineticsBr   │     │  NodeArbiter     │       │
│  │._flush    │     │._flush      │     │  .arbitrate()    │       │
│  │Spatial()  │     │Classic()    │     │  L0+L2+L3 merge  │       │
│  └─────┬─────┘     └──────┬──────┘     └────────┬─────────┘       │
│        │                  │                      │                 │
│        ▼                  ▼                      │                 │
│  ┌──────────────────────────────────┐            │                 │
│  │  AetherIPCHandlers               │            │                 │
│  │  .applySpatialTarget()           │            │                 │
│  │  → buildProfile() per fixture    │            │                 │
│  │  → solveGroupWithFan()           │            │                 │
│  │  → setMotorKineticOverride()     │────────────┘                 │
│  └──────────────────────────────────┘                              │
│                                    │                                │
│                                    ▼                                │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  NodeArbiter._applyRelativeOffsetFusion()                │      │
│  │  final = clamp01(base + offset * amp * aspect * distScale)│      │
│  └──────────────────────────────────────────────────────────┘      │
│                                    │                                │
│                                    ▼                                │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  NodeResolver.resolve()                                  │      │
│  │  ├─ _writeNodeIK()  if targetX present + !isContinuous   │      │
│  │  │  → solveInto() → clampVelocity → airbag → buf[DMX]   │      │
│  │  └─ _writeNode()    classic path                         │      │
│  │     → TransferCurve → Calibration → invert → buf[DMX]   │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                    │                                │
│                                    ▼                                │
│  ┌──────────────────┐     ┌──────────────────┐                   │
│  │  AetherSafety    │     │  HAL / DMX       │                   │
│  │  Middleware      │────▶│  Uint8Array      │                   │
│  │  (clamp/airbag)  │     │  → Hardware      │                   │
│  └──────────────────┘     └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VISUALIZADOR 3D (Feedback)                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  transientStore (mutable ref, 30fps IPC)                │       │
│  │  → getTransientFixture(id) → { pan, tilt, dimmer, ... } │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                    │                                │
│                                    ▼                                │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  useFixture3DData()                                      │       │
│  │  stageStore + transientStore → Fixture3DData[]           │       │
│  │  isPlaced=true → posición authored                       │       │
│  │  isPlaced=false → zone-layout fallback (UNPLACED_SENTINEL_Y)│   │
│  └─────────────────────────────────────────────────────────┘       │
│                                    │                                │
│                                    ▼                                │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  HyperionMovingHead3D.useFrame()                         │       │
│  │  baseQuat = MOUNT_QUATERNIONS[orientation] * offsetQ     │       │
│  │  panAngle = -(smoothPan - 0.5) * panRangeRad             │       │
│  │  tiltAngle = -(visualTilt - 0.5) * tiltRangeRad          │       │
│  │  yokeQuat = setFromAxisAngle(Y, panAngle)                │       │
│  │  headQuat = setFromAxisAngle(X, tiltAngle)               │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Conclusión para Blueprint de Autocalibrado

El ecosistema espacial actual tiene **dos motores matemáticos separados** (IK engine + mountQuaternion) que comparten la misma intención geométrica pero no la misma fuente de verdad. El flujo 2D→3D está mediado por el flag binario `isPlaced` que crea un abismo entre los dos universos de control. El pipeline IK→DMX hace un doble cálculo redundante. Y el visualizador 3D invierte ejes en una capa diferente al resolver de hardware.

Para un blueprint de autocalibrado, los puntos de reescritura prioritarios son:

1. **Unificar MOUNT_ANGLES y MOUNT_QUATERNIONS** en una sola tabla (F7, F8)
2. **Eliminar el doble cálculo IK** entre AetherIPCHandlers y NodeResolver (F3)
3. **Crear puente 2D↔3D** que permita IK desde 2D y radar clásico desde 3D (F1, F4)
4. **Unificar inversión de ejes** en una sola capa (F6)
5. **Visualización del target 3D** en el visor principal (F9, F10)
