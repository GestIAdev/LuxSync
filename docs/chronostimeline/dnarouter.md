Tienes razón — "ambient" es tanto EnergyZone como CanonicalZone/targetZone, y buscar strings en el array plano es una trampa. Necesito ver el JSON real y los tipos. Déjame investigar la estructura del `cognitiveDNA`.

Let me read the `ambient_strobe.lfx` (the one that caused the bug) and the type definition for `cognitiveDNA`:

Now let me read the `CognitiveDNA` type definition:

Now I understand the full picture. Let me check how `cognitiveDNA` flows into the `RecordedClip` and `DragPayload` — does the recorder have access to it?

The recorder already has `hephClip: HephAutomationClipV3` which contains `cognitiveDNA`. Now let me check how `ChronosLayout` receives the recorded clip and what data it has access to:

`ChronosLayout` has `clip.hephClip` (the full `HephAutomationClipV3`) available via `data.clip`. Now let me also check the `DragPayload` to see if it carries `cognitiveDNA`:

`DragPayload` has `hephClipSerialized?: HephAutomationClipV3` which contains `cognitiveDNA`. Now let me also check the `FXClip` type in `TimelineClip.ts` to see if it stores `hephClip`:

Now I have the complete picture. Let me also check the `ambient_strobe.lfx` `spatialZones` to confirm the `all-pars` issue:

Now I see the full picture clearly. The `spatialZones` array contains `['all-pars', 'ambient', 'flash', ...]` — these are HARDWARE zones (where the fixtures are). The `cognitiveDNA.energyZone` is `{min: 'intense', max: 'peak'}` — this is the ENERGETIC zone (when in the song the clip fires).

The bug in WAVE 7565.2 was that `resolvePrimaryTrackZone` searched the flat `zones` array (which is `spatialZones`) for energy keywords. Since `'ambient'` appears in `spatialZones` (as a hardware zone for ambient fixtures), it was a false positive — the clip would route to the AMBIENT energy track even though its `cognitiveDNA.energyZone.max` is `'peak'`.

Now let me implement the fix:

Now let me rewrite the resolver. I need to add an import for `CognitiveDNA` and `EnergyZoneRange` and change the function signature:

Now rewrite the resolver function and its surrounding block:

Now patch `ChronosLayout.tsx` to pass `cognitiveDNA` from `clip.hephClip`:

Now patch `ChronosRecorder.ts` — it has `hephClip: HephAutomationClipV3` which contains `cognitiveDNA`:

TypeScript clean. Now run the tests:

All 273 tests pass.

All done. Here's the complete summary:

---

## WAVE 7565.3: THE TRUE DNA ROUTER — Complete

### The bug in WAVE 7565.2

The previous fix searched the flat `spatialZones` array for energy keywords. This was fundamentally broken because `'ambient'` is **overloaded** — it's both:

1. **An EnergyZone** (`cognitiveDNA.energyZone`): "this clip fires during the ambient (soft) section of the song"
2. **A CanonicalZone / spatial zone** (`spatialZones`): "this clip targets fixtures physically located in the ambient hardware zone" (e.g. your Tungsten fans operating in `ambient+air+flash`)

The `ambient_strobe.lfx` clip proves this perfectly:
- `spatialZones: ['all-pars', 'ambient', 'flash', ...]` — hardware targets (WHERE)
- `cognitiveDNA.energyZone: {min: 'intense', max: 'peak'}` — energy context (WHEN)

WAVE 7565.2 saw `'ambient'` in `spatialZones` and routed the clip to the AMBIENT energy track — wrong. The clip should go to the PEAK track because `cognitiveDNA.energyZone.max = 'peak'`.

### The fix: read `cognitiveDNA` first

The `.lfx` schema already separates these concerns cleanly (as noted in `types.ts` line 425):
```
spatialZones → DÓNDE van los fixtures (CanonicalZone / helpers)
cognitiveDNA → CUÁNDO/CÓMO actúa Selene (EnergyZone, ACO, vibes)
```

