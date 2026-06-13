# WAVE-6019 — DOSSIER DE DIAGNÓSTICO PARA OPUS
## Título: Fuga de Estado Zombi Espacial (IK) + Regresión de Singularidad en L2→L0 Handoff

**Fecha:** 2026-06-11  
**Estado:** FORENSE COMPLETO — 4 FIXES APLICADOS, BUG PERSISTE  
**Autor:** Ejecutor Forense (Cascada)  
**Destinatario:** Opus (Modelo Superior de Razonamiento)  

---

## 1. RESUMEN EJECUTIVO

El sistema sufre una **contaminación espacial persistente** tras usar el radar espacial (IK) y hacer Unlock. Los 6 movers colapsan al techo; los centrales se desincronizan. El radar clásico queda inutilizado hasta reiniciar la aplicación.

Cuatro fixes consecutivos mitigaron síntomas parciales pero **NO erradicaron la raíz**. La hipótesis del "Zero-Allocation Dirty Cache" del NodeArbiter ha sido **refutada empíricamente** — el `_result` cache se limpia correctamente cada frame (`_result.clear()` + `_acquireRecord()` hace `delete rec[key]`). La fuente real debe estar en una capa de estado persistente **aguas abajo** del Arbiter, o en un **re-inyector** que el frontend no alcanza.

Este dossier compila toda la inteligencia forense, histórica y arquitectónica necesaria para que Opus identifique el vector de fuga restante en una sola pasada.

---

## 2. TAREA 1: ESTADO ACTUAL (SÍNTOMAS Y DESCARTADOS)

### 2.1 Síntoma Preciso

> *"En el momento que manipulo el motor espacial, luego se corrompe el clásico también. Al hacer Unlock, los 6 movers se van al techo. El clásico solo los centrales. El sistema solo se recupera reiniciando la app."*

**Características del fallo:**
- **Requiere reinicio** para recuperación → indica estado persistente en memoria.
- **Corrupción simétrica** (espacial manda 6 al techo, clásico solo centrales) → la singularidad geométrica X=0 es el denominador común.
- **Persistencia post-Unlock** → el target espacial sigue "infectando" el pipeline aunque L2 haya sido destruido.

### 2.2 Fixes Aplicados (y por qué cada uno fue insuficiente)

| # | Fix | Archivo | Qué limpió | Qué NO limpió |
|---|-----|---------|-----------|--------------|
| 1 | `toEnginePattern('none')` → `'hold'` | `KineticsBridge.ts` | Evitó purga destructiva accidental al deseleccionar patrón | No afectó la fuga espacial persistente |
| 2 | `clearSpatialTargets()` en `_flushPattern` | `programmerStore.ts` + `KineticsBridge.ts` | Limpia `targetX/Y/Z` del store ANTES de enviar nuevo patrón clásico | No intercepta reinyección entre `releaseKinetics()` y debounced flush |
| 3 | **Cortafuegos IK** — `IK_POISON_KEYS` | `NodeArbiter.ts` | Evita que `targetX/Y/Z` entren al snapshot de fade-out del Release Fader | NO impide que `targetX/Y/Z` sigan fluyendo de `_manualOverrides` → `_result` durante frames normales |
| 4 | `clearSpatialTargets(selectedIds)` antes de `releaseKinetics()` | `KineticsCathedral.tsx` | Limpia frontend store síncronamente antes del release | Solo actúa sobre `selectedIds`; no garantiza limpieza completa del backend `_manualOverrides` |

### 2.3 Hipótesis Refutada: Zero-Allocation Dirty Cache

**Prediagnóstico:** `_result.get(nodeId)` reutiliza el mismo objeto; `targetX` persiste porque "nadie lo borró".

**Verificación empírica:**

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:494-497
this._poolCursor = 0
this._result.clear()           // Map vaciado cada frame
```

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1344-1351
private _acquireRecord(): Record<string, number> {
  if (this._poolCursor < this._resultPool.length) {
    const rec = this._resultPool[this._poolCursor++]
    for (const key in rec) {
      delete rec[key]            // ← LIMPIEZA EXPLÍCITA
    }
    return rec
  }
}
```

