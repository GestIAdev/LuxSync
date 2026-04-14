# BLUEPRINT: SPATIAL INVERSE KINEMATICS

**WAVE 2600** · Diseño Arquitectónico  
**Estado:** Blueprint Aprobado para Implementación  
**Autor:** PunkOpus + Radwulf  
**Fecha:** Junio 2025

---

## 1. DECLARACIÓN DE INTENCIÓN

Transicionar el control de Movers de un **modelo mecánico** (pan/tilt en grados/DMX) a un **modelo espacial** (coordenadas 3D en metros) donde el operador apunta fixtures a un punto en el espacio y el motor IK calcula los valores pan/tilt reales para cada fixture según su posición y orientación física.

### 1.1 El Problema Actual

Hoy el operador mueve pan/tilt directamente. Eso funciona para un fixture aislado, pero cuando controlas un grupo:

- **Pan 128 ≠ "mismo punto"** para dos fixtures montados en posiciones distintas
- El fanning opera en **espacio de grados** (`center.pan + offset.panOffset × fan`), no en espacio real
- La formación "todos apuntan al mismo sitio" requiere calibrar offsets manualmente por fixture
- No hay conciencia espacial: el sistema no sabe dónde están los fixtures ni a qué apuntan

### 1.2 La Solución

Un motor de **Cinemática Inversa (IK)** que:

1. Conoce la **posición 3D** de cada fixture en el escenario (ya existe: `Position3D` en ShowFileV2)
2. Conoce la **orientación de montaje** (ya existe: `Rotation3D` + `InstallationOrientation`)
3. Recibe un **Target(x, y, z)** en metros
4. Calcula los **pan/tilt DMX** exactos para que el haz apunte a ese target
5. Alimenta el pipeline existente (FixturePhysicsDriver → HAL → DMX)

---

## 2. INVENTARIO DEL ESTADO ACTUAL

### 2.1 Tipos ya existentes en ShowFileV2

```typescript
// electron-app/src/core/stage/ShowFileV2.ts

interface Position3D {
  x: number  // Left(-) / Right(+) desde audiencia, metros
  y: number  // Down(-) / Up(+), metros
  z: number  // Back(-) / Front(+), metros
}

interface Rotation3D {
  pitch: number  // Rotación eje X (grados)
  yaw: number    // Rotación eje Y (grados)
  roll: number   // Rotación eje Z (grados)
}

interface PhysicsProfile {
  motorType: string
  maxAcceleration: number
  maxVelocity: number
  safetyCap: number
  orientation: InstallationOrientation  // 'ceiling' | 'floor' | 'truss_front' | 'truss_back'
  invertPan: boolean
  invertTilt: boolean
  swapPanTilt: boolean
  homePosition: { pan: number; tilt: number }
  tiltLimits: { min: number; max: number }
}

interface FixtureV2 {
  position: Position3D
  rotation: Rotation3D
  physics: PhysicsProfile
  calibration: {
    panOffset: number    // grados
    tiltOffset: number   // grados
    panInvert: boolean
    tiltInvert: boolean
  }
  // ... demás campos
}
```

### 2.2 Pipeline de Movimiento Actual

```
UI (XYPad/RadarXY)          → Pan/Tilt en DMX (0-255)
     ↓
MasterArbiter               → Merge de 5 capas (Blackout, Manual, Titan AI, Effects, Consciousness)
     ↓
FixturePhysicsDriver        → Interpolación física (SNAP / CLASSIC)
     ↓
HAL.applyCalibrationOffsets  → Invert, Offset (deg→DMX), TiltLimits, Clamp 0-255
     ↓
ArtNetDriverAdapter.send()  → UDP 6454 → Fixture
```

### 2.3 Fanning Actual (Espacio de Grados)

```typescript
// Cálculo actual en GroupFormation
pan  = formation.center.pan  + (fixtureOffset.panOffset  × formation.fan)
tilt = formation.center.tilt + (fixtureOffset.tiltOffset × formation.fan)
```

Esto distribuye grados equidistantes, **no puntos equidistantes en el espacio**.

### 2.4 Calibración Actual (HardwareAbstraction.ts:1104)

