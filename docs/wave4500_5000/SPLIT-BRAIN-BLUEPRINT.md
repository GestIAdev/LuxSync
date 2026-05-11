# WAVE 4630-B — THE SPLIT-BRAIN BLUEPRINT

**Autor:** Lead Architect / System Designer  
**De:** Dirección de Arquitectura  
**Referencia:** `SPLIT-BRAIN-MAP.md` (Auditoría Forense WAVE 4630-A)  
**Estado:** DOCUMENTO DE DISEÑO — Sin código final  
**Fecha:** 2025-05-08

---

## 1. Principio Rector

El motor Aether opera bajo un modelo **Split-Brain permanente** con dos rutas mutuamente excluyentes para nodos KINETIC:

| Ruta | Señal | Capa | Resolución |
|------|-------|------|------------|
| **Espacial (IK Puro)** | `targetX`, `targetY`, `targetZ` | L2 (Override Manual) | IKEngine → pan/tilt DMX |
| **Clásica (Directa)** | `pan`, `tilt` normalizados 0-1 | L0 (Systems) o L2 (Override Manual) | Directo a DMX × 255 |

**Invariante de diseño:** Un nodo KINETIC en un frame dado **NUNCA** ejecuta ambas rutas. El Gatekeeper (flag `isPlaced`) desaparece como selector de ruta IK/Classic. En su lugar, la presencia de `targetX` en el `channelValues` post-arbitraje es el **único discriminante**.

---

## 2. Topología de Nodos — Flujo de Datos Completo

### 2.1 Ruta Espacial (IK Puro)

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                             │
│                                                                      │
│  SpatialTargetPad.onChange(target: Target3D)                         │
│         ↓                                                            │
│  movementStore.setSpatialTarget(target)                              │
│         ↓ (Zustand subscription)                                     │
│  KineticsBridge._scheduleSpatialFlush()                              │
│         ↓ (debounced IPC)                                            │
│  window.lux.aether.setSpatialTarget({                                │
│    target: {x, y, z},                                                │
│    fixtureIds: string[],                                             │
│    fanMode: 'converge' | 'line' | 'circle',                         │
│    fanAmplitude: number                                              │
│  })                                                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ IPC
┌──────────────────────────────▼──────────────────────────────────────┐
│ BACKEND                                                              │
│                                                                      │
│  AetherIPCHandlers: 'lux:aether:setSpatialTarget'                   │
│         ↓                                                            │
│  [NUEVO] SpatialTargetResolver.resolve(target, fixtureIds, fan)     │
│         ↓ (por cada fixtureId)                                       │
│         ↓ ikSolveGroupWithFan() NO — se descarta IK aquí.           │
│         ↓ Se emiten coordenadas ESPACIALES directas.                 │
│         ↓                                                            │
│  NodeArbiter.setManualOverride(                                      │
│    nodeId = `${fixtureId}:kinetic`,                                  │
│    channels = { targetX, targetY, targetZ }                          │
│  )                                                                   │
│         ↓ (L2 override — prioridad sobre L0)                         │
│         ↓                                                            │
│  NodeArbiter.arbitrate()  [frame loop]                               │
│         ↓ ArbitratedNodeMap: { targetX, targetY, targetZ }           │
│         ↓                                                            │
│  PhysicsPostProcessor.process()  [inercia espacial 3D]              │
│         ↓                                                            │
│  NodeResolver._writeNodeIK()                                         │
│    → detecta targetX presente → IKEngine.solve(target) → DMX        │
│         ↓                                                            │
│  DMX Buffer → HAL.sendUniverseRaw()                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Ruta Clásica (VMM Directo + Faders Manuales)

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                             │
│                                                                      │
│  [L0 — Automático]                                                   │
│  VibeMovementManager → KineticAdapter.process()                      │
│    → IntentBus.push({ pan: 0-1, tilt: 0-1, speed: 0-1 })           │
│                                                                      │
│  [L2 — Manual]                                                       │
│  XYPad / RadarXY / Patrones Manuales (8 shapes)                     │
│    → movementStore.setPanTilt(pan, tilt)                             │
│    → programmerStore → ProgrammerAetherBridge._flush()               │
│    → IPC: setManualOverrides([{                                      │
│        nodeId: `${fixtureId}:kinetic`,                               │
│        channels: { pan: 0-1, tilt: 0-1 }                            │
│      }])                                                             │
│    → NodeArbiter.setManualOverride() [L2]                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│ BACKEND                                                              │
│                                                                      │
│  NodeArbiter.arbitrate()                                             │
│    → ArbitratedNodeMap: { pan: 0-1, tilt: 0-1 }                     │
│    → (SIN targetX — solo pan/tilt)                                   │
│         ↓                                                            │
│  PhysicsPostProcessor.process() [inercia angular]                    │
│         ↓                                                            │
│  NodeResolver._writeNode() [KINETIC path]                            │
│    → targetX === undefined → RUTA CLÁSICA                            │
│    → pan * 255 → DMX coarse                                         │
│    → tilt * 255 → DMX coarse                                        │
│         ↓                                                            │
│  DMX Buffer → HAL.sendUniverseRaw()                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Decisión del Gatekeeper (Nuevo Modelo)

