# PROJECT URANUS — CHROMAGRAM GRAVITY ENGINE
## Architectural Draft (WAVE 7685) — Selene Color Evolution Blueprint

> **Role:** Lead Systems Architect & Principal Color Scientist
> **Status:** ARCHITECTURE DRAFT — no implementation code. Formulas, topology and invariants only.
> **Supersedes conceptually:** `KEY_TO_HUE` discrete mapping, `allowedHueRanges` clamping, `forbiddenHueRanges` elastic rotation.
> **Reference audit:** `docs/technical_audits/SELENE_COLOR_AUDIT.md`
> **Hard constraint inherited from audit:** the `generate()` hot path at 44 Hz is **certified zero-allocation**. Every formula below must be expressible as scalar arithmetic over pre-allocated state. No exceptions.

---

## 0. EXECUTIVE SUMMARY

The current engine derives the primary hue from a **discrete 12-entry lookup** (`KEY_TO_HUE[key]`) driven by a single stabilized key string. This is a lossy projection: the analyzer computes a rich 12-dimensional harmonic energy vector, collapses it to one of 12 labels, then collapses that to one of 12 angles. Two chords sharing a key label produce **identical** color. Information-theoretically we are discarding ~11 dimensions of harmonic data per frame.

Project Uranus replaces this with a **continuous gravitational field**: the hue is the *center of mass* of the full 12-bin chromagram acting on a circle whose topology is the circle of fifths. Three pillars:

| Pillar | Concept | Replaces |
|---|---|---|
| **I** | Barycentric Chromatic Mass — hue as circular center of mass of the chroma energy vector | `KEY_TO_HUE[key]` |
| **II** | Relativistic Sidereal Ring — global angular rotation `Φ(t)` of the basis wheel | `siderealClock.allowedHueRanges` clamping |
| **III** | Repulsive Void — smooth monotone forcefield evacuating `[25°, 80°]` | `forbiddenHueRanges` + elastic rotation |

**The headline result** (§2.2): under the circle-of-fifths topology, the three classical color-harmony strategies emerge *exactly* from the three most structurally important musical intervals. Perfect fifth → 30° (analogous). Major third → 120° (triadic). Tritone → 180° (complementary). The strategy system stops being an arbitrary label attached to a syncopation threshold and becomes a **measurable property of the harmony itself** — which resolves the "the UI lies" finding of WAVE 7681 at its root rather than patching it.

**Verdict:** architecturally sound, mathematically elegant, and cheaper per frame than the current forbidden-range iteration loop. One blocking prerequisite (Pillar 0, below).

---

## PILLAR 0 — THE WIRING GAP (BLOCKING PREREQUISITE)

Before any of this math can run, a data path must exist. It does not.

**Verified current state of the chromagram:**

```
GodEarFFT.computeChromaFromSpectrum()          → Float32Array(12), normalized to [0,1] by max
  ↳ GodEarResult.chroma: number[]              ✅ EXISTS   (workers/GodEarFFT.ts:235)
  ↳ WorkerProtocol.chroma?: number[]           ✅ EXISTS   (workers/WorkerProtocol.ts:193)
  ↳ SpectrumAnalyzer.chroma: number[]          ✅ EXISTS   (core/senses/spectrum/SpectrumAnalyzer.ts:70)
  ↳ AudioAnalysis.chroma?: number[]            ✅ EXISTS   (engine/musical/types.ts:688)
  ─────────────────────── DEAD END ───────────────────────
  ↳ EngineAudioMetrics                         ❌ ABSENT   (engine/TitanEngine.ts:126-162)
  ↳ MusicalContext (core/protocol)             ❌ ABSENT   — carries only `key: MusicalKey | null`
  ↳ ExtendedAudioAnalysis                      ❌ ABSENT   — the actual input to generate()
```

`TitanEngine.ts` contains **zero** occurrences of the string `chroma`. The 12-bin vector is computed 44 times per second and thrown away before it reaches the color engine, which instead consumes `key?: string`.

**Required (Pillar 0):** thread `chroma` through `EngineAudioMetrics` → `ExtendedAudioAnalysis`.