```
STEP 1: INVERT       → if panInvert: pan = 255 - pan
STEP 2: OFFSET        → panDMX += (panOffsetDeg / 540°) × 255
                       → tiltDMX += (tiltOffsetDeg / 270°) × 255
STEP 3: TILT LIMITS  → clamp tilt to [physics.tiltLimits.min, max]
STEP 4: FINAL CLAMP  → Math.round, clamp 0-255
```

---

## 3. ARQUITECTURA IK PROPUESTA

### 3.1 Diagrama de Flujo

```
┌─────────────────────────────────────┐
│  SpatialTargetPad (UI)              │
│  El operador toca un punto 3D       │
│  Target = { x: 2.0, y: 0.0, z: 3.5 }│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  InverseKinematicsEngine            │
│  Para CADA fixture del grupo:       │
│  (position, rotation, orientation)  │
│       + Target(x,y,z)              │
│       = { pan: 0-540°, tilt: 0-270°}│
│       → normalize a DMX 0-255      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  MasterArbiter (sin cambios)        │
│  Recibe pan/tilt DMX como siempre   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  FixturePhysicsDriver (sin cambios) │
│  Interpola como siempre             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  HAL.applyCalibrationOffsets        │
│  ⚠️ MODIFICADO: Skip offset/invert │
│  si el input viene de IK (ya lo    │
│  incorpora en el cálculo)           │
└──────────────┬──────────────────────┘
               │
               ▼
          DMX → Fixture
```

### 3.2 Punto de Inserción

El motor IK se inserta **ANTES** del MasterArbiter. Reemplaza la generación de pan/tilt desde la UI. El resto del pipeline (Arbiter, Physics, HAL) **no cambia** — solo recibe DMX pre-calculado en vez de DMX directo de un pad.

**Razón:** El IK produce pan/tilt DMX que son mecánicamente correctos para la posición del fixture. La calibración (offsets manuales, inverts) ya está incorporada en el cálculo IK. No necesitamos doble-aplicar.

---

## 4. MOTOR IK: `InverseKinematicsEngine`

### 4.1 Ubicación

```
electron-app/src/engine/movement/InverseKinematicsEngine.ts
```

Al lado de `FixturePhysicsDriver.ts` — misma capa lógica, distinta responsabilidad.

### 4.2 Interface

```typescript
interface SpatialTarget {
  x: number  // metros, coordenadas de escenario
  y: number  // metros
  z: number  // metros
}

interface IKResult {
  pan: number   // DMX 0-255 (ya incluye calibración)
  tilt: number  // DMX 0-255 (ya incluye calibración)
  reachable: boolean  // false si el target está fuera del rango físico del fixture
}

interface FixtureIKProfile {
  position: Position3D      // dónde está el fixture
  rotation: Rotation3D      // orientación de montaje
  orientation: InstallationOrientation  // ceiling/floor/truss
  panRange: number          // grados totales de pan (default 540)
  tiltRange: number         // grados totales de tilt (default 270)
  panOffset: number         // offset de calibración (grados)
  tiltOffset: number        // offset de calibración (grados)
  panInvert: boolean
  tiltInvert: boolean
  tiltLimits?: { min: number; max: number }  // DMX limits
}

class InverseKinematicsEngine {
  /**
   * Calcula pan/tilt DMX para que el fixture apunte al target.
   * Incorpora posición, orientación de montaje, calibración.
   * Resultado listo para inyectar en MasterArbiter.
   */
  static solve(fixture: FixtureIKProfile, target: SpatialTarget): IKResult
  
  /**
   * Batch solve para un grupo de fixtures apuntando al mismo target.
   * Cada fixture recibe pan/tilt distintos según su posición.
   */
  static solveGroup(
    fixtures: FixtureIKProfile[], 
    target: SpatialTarget
  ): Map<number, IKResult>  // index → result
}
```

### 4.3 Matemática IK

#### 4.3.1 Vector Fixture → Target

```typescript
// Vector desde fixture a target en coordenadas de escenario
const dx = target.x - fixture.position.x
const dy = target.y - fixture.position.y
const dz = target.z - fixture.position.z
```

#### 4.3.2 Transformar a coordenadas locales del fixture

