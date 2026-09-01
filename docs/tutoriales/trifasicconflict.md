# WAVE 7747 — THE TRIFASIC ZONE CONFLICT: GLOBAL AUDIT & MIGRATION STRATEGY

## 1. The Three Names — Semantic Divergence Map

The concept of "strobe" is fragmented across **three string literals** in the codebase:

| Literal | Layer | Role | Files |
|---|---|---|---|
| `'center'` | **Canonical schema** | The `CanonicalZone` in ShowFileV2 — used for fixture zoning, UI dropdowns, validation | `ShowFileV2.ts`, `ZoneLayoutEngine.ts`, `zoneUtils.ts`, `ZoneRouter.ts`, `zone-node-router.ts`, `SpatialRegistrar.ts`, `FixtureMatrix.tsx`, `ZoneLayer.tsx`, `useHephPreview.ts` |
| `'flash'` | **Aether/NodeGraph + .lfx effects** | The `aetherZone` assigned in the Fixture Forge, and the `zones[]` target in `.lfx` effect files | `ForgeAetherCellsTab.tsx`, `zoneUtils.ts` (case `'flash'`), `AetherUIProjector.ts`, **13 `.lfx` files** in `core/arsenal/builtins/` |
| `'strobe'` | **LiquidEngine + channel types** | The `LiquidStereoResult.strobeActive/strobeIntensity` fields and the `AetherChannelType = 'strobe'` | `LiquidStereoPhysics.ts`, `LiquidEngineBase.ts`, `FixtureDefinition.ts`, `DMXGovernorEvaluator.ts`, `NodeResolver.ts`, `oflTranslator.ts`, `FXTParser.ts` |

**The Architect mandates unifying everything under `'strobe'`.**

---

## 2. Type & Schema Audit — Where `'center'` and `'flash'` Are Explicitly Typed

### 2.1 `CanonicalZone` — The Root Type <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="388-398" />

```typescript
export type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'center'    // ← TARGET: rename to 'strobe'
  | 'air' | 'ambient' | 'unassigned'
```

**Downstream types that embed `CanonicalZone`:**

| Type | File | How it references `'center'` |
|---|---|---|
| `FixtureZone` | `ShowFileV2.ts:403` | `= CanonicalZone \| legacy strings` (includes `'CENTER'`, `'STROBES'` legacy) |
| `EffectZone` | `core/effects/types.ts:64` | `= CanonicalZone \| 'all' \| 'all-movers' \| ...` |
| `ZoneTarget` | `core/hephaestus/types.ts:324` | `= CanonicalZone \| 'all' \| 'all-pars' \| 'all-movers'` |
| `ZONE_LABELS` | `ShowFileV2.ts:455` | `Record<CanonicalZone, string>` — key `'center'` |
| `ZONE_COLORS` | `ZoneLayoutEngine.ts:34` | `Record<CanonicalZone, string>` — key `'center'` |
| `CANONICAL_ZONES` | `ShowFileV2.ts:440` | Array literal — includes `'center'` |

### 2.2 `ZoneId` (Aether) — Untyped string <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\types.ts" lines="55" />

```typescript
export type ZoneId = string   // ← No constraint — 'flash', 'center', anything
```

The Aether layer uses **untyped strings** for zones. `'flash'` appears as a free string literal in:
- `ICapabilityNode.aetherZone?: string` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\types.ts" lines="273" />
- The Forge UI dropdown <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="239" />
- `ATMOSPHERIC_ZONES` set in `AetherUIProjector.ts` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\AetherUIProjector.ts" lines="52" />

### 2.3 `EffectType` — Unrelated `'flash'` (NOT a zone) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arbiter\types.ts" lines="452-454" />

```typescript
export type EffectType = 'strobe' | 'flash' | 'blinder' | 'pulse' | 'chase' | ...
```

**⚠️ IMPORTANT:** This `'flash'` is an **effect type** (single bright burst), NOT a zone. It appears in `PredictionEngine.ts`, `ColorProcessors.ts`, `EffectDreamSimulator.ts`. **This must NOT be renamed** — it's a different concept that happens to share the string. The migration targets ONLY the zone literal `'flash'`, not the effect type.

---

## 3. Serialization & Persistence Audit — The Danger Zone

### 3.1 Show Files (`.json` with FixtureV2[])

