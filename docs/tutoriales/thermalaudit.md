I'll perform a read-only audit of the Hyperion render pipeline. Let me start by locating the relevant components.

Let me read the core render pipeline files in parallel.

Let me read the rest of the worker, the 3D environment/fixture components, and the rest of TacticalCanvas.

Let me read the rest of TacticalCanvas (the data pump / RAF / glass frame subscription) and the postprocessing + Par3D.

Let me check the QUALITY_PRESETS (shadow map resolution), the useFixture3DData hook, and the Vite config for HMR settings.

Let me check the FixtureLayer (called at 60fps in the worker) for per-frame allocations.

Let me check the 2D GridLayer for the 50x25 scale impact.

I have completed the read-only audit. Here is the clinical diagnostic report.

---

# 🔬 WAVE 7749.24 — DIAGNOSTIC REPORT: THE HYPERION LEAK

## VERDICT SUMMARY

The 3.5GB / OOM-in-20-min + GPU thermal throttle is caused by **two distinct mechanisms** acting in the Vite HMR dev environment:

| # | Mechanism | Severity | Scope |
|---|-----------|----------|-------|
| **L1** | **Dev-only worker accumulation** — `TacticalCanvas` cleanup is short-circuited in `DEV`, leaking one `hyperion.render.worker` + `OffscreenCanvas` + RAF loop + sprite cache **per HMR reload** | 🔴 Critical (memory + CPU) | 2D |
| **L2** | **Per-fixture `<pointLight>` proliferation** — every PAR/strobe renders a real `THREE.PointLight`; N lights → O(N) per-fragment shader loop → GPU meltdown at warehouse fixture counts | 🔴 Critical (thermal) | 3D |
| **L3** | **NeonBloom mipmap chain (levels=5) at DPR 1.5** running every frame on a large framebuffer | 🟠 High (thermal) | 3D |

**The 50×25m scale is NOT the vertex/grid blowup the Architect suspected** — the grid divisions are fixed constants. The scale's real cost is indirect: it justifies warehouse-scale fixture counts, which multiplies L2.

---

## 1. WEBGL / THREE.JS DISPOSAL LIFECYCLE

### What is correctly disposed
- **`NeonFloor`** explicitly disposes `gridGeometry` and `gridMaterial` in `useEffect` cleanups (<ref_snippet file=".../environment/NeonFloor.tsx" lines="103-113" />). ✅
- **`HyperionTruss`, `HyperionMovingHead3D`, `HyperionPar3D`** declare geometries/materials as JSX children (`<cylinderGeometry>`, `<meshStandardMaterial>`). R3F auto-disposes these on unmount. ✅
- **`VisualizerCanvas`** relies on R3F's `<Canvas>` unmount to call `gl.dispose()` + `forceContextLoss()`. This is the canonical path and works for HMR. ✅
- **`WebGLContextHandler`** registers `webglcontextlost/restored` listeners with proper removal. ✅
- **`ClippingPlaneSetup`** clears `gl.clippingPlanes` on cleanup. ✅

### The real 3D disposal gap — none fatal for memory, but see L2/L3
There is **no explicit `gl.dispose()` / `renderer.forceContextLoss()`** in `VisualizerCanvas`'s own `useEffect` — it delegates entirely to R3F. This is acceptable **as long as R3F's unmount actually fires**. During HMR of `VisualizerCanvas.tsx` itself, R3F does unmount and dispose. The risk is rapid HMR exceeding the ~16 live WebGL context limit before GC reclaims them, but `forceContextLoss()` releases GPU memory synchronously, so this is **not the primary leak**.

### The 2D disposal gap — **L1, the actual leak**
<ref_snippet file=".../tactical/TacticalCanvas.tsx" lines="430-454" />

```ts
return () => {
  if (import.meta.env.DEV) {
    return          // ← THE LEAK
  }
  // ...terminate worker, null refs...
}
```

This `DEV` early-return was added for **React Strict Mode** (setup→cleanup→setup on the *same* instance, where `workerRef.current` survives and the line-289 guard bails out). That logic is correct **for Strict Mode**.