El fixture tiene una orientación de montaje. Un fixture en ceiling mira hacia abajo; uno en floor mira hacia arriba. Necesitamos rotar el vector al frame de referencia local del fixture.

```typescript
// Rotación por orientación de montaje
// ceiling:     pitch_base = -90° (mira hacia abajo)
// floor:       pitch_base =  90° (mira hacia arriba)
// truss_front: pitch_base = -90° + yaw_base = 0°
// truss_back:  pitch_base = -90° + yaw_base = 180°

const mountPitch = getMountPitch(fixture.orientation) // radianes
const mountYaw   = getMountYaw(fixture.orientation)   // radianes

// Añadir rotación de montaje personalizada (Rotation3D del ShowFile)
const totalPitch = mountPitch + degToRad(fixture.rotation.pitch)
const totalYaw   = mountYaw   + degToRad(fixture.rotation.yaw)
const totalRoll  = degToRad(fixture.rotation.roll)

// Rotar el vector (dx, dy, dz) por la inversa de la rotación de montaje
// para obtener el vector en el frame local del fixture
const local = rotateByInverseMount(dx, dy, dz, totalPitch, totalYaw, totalRoll)
```

#### 4.3.3 Calcular ángulos Pan/Tilt

```typescript
// En el frame local del fixture:
// Pan  = rotación horizontal (atan2 en plano XZ local)
// Tilt = elevación vertical (atan2 desde plano horizontal hacia Y local)

const panAngle  = Math.atan2(local.x, local.z)  // radianes, 0 = frente
const distance  = Math.sqrt(local.x * local.x + local.z * local.z)
const tiltAngle = Math.atan2(-local.y, distance)  // radianes, 0 = horizontal

// Convertir a grados
const panDeg  = radToDeg(panAngle)   // -180° a +180°
const tiltDeg = radToDeg(tiltAngle)  // -90° a +90° (aprox)
```

#### 4.3.4 Mapear a DMX

```typescript
// Pan: rango mecánico típico 540° → 0-255 DMX
// Centro mecánico = 270° = DMX 127.5
// panDeg viene como -180° a +180° relativo al frente del fixture
const panDMXRaw = ((panDeg + (fixture.panRange / 2)) / fixture.panRange) * 255

// Tilt: rango mecánico típico 270° → 0-255 DMX
// Centro mecánico = 135° = DMX 127.5
const tiltDMXRaw = ((tiltDeg + (fixture.tiltRange / 2)) / fixture.tiltRange) * 255

// Aplicar calibración
let pan = fixture.panInvert ? (255 - panDMXRaw) : panDMXRaw
let tilt = fixture.tiltInvert ? (255 - tiltDMXRaw) : tiltDMXRaw

// Aplicar offsets (deg → DMX)
pan  += (fixture.panOffset / fixture.panRange) * 255
tilt += (fixture.tiltOffset / fixture.tiltRange) * 255

// Tilt limits
if (fixture.tiltLimits) {
  tilt = Math.max(fixture.tiltLimits.min, Math.min(fixture.tiltLimits.max, tilt))
}

// Clamp final
pan  = Math.max(0, Math.min(255, Math.round(pan)))
tilt = Math.max(0, Math.min(255, Math.round(tilt)))

// Reachability: ¿el ángulo calculado cae dentro del rango mecánico?
const reachable = (panDMXRaw >= -10 && panDMXRaw <= 265) &&
                  (tiltDMXRaw >= -10 && tiltDMXRaw <= 265)
```

#### 4.3.5 Función de Rotación Inversa de Montaje

```typescript
function rotateByInverseMount(
  dx: number, dy: number, dz: number,
  pitch: number, yaw: number, roll: number
): { x: number; y: number; z: number } {
  // Rotación inversa: primero -roll, luego -pitch, luego -yaw
  // Usando matrices de rotación estándar (Euler ZYX inverso)
  
  // Roll (Z-axis)
  const cr = Math.cos(-roll), sr = Math.sin(-roll)
  let x1 = dx * cr - dy * sr
  let y1 = dx * sr + dy * cr
  let z1 = dz

  // Pitch (X-axis)
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch)
  let x2 = x1
  let y2 = y1 * cp - z1 * sp
  let z2 = y1 * sp + z1 * cp

  // Yaw (Y-axis)
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw)
  return {
    x: x2 * cy + z2 * sy,
    y: y2,
    z: -x2 * sy + z2 * cy
  }
}
```

