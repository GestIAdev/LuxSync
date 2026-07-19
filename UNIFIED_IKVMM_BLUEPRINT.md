# UNIFIED IK/VMM BLUEPRINT — Autocalibrado y Unificación Espacial (WAVE 7178+)

**Base:** `PIPELINE_IKSPATIAL_AUDIT.md` (fricciones F1–F10)
**Doctrina:** IK puro y determinista · latencia cero en pipeline DMX · 2D ágil con conciencia espacial · visor 3D como espejo, nunca como autoridad.

---

## 0. Resumen Ejecutivo

| Pilar | Resuelve | Estrategia |
|---|---|---|
| P1 — `MountTransform` SSOT | F7, F8 (bug totem) | Tabla única de Euler puros en `engine/movement`. El visor deriva cuaterniones vía adaptador memoizado. |
| P2 — `placementMode` tri-estado | F1, F2, F4, F5 | Reemplaza el booleano `isPlaced` por `'unplaced' \| 'planar' \| 'spatial'`. El 2D gana elevación editable y elegibilidad IK. |
| P3 — Single-Solve Pipeline | F3, F6 | El IPC deja de resolver IK; solo distribuye sub-targets. `NodeResolver._writeNodeIK()` es el ÚNICO punto de solve. Inversión de ejes exclusivamente dentro del IK engine (calibración). |
| P4 — Calibration Dock | F9, F10 + autocalibrado | Herramienta visual dentro del Stage Constructor (tool mode `'calibrate'`), sin ensuciar el centro de control. |

---

## P1 — Fuente Única de Verdad: `MountTransform`

### 1.1 Problema actual

Dos tablas paralelas que representan lo mismo:

- `InverseKinematicsEngine.MOUNT_ANGLES` — grados `{ pitch, yaw, roll }`
- `visualizer/utils/mountQuaternion.MOUNT_QUATERNIONS` — cuaterniones Three.js

**Bug confirmado (`totem`):** IK lo trata como identidad (= floor), el visor lo trata como `R_X(π)` (haz hacia arriba). Divergencia silenciosa.

### 1.2 Solución: módulo puro `mountTransforms.ts`

Nuevo archivo: `src/engine/movement/mountTransforms.ts` — **cero dependencias** (ni Three.js, ni DOM). Es importable tanto por el main process (IK) como por el renderer (visor).

```typescript
// src/engine/movement/mountTransforms.ts
import type { InstallationOrientation } from '../../core/stage/ShowFileV2'

/** Transformación de montaje en radianes. Inmutable, pre-congelada. */
export interface MountTransform {
  readonly pitchRad: number
  readonly yawRad: number
  readonly rollRad: number
}

const PI = Math.PI

/**
 * ⚓ SSOT — La ÚNICA tabla de orientaciones de montaje de LuxSync.
 * Consumida por:
 *   - InverseKinematicsEngine (directo, radianes)
 *   - mountQuaternion.ts (adaptador → THREE.Quaternion, memoizado)
 *   - Cualquier futuro motor (autocalibrado, simulación, export)
 *
 * Convención: rotación del frame LOCAL del fixture respecto al frame GLOBAL.
 * El eje de emisión local es -Y (igual que los modelos Hyperion).
 */
export const MOUNT_TRANSFORMS: Readonly<Record<InstallationOrientation, MountTransform>> =
  Object.freeze({
    'ceiling':     Object.freeze({ pitchRad: 0,  yawRad: 0,      rollRad: 0 }),
    'truss-front': Object.freeze({ pitchRad: 0,  yawRad: 0,      rollRad: 0 }),
    'truss-back':  Object.freeze({ pitchRad: 0,  yawRad: PI,     rollRad: 0 }),
    // 🔧 FIX F8: totem = fixture de pie apuntando hacia ARRIBA = floor.
    // Antes IK usaba identidad y el visor usaba R_X(π). Ahora ambos: pitch=π.
    'floor':       Object.freeze({ pitchRad: PI, yawRad: 0,      rollRad: 0 }),
    'totem':       Object.freeze({ pitchRad: PI, yawRad: 0,      rollRad: 0 }),
    'wall-left':   Object.freeze({ pitchRad: 0,  yawRad: PI / 2, rollRad: 0 }),
    'wall-right':  Object.freeze({ pitchRad: 0,  yawRad: -PI / 2, rollRad: 0 }),
  })

/** Fallback seguro. */
export function getMountTransform(o: InstallationOrientation): MountTransform {
  return MOUNT_TRANSFORMS[o] ?? MOUNT_TRANSFORMS['ceiling']
}
```

