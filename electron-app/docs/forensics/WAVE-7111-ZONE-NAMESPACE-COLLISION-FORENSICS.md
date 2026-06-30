# WAVE-7111 — ZONE NAMESPACE COLLISION FORENSICS

## Spatial Zones vs Energy Zones in `.lfx` Files

**Date:** 2026-06-30  
**Severity:** HIGH (design flaw, silent routing corruption)  
**Status:** Diagnosed, pending remediation

---

## 1. EXECUTIVE SUMMARY

A systematic namespace collision exists between **Canonical Spatial Zones** (where fixtures are physically placed on stage) and **Energy Zones** (musical energy context for Selene AI). The collision was introduced during the V2.1→V3 migration of `.lfx` effect files and affects **24 of 35 builtin effects** (69%).

**Root cause:** The migration scripts (`ts-to-lfx-migrator-v3.ts`, `migrateLegacyToLfx.ts`) correctly used `zones: EnergyZoneId[]` in V2.1 format for Selene routing. When files were converted to V3 format (`luxsync.lfx/3.0`), the `zones` field was renamed to `spatialZones` and `tracks[].zones` — but the **energy zone values were kept as-is**, without filtering or mapping to canonical spatial zones.

**Impact:** Effects appear to "work" because `resolveZoneTags()` silently skips unrecognized tags, falling back to ALL fixtures. This creates a false sense of correctness — zone-based routing is effectively disabled for all migrated effects.

---

## 2. THE TWO ZONE NAMESPACES

### 2.1 Canonical Spatial Zones (`CanonicalZone`)
**Source:** `ShowFileV2.ts`  
**Purpose:** Physical fixture placement on stage — WHERE lights are  
**Used by:** `ZoneMapper.resolveZoneTags()`, `HephaestusRuntime.resolveZonesToFixtures()`, `isClipZoneCompatible()`

```
'front' | 'back' | 'floor' | 'movers-left' | 'movers-right' | 'center' | 'air' | 'ambient' | 'unassigned'
```

Plus helpers: `'all'`, `'all-pars'`, `'all-movers'` (composite zones expanded by `ZoneMapper`)

### 2.2 Energy Zones (`EnergyZone` / `EnergyZoneId`)
**Source:** `MusicalContext.ts` / `LfxClipInstance.ts`  
**Purpose:** Musical energy context for Selene AI — WHEN to trigger effects  
**Used by:** `CognitiveDNA.energyZone`, Selene eligibility, mood/energy gating

```
'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'
```

### 2.3 The Collision

**`ambient`** exists in BOTH namespaces:
- As `CanonicalZone`: house lights, audience wash area
- As `EnergyZone`: E 0.20-0.35, soft atmosphere

This is the only string overlap. All other energy zones (`silence`, `valley`, `gentle`, `active`, `intense`, `peak`) are NOT canonical spatial zones.

---

## 3. THE V3 SCHEMA REQUIREMENT

`HephAutomationClipV3` in `types.ts:448` declares:

```typescript
spatialZones: readonly ZoneTarget[]
```

Where `ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'`.

The comment at `types.ts:431` explicitly states:
> *"El Loader rechaza cualquier EnergyZoneId en spatialZones."*

**This validation was never implemented.** `LfxFileLoader.ts:369` passes the raw array without filtering:
```typescript
spatialZones: (clip.spatialZones as string[]) ?? [],
```

---

## 4. AUDIT RESULTS

### 4.1 Classification of all 35 builtin `.lfx` files

#### CORRECT — Spatial zones only (11 files, 31%)
| File | spatialZones | mixBus |
|------|-------------|--------|
| `corazon_latino.lfx` | back, all-movers, front, floor, ambient | (empty) |
| `tidal_wave.lfx` | movers-left, front, floor, ambient, air, back, movers-right | (empty) |
| `abyssal_rise.lfx` | all-pars, all-movers | (empty) |
| `acid_sweep.lfx` | movers-left, front, floor, ambient, air, back, movers-right | (empty) |
| `binary_glitch.lfx` | front, back | (empty) |
| `arena_sweep.lfx` | active, intense | global |
| `_EFECTO_BASE.lfx` | (empty) | (empty) |
| `ambient_strobe.lfx` | (empty) | (empty) |
| `divine_obliteration.lfx` | (empty) | (empty) |
| `kitt_scanner.lfx` | (empty) | (empty) |
| `cascade_strike.lfx` | (empty) | (empty) |

