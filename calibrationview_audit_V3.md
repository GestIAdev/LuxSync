# Calibration Lab Forensic Audit — V3

**Directive:** WAVE 7665-EREBUS-CALIB-LAB-AUDIT
**Role:** Forensic React/DMX Auditor (GLM)
**Mode:** STRICTLY READ-ONLY — no code modified
**Date:** 2026-08-27
**Scope:** Map `CalibrationView` (the upgrade target) and `CalibrationDock` (the legacy component being deprecated), document internal wiring, IPC dispatch, state dependencies, and the broken fixture-path resolution.

---

## 0. File Inventory

| Component | Path | Status |
|---|---|---|
| **CalibrationView** (new core) | `electron-app/src/components/views/CalibrationView/index.tsx` | 1053 lines, monolithic |
| RadarXY (sub, **unused**) | `electron-app/src/components/views/CalibrationView/components/RadarXY.tsx` | Orphaned — see §1.4 |
| FixtureList (sub, **unused**) | `.../CalibrationView/components/FixtureList.tsx` | Orphaned |
| TestPanel (sub, **unused**) | `.../CalibrationView/components/TestPanel.tsx` | Orphaned (raw-DMX path) |
| OffsetPanel (sub, **unused**) | `.../CalibrationView/components/OffsetPanel.tsx` | Orphaned (legacy `lux:fixture:setOffset` IPC) |
| components barrel | `.../CalibrationView/components/index.ts` | Exports 4 subs, none imported by index.tsx |
| **CalibrationDock** (legacy) | `electron-app/src/components/views/erebus/calibration/CalibrationDock.tsx` | 136 lines, assembler |
| useCalibrationSession | `.../erebus/calibration/useCalibrationSession.ts` | Session hook (213 lines) |
| OffsetTrimPad | `.../erebus/calibration/OffsetTrimPad.tsx` | 2D offset pad |
| AxisPolarityToggles | `.../erebus/calibration/AxisPolarityToggles.tsx` | Invert switches |
| CalibrationTargetMini | `.../erebus/calibration/CalibrationTargetMini.tsx` | **Spatial X/Y/Z target pad** |
| CalibrationFixtureList | `.../erebus/calibration/CalibrationFixtureList.tsx` | IK-eligible filter |

> **Key finding up front:** `CalibrationView/index.tsx` does **NOT** import any of its own `components/` barrel exports. The radar, fixture list, test panel, and offset panel are all reimplemented **inline** in the monolithic `index.tsx`. The four subcomponents in `components/` are dead code from WAVE 425 that were superseded by the inline rewrite (WAVE 1135+). Only the inline implementation is live.

---

## 1. CalibrationView — The New Core

### 1.1 Component Tree (as actually rendered)

`CalibrationView` is a single 1053-line FC with no child component imports. The tree is flat JSX inside one return:

```
<div.calibration-lab>
├── <header.lab-header>                      // Title + active fixture badge
│     ├── TargetIcon + "CALIBRATION LAB"
│     └── fixture name · DMX addr · "ARMED" badge
│
├── <div.lab-content>                        // Dual-zone layout
│   ├── <div.zone-targeting>                 // LEFT ~42%
│   │   ├── <div.targeting-radar>            // INLINE radar (NOT RadarXY.tsx)
│   │   │   ├── radar-grid (rings + cross + diagonals)
│   │   │   ├── radar-interactive (mouseDown drag → handleRadarChange)
│   │   │   └── radar-cursor (positioned via normalizedPan/Tilt)
│   │   ├── <div.quick-position>             // 9-button D-Pad + step selector
│   │   ├── <div.position-data>              // Pan/Tilt bars + degree readouts
│   │   └── <div.tool-panel.offset-config>   // Pan/Tilt offset sliders + invert toggles + SAVE/RESET
│   │
│   └── <div.zone-channels>                  // RIGHT ~58%
│       ├── <div.tool-panel.fixture-rack>    // FIXTURE RACK (allFixtures from stageStore)
│       └── <div.tool-panel.channel-grid-panel>  // DMX CHANNEL GRID (per-channel sliders)
│
└── <footer.lab-actions>                     // BLACKOUT / STROBE / COLOR / GOBO / FULL ON
```

