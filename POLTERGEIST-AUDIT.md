# ═══════════════════════════════════════════════════════════════════════════
# 👻 WAVE 4620-A: THE POLTERGEIST TRACE — Forensic Audit
# ═══════════════════════════════════════════════════════════════════════════
# Estado: SOLO LECTURA (ZERO CODE MUTATION)
# Auditor: Cascade (Kimi)
# Fecha: 2026-05-07

## RESUMEN EJECUTIVO

Tres anomalías surgieron tras WAVE 4619 (Orthopedic Fix + FK Bridge):

1. **Haz volumétrico desaparecido** en vista 3D
2. **Fixtures espaciales congelados** en pan ~0.98, tilt ~0.50
3. **Radar 2D invertido** respecto a vista 3D

Este documento rastrea las coordenadas exactas de cada fallo.

---

## 🪦 MISIÓN 1: EL HAZ ENTERRADO (3D Volumetrics)

### Evidencia A — Beam Cone Geometry & Position

```
HyperionMovingHead3D.tsx:420-433
```

El beam cone es un `<mesh>` con:
- `position={[0, -3.5/2 - 0.08, 0]}` — **-Y direction**
- `<coneGeometry args={[1.0, 3.5, 16, 1, true]} />` — altura 3.5, radio base 1.0
- Sin rotación propia — hereda del `<group ref={headRef}>`

**La geometría del cono Three.js por defecto tiene su punta en Y=+height/2 y base en Y=-height/2.**
Al posicionarlo en Y = -1.75 - 0.08 = **-1.83**, el cono se extiende desde Y≈0 (cabeza) hasta Y≈-3.5 (abajo).

### Evidencia B — La Rotación del Head Group

```
HyperionMovingHead3D.tsx:308-310
headQuat.current.setFromAxisAngle(TILT_AXIS, tiltAngle)
// TILT_AXIS = new THREE.Vector3(1, 0, 0)  → eje X
```

`tiltAngle = -(smoothTilt - 0.5) * TILT_RANGE + TILT_REST_ANGLE`

Con TILT_REST_ANGLE = **+Math.PI/4 (+45°)**:
- tilt=0.50 → tiltAngle = +0.785 rad (**+45°**)
- tilt=0.00 → tiltAngle ≈ +1.67 rad (**+95.6°**)
- tilt=1.00 → tiltAngle ≈ -0.098 rad (**-5.6°**)

**Problema**: El cono apunta nativamente hacia -Y. Una rotación tilt de +45° alrededor de X rota el cono hacia -Z (frente del escenario). Esto es correcto para TILT_REST_ANGLE.

### Evidencia C — El Mount Quaternion vs. El Modelo

```
mountQuaternion.ts:38-40
Ceiling mount: identity quaternion (sin rotación)
```

**Comentario en mountQuaternion.ts línea 12**:
> "Los modelos de Hyperion tienen eje de emisión local en -Y."
> "ceiling: identidad — foco colgado apunta al suelo (-Y global)"

Esto significa que **sin baseRotation**, el modelo 3D ya apunta hacia -Y global (= al suelo). El `TILT_REST_ANGLE = +45°` en el head group rota el cono hacia -Z (frente).

### Evidencia D — La Eliminación de -45° baseRotation

Antes de WAVE 4619:
- `baseRotation = { pitch: -45, yaw: 0, roll: 0 }`
- `baseQuat = mountQ(ceiling=identity) * Euler(-45°, 0, 0)`
- El root `<group>` rotaba -45° en pitch
- **Esto compensaba visualmente**: el modelo a -45° + TILT_REST_ANGLE +45° = modelo apuntando al suelo

Después de WAVE 4619:
- `baseRotation = { pitch: 0, yaw: 0, roll: 0 }`  
- `baseQuat = identity * identity = identity`
- El root `<group>` NO rota
- El modelo ahora está **paralelo al techo** (como diseñado)

