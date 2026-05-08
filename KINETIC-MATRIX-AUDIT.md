# WAVE 4617-A — THE KINETIC MATRIX
## Auditoría Forense: Mapeo de Transición Classic vs IK y Matemáticas de Inercia

**Estado**: SOLO LECTURA FORENSE (ZERO CODE MUTATION)  
**Auditor**: Cascade / Kimi  
**Fecha**: 2026-05-07  
**Scope**: NodeResolver.ts, TitanOrchestrator.ts, KineticAdapter.ts, PhysicsPostProcessor.ts, AetherUIProjector.ts, useFixture3DData.ts, HyperionMovingHead3D.tsx, VibeMovementManager.ts, InverseKinematicsEngine.ts  

---

## EXECUTIVE SUMMARY

Se identificaron **tres fallos estructurales independientes** en la cadena cinemática:

1. **Switch de Motores Fracturado**: La decisión entre IK y clásico depende únicamente de la **presencia o ausencia del canal `targetX`** en el ArbitratedNodeMap. `isPlaced` NO interviene. Esto permite que un fixture KINETIC sin `targetX` (por ejemplo, por un override manual de `pan`/`tilt`) caiga en el flujo clásico frame a frame, mientras que con `targetX` va por IK, produciendo saltos de comportamiento.

2. **Traducción VMM→Espacial Sin Contexto de Escenario**: El VMM emite coordenadas abstractas `[-1,+1]`, pero el KineticAdapter las proyecta linealmente a metros usando `stageBounds`. El VMM no conoce el tamaño real del escenario, por lo que un patrón idéntico genera targets a 3m en un escenario de 12m y a 1m en uno de 4m. La percepción de velocidad del patrón cambia drásticamente con el escenario.

3. **Inercia Espacial con Factor Fijo Roto**: PhysicsPostProcessor aplica inercia sobre el **vector 3D (XYZ) en metros ANTES del IK**, usando `DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270`. Este factor asume que 270°/s de rotación pan equivalen a 4.0 m/s de barrido lateral, independientemente de la altura del fixture y la distancia al target. En un escenario grande (12m), la inercia sub-amortigua el movimiento (lento); en uno pequeño (4m), no amortigua suficiente (errático).

4. **Retorno a UI: Lectura Correcta pero con 1 Frame de Lag**: La UI lee `node.currentPosition.pan/tilt` (actualizado por NodeResolver) vía AetherUIProjector → hotFrame → transientStore → HyperionMovingHead3D.useFrame(). Los valores son los resultados finales interpolados por inercia, no los targets crudos. Sin embargo, AetherUIProjector corre **antes** de `resolve()` en el frame loop, por lo que la UI siempre muestra el estado del **frame N-1** (lag de 1 frame a 44Hz, ~23ms).

---

## 1. MISIÓN 1 — EL SWITCH DE MOTORES (CLASSIC vs SPATIAL)

### 1.1 Punto de Decisión en NodeResolver.ts

La frontera entre flujo IK y flujo clásico está en `NodeResolver._writeNode()`, líneas 506-516:

```typescript
// NodeResolver.ts L506-L516
if (channelValues[CH_TARGET_X] !== undefined && node.family === NodeFamily.KINETIC) {
  const kineticNode = node as IKineticNodeData
  if (!kineticNode.isContinuous) {
    this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, writeToDmx)
  }
  return  // nodo continuo (fan/mirrorball) ignora IK de apuntado
}
```

**Condición exacta**: `channelValues['targetX'] !== undefined && node.family === NodeFamily.KINETIC && !node.isContinuous`

**NO hay chequeo de `isPlaced`**. La decisión es puramente por presencia del canal espacial `targetX` en el mapa arbitrado.

### 1.2 Tabla de Decisión

| Condición | Canal `targetX` presente | `isPlaced` | Resultado |
|-----------|-------------------------|------------|-----------|
| Fixture KINETIC, no continuo | Sí | `true` o `false` | **IK path** (`_writeNodeIK`) |
| Fixture KINETIC, no continuo | No | `true` o `false` | **Classic path** (pan/tilt directo del arbitrated map) |
| Fixture KINETIC, continuo (fan/mirrorball) | — | — | **Ignorado** (return, no IK ni clásico) |
| Fixture no-KINETIC | — | — | **Classic path** (canal por canal) |

### 1.3 Colisión: IK vs Classic en el Mismo Fixture

