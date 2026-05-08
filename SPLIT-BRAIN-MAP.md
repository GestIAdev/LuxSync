# WAVE 4630-A — THE SPLIT-BRAIN MAPPING

**Auditor:** Cascade  
**De:** Dirección de Arquitectura  
**Asunto:** Tuberías Dual-Brain (VMM automático vs UI espacial manual)  
**Fecha:** 2026-05-07  
**Estado:** SOLO LECTURA FORENSE — Mapa completo confirmado

---

## Executive Summary

La arquitectura presenta un **Split-Brain crítico**: el path automático (VMM) y el path manual espacial (UI) terminan en **dos árbitros diferentes** que no se sincronizan. El path automático fluye por el **NodeArbiter (Aether V2)**; el path manual espacial fluye por el **ArbitrationDirector (legacy)** cuya salida está **desconectada desde WAVE-4592**. Resultado: los targets manuales 3D desde la UI son resueltos por IK pero **nunca llegan al DMX**.

---

## Mission 1: La Ruta Automática (VMM / Capa 0)

### Pipeline Confirmado

```
VibeMovementManager.generateIntent()
    ↓ (x,y) ∈ [-1,+1] normalizado
KineticAdapter.process()  [VMMAdapter alias]
    ↓ targetX/Y/Z (metros) + speed
IntentBus.push()  [priority=10, source='kinetic-adapter']
    ↓
NodeArbiter.arbitrate()  [L0 merge, LTP para targetX/Y/Z]
    ↓
PhysicsPostProcessor.process()  [inercia espacial 3D]
    ↓
NodeResolver.resolve()  [_writeNodeIK con targetX presente]
    ↓
DMX Uint8Array buffer
```

### Hallazgos Clave

**`KineticAdapter` (WAVE 4523.4) es el único sistema cinético activo.** `KineticSystem.ts` (WAVE 3505.3) existe en el árbol de fuentes pero **NO está registrado en el frame loop del TitanOrchestrator**. El orchestrator instancia `VMMAdapter` (alias backward-compat de `KineticAdapter`) en:

- `TitanOrchestrator.ts:341` — `private _kineticAdapter: InstanceType<typeof VMMAdapter> | null = null`
- `TitanOrchestrator.ts:504` — `this._kineticAdapter = this._kineticAdapter ?? new VMMAdapter()`
- `TitanOrchestrator.ts:1765` — `kineticAdapter.process(this._aetherGraph.getView(NodeFamily.KINETIC), ctx, this._aetherBus)`

**¿Qué emite?** `KineticAdapter.process()` NO emite `pan`/`tilt`. Emite canales espaciales directamente:

```typescript
// KineticAdapter.ts:243-253
const projectedX = intent.x * halfW          // targetX en metros
const projectedY = centerY + intent.y * halfH // targetY en metros
const projectedZ = halfD                       // targetZ en metros

this._valuesDict['targetX'] = clamp(projectedX, -halfW, halfW)
this._valuesDict['targetY'] = clamp(projectedY, 0, height)
this._valuesDict['targetZ'] = clamp(projectedZ, -halfD, halfD)
this._valuesDict['speed']   = BaseSystem.clamp01(intent.speed)
```

**¿En qué capa?** Priority `INTENT_PRIORITY = 10` → **L0 (Systems)**. Source `'kinetic-adapter'`.

**¿Forzado a targetX/Y/Z antes del árbitro?** **SÍ.** La proyección holográfica ocurre dentro de `KineticAdapter.process()` antes del push al bus. El VMM emite coordenadas abstractas 2D; el adapter las proyecta al Crystal Box 3D in-place. No hay `pan`/`tilt` en este flujo.

---

## Mission 2: La Ruta Manual Espacial (Catedral UI / Capa 2)

### Pipeline Confirmado

