# WAVE 4985 — FORENSIC AUDIT: PAYLOAD TOXICITY & X-AXIS SINGULARITY

**Date:** 2026-06-03  
**Status:** AUDIT COMPLETE — ZERO CODE GENERATION  
**Scope:** Origen del payload tóxico en KineticsBridge + matemática de singularidad en eje X del KineticAdapter/VMM.

---

## 1. LA FALSIFICACIÓN DEL PAYLOAD — Origen del anchorPan: 0.5

### 1.1 Fuente directa: `_flushPattern` lee `movementStore.pan`

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 586–588

```typescript
    const { pan: anchorPanDeg, tilt: anchorTiltDeg } = useMovementStore.getState()
    const anchorPan  = Math.max(0, Math.min(1, anchorPanDeg  / 540))
    const anchorTilt = Math.max(0, Math.min(1, anchorTiltDeg / 270))
```

Aquí está la fuente del problema. `anchorPanDeg` viene de `movementStore.pan`, cuyo default es:

**File:** `src/stores/movementStore.ts` | **Lines:** 152–154

```typescript
const DEFAULTS: MovementState = {
  pan: 270,
  tilt: 135,
```

`270 / 540 = 0.5`. `135 / 270 = 0.5`.

**Resultado:** Cuando el operador activa un patrón sin haber tocado el radar, el store tiene los valores default → `anchorPan = 0.5, anchorTilt = 0.5`. El payload enviado es literalmente el centro muerto.

### 1.2 El mismo problema ocurre en `hydrateFromL2` si el backend devuelve null

**File:** `src/stores/movementStore.ts` | **Lines:** 240–241

```typescript
      pan: pan !== null ? Math.max(0, Math.min(540, pan * 540)) : 270,
      tilt: tilt !== null ? Math.max(0, Math.min(270, tilt * 270)) : 135,
```

Si el backend devuelve `panAnchor: null` (nodo sin override), el store se seta a 270°/135° → default tóxico. La próxima activación de patrón lee esos 270/135 → `anchorPan: 0.5`.

### 1.3 La `_hydrateFromBackend` propaga el tóxico explícitamente

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 363–372

```typescript
      const leadState = res.states[0]
      if (leadState) {
        const panDeg  = (leadState.panAnchor  ?? 0.5) * 540
        const tiltDeg = (leadState.tiltAnchor ?? 0.5) * 270

        // Suprimimos el flush clásico derivado — no queremos reescribir L2
        // con valores que acabamos de leer del backend.
        this._suppressClassicFlushCount++
        useMovementStore.getState().setPanTilt(panDeg, tiltDeg)
      }
```

Aquí, `leadState.panAnchor ?? 0.5` — si el nodo recién desbloqueado tiene `panAnchor: null` o `undefined`, se usa el fallback `0.5` explícito. `0.5 * 540 = 270°` → store en default tóxico.

### 1.4 Flujo completo del veneno

```
1. Fixture se desbloquea (pattern = null → clearManualOverride)
2. _hydrateFromBackend() lee el estado vacío del backend
3. leadState.panAnchor = null → fallback 0.5 → setPanTilt(270, 135)
4. movementStore.pan = 270, tilt = 135
5. Operador activa patrón → _flushPattern()
6. anchorPanDeg = 270 → anchorPan = 0.5 ← TÓXICO
7. Payload: { anchorPan: 0.5, anchorTilt: 0.5 } → backend recibe centro muerto
8. AetherIPCHandlers: fallbackPan = 0.5, fallbackTilt = 0.5
9. resolvedAnchorPan = livePan ?? ikPan ?? 0.5 → 0.5 si no hay IK activo
10. Fixture pierde su posición real y salta al centro de la sala
```

### 1.5 El IK Anchor Preservation de WAVE 4916 (salvaguarda que falla)

**File:** `src/core/aether/AetherIPCHandlers.ts` | **Lines:** 502–518