**Loader:** `ShowFileMigrator.ts` — migrates V1 → V2, calls `normalizeZone()` on every fixture zone <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileMigrator.ts" lines="32" />.

**`normalizeZone()`** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="477-529" /> is the **single chokepoint** for all zone string normalization. Its MAP currently includes:
```typescript
'strobes':       'center',
'stage-center':  'center',
'ceiling-center':'center',
'ceiling':       'center',
'center':        'center',
```

**⚠️ CRITICAL:** `normalizeZone()` does NOT have `'flash'` in its MAP. This means:
- A fixture with `zone: 'flash'` in a .json file → `normalizeZone('flash')` → `'unassigned'` (fallback).
- Show files saved by the Forge with `aetherZone: 'flash'` on channels → those channels get zoned as `'unassigned'` when routed through ZoneMapper.

### 3.2 Fixture Profiles (`.json` with nodeGraph)

Fixture profiles saved by the Fixture Forge store `aetherZone` as a free string in the node graph. The Forge UI dropdown offers `'flash'` as an option <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="235-245" />:

```html
<option value="">— zone —</option>
<option value="ambient">ambient</option>
<option value="air">air</option>
<option value="floor">floor</option>
<option value="flash">flash</option>        <!-- ← SAVED TO .json -->
<option value="front">front</option>
<option value="back">back</option>
<option value="movement">movement</option>   <!-- ← NOT a CanonicalZone either -->
<option value="dimmer">dimmer</option>       <!-- ← NOT a CanonicalZone either -->
<option value="unassigned">unassigned</option>
```

**Note:** The Forge dropdown also offers `'movement'` and `'dimmer'` which are NOT `CanonicalZone` values. These are Aether-internal zone concepts that flow through `normalizeZoneId()` in `zoneUtils.ts`, not through `normalizeZone()` in ShowFileV2.

### 3.3 `.lfx` Effect Files (13 files with `"flash"` in zones)

**Loader:** `LfxFileLoader.ts` — parses JSON, passes `zones[]` and `spatialZones[]` through **without normalization** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxFileLoader.ts" lines="289-290, 403" />.

**Infected .lfx files** (all in `core/arsenal/builtins/`):

| File | Occurrences |
|---|---|
| `techno/wraht_of_the_titans.lfx` | 2 (zones + spatialZones) |
| `techno/red_surge.lfx` | 3 |
| `techno/machine_gun.lfx` | 3 |
| `techno/cyber_scanner.lfx` | 2 |
| `techno/ambient_strobe.lfx` | 2 |
| `techno/acid_sweep.lfx` | 2 |
| `techno/strobe_burst.lfx` | 1 (tag only) |
| `latin/divine_obliteration.lfx` | 4 |
| `latin/tidal_wave.lfx` | 2 |
| `latin/kitt_scanner.lfx` | 1 |
| `rock/power_chord.lfx` | 1 (tag only) |
| `rock/thunder_struck.lfx` | 1 (tag only) |

**Two categories of `'flash'` usage in .lfx:**
1. **Zone targeting** (`"zones": ["flash"]`, `"spatialZones": ["flash"]`) — these are the ones that need migration. ~25 occurrences.
2. **Tags** (`"tags": ["flash", ...]`) — these are metadata keywords, NOT zones. ~4 occurrences. **Must NOT be renamed** — they're search/discovery tags.

### 3.4 Where to Inject Backward-Compatibility Hooks

There are **two normalizers** that serve as chokepoints:

| Normalizer | File | Scope | Currently maps `'flash'`? |
|---|---|---|---|
| `normalizeZone()` | `ShowFileV2.ts:477` | Show files, fixtures, ZoneMapper | ❌ No — falls to `'unassigned'` |
| `normalizeZoneId()` | `zoneUtils.ts:31` | Aether/NodeGraph adapter path | ❌ No — passes through as `'flash'` |

**The migration strategy must inject the alias in BOTH normalizers:**

1. **`normalizeZone()` in `ShowFileV2.ts`** — add `'flash'` → `'strobe'` to the MAP. This covers ShowFile loading, ZoneMapper resolution, and all downstream routing.
2. **`normalizeZoneId()` in `zoneUtils.ts`** — add `case 'flash': return 'strobe'` to the switch. This covers the Aether adapter path (`selectZoneFromResult`).
3. **`LfxFileLoader.ts`** — optionally normalize zones at load time, OR rely on the downstream normalizers (preferred — single source of truth).

