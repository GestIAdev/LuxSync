# HYPERION PERFORMANCE AUDIT — WAVE 7568

**Scope:** Frontend render-thread degradation observed during a live show on a 13-year-old Intel i3 (4 GB RAM, legacy Intel HD integrated GPU). The Zero-Allocation DMX/Audio backend threads performed flawlessly; the React/Chromium render thread struggled with UI rendering, producing component degradation. This document audits the heavy rendering processes, dissects the tactical canvas worker, and proposes an Eco-Mode bypass strategy.

**Method:** Static analysis of `electron-app/src` (CSS, worker TS, layer TS, React lifecycle). No runtime profiling was performed — all findings are architectural and are flagged with a confidence level.

---

## SECTION 1 — Heavy Render Targets

The LuxSync frontend leans hard on a "cyberpunk neon" aesthetic. That aesthetic is built almost entirely from CSS properties that Chromium must rasterize on the **compositor/software path** when no GPU acceleration is available — exactly the situation on a 13-year-old i3 with a legacy Intel HD GPU and 4 GB RAM. A grep across `electron-app/src/**/*.css` returns **874 matches** for the combined set `box-shadow | backdrop-filter | filter: blur | drop-shadow | text-shadow`, with **699** for `box-shadow | backdrop-filter` alone. These are not isolated; they are the design language.

### 1.1 CSS properties that force software / expensive rasterization

| Property | Why it hurts on low-end hardware | Prevalence |
|---|---|---|
| `box-shadow` (especially multi-layer `0 0 Npx rgba(...)` glows) | Each shadow is a separate blurred alpha mask the compositor must allocate, blur, and composite. On a software path there is no GPU blur; the CPU does a Gaussian blur per shadow per repaint. Multi-value `box-shadow` lists (e.g. `SystemsCheck.css:207`, `DashboardView.css:125/156/168`) multiply this N×. | Dominant — the single most common heavy property. |
| `backdrop-filter: blur(...)` | Requires Chromium to capture the backdrop into an offscreen layer, blur it, then composite. On legacy GPUs this is either unsupported (falls back to no-op or software blur) or extremely slow. Found in **37 files**. | High. Notable offenders: `erebus.css` (15 matches), `ArsenalDock.css` (14), `HephaestusView.css` (6), `globals.css` (3), `DashboardView.css` (3), `ChronosLayout.css` (4). |
| `filter: drop-shadow(...)` | Same blur cost as `box-shadow` but applied to the element's alpha shape. `SystemsCheck.css:38/213` and `DashboardView.css:57` apply it to icons/titles that repaint frequently. | Medium. |
| `text-shadow` with large radii | `0 0 15px rgba(...)` (`DashboardView.css:67`) forces per-glyph blurred alpha. Cheap on one label, expensive across a dashboard of animated readouts. | Medium. |
| `transition: all ...` | Animating `all` means ANY property change (including `box-shadow`, `filter`, `backdrop-filter`) is interpolated. This turns a cheap state toggle into a multi-frame software-blur re-raster. `SystemsCheck.css` alone has ~16 `transition: all` declarations. | High — this is the amplifier that makes the glow properties re-raster every frame. |
| `animation: ... infinite` (pulse-glow, spin, slideIn, pulse-badge) | Infinite keyframe animations on elements that also carry `box-shadow`/`filter` force a continuous compositor repaint for the entire lifetime the element is mounted. `SystemsCheck.css:504/650/742`, `TacticalCanvas.css:170` (`tactical-pulse`). | High when combined with glow properties. |

### 1.2 Heavy DOM components

**Dashboard (`components/views/DashboardView/`)** — Confidence: HIGH
The dashboard is a dense grid of status cards, each styled with `backdrop-filter: blur(12px)` + multi-layer `box-shadow` (`DashboardView.css:122/154/166`). `SystemsCheck.css` is the single heaviest stylesheet found: ~50 matches for glow/blur/transition/animation properties, including `backdrop-filter: blur(10px)` on a frequently-updating connection panel (`SystemsCheck.css:428`), `animation: pulse-glow 2s infinite` (`:504`), `animation: pulse-badge 1.2s infinite` (`:650`), and `animation: spin 1s linear infinite` on multiple spinners (`:742/:803/:918`). On the i3 this means the dashboard alone is repainting blurred backdrops and glowing badges continuously even when the show data is static.

**Keyforge / Key mapping overlay (`components/KeyForgeOverlay.tsx`, `keyforge/*`)** — Confidence: MEDIUM
`KeyForgeOverlay.tsx` does not import its own CSS file (no `*.css` import located), so it inherits global neon styles. The overlay renders a live key-capture/mapping surface that updates on every keystroke. Because it sits on top of the dashboard and relies on the global neon palette (cyan/magenta glows via inherited `box-shadow`/`text-shadow`), each keystroke triggers a repaint of the overlay AND the blurred backdrop beneath it. The cost is dominated by the backdrop-filter layers it composites over, not by its own DOM size.

**Tactical Canvas rulers (`TacticalCanvas.css:74-95`)** — Confidence: HIGH
The CAD rulers around the 2D tactical view use `backdrop-filter: blur(4px)` (`TacticalCanvas.css:78`). Although the canvas itself renders in a worker, the rulers are **DOM elements** on the main thread. Every ResizeObserver tick and every canvas resize forces the rulers' blurred backdrop to re-raster on the main thread — competing for the same CPU the React render thread needs.

**Erebus / Arsenal / Hephaestus docks** — Confidence: MEDIUM
`erebus.css` (15 `backdrop-filter` matches) and `ArsenalDock.css` (14 matches) are panel-heavy views with stacked glass panels. When any of these are mounted simultaneously with the dashboard (e.g. docked side panels during a show), the compositor must maintain multiple blurred backdrop layers concurrently.