```
SpatialTargetPad.tsx  [drag/move]
    ↓ onChange(target: Target3D)
movementStore.setSpatialTarget(target)
    ↓ Zustand subscription
KineticsBridge._scheduleSpatialFlush()
    ↓ IPC call (debounced)
window.lux.aether.applySpatialTarget({target, fixtureIds, fanMode, fanAmplitude})
    ↓ IPC channel 'lux:aether:applySpatialTarget'
AetherIPCHandlers.ts:253
    ↓
masterArbiter.applySpatialTarget()  ← [ARBITRATION DIRECTOR — LEGACY]
    ↓
ikSolveGroupWithFan()  [InverseKinematicsEngine]
    ↓ {pan: DMX, tilt: DMX} per fixture
masterArbiter.setManualOverride({fixtureId, controls: {pan, tilt}, overrideChannels: ['pan', 'tilt']})
    ↓
LayerStateManager L2  [legacy state]
    ↓
⚠️ DESCONEXIÓN — legacy arbiter BYPASSED desde WAVE-4592
    ↓
[NO LLEGA A DMX]
```

### Hallazgos Clave

**El path manual espacial NO alimenta el NodeArbiter.** La IPC `lux:aether:applySpatialTarget` es manejada por `AetherIPCHandlers.ts:253` que llama `masterArbiter.applySpatialTarget()` — el **ArbitrationDirector legacy**, NO el `NodeArbiter` de Aether.

`ArbitrationDirector.applySpatialTarget()` (líneas 359-428) realiza:
1. `ikBuildProfile()` por fixture (construye perfil IK desde posición física + calibración)
2. `ikSolveGroupWithFan()` (resuelve grupo con fan mode)
3. `this.setManualOverride({fixtureId, controls: {pan: ikResult.pan, tilt: ikResult.tilt}, overrideChannels: ['pan', 'tilt'], source: 'ui_joystick'})`

Este `setManualOverride` almacena los valores en el **`ILayerStateManager` del legacy**, que es consumido por `ArbitrationDirector.arbitrate()`.

**PERO:** `TitanOrchestrator.ts:1257-1295` contiene el bypass explícito:

```typescript
// 🪓 WAVE-4592: LEGACY ARBITER BYPASS — ArbitrationDirector disconnected.
// masterArbiter.setTitanIntent(titanLayer)  ← COMMENTED
// masterArbiter.arbitrate()                 ← COMMENTED
// HAL.renderFromTarget(arbitratedTarget)    ← COMMENTED
```

El `masterArbiter.arbitrate()` **nunca se llama** en el frame loop activo. Los overrides manuales espaciales son resueltos por IK, almacenados en el legacy... y **desaparecen**.

**¿Hay otro path?** Sí — pero para controles DIRECTOS (faders), no espaciales:
- `ProgrammerAetherBridge.ts` → `window.lux.aether.setManualOverrides` → `AetherIPCHandlers.ts:55` → `getTitanOrchestrator().getAetherArbiter().setManualOverride(nodeId, channels)`
- Este path **SÍ** llega al `NodeArbiter` L2, pero solo transporta canales crudos (`pan`, `tilt`, `dimmer`, etc.), NO targets espaciales.

**Conclusión M2:** La UI espacial (`SpatialTargetPad`) tiene **dos problemas acoplados**:
1. Resuelve IK en el legacy arbiter en lugar de enviar `targetX/Y/Z` al NodeArbiter
2. El legacy arbiter está desconectado del pipeline DMX

---

## Mission 3: El Gatekeeper Actual (NodeResolver)

### Estructura Evaluada por Frame

```typescript
// NodeResolver.ts:308 (resolve)
for (const [nodeId, channelValues] of arbitrated) {
  this._writeNode(nodeId, channelValues)
}
```

`channelValues` es un `Record<string, number>` con las keys que el NodeArbiter arbitró para ese nodo. Ejemplos de contenido tras arbitraje:

**Caso A — VMM automático (targetX presente):**
```typescript
{
  targetX: 2.45,   // metros
  targetY: 1.80,   // metros
  targetZ: 1.00,   // metros
  speed: 0.75,     // normalizado
}
```

**Caso B — Manual fader directo (ProgrammerAetherBridge):**
```typescript
{
  pan: 0.65,       // normalizado 0-1
  tilt: 0.40,      // normalizado 0-1
}
```

