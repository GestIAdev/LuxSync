# ASTERIA ARCHITECTURAL CRUX — Forensic Audit (WAVE 8187)

**Scope:** read-only diagnostic of three architectural bottlenecks in the current
Asteria implementation, for injection as context to the Chief Architect.
**Method:** static trace of compile-time and UI code paths. No fixes,
workarounds, or hacks are proposed; observed behavior, mathematical
consequences, and direct implications only.
**Baseline:** commit `a2ad8705` (WAVE 8186). All paths relative to
`electron-app/src/components/views/HephaestusView/` unless noted.

Companion document: `COHORT_FORENSIC_AUDIT.md` (WAVE 8185) — routing/spill
forensics. This audit covers the *cost, scope, and authoring* consequences of
the architecture that audit mapped.

---

## CRUX 1 — Budget Explosion: the MCC Track Multiplier

### Where the multiplier lives

Strategy dispatch (`asteria/compiler/AsteriaCompiler.ts:422–447`):

- `'mcc-device'` → `emitCohortTracks(..., isolateSpilled = true)` (427–430).
- `'mcc'` → `emitMccTracks` (444).
- λ/`ride` → the shared phase-bus path (449–464).

Both surgical emitters share the same loop shape: an outer iteration over
**every active target parameter**, an inner iteration over **every affected
node**.

```ts
// emitCohortTracks — AsteriaCompiler.ts:646, 750–776
const params = emitTargetParams(project, warnings)          // flat list
...
const isolated = isolateSpilled && spill.size > 0            // 750
for (const param of params) {                                // 755
  const fam = isolated ? paramNodeFamily(param) : null       // 756
  if (fam !== null) {
    for (const nid of c.nodeIds) {                           // 759
      ...
      let curve = rotateCurveCyclic(baseCurveFor(param), field.delayMs[i], D)
      curve = bakeGainIntoCurve(curve, gain)
      tracks.push({
        id: `${ASTERIA_TRACK_PREFIX}${param}_mccd_${ci}_${di++}`,
        paramId: param,
        zones: ['all'],
        curve,
        blendMode: 'replace',
        cell: e.nodeId,                                      // 771
      })
    }
    continue
  }
  ... // param sin familia → cohort track
}
```

`emitMccTracks` repeats the same fan-out unconditionally (828: `params =
emitTargetParams(...)`; 838: `for (const param of params)`; 847:
`cell: e.nodeId`).

`paramNodeFamily` (566–588) maps each `HephParamId` to a node family —
`intensity`/`strobe` → `IMPACT`, `color`/`white`/`amber` → `COLOR`,
`pan`/`tilt`/`speed` → `KINETIC`, etc. — so the inner loop emits a track for
every member node **of that param's family**. `emitTargetParams` (543) returns
the flat intersection `project.targetParams ∩ LAMBDA_SAFE_PARAMS`; it carries
no per-parameter routing or cardinality information.

### The 150 + 150 arithmetic

Rig: 150 fixtures, one IMPACT node and one COLOR node each. Operator targets:
`DIM` (intensity) + `CLR` (color). Field covers all 300 nodes.

For each spilled cohort (or every node, under `mcc`):

```
param 'intensity' → fam IMPACT → 150 member nodes → 150 tracks  (ast_intensity_mccd_*)
param 'color'     → fam COLOR  → 150 member nodes → 150 tracks  (ast_color_mccd_*)
                                                              ─────────────
                                                              300 tracks
```

Track count is `Σ_params × (member nodes of that param's family)` — a **product**
of two orthogonal dimensions the compiler multiplies unconditionally.

The color half of the product is pure duplication of shape: every color track
carries a private copy of `synthesizeColorLut(D, project.targetColor)` — the
same 5-key HSL pulse (lutSynth.ts:132–157), differing only by the cyclic
time-rotation applied at 763. 150 serialized copies of an identical waveform
that differs only in phase.

### Why the budget notices

The reported size is `bytes: JSON.stringify(tracks).length`
(AsteriaCompiler.ts:515) and the HUD compares it against
`LFX_MAX_BYTES = 256 * 1024` (AsteriaTransportDrawer.tsx:53; red >70%,
~79–91). The same payload is serialized into the `.lfx`.