**Zero-alloc mandate.** `chroma` must NOT be passed as a fresh `number[]` per frame. Two compliant options:

- **0-A (preferred):** a module-level `Float64Array(12)` owned by the color engine. The producer *copies into* it (`for i: dst[i] = src[i]`). 12 float stores/frame, zero allocation, no aliasing risk.
- **0-B:** pass the existing worker-owned `Float32Array` by reference and treat it as read-only within `generate()`. Cheaper but couples lifetimes across the worker boundary and risks tearing if the worker mutates mid-read.

Recommend **0-A**.

**Normalization contract (must be pinned).** `computeChromaFromSpectrum` normalizes by the **max** bin, not the sum:

```
output[i] /= maxEnergy      ⇒   max_i c_i = 1,   Σ c_i ∈ [1, 12]
```

This is a *sup-norm* normalization. Pillar I's formulas must therefore never assume `Σ c_i = 1`. All weight sums are computed explicitly and divided out (§1.3). Documenting this prevents a whole class of silent scaling bugs.

---

## PILLAR I — BARYCENTRIC CHROMATIC MASS

### 1.1 Choice of topology: why the circle of fifths is forced, not chosen

We must place 12 pitch classes on a 360° circle. Two candidate maps:

**Chromatic adjacency:** `θ_i = 30i`. C=0°, C#=30°, D=60°, …
Semitone neighbours become hue neighbours. But the semitone is the *most dissonant* interval in tonal music. A minor-second cluster (maximum dissonance) would render as two nearly identical hues (maximum visual harmony). The map inverts the perceptual relationship it is supposed to express. **Rejected.**

**Circle of fifths:** `θ_i = ((7i) mod 12) · 30°`.
7 is a generator of ℤ₁₂ (gcd(7,12)=1), so `i ↦ 7i mod 12` is a **bijection** — every pitch class gets a unique slot, no collisions. Harmonically proximate notes become chromatically proximate. **Adopted.**

Resulting fixed basis (verified numerically):

| i | pitch | θ_i | i | pitch | θ_i |
|---|---|---|---|---|---|
| 0 | C  | 0°   | 6  | F♯ | 180° |
| 1 | C♯ | 210° | 7  | G  | 30°  |
| 2 | D  | 60°  | 8  | G♯ | 240° |
| 3 | D♯ | 270° | 9  | A  | 90°  |
| 4 | E  | 120° | 10 | A♯ | 300° |
| 5 | F  | 330° | 11 | B  | 150° |

Note this differs from the existing `ChromaCoupler.FIFTHS_HUE` table in `GodEarFFT.ts:1438`, which contains **duplicate entries** (`D♯` and `F♯` both map to `0.667`), breaking bijectivity. That table should be regarded as superseded by the closed form `((7i) mod 12)·30°`, which needs no lookup table at all.

### 1.2 The emergent strategy theorem

Because the map is `θ_i = 30·(7i mod 12)`, the angular separation induced by a musical interval of `k` semitones is:

```
Δθ(k) = 30 · (7k mod 12)      degrees
```

Evaluating for the structurally decisive intervals:

| Interval | k (semitones) | 7k mod 12 | Δθ | Classical color strategy |
|---|---|---|---|---|
| Unison | 0 | 0 | 0° | monochromatic |
| **Perfect fifth** | 7 | 1 | **30°** | **analogous** |
| Major second | 2 | 2 | 60° | analogous (wide) |
| **Major third** | 4 | 4 | **120°** | **triadic** |
| **Tritone** | 6 | 6 | **180°** | **complementary** |
| Minor third | 3 | 9 | 270° | triadic (inverse) |
| Semitone | 1 | 7 | 210° | split-complementary |

The three strategies the engine currently *declares* from a syncopation threshold are exactly the three intervals the harmony *contains*. Consequences:

1. **Strategy becomes measurable.** Rather than `syncopation < 0.40 ⇒ 'analogous'`, the engine can report the strategy actually present in the chroma vector (via interval-content analysis, §1.6). The UI stops lying because the label is derived from the same quantity as the colors.
2. **Tritone transposition = complementary rotation.** Verified: C major → 45°, F♯ major → 225°, exactly 180° apart. The most dissonant transposition produces the maximum chromatic contrast, for free, with no special-case code.
3. **Fibonacci becomes unnecessary.** The WAVE 7684 strategy-obedient secondary (`+15°` analogous / `+222.5°` otherwise) is a *hand-tuned surrogate* for interval geometry the chroma vector already contains. Under Uranus, the secondary can be derived from the **second-strongest harmonic mass** rather than a golden-angle constant.

### 1.3 The barycenter formula

Naïve angular averaging is invalid on a circle (`mean(350°, 10°) = 180°`, catastrophically wrong). The correct construction is the **circular first moment** — treat each pitch class as a point mass on the unit circle and sum the position vectors.

**Weighting.** Raw chroma is too flat; a tonal centre must dominate. Apply a sharpness exponent γ:

```
w_i = c_i ^ γ                     γ = 2 (default; matches existing ChromaCoupler behaviour)
```

γ is the single most important tuning knob. γ=1 → democratic, mushy, hue drifts toward the circle's centroid. γ=2 → dominant-note emphasis, good default. γ→∞ → degenerates to argmax, i.e. back to discrete `KEY_TO_HUE` behaviour. **γ is a continuous dial between "continuous field" and "discrete lookup"**, which makes migration risk-free: ship at high γ to mimic current behaviour, lower it to unlock the field.

**Mass vector.**

```
M_x = Σ_{i=0}^{11}  w_i · cos θ_i
M_y = Σ_{i=0}^{11}  w_i · sin θ_i
W   = Σ_{i=0}^{11}  w_i
```

`cos θ_i` and `sin θ_i` are **compile-time constants** (12 values each, both drawn from {0, ±0.5, ±0.866, ±1}). Two `Float64Array(12)` module-level LUTs. Cost per frame: 12 × (1 pow + 2 mul + 3 add) ≈ 70 flops. Negligible.

**Barycentric hue and coherence.**

```
H_bary = atan2(M_y, M_x)                    (normalized to [0, 360))
R      = √(M_x² + M_y²) / W                 ∈ [0, 1]
```

### 1.4 R — the free confidence channel