**Caso C — Manual espacial (SpatialTargetPad) — NUNCA LLEGA:**
```typescript
// Este caso NO existe en el NodeArbiter porque el spatial UI
// va al legacy arbiter, no al NodeArbiter.
```

### Lógica de Decisión en _writeNode

```typescript
// NodeResolver.ts:427-436
if (node.family === NodeFamily.KINETIC) {
  const kineticNode = node as IKineticNodeData
  if (!kineticNode.isContinuous && device.isPlaced === true) {
    // Ruta IK siempre para fixtures posicionados
    this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, writeToDmx)
    return
  }
  // isContinuous o isPlaced !== true → ruta clásica
}
```

**El gatekeeper es `device.isPlaced === true`.** Si es `false` o `undefined`, el fixture KINETIC siempre toma la ruta clásica (pan/tilt directos) sin importar qué canales estén presentes.

### Lógica de Decisión en _writeNodeIK

```typescript
// NodeResolver.ts:558-586
if (channelValues[CH_TARGET_X] !== undefined) {
  // FLUJO DIRECTO ESPACIAL
  tx = channelValues[CH_TARGET_X]
  ty = channelValues[CH_TARGET_Y] ?? 1.5
  tz = channelValues[CH_TARGET_Z] ?? 2.0
} else {
  // FK BRIDGE: pan/tilt normalizados → target 3D
  const fkTarget = this._forwardKinematicsBridge(node, panNorm, tiltNorm)
  tx = fkTarget.x; ty = fkTarget.y; tz = fkTarget.z
}
```

**Condición de routing dentro de IK:** Presencia de `targetX` en `channelValues`.
- Si `targetX` existe → **Direct Spatial** (VMM automático)
- Si `targetX` no existe pero hay `pan`/`tilt` → **FK Bridge** (legacy faders)
- Si ni `targetX` ni `pan`/`tilt` → **Fallback Static** (defaults Y=1.5, Z=2.0)

---

## Mission 4: El Fantasma de Legacy (ArbitrationDirector.ts)

### Estado: ZOMBIE — Procesando pero Desconectado

**¿Sigue mutando/interceptando datos?** **SÍ**, pero solo para ciertos consumidores:

| Función | Estado | Consumidor |
|---------|--------|------------|
| `masterArbiter.applySpatialTarget()` | **ACTIVO** | `AetherIPCHandlers.ts:253` (UI espacial) |
| `masterArbiter.setManualOverride()` | **ACTIVO** | UI legacy faders (vía stores antiguos) |
| `masterArbiter.arbitrate()` | **MUERTO** | Comentado en `TitanOrchestrator.ts:1294` |
| `masterArbiter.setTitanIntent()` | **MUERTO** | Comentado en `TitanOrchestrator.ts:1270` |
| Output a HAL | **MUERTO** | `HAL.renderFromTarget()` comentado |

### Evidencia de Bypass (WAVE-4592)

```typescript
// TitanOrchestrator.ts:1257-1260
// 🪓 WAVE-4592: LEGACY ARBITER BYPASS — ArbitrationDirector disconnected.
// masterArbiter.setTitanIntent / setEffectIntents / arbitrate() NO longer
// drive DMX or UI. Aether pipeline is the single source of truth.
```

### Evidencia de Vida Residual

```typescript
// AetherIPCHandlers.ts:240-266
ipcMain.handle('lux:aether:applySpatialTarget', (_event, { target, fixtureIds, fanMode, fanAmplitude }) => {
  // ...
  const results = masterArbiter.applySpatialTarget(target, fixtureIds, fanMode, fanAmplitude)
  // ...
})
```

**Veredicto:** El `ArbitrationDirector` está en estado **zombie**. No es seguro ignorarlo o demolerlo todavía porque:
1. `applySpatialTarget()` es la única implementación de IK grupal con fan mode en el codebase
2. La UI `SpatialTargetPad` depende de esta IPC para resolver targets espaciales
3. Antes de demoler, se debe **migrar** la lógica `ikSolveGroupWithFan()` al nuevo Aether pipeline (NodeArbiter + NodeResolver)

---

