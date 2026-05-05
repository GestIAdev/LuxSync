# KINEMATIC-DUALITY-MAP.md

## Auditoría de Dualidad Cinemática — WAVE 4556

**Scope:** Rastrear el flujo de datos de movimiento desde el generador de patrones (VMM) hasta el buffer DMX, identificando el mecanismo de decisión entre motor Classic (Pan/Tilt directo) y motor Espacial (IK/XYZ).  
**Auditoría realizada:** 2026-05-05  
**Objetivo:** Determinar cómo LuxSync decide cuándo escupir Pan/Tilt clásico y cuándo calcular XYZ, y en qué formato queda el valor justo antes del HAL.

---

## 1. RESUMEN EJECUTIVO

El ecosistema Aether V2 opera con **una única fuente activa de movimiento automático**: `KineticAdapter` (alias `VMMAdapter`). Este adapter decide temprano (L0) si el fixture es de rotación continua (`isContinuous=true`) o posicionado (`isContinuous=false`). Para movers posicionados, **NO emite Pan/Tilt normalizados** — proyecta la salida del `VibeMovementManager` a coordenadas 3D en metros (`targetX`, `targetY`, `targetZ`) y las inyecta en el `IntentBus`.

La decisión final de traducción ocurre en **tres puntos sucesivos**:

1. **`PhysicsPostProcessor`** (post-Arbiter, pre-Resolver): Aplica inercia física. Si detecta `targetX`, usa modelo 3D métrico; si no, usa modelo 1D normalizado.
2. **`NodeResolver._writeNode()`** (Resolver): Si `targetX` está presente y el nodo es KINETIC no-continuo, desvía a `_writeNodeIK()`; de lo contrario, cae al bucle clásico `pan`/`tilt`.
3. **`IKEngine.solve()`** (dentro de `_writeNodeIK`): Convierte metros → DMX 0-255 con calibración, anti-flip y límites mecánicos.

**Hallazgo #1:** `KineticSystem` (la implementación System de WAVE 3505.3) existe como clase exportada pero **NO está cableada** en `TitanOrchestrator.processFrame()`. El loop activo usa exclusivamente `VMMAdapter`/`KineticAdapter`.

**Hallazgo #2:** El path Classic (`pan`/`tilt` directos en el IntentBus) está **reservado para overrides manuales (L2) u otros adapters**, pero el adapter automático nunca lo utiliza para movers. Todo movimiento auto-generado de movers pasa por IK espacial.

**Hallazgo #3:** El `ForgeNodeEvaluator` (WAVE 4548.6) introduce un **tercer bypass total**: si un device tiene grafo Forge compilado, el `NodeResolver` salta TANTO el path Classic como el path IK, delegando completamente al evaluador de opcodes. Esto es crítico para el Fan Tungsten.

---

## 2. EJE 1: EL ORIGEN DE LA INTENCIÓN (THE SOURCE)

### 2.1 VibeMovementManager — El Coreógrafo

```
Archivo: src/engine/movement/VibeMovementManager.ts
Líneas críticas: 45-62 (MovementIntent), 626-897 (generateIntent)
```

**Formato de salida:**
```typescript
export interface MovementIntent {
  x: number            // [-1, +1] normalizado
  y: number            // [-1, +1] normalizado
  pattern: string      // GoldenPattern ID
  speed: number        // [0, 1] normalizado
  amplitude: number    // [0, 1] escala final
  phaseType?: 'linear' | 'polar'
}
```

**Pipeline interno (generateIntent):**
1. **Frame-Once Guard** (línea 641): Si `Date.now() === lastUpdate`, reusa estado interno (evita doble avance cuando TitanEngine llama 2× por frame para stereo L/R).
2. **Selección de patrón** (línea 669): `selectPattern()` rota por frase musical (cada 8 compases). Mapeo de sección → patrón:
   - `intro`/`outro` → idle
   - `verse` → sweep
   - `build` → build
   - `drop` → drop dramático
   - `break` → converge
