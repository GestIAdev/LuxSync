Voy a leer ambos logs en paralelo para hacer el análisis comparativo.

Tengo ambos logs. Ahora necesito leer las secciones del LiquidEngineBase donde se calculan el `dynamicSnareThreshold`, `dynamicFluxGate`, `bFct` y `fFloor` para proponer los ajustes exactos.

Necesito ver dónde se compara el `Drive` con el `threshold` y dónde se calcula el `fFloor`.

Now let me find where `residual` and `bodyFactor` are computed (the NLMS bleed subtraction).

Now let me see the input extraction (crack, bassE, bodyFactor, snareEnergy) and the bypass rescue thresholds context.

Let me see the input extraction at the top of the snare detection block.

Now let me read both telemetry logs to do the forensic comparison.

Let me read the rest of both files.

Let me check the total line counts of both files to ensure I've captured everything.

Both files are large (1130 and 1013 lines). Let me extract the key statistics programmatically to do a proper forensic comparison.

Excellent data. Let me run a deeper analysis to check for potential false positives before formulating the proposal.

Now let me clean up the temporary analysis files and read the exact code locations I'll be referencing in my proposal.

Let me verify the exact code locations for the bypass paths and WNS soft gate before finalizing the proposal.

Now I have all the data I need. Let me present the forensic analysis and proposal to the architect.

---

## Forensic Analysis: Pre-FFT vs Post-FFT Snare Detector — Purple Noise / Boris Brejcha

### 1. Signal Distribution Shift (Pre → Post)

The AGC refactor (removed post-FFT inputGain, removed 2.25× inflation, added spectral tilt, corrected attack/release, reduced history) compressed the snare-band signal dramatically:

| Signal | Pre mean | Post mean | Δ | Pre p95 | Post p95 |
|--------|----------|-----------|---|---------|----------|
| SnareE | 0.561 | 0.242 | **−57%** | 1.000 | 0.492 |
| UnG | 0.190 | 0.121 | −36% | 0.449 | 0.267 |
| Res | 0.092 | 0.057 | −38% | 0.310 | 0.200 |
| sEF | 0.820 | 0.481 | **−41%** | 1.000 | 0.983 |
| Drive | 0.019 | 0.004 | **−79%** | 0.031 | 0.012 |
| cFx | 0.053 | 0.064 | +21% | 0.214 | 0.263 |
| WNS | 0.019 | 0.082 | +331% | 0.169 | 0.739 |
| Flux | 0.056 | 0.061 | +9% | 0.287 | 0.325 |
| Veto | 0.063 | 0.131 | +108% | 0.388 | 0.667 |
| dynTh | 0.022 | 0.017 | −23% | 0.030 | 0.022 |
| fFloor | 0.045 | 0.040 | −11% | 0.045 | 0.040 |

**Onsets: 30 → 23 (−23%)**. **Kicks: 322 → 306**.

The key collapse is in `Drive` (−79%), driven by the multiplicative equation `Drive = Res × cFx × bFct × sEF`. Both `Res` (−38%) and `sEF` (−41%) fell because the AGC tilt reduced crack-band energy and `SnareE` simultaneously. When `bFct` is also at its 0.300 floor (no body resonance), the product collapses to near zero.

### 2. Missed Snare Candidates (Post-FFT)

**49 frames** with clear transient evidence (`RawΔ > 0.10`, `Flux > 0.15`, `OutSnare = 0.000`):

- **ALL 49** have `Drive < 0.040` (the fFloor). Max Drive = 0.027, mean = 0.007.
- **ALL 49** have `gH = 1.000` (gate alive — ghost rescue unavailable).
- **ALL 49** have `UnG < 0.30` and `Res < 0.21` — the bypass rescue thresholds (`UnG > 0.4`, `Res > 0.3`) are unreachable.
- 36 of 49 have `Drive < 0.01` — far below any plausible floor.

**Root cause: Drive starvation.** The multiplicative `Res × cFx × bFct × sEF` cannot produce enough drive to cross `fFloor = 0.040` when the AGC tilt has compressed `Res` and `sEF` simultaneously.

### 3. Successful Onsets (Post-FFT) — For Comparison

All 23 successful onsets share a common signature:
- `bFct = 2.000` (body factor maxed — body resonance present)
- `sEF ≈ 1.000` (smart sEF maxed — SnareE high enough)
- `cFx > 0.276` (crack flux strong)
- `Res > 0.20` (residual substantial)
- `Drive > 0.028` (above fFloor)

