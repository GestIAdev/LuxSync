# MASTER BLUEPRINT: THE QUANTUM SPECTROMETER

> **Codename:** `HephRadar v3 — Quantum Phase Spectrometer`
> **Role:** Central 2D visualizer for the Hephaestus V3 lighting workstation.
> **Mission:** Stop drawing fixtures as dots in a boring room. Start rendering the *mathematics of phase* as a living waveform that operators can read, trust, and feel.

---

## 0. DOCTRINE — Why a Spectrometer, not a Radar

The current `HephRadar` is a top-down stage map: dots positioned by `radarX/radarY`, a beam line from base to Pan/Tilt target, corner readouts. It answers *"where is the fixture in the room?"*.

That question is already answered by the 3D stage view. The central canvas should answer the question the **Eurorack chassis on the left actually controls**: *"what is the SHAPE of the phase distribution across my rig, right now?"*.

The left rack (`PhaseControls.tsx`) manipulates pure math — `spreadDeg`, `wings`, `blocks`, `shuffle`, `symmetry`, `direction`. None of that math is currently visible. **The Spectrometer is the oscilloscope screen of that synthesizer.**

**Three turns of the screw beyond the raw concept:**

1. **The raw idea:** fixtures on X, value on Y, a neon thread connecting them (the "Thread of Ariadne").
2. **Turn 1 — The thread is not a decoration, it is the *evaluated truth*.** The line IS the parameter being sculpted (Dimmer, Tilt, Hue...). Fixtures don't "surf" a cosmetic wave; they ARE sample points on the real evaluated signal. The wave is reconstructed by interpolating between the actual fixture values — what you see is what the DMX bus receives.
3. **Turn 2 — Time is a second axis hidden in plain sight.** A faint "ghost wave" shows where the signal *will be* in `phaseOffsetMs`, so the operator perceives motion direction and spread as a Doppler-like smear, not just a static curve.
4. **Turn 3 — The background is a frequency-domain spectrum.** Behind the waveform, a subtle FFT-style spectrum visualizes the *harmonic content* of the current phase config — `wings` literally appear as harmonic peaks, `shuffle` as noise floor. The operator learns to read the rig's "timbre".

---

## 1. THE AESTHETIC VISION

### 1.1 Philosophy
> *Analog oscilloscope purism × Cyberpunk military telemetry × DAW precision.*

Think the boot screen of a deep-space probe that happens to be running through a Tektronix CRT, designed by the UI team behind *Dune*'s holotables. Matte, dark, phosphor-glow, zero skeuomorphic gloss. Every pixel that emits light must *mean* something — light is data, darkness is silence.

### 1.2 Color Palette — "Phosphor Noir"

The palette inherits and extends the existing Eurorack identity (the rack already speaks orange/cyan/red/green — the Spectrometer must speak the same language so the screen feels wired to the knobs).

**Substrate (matte backgrounds — never pure black, always cold-blue-black):**

| Token | Hex | Use |
|---|---|---|
| `--qs-void` | `#06070C` | Deepest background, behind everything |
| `--qs-substrate` | `#08080D` | Main canvas fill (matches current `BG_COLOR`) |
| `--qs-panel` | `#0E0F16` | HUD glass panels |
| `--qs-grid-line` | `rgba(120,140,180,0.06)` | Math grid, cold steel |
| `--qs-grid-axis` | `rgba(120,140,180,0.16)` | Center axes / zero line |

**Neon Signal Family (the wave & fixtures — phosphor emission):**

| Token | Hex | Meaning |
|---|---|---|
| `--qs-signal-primary` | `#FF6B2B` → glow `#FF6600` | The Ariadne Thread (Hephaestus orange — the brand) |
| `--qs-signal-hot` | `#FFD08A` | Wave crests / high-value highlight |
| `--qs-phase-cyan` | `#00E5FF` | Phase ghost-wave / future state / `direction` cue |
| `--qs-entropy-red` | `#FF1744` | Shuffle/chaos energy (matches Chaos Engine module) |
| `--qs-spatial-green` | `#00E676` | Spatial-behavior overlays (matches Spatial module) |
| `--qs-spectrum-violet` | `#7C4DFF` | Background FFT harmonic spectrum |

