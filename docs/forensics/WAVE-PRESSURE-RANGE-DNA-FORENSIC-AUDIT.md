# WAVE: `pressureRange` DNA Schema Expansion — Forensic Impact Audit

> **Role:** Lead Forensic Systems Architect  
> **Target:** `electron-app/src/`  
> **Mission:** Impact Analysis for introducing `pressureRange: { min: number, max: number }` into the DNA schema  
> **Status:** ANALYSIS ONLY — No implementation code written  

---

## Executive Summary

The proposed `pressureRange` trait aims to solve the **"Slow Reggaeton vs. Hard Dembow"** problem: Divine/Heavy effects fire in low-acoustic-density contexts because the current schema only gates by `energyZone` (a categorical 7-level taxonomy) and `aggression` (a scalar). There is no continuous acoustic-pressure gate. Adding `pressureRange` introduces a **numeric range gate** that compares against real-time rolling bass density (`AcousticRealityState.zScores.low` or `rawEnergy`).

**Blast radius:** 9 files across 4 subsystems. 1 DB migration. 1 mutation engine extension. 2 UI components. No Zod schemas exist (validation is procedural).

---

## 1. EffectDNA Schema & Types

### 1.1 Current Schema Architecture

There are **two parallel DNA interfaces** that must be kept in sync:

#### `EffectDNA` (Intelligence layer — lightweight)
`@/electron-app/src/core/intelligence/dna/EffectDNA.ts:104-119`
```typescript
export interface EffectDNA {
  aggression: number
  chaos: number
  organicity: number
  textureAffinity?: TextureAffinity
  selectionBias?: number
}
```
- Used by `DNAAnalyzer` for target-DNA matching (euclidean distance).
- **Does NOT have `energyZone` or `aggressionRange`** — it's a simplified projection.
- `getEffectDNA()` at `@/electron-app/src/core/intelligence/dna/EffectDNA.ts:464-474` maps `FrozenGenome` → `EffectDNA`, currently dropping all range fields.

#### `CognitiveDNA` (Arsenal layer — full genome)
`@/electron-app/src/core/arsenal/lfxTypes.ts:147-164`
```typescript
export interface CognitiveDNA {
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility?: IKCompatibility
  readonly executionDomain?: ExecutionDomain
  readonly pixelHints?: PixelExecutionHints
}
```
- This is the **canonical DNA schema** stored in `.lfx v2.1` files and `HephAutomationClipV3.cognitiveDNA`.
- Already has `Range` interface available at `@/electron-app/src/core/arsenal/lfxTypes.ts:81-84`:
  ```typescript
  export interface Range { readonly min: number; readonly max: number }
  ```
- `pressureRange` would be a new `Range` field on `CognitiveDNA`.

#### `RegistryEntry` (flattened index)
`@/electron-app/src/core/arsenal/lfxTypes.ts:216-262`
```typescript
export interface RegistryEntry {
  // ...
  readonly dna: FrozenGenome
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range
  // ...
}
```
- Flat alias of `CognitiveDNA` fields for O(1) hot-path lookups.
- Must add `readonly pressureRange: Range` here.

### 1.2 Validation (No Zod — Procedural)

**No Zod schemas exist** in the codebase. Validation is procedural:

`@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:363-369`
```typescript
function _validateGenomeRanges(dna: CognitiveDNA): boolean {
  const g = dna.genome
  if (!_in01(g.aggression) || !_in01(g.chaos) || !_in01(g.organicity)) return false
  if (!_in01(dna.aggressionRange.min) || !_in01(dna.aggressionRange.max)) return false
  if (dna.aggressionRange.min > dna.aggressionRange.max) return false
  return true
}
```
- Must add `pressureRange` validation: `_in01(dna.pressureRange.min)`, `_in01(dna.pressureRange.max)`, `min <= max`.

### 1.3 Default Values