```typescript
          const manual = arbiter.getManualOverride(nodeId)
          const motor  = arbiter.getMotorKineticOverride(nodeId)

          const livePan  = manual && Number.isFinite(manual['pan'])  ? manual['pan']  : null
          const liveTilt = manual && Number.isFinite(manual['tilt']) ? manual['tilt'] : null

          const ikPan  = motor && Number.isFinite(motor['pan_base'])  ? motor['pan_base']  : null
          const ikTilt = motor && Number.isFinite(motor['tilt_base']) ? motor['tilt_base'] : null

          const cachePan  = manual && Number.isFinite(manual['pan_base'])  ? manual['pan_base']  : null
          const cacheTilt = manual && Number.isFinite(manual['tilt_base']) ? manual['tilt_base'] : null

          const resolvedAnchorPan  = livePan  ?? ikPan  ?? fallbackPan  ?? cachePan  ?? 0.5
          const resolvedAnchorTilt = liveTilt ?? ikTilt ?? fallbackTilt ?? cacheTilt ?? 0.5
```

Esta guardia **funciona correctamente cuando hay IK activo** (`ikPan` no es null). El problema ocurre cuando:

1. No hay IK activo (fixture en modo radar clásico, sin `applySpatialTarget`)
2. No hay `manual.pan` vivo (el operador no arrastró el radar desde el unlock)
3. `fallbackPan = 0.5` (el payload del bridge trajo 0.5)
4. No hay `cachePan` (el `clearManualOverride` de WAVE 4984 ya borró `pan_base` de la caché)

→ El fallback final `?? 0.5` se activa. El fixture pierde su posición.

---

## 2. LA SINGULARIDAD ESPACIAL — X-axis jitter en fixtures centrados

### 2.1 El multiplicador discontinuo en `KineticAdapter.ts`

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Line:** 237

```typescript
      const lrPhaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0
```

**Matemática:**
- `x > 0` → `lrPhaseOffset = Math.PI` (3.14159...)
- `x <= 0` → `lrPhaseOffset = 0`

Para un fixture con `x ≈ 0` (ej. `x = 0.001`): `lrPhaseOffset = π`.  
Para un fixture con `x ≈ 0` (ej. `x = -0.001`): `lrPhaseOffset = 0`.

La función tiene una **discontinuidad de salto** en `x = 0`. Un fixture físicamente en el centro de la sala (o con posición x incalculada/`undefined`) puede oscilar entre `0` y `π` si su `physicalPosition.x` fluctúa alrededor de cero entre frames.

**Efecto:** `pan_offset` del VMM oscila entre sin(phase + 0) y sin(phase + π) = **inversión completa del signo del pan**. El fixture salta de un extremo al otro del patrón en cada frame.

### 2.2 El fallback a 0 cuando physicalPosition es undefined

**Line:** 237

```typescript
      const lrPhaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0
```

Si `node.physicalPosition` es `undefined` (fixture sin posición física asignada), `??0` hace que `0 > 0 = false` → `lrPhaseOffset = 0`. Esto es estable (no oscila), pero fixtures sin posición se comportan como fixtures de la izquierda (x ≤ 0).

**El jitter real ocurre cuando `physicalPosition.x` existe pero tiene un valor cerca de 0.0** — la condición `> 0` crea una frontera que genera la oscilación.

### 2.3 El SNAKE estéreo — segunda singularidad en `mag ≈ 0`

**File:** `src/engine/movement/VibeMovementManager.ts` | **Lines:** 1213–1224

```typescript
      const mag = Math.sqrt(finalPosition.x * finalPosition.x + finalPosition.y * finalPosition.y)
      
      if (mag > 0.01) {
        // Ángulo actual del vector posición
        const currentAngle = Math.atan2(finalPosition.y, finalPosition.x)
        // Rotar por el phase offset del fixture
        const newAngle = currentAngle + phaseOffset
        
        stereoPosition.x = Math.cos(newAngle) * mag
        stereoPosition.y = Math.sin(newAngle) * mag
      }
      // Si mag ≈ 0 (posición en centro), no hay nada que rotar
```