There is **no D-Pad subcomponent** — the 9-button `quick-position` grid and the radar are inline JSX. There is **no polar radar component** — `RadarXY.tsx` exists but is never imported. There is **no slider subcomponent** — channel sliders are inline `<input type="range">`.

### 1.2 State & IPC — How Pan/Tilt reaches the engine

#### 1.2.1 Store connections
```
useStageStore  → stageFixtures, updateFixture        // SOURCE OF TRUTH (not truthStore)
useSelectionStore → selectedIds, select, deselectAll
useKeyMapStore  → isArmed (defers keys to KeyForge when armed)
```

#### 1.2.2 Local state
| State | Type | Purpose |
|---|---|---|
| `pan` / `tilt` | number (degrees) | Current aim, clamped to `SAFE_PAN_MAX=513` / `SAFE_TILT_MAX=256` (95% motor protection) |
| `step` | 1/5/15/45 | Degrees per D-Pad nudge |
| `activeTest` | string\|null | Sticky test button (blackout/strobe/gobo/color/full) |
| `channelValues` | `Record<idx, 0-255>` | Multi-channel concurrent DMX grid state |
| `panOffset/tiltOffset/panInvert/tiltInvert` | number/bool | Offset config (persisted to fixture.calibration) |
| `saveStatus` | idle/saving/saved/error | Save-button feedback |

#### 1.2.3 The Pan/Tilt HAL bridge — `sendPosition()`
The D-Pad and radar do **NOT** use `updateLiveCalibration`. They use the **Aether manual-override bridge**:

```ts
// index.tsx:383-409  sendPosition()
const panNorm  = safePan / SAFE_PAN_MAX   // normalize 0-1
const tiltNorm = safeTilt / SAFE_TILT_MAX
await window.lux?.aether?.setManualOverrides([{
  nodeId: `${activeFixtureId}:kinetic`,
  channels: { pan: panNorm, tilt: tiltNorm },
}])
```

- **Bridge:** `window.lux.aether.setManualOverrides` (renderer→preload→main `AetherIPCHandlers`).
- **Node family:** `:kinetic` (pan/tilt live aim).
- **Normalization:** degrees → 0-1 using SAFE limits, matching `KineticsBridge`.
- **Gate immunity:** Comment cites WAVE 4680 — NodeArbiter L2 KINETIC overrides bypass the Smart Gate when `outputEnabled=false` (Move-in-Black).

#### 1.2.4 The DMX channel grid bridge — `sendDMX()`
Each channel slider routes through the **same** `setManualOverrides` bridge but maps `channelType` → Aether family:
```
pan/tilt/speed        → :kinetic
dimmer/strobe/shutter → :impact
red/green/blue/white/amber/uv/color_wheel → :color
(default)             → :beam
```
Payload: `nodeId: ${fixtureId}:${family}`, `channels: { [channelType]: normValue }` (0-1).

> **This is a different bridge than `CalibrationDock` uses.** The Dock uses `window.lux.aether.updateLiveCalibration` (IK profile mutation). The Lab uses `setManualOverrides` (live output injection). They serve different purposes: Lab = "drive the head now", Dock = "bend the IK math".

#### 1.2.5 Calibration-mode lifecycle (cold DMX path)
`useEffect` on `activeFixtureId` (index.tsx:294-346):
- **Enter:** `electron.ipcRenderer.invoke('lux:arbiter:enterCalibrationMode', { fixtureId })` — enables per-fixture output even when ARMED=false.
- **Exit (cleanup):** `invoke('lux:aether:clearManualOverrides', [${id}:color, ${id}:impact, ${id}:kinetic])` then `invoke('lux:arbiter:exitCalibrationMode', { fixtureId })`. WAVE 4949 forces override cleanup so calibration colors don't persist into the Vibe.

