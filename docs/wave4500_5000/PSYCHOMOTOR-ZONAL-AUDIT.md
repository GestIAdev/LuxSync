# WAVE 4615-A — THE PSYCHOMOTOR & ZONAL MAP
## Auditoría Forense de Cinemática, Escalas y Zonas en Aether Matrix

**Estado**: SOLO LECTURA FORENSE (ZERO CODE MUTATION)  
**Auditor**: Cascade / Kimi  
**Fecha**: 2026-05-07  
**Scope**: NodeResolver.ts, AetherSafetyMiddleware.ts, PhysicsPostProcessor.ts, KineticAdapter.ts, LiquidAetherAdapter.ts, zoneUtils.ts, TitanOrchestrator.ts (frame loop), ShowFileV2.ts, NodeExtractionPipeline.ts  

---

## EXECUTIVE SUMMARY

Se identificaron **tres fallos estructurales independientes** que explican los tres síntomas críticos reportados:

1. **Safe Mode Freeze**: El `_lastKineticTargets` caché (WAVE 4614) no tiene datos en el arranque (outputEnabled=false por defecto), por lo que `_writeNodeIK` resuelve IK con valores safe-center (targetX=0, targetY=1.5, targetZ=2.0) → `currentPosition` se bloquea en centro neutro hasta que se activa output.

2. **Movimiento Errático y Lento**: Colisión de escalas en PhysicsPostProcessor. El VMM emite [-1,+1] abstractos, KineticAdapter los proyecta a metros usando `stageBounds`, pero PhysicsPostProcessor convierte `maxPanSpeed` (grados/s) a m/s con un factor fijo `4.0/270` que ignora la altura del fixture y la distancia al target. La inercia espacial se aplica con velocidad mal calibrada, produciendo movimiento sub-amortiguado o sobre-suavizado.

3. **Fractura Zonal**: Las zonas canónicas del ShowFileV2 usan **kebab-case** (`movers-left`, `left`, `front`), pero `selectZoneFromResult` y `selectColorRoleFromZone` en `zoneUtils.ts` usan **camelCase** (`moverLeft`, `frontLeft`). Los fixtures con zonas canónicas kebab-case caen al `default` y reciben promedio global (`selectZoneFromResult`) o rol cromático `ambient` (`selectColorRoleFromZone`), haciendo que fixtures de la misma zona semántica reaccionen con intensidades y colores diferentes.

---

## 1. MISIÓN 1 — SAFE MODE FREEZE AUDIT

### 1.1 Orden de Ejecución en el Frame Loop (TitanOrchestrator.ts)

```
Frame N:
  1. Adapters (KineticAdapter, ColorAdapter, etc.) → emiten intents al bus
  2. NodeArbiter.arbitrate() → produce arbitrated Map<NodeId, channels>
  3. PhysicsPostProcessor.process(arbitrated, ...)       [L1871]
  4. AetherUIProjector.project(fixtureStates, graph, arbitrated)  [L1882]
  5. emitHotFrame() → envía fixtureStates a la UI         [L1883]
  6. aetherSafety.setOutputEnabled(this._outputEnabled)   [L1896]
  7. aetherSafety.applyOutputGate(arbitrated)             [L1910]  ← MUTA in-place
  8. aetherResolver.resolve(arbitrated)                   [L1949]  ← lee mapa YA gateado
  9. HAL.sendUniverseRaw()                                [L1956]
```

**Crítico**: El `AetherUIProjector.project()` corre **ANTES** del gate y del resolve. Esto significa que la UI ve `currentPosition` del **frame N-1** (del nodo en el NodeGraph), no del frame actual.

### 1.2 Mecanismo del Output Gate (AetherSafetyMiddleware.ts)

```typescript
applyOutputGate(arbitrated: Map<NodeId, Record<string, number>>): void {
  if (this._outputEnabled) return
  for (const [nodeId, channels] of arbitrated) {
    if (this._manualNodeIds.has(nodeId)) continue
    for (const k of Object.keys(channels)) {
      if (SAFE_CENTER_CHANNELS.has(k)) {
        channels[k] = k === 'targetX' ? 0 : k === 'targetY' ? 1.5 : k === 'targetZ' ? 2.0 : 0.5
      } else {
        channels[k] = 0
      }
    }
  }
}
```