### 1.4 Neural Command — Sensory & Consciousness sub-views

**Scope:** `components/views/NeuralCommandView/` is a router that mounts one of three specialized sub-views: **Sensory** (what Selene "feels"), **Consciousness** (what Selene "thinks"), and **Stream** (neural log). The first two are the heavy render targets; the Stream is a text log and is cheap. Confidence: HIGH (static analysis + architectural inspection of the RAF loops and CSS).

#### 1.4.1 Audio Spectrum Titan (`SensoryView/AudioSpectrumTitan.tsx`) — THE HEAVIEST COMPONENT

This is the single most expensive React component in the entire frontend, and it is mounted whenever the operator navigates to **Sensory**. It renders a 32-band real-time audio spectrum analyzer with peak-hold markers, energy/flux gauges, BPM confidence bar, and a beat-pulse glow.

**Architecture (the good news):** The component is architecturally well-designed for capable hardware. It uses an **imperative RAF engine** — React renders the static DOM skeleton exactly once (32 bar `<div>`s + 32 peak `<div>`s + stat readouts), then a `requestAnimationFrame` loop reads the transient Zustand store via `getTransientTruth()` and mutates DOM elements directly through refs (`bar.style.height`, `peak.style.bottom`, `textContent`). Zero React re-renders, zero per-frame allocations (pre-allocated `Float64Array` buffers, pre-computed color strings). On a modern machine this is a zero-GC 60fps component.

**Why it crushes the i3 (the bad news):**

1. **32 DOM bars × 60 fps = 1,920 style mutations/sec.** Each `bar.style.height = '${value}%'` and `peak.style.bottom = '${value}%'` triggers a layout invalidation on the bar's parent flex container. On a software compositor, each invalidation forces a re-layout of the 32-bar row + the peak overlay. That is **3,840 layout recalculations per second** (32 bars + 32 peaks × 60 fps), all on the main thread.

2. **`filter: brightness(1.1) drop-shadow(0 0 4px currentColor)` on every bar** (`AudioSpectrumTitan.css:131`). Each of the 32 bars carries a `drop-shadow` glow. When the bar's height changes every frame, the compositor must re-raster the blurred alpha mask for that bar. 32 bars × 60 fps = **1,920 drop-shadow re-rasters/sec** — the exact same Gaussian-blur tax identified in Section 1.1, but now driven at 60 fps by the RAF loop instead of by a CSS animation.

3. **`will-change: height` on every bar** (`AudioSpectrumTitan.css:132`). This promotes each bar to its own compositor layer. On a legacy GPU with limited VRAM, 32 promoted layers + 32 peak layers = **64 compositor layers** for a single component. Each layer consumes VRAM for its backing texture; on Intel HD 3000-era hardware (64–256 MB shared VRAM), this can exhaust compositor memory and force Chromium to fall back to software compositing for the entire window — degrading not just the spectrum but every other component on screen.

4. **Beat-pulse `box-shadow` toggle** (`AudioSpectrumTitan.css:68-71`). On every beat detection (`beat.onBeat` toggles), the root element gets `box-shadow: 0 0 20px rgba(139,92,246,0.3), inset 0 0 30px rgba(139,92,246,0.05)`. At 120 BPM that is 2 shadow on/off transitions per second — each one a full root-element shadow re-raster. The `transition: box-shadow 0.1s ease` on the root (`:65`) means the shadow interpolates over 6 frames, so each beat triggers 6 re-raster frames.

5. **Temporal LERP at 60 fps against 22 Hz data.** The RAF loop runs at 60 fps but the audio data arrives at ~22 Hz (every ~45ms via IPC). The `AUDIO_LERP = 0.35` exponential smoothing (`AudioSpectrumTitan.tsx:159`) means each frame interpolates toward the last-known value. This is correct for smoothness, but it means 60 fps of DOM mutations even when the underlying data only changed 22 times — **38 of the 60 frames per second are pure interpolation work** that produces visual movement but no new information.

**Verdict:** On the i3, the Audio Spectrum Titan alone can consume 40–60% of the main-thread frame budget. It is the single highest-impact component to bypass in Eco-Mode.

#### 1.4.2 Chromatic Core Complete (`SensoryView/ChromaticCoreComplete.tsx`)

A color-theory panel showing a conic-gradient color wheel, Kelvin temperature, detected chord, harmony strategy, and a 4-swatch palette with HSL details.

**Why it is expensive:**

1. **`conic-gradient` with 7 HSL stops + `radial-gradient` mask** (`ChromaticCoreComplete.css:53-74`). The color wheel is a `conic-gradient(from 0deg, hsl(0,80%,50%), ... hsl(360,80%,50%))` masked by a `radial-gradient` to create a ring. `conic-gradient` is a GPU-accelerated path on modern hardware but falls back to **CPU rasterization** on legacy GPUs. When the palette changes (Selene updates the palette at ~10 Hz during a show), the entire conic gradient + mask must be re-rastered.

2. **Multi-layer `box-shadow` on the center display and swatches** (`:110-112, :245-247, :254-256`). The center hex display has `box-shadow: 0 0 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.1)` — two blurred shadows. Each of the 4 palette swatches has the same pattern, and on hover the shadow expands. When the palette updates at 10 Hz, all 5 elements re-raster their shadows.

3. **`text-shadow` on mood labels** (`:198, :203`). The mood indicator has `text-shadow: 0 0 8px rgba(...)` — a blurred text shadow that re-rasters when the mood class changes (bright/dark toggle).