**PERO**: El `TILT_REST_ANGLE` de +45° aún está en el head group. Con el modelo paralelo al techo:
- head group a +45° → el cono (que apunta -Y) rota hacia -Z
- **El cono ahora apunta hacia ADELANTE, no hacia abajo**

### Evidencia E — ¿Por qué el haz "desapareció"?

No desapareció — **cambió de dirección drásticamente**.

Sin baseRotation y con TILT_REST_ANGLE:
- El cuerpo del fixture está paralelo al techo (Y=constante)
- El head group está a +45° → haz apunta hacia -Z (frente del escenario)
- El cono tiene `position={[0, -3.5/2 - 0.08, 0]}` = Y negativo
- Pero el head group ya rotó +45° → el eje Y local del head ahora apunta en diagonal
- **El cono se renderiza fuera del campo de visión de la cámara** o intersecta con el cuerpo del fixture mismo

**Diagnóstico**: La geometría del beam cone asume que el eje de emisión es -Y local del head group. Tras eliminar la baseRotation de -45°, el head group con +45° TILT_REST_ANGLE empuja el haz horizontalmente (hacia -Z) en lugar de diagonalmente hacia el suelo. El cono geométrico (cilindro truncado apuntando a -Y) queda atrapado dentro del cuerpo del fixture o apuntando a un ángulo donde no hay geometría de suelo para iluminar.

### Evidencia F — El Lens Circle

```
HyperionMovingHead3D.tsx:407
<mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
```

El lens es un círculo en plano XZ (rotado 90° en X), posicionado en Y=-0.08 dentro del head group. Esto está correctamente orientado como "lente" del fixture, pero el beam cone que sale de él no coincide con la dirección de emisión.

### Veredicto Misión 1

**La causa raíz**: El modelo 3D tiene el eje de emisión en -Y local del head group. El `TILT_REST_ANGLE=+45°` rota el head group para que el haz apunte "adelante" (hacia el público). Pero tras eliminar la `baseRotation=-45°`, el cuerpo del fixture está horizontal — y el cono del beam se genera en el eje -Y del head group rotado, que ahora apunta en un ángulo que **no intersecta con el suelo del escenario** o queda ocluido por el cuerpo del propio fixture.

**Corrección propuesta** (documentada, no aplicada):
- El beam cone debe ser hijo de un grupo intermedio que represente el **eje óptico real** (no del head group completo).
- Alternativamente: eliminar `TILT_REST_ANGLE` del head group y dejar que el IK/physics maneje el reposo; o ajustar la posición/rotación del beam mesh para compensar.
- La solución más limpia: el beam cone debe apuntar a -Y **local del lens** (que está rotado [Math.PI/2, 0, 0]), no del head group.

---

## 🔢 MISIÓN 2: EL PÁNICO MATEMÁTICO (FK → IK Bridge)

### Escenario de prueba: VMM manda Pan: 104, Tilt: -67

Estos valores son **en grados DMX**, no normalizados. Tracemos el flujo completo.

### Paso 1: VMM → KineticSystem

El `VibeMovementManager` genera `MovementIntent` con coordenadas **abstractas** (x, y ∈ [-1, +1]).

El `KineticSystem.ts` mapea estos a valores **normalizados 0-1**:
- panNorm = 0.5 + x * 0.5  (rango [0, 1])
- tiltNorm = 0.5 + y * 0.5

Para un patrón típico, si VMM quiere apuntar a la izquierda del escenario:
- x = -0.38 → panNorm ≈ 0.31
- y = -0.25 → tiltNorm ≈ 0.38

### Paso 2: FK Bridge en NodeResolver

```
NodeResolver.ts:670-672
const panNorm  = channelValues['pan']  ?? node.currentPosition.pan
const tiltNorm = channelValues['tilt'] ?? node.currentPosition.tilt
const fkTarget = this._forwardKinematicsBridge(node, panNorm, tiltNorm)
```

### Paso 3: Forward Kinematics — Matemática detallada