#### 1.2.6 Hydration on fixture change
`useEffect` on `[activeFixtureId, channels]` (index.tsx:223-268):
- Calls `arbiter.getFixturesState([activeFixtureId])` (via `window.luxsync?.arbiter ?? window.lux?.arbiter`).
- `buildHydratedChannelValues()` reverse-maps engine state (dimmer/color/pan/tilt/zoom/focus) back to per-channel DMX 0-255 using the fixture's channel types.
- Seeds `pan`/`tilt` from `result.state.pan/tilt` if present.

#### 1.2.7 Offset persistence
`handleSaveOffsets()` (index.tsx:562-596) writes via **`stageStore.updateFixture`** (not IPC):
```ts
updateFixture(activeFixtureId, { calibration: { panOffset, tiltOffset, panInvert, tiltInvert } })
```
This persists to the ShowFile on disk. **It does NOT call `updateLiveCalibration`** — offsets are stored but the IK resolver is not notified live (unlike the Dock, which does both).

#### 1.2.8 Keyboard shortcuts
Global `keydown` listener (index.tsx:613-663). WASD/arrows → `handleQuickPosition`; Q/E/Z/C → diagonals; Space → center; B → blackout; F → full; 1-9 → fixture select; Tab → next fixture. **All deferred to KeyForge when `useKeyMapStore.getState().isArmed`** (operator may have remapped keys for show control).

### 1.3 Broken Path — Fixture Rack / Channel Grid

**Symptom:** The fixture rack lists fixtures but the channel grid shows "No channels" for fixtures whose profile was defined under the old folder structure.

**Root cause — WAVE 7605 "SCORCHED EARTH" library restructure:**

1. **Old structure (pre-7605):** Factory library at `resources/librerias/` (`.fxt` files), custom at `userData/fixtures/custom/`. A PATHFINDER scanned 3 candidate roots. Show files stored `definitionPath` pointing at `.fxt` files and `profileId` set to the system ID (e.g. `EL_1140`).

2. **New structure (7605):** Single path `userData/fixtures/` (`.json` only, no `.fxt` in live scan). `factoryLibPath === customLibPath === userData/fixtures/`. The `RuntimeFixtureLibrary` map is populated exclusively from `setRuntimeFixtureLibrary(results)` where `results` come from `rescanAllLibraries()` scanning `userData/fixtures/**/*.json` (skipping legacy `factory/` and `custom/` subfolders).

3. **The failure chain:**
   - `CalibrationView` reads `activeFixture.channels` **directly from `stageStore`** (index.tsx:214-221):
     ```ts
     const channels = useMemo(() => activeFixture?.channels?.map(...) ?? [], [activeFixture])
     ```
   - `stageStore` fixtures carry `channels` inline **only if** they were hot-reloaded (WAVE 384, stageStore.ts:966) or hydrated by the backend's `FixtureProfileResolver`.
   - `FixtureProfileResolver.resolveFixtureDefinitionForAether()` (FixtureProfileResolver.ts:17-47) calls `resolveRuntimeFixtureDefinition([profileId, definitionId, fixtureDefId, definitionPath, model, name])`.
   - `resolveRuntimeFixtureDefinition` (RuntimeFixtureLibrary.ts:57-71) looks up the `runtimeFixtureLibraryNormalized` map by id / basename / stem (case-insensitive).
   - **For legacy show fixtures:** `definitionPath` is a stale `.fxt` path (e.g. `resources/librerias/factory/EL_1140.fxt`) and `profileId` is the old system ID. Neither matches any `userData/fixtures/*.json` entry's id/basename/stem → lookup returns `undefined`.
   - The fallback at FixtureProfileResolver.ts:33 only fires if `fixture.channels` is **already** a non-empty inline array. Show files migrated by `ShowFileMigrator` (ShowFileMigrator.ts:286-293) set `profileId: oldFix.filePath` and `definitionPath: oldFix.filePath` but do **not** inline channels — they rely on runtime resolution.
   - Result: `activeFixture.channels` is undefined/empty → `channels` memo is `[]` → channel grid renders `<div.empty-state>"No channels"</div>` and `sendDMX`/`resetAllChannels` are no-ops.