```typescript
// NodeResolver._writeNode() — NUEVO GATEKEEPER
if (node.family === NodeFamily.KINETIC) {
  const kineticNode = node as IKineticNodeData
  if (kineticNode.isContinuous) {
    // Fan/mirrorball → classic siempre
    break_to_classic
  }

  if (channelValues['targetX'] !== undefined) {
    // RUTA ESPACIAL — IK solve
    this._writeNodeIK(kineticNode, channelValues, ...)
    return
  }

  // RUTA CLÁSICA — pan/tilt directo a DMX
  this._writeNodeClassic(kineticNode, channelValues, ...)
  return
}
```

**Cambio fundamental:** Se elimina la dependencia de `device.isPlaced`. La decisión se basa **exclusivamente** en la presencia de `targetX` en `channelValues`. Esto permite que:
- Un fixture `isPlaced: true` reciba pan/tilt clásicos del XYPad sin pasar por IK.
- Un fixture `isPlaced: false` (guerrilla) pueda recibir coordenadas espaciales si el operador lo fuerza (futuro Tungsteno multi-emisor).

---

## 3. Contratos de Interfaz

### 3.1 Nuevo Canal IPC: `lux:aether:setSpatialTarget`

Reemplaza a `lux:aether:applySpatialTarget` (que actualmente rutea al legacy).

```typescript
// Payload (sin cambios en la forma — cambia el destino)
interface SpatialTargetPayload {
  target: { x: number; y: number; z: number }  // metros
  fixtureIds: string[]
  fanMode?: 'converge' | 'line' | 'circle'     // default 'converge'
  fanAmplitude?: number                          // metros, default 0
}

// Respuesta
interface SpatialTargetResponse {
  success: boolean
  reachability?: Record<string, { reachable: boolean; pan: number; tilt: number }>
  subTargets?: Record<string, { x: number; y: number; z: number }>
  error?: string
}
```

**Nota:** Los campos `reachability` y `subTargets` son opcionales y se calculan **post-arbitraje** (no durante el IPC). El IPC handler solo inyecta targets; la resolución ocurre en el frame loop.

### 3.2 NodeArbiter — Sin Cambios de Interfaz

La API actual ya soporta el contrato necesario:

```typescript
// Ya existente — suficiente para spatial targets
setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void
clearManualOverride(nodeId: NodeId): void
```

El `channels` para spatial será: `{ targetX: number, targetY: number, targetZ: number }`.  
El `channels` para classic será: `{ pan: number, tilt: number }`.

### 3.3 KineticsBridge — Cambio de Target IPC

```typescript
// ANTES (ruta legacy):
window.lux.aether.applySpatialTarget(payload)  // → masterArbiter zombie

// DESPUÉS (ruta Aether directa):
window.lux.aether.setSpatialTarget(payload)    // → NodeArbiter L2
```

### 3.4 KineticAdapter — Cambio de Emisión (Ruta Clásica)

El `KineticAdapter` (alias `VMMAdapter`) actualmente emite `targetX/Y/Z`. Para la nueva arquitectura debe emitir **solo `pan`, `tilt`** normalizados al IntentBus L0.

```typescript
// ANTES (KineticAdapter.process):
this._valuesDict['targetX'] = projectedX
this._valuesDict['targetY'] = projectedY
this._valuesDict['targetZ'] = projectedZ

// DESPUÉS:
this._valuesDict['pan']  = normPan   // 0-1, centro en 0.5
this._valuesDict['tilt'] = normTilt  // 0-1, centro en 0.5
this._valuesDict['speed'] = speed    // 0-1
```

Esto elimina la transformación 3D del VMM en el adapter, dejándola exclusivamente en la ruta espacial.

### 3.5 NodeResolver._writeNodeClassic — Nuevo Método

