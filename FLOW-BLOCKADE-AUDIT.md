# WAVE 4622-A — THE FLOW BLOCKADE AUDIT

**Auditor:** Cascade  
**De:** Dirección de Arquitectura  
**Asunto:** Autopsia del Bloqueo de Flujo (Gatekeeper, Velocidad Cero y Frame Loop)  
**Fecha:** 2026-05-07  
**Estado:** Sondas inyectadas — awaiting runtime telemetry

---

## RESUMEN EJECUTIVO

Tras WAVE 4617-B y WAVE 4619, los fixtures espaciales (isPlaced: true) están congelados — no responden a los comandos de movimiento del VMM. Esta auditoría investiga 3 vectores probables que actúan como "Aduanas Cero", bloqueando la propagación de las intenciones de movimiento:

1. **Iron Gatekeeper** — El ruteo estricto por isPlaced en NodeResolver podría estar forzando fallback estático ignorando los grados entrantes.
2. **Velocity Trap** — El cálculo de maxVelLinear en PhysicsPostProcessor podría estar multiplicando por cero debido a stage bounds incorrectos.
3. **Frame Loop** — currentPosition.pan/tilt podría quedarse matemáticamente congelado tras resolve(), con micro-variaciones que la UI no renderiza.

Se han inyectado 3 sondas de telemetría (throttle: 1/60 frames) para diagnosticar cuál vector es el culpable.

---

## MISIÓN 1: IRON GATEKEEPER AUDIT

**Objetivo:** Confirmar si el ruteo estricto por isPlaced está secuestrando el movimiento.

**Sonda Inyectada:** `NodeResolver.ts` — `_writeNodeIK` (línea 657-667)

```typescript
// WAVE 4622-A Mission 1: GATEKEEPER ROUTING AUDIT — track which path is taken
const hasTargetX = channelValues[CH_TARGET_X] !== undefined
const hasPanTilt = channelValues['pan'] !== undefined || channelValues['tilt'] !== undefined
const route = hasTargetX ? 'DIRECT-SPATIAL' : (hasPanTilt ? 'FK-BRIDGE' : 'FALLBACK-STATIC')
if (this._resolveFrameIndex % 60 === 0) {
  console.log(
    `[GATEKEEPER] node=${String(node.nodeId)} route=${route} ` +
    `hasTargetX=${hasTargetX} hasPanTilt=${hasPanTilt} ` +
    `inputPan=${channelValues['pan']?.toFixed(4) ?? 'N/A'} inputTilt=${channelValues['tilt']?.toFixed(4) ?? 'N/A'}`,
  )
}
```

**Lo que revela:**
- **route=DIRECT-SPATIAL** — El VMM está emitiendo targetX/Y/Z directamente (flujo KineticAdapter normal)
- **route=FK-BRIDGE** — El VMM solo emite pan/tilt, y el FK Bridge debería derivar un target sintético
- **route=FALLBACK-STATIC** — Ni targetX ni pan/tilt presentes → usa defaults (0, 1.5, 2.0) — **ESTE ES EL BLOQUEO**

**Diagnóstico esperado:**
Si route=FK-BRIDGE pero el fixture no se mueve, entonces el problema está en:
- El FK Bridge devolviendo un target inválido (ej: NaN, fuera de rango, o en dirección opuesta)
- El IK Engine recibiendo un target válido pero devolviendo reachable=false
- La post-IK physics estrangulando el movimiento (ver Misión 2)

Si route=FALLBACK-STATIC, entonces el VMM no está emitiendo pan/tilt para fixtures espaciales — **esto es un bug en el VMM/KineticSystem, no en el gatekeeper**.

**Ubicación del código:** `electron-app/src/core/aether/resolver/NodeResolver.ts:657-667`

---

## MISIÓN 2: VELOCITY TRAP AUDIT

**Objetivo:** Confirmar si la velocidad máxima se está multiplicando por cero.

**Sonda Inyectada:** `TitanOrchestrator.ts` — `_updateAetherStageBounds` (línea 2980-2984)

