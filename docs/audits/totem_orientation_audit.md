# TOTEM ORIENTATION BUG — DIAGNOSTIC AUDIT

**Modo:** READ-ONLY forensic audit — No se modificó código.
**Síntoma:** Setting a fixture's orientation to `totem` in the Constructor produces the exact same physical/DMX behavior as `floor`.

---

## 0. VEREDICTO RESUMEN

| Bug | Root Cause | Archivo | Línea | Severidad |
|---|---|---|---|---|
| **Primary: totem = floor (VMM path)** | `generateStereoMovement` no pasa `mountOrientation` a `VMM.generateIntent` → VMM defaultea a `'floor'` → tilt offset de totem (-0.45) nunca se aplica | `MovementGenerators.ts` | 164-165 | **CRITICAL** |
| **Secondary: totem = ceiling (HAL legacy)** | `INSTALLATION_PRESETS` table no tiene entry `totem` → `INSTALLATION_PRESETS['totem']` = `undefined` → fallback a `defaultConfig` que es **ceiling** | `FixturePhysicsDriver.ts` | 147-183 | **HIGH** |

**El bug es dual:**
- En el **pipeline principal (Aether/VMM)**, totem se trata como **floor** porque el orientation nunca llega al VMM.
- En el **pipeline legacy (HAL/FixturePhysicsDriver)**, totem se trata como **ceiling** porque el preset faltante cae al default.
- El usuario reporta "totem = floor" → el pipeline principal es el visible.

---

## 1. CONFIGURATION — DÓNDE SE DEFINE `totem`

### 1.1 Type Definition

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="166-173" />

```typescript
export type InstallationOrientation = 
  | 'ceiling' 
  | 'floor' 
  | 'totem'
  | 'wall-left' 
  | 'wall-right' 
  | 'truss-front' 
  | 'truss-back'
```

`totem` es un valor first-class del tipo. El sistema de tipos lo reconoce.

### 1.2 Parsing del Constructor

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\hydration\FixtureHydrationEngine.ts" lines="140-141" />

```typescript
const installOrientation = fixture.orientation || fixture.installationType || 'ceiling'
ctx.hal.registerMover(fixture.id, installOrientation)
```

El orientation del fixture se lee del ShowFile y se pasa al HAL. **Esto funciona correctamente** — el valor `'totem'` llega al HAL.

### 1.3 Propagación al Aether Graph

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts" lines="777-781" />

```typescript
ikOrientation: {
  installation: orientation as InstallationOrientation,
  rotation:     { pitch: 0, yaw: 0, roll: 0 },
}
```

El orientation se hidrata como `ikOrientation.installation` en el nodo KINETIC del Aether Graph. **Esto funciona correctamente** — `'totem'` llega al nodo.

---

## 2. TRACE — LOS 7 PATHS DE PAN/TILT

Existen **7 paths** donde el orientation afecta el Pan/Tilt final. Se auditaron todos:

| # | Path | Archivo | ¿Totem distinto de floor? | Status |
|---|---|---|---|---|
| 1 | VMM (TitanEngine → generateStereoMovement) | `MovementGenerators.ts:164` | **NO** — mountOrientation no se pasa | ❌ BUG B |
| 2 | VMM (KineticAdapter L2 manual) | `KineticAdapter.ts:303` | **SÍ** — pasa `node.ikOrientation?.installation` | ✅ OK |
| 3 | AetherKineticEngine (L2 patterns) | `AetherKineticEngine.ts:654` | **SÍ** — `resolveTiltOffset('totem')` = -0.45 | ✅ OK |
| 4 | NodeResolver classic kinetic | `NodeResolver.ts:1652-1668` | **NO** — solo invierte ceiling/truss, totem = floor = no invert | ✅ OK (físicamente correcto) |
| 5 | NodeResolver IK path | `InverseKinematicsEngine.ts:229` | **NO** — `getIKMountAngles('totem')` = `{0,0,0}` = mismo que floor | ✅ OK (físicamente correcto) |
| 6 | FixturePhysicsDriver (HAL legacy) | `FixturePhysicsDriver.ts:147-183` | **SÍ** — pero WRONG: totem = ceiling (preset faltante) | ❌ BUG A |
| 7 | 3D Visualizer | `mountTransforms.ts:96-105` | **NO** — `MOUNT_SEMANTICS['totem']` = `MOUNT_SEMANTICS['floor']` | ✅ OK (físicamente correcto) |

