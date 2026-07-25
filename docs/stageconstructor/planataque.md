HyperionView Architecture Audit — Erebus Engine V3 Compatibility
1. Sincronización Espacial y Escala (Stage Size)
✅ What's already V3-compatible
stageStore at @/stores/stageStore.ts:109 exposes stage: StageDimensions | null and already imports clampToCrystalBox, clampElevation, and snapPosition from ShowFileV2. The store is the single source of truth and is Crystal Box-aware.
VisualizerCanvas at @/components/hyperion/views/visualizer/VisualizerCanvas.tsx:410-425 consumes selectStageDimensions from stageStore and dynamically computes stageConfig (width, depth, trussHeight, gridSize, cameraDistance) from the store. Camera distance is derived from the diagonal — no hardcoded assumptions.
ZoneLayoutEngine at @/components/hyperion/shared/ZoneLayoutEngine.ts:160-219 uses relative factors (heightFactor, depthFactor, xRange, fixedX) multiplied by halfWidth/halfDepth at runtime. This is already continuous-coordinate-friendly — zones scale with any stage size.
useFixture3DData at @/components/hyperion/views/visualizer/useFixture3DData.ts:147-152 reads halfWidth/halfDepth from stageConfig passed as props, not from constants. Placed fixtures use authored position.x/y/z directly (line 188-191).
⚠️ Legacy code dependent on fixed stage dimensions
File	Lines	Issue	Severity
useFixture3DData.ts	31-32	STAGE_HALF_WIDTH = 6 / STAGE_HALF_DEPTH = 4 — hardcoded fallback constants (12m×8m). Used when stageConfig is missing (lines 147-152). In V3 with Crystal Box, there is no "default" stage size.	Medium — fallback only triggers if stageStore has no stage data, but the constants encode a V2 assumption.
VisualizerCanvas.tsx	47-49	DEFAULT_STAGE_WIDTH = 12, DEFAULT_STAGE_DEPTH = 8, DEFAULT_TRUSS_HEIGHT = 5 — same V2 fallback. Used at lines 412-414 when stageDims is null.	Medium — same issue: fallback encodes fixed dimensions. V3 should either refuse to render without stage data or use a canonical Crystal Box default.
SpatialTargetPad.tsx	94-99	DEFAULT_STAGE: StageDimensions = { width: 12, depth: 10, height: 6, gridSize: 1 } — hardcoded fallback when stageProp is not provided.	Low — only used if parent doesn't pass stage dimensions. But the default itself is a V2 assumption.
🔴 Key finding: stage: StageDimensions | null
The stageStore holds stage: StageDimensions | null (line 109). When null, the entire 3D pipeline falls back to hardcoded V2 dimensions. In V3, the Crystal Box implies a continuous coordinate system — null stage should never occur in a V3 show file. The fallback constants are dead code waiting to cause confusion.

2. Rendimiento del Pipeline 3D (11Hz vs 44Hz)
✅ The 3D render loop is NOT bottlenecked by reactive subscriptions
The architecture is correctly decoupled — this is the WAVE 2236 "DECOUPLING" pattern:

Data flow (44Hz → 3D canvas):

TickEngine at @/core/orchestrator/tick/TickEngine.ts:37 — HOT_FRAME_DIVIDER = 1 (every frame = 44Hz).
TitanOrchestrator calls onHotFrame callback at 44Hz.
useSeleneTruth.ts:209-213 — window.lux.onHotFrame listener calls injectHotFrame(hotFrame) → goes straight to transientStore.
transientStore.ts:151 — injectHotFrame() does an in-place deep merge on mutable refs. No Zustand, no React re-renders. Zero allocations on the hot path (WAVE 5034 pre-allocated _hotFrameExistingById Map).
HyperionMovingHead3D.tsx:214 and HyperionPar3D.tsx:96 — inside useFrame(), call getTransientFixture(id) which is a pure Map.get() O(1) lookup on the mutable ref. Zero React cost.
What useFixture3DData does reactively (slow path, correct):