**Conclusión:** `_result` se limpia a fondo cada frame. `targetX` **NO puede persistir** en el caché de salida del Arbiter entre frames.

### 2.4 Lo que SIGUE bajo sospecha

1. **`_manualOverrides` en NodeArbiter:** persiste entre frames. Si `ProgrammerAetherBridge` reinyecta `targetX` para nodos no incluidos en `selectedIds`, o si el backend no procesa correctamente los valores `null` del frontend, las coordenadas espaciales permanecen en `_manualOverrides` y fluyen a `_result`.

2. **PhysicsPostProcessor — Estados 3D persistentes:** El `Float32Array` de estado por nodo (`_states`) almacena `SLOT_X3D_POS/Y/Z` que **nunca se resetean a DEFAULT** al salir del modo 3D. Solo se seedea `SLOT_PAN_POS` y `SLOT_TILT_POS` desde `currentPosition`. Si un nodo reingresa al modo 3D (por un targetX zombi), el suavizado arranca desde la posición 3D vieja.

3. **`_3dInitialized` toggle:** Se limpia al salir de 3D, pero si el nodo vuelve a ver `targetX` residual en el siguiente frame, se considera "primer frame 3D" de nuevo y se teleporta... ¿o se reactiva el path 3D con datos viejos?

---

## 3. TAREA 2: HISTORIAL WAVE-4989 (SINGULARIDAD IK & LAG)

**Archivo base:** `WAVE-4989-IK-Spatial-Singularity-Time-Lag.md`

### 3.1 La Matemática de la Singularidad

Cuando un fixture ceiling-mounted está **directamente sobre** el target (`dx≈0, dz≈0`):

```
horizontalDist = sqrt(local.x² + local.z²) ≈ 0
isGimbalLock = horizontalDist < GIMBAL_LOCK_EPSILON   // true
```

**Comportamiento en singularidad (código WAVE-4989):**
- `panDeg` → indeterminado. Se preserva `currentPanDMX` del frame anterior.
- `tiltDeg = atan2(0, -local.y)` → **0°** (horizontal) para fixture en techo apuntando a suelo.
- Resultado visual: **el foco central apunta paralelo al techo**.

### 3.2 Epsilon Agresivamente Pequeño (WAVE-4989)

```typescript
const GIMBAL_LOCK_EPSILON = 0.001   // 1 milímetro
```

Oscilaciones de 0.5mm del target suavizado cruzan el umbral de forma **binaria** — entra/sale del gimbal lock frame a frame, latigazos de pan.

### 3.3 Doble Suavizado en Serie

```
Operador target real
    ↓
[PhysicsPostProcessor] suaviza target 3D
  • snapFactor = 0.5  → ~8 frames para 99% convergencia
  • JITTER_THRESHOLD = 0.0005m (0.5mm) → deltas menores ignorados
    ↓
[NodeResolver._writeNodeIK] recalcula IK con target suavizado
  • currentPanDMX = node.currentPosition.pan * 255 (frame anterior)
    ↓
[AetherSafetyMiddleware] clampKineticVelocity retrasa saltos bruscos
```

**El foco central necesita que el target suavizado se desplace >1mm en X o Z para salir del gimbal lock.** El suavizado exponencial + jitter threshold puede dejarlo "atascado" en singularidad.

### 3.4 Tabla de Hallazgos WAVE-4989