4. **Exact failure point:** `RuntimeFixtureLibrary.resolveRuntimeFixtureDefinition()` → normalized-key miss for legacy `definitionPath`/`profileId` strings. The rack itself still works (it only needs `fixture.id/name/address` from stageStore), but the channel grid is dead for any fixture whose profile wasn't re-resolved under the new single-path library.

5. **Confirmation in docs:** `docs/tutoriales/rutaslibreriasfixtures.md` documents the 7605 deletion of the PATHFINDER, factory seeding, and `.fxt` live scanning — confirming the path contract changed but show-file `definitionPath`/`profileId` fields were not migrated.

> **Migration implication for the Lab upgrade:** Before the Lab becomes the primary tool, legacy show fixtures need a one-time `definitionPath`/`profileId` reconciliation pass (re-resolve against `userData/fixtures/*.json`, or inline `channels` into the show file). Otherwise the upgraded Lab inherits the dead channel grid for all pre-7605 shows.

### 1.4 Targeting Capability — Spatial vs. Mechanical

**`CalibrationView` is purely mechanical.** It has **no X/Y/Z spatial inputs**:
- The radar maps mouse X→Pan degrees (0-513°), mouse Y→Tilt degrees (0-256°).
- The D-Pad nudges Pan/Tilt by `step` degrees.
- The offset config adjusts `panOffset`/`tiltOffset` (mounting compensation) and `panInvert`/`tiltInvert` (polarity).
- There is **no `applySpatialTarget` call**, no `referenceTarget` concept, no elevation/depth/height field.

The spatial targeting capability (X/Y/Z → IK) lives **exclusively in `CalibrationDock`** via `CalibrationTargetMini` (see §2.3). This is the single most important gap to close when upgrading the Lab: the Lab currently cannot aim a head at a 3D point — it can only command raw Pan/Tilt degrees.

### 1.5 Orphaned Subcomponents (dead code in `components/`)

| File | Why dead | Notes |
|---|---|---|
| `RadarXY.tsx` | Inline radar in index.tsx supersedes it | Has its own `SAFE_PAN_MAX`/`SAFE_TILT_MAX` constants (duplicated) |
| `FixtureList.tsx` | Inline fixture-rack in index.tsx supersedes it | Uses emoji icons vs inline's `LuxIcons` |
| `TestPanel.tsx` | Inline footer + channel grid supersede it | **Uses a DIFFERENT bridge:** `window.lux.dmx.sendDirect(universe, absAddr, value)` — raw DMX bypass, no Arbiter. This is the WAVE 1008 raw-hardware probe path, abandoned in favor of the Aether `setManualOverrides` path. |
| `OffsetPanel.tsx` | Inline offset-config supersedes it | **Uses legacy IPC:** `electron.ipcRenderer.invoke('lux:fixture:setOffset', ...)` and `lux:fixture:setInvert` — these handlers' existence in the main process was NOT verified in this audit and may themselves be dead. |

> The `components/index.ts` barrel still exports all four. Any migration blueprint should treat these as deletable unless the raw-DMX `TestPanel` probe path is intentionally revived.

---

## 2. CalibrationDock — The Legacy Component

### 2.1 Role & Mount Condition
Floating satellite `<aside>` rendered only when `toolMode === 'calibrate'` (per header comment). Assembles four subcomponents plus Apply/Revert/Reset actions.

### 2.2 State Entanglement — what mutates if we delete the targeting pads

#### 2.2.1 Stores touched
| Store | Field | Read/Write | Via |
|---|---|---|---|
| `useStageStore` | `fixtures` | Read | direct selector |
| `useStageStore` | `updateFixture` | **Write** | `useCalibrationSession.apply()` → persists `calibration` object |
| `useSelectionStore` | `selectedIds` | Read | fallback for `activeFixtureId` |
| `useLibraryStore` | `dmxStatus.connected` | Read | WAVE 7662 live-DMX indicator |

#### 2.2.2 `useCalibrationSession` hook — the session state machine
The Dock delegates all calibration logic to `useCalibrationSession(fixtureId, getFixture, updateFixture)` which returns:
```
{ session, liveCalibration, updateCalibration, setReferenceTarget, apply, revert, reset }
```