@/useFixture3DData.ts:119-121 — subscribes to fixtures, selectedIds, overrides via Zustand. These are structural changes only (fixtures added/removed, selection, manual overrides). The useMemo at line 170 rebuilds Fixture3DData[] only when these change — not at 44Hz.
Dynamic values (color, intensity, pan, tilt, zoom) are explicitly NOT in the reactive path. They're read as a one-time snapshot at line 226 (getTransientFixture) and then live-updated in useFrame inside each 3D component.
⚠️ Minor performance observations
File	Lines	Observation	Severity
HyperionMovingHead3D.tsx	188-189	useMovementStore and useProgrammerStore selectors are reactive subscriptions outside useFrame. These are fine — they only fire on manual override changes, not per-frame.	None — correct pattern.
VisualizerCanvas.tsx	125-133	BeatTracker uses useAudioStore(state => state.onBeat) — a reactive subscription inside useFrame's parent. onBeat changes at most once per beat (~2Hz). No issue.	None.
transientStore.ts	265-280	injectHotFrame writes to useKineticHydrationStore.setState() when activeKineticPattern changes. This is throttled by value-change detection (_lastVmmPattern), so it only fires on pattern changes (~every 8 beats).	None — correctly throttled.
✅ Verdict: The 3D pipeline correctly consumes 44Hz data directly from transientStore via getTransientFixture() inside useFrame. No slow reactive subscriptions on the hot path.
3. Limpieza de Interfaz (Breathing Space)
✅ No redundant positioning controls in the main sidebar
HyperionView sidebar toggles between two modes:

controls mode → renders StageSidebar → which renders TheProgrammer (Controls tab) or GroupsPanel/SceneBrowser.
kinetics mode → renders KineticsCathedral.
TheProgrammer at @/components/hyperion/controls/TheProgrammer.tsx:302-303 delegates all control rendering to CellRouter — a dynamic cell router that renders capability-based cells. It does not directly embed positioning controls.

KineticsCathedral at @/components/hyperion/kinetics/KineticsCathedral.tsx contains pattern controls (speed, amplitude, chaos, view mode) and an "Unlock" button. No redundant positioning or fan mode controls — it operates on kinetic parameters, not spatial positioning.

⚠️ Position controls that exist but are NOT redundant
Component	Location	Purpose	Redundant with Stage Constructor?
XYPad	controls/controls/XYPad.tsx	Direct pan/tilt degree control (DMX-level)	No — Stage Constructor positions fixtures in 3D space; XYPad controls DMX pan/tilt angles. Different abstraction layer.
RadarXY	controls/controls/RadarXY.tsx	Group pan/tilt with ghost points	No — same as XYPad but for group control.
SpatialTargetPad	controls/controls/SpatialTargetPad.tsx	IK-based target positioning in meters	No — tells fixtures where to look in stage space, not where they are mounted. This is aim control, not placement.
VSlider	controls/controls/ManualPatternControls.tsx	Speed/Amplitude vertical sliders	No — kinetic pattern parameters.
✅ Fan mode controls
SpatialTargetPad (lines 506-554) contains fan mode controls (converge/line/circle + amplitude slider). These are aim fan controls, not positioning fan controls. They control how beams spread toward a target, not how fixtures are physically arranged. Not redundant with Stage Constructor.

movementStore at @/stores/movementStore.ts:170-200 holds spatialFanMode and spatialFanAmplitude — these are kinetic/aim parameters, not stage layout parameters.

✅ Verdict: No redundant positioning or fan mode controls found. The UI cleanly separates fixture placement (Stage Constructor) from fixture aiming (Programmer controls) and kinetic patterns (KineticsCathedral).
Summary of Refactor Targets
Priority	File	Issue	Action
P1	useFixture3DData.ts:31-32	Hardcoded STAGE_HALF_WIDTH=6, STAGE_HALF_DEPTH=4	Replace with V3 Crystal Box canonical default or throw if stage is null.
P1	VisualizerCanvas.tsx:47-49	Hardcoded DEFAULT_STAGE_WIDTH=12, DEFAULT_STAGE_DEPTH=8, DEFAULT_TRUSS_HEIGHT=5	Same — replace with V3 canonical default or enforce non-null stage.
P2	SpatialTargetPad.tsx:94-99	Hardcoded DEFAULT_STAGE fallback	Pass stage dimensions from stageStore at all call sites; remove fallback.
P3	stageStore.ts:109	`stage: StageDimensions	null` — nullable stage enables V2 fallbacks
No changes needed for:

3D render loop data pipeline (already correctly decoupled at 44Hz via transientStore).
UI control separation (no redundant positioning/fan controls).