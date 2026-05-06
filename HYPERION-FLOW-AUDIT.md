# HYPERION-FLOW-AUDIT.md
## WAVE 4575 — The Hyperion Data-Trace & Rulers
**Auditor:** Cascade (Kimi) — Dirección de Arquitectura
**Date:** 2026-05-06
**Scope:** ShowFileV2 → Hyperion Visualizer (2D/3D) data pipeline, scale/ruler infrastructure, and IK duality gates.

---

## EXECUTIVE SUMMARY

| Category | Status | Severity |
|---|---|---|
| Data trace `orientation` | **PASS** | — |
| Data trace `isPlaced` | **PARTIAL** | 🔶 |
| 3D overflow / hardcoded stage | **FAIL** | 🔴 |
| 2D tactical scale | **PASS** | — |
| Rulers / metrics UI | **MISSING** | 🔴 |
| IK duality gate (Aether path) | **FAIL** | 🔴 |
| IK duality gate (SpatialRegistrar path) | **PASS** | — |

---

## 1. MISSION 1: DATA TRACE (The JSON Journey)

### 1.1 Source of Truth — ShowFileV2.ts

```typescript
export interface FixtureV2 {
  position: Position3D
  rotation: Rotation3D
  orientation: InstallationOrientation      // 🏗️ WAVE 4573 — root-level
  isPlaced?: boolean                          // 🏗️ WAVE 4573 — root-level
  physics: PhysicsProfile                    // orientation REMOVED from here
  // ...
}
```

**Status:** Schema correctly decoupled. `orientation` lives at root; `PhysicsProfile.orientation` is deprecated (`optional`).

### 1.2 Migration Path — ShowFileMigrator.ts

| Version | Patch | Action |
|---|---|---|
| `2.1.0` → `2.2.0` | WAVE 4573 | Promotes `physics.orientation` → `fixture.orientation` + infers `isPlaced` from sentinel `{0, 3, 0}` |

**Auto-migrate gate:** `autoMigrate()` now accepts any `2.x.x` (was hardcoded to `2.0.0` only). **Fixed in WAVE 4573.**

### 1.3 stageStore.ts — The Altar

- `loadShowFile()` → `autoMigrate()` → patches applied → fixtures stored in `state.fixtures`
- `state.stage` holds `StageDimensions { width, depth, height, gridSize }`
- `state.visuals` holds `StageVisuals { showGrid }`

**Status:** ✅ `isPlaced` and `orientation` survive the load gate.

### 1.4 Bridge — TitanSyncBridge.tsx

Maps `stageStore.fixtures[]` → `IArbiterFixture[]` for TitanOrchestrator:

```typescript
// Line 117
installationType: (f as any).orientation || f.physics?.orientation || 'ceiling'
```

**Status:** ✅ Reads root `orientation` first, falls back to deprecated `physics.orientation`.

### 1.5 Orchestrator — TitanOrchestrator.ts

- `setFixtures()` receives `IArbiterFixture[]` including `position` and `installationType`
- Line 2547: `const installOrientation = fixture.orientation || fixture.installationType || 'ceiling'`
- Passes orientation to HAL `registerMover()`

**Status:** ✅ Orientation flows through. `isPlaced` is **NOT inspected** here — **see §4.**

### 1.6 Transient Store — transientStore.ts

- `injectTransientTruth()` rebuilds `fixtureIndex` from `truth.hardware.fixtures[]`
- WAVE 4573 Phase 0 diagnostic block logs ID mismatches between stageStore and truth
- **Key fact:** `fixtureIndex` entries contain `position` from Aether nodes but NO `isPlaced` or `orientation` flags. These are structural properties, not DMX runtime properties.

### 1.7 Hook — useFixture3DData.ts (3D Visualizer)

**CRITICAL FINDING — Position calculation IGNORES `isPlaced`:**