- **`session`** (local useState, NOT a global store): `{ fixtureId, referenceTarget: {x,y,z}, snapshot: CalibrationData|null, isDirty }`.
- **`liveCalibration`** (local useState): `{ panOffset, tiltOffset, panInvert, tiltInvert }` — the working buffer.

> **Critical:** The session state is **entirely local to the Dock**. It is NOT in `useCalibrationSession` as a global store — it's a hook instance scoped to the Dock's mount. Deleting the Dock's targeting pads does **not** orphan any global store variable. The only global mutation is `updateFixture(id, { calibration })` on `apply()`, which writes to `stageStore` → ShowFile.

#### 2.2.3 IPC dispatched by the hook
Every calibration mutation (live update, apply, revert, reset) calls the **same** bridge — `window.lux.aether.updateLiveCalibration`:
```ts
// useCalibrationSession.ts:112-120, 148-156, 168-176, 187-190
window.lux?.aether?.updateLiveCalibration({
  nodeId: `${fixtureId}:kinetic`,
  calibration: { panOffset, tiltOffset, panInvert, tiltInvert },
})
```
- **Live updates** are throttled to 100ms (`invalidateTimerRef`) per blueprint §4.5.
- This bridge **mutates `node.ikCalibration` in-place and invalidates the IK profile cache** so the next TickEngine frame uses the new offsets (WAVE 7610). This is the IK-resolver path — distinct from the Lab's `setManualOverrides` output-injection path.