Método dedicado para la ruta clásica de nodos KINETIC. Extrae `pan`/`tilt` del `channelValues`, aplica Safety Middleware (velocity clamp + airbag), y escribe directamente en el buffer DMX.

```typescript
private _writeNodeClassic(
  node: IKineticNodeData,
  channelValues: Readonly<Record<string, number>>,
  baseAddr: number,
  buf: Uint8Array,
  calibration: IDeviceCalibration | undefined,
  writeToDmx: boolean,
): void
```

---

## 4. Código Muerto a Eliminar

| Artefacto | Ubicación | Razón |
|-----------|-----------|-------|
| `_forwardKinematicsBridge()` | `NodeResolver.ts:671-815` | FK ya no se necesita: pan/tilt clásicos van directo a DMX; targets espaciales vienen ya resueltos como x/y/z |
| FK constants (`FK_DEG_TO_RAD`, `FK_DEFAULT_PAN_RANGE_DEG`, etc.) | `NodeResolver.ts:100-106` | Dependencias del FK bridge |
| `FK_MAX_RAY_DISTANCE` | `NodeResolver.ts` (si queda) | Idem |
| `masterArbiter.applySpatialTarget()` IPC handler | `AetherIPCHandlers.ts:240-266` | Reemplazado por `setSpatialTarget` directo |
| `ArbitrationDirector.applySpatialTarget()` | `ArbitrationDirector.ts:359-428` | Lógica migrada |
| `ArbitrationDirector.releaseSpatialTarget()` | `ArbitrationDirector.ts:430-435` | Idem |
| Legacy telemetry: `[FK-FLOOR]`, `[FK-FALLBACK]` | `NodeResolver.ts` | Ya no hay FK |

---

## 5. Plan de Ejecución (4 Pasos Secuenciales)

### PASO 1: Reconectar la Ruta Espacial al NodeArbiter

**Scope:** Backend IPC + Bridge  
**Riesgo:** Bajo (no toca el frame loop hot-path)  
**Archivos:**
- `AetherIPCHandlers.ts` — Nuevo handler `lux:aether:setSpatialTarget` que:
  1. Recibe `SpatialTargetPayload`
  2. Calcula sub-targets si `fanMode !== 'converge'` (inline `ikSolveGroupWithFan` solo para fan geometry, NO para IK solve final)
  3. Para cada fixtureId: `nodeArbiter.setManualOverride(`${fixtureId}:kinetic`, { targetX, targetY, targetZ })`
  4. Retorna `{ success: true, subTargets }` (reachability se calcará post-resolve)
- `AetherIPCHandlers.ts` — Nuevo handler `lux:aether:releaseSpatialTarget` que:
  1. Para cada fixtureId: `nodeArbiter.clearManualOverride(`${fixtureId}:kinetic`)`
- `KineticsBridge.ts` — Cambiar `window.lux.aether.applySpatialTarget` → `window.lux.aether.setSpatialTarget`
- `vite-env.d.ts` — Actualizar types de `window.lux.aether`

**Verificación:** Con fixtures seleccionados en modo `spatial`, arrastrar el target en `SpatialTargetPad` debe producir telemetría `[MATH-INPUT]` con `targetXYZ` reales en la consola del NodeResolver.

---

### PASO 2: Reclasificar el Gatekeeper del NodeResolver

**Scope:** NodeResolver hot-path  
**Riesgo:** Medio (toca resolución por frame)  
**Archivos:**
- `NodeResolver.ts` — Modificar `_writeNode()`:
  1. Eliminar la condición `device.isPlaced === true` como selector de ruta IK.
  2. Nueva lógica: si `channelValues['targetX'] !== undefined` → `_writeNodeIK()`; else → `_writeNodeClassic()`.
  3. El `_writeNodeIK()` existente se simplifica: eliminar el branch FK (líneas 578-585), asumir que targetX/Y/Z SIEMPRE están presentes.
- `NodeResolver.ts` — Crear `_writeNodeClassic()`:
  1. Extraer `pan` y `tilt` de `channelValues` (defaults a 0.5 si ausentes).
  2. Aplicar `_safetyMiddleware.clampKineticVelocity()` y `applyAirbag()`.
  3. Actualizar `node.currentPosition`.
  4. Escribir `pan * 255` y `tilt * 255` al buffer DMX.

**Verificación:** Fixtures en modo classic (XYPad/RadarXY) siguen respondiendo normalmente. Fixtures en modo spatial (SpatialTargetPad) reciben coordenadas IK. No hay crossover.

---

