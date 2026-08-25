Let me re-read the current render loop to understand the exact transform state:

Now I understand the current state. The transform is `screen = world * zoom + pan` with top-left origin. For centering, I need the stage center (`0.5*canvasW` in world space) to map to canvas center (`canvasW/2`) at zoom=1, pan=0, and zoom should scale around canvas center.

The cleanest approach: move the grid INTO the world-space transform (so it draws at world-space cell sizes, and `ctx.scale` handles zoom scaling). This eliminates the dual coordinate systems.

Let me rewrite the render loop with centering:

Now update the mouse handler's inverse transform for the centered origin:

Now update the GridLayer — since it's now drawn inside the world-space transform, it should use world-space cell sizes (no zoom scaling needed, `ctx.scale` handles that):

Now the Erebus Builder audit. Let me read the key coordinate files in parallel:

Now let me check the `clampToCrystalBox` function to understand the clamping behavior:

Let me check `computePlanarPlacement` and the `placeFixture2D` flow:

Now let me typecheck before writing the audit report:

Both typechecks clean. Here's the complete report:

---

## WAVE 7602: Centered Origin + Erebus Audit

### Part 1: Centered Tactical Canvas Origin

**Transform chain** (applied right-to-left to world coords):
```
ctx.translate(cx + panX, cy + panY)   // 3. move to canvas center + pan
ctx.scale(zoom, zoom)                 // 2. zoom around origin
ctx.translate(-cx, -cy)               // 1. move stage center to origin
```

Where `cx = canvasWidth/2`, `cy = canvasHeight/2`.

**Result**: `screen = (world - canvasCenter) * zoom + canvasCenter + pan`

| State | Behavior |
|-------|----------|
| zoom=1, pan=0 | `screen = world` — stage center at canvas center |
| zoom=2, pan=0 | Scales around canvas center — symmetric reveal |
| zoom=0.5, pan=0 | Zoom out — extra space appears symmetrically |
| zoom=1, pan={50,0} | Pan right — stage shifts right |

**Grid moved into world space**: The grid now draws INSIDE the ctx transform (not in screen space). Cell size is `CELL_SIZE` world units (40px at zoom=1). `ctx.scale(zoom)` handles screen scaling automatically — no manual `* zoom` needed. Viewport bounds limit drawing to visible world space.

**Mouse inverse-transform updated**:
```typescript
worldX = (msg.x - cx - panX) / zoom + cx
worldY = (msg.y - cy - panY) / zoom + cy
```

### Part 2: Erebus Builder Coordinate Audit

#### Coordinate System Summary

| Property | Erebus Builder | Tactical Canvas (post-WAVE 7602) |
|----------|----------------|----------------------------------|
| **Origin** | SVG top-left (0,0 = stage corner) | Centered (stage center = canvas center) |
| **Store coords** | Center-origin (0,0 = stage center) | Center-origin (same) |
| **X axis** | +X = right | +X = right |
| **Z→Y mapping** | +Z = front = bottom (higher SVG Y) | +Z = front = bottom (higher fixture.y) |
| **Units** | Meters (SVG viewBox) | Normalized 0-1 (fixture.x/y) |
| **Clamping** | `clampToCrystalBox` → `[-halfW, +halfW]` | **None** (WAVE 7601 removed) |

**Verdict**: The axis directions and center-origin semantics **align perfectly**. A fixture at `position.x=1.25, position.z=6` renders in the same relative location in both views.

#### Findings

**Finding 1: `isPlaced` Inconsistency (Latent Bug, Low Severity)**

- `BlueprintCanvas.handleDrop` (line 107): sets `isPlaced: true` on drag-from-library
- `placeFixture2D` (stageStore:753): sets `isPlaced: false` on drag-to-move
- **Impact**: After moving a fixture in 2D, it loses `isPlaced: true`. The 3D visualizer (`useFixture3DData.ts:186`) checks `isPlaced === true` and would fall back to zone layout for moved fixtures.
- **Tactical Canvas**: NOT affected — WAVE 7600 fix uses `hasRealPosition` (position check), not `isPlaced`.
- **Recommendation**: Change `placeFixture2D` to set `isPlaced: true` since the fixture IS placed (just in 2D). The Y height is inferred from orientation via `DEFAULT_ORIENTATION_HEIGHT`, so 3D rendering still works.

**Finding 2: Crystal Box Clamping vs. Unbounded Tactical (Design Mismatch, Not Bug)**

- Erebus clamps to `[-halfW, +halfW]` via `clampToCrystalBox` — fixtures can't leave the stage bounds
- Tactical Canvas (WAVE 7601) removed clamps — fixtures outside stage bounds are renderable
- **Impact**: A fixture dragged in Erebus will never have `|position.x| > stageWidth/2`. The Tactical Canvas unbounded space is only reachable via direct JSON editing or programmatic placement.
- **Recommendation**: This is intentional design — Erebus is a builder with physical constraints, Tactical Canvas is a simulator with virtual camera. No fix needed, but document the asymmetry.

**Finding 3: `computePlanarPlacement` Y Inference (Correct, No Bug)**

- When placing via 2D drag, Y is inferred from orientation: `DEFAULT_ORIENTATION_HEIGHT[orientation] ?? 3.0`
- This means 2D-placed fixtures get a reasonable default height (e.g., `ceiling` → 6m, `floor` → 0m)
- The Tactical Canvas ignores Y (top-down view), so this is correct

**Finding 4: SVG `viewBox` Padding Asymmetry (Cosmetic)**

- Erebus viewBox: `-1.5` to `stageWidth + 1.5` (1.5m padding) with `preserveAspectRatio="xMidYMid meet"`
- Tactical Canvas: stage fills 100% of canvas at zoom=1 (no padding)
- **Impact**: At zoom=1, the Tactical Canvas shows the stage edge-to-edge, while Erebus shows it with 1.5m padding. The relative fixture positions are the same, but the visual framing differs.
- **Recommendation**: No fix needed — the virtual camera lets users zoom out to see beyond stage bounds in Tactical Canvas.

**Finding 5: `screenToSVG` Uses `getScreenCTM().inverse()` (Correct)**

- This is the SVG standard for pixel-perfect DOM→viewBox conversion
- No manual math — delegates to the browser's CTM matrix
- No bug here

#### Files Audited

| File | Role |
|------|------|
| `BlueprintCanvas.tsx` | Root SVG container, viewBox, drop handler |
| `screenToSVG.ts` | DOM→SVG coordinate conversion |
| `DragDropController2D.tsx` | Drag-to-move, snap, clamp, alignment |
| `ShowFileV2.ts` | `clampToCrystalBox`, `computePlanarPlacement`, `snapPosition` |
| `stageStore.ts` | `placeFixture2D` (sets `isPlaced: false`) |
| `MeasureLayer2D.tsx` | Measure tool (uses same offset math) |
| `LassoSelection.tsx` | Lasso (uses same offset math) |

### Typecheck
`tsc -p tsconfig.json` and `tsc -p tsconfig.node.json` → both exit 0.