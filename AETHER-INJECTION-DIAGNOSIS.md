# 🔬 AETHER INJECTION DIAGNOSIS — WAVE 4593
## "El Mapa del Apagón"

**Estado:** Diagnóstico completo. Causa raíz identificada.  
**Rama:** `v3`  
**Prerequisito:** WAVE-4592 commit `c20e4bf0` (legacy bypass desconectado) + INCISIÓN-5 commit `2c235fb2`

---

## 1. RESUMEN EJECUTIVO

El apagón post-WAVE-4592 tiene **una causa raíz única y estructural**:

> **Las fixtures patcheadas en el flujo IPC legacy (`lux:patch-fixture`, `fixtures:addToPatch`) NUNCA pasan por `NodeExtractionPipeline.extract()` ni por `SpatialRegistrar.register()`. En consecuencia, `registerAetherDevice()` jamás se llama, `_aetherHasDevices` permanece `false`, y el bloque Aether completo es saltado en cada frame.**

No hay datos de dispositivos en el NodeGraph → el NodeArbiter arbitra el vacío → NodeResolver no escribe nada → `sendUniverseRaw()` nunca es llamada.

---

## 2. MAPA DEL PIPELINE COMPLETO (referencia)

```
[PATCH TIME - main process]
  configuración en disco (configManager / luxshow)
       │
       ▼ (ESTE SALTA AL VACÍO — aquí está el agujero negro)
  NodeExtractionPipeline.extract(fixtureDef, fv2)
       │
       ▼
  SpatialRegistrar.register(deviceDef, fv2.position, orchestrator)
       │
       ▼
  TitanOrchestrator.registerAetherDevice(enrichedDef)
       │  ├─ _aetherGraph.registerDevice(definition)  ← NodeGraph lleno
       │  ├─ _aetherHasDevices = true                 ← guard activo
       │  ├─ _chronosAetherAdapter.rebuildNodeIndex()
       │  └─ _aetherResolver.registerUniverse(universe)
       ▼
[FRAME LOOP @ 44Hz]
  if (_aetherHasDevices && hal)  ← solo ya entra aquí
    LiquidAetherAdapter.ingest()  → NodeGraph.getView(IMPACT) → dimmer L0
    ImpactAdapter.process()       → NodeGraph.getView(IMPACT) → dimmer L0 (prio 10)
    ColorAdapter.process()        → NodeGraph.getView(COLOR)  → rgb L0
    KineticAdapter.process()      → NodeGraph.getView(KINETIC)
    ...
    NodeArbiter.arbitrate()       → ArbitratedNodeMap
    PhysicsPostProcessor.process()
    AetherSafetyMiddleware
    NodeResolver.resolve(map)     → si getNodeData(nodeId) == null → silencio
       │
       ▼
    hal.sendUniverseRaw(universe, Uint8Array)  ← DMX real
```

---

## 3. VECTORES INVESTIGADOS

### VECTOR 1: ProgrammerAetherBridge → NodeArbiter L2
**Estado: CLEAN — no action needed**

- Bridge corre a 44Hz vía `setInterval`
- Mapeo familia→label: `IMPACT→'impact'`, `COLOR→'color'`, `KINETIC→'kinetic'`, `BEAM→'beam'`, `EXTRAS→'atmosphere'`
- Formatea correctamente: `{nodeId: "fix-1:impact", channels: {dimmer: 0.8}}`
- NodeArbiter L2: `setManualOverride(nodeId, channels)` → `_manualOverrides: Map<NodeId, Record<string, number>>` — aplicado como capa final (wins sobre todo)
- **El bridge está correcto. El problema es upstream.**

### VECTOR 2: NodeExtractionPipeline → SpatialRegistrar → registerAetherDevice
**Estado: BROKEN — la cadena nunca se invoca en producción**