Cuando `outputEnabled=false`:
- `targetX` → `0`
- `targetY` → `1.5`
- `targetZ` → `2.0`
- `pan`, `tilt` → `0.5` (safe-center)
- `dimmer` → `0`

Esto **muta el mapa `arbitrated` in-place** antes de que `NodeResolver.resolve()` lo consuma.

### 1.3 Caché de Targets Pre-Gate (NodeResolver.ts WAVE 4614)

El `_writeNodeIK` implementa un caché `_lastKineticTargets` para preservar el target real cuando el gate está activo:

```typescript
// NodeResolver.ts L641-L674
const outputEnabled = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled()

if (outputEnabled) {
  this._lastKineticTargets.set(node.nodeId, [rawTx, rawTy, rawTz])   // L657
  tx = rawTx; ty = rawTy; tz = rawTz
} else {
  const cached = this._lastKineticTargets.get(node.nodeId)
  if (cached !== undefined) {
    ;[tx, ty, tz] = cached                                          // L667
  } else {
    tx = rawTx    // ← safe-center: 0
    ty = rawTy    // ← safe-center: 1.5
    tz = rawTz    // ← safe-center: 2.0
  }
}
```

### 1.4 Root Cause del Freeze

**Condición de arranque**: Al iniciar la aplicación, `outputEnabled` es `false` (safe mode hasta activación manual). El caché `_lastKineticTargets` está **vacío** (nunca se ha cacheado un target real).

**Secuencia del fallo**:

1. Frame 0 (output=false):
   - `applyOutputGate` aplasta targetX=0, targetY=1.5, targetZ=2.0
   - `_writeNodeIK` recibe estos valores gateados
   - No hay caché → usa safe-center como target
   - `solve(profile, {0, 1.5, 2.0}, ...)` → retorna pan=128, tilt=128 (centro neutro)
   - `node.currentPosition.pan = 128/255 ≈ 0.5` (safe-center) — L718
   - **No escribe a buf DMX** (return en L725)

2. Frame 0 UI:
   - `AetherUIProjector.project()` leyó `currentPosition` del frame N-1 (inicial/default)
   - Pero `node.currentPosition` fue actualizado en resolve() del frame 0 a 0.5
   - La UI del frame 1 mostrará 0.5 (centro)

3. Frame 1..N (output sigue false):
   - `_writeNodeIK` sigue sin caché (nunca se guardó nada porque outputEnabled=false)
   - Cada frame resuelve IK con safe-center → currentPosition permanece en 0.5
   - **Fixtures "congelados" en posición neutra (safe-center)**

4. Frame N+1 (output=true):
   - `applyOutputGate` no muta (outputEnabled=true, pasa sin cambios)
   - `_writeNodeIK` recibe target real del VMM
   - Cachea el target real por primera vez
   - Resuelve IK con target real → currentPosition se actualiza
   - PERO `AetherUIProjector.project()` ya corrió en este frame con el currentPosition del frame N
   - **La UI no refleja el cambio hasta el frame N+2**

**Conclusión**: El caché WAVE 4614 mitiga el freeze **solo si hubo un frame previo con output=true**. En el arranque (output siempre false), no hay caché histórico y los fixtures se congelan en safe-center. La posición real del VMM nunca llega a `currentPosition` mientras output esté desactivado.

### 1.5 Puntos de Choque

| Punto | Archivo | Línea | Problema |
|-------|---------|-------|----------|
| Caché vacío en arranque | NodeResolver.ts | L665-672 | Si no hay caché, usa safe-center como target para IK |
| Gate aplasta antes de resolve | TitanOrchestrator.ts | L1910 | applyOutputGate muta arbitrated antes de resolve |
| UI ve frame N-1 | TitanOrchestrator.ts | L1882 | AetherUIProjector.project() corre antes del gate y del resolve |
| Safe-center hardcoded | AetherSafetyMiddleware.ts | L~220 | targetY=1.5, targetZ=2.0 son arbitrarios y no coinciden con el escenario real |

---

## 2. MISIÓN 2 — AUDITORÍA DE ESCALAS (GRADOS vs METROS)

