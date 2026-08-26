Tienes razón, se hizo largo pero encontré algo crítico. Déjame verificar una última pieza del rompecabezas antes de escribir el informe final:

Ahora la pieza final — verificar si el `activePattern: 'none'` inicial dispara un `_flushPattern` al montar el bridge:

Ahora tengo todo. Aquí está el informe forense completo:

---

# FORENSIC REPORT: VMM & IK COEXISTENCE (WAVE 7612)

## 1. ARQUITECTURA INTENCIONADA — Coexistencia VMM/IK

El sistema fue diseñado con **dos rutas paralelas** que convergen en el `NodeArbiter`:

### Ruta A: Spatial Target (IK puro)
```
SpatialTargetPad drag
  → movementStore.setSpatialTarget({x,y,z})
  → KineticsBridge._scheduleSpatialFlush() [20ms debounce]
  → _flushSpatial()
  → IPC: lux:aether:applySpatialTarget
  → AetherIPCHandlers: arbiter.setMotorKineticOverride(nodeId, {
      target_x, target_y, target_z    // ← SNAKE_CASE
    })
```

### Ruta B: ProgrammerAetherBridge (L2 manual)
```
programmerStore.fixtureOverrides[id].targetX/Y/Z  // ← CAMELCASE
  → ProgrammerAetherBridge.extractKinetic()
  → ch['targetX'] = ov.targetX       // ← CAMELCASE
  → IPC: lux:aether:setPayloads
  → arbiter._manualOverrides.set(nodeId, { targetX, targetY, targetZ })
```

### Ruta C: Pattern (VMM)
```
PatternArsenal click
  → movementStore.setActivePattern('circle')
  → KineticsBridge._flushPattern()
  → clearSpatialTargets() [limpia programmerStore]
  → IPC: lux:aether:setManualPattern
  → AetherKineticEngine tick @ 44Hz
  → arbiter.setMotorKineticOverride(nodeId, { pan_base, tilt_base })
```

### Fusión en NodeArbiter._applyRelativeOffsetFusion()
```
basePan  = motor.pan_base  ∥ manual.pan_base  ∥ 0.5
baseTilt = motor.tilt_base ∥ manual.tilt_base ∥ 0.5
finalPan  = clamp01(basePan  + pan_offset  * amp * distScale * gimbal)
finalTilt = clamp01(baseTilt + tilt_offset * amp * distScale)
```

**Doctrina**: El Spatial Target es un **anchor** (base) sobre el que el patrón VMM **orbita**. No son mutuamente excluyentes — el patrón suma un offset orbital encima de la base IK.

---

## 2. RAÍZ DEL FALLO — Mismatch de nomenclatura + canal fantasma

### Hallazgo crítico: `target_x` ≠ `targetX`

El `NodeResolver` busca el canal espacial con:
```typescript
const CH_TARGET_X = 'targetX'   // camelCase, sin underscore
const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
```

Pero `applySpatialTarget` escribe al arbiter:
```typescript
arbiter.setMotorKineticOverride(nodeId, {
  target_x: subTarget.x,   // snake_case CON underscore
  target_y: subTarget.y,
  target_z: subTarget.z,
})
```

**Y el arbiter NUNCA copia `target_x/target_y/target_z` del `_motorKineticOverrides` al `_result` record.** La función `_applyRelativeOffsetFusion()` solo lee `pan_base/tilt_base` del motor override — ignora completamente los campos `target_x/y/z`.

### ¿De dónde se supone que llega `targetX` (camelCase) al channelValues?

Solo hay una ruta: **ProgrammerAetherBridge** lee `programmerStore.fixtureOverrides[id].targetX` y lo inyecta como `ch['targetX']` al arbiter via `setManualOverride`. Pero el `SpatialTargetPad` **nunca escribe a `programmerStore`** — solo llama a `movementStore.setSpatialTarget()`.

Existe `programmerStore.setSpatialPosition(target)` que escribiría `targetX/Y/Z` al store, pero **no tiene ningún call site** fuera de su propia definición. Es código muerto.

### El circuito roto:

```
SpatialTargetPad
  → movementStore.setSpatialTarget()     ✅ llega al bridge
  → KineticsBridge._flushSpatial()        ✅ llega al IPC
  → applySpatialTarget IPC                ✅ llega al arbiter
  → arbiter.setMotorKineticOverride({     ✅ se almacena en _motorKineticOverrides
      target_x, target_y, target_z
    })
  → arbiter.arbitrate()                   ❌ NUNCA copia target_x → result['targetX']
  → NodeResolver._writeNode()             ❌ channelValues['targetX'] === undefined
  → hasSpatialTarget = false              ❌ NO toma ruta IK
  → cae a ruta clásica (pan/tilt directo)  ❌ fixture no se mueve al target 3D
```

---

## 3. EL PROBLEMA DEL "HOLD" DEFAULT

### `activePattern: 'none'` → `'hold'`

El `movementStore` inicializa con `activePattern: 'none'`. El bridge convierte:
```typescript
function toEnginePattern(p: string): string {
  if (p === 'none') return 'hold'    // ← 'none' se convierte en 'hold'
  if (p === 'static') return 'hold'
  return p
}
```

Cuando el operador selecciona fixtures por primera vez, la suscripción de patrón dispara `_flushPattern('none', ...)` que se convierte en `'hold'`. Esto:

