# REPORT FOR OPUS — Snare Detection Crisis in Dense Techno (WAVE 7749.x)

## Executive Summary

The 4D snare detection system (Tonality Veto + Sustain Choke + Dual Onset Detector) has been calibrated across 5 iterations (WAVE 7749.0 through 7749.4). Despite fixing 3 critical bugs, the system still produces irregular, non-rhythmic snare detection in dense compressed techno (Boris Brejcha @ 100% volume). The latest Architect directive (WAVE 7749.5) proposes removing the "Centroid Shield" — **this diagnosis is incorrect**. This report presents the verified root causes for Opus to resolve.

---

## The 4D Algorithm Being Calibrated

### Signal Flow (LiquidEngineBase.ts)

```
input.snare_energy (EMA from GodEarFFT)
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. DUAL ONSET DETECTOR                  │
│    deltaOnset: snareDelta > 0.008       │
│              + E > 0.05 + 80ms cooldown │
│    fluxOnset:  flux > 0.04              │
│              + E > 0.08 + 80ms cooldown │
│    → _snareImpulse = 1.0 on onset      │
│    → impulse *= 0.04 per frame (decay) │
└─────────────────────────────────────────┘
       │
       ▼ hybridSnare = max(percRaw, impulse)
       │
┌─────────────────────────────────────────┐
│ 2. SUSTAIN CHOKE                        │
│    If no onset for > chokeFrames:       │
│      if E < 0.15: chokeFactor *= rate  │
│      if E >= 0.15: chokeFactor = 1.0   │
│      (High-Energy Guard)                │
│    hybridSnare *= chokeFactor           │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. TONALITY VETO (4D)                   │
│    3 axes, each [0,1] gate:             │
│    A. flatnessGate (Wiener entropy)     │
│    B. wnsGate (HF broadband noise)      │
│    C. fluxGate (spectral change rate)   │
│    vetoFactor = avg(A, B, C)            │
│    soft-knee: if veto > 0.15 → pass    │
│              else → hybridSnare *= v/0.15│
│    hybridSnare *= vetoFactor ramp       │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. CENTROID SHIELD (WAVE 2449)          │
│    if isKick AND centroid < floor      │
│       AND harshness < 0.024:            │
│       hybridSnare = 0.0                 │
│    (Only kills pure kick drum bleed)    │
└─────────────────────────────────────────┘
       │
       ▼
   envSnare.process(hybridSnare) → Back R zone
```

### Techno Profile Thresholds (techno.ts overrides41)

```
snareVetoFlatnessFloor: 0.02   (knee: 0.10)
snareVetoWnsFloor:      0.02   (knee: 0.20)
snareVetoFluxFloor:     0.05   (knee: 0.20)
snareChokeFrames:       15     (~340ms at 44Hz)
snareChokeRate:         0.85
```

---

## Why the Architect's WAVE 7749.5 Diagnosis is WRONG

### Claim: "Centroid Shield forcefully sets hybridSnare = 0 during heavy drops"

### Verification: FALSE

The Centroid Shield (line 803-810, LiquidEngineBase.ts) has THREE conditions:
1. `isKick` — only active for ~136ms after a kick detection
2. `currentCentroid < centroidFloor` — centroid below ~720Hz (techno morphFactor ~0.2)
3. `harshness < 0.024` — **extremely** low harshness (pure kick drum only)

**A snare hit has high harshness (> 0.024) and would NEVER be killed by this shield.** The shield is specifically designed to kill kick-drum body bleed, not snares.

### Telemetry Proof

Cross-referenced 163 SNARE_TELEMETRY frames from brejcha4.md (100% volume):

- **11 frames** with `Flux > 0.04 AND Veto > 0.15 AND Out < 0.1` — these look like "killed hits"
- ALL 11 have `Out:0.002` or `Out:0.040` — these are **impulse decay values**, NOT `0.000`
- If the Centroid Shield had fired, we'd see `Out:0.000` (it sets `hybridSnare = 0.0`)
- **ZERO frames** with `E > 0.3 AND Flux > 0.10 AND Veto > 0.20 AND Out:0.000`

The Centroid Shield is NOT killing any snares. The 11 suspicious frames are onset cooldown misses (impulse decayed between onsets).

---

## The REAL Problems (Verified via Telemetry)

### Problem 1: Profile Loading Delay (1.1s Blackout at Start)

**Severity: HIGH** — The first ~50 SNARE_TELEMETRY frames have ALL gates at `0.00`.

```
Frame 1:  Flat:0.041 (Gate:0.00)  ← should be 0.26 with floor=0.02
Frame 3:  Flat:0.063 (Gate:0.00)  ← should be 0.54 with floor=0.02
...
Frame 49: ALL gates still 0.00
Frame 50: Flat:0.058 (Gate:0.48)  ← FIRST non-zero gate, profile loaded
```

**Root cause:** The `fuseProfileFor41()` function merges profile overrides, but the profile isn't applied until ~50 frames after audio starts. During this window, the veto uses DEFAULT floors (0.10) instead of techno floors (0.02). Since techno flatness is 0.03-0.08 (below 0.10), all flatness gates are 0.00.

**Impact:** 1.1 seconds of complete snare blackout at every playback start.

### Problem 2: Onset Detection Inconsistency (The Core Issue)