### 2.1 Pipeline Completo VMM → IK

```
VibeMovementManager.generateIntent(vibeId, audio, stereoIndex, ...)
  ↓
  intent.x ∈ [-1, +1]     (coordenada abstracta del patrón coreográfico)
  intent.y ∈ [-1, +1]
  intent.speed ∈ [0, 1]

KineticAdapter.process() [KineticAdapter.ts L156-261]
  ↓
  projectedX = intent.x * (stageBounds.width / 2)     // metros
  projectedY = centerY + intent.y * (stageBounds.height / 2) // metros
  projectedZ = stageBounds.depth / 2                  // metros
  
  Emite: targetX=projectedX, targetY=projectedY, targetZ=projectedZ  [METROS]

NodeArbiter.arbitrate()
  ↓
  Mapa arbitrated con canales espaciales en metros

PhysicsPostProcessor.process() [PhysicsPostProcessor.ts L1-599]
  ↓
  Para nodos KINETIC con targetX/Y/Z:
    maxVel3dMs = min(node.maxPanSpeed * DEG_PER_SEC_TO_METERS_PER_SEC, 5.0)
    DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270  // factor fijo global
    Aplica suavizado (SNAP o CLASSIC) en metros
    Escribe entry['targetX/Y/Z'] suavizados de vuelta

NodeResolver.resolve() → _writeNodeIK() [NodeResolver.ts L634-746]
  ↓
  Recibe targetX, targetY, targetZ en METROS (ya suavizados)
  currentPanDMX = node.currentPosition.pan * 255   // hint del frame N-1
  solve(profile, {x: tx, y: ty, z: tz}, currentPanDMX)
    ↓
    IKEngine calcula pan/tilt DMX (0-255) desde posición 3D en metros
  safePan = clamp + airbag(ikResult.pan)
  safeTilt = clamp + airbag(ikResult.tilt)
  node.currentPosition.pan = safePan / 255
  node.currentPosition.tilt = safeTilt / 255
```

### 2.2 Formato en Cada Etapa

| Etapa | Formato | Unidad | Rango Típico |
|-------|---------|--------|--------------|
| VMM output | `intent.x`, `intent.y` | Normalizado abstracto | [-1, +1] |
| KineticAdapter | `targetX`, `targetY`, `targetZ` | Metros | [-4, +4] X, [0, 3] Y, [0, 1] Z (depende de stageBounds) |
| PhysicsPostProcessor input/output | `targetX/Y/Z` | Metros | Igual que arriba (suavizado) |
| NodeResolver._writeNodeIK input | `targetX/Y/Z` | Metros | Igual que arriba |
| IKEngine.solve input | `{x, y, z}` | Metros | Igual que arriba |
| IKEngine.solve output | `pan`, `tilt` | DMX | [0, 255] |
| NodeResolver write-back | `currentPosition.pan/tilt` | Normalizado | [0, 1] |

**NO hay colisión de tipos** en el pipeline principal (VMM → KineticAdapter → Physics → NodeResolver → IKEngine). Todos manejan metros para posición 3D. La colisión está en **PhysicsPostProcessor** donde se mezclan grados/s con metros/s.

### 2.3 Fallo de Escala en PhysicsPostProcessor

```typescript
// PhysicsPostProcessor.ts (extracto forense)
const DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270  // ≈ 0.01481

const maxVel3dMs = Math.min(
  node.maxPanSpeed * DEG_PER_SEC_TO_METERS_PER_SEC,
  SAFETY_MAX_3D_VEL_MS,  // 5.0
)
```

**Problema**: `node.maxPanSpeed` es la velocidad máxima del fixture en **grados/segundo** (ej. 540°/s para un mover rápido). PhysicsPostProcessor la convierte a metros/segundo multiplicando por `4.0 / 270`.

Este factor asume que:
- 270°/s de rotación pan = 4.0 m/s de barrido lateral