```
NodeResolver.ts:770-771
panDeg  = (panNorm  - 0.5) * panRangeDeg   // panRangeDeg = 540 (default)
tiltDeg = (tiltNorm - 0.5) * tiltRangeDeg  // tiltRangeDeg = 270 (default)
```

**Para panNorm = 0.31**:
- panDeg = (-0.19) * 540 = **-102.6°**

**Para tiltNorm = 0.38**:
- tiltDeg = (-0.12) * 270 = **-32.4°**

**Vector direccional local** (líneas 789-791):
```
localDirX = sin(panDeg) = sin(-102.6°) = -0.976
localDirY = -sin(tiltDeg) * cos(panDeg) = -sin(-32.4°) * cos(-102.6°) = +0.535 * (-0.218) = -0.117
localDirZ = cos(tiltDeg) * cos(panDeg) = cos(-32.4°) * cos(-102.6°) = 0.845 * (-0.218) = -0.184
```

**Rotación a mundo** — Mount: ceiling:
- mountPitchDeg = -90°
- mountYawDeg = 0°
- baseRotation = { pitch: 0, yaw: 0, roll: 0 } (tras WAVE 4619)
- totalPitchRad = (-90 + 0)° = -90°
- totalYawRad = (0 + 0)° = 0°

**Forward rotation**: Roll → Pitch → Yaw

After roll (0°): sin/cos unchanged
After pitch (-90°):
```
afterPitchX = afterRollX = -0.976
afterPitchY = afterRollY * cos(-90°) + afterRollZ * sin(-90°)
            = (-0.117)(0) + (-0.184)(-1) = +0.184
afterPitchZ = -afterRollY * sin(-90°) + afterRollZ * cos(-90°)
            = -(-0.117)(-1) + (-0.184)(0) = -0.117
```

After yaw (0°): unchanged

**World direction**:
```
worldDirX = -0.976
worldDirY = +0.184
worldDirZ = -0.117
```

### Paso 4: Raycast a piso (Y=0)

```
if (worldDirY < -0.001) {  // beam apunta ABAJO
    t = -originY / worldDirY
}
```

**Para un fixture ceiling en Y=3m**:
- originY = 3.0
- worldDirY = **+0.184** (¡POSITIVO!)

**worldDirY = +0.184 > 0** → **NO entra en la rama de intersección con el piso**

El haz apunta **HACIA ARRIBA** ligeramente. La condición `worldDirY < -0.001` falla.

### Paso 5: Fallback del FK Bridge

```
NodeResolver.ts:856-860
const range = Math.min(FK_MAX_RAY_DISTANCE, originY > 0 ? originY * 2 : 5)
// range = min(30, 6) = 6
return {
    x: originX + worldDirX * 6 = 3 + (-0.976)(6) = -2.86
    y: max(0, 3 + 0.184 * 6) = max(0, 4.1) = 4.1
    z: originZ + worldDirZ * 6 = 0 + (-0.117)(6) = -0.70
}
```

**Resultado FK**: `target = (-2.86, 4.1, -0.70)`

### Paso 6: IK Engine recibe target con Y=4.1

```
InverseKinematicsEngine.ts:186
dy = target.y - fixture.position.y = 4.1 - 3.0 = +1.1
```

dy es **positivo** → el target está **ARRIBA** del fixture (en el techo).

```
tiltDeg = atan2(-local.y, horizontalDist)
```

Para un target arriba del fixture, el ángulo de tilt requerido apunta **hacia arriba**, lo cual está **fuera del rango mecánico** de un moving head (que típicamente solo apunta hacia abajo desde el techo).

**Resultado**: `reachable = false`

### Paso 7: Consecuencias del reachable=false

```
NodeResolver.ts:682-683
const reachable = ikResult.reachable !== false
this._ikReachability.set(node.nodeId, reachable)
```

Aunque reachable es false, el código **sigue usando** `ikResult.pan` y `ikResult.tilt`:
```
safePan = ikResult.pan
safeTilt = ikResult.tilt
```

