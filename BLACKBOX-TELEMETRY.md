# WAVE 4621-A / 4622-A — THE BLACK BOX TELEMETRY AUDIT

**Auditor:** Cascade  
**De:** Dirección de Arquitectura  
**Asunto:** Sondas de Velocidad IK, Geometría del Haz Invertida  
**Fecha:** 2026-05-07  
**Estado:** Sondas inyectadas y documentadas

---

## PARTE I: SONDEOS DE CAJA NEGRA (Inyectados)

### Sonda 1: FK Bridge Output

**Archivo:** `electron-app/src/core/aether/resolver/NodeResolver.ts`  
**Método:** `_writeNodeIK`  
**Línea:** ~673  
**Throttle:** cada 60 frames (`this._resolveFrameIndex % 60 === 0`)

```typescript
if (this._resolveFrameIndex % 60 === 0) {
  console.log(
    `[FK-PROBE] node=${String(node.nodeId)} ` +
    `panNorm=${panNorm.toFixed(4)} tiltNorm=${tiltNorm.toFixed(4)} ` +
    `→ target=(${fkTarget.x.toFixed(3)},${fkTarget.y.toFixed(3)},${fkTarget.z.toFixed(3)})`,
  )
}
```

**Qué mide:** Conversión de pan/tilt normalizados (0-1) a coordenadas 3D (metros) vía `_forwardKinematicsBridge`. Si target=(NaN,NaN,NaN) o (0,0,0), el FK Bridge está fallando.

---

### Sonda 2: IK Engine Raw Output

**Archivo:** `electron-app/src/core/aether/resolver/NodeResolver.ts`  
**Método:** `_writeNodeIK`  
**Línea:** ~690  
**Throttle:** cada 60 frames

```typescript
if (this._resolveFrameIndex % 60 === 0) {
  console.log(
    `[IK-PROBE] node=${String(node.nodeId)} ` +
    `target=(${tx.toFixed(3)},${ty.toFixed(3)},${tz.toFixed(3)}) ` +
    `→ rawPan=${ikResult.pan.toFixed(1)} rawTilt=${ikResult.tilt.toFixed(1)} ` +
    `reachable=${ikResult.reachable !== false}`,
  )
}
```

**Qué mide:** Salida cruda del `InverseKinematicsEngine.solve()`. Valores en grados DMX (0-255). Si rawPan/rawTilt son iguales frame tras frame, el motor IK está devolviendo valores congelados o el target es unreachable.

---

### Sonda 3a: Physics 3D Spatial Limits

**Archivo:** `electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts`  
**Método:** `process()`  
**Línea:** ~350  
**Throttle:** cada 60 frames (`this._telemetryFrame % 60`)

```typescript
if ((++this._telemetryFrame % 60) === 0) {
  console.log(
    `[PHYSICS-3D] node=${String(node.nodeId)} mode=${this._mode} ` +
    `stageHalf=(${this._stageHalfW.toFixed(2)},${this._stageHalfH.toFixed(2)},${this._stageHalfD.toFixed(2)}) ` +
    `diag=${this._stageDiag.toFixed(2)} stageScale=${stageScale.toFixed(2)} ` +
    `motorSpeeds=(pan=${node.maxPanSpeed},tilt=${node.maxTiltSpeed}) ` +
    `maxVel3D=(${this._maxVelX3d.toFixed(4)},${this._maxVelY3d.toFixed(4)},${this._maxVelZ3d.toFixed(4)}) ` +
    `maxAcc3D=${this._maxAcc3d.toFixed(4)} dt=${this._dt.toFixed(4)} ` +
    `target=(${this._x3dTarget.toFixed(2)},${this._y3dTarget.toFixed(2)},${this._z3dTarget.toFixed(2)})`,
  )
}
```

**Qué mide:** Límites de velocidad 3D. Si `maxVel3D=(0,0,0)`, la velocidad está estrangulada a cero → fixture congelado. Si `dt=0`, no hay tiempo de integración.

**Fórmula crítica:**

```typescript
const stageScale = this._stageDiag / REF_STAGE_DIAG
const safetyMaxVel = SAFETY_MAX_3D_VEL_BASE_MS * Math.max(1.0, stageScale)
this._maxVelX3d = Math.min(node.maxPanSpeed * DEG_TO_RAD * this._stageHalfW, safetyMaxVel)
```

Si `stageHalfW=0` o `stageDiag=0` → `maxVelX3d=0`.

---

### Sonda 3b: Physics Legacy Pan/Tilt Limits