3. **Monotonic Phase Accumulator** (línea 516): `phaseAccumulator += (smoothedBPM/60) * dt * phasePerBeat * globalSpeedMultiplier`. NUNCA salta — avance continuo.
4. **Gearbox Budget** (línea 922): `calculateEffectiveAmplitude()` reduce la amplitud si el recorrido solicitado excede `fixtureMaxSpeed * secondsPerBeat * patternPeriod`.
5. **Phrase Envelope** (línea 756): Escala amplitud entre 0.85 (inicio) y 1.0 (clímax a ~62% de la frase de 32 beats).
6. **Stereo Phase Offset** (línea 826):
   - `mirror` (techno): fixtures impares invierten X.
   - `snake` (latino/rock/chill): rotación angular del vector posición por `fixtureIndex * stereoConfig.offset`.

**Patrones disponibles (The Golden Dozen + Four Nobles):**

| Género | Patrones |
|---|---|
| **Techno** | `scan_x`, `square`, `diamond`, `botstep` |
| **Latino** | `figure8`, `wave_y`, `ballyhoo` |
| **Pop-Rock** | `circle_big`, `cancan`, `dual_sweep` |
| **Chill** | `drift`, `sway`, `breath` |
| **Four Nobles** | `slow_pan`, `tilt_nod`, `figure_of_4`, `chase_position` |

**Nota:** Todos los patrones son funciones PURAS y DETERMINISTAS de `(phase, audio, index, total)`. Sin `Math.random()`.

### 2.2 KineticAdapter (VMMAdapter) — Proyección Holográfica

```
Archivo: src/core/aether/adapters/KineticAdapter.ts
Líneas críticas: 124-262 (process), 229-255 (decisión isContinuous)
```

Este adapter recibe el `MovementIntent` del VMM y decide el formato de salida al `IntentBus`:

**Para `node.isContinuous === true` (fan, mirror ball, pétalo):**
```typescript
// FLUJO LEGACY — rotación continua
rotation = (intent.x + 1) * 0.5   // [-1,+1] → [0,1] (0.5 = stop)
if (node.physicalPosition.x < 0) rotation = 1 - rotation  // mirror

this._valuesDict['rotation'] = clamp01(rotation)
this._valuesDict['speed']    = clamp01(intent.speed)
```
Emite canales: `rotation`, `speed`.

**Para `node.isContinuous === false` (moving heads, scanners):**
```typescript
// FLUJO IK — proyección al plano virtual 3D (metros)
const projectedX = intent.x * halfW          // width/2  (default 4m)
const projectedY = centerY + intent.y * halfH  // height/2 (default 2m)
const projectedZ = halfD                         // depth/2  (default 1m)

this._valuesDict['targetX'] = clamp(projectedX, -halfW, halfW)
this._valuesDict['targetY'] = clamp(projectedY, 0, height)
this._valuesDict['targetZ'] = clamp(projectedZ, -halfD, halfD)
this._valuesDict['speed']   = clamp01(intent.speed)
```
Emite canales: `targetX`, `targetY`, `targetZ`, `speed`.

**Respuesta directa a la pregunta del usuario:**
> ¿Envía ambos, Pan/Tilt y XYZ, o depende del tipo de patrón?

**NO envía ambos.** Depende exclusivamente de `node.isContinuous`:
- `false` (mover) → **Solo XYZ** (`targetX/Y/Z` en metros).
- `true` (fan/mirror) → **Solo rotación continua** (`rotation`, `speed`).
El tipo de patrón (scan_x vs figure8) solo afecta los valores `(x,y)` que el VMM genera; la proyección a XYZ o rotación es posterior e independiente del patrón.

---

## 3. EJE 2: EL INTERRUPTOR DE DUALIDAD (THE DECISION GATE)

Existen **tres interruptores** en cascada que deciden entre Classic y Espacial.

