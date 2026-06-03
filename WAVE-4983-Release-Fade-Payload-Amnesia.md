# WAVE 4983 — FORENSIC AUDIT: RELEASE FADE & PAYLOAD AMNESIA

**Date:** 2026-06-03  
**Status:** AUDIT COMPLETE — ZERO CODE GENERATION  
**Scope:** Análisis de las 2 regresiones críticas reportadas tras WAVE 4982.

---

## 1. EL BYPASS DEL CLAMP — Release Fade apunta al techo

### 1.1 Orden de ejecución en `arbitrate()`

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 694–737

```typescript
    // WAVE 4752: RELEASE FADES — interpolación ease-out al soltar overrides.
    // Se aplica DESPUÉS de L2/L3 y ANTES del Grand Master.
    if (this._releaseStates.size > 0) {
      this._applyReleaseFades()
    }

    // ... Grand Master ... inhibit limits ...

    // ⚡ WAVE 4914 — RELATIVE OFFSET FUSION (L2 Base + L0 Offset).
    // Sustituye al antiguo pin absoluto del L2-MOTOR. Para cada nodo:
    //   pan_final  = clamp01(pan_base  + pan_offset  * amp * aspect * dist_k)
    //   tilt_final = clamp01(tilt_base + tilt_offset * amp * aspect * dist_k)
    this._applyRelativeOffsetFusion()

    return this._result as ArbitratedNodeMap
```

**Verdict:** `_applyReleaseFades()` se ejecuta ANTES de `_applyRelativeOffsetFusion()`. El fade modifica `record['pan']`/`record['tilt']` en `_result`, pero la fusión los **sobrescribe completamente** después. El fade nunca llega al output final.

### 1.2 Matemática del Release Fade — fade hacia 0 cuando L0 ausente

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 1275–1309

```typescript
  private _applyReleaseFades(): void {
    const now = performance.now()
    for (const [nodeId, rel] of this._releaseStates) {
      let record = this._result.get(nodeId)

      let fadeCompleted = true
      for (const key in rel.channels) {
        const duration = rel.durationByChannel[key] ?? RELEASE_MS_FAST
        const elapsed  = now - rel.startedAtMs
        if (elapsed < duration) fadeCompleted = false
        const t = elapsed >= duration ? 1.0 : elapsed / duration
        // Ease-out cúbico: suave al final — orgánico para movers
        const fadeWeight = 1.0 - t * t * t
        if (fadeWeight <= 0) continue

        const releaseValue = rel.channels[key]
        if (!record) {
          record = this._acquireRecord()
          this._result.set(nodeId, record)
        }
        const l0Value = record[key]
        if (l0Value !== undefined && Number.isFinite(l0Value)) {
          // Blend: snapshot del manual → valor L0 actual
          record[key] = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
        } else {
          // L0 no escribió este canal aún: fade a 0
          record[key] = releaseValue * fadeWeight
        }
      }

      if (fadeCompleted) {
        this._releaseStates.delete(nodeId)
      }
    }
  }
```

**CRÍTICO:** En la línea 1300–1301, cuando `l0Value` es `undefined` (L0 no ha escrito `tilt` aún para este nodo — porque el VMM L0 fue silenciado por el patrón manual o porque el nodo no está en el bus L0), la fórmula degenera a:

```
record['tilt'] = releaseValue * fadeWeight
```

Esto **fadea hacia 0**, no hacia el valor L0. Si `releaseValue` era un tilt alto (ej. 0.85), el fade arranca en 0.85 y desciende linealmente hacia 0 a medida que `fadeWeight` decrece.

En escala DMX, 0 en normalizado = **techo** para mounts de ceiling (por la inversión del NodeResolver). El fixture "apunta al techo" progresivamente durante el fade.

### 1.3 Sobrescritura final por Relative Offset Fusion

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 880–898

```typescript
      // ── Fusión aditiva — WAVE 4980: LTP SUPPRESSION + hard tilt cap ────────
      if (hasBasePan || hasPanOffset) {
        const ox = (!hasBasePan && hasPanOffset) ? (panOffset as number) : 0
        let final = basePan + ox * ampPan * distScale * gimbalFactor
        if (final < 0) final = 0
        else if (final > 1) final = 1
        record['pan'] = final
      }
      if (hasBaseTilt || hasTiltOffset) {
        const oy = (!hasBaseTilt && hasTiltOffset) ? (tiltOffset as number) : 0
        let final = baseTilt + oy * ampTilt * distScale
        if (final < 0) final = 0
        else if (final > TILT_ARBITER_MAX) final = TILT_ARBITER_MAX
        record['tilt'] = final
      }
```