### 4.4 Presets de Orientación de Montaje

```typescript
// Mapeo de InstallationOrientation a ángulos base (grados)
const MOUNT_PRESETS: Record<InstallationOrientation, { pitch: number; yaw: number }> = {
  ceiling:     { pitch: -90, yaw: 0   },  // Colgado del techo, mira abajo
  floor:       { pitch:  90, yaw: 0   },  // En el suelo, mira arriba
  truss_front: { pitch: -90, yaw: 0   },  // En truss, misma dirección que audiencia
  truss_back:  { pitch: -90, yaw: 180 },  // En truss, mirando al fondo del escenario
}
```

Esto ya es consistente con los `INSTALLATION_PRESETS` del `FixturePhysicsDriver.ts` actual.

---

## 5. MODIFICACIÓN DEL PIPELINE

### 5.1 HAL: Flag `ikProcessed`

El `applyCalibrationOffsets` actual aplica invert, offset y tilt limits. Pero cuando el IK ya lo calculó, aplicar offsets e inverts de nuevo **corrompería** el resultado.

**Solución:** Un flag `ikProcessed` en el `FixtureState` que diga "este pan/tilt ya viene cocinado por el IK, solo aplicar tilt limits y clamp final".

```typescript
// En FixtureState (o donde se transporte el estado del fixture)
interface FixtureState {
  // ... campos existentes ...
  ikProcessed?: boolean  // true = pan/tilt calculado por IK, no aplicar offset/invert
}
```

```typescript
// HardwareAbstraction.ts — applyCalibrationOffsets modificado
private applyCalibrationOffsets(
  physicalPan: number,
  physicalTilt: number,
  fixture: PatchedFixture,
  ikProcessed: boolean = false  // <-- nuevo parámetro
): { pan: number; tilt: number } {
  let pan = physicalPan
  let tilt = physicalTilt

  if (!ikProcessed && fixture.calibration) {
    // STEP 1: INVERT (solo si NO viene de IK)
    if (fixture.calibration.panInvert) pan = 255 - pan
    if (fixture.calibration.tiltInvert) tilt = 255 - tilt

    // STEP 2: OFFSET (solo si NO viene de IK)
    if (fixture.calibration.panOffset && fixture.calibration.panOffset !== 0) {
      pan += (fixture.calibration.panOffset / 540) * 255
    }
    if (fixture.calibration.tiltOffset && fixture.calibration.tiltOffset !== 0) {
      tilt += (fixture.calibration.tiltOffset / 270) * 255
    }
  }

  // STEP 3: TILT LIMITS — se aplica SIEMPRE (seguridad)
  if (fixture.physics?.tiltLimits) {
    tilt = Math.max(fixture.physics.tiltLimits.min, Math.min(fixture.physics.tiltLimits.max, tilt))
  }

  // STEP 4: FINAL CLAMP — se aplica SIEMPRE
  pan = Math.max(0, Math.min(255, Math.round(pan)))
  tilt = Math.max(0, Math.min(255, Math.round(tilt)))

  return { pan, tilt }
}
```

### 5.2 MasterArbiter: Sin Cambios

El Arbiter recibe pan/tilt DMX como siempre. No le importa si vienen de XYPad, RadarXY o del motor IK. **Transparencia total.**

### 5.3 FixturePhysicsDriver: Sin Cambios

El Physics Driver interpola pan/tilt DMX como siempre. SNAP/CLASSIC siguen funcionando igual. El fixture se mueve suavemente al nuevo target IK. **Transparencia total.**

---

## 6. UI: `SpatialTargetPad`

### 6.1 Concepto

Reemplaza el `RadarXY.tsx` para control de grupo con un **mapa top-down del escenario** donde:

- Se ven los **fixtures como iconos** en sus posiciones reales (Position3D del ShowFile)
- Se ve el **target** como un punto arrastrable
- Al mover el target, **todos los fixtures del grupo rotan para apuntarlo**
- La línea de visión de cada fixture se dibuja como un rayo