```typescript
// Lines 150-175 (current code)
for (const [zone, zoneFixtures] of fixturesByZone) {
  const layout = ZONE_LAYOUT_3D[zone]
  zoneFixtures.forEach((fixture, index) => {
    let x, y, z
    if (layout.vertical && layout.fixedX !== undefined) {
      x = layout.fixedX * halfWidth
      y = distributeInRange(index, total, trussHeight * 0.5, trussHeight * 0.9)
      z = layout.depthFactor * halfDepth
    } else {
      x = distributeInRange(index, total, layout.xRange[0] * halfWidth, ...)
      y = layout.heightFactor * trussHeight
      z = layout.depthFactor * halfDepth
    }
    // ... pushes Fixture3DData with zone-layout positions for ALL fixtures
  })
}
```

**Problem:** Even when `fixture.isPlaced === true` and `fixture.position` contains real meters, the hook discards it and computes fictional zone layout positions.

The `isPlaced` flag IS propagated into `Fixture3DData.isPlaced` (line 245), but the **position is already wrong** by then. `HyperionMovingHead3D` receives `fixture.x/y/z` from zone layout, not from `fixture.position`.

**Fix needed (WAVE 4575-F1):**
```typescript
if (fixture.isPlaced && fixture.position) {
  x = fixture.position.x
  y = fixture.position.y
  z = fixture.position.z
} else {
  // fallback to zone layout
}
```

### 1.8 Hook — useFixtureData.ts (2D Tactical)

**Status:** ✅ CORRECTLY handles `isPlaced`:

```typescript
// Lines 231-243
if (stageFixture?.isPlaced === true && stageFixture.position) {
  const stageW = stageDimensions?.width ?? 12
  const stageD = stageDimensions?.depth ?? 8
  const rawX = stageFixture.position.x / stageW
  const rawY = -stageFixture.position.z / stageD
  fixture.x = Math.max(-(0.5 - MARGIN), Math.min(0.5 - MARGIN, rawX))
  fixture.y = Math.max(-(0.5 - MARGIN), Math.min(0.5 - MARGIN, rawY))
  return
}
// else → zone layout fallback
```

**Divergence:** 2D tactical reads real Position3D when placed. 3D visualizer does NOT. This is the **primary spatial blindness bug** in Hyperion 3D.

---

## 2. MISSION 2: OVERFLOW & SCALE AUDIT

### 2.1 VisualizerCanvas.tsx (3D)

**Hardcoded stage dimensions — NO connection to show file:**

```typescript
// Lines 45-48
const STAGE_WIDTH = 12
const STAGE_DEPTH = 8
const TRUSS_HEIGHT = 5

// Lines 268-279
<NeonFloor width={STAGE_WIDTH} depth={STAGE_DEPTH} ... />
<HyperionTruss width={STAGE_WIDTH} depth={STAGE_DEPTH} height={TRUSS_HEIGHT} ... />
```

**Camera defaults are also hardcoded:**
```typescript
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 4, 10]
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 2, 0]
```

**Finding:** If `showFile.stage.width = 20` (large venue), the visualizer still draws a 12×8m floor. Fixtures placed at X=9m will **visually overflow** the floor grid. The camera is also fixed at Z=10, making a 20m stage impossible to see in full.

**Fix needed (WAVE 4575-F2):**
1. `HyperionView.tsx` must read `selectStageDimensions` from stageStore
2. Pass `stageConfig={{ width, depth, trussHeight }}` to `VisualizerCanvas`
3. `VisualizerCanvas` must forward `stageConfig` to `useFixture3DData()`
4. Compute camera distance from stage diagonal: `max(width, depth) * 0.8`

### 2.2 useFixture3DData.ts — Scale Fallacy

The hook accepts `options.stageConfig` but `VisualizerCanvas` never passes it. Result: all position calculations fall back to:

```typescript
const STAGE_HALF_WIDTH = 6    // hardcoded
const STAGE_HALF_DEPTH = 4    // hardcoded
const TRUSS_HEIGHT = 5        // hardcoded
```

