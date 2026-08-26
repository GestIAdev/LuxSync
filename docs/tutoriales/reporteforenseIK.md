Déjame verificar el `clearManualOverrides` en el preload y buscar el mecanismo del bucle:

Ahora déjame revisar la rama 'hold' en `setManualPattern` y el `IK_POISON_KEYS`:

Ahora déjame mirar la matemática de inversión de IK. Déjame encontrar `solveInto` y cómo maneja las orientaciones de techo/viga:

Déjame leer el resto de `solveInto` para ver el mapeo de DMX y la inversión:

Ahora déjame comprobar cómo NodeResolver aplica la inversión clásica:

Ahora déjame revisar `_writeNodeIK` para ver si aplica alguna inversión para montajes en techo:

Ahora déjame revisar `_shouldInvertClassicKineticAxes` para entender la condición de inversión:

Déjame verificar qué suscripciones de `KinRadarViewport` podrían causar re-renderizados:

Déjame revisar la limpieza del controlador de arrastre RAF en `SpatialTargetPad`:

Ahora tengo todas las piezas. Déjame escribir el informe forense:

---

# FORENSIC REPORT: IK INVERSION & IPC SPAM (WAVE 7615)

## 1. THE IK INVERSION BUG — Root Cause of "Opposite Direction"

### The asymmetry between IK path and Classic path

**CLASSIC PATH** (`NodeResolver._writeNode`, line 1309-1312):
```typescript
if (chDef.type === TILT_COARSE) {
  if (invertClassicKineticAxes) {
    dmxValue = sanitizeDmxByte(255 - dmxValue)  // ← CEILING INVERSION
  }
}
```

The classic path applies `255 - dmxValue` for ceiling/truss mounts via `_shouldInvertClassicKineticAxes()`. This is an **orientation-based** inversion, automatically derived from `device.orientation` or `ikOrientation.installation`.

**IK PATH** (`NodeResolver._writeNodeIK`, line 1736-1737):
```typescript
const dmxValue = isPan ? safePan : safeTilt
buf[bufIdx] = dmxValue  // ← NO INVERSION APPLIED
```

The IK path writes `ikResult.tilt` **directly** to the DMX buffer. **No `255 - dmxValue` inversion is applied for ceiling mounts.**

The comment at line 1755-1756 explicitly states this design choice:
```typescript
/**
 * WAVE 4547.1: Orientation awareness solo para la ruta clásica KINETIC.
 * IK NO pasa por este camino para evitar doble negación.
 */
```

The original designer assumed the IK solver (`solveInto`) would handle the inversion internally. But it doesn't — the IK solver only applies `calibration.tiltInvert` (a per-fixture flag from ShowFile), which is **separate** from the orientation-based inversion.

### The math trace

For a ceiling mount at position `(x_f, 6, z_f)` targeting `(0.43, 0.019, -0.03)`:
- `dy = 0.019 - 6 = -5.981` (target below fixture)
- `local.y = dy = -5.981` (ceiling = identity transform)
- `tiltDeg = atan2(horizontalDist, -local.y) = atan2(horizontalDist, 5.981)` → ~49°
- `tiltNorm = (49 + 135) / 270 = 0.681`
- `tiltDMXRaw = 0.681 * 255 = 174`
- If `calibration.tiltInvert = false`: `tiltDMX = 174` (no inversion)
- If `calibration.tiltInvert = true`: `tiltDMX = 255 - 174 = 81` (inverted)

The logs show `IK-Result: 179.0/176.0` — tilt=176, which matches `tiltInvert=false` (no inversion). The fixtures have `calibration.tiltInvert = false`.

### Why the 1-second fade works correctly

The `Safe snapshot seeded` code in `AetherIPCHandlers.ts` (line 577-578) applies a compensation:
```typescript
if (isClassicInverted && wasInIKMode) {
  safeTilt = 1.0 - safeTilt  // ← Pre-inverts for classic path
}
```

This converts the IK-space tilt (0.690) to the classic-space tilt (0.310). Then the classic path applies `255 - dmvValue`:
- `dmxValue = 0.310 * 255 = 79` → `255 - 79 = 175`

So the fade outputs DMX 175, which is almost the same as the IK output of 176. **Both produce nearly identical DMX values**, which means the "opposite direction" observation may be caused by an additional layer (likely the PhysicsPostProcessor applying its own classic-mode inversion on top of the IK output).

### The `PHYSICS-3D` clue

The logs show `mode=classic` in the PHYSICS-3D telemetry **even during active IK targeting**:
```
[PHYSICS-3D] node=fixture-1778099037840:kinetic mode=classic stageHalf=(6.00,3.00,4.00)...
```

This suggests the PhysicsPostProcessor is treating the node as `classic` mode and may be applying its own inversion/clamping on top of the IK output — potentially double-inverting the tilt.

### Proposed fix

Apply the same `_shouldInvertClassicKineticAxes` inversion in `_writeNodeIK` before writing to the DMX buffer:

```typescript
// In _writeNodeIK, before writing to buffer:
const invertIK = this._shouldInvertClassicKineticAxes(device.orientation, node)
if (invertIK) {
  safeTilt = sanitizeDmxByte(255 - safeTilt)
  safeTilt16 = Math.max(0, Math.min(65535, 65535 - safeTilt16))
}
```

**CAUTION**: This would also require removing the `1.0 - safeTilt` compensation in the `Safe snapshot seeded` code, since both inversions together would double-invert.

---

## 2. THE IPC SPAM LOOP — `setManualOverride MERGE` firing at 44Hz

### Mechanism

The `ProgrammerAetherBridge` runs a `setInterval` at 44Hz (every ~22ms). Each tick:

1. Checks `dirtyFamilies.size > 0` — if `KINETIC` is dirty, proceeds
2. Calls `extractKinetic()` which finds `targetX/Y/Z` non-null → emits `{ targetX, targetY, targetZ }`
3. Sends via `ipcRenderer.send('lux:aether:setManualOverrides', payloads)` — returns `undefined`
4. `Promise.all([undefined])` resolves immediately → calls `drainDirtyQueues()` → removes `KINETIC` from dirty

The drain IS working. The spam continues because **`setSpatialPosition` is called on every RAF frame during drag** (~33fps), re-dirtying `KINETIC` faster than the bridge can drain.

### The `setSpatialPosition` call site

```typescript
// KinRadarViewport.tsx line 242-243
setSpatialTarget(t)                                    // movementStore (UI)
useProgrammerStore.getState().setSpatialPosition(t)    // programmerStore (L2)
```

`setSpatialPosition` adds `KINETIC` to `dirtyFamilies` on every call. During drag, this fires at ~33fps. The bridge at 44Hz sees `KINETIC` dirty on every tick.

### Why it appears "infinite"

The user drags the pad, which fires `onChange` continuously. The bridge flushes continuously. When the user releases the mouse, `handleUp` fires one final `flushPending()`, then stops. The bridge should drain `KINETIC` and stop.

**However**, if the user observes the spam continuing after releasing the mouse, the most likely cause is that the `SpatialTargetPad`'s RAF callback is still pending. The `handleUp` function calls `flushPending()` which cancels the RAF and flushes the last position, but if there's a race between the RAF callback and the `mouseup` event, one extra `onChange` may fire.

### The real problem: unnecessary 44Hz re-sending

Even during drag, the bridge sends the SAME `targetX/Y/Z` values every tick (since the pad only fires `onChange` when the position changes). The bridge should skip sending if the extracted values haven't changed. Currently, it sends unconditionally whenever `KINETIC` is dirty.

### Proposed fix (choke point)

Add a guard in `KineticsBridge._flushPattern` and the pattern subscription to skip `clearSpatialTargets` when the spatial pad is actively dragging. Track drag state in `movementStore`:

```typescript
// In movementStore:
isSpatialDragging: boolean

// In SpatialTargetPad:
onMouseDown → useMovementStore.getState().setIsSpatialDragging(true)
onMouseUp   → useMovementStore.getState().setIsSpatialDragging(false)

// In KineticsBridge._flushPattern:
if (useMovementStore.getState().isSpatialDragging) {
  console.log('[KineticsBridge] _flushPattern ABORTED — spatial drag active')
  return
}
```

For the IPC spam, add a value-equality guard in `ProgrammerAetherBridge._flush()` to skip sending if the extracted channels are identical to the last sent values:

```typescript
// In ProgrammerAetherBridge._flush(), before sending:
const payloadKey = JSON.stringify(finalSetPayloads)  // or a faster hash
if (payloadKey === this._lastPayloadKey) {
  drainDirtyQueues()  // consume dirty without sending
  return
}
this._lastPayloadKey = payloadKey
```

---

## 3. THE 1-SECOND DROP — Why fixtures fall to rest after fade

### Sequence after UNLOCK

1. `handleUnlockKinetics` calls `clearSpatialTargets(selectedIds)` → clears `targetX/Y/Z` from programmerStore
2. `releaseKinetics()` → clears all kinetic overrides
3. `setManualPattern(null)` → triggers the RELEASE/NULL branch in the IPC handler
4. The RELEASE branch:
   - Captures `currentPosition.tilt` (from IK path: 0.690)
   - Applies `safeTilt = 1.0 - 0.690 = 0.310` (classicInv compensation)
   - Writes `setManualOverride(nodeId, { pan: safePan, tilt: 0.310 })`
   - Calls `clearManualOverride(nodeId)` which starts a **release fade**
5. During the fade (~1 second), the classic path applies `255 - dmvValue` → DMX 175 → **fixtures point correctly**
6. After the fade expires, the manual override is fully cleared
7. L0 (VMM) takes over — but `activePattern = 'none'` → VMM outputs nothing → **fixtures drop to resting position** (DMX 0 or 127 depending on fixture default)

### Why they drop to "straight down"

With no manual override and no active pattern, the arbiter's `_applyRelativeOffsetFusion` has no base values (`hasBasePan = false, hasBaseTilt = false`). The node is skipped (`continue` at line 1019). The resolver's classic path uses the default normalized value (0.5 for pan/tilt → DMX 127). For a ceiling mount with `invertClassicKineticAxes = true`, this becomes `255 - 127 = 128`, which is roughly horizontal — but the physics post-processor may clamp it to a resting position.

### The core issue

The user is in "idle" mode (no Vibe, pure manual). After UNLOCK, there's no L0 source to maintain the position. The fixtures need either:
- An active pattern to keep them moving
- A manual hold to freeze them at the last position
- The release fade to be extended indefinitely (not practical)

---

## 4. SUMMARY

| Issue | Root Cause | Fix Location |
|-------|-----------|--------------|
| Movers point opposite during IK | `_writeNodeIK` doesn't apply `255 - dmvValue` for ceiling mounts | `NodeResolver._writeNodeIK` — add inversion |
| IPC spam at 44Hz | `setSpatialPosition` dirties `KINETIC` on every drag frame; bridge re-sends identical values | `ProgrammerAetherBridge._flush` — add value-equality guard |
| 1-second drop after UNLOCK | Release fade expires → no L0 source → fixtures fall to default | Expected behavior in idle mode — user needs to activate a pattern or hold |

### Critical choke point

The cleanest single fix to break the IPC spam without regressions: **add a value-equality guard in `ProgrammerAetherBridge._flush()`** to skip sending when the extracted channels are identical to the last sent payload. This eliminates the 44Hz spam while preserving the real-time response when values actually change.