**Escenario de colisión**:
- Frame N: KineticAdapter emite `targetX=2.0, targetY=1.5, targetZ=1.0` → NodeResolver va por IK → fixture apunta a coordenada espacial.
- Frame N+1: Un adapter legacy o un override manual emite `pan=0.3, tilt=0.7` (sin `targetX`) → NodeArbiter hace LTP (last-takes-priority) por canal. Si `targetX` no está en el mapa arbitrado (porque el otro adapter no lo emitió), NodeResolver cae al **classic path**.
- El fixture pasa de apuntar a un punto 3D (IK) a interpretar `pan`/`tilt` como DMX normalizado directo. Si `pan=0.3` es un valor normalizado [0-1], el fixture salta bruscamente.

**Root cause**: El bus de intents es **por canal**, no por familia de flujo. No existe un flag "este nodo debe ir por IK este frame". Si `targetX` falta por cualquier razón (bug de adapter, race condition, manual override que solo emite pan/tilt), el fixture cae al flujo clásico sin advertencia.

### 1.4 Puntos de Choque

| Punto | Archivo | Línea | Problema |
|-------|---------|-------|----------|
| Decisión por canal, no por fixture | NodeResolver.ts | L510 | `channelValues[CH_TARGET_X] !== undefined` es una condición frágil |
| `isPlaced` no afecta path | NodeResolver.ts | — | Un fixture `isPlaced=false` con `targetX` va por IK igual |
| Race condition LTP | NodeArbiter.ts | — | Adapter que emite solo pan/tilt puede "ganar" y eliminar targetX |
| Classic path no sabe de IK | NodeResolver.ts | L543-L620 | Si cae a clásico, aplica TransferCurve + calibration a pan/tilt como si fueran DMX normalizado, sin awareness de que el fixture es "placable" |

---

## 2. MISIÓN 2 — TRADUCCIÓN VMM → IK (GRADOS A METROS)

### 2.1 Origen de las Coordenadas: VibeMovementManager.generateIntent()

El VMM **NO emite grados**. Emite coordenadas abstractas `[-1, +1]`:

```typescript
// VibeMovementManager.ts L45-L62
export interface MovementIntent {
  x: number        // [-1 a +1] — abstracto
  y: number        // [-1 a +1] — abstracto
  pattern: string
  speed: number    // [0-1]
  amplitude: number // [0-1]
}
```

Los patrones (scan_x, square, diamond, etc.) retornan `x` e `y` en este rango abstracto. Ejemplo:

```typescript
// VibeMovementManager.ts L256-L261
scan_x: (phase, audio, index = 0, total = 1) => {
  const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 0.5
  return {
    x: Math.sin(phase + fixtureOffset),
    y: Math.sin((phase + fixtureOffset) * 2) * 0.45,
  }
}
```

La pregunta del usuario sobre "Pan: -96, Tilt: -66" **NO corresponde al VMM actual**. Es posible que:
- Sea una interpretación del operador del valor DMX (128-96=32, 128-66=62)
- Provenga de un sistema legacy o manual override que emite grados/offset
- Sea un valor intermedio del FixturePhysicsDriver legacy

En el pipeline Aether actual, **no existen grados entre el VMM y el KineticAdapter**.

### 2.2 Traducción: KineticAdapter.ts — Proyección Holográfica

```typescript
// KineticAdapter.ts L230-L249
if (node.isContinuous) {
  // FLUJO LEGACY: rotación continua (fan, mirror ball)
  let rotation = (intent.x + 1) * 0.5   // [-1,+1] → [0,1]
  ...
} else {
  // FLUJO IK: proyección holográfica → canales espaciales
  const projectedX = intent.x * halfW          // halfW = stageBounds.width / 2
  const projectedY = centerY + intent.y * halfH // halfH = stageBounds.height / 2
  const projectedZ = halfD                     // halfD = stageBounds.depth / 2

  const targetX = clamp(projectedX, -halfW, halfW)
  const targetY = clamp(projectedY, 0, height)
  const targetZ = clamp(projectedZ, -halfD, halfD)

  this._valuesDict['targetX'] = targetX
  this._valuesDict['targetY'] = targetY
  this._valuesDict['targetZ'] = targetZ
  this._valuesDict['speed']   = BaseSystem.clamp01(intent.speed)
}
```

**Fórmula matemática actual**:
- `TargetX = x × (width / 2)`  [metros, eje horizontal]
- `TargetY = centerY + y × (height / 2)` [metros, eje vertical]
- `TargetZ = depth / 2` [metros, plano frontal fijo]

**Fallback si no hay stageBounds**:
```typescript
// KineticAdapter.ts L73-L78
const DEFAULT_STAGE_BOUNDS = {
  width: 8.0,
  height: 4.0,
  depth: 2.0,
  centerY: 1.5,
} as const
```

### 2.3 Evaluación de Coherencia con StageBounds

**Problema**: El VMM no conoce `stageBounds`. Es un generador de patrones abstractos que opera en `[-1,+1]`. El KineticAdapter aplica una **proyección lineal pura** sin compensación por el escenario.