| # | Hallazgo | Ubicación | Impacto |
|---|----------|-----------|---------|
| 1 | `GIMBAL_LOCK_EPSILON = 0.001` (1mm) — singularidad binaria | `InverseKinematicsEngine.ts:137` | Foco centrado → tilt=0° (horizontal) |
| 2 | `tiltDeg = atan2(horizontalDist, -local.y)` — horizontalDist=0 → tilt=0° | `InverseKinematicsEngine.ts:245` | Fixture ceiling apunta horizontal |
| 3 | `panDeg` en gimbal lock usa `currentPanDMX` | `InverseKinematicsEngine.ts:235-240` | Pan preservado del frame anterior |
| 4 | PhysicsPostProcessor suaviza target 3D | `PhysicsPostProcessor.ts:323-385` | Target que ve IK ≠ target real del operador |
| 5 | `JITTER_THRESHOLD = 0.0005` (0.5mm) | `PhysicsPostProcessor.ts:62` | Deltas <0.5mm ignorados → target "atascado" |
| 6 | `snapFactor = 0.5` | `PhysicsPostProcessor.ts:365` | Convergencia exponencial lenta |
| 7 | `_writeNodeIK` recalcula IK con target suavizado | `NodeResolver.ts:1209` | Doble paso = lag compuesto |
| 8 | `clampKineticVelocity` limita saltos | `NodeResolver.ts:1228` | Retrasa salida de singularidad |

---

## 4. TAREA 3: BÚSQUEDA HISTÓRICA (CÓMO SE PARCHEÓ WAVE-4989)

### 4.1 Parche WAVE-5022: Blindaje de Zona de Singularidad

**Archivo:** `src/engine/movement/InverseKinematicsEngine.ts`

**Cambios verificados en código actual:**

```typescript
@/electron-app/src/engine/movement/InverseKinematicsEngine.ts:137-143
const GIMBAL_LOCK_EPSILON = 0.05  // 50mm — WAVE 5022: zona de singularidad blindada
```

```typescript
@/electron-app/src/engine/movement/InverseKinematicsEngine.ts:255-260
let tiltDeg: number
if (isGimbalLock) {
  tiltDeg = 90                // ← FORZADO A VERTICAL
} else {
  tiltDeg = Math.atan2(horizontalDist, -local.y) * RAD_TO_DEG
}
```

- `GIMBAL_LOCK_EPSILON`: `0.001` → `0.05` (50mm). Absorbe jitter temporal sin latigazos.
- `tiltDeg` en singularidad: `0°` → `90°`. El foco central apunta verticalmente (hacia abajo en ceiling-mount) en lugar de horizontalmente.

### 4.2 Parche WAVE-5023: Teleport Inicial + Seeding de Salida

**Archivo:** `src/core/aether/resolver/PhysicsPostProcessor.ts`

**Cambio A — Teleport en primer frame 3D (líneas 347-359):**

```typescript
// WAVE 5023: Primer frame en modo 3D → teleportar estado al target real.
// Sin esto, el suavizado arranca desde DEFAULT_3D_Y=1.5 hacia el target
// real (ej. Y=0 en suelo), produciendo un arco de ~8 frames donde el
// IK calcula ángulos incorrectos y los fixtures centrales apuntan al techo.
if (!this._3dInitialized.has(node.nodeId)) {
  this._3dInitialized.add(node.nodeId)
  state[SLOT_X3D_POS] = this._x3dTarget
  state[SLOT_Y3D_POS] = this._y3dTarget
  state[SLOT_Z3D_POS] = this._z3dTarget
  state[SLOT_X3D_VEL] = 0
  state[SLOT_Y3D_VEL] = 0
  state[SLOT_Z3D_VEL] = 0
}
```

**Cambio B — Seed de estado clásico al salir de 3D (líneas 419-435):**

```typescript
// WAVE 5023: El nodo ha salido del modo 3D (targetX ya no está presente).
// Seedear el estado clásico desde la posición física REAL que el NodeResolver
// acaba de calcular por IK. Sin esto, state[SLOT_PAN_POS] sigue congelado en
// un valor de hace minutos (zombie) y el primer delta clásico es un latigazo.
if (this._3dInitialized.has(node.nodeId)) {
  const actualPan  = node.currentPosition?.pan
  const actualTilt = node.currentPosition?.tilt
  if (typeof actualPan === 'number' && isFinite(actualPan)) {
    state[SLOT_PAN_POS] = actualPan
  }
  if (typeof actualTilt === 'number' && isFinite(actualTilt)) {
    state[SLOT_TILT_POS] = actualTilt
  }
  state[SLOT_PAN_VEL]  = 0
  state[SLOT_TILT_VEL] = 0
  this._3dInitialized.delete(node.nodeId)
}
```

