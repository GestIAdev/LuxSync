Found the key pieces. The drag-drop validation uses `isClipZoneCompatible` in `TimelineCanvas.tsx`, and `ZoneMapper.ts` has the zone mapping logic. Now let me read the recorder and the zone compatibility function:

Now let me read the `isClipZoneCompatible` function and the zone mapping tables in `ZoneMapper.ts`:

Now let me check `CANONICAL_ZONES` and look at how elastic tracks with `targetZone` are created — specifically how `all-pars` would (or wouldn't) match:

Now let me trace how elastic tracks get their `targetZone` and what happens when a clip has `zones: ['all-pars']`. Let me also check how the track zone is created from clip zones — the `generateZoneTracks` or similar:

Now let me check `LuxTargetZone` to see what zone values tracks can have, and look at the `ChronosLayout` clip-drop path that auto-creates tracks:

Now let me look at the `ChronosLayout` clip-drop auto-track-creation path more carefully — this is where `all-pars` would create a phantom track:

Now I have the complete picture. Let me also check the `addTrack` function in the store to see what it does with the zone:

Now let me check `createTrackV3` to see if it validates the zone:

Now I have everything. Let me verify how `all-pars` flows through the recorder's `resolveTakeLane`:

I have the complete picture now. Here's the full report:

---

## WAVE 7565.1: THE GENETIC TRANSLATOR — Trace Report

### 1. The Translator (DNA-to-Energetic Mapping)

The drag-and-drop validation lives in **`TimelineCanvas.tsx`** and uses **`isClipZoneCompatible()`** from **`ZoneMapper.ts`**.

**Drag-over validation (visual feedback):** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.tsx" lines="1059-1070" />

```ts
if (isValidDrop && targetTrack?.targetZone) {
  const zonesMimeType = types.find(t => t.startsWith('application/luxsync-zones:'))
  if (zonesMimeType) {
    const zonesStr = zonesMimeType.slice('application/luxsync-zones:'.length)
    const clipZones = zonesStr ? zonesStr.split(',') : []
    isZoneCompatible = isClipZoneCompatible(clipZones, targetTrack.targetZone)
  }
}
```

**Drop validation (final rejection):** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.tsx" lines="1155-1158" />

```ts
if (targetTrack.targetZone && !isClipZoneCompatible(payload.zones, targetTrack.targetZone)) {
  console.warn(`[TimelineCanvas] 🧲🚫 MAGNETIC REJECTION: ...`)
  return
}
```

**The mapping function itself:** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="575-595" />

```ts
export function isClipZoneCompatible(
  clipZones: string[] | undefined,
  trackTargetZone: string | undefined
): boolean {
  if (!trackTargetZone) return true
  if (!clipZones || clipZones.length === 0) return true
  if (clipZones.includes(trackTargetZone)) return true
  if (clipZones.some(z => z.toLowerCase() === 'all' || z === '*')) return true
  if (CANONICAL_ZONES.includes(trackTargetZone as CanonicalZone)) {
    return getTargetCanonicalZones(clipZones).includes(trackTargetZone as CanonicalZone)
  }
  return false
}
```

The function delegates to `getTargetCanonicalZones()` (line ~520-565 in ZoneMapper.ts) which expands composite zones like `all-pars` → `['front', 'back', 'floor']` via the `COMPOSITE_ZONES` dictionary <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="77-82" />.

### 2. The Hole — Why `all-pars` Creates Phantom Tracks

The `isClipZoneCompatible()` function works correctly for **drag-and-drop** — it expands `all-pars` to `['front', 'back', 'floor']` and checks if the track's `targetZone` is in that set. The hole is NOT in `isClipZoneCompatible`.

The hole is in **`ChronosLayout.tsx` line 908**, the recorded-clip handler that auto-creates tracks: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="906-908" />

```ts
const zones = clip.zones ?? []
const isAllZone = zones.includes('all') || zones.length === 0
const primaryZone: LuxTargetZone = isAllZone ? 'global' : ((zones[0] || 'global') as LuxTargetZone)
```

This takes `zones[0]` **raw** — no translation through `normalizeTagsToCanonical()` or `getTargetCanonicalZones()`. When a clip has `zones: ['all-pars']`:
- `isAllZone` = `false` (it's not literally `'all'`)
- `primaryZone` = `'all-pars'` (the raw composite zone string, cast to `LuxTargetZone` with `as`)
- `store.addTrack('all-pars')` creates a track with `targetZone: 'all-pars'` — a **phantom track** that is not a valid `CanonicalZone`, not an `EnergyZone`, and not `'global'`

The `as LuxTargetZone` cast at line 908 silences the TypeScript error — `all-pars` is not a member of `LuxTargetZone = CanonicalZone | 'global' | EnergyZone`, but the cast forces it through. The store accepts any string because `addTrack(targetZone: LuxTargetZone)` trusts its caller.

`createTrackV3()` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\LuxFileV3.factories.ts" lines="158-173" /> does no validation — it stores whatever `targetZone` it receives.

**The missing translation:** `ChronosLayout.tsx` line 908 needs to call `normalizeTagsToCanonical(zones)` (exported from `ZoneMapper.ts` line 192) to collapse `['all-pars']` → a canonical zone or `'global'` before using it as a `primaryZone`.

### 3. The Bypass — Record Mode

The recorder is in **`ChronosRecorder.ts`**. The `recordFX()` method at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\ChronosRecorder.ts" lines="419-470" /> assigns `trackId` like this:

```ts
const baseZone = zones?.[0] ?? 'all'                    // line 443
const trackId = this.resolveTakeLane(baseZone, ...)     // line 444
```

And `resolveTakeLane()` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\ChronosRecorder.ts" lines="477-493" />:

```ts
private resolveTakeLane(baseZone: string, startMs: number, endMs: number): string {
  const MAX_TAKE_LANES = 8
  for (let lane = 1; lane <= MAX_TAKE_LANES; lane++) {
    const candidateTrack = lane === 1 ? `zone-${baseZone}` : `zone-${baseZone}-${lane}`
    const hasCollision = this.state.clips.some((c) => {
      if (c.trackId !== candidateTrack) return false
      ...
    })
    if (!hasCollision) return candidateTrack
  }
  return `zone-${baseZone}-${MAX_TAKE_LANES}`
}
```

**Three problems in the recorder:**

1. **No translation:** `zones?.[0]` is taken raw. A clip with `zones: ['all-pars']` → `baseZone = 'all-pars'` → `trackId = 'zone-all-pars'`. No `isClipZoneCompatible`, no `normalizeTagsToCanonical`, no `getTargetCanonicalZones`.

2. **Hardcoded `zone-` prefix:** The recorder builds track IDs as `zone-${baseZone}` (line 480). This is the OLD WAVE 2543.3 naming convention. The current store (WAVE 7114) uses UUID-based track IDs (`trk-xxxxx`) with a separate `targetZone` field. The recorder's `trackId` is a string like `zone-all-pars` that doesn't match ANY real track in the store.

3. **No store consultation:** The recorder never calls `getChronosStore().tracks` to find existing tracks matching the zone. It only checks its own internal `this.state.clips` for collisions (line 482). When the recorded clip is later exported to the timeline (via the `clip-added` event → `ChronosLayout.tsx` line 895), the `trackId` from the recorder is **discarded** — `ChronosLayout` re-resolves the track from scratch using `clip.zones[0]` (line 908, the same buggy path described in section 2).

**The net flow for a recorded `all-pars` clip:**
1. `ChronosRecorder.recordFX()` → `baseZone = 'all-pars'` → `trackId = 'zone-all-pars'` (fake, never used)
2. `emit('clip-added', { clip })` → `ChronosLayout` handler at line 895
3. `primaryZone = zones[0] = 'all-pars'` (raw, no translation)
4. `store.tracks.filter(t => t.targetZone === 'all-pars')` → no matches (no track has this zone)
5. `store.addTrack('all-pars')` → creates phantom track with `targetZone: 'all-pars'`

### Summary of what needs to be rewired

| Location | File | Lines | Problem |
|----------|------|-------|---------|
| **The Translator** | `ZoneMapper.ts` | 575-595 | Works correctly. `isClipZoneCompatible` + `getTargetCanonicalZones` + `COMPOSITE_ZONES` dictionary. No fix needed here. |
| **The Hole** | `ChronosLayout.tsx` | 908 | `primaryZone = zones[0] as LuxTargetZone` — raw zone string, no translation. Needs `normalizeTagsToCanonical(zones)` before assignment. |
| **The Bypass (recorder)** | `ChronosRecorder.ts` | 443-444 | `baseZone = zones?.[0]` — raw zone string, no translation. Needs the same `normalizeTagsToCanonical` call. |
| **The Bypass (recorder)** | `ChronosRecorder.ts` | 477-493 | `resolveTakeLane` builds `zone-${baseZone}` track IDs — legacy convention, doesn't match store UUIDs. The recorder's `trackId` is discarded anyway by `ChronosLayout`, so this is cosmetic, but the `baseZone` value propagates to `ChronosLayout` via `clip.zones`. |
| **No validation** | `LuxFileV3.factories.ts` | 158-173 | `createTrackV3` accepts any string as `targetZone` — no guard against non-canonical zones like `all-pars`. |