**Análisis de la ecuación:**

`currentAngle = atan2(y, x)` — no hay división por cero aquí (atan2 es seguro), pero hay inestabilidad numérica cuando `mag` oscila alrededor del umbral `0.01`.

- `mag = 0.009` → NO rota → `stereoPosition = finalPosition` (sin offset estéreo)
- `mag = 0.011` → SÍ rota → `stereoPosition ≠ finalPosition` (offset estéreo aplicado)

Cuando el patrón pasa por el centro de su trayectoria (ej. scan_x en el punto de cruce x=0), `finalPosition.x ≈ 0` y si también `finalPosition.y ≈ 0`, `mag` cruza el umbral 0.01 frame a frame → **el fixture alterna entre versión con y sin estéreo**, causando un salto periódico en la posición.

### 2.4 El MIRROR estéreo — multiplicador discontinuo similar

**File:** `src/engine/movement/VibeMovementManager.ts` | **Lines:** 1195–1202

```typescript
    if (stereoConfig.type === 'mirror' && totalFixtures > 1) {
      const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
      stereoPosition.x = finalPosition.x * mirrorSign
```

Para `techno-club`, `mirrorSign` depende de `fixtureIndex`. Si dos fixtures en el centro de la sala tienen `fixtureIndex = 0` y `fixtureIndex = 1`, reciben `mirrorSign = +1` y `-1` respectivamente.

Si ambos tienen `physicalPosition.x ≈ 0` (y por tanto `lrPhaseOffset` inestable según §2.1), el `mirrorSign` adicional **amplifica** el jitter ya producido por la discontinuidad de `lrPhaseOffset`.

### 2.5 El desfase doble — `lrPhaseOffset` en KineticAdapter vs stereo en VMM

La asimetría L/R se aplica **dos veces** en el pipeline:

1. **KineticAdapter.ts:237** — `lrPhaseOffset = x > 0 ? π : 0` → pasa como `phaseOffset` al VMM
2. **VibeMovementManager.ts:1195–1202** — MIRROR invierte `stereoPosition.x` usando `fixtureIndex % 2`

Un fixture con `fixtureIndex = 1` (derecha, `x > 0`) recibe:
- `lrPhaseOffset = π` del KineticAdapter
- `mirrorSign = -1` del VMM

Para techno, STEREO_CONFIG es `{ offset: Math.PI, type: 'mirror' }`. El offset de π ya está en `lrPhaseOffset`. El mirror adicional es redundante y opera en **espacio de posición** (no de fase), produciendo desfases compuestos no lineales.

---

## 3. TABLA DE CAUSAS RAÍZ

| # | Síntoma | Causa raíz | Ubicación |
|---|---------|------------|-----------|
| 1 | `anchorPan: 0.5` al activar patrón | `movementStore.pan` en default `270` tras unlock o hydratación con `panAnchor: null` | `movementStore.ts:153` + `KineticsBridge.ts:586-588` |
| 2 | Fixture pierde posición al reactivar | `resolvedAnchorPan` cae al fallback `0.5` cuando no hay IK ni live override ni caché | `AetherIPCHandlers.ts:517` |
| 3 | Jitter en focos `x ≈ 0` | `lrPhaseOffset = x > 0 ? π : 0` — discontinuidad binaria en la frontera de la sala | `KineticAdapter.ts:237` |
| 4 | Salto periódico en patrón estéreo | `mag > 0.01` threshold oscila en pasos por el centro de la trayectoria | `VibeMovementManager.ts:1215` |
| 5 | Desfase compuesto L/R | `lrPhaseOffset=π` en KineticAdapter + `mirrorSign=-1` del MIRROR estéreo del VMM actúan por separado sobre el mismo fixture derecho | `KineticAdapter.ts:237` + `VibeMovementManager.ts:1201` |

---

*End of WAVE 4985 Forensic Audit Report.*