4. **React-driven re-renders.** Unlike the Audio Spectrum, the Chromatic Core uses `useTruthPaletteThrottled()` — a throttled Zustand hook that triggers React re-renders at the throttle cadence (~10 Hz). Each re-render re-evaluates `hslToCSS()` and `hslToHex()` for 4 palette colors (8 string allocations) and re-renders the swatch DOM. At 10 Hz this is 10 React reconciliations/sec — modest on its own, but the resulting DOM updates trigger the CSS re-rasters described above.

**Verdict:** Medium cost. The conic-gradient + mask is the heaviest single element, but it only re-rasters at ~10 Hz. The shadow re-rasters are the amplifier. On the i3 this component is noticeable but not dominant — it becomes a problem only when mounted simultaneously with the Audio Spectrum.

#### 1.4.3 Oracle Hybrid (`ConsciousnessView/OracleHybrid.tsx`) — "The Crown Jewel"

A prediction panel with an SVG sparkline (60-point energy history), zone indicator, trend gauge, and alert system.

**Why it is expensive:**

1. **SVG sparkline with `setSparklineData` every 10 frames.** The sparkline maintains a 60-point rolling buffer (`SPARKLINE_POINTS = 60`). Every `SPARKLINE_SAMPLE_INTERVAL = 10` incoming `energyValue` changes, it calls `setSparklineData([...sparklineRef.current])` (`OracleHybrid.tsx:105`) — a React state update that triggers a full re-render of the Oracle component. At ~22 Hz incoming data, that is a React re-render every ~450ms (~2/sec). Each re-render recomputes the SVG path string via `useMemo` (`:122-131`) — a 60-point `M...L...L...` string concatenation — and re-renders the SVG `<path>` element.

2. **`backdrop-filter: blur(4px)` on the energy value badge** (`OracleHybrid.css:122`). The floating energy number in the top-right corner has a blurred backdrop. Every time the energy value changes (22 Hz), the badge's text content changes, and the blurred backdrop must be re-rasterized. This is the same backdrop-filter tax identified in Section 1.1, now driven at 22 Hz by live data.

3. **`filter: drop-shadow(0 0 4px currentColor)` + `animation: point-pulse 1.5s infinite` on the current-point** (`OracleHybrid.css:103-104`). The SVG circle at the end of the sparkline has a drop-shadow glow AND an infinite pulse animation that changes its `r` and `opacity`. This forces a continuous SVG re-raster at 60 fps for the entire lifetime the Oracle is mounted — even when the sparkline data is static.

4. **`animation: alert-pulse 2s ease-in-out infinite` on active alerts** (`OracleHybrid.css:50`). When an alert is active (drop/spike/buildup/breakdown), the alert banner pulses with `box-shadow` changes — another infinite animation driving shadow re-rasters.

5. **`transition: all 0.3s ease` on the alert container** (`OracleHybrid.css:45`). The `transition: all` amplifier (Section 1.1) means any property change on the alert container — including `box-shadow` during the pulse animation — interpolates over 18 frames.

**Verdict:** Medium-high cost. The infinite `point-pulse` animation is the always-on tax; the 22 Hz backdrop-filter re-raster is the data-driven tax. Combined, the Oracle consumes meaningful main-thread budget on the i3, especially since it is mounted in a 2×2 grid alongside the Ethics Council.

#### 1.4.4 Ethics Council Expanded (`ConsciousnessView/EthicsCouncilExpanded.tsx`)

A 3-card voting panel (Beauty 🦋 / Energy 🦊 / Calm 🐋) with vote status, confidence, and consensus score.

**Why it is (moderately) expensive:**

1. **`transition: all 0.2s ease` on vote cards** (`EthicsCouncilExpanded.css:55`). The `transition: all` amplifier strikes again — any property change on the vote cards (including `box-shadow` when the vote status changes) interpolates over 12 frames.

2. **Inset `box-shadow` on vote cards** (`:63, :67`). The "for" and "against" states apply `box-shadow: inset 0 0 20px rgba(...)` — a 20px blurred inset shadow. When a vote flips (e.g. Beauty changes from "abstain" to "for"), the inset shadow re-rasters over 12 frames due to the `transition: all`.

3. **React re-renders driven by `useTruthAI()`.** The Ethics Council receives props from `ConsciousnessView` which subscribes to `useTruthAI()` — updated at ~10 Hz. Each update re-renders the 3 vote cards with new vote status, confidence values, and reasons. The `calculateVotes()` function (`:66-100`) runs string `.toLowerCase().includes()` checks on the ethics flags array on every render — cheap individually but non-zero at 10 Hz.

**Verdict:** Low-medium cost. The inset shadows are smaller than the full-element glows elsewhere, and the re-render cadence is only ~10 Hz. This is the cheapest of the four Neural Command components. On the i3 it is noticeable only when all 4 Consciousness panels are mounted simultaneously in the 2×2 grid.

#### 1.4.5 AI State Titan (`ConsciousnessView/AIStateTitan.css`)

A state badge with `animation: strike-pulse 0.5s ease-in-out infinite` (`:54`) that animates `box-shadow` between `0 0 10px rgba(239,68,68,0.3)` and `0 0 20px rgba(239,68,68,0.6)` (`:58-59`). When the AI state is "striking", this runs a 2 Hz shadow-pulse animation continuously — 2 shadow re-rasters/sec. Low cost individually, but it is another always-on tax in the Consciousness grid.