**Paths 4, 5, 7** tratan totem = floor **por diseño correcto**: ambos facing up, mismo pitch=π, misma inversión (ninguna). La diferencia física entre totem y floor es el **bias hacia el audience** (tilt offset -0.45), no la inversión de ejes.

**Path 1** es el bug crítico: el VMM nunca recibe el orientation, así que no puede aplicar el offset de totem.

**Path 6** es el bug secundario: el preset faltante hace que totem herede defaults de ceiling.

---

## 3. BUG B (PRIMARY) — `generateStereoMovement` no pasa `mountOrientation`

### 3.1 El Código Defectuoso

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\generators\MovementGenerators.ts" lines="156-168" />

```typescript
export function generateStereoMovement(
  vibeId: string,
  audio: MovementAudioInput,
  musical: MovementMusicalInput,
): ProtocolMovementIntent {
  const vmmContext   = buildVMMContext(audio, musical)
  const gearboxSpeed = calculateGearboxBudget(vibeId)

  const intentL = vibeMovementManager.generateIntent(vibeId, vmmContext, 0, STEREO_TOTAL, gearboxSpeed)
  //                                                                            ↑ 6 args, NO 7th arg (mountOrientation)
  const intentR = vibeMovementManager.generateIntent(vibeId, vmmContext, 1, STEREO_TOTAL, gearboxSpeed)
  //                                                                            ↑ 6 args, NO 7th arg (mountOrientation)

  return assembleStereoMovementIntent(intentL, intentR)
}
```

`generateIntent` acepta 7 parámetros, el 7º es `mountOrientation?: string`. Aquí se pasan solo 5 argumentos posicionales (vibeId, vmmContext, index, total, gearboxSpeed). **El 7º parámetro es `undefined`.**

### 3.2 Consecuencia en el VMM

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="1188-1196" />

```typescript
const effectiveMount = (mountOrientation ?? 'floor').toLowerCase().trim()
//                     ↑ undefined → 'floor'
const isCeilingMount = effectiveMount === 'ceiling'
  || effectiveMount === 'truss-front'
  || effectiveMount === 'truss-back'
const tiltOffset = isCeilingMount
  ? TILT_OFFSET_CEILING
  : effectiveMount === 'totem'
    ? -0.45                    // ← NUNCA ALCANZADO para totem (effectiveMount === 'floor')
    : (TILT_OFFSET_BY_VIBE[vibeId] ?? 0)  // ← ESTO SE APLICA en su lugar
```

Cuando `mountOrientation` es `undefined`:
1. `effectiveMount` = `'floor'`
2. `isCeilingMount` = `false`
3. `effectiveMount === 'totem'` = `false` (es `'floor'`)
4. `tiltOffset` = `TILT_OFFSET_BY_VIBE[vibeId] ?? 0` — el offset genérico del vibe, **no** el de totem

**Resultado:** Para un fixture totem, el VMM aplica el mismo tiltOffset que para floor. El bias de -0.45 (audiencia) **nunca se aplica**. El fixture apunta recto hacia arriba en lugar de inclinarse hacia el público.

### 3.3 Por Qué el KineticAdapter Sí Funciona

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" lines="302-311" />

```typescript
const mountOrientation = node.ikOrientation?.installation  // ← 'totem' leído del nodo
const intent = this._vmm.generateIntent(
  vibeId,
  va,
  _index,
  nodes.count,
  node.maxPanSpeed,
  phaseOffset,
  mountOrientation,  // ← 7º arg PASADO CORRECTAMENTE
)
```

El KineticAdapter (path L2 manual) **sí pasa** `mountOrientation` al VMM. Pero este path solo se activa cuando hay patrones manuales L2 activos. En el pipeline automático (TitanEngine → `generateStereoMovement`), el orientation se pierde.

### 3.4 El Caller en TitanEngine

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts" lines="1019" />

```typescript
movement = generateStereoMovement(this.vibeManager.getActiveVibe().id, movAudio, movMusical);
//                                                                   ↑ No pasa mountOrientation
```