- `NodeExtractionPipeline.extract()` existe y funciona (tests pasando)
- `SpatialRegistrar.register()` existe y funciona (tests pasando)
- `TitanOrchestrator.registerAetherDevice()` existe y funciona (llama `_aetherGraph.registerDevice()` + pone `_aetherHasDevices = true`)
- **PERO**: ningún código de producción instancia `NodeExtractionPipeline` ni llama `.extract()` al patchear fixtures
- `lux:patch-fixture` (IPCHandlers.ts:877) → solo hace `patchedFixtures.push(patched)` + `configManager.updateConfig()` → `safeWebSend('lux:fixtures-loaded')`
- `fixtures:addToPatch` (IPCHandlers.ts:733) → ídem
- `StageIPCHandlers.ts`: carga el show file → lo manda al renderer via IPC → **no activa Aether**
- **`_aetherHasDevices` está `false` siempre → el bloque Aether a 44Hz es saltado en su totalidad**

### VECTOR 3: NodeResolver → NodeGraph (condición de segundo fallo)
**Estado: SERÍA SILENT SKIP — si llegáramos aquí**

Incluso si `_aetherHasDevices` estuviera a `true`, si `_aetherGraph.getNodeData("fix-1:impact")` devuelve `undefined` (porque `registerDevice()` no fue llamado):
```typescript
// NodeResolver._writeNode()
const node = this._graph.getNodeData(nodeId)  // undefined si vacío
if (!node) return  // SILENCIO TOTAL — cero output, cero logs
```
El NodeResolver retorna sin escribir nada sin emitir ningún warning. Segundo muro de silencio.

---

## 4. ANÁLISIS DE LA ARQUITECTURA REAL

### Ruta legacy (pre-WAVE-4592)
```
configManager.patchedFixtures[]  →  this.fixtures[]
                                 ↓
TitanOrchestrator.processFrame()
  → buildFixtureStates(this.fixtures)
  → masterArbiter.arbitrate()       [DESCONECTADO en WAVE-4592]
  → renderFromTarget()              [DESCONECTADO en WAVE-4592]
  → flushToDriver()                 [DESCONECTADO en WAVE-4592]
```
Esto funcionaba porque `this.fixtures` se llenaba desde config y el árbitro legacy recorría ese array directamente.

### Ruta Aether (post-WAVE-4592, actualmente rota)
```
configManager.patchedFixtures[]
   ← AQUÍ HAY UN SALTO EN EL VACÍO →
NodeGraph.registerDevice()    ← ESTE STEP NO EXISTE EN PRODUCCIÓN
   ↓
_aetherHasDevices = true
   ↓ 44Hz
NodeResolver.resolve() → hal.sendUniverseRaw()   [CORRECTO, PERO INACCESIBLE]
```

### Ruta Aether (correcta, implementada solo en tests)
```
// patch-time:
const pipeline  = new NodeExtractionPipeline()
const registrar = new SpatialRegistrar()
const deviceDef = pipeline.extract(fixtureDef, dmxAddress, universe, zone)
registrar.register(deviceDef, fixtureV2.position, orchestrator)
// ↑ internamente llama orchestrator.registerAetherDevice(enrichedDef)
```

---

## 5. CAUSA RAÍZ EXACTA

**El eslabón perdido es un PATCH BRIDGE**: no existe ningún componente en el main process que, al recibir fixtures patcheadas (desde config, desde IPC, o al cargar un .luxshow), las pase por `NodeExtractionPipeline` y las registre en el NodeGraph de Aether.

Este bridge era innecesario cuando el árbitro legacy recorría `this.fixtures[]` directamente. Con WAVE-4592 el árbitro legacy desapareció, pero el bridge nunca fue creado.

---

## 6. FORMATO DE NODEID — Coherencia verificada

El bridge formatea: `"${fixtureId}:${familyLabel}"` → e.g. `"fix-123abc:impact"`

El `NodeExtractionPipeline` genera los nodeIds como:
```typescript
// Para cada nodo de la fixture con id "fix-123abc":
nodeId: `${deviceId}:impact`   // DeviceId viene de fv2.id
nodeId: `${deviceId}:color`
nodeId: `${deviceId}:kinetic`
```
**Coherencia confirmada** — los nodeIds generados por la pipeline coincidirían exactamente con los que usa el bridge, **siempre que** `deviceId === fixtureV2.id === fixtureId` (confirmado en NodeExtractionPipeline.ts líneas ~290-295: `resolvedDeviceId = fv2.id as DeviceId`).

---

## 7. PLAN DE CORRECCIÓN — WAVE 4594