**Por qué es incorrecto**:
1. **No considera la altura del fixture**: Un fixture a 6m de altura tiene un radio de giro mayor que uno a 2m. La misma velocidad angular produce más metros/segundo de barrido a mayor altura.
2. **No considera la distancia al target**: Si el target está cerca del fixture, el mismo ángulo de pan cubre pocos metros. Si está lejos, cubre más metros.
3. **No diferencia pan vs tilt**: `maxPanSpeed` se aplica a los 3 ejes (X, Y, Z) por igual en la inercia 3D. Pero el tilt tiene limitaciones mecánicas diferentes (generalmente más lento que pan).
4. **Depende del tamaño del escenario**: Un escenario de 12m de ancho produce targets en X de [-6, +6]. Un escenario de 4m produce [-2, +2]. El mismo patrón VMM (intent.x=0.5) genera targets a 3m o 1m respectivamente. PhysicsPostProcessor aplica la misma velocidad máxima en m/s independientemente del escenario.

**Impacto en el síntoma "errático y lento"**:
- Si el escenario es grande (12m ancho) y el factor de conversión está subestimado: `maxVel3dMs` es demasiado bajo → la inercia suaviza excesivamente → movimiento **lento**
- Si el escenario es pequeño (4m ancho) y el factor está sobreestimado: `maxVel3dMs` es demasiado alto → la inercia no suaviza suficiente → movimiento **errático** (respuesta brusca)
- Para fixtures en posiciones laterales (X grande), el mismo ángulo de pan cubre más metros que para fixtures centrales. La velocidad máxima en m/s debería ser mayor para fixtures laterales, pero PhysicsPostProcessor usa la misma para todos.

### 2.4 Problema Adicional: currentPanDMX del Frame Anterior

```typescript
// NodeResolver.ts L676-L679
const currentPanDMX = node.currentPosition.pan * 255
const ikResult = solve(profile, { x: tx, y: ty, z: tz }, currentPanDMX)
```

El IKEngine recibe `currentPanDMX` como hint para evitar saltos de 180° (selección de rama de la cinemática inversa). Pero `currentPanDMX` es la posición del **frame N-1** (porque `currentPosition` se actualiza en resolve() del frame N-1, y AetherUIProjector lee currentPosition del frame N-1 para enviar a la UI).

En condiciones normales (44Hz), 1 frame de lag no es perceptible. Pero si hay:
- Un cambio brusco de target (saltos en el patrón VMM)
- O un `deltaMs` grande (lag de frame, >200ms)
- El hint `currentPanDMX` puede estar desfasado, causando que `solve()` elija la rama incorrecta de la cinemática inversa → **salto repentino de 180° en pan** (movimiento errático).

### 2.5 Puntos de Choque

| Punto | Archivo | Problema |
|-------|---------|----------|
| Conversión grados→metros fija | PhysicsPostProcessor.ts | `4.0/270` no considera altura ni distancia al target |
| maxPanSpeed para 3 ejes | PhysicsPostProcessor.ts | `maxVel3dMs` se aplica por igual a X, Y, Z sin considerar que pan y tilt tienen velocidades diferentes |
| Hint desfasado | NodeResolver.ts L676 | `currentPanDMX` es del frame N-1, puede causar saltos de rama en IK |
| StageBounds vs VMM | KineticAdapter.ts | El VMM no conoce stageBounds; un patrón abstracto se estira/comprime según el escenario |

---

## 3. MISIÓN 3 — AUDITORÍA DE FRACTURA ZONAL

### 3.1 Flujo de la Propiedad `zone`

```
ShowFileV2.fixture.zone  (FixtureZone / CanonicalZone)
  ↓
StagePersistence.loadShowFile() → normalizeZone(fixture.zone)  [StagePersistence.ts L358]
  ↓
TitanOrchestrator._buildFixtureV2ForAether(fixture)  [TitanOrchestrator.ts L2830]
  zone: this._normalizeAetherZone(fixture.zone)  // L2851
  ↓
NodeExtractionPipeline.extract(definition, fixtureV2)  [NodeExtractionPipeline.ts L281]
  resolvedZone = fv2.zone as ZoneId  // L314
  ↓
_buildAllNodes(deviceId, resolvedZone, ...)  // L460
  zoneId se inyecta en cada nodo (COLOR, IMPACT, KINETIC, etc.)
  ↓
LiquidAetherAdapter.ingest()
  _routeImpactNodes(result, bus) → node.zoneId  // LiquidAetherAdapter.ts L240
  _routeMoodToColorIntensity(result, frame, bus) → node.zoneId  // L318
```