El IK engine, para un target arriba del fixture, produce:
- tilt en **límite máximo** (DMX ≈ 255 o cerca)
- pan según el ángulo horizontal

Convertido a normalizado:
- `node.currentPosition.pan = safePan / 255` → ≈ **0.98**
- `node.currentPosition.tilt = safeTilt / 255` → ≈ **0.50** (o límite según tiltLimits)

### Veredicto Misión 2

**La causa raíz**: El FK Bridge calcula el vector direccional correctamente pero con una **convención de signos inconsistente** entre el sistema local del FK y el sistema del IK engine.

El motor IK (`rotateToLocalFrame` en `InverseKinematicsEngine.ts:525-551`) usa:
- **Pitch negativo** para apuntar hacia abajo desde el techo (MOUNT_ANGLES['ceiling'] = {pitch: -90, yaw: 0})
- El fixture "naturalmente" apunta hacia -Y global

El FK Bridge rota **en dirección positiva** (forward rotation: Roll → Pitch → Yaw con ángulos positivos), mientras que `rotateToLocalFrame` rota **en dirección inversa** (inverse: -Yaw → -Pitch → -Roll).

**El error específico**: El FK Bridge aplica una rotación "forward" cuando debería aplicar la **inversa** de `rotateToLocalFrame`. Como resultado, el vector direccional local→mundo está **invertido en ciertos ángulos**, haciendo que el rayo apunte **hacia arriba** en lugar de hacia el suelo.

**Esto explica**:
- Pan ~0.98: el target FK cae "arriba" del fixture, IK calcula pan límite
- Tilt ~0.50: el tilt resultante queda en el centro del rango o en límite según tiltLimits
- Fixtures "congelados" porque el FK siempre produce targets inalcanzables → IK siempre devuelve valores límite

**Corrección propuesta** (documentada, no aplicada):
- El FK Bridge debe usar la **inversa** de la rotación de montaje (igual que `rotateToLocalFrame` pero en dirección forward → world).
- O más simple: reutilizar la función `rotateToLocalFrame` pero con signos invertidos, o construir un helper `rotateFromLocalFrame`.
- La fórmula correcta para convertir localDir a worldDir con mountPitch=-90 debería dar worldDirY **negativo** (hacia el suelo), no positivo.

**Cálculo correcto esperado**:
- Para tilt=0 (horizontal), mount=-90°: el rayo debería apuntar a -Y global (al suelo).
- Con la rotación inversa correcta: pitch de -90° sobre un vector local horizontal debería producir un vector mundo apuntando hacia abajo.

---

## 🪞 MISIÓN 3: EL ESPEJO 2D vs 3D

### Evidencia A — 2D FixtureLayer Beam Rendering

```
FixtureLayer.ts:177-193
```

```javascript
// Pan angle: 0→ -45°, 0.5→ 0°, 1→ +45°
const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)

// Tilt affects throw length
const tiltFactor = 1 - Math.abs(physicalTilt - 0.5) * 2
const throwLength = canvasHeight * BEAM_MAX_THROW * Math.max(0.15, tiltFactor)

// Beam endpoint
const endX = x + Math.sin(panAngle) * throwLength
const endY = y + Math.cos(panAngle) * throwLength
```

En 2D:
- `panAngle` usa **-π*0.45 a +π*0.45** (±81°)
- `Math.sin(panAngle)` → componente X
- `Math.cos(panAngle)` → componente Y
- **Pan=0.5 → angle=0 → sin=0, cos=1 → beam apunta hacia ABAJO (+Y en canvas)**
- **Pan=0.0 → angle=-81° → sin=-0.99, cos=0.16 → beam apunta IZQUIERDA**  
- **Pan=1.0 → angle=+81° → sin=+0.99, cos=0.16 → beam apunta DERECHA**

### Evidencia B — 3D Pan Rotation