`TitanEngine` no tiene acceso al orientation del fixture en este punto del pipeline — está generando un intent genérico, no per-fixture. El orientation vive en el Aether Graph (nodos KINETIC), no en el TitanEngine.

**Esta es una deficiencia arquitectónica:** el VMM necesita el orientation per-fixture, pero `generateStereoMovement` produce un intent estéreo genérico sin contexto de fixture.

---

## 4. BUG A (SECONDARY) — `INSTALLATION_PRESETS` sin entry `totem`

### 4.1 La Tabla Defectuosa

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\FixturePhysicsDriver.ts" lines="147-183" />

```typescript
private readonly INSTALLATION_PRESETS: Record<string, InstallationPreset> = {
  ceiling: {
    description: 'Colgado del techo, mirando hacia abajo',
    defaultHome: { pan: 127, tilt: 40 },
    invert: { pan: false, tilt: true },    // ← TILT INVERTIDO
    limits: { tiltMin: 20, tiltMax: 200 },
    tiltOffset: -90,
  },
  floor: {
    description: 'En el suelo, mirando hacia arriba',
    defaultHome: { pan: 127, tilt: 127 },
    invert: { pan: false, tilt: false },   // ← TILT NO INVERTIDO
    limits: { tiltMin: 0, tiltMax: 255 },
    tiltOffset: 0,
  },
  truss_front: { ... },
  truss_back: { ... },
  // ❌ NO HAY ENTRY 'totem'
}
```

**No existe `totem` en esta tabla.** Solo hay 4 presets: `ceiling`, `floor`, `truss_front`, `truss_back`.

### 4.2 Consecuencia en `registerFixture`

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\FixturePhysicsDriver.ts" lines="290-301" />

```typescript
const preset = this.INSTALLATION_PRESETS[config.installationType || 'ceiling']
//             ↑ INSTALLATION_PRESETS['totem'] → undefined

const finalConfig: FixtureConfig = {
  ...defaultConfig,   // ← ceiling defaults (invert.tilt=true, home tilt=40, limits 20-200)
  ...preset,          // ← undefined spread = no-op
  ...config,          // ← { installationType: 'totem' } (sin invert/home/limits)
  home: { ...defaultConfig.home, ...preset?.defaultHome, ...config.home },
  //                   ↑ undefined?.defaultHome = undefined → no-op → home = ceiling home
  invert: { ...defaultConfig.invert, ...preset?.invert, ...config.invert },
  //                    ↑ undefined?.invert = undefined → no-op → invert = ceiling invert (tilt:true)
  limits: { ...defaultConfig.limits, ...preset?.limits, ...config.limits },
  //                    ↑ undefined?.limits = undefined → no-op → limits = ceiling limits (20-200)
}
```

Cuando `config.installationType === 'totem'`:
1. `preset` = `INSTALLATION_PRESETS['totem']` = `undefined`
2. `...preset` (spread de `undefined`) = no-op
3. `preset?.defaultHome` = `undefined` → no-op
4. `preset?.invert` = `undefined` → no-op
5. `preset?.limits` = `undefined` → no-op
6. `finalConfig` retiene **todos** los defaults de `defaultConfig` que son **ceiling**:
   - `invert.tilt = true` (ceiling) en lugar de `false` (floor/totem)
   - `home.tilt = 40` (ceiling) en lugar de `127` (floor/totem)
   - `limits = {20, 200}` (ceiling) en lugar de `{0, 255}` (floor/totem)
   - `tiltOffset = -90` (ceiling) en lugar de `0` (floor/totem)

**Resultado:** En el path legacy HAL, totem se comporta como **ceiling** (tilt invertido, home en 40, rango limitado 20-200).

### 4.3 El `defaultConfig` es Ceiling

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\FixturePhysicsDriver.ts" lines="280-288" />

```typescript
const defaultConfig: FixtureConfig = {
  installationType: 'ceiling',     // ← DEFAULT ES CEILING
  home: { pan: 127, tilt: 40 },    // ← tilt=40 (ceiling)
  range: { pan: 540, tilt: 270 },
  invert: { pan: false, tilt: true }, // ← tilt invertido (ceiling)
  limits: { tiltMin: 20, tiltMax: 200 }, // ← rango ceiling
  maxSpeed: { pan: 180, tilt: 130 },
  mirror: false,
}
```

