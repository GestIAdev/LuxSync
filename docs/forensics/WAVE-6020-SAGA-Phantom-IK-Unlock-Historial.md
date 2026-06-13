# ⚔️ WAVE 6020 SAGA — Phantom IK Unlock: Historial Completo

**Resumen épico de la cruzada contra el movimiento fantasma post-Unlock.**

Después de múltiples rondas de auditoría forense, `clearAllMotorKineticOverrides()` resultó ser un síntoma, no la causa. La raíz real fue `_spatialDistanceScales` — un multiplicador de amplitud L0 que `applySpatialTarget` inyectaba en el `NodeArbiter` y que ninguna rama de Unlock limpiaba.

---

## 🎯 Síntoma Reportado

Tras tocar el **Radar 3D (Spatial Target)** y pulsar **Unlock**, los fixtures centrales seguían apuntando al horizonte con movimiento horizontal exagerado, disparando el **Airbag** (`AetherSafetyMiddleware`).

El problema ocurría **solo** si previamente se había usado el modo espacial. En modo clásico puro, Unlock funcionaba correctamente.

---

## 🏛️ Arquitectura Involucrada

| Componente | Rol |
|------------|-----|
| `NodeArbiter` | Arbitra de capas L0/L1/L2/L3, posee `_manualOverrides`, `_motorKineticOverrides`, `_spatialDistanceScales` |
| `KineticAdapter` | Emite offsets `pan_offset` / `tilt_offset` L0 desde VMM (VibeMovementManager) |
| `AetherIPCHandlers` | Handlers `setManualPattern`, `applySpatialTarget`, `releaseSpatialTarget` |
| `AetherKineticEngine` | Motor L2 nativo para patrones manuales (circle, pan, tilt...) |
| `KineticsBridge` | Puente frontend→backend, orquesta `applySpatialTarget` y `clearSpatialTargets` |
| `KineticsCathedral` | UI del botón Unlock, coordina la secuencia de 7 pasos |
| `NodeResolver` | Decide ruta IK vs clásica basado en `hasSpatialTarget` |
| `PhysicsPostProcessor` | Inercia smooth + seed de estado clásico post-Unlock |
| `AetherSafetyMiddleware` | Airbag: clamp de velocidad + teleport detection |

---

## 🧪 Fase 1: Diagnóstico Forense (Auditoría de Stores)

**Hipótesis inicial:** Las claves `targetX`, `targetY`, `targetZ` (IK poison keys) persisten en algún store.

**Hallazgos:**
- `movementStore.spatialTarget` → se limpia en `resetRadarSilent()`
- `programmerStore.fixtureOverrides` / `cellOverrides` → `clearSpatialTargets` las purga
- `NodeArbiter._manualOverrides` → `clearManualOverride` las elimina con log `[ZOMBIE-DIAG]`
- `NodeArbiter._motorKineticOverrides` → Frontend ya llamaba `clearAllMotorKineticOverrides()` en paso 5

**Conclusión:** Los poison keys no eran el vector de persistencia. Algo más amplificaba el movimiento L0 tras Unlock.

---

## 🔧 WAVE 6020.5 — Snapshot IK Pre-RemoveNodes

**Archivo:** `AetherIPCHandlers.ts` (`setManualPattern` RELEASE branch)

**Problema identificado:** `removeNodes()` eliminaba el nodo del `AetherKineticEngine`, pero `currentPosition.tilt` tenía semántica distinta según la ruta:
- **Ruta IK:** `currentPosition.tilt` guarda DMX_físico/255 (sin inversión)
- **Ruta clásica:** `currentPosition.tilt` guarda valor normalizado (0-1) que luego el `NodeResolver` invierte para ceiling

Si se capturaba el snapshot de tilt desde `currentPosition.tilt` sin normalizar, el fade clásico arrancaba desde una posición invertida, causando snap.

**Fix:** Normalizar `safeTilt` antes de inyectarlo al snapshot:
```ts
if (kineticNode.ikOrientation?.installation === 'ceiling') {
  safeTilt = BaseSystem.clamp01(1 - safeTilt)
}
```

---

## 🔧 WAVE 6020.6 — Seed Classic State

**Archivo:** `AetherIPCHandlers.ts` + `PhysicsPostProcessor.ts`

**Problema:** El `PhysicsPostProcessor` interpolaba desde el estado stale previo (3D con velocidad residual) en lugar de arrancar desde la posición del snapshot.

**Fix:** Llamar `physicsPP.seedClassicState(nodeId, safePan, safeTilt)` justo después de inyectar el snapshot, forzando `position = target` y `velocity = 0` para que el primer frame post-Unlock tenga delta cero.

---

## 🔧 WAVE 6020.7 — Radar Anchor Null

**Archivo:** `KineticsCathedral.tsx`

**Problema:** Si `anchorPan` o `anchorTilt` eran `null`, `setManualPattern(null)` inyectaba `null` al motor, rompiendo la coherencia del fade.

**Fix:** Forzar fallback a `270` (pan) y `135` (tilt) cuando los anchors son nulos:
```ts
anchorPan: anchorPan ?? 270,
anchorTilt: anchorTilt ?? 135,
```

---

## 🔧 WAVE 6020.8 — Fade Duration Alignment

**Archivo:** `AetherIPCHandlers.ts`

