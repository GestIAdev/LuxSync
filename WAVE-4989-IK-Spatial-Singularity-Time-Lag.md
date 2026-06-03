# WAVE 4989 — FORENSIC AUDIT: IK SPATIAL SINGULARITY & TIME LAG

**Date:** 2026-06-03  
**Status:** AUDIT COMPLETE — ZERO CODE GENERATION  
**Scope:** Matemática IK que traduce target espacial a pan/tilt DMX; mecanismos de suavizado temporal entre el target y el hardware.

---

## 1. LA MATEMÁTICA ESPACIAL — Singularidad del foco central

### 1.1 La función `solve()` del IKEngine

**File:** `src/engine/movement/InverseKinematicsEngine.ts` | **Lines:** 203–245

```typescript
export function solve(
  fixture: IKFixtureProfile,
  target: Target3D,
  currentPanDMX: number | null = null
): IKResult {
  // ── PASO 1: Vector fixture → target en coordenadas de escenario ──
  const dx = target.x - fixture.position.x
  const dy = target.y - fixture.position.y
  const dz = target.z - fixture.position.z

  // ── PASO 2: Transformar al frame local del fixture ──
  const mountAngles = MOUNT_ANGLES[fixture.orientation.installation] ?? MOUNT_ANGLES['ceiling']
  
  const totalPitchRad = (mountAngles.pitch + fixture.orientation.rotation.pitch) * DEG_TO_RAD
  const totalYawRad   = (mountAngles.yaw   + fixture.orientation.rotation.yaw)   * DEG_TO_RAD
  const totalRollRad  = (mountAngles.roll  + fixture.orientation.rotation.roll)  * DEG_TO_RAD

  const local = rotateToLocalFrame(dx, dy, dz, totalPitchRad, totalYawRad, totalRollRad)

  // ── PASO 3: Detección de Gimbal Lock ──
  const horizontalDist = Math.sqrt(local.x * local.x + local.z * local.z)
  const isGimbalLock = horizontalDist < GIMBAL_LOCK_EPSILON  // 0.001 metros = 1mm

  // ── PASO 4: Calcular ángulos en el frame local ──
  let panDeg: number
  if (isGimbalLock) {
    // Target directamente arriba/abajo del fixture → pan indeterminado.
    // Usar el pan actual para evitar giros erráticos.
    if (currentPanDMX !== null) {
      panDeg = dmxToDegrees(currentPanDMX, fixture.limits.panRangeDeg)
    } else {
      panDeg = 0  // Default: mirar al frente
    }
  } else {
    panDeg = Math.atan2(local.x, -local.z) * RAD_TO_DEG
  }

  const tiltDeg = Math.atan2(horizontalDist, -local.y) * RAD_TO_DEG
```

### 1.2 Análisis de la singularidad — foco directamente sobre el target

Cuando un fixture está **directamente encima** del target (misma X y misma Z en el escenario):

- `dx = 0`, `dz = 0` → después de rotación al frame local → `local.x = 0`, `local.z = 0`
- `horizontalDist = sqrt(0 + 0) = 0`
- `isGimbalLock = 0 < 0.001` → **true**

**Pan:** el ángulo es indeterminado (`atan2(0,0)`). El código usa `currentPanDMX` convertido a grados, o `0°` (frente) si no hay currentPan.

**Tilt:** `atan2(0, -local.y)`.

| Caso | `local.y` | `-local.y` | `tiltDeg` | Significado DMX |
|------|-----------|------------|-----------|-----------------|
| Fixture en techo, target en suelo | -5m | +5 | `atan2(0, +5) = 0°` | Centro mecánico = **horizontal** |
| Fixture en suelo, target en techo | +5m | -5 | `atan2(0, -5) = 180°` | Máximo tilt = **hacia arriba** |

**En nuestro rig (ceiling mount):** fixture en techo (Y ≈ 5m), target en suelo (Y = 0). `tiltDeg = 0°` → el haz apunta **horizontalmente** (paralelo al techo), no hacia abajo hacia el target.