El `defaultConfig` está hardcodeado a ceiling. Cualquier orientation sin preset explícito hereda ceiling.

---

## 5. ANÁLISIS DEL 3D VISUALIZER

### 5.1 MOUNT_SEMANTICS — Totem = Floor

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\mountTransforms.ts" lines="96-105" />

```typescript
export const MOUNT_SEMANTICS: Readonly<Record<InstallationOrientation, MountSemantics>> =
  Object.freeze({
    'ceiling':     { facing: 'down', backFacing: false, wallSide: 'none' },
    'truss-front': { facing: 'down', backFacing: false, wallSide: 'none' },
    'truss-back':  { facing: 'down', backFacing: true,  wallSide: 'none' },
    'floor':       { facing: 'up',   backFacing: false, wallSide: 'none' },
    'totem':       { facing: 'up',   backFacing: false, wallSide: 'none' }, // ← IDENTICAL a floor
    'wall-left':   { facing: 'down', backFacing: false, wallSide: 'left'  },
    'wall-right':  { facing: 'down', backFacing: false, wallSide: 'right' },
  })
```

`MOUNT_SEMANTICS['totem']` es **idéntico** a `MOUNT_SEMANTICS['floor']`:
- `facing: 'up'` — ambos apuntan hacia arriba
- `backFacing: false` — ambos miran al frente
- `wallSide: 'none'` — ninguno está en pared

### 5.2 getVisualMountTransform — Totem = Floor

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\mountTransforms.ts" lines="159-164" />

```typescript
export function getVisualMountTransform(o: InstallationOrientation): MountTransform {
  const s = getMountSemantics(o)
  const pitchRad = s.facing === 'up' ? PI : 0   // ← totem y floor ambos → PI
  const yawRad = s.backFacing ? PI : 0           // ← totem y floor ambos → 0
  const rollRad = s.wallSide === 'left' ? PI / 2 : s.wallSide === 'right' ? -PI / 2 : 0  // ← 0
  return { pitchRad, yawRad, rollRad }
}
```

Para totem y floor: `{ pitchRad: PI, yawRad: 0, rollRad: 0 }` — **cuaternión idéntico**.

### 5.3 Veredicto Visualizer

El visualizer trata totem = floor en la **rotación base**. Esto es **físicamente correcto** — ambos son fixtures en el suelo apuntando hacia arriba. La diferencia entre totem y floor es el **tilt dinámico hacia el audience** (el offset de -0.45 del VMM), que es una propiedad del movimiento, no del montaje base.

**El visualizer NO tiene un bug de totem.** Renderiza correctamente la orientación base. Si el VMM aplicara el offset de totem, el visualizer lo reflejaría dinámicamente via los valores de pan/tilt que recibe.

---

## 6. ANÁLISIS DEL NODE RESOLVER (DMX OUTPUT)

### 6.1 Classic Kinetic Path — Inversión de Ejes

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1652-1668" />

```typescript
private _shouldInvertClassicKineticAxes(
  deviceOrientation: string | undefined,
  node: IKineticNodeData,
): boolean {
  const orientation = deviceOrientation?.toLowerCase().trim()
  if (orientation?.includes('ceiling') || orientation?.startsWith('truss')) {
    return true
  }
  // totem → no entra aquí
  // floor → no entra aquí
  return false  // ← totem y floor ambos → false (no inversión)
}
```

Totem y floor ambos retornan `false` — **ninguno invierte el tilt**. Esto es correcto: ambos facing up, no requieren inversión de eje DMX.

### 6.2 IK Path — Mount Angles

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\mountTransforms.ts" lines="130-140" />

```typescript
export function getIKMountAngles(o: InstallationOrientation): MountTransform {
  const s = getMountSemantics(o)
  const yawRad = s.backFacing
    ? PI
    : s.wallSide === 'left'
      ? PI / 2
      : s.wallSide === 'right'
        ? -PI / 2
        : 0
  return { pitchRad: 0, yawRad, rollRad: 0 }
}
```

Para totem y floor: `{ pitchRad: 0, yawRad: 0, rollRad: 0 }` — **idéntico**. El IK solver usa `atan2(horizontalDist, -local.y)` para determinar el tilt, y el signo de `local.y` (target arriba del fixture) produce naturalmente tilt alto para fixtures facing up. Esto es correcto.

