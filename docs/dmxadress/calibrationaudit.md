Now let me read the rest of `index.tsx` to find the OFFSET CONFIG panel, and the `OffsetTrimPad` component, plus the CSS file.

Now let me read the rest of `index.tsx` (the SAVE button area) and the CSS file for the layout.

Now let me check the `useCalibrationSession` hook to see if `updateCalibration` fires any IPC for live DMX preview, and the `applySpatialTarget` IPC handler to understand why AIM works.

The sliders DO fire `window.lux?.aether?.updateLiveCalibration(...)` — throttled to 100ms. So the IPC exists. Let me trace the backend handler to find why the live DMX tick engine ignores it.

Now let me find `updateLiveCalibration` in the NodeResolver to see what it does:

Let me trace where `ikCalibration` is consumed in the resolver — this is the key to understanding why offsets work in spatial mode but not mechanical:

Let me verify the resolver's KINETIC path — does it only apply `ikCalibration` in IK/spatial mode?

Now let me find the function that calls `_getOrBuildIKProfile` at line 1750 — I need to see its name and when it's invoked:

Let me find where `_writeNodeIK` is called and where the mechanical (non-IK) pan/tilt path is:

Let me check `_applyCalibration` to see what calibration it applies in the classic (mechanical) path:

Let me trace where the `calibration` variable in the classic path comes from:

I now have the complete diagnostic picture. Here is the report.

---

# WAVE 7738 — Calibration Lab Audit: Diagnostic Report

## Bug 1: CSS Layout — Status Message Squishing the Offset Panel

### Container Hierarchy

```
.calibration-lab          (grid: auto 1fr auto, height:100%, overflow:hidden)
 └─ .lab-content           (grid: 42fr 58fr, height:100%, overflow:hidden)
    └─ .zone-targeting     (flex column, overflow-y:auto, min-height:0)
       ├─ .mode-switch             (flex-shrink: NOT SET → defaults to 1)
       ├─ .targeting-panel         (flex-shrink: NOT SET → defaults to 1) ← STATUS MESSAGE HERE
       └─ .tool-panel.offset-config (flex-shrink: 0) ← SLIDERS + SAVE BUTTON
```

### Root Cause

The `.zone-targeting` container is a flex column with `overflow-y: auto`. Its children have mixed `flex-shrink` values:

- `.targeting-radar` has `flex-shrink: 0` (line 169 of CSS) — protected
- `.offset-config` has `flex-shrink: 0` (line 868 of CSS) — protected
- **`.targeting-panel` has NO `flex-shrink` — defaults to `1`** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\CalibrationView\CalibrationView.css" lines="1222-1228" />
- **`.mode-switch` has NO `flex-shrink` — defaults to `1`** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\CalibrationView\CalibrationView.css" lines="1182-1189" />

When the user clicks "AIM TARGET", the status `<div className="targeting-status targeting-status--aimed">` is conditionally rendered at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\CalibrationView\TargetingPanel.tsx" lines="269-271" />, adding ~25px of height inside `.targeting-panel`.

The CSS flexbox algorithm runs **before** `overflow-y: auto` triggers scrolling. It sees that total content height exceeds the container, so it tries to shrink items with `flex-shrink > 0`. `.targeting-panel` (shrink=1) gets compressed, but its inner content (numeric inputs, buttons, status text) has intrinsic minimum heights and can't compress further. The algorithm partially fails, producing a visually broken layout where the panel is squeezed. The `.offset-config` (shrink=0) keeps its full height, but gets pushed down — and since `.tool-panel` has `overflow: hidden` (line 724 of CSS), the bottom of `.offset-config` (the SAVE button row) gets clipped.

### Proposed Fix

Add `flex-shrink: 0` to `.targeting-panel` and `.mode-switch` in `CalibrationView.css`:

```css
.mode-switch {
  flex-shrink: 0;   /* ADD */
  /* ...existing... */
}

.targeting-panel {
  flex-shrink: 0;   /* ADD */
  /* ...existing... */
}
```

This makes all children of `.zone-targeting` non-shrinkable. When the status message appears, the container's `overflow-y: auto` will correctly produce a scrollbar instead of compressing any panel. The `.offset-config` panel will never be pushed off-screen or clipped.

