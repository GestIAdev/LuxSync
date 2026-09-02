Now let me audit `SmartZoneSelector` to see what zone buttons it renders:

Now let me check the `EffectZone` type and the `HephAutomationClipV3` type for `mixBus`:

Now let me check the `CanonicalZone` type and how `mixBus` is consumed downstream:

Let me check who renders `NewClipModal` and whether the callbacks are stable:

Let me check `handleCreateClip` stability and the full `EffectZone` type:

Good — `ZONE_LABELS` is correctly updated with `strobe`. Now let me check the `handleCreateClip` deps and whether `onClose` is stable:

Let me check `refreshMetadata` stability and what store subscriptions `HephaestusView` has:

I now have a complete picture. Here is the clinical diagnostic report.

---

# ⚒️ WAVE 7749.31 — NEW CLIP MODAL AUDIT REPORT

## 1. TARGET ZONES REALIGNMENT

### 1.1 Current zone inventory

The modal delegates zone selection to `<SmartZoneSelector>` (<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\SmartZoneSelector.tsx" />), which renders three rows:

| Row | Tiles | IDs |
|-----|-------|-----|
| TARGET | `ALL`, `MOV`, `PAR`, `AIR` | `all`, `all-movers`, `all-pars`, `air` |
| POSITION | `FRT`, `BCK`, `FLR`, `STR`, `AMB` | `front`, `back`, `floor`, `strobe`, `ambient` |
| MOD | `L`, `R`, `ODD`, `EVN` | `all-left`, `all-right`, `movers-left`, `movers-right` |

### 1.2 Verdict: Zones are ALREADY aligned with the modern engine

The `center/flash` purge (WAVE 7747) is **already complete** at the type level. <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="403-412" /> shows `CanonicalZone` now includes `'strobe'` (not `'center'`). `ZONE_LABELS` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="470-480" /> is correctly updated. The `normalizeZone()` fallback map at line 504 routes legacy `center`/`flash`/`strobes` → `'strobe'`.

The `SmartZoneSelector` POSITION row already uses `STR` (strobe), not `CTR` (center). The stale `CTR` reference only exists in the **JSDoc layout diagram** at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx" lines="17-23" /> — a documentation ghost, not a code bug.

The `floor` zone is present and correct (`FLR` tile, id `'floor'`).

### 1.3 The ODD/EVN problem — confirmed for removal

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\SmartZoneSelector.tsx" lines="71-76" /> reveals a **semantic mismatch**:

```
{ id: 'movers-left',    label: 'ODD',  icon: ① }
{ id: 'movers-right',   label: 'EVN',  icon: ② }
```

These tiles are labeled `ODD`/`EVN` (suggesting index-based parity filtering: fixtures 1,3,5 vs 2,4,6), but their IDs are `movers-left`/`movers-right` — which are **spatial** zones (all moving heads on the left/right side of the stage). This is actively misleading. The Architect is correct: they are confusing and unused.

**Removal strategy:**
1. Delete the `ODD` and `EVN` entries from `MODIFIER_TILES` in `SmartZoneSelector.tsx`.
2. Keep `L` (`all-left`) and `R` (`all-right`) — these are spatial stereo selectors and are semantically correct.
3. The `MODIFIER_TILES` array shrinks from 4 to 2 entries. The "MOD" row label could be renamed to "SIDE" for clarity.
4. **Collateral check:** `movers-left`/`movers-right` remain valid `CanonicalZone` values and are still selectable via the `ZoneMapper` / `FixtureSelector` system — they just lose their (misleading) UI buttons. If granular mover-side targeting is needed in the future, add explicit `M-L`/`M-R` tiles in the TARGET row with honest labels.
5. **No type changes needed** — `EffectZone` and `CanonicalZone` are unaffected.

---

## 2. THE MIX BUS & CATEGORIES

### 2.1 Mix Bus is NOT dead — it is the runtime blend engine

The audit's premise that "MIX BUS was originally built for the deprecated Chronos timeline" is **incorrect**. The `mixBus` field on `HephAutomationClipV3` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts" lines="521-527" />) is explicitly documented as the **V3 canonical inter-clip blend behavior**, NOT legacy timeline routing:

> *"This is NOT the legacy timeline track routing (global/htp/ambient/accent as track labels). That legacy routing is DEMOLITION TARGET — this field stays."*

**Downstream consumers (17 files, 64 references):**

| Consumer | Role | Can remove? |
|----------|------|-------------|
| `EffectManager.ts` (lines 811-921) | **Railway Switch** — decides HTP merge vs LTP dictator. `mixBus === 'global'` triggers the "Respect Protocol" lock. | **NO** — core runtime |
| `arbiter/types.ts` (line 519) | Arbiter inherits `mixBus` from dominant effect | **NO** |
| `ChronosRecorder.ts` (line 436) | Clip color on timeline (`MIXBUS_CLIP_COLORS[mixBus]`) | Cosmetic only |
| `LuxFileV3.factories.ts` | Mirrors `mixBus` to `LuxClip` for quick access | **NO** — serialization |
| `LuxFileV3.ts` (line 59) | `LuxMixBus` type mirrors `HephMixBus` | **NO** — file format |
| `LuxFileV3.schema.ts` (line 169) | Validates `mixBus` against `VALID_MIX_BUSES` | **NO** — validation |
| `LfxFileLoader.ts` (line 404) | Loads `mixBus` from `.lfx` files | **NO** — deserialization |
| `DiamondData.test.ts` (15 refs) | Asserts `mixBus` round-trips through save/load | **NO** — test contract |
| `useHephaestusEditorStore.ts` (line 232, 325) | Default clip + `setMixBus` action | **NO** — store API |

**Verdict: `mixBus` CANNOT be ripped out.** It is the core inter-clip blend behavior. Removing it would break the Railway Switch, the Arbiter, file serialization, and 15 test assertions.

### 2.2 Mix Bus UI simplification strategy

The 4-button grid (Global / HTP / Ambient / Accent) is functionally correct but **cognitively overloaded** for the Architect. The runtime only cares about one binary distinction:

- **`global`** = LTP takeover (dictator — full replacement, nobody overrides)
- **`htp` / `ambient` / `accent`** = HTP merge (additive — highest value wins per channel)

The three HTP variants (`htp`, `ambient`, `accent`) differ only in **timeline color** and **semantic label** — the runtime treats them identically (all HTP). 

**Refactor strategy (UI-only, no data model change):**
1. Collapse the 4-button grid into a **2-option toggle**: `TAKEOVER` (maps to `global`) vs `MERGE` (maps to `htp`).
2. If the Architect needs the cosmetic distinction (timeline colors), expose a secondary "blend flavor" dropdown that only appears when `MERGE` is selected: `Standard` / `Ambient` / `Accent` → maps to `htp` / `ambient` / `accent`.
3. The `mixBus` field stays in `HephAutomationClipV3`, the store, and all consumers. Only the UI presentation changes.

### 2.3 Categories — relevant but stale

`EffectCategory` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\types.ts" lines="40-45" />) = `physical | color | movement | optics | composite`. The `DEFAULT_PARAMS_BY_CATEGORY` map at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx" lines="67-73" /> determines which default tracks are created:

| Category | Default params |
|----------|---------------|
| physical | `intensity`, `strobe` |
| color | `color` |
| movement | `pan`, `tilt` |
| optics | `zoom`, `focus`, `iris` |
| composite | `intensity`, `color`, `pan`, `tilt` |

**Problem:** This map predates WAVE 7749.29. The new laser beam geometry (`scale_x/y`, `rot_x/y`, `gobo_rotation`) and atmosphere (`smoke_pump`, `smoke_density`, `fan_speed`) params have **no category and no default-track entry**. The Architect cannot create a "Laser Beam" or "Atmosphere" clip from the modal.

**Refactor strategy:**
1. Add `beam` and `atmosphere` to `EffectCategory` (requires updating the union in `effects/types.ts` and all exhaustive switches).
2. Add entries to `DEFAULT_PARAMS_BY_CATEGORY`:
   - `beam`: `['scale_x', 'scale_y', 'gobo_rotation']`
   - `atmosphere`: `['smoke_pump', 'smoke_density', 'fan_speed']`
3. Add `CATEGORY_OPTIONS` entries with appropriate LuxIcons.
4. **Cascade check:** `EffectCategory` is used in `EffectFrameOutput.category`, `EffectTriggerConfig`, and the runtime effect registry. Adding new values requires auditing all `switch(category)` blocks for exhaustiveness.

---

## 3. THE ERRATIC NAME INPUT — ROOT CAUSE FOUND

### 3.1 The re-render leak

`NewClipModal` is `memo`'d (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx" line="176" />) and rendered via `createPortal` (line 456). The Portal correctly isolates the DOM tree, but **`memo` is defeated by an unstable prop**:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\index.tsx" lines="707-711" />:
```tsx
<NewClipModal
  isOpen={showNewClipModal}
  onClose={() => setShowNewClipModal(false)}   // ← INLINE ARROW: new identity every render
  onCreate={handleCreateClip}                   // ← stable (useCallback, deps: [refreshMetadata])
/>
```

`onClose` is an **inline arrow function** — it creates a new function identity on every render of `HephaestusView`. Since `memo` does shallow prop comparison, the new `onClose` identity breaks memoization, and `NewClipModal` re-renders on every parent render.

### 3.2 Why the parent re-renders at 60fps

`HephaestusView` subscribes to multiple high-frequency stores (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\index.tsx" lines="47-140" />):

| Subscription | Update frequency |
|--------------|-----------------|
| `useHephaestusEditorStore(state => state.clip)` | On every edit mutation |
| `useStageStore(state => state.showFile)` | On stage changes |
| `useAudioStore(state => state.bpm)` | On BPM detection (irregular) |
| `useHephPreview(clip, stageFixtures)` | **60fps during playback** — produces new preview state every frame |
| `useNavigationStore(state => state.targetBpm)` | On navigation events |

The `useHephPreview` hook (line 97) is the primary culprit. During playback, it evaluates the CurveEvaluator at 60fps and produces new preview state objects, triggering `HephaestusView` re-renders at 60fps. Each re-render creates a new `onClose` identity, defeats `memo`, and forces `NewClipModal` to re-render at 60fps.

### 3.3 Why re-renders drop keystrokes

Although `name` is in local `useState` and survives re-renders, the 60fps re-rendering of the Portal content causes:
1. **Reconciliation overhead** — React runs the full JSX tree diff every frame, including the `<input>`, all category buttons, all zone tiles, and all mix-bus buttons.
2. **Input event coalescing** — Electron's Chromium can coalesce or drop `onChange` events when the component re-renders between the native `input` event and React's synthetic event dispatch.
3. **Focus churn** — While React normally preserves focus on controlled inputs, rapid re-renders in a Portal can cause momentary blur/refocus cycles, especially when the `useEffect` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx" lines="191-201" /> fires `requestAnimationFrame(() => nameRef.current?.focus())` on `isOpen` transitions.

### 3.4 The fix (for the implementation phase)

**Primary fix — stabilize `onClose`:**
```tsx
// In HephaestusView (index.tsx), replace the inline arrow:
const handleCloseNewClipModal = useCallback(() => setShowNewClipModal(false), [])
// ...
<NewClipModal
  isOpen={showNewClipModal}
  onClose={handleCloseNewClipModal}   // ← stable identity
  onCreate={handleCreateClip}          // ← already stable
/>
```

This makes all three props stable (`isOpen` is a boolean, `onClose` and `onCreate` are `useCallback`'d). `memo` will now only re-render `NewClipModal` when `isOpen` actually changes (false→true or true→false). The 60fps parent re-renders are blocked.

**Secondary defense — local input buffer (optional):**
If keystroke issues persist after the primary fix (unlikely), add a local `useState` buffer in `NewClipModal` that defers syncing to the parent store until blur. But this should not be necessary once `memo` is functioning.

**Tertiary defense — `useHephPreview` memoization:**
The root cause of the 60fps parent re-renders is `useHephPreview` producing new state every frame. If this hook's output is not needed while the modal is open, consider:
- Guarding the hook with `if (!showNewClipModal)` (conditional hooks are illegal in React, so this requires refactoring to a conditional sub-component).
- Or memoizing the preview output with a shallow-equality check so identical frames don't trigger re-renders.

---

## SUMMARY: REMOVAL/REFACTOR STRATEGY

| Item | Action | Risk | Files touched |
|------|--------|------|---------------|
| `ODD`/`EVN` tiles | **Remove** from `MODIFIER_TILES` | Low — no runtime dependency on the UI buttons | `SmartZoneSelector.tsx` |
| `CTR` in JSDoc | **Update** layout diagram to `STR` | None — documentation only | `NewClipModal.tsx` (header comment) |
| `mixBus` UI | **Simplify** to 2-option toggle (Takeover/Merge) + optional flavor dropdown | Low — UI-only, data model unchanged | `NewClipModal.tsx` |
| `mixBus` data model | **KEEP** — not dead, core runtime | N/A | None |
| Categories | **Extend** with `beam` + `atmosphere` | Medium — cascade across `EffectCategory` consumers | `effects/types.ts`, `NewClipModal.tsx`, all `switch(category)` blocks |
| Name input bug | **Fix** by wrapping `onClose` in `useCallback` | None — single line change | `index.tsx` |
| `useHephPreview` 60fps | **Investigate** memoization (post-fix verification) | Low | `useHephPreview.ts` (if needed) |

**Recommended execution order:**
1. Fix the name input bug (P0 — one line, immediate UX win).
2. Remove ODD/EVN tiles (P1 — low risk, quick).
3. Simplify Mix Bus UI (P2 — UI refactor, no data model change).
4. Extend categories with beam/atmosphere (P3 — requires cascade audit).
5. Update stale JSDoc diagrams (P4 — cosmetic).