#### 2.2.4 What breaks if we delete the Dock's targeting pads
- **`CalibrationTargetMini`** calls `window.lux.aether.applySpatialTarget({ target, fixtureIds, fanMode:'converge', fanAmplitude:0 })` (CalibrationTargetMini.tsx:39-44). This is the **only** spatial-target IPC in the calibration surface. Deleting it removes the ability to aim a head at a 3D point from the calibrate tool — which is exactly why the Lab must absorb this capability.
- **`setReferenceTarget`** only updates the local `session.referenceTarget` and `isDirty` flag. No global store, no IPC by itself (the IPC fires from `CalibrationTargetMini`'s pointer handlers, not from the setter). Safe to remove.
- **`OffsetTrimPad` + `AxisPolarityToggles`** mutate `liveCalibration` → `updateCalibration` → `updateLiveCalibration` IPC. Removing them removes the live IK-offset trim UI. The Lab's inline offset sliders already cover offset storage but **do not** call `updateLiveCalibration` (see §1.2.7 gap).
- **Apply/Revert/Reset** persist to `stageStore` via `updateFixture`. The Lab's SAVE button already does this. Revert (snapshot restore) has **no Lab equivalent**.

### 2.3 Portability — what's worth salvaging

| Dock piece | Salvage? | Reason / port notes |
|---|---|---|
| **`CalibrationTargetMini`** | **YES — highest priority** | The only spatial X/Y/Z targeting UI. Pad maps X (left/right, ±5m), Z (depth, ±5m), Y (elevation 0-6m) → `applySpatialTarget`. Has precision numeric inputs (WAVE 7662). This is the capability the Lab must gain to replace the deprecated 2D/3D pad concept. |
| **`AxisPolarityToggles`** | YES — already partially duplicated | The Lab has inline `panInvert`/`tiltInvert` toggle buttons, but they only flip local state. The Dock's toggles flow through `updateCalibration` → `updateLiveCalibration` (live IK polarity). Port the live-IPC wiring, not the UI (UI already exists inline). |
| **`OffsetTrimPad`** | MAYBE — UI redundant, wiring valuable | 2D drag pad for pan/tilt offset (±30°, 0.5° snap). The Lab's inline sliders cover the same range (-180/+180 pan, -90/+90 tilt) with broader range. The Dock's pad is more tactile for fine trim. The valuable part is the `updateLiveCalibration` throttle (100ms) — the Lab's sliders currently have no live-IPC feedback. |
| **`useCalibrationSession`** | YES — the session model | Apply/Revert/Reset + snapshot + dirty-tracking + throttled live IK invalidation. The Lab has only SAVE (no revert, no snapshot, no live IK push). Porting this hook (or its logic) into the Lab gives the Lab proper session semantics. |
| **`CalibrationFixtureList`** | NO — redundant | IK-eligible filter (`moving-head/scanner/spot` + `enabled`). The Lab's inline rack shows ALL fixtures (intentional, for debugging). If the Lab should filter to IK-eligible, port the filter predicate, not the component. |
| **DMX LIVE/OFFLINE indicator** | YES — small but useful | Reads `libraryStore.dmxStatus.connected`. The Lab has no DMX-connection feedback; it silently no-ops when DMX is offline. |
| **Apply/Revert/Reset actions** | YES — via the session hook | See `useCalibrationSession` row. |

### 2.4 Dock → Lab capability gap matrix

| Capability | Dock | Lab (current) | Migration target |
|---|---|---|---|
| Raw Pan/Tilt degrees aim | ❌ | ✅ `setManualOverrides:kinetic` | Keep in Lab |
| Spatial X/Y/Z target aim | ✅ `applySpatialTarget` | ❌ | **Port from Dock** |
| Live IK offset push (throttled) | ✅ `updateLiveCalibration` | ❌ (only persists) | **Port from Dock hook** |
| Offset persistence | ✅ `updateFixture` | ✅ `updateFixture` | Already in Lab |
| Polarity invert (live) | ✅ via `updateCalibration` | ⚠️ local-only toggle | Wire to `updateLiveCalibration` |
| Session snapshot/revert | ✅ | ❌ | **Port `useCalibrationSession`** |
| Per-channel DMX grid | ❌ | ✅ `setManualOverrides` per family | Keep in Lab |
| Calibration-mode enter/exit | ❌ | ✅ `enterCalibrationMode` IPC | Keep in Lab |
| Test actions (strobe/gobo/color) | ❌ | ✅ inline footer | Keep in Lab |
| DMX connection indicator | ✅ | ❌ | Port |
| Fixture filtering (IK-eligible) | ✅ | ❌ (shows all) | Decide policy |

---

## 3. Architectural Summary for the Blueprint

1. **The Lab is mechanically complete but spatially blind.** It drives Pan/Tilt degrees and per-channel DMX via `setManualOverrides`, but cannot aim at a 3D point. The Dock's `CalibrationTargetMini` + `applySpatialTarget` is the only spatial path and must be absorbed.

2. **Two distinct Aether bridges are in play, never unified:**
   - Lab: `setManualOverrides` (live output injection, Gate-immune).
   - Dock: `updateLiveCalibration` (IK profile mutation + cache invalidation, 100ms throttle).
   The upgraded Lab must own **both**: `setManualOverrides` for live aim/probe, `updateLiveCalibration` for offset/polarity that bends the IK math.

3. **The Lab persists offsets but doesn't push them live.** `handleSaveOffsets` writes `stageStore` only. The Dock's `useCalibrationSession` pushes live via `updateLiveCalibration` on every change. The Lab must adopt the session hook's live-push + revert semantics.

4. **The broken channel grid is a data-migration issue, not a UI bug.** Pre-WAVE-7605 show fixtures carry stale `definitionPath`/`profileId` that no longer resolve against `userData/fixtures/*.json`. The Lab reads `activeFixture.channels` from stageStore, which is empty when profile resolution fails. A reconciliation pass (re-resolve or inline channels) is a prerequisite for the Lab to function as primary tool on legacy shows.

5. **Four subcomponents in `CalibrationView/components/` are dead code** (RadarXY, FixtureList, TestPanel, OffsetPanel). `TestPanel` uses an abandoned raw-DMX bridge (`lux.dmx.sendDirect`); `OffsetPanel` uses legacy `lux:fixture:setOffset` IPC. They should be deleted or explicitly revived — not left as traps.

6. **No global store state is orphaned by deleting the Dock's pads.** Session state is local to `useCalibrationSession`; the only global write is `updateFixture` on Apply, which the Lab already performs. The migration is additive (port capabilities in) rather than subtractive (no fragile global teardown required).

---

*End of audit. No code was modified. This document is the architectural map for Opus's migration blueprint.*