`R` is the **circular resultant length** (Rayleigh's R) — the classical concentration statistic of directional statistics. It arrives free with the barycenter and is arguably more valuable than the hue itself.

- `R → 1`: all harmonic energy concentrated at one angle. Pure, unambiguous tonality.
- `R → 0`: energy spread evenly around the circle. Atonal, percussive, noise. **Hue is mathematically undefined** (`atan2(0,0)`) and numerically unstable near zero.

Circular variance is `V = 1 − R`.

Verified behaviour:

| Chroma content | H_bary | R | Interpretation |
|---|---|---|---|
| Single note C | 0° | 1.000 | maximum purity |
| Power chord C5 {C,G} | 15° | 0.966 | near-pure (fifth = 30° apart) |
| C major {C,E,G} | 45° | 0.644 | consonant triad |
| A minor {A,C,E} | 75° | 0.644 | consonant triad |
| E minor {E,G,B} | 105° | 0.644 | consonant triad |
| F♯ major {F♯,A♯,C♯} | 225° | 0.644 | tritone of C maj → exactly +180° |
| C maj + tritone {C,E,G,F♯} | 75° | 0.354 | **dissonance halves R** |
| Full 12-tone cluster | undefined | 0.000 | hue must be held |

**Three high-value uses of R:**

1. **Saturation from tonal purity.** `S = S_min + (S_max − S_min)·R^p`. Dissonant/atonal passages desaturate toward white; consonant passages bloom into saturated color. This is a *physically motivated* saturation law replacing the current energy-driven `baseSat = 85 + energy·15`. Adding a tritone to a major triad drops R from 0.644 → 0.354 and the lights visibly lose chroma. This is the single most expressive consequence of the whole design.
2. **Numerical guard.** Below `R_min` (~0.08) the hue is noise. Hold the previous hue, decay saturation. This replaces ad-hoc silence detection with a principled criterion.
3. **Strategy confidence.** Report `R` to the UI alongside the strategy label so the operator can see *how much to trust* the palette.

**Known limitation (must be documented, not hidden):** `R` is invariant under rotation *and reflection*, and the major and minor triads are reflections of one another. Hence C major and A minor share `R = 0.644` exactly. **R cannot distinguish major from minor.** Mode must continue to come from `MODE_MODIFIERS` / the harmony detector. Uranus replaces the *key→hue* mapping, not the *mode* system.

### 1.5 Temporal integration — smooth the vector, never the angle

Chroma at 44 Hz is noisy. Smoothing must happen in the **vector domain**:

```
M̄_x ← (1−α)·M̄_x + α·M_x
M̄_y ← (1−α)·M̄_y + α·M_y
W̄   ← (1−α)·W̄   + α·W
```

then derive `H` and `R` from the smoothed accumulators. Two reasons this is strictly superior to smoothing the angle:

- **No wraparound pathology.** An EMA on an angle crossing 359°→1° swings through 180°. An EMA on a vector cannot: it is coordinate-free.
- **Destructive interference is physically correct.** When the harmony changes rapidly, successive `M` vectors point in different directions and partially cancel, so `|M̄|` — and therefore `R` — *drops automatically*. The system desaturates while it is "uncertain" and re-saturates when it settles. This emergent hesitation requires no extra code. It is the most beautiful property of the construction.

**Dual-rate architecture.** Maintain two accumulators:

- `α_fast` ≈ 0.15 (τ ≈ 150 ms) — chord-level reactivity, drives accent/beam colors.
- `α_slow` ≈ 0.005 (τ ≈ 4.5 s) — key-level structure, drives wash/primary.

The fast/slow *disagreement* `|H_fast − H_slow|` is a modulation/tension signal: it spikes on key changes. Free harmonic-event detector.

### 1.6 Deriving the full palette from harmonic mass

With the field in place, the derived colors stop being constant rotations of the primary:

- **Primary** — `H_slow` (structural).
- **Secondary** — angle of the **residual mass** after projecting out the primary direction: subtract the primary's contribution from `M` and re-take `atan2`. This yields the *second harmonic center*, i.e. the genuine secondary tonal region. Replaces the golden-angle constant entirely.
- **Accent** — `H_fast`, the reactive chord-level center.
- **Ambient** — the **anti-mass** direction `argmin` of the energy distribution: the emptiest region of the circle, `H_bary + 180°` weighted by the actual minimum. Musically: "the color of the notes that are *not* being played." Conceptually strong and trivially cheap.
- **Strategy label** — computed from **interval content**: correlate the chroma autocorrelation at lags 7, 4 and 6 semitones and report whichever of analogous/triadic/complementary dominates.

This is the structural fix for WAVE 7681. The label and the colors derive from one source.

---

## PILLAR II — THE RELATIVISTIC SIDEREAL RING

### 2.1 The reactivity-gain theorem (why clamping must die)

Define **reactivity gain** as the derivative of output hue with respect to audio-derived hue:

```
G = dH_out / dH_in
```

`G` is the correct formal measure of "does the light respond to the music." Evaluate the three available transforms:

| Transform | Formula | G | Verdict |
|---|---|---|---|
| Hard clamp to nearest border (pre-7684) | `H ↦ nearest_edge(H)` | **0** almost everywhere | **Dead.** Non-injective: infinitely many inputs → one output. C minor and A minor both emit 350°. |
| Proportional gamut map (WAVE 7684) | `H ↦ min + (H/360)·(max−min)` | `(max−min)/360` | Alive but compressed. |
| **Global rotation (Uranus)** | `H ↦ (H + Φ) mod 360` | **1** exactly, everywhere | **Isometry.** Bijective, information-preserving. |

Quantified on the real Techno constitution, slot `BUNKER` with `allowedHueRanges: [[170, 210]]`:

```
G_clamp      = 0        →   0 % reactivity
G_gamut(7684) = 40/360  →  11.1 % reactivity
G_rotation    = 1        → 100 % reactivity
```

WAVE 7684 was a genuine improvement — it lifted a dead channel to 11%. But **89% of the harmonic information is still being destroyed** by the narrow window. The window itself is the problem. Rotation eliminates it.

**The structural argument:** rotation is an **isometry of the circle**. It preserves every pairwise angular distance:

```
|(h_j + Φ) − (h_i + Φ)| = |h_j − h_i|      ∀ i, j
```

Therefore the entire harmonic geometry — the 30°/120°/180° interval structure of §1.2, the triadic and complementary relationships, the strategy identity — is **exactly invariant** under the sidereal drift. Only the absolute anchoring moves. Clamping, by contrast, is a non-invertible projection that collapses distinct intervals into coincidence. This is the whole case for Pillar II in one line: *rotation moves the palette, clamping destroys it.*

### 2.2 Free lunch: rotation commutes with the barycenter

Rotating all 12 basis angles then summing is identical to summing then rotating the result, because rotation is linear:

```
Σ w_i · û(θ_i + Φ)  =  Rot(Φ) · Σ w_i · û(θ_i)
```

Hence:

```
H_final = atan2(M̄_y, M̄_x) + Φ(t)
```

**One scalar addition**, not 12 vector rotations, and the `cos θ_i / sin θ_i` LUTs stay compile-time constants. The rotating wheel costs literally one `+`.

### 2.3 Designing Φ(t) — quasi-periodic precession

Requirements: long-term structural evolution; no perceptible moment-to-moment motion; never an exactly repeating loop.

**Rejected — stepped rotation.** `Φ = 72°·act` reproduces the current jump artifacts at act boundaries.

**Adopted — continuous quasi-periodic drift.** Sum incommensurable harmonics so the pattern is aperiodic:

```
Φ(t) = Φ₀ + ω₁·t + A₂·sin(ω₂·t) + A₃·sin(ω₃·t + φ₃)
```

with periods related by the golden ratio so their ratio is irrational and the trajectory never closes:

```
T₁ = 45 min   (primary revolution)     ω₁ = 360°/T₁ = 0.133 °/s = 8 °/min
T₂ = T₁/φ ≈ 27.8 min                   A₂ = 25°
T₃ = T₂/φ ≈ 17.2 min                   A₃ = 10°
```

`Φ₀` seeded from the existing `SIDEREAL_SESSION_OFFSET` (WAVE 7680) so no two sessions start at the same angle. Time base remains `performance.now()` — `Date.now()` stays forbidden, per the established single-clock-domain rule.

Quasi-periodicity means the *combination* of primary hue and act character never exactly recurs within a realistic set length: a Lissajous trajectory on a torus with irrational winding number.

### 2.4 Timescale separation (the non-interference proof)

Audio-reactivity survives iff the drift is slow relative to harmonic motion:

```
|dΦ/dt| ≈ 0.13 °/s          (sidereal)
|dH_audio/dt| ≈ 1–10 °/s    (chord changes)
```

Roughly **1–2 orders of magnitude** of separation. The operator perceives audio response as instantaneous and the ring as invisible-but-cumulative (8°/min: below the ~2–5°/min just-noticeable rate for slow hue drift over short observation windows, but a full revolution per 45 minutes). The two channels are spectrally disjoint — no aliasing, no competition.

### 2.5 What happens to the existing Sidereal "acts"

The acts are good design and should survive — but they must stop touching hue. Repurpose each slot to modulate:

- `lightnessRange` (already does this — keep unchanged)
- `saturationRange`
- the **drift rate** `ω₁` (an "agitated" act precesses faster)
- the **void softness** `s` (§3.2)

Slot identity is then expressed through luminance/chroma envelope and rotational velocity, not hue imprisonment. `allowedHueRanges` is **deleted** from the slot schema. This is a breaking schema change and the primary migration cost of Pillar II.

---

## PILLAR III — THE REPULSIVE VOID (ANTI-YELLOW FORCEFIELD)

### 3.1 Why this pillar is load-bearing

Not cosmetic. Under the fifths topology, common diatonic material lands *inside* the banned zone:

```
Void V = [25°, 80°]       center c = 52.5°,  half-width w = 27.5°

C major  → 45°   ⛔ INSIDE
A minor  → 75°   ⛔ INSIDE
E minor  → 105°  ✅ outside
```

Two of the three most common triads in popular music sit in the forbidden region. Without Pillar III, Uranus would emit yellow/brown constantly. The forcefield is not a filter bolted on the end — it is a structural component.

### 3.2 The repulsion kernel: softplus smooth-max

Requirements: (a) never output inside `V`; (b) C¹ smooth — no visible snapping; (c) **strictly monotone**, hence injective, so distinct inputs stay distinct (preserving reactivity); (d) exactly the identity far from `V`.

Work in the signed angular offset from the void center:

```
d = wrapSigned(H − c)        ∈ (−180°, 180°]
```

Apply a **softplus smooth-max** to the magnitude, lifting it to at least `w`:

```
m(x) = w + s · ln(1 + exp((x − w)/s))
H_out = c + sign(d) · m(|d|)
```

`s` is the softness (default **s = 5°**). Properties:

```
dm/dx = σ((x − w)/s)        the logistic sigmoid, ∈ (0,1)
```

Because the derivative is a sigmoid it is **strictly positive everywhere** ⇒ `m` is strictly increasing ⇒ **injective**. This is the key property that hard clamping lacks. And `dm/dx` *is* the local reactivity gain, so the gain profile is analytically known:

| \|d\| | m(\|d\|) | gain G |
|---|---|---|
| 0° (void center) | 27.52 | 0.004 |
| 10° | 27.65 | 0.029 |
| 20° | 28.51 | 0.182 |
| 27.5° (void edge) | 30.97 | 0.500 |
| 35° | 36.01 | 0.818 |
| 42.5° | 42.74 | 0.953 |
| 60° | 60.01 | 0.998 |
| 80° | 80.00 | 1.000 |

Verified hue outcomes:

```
H = 45°   →  24.91°     (C major escapes downward into red)
H = 75°   →  81.57°     (A minor escapes upward into green)
H = 52.5° →  80.02°     (exact center — tie-break, see §3.3)
H = 25°   →  21.53°     (edge, ~3.5° clearance)
H = 80°   →  83.47°     (edge, ~3.5° clearance)
H = 90°   →  90.63°     (nearly untouched)
H = 100°  → 100.09°     (identity)
```

The field is **well-localized**: gain exceeds 95% beyond ~43° from center, i.e. outside roughly `[10°, 95°]` the transform is effectively the identity. It evacuates the void without disturbing the rest of the circle. Smaller `s` tightens the boundary and reduces the ~3.5° overshoot; larger `s` softens it. `s` is a natural per-act parameter (§2.5).

### 3.3 The degenerate case: exact void center

At `d = 0` the escape direction is undefined. Tie-breaks, best first:

1. **Angular momentum (preferred).** Exit in the direction the hue was already travelling: `sign(d) ← sign(H̄_t − H̄_{t−1})`. Physically gorgeous — inertia carries the hue through the void, and the trajectory stays C⁰ in time. No flicker, no coin flip.
2. **Musical tie-break.** Use the second-strongest pitch class to pick a side. Deterministic and harmonically motivated.
3. **Deterministic hash** of the frame/session seed. Last resort; avoid — it can oscillate frame to frame.

Momentum requires one extra scalar of state (`prevHue`) and is strictly better. Adopt it.

### 3.4 Preserving harmony: rigid-body evacuation

Applying §3.2 independently to primary/secondary/accent/ambient **distorts intervals**: a triad at 0°/120°/240° with one member in the void is displaced and is no longer exactly triadic. That would silently reintroduce the WAVE 7681 dishonesty.

**Superior approach — rotate the palette as a rigid body.** Find a single rotation `ψ` minimizing total void occupancy:

```
minimize   J(ψ) = Σ_i  P(h_i + ψ)
```

where `P(h)` is a penalty measuring depth inside the void (0 outside). Because rotation is an isometry, **all intervals are preserved exactly** — the palette remains genuinely triadic/complementary while evacuating the forbidden zone. Note `ψ` composes trivially with Pillar II: it is simply a *reactive* addend to `Φ`.

**Exact cheap solution.** `J` is piecewise smooth and its minima occur where some color sits exactly on a void edge. Candidate set:

```
ψ ∈ { e − h_i  (mod 360)  :  i ∈ colors,  e ∈ {25°, 80°} }  ∪  {0}
```

That is `4 colors × 2 edges + 1 = 9` candidates. Evaluate `J` at each (9 × 4 = 36 penalty evaluations/frame), take the argmin, tie-break toward smallest `|ψ|` to minimize disturbance. Exact, allocation-free, ~150 flops.

**Hysteresis is mandatory.** A raw per-frame argmin will chatter between equally-good rotations. Apply a deadband (accept a new `ψ` only if it improves `J` by a margin) plus an EMA on `ψ`. Without this, Pillar III becomes a strobe.

**Fallback.** If no rigid `ψ` can evacuate every member (possible with wide palettes and multiple voids), apply the per-color softplus of §3.2 to the residual offenders only. Rigid rotation first, local repulsion as cleanup.

### 3.5 Generalization to multiple voids

The schema must keep supporting N disjoint voids. Sequential application can push a hue out of void 1 into void 2. Two mitigations: (a) iterate to a fixed point — guaranteed to converge because each map is monotone and the voids are disjoint; (b) prefer the rigid-body solver of §3.4, which handles all voids simultaneously in one `J`.

---

## 4. INTEGRATED PIPELINE

Proposed order of operations inside `generate()`:

```
 1. Copy chroma → Float64Array(12)                        [Pillar 0]
 2. w_i = c_i^γ ; accumulate M_x, M_y, W                  [Pillar I]
 3. EMA the vector (fast + slow accumulators)             [Pillar I]
 4. H_slow, H_fast, R  ← atom2 / magnitude                [Pillar I]
 5. if R < R_min: hold previous hue, decay saturation     [Pillar I]
 6. H += Φ(t)          — single scalar add                [Pillar II]
 7. Derive secondary / accent / ambient from mass         [Pillar I §1.6]
 8. Measure strategy from interval content                [Pillar I §1.6]
 9. Rigid-body ψ solve + hysteresis                       [Pillar III §3.4]
10. Residual softplus repulsion per color                 [Pillar III §3.2]
11. S from R ; L from act envelope + energy               [Pillar I §1.4]
12. Existing downstream: thermal gravity, neon, remap     [unchanged]
```

Steps 6 and 9 both contribute to a single accumulated rotation and can be fused into one addition.

**Deliberately unchanged:** `MODE_MODIFIERS` (R cannot see mode, §1.4), the Neon Protocol, thermal gravity, `hueRemapping`, and the entire mechanical-fixture protection chain (`HarmonicQuantizer` → `DarkSpinFilter` → `ColorTranslator`). Uranus replaces hue *derivation*, not hue *delivery*.

**Deleted:** `KEY_TO_HUE`, `PHI_ROTATION` as the secondary driver, `allowedHueRanges` (all three enforcement sites from WAVE 7684), `gamutMapHue`, `_enforceForbiddenHue` elastic rotation, `siderealClock.slots[].allowedHueRanges`.

---

## 5. REACTIVITY BUDGET (BEFORE / AFTER)

| Stage | Current gain G | Uranus gain G |
|---|---|---|
| Key → hue | 12 discrete levels (≈0 between) | continuous, G = 1 |
| Sidereal slot | 0.111 (BUNKER `[170,210]`) | 1.000 (rotation) |
| Forbidden zone | 0 inside (elastic snap) | 0.004–1.0 (analytic sigmoid, injective) |
| **End-to-end (typical)** | **≈ 0.11, quantized to 12 states** | **≈ 0.85–1.0, continuous** |

---

## 6. ZERO-ALLOCATION COMPLIANCE

Per the audit's certified constraint, every element is scalar or pre-allocated:

| Element | Storage | Per-frame cost |
|---|---|---|
| `COS_THETA`, `SIN_THETA` | 2 × `Float64Array(12)`, module-level constants | read-only |
| chroma mirror | 1 × `Float64Array(12)`, module-level | 12 stores |
| `M̄_x, M̄_y, W̄` × {fast, slow} | 6 static numbers | 6 mul + 6 add |
| `Φ(t)` | 3 sin + 1 mul | ~4 transcendental |
| barycenter | — | ~70 flops + 1 atan2 + 1 sqrt |
| `ψ` solver | 9 candidates × 4 colors | ~150 flops |
| repulsion | — | ≤4 × (1 exp + 1 log) |
| `prevHue` (momentum) | 1 static number | 1 store |

Total ≈ **300 flops + ~10 transcendentals per frame**, zero allocations. This is *cheaper* than the current `_enforceForbiddenHue` while-loop, which can iterate up to `360/elasticStep = 24` times per color across 4 colors.

---

## 7. RISKS & OPEN QUESTIONS

1. **Chroma quality is now load-bearing.** Today a bad chroma frame is laundered through a key stabilizer with 10 s buffering and 30 s locking. Uranus consumes chroma directly. If `computeChromaFromSpectrum` is noisy under real program material, the vector EMA (§1.5) must absorb it. **Requires empirical validation against `test-data/live_audio_dump.json` before committing.**
2. **γ needs perceptual tuning.** It controls the continuum between field and lookup. Recommend shipping at γ≈3 (near-current behaviour) and lowering under observation.
3. **Loss of key locking.** The `KeyStabilizer`'s 30 s commitment currently guarantees palette stability. The slow EMA is a weaker guarantee. Consider retaining the stabilizer as a *cross-check* that damps `H_slow` when it disagrees with the locked key.
4. **`ChromaCoupler.FIFTHS_HUE` has duplicate entries** (`D♯`/`F♯` both 0.667), so the existing worker-side hue is not bijective. Independent pre-existing bug; worth fixing regardless of Uranus.
5. **Sidereal schema break.** Removing `allowedHueRanges` from slots invalidates both existing constitutions. Needs a migration.
6. **Rigid-body hysteresis tuning** is the highest-risk numeric in the design. Under-damped ⇒ visible chatter.

---

## 8. VALIDATION PLAN (PRE-IMPLEMENTATION)

1. **Offline harness.** Replay `test-data/live_audio_dump.json` through Pillar I alone; log `H_slow`, `H_fast`, `R`. Confirm `R` correlates with audible tonality and that `H` is stable on sustained chords.
2. **Distinctness test.** Assert distinct chord inputs yield hues separated by > 5°. This is the direct regression test for the "identical output loops" defect that motivated WAVE 7684.
3. **Void containment.** Property test: for 10⁶ random hues, `H_out ∉ [25°, 80°]`, and `H_out` is monotone in `H_in`.
4. **Isometry test.** Assert pairwise angular distances are invariant under `Φ` and `ψ` — the formal guarantee that the strategy label is honest.
5. **Allocation test.** Confirm 0 objects/frame under the existing zero-alloc harness.
6. **Long-run drift.** Simulate 3 h; confirm no exact state recurrence and no discontinuities at act boundaries.

---

## 9. RECOMMENDATION

Implement in strict order, each independently shippable:

| Wave | Scope | Risk |
|---|---|---|
| **7686** | Pillar 0 — wire `chroma` to `ExtendedAudioAnalysis` (zero-alloc mirror). No behaviour change. | minimal |
| **7687** | Pillar I behind a constitution flag `useChromagramGravity`, γ high. A/B against `KEY_TO_HUE`. | low |
| **7688** | Pillar III — replace elastic rotation with softplus + rigid-body ψ. | medium |
| **7689** | Pillar II — replace slot hue-clamping with `Φ(t)`; migrate constitutions. | medium (schema break) |
| **7690** | Derive secondary/accent/ambient and the *measured* strategy label from harmonic mass; retire `PHI_ROTATION`. Closes WAVE 7681. | medium |

Pillar 0 is a prerequisite for everything and is nearly free. Pillar I is the scientific core. Pillar III must land before Pillar II, because removing the hue clamps (II) exposes the diatonic-in-void collision that III solves.

---

*Draft only. No implementation code written. All numerics in §1.4, §3.2 verified computationally prior to publication.*