### Objetivo
Crear el **Aether Patch Bridge**: componente main-process que, al cargar el show o al patchear fixtures, llame a `NodeExtractionPipeline.extract()` + `registerAetherDevice()` para cada fixture del show.

### Punto de integración recomendado
En `TitanOrchestrator`, añadir un método público:

```typescript
/**
 * WAVE 4594: Aether Patch Bridge
 * Registra todas las fixtures de un ShowFileV2 en el NodeGraph.
 * Llamar en patch-time: al cargar show y al añadir/eliminar fixtures.
 */
public syncFixturesToAether(
  fixtures: readonly FixtureV2[],
  fixtureLibrary: readonly FixtureDefinition[],
): void {
  // 1. Unregister all existing (para re-sync limpio)
  // 2. Por cada fixture en showFile.fixtures:
  //    a. Encontrar su FixtureDefinition en la library por profileId
  //    b. pipeline.extract(fixtureDef, fixtureV2)
  //    c. this.registerAetherDevice(deviceDef)
}
```

### Cuándo llamarlo
- Al cargar show (`lux:stage:load` / `lux:stage:loadActive` → después de que `stagePersistence.loadShow()` retorna con éxito)
- Al añadir fixture al patch (`fixtures:addToPatch` / `lux:patch-fixture`)
- Al eliminar fixture (`fixtures:removeFromPatch` / `lux:unpatch-fixture`)
- Al mover fixture en el Stage 3D (actualización de posición → `SpatialRegistrar.updateDevicePosition()`)

### Dependencias necesarias
- `NodeExtractionPipeline` (sin estado, instanciar una vez en el orchestrator)
- `SpatialRegistrar` (ya instanciado o instanciar en el orchestrator)
- Acceso a la `fixtureLibrary` (la lista de `FixtureDefinition[]` — actualmente en `getFixtureLibrary()` en IPCHandlers.ts)
- Acceso al `showFile.fixtures` (array de `FixtureV2[]`)

---

## 8. ESTADO DEL PIPELINE CONFIRMADO COMO CORRECTO

Una vez que `registerAetherDevice()` sea llamado, el resto del pipeline está verificado como funcionalmente correcto:

| Componente | Estado | Verificado |
|------------|--------|-----------|
| `NodeExtractionPipeline.extract()` | ✅ Correcto | Tests pasando, lógica legible |
| `SpatialRegistrar.register()` | ✅ Correcto | Llama `registerAetherDevice()` correctamente |
| `TitanOrchestrator.registerAetherDevice()` | ✅ Correcto | Llena NodeGraph + `_aetherHasDevices = true` |
| `NodeGraph.registerDevice()` | ✅ Correcto | Dense arrays + índices + O(1) lookup |
| `ImpactAdapter.process()` | ✅ Correcto | Itera `getView(IMPACT)`, produce `dimmer` en L0 |
| `LiquidAetherAdapter.ingest()` | ✅ Correcto | Itera `getView(IMPACT)` + `getView(COLOR)` |
| `NodeArbiter.arbitrate()` + L2 manual | ✅ Correcto | L2 overrides desde ProgrammerAetherBridge |
| `NodeResolver.resolve()` | ✅ Correcto | Pero silencia si nodeId no en NodeGraph |
| `hal.sendUniverseRaw()` | ✅ Correcto | Recibe el Uint8Array correctamente |
| `ProgrammerAetherBridge` | ✅ Correcto | Format y nodeIds coherentes |

**El sistema funciona de extremo a extremo — solo falta el primer eslabón: `registerAetherDevice()` nunca es llamado.**

---

## 9. HIPÓTESIS VERIFICADAS

| Hipótesis | Veredicto |
|-----------|-----------|
| **A: `_aetherHasDevices = false` → bloque saltado** | ✅ **CONFIRMADA — CAUSA RAÍZ** |
| **B: Fixtures sin nodos IMPACT/COLOR en NodeGraph** | ✅ **Consecuencia de A** — nunca se registran |
| **C: NodeIds mismatch** | ❌ Descartada — formato coherente |
| **D: Pipeline de arbitración rota** | ❌ Descartada — L2 manual override correcto |
| **E: NodeResolver silencia sin error** | ✅ Secundaria — ocurriría si A fuera false |

---

*Generado en WAVE 4593. Próxima acción: WAVE 4594 — Aether Patch Bridge.*