**Los focos laterales** tienen `horizontalDist > 0` (porque X o Z difieren del target). Para ellos:
- `tiltDeg = atan2(horizontalDist, -local.y)` → ángulo positivo → apuntan hacia abajo correctamente.
- `panDeg = atan2(local.x, -local.z)` → determinado sin ambigüedad.

**El foco central está en una singularidad geométrica:** cuando el vector fixture→target es puramente vertical, el sistema de coordenadas esféricas colapsa. No hay ángulo azimutal (pan) definido, y el ángulo de elevación (tilt) se reduce a 0° o 180° — en nuestro caso, 0° = horizontal.

### 1.3 El `GIMBAL_LOCK_EPSILON` es agresivamente pequeño

**File:** `src/engine/movement/InverseKinematicsEngine.ts` | **Line:** 137

```typescript
const GIMBAL_LOCK_EPSILON = 0.001  // 1mm
```

Un foco a 5m de altura que está desplazado **1cm** en X o Z del target tiene `horizontalDist = 0.01 > 0.001` → NO entra en gimbal lock. Pero un foco perfectamente centrado (0cm desplazamiento) sí entra. No hay zona de transición suave — la singularidad es binaria.

---

## 2. EL DESFASE TEMPORAL — Dos mecanismos de suavizado en serie

### 2.1 PhysicsPostProcessor — Suavizado 3D del target espacial

**File:** `src/core/aether/resolver/PhysicsPostProcessor.ts` | **Lines:** 287–387

```typescript
    process(
      arbitrated: ArbitratedNodeMap,
      nodeGraph: INodeGraph,
      deltaMs: number,
      _vibeId: string,
    ): void {
      // ...
      const device3d = entry['targetX'] !== undefined
        ? nodeGraph.getDevice(node.deviceId)
        : undefined
      if (device3d?.isPlaced === true && entry['targetX'] !== undefined) {
        const xT = entry['targetX']
        const yT = entry['targetY']
        const zT = entry['targetZ']
        this._x3dTarget = isFinite(xT)        ? xT                   : state[SLOT_X3D_POS]
        this._y3dTarget = isFinite(yT ?? NaN) ? (yT ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS]
        this._z3dTarget = isFinite(zT ?? NaN) ? (zT ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS]

        // ... derive maxVelX3d, maxVelY3d, maxVelZ3d ...

        if (this._mode === 'snap') {
          const dxSnap  = this._snapFactor * (this._x3dTarget - state[SLOT_X3D_POS])
          const dySnap  = this._snapFactor * (this._y3dTarget - state[SLOT_Y3D_POS])
          const dzSnap  = this._snapFactor * (this._z3dTarget - state[SLOT_Z3D_POS])
          const maxMoveX = this._maxVelX3d * this._dt
          // ...
          state[SLOT_X3D_POS] += clampAbs(Math.abs(dxSnap) < JITTER_THRESHOLD ? 0 : dxSnap, maxMoveX)
          // ...
        } else {
          this._applyClassicAxis(state, SLOT_X3D_POS, SLOT_X3D_VEL, this._x3dTarget, this._maxVelX3d, this._maxAcc3d)
          // ...
        }

        entry['targetX'] = state[SLOT_X3D_POS]
        entry['targetY'] = state[SLOT_Y3D_POS]
        entry['targetZ'] = state[SLOT_Z3D_POS]
        return  // nodo espacial procesado — skip flujo legacy pan/tilt
      }
```

**Análisis:**
- El `PhysicsPostProcessor` **suaviza el target espacial en 3D** antes de que el NodeResolver lo vea.
- En modo `snap` (default para Techno/Latino/Rock): `entry['targetX'] = state[SLOT_X3D_POS]` se interpola con `snapFactor` (default 0.5) hacia el target real.
- En modo `classic` (Chill): curva S con aceleración/frenado.
- El target que llega al NodeResolver **no es el target real** — es una versión interpolada del target.

**JITTER_THRESHOLD para 3D:**