**Archivo:** `electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts`  
**Método:** `process()`  
**Línea:** ~416  
**Throttle:** cada 60 frames

```typescript
if ((++this._telemetryFrame % 60) === 0) {
  console.log(
    `[PHYSICS-LEGACY] node=${String(node.nodeId)} mode=${this._mode} ` +
    `panTarget=${this._panTarget.toFixed(4)} tiltTarget=${this._tiltTarget.toFixed(4)} ` +
    `maxVelNorm=${this._maxVelNorm.toFixed(6)} maxAccNorm=${this._maxAccNorm.toFixed(6)} ` +
    `dt=${this._dt.toFixed(4)} panPos=${state[SLOT_PAN_POS].toFixed(4)} tiltPos=${state[SLOT_TILT_POS].toFixed(4)}`,
  )
}
```

**Qué mide:** Límites de velocidad normalizados para pan/tilt legacy. Si `maxVelNorm=0`, el fixture no puede moverse en modo clásico.

---

### Sonda 4 (WAVE 4622-A): Gatekeeper Routing

**Archivo:** `electron-app/src/core/aether/resolver/NodeResolver.ts`  
**Línea:** ~661  
**Throttle:** cada 60 frames

```typescript
const route = hasTargetX ? 'DIRECT-SPATIAL' : (hasPanTilt ? 'FK-BRIDGE' : 'FALLBACK-STATIC')
if (this._resolveFrameIndex % 60 === 0) {
  console.log(
    `[GATEKEEPER] node=${String(node.nodeId)} route=${route} ` +
    `hasTargetX=${hasTargetX} hasPanTilt=${hasPanTilt} ` +
    `inputPan=${channelValues['pan']?.toFixed(4) ?? 'N/A'} inputTilt=${channelValues['tilt']?.toFixed(4) ?? 'N/A'}`,
  )
}
```

**Qué mide:** Qué ruta toma el fixture en `_writeNodeIK`. `DIRECT-SPATIAL`=canales espaciales presentes; `FK-BRIDGE`=pan/tilt traducidos a target 3D; `FALLBACK-STATIC`=sin input → defaults (0,1.5,2.0).

---

### Sonda 5 (WAVE 4622-A): Stage Bounds Propagation

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`  
**Método:** `_updateAetherStageBounds`  
**Línea:** ~2980

```typescript
console.log(
  `[STAGE-BOUNDS] input=(${stageBounds?.width?.toFixed(2) ?? 'N/A'},${stageBounds?.height?.toFixed(2) ?? 'N/A'},${stageBounds?.depth?.toFixed(2) ?? 'N/A'}) ` +
  `current=(${bounds.width.toFixed(2)},${bounds.height.toFixed(2)},${bounds.depth.toFixed(2)})`,
)
```

**Qué mide:** Si `input=N/A` o `current=(0,0,0)`, las dimensiones del escenario nunca llegan al PhysicsPostProcessor.

---

### Sonda 6 (WAVE 4622-A): Frame Loop Position Freeze

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`  
**Línea:** ~1944  
**Throttle:** cada 60 frames (`this.frameCount % 60`)

```typescript
if (this.frameCount % 60 === 0) {
  const kineticView = this._aetherGraph.getView(NodeFamily.KINETIC)
  kineticView.forEach((node: IKineticNodeData) => {
    console.log(
      `[FRAME-LOOP] node=${String(node.nodeId)} ` +
      `currentPosition.pan=${node.currentPosition.pan.toFixed(6)} ` +
      `currentPosition.tilt=${node.currentPosition.tilt.toFixed(6)} ` +
      `isPlaced=${this._aetherGraph.getDevice(node.deviceId)?.isPlaced ?? false}`,
    )
  })
}
```

**Qué mide:** Si `currentPosition.pan/tilt` son idénticos frame tras frame, la resolución no está actualizando los valores.

---

## PARTE II: FIX VISUAL DEL EMBUDO (Beam Cone Geometry)

### Anatomía del Bug

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx`  
**Líneas:** 420-441

```tsx
<mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]} rotation={[Math.PI, 0, 0]}>
  <coneGeometry args={[1.0, 3.5, 16, 1, true]} />
