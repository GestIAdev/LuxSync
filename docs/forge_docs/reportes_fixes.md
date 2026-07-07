WAVE 7122.1 — Cross-Cell Isolation
Root cause: makeInputDmxNode in compileForgeState.ts used bare ch.type as channelKey. When two cells (e.g., golden-master and wash) both had a strobe channel, the ForgeGraphCompiler inputMap collided — only the last registered wire survived. Then _accumulateForgeNodeValues in NodeResolver.ts merged all nodes' values into one flat Record<string, number>, so strobe from cell A overwrote strobe from cell B.

Fix (2 files):

compileForgeState.ts:232-252 — makeInputDmxNode now prefixes channelKey with aetherNodeId for cell-owned channels: ${cellId}:${ch.type} (e.g., golden-master:strobe). Unassigned passthrough channels keep bare ch.type.
NodeResolver.ts:780-820 — _accumulateForgeNodeValues extracts the cell suffix from the Aether nodeId (deviceId:cellSuffix), and routes values to the prefixed key when it exists in compiled.inputMap (O(1) Map.has check). Falls back to bare key for passthrough channels.
WAVE 7122.2 — DMX Base-0 Enforcement
Root cause: compileForgeState.ts:258 wrote dmxOffset: ch.index (1-based), while NodeGraphBuilder.fromChannels() and NodeExtractionPipeline._mapForgeNodes() both use ch.index - 1 (0-based). This caused a +1 channel shift in all fixtures saved via Aether Cells.

Fix: dmxOffset: ch.index - 1 in makeOutputDmxNode, plus dmxFootprint calculation and node label corrected to 0-based.

Verification: tsc --noEmit → exit 0, 0 errors.

WAVE 7122.3 — Pro-Graph Reconciliation (Bug W-2)
Root cause: syncGraphOutputsWithChannels in FixtureForgeEmbedded.tsx:182 created a new config object that only contained rack properties (channelType, channelName, defaultDmxValue, is16bit, continuousRotation, ignitionDeps). Graph-extended properties like aetherNodeId, aetherZone, cellLabel, and profileMeta were silently dropped on every save.

Fix: Changed the spread order to {...cfg, channelType, ...} — the graph node's existing config is the base, and only basic channel properties from the rack override it. ignitionDeps now falls back to cfg.ignitionDeps when the rack has none, preserving manually-set dependencies.

WAVE 7122.4 — Eliminate Double Compilation (Bug W-3)
Root cause: The local buildCompleteFixture callback synced the live forge graph at line 469, then at line 528 unconditionally called compileForgeState(state) when cells.length > 0, overwriting the synced graph with an auto-generated one. This destroyed all manual node graph edits whenever cells existed.

Fix: Changed if (state.cells.length > 0) to else if (state.cells.length > 0) — compileForgeState now only runs as a fallback when there's no live or persisted graph. The handleSave pre-check at line 555 remains as a validation-only gate (it doesn't consume the graph).

Verification: tsc --noEmit → exit 0, 0 errors.

WAVE 7122.5 — Local Ignition Dep Disambiguation (Bug W-5)
Root cause: resolveDep in compileForgeState.ts searched globally for a channel matching dep.channelType. When multiple cells had the same channel type (e.g., two dimmer channels in different cells), matches.length > 1 and auto-resolution silently failed.

Fix: resolveDep now accepts an optional localChannels parameter. When provided, it first searches within the same cell's channels. If exactly one local match exists, it auto-resolves targetChannelIndex without ambiguity. If no local match or ambiguous locally, it falls back to the global search. Both compileForgeState() and buildCompleteFixture() now build a channelToCell map and pass local channels to resolveChannelDeps.

WAVE 7122.6 — Restore Iris Type in Palette (Bug W-7)
Root cause: The iris channel type was supported by the engine but missing from FUNCTION_PALETTE in FixtureForgeEmbedded.tsx, making it impossible to assign from the UI.

Fix: Added { type: 'iris', label: 'Iris', color: '#00ddaa', icon: <Aperture size={13} /> } to the BEAM category.

Verification: tsc --noEmit → exit 0, 0 errors.


WAVE 7122.7 — Deep cloneGraph (Bug W-11)
Root cause: cloneGraph in forgeGraphStore.ts:107 did { ...graph }, which copies the top-level object but shares the nodes[] and edges[] array references. Any code that pushed to these arrays instead of replacing them would mutate the original graph.

Fix: cloneGraph now maps over nodes and edges, spreading each node (including config, inputs, outputs) and each edge. This ensures the clone is fully independent at the array level.

WAVE 7122.8 — DMX Footprint Overflow Validation (Bug W-12)
Root cause: validateState in compileForgeState.ts had no check for fixtures exceeding 512 DMX channels. A fixture with >512 channels could crash the runtime evaluator or produce invalid DMX output.

Fix: Added V6 validation that calculates the total DMX footprint (accounting for 16-bit channels occupying 2 slots) and emits a blocking DMX_FOOTPRINT_OVERFLOW error if it exceeds DMX_UNIVERSE_SIZE (512). Added the new code to the ForgeValidationCode union type.

Verification: tsc --noEmit → exit 0, 0 errors.