The detector only fires when **all four multiplicative factors are simultaneously high**. Post-FFT, this only happens on the strongest snare hits. Moderate snares with `bFct = 0.300` (no body resonance) or `sEF < 0.7` (moderate SnareE) are starved.

### 4. Rejection Mechanism Classification

| Class | Count | Mechanism | Evidence |
|-------|-------|-----------|----------|
| **A. Drive-starved** | 45/49 | `Res × cFx × bFct × sEF < fFloor` | Drive 0.002–0.027, all below 0.040 |
| **B. Bypass unreachable** | 49/49 | `UnG > 0.4`, `Res > 0.3`, `RawD > 0.2` calibrated for pre-FFT range | Post-FFT max UnG=0.464, max Res=0.399 |
| **C. WNS soft gate** | 4/49 | `gH>0.1 && WNS<0.05 && Flux<0.25` reduces crackDrive ×0.3 | High-SnareE missed: raw crackDrive 0.08–0.13 → gated to 0.025–0.040 |
| **D. Ghost blocked** | 49/49 | `gH = 1.000` → `ghostGateFactor = 1 - gH = 0` | Ghost path produces zero output |
| **E. dynTh** | 0/49 | dynTh is lower post-FFT (0.017 vs 0.022) | Not a blocker — Drive is below any threshold |

**Class A is the dominant blocker.** The bypass rescue (Class B) was designed to catch exactly these cases, but its thresholds are calibrated for the pre-FFT range and are now unreachable.

### 5. High-SnareE Missed (Class C — WNS Soft Gate Victims)

4 frames with `SnareE > 0.40`, `Res > 0.15`, `bFct = 2.000`, `sEF ≈ 1.000`:

| # | SnareE | Res | cFx | bFct | sEF | raw crackDrive | WNS-gated | Drive | fFloor |
|---|--------|-----|-----|------|-----|----------------|-----------|-------|--------|
| 0 | 0.508 | 0.219 | 0.305 | 2.000 | 1.000 | **0.134** | 0.040 | 0.040 | 0.040 |
| 1 | 0.417 | 0.166 | 0.353 | 1.829 | 0.833 | **0.089** | 0.027 | 0.027 | 0.040 |
| 2 | 0.522 | 0.177 | 0.289 | 2.000 | 1.000 | **0.102** | 0.031 | 0.031 | 0.040 |
| 3 | 0.531 | 0.158 | 0.259 | 2.000 | 1.000 | **0.082** | 0.025 | 0.025 | 0.040 |

These are **real snares** (high SnareE, high Res, high bFct, high cFx) that the WNS soft gate (line 1262) reduces by 70% because `WNS = 0.000` and `Flux < 0.25`. Without the gate, their Drive would be 0.082–0.134, well above fFloor. The gate was designed to block **synth stabs** (which have `Res < 0.05`), but these frames have `Res > 0.15`.

---

## Proposed Modifications (Awaiting Architect Approval)

### Proposal 1: Lower Bypass Rescue Thresholds (lines 1456–1458)

**Current:**
```ts
ungatedSnare > 0.4 &&
residual > 0.3 &&
rawSnareDelta > 0.2 &&
```

**Proposed:**
```ts
ungatedSnare > 0.15 &&
residual > 0.10 &&
rawSnareDelta > 0.10 &&
```

**Rationale:** Post-FFT max values are UnG=0.464, Res=0.399, RawD=0.414. The current thresholds (0.4, 0.3, 0.2) are at or above the post-FFT maximums, making the bypass unreachable for all but the strongest hits. The proposed thresholds (0.15, 0.10, 0.10) are:
- **Above hi-hat range**: hi-hats have UnG < 0.05, Res ≈ 0, cFx ≈ 0
- **Above synth-stab range**: synth stabs have Res < 0.05 (per code comments)
- **Above noise-tail range**: noise tails have RawD < 0 (decay)

**Safety:** The existing hi-hat exclusion `!(snareEnergy < 0.2 && hhEnergy > 0.5)` and Flux > 0.20 requirement remain in place. The `residual > 0.10` threshold is the primary discriminator — real snares have Res > 0.10, while hi-hats/synth-stabs/noise have Res < 0.05.

