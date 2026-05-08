# WAVE 4624-A — THE OIL LEAK (isPlaced Path Tracing)

**Auditor:** Cascade  
**De:** Dirección de Arquitectura  
**Asunto:** Rastreo forense del path de `isPlaced` desde ShowFile hasta NodeResolver  
**Fecha:** 2026-05-07  
**Estado:** SOLO LECTURA — ZERO CODE MUTATION

---

## RESUMEN EJECUTIVO

**VEREDICTO: NO HAY FUGA EN EL PATH DEL CÓDIGO.**

La propiedad `isPlaced` vive en el path correcto (`fixture.isPlaced`) en TODOS los eslabones de la cadena. El código la lee, la propaga y la evalúa correctamente. El "oil leak" no es un bug de mapeo — es un **problema de datos históricos**.

---

## MISIÓN 1: Dónde vive isPlaced en el JSON original

**File:** `electron-app/src/core/stage/ShowFileV2.ts`  
**Line:** 676

```typescript
export interface FixtureV2 {
  id: string
  name: string
  model: string
  manufacturer: string
  type: 'moving-head' | 'par' | ...
  address: number
  universe: number
  channelCount: number
  profileId: string

  position: Position3D        // ← raíz, NO anidado
  rotation: Rotation3D        // ← raíz, NO anidado
  orientation: InstallationOrientation  // ← raíz

  isPlaced?: boolean          // ← RAÍZ. NO está en position.isPlaced,
                              //   NO está en flags.isPlaced,
                              //   NO está en physics.isPlaced.
                              //   Es una propiedad opcional del fixture mismo.

  physics: PhysicsProfile
  zone: FixtureZone
  // ...
}
```

**Hallazgo:** `isPlaced` está EXACTAMENTE en `fixture.isPlaced` — nivel raíz del objeto FixtureV2. No hay anidamiento incorrecto.

---

## MISIÓN 2: Qué lee el Orquestador

**File:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`  
**Method:** `_buildFixtureV2ForAether()`  
**Line:** 2863

```typescript
private _buildFixtureV2ForAether(fixture: any, definition: FixtureDefinition): FixtureV2 {
  return {
    id: fixture.id,
    name: fixture.name ?? definition.name ?? fixture.id,
    // ...
    position: fixture.position ?? { x: 0, y: 0, z: 0 },
    rotation: fixture.rotation ?? { x: 0, y: 0, z: 0 },
    orientation: fixture.orientation ?? fixture.installationType ?? 'ceiling',

    // WAVE 4623 (cambio del usuario):
    isPlaced: fixture.isPlaced || false,

    physics: fixture.physics ?? { ... },
    // ...
  } as FixtureV2
}
```

**Hallazgo:** El orquestador lee `fixture.isPlaced` desde el objeto fixture recibido (que ya viene normalizado en `setFixtures()`). El path de lectura es correcto: `fixture.isPlaced`.

**Nota sobre el cambio WAVE 4623:**  
`fixture.isPlaced || false` — si el fixture original tiene `isPlaced === undefined` (show file antiguo, pre-WAVE 4573), se coerciona a `false`. Esto es intencional y documentado: "si el show no trae isPlaced explícito, caemos al dominio clásico por seguridad."

---

## CADENA DE PROPAGACIÓN COMPLETA

```
ShowFileV2.fixture.isPlaced          (raíz del objeto fixture)
         ↓
TitanOrchestrator.setFixtures()
  this.fixtures = fixtures.map(f => ({...f, ...}))  // spread conserva isPlaced
         ↓
TitanOrchestrator._syncFixturesToAether()
  const fixtureV2 = this._buildFixtureV2ForAether(fixture, def)
    isPlaced: fixture.isPlaced || false   // ← LECTURA CORRECTA
         ↓
NodeExtractionPipeline.extract(def, fixtureV2)
  resolvedIsPlaced = fv2.isPlaced        // ← LECTURA CORRECTA
  return {
    deviceId, name, type, ...
    ...(resolvedIsPlaced !== undefined && { isPlaced: resolvedIsPlaced })
  } satisfies IDeviceDefinition
         ↓
NodeGraph.registerDevice(deviceDef)
  _deviceDefs.set(deviceDef.deviceId, deviceDef)  // ← ALMACENAMIENTO CORRECTO
         ↓
NodeResolver._writeNode()  [hot-path 44Hz]
  const device = this._nodeGraph.getDevice(node.deviceId)
  if (!kineticNode.isContinuous && device.isPlaced === true) {
    // ← EVALUACIÓN CORRECTA
  }