> ⚠️ **Nota de migración F8**: hoy `MOUNT_ANGLES` del IK declara `floor: {0,0,0}` y `ceiling: {0,0,0}` (convergencia WAVE 4899 — la distinción se maneja con `tiltInvert` de calibración). La tabla definitiva debe validarse contra los tests de `InverseKinematicsEngine.test.ts` ANTES de fijar los valores: **la regla es una sola — IK y visor leen la misma celda**. Si el resultado del test dicta que `floor` es identidad en el dominio IK, entonces el adaptador del visor aplica la transformación equivalente derivada, nunca una tabla propia.

### 1.3 Adaptador del visor (única frontera con Three.js)

```typescript
// src/components/hyperion/views/visualizer/utils/mountQuaternion.ts (REESCRITO)
import * as THREE from 'three'
import { MOUNT_TRANSFORMS, type MountTransform } from '../../../../../engine/movement/mountTransforms'
import type { InstallationOrientation } from '../../../../../core/stage/ShowFileV2'

/** Cache module-level: 7 orientaciones → 7 quaternions. Una sola alloc por app. */
const _cache = new Map<InstallationOrientation, THREE.Quaternion>()

export function getMountQuaternion(o: InstallationOrientation): THREE.Quaternion {
  let q = _cache.get(o)
  if (!q) {
    const m: MountTransform = MOUNT_TRANSFORMS[o] ?? MOUNT_TRANSFORMS['ceiling']
    q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(m.pitchRad, m.yawRad, m.rollRad, 'YXZ')  // mismo orden que rotateToLocalFrame
    )
    _cache.set(o, q)
  }
  return q
}
```

**Regla de oro:** el orden de Euler del adaptador (`'YXZ'`) DEBE coincidir con el orden de composición de `rotateToLocalFrame()` en el IK. Se añade un test de paridad (§1.4).

### 1.4 Test de paridad (regresión permanente)

```typescript
// src/engine/movement/__tests__/mountParity.test.ts
// Para cada orientación y un set de targets canónicos:
//   1. IK: solve(profile, target) → panDeg/tiltDeg lógicos
//   2. Visor: baseQuat * yokeQuat(panAngle) * headQuat(tiltAngle) → vector de haz
//   3. Assert: el vector de haz apunta al target con error < 0.5°
// Este test detecta CUALQUIER divergencia futura entre motor y espejo.
```

### 1.5 Archivos a modificar (P1)

| Archivo | Cambio |
|---|---|
| `src/engine/movement/mountTransforms.ts` | NUEVO — tabla SSOT |
| `src/engine/movement/InverseKinematicsEngine.ts` | Eliminar `MOUNT_ANGLES` local; importar `getMountTransform()` |
| `src/components/.../utils/mountQuaternion.ts` | Reescribir como adaptador derivado + cache |
| `src/engine/movement/__tests__/mountParity.test.ts` | NUEVO — test de paridad IK↔visor |

---

## P2 — Puente Multidimensional: `placementMode`

### 2.1 Problema actual

`isPlaced: boolean` bifurca dos universos sin puente:
- `false` (2D/guerrilla) → sin IK, zone-layout en el visor, Y inferida fija (`ORIENTATION_HEIGHT`)
- `true` (3D) → IK activo, posición authored

Un fixture colocado en 2D tiene X/Z reales pero el IK lo ignora. Y su altura es una constante mágica (ceiling=4.0m) que introduce error de tilt.

### 2.2 Solución: estado tri-modal + elevación explícita