**Consecuencias**:

| Escenario Real | width | halfW | VMM intent.x=0.5 | TargetX resultante | Percepción de Velocidad |
|----------------|-------|-------|------------------|---------------------|------------------------|
| Pequeño club | 4m | 2m | 0.5 | 1.0m | Patrón "comprimido", movimientos cortos |
| Medio teatro | 8m | 4m | 0.5 | 2.0m | Patrón "estándar" |
| Gran estadio | 16m | 8m | 0.5 | 4.0m | Patrón "expandido", movimientos amplios |

La velocidad angular del motor (grados/segundo) es la misma en los tres escenarios, pero el arco que barre en el espacio real es proporcional al tamaño del escenario. Un patrón `scan_x` en un estadio de 16m produce un barrido de 8m de lado a lado; en un club de 4m, solo 2m. La inercia (siguiente misión) no compensa esto, por lo que el movimiento se siente "lento" en escenarios grandes y "rápido/estrecho" en escenarios pequeños.

**Además**: `TargetZ = depth / 2` es **fijo** para todos los fixtures. Todos apuntan al mismo plano frontal, independientemente de su posición lateral (X). Un fixture en X=-4m y otro en X=+4m apuntan ambos a Z=1m (si depth=2m), pero el ángulo de pan necesario para alcanzar el mismo target es diferente. Esto es correcto para el IK, pero significa que el VMM no controla la profundidad del target — es siempre el centro del escenario en Z.

### 2.4 Pipeline Completo de Unidades

```
VMM.generateIntent()
  → x ∈ [-1, +1] (abstracto)
  → y ∈ [-1, +1] (abstracto)

KineticAdapter.process()
  → targetX = x * (width/2)  [metros]
  → targetY = centerY + y * (height/2) [metros]
  → targetZ = depth/2 [metros]

NodeArbiter.arbitrate()
  → Mapa arbitrado con canales en metros

PhysicsPostProcessor.process()  [MISIÓN 3]
  → Suaviza targetX/Y/Z en metros (inercia espacial)

NodeResolver._writeNodeIK()
  → solve(profile, {x: tx, y: ty, z: tz}, currentPanDMX)
  → Retorna pan/tilt en DMX [0-255]
```

**No hay colisión de unidades** en el pipeline principal. Todos los módulos entre KineticAdapter y NodeResolver usan metros para posición 3D. La colisión está en la **inercia** (Misión 3), donde se mezclan grados/s con metros/s.

---

## 3. MISIÓN 3 — EL CUELLO DE BOTELLA DE LA INERCIA (PhysicsPostProcessor)

### 3.1 Posición en el Pipeline

```
Frame N:
  1. Adapters (KineticAdapter, etc.) → emiten intents al bus
  2. NodeArbiter.arbitrate() → arbitrated Map<NodeId, channels>
  3. [PHYSICS POST-PROCESSOR] → muta in-place targetX/Y/Z o pan/tilt
  4. AetherUIProjector.project() → lee currentPosition (frame N-1)
  5. NodeResolver.resolve(arbitrated) → resuelve IK con valores suavizados
```

**Crítico**: PhysicsPostProcessor procesa **inercia sobre el vector 3D (XYZ) en metros ANTES de que NodeResolver llame a `solve()`**. Esto significa que el IK recibe targets espaciales ya suavizados, no los targets instantáneos del VMM.

### 3.2 Algoritmo de Inercia Espacial 3D

```typescript
// PhysicsPostProcessor.ts L292-L324
if (entry['targetX'] !== undefined) {
  const xT = entry['targetX']
  const yT = entry['targetY']
  const zT = entry['targetZ']

  // Conversión de velocidad angular a lineal
  this._maxVel3dMs  = Math.min(
    node.maxPanSpeed * DEG_PER_SEC_TO_METERS_PER_SEC,
    SAFETY_MAX_3D_VEL_MS
  )
  this._maxAcc3dMs2 = Math.min(this._maxVel3dMs * 4, SAFETY_MAX_3D_ACC_MS2)

  // MODO CLASSIC (curva-S) para cada eje
  this._applyClassicAxis(state, SLOT_X3D_POS, SLOT_X3D_VEL, this._x3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)
  this._applyClassicAxis(state, SLOT_Y3D_POS, SLOT_Y3D_VEL, this._y3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)
  this._applyClassicAxis(state, SLOT_Z3D_POS, SLOT_Z3D_VEL, this._z3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)

  // Escribe los valores suavizados de vuelta al arbitrated map
  entry['targetX'] = state[SLOT_X3D_POS]
  entry['targetY'] = state[SLOT_Y3D_POS]
  entry['targetZ'] = state[SLOT_Z3D_POS]
}
```

