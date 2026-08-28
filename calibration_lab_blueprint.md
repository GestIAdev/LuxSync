# Calibration Lab Rebuild Blueprint

**Directive:** WAVE 7666-EREBUS-CALIB-BLUEPRINT
**Role:** Lead UI/UX Architect (Opus)
**Date:** 2026-08-27
**Predecessor:** `calibrationview_audit_V3.md` (forensic audit, non-binding context)
**Scope constraint:** React UI, state bridging, IPC dispatch **only**. `InverseKinematicsEngine.ts` and `NodeResolver.ts` are treated as sound black boxes and are **not** touched.

---

## 0. Executive Summary

`CalibrationView` (Calibration Lab) becomes the single primary calibration surface, absorbing spatial IK targeting from the deprecated `CalibrationDock`. The rebuild is **additive**: the Lab already owns the mechanical aim path, DMX channel grid, calibration-mode lifecycle, and test actions. It gains four things:

1. A **numeric Targeting Module** (X/Y/Z in meters + Aim Target) replacing the Dock's 2D pad.
2. **Live offset feedback** via throttled `updateLiveCalibration` (currently offsets only persist to the store).
3. **Session control** (Apply / Revert / Reset with snapshot + dirty tracking) ported from `useCalibrationSession`.
4. A **legacy path migration** that repairs the broken DMX Channel Grid.

### Pre-flight findings that changed this plan

Three discoveries during blueprint verification alter the naive approach. They are load-bearing:

| # | Finding | Impact |
|---|---|---|
| **F1** | The Dock's mount site is `ContextInspector.tsx` (priority-1 branch, `toolMode === 'calibrate'`, `React.lazy`). It is **not** mounted in `ErebusShell` directly. | Phase 1 cleanup is a precise 2-edit removal, not a shell refactor. |
| **F2** | `lux:aether:applySpatialTarget` accepts optional `fixturePositions` and `fixtureIKProfiles`. **No frontend component currently sends them.** The handler skips any fixture where `fixtureIKProfiles[id].isPlaced === false`, and falls back to a possibly-stale `{0,0,0}` Orchestrator position otherwise. | The new Targeting Module **must** send `fixturePositions` from `stageStore`, or it inherits the Dock's silent "spatial amnesia" bug. This is a correctness upgrade, not a port. |
| **F3** | The engine has a **Spatial Gate** (WAVE 7622): once `targetX` is present in a node's motor override, the node is in IK mode and `pan_base`/`tilt_base` injection is suppressed. Mechanical aim (`setManualOverrides`) and spatial target are therefore **competing control modes** on the same `:kinetic` node. | The Lab needs explicit **mode arbitration** and a **Release Target** action. Shipping both controls live simultaneously would produce non-deterministic aim. See Design Decision **D1**. |

---

## 1. Architectural Design & UI Layout

### 1.1 Control-mode model (foundational)

Because of **F3**, the Lab must expose a single explicit control mode per fixture. This is the spine of the whole design.

```
                    ┌─────────────────────────────┐
                    │   controlMode (Lab state)   │
                    └──────────┬──────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
   ┌─────▼──────┐                            ┌───────▼───────┐
   │  SPATIAL   │                            │  MECHANICAL   │
   │   (IK)     │                            │  (Pan/Tilt)   │
   ├────────────┤                            ├───────────────┤
   │ X/Y/Z num  │                            │ Radar + D-Pad │
   │ Aim Target │                            │ absolute deg  │
   │            │                            │               │
   │ dispatch:  │                            │ dispatch:     │
   │ aether.    │                            │ aether.       │
   │ applySpat- │                            │ setManual-    │
   │ ialTarget  │                            │ Overrides     │
   │ (invoke)   │                            │ (send)        │
   └────────────┘                            └───────────────┘
         │                                           │
         └──────────► on switch: releaseSpatialTarget ◄┘
                      (clears targetX/Y/Z, exits IK)
```

**Rules:**
- Entering **MECHANICAL** from **SPATIAL** dispatches `aether.releaseSpatialTarget({ fixtureIds:[id] })` first, so the Spatial Gate releases and `pan`/`tilt` overrides take effect predictably.
- Entering **SPATIAL** does not need to clear manual overrides, but the UI must show that the radar/D-Pad readouts are now *reported* IK output, not *commanded* values.
- The **Offset Module is mode-independent** — offsets bend the IK math and are valid in both modes. It is always active.