**Semantic / state:**

| Token | Hex | Meaning |
|---|---|---|
| `--qs-live` | `#39FF14` | LIVE transport pulse |
| `--qs-muted` | `rgba(160,170,190,0.4)` | Paused / inactive readout text |
| `--qs-warn` | `#FFB300` | Clamp / out-of-range warning on a fixture |

### 1.3 Textures & Material

- **Matte substrate with vignette:** radial darkening toward edges (`--qs-void` at corners) so the eye is pulled to center. No flat fill.
- **CRT scanlines:** keep the existing 3px horizontal scanline (`SCANLINE_ALPHA ≈ 0.03`) but add a slow vertical *roll bar* — a single brighter scanline drifting top-to-bottom every ~8s, the classic CRT sync artifact. Pure atmosphere.
- **Phosphor persistence (bloom):** the wave and dots render with an additive glow pass (`globalCompositeOperation = 'lighter'`) so overlapping light *accumulates* like real phosphor, never flat-stacks.
- **Glassmorphism HUD:** telemetry panels = `--qs-panel` at 85% opacity + `backdrop-filter: blur(8px)` + 1px hairline border `rgba(255,107,43,0.25)` + faint inner top highlight. Frosted glass floating over the scope.
- **Mathematical grid:** two-tier grid. A fine sub-grid (8 divisions, current behavior) PLUS a labeled major grid on the Y-axis showing the parameter scale (`0 / 64 / 128 / 192 / 255` for DMX, or `0° / 90° / 180° / 270° / 360°` for Tilt). X-axis ticks are fixture indices, NOT room coordinates.
- **Corner brackets:** thin L-shaped framing brackets in each corner (military HUD reticle convention) that subtly pulse on the beat.

### 1.4 Typography

| Role | Font | Notes |
|---|---|---|
| Numeric telemetry / readouts | **JetBrains Mono** or **IBM Plex Mono** | Tabular figures, fixed-width — values never jitter horizontally |
| HUD labels / headers | **Eurostile / Rajdhani / Orbitron** (condensed geo-sans) | Wide letter-spacing `0.12em`, uppercase — the "spaceship label" look |
| Micro-annotations | Current `monospace` fallback | 8–9px, low opacity |

All numbers use **tabular-nums** and zero-padding (the codebase already pads with `padStart(3,' ')` — keep that discipline).

---

## 2. ANATOMY OF THE RENDER LAYERS

The canvas is composited back-to-front in **5 distinct layers**. Each is a conceptual pass; cheap ones can share a frame, expensive ones can throttle.

### Layer 0 — THE SUBSTRATE (deep background)
- Matte `--qs-substrate` fill + radial vignette to `--qs-void`.
- CRT scanlines + drifting roll bar.
- Corner reticle brackets.
- This is the "dead screen" — what you see when nothing is loaded.

### Layer 1 — THE SPECTRUM FIELD (frequency domain, *the surprise*)
> *Behind the wave, the rig's harmonic fingerprint.*

A low-opacity (8–12%) bar spectrum in `--qs-spectrum-violet`, anchored to the bottom edge, rising like a city skyline in fog. It is **not** an audio FFT — it is the **spatial-frequency spectrum of the current `PhaseConfigPro`**:

- **`wings`** → produces N sharp harmonic peaks. `wings=1` = one fundamental bump; `wings=3` = three evenly-spaced peaks. The operator *sees* the frequency multiplier.
- **`shuffle`** → raises the noise floor between peaks (entropy = broadband noise). At `shuffle=1` the clean peaks dissolve into a flat hiss.
- **`blocks`** → quantizes the spectrum into stepped plateaus.
- **`symmetry`** → `mirror`/`center-out` add a symmetric mirror-image lobe.

This layer teaches the operator to read phase math as *timbre*. It breathes slowly (no hard per-frame recompute — update on config change + gentle idle drift).

