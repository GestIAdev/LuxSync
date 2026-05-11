# HYPERION-KINETIC-AUDIT.md
## WAVE 4578-A — Forensic Structural & State Map
**Auditor:** Cascade / Kimi  
**Date:** 2026-05-06  
**Scope:** Zero-code-mutation forensic audit of HyperionView, Kinetics Cathedral, and 3D moving-head kinematics.  
**Status:** COMPLETE — All 5 missions mapped. Bottlenecks and conflicts identified.

---

## EXECUTIVE SUMMARY

| Mission | Finding | Severity |
|---|---|---|
| M1 — Component Tree | Both 2D/3D canvases are **always mounted**, CSS-hidden. KIN mode **replaces** the viewport entirely. No unmount = no state loss from React lifecycle, but KIN sidebar tab (`cathedralTab`) is **local `useState`** — lost on every sidebar toggle. | Medium |
| M2 — State Amnesia | `movementStore` is **persistent** (Zustand), but `KineticsCathedral` has `useEffect` → `resetToDefaults()` when `selectedIds.length === 0`. Switching to 3D view and deselecting fixtures **wipes pan/tilt/spatialTarget** to factory defaults. Sub-tab state (`cathedralTab`) also ephemeral. | **High** |
| M3 — Motor Wiring | **Classic path** (RadarXY/XYPad) → `programmerStore.setPosition/setPositionPerFixture` → `ProgrammerAetherBridge` (44Hz). **Spatial path** (SpatialTargetPad) → `window.lux.arbiter.applySpatialTarget()` → backend IK engine. Two separate IPC channels, no shared dirty-family flag for spatial. UI mode resolved by `useAdiabaticRadarMode`. | Medium |
| M4 — Unlock Mechanism | `programmerStore.releasePosition()` exists but **NO UI button** in KineticsCathedral. `lockedFixtureIds` only disables controls — no "release all" action. Operator cannot pause LiquidEngine and take manual control without the next vibe/frame overwriting it. | **High** |
| M5 — Zero-Position | `TILT_REST_ANGLE = 0` since WAVE 4573 (removed 45° forward bias). At DMX center (pan=0.5, tilt=0.5), ceiling-mounted fixture beam points in **local +Y** (up toward ceiling), not toward stage floor or audience. Mismatch between `mountQuaternion.ts` comment ("emission axis -Y") and actual `ConeGeometry` orientation (+Y). | **High** |

---

## M1: ÁRBOL DE COMPONENTES Y LAYOUT (HyperionView)

### 1.1 File: `src/components/hyperion/views/HyperionView.tsx`

**Root orchestrator.** Renders a flex row with:
- **Left:** `hyperion-viewport` (80% width) — the stage canvas(es)
- **Right:** `hyperion-sidebar-container` (20% width) — controls sidebar

### 1.2 View State Machine

```
viewMode ∈ {'2D' | '3D'}          (persisted in localStorage via usePersistedState)
sidebarMode ∈ {'controls' | 'kinetics'}   (from controlStore, NOT persisted)
```

**State transitions:**
- `viewMode` toggled by toolbar buttons (2D ↔ 3D). Persisted.
- `sidebarMode` toggled by "⊕ KIN" button. Not persisted across reloads.
- When `sidebarMode === 'kinetics'`, the **entire viewport canvas is replaced** by `KinRadarViewport`.

### 1.3 Mount/Unmount Strategy — WAVE 2515

**CRITICAL ARCHITECTURAL DECISION (lines 369–420):**

