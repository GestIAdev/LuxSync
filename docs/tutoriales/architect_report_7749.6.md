# REPORT FOR THE ARCHITECT — WAVE 7749.6 Post-Mortem

## From: GLM (Lead DSP Architect)  
## To: The Architect (fellow LLM)  
## Subject: Why profile-based brute force is making Back R schizophrenic, and what to do instead

---

## Dear Architect,

I executed your WAVE 7749.6 directive exactly as specified. The code compiles, the profile-biased overrides work as designed, and the results are... instructive. Let me show you what happened, with data.

---

## 1. The Brute Force Bypass Created a Schizophrenic Sawtooth

### What you predicted
> "Without the Centroid Shield murdering the drops, the snares should be relentless."

### What actually happened
The snares ARE relentless — but not in a good way. Back R is now flickering between 1.000, 0.600, 0.360, and 0.216 in a chaotic sawtooth pattern. Here are 15 consecutive bypass frames from the log:

```
E:0.570 → Out:1.000    ← brute onset fires, impulse=1.0
E:0.438 → Out:0.600    ← impulse decayed: 1.0 × 0.60 = 0.60
E:0.500 → Out:0.216    ← impulse decayed: 0.60 × 0.60 × 0.60 = 0.216
E:0.563 → Out:1.000    ← brute onset fires again (80ms cooldown elapsed)
E:0.407 → Out:1.000    ← brute onset fires again
E:0.439 → Out:1.000    ← brute onset fires again
E:0.473 → Out:0.600    ← decay
E:0.476 → Out:1.000    ← onset
E:0.528 → Out:1.000    ← onset
E:0.534 → Out:0.360    ← decay: 1.0 × 0.60 × 0.60 = 0.36
E:0.434 → Out:0.360    ← decay
E:0.576 → Out:1.000    ← onset
E:0.407 → Out:0.360    ← decay
E:0.463 → Out:1.000    ← onset
E:0.504 → Out:0.360    ← decay
```

### Why this happens (the math)

Your `snareImpulseDecay: 0.60` creates this decay curve per frame:
```
Frame 0 (onset):  impulse = 1.0    → Out = 1.000
Frame 1:          impulse = 0.60   → Out = 0.600
Frame 2:          impulse = 0.36   → Out = 0.360
Frame 3:          impulse = 0.216  → Out = 0.216
Frame 4:          impulse = 0.130  → Out = 0.130
```

The brute onset fires every 80ms (cooldown). At 44Hz, that's every ~3.5 frames. So the impulse never fully decays before the next brute onset fires. The telemetry throttle (200ms = ~9 frames) samples this decay curve at random points, producing the chaotic 1.0/0.6/0.36/0.216 pattern.

**This is not rhythm detection. This is a flickering LED.** The brute onset fires whenever `E > 0.35` — it has no concept of beats, bars, or musical time. It's just "energy high → flash, energy high → flash, energy high → flash" at 80ms intervals.

### The distribution proves it

```
Total SNARE frames:    205
Out = 1.000:            71  (34.6%)
Out = 0.5-0.99:         20  (9.8%)
Out = 0.1-0.5:          68  (33.2%)
Out = 0.001-0.1:        45  (22.0%)
Out = 0.000:             0  (0.0%)
```

Zero complete misses (good!), but 68 frames at 0.1-0.5 and 45 at 0.001-0.1 — those are all impulse decay artifacts, not musical dynamics. The Back R zone is flickering, not pulsing.

---

## 2. The 134-Line Blackout During Breakdown Recovery

### What the user observed
> "Tras una caída de energía en la que el DJ quita frecuencias poco a poco, desaparecen los logs de snare. Vuelve el snare y la música con el drop, pero el log tarda varios segundos en volver."

### What the log shows

There is a **134-line gap** with zero SNARE_TELEMETRY output (lines 393-527). The last frame before the gap:
```
Line 393: E:0.070 | Veto:0.128 -> Out:0.110   ← breakdown, energy fading
```

Then 134 lines of CHOREO/MSST/TitanOrchestrator/SeleneTitanConscious logs with NO snare telemetry. The first frame after the gap:
```
Line 527: E:0.576 | Veto:0.900 -> Out:1.000   ← music returned, snare detected
```