### Layer 2 — THE MATH GRID & AXES
- Fine 8×8 sub-grid (`--qs-grid-line`).
- Bold zero-line / center axis (`--qs-grid-axis`).
- Y-axis scale labels (parameter-dependent: DMX 0–255 or degrees).
- X-axis fixture-index ticks with tiny base-anchor glyphs (a small `▽` per fixture position, the "mounting point" of each sample).
- A vertical **playhead sweep line** crossing the whole scope (`--qs-signal-primary` at low alpha) — the temporal cursor.

### Layer 3 — THE ARIADNE THREAD (the wave — *the hero*)
This is the heart. Three sub-strokes composited additively:

1. **The Ghost Wave (past/future):** a `--qs-phase-cyan` faint curve offset in time by the rig's spread — shows where the signal *was* (trailing) or *will be* (leading), depending on `direction`. This creates a Doppler smear that makes propagation direction instantly legible.
2. **The Live Thread:** a smooth Catmull-Rom / cardinal spline through the actual evaluated fixture values. Stroke = `--qs-signal-primary` with a 2-pass glow (wide soft underlay + crisp 1.5px core). Crests brighten toward `--qs-signal-hot` (value-mapped color, so a tall peak literally glows hotter).
3. **The Fill Membrane:** a vertical gradient fill UNDER the thread, from `rgba(255,107,43,0.18)` at the line down to `0` at the zero-axis — an "energy membrane" that gives the wave volume without clutter.

**Thermal trail (the requested innovation):** the thread leaves a *thermal afterimage*. We keep a short ring buffer of previous wave shapes (the codebase already has `history: Array<{timeMs, val}>`, a 60-frame ring — extend this concept per-fixture). Older shapes render progressively dimmer and shifted toward red→violet (cooling metal in a forge — perfect for *Hephaestus*). Result: fast movement smears into a hot comet tail; static signal shows a clean razor line. The wave literally glows like cooling steel.

### Layer 4 — THE FIXTURES (the sample nodes — *the foreground*)
Each fixture is a **node clamped onto the thread** at `(indexX, evaluatedValueY)`:

- **Core node:** a diamond/hex glyph (not a boring circle — sci-fi nodes are faceted), filled with the fixture's actual RGB color, sized by `dimmer`.
- **Glow halo:** radial bloom, alpha = `dimmer/255 × strobeGate` (reuse existing strobe gate logic).
- **Phase tether:** a thin vertical "drop line" from each node down to the X-axis, like a plumb line — reinforces the sample-point reading and shows exact index alignment.
- **Block bracket:** when `blocks > 1`, fixtures sharing a block are visually joined by a subtle horizontal under-bracket (they share phase → they share a bracket). The operator *sees* the grouping the Block Matrix module created.
- **Strobe node:** strobing fixtures pulse their halo in hard on/off (gate-driven), and emit a tiny white spark flash on the "on" edge.
- **Selection state:** selected node gets a rotating reticle ring (`--qs-signal-primary`, `shadowBlur`) + locks the HUD (Section 3).
- **Out-of-range clamp:** if an evaluated value is clamped, the node's drop-line turns `--qs-warn` amber — instant visual debugging.

> **Layout note:** X position is **logical order** (fixture index, evenly spaced), *not* `radarX` room coordinates. This is the deliberate break from the old radar. The 3D view owns physical space; the Spectrometer owns logical/phase space. A small toggle (`SPACE ⇄ PHASE`) can let power users flip X back to `radarX` for spatial correlation, but **PHASE is the default**.

---

## 3. TELEMETRY & HUD

> *No Excel. No tables. Ballistic telemetry like a fighter-jet target lock.*

### 3.1 Resting State — The Ambient Strip
When nothing is selected, the HUD is minimal and lives in the **corner reticle brackets**:

- **Top-left:** active parameter being scoped (`SCOPE: DIMMER` / `SCOPE: TILT`) + Y-scale unit.
- **Top-right:** global phase signature, compact — `Σ240° · W2 · B4 · SH35%` (spread, wings, blocks, shuffle) in the rack's own colors so the screen echoes the knobs.
- **Bottom strip:** transport (`▶ ⏸ ⏹`), `● LIVE` pulse in `--qs-live`, frame counter, and the time readout `1.24s / 4.0s`.
- **Bottom progress bar:** keep the existing glowing playhead bar (`--qs-signal-primary`).

