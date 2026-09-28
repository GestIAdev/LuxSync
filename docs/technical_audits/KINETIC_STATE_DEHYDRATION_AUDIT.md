# WAVE 8270-RECON — Kinetic State Dehydration Audit

**Tipo:** Forense, estrictamente lectura/análisis. Sin cambios de código.

**Síntoma reportado:** al remapear, conectar o desconectar un foco en caliente
en el circuito DMX, las fixtures pierden su estado mecánico (prismas, gobos,
rotación continua, Pan/Tilt → home/defaults) mientras el color RGBW se recupera
al instante.

---

## 1. Veredicto ejecutivo

La amnesia NO ocurre en las instancias de nodo del NodeGraph (que se recrean,
pero son efímeras por diseño). Ocurre en **`NodeArbiter.purgeForShow()`**, que
se ejecuta **en CADA cambio de patch** — no solo al cargar show — y borra
todos los mapas L2 (estado escrito por el operador) para **TODOS** los
fixtures, incluidos los que no se tocaron.

El estado cinético del operador vive exclusivamente en cuatro mapas del
`NodeArbiter` y un singleton de engine, todos indexados por `nodeId`
(determinista: `${deviceId}:${family}`):

| Mapa | Contenido | ¿Sobrevive al repatch? |
|---|---|---|
| `NodeArbiter._manualOverrides` | Radar anchor (`pan_base`/`tilt_base`), `pan`/`tilt` manuales, `rotation`, `speed`, gobo, prism, canales del Programmer | ❌ `purgeForShow()` |
| `NodeArbiter._motorKineticOverrides` | Output del engine L2 + **targetX/Y/Z espaciales** (radar espacial) | ❌ `purgeForShow()` |
| `NodeArbiter._releaseStates` / `_manualPatternLocks` / `_inhibitLimits` | Fades de retorno, locks de patrón, inhibit caps | ❌ `purgeForShow()` |
| `NodeArbiter._spatialCoupledLock` / `_spatialSuppressedNodes` / `_spatialDistanceScales` | Locks de modo IK | ⚠️ NO se purgan (leak: quedan huérfanos) |
| `AetherKineticEngine._nodeConfigs`/`_phaseMap`/`_overridePool`/`_smoothOffset*` | Config de patrón por nodo (pattern, speed, amplitude, fan, mountOrientation) | ✅ Singleton de módulo; `purgeForShow` no lo toca |
| `PhysicsPostProcessor._states` | Posición+velocidad pan/tilt y estado 3D por nodo | ✅ `registerNode` es idempotente; jamás se borran entradas |
| `AetherSafetyMiddleware._kineticState`/`_darkSpinState` | Velocidad previa, DarkSpin | ✅ `registerKineticNode` idempotente |
| `NodeResolver._prev8bitNorm`/`_prev16bit*`/`_governorMaps`/`_ignitionMap` | Caches de salida por device:channel | ✅/rebuild en `registerDevice` |
| Frontend `programmerStore.fixtureOverrides`, `movementStore`, `kineticHydrationStore` | **La verdad del operador completa** | ✅ Sobrevive… pero nunca se re-emite |

---

## 2. Cadena forense exacta de la amnesia

### Paso 0 — El operador escribe estado

- Radar clásico → `KineticsBridge` → `lux.aether.setManualOverrides` →
  `arbiter.setManualOverride(nodeId, { pan_base, tilt_base, … })`.
- Radar espacial → `applySpatialTarget` → `arbiter.setMotorKineticOverride(nodeId, { targetX/Y/Z })`
  + `setSpatialCoupledLock` (`AetherIPCHandlers.ts:1122-1146`).
- Patrones → `setManualKinetics` → `AetherKineticEngine._nodeConfigs` +
  `_manualPatternLocks`; el engine escribe `pan_base`/`tilt_base` (o
  `pan_offset`/`tilt_offset` en modo IK) en `_motorKineticOverrides` cada tick
  (`AetherKineticEngine.ts:619+`, invocado desde `TickEngine.ts:1778`).
- Gobos/prism/rotation/speed del Programmer → `ProgrammerAetherBridge._flush()`
  → `setManualOverride` — **solo cuando hay dirty flags**.

### Paso 1 — El trigger: cualquier mutación del patch

`stageStore.ts` dispara `lux.aether.setFixtures(allFixtures, null)` en:
`addFixture` (766), `addFixtures`/`duplicateFixture`/`removeFixture(s)` (783-855),
y **`updateFixture` cuando cambia `position`/`rotation`/`orientation`/`address`/`universe`
(883-891)** — o sea, *remapear un foco* entra aquí. También `StageIPCHandlers:45`
y `TitanSyncBridge:162`.

### Paso 2 — `TitanOrchestrator.setFixtures` (`TitanOrchestrator.ts:1127-1161`)