### 4.3 ¿Omite la arquitectura Aether Glass estas protecciones?

**NO — las protecciones matemáticas están intactas.** La arquitectura Aether Glass (NodeArbiter, NodeResolver, PhysicsPostProcessor) NO ha eliminado ni puenteado los parches WAVE-5022/5023.

**PERO — la ruta de decisión 3D vs Clásico permanece idéntica y es una sola condición:**

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:970-985
if (node.family === NodeFamily.KINETIC) {
  const kineticNode = node as IKineticNodeData
  const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
  if (!kineticNode.isContinuous && hasSpatialTarget) {
    this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, !nodeBlocked)
    return
  }
}
```

```typescript
@/electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts:336-339
if (device3d?.isPlaced === true && entry['targetX'] !== undefined) {
  // ... modo 3D
}
```

**Ambos gatekeepers dependen de:** `entry['targetX'] !== undefined`. Si cualquier capa upstream inyecta `targetX`, **TODO el pipeline espacial se reactiva.**

---

## 5. ARQUITECTURA DEL FLUJO ESPACIAL ACTUAL

### 5.1 Pipeline

```
UI SpatialTargetPad
    ↓
programmerStore.fixtureOverrides[targetX/Y/Z]
    ↓
ProgrammerAetherBridge ──IPC──▶ setManualOverrides
                                    ↓
                           NodeArbiter._manualOverrides
                                    ↓
                           arbitrate() → _result (limpio cada frame ✓)
                                    ↓
                           PhysicsPostProcessor.process()
                             • Detecta targetX → modo 3D
                             • Suaviza targetX/Y/Z
                             • Escribe DE VUELTA a entry[targetX/Y/Z] (muta in-place)
                                    ↓
                           NodeResolver.resolve()
                             • hasSpatialTarget = targetX !== undefined
                             • true → _writeNodeIK → solveInto() → DMX
                             • false → flujo clásico pan/tilt