> **D1 — Design Decision required.** The directive states the D-Pad/Radar should "dispatch `updateLiveCalibration` (throttled) ... instead of just saving to the store." Read literally this would convert the *aim* control into an *offset trim* control and delete the Lab's mechanical aim capability. My reading: the phrase "instead of just saving to the store" describes the **Offset Module's** current defect (`handleSaveOffsets` writes `stageStore` only, never notifies the resolver). **Recommendation:** keep Radar/D-Pad as the MECHANICAL *aim* control (unchanged dispatch: `setManualOverrides`), and give the **Offset Module its own trim D-Pad + numeric fields** wired to throttled `updateLiveCalibration`. This preserves both capabilities and satisfies the intent (live physical feedback for offsets). The layout below implements this recommendation. If the Architect intends the literal reading, only §1.4 changes — the phases are unaffected.

### 1.2 New layout — three zones + footer

The existing dual-zone shell is retained and subdivided. `zone-targeting` (left) is reorganized into a vertical stack of four collapsible modules; `zone-channels` (right) is unchanged.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER: ⌖ CALIBRATION LAB   │ <fixture name> │ DMX 41 │ ● DMX LIVE │ ● DIRTY │
├────────────────────────────────────┬─────────────────────────────────────────┤
│ ZONE A — CONTROL STACK (~42%)      │ ZONE B — FIXTURE / DMX (~58%)           │
│                                    │                                         │
│ ┌────────────────────────────────┐ │ ┌─────────────────────────────────────┐ │
│ │ ▣ MODE   [ SPATIAL ][MECHANIC] │ │ │ FIXTURE RACK              [ 12 ]    │ │
│ └────────────────────────────────┘ │ │ ┌─────────────────────────────────┐ │ │
│                                    │ │ │ 1  ⬢ Mov.Head L   CH 41  ✓IK   │ │ │
│ ┌────────────────────────────────┐ │ │ │ 2  ⬢ Mov.Head R   CH 61  ⚠NP   │ │ │
│ │ 🎯 TARGETING (SPATIAL)         │ │ │ │ 3  ○ Par Wash     CH 81        │ │ │
│ ├────────────────────────────────┤ │ │ └─────────────────────────────────┘ │ │
│ │  X [  0.00 ] m   (stage L/R)   │ │ └─────────────────────────────────────┘ │
│ │  Y [  1.50 ] m   (elevation)   │ │                                         │
│ │  Z [  2.00 ] m   (depth)       │ │ ┌─────────────────────────────────────┐ │
│ │                                │ │ │ DMX CHANNEL GRID  DMX 41 · 16CH     │ │
│ │  [ presets: Centre │ DS │ US ] │ │ │                       [ RESET ALL ] │ │
│ │                                │ │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│ │
│ │  ┌──────────────────────────┐  │ │ │ │ 1    │ │ 2    │ │ 3    │ │ 4    ││ │
│ │  │      ⌖  AIM TARGET       │  │ │ │ │ pan  │ │ tilt │ │ dim  │ │ red  ││ │
│ │  └──────────────────────────┘  │ │ │ │ ▓▓░░ │ │ ▓░░░ │ │ ▓▓▓▓ │ │ ░░░░ ││ │
│ │  [ Release Target ]            │ │ │ │ 128  │ │  64  │ │ 255  │ │   0  ││ │
│ │                                │ │ │ └──────┘ └──────┘ └──────┘ └──────┘│ │
│ │  status: ✓ aimed  (d=6.4m)     │ │ │           … (scroll)                │ │
│ │          ⚠ fixture not placed  │ │ └─────────────────────────────────────┘ │
│ └────────────────────────────────┘ │                                         │
│                                    │                                         │
│ ┌────────────────────────────────┐ │                                         │
│ │ ⊕ MECHANICAL AIM               │ │                                         │
│ ├────────────────────────────────┤ │                                         │
│ │   ╭──────────────╮   ↖ ↑ ↗     │ │                                         │
│ │   │   polar      │   ← ⊙ →     │ │                                         │
│ │   │   radar   ✛  │   ↙ ↓ ↘     │ │                                         │
│ │   ╰──────────────╯             │ │                                         │
│ │   STEP [1°][5°][15°][45°]      │ │                                         │
│ │   PAN  ▓▓▓▓▓▓░░░  256° / 540°  │ │                                         │
│ │   TILT ▓▓▓░░░░░░  128° / 270°  │ │                                         │
│ └────────────────────────────────┘ │                                         │
│                                    │                                         │
│ ┌────────────────────────────────┐ │                                         │
│ │ 🔧 OFFSET TRIM  (live)         │ │                                         │
│ ├────────────────────────────────┤ │                                         │
│ │   ╭──────────────╮  Pan° [ 0.0]│ │                                         │
│ │   │  trim pad ✛  │  Tilt°[ 0.0]│ │                                         │
│ │   ╰──────────────╯             │ │                                         │
│ │   TRIM STEP [0.5°][1°][5°]     │ │                                         │
│ │   ↖ ↑ ↗                        │ │                                         │
│ │   ← ⊙ →   Pan ↔ [off] Tilt ↕[on]│ │                                        │
│ │   ↙ ↓ ↘                        │ │                                         │
│ └────────────────────────────────┘ │                                         │
│                                    │                                         │
│ ┌────────────────────────────────┐ │                                         │
│ │ SESSION  ● unsaved changes     │ │                                         │
│ │ [ APPLY ] [ REVERT ] [ RESET ] │ │                                         │
│ └────────────────────────────────┘ │                                         │
├────────────────────────────────────┴─────────────────────────────────────────┤
│ FOOTER: [BLACKOUT] [STROBE] [COLOR] [GOBO] [FULL ON]                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Targeting Module (NEW)