When real positions are eventually read (after fix F1), the normalization will be wrong unless `stageConfig` is wired.

### 2.3 TacticalCanvas (2D)

- `useFixtureData.ts` reads `stageDimensions` from stageStore (line 109)
- Positions are projected using `stageDimensions?.width ?? 12` and `stageDimensions?.depth ?? 8`
- **Status:** ✅ Respects show file dimensions. Overflow only occurs if dimensions are missing (fallback to 12×8).

### 2.4 SpatialTargetPad.tsx

- Receives `stage: StageDimensions` as prop
- Defaults: `width: 12, depth: 10, height: 6`
- Grid lines drawn at `stage.gridSize || 1`
- **Status:** ✅ Correctly uses dynamic dimensions.

---

## 3. MISSION 3: RULERS & METRICS (The Missing Infrastructure)

### 3.1 Does ShowFileV2 Contain Dimensions?

**YES.** `ShowFileV2` has `stage: StageDimensions`:
```typescript
export interface StageDimensions {
  width: number    // meters
  depth: number    // meters
  height: number   // meters (truss/ceiling)
  gridSize: number  // snap grid in meters
}
```

Default in `createEmptyShowFile()`:
```typescript
stage: { width: 12, depth: 8, height: 6, gridSize: 0.25 }
```

### 3.2 Is There a StageRuler Entity?

**NO.** No `StageRuler` class, component, or type exists. Search across `src/` yields zero matches for "ruler" or "measurement lines" in the visualizer.

### 3.3 What Grid Exists?

| Component | Grid Source | User-visible metrics? |
|---|---|---|
| `NeonFloor.tsx` | Hardcoded `width=12, depth=8` | No labels |
| `SpatialTargetPad.tsx` | `stage.gridSize` from props | No labels |
| `StageGrid3D.tsx` (constructor) | `stage.gridSize` from store | No labels |

**Finding:** The grid is purely decorative. There are no **ruler labels** (e.g., "0m", "6m", "12m"), no **axis indicators**, and no **fixture coordinate readout** in the 3D visualizer.

### 3.4 Recommended Ruler Injection Points

1. **NeonFloor.tsx**: Add `<Text>` labels at every 2m interval on the floor edges (drei Text component).
2. **VisualizerCanvas.tsx**: Add a HUD overlay showing:
   - Stage dimensions (width × depth × height)
   - Selected fixture position (X, Y, Z in meters)
   - Camera distance / angle
3. **StageGrid3D.tsx** (constructor): Already has a grid; add axis labels.

**No code changes needed for data — the JSON already holds everything.**

---

## 4. MISSION 4: DUALITY — Aether vs Legacy IK Gate

### 4.1 SpatialRegistrar Path (UI / StageGrid3D)

```typescript
// SpatialRegistrar.ts Lines 225-238
public register(deviceDef, stagePosition, target, isPlaced?): void {
  // 🚨 WAVE 4573 Phase 5a: GUERRILLA BYPASS
  if (isPlaced === false) {
    target.registerAetherDevice(deviceDef)  // Classic mode, no IK enrichment
    return
  }
  const enriched = this._enrichWithSpatialData(deviceDef, stagePosition)
  target.registerAetherDevice(enriched)      // IK-ready enriched nodes
}
```

**Status:** ✅ When `isPlaced === false`, spatial enrichment is SKIPPED. Fixture enters Aether in Classic Pan/Tilt mode.

### 4.2 NodeExtractionPipeline Path

```typescript
// NodeExtractionPipeline.ts Lines 276-281
resolvedOrientation = fv2.orientation
resolvedIsPlaced    = fv2.isPlaced

// Lines 315-316
...(resolvedOrientation !== undefined && { orientation: resolvedOrientation }),
...(resolvedIsPlaced    !== undefined && { isPlaced: resolvedIsPlaced }),
```