### PASO 3: Migrar KineticAdapter a Emisión Clásica

**Scope:** KineticAdapter (VMMAdapter)  
**Riesgo:** Medio (cambia lo que el VMM inyecta al bus)  
**Archivos:**
- `KineticAdapter.ts` — Modificar `process()`:
  1. En lugar de proyectar a `targetX/Y/Z` (metros), emitir `pan`/`tilt` normalizados (0-1).
  2. `pan = 0.5 + (intent.x * 0.5)` — mapeo lineal de VMM [-1,+1] a [0,1]
  3. `tilt = 0.5 + (intent.y * 0.5)` — idem
  4. `speed` se mantiene igual.
  5. Eliminar la proyección de stage bounds (ya no necesaria — el mapping es puro angular).
- `PhysicsPostProcessor.ts` — Verificar que la inercia funcione con `pan`/`tilt` en [0,1] (actualmente opera sobre targets en metros). Puede requerir un branch: si canal es `pan`/`tilt` → inercia angular; si canal es `targetX/Y/Z` → inercia espacial.

**Verificación:** Con VMM activo (cualquier vibe), los fixtures deben moverse fluidamente en pan/tilt sin pasar por IK. El canal `targetX` NO debe aparecer en la ArbitratedNodeMap para nodos alimentados solo por L0.

---

### PASO 4: Limpieza — Demolición del FK Bridge y Legacy

**Scope:** Dead code removal  
**Riesgo:** Bajo (todo es código ya inactivo tras Pasos 1-3)  
**Archivos:**
- `NodeResolver.ts`:
  1. Eliminar `_forwardKinematicsBridge()` completo (~145 líneas).
  2. Eliminar constantes FK: `FK_DEG_TO_RAD`, `FK_DEFAULT_PAN_RANGE_DEG`, `FK_DEFAULT_TILT_RANGE_DEG`, `FK_MAX_RAY_DISTANCE` (si queda).
  3. Eliminar telemetría `[FK-FLOOR]` y `[FK-FALLBACK]`.
  4. Simplificar `_writeNodeIK()`: eliminar branch else del FK bridge.
- `AetherIPCHandlers.ts`:
  1. Eliminar handler `lux:aether:applySpatialTarget` (legacy).
  2. Eliminar handler `lux:aether:releaseSpatialTarget` (legacy).
- `ArbitrationDirector.ts`:
  1. Eliminar `applySpatialTarget()` y `releaseSpatialTarget()`.
  2. Eliminar imports de IK engine (`ikSolve`, `ikSolveGroup`, `ikSolveGroupWithFan`, `ikBuildProfile`).
  3. Eliminar `_ikProcessedFixtures` set y sus referencias.
- Verificar que `tsc --noEmit` pasa con 0 errores.

**Verificación:** `tsc --noEmit` clean. Ambas rutas siguen funcionando. La telemetría `[MATH-INPUT]` muestra targets espaciales SOLO para fixtures en modo spatial. La consola no muestra `[FK-FLOOR]` nunca.

---

## 6. Consideraciones para Tungsteno (Multi-Emisor)

La nueva arquitectura está preparada para fixtures multi-emisor:

- Cada emisor se registrará como un **nodo KINETIC independiente** en el NodeGraph (ej: `fixture-01:kinetic:emitter-A`, `fixture-01:kinetic:emitter-B`).
- El `SpatialTargetPad` podrá emitir **targets diferenciados** por emisor (sub-targeting nativo).
- La ruta clásica también soporta multi-emisor: cada nodo recibe su propio `pan`/`tilt`.
- No se necesita fan geometry a nivel de resolver — cada emisor es atómico.

---

## 7. Resumen de Riesgo por Paso

| Paso | Impacto en Frame Loop | Reversibilidad | Dependencia |
|------|----------------------|----------------|-------------|
| 1 | Ninguno (solo IPC) | Total (dejar ambos handlers) | Independiente |
| 2 | Alto (gatekeeper) | Media (revert commit) | Requiere Paso 1 |
| 3 | Alto (VMM output) | Media (revert commit) | Requiere Paso 2 |
| 4 | Ninguno (dead code) | Total | Requiere Pasos 1-3 |

**Recomendación:** Ejecutar Paso 1 y verificar antes de continuar. Cada paso es un commit atómico que puede desplegarse independientemente (excepto Paso 4, que es pura limpieza).

---

*Fin del Blueprint SPLIT-BRAIN-BLUEPRINT.md.*  
*Listo para ejecución secuencial.*