### 3.1 Interruptor L0 — KineticAdapter (Fuente)

```
Archivo: src/core/aether/adapters/KineticAdapter.ts:215-255
```

```typescript
if (node.isContinuous) {
  // FLUJO LEGACY: rotation + speed
} else {
  // FLUJO IK: targetX/Y/Z (metros)
}
```

**Decisión:** Basada en el capability flag `isContinuous` del nodo KINETIC. Determina qué canales se escriben al `IntentBus`.

### 3.2 Interruptor L2 — PhysicsPostProcessor (Inercia)

```
Archivo: src/core/aether/resolver/PhysicsPostProcessor.ts:255-374 (process)
Líneas críticas: 293-325
```

Este procesador muta el `ArbitratedNodeMap` in-place entre el Arbiter y el Resolver. Itera SOLO nodos KINETIC.

```typescript
// DUALITY CHECK
if (entry['targetX'] !== undefined) {
  // ── MODO ESPACIAL 3D ──
  // Aplica inercia métrica (metros) con SAFETY_MAX_3D_VEL_MS = 5.0 m/s
  // y SAFETY_MAX_3D_ACC_MS2 = 20.0 m/s²
  this._applySnapOrClassic3D(state, targetX/Y/Z, maxVel, maxAcc)
  entry['targetX'] = state[SLOT_X3D_POS]  // muta in-place
  entry['targetY'] = state[SLOT_Y3D_POS]
  entry['targetZ'] = state[SLOT_Z3D_POS]
  return  // skip flujo legacy pan/tilt
} else {
  // ── MODO CLÁSICO 1D ──
  this._panTarget  = entry['pan']  ?? 0.5
  this._tiltTarget = entry['tilt'] ?? 0.5
  // Aplica inercia normalizada [0,1] con SAFETY_MAX_VELOCITY_NORM ≈ 0.00291 norm/s
  this._applySnapOrClassic1D(state, panTarget, tiltTarget)
  entry['pan']  = state[SLOT_PAN_POS]   // muta in-place
  entry['tilt'] = state[SLOT_TILT_POS]
}
```

**Decisión:** Basada en la presencia de la key `targetX` en el mapa arbitrado del nodo.
- **`targetX` presente** → Inercia espacial 3D (metros). Escribe de vuelta `targetX/Y/Z` suavizados.
- **`targetX` ausente** → Inercia clásica 1D (normalizada 0-1). Escribe de vuelta `pan`/`tilt` suavizados.

**Configuración de modo:** `setPhysicsMode('snap' | 'classic', snapFactor?)`. Default: `classic`.

### 3.3 Interruptor L3 — NodeResolver (Traducción a DMX)

```
Archivo: src/core/aether/resolver/NodeResolver.ts:326-497 (writeNode + writeNodeIK)
Líneas críticas: 357-367, 442-497
```

Este es el **último y definitivo** gate antes del hardware.

```typescript
// WAVE 4523.5: Flujo IK — canales espaciales (metros)
if (channelValues[CH_TARGET_X] !== undefined && node.family === NodeFamily.KINETIC) {
  const kineticNode = node as IKineticNodeData
  if (!kineticNode.isContinuous) {
    this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration)
    return  // BYPASS del bucle legacy
  }
  return  // nodo continuo ignora IK de apuntado
}

// Flujo legacy: bucle por canales, TransferCurve, Calibration, Clamp [0,255]
for (let ci = 0; ci < node.channels.length; ci++) { ... }
```

**Decisión:** Basada en presencia de `CH_TARGET_X` (`'targetX'`) en los valores arbitrados + familia KINETIC + `!isContinuous`.
- **Condición TRUE** → `_writeNodeIK()`: llama a `IKEngine.solve()` → obtiene pan/tilt DMX listos → escribe directo al buffer.
- **Condición FALSE** → Bucle clásico: para cada canal definido en `node.channels`, aplica `TransferCurve`, calibración, clamp a `[0,255]`.