```

---

## MISIÓN 3: Si el objeto destino soporta almacenar la variable

**File:** `electron-app/src/core/aether/device.ts`  
**Interface:** `IDeviceDefinition`  
**Line:** 143-147

```typescript
export interface IDeviceDefinition {
  deviceId: DeviceId
  name: string
  type: string
  dmxAddress: number
  universe: number
  channelCount: number
  nodes: readonly ICapabilityNode[]
  calibration?: IDeviceCalibration
  isVirtual?: boolean
  orientation?: string
  isPlaced?: boolean       // ← EXPLÍCITAMENTE DEFINIDO
}
```

**Hallazgo:** `IDeviceDefinition` tiene `isPlaced?: boolean` explícitamente. TypeScript no lo ignorará ni lo perderá.

**File:** `electron-app/src/core/aether/NodeGraph.ts`  
**Method:** `registerDevice()` + `getDevice()`  
**Lines:** 240, 305-306, 402-404

```typescript
private readonly _deviceDefs = new Map<DeviceId, IDeviceDefinition>()

registerDevice(definition: IDeviceDefinition): readonly NodeId[] {
  // ... registra nodos ...
  this._deviceDefs.set(definition.deviceId, definition)  // ← Guarda el objeto completo
}

getDevice(deviceId: DeviceId): IDeviceDefinition | undefined {
  return this._deviceDefs.get(deviceId)  // ← Recupera el objeto completo
}
```

**Hallazgo:** NodeGraph almacena y recupera el `IDeviceDefinition` completo mediante un Map. La propiedad `isPlaced` viaja intacta.

---

## CONCLUSIÓN FORENSE

**No hay oil leak en el código.** El path de `isPlaced` es correcto en los 5 eslabones:

| Eslabón | Archivo | Línea | Estado |
|---------|---------|-------|--------|
| Origen (JSON) | ShowFileV2.ts | 676 | `fixture.isPlaced` — raíz, correcto |
| Normalización | TitanOrchestrator.ts | 2622 | Spread conserva `isPlaced` del objeto original |
| Lectura V2 | TitanOrchestrator.ts | 2863 | `fixture.isPlaced || false` — path correcto |
| Pipeline | NodeExtractionPipeline.ts | 322, 360 | `fv2.isPlaced` → `isPlaced: resolvedIsPlaced` — correcto |
| Destino | device.ts | 147 | `isPlaced?: boolean` — explícito en interfaz |
| Almacenamiento | NodeGraph.ts | 240, 402 | Map<DeviceId, IDeviceDefinition> — conserva todo |
| Consumidor | NodeResolver.ts | 526 | `device.isPlaced === true` — evalúa correctamente |

### LA VERDAD REAL DEL BLOQUEO

Si `fixture.isPlaced` llega como `undefined` al orquestador, el coercimiento `|| false` lo convierte en `false`, lo cual activa el **gatekeeper clásico** y desvía el fixture al path legacy (pan/tilt directo), saltándose el IK completamente.

**Esto ocurre cuando:**
- El show file fue creado **antes de WAVE 4573** (no tenía el campo `isPlaced`).
- El fixture fue añadido vía **Quick-Add** sin pasar por el StageBuilder 3D.
- El fixture tiene posición 3D (`fixture.position`) pero NO tiene `isPlaced: true` explícito.

**El gatekeeper está funcionando EXACTAMENTE como fue diseñado:**
- `isPlaced === true` → ruta IK (spatial)
- `isPlaced !== true` → ruta clásica (2D pan/tilt)

**El "bloqueo" no es un bug — es una condición de seguridad intencional que rechina con show files históricos.**

---

## RECOMENDACIÓN (para la Dirección de Arquitectura)

Si la intención es que **todo fixture con `position` definida** se considere espacial automáticamente, el fix es cambiar la heurística del orquestador:

```typescript
// En _buildFixtureV2ForAether():
// Opción A: Inferir isPlaced=true si hay posición real
isPlaced: fixture.isPlaced ?? (fixture.position &&
  (fixture.position.x !== 0 || fixture.position.y !== 0 || fixture.position.z !== 0)),

// Opción B: Invertir la lógica: default=true, solo false cuando se fuerce
isPlaced: fixture.isPlaced !== false,  // undefined → true, false → false
```

Pero esto es una **mutación de lógica**, no de código de lectura. La lectura ya es correcta.

---

*Fin del informe forense WAVE 4624-A.*
*VEREDICTO: PATH CORRECTO — ROOT CAUSE ES HISTORIAL DE DATOS, NO BUG DE MAPEO.*