**Severity: CRITICAL** — This is the main reason snares are irregular and "disappear after a few beats".

The Dual Onset Detector has two triggers:
- **deltaOnset**: `snareDelta > 0.008` — catches EMA jumps
- **fluxOnset**: `flux > 0.04` — catches spectral change

**In dense compressed techno, BOTH triggers fail frequently:**

| Frame | E | Flux | Should fire? | Why it fails |
|-------|------|-------|-------------|--------------|
| 4 | 0.565 | 0.002 | YES (high E) | Flux 0.002 << 0.04, delta ~0 |
| 10 | 0.388 | 0.019 | YES (high E) | Flux 0.019 < 0.04, delta ~0 |
| 14 | 0.410 | 0.005 | YES (high E) | Flux 0.005 << 0.04, delta ~0 |
| 27 | 0.582 | 0.089 | YES | Flux 0.089 > 0.04 ✓ but cooldown? |

**The paradox:** `snare_energy` (EMA from GodEarFFT) can be 0.5+ (clearly a snare is present), but `spectralFlux` is 0.002 (no spectral change detected). This happens because:
1. Heavy compression flattens transient dynamics
2. Dense sub-bass masks spectral changes in the snare frequency range
3. The EMA smoothing in GodEarFFT removes the transient edge

**The fluxOnset fires only when there's a sharp spectral change** — but in compressed techno, sharp changes are rare. The beats where flux > 0.04 fire correctly (Out:1.000), but they're a minority (~25% of high-energy frames).

### Problem 3: Impulse Decay Too Fast (96% per frame)

**Severity: MEDIUM** — The impulse decays by `*= 0.04` per frame:

```
Frame 0 (onset):  impulse = 1.0    → hybridSnare = 1.0
Frame 1:          impulse = 0.04   → hybridSnare = 0.04
Frame 2:          impulse = 0.0016 → hybridSnare = 0.0016
Frame 3:          impulse = ~0     → hybridSnare = 0
```

After 2 frames (~45ms), the impulse is effectively dead. If the next onset doesn't fire for 200-400ms (common in irregular detection), the Back R envelope gets no input and decays to nothing.

The envelope's own decay should sustain the Back R, but if onsets are irregular (every 200-400ms instead of every 469ms), the envelope decays between hits.

### Problem 4: Telemetry Logging Gap

**Severity: LOW (debugging only)** — The telemetry is throttled to 200ms, but onsets fire at frame rate (44Hz). We're seeing ~1 in 9 frames. Many onset frames are NOT logged, making it hard to trace the actual onset pattern. The `Out:0.040` frames are likely 1 frame after an unlogged onset.

---

## Telemetry Statistics (brejcha4.md, 163 SNARE frames)

```
Total SNARE_TELEMETRY frames: 163
Hits (Out:1.000):              42  (25.8%)
Misses (Out:0.000):            90  (55.2%)
Partial (0 < Out < 1):         31  (19.0%)

High-energy frames (E > 0.3):  72
High-energy hits:              28  (38.9% — 61% of high-energy beats MISSED)
```

**61% of high-energy beats are missed.** This is the core problem.

---

## What Was Already Fixed (WAVE 7749.0 - 7749.4)

1. ✅ `fuseProfileFor41()` not merging snareVeto* fields → Fixed (explicit field merging)
2. ✅ Sustain Choke killing high-energy percussion → Fixed (High-Energy Guard: E >= 0.15)
3. ✅ Impulse decayed in same frame as onset → Fixed (pre-decay capture)
4. ✅ Slow recovery after silence → Fixed (reset _prevSnareEnergy on silence)
5. ✅ Single onset detector missed 80% of beats → Fixed (Dual Onset: delta + flux)
6. ✅ Veto thresholds too strict → Fixed (lowered floors + soft-knee)

---

## Open Questions for Opus

1. **How to detect onsets when spectralFlux is near-zero but snare_energy is high?**
   - The EMA says "snare is present" but the flux says "nothing is changing"
   - Should we add a third trigger: "sustained high energy" → periodic re-trigger?
   - Or should we use a level-gated approach: if E > threshold for N frames, fire periodically?

2. **Should the impulse decay be slower?**
   - Current: 0.04 per frame (96% decay) → dead in 2 frames
   - Proposed: 0.50 per frame (50% decay) → sustains for ~5 frames
   - Risk: slower decay = more false positives from sustained noise

3. **Should we bypass the veto entirely when snare_energy is very high?**
   - If E > 0.5, it's almost certainly a real snare, regardless of tonality
   - The veto is designed to kill vocal/synth bleed, not to gate real percussion

4. **How to fix the profile loading delay?**
   - The first 50 frames use default thresholds (0.10) instead of profile thresholds (0.02)
   - Should fuseProfileFor41() be called earlier in the initialization?

---

## Key Files

- `electron-app/src/hal/physics/LiquidEngineBase.ts` — Engine (onset detection, choke, veto, centroid shield)
- `electron-app/src/hal/physics/profiles/techno.ts` — Techno profile overrides
- `docs/tutoriales/brejcha4.md` — Latest telemetry (100% volume, 163 frames)
- `docs/tutoriales/gravity3.md` — Previous telemetry (WAVE 7749.4)

---

*Prepared by GLM (Lead DSP Architect) for Opus (Chief Architect).*
*WAVE 7749.5 — 2025-01-30*