### 6.3 Veredicto NodeResolver

El NodeResolver trata totem = floor en la inversión de ejes. **Esto es físicamente correcto.** La diferencia entre totem y floor NO es la inversión de ejes — es el bias del centro de gravedad del movimiento (tilt offset), que es responsabilidad del VMM.

---

## 7. MATRIZ DE FLUJO — TRACE COMPLETO

```
Fixture Constructor (JSON)
│
├─ orientation: 'totem'
│
├─→ FixtureHydrationEngine:140
│   │
│   ├─→ HAL.registerMover('totem')
│   │   │
│   │   └─→ FixturePhysicsDriver.registerFixture({installationType:'totem'})
│   │       │
│   │       ├─ INSTALLATION_PRESETS['totem'] → undefined ❌ BUG A
│   │       ├─ preset?.invert → undefined → no-op
│   │       └─ finalConfig.invert.tilt = true (ceiling default) ❌ WRONG
│   │
│   └─→ NodeExtractionPipeline:778
│       │
│       └─→ ikOrientation: { installation: 'totem', rotation: {0,0,0} }
│           │
│           ├─→ KineticAdapter:302 (L2 manual path)
│           │   │
│           │   └─→ VMM.generateIntent(..., mountOrientation='totem') ✅ CORRECTO
│           │       └─ tiltOffset = -0.45 (audience bias) ✅
│           │
│           ├─→ AetherKineticEngine:654 (L2 patterns)
│           │   │
│           │   └─→ resolveTiltOffset('totem') = -0.45 ✅ CORRECTO
│           │
│           └─→ NodeResolver (classic + IK paths)
│               │
│               ├─ _shouldInvertClassicKineticAxes('totem') → false ✅ (mismo que floor, correcto)
│               └─ getIKMountAngles('totem') → {0,0,0} ✅ (mismo que floor, correcto)
│
└─→ TitanEngine:1019 (automatic VMM path)
    │
    └─→ generateStereoMovement(vibeId, audio, musical)
        │                                   ↑ NO mountOrientation parameter
        │
        └─→ VMM.generateIntent(vibeId, ctx, 0, 2, speed)
                                          ↑ 5 args, NO 7th arg
            │
            ├─ mountOrientation = undefined ❌ BUG B
            ├─ effectiveMount = 'floor'
            ├─ tiltOffset = TILT_OFFSET_BY_VIBE[vibeId] ?? 0
            └─ totem -0.45 audience bias NUNCA APLICADO ❌
```

---

## 8. POR QUÉ EL USUARIO VE "totem = floor"

### 8.1 El Pipeline Principal

El pipeline principal de movimiento automático es:

```
TitanEngine → generateStereoMovement → VMM.generateIntent → intent estéreo → NodeResolver → DMX
```

En este pipeline:
1. `generateStereoMovement` no pasa `mountOrientation` (Bug B)
2. VMM recibe `mountOrientation = undefined`
3. VMM normaliza a `'floor'`
4. VMM aplica `tiltOffset = TILT_OFFSET_BY_VIBE[vibeId] ?? 0` (mismo que floor)
5. NodeResolver no invierte tilt para totem ni floor (correcto)
6. DMX resultante = mismo que floor

### 8.2 El Pipeline L2 (Manual)

El pipeline L2 (patrones manuales del operador) es:

```
AetherIPCHandlers → KineticAdapter → VMM.generateIntent(..., mountOrientation) → intent → DMX
```

En este pipeline:
1. KineticAdapter pasa `node.ikOrientation?.installation = 'totem'`
2. VMM recibe `mountOrientation = 'totem'`
3. VMM aplica `tiltOffset = -0.45` (audience bias)
4. DMX resultante ≠ floor (correcto)

**Pero el usuario reporta el comportamiento del pipeline automático**, no el manual. En automático, totem = floor.

### 8.3 El Pipeline Legacy HAL

El pipeline legacy HAL (FixturePhysicsDriver) es:

```
HAL.registerMover → FixturePhysicsDriver.registerFixture → physics → DMX
```