**Status:** ✅ `isPlaced` and `orientation` are correctly extracted from `FixtureV2` and embedded into `IDeviceDefinition`.

### 4.3 TitanOrchestrator Bulk Path — THE GAP

**CRITICAL FINDING:** `TitanOrchestrator.setFixtures()` processes ALL fixtures from `TitanSyncBridge` without checking `isPlaced`.

Flow:
```
stageStore.fixtures[]
  → TitanSyncBridge (maps to IArbiterFixture[])
    → TitanOrchestrator.setFixtures()
      → registerAetherDevice(definition)  // NO isPlaced guard here
        → NodeResolver.registerDevice()
          → Spatial enrichment ALWAYS happens for fixtures with position
```

Unlike the `SpatialRegistrar.register()` path (which has the `isPlaced` guard), the bulk `setFixtures()` path does NOT gate on `isPlaced`. A fixture with `isPlaced: false` but a non-sentinel `position` (e.g., from a previous placement then downgraded) would still get spatial enrichment and enter the IK engine.

**Fix needed (WAVE 4575-F4):**
In `TitanOrchestrator.setFixtures()`, before calling `registerAetherDevice()`:
```typescript
if (fixture.isPlaced === false) {
  // Skip spatial enrichment: register raw definition
  this.registerAetherDevice(rawDefinition)
} else {
  // Full spatial enrichment path
  this.registerAetherDevice(enrichedDefinition)
}
```

### 4.4 ArbitrationDirector — IK Build Profile

```typescript
// ArbitrationDirector.ts Line 377
(fixture as any).installationOrientation ?? 'ceiling'
```

**Status:** ✅ Reads `installationOrientation` from the fixture object. If the bulk path correctly propagates `orientation` → `installationOrientation`, this works. But it has NO `isPlaced` guard either.

### 4.5 HyperionMovingHead3D — Visual Ghost Mode

```typescript
// Lines 189-191
const isPlaced = fixture.isPlaced !== false
const ghostOpacity = isPlaced ? 1.0 : 0.4

// Line 403
{showBeam && (fixture.isPlaced !== false) && (
  <mesh ref={beamMeshRef} ...>
```

**Status:** ✅ Visualizer correctly dims unplaced fixtures and suppresses beam rendering. This is purely visual safety.

---

## 5. COLLISION MAP (Data Flow Diagram)

```
┌─────────────────┐
│   ShowFileV2    │
│  (JSON on disk) │
└────────┬────────┘
         │ loadShowFile()
         ▼
┌─────────────────┐     ┌──────────────────────┐
│   stageStore    │────▶│  selectStageDimensions│──► StageGrid3D (constructor)
│  (Zustand)      │     └──────────────────────┘
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│useFixture│ │useFixture3DData│
│Data.ts   │ │   .ts        │
│(2D)      │ │  (3D)        │
└────┬───┘ └──────┬───────┘
     │            │
     ▼            ▼
┌────────┐ ┌──────────────┐
│Tactical│ │ VisualizerCanvas│
│Canvas  │ │   (3D R3F)     │
└────────┘ └───────────────┘
         │
         │  stageStore.fixtures[]
         ▼
┌─────────────────┐
│ TitanSyncBridge │
│  (maps to       │
│ IArbiterFixture)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│TitanOrchestrator│
│  setFixtures()  │────┐
└────────┬────────┘    │
         │             │
    ┌────┴────┐        │
    ▼         ▼        │
┌────────┐ ┌────────┐  │
│Spatial │ │  Bulk  │  │
│Registrar│ │register│  │
│(UI path)│ │(setFix)│  │
└────┬───┘ └────┬───┘  │
     │          │      │
     ▼          ▼      │
┌─────────────────────┴──┐
│    NodeResolver /      │
│    Aether NodeGraph      │
│                          │
│  isPlaced=false →       │
│  Classic Pan/Tilt       │
│                          │
│  isPlaced=true  →       │
│  IK Spatial Enrichment  │
└─────────────────────────┘
         │
         ▼
┌─────────────────┐
│  transientStore │
│  (fixtureIndex) │
└────────┬────────┘
         │ getTransientFixture(id)
         ▼
┌─────────────────┐
│HyperionMovingHead3D│
│  (useFrame 60fps) │
└─────────────────┘
```