Replaces `CalibrationTargetMini`'s 2D pad + elevation slider entirely. **No pad. No drag. Numeric only.** This is the core UX fix: a 3D point is entered as three unambiguous numbers rather than inferred from a compressed 2D surface.

| Element | Spec |
|---|---|
| **X input** | meters, stage left/right. Step `0.25`. Suggested soft range `-10 … +10`. Label: `X — Stage L/R`. |
| **Y input** | meters, elevation/height. Step `0.25`. Soft range `0 … 12`. Label: `Y — Elevation`. |
| **Z input** | meters, stage depth (front/back). Step `0.25`. Soft range `-10 … +10`. Label: `Z — Depth`. |
| **Presets** | `Centre Stage` (0, 1.5, 0), `Downstage` (0, 1.5, +3), `Upstage` (0, 1.5, -3). Convenience only; values remain editable. |
| **Aim Target button** | Primary action. Dispatches the spatial target. Disabled when no `activeFixtureId`. |
| **Release Target button** | Secondary. Dispatches `aether.releaseSpatialTarget`, returns node to non-IK control. |
| **Status line** | Reports outcome: aimed + computed distance, or a specific warning (see below). |

**Axis semantics** are inherited verbatim from the engine's coordinate system and the Dock's WAVE 7662 correction — `X = left/right`, `Y = height`, `Z = depth`. Reusing these exact semantics means zero engine-side change.

**Dispatch contract — `window.lux.aether.applySpatialTarget`** (`invoke`, awaitable):

```text
payload:
  target        : { x, y, z }                       ← from the three numeric inputs
  fixtureIds    : [ activeFixtureId ]
  fanMode       : 'converge'
  fanAmplitude  : 0
  fixturePositions  : { [id]: {x,y,z} }             ← NEW (F2) from stageStore fixture.position
  fixtureIKProfiles : { [id]: { isPlaced, orientation,
                                rotation, calibration,
                                panRangeDeg, tiltRangeDeg } }  ← NEW (F2)

returns: { success: true, subTargets: { [id]: {x,y,z} } }
      |  { success: false, error: string }
```

**Why the two new fields matter (F2).** The handler resolves position as `fixturePositions?.[id] ?? f?.position`. Without `fixturePositions`, it falls back to the Orchestrator's copy, which is documented (WAVE 4884) to suffer "amnesia espacial" — stale `{0,0,0}` when `isPlaced:true` was never synced. The Dock sends neither field, so its targeting silently aims from the wrong origin. The Lab reads `stageStore` already (it is the source of truth for positions), so supplying both fields is nearly free and strictly more correct.

**Preflight validation (UI-side guard rails).** Before dispatch, the module checks and surfaces:

| Condition | UI response |
|---|---|
| `fixture.isPlaced === false` | ⚠ `Fixture not placed on stage — targeting will be skipped.` **Block dispatch.** (Handler skips these silently at line 1009 — we surface it instead.) |
| `fixture.position` missing / non-finite | ⚠ `Fixture has no valid position.` Block dispatch. |
| Fixture type not IK-eligible (not `moving-head`/`scanner`/`spot`) | ⚠ `Fixture has no pan/tilt — spatial targeting unavailable.` Disable module. |
| `success: false` from handler | ✗ show `error` string verbatim. |
| `subTargets` empty object | ⚠ `Engine accepted but resolved no sub-targets.` |
| Success | ✓ `Aimed — distance N.Nm` (distance computed client-side from position↔target). |