**But HMR is not Strict Mode.** HMR replaces the module and mounts a **fresh component instance** with `workerRef.current = null`. The sequence on every HMR reload:

1. Old `TacticalCanvas` unmounts → cleanup fires → `DEV` early-return → **worker NOT terminated**.
2. Old worker keeps running its 60fps `requestAnimationFrame(render)` loop forever, holding:
   - the transferred `OffscreenCanvas` (GPU texture memory),
   - `glowSpriteCache` + `beamSpriteCache` (up to 150 `OffscreenCanvas` sprites each ≈ **16MB+ GPU/CPU memory per orphan**),
   - `physicsStore`, `prevIntensity` Maps,
   - the `MessagePort` `glassPort` (port1 was closed by the *separate* GLASS effect cleanup, so no new frames arrive, but the worker still renders the last frame forever).
3. New `TacticalCanvas` mounts → `workerRef.current === null` → calls `canvas.transferControlToOffscreen()` on the new canvas → creates a **new** worker.

**Result:** one orphaned worker per HMR reload. After ~10–20 reloads in a 20-minute session: 10–20 RAF loops, 10–20 OffscreenCanvas contexts, 160–320MB+ in sprite caches alone. This is the 3.5GB balloon.

The `GLASS_PORT` effect cleanup (<ref_snippet file=".../tactical/TacticalCanvas.tsx" lines="590-595" />) correctly unsubscribes `glass.onFrame` and closes `port1`, so the **main-thread** side does not accumulate subscriptions — only the worker side leaks.

---

## 2. THE 50×25m SCALE IMPACT (Thermal Bottleneck)

### Grid — NOT the culprit
The Architect's hypothesis that the 50×25m scale blew up `GridHelper` segments is **incorrect**:

- **3D `NeonFloor`**: `GRID_DIVISIONS_X = 24`, `GRID_DIVISIONS_Z = 16` are **hardcoded constants** (<ref_snippet file=".../environment/NeonFloor.tsx" lines="24-26" />), independent of `width`/`depth`. The grid is always ~80 vertices. The floor plane is a single 2-triangle `<planeGeometry args={[50,25]}>`. ✅ No blowup.
- **2D `GridLayer`**: cell size is fixed at 40px in world space (<ref_snippet file=".../tactical/layers/GridLayer.ts" lines="82-83" />), bounded by the visible viewport. Line count scales with **viewport pixels / 40**, not stage meters. ✅ No blowup.

### Shadow map — minor
`QUALITY_PRESETS.HQ.shadows = true` (<ref_snippet file=".../shared/types.ts" lines="107-115" />). The `<directionalLight castShadow>` uses R3F's default 2048² shadow map. The 50×25m frustum spreads this resolution thin (visual acne, not memory). The shadow pass cost scales with **shadow-caster mesh count**, not stage area. With 200 fixtures × ~5 meshes each, the shadow pass renders ~1000 meshes — non-trivial but linear, not exponential.

### The actual thermal culprit — L2: per-fixture PointLights
<ref_snippet file=".../visualizer/fixtures/HyperionPar3D.tsx" lines="220-228" />

```tsx
<pointLight
  ref={pointLightRef}
  position={[0, -0.1, 0]}
  intensity={0}
  distance={3.5}
  decay={2}
  color={fixture.color}
/>
```

**Every PAR/wash/generic/strobe/blinder renders a real `THREE.PointLight`.** `HyperionMovingHead3D` correctly avoids this (uses emissive + beam cone only), but `HyperionPar3D` is used for `pars`, `strobes`, *and* `generic` types (<ref_snippet file=".../visualizer/VisualizerCanvas.tsx" lines="319-338" />).

Three.js's default forward renderer loops over **all lights per fragment** in the shader. With a warehouse-scale show (100–200 PARs), this is 100–200 dynamic lights → the fragment shader cost grows ~O(N_lights × N_fragments). At DPR 1.5 on a fullscreen canvas, this is the GPU melter. `intensity=0` when off does **not** remove the light from the shader's light array — the uniform is still uploaded and the loop still iterates.

