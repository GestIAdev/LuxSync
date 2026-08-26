Let me start by reading PatternArsenal and tracing the pattern flow:

Now let me trace `handlePatternChange` in `KineticsCathedral.tsx`:

So `setActivePattern(pattern)` writes to `movementStore`. The `KineticsBridge` subscribes and calls `_flushPattern` → `setManualPattern` IPC. Let me now look at the VMM (VibeMovementManager) and how `pan_offset`/`tilt_offset` are generated. This is the key — does the VMM generate the same patterns?

The key file is `KineticAdapter.ts` — it has 11 matches. Let me read it:

**This is the key finding.** Now let me check the L2 SUPREMACY GATE more carefully — lines 204-219. This is the critical block:

**FOUND IT.** This is the smoking gun. Now let me also check the `selene-aether-adapter` to see if it has a similar gate:

Now I have the complete picture. Let me also verify the L2 engine's `tick()` to confirm it silences the VMM:

Now I have the complete forensic picture. Here's the report:

---

# FORENSIC REPORT: PATTERN ARSENAL & OFFSET MERGE (WAVE 7620-ARSENAL)

## 1. PatternArsenal — UI to Backend Flow

### UI Layer

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\PatternArsenal.tsx" />

`PatternArsenal` is a pure UI component — a 4×2 button grid. On click, it calls `onChange(pattern)` which routes to `handlePatternChange` in `KineticsCathedral.tsx` (line 102):

```typescript
const handlePatternChange = useCallback((pattern: string) => {
  setActivePattern(pattern)  // → movementStore.activePattern
  useProgrammerStore.getState().setKineticSpeed(patternSpeed ?? 50)
}, [patternSpeed, setActivePattern])
```

### Bridge Layer

`KineticsBridge` subscribes to `movementStore.activePattern` and calls `_flushPattern` → `window.lux.aether.setManualPattern()` IPC (E11).

### Backend Layer

The IPC handler in `AetherIPCHandlers.ts` (line 472+) does two things:
1. Calls `vibeMovementManager.setL2Active(true)` — **silences the VMM (L0)**
2. Calls `aetherKineticEngine.setManualKinetics()` — activates the L2 engine

The L2 engine's `tick()` (44Hz) computes `pan_base`/`tilt_base` from the pattern function and writes them to `_motorKineticOverrides`.

---

## 2. The Offset Merge — Opus's Original Architecture

### The KEY finding: `KineticAdapter` is the bridge

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" />

**This is Opus's original merge logic.** The `KineticAdapter` (L0, priority 10) is the system that converts VMM output into `pan_offset`/`tilt_offset` channels:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" lines="313-321" />

```typescript
// ── WAVE 4914 RELATIVE OFFSET ROUTING ────────────────────────────
// VMM intent.x / intent.y ∈ [-1,+1] se emiten TAL CUAL como offsets.
// El NodeArbiter._applyRelativeOffsetFusion suma con la base IK/anchor:
//   pan_final = clamp01(pan_base + pan_offset * amp * aspect)
// Cuando no hay base, el arbiter usa 0.5 como centro neutro y la
// fórmula degenera al mapeo legacy `(x+1)/2` (con amp=1, aspect=0.5).
this._valuesDict['pan_offset']  = clamp(intent.x, -1, 1)
this._valuesDict['tilt_offset'] = clamp(intent.y, -1, 1)
this._valuesDict['speed'] = BaseSystem.clamp01(intent.speed)
```

The VMM generates the pattern as `intent.x`/`intent.y` ∈ [-1,+1], and the adapter emits them as `pan_offset`/`tilt_offset`. The arbiter's `_applyRelativeOffsetFusion` then fuses them with the base:

```
pan_final = clamp01(pan_base + pan_offset * amp * aspect * distScale * gimbalFactor)
```

The resolver's IK path reads `pan_offset`/`tilt_offset` and applies them as DMX deltas after `solveInto` (WAVE 7179 post-solve fusion).

### The L2 SUPREMACY GATE — The bug that broke everything

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" lines="204-219" />