**File:** `src/core/aether/resolver/PhysicsPostProcessor.ts` | **Line:** 62

```typescript
const JITTER_THRESHOLD = 0.0005  // unidades normalizadas 0-1
```

Para el eje 3D, `entry['targetX']` está en **metros** (no normalizado). `JITTER_THRESHOLD = 0.0005 metros = 0.5 milímetros`. Si el delta del target espacial es menor a 0.5mm, se ignora completamente (`dxSnap = 0`).

Esto significa que para un foco central, cualquier pequeña oscilación del target por debajo de 0.5mm es **silenciada** por el jitter threshold. Pero como el foco central está en singularidad, incluso un delta de 1mm en X o Z produce un `horizontalDist` que cruza el umbral `0.001`, saliendo/entrando del gimbal lock de forma binaria.

### 2.2 NodeResolver._writeNodeIK — Recálculo IK con target suavizado

**File:** `src/core/aether/resolver/NodeResolver.ts` | **Lines:** 1189–1265

```typescript
  private _writeNodeIK(
    node: IKineticNodeData,
    channelValues: Record<string, number>,
    baseAddr: number,
    buf: Uint8Array,
    calibration: IDeviceCalibration | undefined,
    nodeWriteEnabled: boolean,
  ): void {
    const txRaw = channelValues[CH_TARGET_X]
    if (!Number.isFinite(txRaw)) return
    const tx = txRaw
    const ty = sanitizeNormalizedValue(channelValues[CH_TARGET_Y], 1.5)
    const tz = sanitizeNormalizedValue(channelValues[CH_TARGET_Z], 2.0)

    const profile      = this._getOrBuildIKProfile(node, calibration)
    const currentPanDMX = node.currentPosition.pan * 255

    const ikResult = solve(profile, { x: tx, y: ty, z: tz }, currentPanDMX)
```

**Análisis:**
- El `currentPanDMX` viene de `node.currentPosition.pan * 255` — el **frame anterior**.
- Para un foco central en singularidad, `currentPanDMX` se preserva (gimbal lock usa currentPan).
- El `solve()` recalcula el IK con el target suavizado del PhysicsPostProcessor.
- Si el target suavizado sigue estando directamente debajo del fixture (porque el PhysicsPostProcessor no ha convergido aún), `tiltDeg` sigue siendo 0°.

### 2.3 AetherSafetyMiddleware — Velocity clamp + Airbag

**File:** `src/core/aether/resolver/NodeResolver.ts` | **Lines:** 1223–1231

```typescript
    const sm = this._safetyMiddleware
    if (sm) {
      const clamped = sm.clampKineticVelocity(node.nodeId, safePan, safeTilt)
      safePan  = sm.applyAirbag(clamped.pan, true)
      safeTilt = sm.applyAirbag(clamped.tilt, false)
    }
```

El `clampKineticVelocity` limita cuánto puede cambiar pan/tilt entre frames. Si el foco central de repente sale del gimbal lock (porque el target suavizado se movió lo suficiente), el pan puede saltar de `currentPanDMX` a un nuevo valor. El safety middleware **retrasa ese salto** frame a frame, agregando lag adicional.

### 2.4 PhysicsPostProcessor para pan/tilt legacy (no espacial)

**File:** `src/core/aether/resolver/PhysicsPostProcessor.ts` | **Lines:** 389–419

```typescript
      // Leer target del ArbitratedNodeMap
      this._panTarget  = entry['pan']  ?? 0.5
      this._tiltTarget = entry['tilt'] ?? 0.5

      // NaN guard — si el arbiter produce un NaN, mantener posición anterior
      if (!isFinite(this._panTarget))  this._panTarget  = state[SLOT_PAN_POS]
      if (!isFinite(this._tiltTarget)) this._tiltTarget = state[SLOT_TILT_POS]

      // Leer estado de inercia (posición y velocidad actuales)
      this._panPos  = state[SLOT_PAN_POS]
      this._tiltPos = state[SLOT_TILT_POS]
      this._panVel  = state[SLOT_PAN_VEL]
      this._tiltVel = state[SLOT_TILT_VEL]
      // ... applySnap o applyClassic
```