### 3.3 El Factor Fijo Roto: `DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270`

```typescript
// PhysicsPostProcessor.ts L86-L88
/**
 * Conversión deg/s → m/s para el espacio 3D del escenario.
 * Calibrado para un escenario de 8m: a 270 deg/s → ~4 m/s de barrido lateral.
 */
const DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270  // ≈ 0.01481
```

**Cálculo**: 270°/s de velocidad angular pan × factor = 4.0 m/s de barrido lateral.

**Por qué está roto**:

1. **Asume escenario de 8m fijo**: El comentario dice "calibrado para un escenario de 8m". Si el escenario real es de 4m, el mismo ángulo de pan barre 2m de lateral (radio menor). Si es de 16m, barre 8m. El factor `4.0/270` ignora el radio real.

2. **No considera la altura del fixture**: Un fixture a 3m de altura (floor mount) tiene un radio de gizo menor que uno a 6m (truss). La misma velocidad angular produce menos metros/segundo de barrido a menor altura.

3. **No considera la distancia al target**: Si el target está a 1m del fixture (Z cercano), el mismo delta de pan cubre pocos metros. Si está a 10m, cubre muchos metros. La velocidad máxima en m/s debería depender de la distancia al target.

4. **Aplica la misma velocidad a los 3 ejes**: `maxPanSpeed` (generalmente mayor que `maxTiltSpeed`) se usa para limitar X, Y, Z por igual. Pero:
   - X (pan) tiene rango mecánico típico de 540°
   - Y (tilt) tiene rango típico de 270°
   - Z (profundidad) no es un eje mecánico real — es una coordenada espacial
   Usar `maxPanSpeed` para limitar Z es físicamente incorrecto.

5. **No usa `maxTiltSpeed` para el eje Y**: Aunque `_applyClassicAxis` acepta `maxVel` por eje, la llamada para 3D usa `this._maxVel3dMs` para los 3 ejes. No diferencia pan (X) de tilt (Y).

### 3.4 Cálculo de Delta de Velocidad (Modo Classic)

```typescript
// PhysicsPostProcessor.ts L487-L538 (_applyClassicAxis)
const delta = target - pos
const absDelta = Math.abs(delta)

// Distancia de frenado = v² / (2 * maxAcc)
this._brakeDist = (vel * vel) / (2 * maxAcc + 0.000001)

if (absDelta > this._brakeDist) {
  // Fase de aceleración
  vel += sign * maxAcc * this._dt
} else {
  // Fase de frenado
  vel -= sign * maxAcc * this._dt
}

// Clamp de velocidad máxima
vel = clampAbs(vel, maxVel)

// Integrar posición
pos += vel * this._dt
```

**Problema**: La distancia de frenado se calcula en **metros** (porque `pos` y `target` están en metros), pero `maxVel` se deriva de **grados/segundo convertidos a metros/segundo con un factor fijo**.

En un escenario de 16m (`halfW=8m`), un target en X puede saltar de -8m a +8m (delta=16m). Con `maxVel3dMs` limitado a ~2.0 m/s (para un motor de 540°/s), el tiempo de viaje es ~8 segundos. El patrón VMM produce un ciclo completo en ~4-8 compases (8-16 segundos a 120 BPM), pero la inercia espacial no permite que el cabezal alcance los extremos antes de que el patrón cambie de dirección.

**Resultado**: El fixture nunca alcanza los targets extremos del patrón. Se mueve en una "caja de inercia" mucho más pequeña que el escenario real, haciendo que los patrones se vean "lentos y comprimidos".

### 3.5 MODO SNAP (Alternativa)

```typescript
// PhysicsPostProcessor.ts L304-L314
if (this._mode === 'snap') {
  const maxMove = this._maxVel3dMs * this._dt
  const dxSnap  = this._snapFactor * (this._x3dTarget - state[SLOT_X3D_POS])
  ...
  state[SLOT_X3D_POS] += clampAbs(Math.abs(dxSnap) < JITTER_THRESHOLD ? 0 : dxSnap, maxMove)
}
```

En modo snap, el fixture se mueve una fracción (`snapFactor`, default 0.5) de la distancia al target por frame, clampeada por `maxMove`. Con el factor de conversión roto, `maxMove` es demasiado pequeño para escenarios grandes, causando que el fixture "arrastre" detrás del target sin alcanzarlo nunca.

### 3.6 Orden de Procesamiento: Inercia ANTES de IK

**Confirmado**: PhysicsPostProcessor muta `entry['targetX/Y/Z']` in-place. NodeResolver recibe estos valores suavizados y los pasa directamente a `solve()`:

```typescript
// NodeResolver.ts L639-L646
const tx = channelValues[CH_TARGET_X]!   // Ya suavizado por PhysicsPostProcessor
const ty = channelValues[CH_TARGET_Y] ?? 1.5
const tz = channelValues[CH_TARGET_Z] ?? 2.0

const ikResult = solve(profile, { x: tx, y: ty, z: tz }, currentPanDMX)
```

**Esto es correcto arquitectónicamente**: Suavizar en espacio 3D (antes de IK) evita que la inercia opere sobre ángulos DMX, donde el wrap-around de pan (540° con centro en 270°) causaría saltos. Sin embargo, la conversión grados→metros está rota.

### 3.7 Puntos de Choque

| Punto | Archivo | Línea | Problema |
|-------|---------|-------|----------|
| Factor fijo 4.0/270 | PhysicsPostProcessor.ts | L88 | Asume escenario 8m, ignora altura y distancia al target |
| maxPanSpeed para 3 ejes | PhysicsPostProcessor.ts | L301 | Usa maxPanSpeed para X, Y, Z sin diferenciar |
| No usa stageBounds en physics | PhysicsPostProcessor.ts | — | La velocidad máxima en m/s es constante, independiente del tamaño del escenario |
| maxAcc = maxVel * 4 | PhysicsPostProcessor.ts | L302 | Relación fija sin base física |
| targetZ fijo (depth/2) | KineticAdapter.ts | L245 | El VMM no controla profundidad; todos los fixtures apuntan al mismo plano Z |

---

## 4. MISIÓN 4 — RETORNO A LA UI (THE FEEDBACK LOOP)

### 4.1 Pipeline Completo UI

```
NodeResolver._writeNodeIK()
  → node.currentPosition.pan = safePan / 255   [L682]
  → node.currentPosition.tilt = safeTilt / 255  [L683]

AetherUIProjector.project(fixtureStates, graph, arbitrated)
  → fixture.pan = toDmx(kn.currentPosition.pan ?? 0.5)   [L76]
  → fixture.tilt = toDmx(kn.currentPosition.tilt ?? 0.5) [L77]

TitanOrchestrator.emitHotFrame()
  → hotFrame.fixtures[i] = {
       pan: f.pan / 255,
       tilt: f.tilt / 255,
       physicalPan: (f.physicalPan ?? f.pan) / 255,
       physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
     }

IPC → Renderer

transientStore.injectHotFrame(hotFrame)
  → mutable.dimmer = hot.dimmer
  → mutable.pan = hot.pan
  → mutable.physicalPan = hot.physicalPan

HyperionMovingHead3D.useFrame()
  → const fixtureState = getTransientFixture(fixtureId)
  → let livePan = fixtureState.physicalPan ?? fixtureState.pan ?? 0.5
  → let liveTilt = fixtureState.physicalTilt ?? fixtureState.tilt ?? 0.5
  → // Exponential smoothing
  → smoothPan.current += (livePan - smoothPan.current) * VISUAL_SMOOTH
  → // Convert to radians
  → panAngle = (smoothPan.current - 0.5) * PAN_RANGE
```

### 4.2 Confirmación: ¿UI Lee el Resultado Interpolado?

**SÍ**. La UI lee `physicalPan`/`physicalTilt` del transientStore, que provienen de `node.currentPosition.pan/tilt` (actualizado por NodeResolver), NO del target crudo del VMM.

La cadena de valores es:
1. **VMM target** (abstracto [-1,+1]) → KineticAdapter lo proyecta a metros
2. **PhysicsPostProcessor** suaviza los metros (inercia)
3. **NodeResolver._writeNodeIK** resuelve IK con metros suavizados → obtiene pan/tilt DMX
4. **AetherUIProjector** lee `currentPosition.pan/tilt` (DMX normalizado [0-1]) del NodeGraph
5. **HotFrame** propaga estos valores al renderer
6. **HyperionMovingHead3D** lee del transientStore y aplica smoothing visual adicional

**El valor que renderiza la UI es el resultado final post-inercia-post-IK**, no el target crudo.

### 4.3 Lag de 1 Frame

**Problema menor pero confirmado**: En el frame loop de TitanOrchestrator.ts:

```typescript
// TitanOrchestrator.ts L1871-L1883
this._physicsPostProcessor.process(arbitrated, this._aetherGraph, this._aetherCtx.deltaMs, this._aetherCtx.vibe.name)

// UI projector corre ANTES de resolve()
this._aetherUIProjector.project(fixtureStates, this._aetherGraph, arbitrated)
emitHotFrame()

// ... luego ...
aetherResolver.resolve(arbitrated)  // Aquí se actualiza node.currentPosition
```