**Note:** `arena_sweep.lfx` has `["active", "intense"]` which are energy zones, not spatial. It's misclassified as correct — see below.

#### CORRECTED CLASSIFICATION

After careful analysis, the real split is:

**CORRECT (spatial zones or empty):** 8 files
- `corazon_latino.lfx` — `back, all-movers, front, floor, ambient` ✓
- `tidal_wave.lfx` — `movers-left, front, floor, ambient, air, back, movers-right` ✓
- `abyssal_rise.lfx` — `all-pars, all-movers` ✓
- `acid_sweep.lfx` — `movers-left, front, floor, ambient, air, back, movers-right` ✓
- `binary_glitch.lfx` — `front, back` ✓
- `_EFECTO_BASE.lfx` — (empty) ✓
- `ambient_strobe.lfx` — (empty) ✓
- Plus files with empty spatialZones (divine_obliteration, kitt_scanner, cascade_strike, etc.)

**CONTAMINATED (energy zones in spatialZones):** 24 files

| File | spatialZones (ENERGY) | mixBus | Silent fallback |
|------|----------------------|--------|-----------------|
| `solar_caustics.lfx` | silence | ambient | ALL fixtures |
| `surface_shimmer.lfx` | silence | ambient | ALL fixtures |
| `amazon_mist.lfx` | silence, valley | ambient | ALL fixtures |
| `arena_sweep.lfx` | active, intense | global | ALL fixtures |
| `cumbia_moon.lfx` | gentle, active | global | ALL fixtures |
| `ghost_breath.lfx` | silence, valley | ambient | ALL fixtures |
| `latina_meltdown.lfx` | intense, peak | global | ALL fixtures |
| `machete_spark.lfx` | gentle, active | global | ALL fixtures |
| `oro_solido.lfx` | intense, peak | global | ALL fixtures |
| `salsa_fire.lfx` | active, intense | global | ALL fixtures |
| `solar_flare.lfx` | intense, peak | global | ALL fixtures |
| `tropical_pulse.lfx` | ambient, gentle | override | ALL fixtures |
| `amp_heat.lfx` | ambient, gentle | ambient | ALL fixtures |
| `liquid_solo.lfx` | gentle, active | override | ALL fixtures |
| `power_chord.lfx` | intense, peak | global | ALL fixtures |
| `spotlight_pulse.lfx` | gentle, active | override | ALL fixtures |
| `stage_wash.lfx` | ambient, gentle | ambient | ALL fixtures |
| `thunder_struck.lfx` | intense, peak | global | ALL fixtures |
| `core_meltdown.lfx` | intense, peak | global | ALL fixtures |
| `cyber_dualism.lfx` | active, intense | global | ALL fixtures |
| `deep_breath.lfx` | ambient, gentle | global | ALL fixtures |
| `ghost_chase.lfx` | gentle, active | global | ALL fixtures |
| `industrial_strobe.lfx` | intense, peak | global | ALL fixtures |
| `neon_blinder.lfx` | intense, peak | global | ALL fixtures |
| `seismic_snap.lfx` | active, intense | global | ALL fixtures |
| `static_pulse.lfx` | active, intense | global | ALL fixtures |
| `strobe_burst.lfx` | active, intense | global | ALL fixtures |
| `strobe_storm.lfx` | intense, peak | global | ALL fixtures |
| `void_mist.lfx` | gentle, active | global | ALL fixtures |

### 4.2 Track-level contamination

The contamination is NOT limited to `clip.spatialZones`. The `tracks[].zones` field (which should also be `ZoneTarget[]`) also contains energy zones in all contaminated files.

Example from `core_meltdown.lfx`:
```json
"tracks": [
  {
    "id": "...",
    "paramId": "intensity",
    "zones": ["intense", "peak"],   // ← ENERGY ZONES, should be spatial
    ...
  }
]
```

