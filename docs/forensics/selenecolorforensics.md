Let me re-read the key sections precisely with line numbers for the audit:

Now let me read the Mud Guard section and the post-processing:

Now let me check what the Mud Guard's swampZone is for the Latino constitution and check the Anti-Mud Protocol more carefully:

Now I have all the data I need. Let me also verify the Anti-Mud Protocol (WAVE 81) section — it only runs on `finalHue` (primary), not on secondary/accent/ambient:

Now let me check the neonProtocol to understand the full post-processing chain:

---

# WAVE 7723: HOLISTIC PROCEDURAL AUDIT — DIAGNOSIS

## AUDIT TARGET 1: The Mud Guard Bypass — WHY Secondary/Accent Turn Brown

### Color Lifecycle Timeline (with exact line numbers)

| Phase | Lines | What happens | Which colors |
|-------|-------|-------------|--------------|
| **A. Anti-Mud Protocol (WAVE 81)** | 1466–1507 | Evaluates `finalHue` ONLY. Checks danger zone 20-55°. Adjusts `correctedSat`/`correctedLight` scalars. | **PRIMARY ONLY** — `finalHue` is the primary hue. Secondary/accent/ambient don't exist yet. |
| **B. Primary assigned** | 1649–1652 | `pal.primary.h/s/l = finalHue/correctedSat/correctedLight` | Primary gets the anti-mud corrected values. |
| **C. Secondary offset applied** | 1654–1673 | `secondaryHue = finalHue + fibonacciRotation(137.5°) + saltRotation` | Secondary hue computed. **S/L derived from `correctedSat`/`correctedLight` but NOT re-validated against danger zone.** |
| **D. Accent offset applied** | 1690–1733 | `accentHue = finalHue + 30/120/180` depending on strategy | Accent hue computed. S=100, L=max(70, primaryLight+20). **No danger zone check.** |
| **E. Ambient offset applied** | 1752–1792 | `ambientHue = finalHue + 240/secondaryHue+30/finalHue-30` | Ambient hue computed. S/L derived from corrected values. **No danger zone check.** |
| **F. Mud Guard (WAVE 85)** | 1904–1919 | `fixDirtyColor()` checks `c.h >= swampMin && c.h <= swampMax` | **Evaluates primary, secondary, ambient** — but **NOT accent** (line 1916-1918: primary, secondary, ambient only). |
| **G. Constitutional Enforcement** | 1985–2013 | Elastic rotation away from `forbiddenHueRanges` | All 4 colors. But only rotates HUE — does NOT fix S/L. |
| **H. Neon Protocol** | 2104–2110 | Transforms danger-zone colors to neon or white | All 4 colors. But only if `neonProtocol.enabled` in constitution. |

### THE BUG: Two Separate Mud Guards, Both Incomplete

There are **TWO** anti-brown mechanisms, and **both have gaps**:

**1. Anti-Mud Protocol (WAVE 81, lines 1466-1507):**
- Runs at line 1485: `const isDangerZone = finalHue > 20 && finalHue < 55`
- **Only evaluates `finalHue` (the primary).** At this point, secondary/accent/ambient haven't been computed yet.
- It adjusts `correctedSat` and `correctedLight` — scalars that later get inherited by secondary (line 1672: `correctedSat + 5`, line 1673: `correctedLight - 10`) and ambient (line 1791: `correctedSat - 10`, line 1792: `correctedLight - 5`).
- **But the hue danger check is never repeated for the derived colors.** If `finalHue = 10°` (safe red), the secondary at `10 + 137.5 = 147.5°` (safe green) is fine. But if `finalHue = 300°` (safe magenta), the secondary at `300 + 137.5 = 77.5°` lands **directly in the brown danger zone (45-90°)** with no correction.

**2. Mud Guard (WAVE 85, lines 1904-1919):**
- Runs AFTER offsets are applied. Good.
- `fixDirtyColor()` checks `c.h >= swampMin && c.h <= swampMax` (45-90° for Latino).
- **Calls `fixDirtyColor` for primary, secondary, ambient — but NOT accent.** Line 1916-1918:
  ```typescript
  fixDirtyColor(pal.primary);
  fixDirtyColor(pal.secondary);
  fixDirtyColor(pal.ambient);
  // ← pal.accent is MISSING
  ```
- The accent at `finalHue + 30` can land at 45-75° (yellow-brown) with `s=100, l=70+` — high saturation but still in the brown hue band. The Mud Guard never touches it.

### DIAGNOSIS

**The secondary turns brown because:**
1. The Anti-Mud Protocol (WAVE 81) only checks `finalHue` (primary) at line 1485 — before secondary exists.
2. The Fibonacci rotation (`+137.5°`) can push the secondary into the 45-90° swamp zone.
3. The Mud Guard (WAVE 85) DOES check secondary at line 1917, but only if `mudGuard.enabled` is in the constitution. For Techno/Idle/Rock, there's no mudGuard, so the secondary is unprotected.