`AetherUIProjector.project()` lee `kn.currentPosition.pan` del NodeGraph. Este valor fue actualizado en el **frame N-1** por `NodeResolver.resolve()` del frame anterior. El `resolve()` del frame N (que actualiza `currentPosition` con los nuevos valores) ocurre **después** del `project()`.

**Impacto**: La UI siempre muestra el estado del frame anterior (lag de ~23ms a 44Hz). Esto es imperceptible visualmente, pero significa que `emitHotFrame()` envía datos que son 1 frame atrasados respecto al cálculo actual del motor.

### 4.4 Puntos de Choque

| Punto | Archivo | Línea | Problema |
|-------|---------|-------|----------|
| UI lee frame N-1 | TitanOrchestrator.ts | L1882 | `project()` antes de `resolve()` causa 1 frame de lag |
| physicalPan fallback | TitanOrchestrator.ts | L1642 | `f.physicalPan ?? f.pan` — AetherUIProjector no escribe `physicalPan`, siempre fallback a `pan` |
| Doble smoothing | HyperionMovingHead3D.tsx | L299 | PhysicsPostProcessor ya suavizó; Hyperion aplica VISUAL_SMOOTH=0.35 adicional |
| Manual override visual lock | HyperionMovingHead3D.tsx | L262 | Si `manualOverrideFixtureIds` tiene el fixture, ignora transient pan/tilt y lee del programmerStore |

---

## 5. MAPA MATEMÁTICO DEL FLUJO DE MOVIMIENTO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VMM.generateIntent(vibeId, audio, stereoIndex)                            │
│  → x, y ∈ [-1, +1]  (COORDENADAS ABSTRACTAS, NO GRADOS)                    │
│  → amplitudeScale ∈ [0.12, 0.70] según vibe                                │
│  → patternPeriod ∈ [8, 256] beats                                          │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  KineticAdapter.process(nodes, context, bus)                                 │
│                                                                               │
│  Para nodos NO continuos (isContinuous=false):                               │
│    halfW = stageBounds.width / 2    (default: 4.0m)                         │
│    halfH = stageBounds.height / 2   (default: 2.0m)                         │
│    halfD = stageBounds.depth / 2    (default: 1.0m)                         │
│                                                                               │
│    targetX = clamp(intent.x * halfW, -halfW, halfW)        [METROS]          │
│    targetY = clamp(centerY + intent.y * halfH, 0, height)  [METROS]          │
│    targetZ = clamp(halfD, -halfD, halfD)                   [METROS] ← FIJO   │
│                                                                               │
│  Para nodos continuos (fan/mirrorball):                                      │
│    rotation = (intent.x + 1) * 0.5  [0-1 normalizado]                       │
│    speed    = intent.speed          [0-1 normalizado]                        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  NodeArbiter.arbitrate() → LTP por canal                                     │
│  Si targetX presente: Map[nodeId] = {targetX, targetY, targetZ, speed}        │
│  Si NO presente:     Map[nodeId] = {pan, tilt} (flujo clásico)              │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  PhysicsPostProcessor.process(arbitrated, nodeGraph, deltaMs, vibeId)        │
│                                                                               │
│  MODO CLASSIC (default):                                                      │
│    Para cada eje (X, Y, Z):                                                  │
│      delta = target - pos                                                    │
│      brakeDist = vel² / (2 * maxAcc)                                         │
│      if |delta| > brakeDist → acelerar                                       │
│      else → frenar                                                           │
│      vel = clampAbs(vel, maxVel)                                             │
│      pos += vel * dt                                                         │
│                                                                               │
│  CONSTANTES ROTO:                                                            │
│    DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270  ≈ 0.01481                    │
│    maxVel3dMs = min(maxPanSpeed * 0.01481, 5.0)   [m/s]                      │
│    maxAcc3dMs2 = min(maxVel3dMs * 4, 20.0)       [m/s²]                     │
│                                                                               │
│  MUTA in-place: entry['targetX'] = smoothedX                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  NodeResolver._writeNode(nodeId, channelValues)                            │
│                                                                               │
│  DECISIÓN:                                                                   │
│    if (channelValues['targetX'] !== undefined && family === KINETIC)         │
│      → _writeNodeIK()  (flujo espacial)                                      │
│    else                                                                      │
│      → flujo clásico pan/tilt directo (canal por canal)                     │
│                                                                               │
│  _writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration):       │
│    tx = channelValues['targetX']   ← YA SUAVIZADO (metros)                  │
│    ty = channelValues['targetY']   ← YA SUAVIZADO (metros)                  │
│    tz = channelValues['targetZ']   ← YA SUAVIZADO (metros)                  │
│                                                                               │
│    currentPanDMX = node.currentPosition.pan * 255  ← HINT del frame N-1     │
│    ikResult = solve(profile, {x:tx, y:ty, z:tz}, currentPanDMX)            │
│                                                                               │
│    safePan  = sm.clampKineticVelocity(nodeId, ikResult.pan, ...)            │
│    safeTilt = sm.applyAirbag(safeTilt, false)                                │
│                                                                               │
│    node.currentPosition.pan  = safePan / 255    [0-1] ← WRITE-BACK           │
│    node.currentPosition.tilt = safeTilt / 255   [0-1] ← WRITE-BACK          │
│                                                                               │
│    if (writeToDmx)                                                           │
│      buf[panOffset]  = safePan   [DMX 0-255]                                │
│      buf[tiltOffset] = safeTilt  [DMX 0-255]                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  AetherUIProjector.project(fixtureStates, graph, arbitrated)                 │
│  → Lee node.currentPosition.pan/tilt (frame N-1 porque resolve() no corrió) │
│  → fixture.pan  = round(clamp(pan, 0, 1) * 255)                            │
│  → fixture.tilt = round(clamp(tilt, 0, 1) * 255)                            │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  TitanOrchestrator.emitHotFrame()                                            │
│  → physicalPan  = (fixture.physicalPan ?? fixture.pan) / 255                 │
│  → physicalTilt = (fixture.physicalTilt ?? fixture.tilt) / 255               │
│  → IPC al renderer                                                           │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  transientStore.injectHotFrame(hotFrame)                                     │
│  → mutable.physicalPan = hot.physicalPan                                     │
│  → mutable.physicalTilt = hot.physicalTilt                                   │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────────────┐
│  HyperionMovingHead3D.useFrame()                                             │
│  → fixtureState = getTransientFixture(fixtureId)                             │
│  → livePan  = fixtureState.physicalPan ?? fixtureState.pan ?? 0.5            │
│  → liveTilt = fixtureState.physicalTilt ?? fixtureState.tilt ?? 0.5          │
│                                                                               │
│  // Visual smoothing adicional                                               │
│  → smoothPan  += (livePan - smoothPan) * VISUAL_SMOOTH  (0.35)              │
│  → smoothTilt += (liveTilt - smoothTilt) * VISUAL_SMOOTH (0.35)              │
│                                                                               │
│  // Convert to radians for quaternion                                         │
│  → panAngle  = (smoothPan - 0.5) * PAN_RANGE   (±135° = ±2.356 rad)       │
│  → tiltAngle = -(smoothTilt - 0.5) * TILT_RANGE + TILT_REST_ANGLE           │
│               = -(smoothTilt - 0.5) * 2.356 + 0.785                           │
│                                                                               │
│  → yokeQuat.setFromAxisAngle(PAN_AXIS, panAngle)                             │
│  → headQuat.setFromAxisAngle(TILT_AXIS, tiltAngle)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. FÓRMULAS ROTAS Y CUELLOS DE BOTELLA