1. **Llama `clearSpatialTargets(fixtureIds)`** — borra `targetX/Y/Z` del programmerStore
2. **Cancela el timer `_spatialFlushTimeout`** — decapita cualquier flush espacial pendiente
3. **Envía `setManualPattern({ pattern: 'hold' })`** al backend

El backend `setManualPattern` con `'hold'` **migra motor→manual** y congela el fixture en su posición actual. Si el operador luego arrastra el SpatialTargetPad, el flush espacial llega al arbiter como `target_x/y/z` en `_motorKineticOverrides`, pero:

- El arbiter no copia esos valores al resultado
- El resolver no ve `targetX` (camelCase) en channelValues
- **El fixture permanece congelado en hold**

---

## 4. IMPACTO DE WAVE 7610/7611

### WAVE 7610 (16-bit IK + Calibration)
- **No rompió nada en esta ruta.** `solveInto()` signature no cambió — sigue aceptando `Target3D`.
- Los campos `pan16/tilt16` son output-only, no afectan el input pipeline.
- La reparación de calibración es ortogonal al problema del spatial target.

### WAVE 7611 (Spatial Unlock)
- **Tampoco rompió nada.** Solo removió el `disabled` del botón UI.
- El problema ya existía antes del unlock — el botón estaba congelado precisamente porque **el equipo sabía que la ruta no funcionaba**.
- Al desbloquear, expuso el bug subyacente que nunca se había reparado.

---

## 5. DIAGNÓSTICO TEÓRICO

### Causa raíz: **Dos rutas de inyección de targets espaciales, ninguna funcional**

| Ruta | Estado | Problema |
|------|--------|----------|
| A: `applySpatialTarget` → `_motorKineticOverrides` | ❌ Rota | Arbiter almacena `target_x` (snake) pero no lo copia al resultado. Resolver busca `targetX` (camel). |
| B: `ProgrammerAetherBridge` → `_manualOverrides` | ❌ Desconectada | `setSpatialPosition()` existe pero **no tiene call sites**. SpatialTargetPad no escribe a programmerStore. |

### Fix teórico (sin implementar):

**Opción A — Hacer que el arbiter propague los targets:**
En `_applyRelativeOffsetFusion()` o en un paso post-fusion, copiar `target_x/y/z` del `_motorKineticOverrides` al `_result` record como `targetX/targetY/targetZ` (camelCase).

**Opción B — Hacer que el SpatialTargetPad escriba a programmerStore:**
En `KinRadarViewport.handleTargetChange`, además de `setSpatialTarget(t)`, llamar `useProgrammerStore.getState().setSpatialPosition(t)` para que ProgrammerAetherBridge inyecte `targetX` (camelCase) via `_manualOverrides`.

**Opción C — Renombrar en el IPC handler:**
En `applySpatialTarget`, escribir `targetX` (camelCase) en vez de `target_x` al motor override, Y agregar lógica en el arbiter para pasar esos campos al resultado.

### Recomendación del forense:

**Opción A** es la más limpia — el arbiter ya tiene los datos en `_motorKineticOverrides`, solo necesita propagarlos. Es un fix de ~3 líneas en `_applyRelativeOffsetFusion()`. Pero requiere también que el arbiter no haga `continue` prematuro en el hold state si hay targets espaciales en el motor override.

**Opción B** es la más segura — usa la ruta que ya estaba diseñada (ProgrammerAetherBridge) y que tiene toda la maquinaria de `targetX` (camelCase) funcionando. Solo necesita conectar el `SpatialTargetPad` al `setSpatialPosition`.

---

## 6. RESUMEN EJECUTIVO

```
┌─────────────────────────────────────────────────────────────────┐
│ SPATIAL TARGET DATA FLOW — FORENSIC TRACE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SpatialTargetPad                                               │
│    │ onChange(Target3D)                                         │
│    ▼                                                            │
│  movementStore.setSpatialTarget()          ✅ OK                │
│    │                                                            │
│    ▼                                                            │
│  KineticsBridge._flushSpatial()            ✅ OK                │
│    │                                                            │
│    ▼                                                            │
│  IPC: applySpatialTarget                   ✅ OK                │
│    │                                                            │
│    ▼                                                            │
│  arbiter.setMotorKineticOverride({         ✅ Stored             │
│    target_x, target_y, target_z           ...but as snake_case  │
│  })                                                             │
│    │                                                            │
│    ▼                                                            │
│  arbiter.arbitrate()                       ❌ BROKEN             │
│    │  _applyRelativeOffsetFusion() only reads pan_base/tilt_base│
│    │  NEVER copies target_x → result['targetX']                 │
│    │  HOLD state: continue skips node entirely                  │
│    ▼                                                            │
│  NodeResolver._writeNode()                 ❌ BROKEN             │
│    │  channelValues['targetX'] === undefined                    │
│    │  hasSpatialTarget = false                                  │
│    │  → falls to CLASSIC path (pan/tilt direct)                 │
│    ▼                                                            │
│  solveInto() NEVER CALLED                  ❌ FIXTURE FROZEN     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**El target 3D llega al arbiter pero muere ahí.** El resolver nunca lo ve porque el arbiter no propaga `target_x` (snake) como `targetX` (camel) al mapa de resultados. Adicionalmente, el patrón `hold` default congela el fixture antes de que el IK tenga oportunidad de ejecutarse.