Para nodos **sin** targetX (ruta clásica VMM), el PhysicsPostProcessor suaviza pan/tilt normalizados directamente. Pero para nodos **con** targetX, el suavizado se aplica al **target 3D**, no al pan/tilt. Esto es clave: el lag del foco central viene del suavizado del target espacial, no del suavizado del pan/tilt.

---

## 3. CADENA CAUSAL DEL LAG EN FOCOS CENTRALES

```
1. Operador establece target espacial (ej. centro del escenario)
2. PhysicsPostProcessor recibe targetX/Y/Z y lo interpola hacia el target real
   → snapFactor=0.5 → cada frame avanza solo 50% del delta restante
   → target suavizado converge exponencialmente, nunca instantáneo
3. NodeResolver._writeNodeIK recibe target suavizado
4. Para foco central: target suavizado sigue estando casi directamente debajo
   → horizontalDist ≈ 0 → isGimbalLock = true
   → tiltDeg = atan2(0, -local.y) = 0° → horizontal
   → panDeg = currentPanDMX (preservado del frame anterior) → no converge
5. Los focos laterales reciben el MISMO target suavizado
   → horizontalDist > 0 → tiltDeg = atan2(>0, -local.y) > 0° → apuntan hacia abajo
   → panDeg converge normalmente
6. Resultado visual: laterales ya apuntan al target; foco central sigue horizontal
   → "lag" de ~1 segundo mientras el target suavizado converge lo suficiente
     para que horizontalDist supere 0.001 y salga del gimbal lock
```

**La singularidad + el suavizado 3D = un doble penalty:**
- El suavizado retrasa el target espacial.
- La singularidad hace que cualquier target no-100%-convergido produzca tilt horizontal.
- Los focos laterales NO están en singularidad, así que el target suavizado ya les produce un tilt válido desde el frame 1.
- El foco central necesita esperar a que el target suavizado se desplace lo suficiente (más de 1mm en X o Z) para salir del gimbal lock.

---

## 4. TABLA DE HALLAZGOS

| # | Hallazgo | Ubicación | Impacto |
|---|----------|-----------|---------|
| 1 | `GIMBAL_LOCK_EPSILON = 0.001` (1mm) — singularidad binaria | `InverseKinematicsEngine.ts:137` | Foco centrado sobre target → tilt=0° (horizontal) |
| 2 | `tiltDeg = atan2(horizontalDist, -local.y)` — cuando horizontalDist=0, tilt=0° | `InverseKinematicsEngine.ts:245` | Fixture ceiling apunta horizontal, no hacia abajo |
| 3 | `panDeg` en gimbal lock usa `currentPanDMX` convertido a grados | `InverseKinematicsEngine.ts:235-240` | Pan se preserva del frame anterior, no converge al target |
| 4 | PhysicsPostProcessor suaviza target 3D antes del resolver | `PhysicsPostProcessor.ts:323-385` | El target que ve el IK no es el target real del operador |
| 5 | `JITTER_THRESHOLD = 0.0005` (0.5mm) en 3D | `PhysicsPostProcessor.ts:62` | Deltas menores a 0.5mm se ignoran — el target suavizado puede quedar "atascado" cerca de la singularidad |
| 6 | `snapFactor = 0.5` → convergencia exponencial del target | `PhysicsPostProcessor.ts:365` | Cada frame avanza solo 50% del delta restante → ~8 frames para 99% convergencia |
| 7 | NodeResolver `_writeNodeIK` recalcula IK con target suavizado | `NodeResolver.ts:1209` | Doble paso: suavizado 3D + recálculo IK = lag compuesto |
| 8 | AetherSafetyMiddleware `clampKineticVelocity` limita saltos de pan/tilt | `NodeResolver.ts:1228` | Si el foco finalmente sale de singularidad, el salto de pan es retrasado frame a frame |

---

*End of WAVE 4989 Forensic Audit Report.*