```typescript
// src/core/stage/ShowFileV2.ts — extensión de FixtureV2

/** 
 * 🌉 WAVE 7178+: Modo de colocación espacial.
 *  - 'unplaced': sin posición fiable → zone-layout, SIN IK (comportamiento legacy isPlaced=false)
 *  - 'planar':   colocado en canvas 2D → X/Z authored + Y explícita (elevation) → IK ACTIVO
 *  - 'spatial':  colocado en grid 3D → XYZ authored completo → IK ACTIVO (legacy isPlaced=true)
 */
export type PlacementMode = 'unplaced' | 'planar' | 'spatial'

export interface FixtureV2 {
  // ... campos existentes ...

  placementMode?: PlacementMode   // NUEVO — autoridad
  /** @deprecated Derivado de placementMode. Mantenido para shows legacy. */
  isPlaced?: boolean
}

/** Derivación canónica — única función que decide elegibilidad IK. */
export function isIKEligible(f: Pick<FixtureV2, 'placementMode' | 'isPlaced'>): boolean {
  if (f.placementMode) return f.placementMode !== 'unplaced'
  return f.isPlaced === true   // fallback legacy
}

/** Migración al cargar show: */
export function migratePlacement(f: FixtureV2): PlacementMode {
  if (f.placementMode) return f.placementMode
  return f.isPlaced === true ? 'spatial' : 'unplaced'
}
```

### 2.3 Lógica en `stageStore`

```typescript
// src/stores/stageStore.ts — nuevas acciones

interface StageActions {
  // ... existentes ...

  /**
   * 🌉 Drop en canvas 2D → modo 'planar'.
   * X/Z del drop, Y desde ORIENTATION_HEIGHT como VALOR INICIAL EDITABLE
   * (no una constante congelada). Clampea Y al Crystal Box (fix F5).
   */
  placeFixture2D(id: string, xm: number, zm: number, zone: FixtureZone): void
  // impl:
  //   const f = fixtures.find(...)
  //   const y0 = f.position?.y > 0 ? f.position.y   // preservar elevación previa
  //            : ORIENTATION_HEIGHT[f.orientation ?? 'ceiling']
  //   const pos = clampToCrystalBox({ x: xm, y: y0, z: zm }, stage)  // ← F5 fix
  //   updateFixture(id, { position: pos, placementMode: 'planar' })

  /**
   * 🎚️ Ajuste de elevación desde el 2D (chip numérico / drag vertical).
   * Snap a voxel + clamp al height del stage.
   */
  setFixtureElevation(id: string, ym: number): void
  // impl: position.y = clamp(0, stage.height, snapToVoxel(ym)); mantiene placementMode

  /** Drop/drag en grid 3D → modo 'spatial' (sin cambios de flujo). */
  placeFixture3D(id: string, pos: Position3D): void
}
```

### 2.4 UX del 2D: elevación sin fricción

El canvas 2D sigue siendo drag & drop puro en X/Z. La conciencia espacial se añade con **coste de interacción cero**:

- **Badge de elevación** en cada chip de fixture: `▲ 4.0m` — click abre stepper inline (±0.25m, snap voxel).
- **Anillo de alcance** (opcional, toggle): círculo SVG con el radio de cobertura del haz a nivel de suelo dado `elevation` y `tiltRangeDeg` — feedback inmediato de si el fixture "llega" al target.
- Los drops nuevos siguen infiriendo Y de `ORIENTATION_HEIGHT` — pero ahora es un *default editable*, no una verdad congelada (fix F2).

### 2.5 Consumidores a actualizar

| Consumidor | Cambio |
|---|---|
| `KineticsBridge._flushSpatial()` | Filtro de elegibilidad: `isIKEligible(f)` en vez de `f.isPlaced === true` (fix F4) |
| `useFixture3DData.ts` | `isIKEligible(f)` → posición authored; `'unplaced'` → zone-layout fallback (sin cambios de render) |
| `StageCanvas2D.onDrop` | Llama `placeFixture2D()` — ya NO escribe `isPlaced: false` |
| `StageGrid3D.handleFixtureDrop` | Llama `placeFixture3D()` — `placementMode: 'spatial'` |
| `NodeExtractionPipeline` | Propaga `placementMode` al nodo KINETIC para el gate del resolver |

---

## P3 — Refactor del Pipeline IK: Single-Solve

### 3.1 Problema actual (F3 + F6)

```
HOY (doble solve):
IPC applySpatialTarget → solveGroupWithFan() ①  → pan_base/tilt_base → Arbiter fusion
                                                 → targetX/Y/Z       → Resolver
NodeResolver._writeNodeIK → solveInto() ②        → DMX write

Inversión de ejes: repartida en 3 capas (IK calibración, resolver invertClassicKineticAxes,
visualizador visualTilt = 1 - smoothTilt).
```