### 3.2 Target Lock — The Ballistic Card
When a fixture node is selected (or hovered), a **target-lock animation** fires:

1. A reticle *snaps* onto the node (animated bracket close-in, ~120ms, with a faint "lock" tick).
2. A **leader line** (thin angled connector, military callout style) draws from the node out to a floating glass card in the nearest free corner — the card never covers the wave.
3. The card is **glassmorphic** (`--qs-panel` + blur), laid out as a *cockpit instrument cluster*, NOT rows of text:

```
┌─────────────────────────────┐
│ ◢ MH-04 · BACK TRUSS L       │  ← header, --qs-signal-primary
├─────────────────────────────┤
│  PAN  ▮▮▮▮▮▮▯▯  187          │  ← mini horizontal gauges, not raw nums
│  TILT ▮▮▮▮▯▯▯▯  104          │
│  DIM  ▮▮▮▮▮▮▮▮  248          │
├─────────────────────────────┤
│  φ PHASE OFFSET   +142 ms    │  ← the star metric, big, cyan
│  Δ vs LEADER      37.2°      │
│  BLOCK            #2 of 3    │
└─────────────────────────────┘
```

- **Gauges over numbers:** Pan/Tilt/Dim render as tiny segmented bar gauges (the eye reads fill-level faster than digits); the exact number sits at the end for precision.
- **Phase Offset is the hero metric** (`phaseOffsetMs` from `PreviewFixtureState`): big, cyan, with a `+/-` sign and a micro-sparkline showing this node's value over the last ~1s.
- **Δ vs LEADER:** how far this fixture's phase trails fixture[0] — the single most useful number for tuning spread, currently faked in the old code as `(pan/255)*360`. Here it's derived honestly from `phaseOffsetMs / durationMs × 360°`.
- **Color swatch:** a small RGB chip showing `r,g,b` + white/amber contribution.
- The card has a subtle scanline texture and a pulsing border keyed to the playhead.

### 3.3 Multi-select — Squadron View
If multiple nodes are selected, collapse to a compact **squadron list** docked to one edge: one row per fixture with `ID · φoffset · mini-gauge`, the selected wave segment highlighted on the scope. Think wingman roster in a space sim.

---

## 4. MICRO-INTERACTIONS

> *The Spectrometer must feel alive and physically reactive — every knob on the rack should produce a visible "shudder" on the scope.*

### 4.1 Applying SPREAD (the rack's main knob)
As `spreadDeg` rises from 0 → 360+:
- The flat thread **blooms into a wave** with a spring/ease-out, not a linear lerp — it should feel like tension releasing.
- Fixtures slide along the thread to their new phase positions with motion-blur trails (the thermal trail from Layer 3 does this for free).
- The background spectrum (Layer 1) peaks sharpen in sync.

### 4.2 WINGS change
- Each increment visibly *adds a hump* to the wave with a ripple that propagates outward from center.
- A corresponding harmonic peak rises in the background spectrum — the clearest "aha, frequency multiplier" moment.

### 4.3 BLOCKS change
- Fixtures **magnetically snap** into grouped clusters; block-brackets draw in under each group with a quick wipe.
- Within a block, the drop-lines briefly flash to show "these now share one phase."

### 4.4 SHUFFLE / CHAOS (the `--qs-entropy-red` module)
> This is the showpiece interaction.

- As `shuffle` rises, the thread **destabilizes**: nodes jitter off the clean curve, the line acquires red chromatic-aberration fringing (split R/B channels by a few px), and the background noise floor rises with audible-looking hiss texture.
- Hitting the **🎲 dice (randomize seed)** triggers a **"quantum collapse" flash**: a sub-100ms full-canvas red interference burst, then nodes *teleport* to their new shuffled positions with a glitch-scramble (brief datamosh / RGB-shift) before settling. Feels like rerolling reality.
- At `shuffle=1`, the clean wave is gone — replaced by a chaotic point-cloud held loosely by a faint red web. Pure entropy made visible.