### 6.2 Ubicación

```
electron-app/src/components/hyperion/controls/controls/SpatialTargetPad.tsx
```

### 6.3 Props

```typescript
interface SpatialTargetPadProps {
  // Fixtures del grupo activo (con posiciones reales)
  fixtures: Array<{
    id: string
    position: Position3D
    rotation: Rotation3D
    orientation: InstallationOrientation
    panRange?: number
    tiltRange?: number
  }>
  
  // Target actual
  target: SpatialTarget
  
  // Callback cuando el operador mueve el target
  onTargetChange: (target: SpatialTarget) => void
  
  // Dimensiones del escenario (para escalar la vista)
  stageDimensions: StageDimensions
  
  // Si mostrar las líneas de visión (rayos)
  showBeamRays?: boolean
}
```

### 6.4 Vistas

#### 6.4.1 Vista Top-Down (Principal)

```
┌─────────────────────────────────┐
│  FONDO DEL ESCENARIO (Z-)      │
│                                 │
│   [F1]─────────┐               │
│                 │               │
│   [F2]─────────┼──→ ⊕ Target   │
│                 │               │
│   [F3]─────────┘               │
│                                 │
│  FRENTE (Z+)  ─── Audiencia    │
└─────────────────────────────────┘
  ← X-                    X+ →
```

- **Eje horizontal:** X (Left/Right desde audiencia)
- **Eje vertical:** Z (Front/Back, frente = abajo)
- **Fixtures:** Iconos en sus posiciones X/Z reales
- **Target:** Punto arrastrable (⊕)
- **Rayos:** Líneas desde cada fixture al target (color = fixture color)

#### 6.4.2 Control de Altura (Lateral)

Un **slider vertical** al costado del pad, controlando el Y del target:

```
  Techo ──── ▲
             │
             │  ● Y = 2.5m
             │
  Suelo ──── ▼
```

El slider muestra la altura en metros. Range: 0m (suelo) a stageDimensions.height (techo).

#### 6.4.3 Vista de Sección (Opcional, Futuro)

Vista lateral (corte en XY o ZY) para visualizar la elevación del haz. No es prioritaria para V1.

### 6.5 Interacción

- **Drag del target:** El operador arrastra con el mouse/touch. RAF throttle a ~33 IPC/sec (mismo patrón que XYPad/RadarXY)
- **Click para posicionar:** Click en el mapa = mover target instantáneamente ahí
- **Scroll vertical en el pad:** Ajustar Y (altura) del target
- **Shift+Drag:** Mover target solo en eje X o Z (snap a eje)

### 6.6 Modo Individual vs Grupo

| Modo | Comportamiento |
|------|----------------|
| **Individual** | Un solo fixture. El target se mueve y el fixture lo sigue. Equivale al XYPad actual pero en espacio 3D |
| **Grupo** | Múltiples fixtures. Todos apuntan al mismo target. Cada uno calcula su pan/tilt independientemente |
| **Grupo + Fan** | Target "base" + vector de fanning espacial (ver Sección 7) |

### 6.7 Coexistencia con XYPad/RadarXY

El SpatialTargetPad **NO reemplaza** XYPad/RadarXY. Ambos coexisten:

- **XYPad/RadarXY:** Control mecánico directo (pan/tilt en grados). Siempre disponible. Modo "manual".
- **SpatialTargetPad:** Control espacial (target en metros). Disponible cuando fixtures tienen Position3D definida. Modo "IK".

El toggle será un botón en la UI: `⟨ GRADOS | SPATIAL ⟩`

Cuando el operador está en modo Spatial y cambia a Grados, se preserva la posición actual del fixture (no salta).

---

## 7. FANNING ESPACIAL

### 7.1 El Problema

El fanning actual distribuye grados:

```
fan = 0.5 → offset de ±X grados
```

Esto no crea patrones geométricos predecibles en el espacio. Un fan de 0.5 en pan puede hacer que fixtures en posiciones distintas apunten a sitios totalmente diferentes del escenario.

### 7.2 Fanning como Distribución de Targets

En el modelo espacial, el fan opera sobre **targets, no sobre ángulos**:

```
Fan = 0 → Todos apuntan al mismo target
Fan = 1 → Cada fixture apunta a un target distribuido según patrón
```

### 7.3 Patrones de Fanning Espacial

#### 7.3.1 Línea

Los targets se distribuyen en línea a lo largo de un eje:

```typescript
interface LineFan {
  type: 'line'
  axis: 'x' | 'z' | 'custom'  // eje de la línea
  spread: number               // separación total en metros
  angle?: number               // ángulo de la línea (si axis = 'custom')
}

// Para N fixtures:
// target[i] = baseTarget + (i - (N-1)/2) / (N-1) * spread * axisVector
```

**Resultado visual:** Todos los haces barren una línea en el suelo/pared.

#### 7.3.2 Círculo

Los targets se distribuyen en un círculo alrededor del target base:

```typescript
interface CircleFan {
  type: 'circle'
  radius: number  // metros
  plane: 'xz' | 'xy' | 'yz'  // plano del círculo
  phase: number   // rotación inicial (0-360°)
}

// Para N fixtures:
// angle = (2π × i / N) + degToRad(phase)
// target[i] = baseTarget + radius × (cos(angle), 0, sin(angle))  // para plano XZ
```

**Resultado visual:** Los haces dibujan un círculo en el suelo.

#### 7.3.3 Converge/Diverge

Variación del fan actual pero en espacio:

```typescript
interface ConvergeFan {
  type: 'converge'
  factor: number  // 0 = todos al target, 1 = máxima divergencia
}

// Para cada fixture:
// target[i] = lerp(baseTarget, fixture[i].position projected to target plane, factor)
```

**factor = 0:** Todos convergen al target (comportamiento IK base).  
**factor = 1:** Cada fixture apunta "recto hacia abajo" desde su posición.  
**factor = 0.5:** Punto medio — semi-convergencia.

### 7.4 API de Fanning Espacial

```typescript
interface SpatialFanConfig {
  pattern: LineFan | CircleFan | ConvergeFan
  animate?: {
    speed: number     // velocidad de rotación/movimiento del patrón (rpm o m/s)
    direction: 1 | -1 // sentido
  }
}

// InverseKinematicsEngine ampliado:
static solveGroupWithFan(
  fixtures: FixtureIKProfile[],
  baseTarget: SpatialTarget,
  fan: SpatialFanConfig
): Map<number, IKResult>
```

---

## 8. ANÁLISIS DE RIESGOS Y EDGE CASES

### 8.1 Gimbal Lock

**Cuándo ocurre:** Cuando el target está exactamente en el eje vertical del fixture (dx ≈ 0, dz ≈ 0). El pan se vuelve indeterminado (atan2(0, 0) = indefinido).

**Mitigación:**

```typescript
const EPSILON = 0.001  // 1mm
if (Math.abs(local.x) < EPSILON && Math.abs(local.z) < EPSILON) {
  // Target directamente arriba/abajo del fixture
  // Mantener el último pan conocido, solo ajustar tilt
  return { pan: lastKnownPan, tilt: computedTilt, reachable: true }
}
```

### 8.2 Pan Zero-Crossing (540° Wrap)

**El problema:** Pan tiene rango 0-540°. Cuando el target cruza de -180° a +180° en espacio local, el pan necesita cruzar de 0°→540° o viceversa, lo que causa un giro completo del fixture en vez de un movimiento mínimo.

**Mitigación:** 

```typescript
// Elegir la representación de panAngle que minimice el movimiento
// desde el pan actual
const panDeg1 = panAngle        // -180 a +180
const panDeg2 = panAngle + 360  // +180 a +540

const dmx1 = ((panDeg1 + (panRange / 2)) / panRange) * 255
const dmx2 = ((panDeg2 + (panRange / 2)) / panRange) * 255

// Elegir el que esté más cerca del pan actual
const delta1 = Math.abs(dmx1 - currentPan)
const delta2 = Math.abs(dmx2 - currentPan)

panDMX = delta1 <= delta2 ? dmx1 : dmx2
```

Esto requiere que el IK tenga acceso al **pan actual del fixture** para elegir el camino más corto. El `currentPan` se lee del `FixtureState` actual.

### 8.3 Target Inalcanzable