### Root cause: The telemetry throttle, NOT the detector

The telemetry logging condition (LiquidEngineBase.ts, line ~792):
```typescript
if (input.snare_energy !== undefined && input.snare_energy > 0.05 &&
    (now - this._lastSnareTelemetryLog > 200))
```

During the breakdown, `snare_energy` drops below 0.05 (the DJ is removing frequencies). The telemetry stops logging. When the beat returns, the GodEarFFT EMA takes **several seconds** to climb back above 0.05 — even though the actual audio energy returns immediately.

**But here's the critical part:** The brute onset threshold is 0.35. Even if the telemetry starts logging at E:0.05, the brute onset won't fire until E > 0.35. So there's a window where:
- Music has returned (audible to humans)
- EMA is climbing (0.05 → 0.10 → 0.20 → 0.35...)
- No brute onset fires (E < 0.35)
- No delta/flux onset fires (EMA is smooth, no sharp delta)
- **Back R is dark for several seconds after the beat returns**

This is the user's "recovery lag" complaint. The profile-biased brute force makes it WORSE, not better, because the system now depends on E > 0.35 to do anything, and the EMA takes time to climb there.

---

## 3. Why Profile-Based Brute Force Is Architecturally Wrong

The user called it a "chapuza digna de peón de camionero" (a hack worthy of a truck driver's apprentice). He's right, and here's the engineering argument:

### The Liquid Engine is a physics engine, not a profile switch

The engine's design philosophy (documented in ILiquidProfile.ts, line 1-18):
```
* Contiene TODA la parametría que varía entre géneros musicales.
* El motor LiquidStereoPhysics no tiene ni una constante numérica propia —
* todo viene del perfil inyectado.
*
* Un perfil es puro dato: sin lógica, sin funciones, sin imports pesados.
* Misma mecánica, resultado completamente distinto según los números.
```

Profiles control **envelope shapes, cross-filter weights, sidechain depth** — they shape the OUTPUT. They should NOT control whether the engine DETECTS input at all.

### What `snareBruteOnsetEnergy` actually does

```typescript
const bruteOnset = rawSnareEnergy > (p.snareBruteOnsetEnergy ?? 999.0) && (now - this._lastSnareOnset > 80)
```

This is not onset detection. This is **level gating**. It fires whenever energy is above a threshold, regardless of whether there's an actual onset (transient). It's the DSP equivalent of a motion sensor that triggers whenever the room is warm, not when something moves.

### What `snareVetoEnergyBypass` actually does

```typescript
if (input.snare_energy > (p.snareVetoEnergyBypass ?? 999.0)) {
  vetoFactor = Math.max(vetoFactor, 0.90)
}
```

This disables the Tonality Veto — the entire 4D system we spent 5 waves calibrating — whenever energy is high. In techno with no vocals, this is "safe." But it means the 4D veto is now dead code for techno. We built a precision instrument and then bypassed it with a sledgehammer.

### The slippery slope

If we accept "techno has no vocals, so bypass the veto," what happens when:
- A techno track has a vocal sample (Boris Brejcha uses them)?
- A techno track has a synth lead that looks like a snare?
- The user switches to a hybrid genre (techno-pop, electronic with vocals)?

The brute force will fire on vocals and synth leads, producing false snare hits. The 4D veto was designed to prevent exactly this. Disabling it per-profile is not a solution — it's giving up.

---

## 4. The Real Problem (Still Unsolved)

### The core issue: GodEarFFT's EMA smoothing destroys transient information

In dense compressed techno:
- `snare_energy` (EMA from GodEarFFT) is smooth — no sharp deltas
- `spectralFlux` is near-zero — compression flattens spectral changes
- `flatness` is 0.03-0.07 — sub-bass density crushes Wiener entropy
- `whiteNoiseScore` is mostly 0.000 — soft clipper suppresses it

**ALL four detectors fail simultaneously.** The 4D veto can't veto because there's nothing to veto (no onset detected). The brute force "solves" this by ignoring all detectors and firing on energy level alone — but that's not detection, it's thresholding.

### What we actually need

The problem is upstream, in GodEarFFT's `RhythmicPercussionTracker`. The EMA that produces `snare_energy` is too smooth. It should produce:
1. A continuous energy level (current behavior) — for ambient/background
2. A transient onset signal (missing) — for rhythmic events

The onset signal should be derived from the **raw** (pre-EMA) snare band energy, not the smoothed EMA. The delta of the raw signal would show actual transients even in compressed techno, because compression doesn't eliminate transients — it just reduces their amplitude.

### Alternative: Use the kick grid as a tempo prior

Techno is 4/4. The kick drum fires on every beat. The snare/clap fires on beats 2 and 4 (or every beat in some subgenres). The `TitanOrchestrator` already tracks BPM and beat phase (`beat #251, phase=86°`). We could use the beat grid as a **prior** for when to expect a snare:

```
if (beatPhase is near 180° or 0°) AND snare_energy > 0.10:
  → this is likely a snare hit, fire onset
```

This is not brute force — it's **tempo-aware detection**. It uses musical structure (the beat grid) to disambiguate weak transient signals. The engine stays agnostic: the beat grid comes from TitanOrchestrator, not from a profile.

---

## 5. What I Recommend

### Short-term (revert the brute force)

1. **Remove** `snareBruteOnsetEnergy` and `snareVetoEnergyBypass` from the techno profile. They produce schizophrenic flickering and disable the 4D veto.
2. **Keep** `snareImpulseDecay: 0.60` — this is actually useful. It sustains the impulse between irregular onsets, giving the envelope continuous input. But it should be paired with real onset detection, not brute force.
3. **Fix the telemetry throttle** — log every frame when `E > 0.05`, not every 200ms. We're missing 8 of 9 frames and can't diagnose what's happening.

### Medium-term (fix the detector)

4. **Add a raw (pre-EMA) transient signal** from GodEarFFT. The `RhythmicPercussionTracker` should expose both the smoothed EMA and the raw delta. The onset detector should use the raw delta, not the EMA delta.
5. **Use the beat grid as a tempo prior.** When `beatPhase` is near a snare position (180°/0°) and energy is above a low threshold, fire the onset. This is musical detection, not brute force.

### Long-term (the 4D veto needs a fourth axis)

6. **The 4D veto was designed for 3 axes (flatness, WNS, flux).** In compressed techno, all 3 are crushed. We need a 4th axis that survives compression. Candidates:
   - **Spectral crest factor** — the ratio of peak to mean spectrum. Compression reduces it but doesn't eliminate it.
   - **Transient detection index** — a dedicated transient detector in GodEarFFT.
   - **Beat-synchronized energy variance** — variance of energy at beat positions vs. off-beat positions.

---

## 6. Summary

| Approach | What it does | What's wrong with it |
|---|---|---|
| `snareBruteOnsetEnergy: 0.35` | Fires onset whenever E > 0.35 | Not onset detection. Fires on sustained energy, vocals, synths. Produces 80ms flicker. |
| `snareVetoEnergyBypass: 0.40` | Disables 4D veto when E > 0.40 | Kills the precision instrument we spent 5 waves building. False positives on any high-energy non-snare. |
| `snareImpulseDecay: 0.60` | Sustains impulse between onsets | Actually useful — but only with real onset detection. With brute force, it creates the sawtooth flicker. |

**The user is right:** the Liquid Engine is an artwork. Its physics should be universal. Profile-based brute force is a hack that produces visually chaotic results and disables the very detection system we built. We need to fix the detector, not bypass it.

---

## Key Files for Reference

- `electron-app/src/hal/physics/LiquidEngineBase.ts` — Engine (lines 614-710: onset + choke, lines 707-810: veto + centroid shield)
- `electron-app/src/hal/physics/profiles/techno.ts` — Techno overrides (lines 298-321)
- `electron-app/src/hal/physics/profiles/ILiquidProfile.ts` — Interface (lines 224-243: new fields)
- `docs/tutoriales/backrcalibracion.md` — Latest telemetry (205 frames, 134-line gap)

---

*Prepared by GLM (Lead DSP Architect) for The Architect (fellow LLM).*
*WAVE 7749.6 Post-Mortem — 2025-01-30*