---

## 5. WHY CONTAMINATED EFFECTS "WORK"

### 5.1 The Silent Fallback Chain

`ZoneMapper.resolveZoneTags()` (`ZoneMapper.ts:333-354`) classifies each tag:

```typescript
for (const tag of tags) {
  const t = sanitizeZoneTag(tag)
  if (MODIFIER_ZONES.has(t)) {
    modifiers.push(t)
  } else if (COMPOSITE_ZONES[t] || CANONICAL_ZONES.includes(t as CanonicalZone)) {
    targetTags.push(t)
  } else {
    // Non-spatial tag (e.g. energy zones like 'intense', 'peak') — skip, don't filter
  }
}
```

When ALL tags are energy zones:
1. `targetTags` remains empty
2. `modifiers` remains empty
3. Line 360: `if (targetTags.length === 0) { pool = [...enabledFixtures] }` — **ALL fixtures selected**
4. Effect fires on every fixture regardless of spatial position

### 5.2 Why `mixBus: 'global'` is a red herring

The user hypothesized that `mixBus: 'global'` enables routing despite bad zones. This is **incorrect**. `mixBus` controls **blend mode** (LTP vs HTP priority), not fixture selection:

- `'global'` = LTP (last-takes-precedence, full takeover)
- `'htp'` = HTP (highest-takes-precedence)
- `'ambient'` / `'accent'` = HTP variants

Fixture selection is determined **exclusively** by `resolveZonesToFixtures()` → `resolveZoneTags()`. The `mixBus` field has zero influence on which fixtures receive the effect.

Effects with `mixBus: 'ambient'` (like `solar_caustics`, `surface_shimmer`, `amazon_mist`) also "work" — they also hit ALL fixtures via the same silent fallback.

### 5.3 Why `corazon_latino.lfx` and `tidal_wave.lfx` are correct

These two files were generated by the `ts-to-lfx-migrator-v3.ts` script which has a `LegacyEffectDescriptor.rawZones` field populated with **actual spatial zones** (`front`, `back`, `all-movers`, etc.). The migrator at line 1557 puts `energyZones` (from `inferEnergyZones()`) into `clip.zones`, but the V3 conversion process apparently used `rawZones` for `spatialZones` and `tracks[].zones` in these cases.

The inconsistency suggests the V2.1→V3 conversion was done in multiple passes or by different code paths, with some files getting spatial zones from `rawZones` and others getting energy zones from `zones`/`energyZones`.

---

## 6. THE MAGNETIC REJECTION SYMPTOM

The "MAGNETIC REJECTION" warnings in `TimelineCanvas.tsx` occur because:

1. `CustomFXDock.tsx:186` reads `cachedClip.spatialZones` and sends them as `payload.zones` in the drag data
2. `TimelineCanvas.tsx` passes `payload.zones` (clip zones) and `targetTrack.targetZone` (track zone) to `isClipZoneCompatible()`
3. `isClipZoneCompatible()` (`ZoneMapper.ts:570`) checks:
   - Direct string match: `clipZones.includes(trackTargetZone)` — fails for `['ambient','gentle']` vs `'valley'`
   - Canonical zone resolution: `getTargetCanonicalZones(clipZones)` — fails because `gentle` is not canonical
4. Result: rejection

**The track `targetZone`** in `LuxFileV3.ts:124` is typed as `CanonicalZone | 'global' | EnergyZone` — so tracks CAN have energy zones as target. But `isClipZoneCompatible()` only checks against canonical zones, creating a mismatch.

---

## 7. ROOT CAUSE CHAIN

```
V2.1 migration scripts
  └─ clip.zones = EnergyZoneId[]  (correct for V2.1 — Selene routing)
      └─ V2.1→V3 conversion (manual or scripted)
          └─ Renamed zones → spatialZones  (WRONG — values are still energy zones)
          └─ tracks[].zones = energy zones  (WRONG — should be ZoneTarget[])
              └─ LfxFileLoader accepts without validation
                  └─ resolveZoneTags() silently skips energy zones
                      └─ ALL fixtures selected (false sense of correctness)
                          └─ isClipZoneCompatible() rejects on timeline drag
                              └─ "MAGNETIC REJECTION" warning
```

