irect properties of this (with _ prefix stripped). The user's createMutableProxy approach for hydrationCtx passes _aetherCtx, _aetherAudio, etc. which would expose as aetherCtx, aetherAudio — but the interface expects aetherGraph, aetherArbiter, etc. The proxy keys are WRONG.

The user's manual edit was incomplete. The hydrationCtx is created but never assigned to this.hydrationEngine. And the proxy keys don't match the HydrationContext interface.

I need to:

Fix hydrationCtx with correct proxy keys
Add this.hydrationEngine = new FixtureHydrationEngine(hydrationCtx)
Add audioCtx and this.audioPipeline = new AudioPipelineManager(audioCtx)
Add tickCtx and this.tickEngine = new TickEngine(tickCtx)
Replace processAudioFrame and processAudioBuffer with one-liners
But the user said "No intentes reescribir el constructor entero ni generar contextos masivos para el TickEngine". However, the constructor IS broken — hydrationCtx has wrong keys and isn't used, audioPipeline and tickEngine are never assigned.

Let me be pragmatic. I'll:

Fix the hydrationCtx proxy keys to match HydrationContext interface
Add this.hydrationEngine = new FixtureHydrationEngine(hydrationCtx)
Add minimal audioCtx and this.audioPipeline = new AudioPipelineManager(audioCtx)
Add tickCtx using createMutableProxy (the user's preferred approach) and this.tickEngine = new TickEngine(tickCtx)
Replace processAudioFrame and processAudioBuffer with one-liners
For HydrationContext, the fields and their corresponding this properties:

aetherGraph → this._aetherGraph
aetherArbiter → this._aetherArbiter
aetherResolver → this._aetherResolver
aetherPipeline → this._aetherPipeline
aetherHasDevices → this._aetherHasDevices
physicsPostProcessor → this._physicsPostProcessor
aetherSafety → this._aetherSafety
chronosAetherAdapter → this._chronosAetherAdapter
colorAdapter → this._colorAdapter
kineticAdapter → this._kineticAdapter
beamAdapter → this._beamAdapter
atmosphereAdapter → this._atmosphereAdapter
liquidAetherAdapter → this._liquidAetherAdapter
seleneAetherAdapter → this._seleneAetherAdapter
zoneNodeRouter → this._zoneNodeRouter
hal → this.hal
logManager → this.logManager
stateManager → this.stateManager
vibeManager → this.vibeManager
fixtures → this.fixtures
profileResolver → this.profileResolver
stageBoundsManager → this.stageBoundsManager
seleneBus → this._seleneBus
So the proxy keys should be: '_aetherGraph', '_aetherArbiter', '_aetherResolver', '_aetherPipeline', '_aetherHasDevices', '_physicsPostProcessor', '_aetherSafety', '_chronosAetherAdapter', '_colorAdapter', '_kineticAdapter', '_beamAdapter', '_atmosphereAdapter', '_liquidAetherAdapter', '_seleneAetherAdapter', '_zoneNodeRouter', 'hal', 'logManager', 'stateManager', 'vibeManager', 'fixtures', 'profileResolver', 'stageBoundsManager', '_seleneBus'

For AudioPipelineContext:

trinity → this.trinity
brain → this.brain
log → this.log function
getInputGain → () => this.inputGain
For TickEngine, the context needs all those getters. Using createMutableProxy: '_aetherHasDevices', '_aetherArbiter', '_aetherResolver', '_colorAdapter', '_kineticAdapter', '_beamAdapter', '_atmosphereAdapter', '_liquidAetherAdapter', '_seleneAetherAdapter', '_chronosAetherAdapter', '_hephaestusAetherAdapter', '_aetherCanvasManager', '_pixelMapAdapter', '_theiaVideoRenderer', '_physicsPostProcessor', '_aetherSafety', '_forgeFrameCtx', '_forgeAudioBands', '_aetherUIProjector', '_goldenNukeLocks', '_aetherGraph', '_aetherBus', '_seleneBus', '_effectBus', '_impactAdapter', '_aetherAudio', '_aetherMusical', '_aetherVibe', '_aetherCtx', '_aetherStageBounds', '_hephByFixtureId', '_hephByZone', '_hephOutputPool', '_seleneThetaBridge', '_timelineEngine', 'brain', 'engine', 'hal', 'trinity', 'fixtures', 'onHotFrame', 'onBroadcast', 'peakHoldMap', 'EMPTY_FFT_BUFFER', 'oscProvider', '_licenseTier', 'lastConsciousnessOutput', 'mode', 'inputGain', 'useBrain',

Plus: log, audioPipeline

OK this is getting massive. The user said not to generate massive contexts for TickEngine. But the TickEngine needs all these fields. The alternative is to not construct TickEngine at all, but then processFrame crashes.

Actually, wait. Let me re-read what the user said: "No intentes reescribir el constructor entero ni generar contextos masivos para
