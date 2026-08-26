Let me find all the hardcoded fallbacks and start the audit subagent in parallel:

Now I have all the locations. Let me update them all. I'll skip test files (they have their own fixtures) and focus on production code:

Now update the dev console reset in main.tsx:

Now let me also check the VisualizerCanvas for SAFE_FALLBACK constants:

Those are crash-safety fallbacks (value=1), not default stage sizes — they're fine as-is. Now typecheck:

Typecheck clean. Now let me wait for the audit subagent:

Audit complete. Let me mark the todo and present the full report:

---

## WAVE 7609: GIANT STAGE & CALIBRATION FLOW AUDIT

### Part 1: Giant Crystal Box — DONE

Default stage dimensions updated from **12×8×6m** → **50×25×15m** across 11 files:

| File | Change |
|------|--------|
| `ShowFileV2.ts:1231` | `createEmptyShowFile()` default |
| `ShowFileMigrator.ts:100` | `STAGE_REF` migration reference |
| `HyperionTruss.tsx:92` | Truss fallback props |
| `NeonFloor.tsx:45` | Floor fallback props |
| `CrystalEdges.tsx:33` | Crystal box visual fallback |
| `ErebusShell.tsx:51` | Stage width/depth extraction |
| `useFixtureData.ts:199` | Tactical canvas fallback |
| `TacticalCanvas.tsx:235` | Tactical ruler fallback |
| `MeasureLayer3D.tsx:80` | Measure tool clamp fallback |
| `RigSystem.tsx:97,203` | Rig placement clamp + max height |
| `SpatialGuides.tsx:68` | Spatial guide dimensions |
| `FixtureInspector.tsx:55` | Manual coordinate clamp fallback |
| `main.tsx:38` | Dev console reset default |

Typecheck clean. New shows now get 50×25×15m. Existing shows keep their stored dimensions. The dev console `__lux.setStage()` can override at runtime.

---

### Part 2: Calibration Pipeline Audit — CRITICAL FINDINGS

#### The Pipeline (as designed):

```
OffsetTrimPad slider
    │  onChange(pan, tilt)
    ▼
useCalibrationSession.updateCalibration()
    │  1. Updates liveCalibration state
    │  2. Throttled 100ms → invalidateIKProfile(nodeId)
    │  3. On "Apply" → updateFixture(id, { calibration })
    ▼
stageStore.updateFixture()
    │  Writes FixtureV2.calibration { panOffset, tiltOffset, panInvert, tiltInvert }
    │  Debounced save to disk (2s)
    ▼
FixtureHydrationEngine._syncFixturesToAether()
    │  extract(fixtureDef, fixtureV2)
    │  v2CalibOverride = fixtureV2.calibration
    │  calibration = _buildCalibration(fixtureDef, v2CalibOverride)
    │  → IDeviceCalibration { invertPan, invertTilt, panOffset, tiltOffset }
    ▼
NodeResolver._getOrBuildIKProfile()
    │  profile = buildProfile(..., calibration, ...)
    │  Uses: node.ikCalibration ?? { panOffset: 0, tiltOffset: 0, panInvert, tiltInvert }
    ▼
solveInto() → IKResult → AetherSafetyMiddleware → DMX buffer
```

#### The Pipeline (as actually runs):

**THREE CRITICAL GAPS FOUND:**

##### GAP 1: `node.ikCalibration` is NEVER populated

`NodeExtractionPipeline._buildKineticNode()` builds the kinetic node with `ikOrientation` and `ikLimits` but **never sets `ikCalibration`**. The field is always `undefined`.

**Effect:** In `NodeResolver._getOrBuildIKProfile()` (line 1779), the fallback kicks in:
```typescript
node.ikCalibration ?? {
  panOffset:  0,     // ⚠️ ALWAYS 0 — calibration offsets never reach IK
  tiltOffset: 0,     // ⚠️ ALWAYS 0
  panInvert:  calibration?.invertPan  ?? false,  // ✅ Works (from IDeviceCalibration)
  tiltInvert: calibration?.invertTilt ?? false,  // ✅ Works
}
```

**Result:** Pan/tilt **invert flags work**, but **offsets are always zero**. The IK solver never sees the calibration trim.

##### GAP 2: Unit mismatch between layers