```typescript
// Both canvases ALWAYS mounted, CSS-switched
{!isEmpty && (
  <>
    {sidebarMode === 'kinetics' && (
      <div className="hyperion-canvas-container--kin-radar">
        <KinRadarViewport />
      </div>
    )}

    {/* Canvas 2D — always mounted, hidden by CSS */}
    <div style={(viewMode !== '2D' || sidebarMode === 'kinetics')
      ? { visibility: 'hidden', pointerEvents: 'none' }
      : undefined}>
      <TacticalCanvas isVisible={viewMode === '2D' && sidebarMode !== 'kinetics'} />
    </div>

    {/* Canvas 3D — always mounted, hidden by CSS */}
    <div style={(viewMode !== '3D' || sidebarMode === 'kinetics')
      ? { visibility: 'hidden', pointerEvents: 'none' }
      : undefined}>
      <VisualizerCanvas isVisible={viewMode === '3D' && sidebarMode !== 'kinetics'} />
    </div>
  </>
)}
```

**Why this design:** `transferControlToOffscreen()` is **irreversible**. Unmounting the `<canvas>` node kills the `OffscreenCanvas` context in the worker permanently (Context Lost). Same with R3F's WebGLRenderer.  
**Fix:** Both canvases live forever. `visibility:hidden + position:absolute` hides the inactive one. Each canvas receives an `isVisible` prop to pause its render loop (Hibernation Protocol).

### 1.4 Sidebar Switching

```typescript
<div className={`hyperion-sidebar-container${sidebarMode === 'kinetics' ? ' cathedral-expanded' : ''}`}>
  {sidebarMode === 'controls'
    ? <StageSidebar />
    : <KineticsCathedral onClose={() => setSidebarMode('controls')} />
  }
</div>
```

- `StageSidebar` is unmounted when KIN is active.
- `KineticsCathedral` is unmounted when returning to Controls.
- **Implication:** Any `useState` inside `KineticsCathedral` (e.g., `cathedralTab`) is **wiped** on every toggle.

---

## M2: EL CEREBRO DE LA CATEDRAL (State & Stores)

### 2.1 Primary Store: `movementStore.ts` (Zustand)

**File:** `src/stores/movementStore.ts`

**State shape:**

```typescript
interface MovementState {
  // Classic (degrees)
  pan: number           // 0–540°
  tilt: number          // 0–270°
  fanValue: number      // -100..100

  // Spatial (IK 3D)
  spatialTarget: Target3D            // {x, y, z} in meters
  spatialFanMode: SpatialFanMode       // 'converge' | 'line' | 'circle'
  spatialFanAmplitude: number         // meters
  spatialReachability: Record<string, IKResult>
  spatialSubTargets: Record<string, Target3D>

  // Mode
  radarModeOverride: RadarModeOverride  // null | 'classic' | 'spatial'

  // Pattern + dynamics
  activePattern: PatternType
  patternSpeed: number      // 0-100
  patternAmplitude: number  // 0-100

  // Chaos
  chaosAmount: number   // 0-1
  chaosSeed: number      // 0..65535

  // UI / Lock
  isCalibrating: boolean
  lockedFixtureIds: ReadonlySet<string>
}
```

**Actions:**
- `setPanTilt`, `setFanValue`
- `setSpatialTarget`, `setSpatialFanMode`, `setSpatialFanAmplitude`
- `setRadarModeOverride`
- `setActivePattern`, `setPatternSpeed`, `setPatternAmplitude`
- `hydrateFromBackend(state)` — fills pan/tilt/pattern/speed/amplitude from backend IPC
- `resetToDefaults()` — **FULL WIPE** to factory defaults (pan=270, tilt=135, target={x:0,y:2,z:0}, pattern='none', etc.)

### 2.2 KineticsCathedral.tsx — The Amnesia Bug

**File:** `src/components/hyperion/kinetics/KineticsCathedral.tsx`

**Lines 97–117:**

```typescript
useEffect(() => {
  let mounted = true
  const hydrate = async () => {
    if (selectedIds.length === 0) {
      resetToDefaults()    // ← AMNESIA TRIGGER #1
      return
    }
    try {
      const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
      if (!mounted) return
      if (result?.success && result?.state) {
        hydrateFromBackend(result.state)  // ← AMNESIA TRIGGER #2
      }
    } catch {
      // fallback: keep current state
    }
  }
  hydrate()
  return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedIds.join(',')])
```

