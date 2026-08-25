### Step 1: Micro-patch `placeFixture2D`

### Step 2: Rescue the Fixture Library

Let me find the IPC handler and path resolution logic:

Let me look at the source `main.ts` (not the dist) to find the path resolution:

Let me check what's actually in the `librerias` folder and the build config:

The `librerias/` folder only has 1 file (`barato.json`). Let me check if there are fixtures elsewhere:

Found the root cause. The factory library with 14 `.fxt` files is at the **project root** (`LuxSync/librerias/`), but the pathfinder only searches `electron-app/librerias/` (which has only `barato.json`). Let me verify:

Let me check the build config to understand the intended path structure:

Now I understand the full picture. Two issues:
1. **Factory library**: Pathfinder searches `electron-app/librerias/` (1 file) but the real library is at project root `LuxSync/librerias/` (17 files)
2. **User fixtures**: `customLibPath` points to `userData/fixtures/custom/` (empty) but user fixtures are at project root `LuxSync/fixtures/`
3. **Production build**: `librerias/` is NOT in `extraResources` — won't be bundled

Let me fix the pathfinder in `main.ts`:

Now let me apply the fix — add the project root as a development candidate for both factory and user fixtures:

Now add `librerias/` to `extraResources` in `package.json` for production builds:

### Step 3: Audit Erebus Flaky UI

Let me investigate the tool state management and library popover:

Now let me look at the DragDropController2D tool mode gating and the library popover:

Now let me find the library popover — the DockFlyout or DockRail:

Now let me check the SymbolLayer to see how pointer events interact with tool mode:

Now let me check the LassoSelection for the select tool mode:

Now I have enough context for the audit. Let me also check the FixtureCard for the drag-start event:

Now let me typecheck and write the audit:

Typecheck clean. Here's the complete report:

---

## WAVE 7603: Library Rescue, Micro-Patch & UI Audit

### Part 1: Micro-Patch — `placeFixture2D` isPlaced

**File**: `stageStore.ts:748`

Changed `isPlaced: false` → `isPlaced: true`. A 2D-placed fixture has real X/Z coordinates and an inferred Y height from `DEFAULT_ORIENTATION_HEIGHT`. Setting `isPlaced: true` ensures the 3D visualizer (`useFixture3DData.ts:186`) uses the authored position instead of falling back to zone-based distribution.

### Part 2: Fixture Library Rescue

**Root Cause**: The pathfinder in `main.ts` searched only 2 paths:
1. `process.resourcesPath/librerias` (production — not bundled, see below)
2. `app.getAppPath()/librerias` (dev — `electron-app/librerias/`, which has only 1 file: `barato.json`)

The actual factory library (17 files: 14 `.fxt` + 3 `.json`) lives at the **project root**: `LuxSync/librerias/`. Similarly, user fixtures (4 `user-*.json` files) live at `LuxSync/fixtures/`, not `userData/fixtures/custom/`.

**Fix applied** (`main.ts:1525`):
- Added 3rd candidate path: `path.resolve(app.getAppPath(), '..', 'librerias')` — resolves to project root in dev
- Added user fixture seeding: scans `LuxSync/fixtures/` for `user-*.json` files and copies them to `userData/fixtures/custom/` on first boot

**Fix applied** (`package.json:91`):
- Added `librerias/` to `extraResources` so it's bundled in production builds:
```json
{ "from": "../librerias", "to": "librerias" }
```

**Expected result**: Library should now load 17 system fixtures + 4 user fixtures instead of "1 system + 0 user".

### Part 3: Erebus UI Flakiness Audit (Read-Only)

#### Issue A: Select/Move Tool Inconsistency

**Finding**: The `DragDropController2D.handlePointerDown` (line 139) gates drag start on `toolMode !== 'move'` — it returns early if not in move mode. However, **selection logic runs BEFORE the tool mode check** (lines 130-136):

```typescript
// Selection logic (works in all modes) ← runs in BOTH select and move
if (e.ctrlKey || e.metaKey) { select(fixtureId, 'toggle') }
else if (e.shiftKey) { select(fixtureId, 'add') }
else if (!selectedIds.has(fixtureId)) { select(fixtureId, 'replace') }

// Only start drag in 'move' mode ← gates drag
if (toolMode !== 'move') return
```