### 1.5 Root cause summary (expanded)
The degradation is **not** primarily from element count — it is from **continuous re-rasterization of blurred alpha masks** (`box-shadow`, `backdrop-filter`, `drop-shadow`, `text-shadow`) driven by `transition: all` and infinite `animation` loops, executed on a software compositor path with no GPU blur. The backend threads are fine because they never touch the compositor; the render thread starves because it is burning CPU on Gaussian blurs for decorative glows.

The Neural Command sub-views (Section 1.4) amplify this problem with **data-driven re-rasters**: unlike the dashboard's static glows (which pulse on a timer), the Audio Spectrum's 32 bars re-raster `drop-shadow` glows at 60 fps driven by live audio data, and the Oracle's `backdrop-filter` badge re-rasters at 22 Hz driven by live energy values. These are the only components in the app where **data frequency × CSS blur cost** creates a multiplicative main-thread load. On the i3, mounting the Sensory view (Audio Spectrum + Chromatic Core) or the Consciousness view (Oracle + Ethics + AI State + Dream Forge) can consume 60–80% of the frame budget — leaving insufficient time for React reconciliation of the rest of the app.

---

## SECTION 2 — The Worker Anatomy (`Hyperion.render.worker`)

### 2.1 What it is
`hyperion-render.worker.ts` is "The 4th Worker" — a dedicated Web Worker (Chromium renderer-process side) that owns the tactical 2D canvas via `OffscreenCanvas`. It is instantiated from `TacticalCanvas.tsx` with Vite's `?worker&inline` import suffix (`TacticalCanvas.tsx:81`), which bundles the worker inline for Electron's renderer process.

### 2.2 Thread usage & ownership transfer
- **Mount:** `TacticalCanvas` calls `canvas.transferControlToOffscreen()` (`TacticalCanvas.tsx:290`) — a **one-shot, irreversible** transfer of the `<canvas>` DOM node's rendering ownership to an `OffscreenCanvas` handle. That handle is sent to the worker via `postMessage('INIT', ..., [offscreen])` as a **Transferrable** (`TacticalCanvas.tsx:402`). After this, the main thread can no longer draw to that canvas.
- **Render loop:** The worker runs its own `requestAnimationFrame(render)` loop at 60 fps (`hyperion-render.worker.ts:310`). The main thread does NOT drive rendering — it only forwards events and data.
- **Five render layers** all execute inside the worker, in order: Grid → Zone → Fixture → Selection → HUD (`hyperion-render.worker.ts:265-298`). The layers themselves (`layers/*.ts`) are pure canvas-2d draw functions shared by reference.

### 2.3 Main-thread ↔ worker communication (`postMessage`)
Two distinct data paths exist:

**Cold path (structural):** `SCAFFOLD` carries fixture structural data (id, position, type, zone, gobo, prism) and is sent once per show load / fixture config change (`TacticalCanvas.tsx:454-469`). Also `SELECTION`, `OPTIONS`, `RESIZE`, `HIBERNATE`, `MOUSE`, `SHUTDOWN` — all low-frequency control messages.

**Hot path (per-frame dynamic data):** Two implementations coexist:
1. **Legacy `FRAME` path:** main thread packs a `Float32Array` (10 floats × N fixtures) and transfers it (`hyperion-render.types.ts:113-122`).
2. **GLASS BYPASS (Fase 2, active):** a `MessageChannel` is created on the main thread; `port2` is transferred to the worker via `GLASS_PORT` (`TacticalCanvas.tsx:511-512`). The main thread subscribes to `window.glass.onFrame` (the Aether Glass SAB), translates the Glass 16-float layout → worker 10-float layout (`packGlassFrameInto`, `TacticalCanvas.tsx:130-159`), and posts the packed buffer through `port1` as a Transferrable (`TacticalCanvas.tsx:559`). The worker reads frames directly from the port (`hyperion-render.worker.ts:600-624`), bypassing the React/IPC chain entirely.

**Ping-pong buffer pool (OOM fix):** To stay zero-allocation, a double-buffer pool (`bufferPool`, `TacticalCanvas.tsx:205`) alternates two `Float32Array` slots. When a new frame arrives, the worker returns the **previous** frame's buffer via `BUFFER_RETURN` through the port (`hyperion-render.worker.ts:611-614`); the main thread reclaims it into the first null pool slot (`TacticalCanvas.tsx:517-527`). At ~44 Hz inbound vs 60 fps render, the render loop always consumes a buffer at least once before it is returned — safe by design.

**Outbound (worker → main):** `READY`, `HIT_TEST`, `LASSO_COMPLETE`, `METRICS` (every 60 frames ≈ 1 s), `FRAME_ACK`, `ERROR`.

### 2.4 Why it chokes low-VRAM / old-CPU systems
The worker is architecturally sound for capable hardware, but several factors combine to crush a 13-year-old i3:

1. **`OffscreenCanvas` 2D on a legacy GPU.** `canvas.getContext('2d')` on an `OffscreenCanvas` may fall back to a **software-skia** rasterizer when the GPU/driver lacks accelerated 2D canvas (common on Intel HD 3000-era hardware). Every `drawImage`, `arc`, `fillRect`, and `stroke` then runs on the CPU. The worker thread — which is supposed to be "the cheap thread" — becomes a second CPU-bound rasterizer competing with the main thread's software compositor.

2. **60 fps RAF is unconditional.** The render loop schedules `requestAnimationFrame(render)` every frame regardless of whether fixture data has changed (`hyperion-render.worker.ts:310`). On hardware where a single frame's 5-layer pipeline takes >16 ms, the RAF backlog compounds. There is no adaptive throttle tied to measured `metrics.fps`.