### 3.2 Zonas Canónicas del ShowFileV2

```typescript
// ShowFileV2.ts L281-L291
export type CanonicalZone =
  | 'front'
  | 'back'
  | 'floor'
  | 'left'
  | 'right'
  | 'movers-left'
  | 'movers-right'
  | 'ambient'
  | 'unassigned'
```

Todas en **kebab-case** (con guiones). El normalizador `normalizeZone()` convierte legacy strings a estas 9 zonas canónicas.

### 3.3 Matching de Zonas en LiquidAetherAdapter

```typescript
// LiquidAetherAdapter.ts L348-L368
private _selectReactiveZoneIntensity(result: LiquidStereoResult, zoneId: string): number {
  switch ((zoneId || '').toLowerCase()) {
    case 'unassigned':
    case 'center':
    case 'mid':
      return average9Zones(result)
    case 'front':
      return clamp01((result.frontLeftIntensity + result.frontRightIntensity) * 0.5)
    case 'back':
      return clamp01((result.backLeftIntensity + result.backRightIntensity) * 0.5)
    case 'left':
      return clamp01((result.frontLeftIntensity + result.backLeftIntensity + result.moverLeftIntensity) / 3)
    case 'right':
      return clamp01((result.frontRightIntensity + result.backRightIntensity + result.moverRightIntensity) / 3)
    case 'movers-left':
      return result.moverLeftIntensity
    case 'movers-right':
      return result.moverRightIntensity
    default:
      return selectZoneFromResult(result, zoneId)
  }
}
```

Este switch **funciona** para las zonas canónicas kebab-case porque:
- `'movers-left'.toLowerCase()` → `'movers-left'` → matchea `case 'movers-left'`
- `'left'.toLowerCase()` → `'left'` → matchea `case 'left'`

### 3.4 Matching de Zonas en zoneUtils.ts (FALLIDO)

```typescript
// zoneUtils.ts L95-L123
export function selectZoneFromResult(result: LiquidStereoResult, nodeZone: string): number {
  switch (nodeZone) {
    case 'frontLeft':   return result.frontLeftIntensity
    case 'frontRight':  return result.frontRightIntensity
    case 'backLeft':    return result.backLeftIntensity
    case 'backRight':   return result.backRightIntensity
    case 'moverLeft':   return result.moverLeftIntensity
    case 'moverRight':  return result.moverRightIntensity
    case 'floor':       return result.floorIntensity
    case 'ambient':     return result.ambientIntensity
    case 'air':         return result.airIntensity
    default: {
      const avg = (result.frontLeftIntensity + result.frontRightIntensity + ...) / 6
      return avg
    }
  }
}
```

**PROBLEMA**: `selectZoneFromResult` usa **camelCase** (`'moverLeft'`, `'frontLeft'`). Las zonas canónicas del ShowFileV2 son **kebab-case** (`'movers-left'`). Cuando `_selectReactiveZoneIntensity` recibe una zona que no reconoce (va al `default`), llama `selectZoneFromResult(result, zoneId)` con la zona kebab-case original. Esta función NO matchea ningún case y cae al default, retornando el **promedio de las 6 zonas clásicas**.

**Ejemplo**: Un fixture con `zone = 'movers-left'`:
- `_selectReactiveZoneIntensity`: matchea `'movers-left'` → retorna `result.moverLeftIntensity` ✓
- Si en el futuro se usa `selectZoneFromResult` directamente (por ejemplo, en un nuevo adapter): cae al default → **promedio global** ✗

**Ejemplo**: Un fixture con `zone = 'left'`:
- `_selectReactiveZoneIntensity`: matchea `'left'` → retorna promedio de `(frontLeft + backLeft + moverLeft) / 3` ✓
- `selectColorRoleFromZone` (para asignar rol cromático):