---

## Bug 2: Live DMX — Offset Sliders Don't Send DMX in Mechanical Mode

### The IPC Path IS Wired (Surprise Finding)

Contrary to the bug report's assumption, the offset sliders **DO fire an IPC call**. The chain is:

1. Slider `onChange` → `updateCalibration({ panOffset: ... })` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\CalibrationView\index.tsx" lines="979-980" />
2. `updateCalibration` in the hook fires `window.lux?.aether?.updateLiveCalibration(...)` — throttled to 100ms <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\CalibrationView\useCalibrationSession.ts" lines="108-124" />
3. IPC handler `lux:aether:updateLiveCalibration` calls `resolver.updateLiveCalibration(nodeId, calibration)` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="1312-1330" />
4. `NodeResolver.updateLiveCalibration` mutates `node.ikCalibration` (degree domain) and invalidates `_ikProfiles` cache <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="476-497" />

### Root Cause: Two Disjoint Calibration Systems

The resolver has **two completely separate pan/tilt resolution paths** that use **two different calibration objects**:

**Path A — IK/Spatial mode** (when `targetX` is present in channel values):
- `_writeNodeIK()` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1296-1298" />
- Calls `_getOrBuildIKProfile()` which reads `node.ikCalibration` (degree domain) at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="2110-2115" />
- **This is why AIM TARGET works** — it sets `targetX/Y/Z` via `applySpatialTarget`, routing through the IK path, which consumes `node.ikCalibration`.

**Path B — Classic/Mechanical mode** (no `targetX`, pan/tilt from manual overrides):
- The classic channel loop at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1340-1409" />
- Uses `const calibration = device.calibration` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1278" /> — this is `IDeviceCalibration` (DMX-domain, 0-255 offsets)
- Calls `_applyCalibration()` which reads `calibration.panOffset` / `calibration.tiltOffset` in **DMX steps** at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="2443-2465" />
- **This path NEVER reads `node.ikCalibration`** — the degree-domain offsets written by `updateLiveCalibration` are invisible to it.

The `device.calibration` object is only updated when `apply()` is called (SAVE button) → `updateFixture()` → stageStore → ShowFile → F1 sync → NodeGraph device re-registration. That's why SAVE works but live drag doesn't.

In summary:
- `updateLiveCalibration` writes to **`node.ikCalibration`** (degrees)
- Mechanical mode reads **`device.calibration`** (DMX steps)
- These are two different objects in two different domains, and nothing bridges them during live editing

### Proposed Fix

The cleanest fix is to extend `NodeResolver.updateLiveCalibration` to **also update `device.calibration`** with DMX-domain offsets, converting from degrees using the node's pan/tilt range. The conversion is:

```
dmxOffset = round(degrees / panRangeDeg * 255)
```

In `NodeResolver.updateLiveCalibration` (line 476), after mutating `node.ikCalibration`, also mutate the device's calibration:

```typescript
// Convert degree-domain offsets to DMX-domain for the classic path
const device = this._graph.getDevice(node.deviceId)
if (device && device.calibration) {
  const panRange = node.ikLimits?.panRangeDeg ?? 540
  const tiltRange = node.ikLimits?.tiltRangeDeg ?? 270
  ;(device.calibration as any).panOffset = Math.round(calibration.panOffset / panRange * 255)
  ;(device.calibration as any).tiltOffset = Math.round(calibration.tiltOffset / tiltRange * 255)
  ;(device.calibration as any).invertPan = calibration.panInvert
  ;(device.calibration as any).invertTilt = calibration.tiltInvert
}
```

This way, the classic path at line 1278 (`const calibration = device.calibration`) picks up the live offsets on the very next frame, and `_applyCalibration` at line 1409 applies them to the DMX output — producing immediate live preview in mechanical mode.

**Alternative approach** (if mutating `device.calibration` in the hot path is deemed too invasive): In the `useCalibrationSession` hook's `updateCalibration` callback, after sending `updateLiveCalibration`, also re-fire `setManualOverrides` with the current pan/tilt values plus the offset applied. This would use the existing working DMX path but requires the hook to know the current pan/tilt position, which it currently doesn't — making it more complex than the resolver fix.