---

## 4. Routing & HAL Audit — Every Path That Relies on `'center'` or `'flash'`

### 4.1 `selectZoneFromResult()` — The Aether Bridge <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="177-209" />

```typescript
switch (normalizeZoneId(nodeZone)) {
  case 'flash':                    // ← reads strobe
    return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
  case 'unassigned':
  case 'center':                   // ← BUG: reads ambient, NOT strobe
  case 'mid':
    return result.ambientIntensity
}
```

**Two bugs in one function:**
- `case 'flash'` correctly reads `strobeActive/strobeIntensity` ✅
- `case 'center'` falls through to `ambientIntensity` ❌ (the WAVE 7744 bug)

### 4.2 `ZoneRouter.ts` (legacy HAL) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\ZoneRouter.ts" lines="25-35, 304-353" />

Uses `PhysicalZone = 'STROBES' | 'CENTER' | ...` — SCREAMING_CASE legacy. Has separate configs for `'STROBES'` and `'CENTER'`:
```typescript
config.set('STROBES', { respondsTo: 'beat', gateThreshold: 0.80, ... })
config.set('CENTER',  { respondsTo: 'beat', gateThreshold: 0.80, ... })
```
Both are identical. The `mapAbstractToPhysical()` function maps `'center'` → `['FRONT_PARS', 'BACK_PARS']` (NOT to `'STROBES'` or `'CENTER'`!) — another bug.

**This is legacy HAL** — the Omniliquid Engine path doesn't use `ZoneRouter`. But it's still referenced by some code paths. Must be updated for consistency.

### 4.3 `LiquidEngineBase.calculateStrobe()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="963-990" />

Produces `strobeActive` + `strobeIntensity` — the fields that the `'flash'`/`'center'`/`'strobe'` zone should consume. The field names `strobeActive`/`strobeIntensity` are already correct and don't need renaming (they describe the SIGNAL, not the ZONE).

### 4.4 `AetherUIProjector.ts` — Atmospheric classification <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\AetherUIProjector.ts" lines="52" />

```typescript
const ATMOSPHERIC_ZONES = new Set(['ambient', 'air', 'flash'])
```
Classifies `'flash'` as atmospheric. After rename, this becomes `['ambient', 'air', 'strobe']`. **Debatable:** strobes are impact, not atmospheric. This classification may need semantic review.

### 4.5 `zone-node-router.ts` — Canonical zone list <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\helpers\zone-node-router.ts" lines="207-230" />

```typescript
const canonicalZones: readonly EffectZone[] = [
  'front', 'back', 'center', 'floor', ...
]
```
Hardcoded list includes `'center'`. Must be renamed to `'strobe'`.

### 4.6 `SpatialRegistrar.ts` — Role assignment <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\SpatialRegistrar.ts" lines="402, 652" />

```typescript
if (zone === 'front' || zone === 'center') return 'primary'
```
Uses `'center'` for role inference. Must be renamed to `'strobe'`.

### 4.7 `ZoneMapper.resolveZone()` — The .lfx routing path <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="260-314" />

```typescript
const z = zone.toLowerCase().trim()   // target zone, NOT normalized
// ...
if (normalizeZone(f.zone) === z) return true   // fixture zone IS normalized
```

**⚠️ CRITICAL BUG:** The target zone `z` is lowercased but NOT passed through `normalizeZone()`. So:
- .lfx has `"zones": ["flash"]` → `z = 'flash'`
- Fixture has `zone: 'center'` → `normalizeZone('center') = 'center'`
- `'center' !== 'flash'` → **NO MATCH**

**Effects targeting `'flash'` in .lfx files currently DO NOT MATCH fixtures zoned as `'center'`.** This is a silent failure — the effect loads, runs, but affects zero fixtures. The `normalizeZone()` MAP needs `'flash' → 'strobe'` AND the `resolveZone()` function needs to normalize the TARGET zone too, not just the fixture zone.

---

## 5. UI & Drag-and-Drop Audit

### 5.1 Stage Constructor / Fixture Inspector (Erebus) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\erebus\hud\FixtureInspector.tsx" lines="137-139" />

