# SPATIAL-UNIFICATION-BLUEPRINT.md
## ⚡ WAVE 4573 — THE SPATIAL TRUTH & ORIENTATION DECOUPLING

> *"El visor debe ser un espejo del backend, no un diorama de fantasía."*

**Date:** 2026-05-06
**Author:** Cascade (Opus / The Quantum Engineer)
**Status:** BLUEPRINT DEFINITIVO — Orden de ejecución para implementación sin ambigüedades
**Prerequisite:** VISUALIZER-DIAGNOSIS.md (WAVE 4572)

---

## TABLE OF CONTENTS

1. [Misión 1: El Desacople de la Orientación](#misión-1-el-desacople-de-la-orientación)
2. [Misión 2: Single Source of Truth](#misión-2-single-source-of-truth)
3. [Misión 3: Resurrección de Haces](#misión-3-resurrección-de-haces)
4. [Misión 4: Guerrilla Setup](#misión-4-the-guerrilla-setup)
5. [Execution Order](#execution-order)
6. [File Manifest](#file-manifest)

---

## MISIÓN 1: EL DESACOPLE DE LA ORIENTACIÓN

### 1.1 Problema Arquitectónico

`InstallationOrientation` vive actualmente dentro de `PhysicsProfile`:

```typescript
// ShowFileV2.ts:126-172 — CURRENT (WRONG)
export interface PhysicsProfile {
  motorType: MotorType
  maxAcceleration: number
  maxVelocity: number
  safetyCap: boolean
  orientation: InstallationOrientation  // ← AQUÍ: mezclada con física del motor
  invertPan: boolean     // @deprecated
  invertTilt: boolean    // @deprecated
  swapPanTilt: boolean
  homePosition: { pan: number; tilt: number }
  tiltLimits: { min: number; max: number }
}
```

**El error conceptual:** `orientation` describe DÓNDE está montado el fixture en el escenario (ceiling, floor, wall). Eso es una propiedad de **instancia** (stage), no del **ADN** del motor (physics). Un mismo moving head puede estar en ceiling en un show y en floor en otro. Pero `PhysicsProfile` se copia desde la librería al parchear (`StageGrid3D.tsx:1519-1530`), arrastrando un `orientation: 'floor'` por defecto que no tiene nada que ver con la intención del usuario.

Además, `homePosition` y `tiltLimits` son dependientes de la orientación de montaje. Un fixture en ceiling tiene tiltLimits invertidos respecto a uno en floor.

### 1.2 Migración de Datos

#### 1.2.1 Nuevo campo en `FixtureV2`

```typescript
// ShowFileV2.ts — MODIFIED
export interface FixtureV2 {
  // ... existing fields ...

  position: Position3D
  rotation: Rotation3D

  // ═══════════════════════════════════════════════════════════════════════
  // 🏗️ WAVE 4573: ORIENTATION DECOUPLING
  // Moved OUT of PhysicsProfile into FixtureV2 root.
  // This is a STAGE property (how/where the fixture is physically mounted),
  // not a motor property (how fast the motor spins).
  // ═══════════════════════════════════════════════════════════════════════

  /** Physical installation orientation — stage property, not motor property.
   *  Determines base quaternion in 3D visualizer and IK solver frame.
   *  Default: 'ceiling' (most common: hanging from truss). */
  orientation: InstallationOrientation

  physics: PhysicsProfile   // orientation REMOVED from here (see 1.2.2)
  zone: FixtureZone
  // ... rest unchanged ...
}
```

#### 1.2.2 Limpieza de `PhysicsProfile`

```typescript
// ShowFileV2.ts — MODIFIED
export interface PhysicsProfile {
  motorType: MotorType
  maxAcceleration: number
  maxVelocity: number
  safetyCap: boolean
  // orientation: DELETED (moved to FixtureV2.orientation)
  invertPan: boolean     // @deprecated — kept for file compat
  invertTilt: boolean    // @deprecated — kept for file compat
  swapPanTilt: boolean
  homePosition: { pan: number; tilt: number }
  tiltLimits: { min: number; max: number }
}
```

#### 1.2.3 `DEFAULT_PHYSICS_PROFILES` — Remove `orientation`

```typescript
// ShowFileV2.ts — MODIFIED
export const DEFAULT_PHYSICS_PROFILES: Record<MotorType, PhysicsProfile> = {
  'servo-pro': {
    motorType: 'servo-pro',
    maxAcceleration: 4000,
    maxVelocity: 800,
    safetyCap: false,
    // orientation: DELETED
    invertPan: false,
    invertTilt: false,
    swapPanTilt: false,
    homePosition: { pan: 127, tilt: 127 },
    tiltLimits: { min: 20, max: 200 }
  },
  // ... same pattern for all 4 profiles ...
}
```

#### 1.2.4 `createDefaultFixture` — New field

```typescript
// ShowFileV2.ts — MODIFIED
export function createDefaultFixture(
  id: string,
  address: number,
  options: Partial<FixtureV2> = {}
): FixtureV2 {
  return {
    id,
    name: options.name || `Fixture ${address}`,
    model: options.model || 'Generic',
    manufacturer: options.manufacturer || 'Unknown',
    type: options.type || 'generic',
    address,
    universe: options.universe || 0,
    channelCount: options.channelCount || 1,
    profileId: options.profileId || 'generic-dimmer',
    position: options.position || { x: 0, y: 3, z: 0 },
    rotation: options.rotation || { pitch: -45, yaw: 0, roll: 0 },
    orientation: options.orientation || 'ceiling',           // ← NEW: root-level
    physics: options.physics || { ...DEFAULT_PHYSICS_PROFILES['unknown'] },
    zone: options.zone || 'unassigned',
    enabled: true,
    ...options
  }
}
```

#### 1.2.5 ShowFile Migrator — Auto-promote `physics.orientation`

```typescript
// ShowFileMigrator.ts — ADD to migration logic
// When loading a ShowFile where fixtures have physics.orientation but no root orientation:
function migrateOrientationToRoot(fixture: any): void {
  if (fixture.orientation === undefined && fixture.physics?.orientation) {
    fixture.orientation = fixture.physics.orientation
  }
  if (fixture.orientation === undefined) {
    // Heuristic: if position.y > 2m → ceiling, else floor
    fixture.orientation = (fixture.position?.y ?? 3) > 2 ? 'ceiling' : 'floor'
  }
}
```

### 1.3 UI de StageConstructor

#### 1.3.1 Context Menu — Add Orientation Submenu

**File:** `StageGrid3D.tsx` (lines ~1226-1330)

The context menu already has height management (`sendFixtureToHeight`) and zone assignment (`assignZoneManual`). Add an orientation submenu at the same level.

```typescript
// StageGrid3D.tsx — ADD new callback
const setFixtureOrientation = useCallback((orientation: InstallationOrientation) => {
  if (!contextMenu) return
  const idsToUpdate = selectedIds.size > 1 ? [...selectedIds] : [contextMenu.fixtureId]
  idsToUpdate.forEach(id => {
    updateFixture(id, { orientation })
  })
  closeContextMenu()
  console.log(`[StageGrid3D] 🧭 Orientation set to "${orientation}" for ${idsToUpdate.length} fixtures`)
}, [contextMenu, selectedIds, updateFixture, closeContextMenu])
```

**Context menu JSX** — Add after the existing "Assign Zone" submenu:

```tsx
{/* 🧭 WAVE 4573: Orientation submenu */}
<div className="context-submenu">
  <span className="context-label">🧭 Orientation</span>
  <button onClick={() => setFixtureOrientation('ceiling')}>⬇️ Ceiling (hanging)</button>
  <button onClick={() => setFixtureOrientation('floor')}>⬆️ Floor (uplight)</button>
  <button onClick={() => setFixtureOrientation('wall-left')}>⬅️ Wall Left</button>
  <button onClick={() => setFixtureOrientation('wall-right')}>➡️ Wall Right</button>
  <button onClick={() => setFixtureOrientation('truss-front')}>🎭 Truss Front</button>
  <button onClick={() => setFixtureOrientation('truss-back')}>🎬 Truss Back</button>
</div>
```

#### 1.3.2 Auto-Orientation Heuristic on Drop

**File:** `StageGrid3D.tsx` — `handleDrop` (line ~1489) and `handleFixtureDrop` (line ~1597)

After drop, infer orientation from Y position:

```typescript
// After fixture is created and added:
const inferredOrientation: InstallationOrientation =
  ghostPos.y >= 2.5 ? 'ceiling' :
  ghostPos.y <= 0.3 ? 'floor' :
  ghostPos.x < -(stage?.width ?? 12) * 0.35 ? 'wall-left' :
  ghostPos.x > (stage?.width ?? 12) * 0.35 ? 'wall-right' :
  'ceiling'  // Default

// Set orientation after addFixture:
updateFixture(fixtureId, { orientation: inferredOrientation })
```

### 1.4 Engine Routing

#### 1.4.1 `SpatialRegistrar` — Read from `FixtureV2.orientation`

**Current:** `SpatialRegistrar.register()` receives a `FixtureV2` indirectly. The `IKFixtureProfile.orientation` is built from `FixtureV2.physics.orientation`.

**Change:** All call sites that build `IKFixtureProfile` must read `fixture.orientation` (root) instead of `fixture.physics.orientation`.

**Files affected:**
- `SpatialRegistrar.ts` — `_enrichWithSpatialData()` and any profile building
- `NodeExtractionPipeline.ts` — If it reads orientation for role heuristics
- Any caller that builds `FixtureOrientation` from `FixtureV2`

**Pattern:**

```typescript
// BEFORE:
const orientation: FixtureOrientation = {
  installation: fixture.physics.orientation,
  rotation: fixture.rotation,
}

// AFTER:
const orientation: FixtureOrientation = {
  installation: fixture.orientation,  // ← Root-level, not physics
  rotation: fixture.rotation,
}
```

#### 1.4.2 `InverseKinematicsEngine` — No changes needed

The IK engine already reads from `IKFixtureProfile.orientation.installation` which is populated by the registrar. Once the registrar reads from the correct field, IK is fixed automatically.

---

## MISIÓN 2: SINGLE SOURCE OF TRUTH

### 2.1 Erradicación de Posiciones Ficticias — `useFixture3DData.ts`

**Current behavior (BROKEN):** Positions computed from `ZONE_LAYOUT_3D` dictionary. `fixture.position` (real `Position3D`) is **never read**.

**New behavior:** Read `fixture.position` directly. Fall back to zone layout ONLY when `fixture.position` is the default sentinel `{0, 3, 0}` AND the fixture has no spatial awareness (Guerrilla mode — see Misión 4).

#### 2.1.1 Refactored `useFixture3DData.ts`

Replace the entire position calculation block (lines 147-168) with:

```typescript
// ── Position calculation — WAVE 4573: SPATIAL TRUTH ─────────────────
// Read REAL Position3D from FixtureV2.
// Only fall back to zone layout for "unplaced" fixtures (Guerrilla mode).
let x: number
let y: number
let z: number

const hasRealPosition = fixture.position &&
  !(fixture.position.x === 0 && fixture.position.y === 3 && fixture.position.z === 0)

if (hasRealPosition) {
  // 🎯 SPATIAL TRUTH: Use the real position from StageBuilder
  x = fixture.position.x
  y = fixture.position.y
  z = fixture.position.z
} else {
  // 🏃 GUERRILLA FALLBACK: Fixture has no real position → use zone layout
  if (layout.vertical && layout.fixedX !== undefined) {
    x = layout.fixedX * halfWidth
    y = distributeInRange(index, total, trussHeight * 0.5, trussHeight * 0.9)
    z = layout.depthFactor * halfDepth
  } else {
    x = distributeInRange(index, total, layout.xRange[0] * halfWidth, layout.xRange[1] * halfWidth)
    y = layout.heightFactor * trussHeight
    z = layout.depthFactor * halfDepth
  }
}
```

**Sentinel detection:** The default position from `createDefaultFixture` is `{x:0, y:3, z:0}`. This is unlikely for a real stage placement (dead center at 3m height). We use this as the "unplaced" sentinel. A cleaner approach would be an `isPlaced: boolean` flag, but the sentinel avoids a schema change.

**Alternative (more robust):** Add an optional `isPlaced?: boolean` to `FixtureV2`:

```typescript
// ShowFileV2.ts — OPTIONAL enhancement
export interface FixtureV2 {
  // ...
  /** True when the user has explicitly placed this fixture in the 3D stage.
   *  False/undefined = "guerrilla" fixture, placed via quick-add without coordinates. */
  isPlaced?: boolean
  // ...
}
```

Then in `useFixture3DData`:
```typescript
const hasRealPosition = fixture.isPlaced === true
```

**Recommendation:** Use `isPlaced` flag. Cleaner, no false positives from sentinel coincidence.

#### 2.1.2 `Fixture3DData` interface — Add `orientation`

```typescript
// types.ts — MODIFIED
export interface Fixture3DData {
  // ... existing fields ...

  // ═══ WAVE 4573: Spatial Truth ═══
  /** Installation orientation for base quaternion */
  orientation: InstallationOrientation

  /** Custom rotation from ShowFile (pitch/yaw/roll in degrees) */
  baseRotation: Rotation3D
}
```

Populate in `useFixture3DData`:

```typescript
result.push({
  // ... existing fields ...
  orientation: fixture.orientation || fixture.physics?.orientation || 'ceiling',
  baseRotation: fixture.rotation || { pitch: -45, yaw: 0, roll: 0 },
})
```

#### 2.1.3 Refactored `useFixtureData.ts` (2D Tactical)

Same pattern for the 2D view. Replace the zone-based position calculation (lines 218-245) with:

```typescript
// ── WAVE 4573: Spatial Truth for 2D ──
// If fixture has real Position3D, project to 2D canvas.
// Otherwise, use ZONE_LAYOUT_2D (guerrilla fallback).

byZone.forEach((indices, zone) => {
  const layout = ZONE_LAYOUT_2D[zone]
  const count = indices.length
  const isVertical = layout.vertical === true

  indices.forEach((globalIdx, localIdx) => {
    const fixture = classified[globalIdx]
    const stageFixture = fixtureArray[globalIdx]
    const hasRealPosition = stageFixture?.isPlaced === true

    if (hasRealPosition && stageFixture?.position) {
      // 🎯 Project 3D → 2D: X maps to canvas X, Z maps to canvas Y
      // Stage coords: X [-halfW, +halfW], Z [-halfD, +halfD]
      // Canvas coords: x [0, 1], y [0, 1]
      const halfW = (stageConfig?.width ?? 12) / 2
      const halfD = (stageConfig?.depth ?? 8) / 2
      fixture.x = 0.5 + (stageFixture.position.x / halfW) * 0.4  // ±0.4 range
      fixture.y = 0.5 - (stageFixture.position.z / halfD) * 0.4  // ±0.4, Z+ = front = lower Y
    } else {
      // 🏃 GUERRILLA FALLBACK
      if (isVertical && layout.fixedX !== undefined) {
        fixture.x = layout.fixedX
        fixture.y = distributeVertically(localIdx, count, layout.y)
      } else {
        const [xMin, xMax] = layout.xRange
        fixture.x = distributeInRange(localIdx, count, xMin, xMax)
        fixture.y = layout.y
        if (fixture.type === 'moving') fixture.y -= 0.06
        else if (fixture.type === 'par' || fixture.type === 'wash') fixture.y += 0.06
      }
    }
  })
})
```

**Note:** `useFixtureData` needs access to `stageFixtures` (which it already has via `stageStore`) to read `position` and `isPlaced`. The 3D→2D projection is an orthographic top-down: X maps to X, Z maps to Y (inverted because +Z = front = bottom of 2D canvas).

### 2.2 Fix del Tilt Sign

**File:** `HyperionMovingHead3D.tsx` — line 68

**Current:**
```typescript
const TILT_REST_ANGLE = Math.PI * 0.25  // 45° forward from vertical
```

**Analysis:**

The comment says "45° forward" but the math produces a beam pointing toward **-Z** (back of stage):
- The cone hangs in **-Y** (pointing down from the head)
- A positive rotation around **+X** (right-hand rule) rotates **-Y toward +Z**... Wait, let me re-verify.

In Three.js right-hand rule:
- Positive rotation around +X rotates +Y toward +Z, and -Y toward -Z
- The cone's rest position is -Y (pointing down)
- `TILT_REST_ANGLE = +0.25π` (+45°) rotates -Y toward -Z → beam points toward **-Z (backstage)**

But the comment claims "forward into audience" which would be **+Z**.

**The fix depends on the coordinate system convention:**
- ShowFileV2 says: Z: Back(-) to Front(+)
- So +Z = front/audience, -Z = back/upstage
- For ceiling-mounted fixtures, beam should point **toward +Z** (audience) at rest
- Need negative tilt rest angle: rotate -Y toward +Z

**Fix:**
```typescript
// BEFORE:
const TILT_REST_ANGLE = Math.PI * 0.25  // +45° → beam to -Z (BACK) — WRONG

// AFTER:
const TILT_REST_ANGLE = -Math.PI * 0.25  // -45° → beam to +Z (FRONT/AUDIENCE) — CORRECT
```

**BUT WAIT:** This constant should NOT be a single global value anymore. With Misión 1's orientation decoupling, the rest angle depends on `InstallationOrientation`:
- `ceiling` / `truss-front`: beam should point toward +Z (audience) → negative rest angle
- `floor`: beam should point toward +Z too (uplight forward) → positive rest angle (or zero)
- `truss-back`: beam should point toward -Z → positive rest angle
- `wall-left`/`wall-right`: beam horizontal → zero rest angle

This is handled by the Base Quaternion system in §2.3 below. The `TILT_REST_ANGLE` becomes **zero** because the orientation-dependent rotation is handled by the base quaternion.

```typescript
// AFTER WAVE 4573:
const TILT_REST_ANGLE = 0  // Orientation-dependent rest handled by base quaternion
```

### 2.3 Inyección del Quaternion Base

**File:** `HyperionMovingHead3D.tsx`

**Concept:** Before applying DMX pan/tilt, the entire fixture mesh gets a **base rotation** that represents its physical mounting. This is the 3D equivalent of the IK engine's `MOUNT_ANGLES`.

#### 2.3.1 Base Quaternion Lookup

```typescript
// HyperionMovingHead3D.tsx — ADD (or new file: visualizer/utils/mountQuaternion.ts)
import type { InstallationOrientation } from '../../../../core/stage/ShowFileV2'

/**
 * MOUNT_QUATERNIONS — Base rotation for each installation orientation.
 * Aligns the fixture mesh so that the beam points in the physically
 * correct direction BEFORE pan/tilt DMX is applied.
 *
 * Convention:
 * - Default mesh: base at origin, beam cone hangs in -Y
 * - After base rotation: beam points in the fixture's "forward" direction
 *
 * Matches MOUNT_ANGLES from InverseKinematicsEngine.ts:
 *   ceiling:     pitch=-90° (down)      → mesh stays as-is (beam = -Y = down) ✓
 *   floor:       pitch=+90° (up)        → rotate 180° around Z → beam = +Y = up
 *   truss-front: pitch=-90°, yaw=0°     → same as ceiling
 *   truss-back:  pitch=-90°, yaw=180°   → rotate 180° around Y → beam down, facing back
 *   wall-left:   pitch=0°,  yaw=+90°    → rotate -90° around Z → beam = +X (right, toward center)
 *   wall-right:  pitch=0°,  yaw=-90°    → rotate +90° around Z → beam = -X (left, toward center)
 */
const MOUNT_QUATERNIONS: Record<InstallationOrientation, THREE.Quaternion> = (() => {
  const q = (axis: THREE.Vector3, angle: number) => 
    new THREE.Quaternion().setFromAxisAngle(axis, angle)
  const Y = new THREE.Vector3(0, 1, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const X = new THREE.Vector3(1, 0, 0)

  return {
    'ceiling':     new THREE.Quaternion(),                      // Identity — beam = -Y (down)
    'floor':       q(Z, Math.PI),                              // 180° around Z — beam = +Y (up)
    'truss-front': q(X, -Math.PI * 0.25),                     // Slight forward tilt toward +Z
    'truss-back':  new THREE.Quaternion()
                     .multiplyQuaternions(q(Y, Math.PI), q(X, -Math.PI * 0.25)),
    'wall-left':   q(Z, -Math.PI / 2),                        // Beam → +X
    'wall-right':  q(Z, Math.PI / 2),                         // Beam → -X
  }
})()

function getMountQuaternion(orientation: InstallationOrientation): THREE.Quaternion {
  return MOUNT_QUATERNIONS[orientation] ?? MOUNT_QUATERNIONS['ceiling']
}
```

#### 2.3.2 Apply Base Quaternion to Root Group

**In `HyperionMovingHead3D` component — modify the root `<group>`:**

```typescript
// Inside the component, compute base quaternion from fixture props:
const baseQuat = useMemo(() => {
  const mountQ = getMountQuaternion(fixture.orientation ?? 'ceiling')

  // Apply custom rotation (from ShowFile Rotation3D) on top of mount
  const customQ = new THREE.Quaternion()
  const euler = new THREE.Euler(
    (fixture.baseRotation?.pitch ?? 0) * DEG2RAD,
    (fixture.baseRotation?.yaw ?? 0) * DEG2RAD,
    (fixture.baseRotation?.roll ?? 0) * DEG2RAD,
    'YXZ'
  )
  customQ.setFromEuler(euler)

  return new THREE.Quaternion().multiplyQuaternions(mountQ, customQ)
}, [fixture.orientation, fixture.baseRotation])

// In JSX:
<group
  ref={groupRef}
  position={[fixture.x, fixture.y, fixture.z]}
  quaternion={baseQuat}          // ← NEW: base mounting rotation
  onClick={handleClick}
  userData={{ fixtureId: id }}
>
  {/* Base, Yoke, Head unchanged — pan/tilt applied to yoke/head as before */}
```

**Critical:** The yoke (pan) and head (tilt) rotations are applied **inside** the base-rotated group. This means pan/tilt operate in the fixture's local frame, which is correct — matching how real moving heads work.

#### 2.3.3 Component Props Update

```typescript
// HyperionMovingHead3D.tsx — MODIFY props interface
interface HyperionMovingHead3DProps {
  fixture: Fixture3DData    // Now includes orientation + baseRotation
  onSelect?: (id: string, shift: boolean, ctrl: boolean) => void
  showBeam?: boolean
  beatIntensity?: number
}
```

No change to the interface — the new fields flow through `Fixture3DData`.

---

## MISIÓN 3: RESURRECCIÓN DE HACES

### 3.1 ID Unification

**Root cause:** `transientStore.fixtureIndex` is keyed by `fixture.id` from `truth.hardware.fixtures`. The 3D components query it with `fixture.id` from `stageStore.fixtures`. If these IDs don't match, `getTransientFixture()` returns `null` forever.

**ID sources:**
- `stageStore.fixtures[].id` — User-defined, e.g. `"fixture-1715000000000"` (from `handleDrop` timestamp)
- `truth.hardware.fixtures[].id` — Set by `TitanOrchestrator.ts:1611`: `originalFixture?.id || 'fix_${i}'`
- `transientStore.fixtureIndex` — Built from `truth.hardware.fixtures[].id` in `injectTransientTruth`

**The `TitanOrchestrator.fixtures` array** is populated when the HAL starts. The `originalFixture` references must come from the same `stageStore.fixtures`. If they're the same objects, IDs match. If HAL re-creates fixtures from a different source (e.g., DMX patch file), IDs might diverge.

#### 3.1.1 Diagnostic Logging (Phase 0)

Before any fix, add diagnostic logging to confirm the hypothesis:

```typescript
// transientStore.ts — ADD after fixtureIndex rebuild (line ~92)
if (process.env.NODE_ENV !== 'production') {
  const stageIds = window.__luxDebug?.stageFixtureIds ?? []
  if (stageIds.length > 0) {
    const missingIds = stageIds.filter((id: string) => !fixtureIndex.has(id))
    if (missingIds.length > 0) {
      console.warn(`[transientStore] ⚠️ ID MISMATCH: ${missingIds.length} stageStore IDs not found in truth:`, missingIds)
    }
  }
}
```

And in `useFixture3DData.ts`, expose IDs for debug:

```typescript
// At module scope or in hook:
if (typeof window !== 'undefined') {
  (window as any).__luxDebug = (window as any).__luxDebug || {}
  ;(window as any).__luxDebug.stageFixtureIds = fixtures.map(f => f.id)
}
```

#### 3.1.2 Defensive Fallback in `getTransientFixture`

If the ID-indexed lookup fails, fall back to array scan by index position. This handles the case where IDs are generated differently but fixture order is preserved:

```typescript
// transientStore.ts — MODIFY getTransientFixture
export function getTransientFixture(fixtureId: string): any | null {
  // O(1) primary lookup
  const indexed = fixtureIndex.get(fixtureId)
  if (indexed) return indexed

  // 🛡️ WAVE 4573: Fallback — scan by id substring or index
  // If stageStore uses "fixture-xxx" and truth uses "fix_0", try positional match
  const fixtures = transientRef.current?.hardware?.fixtures
  if (fixtures) {
    for (let i = 0; i < fixtures.length; i++) {
      if (fixtures[i]?.id === fixtureId) return fixtures[i]
    }
  }

  return null
}
```

**Note:** The array fallback is only needed during the diagnostic phase. The real fix is ensuring IDs are identical at the source — which they should be if `TitanOrchestrator.fixtures` is populated from `stageStore.fixtures`. The fallback is a safety net.

#### 3.1.3 Structural Fix — Ensure ID Consistency

**File:** `TitanOrchestrator.ts` — Where fixtures are loaded.

Verify that `this.fixtures` is populated from `stageStore.fixtures` and that the `.id` field is preserved through the entire pipeline:
- `stageStore.fixtures[].id` → HAL patch → `TitanOrchestrator.fixtures[].id` → hot frame `originalFixture.id` → `transientStore.fixtureIndex`

**Action:** Grep for all places where `TitanOrchestrator.fixtures` is populated. Ensure every path preserves the `id` from `stageStore`. If HAL creates its own IDs, add an `originalStageId` field or map back to stageStore IDs.

### 3.2 Beam Visibility Fixes

#### 3.2.1 `BEAM_RADIUS_MIN` increase for LQ

**File:** `HyperionMovingHead3D.tsx` — line 84

```typescript
// BEFORE:
const BEAM_RADIUS_MIN = 0.03   // 6cm diameter — invisible without bloom

// AFTER:
const BEAM_RADIUS_MIN = 0.08   // 16cm diameter — visible even in LQ without bloom
```

**Rationale:** At 0.03, the cone is 6cm across at 3.5m length. Without bloom (LQ mode), this is a sub-pixel line at typical camera distance. 0.08 gives 16cm — visible as a thin beam.

#### 3.2.2 Beam Clipping Plane Exclusion

**Problem:** The global clipping plane at Y=0 cuts beam tips for floor fixtures. Floor fixture at Y=0.25m has beam tip at Y = 0.25 - 1.75 - 0.08 = **-1.62m** → clipped.

**Solution:** Exclude beam meshes from the global clipping plane by setting per-material clipping:

```typescript
// HyperionMovingHead3D.tsx — MODIFY beam material (line ~356)
<meshBasicMaterial
  ref={beamMaterialRef}
  color={fixture.color}
  transparent
  opacity={0.0}
  side={THREE.DoubleSide}
  depthWrite={false}
  blending={THREE.AdditiveBlending}
  clippingPlanes={[]}              // ← NEW: Override global clipping for beams
/>
```

**And in `useFrame`**, ensure the material's clipping override is maintained:

```typescript
// After beamMaterialRef.current is accessed:
if (beamMaterialRef.current) {
  beamMaterialRef.current.clippingPlanes = []  // Never clip beams
}
```

**Alternative (cleaner):** Instead of per-material override, change `ClippingPlaneSetup` to use `localClippingEnabled` on a per-object basis. But the material approach is simpler and sufficient.

#### 3.2.3 Anti-Zombie Softening

**File:** `HyperionMovingHead3D.tsx` — lines 198-202

**Current:** If `getTransientFixture` returns null, beam is hidden immediately with no recovery path.

**Fix:** Add a grace period. If fixture state is null for < 500ms (typical transient gap during boot or vibe change), use last known values instead of killing the beam:

```typescript
// ADD ref for grace period
const lastValidStateRef = useRef<{ dimmer: number; pan: number; tilt: number } | null>(null)
const nullFrameCountRef = useRef(0)
const NULL_GRACE_FRAMES = 30  // ~500ms at 60fps

// In useFrame, replace the anti-zombie block:
if (!fixtureState) {
  nullFrameCountRef.current++
  if (nullFrameCountRef.current > NULL_GRACE_FRAMES || !lastValidStateRef.current) {
    // Hard kill after grace period or if never had data
    if (beamMeshRef.current) beamMeshRef.current.visible = false
    if (lensMaterialRef.current) lensMaterialRef.current.color.setScalar(0)
    return
  }
  // During grace: hold last known state (beam stays visible but frozen)
  return
}

// Reset grace counter on valid data
nullFrameCountRef.current = 0
lastValidStateRef.current = {
  dimmer: fixtureState.dimmer ?? 0,
  pan: fixtureState.physicalPan ?? 0.5,
  tilt: fixtureState.physicalTilt ?? 0.5,
}
```

---

## MISIÓN 4: THE "GUERRILLA" SETUP

### 4.1 El Problema del Tiempo

In fast gig setups (4 minutes to patch), the operator cannot:
1. Open StageConstructor
2. Drag each fixture to a 3D position
3. Set orientation
4. Assign zone
5. Close StageConstructor and start performing

They need: **Patch → Group → GO.** Movement control defaults to classic mode (pan/tilt in degrees/DMX), not spatial IK.

### 4.2 Design: Quick-Add Without 3D Placement

#### 4.2.1 `isPlaced` Flag

```typescript
// ShowFileV2.ts — ADD to FixtureV2
export interface FixtureV2 {
  // ...
  /** True when placed in 3D StageBuilder with explicit coordinates.
   *  False/undefined = quick-add (guerrilla). Zone layout fallback for visualization. */
  isPlaced?: boolean
  // ...
}
```

**Set to `true`:** When fixture is dropped onto StageGrid3D canvas.
**Remains `false`/`undefined`:** When fixture is added via Quick-Add (see below).

#### 4.2.2 Quick-Add UI in StageConstructor

**Location:** `FixtureLibrarySidebar` in `StageConstructorView.tsx`

Add a button or double-click action on library items that adds a fixture directly to the patch **without** requiring a 3D drop. The fixture gets default position `{0, 3, 0}` and `isPlaced: false`.

```typescript
// StageConstructorView.tsx — ADD to FixtureLibrarySidebar
const handleQuickAdd = useCallback(async (libraryId: string, fixtureType: string) => {
  const fixtureId = `fixture-${Date.now()}`
  const nextAddress = useStageStore.getState().fixtures.length * 8 + 1

  let fixtureData: Partial<FixtureV2> = {
    type: fixtureType as FixtureV2['type'],
    position: { x: 0, y: 3, z: 0 },  // Default sentinel
    zone: 'unassigned',
    isPlaced: false,                   // ← GUERRILLA MODE
  }

  // Load definition from library (same as handleDrop)
  if (libraryId && window.lux?.getFixtureDefinition) {
    try {
      const result = await window.lux.getFixtureDefinition(libraryId)
      if (result.success && result.definition) {
        // ... same definition loading as handleDrop ...
        fixtureData = { ...fixtureData, /* merged definition */ }
      }
    } catch (err) { /* ... */ }
  }

  fixtureData.isPlaced = false  // Ensure guerrilla flag survives merge
  const newFixture = createDefaultFixture(fixtureId, nextAddress, fixtureData)
  addFixture(newFixture)
}, [addFixture])
```

**UI trigger:** A ⚡ button on each library asset card, or double-click on the asset in the sidebar tree.

#### 4.2.3 Batch Quick-Add

For patching 6 PARs at once:

```typescript
// StageConstructorView.tsx — ADD batch handler
const handleBatchQuickAdd = useCallback(async (libraryId: string, fixtureType: string, count: number) => {
  const baseAddress = useStageStore.getState().fixtures.length * 8 + 1
  const batchUpdates: FixtureV2[] = []

  for (let i = 0; i < count; i++) {
    const fixtureId = `fixture-${Date.now()}-${i}`
    const address = baseAddress + i * 8  // Auto-increment address
    const fixture = createDefaultFixture(fixtureId, address, {
      type: fixtureType as FixtureV2['type'],
      position: { x: 0, y: 3, z: 0 },
      zone: 'unassigned',
      isPlaced: false,
    })
    batchUpdates.push(fixture)
  }

  // Add all at once
  batchUpdates.forEach(f => addFixture(f))
}, [addFixture])
```

**UI:** "Add ×N" counter next to the Quick-Add button, or a modal prompt asking quantity.

#### 4.2.4 Aether Classic Mode Routing

When a fixture has `isPlaced: false`:

1. **IK engine:** Skipped entirely. No `Position3D` to solve against.
2. **NodeResolver:** Falls back to classic pan/tilt DMX control (XYPad, manual faders).
3. **Visualizer 3D:** Uses zone layout fallback (existing behavior, which is correct for unplaced fixtures).
4. **Visualizer 2D:** Uses zone layout fallback (existing behavior).
5. **KinRadarViewport (Trinity Router):** Routes to `XYPad` (single) or `RadarXY` (multiple) instead of `SpatialTargetPad`, because there's no spatial context.

**SpatialRegistrar integration:**

```typescript
// SpatialRegistrar.ts — ADD guard
public register(
  deviceDef: Readonly<IDeviceDefinition>,
  stagePosition: Readonly<StagePosition3D>,
  target: IAetherRegistrationTarget,
  isPlaced: boolean = true,   // ← NEW parameter
): void {
  if (!isPlaced) {
    // Guerrilla fixture: register device without spatial enrichment.
    // Nodes get no Position3D → IK solver skips them → classic mode.
    target.registerAetherDevice(deviceDef)
    return
  }
  const enriched = this._enrichWithSpatialData(deviceDef, stagePosition)
  target.registerAetherDevice(enriched)
}
```

#### 4.2.5 Visual Indicator for Unplaced Fixtures

In the 3D visualizer, unplaced fixtures should be visually distinct:
- **Translucent/ghosted** appearance (opacity 0.5)
- **"?" icon** or **dashed selection ring** instead of solid
- **No beam** rendered (beam direction is meaningless without real position)

```typescript
// In HyperionMovingHead3D and HyperionPar3D:
const isPlaced = fixture.isPlaced !== false  // Default to true for backward compat

// In JSX:
<meshStandardMaterial
  color={selected ? NEON_CYAN : '#0a0a14'}
  metalness={0.9}
  roughness={0.1}
  transparent={!isPlaced}                     // ← Ghost mode
  opacity={isPlaced ? 1.0 : 0.4}             // ← Ghost mode
/>

// Beam rendering:
{showBeam && isPlaced && (                    // ← No beam for unplaced
  <mesh ref={beamMeshRef} ...>
```

**This requires adding `isPlaced` to `Fixture3DData`:**

```typescript
// types.ts — ADD field
export interface Fixture3DData {
  // ... existing ...
  /** True if fixture was placed in 3D StageBuilder. False = guerrilla/quick-add. */
  isPlaced: boolean
}
```

---

## EXECUTION ORDER

### Phase 0: Diagnostics (0.5 days)
> *Can be done independently, before any structural changes.*

| Step | File | Action |
|---|---|---|
| 0.1 | `transientStore.ts` | Add ID mismatch diagnostic logging (§3.1.1) |
| 0.2 | `useFixture3DData.ts` | Expose stageFixture IDs for debug (§3.1.1) |
| 0.3 | **Manual test** | Verify if beam disappearance is caused by ID mismatch |

### Phase 1: Schema Evolution (1 day)
> *Data model changes. No visual impact yet. Must be done before anything else.*

| Step | File | Action |
|---|---|---|
| 1.1 | `ShowFileV2.ts` | Add `orientation` to `FixtureV2`, add `isPlaced?: boolean` to `FixtureV2` |
| 1.2 | `ShowFileV2.ts` | Remove `orientation` from `PhysicsProfile` interface |
| 1.3 | `ShowFileV2.ts` | Remove `orientation` from `DEFAULT_PHYSICS_PROFILES` |
| 1.4 | `ShowFileV2.ts` | Update `createDefaultFixture` with `orientation` param |
| 1.5 | `ShowFileMigrator.ts` | Add `migrateOrientationToRoot()` in migration pipeline |
| 1.6 | `stageStore.ts` | Add `updateFixtureOrientation` action (or use existing `updateFixture`) |
| 1.7 | **tsc --noEmit** | Fix all compile errors from PhysicsProfile.orientation removal |
| 1.8 | `StageGrid3D.tsx` | Update both `handleDrop` and `handleFixtureDrop`: remove `orientation` from physics block, add to fixture root. Set `isPlaced: true`. |
| 1.9 | `StageGrid3D.tsx` | Add auto-orientation heuristic on drop (§1.3.2) |

### Phase 2: Beam Resurrection (0.5 days)
> *Quick wins. Fixes F1 from diagnosis. Independent of spatial truth.*

| Step | File | Action |
|---|---|---|
| 2.1 | `HyperionMovingHead3D.tsx` | Increase `BEAM_RADIUS_MIN` from 0.03 to 0.08 |
| 2.2 | `HyperionMovingHead3D.tsx` | Add `clippingPlanes={[]}` to beam material |
| 2.3 | `HyperionMovingHead3D.tsx` | Add grace period to anti-zombie block (§3.2.3) |
| 2.4 | `transientStore.ts` | Add defensive fallback in `getTransientFixture` (§3.1.2) |

### Phase 3: Spatial Truth (1.5 days)
> *The big refactor. Requires Phase 1 complete.*

| Step | File | Action |
|---|---|---|
| 3.1 | `types.ts` (visualizer) | Add `orientation`, `baseRotation`, `isPlaced` to `Fixture3DData` |
| 3.2 | `useFixture3DData.ts` | Replace position calculation: read `fixture.position` with guerrilla fallback (§2.1.1) |
| 3.3 | `useFixture3DData.ts` | Populate new `Fixture3DData` fields from `FixtureV2` |
| 3.4 | `HyperionMovingHead3D.tsx` | Add `MOUNT_QUATERNIONS` lookup table (§2.3.1) |
| 3.5 | `HyperionMovingHead3D.tsx` | Apply base quaternion to root group (§2.3.2) |
| 3.6 | `HyperionMovingHead3D.tsx` | Set `TILT_REST_ANGLE = 0` (rest handled by base quat) |
| 3.7 | `HyperionMovingHead3D.tsx` | Ghost mode for unplaced fixtures (§4.2.5) |
| 3.8 | `HyperionPar3D.tsx` | Apply same base quaternion + ghost mode |
| 3.9 | `useFixtureData.ts` | Replace 2D position calculation with 3D→2D projection (§2.1.3) |
| 3.10 | `FixtureLayer.ts` | Verify beam rendering still works with projected positions |

### Phase 4: Orientation UI + Guerrilla (1 day)
> *UX improvements. Requires Phase 1 complete.*

| Step | File | Action |
|---|---|---|
| 4.1 | `StageGrid3D.tsx` | Add orientation submenu to context menu (§1.3.1) |
| 4.2 | `StageConstructorView.tsx` | Add Quick-Add handler (§4.2.2) |
| 4.3 | `StageConstructorView.tsx` | Add Batch Quick-Add handler (§4.2.3) |
| 4.4 | `FixtureLibrarySidebar` (in StageConstructorView) | Add ⚡ Quick-Add button to asset cards |
| 4.5 | `SpatialRegistrar.ts` | Add `isPlaced` guard to `register()` (§4.2.4) |
| 4.6 | Engine routing files | Verify classic mode fallback for unplaced fixtures |

### Phase 5: Engine Routing (0.5 days)
> *Ensure orientation flows correctly through the engine.*

| Step | File | Action |
|---|---|---|
| 5.1 | `SpatialRegistrar.ts` | Change `fixture.physics.orientation` → `fixture.orientation` (§1.4.1) |
| 5.2 | `NodeExtractionPipeline.ts` | Same orientation source fix if applicable |
| 5.3 | Any `IKFixtureProfile` builders | Verify `orientation.installation` reads from `FixtureV2.orientation` |
| 5.4 | `TitanOrchestrator.ts` | Verify `registerAetherDevice` passes `isPlaced` to registrar |
| 5.5 | **tsc --noEmit** | Final compile check — 0 errors |

---

## FILE MANIFEST

### Modified Files (15)

| File | Phase | Changes |
|---|---|---|
| `src/core/stage/ShowFileV2.ts` | 1 | `FixtureV2.orientation`, `FixtureV2.isPlaced`, `PhysicsProfile` cleanup, `createDefaultFixture` |
| `src/core/stage/ShowFileMigrator.ts` | 1 | `migrateOrientationToRoot()` |
| `src/stores/stageStore.ts` | 1 | Compile fixes for PhysicsProfile |
| `src/stores/transientStore.ts` | 0,2 | Diagnostic logging, defensive fallback |
| `src/components/views/StageConstructor/StageGrid3D.tsx` | 1,4 | Orientation submenu, drop handlers, auto-orient |
| `src/components/views/StageConstructorView.tsx` | 4 | Quick-Add, Batch Quick-Add |
| `src/components/hyperion/views/visualizer/types.ts` | 3 | `Fixture3DData` new fields |
| `src/components/hyperion/views/visualizer/useFixture3DData.ts` | 3 | Spatial truth position, new field population |
| `src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx` | 2,3 | Beam fixes, base quaternion, tilt sign, ghost mode |
| `src/components/hyperion/views/visualizer/fixtures/HyperionPar3D.tsx` | 3 | Base quaternion, ghost mode |
| `src/components/hyperion/views/tactical/useFixtureData.ts` | 3 | 3D→2D projection |
| `src/components/hyperion/views/tactical/layers/FixtureLayer.ts` | 3 | Verify beam compat |
| `src/core/aether/ingestion/SpatialRegistrar.ts` | 4,5 | `isPlaced` guard, orientation source fix |
| `src/core/aether/ingestion/NodeExtractionPipeline.ts` | 5 | Orientation source fix (if applicable) |
| `src/core/orchestrator/TitanOrchestrator.ts` | 5 | `isPlaced` passthrough |

### New Files (0-1)

| File | Phase | Purpose |
|---|---|---|
| `src/components/hyperion/views/visualizer/utils/mountQuaternion.ts` | 3 | (OPTIONAL) Extract `MOUNT_QUATERNIONS` + `getMountQuaternion` if file gets too large |

### Deleted Files (0)

No files deleted. `ZONE_LAYOUT_3D` and `ZONE_LAYOUT_2D` are preserved as guerrilla fallbacks.

---

## RISK ASSESSMENT

| Risk | Mitigation |
|---|---|
| **ShowFile backward compat** | `migrateOrientationToRoot()` auto-promotes. Old files load fine. |
| **PhysicsProfile breakage** | Phase 1.7 catches all compile errors. `orientation` was only read in 3-4 places. |
| **Visualizer regression** | Phase 0 diagnostics first. Phase 2 beam fixes are safe standalone patches. |
| **Guerrilla → Spatial upgrade path** | When user drags an unplaced fixture in StageGrid3D, set `isPlaced: true` + update position. Seamless upgrade. |
| **IK engine regression** | IK reads from `IKFixtureProfile`, which is built by registrar. Registrar change is a 1-line source swap. |
| **Performance (position read)** | `fixture.position` is a direct object property read. Cheaper than the current `ZONE_LAYOUT_3D[zone]` + `distributeInRange()` computation. |

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] **Beam visible** in LQ mode with zoom=0 (tight beam)
- [ ] **Beam visible** for floor fixtures (Y < 0.5m)
- [ ] **Beam holds** during first 500ms after app boot (grace period)
- [ ] **Moving head at ceiling** orientation: beam points DOWN at tilt=0.5
- [ ] **Moving head at floor** orientation: beam points UP at tilt=0.5
- [ ] **3D position matches** StageBuilder placement (drag fixture to (3, 4, -2) → 3D shows it there)
- [ ] **2D position matches** 3D position (top-down projection)
- [ ] **SpatialTargetPad beam** converges to target point from correct fixture positions
- [ ] **Quick-Add fixture** appears in 3D at zone-layout position (ghost appearance)
- [ ] **Quick-Add fixture** controllable via XYPad/RadarXY (classic mode, not IK)
- [ ] **Old show files** load without error (migration promotes orientation)
- [ ] **tsc --noEmit: 0 errors**
- [ ] **No GC pressure increase** from new useMemo dependencies

---

*End of Blueprint — WAVE 4573*
*Zero code modified. Implementation-ready specification.*