```typescript
// WAVE 4622-A Mission 2: STAGE BOUNDS AUDIT — verify propagation to PhysicsPostProcessor
console.log(
  `[STAGE-BOUNDS] input=(${stageBounds?.width?.toFixed(2) ?? 'N/A'},${stageBounds?.height?.toFixed(2) ?? 'N/A'},${stageBounds?.depth?.toFixed(2) ?? 'N/A'}) ` +
  `current=(${bounds.width.toFixed(2)},${bounds.height.toFixed(2)},${bounds.depth.toFixed(2)})`,
)
```

**Sonda Existente (WAVE 4621-A):** `PhysicsPostProcessor.ts` — línea 350-361

```typescript
// WAVE 4621-A: TELEMETRY — Spatial 3D physics limits (cada 60 frames)
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

**Lo que revela:**

**STAGE-BOUNDS:**
- Si `input=(N/A,N/A,N/A)` → TitanOrchestrator.setFixtures() no está recibiendo stage bounds del frontend
- Si `current=(0.00,0.00,0.00)` o valores muy pequeños → maxVelLinear = motorSpeed * 0 = 0 → **VELOCIDAD CERO**
- Si `current` es razonable (ej: 8.0, 4.0, 2.0) pero `maxVel3D` es 0 → problema en el cálculo de stageScale o safety cap

**PHYSICS-3D:**
- `maxVel3D=(0.0000,0.0000,0.0000)` → **VELOCIDAD CERO CONFIRMADA** — el fixture no se puede mover
- `dt=0.0000` → deltaMs es 0 → physics no procesa
- `mode=snap` con `maxVel3D=0` → snapFactor * delta = 0 → posición congelada

**Cálculo de maxVelLinear (PhysicsPostProcessor:344-347):**

```typescript
this._maxVelX3d = Math.min(node.maxPanSpeed  * DEG_TO_RAD * this._stageHalfW, safetyMaxVel)
this._maxVelY3d = Math.min(node.maxTiltSpeed * DEG_TO_RAD * this._stageHalfH, safetyMaxVel)
this._maxVelZ3d = Math.min(node.maxPanSpeed  * DEG_TO_RAD * this._stageHalfD, safetyMaxVel)
```

Si `stageHalfW/H/D = 0`, entonces `maxVel3D = 0` → movimiento imposible.

**Diagnóstico esperado:**
- Si stage bounds llegan como 0 o undefined → **BUG en TitanOrchestrator.setFixtures()** o en la llamada desde el frontend
- Si stage bounds son correctos pero maxVel3D = 0 → **BUG en el cálculo de stageScale o safetyMaxVel**
- Si maxVel3D es correcto pero el fixture no se mueve → el problema está en otro vector (Gatekeeper o Frame Loop)

**Ubicación del código:**
- Sonda stage bounds: `electron-app/src/core/orchestrator/TitanOrchestrator.ts:2980-2984`
- Sonda physics: `electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts:350-361`

---

## MISIÓN 3: FRAME LOOP AUDIT

**Objetivo:** Confirmar qué datos exactos está entregando resolve() a la UI.

**Sonda Inyectada:** `TitanOrchestrator.ts` — frame loop (línea 1944-1957)

```typescript
// WAVE 4622-A Mission 3: FRAME LOOP AUDIT — check currentPosition values after resolve
if (this.frameCount % 60 === 0) {
  const kineticView = this._aetherGraph.getView(NodeFamily.KINETIC)
  kineticView.forEach((node: IKineticNodeData) => {
    if ('currentPosition' in node && 'pan' in node.currentPosition && 'tilt' in node.currentPosition) {
      console.log(
        `[FRAME-LOOP] node=${String(node.nodeId)} ` +
        `currentPosition.pan=${node.currentPosition.pan.toFixed(6)} ` +
        `currentPosition.tilt=${node.currentPosition.tilt.toFixed(6)} ` +
        `isPlaced=${this._aetherGraph.getDevice(node.deviceId)?.isPlaced ?? false}`,
      )
    }
  })
}
```

**Lo que revela:**
- **currentPosition.pan=0.500000 tilt=0.500000** frame tras frame → **POSICIÓN CONGELADA** — ni physics ni IK están actualizando
- **currentPosition.pan/tilt cambiando microscópicamente** (ej: 0.500001 → 0.500002) → physics está funcionando pero el delta es demasiado pequeño para ser visible en la UI → **threshold problem en renderizado**
- **currentPosition.pan/tilt cambiando significativamente** pero UI no muestra movimiento → **BUG en AetherUIProjector.project()** o en el componente de renderizado

**Cadena de actualización de currentPosition:**
1. NodeResolver._writeNodeIK() llama a IKEngine.solve()
2. IK result (pan/tilt DMX) → safety middleware (velocity clamp + airbag)
3. Resultado post-safety → `node.currentPosition.pan/tilt = safePan/255, safeTilt/255`
4. PhysicsPostProcessor.process() suaviza currentPosition con inercia
5. AetherUIProjector.project() lee currentPosition para UI/2D/3D

**Diagnóstico esperado:**
- Si currentPosition está congelado en 0.5 → el problema está en IK, physics, o en el gatekeeper (Misiones 1 y 2)
- Si currentPosition cambia pero UI no refleja → **BUG en AetherUIProjector o en el renderizado**
- Si currentPosition cambia pero el fixture físico no se mueve → **BUG en la capa DMX/HAL** (menos probable para fixtures virtuales)

**Ubicación del código:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts:1944-1957`