### L3: Bloom mipmap chain
<ref_snippet file=".../visualizer/postprocessing/NeonBloom.tsx" lines="60-69" />

```tsx
<EffectComposer multisampling={0}>
  <Bloom mipmapBlur levels={5} ... />
  <Vignette ... />
</EffectComposer>
```

`mipmapBlur` with `levels={5}` allocates 5 mip render targets of the full scene buffer, re-rendered every frame. Combined with L2's per-fragment light cost, this is the second thermal contributor. It is correctly bypassed in LQ (`postProcessing=false` → `NeonBloom` not mounted), so it only hurts HQ.

---

## 3. THE 2D CANVAS & RENDER WORKER

### RAF loop — clean (modulo L1)
The worker's `render()` loop (<ref_snippet file=".../workers/hyperion-render.worker.ts" lines="188-379" />) reschedules via `requestAnimationFrame(render)` and is properly cancelled on `HIBERNATE` (line 679) and `SHUTDOWN` (line 736). The `HIBERNATE` path is wired from `TacticalCanvas` when `isVisible=false` (<ref_snippet file=".../tactical/TacticalCanvas.tsx" lines="511-514" />). ✅

**However**, L1's orphaned workers ignore `HIBERNATE` (no one sends it to them after the main thread moves on), so they keep RAF-ing forever.

### Per-frame allocation — already fixed (WAVE 7713)
- `smoothedFixturesPool` / `hitTestFixturesPool` are module-level pre-allocated arrays, mutated in-place via `getOrCreatePoolSlot` (<ref_snippet file=".../workers/hyperion-render.worker.ts" lines="159-182" />). Zero alloc/frame. ✅
- `FixtureLayer` uses a pre-rendered `OffscreenCanvas` sprite cache keyed by color string, stamped via `drawImage` (<ref_snippet file=".../tactical/layers/FixtureLayer.ts" lines="96-188" />). Zero `CanvasGradient` allocs in the hot loop. ✅
- The main-thread Glass pump uses a 2-slot ping-pong `Float32Array` pool with `BUFFER_RETURN` reclaim (<ref_snippet file=".../tactical/TacticalCanvas.tsx" lines="200-206, 533-581" />). Zero-copy transfer. ✅

**The 2D render path itself is not allocating garbage.** The leak is purely the orphaned-worker lifecycle (L1), not the render loop.

### One subtle accumulation in the sprite cache
The sprite caches are **module-scoped inside the worker** (`glowSpriteCache`, `beamSpriteCache`). Each orphaned worker retains its own copy. The `SPRITE_CACHE_LIMIT=150` eviction calls `(sprite as any).close()` (<ref_snippet file=".../tactical/layers/FixtureLayer.ts" lines="132-137" />), which is good — but it only fires when a *single* cache hits 150 unique colors. Color fades over time can churn through colors, and each orphaned worker holds its own full cache. This multiplies L1's memory footprint.

---

## PATCH STRATEGY (for Architect review — no code written)

### P1 — Fix the dev worker leak (L1)  [highest impact]
The `DEV` early-return conflates two different lifecycle events. Strict Mode and HMR need different guards:

- **Strict Mode guard**: keep the `if (workerRef.current) return` at line 289 — this correctly handles setup→cleanup→setup on the same instance.
- **HMR teardown**: the cleanup must still `terminate()` the worker when the component is *truly* unmounting (HMR, navigation away). The `DEV` short-circuit should be **removed** OR replaced with a Strict-Mode-specific signal.

Recommended approach: drop the `import.meta.env.DEV` early-return entirely and rely solely on the `workerRef.current` guard at the top of the init effect. Strict Mode's second setup will see `workerRef.current` still set (refs survive Strict Mode's fake unmount) and bail out — no double transfer. HMR's fresh mount will see `null` and create a new worker, while the cleanup properly terminates the old one.