**Nota importante sobre el Classic path en Aether:** En la práctica actual, el bucle clásico de `_writeNode()` para KINETIC solo se activaría si:
- Un manual override (Layer 2) escribe `pan`/`tilt` directamente al bus.
- Otro adapter emite `pan`/`tilt` en vez de `targetX/Y/Z`.
- El nodo es `isContinuous=true` (se ignora IK y el bucle clásico procesa `rotation`/`speed`).

---

## 4. EJE 3: INTEGRACIÓN DE MOTORES (RESOLVER PIPELINE)

### 4.1 Pipeline Unificado (mismo pipeline, divergencia condicional)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TITAN ORCHESTRATOR — processFrame() (44Hz)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. L0 Adapters procesan NodeGraph views y escriben al _aetherBus:           │
│       kineticAdapter.process(KINETIC view, ctx, bus)                         │
│         └─► VMM.generateIntent() → proyección XYZ o rotación continua        │
│                                                                               │
│  2. NodeArbiter.arbitrate()                                                  │
│       ├── Recoge intents de L0 (KineticAdapter)                             │
│       ├── Mezcla con L2 (Manual overrides pan/tilt o targetX/Y/Z)           │
│       ├── Mezcla con L3 (Selene cognitive, Chronos timeline)                │
│       └── Produce: ArbitratedNodeMap (Record<nodeId, Record<channel, value>>)│
│                                                                               │
│  3. PhysicsPostProcessor.process(arbitrated, nodeGraph, deltaMs, vibeId)   │
│       ├── Si entry['targetX'] existe → inercia 3D métrica (m/s, m/s²)      │
│       └── Si no → inercia 1D normalizada (pan/tilt [0,1])                  │
│       └── Muta in-place el ArbitratedNodeMap                                 │
│                                                                               │
│  4. NodeResolver.resolve(arbitrated)                                         │
│       ├── Para cada nodo:                                                   │
│       │      ├── Si targetX presente + KINETIC + !continuous:                │
│       │      │     _writeNodeIK() → IKEngine.solve() → DMX 0-255            │
│       │      └── Si no: bucle clásico pan/tilt/rotation/etc → DMX 0-255    │
│       │      └── WAVE 4548.6: Si compiled Forge graph → BYPASS total        │
│       └── Ensambla IDMXPacket[] (Uint8Array por universo)                    │
│                                                                               │
│  5. HAL.sendUniverseRaw(universe, Uint8Array) → Driver DMX                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Motor Espacial — IKEngine.solve()

```
Archivo: src/engine/movement/InverseKinematicsEngine.ts
Líneas críticas: 180-264 (solve function)
```

**Input:** `IKFixtureProfile` (posición 3D, orientación de montaje, límites mecánicos, calibración) + `Target3D` (metros) + `currentPanDMX` (para anti-flip).

**Pipeline de 12 pasos:**
1. Vector fixture→target en coordenadas de escenario (dx, dy, dz).
2. Rotación al frame local del fixture (inversa de Yaw·Pitch·Roll).
3. Detección de Gimbal Lock (si `horizontalDist < 0.001m`, preserva pan actual).
4. `panDeg = atan2(local.x, local.z) * RAD_TO_DEG`.
5. `tiltDeg = atan2(-local.y, horizontalDist) * RAD_TO_DEG`.
6. Aplica offsets de calibración (`panOffset`, `tiltOffset`).
7. Mapea grados → DMX: `((calibratedDeg + range/2) / range) * 255`.
8. **Anti-Flip (shortest path):** Si el salto DMX excede 180° del rango pan, elige `pan ± 360°` para minimizar distancia.
9. Aplica inversión de ejes (`panInvert`, `tiltInvert`).
10. Evalúa reachability (¿ambos ángulos caen dentro del rango mecánico + margen?).
11. Aplica `tiltLimits` (hard stops mecánicos configurados por usuario).
12. Aplica `PAN_SAFETY_MARGIN = 5` DMX units y clamp final `[0, 255]`.