```tsx
{CANONICAL_ZONES.map(z => (
  <option key={z} value={z}>{z}</option>
))}
```
Iterates `CANONICAL_ZONES` — will automatically show `'strobe'` after the type rename. ✅ Zero changes needed.

### 5.2 Fixture Forge — Aether Cells Tab <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="235-245" />

**Hardcoded `<option>` list** — does NOT iterate `CANONICAL_ZONES`. Must manually change:
```tsx
<option value="flash">flash</option>
```
→
```tsx
<option value="strobe">strobe</option>
```

**Also:** This dropdown includes `'movement'` and `'dimmer'` which are NOT `CanonicalZone` values. The dropdown should be refactored to use `CANONICAL_ZONES` + Aether-specific extensions, but that's a separate cleanup.

### 5.3 Blueprint 2D — Zone Layer <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\erebus\blueprint2d\layers\ZoneLayer.tsx" lines="37, 54, 99" />

```typescript
'center': 'CENTER / FLASH / STROBE',   // ← already acknowledges all 3 names!
```
The display label already shows the trifurcation. After unification, this becomes `'strobe': 'STROBE'`.

### 5.4 Hephaestus Preview <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\useHephPreview.ts" lines="132" />

```typescript
'center': { label: 'CTR', x: 0.5, y: 0.5 },
```
Key `'center'` → rename to `'strobe'`.

### 5.5 Fixture Matrix <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\FixtureMatrix.tsx" lines="127" />

```typescript
const PRIORITY: Record<string, number> = {
  'movers-left': 0, 'movers-right': 1, 'air': 2, 'center': 3, ...
}
```
Key `'center'` → rename to `'strobe'`.

### 5.6 Zone Layout Engine <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\shared\ZoneLayoutEngine.ts" lines="40" />

```typescript
'center': '#FACC15',   // Amarillo blinder
```
Key `'center'` → rename to `'strobe'`. Also `ZONE_LAYOUT_2D` and `ZONE_LAYOUT_3D` records.

---

## 6. Complete Infection Map

### Layer 1: Type Definitions (3 files)

| File | Line(s) | What |
|---|---|---|
| `core/stage/ShowFileV2.ts` | 388-398 | `CanonicalZone` includes `'center'` |
| `core/stage/ShowFileV2.ts` | 403-430 | `FixtureZone` includes `'CENTER'`, `'STROBES'` legacy |
| `core/effects/types.ts` | 64-65 | `EffectZone = CanonicalZone \| ...` (inherits `'center'`) |
| `core/hephaestus/types.ts` | 324 | `ZoneTarget = CanonicalZone \| ...` (inherits `'center'`) |

### Layer 2: Constants & Maps (5 files)

| File | Line(s) | What |
|---|---|---|
| `core/stage/ShowFileV2.ts` | 440-450 | `CANONICAL_ZONES` array |
| `core/stage/ShowFileV2.ts` | 455-465 | `ZONE_LABELS` record |
| `core/stage/ShowFileV2.ts` | 488-526 | `normalizeZone()` MAP |
| `components/hyperion/shared/ZoneLayoutEngine.ts` | 34-44 | `ZONE_COLORS` record |
| `components/hyperion/shared/ZoneLayoutEngine.ts` | 50+ | `ZONE_LAYOUT_2D`, `ZONE_LAYOUT_3D` |

### Layer 3: Normalizers & Routing (4 files)

| File | Line(s) | What |
|---|---|---|
| `core/aether/adapters/zoneUtils.ts` | 31-101 | `normalizeZoneId()` switch |
| `core/aether/adapters/zoneUtils.ts` | 177-209 | `selectZoneFromResult()` switch |
| `core/aether/adapters/zoneUtils.ts` | 277-302 | `selectColorRoleFromZone()` switch |
| `core/zones/ZoneMapper.ts` | 260-314 | `resolveZone()` — target not normalized (BUG) |

### Layer 4: Aether / NodeGraph (4 files)

| File | Line(s) | What |
|---|---|---|
| `core/aether/resolver/AetherUIProjector.ts` | 52 | `ATMOSPHERIC_ZONES` set |
| `core/aether/adapters/helpers/zone-node-router.ts` | 210 | `canonicalZones` array |
| `core/aether/ingestion/SpatialRegistrar.ts` | 402, 652 | Role inference |
| `core/aether/ingestion/NodeExtractionPipeline.ts` | 657-658 | `aetherZone` → `normalizeZoneId()` |