### 6.1 Fórmula Rota #1: Conversión Grados→Metros

```
DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270  ≈ 0.01481
maxVel3dMs = min(maxPanSpeed * 0.01481, 5.0)
```

**Asunción implícita**: Todos los fixtures están en un escenario de 8m de ancho, a una altura donde 270°/s de pan equivalen a 4.0 m/s de barrido lateral.

**Fórmula correcta (teórica)**:
```
// Para un fixture en posición (fx, fy, fz) apuntando a target (tx, ty, tz):
distance = sqrt((tx-fx)² + (tz-fz)²)  // distancia horizontal al target
maxVelMs = maxPanSpeed * (π/180) * distance  // v = ω * r
```

Esto haría que la velocidad lineal máxima dependa de la distancia al target. Un fixture cerca del target se movería lentamente en metros/segundo; uno lejos, rápidamente (pero con el mismo ángulo angular).

### 6.2 Fórmula Rota #2: Inercia Sin Awareness de StageBounds

```
// KineticAdapter: targetX ∈ [-halfW, +halfW]
// PhysicsPostProcessor: maxVel3dMs = constante (depende solo de maxPanSpeed)

// En escenario de 16m: halfW = 8m
// targetX puede saltar de -8m a +8m (delta = 16m)
// Con maxVel3dMs ≈ 2.0 m/s (para motor 540°/s):
//   tiempo mínimo para cruzar = 16m / 2.0m/s = 8 segundos
//   patrón scan_x tiene periodo de 8 beats ≈ 4s @ 120BPM
//   → EL FIXTURE NUNCA ALCANZA LOS EXTREMOS DEL PATRÓN
```

### 6.3 Fórmula Rota #3: targetZ Fijo

```
// KineticAdapter.ts L245
const projectedZ = halfD   // SIEMPRE el centro del escenario en Z
```