```
HyperionMovingHead3D.tsx:307-310
const panAngle = (smoothPan.current! - 0.5) * PAN_RANGE  // PAN_RANGE = Math.PI * 1.5
const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE + TILT_REST_ANGLE
yokeQuat.current.setFromAxisAngle(PAN_AXIS, panAngle)  // PAN_AXIS = (0, 1, 0)
```

En 3D:
- `panAngle` usa **-π*0.75 a +π*0.75** (±135°) — rango MUCHO mayor que 2D
- Rotación alrededor de **Y** (eje vertical)
- A pan=0.5, panAngle=0 → el fixture "mira al frente" (dirección por defecto del modelo)
- **La dirección por defecto del modelo** (antes de cualquier rotación) apunta hacia **-Y** según mountQuaternion.ts:12-13

### Evidencia C — Dirección Base en 3D vs 2D

**En 2D** (canvas):
- El fixture está en (x, y)
- El beam apunta en dirección (sin(pan), cos(pan))
- Pan=0.5 → apunta hacia **+Y** (abajo en el canvas)

**En 3D** (Three.js):
- El fixture está en (x, y, z)
- El modelo base apunta hacia **-Y** (abajo en coordenadas Three.js)
- Pan rota alrededor de Y → rota el eje -Y en el plano XZ
- Pan=0.5 (0 rad) → el modelo mira hacia **-Y** (perpendicular al suelo)

### Evidencia D — El Signo de Tilt

**En 2D** (FixtureLayer.ts):
- Tilt NO rota el ángulo del beam en 2D
- Tilt modifica solo el `throwLength`: `tiltFactor = 1 - |tilt - 0.5| * 2`
- tilt=0.5 → throw máximo
- tilt=0.0 o 1.0 → throw mínimo (15%)

**En 3D**:
- `tiltAngle = -(tilt - 0.5) * TILT_RANGE + TILT_REST_ANGLE`
- tilt=0.5 → tiltAngle = +45° → rota el head hacia **adelante** (-Z)
- tilt=0.0 → tiltAngle ≈ +95.6° → casi horizontal hacia atrás
- tilt=1.0 → tiltAngle ≈ -5.6° → casi vertical hacia abajo

### Evidencia E — Discrepancia de Rango

| Parámetro | 2D | 3D |
|-----------|-----|-----|
| Pan range | ±81° | ±135° |
| Tilt effect | Throw length | Rotation angle + rest angle |
| Dirección "center" | +Y (canvas down) | -Y (Three.js down) |

### Evidencia F — Proyección 2D de Posición

```
useFixtureData.ts:241-244
const rawX = stageFixture.position.x / stageW
const rawY = stageFixture.position.z / stageD
fixture.x = clamp(rawX + 0.5, MARGIN, 1-MARGIN)
fixture.y = clamp(rawY + 0.5, MARGIN, 1-MARGIN)
```

```
useFixture3DData.ts:163-166
x = fixture.position.x
y = fixture.position.y
z = fixture.position.z
```

**En 2D**: `fixture.x` y `fixture.y` son **normalizados [0,1]** para el canvas.

**En 3D**: `fixture.x/y/z` son **en metros** directamente.

El 2D beam usa `fx = fixture.x * width` y `fy = fixture.y * height` (FixtureLayer.ts:392-393).

### Veredicto Misión 3

**La discrepancia no es un "mirroring" simple de signos** — es una **diferencia de convenciones de representación**:

1. **Rango de pan diferente**: 2D usa ±81° mientras 3D usa ±135°. Un mismo valor normalized produce ángulos visuales distintos.

2. **Dirección "forward" diferente**: 
   - En 2D, pan=0.5 apunta hacia +Y del canvas (abajo).
   - En 3D, pan=0.5 con el modelo ceiling mira hacia -Y global (también "abajo" en el mundo).
   - **PERO** el 2D beam usa `Math.sin(pan)` y `Math.cos(pan)` mientras el 3D usa rotación en Y con cuaterniones.