**Reachability note.** The handler returns only `subTargets`; its own comment states reachability telemetry is published asynchronously by the resolver via transient updates. The blueprint therefore does **not** promise a reachability badge in this wave. The status line is structured to accept one later without layout change. (`lux:arbiter:applySpatialTarget` — a *different* bridge — does return per-fixture `IKResult` with a reachability flag, but it is the legacy MasterArbiter route and is explicitly out of scope.)

### 1.4 Offset Module (UPGRADED)

Retains the Lab's existing offset semantics and adds live physical feedback plus a tactile trim pad.

| Element | Behaviour |
|---|---|
| **Trim pad** (ported from `OffsetTrimPad`) | 2D drag → `panOffset` / `tiltOffset`. Range ±30°, snap 0.5°. Double-click resets to 0/0. |
| **Trim D-Pad** | 8-direction nudge by `trimStep`. **Steps: 0.5° / 1° / 5°** — the fine-trim scale the directive calls for. Distinct from the aim D-Pad's 1/5/15/45 coarse steps. |
| **Numeric Pan° / Tilt°** | Direct entry, clamped ±30, snapped 0.5. (Ported from `OffsetTrimPad` WAVE 7662 inputs.) |
| **Pan ↔ / Tilt ↕ polarity** | Existing inline toggles, **rewired** to flow through the live dispatch instead of local-state-only. |

**The critical rewire.** Every offset/polarity mutation now flows:

```
UI change ──► updateCalibration(partial)         (session buffer, immediate — UI stays 60fps)
                     │
                     ├─► recompute isDirty vs snapshot
                     │
                     └─► throttle 100ms ──► window.lux.aether.updateLiveCalibration({
                                               nodeId: `${fixtureId}:kinetic`,
                                               calibration: { panOffset, tiltOffset,
                                                              panInvert, tiltInvert }
                                             })                       (ipcRenderer.send)
```

- **100ms throttle** preserved from `useCalibrationSession` (blueprint §4.5 precedent). Trailing-edge timer, cleared on unmount.
- Values are sent in **degrees** and **booleans** — matching the preload contract exactly. No normalization.
- `updateLiveCalibration` is `ipcRenderer.send` (fire-and-forget), so it is safe at trim-drag rates behind the throttle and needs no error handling.
- The resolver mutates `node.ikCalibration` in place and invalidates the IK profile cache, so the next TickEngine frame reflects the trim — this is the "live physical feedback" the directive requires.

**The bug this fixes.** Today `handleSaveOffsets` writes only `stageStore.updateFixture(...)`. The operator drags an offset slider and the light does not move until a full re-patch. After the rewire, the head responds within one frame.

### 1.5 Session Control (NEW)

`useCalibrationSession`'s semantics are adopted wholesale.

| Control | Behaviour |
|---|---|
| **APPLY** | Persist `liveCalibration` → `stageStore.updateFixture(id, { calibration })` (→ ShowFile on disk), immediately push `updateLiveCalibration` (unthrottled), then `snapshot = liveCalibration`, `isDirty = false`. Reuses the Lab's existing `saveStatus` feedback (`idle`/`saving`/`saved`/`error`). |
| **REVERT** | Restore `liveCalibration` from `snapshot`, push snapshot values live, `isDirty = false`. **No Lab equivalent exists today** — this is a net capability gain. |
| **RESET** | Zero all four fields (`0/0/false/false`), push zeroed calibration live. Leaves `isDirty` true if a snapshot exists, so the operator must consciously APPLY or REVERT. |
| **Dirty indicator** | `●` in the header + the SESSION panel, driven by `isDirty`. Mirrors the Dock's `calibration-dock-dirty` affordance. |

**Snapshot lifecycle.** On `activeFixtureId` change: read `fixture.calibration` from `stageStore`, seed both `liveCalibration` and `snapshot`, clear `isDirty`. This replaces the Lab's current ad-hoc offset-loading `useEffect`, which has a latent defect — it depends on `[activeFixtureId, stageFixtures]`, so **any** unrelated `stageFixtures` mutation re-runs it and can clobber in-progress edits. Routing through the session hook (keyed on `fixtureId` only) removes that hazard.

**Unsaved-changes guard.** If `isDirty` and the operator switches fixture or unmounts the view, prompt or auto-revert. Recommendation: **auto-revert with a toast** (calibration is physical; silently persisting a half-finished trim is worse than losing it).

### 1.6 Header additions