En este pipeline:
1. `INSTALLATION_PRESETS['totem']` = `undefined` (Bug A)
2. Fallback a `defaultConfig` = ceiling
3. `invert.tilt = true` (ceiling), `home.tilt = 40` (ceiling), `limits = {20,200}` (ceiling)
4. DMX resultante = ceiling (no floor)

**Este path produce totem = ceiling**, no totem = floor. Pero si este path no es el productor principal de DMX (el Aether path lo es), el usuario no ve este bug.

---

## 9. HALLAZGOS DETALLADOS

### 9.1 Bug B — `generateStereoMovement` no pasa `mountOrientation`

| Aspecto | Detalle |
|---|---|
| **Archivo** | `MovementGenerators.ts` |
| **Línea** | 164-165 |
| **Bug** | `generateIntent` llamado con 5 args, no 7 |
| **Parámetro faltante** | `mountOrientation?: string` (7º param) |
| **Consecuencia** | VMM normaliza a `'floor'`, aplica offset de floor |
| **Offset perdido** | `-0.45` (totem audience bias) |
| **Impacto** | Totem apunta recto arriba (como floor) en lugar de inclinarse al audience |
| **Path afectado** | Pipeline automático (TitanEngine → VMM) |
| **Fix propuesto** | Thread `mountOrientation` desde TitanEngine o aplicar offset post-VMM en NodeResolver |

### 9.2 Bug A — `INSTALLATION_PRESETS` sin entry `totem`

| Aspecto | Detalle |
|---|---|
| **Archivo** | `FixturePhysicsDriver.ts` |
| **Línea** | 147-183 |
| **Bug** | Tabla tiene 4 entries (ceiling, floor, truss_front, truss_back), falta `totem` |
| **Consecuencia** | `INSTALLATION_PRESETS['totem']` = `undefined` |
| **Fallback** | `defaultConfig` = ceiling (invert.tilt=true, home=40, limits=20-200) |
| **Impacto** | Totem se trata como ceiling en el path legacy HAL |
| **Path afectado** | Pipeline legacy HAL (FixturePhysicsDriver) |
| **Fix propuesto** | Agregar entry `totem` con mismos valores que `floor` (facing up, no invert, home=127, limits=0-255) |

### 9.3 Paths Correctos (no requieren fix)

| Path | Archivo | Comportamiento |
|---|---|---|
| KineticAdapter L2 | `KineticAdapter.ts:302-311` | Pasa `mountOrientation` correctamente al VMM |
| AetherKineticEngine L2 | `AetherKineticEngine.ts:142-148,654` | `resolveTiltOffset('totem')` = -0.45 |
| NodeResolver classic | `NodeResolver.ts:1652-1668` | No invierte totem (correcto, mismo que floor) |
| NodeResolver IK | `InverseKinematicsEngine.ts:229` | `getIKMountAngles('totem')` = `{0,0,0}` (correcto) |
| 3D Visualizer | `mountTransforms.ts:96-105` | `MOUNT_SEMANTICS['totem']` = floor (correcto base) |
| FixtureMapper | `FixtureMapper.ts:312` | No invierte totem (correcto, solo ceiling invierte) |

---

## 10. NOTA ARQUITECTÓNICA

El Bug B revela una deficiencia arquitectónica:

- `generateStereoMovement` produce un **intent estéreo genérico** (un solo intent para L+R)
- El VMM necesita el orientation **per-fixture** para aplicar el tilt offset correcto
- Pero el TitanEngine no tiene contexto de fixture individual en este punto — está generando un intent que luego se distribuye a múltiples fixtures via el Arbiter

**Posibles enfoques de fix:**

1. **Thread del orientation:** Pasar el orientation promedio (o una lista) desde TitanEngine hasta `generateStereoMovement`. Complejo porque TitanEngine no sabe qué fixtures consumirán el intent.

2. **Post-VMM offset en NodeResolver:** Aplicar el tilt offset de totem (-0.45) en el NodeResolver o Arbiter, donde SÍ se conoce el orientation del nodo. Esto descentraliza la lógica pero la hace consistente con cómo ya funciona el L2 path (KineticAdapter).

3. **Per-fixture VMM call:** Llamar `generateIntent` por cada fixture con su orientation, similar a como lo hace KineticAdapter. Más costoso pero más correcto.

**Esperando instrucciones para el fix.**