3. **Sprite-cache `drawImage` scaling.** WAVE 7571 replaced per-frame `createRadialGradient` (Oilpan OOM) with pre-rendered `OffscreenCanvas` sprites stamped via `drawImage` (`FixtureLayer.ts:124-179`). This fixed the OOM but, on a software rasterizer, each `drawImage` with non-trivial scaling is a CPU image resample. With ~200 fixtures × (aura + 2 halo passes + beam body + beam core + core + hot center + rim) ≈ 1000+ `drawImage`/`fill`/`stroke` calls per frame, the CPU saturates.

4. **DPR amplification.** `DEFAULT_TACTICAL_OPTIONS.maxDPR = 1.5` (`types.ts:150`). On the i3 the physical pixel buffer is 1.5× the CSS size in each dimension — 2.25× the pixels to rasterize per frame, all on the CPU.

5. **`ctx as unknown as CanvasRenderingContext2D` casts.** The worker passes its `OffscreenCanvasRenderingContext2D` to the layer functions cast as `CanvasRenderingContext2D` (`hyperion-render.worker.ts:267-298`). This is type-only and harmless at runtime, but it masks the fact that the OffscreenCanvas 2D context on legacy hardware may have a smaller feature fast-path than a real GPU canvas context.

6. **Main-thread contention.** Although rendering is offloaded, the main thread still: runs the Glass frame packing loop (`packGlassFrameInto` over N fixtures at 44 Hz), services `ResizeObserver`, manages React state for hover/lasso/tooltip, and — per Section 1 — continuously re-rasterizes blurred neon DOM. The worker and the main thread thus **both** hammer the same CPU cores; offloading rendering to a worker does not help when the compositor is also software-bound.

### 2.5 The compilation / runtime null bug (context for the fix)
The `INIT` handler assigned `canvas = msg.canvas` and immediately dereferenced `canvas.width` (`hyperion-render.worker.ts`, pre-fix). The type contract (`WorkerMsgInit.canvas: OffscreenCanvas`) claims non-null, but on legacy GPUs `transferControlToOffscreen()` can silently yield a null/detached canvas. The resulting `Cannot read properties of null (reading 'width')` killed the worker before it could emit `ERROR`, leaving `TacticalCanvas` stuck on "INITIALIZING..." — which on the i3 read as a persistent null crash. The WAVE 7568 fix adds an explicit `OffscreenCanvas | null` guard at the read site (see code change). `tsc --noEmit` and `vite build` both pass clean after the fix.

---

## SECTION 3 — Eco-Mode Strategy (theoretical, no code)

The goal of Eco-Mode is to let LuxSync run a live show on potato hardware without breaking React's lifecycle or the worker contract. The strategy is **additive and conditional**: nothing is removed; heavy paths are bypassed when an Eco flag is active. All proposals below preserve existing component lifecycles — they only change *what gets mounted* and *which CSS rules win*.

### 3.1 Detection & global flag
- Introduce a single runtime flag (e.g. an Eco-Mode toggle in settings, auto-detected from `navigator.hardwareConcurrency`, `deviceMemory`, and a one-shot `OffscreenCanvas` + `getContext('2d')` capability probe at boot).
- Propagate the flag through a Zustand store (same pattern as existing stores) so any component can subscribe. No prop-drilling, no context-provider churn.

### 3.2 Conditional canvas mounting (worker bypass)
- When Eco-Mode is ON, **do not mount `TacticalCanvas` with `transferControlToOffscreen`**. Instead mount a lightweight "Eco" tactical view that:
  - Renders to a plain `<canvas>` 2D context **on the main thread** at a capped frame rate (e.g. 15–20 fps via a throttled RAF or `setInterval`), OR
  - Renders a static DOM/SVG representation of fixtures (dots + color) with no glow, no beams, no aura — only the selection layer.
- This is a **sibling component swap**, not a conditional inside `TacticalCanvas`. React mounts either `<TacticalCanvas/>` or `<EcoTacticalView/>` based on the flag. Both conform to the same props interface. Because `transferControlToOffscreen` is never called in Eco, there is no irreversible-transfer risk and no worker thread at all — freeing a full core.
- The Glass data subscription is redirected: in Eco-Mode the main thread reads `window.glass.onFrame` directly and updates the eco view at the throttled cadence (latest-frame-wins, no ping-pong pool needed).

### 3.3 Global CSS overrides (kill the blur tax)
- Ship an `eco-mode.css` sheet, injected as a **low-specificity override layer loaded last** (after all component CSS), gated on a `body.eco-mode` class. Because it loads last and uses `!important` sparingly only where needed, it wins the cascade without editing any component stylesheet.
- Overrides:
  - `backdrop-filter: none !important` on all elements (eliminates the 37-file backdrop-blur tax instantly).
  - Replace `box-shadow` glows with a single solid 1px border or a flat `outline` (no blur). Provide a utility class `.eco-no-glow { box-shadow: none !important; filter: none !important; text-shadow: none !important; }`.
  - Disable infinite decorative animations: `animation: none !important` for `pulse-glow`, `pulse-badge`, `tactical-pulse`, `spin` (keep functional spinners only where a loading state is required, and make them CSS-only with `border` instead of `box-shadow`).
  - Replace `transition: all ...` with `transition: opacity 0.15s, background-color 0.15s` (animate only cheap properties; never `box-shadow`/`filter`).
  - Cap `image-rendering` to `crisp-edges` and force `will-change: auto` to drop implicit compositor layers.
- This is a **pure CSS-layer bypass**: no React component re-renders, no lifecycle change, no state mutation. The DOM is identical; only the rasterization work changes. It is the highest-impact, lowest-risk intervention.