**Output:** `IKResult { pan: number, tilt: number, reachable: boolean, antiFlipApplied: boolean }`.

**Nota anti-double-calibration:** `NodeResolver._writeNodeIK()` NO llama a `_applyCalibration()` porque el IKEngine ya aplicó calibración internamente.

### 4.3 Motor Clásico — Bucle Normalizado

```
Archivo: src/core/aether/resolver/NodeResolver.ts:392-439 (bucle legacy)
```

Para cada canal del nodo:
```typescript
rawNormalized = translatedValues[chDef.type] ?? default
normalized    = _applyTransferCurve(rawNormalized, chDef, transferCurve)
maxNorm       = node.constraints.maxValue / 255
if (normalized > maxNorm) normalized = maxNorm  // constraint clamp
dmxValue      = Math.round(normalized * 255)
dmxValue      = _applyCalibration(dmxValue, chDef.type, calibration)  // invertPan, tiltOffset
if (dmxValue < 0) dmxValue = 0; if (dmxValue > 255) dmxValue = 255  // safety clamp
buf[baseAddr + chDef.dmxOffset] = dmxValue

// 16-bit support:
if (chDef.is16bit) {
  raw16 = Math.round(normalized * 65535)
  buf[fineIdx] = raw16 & 0xFF        // LSB
  buf[coarseIdx] = (raw16 >> 8) & 0xFF  // MSB
}
```

**Formato de salida:** DMX 8-bit (0-255) o 16-bit (0-65535 split en coarse/fine).

### 4.4 Motor Forge — Bypass Total

```
Archivo: src/core/aether/resolver/NodeResolver.ts:338-352
```

```typescript
const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, this._forgeFrameContext, buf, baseAddr)
  return  // BYPASS: no ejecutar flujo legacy NI IK
}
```

Si un fixture tiene grafo Forge compilado (WAVE 4548.6), **ambos motores (Classic e IK) son ignorados**. El evaluador de opcodes escribe directamente al buffer DMX. Esto es relevante para fixtures custom como Fan Tungsten que pueden definir su propia lógica de movimiento/efecto en un grafo Forge.

---

## 5. EJE 4: FORMATO DE SALIDA (THE EGRESS)

### 5.1 Justo antes del HAL

Independientemente del path tomado, el resultado que sale de `NodeResolver.resolve()` es:

```typescript
interface IDMXPacket {
  universe: number
  channels: number[]   // 512 valores [0..255]
}
```

Internamente, el resolver mantiene `Uint8Array(512)` por universo (zero-fill cada frame). Los packets se construyen copiando esos buffers.

### 5.2 Formato por path

| Path | Formato intermedio | Formato final en buffer | Módulo responsable |
|---|---|---|---|
| **Espacial (IK)** | `Target3D` (metros) → `IKResult` | `pan`, `tilt` como **DMX 0-255 enteros** (ya calibrados) | `IKEngine.solve()` + `_writeNodeIK()` |
| **Clásico** | `pan`/`tilt` normalizados [0,1] | `Math.round(normalized * 255)` + calibration + clamp | Bucle `_writeNode()` |
| **Continuo** | `rotation`, `speed` [0,1] | `Math.round(rotation * 255)` (si mapea a DMX) | Bucle `_writeNode()` |
| **Forge** | Opcodes arbitrarios | Escritura directa al `Uint8Array` por el evaluador | `ForgeNodeEvaluator.evaluate()` |

**¿Ya está convertido a grados/valores DMX crudos (0-255)?**
- **SÍ en path IK:** `IKEngine.solve()` retorna `pan` y `tilt` ya en DMX 0-255. `_writeNodeIK()` los escribe directo al buffer sin escalado adicional.
- **SÍ en path Clásico:** El bucle `_writeNode()` escala `normalized [0,1] → [0,255]` con `Math.round()`.
- **SÍ en path Continuo:** Igual que clásico, escalado normalizado → DMX.
- **SÍ en path Forge:** Depende del opcode `output_dmx` (opcode 23), que escribe valor crudo al índice DMX.