### Collision Points (where data may collide/overwrite)

| Point | Collision | Risk |
|---|---|---|
| **A** | `useFixture3DData` position vs `FixtureV2.position` | 3D shows zone layout, not real position |
| **B** | `VisualizerCanvas` hardcoded 12×8 vs `showFile.stage` | Floor/truss don't match show dimensions |
| **C** | `TitanOrchestrator.setFixtures` ignores `isPlaced` | Guerrilla fixtures may enter IK engine |
| **D** | `useFixtureData` (2D) vs `useFixture3DData` (3D) | 2D respects `isPlaced`, 3D does NOT |

---

## 6. FIX RECOMMENDATIONS (Prioritized)

### 🔴 P0 — 3D Spatial Blindness
**File:** `src/components/hyperion/views/visualizer/useFixture3DData.ts`
**Action:** Read `fixture.position` when `isPlaced === true`. Fall back to zone layout only when unplaced.

```typescript
// Inside zoneFixtures.forEach loop, BEFORE the layout switch:
if (fixture.isPlaced && fixture.position) {
  x = fixture.position.x
  y = fixture.position.y
  z = fixture.position.z
} else if (layout.vertical && layout.fixedX !== undefined) {
  // ... existing zone layout
}
```

### 🔴 P0 — Stage Dimension Wiring
**Files:**
- `src/components/hyperion/views/HyperionView.tsx`
- `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`
- `src/components/hyperion/views/visualizer/useFixture3DData.ts`

**Action:**
1. `HyperionView.tsx`: `const stage = useStageStore(selectStageDimensions)`
2. Pass `stageConfig={stage}` to `VisualizerCanvas`
3. `VisualizerCanvas`: forward to `useFixture3DData({ stageConfig })`
4. `VisualizerCanvas`: use `stageConfig.width/depth` for `NeonFloor` and `HyperionTruss`
5. Compute camera distance from stage diagonal

### 🔴 P0 — IK Duality Gap
**File:** `src/core/orchestrator/TitanOrchestrator.ts`
**Action:** In `setFixtures()`, skip spatial enrichment for `isPlaced === false` fixtures. Register them as Classic mode devices.

### 🟡 P1 — Ruler / Metrics HUD
**File:** `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`
**Action:** Add overlay HUD component showing:
- Stage dimensions badge
- Selected fixture coordinates (X, Y, Z)
- Grid labels on NeonFloor (every 2m)

### 🟡 P1 — Tactical Canvas StageConfig
**File:** `src/components/hyperion/views/HyperionView.tsx`
**Action:** Pass `stageDimensions` to `TacticalCanvas` so it can scale its internal coordinate system to match the show file (currently it may also use defaults).

---

## 7. VERIFICATION CHECKLIST (Post-Fix)

- [ ] 3D fixture at Position3D(3, 4, -2) appears at (3, 4, -2) in VisualizerCanvas
- [ ] Same fixture appears at correct 2D projected position in TacticalCanvas
- [ ] Changing `showFile.stage.width` to 20m expands NeonFloor to 20m
- [ ] Camera pulls back to see full 20m stage
- [ ] `isPlaced=false` fixture renders as ghost (opacity 0.4) with no beam
- [ ] `isPlaced=false` fixture with position data does NOT get IK-enriched in NodeGraph
- [ ] `isPlaced=true` fixture DOES get IK-enriched and SpatialTargetPad can target it
- [ ] Ruler labels visible on floor grid (0m, 2m, 4m...)
- [ ] Selected fixture HUD shows real-time X/Y/Z coordinates

---

*End of audit. All findings derived from source code inspection. No runtime instrumentation required.*