---

## MATRIZ DE DIAGNÓSTICO

| Misión | Sonda | Resultado Esperado (NORMAL) | Resultado (BLOQUEO) | Causa Raíz Probable |
|--------|-------|----------------------------|---------------------|---------------------|
| 1 | GATEKEEPER | route=FK-BRIDGE, inputPan/tilt variando | route=FALLBACK-STATIC o route=FK-BRIDGE pero inputPan/tilt=0.5 | VMM no emitiendo pan/tilt para fixtures espaciales |
| 2 | STAGE-BOUNDS | input=(8.0,4.0,2.0), current=(8.0,4.0,2.0) | input=N/A o current=(0,0,0) | setFixtures() no recibiendo stage bounds del frontend |
| 2 | PHYSICS-3D | maxVel3D=(0.1,0.05,0.1) | maxVel3D=(0,0,0) | stageHalfW/H/D = 0 → maxVelLinear = 0 |
| 3 | FRAME-LOOP | currentPosition.pan/tilt cambiando | currentPosition.pan/tilt=0.5 estático | IK/Physics no actualizando (ver M1/M2) |

---

## PROCEDIMIENTO DE DIAGNÓSTICO

1. **Ejecutar la app** y abrir la consola del DevTools
2. **Filtrar por `[GATEKEEPER]`, `[STAGE-BOUNDS]`, `[PHYSICS-3D]`, `[FRAME-LOOP]`**
3. **Identificar cuál sonda muestra valores anómalos**
4. **Correlacionar con la matriz de diagnóstico** para identificar la causa raíz

**Interpretación de logs:**
- Si solo `[STAGE-BOUNDS]` muestra N/A → **FIX en TitanOrchestrator.setFixtures()** para propagar stage bounds
- Si `[PHYSICS-3D]` muestra maxVel3D=0 → **FIX en el cálculo de stageScale o en la inicialización de stage bounds**
- Si `[GATEKEEPER]` muestra route=FALLBACK-STATIC → **FIX en VMM/KineticSystem para emitir pan/tilt para fixtures espaciales**
- Si `[FRAME-LOOP]` muestra currentPosition congelado pero otras sondas son normales → **FIX en AetherUIProjector o en el renderizado**

---

## CIERRE

Las tres sondas están inyectadas y throttleadas a 1/60 frames para evitar inundar la consola. El runtime revelará cuál de los 3 vectores es el culpable del bloqueo de flujo.

**Prioridad de fix (basado en probabilidad):**
1. Velocity Trap (stage bounds = 0) → más probable tras WAVE 4617-B M3
2. Iron Gatekeeper (route = FALLBACK-STATIC) → menos probable si VMM está funcionando
3. Frame Loop (currentPosition congelado pero otras sondas normales) → menos probable

---

*Fin del informe forense WAVE 4622-A.*
*SONDAS INYECTADAS — awaiting runtime telemetry.*