```typescript
// zoneUtils.ts L189-L209
export function selectColorRoleFromZone(zoneId: string): 'primary' | 'secondary' | 'accent' | 'ambient' {
  switch (zoneId) {
    case 'frontLeft':
    case 'frontRight':
    case 'front':
      return 'primary'
    case 'backLeft':
    case 'backRight':
    case 'back':
      return 'secondary'
    case 'moverLeft':
    case 'moverRight':
      return 'accent'
    case 'ambient':
    case 'air':
    case 'floor':
    default:
      return 'ambient'
  }
}
```

**PROBLEMA**: `selectColorRoleFromZone` también usa camelCase. Para zonas canónicas kebab-case:
- `'movers-left'` → no matchea → `default: return 'ambient'`
- `'left'` → no matchea → `default: return 'ambient'`
- `'right'` → no matchea → `default: return 'ambient'`

### 3.5 Tabla de Fractura Zonal

| Zona Canónica (ShowFileV2) | `_selectReactiveZoneIntensity` | `selectZoneFromResult` (fallback) | `selectColorRoleFromZone` |
|---------------------------|--------------------------------|-----------------------------------|---------------------------|
| `'front'` | ✓ Promedio frontLeft+frontRight | ✗ Default (promedio global) | ✓ `'primary'` |
| `'back'` | ✓ Promedio backLeft+backRight | ✗ Default (promedio global) | ✓ `'secondary'` |
| `'left'` | ✓ Promedio front+back+mover left | ✗ Default (promedio global) | ✗ `'ambient'` (debería ser ?) |
| `'right'` | ✓ Promedio front+back+mover right | ✗ Default (promedio global) | ✗ `'ambient'` (debería ser ?) |
| `'movers-left'` | ✓ `moverLeftIntensity` | ✗ Default (promedio global) | ✗ `'ambient'` (debería ser `'accent'`) |
| `'movers-right'` | ✓ `moverRightIntensity` | ✗ Default (promedio global) | ✗ `'ambient'` (debería ser `'accent'`) |
| `'floor'` | ✗ Default → `selectZoneFromResult` | ✓ `'floorIntensity'` | ✓ `'ambient'` |
| `'ambient'` | ✗ Default → `selectZoneFromResult` | ✓ `'ambientIntensity'` | ✓ `'ambient'` |
| `'unassigned'` | ✓ Promedio global | ✗ Default (promedio global) | ✗ `'ambient'` |

### 3.6 Root Cause de la Fractura

**Dos formatos de zona coexisten sin unificación**:
1. **Formato A (ShowFileV2 / canonical)**: kebab-case con zonas compuestas (`'movers-left'`, `'left'`, `'right'`)
2. **Formato B (zoneUtils.ts)**: camelCase con zonas atómicas (`'moverLeft'`, `'frontLeft'`, `'backLeft'`)

**Consecuencias**:
- Fixtures con `'movers-left'` reciben intensidad correcta en `_selectReactiveZoneIntensity` pero **rol cromático `'ambient'`** en `selectColorRoleFromZone` → colores equivocados
- Fixtures con `'left'` reciben intensidad correcta (promedio de 3 zonas) pero **rol cromático `'ambient'`** → colores equivocados
- Cualquier adapter que use `selectZoneFromResult` directamente (en lugar de `_selectReactiveZoneIntensity`) recibe el **promedio global** para zonas kebab-case → intensidad completamente diferente a fixtures de la misma zona semántica
- Si dos fixtures están en la misma zona semántica pero uno tiene `zone='left'` y otro tiene `zone='frontLeft'` (por ejemplo, por migración incompleta), reciben intensidades diferentes:
  - `'left'` → promedio de 3 zonas (left composite)
  - `'frontLeft'` → `frontLeftIntensity` (zona atómica)
  - Estos valores pueden ser significativamente diferentes dependiendo del análisis FFT

### 3.7 Puntos de Choque

| Punto | Archivo | Problema |
|-------|---------|----------|
| Inconsistencia kebab vs camel | `zoneUtils.ts` | `selectZoneFromResult` y `selectColorRoleFromZone` usan camelCase; ShowFileV2 usa kebab-case |
| Zona compuesta vs atómica | `zoneUtils.ts` | `'left'` (compuesta) no existe en `selectZoneFromResult`; `'frontLeft'` (atómica) no existe en ShowFileV2 canonical |
| Floor/Ambient unhandled | `LiquidAetherAdapter.ts` | `'floor'` y `'ambient'` caen al default de `_selectReactiveZoneIntensity` y van a `selectZoneFromResult` |
| Falta de normalización en NodeExtractionPipeline | `NodeExtractionPipeline.ts` | No normaliza `zoneId` a un formato canónico único |

