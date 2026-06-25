HEPHAESTUS — FORENSIC ARCHITECTURAL AUDIT
Scope: Data storage, curve engine, phase distribution, export contract, technical debt. No code modified. All citations reference current source.

1. Data Storage & Migration to Universal Asset Library Store
1.1 Current Storage — Dual-System Fragmentation
Hephaestus effects persist as .lfx files on disk. There are two independent I/O layers with overlapping responsibilities:

Layer A — HephFileIO (main process, async) @/electron-app/src/core/hephaestus/HephFileIO.ts:111-393

Stores clips at userData/effects/*.lfx
File format: { $schema: 'hephaestus/v1', version: '1.0.0', clip: HephAutomationClipSerialized, checksum: SHA-256 }
API: saveClip(), loadClip(), listClips(), deleteClip(), clipExists()
Only handles V2.1 clips (HephAutomationClip / HephAutomationClipSerialized). No V3 awareness.
listClips() reads every .lfx file fully, parses JSON, and extracts metadata — no lightweight metadata index. For N clips, this is N file reads + N JSON parses on every listing call.
loadClip() by ID does a linear scan of all .lfx files, reading and parsing each one until the ID matches. O(N) file I/O per lookup-by-ID.
Layer B — LfxFileLoader (main process, async) @/electron-app/src/core/arsenal/LfxFileLoader.ts:73-450

Loads .lfx files from multiple directories (builtin, user) into DynamicEffectRegistry
Handles both V2.1 and V3 (luxsync.lfx/3.0) schemas via schema-peek routing
V2.1 path: structural validation → isSeleneEligible() gate → G2 checksum → G5 curve sanity → G6 strobe cross-check → G7 spatial ranges → user safety policy
V3 path: structural validation → G5 track/zone/keyframe validation → DNA genome range check → user policy → G2 checksum (currently bypassed — see §5)
G2 checksum gate disabled for V3: // ⚡ WAVE 5020.5: G2 BYPASSED at LfxFileLoader.ts:402-421
Layer C — HephaestusRuntime.loadClip() (renderer process, sync) @/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:294-421

Synchronous fs.readFileSync in the renderer process
Caches parsed clips in clipCache: Map<filePath, HephAutomationClip | HephAutomationClipV3>
Handles V3 (luxsync.lfx/3.0) and V2.1 (hephaestus/v2.1 or legacy bare curves)
This is the hot-path loader called by play()
1.2 The Universal Asset Library Store Gap
@/electron-app/src/stores/assetLibraryStore.ts:94-177

The AssetLibraryState currently manages:

fixtures: LibraryAsset[] — system + user fixtures
ingenios: LibraryAsset[] — system + user ingenios
Effects / .lfx clips are NOT ingested. The store has no effects array, no ingestEffects() action, and no AssetType for 'effect' or 'lfx'. The AssetType enum (from assetAdapters.ts) only covers fixture and ingenio types.

Migration needed:

Add effects: LibraryAsset[] to AssetLibraryState
Add ingestEffects(metadata: HephClipMetadata[], source: AssetSource) action
Extend AssetType to include 'effect'
Create effectToAsset() adapter in assetAdapters.ts (mapping HephClipMetadata → LibraryAsset)
Wire HephFileIO.listClips() output → ingestEffects() during app boot
The getFilteredAssets() selector must handle the new type
1.3 Schema Versioning Concerns
Three schema versions coexist in the wild:

Schema	Format	Handler
hephaestus/v1	V2.1 wrapper with checksum	HephFileIO only
hephaestus/v2.1	V2.1 wrapper	HephaestusRuntime.loadClip()
luxsync.lfx/3.0	V3 native with tracks[]	LfxFileLoader + HephaestusRuntime.loadClip()
HephFileIO writes hephaestus/v1 but the runtime accepts v2.1 and v3.0. HephFileIO.saveClip() cannot save V3 clips — its saveClip() signature accepts only HephAutomationClip (V2), not HephAutomationClipV3. This means any V3 clip created in the UI cannot be persisted through HephFileIO.

2. Curve Engine — Bezier Evaluation & Canvas
2.1 CurveEvaluator (Runtime Math)
@/electron-app/src/core/hephaestus/CurveEvaluator.ts:80-661

Architecture:

One CurveEvaluator per HephAutomationClip (V2) or per HephTrack (V3 — single-curve Map)
Cursor cache (cursors: Map<HephParamId, number>) stores the left keyframe index of the active segment
O(1) amortized in forward playback (cursor advances 0 or 1 positions)
O(log n) on seek/scrub via binary search (findSegment())
Zero-allocation (WAVE 2400): pre-allocated _hslResult, _snapshotCache, _snapshotColorCache — callers must not retain references
Interpolation modes:

hold — step function, returns v0 until next keyframe
linear — direct lerp: v0 + (v1 - v0) * t
bezier — cubic Bezier via Newton-Raphson (4 iterations, epsilon 1e-7)
Cubic Bezier implementation (CurveEvaluator.ts:548-627):

Control points: P0=(0,0), P1=(cx1,cy1), P2=(cx2,cy2), P3=(1,1)
Handles are [cx1, cy1, cx2, cy2] relative to segment
Newton-Raphson solves BezierX(u) = t for u, then evaluates BezierY(u)
4 iterations → error < 0.001 (visually imperceptible at 60fps)
cy values outside [0,1] allow overshoot/bounce — intentional
If no handles provided, falls back to linear
Endpoints (t=0, t=1) are exact
Color interpolation (CurveEvaluator.ts:222-341):

H, S, L interpolated independently
Hue shortest-path: 350° → 10° crosses 0° (20° delta, not 340°)
Defensive HSL validation with safe-default fallback (WAVE 2040.22c)
Returns pre-allocated _hslResult (zero-alloc contract)
Performance target: 60 FPS × 12 params × 50 effects = 36,000 evals/sec. Each eval < 10μs → ~2ms/frame (~12% budget).

2.2 CurveEditor (UI Canvas)
@/electron-app/src/components/views/HephaestusView/CurveEditor.tsx:1-1530

Architecture:

Pure SVG — no Canvas2D, no visx/d3. DOM events come free.
Re-renders only on data change (no requestAnimationFrame loop)
Max ~50 keyframes per curve — SVG handles this effortlessly
Features:

Keyframe drag & drop (constrained to bounds)
Double-click to add, right-click to delete
Bezier handle visualization and dragging (control points rendered as circles)
Zoom (wheel, 0.2x–8x) and pan (middle-click drag)
Playhead indicator
Beat grid with snap
Rubber-band multi-selection
Scrub (click-drag on background)
Context menus: keyframe, background, multi-selection
Viewport state persistence (WAVE 2043.8)
Mathematical shape application to multi-selection (WAVE 2043.11)
Batch audio binding (WAVE 2043.12)
Value extraction: getPlotValue() at CurveEditor.tsx:149-156 normalizes color hue (0-360) to 0-1 for canvas plotting, preventing NaN in coordinate calculations.

Drag state machine: DragState.type can be 'keyframe' | 'handle-cp1' | 'handle-cp2' | 'pan' | 'rubber-band' | 'scrub' — all handled through a unified mouse event system.

3. Phase Distribution Engine
3.1 PhaseDistributor (Stateless Pure Function)
@/electron-app/src/core/hephaestus/runtime/PhaseDistributor.ts:55-188

Design axioms:

Pure function — same inputs → same outputs, always
Pre-calculable — resolve() called once at play() time, not per tick
Sorted output — FixturePhase[] sorted by phaseOffsetMs ASC, enabling O(1) cursor cache in CurveEvaluator
Core formulas:



spreadMs = durationMs × config.spread  (spread ∈ [0,1])
Linear:



stepMs = spreadMs / max(1, N - 1)
offset[i] = i × stepMs
Mirror (fold from edges to center):



halfN = ceil(N / 2)
mirrorIdx = min(i, N - 1 - i)
offset[i] = mirrorIdx × (spreadMs / max(1, halfN - 1))
Center-out (expand from center):



center = (N - 1) / 2
dist[i] = abs(i - center)
offset[i] = (dist / maxDist) × spreadMs
Wings (sub-groups with independent phase cycles):



wingSize = ceil(N / wings)
localIndex = i % wingSize
→ Apply symmetry formula with localIndex and localN (wing's fixture count)
Direction: direction === -1 flips offset: offset = spreadMs - offset

Edge cases:

N=0 → empty array
N=1 or spread=0 → all offsets = 0
wings > N → clamped to N (each fixture is its own wing → offset=0)
Negative spread → clamped to 0
3.2 Runtime Integration
Pre-calculation at play time: HephaestusRuntime._buildResolvedTrack() at HephaestusRuntime.ts:1028-1056

Each ResolvedTrack gets its own CurveEvaluator (single-curve Map)
If phaseConfig.spread > 0 and fixtureIds.length > 0, calls PhaseDistributor.resolve()
Result stored in ResolvedTrack.fixturePhases: FixturePhase[] | null
Tick-time evaluation: HephaestusRuntime.tickActive() at HephaestusRuntime.ts:663-741

Path A (with phases): For each FixturePhase, computes localElapsedMs = max(0, baseClipTimeMs - fp.phaseOffsetMs) — the MA3 model where offset represents how long a fixture waits before starting. The offset is subtracted, not added. This produces genuine wave/cascade effects.
Path B (no phases): All fixtures receive the same baseClipTimeMs
Loop handling: fixtureTimeMs = ((localElapsedMs % durationMs) + durationMs) % durationMs
Non-loop: fixtureTimeMs = min(localElapsedMs, durationMs)
Phase config sources (priority order):

track.phaseConfig (V3 native shorthand)
track.selector?.phase (FixtureSelector variant)
track.selector?.phaseSpread (legacy scalar → linear/default config)
Clip-level clip.selector?.phase (V2.1 inheritance to all migrated tracks)
3.3 UI Controls
@/electron-app/src/components/views/HephaestusView/PhaseControls.tsx:1-222

Spread slider (0–1)
Symmetry mode selector: linear, mirror, center-out
Wings count input
Direction toggle (forward/reverse)
PhaseConfig interface at types.ts:110-122:

spread: number (0–1)
symmetry: PhaseSymmetryMode
wings: number (1–N)
direction: PhaseDirection (1 or -1)
4. Export Interface — Selene IA & Chronos
4.1 Selene → Hephaestus Bridge
@/electron-app/src/core/arsenal/SeleneHephBridge.ts:1-399

Flow:



Selene DecisionMaker → ConsciousnessEffectDecision { effectType, ... }
  ↓
SeleneHephBridge.route(decision, context)
  ├─ HIT (vector)  → RegistryEntry found, executionDomain='vector'
  │   → ResolvedPlayParams → playHook (HephaestusRuntime.play)
  │   → { kind: 'hephaestus', entry, resolved, instanceId }
  │
  ├─ HIT (pixel)   → executionDomain='pixel'
  │   → ResolvedPixelParams → renderHook (AetherCanvasManager)
  │   → { kind: 'pixelmap', entry, resolved, canvasId }
  │
  └─ MISS          → { kind: 'legacy', reason }
Key contract points:

Bridge never calls EffectDreamSimulator or EffectManager directly
Bridge never touches NodeArbiter directly
On MISS, caller continues legacy path — strict retrocompatibility
Spatial silencing: If spatialBehavior='absolute' and IK target active, silenceSpatial=true — pan/tilt blocked, dimmer/color pass through
PlayHook callback: (params: ResolvedPlayParams, entry: RegistryEntry) => number (returns instanceId)
RenderHook callback: (params: ResolvedPixelParams, entry: RegistryEntry) => string | null (returns canvasId)
4.2 Hephaestus → Aether (NodeArbiter L3)
@/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:1-408

Contract:

Consumes HephFixtureOutput[] (pre-scaled DMX values from HephaestusRuntime.tick())
Emits INodeIntent[] via arbiter.setHephaestusIntents()
L3+ priority: 350 (after IntentComposer effects at 300)
Source: 'hephaestus'
Confidence: 1.0
Only processes isCustomClip === true outputs
Only processes fixtures registered in the NodeGraph
HephParamId → NodeFamily → INodeIntent.values mapping is static
WAVE 4995: _frameIntentMap consolidates multiple intents targeting the same nodeId into one INodeIntent per frame — prevents LTP color overwrites for overlapping zones
WAVE 2483: Per-frame _spatialCache maps clipId → SpatialBehavior for relative_offset routing (1 lookup per distinct clip per frame)
4.3 Chronos Integration
HephaestusRuntime.play() and playFromClip() are the entry points:

play(filePath, options) — file-based, used by Chronos triggerHeph calls. Loads from disk (cached), builds resolved tracks, starts playback.
playFromClip(clip, options) — Diamond Data path. Clip arrives inline via Chronos timeline (serialized in FXClip, deserialized by IPCHandlers). No file I/O needed.
Both return an instanceId string for tracking. stop(instanceId) and stopAll() control playback.

4.4 CognitiveDNA — The Selene Matching Contract
@/electron-app/src/core/arsenal/lfxTypes.ts:147-164



typescript
interface CognitiveDNA {
  readonly genome: FrozenGenome        // { aggression, chaos, organicity } ∈ [0,1]
  readonly textureAffinity: TextureAffinity  // 'clean' | 'dirty' | 'universal'
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange      // { min, max } — Selene thermometer
  readonly aggressionRange: Range           // { min, max } ∈ [0,1]
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility?: IKCompatibility
  readonly executionDomain?: ExecutionDomain  // 'vector' | 'pixel' | 'hybrid'
  readonly pixelHints?: PixelExecutionHints
}
Selene's SeleneTheiaAdapter._closestAtom() at SeleneTheiaAdapter.ts:218-245 computes euclidean distance in the 3D genome space (aggression, chaos, organicity) to find the best-matching effect atom. Score = 1 - distance/√3.

LfxClipInstance.toCognitiveDNA() at LfxClipInstance.ts:506-558 builds the CognitiveDNA from the ACO triad, deriving textureAffinity from archetype and energyZone from declared zones.

4.5 DynamicEffectRegistry — The Arsenal
@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:314-480

registerEffect() (V2.1) and registerEffectV3() (V3) build RegistryEntry objects
Entries are Object.freeze()d — immutable at runtime
_buildEntryFromV3() at DynamicEffectRegistry.ts:345-406 maps V3 clips to registry entries with default execHints and safetyDecl (V3 doesn't declare these)
V3 clips default to executionDomain: 'vector' (pixel domain reserved)
5. Technical Debt & Critical Typings
5.1 any Usage in Core Hephaestus
File	Line	Usage	Risk
HephaestusRuntime.ts	316	let parsed: any	JSON.parse result — unavoidable but unguarded property access
HephaestusRuntime.ts	386	const hephCurve = curve as any	V2.1 curve validation — bypasses type safety for keyframe array check
CurveEvaluator.ts	242	const isValidHSL = (v: any): v is HSL	Type guard — acceptable pattern but any in predicate
5.2 HephFileIO V3 Incompatibility
HephFileIO.saveClip() accepts only HephAutomationClip (V2). V3 clips (HephAutomationClipV3) cannot be saved. The schema constant is still 'hephaestus/v1' while the runtime accepts v2.1 and v3.0. This is a blocking debt for any V3 authoring workflow.

5.3 G2 Checksum Bypass (V3)
LfxFileLoader.ts:402-421 — checksum verification for V3 clips is commented out (WAVE 5020.5: G2 BYPASSED). The code block is dead but present. In production, corrupted or tampered V3 .lfx files will load silently.

5.4 Synchronous File I/O in Renderer
HephaestusRuntime.loadClip() uses fs.existsSync() and fs.readFileSync() — synchronous I/O in the renderer process. This blocks the UI thread on cache misses. The HephFileIO class (async, main process) exists but is not wired to the runtime's cache.

5.5 listClips() Full-File Scan
HephFileIO.listClips() at HephFileIO.ts:256-297 reads and fully JSON-parses every .lfx file to extract metadata. No metadata index, no caching of the listing. For large effect libraries (100+ clips), this will cause noticeable latency on every library refresh.

5.6 loadClip() by ID — O(N) Linear Scan
HephFileIO.loadClip(idOrPath) at HephFileIO.ts:199-224 — when given an ID (not an absolute path), it reads and parses every .lfx file sequentially until the ID matches. No index map, no early termination guarantee. Combined with the sync runtime loader, this is a double I/O penalty.

5.7 V2→V3 Migration Blend Mode Heuristic
_v2BlendModeFor() at HephaestusRuntime.ts:88-101 infers blend mode from V2's mixBus string. The mapping is heuristic:

'htp'/'max' → intensity: 'max', else 'replace'
'ambient'/'accent'/'add' → intensity: 'add', else 'replace'
Everything else → 'replace'
This is a lossy semantic migration. V2 authors who used 'global' mixBus with additive intent will get 'replace' behavior.

5.8 as any Casts in Test Code
HephaestusE2E.test.ts uses (newF as any).panFine, (newF as any).tiltFine, (newF as any).iris, (newF as any).gobo2 — indicating the FixtureState type is missing fields for panFine, tiltFine, iris, gobo2. These are real DMX parameters but not typed on the fixture state interface.

5.9 LfxFileLoader._parseAndValidateV3 — Loose Typing
LfxFileLoader.ts:424-444 assembles the V3 file with multiple as any casts:



typescript
cognitiveDNA: (clip.cognitiveDNA as any) || undefined,
simulationMeta: (clip.simulationMeta as any) || undefined,
tracks: clip.tracks as import('../hephaestus/types').HephTrack[],
The HephTrack[] cast is unchecked — the preceding validation only verifies zones and curve.keyframes are arrays, but individual keyframe objects within those arrays are not structurally validated.

5.10 Diagnostic Logging Left in Production Code
HephaestusRuntime._buildResolvedTracks() at HephaestusRuntime.ts:974-977:



typescript
const hasTungsten = fixtureIds.some(id => id === 'fixture-1781916704143')
if (hasTungsten) {
  console.log(`[HephaestusRuntime._buildResolvedTracks] 🧩 track=${t.id} ...`)
}
This is a hardcoded fixture ID diagnostic log that runs on every play() call. It should be removed or gated behind a debug flag.

5.11 TitanOrchestrator.ts.corrupt File
A file named TitanOrchestrator.ts.corrupt exists in the codebase and was matched by grep for SeleneHephBridge references. This is a stale corrupted file that should be cleaned up to avoid confusion.

Summary Matrix
Area	Status	Critical Debt
Data Storage	Fragmented across 3 layers	HephFileIO can't save V3; sync I/O in renderer; no metadata index; assetLibraryStore has no effects
Curve Engine	Solid, zero-alloc, well-tested	any in type guards; Newton-Raphson fixed at 4 iterations (no adaptive)
Phase Distribution	Clean, stateless, well-tested	None critical — design is mathematically sound
Export Contract	Functional dual-path (vector/pixel)	G2 checksum bypassed for V3; loose as any casts in V3 parsing; hardcoded fixture ID log
Typings	Mostly strict	FixtureS