- **DMX LIVE / DMX OFFLINE** pill — port from the Dock (`useLibraryStore(s => s.dmxStatus.connected)`). The Lab currently no-ops silently when DMX is down; the operator deserves to know why nothing moved.
- **Dirty dot** — `isDirty` from the session.
- The existing hardcoded `⟳ ARMED` badge should be replaced with real state or removed; it currently asserts ARMED unconditionally, which is misleading.

### 1.7 Fixture Rack annotations

Keep showing **all** fixtures (deliberate, for debugging), but annotate IK capability so the operator understands why targeting is unavailable:

- `✓IK` — type is `moving-head`/`scanner`/`spot` **and** `isPlaced`.
- `⚠NP` — IK-capable type but **not placed** → spatial targeting will be skipped by the engine.
- *(no badge)* — no pan/tilt; mechanical + spatial modules disabled, DMX grid still fully usable.

This ports `CalibrationFixtureList`'s `IK_ELIGIBLE_TYPES` predicate as a *badge* rather than as a filter — preserving the Lab's debug-everything philosophy while eliminating the mystery.

---

## 2. Component Teardown & Migration Plan (Phased)

Each phase is independently shippable and leaves the app in a working state.

### Phase 1 — Cleanup

**Goal:** Remove the deprecated Dock and the four zombie files. No behavioural change to the Lab.

**1a. Unmount the Dock (F1).** In `src/components/views/erebus/hud/ContextInspector.tsx`:
- Remove the `React.lazy` import of `../calibration/CalibrationDock` (line 23).
- Remove the entire **Priority 1** `toolMode === 'calibrate'` branch (lines 37–50).
- Remove the now-unused `Suspense` import if nothing else uses it.
- Update the priority-list header comment (lines 15–20) to drop item 1.
- `toolMode` prop stays — still used for other tool logic. With the branch gone, `calibrate` mode falls through to normal selection-based inspectors.

**1b. Delete the Dock cluster** (`src/components/views/erebus/calibration/`):

| File | Action | Rationale |
|---|---|---|
| `CalibrationDock.tsx` | **Delete** | Superseded by the Lab. |
| `CalibrationTargetMini.tsx` | **Delete after Phase 3** | Its `applySpatialTarget` payload shape is the reference for the new Targeting Module. Keep as reference until Phase 3 lands, then delete. |
| `OffsetTrimPad.tsx` | **Move / keep** | Genuinely good component. Either relocate into the Lab's own components folder or copy its pad + numeric-input logic into the new Offset Module. Do **not** delete blindly. |
| `AxisPolarityToggles.tsx` | **Optional keep** | Lab has equivalent inline toggles. Keep only if the Lab adopts this component instead of its inline buttons. |
| `CalibrationFixtureList.tsx` | **Delete** | Redundant. Port only the `IK_ELIGIBLE_TYPES` predicate (§1.7). |
| `useCalibrationSession.ts` | **Move, do not delete** | Migrated in Phase 2. |

**1c. Delete the four zombies** (`src/components/views/CalibrationView/components/`) — all four are confirmed unimported by `index.tsx`:

| File | Notes |
|---|---|
| `RadarXY.tsx` | Duplicates `SAFE_PAN_MAX`/`SAFE_TILT_MAX`; superseded by the inline radar. |
| `FixtureList.tsx` | Superseded by the inline rack. |
| `TestPanel.tsx` | Uses the **abandoned raw-DMX bridge** `lux.dmx.sendDirect` (Arbiter bypass). Deleting it removes the last renderer caller of that probe path — confirm no other consumer before deleting. |
| `OffsetPanel.tsx` | Uses **legacy IPC** `lux:fixture:setOffset` / `lux:fixture:setInvert`. Deleting it may orphan those main-process handlers; flag them for a separate audit. |
| `components/index.ts` | Delete the barrel (it only re-exports the four). |

**Exit criteria:** typecheck clean; `calibrate` tool mode no longer opens the Dock; Lab behaves exactly as before; no dead imports.

**Risk:** Low. Confined to deletions plus one branch removal.

---

### Phase 2 — State Migration

**Goal:** `CalibrationView` owns the session buffer. No new UI yet.

**2a. Relocate the hook.** Move `useCalibrationSession.ts` → `src/components/views/CalibrationView/useCalibrationSession.ts`. Fix the `FixtureV2` import depth (`../../../../core/stage/ShowFileV2` → `../../../core/stage/ShowFileV2` from the new location — verify at edit time).

**2b. Wire it in.** In `CalibrationView`, replace the four standalone offset `useState`s (`panOffset`, `tiltOffset`, `panInvert`, `tiltInvert`) and the offset-loading `useEffect` with:

```text
const getFixture = useCallback((id) => stageFixtures.find(f => f.id === id), [stageFixtures])

const { session, liveCalibration, updateCalibration,
        apply, revert, reset } = useCalibrationSession(activeFixtureId, getFixture, updateFixture)
```

- All offset reads become `liveCalibration.panOffset` etc.
- All offset writes become `updateCalibration({ panOffset: v })` etc.
- `handleSaveOffsets` is replaced by the hook's `apply` — but **keep** the Lab's `saveStatus` UX by wrapping `apply` in a thin handler that drives `saving`/`saved`/`error`.
- `handleResetOffsets` is replaced by the hook's `reset`.
- **Drop** `setReferenceTarget` from the destructure — the new Targeting Module owns X/Y/Z as its own local state (Phase 3); the hook's `referenceTarget` field is vestigial for the Lab and should be considered for removal from the hook's type.

**2c. Memoization discipline.** `getFixture` is a `useCallback` dep of the hook's fixture-load `useEffect`. If it is recreated on every `stageFixtures` change, the effect re-runs and re-snapshots, reintroducing the clobber hazard from §1.5. Prefer keying the effect on `fixtureId` only, or make `getFixture` a `useRef`-stable reader. **This is the single highest-risk detail in Phase 2** — verify by editing an offset while an unrelated fixture moves.

**2d. Free win.** Because the hook already dispatches throttled `updateLiveCalibration` on every `updateCalibration`, Phase 2 alone delivers the directive's live-offset-feedback requirement. The Offset Module's D-Pad in Phase 3 is then purely additive UI.

**Exit criteria:** dragging an existing offset slider moves the physical head within ~100ms; Apply persists; Revert restores; dirty dot tracks correctly.

**Risk:** Medium — effect-dependency correctness (2c).

---

### Phase 3 — UI Construction

**Goal:** Build the Targeting Module, the Offset trim D-Pad, mode arbitration, and the header/rack affordances.