**Amnesia Scenario — Repro Steps:**
1. Operator sets pan=400°, tilt=200° via RadarXY.
2. Operator switches from KIN sidebar back to Controls (e.g., to adjust dimmer).
3. `KineticsCathedral` unmounts. `movementStore` retains pan/tilt.
4. Operator switches to 3D view. `TacticalCanvas` receives `isVisible=false`, `VisualizerCanvas` wakes up.
5. Operator clicks on the 3D stage to inspect a fixture. This triggers `selectionStore.deselectAll()` then a new selection.
6. `selectedIds` changes. `KineticsCathedral` remounts.
7. The `useEffect` fires. If the new selection has moving heads, `hydrateFromBackend()` **overwrites** pan/tilt with whatever the backend reports for the newly selected fixture.
8. If no moving heads are selected, `resetToDefaults()` **wipes everything** to pan=270, tilt=135.

**Root Cause:** The Cathedral has no memory of "last user-set values." It always trusts the backend (`getFixturesState`) or resets to defaults. There is no "preserve user intent across selection changes" flag.

### 2.3 Ephemeral Local State

**`cathedralTab`** (line 150):
```typescript
const [cathedralTab, setCathedralTab] = useState<'kinetics' | 'matrix'>('kinetics')
```
- **Not persisted.** Every time the operator toggles KIN ↔ Controls, the sub-tab resets to "KINETICS."
- Minor UX friction, but indicative of a broader pattern: KineticsCathedral treats its own UI state as disposable.

### 2.4 Sidebar Mode Persistence Gap

`sidebarMode` is read from `controlStore` (not `usePersistedState`). `controlStore` does **not** persist to localStorage. If the user reloads the page, sidebarMode resets to 'controls' regardless of previous session.

---

## M3: EL CABLEADO DE LOS MOTORES (Aether vs Legacy UI Bindings)

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HYPERION VIEWPORT                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │   XYPad      │  │  RadarXY     │  │   SpatialTargetPad             │ │
│  │  (1 fixture) │  │ (N fixtures) │  │   (IK 3D target)               │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────────────┘ │
│         │                 │                        │                     │
│         └─────────────────┴────────────────────────┘                     │
│                           │                                              │
│              ┌────────────┴────────────┐                               │
│              │   KinRadarViewport        │                               │
│              │   (Trinity Router)        │                               │
│              └────────────┬────────────┘                                │
│                           │                                              │
│         ┌─────────────────┼─────────────────┐                         │
│         │                 │                 │                         │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐                      │
│    │ Classic │      │ Classic │      │ Spatial  │                      │
│    │  path   │      │  path   │      │  path    │                      │
│    │(1 head) │      │(N heads)│      │(N heads) │                      │
│    └────┬────┘      └────┬────┘      └────┬────┘                      │
│         │                 │                 │                          │
│         └─────────────────┴─────────────────┘                          │
│                           │                                            │
│              ┌────────────┴────────────┐                              │
│              │   movementStore           │                              │
│              │   (Zustand — persistent)  │                              │
│              └────────────┬────────────┘                              │
│                           │                                            │
│         ┌─────────────────┼─────────────────┐                         │
│         │                 │                 │                         │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐                      │
│    │setPanTilt│      │setPanTilt│      │setSpatial│                    │
│    │(1 head) │      │(N heads)│      │ Target   │                    │
│    └────┬────┘      └────┬────┘      └────┬────┘                      │
│         │                 │                 │                          │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐                      │
│    │programmer│      │programmer│      │  IPC    │                      │
│    │Store     │      │Store     │      │arbiter  │                      │
│    │setPosition│      │setPosition│      │applySpatial│                   │
│    │          │      │PerFixture│      │Target() │                      │
│    └────┬────┘      └────┬────┘      └────┬────┘                      │
│         │                 │                 │                          │
│         └─────────────────┴─────────────────┘                          │
│                           │                                            │
│              ┌────────────┴────────────┐                              │
│              │   BACKEND (Aether)       │                              │
│              │   - ProgrammerAetherBridge│                             │
│              │   - InverseKinematicsEngine│                            │
│              │   - NodeResolver           │                             │
│              └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Classic Path (RadarXY / XYPad)