```
_isHydrating = true                         // tick bloqueado
hydrationEngine.setFixtures(fixtures)       // FixtureHydrationEngine.ts:121
  ├─ hal.invalidateProfileCache()
  ├─ hal.purgeShowState()                   // buffers DMX del worker + universes + _colorSnapshot → wipe
  ├─ hal.registerMover(id, orientación)     // re-registro fresco por mover
  └─ _syncFixturesToAether()                // FixtureHydrationEngine.ts:348
       ├─ unregisterDevice() × TODOS        // líneas 420-423 — swap atómico total
       └─ registerAetherDevice() × TODOS    // nodos ICapabilityNode NUEVOS
                                             //   (currentPosition → defaults)
this._aetherArbiter?.purgeForShow()         // TitanOrchestrator.ts:1155  ☠️ AMNESIA
_isHydrating = false
```

### Paso 3 — `NodeArbiter.purgeForShow()` (`NodeArbiter.ts:1604-1617`)

```ts
this._manualOverrides.clear()          // ← radar anchors, gobos, prism, rotation, speed
this._motorKineticOverrides.clear()    // ← output del engine + targetX/Y/Z espaciales
this._releaseStates.clear()
this._manualPatternLocks.clear()
this._moverShieldNodeIds.clear()
this._inhibitLimits.clear()
this._calibrationIntents = []
```

Su docstring dice *"al cargar un show"*, pero `setFixtures` es también la ruta
de hot-patch: **una purga diseñada para show-load se ejecuta en cada remapeo**.

### Paso 4 — Por qué cada síntoma aparece

| Síntoma | Mecanismo |
|---|---|
| **Fan / rotación continua muere** | `KineticAdapter` hace early-return en nodos `isContinuous` (`KineticAdapter.ts:229-231`): la rotación SOLO viene de L2. Purga → sin intent → `defaultValue` del canal → parada total. |
| **Gobos / prismas a 0** | Vivían en `_manualOverrides`; purgados → `defaultValue` (slot abierto/0). |
| **Pan/Tilt a "home"** | Con L2 vacío, la puerta de supremacía L2 se abre (`hasNode`/`getManualOverride`/`getMotorKineticOverride` → vacíos) → `KineticAdapter` re-emite `pan_offset`/`tilt_offset` del VMM → el arbiter fusiona sobre base neutra 0.5 → coreografía automática centrada = *"volvió a home"*. |
| **Radar aim perdido** | `pan_base`/`tilt_base` borrados; si el patrón del engine sobrevive (`_nodeConfigs` sí sobrevive), el patrón reanuda orbitando alrededor de **0.5/0.5** (centro del universo) en lugar del punto del radar. |
| **Target espacial perdido** | `targetX/Y/Z` vive en `_motorKineticOverrides` como escritura **one-shot** de IPC — no hay re-emisor por frame. Purga → fuera de modo IK para siempre (hasta re-touch del operador). |

### Paso 5 — Por qué el color sí recupera

RGBW lo re-emite L0 **cada frame** (Selene/Liquid adapters) — es estado
derivado del audio, no escrito por el operador. El estado cinético es
operator-authored (escritura one-shot en mapas L2): una vez purgado,
**ningún componente lo re-emite**.

### Paso 6 — Lo irónico: el estado físico SÍ sobrevive

`PhysicsPostProcessor._states` nunca se limpia (`registerNode` es idempotente,
no existe `unregisterNode`). La posición pan/tilt real persiste → el fixture
**interpolación suave hacia el target equivocado** en lugar de saltar. Por eso
se percibe como un "regreso a casa" fluido y no como un corte.

Además, el **frontend conserva la verdad completa** (`programmerStore.fixtureOverrides`,
`movementStore`), pero `ProgrammerAetherBridge` es push-on-dirty y `KineticsBridge`
es push-on-change: ninguno re-emite tras un repatch. El estado existe; el puente
no lo cruza.

### Leaks secundarios detectados (informativos)

- `_spatialCoupledLock`, `_spatialSuppressedNodes`, `_spatialDistanceScales`
  NO están en `purgeForShow` → locks huérfanos post-repatch (bajo riesgo porque
  nodeIds son estables, pero inconsistente).
- `AetherSafetyMiddleware._deviceUniverseMap`/`_virtualDeviceIds` no se limpian
  en `unregisterAetherDevice` (solo `registerDevice` sobreescribe) → deviceIds
  muertos persisten.
- `PhysicsPostProcessor._states`, `_prevKineticPos`, `_handoffPassThrough`
  crecen sin eviction para nodeIds eliminados → leak acotado pero real.

---

## 3. Propuesta de desacoplamiento — `KineticStateStore`

Objetivo: el estado mecánico **explícito del operador** deja de ser propiedad
de los mapas efímeros del arbiter y pasa a un store indexado por `deviceId`
(estable entre repatches; los nodeIds `${deviceId}:${suffix}` se derivan).

### 3.1 Modelo de datos (conceptual)