Cuando el target cae fuera del rango mecánico del fixture (por ejemplo, un fixture de ceiling con tiltLimits que no puede apuntar hacia su propia espalda).

**Mitigación:**

- `IKResult.reachable = false` → La UI muestra el rayo en rojo/punteado
- El fixture apunta al **punto más cercano alcanzable** (clamp al límite mecánico)
- **No se fuerza jamás** un valor fuera de tiltLimits

### 8.4 Fixtures sin Position3D

Si un fixture no tiene posición definida (Position3D = {0,0,0} por defecto), el IK producirá resultados incorrectos.

**Mitigación:**

- El SpatialTargetPad solo aparece como opción si **todos** los fixtures del grupo tienen Position3D definida con al menos un eje ≠ 0
- Fixtures sin posición quedan en modo mecánico (XYPad/RadarXY)

### 8.5 Precisión vs Realidad Mecánica

Los moving heads reales tienen juego mecánico, backlash, y desviación entre el ángulo teórico y el real. El IK calcula el ángulo perfecto, pero el fixture puede desviarse 2-5°.

**Mitigación:**

- Los `calibration.panOffset` y `calibration.tiltOffset` existentes compensan esta desviación
- El operador calibra una vez con el IK activo y los offsets se aplican en el cálculo IK
- **No se intenta auto-corrección** (requeriría feedback óptico, fuera de scope)

### 8.6 Conversión de 8-bit vs 16-bit Pan/Tilt

Muchos fixtures tienen canales `pan_fine` y `tilt_fine` para resolución de 16 bits. El IK actual calcula a 8-bit (0-255).

**Fase 1:** 8-bit (0-255). Suficiente para la mayoría de aplicaciones.  
**Fase 2 (futuro):** El IK calcula a float (0.0-1.0) y el pipeline lo convierte a 16-bit (0-65535) usando los canales fine. Requiere modificar `statesToDMXPackets` en HAL.

---

## 9. DATOS REQUERIDOS POR FIXTURE

Para que el IK funcione, cada fixture en el ShowFile necesita:

| Campo | ¿Existe? | ¿Es obligatorio? | Notas |
|-------|----------|-------------------|-------|
| `position: Position3D` | ✅ Sí | ✅ Sí | Debe reflejar la posición **real** en el venue |
| `rotation: Rotation3D` | ✅ Sí | ⚠️ Parcial | Necesaria si el fixture tiene rotación no-estándar |
| `physics.orientation` | ✅ Sí | ✅ Sí | ceiling/floor/truss determina la transformación base |
| `calibration.panOffset` | ✅ Sí | Opcional | Compensación de desviación mecánica |
| `calibration.tiltOffset` | ✅ Sí | Opcional | Compensación de desviación mecánica |
| `calibration.panInvert` | ✅ Sí | ✅ Sí | Algunas cabezas invierten el pan por montaje |
| `calibration.tiltInvert` | ✅ Sí | ✅ Sí | Idem para tilt |
| `physics.tiltLimits` | ✅ Sí | Opcional | Safety caps para proteger audiencia |
| `panRange` (grados) | ❌ No | Recomendado | Default 540° si falta. Leer del perfil del fixture |
| `tiltRange` (grados) | ❌ No | Recomendado | Default 270° si falta. Leer del perfil del fixture |

### 9.1 Campos Nuevos Necesarios

Solo **dos campos nuevos** en el perfil del fixture (no en ShowFileV2, que ya tiene todo lo necesario):

```typescript
// Añadir al FixtureProfile (librerias/*.fxt / *.json)
interface FixtureProfile {
  // ... campos existentes ...
  panRangeDegrees?: number   // Rango total de pan (default: 540)
  tiltRangeDegrees?: number  // Rango total de tilt (default: 270)
}
```

Estos valores vienen de la hoja de datos del fixture. Si faltan, se usan defaults de industria (540°/270°).

---

## 10. FASES DE IMPLEMENTACIÓN

### Fase 1: Motor IK Core (WAVE 2601-2610)