```typescript
// ── 4b. GATE L2-SUPREMACY: si el motor nativo L2 tiene este nodo bajo
// control manual, NO emitir intent L0 — el engine ya escribió pan_base/tilt_base
// en L2 antes de este tick. Emitir L0 aquí contaminaría el resultado final.
// ─── FIX WAVE 4938: L2 SUPREMACY SPATIAL GATE ───
const fixtureId = node.nodeId.split(':')[0]
const arbiter = aetherKineticEngine.arbiter
const manual = arbiter ? arbiter.getManualOverride(node.nodeId) : undefined
const hasSpatialTarget = manual && (manual['targetX'] !== undefined || manual['targetY'] !== undefined || manual['targetZ'] !== undefined)

if (
  aetherKineticEngine.hasNode(node.nodeId) ||                           // ← L2 engine active
  (arbiter && arbiter.getMotorKineticOverride(`${fixtureId}:kinetic`) !== undefined) ||  // ← spatial target active
  hasSpatialTarget                                                      // ← manual has targetX/Y/Z
) {
  return // L2 SUPREMACY: El VMM clásico se calla.
}
```

**This gate has THREE conditions, any of which silences the VMM (L0):**

1. `aetherKineticEngine.hasNode(node.nodeId)` — L2 engine has this node (pattern active)
2. `arbiter.getMotorKineticOverride(nodeId) !== undefined` — spatial target exists in motor overrides
3. `hasSpatialTarget` — manual overrides contain `targetX/Y/Z`

**Condition #1 is the problem.** When the operator activates a pattern (sweep), the L2 engine takes over the node, and the VMM is silenced. The pattern's `pan_base`/`tilt_base` is written to `_motorKineticOverrides`, and the arbiter fuses it into `record['pan']`/`record['tilt']`. But the resolver's IK path **ignores `record['pan']`/`record['tilt']`** — it only uses `pan_offset`/`tilt_offset` for post-solve fusion.

### The architectural intent

Opus designed **two parallel pattern sources**, both feeding into the same `pan_offset`/`tilt_offset` channels:

| Source | When active | What it writes |
|--------|------------|---------------|
| **VMM (L0)** via `KineticAdapter` | No L2 pattern, no spatial target | `pan_offset`/`tilt_offset` from `intent.x`/`intent.y` |
| **L2 Engine** via `AetherKineticEngine.tick()` | L2 pattern active | `pan_base`/`tilt_base` to `_motorKineticOverrides` |

The VMM was supposed to be the **default pattern source** — it always generates `pan_offset`/`tilt_offset`. When a spatial target is active, the arbiter fuses the VMM's offsets with the IK base, and the resolver applies them as DMX deltas after `solveInto`.

The L2 engine was designed for **manual pattern control** — when the operator clicks a pattern in PatternArsenal, the L2 engine takes over and writes `pan_base`/`tilt_base` directly. But the L2 SUPREMACY GATE silences the VMM entirely, so no `pan_offset`/`tilt_offset` are emitted.

### The missing piece: L2 engine should emit offsets, not bases

The L2 engine writes `pan_base`/`tilt_base` (absolute positions in DMX space). The arbiter fuses these into `record['pan']`/`record['tilt']`. But the resolver's IK path ignores these — it only reads `pan_offset`/`tilt_offset`.

**Opus's intended architecture**: The L2 engine should emit `pan_offset`/`tilt_offset` (like the VMM does), NOT `pan_base`/`tilt_base`. Then the resolver's IK path would naturally absorb them via the WAVE 7179 post-solve fusion.

Alternatively, the L2 SUPREMACY GATE should NOT silence the VMM when a spatial target is active — only when a pattern is active. The VMM should continue generating `pan_offset`/`tilt_offset` for the IK path, while the L2 engine handles the classic path.

---

## 3. The Exact Code That Bridges Patterns into IK Offsets

### The VMM path (working, but silenced by the gate)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" lines="296-321" />

```typescript
const intent = this._vmm.generateIntent(
  vibeId, va, _index, nodes.count,
  node.maxPanSpeed, phaseOffset, mountOrientation,
)

// ── WAVE 4914 RELATIVE OFFSET ROUTING ────────────────────────────
this._valuesDict['pan_offset']  = clamp(intent.x, -1, 1)
this._valuesDict['tilt_offset'] = clamp(intent.y, -1, 1)
this._valuesDict['speed'] = BaseSystem.clamp01(intent.speed)
```