```

### 5.2 Mutación In-Place del PhysicsPostProcessor

El `PhysicsPostProcessor` muta el `arbitrated` map in-place:

```typescript
@/electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts:413-416
entry['targetX'] = state[SLOT_X3D_POS]
entry['targetY'] = state[SLOT_Y3D_POS]
entry['targetZ'] = state[SLOT_Z3D_POS]
return  // nodo espacial procesado — skip flujo legacy pan/tilt
```

Esto reemplaza el `targetX` raw del Arbiter por el `targetX` suavizado del PostProcessor. Es correcto en funcionamiento normal, pero si el `targetX` original no debería estar ahí (zombi), el PostProcessor lo "legitima" al suavizarlo y escribirlo de vuelta.

---

## 6. HIPÓTESIS VIVAS PARA OPUS (RANKING)

### H1 — Fuga del `_manualOverrides` Agujereado (MAYOR PROBABILIDAD)

**Vector:** El frontend `clearSpatialTargets(fixtureIds)` solo limpia los fixtures incluidos. Si `ProgrammerAetherBridge` envía `setManualOverrides` con `targetX: null` para fixtures no seleccionados, o si el backend no convierte `null` en eliminación de key, `_manualOverrides` conserva `targetX` activa.

**Evidencia a favor:**
- `ProgrammerAetherBridge` envía overrides continuamente a 44Hz.
- `releaseKinetics()` limpia el store para TODOS los fixtures, pero el bridge podría tener 1 frame lag.
- El backend IPC handler `setManualOverride` recibe `Record<string, number>`. Un valor `null` del frontend no es `number`. ¿Se filtra? ¿O se almacena como key con valor inválido que igual cumple `!== undefined`?

**Test sugerido:** Loggear `_manualOverrides.keys()` y `_manualOverrides.get(nodeId)['targetX']` en el backend inmediatamente después de Unlock. Si persiste → H1 confirmada.

### H2 — Zombie 3D en PhysicsPostProcessor (ALTA PROBABILIDAD)

**Vector:** El `Float32Array` de estado (`_states`) nunca resetea `SLOT_X3D_POS/Y/Z` a `DEFAULT_3D_*` al salir del modo 3D. El seeding de salida solo actualiza `SLOT_PAN_POS` y `SLOT_TILT_POS`. Si un targetX zombi hace que el nodo reingrese brevemente al modo 3D:

1. `_3dInitialized.has(node)` → `false` (fue borrado en la salida anterior).
2. El código entra en el bloque de teleport inicial (línea 351).
3. **PERO** el teleport usa `this._x3dTarget` que viene del `entry['targetX']` zombi.
4. El suavizado arranca desde el zombi, no desde DEFAULT.

**Más grave:** Si el nodo NO reingresa a 3D pero `_manualOverrides` tiene `targetX`, el Arbiter lo copia a `_result`, el PhysicsPostProcessor lo suaviza, y el NodeResolver lo ve. H1 y H2 son complementarias.

### H3 — Race Condition Frontend-Backend en Unlock (MEDIA PROBABILIDAD)

**Vector:**
1. `handleUnlockKinetics` llama `clearSpatialTargets(selectedIds)` → store limpio.
2. `releaseKinetics()` → store marca dirty KINETIC.
3. `ProgrammerAetherBridge` (async/debounced) lee el store y envía overrides limpios.
4. **PERO** `KineticsBridge._flushPattern` también llama `clearSpatialTargets(fixtureIds)` y está **debounced**.
5. En la ventana entre (1) y (3), el bridge podría no haber enviado aún. ¿El backend tiene algún mecanismo de "retención" del último valor conocido?

**Evidencia en contra:** Un race de 1-2 frames no explicaría la persistencia **hasta reinicio**. Debe haber un estado que se "congela" en una capa persistente.

### H4 — Forge Graph Bypass o Acumulador Residual (MEDIA PROBABILIDAD)

**Vector:** El NodeResolver usa un acumulador `_forgeAccumValues` que se limpia con `.clear()` cada frame. Sin embargo, `_forgeManualDevices` y `_forgeValuePool` también se reinician. Pero si algún nodo KINETIC está en una ruta Forge Graph, el evaluador podría inyectar `targetX/Y/Z` desde alguna celda del grafo.

**Verificación necesaria:** ¿Existen canales `targetX/Y/Z` en algún nodo del grafo Forge compilado? Buscar en `_forgeGraphs` o en la definición de fixtures Forge.

### H5 — El Parche WAVE-5022 Funciona en Estado Estable pero NO en Transición

**Vector:** El parche `tiltDeg = 90` en gimbal lock es correcto para estado estacionario. Pero durante el **Unlock**, el Release Fader del Cortafuegos IK elimina `targetX` instantáneamente (no lo interpola). El PhysicsPostProcessor sale de modo 3D, seedea clásico desde `currentPosition`... pero si `currentPosition` fue corrompido durante la fase espacial (por ejemplo, por un `targetX` zombi que hizo que el IK calculara valores erráticos justo antes del Unlock), el seed clásico arranca desde una posición física inválida.

**Evidencia a favor:** El síntoma "solo se recupera reiniciando" implica que `currentPosition` o algún estado persistente del nodo está corrupto. `node.currentPosition` es mutable y se actualiza cada frame en `_writeNodeIK`:

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:1255-1258
node.currentPosition.pan  = safePan  / 255
node.currentPosition.tilt = safeTilt / 255
```

Si el IK produjo `safePan/safeTilt` erráticos durante la corrupción (por targetX zombi cerca de singularidad), `currentPosition` queda envenenado. Al hacer Unlock, el seed clásico copia esta posición envenenada al PhysicsPostProcessor, y el foco "se va al techo" físicamente porque arranca desde un tilt corrupto.