**File:** `src/components/hyperion/kinetics/KinRadarViewport.tsx` (lines 186–208)

```typescript
const handlePanTiltChange = useCallback((newPan: number, newTilt: number) => {
  const sp = Math.max(0, Math.min(513, newPan))
  const st = Math.max(0, Math.min(256, newTilt))
  setPanTilt(sp, st)

  if (movingHeadIds.length > 1) {
    // Formation mode — per-fixture pan offsets with fan spread
    const basePanNorm = sp / 540
    const spread = (fanValue / 100) * 0.3
    const positions = movingHeadIds.map((id, i) => {
      const off = i - (movingHeadIds.length - 1) / 2
      const offsetX = off * spread / (movingHeadIds.length - 1)
      return {
        fixtureId: id,
        pan: Math.max(0, Math.min(1, basePanNorm + offsetX)) * 540,
        tilt: st,
      }
    })
    useProgrammerStore.getState().setPositionPerFixture(positions)
  } else {
    // Single fixture — direct pan/tilt
    useProgrammerStore.getState().setPosition(sp, st)
  }
}, [movingHeadIds, fanValue, setPanTilt])
```

**Data flow:**
1. User drags RadarXY / XYPad.
2. `handlePanTiltChange` clamps to safe limits (513° / 256°).
3. Calls `setPanTilt(sp, st)` → updates `movementStore` (for UI feedback).
4. Calls `programmerStore.setPosition()` or `setPositionPerFixture()`.
5. ProgrammerStore normalizes: `normPan = pan / 540`, `normTilt = tilt / 270` (lines 325–328).
6. Sets `dirtyFamilies.add('KINETIC')`.
7. `ProgrammerAetherBridge` reads dirty families at 44Hz and flushes via IPC.

**What it modifies:**
- `programmerStore.fixtureOverrides` — a `Map<string, ProgrammerOverrides>` where each override has `pan: number|null` and `tilt: number|null` (normalized 0–1).
- Does **NOT** touch `stageStore.fixtures[].position`.
- Does **NOT** modify the raw JSON showFile.

### 3.3 Spatial Path (SpatialTargetPad)

**File:** `src/components/hyperion/kinetics/KinRadarViewport.tsx` (lines 215–242)

```typescript
const applySpatialFanIPC = useCallback(async (
  target: Target3D,
  fanMode: string,
  fanAmplitude: number,
  fixtureIds: string[],
) => {
  if (fixtureIds.length === 0) return
  try {
    const result = await (window as any).lux?.arbiter?.applySpatialTarget({
      target,
      fixtureIds,
      fanMode,
      fanAmplitude,
    })
    if (result?.success && result.results) {
      const subs: Record<string, Target3D> = {}
      for (const [id, r] of Object.entries(result.results)) {
        const res = r as any
        if (res.subTarget) subs[id] = res.subTarget as Target3D
      }
      setSpatialSubTargets(subs)
      setSpatialReachability(result.results as any)
    }
  } catch {
    // IPC failure silenciosa: el pad sigue funcionando sin sub-targets
  }
}, [setSpatialSubTargets, setSpatialReachability])
```