`@/electron-app/src/core/hephaestus/defaults.ts:10-19`
```typescript
export const DEFAULT_COGNITIVE_DNA: Readonly<CognitiveDNA> = Object.freeze({
  genome: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
  textureAffinity: 'universal',
  compatibleVibes: [],
  validSections: [],
  energyZone: { min: 'ambient', max: 'peak' },
  aggressionRange: { min: 0, max: 1 },
  spatialBehavior: 'absolute',
  ikCompatibility: undefined,
})
```
- Must add `pressureRange: { min: 0, max: 0 }` (or `{ min: 0, max: 1 }` if we want permissive default).

### 1.4 DB Schema (SQLite — `lfx_blueprints` table)

`@/electron-app/src/core/genesis/schema.sql:21-56`
```sql
CREATE TABLE IF NOT EXISTS lfx_blueprints (
  -- ...
  energy_zone_min       TEXT NOT NULL,
  energy_zone_max       TEXT NOT NULL,
  aggression_range_min  REAL NOT NULL,
  aggression_range_max  REAL NOT NULL,
  spatial_behavior      TEXT NOT NULL,
  -- ...
);
```

**⚠️ BREAKING CHANGE — DB MIGRATION REQUIRED:**

- Must add `pressure_range_min REAL NOT NULL DEFAULT 0` and `pressure_range_max REAL NOT NULL DEFAULT 0` columns.
- SQLite supports `ALTER TABLE ADD COLUMN` but the `lfx_blueprints_immutable` trigger blocks `UPDATE`. The migration must use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (which is allowed since it's a DDL, not a DML UPDATE).
- Existing blueprints will get `DEFAULT 0` for both columns — meaning **all legacy blueprints will have `pressureRange: {0, 0}`**, which must be interpreted as "no pressure gate" (permissive) by downstream consumers.
- The `clip_v3_json` column stores the full `HephAutomationClipV3` as JSON, which includes `cognitiveDNA`. Legacy clips won't have `pressureRange` in their JSON — deserialization must handle the missing field with a default.

### 1.5 Files Requiring Update for Schema

| File | Change |
|------|--------|
| `lfxTypes.ts:147-164` | Add `pressureRange: Range` to `CognitiveDNA` |
| `lfxTypes.ts:216-262` | Add `pressureRange: Range` to `RegistryEntry` |
| `defaults.ts:10-19` | Add `pressureRange` to `DEFAULT_COGNITIVE_DNA` |
| `DynamicEffectRegistry.ts:363-369` | Add `pressureRange` validation in `_validateGenomeRanges` |
| `DynamicEffectRegistry.ts:385-446` | Add `pressureRange` extraction in `_buildEntryFromV3` |
| `LfxClipInstance.ts:515-567` | Add `pressureRange` emission in `toCognitiveDNA()` |
| `schema.sql:21-56` | Add `pressure_range_min/max` columns to `lfx_blueprints` |
| `EffectDNA.ts:104-119` | **Optional:** Add `pressureRange?` to `EffectDNA` if DNA matching needs it |

---

## 2. Hephaestus UI (`DnaRail.tsx` & Related)

### 2.1 Current Range-Based DNA Property Handling

The UI handles **two** range-like properties:

#### Energy Zones (categorical range — multi-select buttons)
`@/electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx:558-588`

Energy zones are rendered as a **thermometer** of 7 toggle buttons (`silence` → `peak`). The selected zones are collapsed into `{min, max}` via `LfxClipInstance.toCognitiveDNA()` which takes the first and last selected zone by canonical order.

```typescript
const handleZoneToggle = useCallback((zone: EnergyZoneId) => {
  setForm(prev => {
    // ... toggle logic, max 2 zones (WAVE 7123 Montecarlo equilibrium)
  })
}, [])
```

#### Aggression Range (auto-derived — NOT user-editable)
`@/electron-app/src/core/arsenal/LfxClipInstance.ts:552-553`
```typescript
const aggression = this.acoTriad.aggression
const aggressionRange = Object.freeze({ min: aggression, max: aggression })
```
`aggressionRange` is a **degenerate range** (min === max === aggression). It is NOT editable in the UI — it's auto-derived from the ACO slider. This means there is **no existing UI pattern for a numeric range slider** in the DNA rail.

### 2.2 What Needs Refactoring

#### `DnaRail.tsx` — Primary DNA Editor

1. **`DnaFormState` interface** (line 167-173): Add `pressureRange: Range` field.
   ```typescript
   interface DnaFormState {
     archetype: UserArchetype
     aco: AcoTriad
     zones: EnergyZoneId[]
     vibes: CompatibleVibe[]
     maxStrobeFreqHz: number
     // NEW: pressureRange: { min: number; max: number }
   }
   ```

2. **Form initialization** (lines 224-253): Add `pressureRange` defaults when loading from `dna` prop.

3. **`onDnaChange` propagation** (lines 326-335): Must include `pressureRange` in the propagated `CognitiveDNA`:
   ```typescript
   onDnaChange({
     // ... existing fields ...
     pressureRange: { ...reality.pressureRange },
   })
   ```

4. **New UI section**: A dual-handle range slider (min/max) for `pressureRange`. The existing ACO sliders use `<input type="range">` — a dual-handle slider would require either:
   - A custom React component with two overlaid range inputs, or
   - A third-party dual-range slider library.
   - The slider should be labeled **"ACOUSTIC PRESSURE"** with values 0.0–1.0, representing the minimum rolling bass density required for the effect to be eligible.

5. **Archetype bias map** (`ARCHETYPE_BIAS_MAP`): Consider adding `pressureRange` constraints per archetype (e.g., `divine` → `pressureRange.min >= 0.6`, `ambient` → `pressureRange.max <= 0.3`).

#### `TheiaDNALab.tsx` — Secondary DNA Editor (Theia Atoms)

`@/electron-app/src/components/theia/TheiaDNALab.tsx:47-268`

- Has genome sliders (aggression, chaos, organicity) and energy zone tag selectors.
- `DraftAtom` interface in `@/electron-app/src/stores/useTheiaEditorStore.ts:37-64` would need `pressureRange`.
- `updateEnergyZone` action pattern shows how to add an `updatePressureRange` action.
- **Lower priority** — Theia atoms are pre-clips, not full effects. But if `pressureRange` becomes part of `CognitiveDNA`, it must be authorable here too for consistency.

#### `LabTab.tsx` — Container

`@/electron-app/src/components/views/HephaestusView/tabs/LabTab.tsx:282-288`

- `DnaRail` is rendered with `dna={clip?.cognitiveDNA}`. No changes needed here — the `CognitiveDNA` type change propagates automatically.

### 2.3 UI Bottleneck

**There is no existing dual-range slider component in the codebase.** The ACO sliders are single-handle `<input type="range">`. A `pressureRange` editor needs a **dual-handle slider** (min + max on the same track). This is a **new React component** that must be built or imported.

---

## 3. Genesis Selene Matrix (Coliseum / Mutation Engine)

### 3.1 How Operators Handle Ranges Today

The mutation operators split into two categories:

#### Track-level operators (do NOT touch CognitiveDNA)
- `pointMutation` — mutates keyframe values and bezier handles.
- `geneSplice` — inserts new keyframes with interpolated values.
- `interpolationDrift` — changes keyframe interpolation types.
- `geneDuplication` — clones tracks and mutates `phaseConfig`.
- `temporalStretch` — adjusts keyframe timings.

These operate exclusively on `HephAutomationClipV3.tracks[].keyframes` — they **never read or write `cognitiveDNA`**. Adding `pressureRange` to `CognitiveDNA` has **zero impact** on these operators.

#### DNA-level operator (crossover → `blendCognitiveDNA`)
`@/electron-app/src/core/genesis/operators/GeneticOperators.ts:885-938`

```typescript
export function blendCognitiveDNA(
  dnaA: CognitiveDNA,
  dnaB: CognitiveDNA,
  dominant: 'A' | 'B',
): CognitiveDNA {
  const dom = dominant === 'A' ? dnaA : dnaB
  const sub = dominant === 'A' ? dnaB : dnaA

  const genome: FrozenGenome = {
    aggression: 0.6 * dom.genome.aggression + 0.4 * sub.genome.aggression,
    chaos: 0.6 * dom.genome.chaos + 0.4 * sub.genome.chaos,
    organicity: 0.6 * dom.genome.organicity + 0.4 * sub.genome.organicity,
  }
  // ...
  const energyZone: EnergyZoneRange =
    unionSpan > 2 ? dom.energyZone : {
      min: ENERGY_ZONES[Math.max(0, unionMinIdx)],
      max: ENERGY_ZONES[Math.min(ENERGY_ZONES.length - 1, unionMaxIdx)],
    }

  const aggressionRange = {
    min: Math.min(dnaA.aggressionRange.min, dnaB.aggressionRange.min),
    max: Math.max(dnaA.aggressionRange.max, dnaB.aggressionRange.max),
  }

  return {
    genome, textureAffinity, compatibleVibes, validSections,
    energyZone, aggressionRange, spatialBehavior,
    ikCompatibility: dom.ikCompatibility,
    executionDomain: dom.executionDomain,
  }
}
```

### 3.2 Impact of Adding `pressureRange`

**⚠️ BREAKING CHANGE — `blendCognitiveDNA` will NOT automatically evolve `pressureRange`:**

1. The function constructs the return object **explicitly field by field**. If `CognitiveDNA` gains a new required field `pressureRange`, TypeScript will **fail to compile** because the return object at line 927-937 does not include it.

2. The blending strategy for `pressureRange` must be decided:
   - **Option A (union, like `aggressionRange`):** `min: Math.min(a.min, b.min), max: Math.max(a.max, b.max)` — widens the pressure envelope.
   - **Option B (weighted average, like `genome`):** `0.6 * dom + 0.4 * sub` for both min and max — preserves narrow envelopes.
   - **Option C (dominant-takes-all, like `spatialBehavior`):** Use `dom.pressureRange` — simplest, no blending.
   - **Recommended: Option A** (union) — consistent with `aggressionRange` semantics. A child should be eligible in any pressure context where either parent was eligible.

3. The `crossover()` function at line 947-956 calls `blendCognitiveDNA()` — this is the **only call site**, so the fix is localized.

### 3.3 Prenatal Screening

`@/electron-app/src/core/genesis/ColiseumService.ts:165-324`

The `spawnOrganism` pipeline:
1. Fetch ancestor blueprint → `HephAutomationClipV3`
2. `applyOperator(parentClip, operatorType, seed)` → mutated clip
3. `prenatalScreening(mutatedClip, l2Distance)` → viability check
4. If viable → `estimateRarity()` + DB insert

**`prenatalScreening` operates on clip structure (tracks, keyframes), NOT on DNA traits.** Adding `pressureRange` does not affect prenatal screening. However, if we want the mutation engine to **mutate** `pressureRange` (not just blend it), we would need to add logic to `pointMutation` or create a new epigenetic operator — currently, **mutation operators never modify `cognitiveDNA`**. The DNA is inherited verbatim from the parent clip, except in `crossover` where it's blended.

### 3.4 Mutation Engine Summary

| Operator | Touches CognitiveDNA? | Impact of `pressureRange` |
|----------|----------------------|---------------------------|
| `point_mutation` | ❌ | None |
| `hue_drift` | ❌ | None |
| `phase_epigenetics` | ❌ | None |
| `gene_duplication` | ❌ | None |
| `gene_deletion` | ❌ | None |
| `gene_splice` | ❌ | None |
| `temporal_stretch` | ❌ | None |
| `interpolation_drift` | ❌ | None |
| `context_drift` | ❌ | None |
| `transposition` | ❌ | None |
| **`crossover`** | ✅ via `blendCognitiveDNA` | **⚠️ TypeScript compile error + must add blending logic** |

---

## 4. Intelligence Integration (Gatekeeper / Dream Simulator)

### 4.1 Current Interception Points

#### `EffectDreamSimulator.filterByZone()`
`@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:538-575`

```typescript
private filterByZone(effects: string[], zone: string): string[] {
  const aggressionLimits: Record<string, { min: number; max: number }> = {
    'silence': { min: 0, max: 0.30 },
    'valley':  { min: 0, max: 0.50 },
    'ambient': { min: 0, max: 0.70 },
    'gentle':  { min: 0, max: 0.85 },
    'active':  { min: 0.40, max: 0.80 },
    'intense': { min: 0.60, max: 1.00 },
    'peak':    { min: 0.70, max: 1.00 },
  }
  const limits = aggressionLimits[zone] || { min: 0, max: 1 }
  const filtered = effects.filter(effect => {
    const entry = registry.getEntry(effect)
    return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
  })
  // ... fallback if too strict
}
```

- Filters by **categorical zone → aggression scalar**. No pressure check.
- Called at line 703: `this.filterByZone(vibeAllowedEffects, projectedZone)`.
- **This is NOT the optimal place for `pressureRange` interception** — `filterByZone` operates on the zone label, not on continuous acoustic data. The `projectedZone` is already a categorical abstraction. Adding pressure here would conflate categorical and continuous gating.

#### `SeleneTitanConscious.ts` — Sovereign Clock (Universal Reality Clamp)
`@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:620-680`

```typescript
const isHeavyEffect = registryEntry?.simMeta.isHeavyCandidate
  || registryEntry?.simMeta.isDivineCandidate
  || (registryEntry?.dna.aggression ?? 0) > 0.7

if (isHeavyEffect) {
  if (ars) {
    const zoneLabel = ars.zone.label
    const phaseLabel = ars.phase.phase
    const inLowZone = zoneLabel === 'silence' || zoneLabel === 'valley'
    const hasHiddenTension = phaseLabel === 'textural'

    if (inLowZone && !hasHiddenTension) {
      aborted = true
      abortReason = `Acoustic Reality veto (Zone: ${zoneLabel}...)`
    }
  } else {
    // Fallback: energy/Z-Score abort
    const energyTooLow = titanState.rawEnergy < 0.35
    const zTooLow = currentZScore < -0.5
    if (energyTooLow || zTooLow) { aborted = true }
  }
}
```

- This is the **closest existing pattern** to what `pressureRange` needs: checking real-time acoustic state (`AcousticRealityState`) against effect properties before firing.
- Currently uses categorical zone labels (`silence`, `valley`) + scalar thresholds (`rawEnergy < 0.35`).
- **This is where `pressureRange` interception should live** — but as a **separate check**, not embedded in the Sovereign Clock block. The Sovereign Clock only runs for pre-buffered divine effects. `pressureRange` should gate ALL effects, not just divine.

#### `AcousticRealityState` — Available Real-Time Data
`@/electron-app/src/core/intelligence/perception/StateCouplingEnforcer.ts:24-41`

```typescript
export interface AcousticRealityState {
  readonly timestamp: number
  readonly zone: MultiSpectralZone
  readonly phase: ValidatedNarrativePhase
  readonly zScores: { low: number; mid: number; high: number; total: number }
  readonly crestFactors: { low: number; high: number }
  readonly spectralTension: number
  readonly spectralDivergence: number
}
```

- `zScores.low` — Z-score of the low-frequency band (bass). This is the **primary signal** for `pressureRange` comparison.
- `crestFactors.low` — crest factor of the low band (peak/RMS ratio). Useful for distinguishing sustained bass (low crest = high pressure) from transient kicks (high crest = low sustained pressure).
- **No rolling average is stored in ARS** — it's a per-frame snapshot. A rolling low-freq mean would need to be derived from `contextualMemory` or added to ARS.

### 4.2 Optimal Interception Architecture

**Recommendation: Two-layer interception**

#### Layer 1: `EffectDreamSimulator.generateCandidates()` — Early Filtering
**Where:** After `filterByZone()` at line 703, add a `filterByPressure()` step.

```typescript
// CONCEPTUAL — NOT IMPLEMENTATION
const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, projectedZone)
const pressureFilteredEffects = this.filterByPressure(zoneFilteredEffects, ars)
```

- Compares `RegistryEntry.pressureRange` against `ars.zScores.low` (or a rolling mean).
- If `pressureRange.min > 0` (i.e., the effect has a pressure gate), and `ars.zScores.low < pressureRange.min`, the effect is **filtered out** before simulation.
- This saves CPU by not simulating ineligible candidates.
- **Must respect `relaxGuardsForFuture`** — if a drop is predicted with high confidence, pressure guards should be relaxed (the bass will arrive).

#### Layer 2: `SeleneTitanConscious.ts` — Sovereign Clock Veto
**Where:** In the Universal Reality Clamp block (line 633), add a `pressureRange` check alongside the existing zone check.

```typescript
// CONCEPTUAL — NOT IMPLEMENTATION
if (isHeavyEffect && ars) {
  const pressure = ars.zScores.low  // or rolling mean
  const effectPressureRange = registryEntry?.pressureRange
  if (effectPressureRange && pressure < effectPressureRange.min) {
    aborted = true
    abortReason = `Pressure veto (Z_low=${pressure.toFixed(2)} < min=${effectPressureRange.min})`
  }
}
```

- This is a **safety net** for pre-buffered effects that were selected before the acoustic context changed.
- Works alongside the existing zone-based veto.

### 4.3 `Gatekeeper` (ContextualEffectSelector)

The Gatekeeper in `SeleneTitanConscious.ts` (lines 1600-1670) handles:
- Hard cooldown enforcement
- Post-drop refractory lock
- V3 ignite bypass
- Ethics score gating

It does **NOT** currently check acoustic pressure or DNA ranges. Adding `pressureRange` to the Gatekeeper would be **redundant** if Layer 1 (DreamSimulator) and Layer 2 (Sovereign Clock) are implemented. The Gatekeeper operates on a single `intent` (effect ID) — it doesn't have access to the full candidate list for filtering.

### 4.4 Intelligence Integration Summary

| Interception Point | Layer | When | Has ARS? | Recommended? |
|-------------------|-------|------|----------|-------------|
| `filterByZone()` | DreamSimulator | Candidate generation | No (zone string only) | ❌ Wrong abstraction level |
| `generateCandidates()` post-filter | DreamSimulator | After zone filter | Yes (via `state`) | ✅ **Layer 1 — early filter** |
| Sovereign Clock clamp | SeleneTitanConscious | Pre-buffer execution | Yes (`this.lastMemoryOutput?.acousticReality`) | ✅ **Layer 2 — safety net** |
| Gatekeeper | SeleneTitanConscious | Single intent evaluation | Indirect | ❌ Redundant |

---

## 5. Breaking Changes Summary

### 🔴 Critical (Will Not Compile Without Fix)

| File | Issue |
|------|-------|
| `GeneticOperators.ts:927-937` | `blendCognitiveDNA` return object missing `pressureRange` → TS2345 |
| `defaults.ts:10-19` | `DEFAULT_COGNITIVE_DNA` missing `pressureRange` → TS2741 |
| `LfxClipInstance.ts:557-566` | `toCognitiveDNA()` return object missing `pressureRange` → TS2741 |

### 🟡 Migration Required

| File | Issue |
|------|-------|
| `schema.sql:21-56` | `lfx_blueprints` table needs `pressure_range_min/max` columns |
| `DynamicEffectRegistry.ts:385-446` | `_buildEntryFromV3` must extract `pressureRange` from `clip.cognitiveDNA` |
| `DynamicEffectRegistry.ts:363-369` | `_validateGenomeRanges` must validate `pressureRange` |
| `DnaRail.tsx:167-173` | `DnaFormState` + form init + propagation must include `pressureRange` |
| `useTheiaEditorStore.ts:37-64` | `DraftAtom` + `cloneAtomToDraft` + `newDraftFromPath` must include `pressureRange` |

### 🟢 No Impact

| File | Reason |
|------|--------|
| All track-level mutation operators | Never touch `cognitiveDNA` |
| `ColiseumService.ts` | Delegates DNA handling to `blendCognitiveDNA` |
| `GatekeeperLinter.ts` | Validates bias/ACO, not range fields |
| `EffectDNA.ts` | Simplified projection — `pressureRange` optional here |

---

## 6. Architectural Recommendations

1. **`pressureRange` should be a `Range` on `CognitiveDNA`** (not `EffectDNA`). It's a regulatory trait, not a core genome coordinate. Keep `EffectDNA` as the 3-axis cube.

2. **Default to `{min: 0, max: 0}`** (permissive). A `pressureRange` of `{0, 0}` means "no pressure gate" — all legacy effects continue to work unchanged.

3. **Blending strategy: Union (Option A).** Children should be eligible wherever either parent was eligible. Consistent with `aggressionRange` semantics.

4. **Interception: Two-layer.** DreamSimulator early-filter + Sovereign Clock safety-net. Do NOT add to Gatekeeper.

5. **Rolling bass mean:** `AcousticRealityState.zScores.low` is a per-frame snapshot. For a true "sustained pressure" metric, add a rolling 2-4 second mean to `contextualMemory` or `AcousticRealityState`. This is a **prerequisite** for `pressureRange` to function correctly — a single-frame Z-score is too noisy for reggaeton vs. dembow distinction.

6. **UI: Build a `DualRangeSlider` component.** No existing dual-handle slider in the codebase. Place it in the DnaRail between "ENERGY ZONES" and "VIBES" sections.

7. **DB Migration:** `ALTER TABLE lfx_blueprints ADD COLUMN pressure_range_min REAL NOT NULL DEFAULT 0;` — safe with the immutability trigger (DDL, not DML).

---

## 7. File Inventory

| # | File (absolute path) | Lines of Interest | Change Type |
|---|----------------------|-------------------|-------------|
| 1 | `electron-app/src/core/arsenal/lfxTypes.ts` | 81-84, 147-164, 216-262 | Add `pressureRange` to `CognitiveDNA` + `RegistryEntry` |
| 2 | `electron-app/src/core/hephaestus/defaults.ts` | 10-19 | Add `pressureRange` to `DEFAULT_COGNITIVE_DNA` |
| 3 | `electron-app/src/core/arsenal/DynamicEffectRegistry.ts` | 363-369, 385-446 | Add validation + extraction |
| 4 | `electron-app/src/core/arsenal/LfxClipInstance.ts` | 515-567 | Add `pressureRange` to `toCognitiveDNA()` |
| 5 | `electron-app/src/core/genesis/schema.sql` | 21-56 | Add DB columns |
| 6 | `electron-app/src/core/genesis/operators/GeneticOperators.ts` | 885-938 | Add `pressureRange` blending to `blendCognitiveDNA` |
| 7 | `electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx` | 167-173, 224-253, 326-335 | Add form state + UI section + propagation |
| 8 | `electron-app/src/stores/useTheiaEditorStore.ts` | 37-64, 97-112, 187-204 | Add `pressureRange` to `DraftAtom` |
| 9 | `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts` | 538-575, 703 | Add `filterByPressure()` after `filterByZone()` |
| 10 | `electron-app/src/core/intelligence/SeleneTitanConscious.ts` | 620-680 | Add pressure check in Sovereign Clock |
| 11 | `electron-app/src/core/intelligence/perception/StateCouplingEnforcer.ts` | 24-41 | **Optional:** Add rolling low-freq mean to ARS |

---

*End of Forensic Audit — No implementation code was written.*