### Layer 5: UI Components (5 files)

| File | Line(s) | What |
|---|---|---|
| `components/views/ForgeView/tabs/ForgeAetherCellsTab.tsx` | 239 | `<option value="flash">` |
| `components/views/erebus/blueprint2d/layers/ZoneLayer.tsx` | 37, 54, 99 | Display names + logic |
| `components/views/HephaestusView/useHephPreview.ts` | 132 | Zone layout positions |
| `components/hyperion/kinetics/FixtureMatrix.tsx` | 127 | Priority sort |
| `components/views/erebus/hud/FixtureInspector.tsx` | 137 | Uses `CANONICAL_ZONES` (auto-updates) |

### Layer 6: Legacy HAL (1 file)

| File | Line(s) | What |
|---|---|---|
| `hal/mapping/ZoneRouter.ts` | 25-35, 304-353, 220-233 | `PhysicalZone` + `mapAbstractToPhysical()` |

### Layer 7: Serialized Files (13+ .lfx files, unknown .json shows)

| File(s) | What |
|---|---|
| 13 `.lfx` files in `core/arsenal/builtins/` | `"zones": ["flash"]`, `"spatialZones": ["flash"]` |
| User fixture profiles (`.json`) | `aetherZone: "flash"` in nodeGraph |
| User show files (`.json`) | `zone: "center"` in fixtures |

---

## 7. Migration Strategy — Zero-Breakage Rename to `'strobe'`

### Phase 1: Normalizer Hooks (The Safety Net)

**Step 1.1:** In `normalizeZone()` (`ShowFileV2.ts:488`), add to the MAP:
```typescript
'flash':         'strobe',   // ← NEW: Aether/Forge legacy
'center':        'strobe',   // ← CHANGED: was 'center'
'strobes':       'strobe',   // ← CHANGED: was 'center'
'stage-center':  'strobe',   // ← CHANGED: was 'center'
'ceiling-center':'strobe',   // ← CHANGED: was 'center'
'ceiling':       'strobe',   // ← CHANGED: was 'center'
```

**Step 1.2:** In `normalizeZoneId()` (`zoneUtils.ts:42`), add to the switch:
```typescript
case 'flash':
case 'strobes':
case 'stage-center':
case 'ceiling-center':
case 'center':
  return 'strobe'    // ← CHANGED: was 'center'
```

**Step 1.3:** In `ZoneMapper.resolveZone()` (`ZoneMapper.ts:260`), normalize the TARGET zone before comparison:
```typescript
const z = normalizeZone(zone)   // ← CHANGED: was zone.toLowerCase().trim()
```
This fixes the silent .lfx routing bug where `'flash'` targets never matched `'center'` fixtures.

**After Phase 1:** All existing files with `'flash'` or `'center'` load and route correctly to `'strobe'`. Zero file corruption. This is the ONLY phase needed for backward compatibility.

### Phase 2: Type Rename (Compile-Time)

**Step 2.1:** In `CanonicalZone` (`ShowFileV2.ts:388`), replace `'center'` with `'strobe'`:
```typescript
export type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'strobe'    // ← CHANGED: was 'center'
  | 'air' | 'ambient' | 'unassigned'
```

**Step 2.2:** Update `CANONICAL_ZONES` array, `ZONE_LABELS`, `ZONE_COLORS`, `ZONE_LAYOUT_2D`, `ZONE_LAYOUT_3D` — replace key `'center'` with `'strobe'`.

**Step 2.3:** Update `FixtureZone` legacy strings — `'CENTER'` and `'STROBES'` both map to `'strobe'` via normalizer (already handled by Phase 1).

**Step 2.4:** `tsc --noEmit` — fix all type errors where `'center'` was used as a literal. The compiler will find every occurrence.

### Phase 3: Code Updates (All Layers)

**Step 3.1:** `selectZoneFromResult()` (`zoneUtils.ts:177`) — merge `case 'flash'` and `case 'center'` into `case 'strobe'`:
```typescript
case 'strobe':
  return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
case 'unassigned':
case 'mid':
  return result.ambientIntensity
```
This **fixes the WAVE 7744 bug** — `'center'` no longer falls through to ambient.