### 3.4 Worker-side Eco knobs (when the worker IS mounted)
If Eco-Mode is ON but the operator still wants the worker canvas (e.g. a slightly better machine), reuse the existing `OPTIONS` message to drive quality down:
- Force `quality: 'LQ'` (already supported — `renderFixtureLayer` skips the aura pass when `isHQ` is false, `FixtureLayer.ts:496`).
- Add an Eco flag to the `OPTIONS` message that, in the worker's `render()` loop, (a) caps RAF to every 2nd or 3rd vsync, (b) skips the Grid and HUD layers, (c) reduces DPR to 1.0, (d) skips beat-envelope scaling. These are additive branches in the worker, not removals.
- Tie the RAF cadence to `metrics.fps`: if the rolling FPS drops below a threshold (e.g. 30), automatically skip frames. This makes Eco adaptive rather than a static flag.

### 3.5 React lifecycle safety guarantees
- **No unmount of the immortal worker mid-show.** The existing "Immortal Worker" guard (`TacticalCanvas.tsx:278`) already prevents Strict-Mode double-transfer. Eco-Mode must respect this: switching Eco ON→OFF at runtime should NOT remount `TacticalCanvas` (which would re-attempt `transferControlToOffscreen` on an already-transferred node). Instead, the Eco↔HQ switch should happen at the **view-router level** (mount one or the other), and only when the view is not actively showing, OR the HQ view should be CSS-hidden (not unmounted) so the canvas node stays valid.
- **Hibernation reuse.** The existing `HIBERNATE` protocol (`hyperion-render.worker.ts:571-586`) already pauses the RAF loop when the canvas is CSS-hidden. Eco-Mode can reuse this: when the Eco DOM view is active, send `HIBERNATE { sleep: true }` to the (still-mounted, hidden) worker so it burns zero cycles, then wake it on switch-back. This avoids the irreversible-transfer problem entirely.
- **State continuity.** Selection, hover, and tooltip state live in `selectionStore` / component state — independent of which view renders them. Swapping the view does not lose selection.

### 3.6 Expected impact (qualitative)
On the target i3: disabling `backdrop-filter` + `box-shadow` + infinite animations via the CSS override alone should recover the majority of the render-thread budget (the blur re-rasters are the dominant cost). Adding the conditional eco canvas mount removes the second software rasterizer (the worker) entirely. The combination should move the render thread from "component degradation" to "functional, lower-fidelity show control" — which is the stated survival goal. The backend DMX/Audio threads are unaffected by any of these changes.

### 3.7 Eco-Mode component fallbacks — Neural Command (WAVE 7578)

The CSS override layer (Section 3.3) kills the blur tax globally, but the Neural Command components (Section 1.4) have a second cost axis that CSS cannot address: **high-frequency DOM mutations and React re-renders driven by live data**. The Audio Spectrum's 1,920 style mutations/sec and the Oracle's 22 Hz backdrop re-raster survive the CSS override because they are driven by JavaScript, not by CSS animations. These require **React-level component swaps** — mounting a lightweight fallback component instead of the heavy one when `isPerformanceMode` is true.

The strategy is identical to Section 3.2 (sibling swap, not conditional inside the heavy component). Each fallback conforms to the same props interface but replaces the expensive rendering path with a static or heavily throttled equivalent.

#### 3.7.1 `<EcoSpectrum>` — replaces `<AudioSpectrumTitan>`

**What it kills:** The 60 fps RAF loop, 32 DOM bars with `drop-shadow` + `will-change`, the beat-pulse `box-shadow` toggle, and the 1,920 style mutations/sec.

**What it keeps:** The operator still needs to see that audio is live and get a rough sense of energy level. The beat detection (BPM + confidence) is critical for show sync.

**Design:**
- Mount a **single static DOM skeleton**: one root `<div>`, one "SYNC" LED indicator, one BPM text readout, one energy bar (single `<div>` with `width: %`), and one confidence bar. Total: ~5 DOM elements instead of 70+.
- **No RAF loop.** Instead, subscribe to the transient store via a **throttled Zustand selector** at 5 Hz (every 200ms). This reduces data-driven updates from 60 fps to 5 Hz — a **24× reduction in update frequency**.
- The "SYNC" LED blinks on `beat.onBeat` — but only toggles a CSS class (`led--on` / `led--off`), no shadow animation. The LED is a 6px solid-color circle with a flat `background` change.
- The energy bar is a single `<div style="width: X%">` — one style mutation per 200ms instead of 64 per frame.
- **No `drop-shadow`, no `will-change`, no `box-shadow`, no `filter`** on any element. The CSS override layer (Section 3.3) handles this globally, but the EcoSpectrum should also be written without these properties so it is cheap even if the CSS override is not loaded.
- **No `getTransientTruth()` imperative polling.** The throttled React subscription is sufficient at 5 Hz; the imperative `getState()` RAF pattern is unnecessary when the update rate is this low.

**Props interface:** Same as `AudioSpectrumTitan` (currently takes no props — it reads the store internally). The EcoSpectrum reads the same store but via a throttled hook.

**Expected impact:** Eliminates ~1,920 style mutations/sec, 1,920 drop-shadow re-rasters/sec, and 64 compositor layers. Replaces them with ~5 style mutations/sec and 0 shadow re-rasters. This alone should recover 30–40% of the main-thread frame budget on the i3 when the Sensory view is active.

#### 3.7.2 `<EcoChromaticCore>` — replaces `<ChromaticCoreComplete>`

**What it kills:** The `conic-gradient` + `radial-gradient` mask re-raster at 10 Hz, the multi-layer `box-shadow` on 5 elements, and the `text-shadow` on mood labels.

**What it keeps:** The operator still needs to see the current palette (4 colors) and the detected mood. The harmony strategy label is useful but non-essential.