**Expected impact:** 32 missed frames would fire as new onsets (from my simulation). 25 of these have SnareE > 0.15 (clear snares). 7 have SnareE 0.10–0.14 with Res 0.12–0.18 (borderline — could be low-crack snares or layered noise). The 7 borderline frames all have Flux > 0.30 and WNS > 0.10, consistent with broadband transients rather than hi-hats (hi-hats have Flux < 0.15).

**False-positive risk:** Low. The `residual > 0.10` threshold blocks hi-hats (Res ≈ 0) and synth stabs (Res < 0.05). The Flux > 0.20 requirement blocks narrowband noise. The hi-hat exclusion blocks high-hE/low-SnareE frames.

### Proposal 2: Residual Exemption for WNS Soft Gate (line 1262)

**Current:**
```ts
if (gateHealth > 0.1 && wns < 0.05 && spectralFlux < 0.25) {
  crackDrive *= 0.3
}
```

**Proposed:**
```ts
if (gateHealth > 0.1 && wns < 0.05 && spectralFlux < 0.25 && residual < 0.12) {
  crackDrive *= 0.3
}
```

**Rationale:** The WNS soft gate targets synth stabs with high SnareE/bFct but no WNS. Synth stabs have `Res < 0.05`. Real snares with low Flux (narrowband synthetic snares) have `Res > 0.15`. Exempting `Res > 0.12` preserves the synth-stab block while rescuing the 4 high-SnareE missed frames (Class C), whose raw crackDrive (0.082–0.134) would clear fFloor without the 70% reduction.

**Expected impact:** 4 high-SnareE missed frames would gain Drive 0.082–0.134 (above fFloor=0.040), making them eligible for MACD crossover or bypass rescue. Additionally, ~50 frames with SnareE > 0.3, Res > 0.12, WNS=0, Flux < 0.25 would have their crackDrive restored to raw values, potentially generating new onsets via the MACD path.

**False-positive risk:** Very low. Synth stabs (the gate's target) have Res < 0.05, well below the 0.12 exemption threshold.

### Proposal 3: Lower fFloor (profiles/techno.ts:340, profiles/rave.ts:341)

**Current:**
```ts
snareMomentumFloor: 0.040,
```

**Proposed:**
```ts
snareMomentumFloor: 0.025,
```

**Rationale:** Post-FFT Drive mean is 0.004, p95 is 0.012. The current fFloor=0.040 is above the p95 of Drive, meaning >95% of frames are below the floor. Lowering to 0.025 would allow the top ~13 missed candidates (Drive 0.010–0.027) to pass the floor check, while still blocking noise (Drive < 0.005 for non-transient frames).

**Expected impact:** ~13 additional frames would pass the `snareDrive >= snareFloor` check. These would still need a MACD crossover or bypass rescue to fire. This is a **blunt instrument** compared to Proposals 1 and 2, and should be considered optional or secondary.

**False-positive risk:** Moderate. Lowering the floor to 0.025 could let weak synth stabs or noise transients through if they happen to coincide with a MACD crossover. The WNS soft gate and veto still apply downstream.

### Proposal 4: No Change to dynTh, Veto, or Ghost Path

- **dynTh** is already lower post-FFT (0.017 vs 0.022) and is not the blocker.
- **Veto** is more favorable post-FFT (mean 0.131 vs 0.063) due to higher WNS.
- **Ghost path** is universally blocked by `gH = 1.000` (`ghostGateFactor = 0`), but this is correct behavior — the ghost path is designed for dead-gate scenarios, not alive-gate misses.

### Summary of Expected Outcomes

| Proposal | New onsets | Hi-hat FP risk | Synth-stab FP risk | Kick rejection |
|----------|-----------|----------------|-------------------|----------------|
| 1. Bypass thresholds | ~25–32 | Low (Res > 0.10 blocks HH) | Low (Res > 0.10 blocks stabs) | Preserved (Flux > 0.20) |
| 2. WNS residual exemption | ~4–10 | Very low (Res > 0.12) | Very low (Res > 0.12) | Preserved |
| 3. fFloor 0.040 → 0.025 | ~13 | Moderate | Low | Preserved |
| **Combined 1+2** | **~30–40** | **Low** | **Low** | **Preserved** |

**Recommendation:** Proposals 1 and 2 are the primary targeted fixes. Proposal 3 is optional and should only be applied if 1+2 are insufficient. All three preserve the existing hi-hat exclusion, Flux gate, and veto downstream.

Awaiting architect approval before any code changes.