**Verdict:** Después del fade, `_applyRelativeOffsetFusion` calcula `record['tilt']` desde cero usando `baseTilt` y `tilt_offset`. Si no hay base (porque `_motorKineticOverrides` fue borrado por unlock) pero SÍ hay `tilt_offset` de L0 (porque el VMM retomó), `baseTilt = 0.5` y `final = 0.5 + offset * amp * distScale`. El fade anterior se pierde por completo.

**Resumen del flujo defectuoso:**
1. Unlock → `clearManualOverride` captura snapshot de `tilt` en `_releaseStates`
2. Primer frame post-unlock: release fade calcula `tilt = snapshot * fadeWeight` (fade hacia 0 porque L0 no escribió `tilt` aún)
3. `_applyRelativeOffsetFusion` corre DESPUÉS: si L0 escribió `tilt_offset`, `final = 0.5 + offset * amp * distScale` — sobrescribe el fade
4. Si L0 NO escribió `tilt_offset`, el nodo se saltea (`continue`) y el fade hacia 0 persiste → **fixture apunta al techo**

---

## 2. LA AMNESIA DEL PAYLOAD — El target IK desaparece al reactivar

### 2.1 El Bridge lee el radar, no el IK

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 586–601

```typescript
    // WAVE 4708 T2 — ANCHOR HYDRATION: leer la posición ACTUAL del radar
    // del movementStore y enviarla normalizada en el mismo payload. El handler
    // IPC inyecta pan_base/tilt_base en _manualOverrides ANTES de activar el
    // motor → el primer tick lee el anchor real, no el fallback 0.5.
    const { pan: anchorPanDeg, tilt: anchorTiltDeg } = useMovementStore.getState()
    const anchorPan  = Math.max(0, Math.min(1, anchorPanDeg  / 540))
    const anchorTilt = Math.max(0, Math.min(1, anchorTiltDeg / 270))

    // WAVE 4700: Incluir fan en el payload — el motor nativo integra el desfase
    console.log('[SONDA L2-FRONT] Enviando patrón:', enginePattern, 'Fixtures:', fixtureIds.length, 'anchor:', { anchorPan, anchorTilt })
    try {
      await window.lux?.aether?.setManualPattern({
        fixtureIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
        fan: fanValue,  // [-100, 100] — el handler IPC normaliza a [0, 1]
        anchorPan,      // [0, 1] — WAVE 4708 T2
        anchorTilt,     // [0, 1] — WAVE 4708 T2
      })
```

**Verdict:** Cuando se reactiva un patrón manual, `_flushPattern` siempre lee `pan`/`tilt` del **movementStore** (la posición del radar). Si el usuario no movió el radar desde el unlock, estos valores son los defaults: `pan: 270, tilt: 135` → normalizado a `0.5, 0.5`. El payload envía `anchorPan: 0.5, anchorTilt: 0.5`.

**NO** lee el target IK actual ni el `_motorKineticOverride` del backend. El payload nunca incluye datos del target espacial.

### 2.2 El handler IPC pierde el IK en la jerarquía de resolución

**File:** `src/core/aether/AetherIPCHandlers.ts` | **Lines:** 502–518

```typescript
          const manual = arbiter.getManualOverride(nodeId)
          const motor  = arbiter.getMotorKineticOverride(nodeId)

          // Posición viva absoluta (canal directo pan/tilt, sin sufijo _base)
          const livePan  = manual && Number.isFinite(manual['pan'])  ? manual['pan']  : null
          const liveTilt = manual && Number.isFinite(manual['tilt']) ? manual['tilt'] : null

          // Target base del motor IK activo
          const ikPan  = motor && Number.isFinite(motor['pan_base'])  ? motor['pan_base']  : null
          const ikTilt = motor && Number.isFinite(motor['tilt_base']) ? motor['tilt_base'] : null

          // Caché del radar (activo tóxico — sólo como última red de seguridad)
          const cachePan  = manual && Number.isFinite(manual['pan_base'])  ? manual['pan_base']  : null
          const cacheTilt = manual && Number.isFinite(manual['tilt_base']) ? manual['tilt_base'] : null

          const resolvedAnchorPan  = livePan  ?? ikPan  ?? fallbackPan  ?? cachePan  ?? 0.5
          const resolvedAnchorTilt = liveTilt ?? ikTilt ?? fallbackTilt ?? cacheTilt ?? 0.5
```

**Verdict:** La jerarquía es: `livePan > ikPan > fallbackPan > cachePan > 0.5`. El `fallbackPan` es el `anchorPan` del payload (0.5 si el radar no se movió).

### 2.3 ¿Por qué `ikPan` es null al reactivar?

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 355–382