The resolver now reads `cognitiveDNA.energyZone.max` FIRST — before even looking at `spatialZones`.

### 1. `ZoneMapper.ts` — The Resolver

**New import:** `CognitiveDNA` from `../arsenal/lfxTypes` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="36-42" />

**New input type:** `ClipZoneInput` — accepts `cognitiveDNA` and `spatialZones` separately <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="625-630" />

**Rewritten function:** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="632-700" />

New resolution priority:

| Priority | Source | Example | Result |
|----------|--------|---------|--------|
| 1 | `cognitiveDNA.energyZone.max` | `'peak'` | `'peak'` (THE source of truth) |
| 2 | `cognitiveDNA.energyZone.min` | `'intense'` | `'intense'` (fallback within DNA) |
| 3 | Empty/`'all'` spatialZones | `[]` | `'global'` |
| 4 | `normalizeTagsToCanonical(spatialZones)` → single CanonicalZone | `['front']` | `'front'` |
| 5 | Composite/compound/modifier | `['all-pars']` | `'global'` |

**Backwards compatibility:** The function accepts both the new `ClipZoneInput` object AND the old `string[]` signature (detected via `Array.isArray`). Old callers passing a raw `string[]` are treated as `spatialZones` with no DNA — they get the legacy fallback path (priority 3-5).

**Critical change:** The legacy fallback path (priority 3-5) **no longer searches spatialZones for energy keywords**. The `ENERGY_ZONE_SET` is only used to validate `cognitiveDNA.energyZone` values. `'ambient'` in `spatialZones` is now correctly treated as a hardware zone, never an energy track.

### 2. `ChronosLayout.tsx` — Pass `cognitiveDNA`

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="907-918" />

```ts
const primaryZone: LuxTargetZone = resolvePrimaryTrackZone({
  cognitiveDNA: clip.hephClip?.cognitiveDNA,
  spatialZones: zones,
})
```

`clip.hephClip` is the embedded `HephAutomationClipV3` (Diamond Data) which contains `cognitiveDNA`. For recorded clips, this comes from `RecordedClip.hephClip`. For dropped clips, it comes from `DragPayload.hephClipSerialized`.

### 3. `ChronosRecorder.ts` — Pass `cognitiveDNA`

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\ChronosRecorder.ts" lines="439-455" />

```ts
const baseZone = resolvePrimaryTrackZone({
  cognitiveDNA: hephClip.cognitiveDNA,
  spatialZones: zones,
})
```

The recorder already receives `hephClip: HephAutomationClipV3` as its first argument — no library cache lookup needed. The `cognitiveDNA` is right there.

### Verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` | exit 0, zero errors |
| All 14 chronos test files | 273/273 passed |

### What the Architect will see

**`ambient_strobe.lfx`** (the bug case):
- `spatialZones: ['all-pars', 'ambient', 'flash']` — hardware targets
- `cognitiveDNA.energyZone: {min: 'intense', max: 'peak'}`

**Before (WAVE 7565.2):** Saw `'ambient'` in spatialZones → routed to AMBIENT energy track (wrong — this is a peak-energy strobe)

**After (WAVE 7565.3):** Reads `cognitiveDNA.energyZone.max = 'peak'` → routed to PEAK track (correct). The `'ambient'` in spatialZones is now ignored for track assignment — it's only used for fixture routing within the effect.

**Legacy clip without cognitiveDNA:**
- `spatialZones: ['front']` → no DNA → `normalizeTagsToCanonical(['front'])` → `'front'` (valid canonical) → routed to FRONT track

**Composite without DNA:**
- `spatialZones: ['all-pars']` → no DNA → `normalizeTagsToCanonical(['all-pars'])` → `'all-pars'` (not a single canonical) → `'global'` (no phantom track)