**Problema:** El fade de Unlock usaba `RELEASE_MS_SLOW` (1000ms) para pan/tilt, pero `clearManualOverride` con `releaseMs=0` era `skipFade=true`, lo que provocaba saltos bruscos.

**Fix:** Asegurar que el snapshot capture se hace con duración correcta y que `seedClassicState` anula la inercia residual del frame anterior.

---

## 🔧 WAVE 6020.9 — Survival Log

**Archivo:** `NodeArbiter.ts`

**Mejora diagnóstica:** Log `[WAVE-6020.9-SURVIVAL]` en `clearManualOverride` para confirmar qué keys entran al snapshot de fade y con qué valores.

---

## 🔧 WAVE 6020.10 — Zona Neutral Destruida

**Archivo:** `KineticAdapter.ts`

**Problema:** La zona neutral `|x| ≤ 0.5` secuestraba fixtures centrales (`+0.25`) forzándolos a `phase = 0` (izquierda), generando trayectorias extremas.

**Fix:** Clasificación estrictamente binaria:
```ts
posX >= 0 ? Math.PI : 0  // derecha estricta, incluye centro
```

---

## 🔧 WAVE 6020.11 — Purga IK Poison Keys en Manual Overrides

**Archivo:** `AetherIPCHandlers.ts` (RELEASE branch)

**Fix:** Bucle explícito que purga `targetX`, `targetY`, `targetZ` de `_manualOverrides` para cada nodo `:kinetic` antes de llamar `clearManualOverride`, evitando que `NodeResolver` detecte `hasSpatialTarget = true`.

---

## 🔧 WAVE 6020.12 — Exorcismo de Motor Overrides Huérfanos

**Archivo:** `AetherIPCHandlers.ts` (RELEASE branch)

**Hipótesis:** `applySpatialTarget` escribe directo a `_motorKineticOverrides` vía `arbiter.setMotorKineticOverride()` sin pasar por `AetherKineticEngine`, por lo que `removeNodes()` no los limpia.

**Fix:**
```ts
for (const nodeId of removeNodeIds) {
  arbiter.clearMotorKineticOverride(nodeId)
}
```

**Veredicto post-build:** ❌ **El problema persistió.** El frontend ya llamaba `clearAllMotorKineticOverrides()` en el paso 5 de Unlock. Este fix fue **redundante** para el flujo del usuario.

---

## 🔧 WAVE 6020.13 — La Verdadera Raíz: `_spatialDistanceScales`

**Archivo:** `AetherIPCHandlers.ts` (RELEASE branch)

**Descubrimiento:** `applySpatialTarget` establece `_spatialDistanceScales` (ej. `2.0` para fixtures cerca del target) para que `_applyRelativeOffsetFusion` escale los offsets L0. Durante modo espacial, `KineticAdapter` está gateado por L2 supremacy (`ox = 0`), así que `distScale` no tiene efecto visible.

**Tras Unlock:**
1. Motor overrides se limpian (paso 5 del frontend)
2. `KineticAdapter` vuelve a emitir offsets L0 (`ox ≠ 0`)
3. `_spatialDistanceScales` **persiste** — nadie la limpiaba en RELEASE
4. `_applyRelativeOffsetFusion` multiplica: `final = 0.5 + ox * amp * distScale * gimbal`
5. `distScale = 2.0` → **dobla el arco de movimiento**, Airbag detecta teleport/velocidad excesiva

`releaseSpatialTarget` **sí** limpiaba `clearSpatialDistanceScale()`, pero `setManualPattern(null)` (RELEASE branch) **no**.

**Fix definitivo:**
```ts
for (const nodeId of removeNodeIds) {
  arbiter.clearMotorKineticOverride(nodeId)      // WAVE-6020.12 (redundante pero harmless)
  arbiter.clearSpatialDistanceScale(nodeId)      // WAVE-6020.13 (la cura real)
}
```

**Veredicto post-build:** ✅ **Todos apuntan organizaditos. Da igual espacial → clásico, con o sin vibe.**

---

## 🧠 Lecciones Aprendidas

1. **Síntoma ≠ Causa:** `clearAllMotorKineticOverrides()` parecía no funcionar, pero en realidad el frontend ya la llamaba. El veneno estaba en otro Map.
2. **Multiplicadores ocultos:** Los factores de escala (`distScale`) son invisibles durante modos que gatean el producto final, pero se vuelven letales cuando el gating desaparece.
3. **Simetría de cleanup:** Todo lo que `applySpatialTarget` escribe, el RELEASE debe limpiar. No asumir que "ya se limpia en otro lado".
4. **Arquitectura a prueba de bombas:** Tras esta saga, el pipeline de Unlock cubre:
   - Purga de poison keys (`targetX/Y/Z`)
   - Limpieza de motor overrides
   - Limpieza de distance scales
   - Snapshot con fade suave (`RELEASE_MS_SLOW`)
   - Seed de estado clásico (`seedClassicState`)
   - Escudo `_isUnlocking` contra race conditions

---

## 📁 Commits Relacionados

- `v3` → `4a34565e` WAVE-6020.13: Purgar `_spatialDistanceScales` en RELEASE branch
- (anteriores en la misma rama: 6020.5 a 6020.12)

---

*"La puta amplitud de escala... pero ahora son a prueba de bombas."* 🛡️