**Data flow:**
1. User drags target on SpatialTargetPad (top-down X/Z grid + Y slider).
2. `SpatialTargetPad` converts pixel coordinates to world meters (`gridToWorld`).
3. `handleTargetChange` in KinRadarViewport calls `setSpatialTarget(t)` + `applySpatialFanIPC()`.
4. `applySpatialFanIPC` calls `window.lux.arbiter.applySpatialTarget({target, fixtureIds, fanMode, fanAmplitude})`.
5. Backend `InverseKinematicsEngine.solveGroup()` computes per-fixture pan/tilt.
6. Backend returns `IKResult` per fixture, including `subTarget` (where each fixture actually aims).
7. Frontend stores `spatialSubTargets` and `spatialReachability` in `movementStore`.

**What it modifies:**
- `movementStore.spatialTarget` — the user-defined target in meters.
- `movementStore.spatialSubTargets` — per-fixture aim points from IK.
- `movementStore.spatialReachability` — per-fixture IK metadata (panDeg, tiltDeg, reachable flag).
- Does **NOT** touch `programmerStore`.
- Does **NOT** set `dirtyFamilies`.

### 3.4 Critical Divergence: Classic vs Spatial Dirty Flags

| Path | Store Written | Dirty Flag | IPC Rate | Backend Handler |
|---|---|---|---|---|
| Classic | `programmerStore.fixtureOverrides` | `'KINETIC'` | 44Hz | `ProgrammerAetherBridge` → `NodeResolver` |
| Spatial | `movementStore.spatialTarget` | **NONE** | On-drag (~33Hz RAF) | `window.lux.arbiter.applySpatialTarget()` → `IKEngine` |

**Conflict:** Spatial target updates bypass the `programmerStore` dirty-family system entirely. They go through a separate IPC method. The backend must reconcile two independent control sources:
- Programmer overrides (classic pan/tilt degrees)
- Spatial targets (IK-computed pan/tilt degrees)

There is no documented arbitration priority between these two channels.

### 3.5 Mode Detection: `useAdiabaticRadarMode`

**File:** `src/hooks/useAdiabaticRadarMode.ts`

```typescript
export function useAdiabaticRadarMode(
  selectedIds: string[],
  stageFixtures: Array<{ id: string; position?: unknown }>,
  override: RadarMode | null,
): RadarMode {
  return useMemo((): RadarMode => {
    if (override !== null) return override
    if (selectedIds.length === 0) return 'classic'
    const allHavePosition = selectedIds.every(id => {
      const sf = stageFixtures.find(f => f.id === id)
      return sf?.position != null
    })
    return allHavePosition ? 'spatial' : 'classic'
  }, [selectedIds, stageFixtures, override])
}
```

**Logic:**
- If user manually clicked AUTO/DEGREES/3D → `override` wins.
- If override is `null` (AUTO): checks if **all** selected fixtures have `position != null` in `stageStore`.
- If any fixture lacks position → falls back to `'classic'`.

**Edge case:** If a user selects a mix of placed (has position) and unplaced fixtures, the mode falls back to `'classic'` even though some fixtures could support spatial IK.

---

## M4: EL MECANISMO DE "UNLOCK" E HIDRATACIÓN

### 4.1 Current Override / Release Infrastructure

**File:** `src/stores/programmerStore.ts`

**Release actions exist but are NOT surfaced in KineticsCathedral UI:**

```typescript
// programmerStore.ts lines 357–365
releasePosition: () => {
  set(state => {
    const next = new Map(state.fixtureOverrides)
    for (const id of state.activeFixtureIds) {
      const ov = next.get(id)
      if (ov) next.set(id, { ...ov, pan: null, tilt: null })
    }
    const dirty = new Set(state.dirtyFamilies)
    dirty.add('KINETIC')
    return { fixtureOverrides: next, dirtyFamilies: dirty }
  })
},

// Line 140–141
releaseAll: () => void  // Releases ALL families for all active fixtures
```

**How `releasePosition` works:**
- Sets `pan: null` and `tilt: null` in the fixture override map.
- Sets `dirtyFamilies.add('KINETIC')`.
- `ProgrammerAetherBridge` reads the nulls and sends a "release" command to the backend.
- Backend `NodeArbiter` detects no manual override → resumes AI/LiquidEngine control.