El solve ① solo existe para alimentar la fusión de offsets del VMM en dominio pan/tilt. El solve ② es el que manda al hardware. Dos verdades, doble coste, y el anti-flip usa `currentPanDMX` distinto en cada capa.

### 3.2 Arquitectura objetivo

```
MAÑANA (single solve):
IPC applySpatialTarget
  → computeFanSubTargets()          ← SOLO geometría de fan (barato, sin IK)
  → arbiter.setMotorKineticOverride(nodeId, { target_x, target_y, target_z })
Arbiter._applyRelativeOffsetFusion
  → passthrough de target_* + pan_offset/tilt_offset del VMM (sin tocar targets)
NodeResolver._writeNodeIK           ← ÚNICO SOLVE
  → solveInto(profile, subTarget)   → pan/tilt base DMX
  → fusión de offsets VMM EN DOMINIO DMX (post-solve)
  → velocity clamp + airbag → buf write
  → publica reachability a _ikReachability (telemetría existente → frontend)
```

### 3.3 Extracción del fan como módulo puro

`solveGroupWithFan` se descompone: la distribución de sub-targets ya es pura y barata. El IPC la usa SIN resolver:

```typescript
// InverseKinematicsEngine.ts — nueva export (reutiliza computeLineFanOffsets/computeCircleFanOffsets)
export function computeFanSubTargets(
  fixtures: ReadonlyArray<{ id: string; position: Position3D }>,
  target: Target3D,
  fanMode: SpatialFanMode,
  fanAmplitude: number,
): Map<string, Target3D> {
  // converge/amp=0 → todos al target
  // line   → computeLineFanOffsets(positions, target, amp)
  // circle → computeCircleFanOffsets(n, amp)
  // Devuelve subTarget por fixture. CERO llamadas a solve().
}
```

### 3.4 Nuevo `AetherIPCHandlers.applySpatialTarget` (pseudo-código)

```typescript
// AetherIPCHandlers.ts
async function applySpatialTarget(payload) {
  const subTargets = computeFanSubTargets(eligibleFixtures, payload.target,
                                          payload.fanMode, payload.fanAmplitude)

  for (const [fixtureId, subTarget] of subTargets) {
    const nodeId = kineticNodeIdOf(fixtureId)
    // ⚡ Solo targets. NADA de pan_base/tilt_base. NADA de solve().
    arbiter.setMotorKineticOverride(nodeId, {
      target_x: subTarget.x,
      target_y: subTarget.y,
      target_z: subTarget.z,
    })
  }

  // Respuesta inmediata al frontend: subTargets para el render del pad.
  // Reachability llega asíncrona vía transient updates (resolver la publica).
  return { success: true, subTargets: serialize(subTargets) }
}
```

### 3.5 Nuevo `NodeResolver._writeNodeIK` (pseudo-código)

```typescript
// NodeResolver.ts
private _writeNodeIK(node, channelValues, baseAddr, buf, calibration, writeEnabled) {
  const target = readTarget(channelValues)             // target_x/y/z
  const profile = this._getOrBuildIKProfile(node, calibration)
  const currentPanDMX = node.currentPosition.pan * 255  // anti-flip con estado REAL

  // ── ÚNICO SOLVE DEL SISTEMA ──
  solveInto(this._ikResultScratch, profile, target, currentPanDMX)
  const ik = this._ikResultScratch
  this._ikReachability.set(node.nodeId, ik.reachable)   // telemetría → frontend

  // ── FUSIÓN VMM POST-SOLVE (antes vivía en el Arbiter con pan_base) ──
  // offsets normalizados 0-1 del VMM llegan en el record arbitrado.
  const panOffset  = channelValues['pan_offset']  ?? 0   // -0.5..+0.5
  const tiltOffset = channelValues['tilt_offset'] ?? 0
  const distScale  = channelValues['dist_scale']  ?? 1   // pre-computado en patch del target
  let pan  = ik.pan  + panOffset  * 255 * AMP_PAN  * distScale
  let tilt = ik.tilt + tiltOffset * 255 * AMP_TILT * distScale

  // ── SAFETY (única capa, sin cambios) ──
  sm.clampKineticVelocityInto(scratch, node.nodeId, pan, tilt)
  pan  = sm.applyAirbag(scratch.pan, true)
  tilt = sm.applyAirbag(scratch.tilt, false)

  node.currentPosition.pan  = pan / 255   // pre-vis SIEMPRE (aunque output desarmado)
  node.currentPosition.tilt = tilt / 255

  if (!writeEnabled) return
  writePanTiltToBuffer(buf, baseAddr, node.channels, pan, tilt)
}
```