---

## 7. DIRECTIVAS PARA OPUS

### 7.1 Preguntas que Opus debe responder

1. **Si `_manualOverrides` tiene `targetX` para un nodo KINETic después de Unlock:** ¿Por qué `clearManualOverride` no fue llamado para ese nodo? ¿Es porque el frontend no envió la limpieza, o porque el backend la ignoró?

2. **¿Qué hace el backend cuando `setManualOverrides` recibe `targetX: null`?** Verificar `AetherIPCHandlers.ts` y `NodeArbiter.setManualOverride()` — ¿ignora valores no-numéricos o los almacena como keys residuales?

3. **¿Puede `node.currentPosition` quedar envenenado permanentemente?** Si el IK, forzado por un targetX zombi, calcula `safePan/safeTilt` erráticos durante varios frames, `currentPosition` absorbe ese veneno. Al reiniciar la app se reconstruye `currentPosition` desde cero (hydration) → explica por qué solo el reinicio cura.

4. **¿El `PhysicsPostProcessor._states` Float32Array necesita un reset explícito de `SLOT_X3D_*` al salir de modo 3D?** Actualmente solo se seedea clásico. Las coordenadas 3D viejas permanecen en memoria. Si un zombi hace reingresar al nodo a 3D, esas coordenadas viejas se usan.

### 7.2 Áreas de código a inspeccionar

| Prioridad | Archivo | Líneas | Qué buscar |
|-----------|---------|--------|-----------|
| P0 | `AetherIPCHandlers.ts` | setManualOverride handler | ¿Cómo procesa `null`/undefined en canales? |
| P0 | `NodeArbiter.ts` | `setManualOverride()` | ¿Almacena keys con valores no-numéricos? ¿`delete` o `= undefined`? |
| P0 | `NodeResolver.ts` | `_writeNodeIK` (1207-1265) | ¿`currentPosition` puede quedar con NaN/valores erráticos? |
| P1 | `PhysicsPostProcessor.ts` | `process()` 3D exit block (419-435) | ¿Necesita reset de `SLOT_X3D_POS/Y/Z` a DEFAULT? |
| P1 | `PhysicsPostProcessor.ts` | `_states` Map | ¿Se mantiene `targetX` residual en el Float32Array? |
| P1 | `KineticAdapter.ts` | L2 Supremacy Gate (204-218) | ¿`hasSpatialTarget` lee del Arbiter correctamente? |
| P2 | `ProgrammerAetherBridge.ts` | `extractKinetic()` | ¿Envía `targetX` como `null` o lo omite del objeto? |

### 7.3 Experimento de validación sugerido

**Test en vivo (sin reiniciar):**
1. Abrir consola del backend (main process).
2. Activar radar espacial, mover un foco central.
3. Hacer Unlock.
4. Ejecutar en consola:
   ```javascript
   // En contexto del backend donde NodeArbiter es accesible
   for (const [nid, ch] of arbiter._manualOverrides) {
     if (ch.targetX !== undefined || ch.targetY !== undefined || ch.targetZ !== undefined) {
       console.log('ZOMBIE FOUND:', nid, ch)
     }
   }
   ```
5. Si se encuentran nodos con targetX/Y/Z después de Unlock → H1 confirmada.
6. Si NO se encuentran en `_manualOverrides`, buscar en `PhysicsPostProcessor._states`:
   ```javascript
   for (const [nid, state] of physicsPostProcessor._states) {
     if (Math.abs(state[4] - DEFAULT_3D_X) > 0.01 || Math.abs(state[5] - DEFAULT_3D_Y) > 0.01) {
       console.log('3D ZOMBIE STATE:', nid, {x: state[4], y: state[5], z: state[6]})
     }
   }
   ```

---

*Dossier compilado para diagnóstico por modelo Opus. Toda la información aquí contenida ha sido verificada directamente sobre el código fuente actual (no memorias stale).*