**Bug**: In `select` mode, clicking a fixture selects it (correct), but the `LassoSelection` component also listens for `pointerDown` on the SVG background. The problem is **event target filtering** in `LassoSelection.tsx:63`:
```typescript
if (target.tagName !== 'svg' && target.tagName !== 'rect' && target.tagName !== 'g') return
```
This filter allows `<g>` elements to start a lasso — but fixture symbols ARE `<g>` elements (SymbolLayer renders each fixture as a `<g>`). So clicking a fixture in `select` mode can trigger BOTH the fixture's `onPointerDown` (selection) AND the lasso's `pointerDown` (start lasso rectangle).

**Fix recommendation**: Change the lasso filter to exclude fixture groups:
```typescript
// Only start lasso on the SVG background itself, not on fixture symbols
if (target.tagName !== 'svg' && !(target.tagName === 'rect' && target.getAttribute('data-bg'))) return
```
Or add `e.stopPropagation()` in the fixture symbol's `onPointerDown` handler (already present in `DragDropController2D:127` but the lasso listens on the SVG root, so stopPropagation on the child `<g>` should prevent it from reaching the SVG — **but the lasso's listener is on the SVG element via React's synthetic event system, and React events bubble**, so `stopPropagation` in the child should work. The issue is that the lasso's `handlePointerDown` checks `e.target`, and if the target is a `<g>` it passes the filter).

**Severity**: Medium — causes accidental lasso rectangles when clicking fixtures in select mode.

#### Issue B: Library Popover Hover/Click Unreliable

**Finding**: The `DockRail` uses a hover-based flyout with timers:
- `handleMouseEnter`: 100ms open delay
- `handleMouseLeave`: 300ms close delay
- `handleFlyoutEnter`: cancels close timer

**Bug 1 — Gap between rail and flyout**: The flyout is positioned at `left: 60px` (line 103) while the rail is 48px wide. The 12px gap means the mouse must traverse 12px of empty space between the rail button and the flyout. The 300ms close timer is supposed to cover this, but if the user moves slowly or the flyout has a CSS transition, the timer can fire before the mouse reaches `handleFlyoutEnter`.

**Fix**: Reduce the gap to 0px (position flyout at `left: 48px`) or increase the close delay to 400ms.

**Bug 2 — `visible` prop logic**: The flyout's visibility is controlled by:
```typescript
visible={hoveredCategory !== null || isPinned}
```
But `DockFlyout` also checks `shouldShow = (visible || pinned) && !retracted`. When `retracted` is true (after drag start), the flyout hides. The `erebus:dock-flyout-restore` event restores it, but only if `visible` is still true. If the user's mouse has left the rail during the drag, `hoveredCategory` is null, `visible` is false, and the flyout won't show even after restore.

**Fix**: The restore event should also re-set `hoveredCategory` if the mouse is still over the rail, or the flyout should remain visible until the drag completes regardless of mouse position.

**Bug 3 — Double-click vs single-click conflict**: The rail buttons use `onDoubleClick` for pinning, but there's no `onClick` handler. In some browsers, the first click of a double-click can trigger a synthetic hover state change that interferes with the 100ms open timer.

**Severity**: Low-Medium — annoying but not blocking.

#### Summary of Recommendations (Not Applied — Read-Only Audit)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Select mode triggers lasso on fixture click | Lasso filter allows `<g>` targets | Exclude fixture `<g>` elements from lasso start |
| Flyout closes during rail→flyout transit | 12px gap + 300ms timer race | Reduce gap to 0px or increase delay to 400ms |
| Flyout doesn't restore after drag | `visible` depends on `hoveredCategory` which is null after mouse leaves | Decouple restore from hover state |
| Double-click pin unreliable | No `onClick` handler, timer interference | Add explicit `onClick` that toggles hover state |

### Files Modified

| File | Change |
|------|--------|
| `stageStore.ts` | `isPlaced: false` → `true` in `placeFixture2D` |
| `electron/main.ts` | Added project root path candidates + user fixture seeding |
| `package.json` | Added `librerias/` to `extraResources` |

### Typecheck
`tsc -p tsconfig.node.json` → exit 0.