1. **WAVE 2601:** Crear `InverseKinematicsEngine.ts` con `solve()` y `solveGroup()`
2. **WAVE 2602:** Tests unitarios con fixtures en posiciones conocidas y targets predecibles
3. **WAVE 2603:** Integrar con HAL — flag `ikProcessed` en `applyCalibrationOffsets`
4. **WAVE 2604:** Wire: Conectar IK al MasterArbiter como fuente alternativa de pan/tilt

### Fase 2: UI SpatialTargetPad (WAVE 2611-2620)

5. **WAVE 2611:** Crear `SpatialTargetPad.tsx` — vista top-down con fixtures y target arrastrable
6. **WAVE 2612:** Slider de altura (Y)
7. **WAVE 2613:** Toggle GRADOS/SPATIAL en la UI
8. **WAVE 2614:** Rayos de visualización (líneas fixture→target)
9. **WAVE 2615:** Indicador de reachability (rayo rojo/punteado si inalcanzable)

### Fase 3: Fanning Espacial (WAVE 2621-2630)

10. **WAVE 2621:** `solveGroupWithFan()` — patrón Línea
11. **WAVE 2622:** Patrón Círculo
12. **WAVE 2623:** Patrón Converge/Diverge
13. **WAVE 2624:** UI de configuración de fan espacial en SpatialTargetPad
14. **WAVE 2625:** Animación de patrones de fan (rotación, ping-pong)

### Fase 4: Integración con Choreography (WAVE 2631-2640)

15. **WAVE 2631:** Los patrones del Golden Dozen generan targets espaciales en vez de pan/tilt
16. **WAVE 2632:** Titan AI emite targets en coordenadas de escenario
17. **WAVE 2633:** Effects engine puede modular targets (circular sweep → target orbital)

### Fase 5: Refinamiento (WAVE 2641-2650)

18. **WAVE 2641:** Pan zero-crossing optimization (shortest path)
19. **WAVE 2642:** Soporte 16-bit pan/tilt fine
20. **WAVE 2643:** Preset de targets reutilizables (spots del venue)

---

## 11. IMPACTO EN ARCHIVOS EXISTENTES

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `InverseKinematicsEngine.ts` | **NUEVO** | Motor IK core |
| `SpatialTargetPad.tsx` | **NUEVO** | UI de control espacial |
| `HardwareAbstraction.ts` | MODIFICADO | `applyCalibrationOffsets` recibe flag `ikProcessed` |
| `ShowFileV2.ts` | SIN CAMBIOS | Ya tiene Position3D, Rotation3D, PhysicsProfile |
| `FixturePhysicsDriver.ts` | SIN CAMBIOS | Sigue interpolando DMX 0-255 |
| `MasterArbiter` | SIN CAMBIOS | Recibe DMX como siempre |
| `RadarXY.tsx` | SIN CAMBIOS | Sigue existiendo para modo mecánico |
| `XYPad.tsx` | SIN CAMBIOS | Sigue existiendo para modo mecánico |
| `FixtureProfile` types | MODIFICADO | Añadir `panRangeDegrees`, `tiltRangeDegrees` |

**Solo 1 archivo existente modificado (HAL), 1 tipo ampliado, 2 archivos nuevos.**

---

## 12. PRINCIPIOS DE DISEÑO

1. **El IK se inserta, no reemplaza.** El pipeline existente sigue funcionando. El IK es una nueva fuente de pan/tilt, no un nuevo pipeline.

2. **Transparencia hacia abajo.** MasterArbiter y FixturePhysicsDriver no saben ni les importa si el pan/tilt viene de un pad mecánico o del IK.

3. **Determinismo absoluto.** Misma posición de fixture + mismo target = mismo pan/tilt. Siempre. Sin aleatorios, sin heurísticas. (Axioma Anti-Simulación)

4. **Degrada con gracia.** Si un fixture no tiene Position3D, se queda en modo mecánico. No se rompe nada.

5. **La calibración se aplica UNA vez.** O la aplica el IK (modo spatial), o la aplica HAL (modo mecánico). Nunca ambos.

6. **La seguridad manda.** Los tiltLimits se aplican SIEMPRE, venga de donde venga el pan/tilt. Un fixture nunca apunta a la audiencia.

---

*"No le dices al fixture a cuántos grados girar. Le dices dónde mirar."*  
— PunkOpus, WAVE 2600