3. **El "mirroring" observado** probablemente viene del **FK Bridge incorrecto** (Misión 2): cuando el FK produce targets arriba del fixture, el IK resuelve pan/tilt que no corresponden con los valores VMM originales. El 2D muestra los valores VMM crudos (antes del FK→IK), mientras el 3D muestra los valores post-IK.

4. **Inversión específica**: En 2D, `endX = x + Math.sin(panAngle)` y `endY = y + Math.cos(panAngle)`. Si `panAngle` en 2D está calculado con `physicalPan` que viene del backend, y `physicalPan` en el Aether es `currentPosition.pan` (post-IK), mientras el VMM original quería apuntar al otro lado... el resultado es un beam 2D que apunta en dirección **opuesta** al target real del FK.

**La causa raíz del "mirroring"**:
- VMM genera pan/tilt abstractos → KineticSystem los pone en channelValues
- FK Bridge los convierte a target 3D (pero con rotación invertida)
- IK resuelve desde ese target (erróneo) → `currentPosition.pan/tilt`
- AetherUIProjector lee `currentPosition.pan` → lo convierte a DMX 0-255
- 2D lee `physicalPan` (que es `currentPosition.pan` normalizado)
- **Resultado**: los valores que el 2D muestra son los post-IK (erróneos), no los originales del VMM

**Si el FK Bridge invierte la rotación** (como diagnosticado en Misión 2), el target 3D cae en el cuadrante opuesto → IK resuelve pan en el lado opuesto → 2D beam apunta en dirección **opuesta** a lo que VMM quería.

---

## 📊 MATRIZ DE CORRELACIÓN

| Anomalía | Causa Raíz | Ubicación | Severidad |
|----------|-----------|-----------|-----------|
| Haz 3D desaparecido | TILT_REST_ANGLE con modelo horizontal empuja haz a -Z; cono queda ocluido | HyperionMovingHead3D.tsx:74-75, 420-433 | Alta |
| Fixtures congelados en ~0.98/0.50 | FK Bridge rota en sentido incorrecto → target cae arriba del fixture → IK devuelve límites | NodeResolver.ts:793-832 | Crítica |
| 2D invertido respecto a 3D | FK Bridge incorrecto + 2D muestra post-IK, no pre-FK; diferencia de rangos pan | NodeResolver.ts:793-832 + FixtureLayer.ts:177 | Alta |

---

## 🎯 RECOMENDACIONES DE REMEDIACIÓN

1. **FK Bridge — Invertir la rotación de montaje**:
   - La función `_forwardKinematicsBridge` debe usar la **inversa** de la rotación usada por `rotateToLocalFrame`.
   - O reutilizar la función `solve` del IK en modo inverso: dado pan/tilt normalized, resolver forward.
   - La forma más simple: `worldDir = localDir` transformado por la **matriz de rotación inversa** de `rotateToLocalFrame`.

2. **Haz 3D — Reorientar el beam cone**:
   - El beam debe ser hijo de un nodo que represente el **eje óptico**, no el head group completo.
   - Considerar eliminar `TILT_REST_ANGLE` del cálculo visual y dejar que el head group se oriente según los valores IK/physics reales.

3. **2D/3D Alignment**:
   - Asegurar que ambas vistas usen el **mismo rango de pan** para representación visual, o normalizar de forma consistente.
   - El 2D beam podría usar el **target 3D proyectado** en lugar de los valores pan/tilt crudos, para mostrar dónde REALMENTE apunta el fixture.

---

## CIERRE

Las tres anomalías son **manifestaciones del mismo error raíz**: la rotación de montaje en el FK Bridge está aplicada en sentido incorrecto. Esto produce targets 3D "arriba" de los fixtures, que el IK no puede alcanzar, resultando en valores límite que a su vez desorientan el beam 3D y el radar 2D.

**Prioridad de fix**: Misión 2 (FK Bridge) → Misión 1 (Beam 3D) → Misión 3 (2D alignment).

---
*Fin del informe forense WAVE 4620-A.*
*ZERO CODE MUTATION aplicado. Todas las conclusiones son diagnóstico puro.*