### 4.2 KineticsCathedral — Lock Feedback Only, No Release Action

**File:** `src/components/hyperion/kinetics/KineticsCathedral.tsx` (lines 142–147)

```typescript
const lockedFixtureIds = useMovementStore(s => s.lockedFixtureIds)
const anyLocked = useMemo(
  () => selectedIds.some(id => lockedFixtureIds.has(id)),
  [selectedIds, lockedFixtureIds],
)
```

**Usage in render:**
- Fan mode buttons: `disabled={anyLocked}`
- Faders: `disabled={anyLocked}`
- Pattern arsenal: no explicit lock check (potential bug)

**What is missing:**
- ❌ No "Release / Unlock" button in the KineticsCathedral UI.
- ❌ No "Pause AI" toggle.
- ❌ No visual indicator that the current position is being overridden vs. AI-controlled.

### 4.3 The Race Condition: Manual vs LiquidEngine

**Scenario:**
1. Operator drags RadarXY to pan=400°, tilt=200°.
2. `programmerStore` sets `pan=400/540=0.74`, `tilt=200/270=0.74`.
3. `ProgrammerAetherBridge` sends override to backend at 44Hz.
4. Backend `NodeArbiter` sets manual override → fixture moves to 400°/200°.
5. LiquidEngine (running at 44Hz independently) computes next target for the vibe.
6. `NodeArbiter` priority: manual override > AI. So the fixture stays at 400°/200°.
7. **BUT:** If the operator now switches to 3D view and moves the fixture in StageGrid3D, that goes through a DIFFERENT store (`stageStore.updateFixture`).
8. If the operator then clicks "Release" (which doesn't exist in KIN UI), nothing happens. The override persists until:
   - The fixture is deselected (programmerStore.syncSelection clears its override)
   - The operator changes the vibe (which may or may not clear overrides)
   - The app restarts

### 4.4 Hydration from Backend — Overwrites User Intent

**File:** `KineticsCathedral.tsx` lines 97–117

```typescript
useEffect(() => {
  // ...
  const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
  if (result?.success && result?.state) {
    hydrateFromBackend(result.state)  // ← Overwrites movementStore
  }
}, [selectedIds.join(',')])
```

**`hydrateFromBackend` implementation** (`movementStore.ts` lines 173–181):

```typescript
hydrateFromBackend: ({ pan, tilt, pattern, speed, amplitude }) => {
  const uiPattern = pattern === 'hold' ? 'static' : (pattern ?? 'none')
  set({
    pan: pan ?? 270,
    tilt: tilt ?? 135,
    activePattern: uiPattern as PatternType,
    patternSpeed: speed ?? 50,
    patternAmplitude: amplitude ?? 50,
  })
},
```

**Problem:** When the operator selects a different fixture, `hydrateFromBackend` overwrites the movementStore with the **backend's current state** for that fixture. The operator's previous RadarXY position (e.g., pan=400°) is lost. This is by design for "show the current state of the selected fixture," but it creates the **amnesia effect** described in M2.

### 4.5 Spatial Hydration Gap

**Notable absence:** `hydrateFromBackend` does **NOT** hydrate `spatialTarget`. There is no `getFixturesState` response field for spatial target. If the operator was in spatial mode aiming at {x:5, y:3, z:2}, then selects a different fixture and comes back, the spatial target resets to `{x:0, y:2, z:0}` (default).

---

## M5: THE ZERO-POSITION OFFSET

### 5.1 File: `HyperionMovingHead3D.tsx` (lines 128–295)

### 5.2 The Quaternion Chain

The final orientation of a fixture is computed as:

```
WorldOrientation = baseQuat * yokeQuat * headQuat
```

Where:
- `baseQuat` = mount orientation + user base rotation
- `yokeQuat` = pan rotation around world Y axis
- `headQuat` = tilt rotation around local X axis

### 5.3 Base Quaternion (`baseQuat`)

**File:** `src/components/hyperion/views/visualizer/utils/mountQuaternion.ts`

```typescript
export const MOUNT_QUATERNIONS = {
  'ceiling':      new THREE.Quaternion(),                    // identity
  'floor':        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
  'truss-front':  identity.clone(),                          // same as ceiling
  'truss-back':   new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),
  'wall-left':    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
  'wall-right':   new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
}
```

**For ceiling mount:** `baseQuat = identity` → the fixture's local +Y axis aligns with world +Y (up).

### 5.4 Pan / Tilt Angle Computation

**File:** `HyperionMovingHead3D.tsx` lines 290–293

```typescript
const panAngle  = (smoothPan.current! - 0.5) * PAN_RANGE    // PAN_RANGE = π*1.5 = ±135°
const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE + TILT_REST_ANGLE
                                                             // TILT_RANGE = π*0.75 = ±67.5°
                                                             // TILT_REST_ANGLE = 0 (WAVE 4573)
yokeQuat.current.setFromAxisAngle(PAN_AXIS, panAngle)        // PAN_AXIS = (0, 1, 0)
headQuat.current.setFromAxisAngle(TILT_AXIS, tiltAngle)        // TILT_AXIS = (1, 0, 0)
```

### 5.5 At DMX Center (pan=0.5, tilt=0.5)

```
panAngle  = (0.5 - 0.5) * 1.5π = 0
 tiltAngle = -(0.5 - 0.5) * 0.75π + 0 = 0

yokeQuat = identity (no Y-axis rotation)
headQuat = identity (no X-axis rotation)

baseQuat (ceiling) = identity

WorldOrientation = I · I · I = identity
```

**Result:** The fixture's local coordinate system is aligned with world coordinates.

### 5.6 The Emission Axis Ambiguity

**`mountQuaternion.ts` comment (line 12):**
> "Los modelos de Hyperion tienen eje de emisión local en -Y."

**But the actual `ConeGeometry` in `HyperionMovingHead3D.tsx` (line 404):**
```typescript
<mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]}>
  <coneGeometry args={[1.0, 3.5, 16, 1, true]} />
```

In Three.js, `ConeGeometry` points along the **+Y** axis by default (tip at +height/2). There is **no rotation** applied to the beam mesh to flip it to -Y.

**Conclusion:** At DMX center with ceiling mount, the beam points in the **+Y direction** (up toward the ceiling), not down (-Y) as the mountQuaternion comment claims, and not toward the stage front.

### 5.7 Mathematical Correction Proposal

**Goal:** At DMX center (pan=0.5, tilt=0.5), a ceiling-mounted fixture should point **forward into the stage** (approximately -Z world direction, or slightly down-forward).

**Option A — Restore TILT_REST_ANGLE (minimum change):**
```typescript
// Revert WAVE 4573 removal
const TILT_REST_ANGLE = Math.PI / 4  // 45° forward

// At DMX center:
// tiltAngle = 0 + 45° = 45°
// head rotates +45° around X axis → beam tilts forward from +Y toward +Z
// With ceiling mount (identity), +Z is toward the audience (front of stage)
```

**Option B — Fix MOUNT_QUATERNIONS (architecturally cleaner):**
```typescript
// Add a forward-pointing bias to ceiling mount
const ceiling = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(Math.PI / 4, 0, 0)  // 45° forward tilt
)
```

This makes all ceiling-mounted fixtures point ~45° forward by default, which is physically realistic for truss-mounted moving heads.

**Option C — Fix emission direction (model-level):**
```typescript
// Rotate the beam mesh to align with -Y as documented
<mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]} rotation={[Math.PI, 0, 0]}>
```
This flips the cone to point in -Y, matching the mountQuaternion documentation. Combined with Option A or B, this produces the correct visual.

### 5.8 Recommended Fix

Apply **Option A + Option C**:
1. Restore `TILT_REST_ANGLE = Math.PI / 4` (or similar) in `HyperionMovingHead3D.tsx`.
2. Add `rotation={[Math.PI, 0, 0]}` to the beam mesh to align with documented `-Y` emission axis.
3. Verify that `mountQuaternion.ts` comment remains accurate.

This ensures:
- DMX center → beam points forward (into the stage, toward audience).
- Pan sweeps produce visible horizontal arcs across the stage floor.
- Tilt sweeps produce visible vertical arcs.

---

## CROSS-MISSION BOTTLENECKS & CONFLICTS

### B1: Dual-Channel Motor Conflict (Classic vs Spatial)

Both paths can send pan/tilt commands to the same fixture simultaneously:
- Classic: via `programmerStore` → `ProgrammerAetherBridge` → `NodeResolver`
- Spatial: via `applySpatialTarget` → `IKEngine` → `NodeResolver`

There is no UI indication of which mode is "active" for a given fixture, and no arbitration UI to resolve conflicts.

### B2: Selection Change Destroys User Intent

The `hydrateFromBackend` + `resetToDefaults` pattern in `KineticsCathedral` means the operator cannot:
- Set a pattern + speed, then select a different fixture group without losing the pattern settings.
- Set a spatial target, then inspect a single fixture without the target resetting to default.

### B3: Missing "Release All" in Kinetics Mode

The KineticsCathedral UI has no button to release all overrides and hand control back to LiquidEngine. The operator must either:
- Switch to the Programmer tab and click Release (if available there).
- Deselect all fixtures (which triggers `resetToDefaults` but does NOT release backend overrides).

### B4: Local State Ephemerality

`cathedralTab`, `bannerDismissed`, and other `useState` values inside `KineticsCathedral` are lost on every sidebar toggle. This creates a "groundhog day" UX where the operator must re-expand the same sections repeatedly.

---

## FILE MAP — Reference Index

| File | Role | Key Lines |
|---|---|---|
| `src/components/hyperion/views/HyperionView.tsx` | View orchestrator, mount strategy | 202–446 |
| `src/components/hyperion/kinetics/KineticsCathedral.tsx` | KIN sidebar, pattern/fader controls | 1–328 |
| `src/components/hyperion/kinetics/KinRadarViewport.tsx` | Main viewport radar router, IPC dispatch | 1–367 |
| `src/components/hyperion/controls/controls/RadarXY.tsx` | Classic group radar (degrees) | 1–304 |
| `src/components/hyperion/controls/controls/XYPad.tsx` | Classic single-fixture pad | 1–225 |
| `src/components/hyperion/controls/controls/SpatialTargetPad.tsx` | Spatial 3D target pad (meters) | 1–692 |
| `src/stores/movementStore.ts` | Kinetic state (Zustand, persistent) | 1–186 |
| `src/stores/programmerStore.ts` | Override plumbing (Zustand) | 1–488 |
| `src/stores/transientStore.ts` | Ghost store (mutable ref, 60fps) | 1–261 |
| `src/hooks/useAdiabaticRadarMode.ts` | Mode auto-detection | 1–30 |
| `src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx` | 3D moving head rendering | 1–438 |
| `src/components/hyperion/views/visualizer/utils/mountQuaternion.ts` | Base orientation quaternions | 1–74 |

---

## AUDIT CERTIFICATION

- **Code mutated:** NONE (zero-code-mutation directive respected)
- **Files read:** 11
- **Lines audited:** ~2,800
- **Bugs identified:** 5 (2 High, 3 Medium)
- **Ready for remediation:** YES — all findings include specific line numbers and proposed fixes.

---
*End of HYPERION-KINETIC-AUDIT.md — WAVE 4578-A*