If the Strict-Mode double-transfer race still bites (the original reason for the guard), alternative: track a module-level `Map<canvasNode, Worker>` so the guard is keyed by the actual DOM node identity rather than a ref that HMR resets.

Also: in the cleanup, send `SHUTDOWN` *before* `terminate()` (currently it does — good), and explicitly `close()` any sprite caches the worker holds. Since sprites are module-scoped in the worker, `SHUTDOWN` should iterate `glowSpriteCache`/`beamSpriteCache` and call `.close()` on each before the worker dies.

### P2 — Eliminate per-fixture PointLights (L2)  [thermal]
`HyperionPar3D` should **not** emit a real `<pointLight>` per fixture. Options, in order of preference:

1. **Remove the pointLight entirely** — the halo (additive sphere) + HDR lens already sell the glow via bloom. The pointLight's contribution (illuminating nearby floor/walls) is marginal at warehouse scale and catastrophic at count.
2. **Single shared pooled light** — keep at most 1–2 `PointLight`s that the brightest selected fixture "borrows" (move the light to the hottest fixture each frame).
3. **InstancedMesh + fake lighting** — render PARs as an instanced mesh with emissive baked into vertex colors; let bloom carry the glow.

This single change will drop GPU fragment cost from O(N) to O(1) lights and is the largest thermal win.

### P3 — Cap bloom cost (L3)  [thermal]
- Reduce `levels={5}` → `levels={3}` for HQ.
- Gate `NeonBloom` behind a fixture-count threshold (e.g. skip bloom when `fixtureCount > 80` even in HQ, or auto-downgrade to LQ post-processing).
- Consider `frameloop="demand"` with `invalidate()` on state change instead of `'always'` when the scene is static (no beat, no movement) — but this conflicts with the live DMX animation, so likely keep `'always'` only while `isVisible && isDocumentVisible && isInViewport` (already implemented — good).

### P4 — HMR-hardening for the 3D Canvas
Although R3F disposes on unmount, add an explicit `useEffect` cleanup in `VisualizerCanvas` that calls `gl.dispose()` + `gl.forceContextLoss()` via a `useThree`-captured `gl` ref, as a belt-and-suspenders against any HMR edge case where R3F's root unmount is skipped. Low priority given R3F's existing handling, but cheap insurance.

### P5 — Sprite cache hygiene
In `FixtureLayer`, lower `SPRITE_CACHE_LIMIT` from 150 → ~64 (discrete fixture palettes rarely exceed this), and quantize color keys (e.g. round RGB to nearest 8) so color fades produce fewer unique sprites. This reduces per-worker memory and makes L1 orphans cheaper if any slip through.

---

## CONFIDENCE

- **L1 (dev worker leak)**: High confidence — the `DEV` early-return is unambiguous and the HMR-vs-Strict-Mode conflation is clear from the code and comments.
- **L2 (pointLight thermal)**: High confidence — the per-fixture `<pointLight>` is plainly visible and is the textbook GPU-killer at scale.
- **L3 (bloom thermal)**: Medium-high — contributes but is secondary to L2.
- **50×25m grid blowup hypothesis**: Refuted — grid divisions are constant; the scale's only sin is enabling large fixture counts that amplify L2.

No code was modified or committed. Ready for Architect review of the patch strategy.

The lint error is **unrelated to the audit** — I made no code or config changes (the audit was strictly read-only). It's a pre-existing TypeScript deprecation in `tsconfig.json`:

> `Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.`

This is a config-level warning, not a code defect, and it has nothing to do with the Hyperion memory leak. It will not affect the patch strategy I delivered (P1–P5 are all about runtime lifecycle and GPU cost, not TS compilation).

If you'd like, I can silence it by adding `"ignoreDeprecations": "6.0"` to `tsconfig.json` compilerOptions — but I'd recommend doing that as a separate, deliberate change rather than bundling it into the Hyperion fix work. Want me to proceed with the Hyperion patches (P1–P5) instead, or handle the tsconfig deprecation first?