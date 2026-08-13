OPERATION ROSETTA STONE — V3 Type System & DnaRail Mapping Report
1. V3 Type System & .lfx Contracts
1.1 File Format — LFXFileV3
@/electron-app/src/core/arsenal/lfxTypes.ts:316-320



typescript
interface LFXFileV3 {
  readonly $schema: 'luxsync.lfx/3.0'
  readonly clip: HephAutomationClipV3
  readonly checksum: string  // SHA-256 over JSON.stringify(clip) without pretty-print
}
The .lfx file is a JSON wrapper with a literal discriminator ($schema: 'luxsync.lfx/3.0') and a SHA-256 checksum over the non-pretty JSON of the clip. The Loader uses $schema to route to V3 parsing or V2→V3 in-memory migration.

1.2 Anatomy of HephAutomationClipV3
@/electron-app/src/core/hephaestus/types.ts:428-475

The clip is divided into 5 logical blocks:

Block A — Identity / Authoring:

id: string — UUID or deterministic slug
name: string — human-readable
author: string — creator
category: EffectCategory — 'physical' | 'color' | 'movement' | 'optics' | 'composite' (auto-inferable via inferHephCategory)
tags: string[] — free-form tags
vibeCompat: string[] — auto-synced from cognitiveDNA.compatibleVibes during serialization (serializeHephClip at line 591)
Block B — Spatial (WHERE):

spatialZones: readonly ZoneTarget[] — union of all tracks[].zones, auto-recomputed by Loader
ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers' — 9 canonical zones from ShowFileV2 + 3 helpers
Namespace separation (F3b fix): spatialZones only accepts CanonicalZone/helpers. The Loader rejects any EnergyZoneId in spatialZones.
Block C — Execution:

mixBus: 'global' | 'htp' | 'ambient' | 'accent' — inter-clip blend behavior (global=LTP takeover, htp/ambient/accent=HTP)
priority: number — stacking order
durationMs: number — clip length
effectType: string — runtime effect identifier
tracks: HephTrack[] — the multicellular heart (see below)
staticParams: Record<string, number | string | boolean> — constant scalars (never dominantColor)
Block D — Cognitive (WHEN/HOW — optional, Selene-visible only):

cognitiveDNA?: CognitiveDNA — the matching genome for Selene IA
simulationMeta?: SimulationMeta — beauty weights, GPU cost, fatigue, zScore guards
safetyDeclaration?: SafetyDeclaration — strobe safety self-report
Block E — Schema:

schemaVersion: '3.0' — literal discriminator
1.3 The Multicellular Track — HephTrack
@/electron-app/src/core/hephaestus/types.ts:348-412



typescript
interface HephTrack {
  id: string                    // UUID v4 or migrator slug
  paramId: HephParamId          // 'intensity' | 'color' | 'pan' | 'tilt' | 'zoom' | ...
  zones: readonly ZoneTarget[]  // WHERE this track applies (canonical zones)
  curve: HephCurve              // keyframes + interpolation
  dimmerScale?: number          // [0..1], only for paramId='intensity'
  colorOverride?: HSL           // constant color, supplants curve for paramId='color'
  blendMode?: BlendMode         // 'max' | 'replace' | 'add' | 'multiply'
  cell?: string                 // RESERVED v3.0 — forward-compat for multicell fixtures
  selector?: FixtureSelector    // fine-grained fixture subset (AND-intersect with zones)
  phaseConfig?: PhaseConfigPro  // grandMA3-style per-fixture phase distribution
  phaseOverrides?: PhaseOverrideMap  // manual per-fixture phase deltas
}
Key innovation: multiple tracks with the same paramId can coexist, each targeting different zones. This is multicellularity — the same parameter animated differently across spatial zones.

1.4 Keyframe & Curve Anatomy
@/electron-app/src/core/hephaestus/types.ts:218-299