---

## 4. MAPA DE DEPENDENCIAS Y CHOQUE DE DATOS

```
ShowFileV2.fixture.zone (kebab-case canonical)
    │
    ▼
NodeExtractionPipeline.extract() → zoneId (sin normalización)
    │
    ├─► LiquidAetherAdapter._selectReactiveZoneIntensity()  [kebab-case switch — funciona]
    │     ├─► _routeImpactNodes() → dimmer
    │     └─► _routeMoodToColorIntensity() → brightness
    │
    ├─► zoneUtils.selectColorRoleFromZone()  [camelCase switch — FALLA para kebab]
    │     └─► ColorAdapter/SeleneAetherAdapter → rol cromático
    │
    └─► zoneUtils.selectZoneFromResult()  [camelCase switch — FALLA para kebab]
          └─► ImpactAdapter (legacy) o cualquier adapter que lo use directamente
```

---

## 5. RECOMENDACIONES DE REMEDIACIÓN (ZERO CODE MUTATION — SOLO DOCUMENTACIÓN)

### 5.1 Safe Mode Freeze

1. **Pre-poblar el caché `_lastKineticTargets`** con los targets reales del VMM en cada frame, independientemente de `outputEnabled`. El gate debe bloquear solo el write a DMX, no el cálculo de `currentPosition`.
2. O separar completamente el path de `currentPosition` (para UI) del path de DMX write. Calcular IK con targets reales siempre, y usar el gate solo para el buffer DMX.
3. Considerar que `AetherUIProjector.project()` corre antes de resolve, por lo que la UI siempre tiene 1 frame de lag. Esto es aceptable a 44Hz, pero el freeze de safe-center es independiente del lag.

### 5.2 Escalas

1. **Recalibrar `DEG_PER_SEC_TO_METERS_PER_SEC`**: El factor `4.0/270` debe derivarse dinámicamente de la altura del fixture y la distancia promedio al target, no ser una constante global.
2. **Diferenciar maxPanSpeed vs maxTiltSpeed**: Si el fixture tiene velocidades diferentes para pan y tilt, PhysicsPostProcessor debería usar velocidades distintas para X (pan) e Y (tilt) en el espacio 3D.
3. **Considerar stageBounds en VMM**: El VMM podría recibir `stageBounds` como contexto para que los patrones coreográficos se adapten al tamaño real del escenario, evitando que un patrón se vea "lento" en escenarios grandes.
4. **Eliminar o documentar el hint `currentPanDMX`**: Si el lag de 1 frame causa saltos de rama en IK, considerar usar un predictor o eliminar el hint (dejar que el solver elija la rama más cercana al target espacial, no al pan anterior).

### 5.3 Zonas

1. **Unificar formato de zona a kebab-case en todo el pipeline**: Actualizar `selectZoneFromResult` y `selectColorRoleFromZone` para usar las mismas strings que `CanonicalZone` (`'movers-left'`, `'left'`, `'right'`, `'front'`, `'back'`).
2. **Agregar cases faltantes**:
   - `'movers-left'` → `'accent'` (en `selectColorRoleFromZone`)
   - `'movers-right'` → `'accent'`
   - `'left'` → `'secondary'` o `'accent'` (definir semánticamente)
   - `'right'` → `'secondary'` o `'accent'`
3. **Normalizar en pipeline**: `NodeExtractionPipeline` o `_normalizeAetherZone` debería garantizar que `zoneId` sea siempre un valor canónico kebab-case, rechazando o migrando camelCase legacy.
4. **Eliminar duplicación**: `_selectReactiveZoneIntensity` y `selectZoneFromResult` tienen lógica solapada. Considerar un único point-of-truth para zone→intensity.

---

*Fin del informe forense. Cero mutación de código realizada. Todos los hallazgos derivan exclusivamente de lectura estática del código fuente.*