Per surgical track the serialized cost is: id + paramId + `zones:['all']` +
`blendMode` + `cell` + a full keyframe array (5–9 keys, each a JSON object with
`timeMs`/`value`/easing — on the order of 0.3–0.9 KB per curve). At 300 tracks
the track array alone lands in the ~150–350 KB range — comparable to, or beyond,
the entire 256 KB envelope **before** clip metadata, `spatialZones`,
`cognitiveDNA`, and any manual Forge tracks are counted. The WAVE 8186 test
`BUDGET: la explosión de pistas se contabiliza en report.bytes`
(AsteriaCompiler.test.ts:1217) verifies that this growth is visible in the
report.

### The missing decoupling — observed facts

1. `emitTargetParams` returns a flat `readonly HephParamId[]` (543). The
   isolated branch iterates it identically for every cohort (755). There is no
   code path that assigns different emission cardinality to different params —
   `paramNodeFamily` decides *which* nodes, never *how many tracks*.
2. The λ path demonstrates that the codebase already knows a cheaper encoding
   for the same spatial information: one track per param +
   `phaseOverrides` (per-device delay map) at 455–464. In the isolated
   cohort/MCC path the phase bus is absent — isolated tracks carry **no**
   `phaseConfig`/`phaseOverrides` (765–772); delay is baked into each rotated
   curve copy instead.
3. `lutSource` is a single project-level curve source (401–414): one ride track
   or one synthesized shape, cloned for every param. No per-param or
   per-cohort curve source exists.
4. `auto` escalates spilled cohorts into this same pipeline (422–437), so the
   multiplier is reached by the default path, not only by explicit selection.

**Net diagnosis:** surgical isolation is applied at the granularity of
*(cohort, param, node)* uniformly; nothing in the data model lets `color`
be emitted at a different cardinality than `intensity`. With two active
targets on a 150-node field the compiler emits 300 serialized curves — the
`.lfx` budget failure is the serialized size of that product.

---

## CRUX 2 — Target Singularity: Global vs. Layer

### Where the target state lives

`AsteriaProject` (`asteria/model/AsteriaProject.ts`):

```ts
// 277–285 — campos de proyecto, no de gesto
readonly targetParams: readonly HephParamId[]   // 277
readonly targetColor?: string                    // 285
```

Defaults: `ASTERIA_DEFAULT_TARGET_PARAMS`, `ASTERIA_DEFAULT_TARGET_COLOR`
(323–324).

Store (`asteria/store/useAsteriaStore.ts`):

```ts
setTargetParams: (params) =>
    : { ...historyPush(s), project: { ...s.project, targetParams: params } },  // 578–582
setTargetColor: (color) =>
    : { ...historyPush(s), project: { ...s.project, targetColor: color } },    // 585–589
```

Both setters write to `s.project` — the project root. No gesture-level setter
for param selection or color exists anywhere in the store.

### What a gesture can actually target

```ts
// AsteriaProject.ts:37, 154
export type FieldChannel = 'delay' | 'gain' | 'both'
...
readonly channel: FieldChannel        // 154 — en cada Gesture
```

A gesture's `channel` selects **which axis of the scalar field** it writes —
delay (time), gain (intensity), or both. It does **not** select which DMX
parameter the gesture will ultimately drive. `FieldChannel` has no member that
names a param, and no gesture type carries a `paramId` or color property.

### What the field carries

```ts
// fieldEngine.ts:68–77 — la totalidad del campo evaluado
export interface FieldSnapshot {
  readonly count: number
  readonly delayMs: Float32Array   // eje temporal
  readonly gain: Float32Array      // eje de intensidad
  readonly mask: Uint8Array        // cobertura
}
```

`blendInto` (100+) merges `(d, g)` scalar pairs per node under the gesture's
`BlendOp`, restricted to `channel` ∈ {delay, gain, both}. Layer composition is
defined **only** over `(delay, gain, mask)`. The evaluated field has no color
dimension, no param dimension, and no layer identity — after `evaluate()`, it
is impossible to recover which gesture wrote a given value, only the merged
scalar result.