```typescript
  clearManualOverride(nodeId: NodeId, _releaseMs?: number): void {
    const channels = this._manualOverrides.get(nodeId)
    if (channels) {
      // Capturar snapshot para el fade de retorno
      const snapshot: Record<string, number> = {}
      const durationByChannel: Record<string, number> = {}
      for (const key in channels) {
        const v = (channels as Record<string, number>)[key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          snapshot[key] = v
          durationByChannel[key] = SLOW_RELEASE_CHANNELS.has(key) ? RELEASE_MS_SLOW : RELEASE_MS_FAST
        }
      }
      if (Object.keys(snapshot).length > 0) {
        this._releaseStates.set(nodeId, {
          channels: snapshot,
          startedAtMs: performance.now(),
          durationByChannel,
        })
      }
    }
    this._manualOverrides.delete(nodeId)

    // WAVE 4935 M2: Ghost Anchor fix.
    // L2 clear debe limpiar también el estado cinético nativo (IK targets, orbits)
    // para evitar que L0 lea posiciones fantasma al retomar el control.
    this._motorKineticOverrides.delete(nodeId)
  }
```

**CRÍTICO:** En la línea 381, `clearManualOverride` borra `_motorKineticOverrides` junto con `_manualOverrides`. El comentario dice "Ghost Anchor fix" para evitar que L0 lea posiciones fantasma.

**PERO:** Al desactivar un patrón manual (unlock), el handler IPC llama `clearManualOverride` (línea 428 de AetherIPCHandlers.ts). Esto borra el target IK (`_motorKineticOverrides`).

**File:** `src/core/aether/AetherKineticEngine.ts` | **Lines:** 406–420

```typescript
  removeNodes(nodeIds: string[], arbiter: NodeArbiter): void {
    for (const nodeId of nodeIds) {
      if (this._nodeConfigs.delete(nodeId)) {
        arbiter.clearMotorKineticOverride(nodeId)
        this._phaseMap.delete(nodeId)
        // WAVE 4982 Paso 3: Purgar posición anterior del Filtro Glaciar.
        this._prevPositionMap.delete(nodeId)
        // _overridePool y _manualOverrides: PRESERVADOS — paradigma Programmer.
      }
    }
  }
```

**Verdict:** `removeNodes` ya llama `arbiter.clearMotorKineticOverride(nodeId)` (borra `_motorKineticOverrides`). Luego, `clearManualOverride` en el handler IPC vuelve a borrar `_motorKineticOverrides` (línea 381). El target IK es **borrado dos veces** y no queda rastro.

Al reactivar el patrón manual:
- `motor = arbiter.getMotorKineticOverride(nodeId)` → `undefined`
- `ikPan = null`
- `resolvedAnchorPan = fallbackPan = 0.5` (del payload del bridge)

**El fixture pierde su target IK y se va a (0.5, 0.5).**

---

## 3. LA SINGULARIDAD CENTRAL — KineticAdapter.ts

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Lines:** 237

```typescript
      const lrPhaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0
```

**Verdict:** Cuando `node.physicalPosition.x === 0` (fixture exactamente en el centro de la sala), `lrPhaseOffset = 0`. El fixture se mueve en fase con los de la izquierda (x < 0), no con los de la derecha (x > 0). Es una discontinuidad en el límite, pero es intencional y no causa la regresión reportada.

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 764

```typescript
    const intentsByFixture = Object.fromEntries(this._result)
```

**Verdict:** Convierte el Map `_result` a un objeto plano. Las claves del Map son strings como `fixtureId:kinetic`, así que el objeto tiene propiedades con esos nombres exactos. Luego:

```typescript
        if (fixtureId === Object.keys(intentsByFixture)[0]) {
```

Compara el `fixtureId` puro (extraído con `nodeId.slice(0, sep)`) contra la primera key del objeto, que incluye el sufijo `:kinetic`. La comparación siempre es `false`. Este es solo un filtro de logging (RADAR TELEMETRY TRAP), no afecta la lógica de fusión.

---

## 4. RESUMEN DE CAUSAS RAÍZ

| # | Síntoma | Causa raíz | Ubicación exacta |
|---|---------|------------|------------------|
| 1 | Fixture apunta al techo tras unlock | Release fade aplica antes de `_applyRelativeOffsetFusion`. Cuando L0 no escribió `tilt`, fadea hacia 0 (techo en ceiling mount). Luego la fusión puede sobrescribir o dejar el fade hacia 0 intacto. | `NodeArbiter.ts:1296–1301` (fade hacia 0) + `NodeArbiter.ts:694–698` vs `735` (orden de ejecución) |
| 2 | Fixture pierde target IK al reactivar patrón | `clearManualOverride` (línea 381) borra `_motorKineticOverrides`. `removeNodes` ya lo había borrado. Al reactivar, `ikPan` es null y el fallback es `anchorPan` del radar (0.5 si no se movió). | `NodeArbiter.ts:381` + `AetherKineticEngine.ts:409` + `KineticsBridge.ts:586–588` |

---

*End of WAVE 4983 Forensic Audit Report.*