HephKeyframe: timeMs, value: number | HSL, interpolation: 'hold' | 'linear' | 'bezier', bezierHandles?: [cx1, cy1, cx2, cy2], audioBinding?: HephAudioBinding
HephCurve: paramId, valueType: 'number' | 'color', range: [min, max], defaultValue, keyframes: HephKeyframe[], mode: 'absolute' | 'relative' | 'additive'
Bezier handles: After Effects style — cy can exceed [0,1] for overshoot/bounce
10 presets: linear, ease-in, ease-out, ease-in-out, overshoot, bounce, snap, smooth, sharp-in, sharp-out
1.5 CognitiveDNA — The Selene Matching Contract
@/electron-app/src/core/arsenal/lfxTypes.ts:150-169



typescript
interface CognitiveDNA {
  archetype?: UserArchetype          // 'strobe' | 'ambient' | 'heavy' | 'divine' | 'utility'
  genome: FrozenGenome               // {aggression, chaos, organicity} — readonly [0,1]
  textureAffinity: TextureAffinity   // 'clean' | 'dirty' | 'universal'
  compatibleVibes: readonly string[] // bridged vibe labels ('techno-club', 'fiesta-latina', ...)
  validSections: readonly string[]   // song sections where this clip is valid
  energyZone: EnergyZoneRange        // {min: EnergyZone, max: EnergyZone} — Selene thermometer
  aggressionRange: Range             // [min, max] — tolerance band for runtime aggression
  pressureRange: Range               // [min, max] — acoustic pressure gate
  spatialBehavior: SpatialBehavior   // 'static' | 'relative_offset' | 'absolute' | 'spatial'
  ikCompatibility?: IKCompatibility // respectsTarget, orbitAmplitude, fallbackOnNoTarget
  executionDomain?: ExecutionDomain  // 'vector' | 'pixel' | 'hybrid'
  pixelHints?: PixelExecutionHints    // resolution, blend, alphaToDimmer, etc.
}
Decoupling principle: spatialZones (in the clip body) answers WHERE fixtures receive the effect. cognitiveDNA.energyZone answers WHEN Selene should fire it (energy thermometer). cognitiveDNA.genome answers HOW aggressive/chaotic/organic the effect is. These are orthogonal axes that never mix.

1.6 SimulationMeta — DreamSimulator Contract
@/electron-app/src/core/arsenal/lfxTypes.ts:172-190

beautyWeights: {base, energyMultiplier, vibeBonus} — scoring components
gpuCost, fatigueImpact — resource budgeting
minDurationMs, cooldownMs — temporal guards
isStrobe, isDivineCandidate, isHeavyCandidate — archetype flags (auto-synced from DnaRail)
zScoreGuards: {requireRising, minimumZ, minimumEnergy} — statistical gates
1.7 SafetyDeclaration
@/electron-app/src/core/arsenal/lfxTypes.ts:200-208

maxStrobeFreqHz — 0 if non-stroboscopic
containsRapidFlash — flag for >3Hz segments
communityTrusted — false for user-created effects (safety gating)
1.8 Registry Entry (Internal Hot-Path Snapshot)
@/electron-app/src/core/arsenal/lfxTypes.ts:221-275

The RegistryEntry is a flattened, frozen snapshot of an .lfx for zero-alloc hot-path access. It denormalizes CognitiveDNA fields into flat properties (dna, textureAffinity, compatibleVibes, etc.) for O(1) lookup. Curves are not included — loaded lazily via source: LFXFileV3 | null or filePath.

Genesis-specific fields: organismId?, trialsCount?, organismStatus? — present only for evolved mutants.

1.9 Canonical Serializer
@/electron-app/src/core/hephaestus/types.ts:547-615

serializeHephClip(clip) produces a deep-cloned, JSON-ready HephAutomationClipV3 from the Immer store state. Key behavior:

Deep clones all tracks, curves, keyframes, nested objects
Auto-syncs vibeCompat from cognitiveDNA.compatibleVibes (line 591-594)
Discards ephemeral UI variables
Always stamps schemaVersion: '3.0'
2. DnaRail Component
2.1 Role & Location
@/electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx (928 lines)