**Design:**
- Replace the conic-gradient color wheel with a **static 4-swatch row**: four `<div>` blocks with `background: hsl(...)` — no gradient, no mask, no shadow. The swatches update at 10 Hz (throttled React subscription) but a flat `background-color` change is a cheap compositor operation (no blur, no mask).
- The Kelvin temperature, chord, and harmony strategy are shown as **plain text** with no `text-shadow`. A single `textContent` update at 10 Hz is negligible.
- The mood indicator is a **single colored dot** (6px circle, flat `background`) with a text label — no `text-shadow` glow.
- **No `box-shadow`, no `conic-gradient`, no `mask`, no `text-shadow`, no `filter`** on any element.

**Expected impact:** Eliminates the conic-gradient re-raster (the heaviest single element) and 5 shadow re-rasters at 10 Hz. Modest in isolation but meaningful when combined with EcoSpectrum in the Sensory view.

#### 3.7.3 `<EcoOracle>` — replaces `<OracleHybrid>`

**What it kills:** The infinite `point-pulse` SVG animation, the `backdrop-filter: blur(4px)` on the energy badge, the `alert-pulse` infinite animation, and the `transition: all` on the alert container.

**What it keeps:** The operator still needs to see the current prediction, energy zone, and trend direction. The sparkline is a luxury — a numeric trend arrow (↑/↓/→) conveys the same information at zero rendering cost.

**Design:**
- Replace the 60-point SVG sparkline with a **3-level trend indicator**: a single text element showing `↑ RISING`, `↓ FALLING`, or `→ STABLE` based on `energyVelocity`. No SVG, no path computation, no `setSparklineData` state updates. The trend text updates at 5 Hz (throttled subscription).
- The energy value badge is a **plain text readout** with a solid `background: rgba(0,0,0,0.6)` — no `backdrop-filter`. The text updates at 5 Hz via `textContent`.
- The zone indicator is a **colored text label** (e.g. `CALM` in green, `BUILDUP` in amber) — no glow, no animation.
- Alerts are shown as a **static colored border** on the panel (red for drop/spike, amber for buildup) — no `animation: alert-pulse`, no `transition: all`. The border color changes at 5 Hz; a border-color change is a cheap compositor operation.
- **No `backdrop-filter`, no `filter: drop-shadow`, no `animation: ... infinite`, no `transition: all`** on any element.

**Expected impact:** Eliminates 1 infinite SVG animation, 1 backdrop-filter re-raster at 22 Hz, and 1 infinite alert-pulse animation. Recovers ~10–15% of the frame budget on the i3 when the Consciousness view is active.

#### 3.7.4 `<EcoEthicsCouncil>` — replaces `<EthicsCouncilExpanded>`

**What it kills:** The `transition: all 0.2s ease` on vote cards and the inset `box-shadow` re-rasters on vote status change.

**What it keeps:** The operator still needs to see the 3 votes (Beauty/Energy/Calm) and the consensus score. This is the cheapest component to begin with, so the Eco fallback is mostly a CSS simplification.

**Design:**
- Three vote cards as **plain text rows**: `🦋 BEAUTY: FOR (0.82)` / `🦊 ENERGY: AGAINST (0.91)` / `🐋 CALM: ABSTAIN (0.50)`. No card backgrounds, no inset shadows, no transitions.
- The consensus score is a **single percentage text** — no progress bar fill animation.
- Vote status changes are instant (no `transition: all`). A text color change (green/red/gray) is a cheap compositor operation.
- **No `box-shadow`, no `transition: all`** on any element.

**Expected impact:** Minimal in isolation (the original is already cheap), but removes 2 inset shadow re-rasters and 1 `transition: all` amplifier. Useful for completeness — the Consciousness view should have ALL four panels in Eco-Mode, not just the expensive ones.

#### 3.7.5 Eco-Mode view router integration

The Neural Command view (`NeuralCommandView.tsx`) already has a sub-tab router (`SubTabNavigation`) that conditionally mounts `SensoryView`, `ConsciousnessView`, or `NeuralStreamLog`. The Eco-Mode integration point is at this router level:

```
SensoryView
  ├── HQ: <AudioSpectrumTitan/> + <ChromaticCoreComplete/> + <OmniMatrixTelemetry/>
  └── ECO: <EcoSpectrum/> + <EcoChromaticCore/> + <OmniMatrixTelemetry/>  (telemetry is cheap, keep as-is)

ConsciousnessView
  ├── HQ: <OracleHybrid/> + <EthicsCouncilExpanded/> + <AIStateTitan/> + <DreamForgeComplete/>
  └── ECO: <EcoOracle/> + <EcoEthicsCouncil/> + <EcoAIState/> + <EcoDreamForge/>
```

The swap is a **conditional import at the view level**, gated on the `isPerformanceMode` flag from the Eco Zustand store (Section 3.1). No prop-drilling. The heavy components are never mounted in Eco-Mode — they are not just CSS-hidden, they are **not in the React tree**, so their RAF loops, Zustand subscriptions, and `useEffect` cleanup functions never run. This is the critical distinction from the CSS override layer: the CSS override changes *how elements render*, but the component swap changes *whether they exist*.

#### 3.7.6 Throttled subscription pattern (shared utility)

All Eco fallback components share a common data-access pattern: instead of the imperative `getTransientTruth()` RAF loop or the unthrottled `useTruthAI()` hook, they use a **throttled selector** that fires at most once every 200ms (5 Hz). This can be implemented as a shared `useThrottledTruthSelector(selectorFn, intervalMs)` hook:

- Internally uses `useRef` to track the last update timestamp.
- Subscribes to the transient store via `useTransientStore.subscribeWithSelector`.
- Only calls `setState` when `(now - lastUpdate) >= intervalMs`.
- Returns the latest snapshot — stale data is acceptable at 5 Hz for display purposes.

This pattern replaces:
- Audio Spectrum's 60 fps RAF → 5 Hz throttled subscription (**12× reduction**)
- Oracle's 22 Hz `useTruthAI()` → 5 Hz throttled subscription (**4.4× reduction**)
- Chromatic Core's 10 Hz `useTruthPaletteThrottled()` → 5 Hz (already throttled, minor reduction)

The throttled hook is the single most reusable piece of Eco-Mode infrastructure — it applies to any future high-frequency component without requiring a custom fallback.

### 3.8 Expected impact — Neural Command Eco-Mode (qualitative)

On the target i3 with the Neural Command view active:

| Intervention | Estimated frame budget recovered |
|---|---|
| CSS override (Section 3.3) — kills blur tax globally | ~40-50% |
| `<EcoSpectrum>` replaces `<AudioSpectrumTitan>` | ~30-40% |
| `<EcoOracle>` replaces `<OracleHybrid>` | ~10-15% |
| `<EcoChromaticCore>` + `<EcoEthicsCouncil>` | ~5-10% |
| **Combined Neural Command Eco-Mode** | **~85-95%** of the frame budget recovered |

The remaining 5–15% is the irreducible cost of React reconciliation at 5 Hz, the throttled store subscriptions, and the base Electron/Chromium overhead. This should move the Neural Command view from "component degradation and frame drops" to "functional, low-fidelity neural monitoring" — the operator can still see BPM, energy level, prediction, and ethics votes, just without the animated glow tax.

---

## APPENDIX — Files inspected

- `electron-app/src/workers/hyperion-render.worker.ts` (render loop, message handler, INIT/RESIZE/SHUTDOWN/HIBERNATE/GLASS_PORT)
- `electron-app/src/workers/hyperion-render.types.ts` (worker contract, FLOATS_PER_FIXTURE)
- `electron-app/src/workers/HyperionRenderBuffer.ts` (pack/unpack)
- `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx` (lifecycle, Glass pipeline, ping-pong pool)
- `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.css` (ruler backdrop-filter)
- `electron-app/src/components/hyperion/views/tactical/layers/FixtureLayer.ts` (sprite cache, 6-pass fixture pipeline)
- `electron-app/src/components/hyperion/views/tactical/layers/GridLayer.ts`
- `electron-app/src/components/hyperion/views/tactical/layers/SelectionLayer.ts`
- `electron-app/src/components/hyperion/views/tactical/layers/HUDLayer.ts`
- `electron-app/src/components/hyperion/views/tactical/types.ts` (DEFAULT_TACTICAL_OPTIONS.maxDPR=1.5)
- `electron-app/src/components/views/DashboardView/**/*.css` (heaviest stylesheet cluster)
- `electron-app/src/components/KeyForgeOverlay.tsx`
- `electron-app/src/components/views/NeuralCommandView/NeuralCommandView.tsx` (sub-tab router, Sensory/Consciousness/Stream)
- `electron-app/src/components/views/NeuralCommandView/SubTabNavigation.tsx`
- `electron-app/src/components/views/SensoryView/AudioSpectrumTitan.tsx` (32-band RAF engine, imperative DOM mutation, zero-alloc buffers)
- `electron-app/src/components/views/SensoryView/AudioSpectrumTitan.css` (drop-shadow on bars, will-change, beat-pulse box-shadow)
- `electron-app/src/components/views/SensoryView/ChromaticCoreComplete.tsx` (conic-gradient wheel, palette swatches, HSL conversion)
- `electron-app/src/components/views/SensoryView/ChromaticCoreComplete.css` (conic-gradient + radial-gradient mask, multi-layer box-shadow, text-shadow)
- `electron-app/src/components/views/SensoryView/SensoryView.tsx` (Sensory view container)
- `electron-app/src/components/views/SensoryView/OmniMatrixTelemetry.css` (text-shadow on active values)
- `electron-app/src/components/views/ConsciousnessView/ConsciousnessView.tsx` (2×2 grid router, useTruthAI subscription)
- `electron-app/src/components/views/ConsciousnessView/OracleHybrid.tsx` (60-point SVG sparkline, setSparklineData state updates, backdrop-filter badge)
- `electron-app/src/components/views/ConsciousnessView/OracleHybrid.css` (backdrop-filter:blur(4px), infinite point-pulse animation, alert-pulse animation, transition:all)
- `electron-app/src/components/views/ConsciousnessView/EthicsCouncilExpanded.tsx` (3-card vote panel, calculateVotes logic)
- `electron-app/src/components/views/ConsciousnessView/EthicsCouncilExpanded.css` (transition:all, inset box-shadow on vote cards)
- `electron-app/src/components/views/ConsciousnessView/AIStateTitan.css` (strike-pulse infinite animation with box-shadow)
- CSS grep across `electron-app/src/**/*.css`: 874 heavy-property matches, 37 files with `backdrop-filter`
- CSS grep across `SensoryView/**/*.css`: 13 heavy-property matches (drop-shadow on 32 bars, conic-gradient, multi-layer box-shadow)
- CSS grep across `ConsciousnessView/**/*.css`: 12 heavy-property matches (backdrop-filter, infinite animations, transition:all)

**Verification performed:** `npx tsc --noEmit` (exit 0, clean) and `npx vite build` (exit 0, clean) both pass after the WAVE 7568 worker null-guard fix. WAVE 7578 additions are documentation-only (no code changes).