**The accent turns brown because:**
1. The `+30°` analogous offset can land the accent in the 45-75° yellow-brown band.
2. The Mud Guard at lines 1916-1918 **never calls `fixDirtyColor(pal.accent)`** — it's simply missing from the list.
3. The Neon Protocol (line 2110) would catch it IF enabled, but Latino constitution doesn't have `neonProtocol` configured.

---

## AUDIT TARGET 2: Procedural Seed Stability — The Macro-Cycle Mutation

### Where the Offsets Are Defined

| Offset | Line | Formula | Current value |
|--------|------|---------|---------------|
| **Secondary** | 1669 | `finalHue + fibonacciRotation + saltRotation` | `fibonacciRotation = options?.fibonacciRotationDeg ?? PHI_ROTATION (222.5°)` |
| **Accent** | 1702-1727 | `finalHue + 30 / 120 / 180` (strategy-dependent) | Hardcoded constants |
| **Ambient** | 1754-1767 | `finalHue + 240 / secondaryHue+30 / finalHue-30` (strategy-dependent) | Hardcoded constants |

The `fibonacciRotation` is already configurable via constitution (`fibonacciRotationDeg`), but the accent and ambient offsets are **pure hardcoded constants** with no procedural variation.

### Proposed Stable Mutation Math (Zero-Allocation)

The key insight: `_macroCycleCount` increments only when the Sidereal Clock wraps around its slot array (every ~30 minutes for 6 slots × 5 min each). Within a slot, it's absolutely stable. This makes it the perfect seed for procedural variety.

```typescript
// 🌌 WAVE 7723: PROCEDURAL OFFSET MUTATION
// Stable within a slot, varies across macro-cycles (every ~30 min).
// Uses _sessionEntropy (set once at session start) XOR _macroCycleCount
// to generate a deterministic per-cycle perturbation.
//
// Math: hash(sessionEntropy ^ macroCycleCount) → small angular delta
// The delta is bounded to ±15° to stay within the strategy's "feel"
// (analogous stays analogous, triadic stays triadic).

// Simple integer hash (no allocation, no Math.random):
const _cycleSeed = (this._sessionEntropy ^ (this._macroCycleCount * 2654435761)) >>> 0;
// Use the top 16 bits mapped to ±15°:
const _cycleDelta = ((_cycleSeed >> 16) % 31) - 15;  // range: -15 to +15

// Apply to offsets:
const secOffset  = fibonacciRotation + saltRotation + _cycleDelta;
const accOffset  = baseAccOffset + _cycleDelta;      // 30/120/180 + delta
const ambOffset  = baseAmbOffset + _cycleDelta;      // 240/30/-30 + delta
```

**Why this is stable:**
- `_sessionEntropy` is set once (first non-zero audio frame) and never changes during the session.
- `_macroCycleCount` only increments when `slotIndex` wraps around (line 1533: `slotIndex < _lastSlotIndex`). Within a slot (5 minutes), both values are constant → `_cycleDelta` is constant → offsets are constant → **zero jitter within a slot**.
- Across macro-cycles (~30 min), `_macroCycleCount` increments → `_cycleDelta` changes → palettes feel fresh.
- The `±15°` bound ensures the mutation never pushes an analogous accent (+30°) into triadic territory (+120°). The strategy "feel" is preserved.

**Why `2654435761`:** This is Knuth's multiplicative constant (2^32 / φ). It provides excellent bit-avalanche for integer hashing — small changes in input produce wildly different outputs, ensuring consecutive macro-cycles get visually distinct deltas.

**Integration point:** The mutation would be applied at lines 1657 (fibonacciRotation), 1700-1727 (accentHue), and 1754-1767 (ambientHue) — replacing the hardcoded constants with `constant + _cycleDelta`.

---

## SUMMARY

| Flaw | Root Cause | Fix Location |
|------|-----------|--------------|
| **Secondary brown** | Anti-Mud (WAVE 81) only checks `finalHue` at line 1485. Mud Guard (WAVE 85) checks secondary but only when `mudGuard.enabled`. Techno/Idle have no mudGuard. | Add `fixDirtyColor(pal.secondary)` to a universal post-processing guard, not gated by `mudGuard.enabled`. |
| **Accent brown** | Mud Guard at lines 1916-1918 **never calls `fixDirtyColor(pal.accent)`** — it's missing from the list. | Add `fixDirtyColor(pal.accent)` at line 1918. |
| **No procedural variety** | Accent/ambient offsets are hardcoded constants (30/120/180/240/-30). No mutation across hours of playback. | Add `_cycleDelta` derived from `_sessionEntropy ^ _macroCycleCount` to all three offsets. Stable within slot, varies across macro-cycles. |