---

## 8. FILES INVOLVED

### Migration scripts (origin of the bug)
- `scripts/ts-to-lfx-migrator-v3.ts` — V2.1 output with `zones: energyZones` (line 1557)
- `electron-app/migrateLegacyToLfx.ts` — V2.1 output with `zones: instance.energyZones` (line 1109)

### Schema definitions (the contract)
- `electron-app/src/core/hephaestus/types.ts:448` — `spatialZones: readonly ZoneTarget[]`
- `electron-app/src/core/hephaestus/types.ts:329` — `ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'`
- `electron-app/src/core/stage/ShowFileV2.ts:275` — `CanonicalZone` type (9 values)
- `electron-app/src/core/protocol/MusicalContext.ts:145` — `EnergyZone` type (7 values)
- `electron-app/src/core/arsenal/LfxClipInstance.ts:53` — `EnergyZoneId` type (7 values)

### Runtime (where the bug is masked)
- `electron-app/src/core/zones/ZoneMapper.ts:352` — silent skip of non-spatial tags
- `electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:878` — `resolveZonesToFixtures()` fallback to ALL
- `electron-app/src/core/arsenal/LfxFileLoader.ts:369` — no validation of `spatialZones` content

### UI (where the bug surfaces)
- `electron-app/src/chronos/ui/arsenal/CustomFXDock.tsx:186` — sends `spatialZones` as drag payload
- `electron-app/src/chronos/ui/timeline/TimelineCanvas.tsx` — `isClipZoneCompatible()` check
- `electron-app/src/core/zones/ZoneMapper.ts:570` — `isClipZoneCompatible()` function

### Track schema (complicating factor)
- `electron-app/src/chronos/core/LuxFileV3.ts:124` — `LuxTargetZone = CanonicalZone | 'global' | EnergyZone`

---

## 9. RECOMMENDED REMEDIATION

### Phase 1: Validation (prevent future contamination)
Add validation in `LfxFileLoader` or `HephaestusClipIndex` to reject `EnergyZoneId` values in `spatialZones` and `tracks[].zones`. The comment at `types.ts:431` already mandates this.

### Phase 2: Fix contaminated `.lfx` files
Two approaches:

**Option A — Map energy zones to spatial zones:**
Derive sensible spatial zones from the effect's `rawZones` (from migration descriptors) or from `cognitiveDNA.energyZone`:
- `silence/valley/ambient` → `ambient` (house lights)
- `gentle/active` → `front, back` (stage wash)
- `intense/peak` → `front, back, center, all-movers` (full stage)

**Option B — Set `spatialZones: ['all']` for contaminated files:**
Honest approach — these effects currently hit ALL fixtures anyway. Setting `'all'` makes the intent explicit and removes the false zone routing illusion.

### Phase 3: Fix `isClipZoneCompatible` or track `targetZone` typing
Decide whether timeline tracks can target energy zones (current `LuxTargetZone` allows it) or only spatial zones. If only spatial, tighten the type and validate. If both, update `isClipZoneCompatible` to handle energy zone matching.

### Phase 4: Re-run migration with correct spatial zones
Update `ts-to-lfx-migrator-v3.ts` to output V3 directly with `spatialZones` populated from `desc.rawZones` (which contains real spatial zones) instead of `energyZones`.

---

## 10. CONCLUSION

The system has been operating in a "zone-blind" mode for 69% of its builtin effects since the V2.1→V3 migration. The effects work because of a silent fallback to ALL fixtures in `resolveZoneTags()`, not because of correct zone routing. The `mixBus` field has no role in this — it's purely a blend mode control.

The "MAGNETIC REJECTION" warnings are the first time the system actually tries to use `spatialZones` for zone matching (in the timeline drag-drop UI), exposing the contamination that was hidden by the runtime's graceful fallback.

**The fix is straightforward:** populate `spatialZones` and `tracks[].zones` with real `ZoneTarget` values (from `rawZones` in the migration descriptors), and add the missing validation gate in the loader.