| Layer | Field | Unit |
|-------|-------|------|
| `FixtureV2.calibration.panOffset` | Show file | **degrees** |
| `IDeviceCalibration.panOffset` | Device | **DMX units** |
| `IKFixtureProfile.calibration.panOffset` | IK engine | **degrees** |

Even if Gap 1 were fixed by passing `IDeviceCalibration.panOffset` to the IK profile, the values would be in **DMX units** while the IK engine expects **degrees**. The IK engine applies offsets in the degree domain (line 268):
```typescript
let calibratedPanDeg = panDeg + fixture.calibration.panOffset  // expects degrees
```

##### GAP 3: `invalidateIKProfile()` doesn't update node data

When the user drags the calibration slider, `useCalibrationSession` calls `window.lux?.aether?.invalidateIKProfile({ nodeId })`. This clears the **profile cache** in NodeResolver, forcing a rebuild on the next frame.

**But:** The rebuild reads from `node.ikCalibration` which is still `undefined` (Gap 1). The cache invalidation works, but the rebuilt profile still has zero offsets. The node data itself is stale — it was set at patch time and never updated.

**Full re-patch required:** To actually propagate new calibration to the IK solver, the fixture must be re-extracted through `NodeExtractionPipeline.extract()`, which only happens on `setFixtures` IPC or show file load.

#### Is the path secure?

**YES** — `AetherSafetyMiddleware` is in the path:
- `clampKineticVelocityInto()` — velocity limiting per vibe preset
- `applyAirbag()` — 5 DMX margin from mechanical limits

The `HardwareSafetyLayer` (`hal/translation/HardwareSafetyLayer.ts`) is a **separate layer** that only handles color wheel debounce for mechanical fixtures — it is NOT in the calibration path.

#### Are moving heads receiving live DMX when sliders move?

**NO** — Calibration offset changes do NOT produce live DMX updates. The invert flags work (they're read from `IDeviceCalibration` at profile build time), but the offset trim values are lost. The moving heads will respond to target changes but will NOT respond to calibration trim adjustments.

#### Legacy CalibrationView

`src/components/views/CalibrationView/index.tsx` (1053 lines) is a separate legacy view with its own state management. It also calls `updateFixture(id, { calibration })` — same store path, same broken pipeline.

---

### Diagnostic Summary

| Pipeline Segment | Status | Notes |
|-----------------|--------|-------|
| UI → `useCalibrationSession` | ✅ Working | Slider → state → store |
| `useCalibrationSession` → `stageStore.updateFixture` | ✅ Working | Persisted to show file |
| `stageStore` → `FixtureHydrationEngine` | ✅ Working | Re-patch on show load |
| `FixtureHydrationEngine` → `IDeviceCalibration` | ✅ Working | Invert flags + offsets merged |
| `IDeviceCalibration` → `node.ikCalibration` | ❌ **BROKEN** | Node never gets calibration |
| `node.ikCalibration` → `IKFixtureProfile.calibration` | ❌ **BROKEN** | Falls back to offset=0 |
| `IKFixtureProfile` → `solveInto()` → DMX | ✅ Working | Math is correct, just gets wrong input |
| `AetherSafetyMiddleware` in path | ✅ Secure | Velocity + airbag applied |
| `invalidateIKProfile()` on slider drag | ⚠️ Partial | Cache cleared but node data stale |
| Live DMX on calibration change | ❌ **NO** | Offsets don't reach IK |

### What DOES work today
- **panInvert / tiltInvert** — These are read from `IDeviceCalibration.invertPan/invertTilt` in the fallback, so axis inversion works
- **Calibration persistence** — Values are saved to the show file correctly
- **Profile cache invalidation** — The throttle + invalidate mechanism works mechanically

### What DOESN'T work today
- **panOffset / tiltOffset** — Always treated as 0 by the IK solver
- **Live trim feedback** — Adjusting sliders does not move the fixtures
- **Unit coherence** — Even if wired, degrees vs DMX units would produce wrong results

**Recommendation for tomorrow's warehouse test:** The calibration trim UI will NOT affect the moving heads. Aiming must be done via target XYZ only. The fix requires populating `node.ikCalibration` in `NodeExtractionPipeline._buildKineticNode()` with degree-domain values from `FixtureV2.calibration`, plus triggering a node data refresh (not just cache invalidation) when calibration changes.