### Where color enters — once, globally, at compile time

```ts
// AsteriaCompiler.ts:411–413
return param === 'color'
  ? synthesizeColorLut(D, project.targetColor ?? ASTERIA_DEFAULT_TARGET_COLOR)
  : synthesizeLambdaPulse(param, D)
```

`project.targetColor` is read once and baked into every emitted color track.
`emitTargetParams(project)` (543) emits the same `project.targetParams` set
for the whole aggregated field — there is no per-layer param selection to
iterate.

### Mathematical statement of the singularity

Let the evaluated field be `F : Nodes → ℝ² × {0,1}` — `(delayMs, gain, mask)`
per node. Layer composition is an algebra over that codomain:
`blend(F₁, F₂) : (ℝ²×{0,1}) × (ℝ²×{0,1}) → ℝ²×{0,1}`.

A Photoshop-like color layer model would require `C : Layers × Nodes → HSL³`
— color as a *per-layer* field quantity composited alongside gain. The
implemented model instead has `C : AsteriaProject → HSL³` — a compile-time
constant. Concretely:

- Layer L₁ paints nodes A with intended color C₁; layer L₂ paints nodes B with
  intended color C₂.
- The engine evaluates `mask(A) = mask(B) = 1` — the only surviving record of
  the paint is scalar `(d, g)`.
- At compile time, `synthesizeColorLut` stamps **one** `project.targetColor`
  into every color track. There is no term in `F` that could carry C₁ or C₂.

Any function mapping the current field to a correct two-color output would
need information that does not exist post-`evaluate()`. Two layers of
different colors are not composable — not because the blend ops are wrong,
but because the **space being blended in has no color axis**. The same
singularity applies to params: a gesture cannot write "only intensity" or
"only color" — `channel` partitions {delay, gain}, which is orthogonal to
{intensity, color, pan, …}; param selection is uniform across the stack.

---

## CRUX 3 — Curve Locking and the Missing Local Synth

### The lock surface (every mutation path)

`isAsteriaTrack` = `trackId.startsWith('ast_')` (`AsteriaCompiler.ts:106`,
`ASTERIA_TRACK_PREFIX`).

| Surface | File:line | Guard |
|---|---|---|
| Lane badge/tooltip | `ParameterLane.tsx:190, 261–268` | 🔒 + "solo lectura (se sobrescribe al recompilar). Duplícala…" |
| Zone editing | `ParameterLane.tsx:286–305` | badge click → `stopPropagation` only; cursor `default` |
| Track removal | `ParameterLane.tsx:344` | `{onRemove && !isAst && (` — button unmounted |
| Curve editing | `ForgeTab.tsx:412` | `updateCurve` early-return — covers drags, keyframe ops, context menu, templates, mode changes (comment 408–411) |
| Track removal | `ForgeTab.tsx:874` | `handleRemoveTrack` early-return |
| Zone mutation | `ForgeTab.tsx:894` | `handleTrackZonesChange` early-return |
| Phase editor | `LabTab.tsx:106, 286–298, 306` | `PhaseControls disabled={activeTrackIsAst}` + 🔒 ASTERIA badge |

The rationale is written into the guards themselves (ParameterLane 186–189,
ForgeTab 408–411): `injectAstTracks` (AsteriaCompiler.ts:~125–128) filters
**all** `ast_*` tracks out of `clip.tracks` and re-emits them — any manual
edit is destroyed on the next recompile, so the UI treats the tracks as
compiler-owned. Duplication is the single permitted escape (⧉, ParameterLane
333–342): the copy gets a fresh UUID, loses the `ast_` prefix, and becomes an
ordinary manual track — outside the Asteria pipeline.

### The synthesis vocabulary — exhaustive inventory

`asteria/compiler/lutSynth.ts` contains exactly three generators:

| Function | Line | Shape |
|---|---|---|
| `synthesizeLambdaPulse` | 58–77 | One fixed trapezoidal pulse: rise to ~8%D, hold through ~28%D, release through ~42%D, C⁰-close at D |
| `synthesizeColorLut` | 132–157 | One fixed color pulse: L 0 → target → target → 0 → 0, constant H/S |
| `synthesizeLambda` | 174–195 | Wraps the pulse + builds the per-device `phaseOverrides` map |