### 3.6 Inversión de ejes: UNA capa (fix F6)

**Doctrina:** la inversión pertenece al dominio físico → vive EXCLUSIVAMENTE en el IK engine vía `FixtureCalibration.panInvert/tiltInvert` (paso 10 del solve, ya existente).

| Capa | Hoy | Mañana |
|---|---|---|
| `InverseKinematicsEngine.solveInto` | invierte via calibración | ✅ ÚNICA capa de inversión (ruta IK) |
| `NodeResolver._writeNode` (clásica) | `invertClassicKineticAxes` en DMX | Se mantiene SOLO para ruta clásica (sin targets no hay IK), pero se extrae a `applyAxisPolicy(orientation, dmx)` compartida y documentada |
| `HyperionMovingHead3D` | `visualTilt = 1 - smoothTilt` para ceiling | ❌ ELIMINADO — el visor renderiza el valor lógico de `currentPosition` tal cual. La coherencia la garantiza el test de paridad (§1.4) |

El visor deja de "adivinar" la física: `NodeResolver` ya guarda `currentPosition` en espacio lógico ANTES de la inversión (WAVE 4932.3) — esa es la señal que el visor debe consumir sin re-transformar.

### 3.7 Archivos a modificar (P3)

| Archivo | Cambio |
|---|---|
| `InverseKinematicsEngine.ts` | + `computeFanSubTargets()` export; `solveGroupWithFan` queda para tests/legacy |
| `AetherIPCHandlers.ts` | `applySpatialTarget` sin solve; overrides = solo `target_*` |
| `NodeArbiter.ts` | `_applyRelativeOffsetFusion` → passthrough de `target_*` + offsets (elimina rama `pan_base` del motor; conserva `pan_base` MANUAL para HOLD/anchor) |
| `NodeResolver.ts` | `_writeNodeIK` v2 con fusión post-solve; publica reachability |
| `KineticsBridge.ts` | Lee reachability desde transient/telemetría en vez de la respuesta síncrona del IPC |
| `HyperionMovingHead3D.tsx` | Eliminar `visualTilt = 1 - smoothTilt` y el pan negado ad-hoc; render directo del espacio lógico |

---

## P4 — Módulo UI: Calibration Dock (Apuntado)

### 4.1 Principio de diseño

La calibración vive **dentro del Stage Constructor** como un *tool mode* más (`'calibrate'`), no como panel flotante en el centro de control. El main control center queda intacto. El dock es una columna lateral derecha colapsable (flex `0 0 320px`, `min-width:0`), y el viewport 3D/2D sigue siendo el protagonista (`flex:1 1 0`).

### 4.2 Estructura de componentes

```
src/components/views/StageConstructor/calibration/
├── CalibrationDock.tsx          — contenedor columna derecha (tool mode 'calibrate')
├── CalibrationFixtureList.tsx   — lista de fixtures IK-elegibles, selección single
├── CalibrationTargetMini.tsx    — mini SpatialTargetPad (reutiliza el componente, props reducidas)
├── OffsetTrimPad.tsx            — pad XY: drag = panOffset (X) / tiltOffset (Y), ±30°, snap 0.5°
├── AxisPolarityToggles.tsx      — switches panInvert / tiltInvert / swapPanTilt
├── CalibrationBeamGhost.tsx     — R3F: haz FANTASMA (línea al target ideal) vs haz REAL
└── useCalibrationSession.ts     — hook: estado de sesión, dirty tracking, apply/revert
```

Integración en `StageConstructorView`:

```tsx
// StageConstructorView.tsx — dentro del layout existente
<div className="constructor-main">                 {/* flex row */}
  <FixtureLibrarySidebar />                        {/* izquierda, existente */}
  <div className="constructor-viewport">           {/* flex:1 1 0, min-width:0 */}
    {viewMode === '3d' ? <StageGrid3D /> : <StageCanvas2D />}
    {toolMode === 'calibrate' && viewMode === '3d' && <CalibrationBeamGhost />}
  </div>
  {toolMode === 'calibrate' && <CalibrationDock />} {/* derecha, 320px, colapsable */}
</div>
```