### 5.3 Entrega al HAL

```typescript
// TitanOrchestrator.ts:1800-1804
for (const universe of aetherResolver.registeredUniverses) {
  const rawBuf = aetherResolver.getUniverseBuffer(universe)  // Uint8Array(512)
  if (rawBuf) this.hal.sendUniverseRaw(universe, rawBuf)
}
```

`sendUniverseRaw()` recibe el `Uint8Array` por referencia directa (zero-copy) y lo pasa al driver DMX.

---

## 6. MAPA DE ARCHIVOS DE DUALIDAD CINEMÁTICA

```
src/engine/movement/
├── VibeMovementManager.ts           ← Generador de patrones (MovementIntent x,y)
│   ├── WAVE 2088.10: Monotonic Phase Accumulator
│   ├── WAVE 2086.1: Stereo Phase Offset (mirror/snake)
│   └── WAVE 2074.3: Gearbox Budget (per-fixture speed limit)
│
├── InverseKinematicsEngine.ts       ← IKEngine.solve(): metros → DMX 0-255
│   ├── WAVE 2601: 12-paso IK puro
│   ├── Anti-flip (shortest path pan)
│   ├── Gimbal Lock guard
│   └── PAN_SAFETY_MARGIN = 5
│
src/core/aether/adapters/
├── KineticAdapter.ts                ← L0: VMM → IntentBus (targetX/Y/Z o rotation)
│   └── Alias VMMAdapter en barrel
│
src/core/aether/systems/
├── KineticSystem.ts                 ← Clase alternativa (WAVE 3505.3) — NO cableada en TitanOrchestrator
│
src/core/aether/resolver/
├── PhysicsPostProcessor.ts          ← Inercia post-Arbiter (3D métrico vs 1D normalizado)
│   ├── WAVE 4518.1: THE INERTIA ENGINE
│   ├── TELEPORT_THRESHOLD_MS = 200
│   └── JITTER_THRESHOLD = 0.0005 norm
│
├── NodeResolver.ts                  ← Gate final: _writeNodeIK() vs bucle clásico
│   ├── WAVE 4523.5: Flujo IK (canales espaciales)
│   ├── WAVE 4522.4: Traducción cromática (COLOR)
│   └── WAVE 4548.6: Forge bypass
│
src/core/orchestrator/
└── TitanOrchestrator.ts             ← Frame loop: kineticAdapter.process() → ... → sendUniverseRaw()
    ├── Línea 1710: kineticAdapter.process() (L0 KINETIC)
    ├── Línea 1762: aetherArbiter.arbitrate()
    ├── Línea 1766: physicsPostProcessor.process()
    ├── Línea 1798: aetherResolver.resolve()
    └── Línea 1803: hal.sendUniverseRaw()
```

---

## 7. CHECKLIST DE DECISIONES POR FIXTURE

| Condición del nodo KINETIC | Adapter emite | PhysicsPostProcessor aplica | Resolver usa | Formato final |
|---|---|---|---|---|
| `isContinuous = true` | `rotation`, `speed` | Inercia 1D (si llegan como pan) | Bucle clásico | DMX 0-255 |
| `isContinuous = false` + XYZ presentes | `targetX`, `targetY`, `targetZ` | Inercia 3D métrica | `_writeNodeIK()` | DMX 0-255 (post-IK) |
| `isContinuous = false` + XYZ ausentes | (override manual) `pan`, `tilt` | Inercia 1D normalizada | Bucle clásico | DMX 0-255 |
| `forgeGraph` compilado | Ignorado por adapter | Ignorado | `ForgeNodeEvaluator` | DMX crudo (opcode) |

---

*Fin del Mapa de Dualidad Cinemática — WAVE 4556*