Todos los fixtures apuntan al mismo plano Z, independientemente de su posición lateral. El VMM no controla la profundidad del target. Esto significa que un fixture en el lateral izquierdo (X=-4m) y uno en el lateral derecho (X=+4m) apuntan ambos a Z=1m (si depth=2m). El IK calcula los ángulos correctos, pero el "punto de interés" del patrón es siempre el centro del escenario en profundidad.

### 6.4 Cuello de Botella: Doble Suavizado

```
VMM target (instantáneo)
  → PhysicsPostProcessor (inercia espacial, modo classic)  [SUAVIZADO 1]
  → NodeResolver.solve() (IK, resultado angular)
  → AetherUIProjector (lectura de currentPosition)
  → HyperionMovingHead3D.useFrame() (VISUAL_SMOOTH=0.35)   [SUAVIZADO 2]
```

El doble suavizado no es inherentemente malo, pero el primero (PhysicsPostProcessor) está mal calibrado, por lo que el segundo (Hyperion) suaviza sobre una señal ya distorsionada.

---

## 7. RECOMENDACIONES DE REMEDIACIÓN (ZERO CODE MUTATION — SOLO DOCUMENTACIÓN)

### 7.1 Switch de Motores

1. **Agregar un flag explícito de modo cinemático** al nodo KINETIC (por ejemplo, `kineticMode: 'spatial' | 'classic'`), establecido en patch-time según `isPlaced` y la presencia de canales espaciales. NodeResolver debería usar este flag en lugar de detectar `targetX` en runtime.
2. **Bloquear el flujo clásico para nodos espaciales**: Si un nodo está registrado como espacial, y no llega `targetX` en un frame, el NodeResolver debería usar el último target conocido (cache) o ir a safe-center, en lugar de caer al flujo clásico.
3. **Asegurar que `isPlaced` determine el modo**: Fixtures `isPlaced=true` deberían operar en modo espacial (IK); fixtures `isPlaced=false` podrían operar en modo clásico o distribución automática.

### 7.2 Traducción VMM→Espacial

1. **Inyectar stageBounds al VMM**: El VMM debería conocer `stageBounds` para escalar `amplitudeScale` dinámicamente. Un escenario grande necesita `amplitudeScale` mayor para que el patrón sea perceptible.
2. **Variable targetZ**: Permitir que el VMM controle la profundidad del target (Z) mediante el patrón o una curva de envolvente, en lugar de fijarlo a `depth/2`.
3. **Coordenadas del fixture en la proyección**: El KineticAdapter usa `intent.x * halfW`, pero no compensa la posición física del fixture. Un fixture en X=-4m con targetX=+4m necesita un pan diferente que uno en X=+4m con el mismo targetX. El IK ya maneja esto, pero la proyección podría ser más inteligente (por ejemplo, target relativo al fixture, no al centro del escenario).

### 7.3 Inercia Espacial

1. **Derivar `maxVel3dMs` dinámicamente**: `maxVelMs = maxPanSpeed * (π/180) * distance_to_target`. La distancia al target cambia frame a frame, por lo que la velocidad máxima lineal debería ser dinámica.
2. **Diferenciar ejes**: Usar `maxPanSpeed` para el eje X (pan), `maxTiltSpeed` para el eje Y (tilt), y una velocidad Z independiente (posiblemente relacionada con el zoom/focus del fixture, no con pan/tilt).
3. **Escala del escenario en la inercia**: La inercia debería considerar `halfW` y `halfH` para ajustar la percepción de velocidad. En un escenario grande, la velocidad angular debería traducirse a más metros/segundo.
4. **Considerar eliminar inercia espacial y moverla a post-IK**: Suavizar los ángulos DMX resultantes (pan/tilt) en lugar de las coordenadas espaciales. Esto evita el problema de la conversión grados→metros, pero introduce complejidad con el wrap-around de pan (540°).

### 7.4 Retorno a UI

1. **Eliminar el lag de 1 frame**: Mover `AetherUIProjector.project()` y `emitHotFrame()` a **después** de `NodeResolver.resolve()` en el frame loop. La UI debería leer los valores actualizados del frame N, no del N-1.
2. **Escribir `physicalPan`/`physicalTilt` explícitamente** en AetherUIProjector para evitar el fallback `f.physicalPan ?? f.pan` en el hotFrame.
3. **Revisar el doble smoothing**: Si PhysicsPostProcessor está correctamente calibrado, el `VISUAL_SMOOTH=0.35` de Hyperion podría ser excesivo. Considerar reducirlo o eliminarlo si la inercia espacial ya produce movimiento fluido.

---

*Fin del informe forense. Cero mutación de código realizada. Todos los hallazgos derivan exclusivamente de lectura estática del código fuente.*