## Diagrama de Arquitectura Split-Brain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │ VMM Engine  │    │ SpatialTargetPad│    │ Programmer Faders           │  │
│  │ (automático)│    │ (manual 3D)      │    │ (manual pan/tilt directo) │  │
│  └──────┬──────┘    └────────┬────────┘    └─────────────┬───────────────┘  │
│         │                     │                           │                  │
│         ↓ IPC NONE           ↓ IPC                       ↓ IPC              │
│    (directo en              lux:aether:           lux:aether:              │
│     frame loop)              applySpatialTarget     setManualOverrides      │
└─────────────────────────────────────────────────────────────────────────────┘
         │                     │                           │
         ↓                     ↓                           ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│         │                     │                           │                  │
│         ↓                     ↓                           ↓                  │
│  ┌──────────────┐     ┌─────────────────┐     ┌─────────────────────────┐  │
│  │KineticAdapter│     │AetherIPCHandlers│     │AetherIPCHandlers        │  │
│  │ (Aether L0)  │     │:applySpatial    │     │:setManualOverrides      │  │
│  └──────┬───────┘     │  Target          │     │                         │  │
│         │             └────────┬────────┘     └───────────┬─────────────┘  │
│         ↓                      ↓                          ↓                │
│    IntentBus              masterArbiter              NodeArbiter (L2)        │
│         │              (ArbitrationDirector)         (Aether V2)           │
│         ↓                      ↓                          ↓                  │
│    NodeArbiter            ikSolveGroup()            setManualOverride()    │
│    (L0 merge)                  ↓                          ↓                │
│         │               setManualOverride()          Intent merge            │
│         ↓                      ↓                          ↓                │
│  ArbitratedNodeMap      LayerStateManager          ArbitratedNodeMap       │
│         │             (legacy, NO CONSUMIDO)              │                  │
│         ↓                      ⚠️                        ↓                  │
│  PhysicsPostProcessor      [ZOMBIE — no llega       NodeResolver            │
│         │                   a DMX]                      │                  │
│         ↓                      X                        ↓                  │
│  NodeResolver._writeNodeIK  [PERDIDO]              _writeNodeIK o Classic  │
│         │                                               │                  │
│         ↓                                               ↓                    │
│      DMX buffer                                      DMX buffer            │
│         │                                               │                  │
│    ═════╧═══════════════════════════════════════════════╧══════════════    │
│                         HAL.sendUniverseRaw()                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusiones para el Blueprint de Migración Split-Brain

1. **El VMM automático ya está en Aether V2 y funciona.** Emite `targetX/Y/Z` por `KineticAdapter` → `NodeArbiter` L0 → `NodeResolver` IK directo. No requiere cambios.

2. **La UI espacial manual está rota.** `SpatialTargetPad` resuelve IK en el legacy arbiter, cuya salida está desconectada. **Ningún target manual 3D llega al DMX** en la build actual.

3. **La ruta de faders directos SÍ funciona.** `ProgrammerAetherBridge` → `setManualOverrides` IPC → `NodeArbiter` L2 → `NodeResolver` FK Bridge o Classic path. Pero solo transporta `pan`/`tilt` crudos, no targets espaciales.

4. **Para unificar Split-Brain, se necesita:**
   - **Opción A (recomendada):** Mover `applySpatialTarget` del `ArbitrationDirector` al nuevo pipeline. El `SpatialTargetPad` debería emitir `targetX/Y/Z` directamente al `NodeArbiter` L2 (como hace el `KineticAdapter` en L0), sin pasar por IK solve en el legacy. El `NodeResolver` ya tiene el FK Bridge para fallback.
   - **Opción B (bridge temporal):** Después de `masterArbiter.applySpatialTarget()`, reinyectar los `{pan, tilt}` resultantes en el `NodeArbiter` vía `setManualOverride` con nodeId correcto. Pero esto es un parche frágil.

5. **El `ArbitrationDirector` NO es seguro de demoler** hasta que `applySpatialTarget` sea migrado. Es el único implementador de `ikSolveGroupWithFan()` para modos de fan (converge/line/circle).

---

*Fin del informe SPLIT-BRAIN-MAP.md.*
*ZERO CODE MUTATION — Mapa forense puro.*