This is the bridge: VMM pattern → `pan_offset`/`tilt_offset` → arbiter fusion → resolver IK post-solve fusion.

### The L2 engine path (broken — writes bases, not offsets)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="647-697" />

The L2 engine computes:
```typescript
const scaledX = x * PAN_ASPECT_RATIO * cfg.amplitude * 0.45
const scaledY = y * cfg.amplitude * 0.45
// ... orientation offset ...
let panBase = clamp01(anchorPan + scaledX + tiltOffsetNorm)
let tiltBase = clamp01(anchorTilt + scaledY)
// ... writes to _motorKineticOverrides as pan_base/tilt_base
```

It writes **absolute positions** (`pan_base`/`tilt_base`), not **relative offsets** (`pan_offset`/`tilt_offset`). The arbiter fuses these into `record['pan']`/`record['tilt']`, which the IK path ignores.

---

## 4. The Fix — Two options

### Option A: L2 engine emits offsets (minimal change, preserves Opus's architecture)

Modify `AetherKineticEngine.tick()` to write `pan_offset`/`tilt_offset` instead of `pan_base`/`tilt_base` when a spatial target is active:

```typescript
// In tick(), after computing scaledX/scaledY:
const hasSpatialTarget = arbiter.getMotorKineticOverride(nodeId)?.['targetX'] !== undefined
if (hasSpatialTarget) {
  // Emit as offset [-1,+1] for the IK post-solve fusion
  rec['pan_offset']  = x * cfg.amplitude  // raw [-1,+1], no 0.45 scale
  rec['tilt_offset'] = y * cfg.amplitude
  delete rec['pan_base']
  delete rec['tilt_base']
} else {
  // Classic path: emit as base [0,1]
  rec['pan_base']  = finalPanBase
  rec['tilt_base'] = finalTiltBase
}
```

And remove the L2 SUPREMACY GATE's condition #1 (don't silence VMM when L2 engine has the node — let both run, but the L2 engine's offsets will be fused by the arbiter).

### Option B: Remove the L2 SUPREMACY GATE for spatial targets only

Keep the L2 engine writing `pan_base`/`tilt_base` for the classic path, but when a spatial target is active, let the VMM continue generating `pan_offset`/`tilt_offset` for the IK path:

```typescript
// In KineticAdapter, modify the gate:
if (
  aetherKineticEngine.hasNode(node.nodeId) ||
  (arbiter && arbiter.getMotorKineticOverride(`${fixtureId}:kinetic`) !== undefined) ||
  hasSpatialTarget
) {
  // WAVE 7620: If spatial target is active, DON'T silence VMM.
  // The VMM generates pan_offset/tilt_offset that the IK path needs.
  // Only silence if L2 engine has the node AND no spatial target.
  if (hasSpatialTarget && !aetherKineticEngine.hasNode(node.nodeId)) {
    // Continue to VMM generation below
  } else {
    return // L2 SUPREMACY: classic path only
  }
}
```

**Option A is cleaner** — it makes the L2 engine speak the same language as the VMM (offsets, not bases) when the IK path is active. Option B would cause both the VMM and L2 engine to generate offsets simultaneously, which could double the movement.

---

## 5. Summary

The missing link was the **`KineticAdapter`** — it bridges the VMM's pattern output into `pan_offset`/`tilt_offset` channels that the IK resolver naturally absorbs. But the **L2 SUPREMACY GATE** (WAVE 4938) silences the VMM entirely when a spatial target or L2 pattern is active, cutting off the offset supply.

The L2 engine writes `pan_base`/`tilt_base` (absolute positions) instead of `pan_offset`/`tilt_offset` (relative offsets), so the IK path never sees the pattern.

**The fix**: Make the L2 engine emit `pan_offset`/`tilt_offset` when a spatial target is active, so the resolver's WAVE 7179 post-solve fusion picks them up naturally. This is the architecture Opus intended — patterns as offsets, not bases, when IK is active.