**3a. Mode switch.** Add `controlMode: 'spatial' | 'mechanical'` local state (default `'mechanical'`, preserving today's behaviour). Render the segmented control. On transition to `mechanical`, dispatch `aether.releaseSpatialTarget({ fixtureIds:[activeFixtureId] })` (§1.1).

**3b. Targeting Module.** New subcomponent `CalibrationView/components/TargetingPanel.tsx`:
- Local state `{ x, y, z }`, default `(0, 1.5, 2)`.
- Three numeric inputs, presets, Aim Target, Release Target, status line.
- Build `fixturePositions` and `fixtureIKProfiles` from the active `stageStore` fixture (**F2**) — this is the correctness-critical part.
- Run the §1.3 preflight checks before dispatch; render the resulting status/warning.
- `await` the `invoke`, branch on `success`, surface `error`.

**3c. Offset trim D-Pad.** Extend the Offset Module with the 8-direction nudge grid and `trimStep` selector (0.5°/1°/5°). Each nudge calls `updateCalibration` with the clamped, snapped delta — automatically inheriting Phase 2's throttled live dispatch.

**3d. Relocate the trim pad.** Bring `OffsetTrimPad`'s pad + numeric inputs into the Offset Module (per Phase 1b decision), so offsets have pad, D-Pad, and numeric entry.

**3e. Header + rack.** Add the DMX LIVE/OFFLINE pill and dirty dot (§1.6); add IK badges to the rack (§1.7); fix or remove the hardcoded ARMED badge.

**3f. Keyboard integration.** The Lab's global `keydown` handler must respect `controlMode` — WASD/arrows should drive mechanical aim only in `mechanical` mode, and should be inert (or drive trim) in `spatial` mode. Preserve the existing `useKeyMapStore.isArmed` KeyForge deferral unconditionally.

**3g. Cleanup.** Delete `CalibrationTargetMini.tsx` once the new module is verified.

**Exit criteria:** operator can enter X/Y/Z, press Aim Target, and the head points at that point; trim D-Pad produces live physical response; mode switching is deterministic; warnings appear for unplaced fixtures.

**Risk:** Medium — mode arbitration against the Spatial Gate (F3) needs hardware verification.

---

### Phase sequencing summary

| Phase | Delivers | Blocked by | Risk |
|---|---|---|---|
| 1 — Cleanup | Dock unmounted, 4+ zombies deleted | — | Low |
| 2 — State migration | **Live offset feedback**, Apply/Revert/Reset | 1 | Medium |
| 3 — UI construction | **Numeric X/Y/Z targeting**, trim D-Pad, mode switch | 2 | Medium |
| 4 — Legacy migration (§3) | **DMX Channel Grid repaired** | independent | Medium |

Phase 4 is **independent** and may run in parallel — it touches data, not the Lab's UI.

---

## 3. The Legacy Path Script (Data Migration)

### 3.1 The defect, restated

Pre-WAVE-7605 shows store `profileId` and `definitionPath` pointing at the retired factory library (`resources/librerias/**.fxt`) or the old `userData/fixtures/custom/` split. WAVE 7605 collapsed everything to a single `userData/fixtures/**.json` root and deleted the PATHFINDER, but **show files were never migrated**.

Failure chain:

```
show fixture { profileId:'EL_1140', definitionPath:'resources/librerias/factory/EL_1140.fxt' }
        │
        ▼
FixtureProfileResolver.resolveFixtureDefinitionForAether()
        │  candidates: [profileId, definitionId, fixtureDefId, definitionPath, model, name]
        ▼
RuntimeFixtureLibrary.resolveRuntimeFixtureDefinition()
        │  looks up id / basename / stem (lowercased) in the map built from userData/fixtures/*.json
        ▼
   ✗ MISS  — no .json has id/basename/stem 'el_1140' or 'el_1140.fxt'
        │
        ▼
fallback requires fixture.channels to ALREADY be a non-empty inline array
        │  (ShowFileMigrator sets profileId/definitionPath but does NOT inline channels)
        ▼
   ✗ definition = null → stageStore fixture has no channels
        │
        ▼
CalibrationView: channels memo = []  →  "No channels" ; sendDMX / resetAllChannels are no-ops
```

The Fixture Rack still renders (it needs only `id`/`name`/`address`), which is why the failure looks like a UI bug rather than a data bug.

### 3.2 Recommended approach — main-process reconciliation at show load

**Placement:** a one-shot reconciliation step in the main process, immediately after `rescanAllLibraries()` has populated `RuntimeFixtureLibrary` and after the show file is loaded (the `lux:stage:load` / `StagePersistence` path), *before* fixtures are handed to Aether hydration.

**Why main process, not renderer:**
- `RuntimeFixtureLibrary` (the authoritative resolution map) lives there.
- It runs before `FixtureProfileResolver` consumes the fixtures, so the repair is invisible downstream — no UI flicker, no double hydration.
- It fixes the Channel Grid *and* every other consumer of resolved channels simultaneously.

**Algorithm (per fixture, only when resolution currently fails):**

```text
1. SKIP if the fixture already resolves (resolveRuntimeFixtureDefinition succeeds)
   or already carries a non-empty inline `channels` array.
      → migration is strictly repair-only; healthy fixtures are never touched.

2. DETECT legacy shape. Flag if definitionPath or profileId:
      · ends with '.fxt'
      · contains 'librerias'  (also match 'resources/librerias', any separator)
      · contains a '/factory/' or '/custom/' segment
      · is an absolute path that no longer exists on disk

3. MATCH against the live library (userData/fixtures/**.json), in confidence order:
      a. basename-stem of definitionPath  vs  library entry id
                (e.g. 'EL_1140.fxt' → 'el_1140')
      b. basename-stem  vs  library entry filename stem
      c. exact, case-insensitive  fixture.model   vs  library entry name
      d. exact, case-insensitive  fixture.name    vs  library entry name
      e. normalized name match (strip _ - and whitespace, lowercase)
      f. channelCount equality used ONLY as a tie-breaker among
         otherwise-equal candidates — never as a primary key

4. ON UNIQUE MATCH — rewrite:
      profileId      := matched.id
      definitionPath := matched.filePath
      channels       := matched.channels        (inline, so future resolution
                                                 succeeds via the fallback path
                                                 even if the library changes)
      channelCount   := matched.channels.length
      mark show file dirty

5. ON AMBIGUOUS MATCH (>1 candidate) — do NOT guess.
      Log: fixture id/name/model + all candidate ids.
      Leave untouched. Report in the summary.

6. ON NO MATCH — leave untouched.
      Log fixture id + name + model + old definitionPath.
      Report in the summary.

7. PERSIST once, after the whole pass, if anything changed.
      Single write. Never per-fixture.

8. REPORT a single summary line:
      [CalibMigration] N fixtures scanned · M migrated · A ambiguous · U unmatched
```

### 3.3 Safety requirements (non-negotiable)

| Requirement | Rationale |
|---|---|
| **Back up the show file** before the first write (`<show>.pre-7605.bak`) | Rewriting `profileId` is destructive; operators must be able to roll back. |
| **Idempotent** | Re-running must be a no-op. Guaranteed by step 1 (skip already-resolving fixtures). |
| **Never guess on ambiguity** | A wrong `profileId` silently produces wrong DMX channel mapping — worse than a visibly empty grid. |
| **Never delete or invent** channels | Only copy from a matched library entry. |
| **Log every skip** with enough identity to fix by hand | Unmatched fixtures need an operator remedy path. |
| **Additive to the migrator, not a replacement** | Leave `ShowFileMigrator` alone; this is a distinct post-7605 concern. |

### 3.4 Operator-facing remedy (required companion)

The script cannot repair a fixture whose profile genuinely no longer exists — the factory library shipped **zero** fixtures after 7605. Those fixtures need human action, so the UI must expose the state rather than showing a blank grid:

- In the Lab's DMX Channel Grid empty state, replace `"No channels"` / `"Select a fixture with channel data"` with a diagnostic: **`Profile unresolved — this fixture's definition (<old definitionPath>) is missing from the library. Re-assign a profile in the Forge.`**
- Optionally surface a `⚠ profile unresolved` badge in the Fixture Rack.

This converts a silent dead end into an actionable message and is the highest-value, lowest-cost part of Phase 4.

### 3.5 Alternative (fallback) — renderer-side one-shot

If touching the main-process load path is undesirable, an equivalent pass can run in the renderer after `stageStore` hydration, using `lux:library:list-all` (which returns `userFixtures` with `filePath` and `channels`) and applying repairs via `stageStore.updateFixture`. **Trade-offs:** runs after Aether hydration has already failed (so a re-sync is needed), and duplicates matching logic that the main process could own. Acceptable as a stopgap; the main-process placement is preferred.

---

## 4. Risk Register & Open Decisions

| ID | Item | Severity | Disposition |
|---|---|---|---|
| **D1** | Literal vs. intent reading of "wire D-Pad/Radar to `updateLiveCalibration`" | **Blocking** | Blueprint implements the *intent* reading (aim stays mechanical; offsets gain live dispatch) and adds a dedicated trim D-Pad. **Architect confirmation requested.** |
| **F3** | Spatial Gate — mechanical vs. spatial control conflict on the same `:kinetic` node | High | Mode switch + `releaseSpatialTarget` on transition (§1.1). Requires hardware verification. |
| **F2** | Missing `fixturePositions`/`fixtureIKProfiles` → spatial amnesia | High | Targeting Module sends both from `stageStore` (§1.3). |
| **R1** | `getFixture` callback identity re-running the session snapshot effect | High | §2c — key the effect on `fixtureId` only. Verify by editing offsets during unrelated fixture movement. |
| **R2** | Ambiguous profile matches in the legacy migration | High | Never auto-resolve; log and report (§3.2 step 5). |
| **R3** | Deleting `TestPanel` orphans the `lux.dmx.sendDirect` probe path | Medium | Confirm no other consumer; the raw-DMX bypass may still be wanted as a diagnostic. |
| **R4** | Deleting `OffsetPanel` orphans `lux:fixture:setOffset` / `lux:fixture:setInvert` main handlers | Low | Flag for a separate dead-IPC audit; do not remove handlers in this wave. |
| **R5** | Unsaved trim lost on fixture switch | Medium | Auto-revert with toast (§1.5). |
| **R6** | Reachability badge not deliverable | Low | Handler returns only `subTargets`; status line reserves space for a later transient-telemetry subscription. |
| **R7** | Hardcoded `⟳ ARMED` header badge is misleading | Low | Replace with real state or remove (§1.6). |

---

## 5. What Is Explicitly Not In Scope

- `InverseKinematicsEngine.ts`, `NodeResolver.ts`, and all IK math — treated as sound.
- Any new or modified IPC channel. Every dispatch in this blueprint uses an **existing** preload bridge: `aether.applySpatialTarget`, `aether.releaseSpatialTarget`, `aether.setManualOverrides`, `aether.clearManualOverrides`, `aether.updateLiveCalibration`, `arbiter.enterCalibrationMode` / `exitCalibrationMode`, `arbiter.getFixturesState`.
- The `lux:arbiter:applySpatialTarget` legacy MasterArbiter route.
- Fixture Forge / profile authoring UI (referenced only as the operator remedy in §3.4).
- The `dist-electron-backend/` build output (regenerated, never hand-edited).

---

*Blueprint complete. No code written. Phases 1–4 are independently shippable; Phase 4 may run in parallel with 1–3. Design Decision D1 requires Architect confirmation before Phase 3 begins.*