There is no triangle, sawtooth, sine, square, ramp, or parameterized waveform
generator anywhere in the Asteria tree. `baseCurveFor` (401–414) has exactly
two sources: `cloneCurve(rideCurve)` if `project.lutSource.kind === 'ride'`,
else the fixed synth.

### What cohort/MCC can do to a curve — time-shift and gain, nothing else

Every generated track in the surgical and cohort paths is produced by the
same pair of transforms:

```ts
// AsteriaCompiler.ts:763–764 (isolated), 778–779 (cohort), ~840 (mcc)
let curve = rotateCurveCyclic(baseCurveFor(param), delay, D)   // time-shift
curve = bakeGainIntoCurve(curve, gain)                         // amplitude scale
```

`rotateCurveCyclic` shifts keyframe times; `bakeGainIntoCurve` scales values.
Neither can change the *shape* — the trapezoid's duty cycle, edge order, and
keyframe count are identical across all 300 tracks of a Crux-1 scenario.
Shape selection exists at exactly one point — `project.lutSource` — and it is
singular: one source, applied to every param, every cohort, every node.

### The operator trap — stated without remedy

Three facts that are simultaneously true in the current build:

1. **Generated tracks are uneditable in place.** Every mutation path —
   curve, zones, phase, removal — is guarded (table above), and the guards
   are *correct*: recompilation unconditionally overwrites `ast_*`.
2. **Editable tracks are external to Asteria.** A duplicated/detached track
   or a hand-built Forge track is not managed by the Gesture Stack — it does
   not receive field evaluation, cohort partitioning, or `cell` routing.
   Λ-Ride (GestureInspector STRATEGY → LUT SRC) lets such a track *feed* the
   compile via `cloneCurve`, but the source shape is authored outside Asteria
   and applies to everything uniformly.
3. **Asteria cannot synthesize a shape per generated track.** There is no
   input — gesture property, cohort field, or per-node selector — that
   reaches `baseCurveFor` other than `param` and the project-global
   `lutSource`. A spatial "laser" waveform (e.g., a fast linear ramp sweeping
   across a cohort, distinct from the pulse on the rest of the rig) has no
   representation in the compile: the generated track exists only as a
   rotated/scaled instance of the single global shape.

Resulting state: the operator sits between a generated, read-only, uniformly
shaped track set and a manual, editable surface that Asteria cannot write
*into*. Non-pulse choreography requires authoring in Forge and surrendering
it to a single global ride — there is no point in the pipeline where a
synthesized waveform of the operator's choosing can be injected into a
specific generated track.

---

## Cross-Crux evidence index

| Fact | Location |
|---|---|
| Track fan-out `param × node` | `AsteriaCompiler.ts:755–776` (cohort-isolated), `838–847` (mcc) |
| Flat param list | `AsteriaCompiler.ts:543` (`emitTargetParams`), `277` (`targetParams`) |
| Byte accounting | `AsteriaCompiler.ts:515`; envelope `AsteriaTransportDrawer.tsx:53` |
| λ contrast path (1 track/param + overrides) | `AsteriaCompiler.ts:455–464` |
| Global color read | `AsteriaCompiler.ts:412`; `AsteriaProject.ts:285`, `useAsteriaStore.ts:585` |
| Field codomain ℝ²×{0,1} | `fieldEngine.ts:68–77`, `blendInto` 100+ |
| Gesture channel = field axis, not param | `AsteriaProject.ts:37, 154` |
| `ast_` predicate / wipe-on-recompile | `AsteriaCompiler.ts:106, ~125–128` |
| UI lock matrix | `ParameterLane.tsx:190–344`; `ForgeTab.tsx:412, 874, 894`; `LabTab.tsx:106, 286–306` |
| Synth inventory | `lutSynth.ts:58, 132, 174` |
| Only curve transforms | `rotateCurveCyclic`, `bakeGainIntoCurve` — call sites `AsteriaCompiler.ts:763–764, 778–779` |

*Diagnosis only. No recommendations are made in this document.*