### 4.5 STROBE
- Strobing fixture nodes hard-gate their halo (existing gate logic), and on each "on" edge emit a **white spark + a thin shockwave ring** that expands and fades.
- If MANY fixtures strobe together, the whole substrate flickers a near-black/near-white micro-pulse (subtle — never seizure-inducing; clamp contrast and respect a reduced-motion setting).
- A small `⚡ STROBE` indicator in the top reticle pulses red.

### 4.6 DIRECTION toggle (FWD ⇄ REV)
- The ghost-wave (Layer 3) **flips sides** — leading becomes trailing — and a directional arrow sweeps across the scope in the new direction (orange for FWD, cyan for REV, matching the rack button colors exactly).

### 4.7 SYMMETRY mode switch
- `linear → mirror`: the wave **folds** at center with a paper-fold animation.
- `→ center-out`: the wave **inverts/breathes** from the center outward.
- Each transition is a morph (~200ms ease), never a hard cut — the operator sees the topology change.

### 4.8 Beat & playhead
- Corner brackets and the progress-bar playhead glow-pulse on each beat (drive from `frameCount` / live BPM if available).
- The vertical playhead sweep line leaves a faint cyan persistence trail as it crosses.

### 4.9 Idle / no-signal
- When paused with `dimmer=0` everywhere, the scope shows a **flatline with a slow heartbeat blip** traversing left-to-right (the classic "system alive but silent" EKG) — reassures the operator the engine is running, nothing is broken.

### 4.10 Hover (pre-selection)
- Hovering near a node lifts it slightly off the thread with a soft glow and a tooltip-less reticle ghost — a "soft lock" before the full target-lock click.

---

## 5. INTERACTION & LAYOUT SUMMARY

| Zone | Behavior |
|---|---|
| **Wave body** | Hover = soft-lock node; click = target-lock + HUD card |
| **Bottom 12px** | Scrub/seek (preserve existing seek strip) |
| **X axis** | Logical fixture order (default) — toggle `SPACE ⇄ PHASE` for `radarX` |
| **Y axis** | Parameter scope selector (`DIM / TILT / PAN / HUE`) — a small dropdown in top-left reticle |
| **Drag on wave** | (Future) draw-to-edit the curve directly → writes back to phase math |
| **Scroll** | Zoom the Y-scale (precision on subtle values) |

---

## 6. PERFORMANCE & IMPLEMENTATION NOTES (for the programmer)

- **Single `<canvas>`, layered passes** in the existing rAF loop (`HephRadar.tsx` already runs a clean DPR-correct rAF — extend it, don't rewrite the harness).
- **Throttle the cold layers:** Spectrum (Layer 1) and grid labels recompute only on `PhaseConfigPro` change or at ~10fps idle drift, not every frame.
- **Additive glow** via `ctx.globalCompositeOperation = 'lighter'` for the wave + halos, restored to `source-over` for HUD.
- **Thermal trail** = reuse/extend the existing 60-frame `history` ring buffer; store a downsampled value array per frame, not full bitmaps.
- **Zero-alloc hot path:** pre-allocate the spline point arrays and gauge buffers; the codebase already follows zero-alloc discipline elsewhere — honor it here.
- **DPR-correct** rendering already handled — keep `ctx.scale(dpr, dpr)`.
- **Reduced-motion guard:** gate strobe-flash, datamosh, and roll-bar behind a `prefers-reduced-motion` / user setting. Safety first on a stage tool.
- **Data source untouched:** consumes the exact same `HephPreviewState` / `PreviewFixtureState` already produced by `useHephPreview`. No engine changes required — this is a pure presentation upgrade. `phaseOffsetMs` is already on the fixture state; the spectrometer finally *uses* it.

---

## 7. THE ONE-LINE PITCH

> **The Quantum Spectrometer turns the invisible math of the Eurorack phase chassis into a living, breathing, forge-hot oscilloscope — where every fixture is a sample point on a thread of light, and every knob-turn sends a visible shudder through the waveform.**