```

### Por qué está invertido

Three.js `ConeGeometry(radius, height, radialSegments, heightSegments, openEnded)` tiene la siguiente geometría nativa:

| Punto | Posición local Y | Radio |
|-------|-----------------|-------|
| Apex (punta) | `+height/2 = +1.75` | `0` (teórico) |
| Base (círculo ancho) | `-height/2 = -1.75` | `radius = 1.0` |
| Eje del cono | `+Y` | — |

El mesh del haz se posiciona en `[0, -1.83, 0]` dentro del grupo `head` (el cabezal del fixture).

Con `rotation={[Math.PI, 0, 0]}` (180° alrededor de X):
- El eje del cono se invierte: apunta ahora en `-Y`
- El **apex** (punta fina, radio≈0) queda en `Y = -1.83 + (-1.75) = -3.58`
- La **base** (círculo ancho, radio=1.0) queda en `Y = -1.83 + 1.75 = -0.08`

La lente del fixture está en `Y = -0.08` dentro del mismo grupo `head`.

**Resultado visual:**
- Base ancha (radio 1.0) coincide exactamente con la lente (Y ≈ -0.08) ❌
- Punta fina (radio ~0) apunta hacia el suelo/escenario (Y ≈ -3.58) ❌

Esto es un **embudo invertido** — físicamente imposible para un haz de luz, que debe ser **estrecho en la lente y ensancharse hacia el escenario**.

---

### Fórmula Geométrica Correcta

Un haz de luz real se modela como un **cilindro truncado cónico**: radio pequeño en el origen (lente), radio grande en la distancia (escenario).

Three.js no tiene `truncatedConeGeometry`, pero `CylinderGeometry` acepta radios diferentes en cada extremo:

```typescript
CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded)
```

**Geometría correcta para el haz:**

```tsx
{showBeam && (fixture.isPlaced !== false) && (
  <mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]} rotation={[0, 0, 0]}>
    <cylinderGeometry args={[0.08, 1.0, 3.5, 16, 1, true]} />
    <meshBasicMaterial
      ref={beamMaterialRef}
      color={fixture.color}
      transparent
      opacity={0.0}
      side={THREE.DoubleSide}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      clippingPlanes={[]}
    />
  </mesh>
)}
```

**Desglose de la fórmula:**

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `radiusTop` | `BEAM_RADIUS_MIN = 0.08` | Radio en la lente (estrecho, 8cm en escena 1:1) |
| `radiusBottom` | `BEAM_RADIUS_MAX = 1.0` | Radio en el suelo (ancho, 1m en escena 1:1) |
| `height` | `3.5` | Longitud del haz (3.5 unidades = ~3.5m) |
| `radialSegments` | `16` | Resolución circular |
| `heightSegments` | `1` | Mínimo para rendimiento |
| `openEnded` | `true` | Sin tapas — additive blending requiere geometría abierta |

**Posicionamiento:**

```
position={[0, -height/2 - 0.08, 0]}  // = [0, -1.83, 0]
```

El centro del cilindro está a `-1.83` en Y local del cabezal:
- `Top` (radio 0.08) queda en `Y = -1.83 + 1.75 = -0.08` → **exactamente en la lente** ✓
- `Bottom` (radio 1.0) queda en `Y = -1.83 - 1.75 = -3.58` → **hacia el escenario** ✓

**Rotación:**

```
rotation={[0, 0, 0]}  // Sin rotación — el cilindro apunta nativamente en +Y→-Y
```

`CylinderGeometry` tiene su eje a lo largo de Y, con `radiusTop` en `+height/2` y `radiusBottom` en `-height/2`. Como `radiusTop < radiusBottom`, la forma se ensancha hacia `-Y`, que es la dirección del haz desde el cabezal hacia el suelo.

**Actualización dinámica del zoom (WAVE 2088.12):**

El ancho del haz en vivo se controla mutando `scale.x` y `scale.z` del mesh:

```typescript
const targetRadius = BEAM_RADIUS_MIN + (smoothZoom.current ?? 0.5) * (BEAM_RADIUS_MAX - BEAM_RADIUS_MIN)
beamMeshRef.current.scale.x = targetRadius / BEAM_RADIUS_MIN   // normalizado respecto al mínimo
beamMeshRef.current.scale.z = targetRadius / BEAM_RADIUS_MIN
```

Con `cylinderGeometry` en lugar de `coneGeometry`, el mismo sistema de escalado funciona idénticamente porque ambos son meshes radiales simétricos.

---

### TL;DR del Fix

```diff
- <mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]} rotation={[Math.PI, 0, 0]}>
-   <coneGeometry args={[1.0, 3.5, 16, 1, true]} />
+ <mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]} rotation={[0, 0, 0]}>
+   <cylinderGeometry args={[0.08, 1.0, 3.5, 16, 1, true]} />
```

---

*Fin del informe BLACKBOX-TELEMETRY.md.*
*SONDAS INYECTADAS — awaiting runtime telemetry.*