```ts
interface FixtureKineticState {
  // L2 operator-authored — canales explícitos (pan_base, tilt_base,
  // rotation, speed, gobo, prism, focus, zoom…)
  manualChannels: Record<string, number>
  // Radar espacial (IK mode)
  spatialTarget: { x: number; y: number; z: number } | null
  // Pista del motor L2 (mirror de AetherKineticEngine._nodeConfigs)
  pattern: {
    pattern: NativeKineticPattern
    speed: number; amplitude: number; fan: number
    fanIndex: number; fanTotal: number
    mountOrientation: string
  } | null
  patternLock: boolean
  inhibitLimit: number | null
  // Verdad física capturada al morir el nodo (rehidratación de PPP)
  lastPhysicalPan: number; lastPhysicalTilt: number
  updatedAtMs: number
}
```

`KineticStateStore` vive en el proceso Main, junto al `NodeArbiter`
(mismo lifetime que el orchestrator — sobrevive repatches y reloads del
renderer).

### 3.2 Escritura (write-through, patch/gesture time — nunca 44Hz)

Interceptores mínimos, todos fuera del hot path:

| Escritor actual | Punto de espejo al store |
|---|---|
| `arbiter.setManualOverride()` | merge de `channels` en `manualChannels` |
| `arbiter.clearManualOverride()` | borrado selectivo (respetando pattern-lock/anchor) |
| `arbiter.setMotorKineticOverride()` con `targetX` | `spatialTarget = {x,y,z}` |
| `aetherKineticEngine.setManualKinetics()` | `pattern = cfg` por nodeId→deviceId |
| `aetherKineticEngine.removeNodes()`/`stop()` | `pattern = null` |
| `arbiter.setInhibitLimit()`/`clearInhibitLimit()` | `inhibitLimit` |
| `PPP.process()` | `lastPhysicalPan/Tilt` — opcional, throttled (cada ~250ms o solo en unregister) |

### 3.3 Rehidratación en `registerAetherDevice`

Dentro de `FixtureHydrationEngine.registerAetherDevice`, **después** de
`graph.registerDevice` y **antes** de soltar el próximo frame (ya estamos bajo
`_isHydrating`, así que es atómico respecto al tick):

```
para cada nodeId KINETIC/BEAM del device:
  state = store.get(deviceId)
  si no hay state → comportamiento actual (defaults)
  si hay:
    1. arbiter.setManualOverride(nodeId, state.manualChannels)   // radar anchor, gobos…
    2. si state.spatialTarget → setMotorKineticOverride + setSpatialCoupledLock
    3. si state.pattern → engine.setManualKinetics(nodeId, cfg, …) + setManualPatternLock
    4. si inhibitLimit → arbiter.setInhibitLimit
    5. physicsPostProcessor.seedClassicState(nodeId, lastPan, lastTilt)
       → el primer frame ya emite la posición real (delta=0, sin glide a home)
```

El fixture re-parchado sale al aire **ya en su estado** — ni snap ni glide.

### 3.4 Purga con scope, no nuclear

Hoy `purgeForShow()` es binario: o todo o nada, y corre en TODO `setFixtures`.
Separar dos niveles:

- **`purgeForDevice(deviceId)`** — invalida solo los mapas del device eliminado.
  En `_syncFixturesToAether`, diff entre `existingIds` y `staged`: purgar solo
  los que realmente desaparecen; los supervivientes conservan sus mapas L2.
- **`purgeForShow()`** — solo en carga de show real (distinguir `loadShow` vs
  `patchDelta` en `setFixtures`, p. ej. flag `opts.fullRebuild`).

### 3.5 (Alternativa barata, complementaria) — Re-push desde frontend

`_showGeneration` ya existe y se incrementa en cada `setFixtures`
(`TitanOrchestrator.ts:1132`). Broadcast `patchGeneration` por IPC →
`KineticsBridge` + `ProgrammerAetherBridge` re-marcan como dirty todo el
`fixtureOverrides`/`movementStore` y re-flushean una vez. Ventaja: la fuente
de verdad ya existe en el renderer. Desventaja: dos fuentes de verdad (frontend
+ backend) y un race window de ~1 frame; el store en Main es más robusto.

### 3.6 Higiene asociada (aprovechar la wave)

- `unregisterNode(nodeId)` en `PhysicsPostProcessor` + `AetherSafetyMiddleware`
  (eviction real de `_states`, `_prevKineticPos`, `_kineticState`,
  `_darkSpinState`) — hoy es leak latente.
- Añadir `_spatialCoupledLock`, `_spatialSuppressedNodes`,
  `_spatialDistanceScales` a la purga por-device (hoy quedan huérfanos).
- `AetherSafety.unregisterDevice(deviceId)` para `_deviceUniverseMap` /
  `_virtualDeviceIds` / `_universeDeviceMap`.

---

## 4. Resumen de una línea

> La instancia del foco no "contiene" el estado — el estado L2 del operador
> vive en `NodeArbiter._manualOverrides`/`_motorKineticOverrides`, y
> `setFixtures()` los **borra globalmente vía `purgeForShow()` en cada cambio
> de patch**, mientras el frontend que aún posee la verdad no la re-emite.
> Fix arquitectónico: `KineticStateStore` por `deviceId` + rehidratación en
> `registerAetherDevice` + purga con scope por device.