DnaRail is the 260px right-side panel in the Hephaestus LabTab. It is the ** sole UI interface** for configuring CognitiveDNA and SimulationMeta on a clip. Without DNA enabled, a clip is invisible to Selene IA — DnaRail is the bridge between human-authored effects and the AI selection system.

2.2 Architecture
Props:



typescript
interface DnaRailProps {
  dna: CognitiveDNA | undefined
  simMeta: SimulationMeta | undefined
  onDnaChange: (dna: CognitiveDNA) => void
  onSimMetaChange: (meta: SimulationMeta) => void
  onEnableDna: () => void
}
Data flow:

User interacts with UI controls → mutates form: DnaFormState (local state)
useMemo derives LfxClipInstance from form via buildInstance()
useMemo runs validateClip(instance, form.aco) → LinterResult
useEffect propagates changes upstream via onDnaChange(instance.toCognitiveDNA(overrides))
Parent (LabTab) stores in clip → serializeHephClip on save → .lfx file
Anti-loop protection: isSyncingFromDna ref prevents update cycles when prop changes are echoed back. Content-based comparison via JSON.stringify prevents redundant propagations.

2.3 UI Sections (7 total)
Section 1 — Archetype Loadout:

5 pill buttons: STROBE ⚡, AMBIENT 〰, HEAVY ◆, DIVINE ✦, UTILITY ◈
Each applies ARCHETYPE_BIAS_MAP constraints immediately:
Divine: aggression ≥0.90, zones limited to intense/peak
Strobe: aggression ≥0.75, chaos ≥0.40, organicity ≤0.35, zones active/intense/peak
Heavy: aggression ≥0.70, organicity ≤0.45, zones active/intense/peak
Ambient: aggression ≤0.30, chaos ≤0.30, organicity ≥0.55, zones silence/valley/ambient/gentle
Utility: no bias, all zones allowed
Auto-syncs simMeta flags: isStrobe, isDivineCandidate, isHeavyCandidate (WAVE 7185)
Section 2 — Genome Chamber:

3D CSS cube (preserve-3d) showing A·C·O axes
Dot position on front face: x = aggression, y = 1 - chaos
Numeric readout: A/C/O values at 3 decimal precision
narrativeDescription(aco) — semantic text from inferArchetypes (e.g., "A savage, chaotic burst with mechanical precision")
Section 2.5 — Sim Guards (simulationMeta):

3 toggle switches: Strobe, Heavy, Divine (auto-synced from archetype, manually overridable)
Numeric inputs: Cooldown (ms, 0-60000), Fatigue (0-1)
Section 3 — ACO Matrix (Sliders):

3 range sliders: Aggression, Chaos, Organicity [0..1] at 0.001 precision
Bias shading: locked regions visually greyed out based on archetype constraints
Slider + numeric input dual control
semanticLabel(axis, value) shows real-time semantic tag per axis
Strobe Hz input (1-30) visible only when archetype = strobe
Section 3.5 — Texture Affinity (WAVE 7169):

3-button toggle: Clean | Universal | Dirty
Maps to CognitiveDNA.textureAffinity
Override semantics: User selection overrides LfxClipInstance.toCognitiveDNA() auto-derivation from archetype. The auto-derivation maps: strobe/heavy→dirty, ambient/divine→clean, utility→universal. User can select any value independently.
Section 4 — Energy Thermometer:

7 zone segments: SIL | VAL | AMB | GEN | ACT | INT | PEK
Multi-select (max 2 zones, WAVE 7123 Montecarlo equilibrium)
Blocked zones greyed out by archetype bias
Maps to CognitiveDNA.energyZone: {min, max} — derived from selected zone range
Section 5 — Acoustic Pressure:

Default: PERMISSIVE — NO GATE (min=0, max=0)
"+ SET RANGE" enables dual sliders: min [0..1], max [0..1]
Min ≤ Max enforced bidirectionally
Reset returns to permissive
Maps to CognitiveDNA.pressureRange
Section 6 — Vibe Compatibility:

4 checkboxes: techno-dark, latino-organic, pop-rock (disabled/soon), chill-lounge
Maps to CognitiveDNA.compatibleVibes via reverseVibeBridge() — translates Selene bridged labels back to directive labels
Serialized into clip.vibeCompat by serializeHephClip
Section 7 — Gatekeeper Linter:

Live validation via validateClip(instance, form.aco) from GatekeeperLinter
10 rule IDs: ARCHETYPE_BIAS_VIOLATION, AMBIENT_AGGRESSION_OVERFLOW, STROBE_FREQ_DANGEROUS, STROBE_FREQ_UNDECLARED, ZONE_INCOHERENT_FOR_ARCHETYPE, HEAVY_IN_LOW_ZONE, DIVINE_NOT_PEAK_ONLY, EMPTY_ENERGY_ZONES, EMPTY_VIBE_LIST, STROBE_LOW_FREQ_FOR_ARCHETYPE
Severity: info | warning | error | critical
error or critical → canSave = false → save blocked
Each warning shows seleneCorrelation (engine + rule + threshold) for "why am I seeing this?"
Expandable cards with message + engine correlation
2.4 Parameters Exposed Summary
Parameter	UI Control	Maps to	Constraints
Archetype	5 pill buttons	CognitiveDNA.archetype	Bias map clamps ACO + zones
Aggression	Slider + numeric	FrozenGenome.aggression	[0,1], archetype-bounded
Chaos	Slider + numeric	FrozenGenome.chaos	[0,1], archetype-bounded
Organicity	Slider + numeric	FrozenGenome.organicity	[0,1], archetype-bounded
Texture Affinity	3-button toggle	CognitiveDNA.textureAffinity	clean | universal | dirty
Energy Zones	7-segment thermometer	CognitiveDNA.energyZone	Max 2 zones, archetype-filtered
Acoustic Pressure	Dual slider	CognitiveDNA.pressureRange	[0,1], min ≤ max
Vibes	4 checkboxes	CognitiveDNA.compatibleVibes	Reverse-bridged to directive labels
Strobe Hz	Numeric (strobe only)	SafetyDeclaration.maxStrobeFreqHz	[1, 30]
Cooldown	Numeric	SimulationMeta.cooldownMs	[0, 60000] ms
Fatigue	Numeric	SimulationMeta.fatigueImpact	[0, 1]
Sim Flags	3 toggles	SimulationMeta.isStrobe/isDivineCandidate/isHeavyCandidate	Auto-synced + manually overridable
2.5 Supporting Modules
LfxClipInstance (@/electron-app/src/core/arsenal/LfxClipInstance.ts): Translator class between user archetypes (semantic) and cold ACO matrix. Applies bias clamping, zone intersection, vibe bridging. toCognitiveDNA(overrides) produces the final CognitiveDNA object.
GatekeeperLinter (@/electron-app/src/core/arsenal/GatekeeperLinter.ts): Pure static validator. 10 rules mapped to real Selene engines (Gatekeeper, DNAAnalyzer, EnergyConsciousness, SafetyMiddleware, EffectDreamSimulator, MoodController).
inferArchetypes (@/electron-app/src/core/arsenal/inferArchetypes.ts): Reverse-lookup from raw ACO vector to nearest UserArchetype via weighted Euclidean distance to centroids. Used by DnaRail for narrative text and by Genesis Engine for mutant labeling.
3. Cross-System Contract Summary
The V3 type system is the universal language binding all LuxSync subsystems:

Chronos (timeline): Sequences HephAutomationClipV3 instances, reads mixBus/priority for track routing
Selene IA: Consumes CognitiveDNA for effect matching, SimulationMeta for dream simulation scoring, SafetyDeclaration for safety gating
Genesis: Mutates HephAutomationClipV3 via genetic operators, stores delta_json (RFC 6902 patches), uses CognitiveDNA.genome for operator guidance, bezier_signature for speciation
Hephaestus: Authoring environment, HephTrack/HephCurve/HephKeyframe are the creative substrate, DnaRail configures the cognitive layer
Theia (under construction): Will consume the same V3 contracts for timeline composition