### 4.3 Flujo de calibración en vivo

```
1. Operador entra en tool mode 'calibrate' → selecciona fixture en CalibrationFixtureList
2. CalibrationTargetMini fija un Target3D de referencia (p.ej. centro pista, y=0)
   → KineticsBridge._flushSpatial() SOLO para ese fixture → el hardware apunta
3. CalibrationBeamGhost dibuja:
   ── línea VERDE: rayo ideal fixture→target (geometría pura, sin IK)
   ── cono REAL: pose actual del hardware (currentPosition vía transientStore)
4. Operador arrastra OffsetTrimPad hasta que el cono real se alinea con la línea verde
   → cada delta escribe en stageStore.updateFixture(id, { calibration }) (throttled 100ms)
   → IPC 'aether:invalidateIKProfile' → NodeResolver._ikProfileCache.delete(nodeId)
   → el siguiente frame del resolver re-solvea con la calibración nueva → LATENCIA < 1 frame
5. useCalibrationSession trackea snapshot inicial → botones APPLY (persistir a show) / REVERT
```

### 4.4 Contrato de datos (sin tipos nuevos en el hot-path)

La calibración reutiliza `FixtureV2.calibration` existente (`panOffset`, `tiltOffset`, `panInvert`, `tiltInvert`) — el IK ya la consume en el paso 7 y 10 del solve. Lo único nuevo:

```typescript
// useCalibrationSession.ts
interface CalibrationSession {
  fixtureId: string | null
  referenceTarget: Target3D            // target de calibración (default: {0, 0, 2})
  snapshot: FixtureCalibration | null  // para REVERT
  isDirty: boolean
}

// IPC nuevo (1 handler):
// 'aether:invalidateIKProfile' (nodeId) → resolver cache bust. Zero-payload, fire & forget.
```

### 4.5 Rendimiento

- `OffsetTrimPad` escribe con throttle de 100ms al store — el resolver a 44Hz recoge el cambio sin re-render de React en el hot-path.
- `CalibrationBeamGhost` usa `useFrame` + `getTransientFixture()` (patrón existente de `HyperionMovingHead3D`) — cero suscripciones reactivas.
- El dock solo se monta en tool mode `'calibrate'` — coste cero el 99% del tiempo.

---

## 5. Plan de Migración (orden de ejecución)

| Fase | Contenido | Riesgo | Gate de validación |
|---|---|---|---|
| M1 | P1: `mountTransforms.ts` + adaptador + test de paridad | Bajo | `mountParity.test.ts` verde + tests IK existentes verdes |
| M2 | P2: `placementMode` + migración + `placeFixture2D`/`setFixtureElevation` | Medio | Show legacy carga sin regresión; fixture 2D aparece en `_flushSpatial` |
| M3 | P3a: `computeFanSubTargets` + IPC sin solve | Medio | Reachability sigue llegando al pad; DMX idéntico byte a byte (test A/B) |
| M4 | P3b: fusión VMM post-solve en resolver + limpieza de inversiones del visor | Alto | Test de paridad + validación física con hardware real |
| M5 | P4: Calibration Dock | Bajo | Sesión de calibrado end-to-end con un mover real |

**Regla de compatibilidad:** cada fase deja el sistema en estado shippeable. `solveGroupWithFan` y `isPlaced` se mantienen deprecados (no eliminados) hasta M5+1.

---

## 6. Invariantes que este blueprint NO negocia

1. `InverseKinematicsEngine.ts` sigue siendo puro: sin Three.js, sin DOM, sin IPC. `mountTransforms.ts` hereda la misma pureza.
2. El hot-path del resolver mantiene zero-alloc: scratchpads existentes (`_ikResultScratch`, `_kineticClampScratch`) se reutilizan; la fusión post-solve es aritmética pura.
3. El operador humano (L2 manual / HOLD) conserva supremacía absoluta — la fusión post-solve respeta `hasAbsoluteManualLock` y los estados HOLD del Arbiter.
4. `AetherSafetyMiddleware` (velocity clamp + airbag) permanece como última línea antes del buffer — ningún refactor lo puentea.
5. El visor 3D es un ESPEJO de `currentPosition` — nunca calcula física propia. Toda coherencia visual↔hardware se garantiza por el test de paridad, no por transformaciones ad-hoc.