**Step 3.2:** `selectColorRoleFromZone()` (`zoneUtils.ts:277`) — add `case 'strobe': return 'accent'` (blinders are accent).

**Step 3.3:** `AetherUIProjector.ts` — `ATMOSPHERIC_ZONES` — remove `'flash'`, add `'strobe'` (or reconsider classification).

**Step 3.4:** `zone-node-router.ts` — `canonicalZones` array: replace `'center'` with `'strobe'`.

**Step 3.5:** `SpatialRegistrar.ts` — replace `zone === 'center'` with `zone === 'strobe'`.

**Step 3.6:** `FixtureMatrix.tsx` — PRIORITY record: replace `'center'` with `'strobe'`.

**Step 3.7:** `useHephPreview.ts` — zone layout: replace `'center'` with `'strobe'`.

**Step 3.8:** `ZoneLayer.tsx` (blueprint2d) — replace display name `'CENTER / FLASH / STROBE'` with `'STROBE'`, update `hasCenter` → `hasStrobe`.

**Step 3.9:** `ForgeAetherCellsTab.tsx` — replace `<option value="flash">flash</option>` with `<option value="strobe">strobe</option>`.

**Step 3.10:** `ZoneRouter.ts` (legacy) — update `PhysicalZone` and `mapAbstractToPhysical()`: map `'strobe'` → `['STROBES']` (or `['CENTER']` — they're identical).

### Phase 4: .lfx File Migration (Optional — Phase 1 covers this)

**Step 4.1:** Run a one-time script to replace `"flash"` with `"strobe"` in `zones[]` and `spatialZones[]` arrays across all 13 `.lfx` files. **Do NOT touch `"tags"` arrays** — `"flash"` as a tag is metadata, not a zone.

**Step 4.2:** Alternatively, leave the .lfx files as-is — Phase 1's normalizer hook handles `'flash' → 'strobe'` at load time. The .lfx files will work correctly without modification. Migration can happen lazily.

### Phase 5: User File Migration (Transparent)

**No action needed.** User show files (`.json`) with `zone: "center"` and fixture profiles with `aetherZone: "flash"` will be normalized at load time by the Phase 1 hooks. When the user next saves, the show file will be written with `zone: "strobe"` (if the save path uses `CanonicalZone` typing) or retained as-is (if the save path preserves the original string).

**Recommended:** Add a one-time silent migration in `ShowFileMigrator` that rewrites `'center'` → `'strobe'` and `'flash'` → `'strobe'` on next save. This is already the behavior of `normalizeZone()` — the migrator just needs to persist the normalized value.

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| User .json files with `'flash'`/`'center'` fail to load | **Critical** | Phase 1 normalizer hooks — injected BEFORE any type changes |
| .lfx effects silently target zero fixtures (existing bug) | **High** | Phase 1.3 fixes `resolveZone()` target normalization |
| `EffectType = 'flash'` accidentally renamed | **High** | Migration targets ONLY zone literals, not effect types. Separate type in `arbiter/types.ts` |
| `'flash'` in .lfx tags array renamed | **Medium** | Phase 4 script must target only `zones[]`/`spatialZones[]`, NOT `tags[]` |
| `ZoneRouter.ts` legacy breaks | **Low** | Legacy path is not used by Omniliquid Engine. Update for consistency only |
| UI dropdowns show stale labels | **Low** | `CANONICAL_ZONES` iteration auto-updates. Hardcoded dropdowns (Forge) updated in Phase 3 |

---

## 9. Execution Order Summary

```
Phase 1 (Safety Net)     → 5 edits in 3 files. Zero breakage. All old files work.
Phase 2 (Type Rename)    → 1 edit in ShowFileV2.ts. tsc finds all references.
Phase 3 (Code Updates)   → ~10 edits across 8 files. Driven by tsc errors.
Phase 4 (.lfx Migration) → Optional. Script or lazy. 13 files.
Phase 5 (User Files)     → Transparent. No action needed.
```

**Phase 1 is the only mandatory phase for backward compatibility.** Phases 2-3 are the actual rename. Phase 4-5 are cleanup.

---

*WAVE 7747 audit complete. Read-only. No code modified. Awaiting directive to execute.*