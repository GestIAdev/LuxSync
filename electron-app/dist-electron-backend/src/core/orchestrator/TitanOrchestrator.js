/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * WAVE 374: MASTER ARBITER INTEGRATION
 * WAVE 2030.4: HEPHAESTUS INTEGRATION
 * WAVE 2211: PIPELINE EXORCISM â€” Async Stampede Guard + IPC Throttle + GC reduction
 *
 * Orquesta Brain -> Engine -> Arbiter -> HAL pipeline.
 * main.ts se encarga de IPC handlers, este mÃ³dulo solo orquesta el flujo de datos.
 *
 * @module TitanOrchestrator
 */
import { getEventRouter } from './EventRouter';
//  WAVE 2030.19: HephaestusRuntime for .lfx execution
import { getHephaestusRuntime } from './IPCHandlers';
//  WAVE 3504.5: Extracted math + scheduling modules
import { FrameScheduler } from './scheduler/FrameScheduler';
// WAVE 3505.4: AETHER MATRIX â€” Agnostic Engine V2 Pipeline
import { NodeGraph, IntentBus, PhysicsPostProcessor } from '../aether';
// WAVE 3516.2: Adapters â€” cableado al hot-path del frame loop
import { LiquidImpactAdapter } from '../aether';
import { ChronosAetherAdapter } from '../aether/adapters/ChronosAetherAdapter';
import { HephaestusAetherAdapter } from '../aether/adapters/HephaestusAetherAdapter';
// ðŸ›ï¸ WAVE 2483: Infinite Arsenal â€” bridge wiring (playHook â†’ HephaestusRuntime.play).
import { getSeleneHephBridge } from '../arsenal/SeleneHephBridge';
// ðŸŽ¨ WAVE 4812: Aether Canvas â€” Pixel Mapping engine
import { AetherCanvasManager } from '../aether/canvas/AetherCanvasManager';
import { PixelMapAetherAdapter } from '../aether/canvas/PixelMapAetherAdapter';
// WAVE 4557: Aether Safety Middleware â€” La Aduana Aether
import { AetherSafetyMiddleware } from '../aether/egress/AetherSafetyMiddleware';
// WAVE 4559: THE MIRROR â€” Projecta estado Aether â†’ FixtureState[] legacy para la UI
import { AetherUIProjector } from '../aether/resolver/AetherUIProjector';
import { timelineEngine } from '../engine/TimelineEngine';
//  WAVE 4959 PHASE 1-3: Extracted managers
import { TacticalLogManager } from './logging/TacticalLogManager';
import { TheiaBridgeManager } from './theia/TheiaBridgeManager';
import { StateManager } from './lifecycle/StateManager';
import { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager';
//  WAVE 4960.1 PHASE 5: Hydration managers
import { FixtureHydrationEngine } from './hydration/FixtureHydrationEngine';
import { FixtureProfileResolver } from './hydration/FixtureProfileResolver';
import { StageBoundsManager } from './hydration/StageBoundsManager';
//  WAVE 4961 PHASE 6: I/O managers
import { AudioPipelineManager } from './audio/AudioPipelineManager';
import { TickEngine } from './tick/TickEngine';
import { SystemLifecycleManager } from './lifecycle/SystemLifecycleManager';
//  WAVE 2543.4: Centralized zone resolution
import { resolveZone } from '../zones/ZoneMapper';
//  WAVE 3050: MODULE-LEVEL CONSTANTS â€” allocated once, reused per frame
// Zone mapping for StageSimulator2 compatibility (was recreated per fixture * per truth broadcast)
const ZONE_MAP = {
    // Legacy canvas zones
    'FRONT_PARS': 'front',
    'BACK_PARS': 'back',
    'MOVING_LEFT': 'left',
    'MOVING_RIGHT': 'right',
    'STROBES': 'center',
    'AMBIENT': 'center',
    'FLOOR': 'front',
    'UNASSIGNED': 'center',
    // Constructor 3D zones
    'ceiling-left': 'left',
    'ceiling-right': 'right',
    'floor-front': 'front',
    'floor-back': 'back'
};
// Static DMX output placeholder (512 zeros) â€” no new Array(512).fill(0) per truth frame
const DMX_OUTPUT_ZEROS = Object.freeze(new Array(512).fill(0));
const DEFAULT_AETHER_STAGE_BOUNDS = {
    width: 8,
    height: 4,
    depth: 2,
    centerY: 1.5,
};
/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
    /**
     * Registra un dispositivo en el Motor Agnostico Aether (WAVE 3505.4).
     *
     * Llama esto en patch time para que el dispositivo sea procesado por el
     * pipeline V2. El NodeGraph y NodeResolver se configuran automÃ¡ticamente.
     * El pipeline legacy mantiene el control de todos los demÃ¡s fixtures.
     *
     * @param definition  IDeviceDefinition con nodes, calibraciÃ³n y universo DMX
     * @param forgeGraph  WAVE 4548.6: Optional ForgeNodeGraph for zero-alloc evaluation
     */
    registerAetherDevice(definition, forgeGraph) {
        this.hydrationEngine.registerAetherDevice(definition, forgeGraph);
    }
    /**
     * WAVE 4529: Expone el NodeArbiter interno para que AetherIPCHandlers
     * pueda inyectar overrides manuales L2 desde el Programmer UI.
     */
    getAetherArbiter() {
        this.hydrationEngine.ensureAetherMatrixInitialized();
        if (!this._aetherArbiter) {
            throw new Error('Aether Matrix initialization failed: NodeArbiter unavailable');
        }
        return this._aetherArbiter;
    }
    /**
     * WAVE 6020 SALVA-SHOWS: Expone el PhysicsPostProcessor para que
     * AetherIPCHandlers pueda exorcizar el estado 3D en Unlock espacial.
     */
    getPhysicsPostProcessor() {
        return this._physicsPostProcessor;
    }
    /**
     * WAVE 6020 SALVA-SHOWS: Expone el NodeGraph para que los IPC handlers
     * puedan leer estado actual de los nodos (currentPosition) al preparar
     * snapshots limpios de release fade.
     */
    getAetherNodeGraph() {
        return this._aetherGraph;
    }
    /**
     * WAVE 4699.2 M2: Resuelve los nodeIds del Tungsten para el Golden Nuke.
     * Busca el/los fixtures cuya definiciÃ³n tenga name === 'Tungsten',
     * luego devuelve un mapa de sufijo â†’ nodeId para cada nodo de flash.
     *
     * Retorna null si no hay ningÃºn Tungsten registrado en el NodeGraph.
     */
    getTungstenNodeIds() {
        const results = [];
        const deviceIds = this._aetherGraph.getDeviceIds();
        for (const deviceId of deviceIds) {
            const nodeIds = this._aetherGraph.getDeviceNodes(deviceId);
            const hasGoldenMaster = nodeIds.some(nid => nid.endsWith(':golden-master'));
            if (!hasGoldenMaster)
                continue;
            results.push({
                goldenMaster: `${deviceId}:golden-master`,
                petalL: `${deviceId}:petal-l`,
                petalC: `${deviceId}:petal-c`,
                petalR: `${deviceId}:petal-r`,
                kinetic: `${deviceId}:kinetic`,
            });
        }
        return results;
    }
    /**
     *  WAVE 4835 â€” DMX BYPASS: Habilita la inyecciÃ³n directa de 255 en los canales Golden Nuke
     */
    setGoldenNukeLock(deviceId) {
        const device = this._aetherGraph?.getDevice(deviceId);
        if (!device)
            return;
        this._goldenNukeLocks.set(deviceId, {
            universe: device.universe,
            dmxAddress: device.dmxAddress,
        });
    }
    /**
     *WAVE 4835 â€” DMX BYPASS: Deshabilita la inyecciÃ³n directa
     */
    clearGoldenNukeLock(deviceId) {
        this._goldenNukeLocks.delete(deviceId);
    }
    /**
     * Retira un dispositivo del Motor Agnostico Aether.
     *
     * @param deviceId â€” ID del dispositivo a retirar
     */
    unregisterAetherDevice(deviceId) {
        this.hydrationEngine.unregisterAetherDevice(deviceId);
    }
    createMutableProxy(...internalNames) {
        const self = this;
        const obj = {};
        for (const name of internalNames) {
            const proxyKey = name.startsWith('_') ? name.slice(1) : name;
            Object.defineProperty(obj, proxyKey, {
                get() { return self[name]; },
                set(v) { self[name] = v; },
                enumerable: true,
                configurable: true,
            });
        }
        return obj;
    }
    constructor(config = {}) {
        this.glassPool = null;
        // 👻 WAVE 5037: GHOST-HUNTER — ID único de instancia para detectar clones.
        // Si este log aparece más de una vez sin reiniciar la app, hay fugas de
        // componentes y múltiples orquestadores están emitiendo DMX simultáneamente.
        this._instanceId = `titan-${Math.random().toString(36).slice(2, 8)}`;
        this._startCount = 0;
        this.brain = null;
        this.engine = null;
        this.hal = null;
        this.trinity = null; //   WAVE 258: Trinity reference
        // WAVE 3401: OSC Nexus Provider (bidirectional OSC over UDP)
        this.oscProvider = null;
        // WAVE 3402: Native audio providers
        this.virtualWireProvider = null;
        this.usbDirectLinkProvider = null;
        // WAVE 1153: THE PACEMAKER - Heart of the rhythm system
        this.beatDetector = null;
        this.isInitialized = false;
        this.isRunning = false;
        this.cardiogramaInterval = null;
        this._glassTelemetryInterval = null;
        this.frameCount = 0;
        // WAVE 4959: Extracted managers
        this.logManager = new TacticalLogManager();
        this.stateManager = new StateManager();
        this.vibeManager = new VibeLifecycleManager(this.stateManager, this.logManager);
        // theiaManager initialized inline below (needs _aetherCanvasManager etc.)
        // ðŸ§© WAVE 4960.1: Hydration managers
        this.profileResolver = new FixtureProfileResolver();
        // âš¡ WAVE 3504.5: FRAME SCHEDULER â€” replaces bare setInterval + isProcessingFrame
        // The Stampede Guard now lives inside FrameScheduler (WAVE 2211 contract kept).
        this.scheduler = new FrameScheduler(23, () => this.processFrame());
        // ðŸ”§ DMX TIMING â€” Frame-drop protection for physical DMX timing
        // DMX512 spec: 1 frame = ~25ms (Break 88Âµs + MAB 8Âµs + 512ch Ã— 44Âµs).
        // Combined with isProcessingFrame (WAVE 2211), the 40ms loop interval
        // guarantees ~13ms of margin for the FTDI chip to drain its buffer before
        // the next frame arrives. No explicit isSendingDMX flag needed: the
        // Stampede Guard already ensures the pipeline is never re-entered.
        // WAVE 252: Real fixtures from ConfigManager (no more mocks)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.fixtures = [];
        // WAVE 2490: THE TIER SEPARATION PROTOCOL â€” Hephaestus gate
        this._licenseTier = 'FULL_SUITE';
        // WAVE 254: Control state
        this.mode = 'auto';
        this.useBrain = true;
        this.inputGain = 1.0;
        //  WAVE 560: Separated consciousness toggle (Layer 1 only)
        // useBrain = Layer 0 (reactiva) + Layer 1 (consciousness)
        // consciousnessEnabled = ONLY Layer 1 (consciousness)
        this.consciousnessEnabled = true;
        // WAVE 255: Real audio buffer from frontend
        //  WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
        //  WAVE 1162: THE BYPASS - rawBassEnergy para BeatDetector
        this.lastAudioData = {
            bass: 0, mid: 0, high: 0, energy: 0
        };
        this.hasRealAudio = false;
        this.currentLiquidLayout = '4.1';
        //  WAVE 4524.3: Last ConsciousnessOutput from the DecisionMaker
        // Se utiliza en el SeleneAetherAdapter para traducciÃ³n de efectos L3.
        // Por ahora inicializado como null; en el futuro el engine populate esto.
        this.lastConsciousnessOutput = null;
        // âš¡ WAVE 3504.5: PURE MATH MODULES â€” extracted from the monolith
        // SyncSmoother:   EMA filter bank + syncopation estimator + freewheel chain
        // Este pipeline corre EN PARALELO con el pipeline legacy (masterArbiter â†’ HAL).
        // Los devices registrados en NodeGraph son procesados por Systems â†’ Arbiter â†’
        // Resolver y sus paquetes DMX son enviados directamente via HAL.sendUniverseRaw().
        // ACTIVACIÃ“N: registerAetherDevice() activa automaticamente el pipeline.
        // Si _aetherNodeGraph estÃ¡ vacÃ­o, el bloque Aether en processFrame() es no-op.
        //
        this._aetherGraph = new NodeGraph();
        this._aetherBus = new IntentBus(4096);
        // WAVE 4663: Bus dedicado para Selene (L1). Aislado del bus L0 de los Systems.
        // Capacity 512: Selene emite dimmer+color+strobe por nodo (~50 fixtures Ã— 3 familias).
        this._seleneBus = new IntentBus(512);
        // WAVE 4705: Bus dedicado para LiveFX (L3). Autoridad sobre L2 manual.
        this._effectBus = new IntentBus(512);
        this._aetherArbiter = null;
        this._aetherResolver = null;
        // WAVE 4518.1: Physics Post-Processor â€” The Inertia Engine
        this._physicsPostProcessor = new PhysicsPostProcessor();
        this._aetherHasDevices = false;
        //  WAVE 4594: Stateless extraction pipeline â€” lazy-init, reutilizado en cada resync
        this._aetherPipeline = null;
        //  WAVE 4559: THE MIRROR â€” instancia Ãºnica, zero-alloc projection cada frame
        this._aetherUIProjector = new AetherUIProjector();
        //  WAVE 3516.2: Adapters â€” instanciados una vez, reutilizados cada frame
        this._impactAdapter = new LiquidImpactAdapter();
        //  WAVE 3516.3: ColorAdapter â€” rebautizada de LiquidColorAdapter
        this._colorAdapter = null;
        this._kineticAdapter = null;
        //  WAVE 3516.4: Optic & Elemental Bridges
        this._beamAdapter = null;
        this._atmosphereAdapter = null;
        // WAVE 4521.3: LiquidAetherAdapter â€” Capa L0 del IntentBus
        // Se instancia con el NodeGraph y el liquidEngine71 para acceder a lastFrame
        this._liquidAetherAdapter = null;
        //  WAVE 4524.3: Selene-Aether Adapter â€” Puente Cognitivo L3
        // Se instancia solo una vez. ZoneNodeRouter se construye en el constructor.
        this._zoneNodeRouter = null;
        this._seleneAetherAdapter = null;
        this._chronosAetherAdapter = new ChronosAetherAdapter(this._aetherGraph);
        // WAVE 3521: Hephaestus Diamond Data L3+ adapter
        this._hephaestusAetherAdapter = new HephaestusAetherAdapter(this._aetherGraph);
        //  WAVE 4812: Aether Canvas â€” Pixel Mapping engine (patch-time acquire, hot-path ingest)
        this._aetherCanvasManager = new AetherCanvasManager();
        this._pixelMapAdapter = new PixelMapAetherAdapter({ targetLayer: 'effect' });
        //  WAVE 4952: _plasmaRenderers map REMOVED â€” test-pattern poltergeist amputated.
        //  WAVE 5033: _theiaVideoRenderer REMOVED â€” no callers to attachTheiaRenderer, safe exorcism.
        //  WAVE 4869: SeleneTheiaBridge â€” null hasta que se llame attachSeleneTheiaBridge()
        this._seleneThetaBridge = null;
        this._timelineEngine = timelineEngine;
        // FrameContext pre-alloc â€” mutable in-place, cero alloc en hot-path
        this._aetherAudio = {
            subBass: 0, bass: 0, mid: 0, highMid: 0, presence: 0, air: 0,
            energy: 0, hasTransient: false, transientStrength: 0,
            bpm: 0, beatPhase: 0, beatCount: 0,
        };
        this._aetherMusical = {
            section: 'unknown', dropImminent: false, sectionIntensity: 0, harmonicTension: 0, sectionElapsedMs: 0,
        };
        this._aetherVibe = {
            name: 'idle',
            palette: [{ h: 0, s: 0, l: 1 }],
            movementSpeed: 0.5,
            intensity: 0.5,
            beamExpressiveness: 0.5,
        };
        this._aetherStageBounds = {
            width: DEFAULT_AETHER_STAGE_BOUNDS.width,
            height: DEFAULT_AETHER_STAGE_BOUNDS.height,
            depth: DEFAULT_AETHER_STAGE_BOUNDS.depth,
            centerY: DEFAULT_AETHER_STAGE_BOUNDS.centerY,
        };
        //  WAVE 4960.1: StageBoundsManager (needs _physicsPostProcessor + _aetherStageBounds)
        this.stageBoundsManager = new StageBoundsManager(this._aetherStageBounds, this._physicsPostProcessor);
        this._aetherCtx = {
            audio: this._aetherAudio,
            musical: this._aetherMusical,
            vibe: this._aetherVibe,
            stageBounds: this._aetherStageBounds,
            nowMs: 0,
            deltaMs: 23,
            frameIndex: 0,
        };
        //  WAVE 4557: Aether Safety Middleware â€” velocity clamp, airbag, DarkSpin, output gate, throttle
        this._aetherSafety = new AetherSafetyMiddleware();
        // WAVE 4548.6: Pre-allocated ForgeFrameContext â€” mutable in-place, zero alloc
        this._forgeAudioBands = new Float64Array(6);
        this._forgeFrameCtx = {
            timeMs: 0,
            deltaMs: 23,
            bpm: 120,
            bpmConfidence: 0,
            isBeat: false,
            energy: 0,
            audioBands: this._forgeAudioBands,
            frameIndex: 0,
        };
        // ðŸ—‘ï¸ WAVE 2211: PRE-ALLOCATED FFT BUFFER â€” GC pressure reduction
        // BEFORE: `new Array(256).fill(0)` every frame = 256 floats Ã— 30fps = 7,680 allocs/sec
        // AFTER: Single buffer reused across frames. Zero GC from FFT.
        this.EMPTY_FFT_BUFFER = Object.freeze(new Array(256).fill(0));
        // WAVE 3190: PRE-ALLOCATED HEPHAESTUS ROUTING BUFFERS â€” GC Zero Allocation
        // Eliminan los new Map() que se creaban CADA FRAME cuando hay clips activos.
        // Se limpian con .clear() al inicio del bloque Hephaestus y se reusan.
        this._hephByFixtureId = new Map();
        this._hephByZone = new Map();
        // Pool de arrays de outputs por fixture â€” se reusan across frames
        // El pool crece hasta N fixtures y nunca encoge (GC amortizado)
        this._hephOutputPool = new Map();
        //  WAVE 265: STALENESS DETECTION - Anti-SimulaciÃ³n
        // Si no llega audio fresco en AUDIO_STALENESS_THRESHOLD_MS, hasRealAudio = false
        // Esto evita que el sistema siga "animando" con datos congelados cuando el frontend muere
        this.lastAudioTimestamp = 0;
        this.AUDIO_STALENESS_THRESHOLD_MS = 500; // 500ms = medio segundo sin audio = stale
        // ðŸ“œ WAVE 1198: THE WARLOG HEARTBEAT - State tracking for tactical logs
        this.hasLoggedFirstAudio = false;
        this.lastLoggedVibe = '';
        this.lastLoggedMood = '';
        this.lastLoggedBrainState = false;
        this.warlogHeartbeatFrame = 0; // For periodic heartbeat logs
        // WAVE 255.5: Callback to broadcast fixture states to frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onBroadcast = null;
        //  WAVE 2510: Hot Frame callback â€” high-frequency fixture data at 44Hz
        // Carries ONLY dynamic fixture data (fixtures array + beat flag + frame number)
        // Separate from full SeleneTruth which broadcasts at ~7Hz
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onHotFrame = null;
        //  WAVE 2464: PEAK HOLD â€” Captura el pico de intensidad del frame skipeado.
        // El throttle frameCount % 2 hace que broadcasts salten 1 de cada 2 frames (40ms).
        // Un beat con decay de 40ms puede nacer y morir en ese frame skipeado â€” el canvas
        // nunca lo ve. SoluciÃ³n: guardar el dimmer mÃ¡ximo visto entre dos broadcasts.
        // El siguiente broadcast manda el PICO, no el valor actual.
        // RESET: tras cada broadcast, se reinicia a 0 para el siguiente ciclo.
        this.peakHoldMap = new Map(); // fixtureId â†’ peak dimmer (0-255)
        // WAVE 4590: Output gate canonical state para AetherSafety (independiente del arbiter clÃ¡sico)
        // WAVE 6015 PARCHE 2: _outputEnabled=false en boot. Cold Start Protocol — user must arm.
        this._outputEnabled = false;
        //  WAVE 4835 â€” DMX BYPASS: Golden Nuke Lock
        // Key: deviceId, Value: { universe, dmxAddress }
        // Cuando estÃ¡ presente, inyecta 255 directamente en los canales del Tungsteno
        this._goldenNukeLocks = new Map();
        /**
         * WAVE 257: Set callback for sending logs to frontend (Tactical Log)
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onLog = null;
        console.warn(`[GHOST-HUNTER] 👻 Instanciando TitanOrchestrator. ID: ${this._instanceId}`);
        this.config = {
            debug: false,
            // WAVE 255: Force IDLE on startup - system starts in blackout
            initialVibe: 'idle',
            ...config,
        };
        const hydrationCtx = Object.assign(this.createMutableProxy('_aetherGraph', '_aetherArbiter', '_aetherResolver', '_aetherPipeline', '_aetherHasDevices', '_colorAdapter', '_kineticAdapter', '_beamAdapter', '_atmosphereAdapter', '_liquidAetherAdapter', '_seleneAetherAdapter', '_zoneNodeRouter', 'hal', 'fixtures', '_outputEnabled'), {
            physicsPostProcessor: this._physicsPostProcessor,
            aetherSafety: this._aetherSafety,
            chronosAetherAdapter: this._chronosAetherAdapter,
            logManager: this.logManager,
            stateManager: this.stateManager,
            vibeManager: this.vibeManager,
            profileResolver: this.profileResolver,
            stageBoundsManager: this.stageBoundsManager,
            seleneBus: this._seleneBus,
        });
        this.hydrationEngine = new FixtureHydrationEngine(hydrationCtx);
        const self = this;
        const audioCtx = {
            get trinity() { return self.trinity; },
            get brain() { return self.brain; },
            log: (category, message, data) => self.log(category, message, data),
            getInputGain: () => self.inputGain,
        };
        this.audioPipeline = new AudioPipelineManager(audioCtx);
        this.tickEngine = new TickEngine({
            get brain() { return self.brain; },
            get engine() { return self.engine; },
            get hal() { return self.hal; },
            get trinity() { return self.trinity; },
            audioPipeline: this.audioPipeline,
            get fixtures() { return self.fixtures; },
            get onHotFrame() { return self.onHotFrame; },
            get onBroadcast() { return self.onBroadcast; },
            get _aetherHasDevices() { return self._aetherHasDevices; },
            get _aetherArbiter() { return self._aetherArbiter; },
            get _aetherResolver() { return self._aetherResolver; },
            get _colorAdapter() { return self._colorAdapter; },
            get _kineticAdapter() { return self._kineticAdapter; },
            get _beamAdapter() { return self._beamAdapter; },
            get _atmosphereAdapter() { return self._atmosphereAdapter; },
            get _liquidAetherAdapter() { return self._liquidAetherAdapter; },
            get _seleneAetherAdapter() { return self._seleneAetherAdapter; },
            get _chronosAetherAdapter() { return self._chronosAetherAdapter; },
            get _hephaestusAetherAdapter() { return self._hephaestusAetherAdapter; },
            get _aetherCanvasManager() { return self._aetherCanvasManager; },
            get _pixelMapAdapter() { return self._pixelMapAdapter; },
            get _physicsPostProcessor() { return self._physicsPostProcessor; },
            get _outputEnabled() { return self._outputEnabled; },
            get _aetherSafety() { return self._aetherSafety; },
            get _forgeFrameCtx() { return self._forgeFrameCtx; },
            get _forgeAudioBands() { return self._forgeAudioBands; },
            get _aetherUIProjector() { return self._aetherUIProjector; },
            _goldenNukeLocks: this._goldenNukeLocks,
            _aetherGraph: this._aetherGraph, _aetherBus: this._aetherBus,
            _seleneBus: this._seleneBus, _effectBus: this._effectBus,
            _impactAdapter: this._impactAdapter,
            _aetherAudio: this._aetherAudio, _aetherMusical: this._aetherMusical,
            get _aetherVibe() { return self._aetherVibe; },
            _aetherCtx: this._aetherCtx,
            _aetherStageBounds: this._aetherStageBounds,
            _hephByFixtureId: this._hephByFixtureId, _hephByZone: this._hephByZone,
            _hephOutputPool: this._hephOutputPool, peakHoldMap: this.peakHoldMap,
            _seleneThetaBridge: this._seleneThetaBridge,
            _timelineEngine: this._timelineEngine,
            EMPTY_FFT_BUFFER: this.EMPTY_FFT_BUFFER,
            oscProvider: this.oscProvider,
            _licenseTier: this._licenseTier,
            lastConsciousnessOutput: this.lastConsciousnessOutput,
            mode: this.mode, inputGain: this.inputGain, useBrain: this.useBrain,
            get glassPool() { return self.glassPool; },
            log: (category, message, data) => this.log(category, message, data),
        });
        const lifecycleCtx = Object.assign(this.createMutableProxy('brain', 'engine', 'hal', 'trinity', 'audioPipeline', 'oscProvider', 'virtualWireProvider', 'usbDirectLinkProvider', 'isInitialized', 'isRunning', 'config', 'scheduler', 'cardiogramaInterval', 'fixtures', 'beatDetector'), {
            log: (category, message, data) => this.log(category, message, data),
        });
        this.lifecycleManager = new SystemLifecycleManager(lifecycleCtx);
        this.theiaBridgeManager = new TheiaBridgeManager(this._aetherCanvasManager, this._pixelMapAdapter, this._aetherGraph, this._aetherStageBounds);
        this.vibeLifecycleManager = this.vibeManager;
        this.eventRouter = getEventRouter();
        // WAVE 4703: _outputEnabled starts false at boot â€” canonical state owned by TitanOrchestrator
        // WAVE 2098: Boot silence
        //
        //  WAVE 2483: Wire SeleneHephBridge.playHook â†’ HephaestusRuntime.play.
        // Idempotente: si el constructor corre dos veces (tests), el Ãºltimo wins.
        // Si el HephaestusRuntime aÃºn no estuviera disponible, el lookup es lazy
        // dentro del closure, asÃ­ que no hay race condition al boot.
        // 
        try {
            const bridge = getSeleneHephBridge();
            bridge.setPlayHook((resolved, _entry) => {
                if (!resolved.filePath)
                    return -1;
                //  WAVE 4913: import top-level (line 48) â€” la dependencia circular
                // ya estÃ¡ resuelta por el bundler. El require() lazy fallaba en el
                // build empaquetado porque no existe un archivo fÃ­sico ./IPCHandlers.
                const runtime = getHephaestusRuntime();
                const instanceId = runtime.play(resolved.filePath, {
                    intensity: resolved.intensity,
                    durationOverrideMs: resolved.durationMs,
                });
                return instanceId != null ? 1 : -1;
            });
            // WAVE 4952 â€” THE POLTERGEIST HUNT: PlasmaRenderer test-pattern AMPUTATED.
            //
            // ROOT CAUSE of the "ghost color flashes" (greenâ†’yellow/lighter in Front,
            // even in absolute silence, surviving every restart):
            //   1. SeleneHephBridge.route() invoked this renderHook for any clip with
            //      executionDomain='pixel', which (a) bound world samplers on the
            //      PixelMapAetherAdapter and (b) started a perpetual PlasmaRenderer â€”
            //      a demoscene Math.sin(t) rainbow generator (a "test pattern producer").
            //   2. EffectManager THEN rejects pixelmap routes (route.kind !== 'hephaestus',
            //      EffectManager.ts:455) and returns null â€” but the side-effects above
            //      were NEVER undone. Nothing ever called renderer.stop() or
            //      unbindCanvas() for plasma canvases.
            //   3. Result: the plasma front buffer was sampled every frame in the hot
            //      loop (_pixelMapAdapter.ingest) and bled time-cycling RGB into
            //      front-zone COLOR nodes at L3 (effect layer), which dominates L0/L1.
            //      Time-based (not audio-based) â†’ flashed in silence. Re-armed on EVERY
            //      boot the instant any pixel-domain clip was attempted.
            //
            // FIX: degrade pixel-domain clips to 'legacy' (return null) WITHOUT starting
            // any generative renderer or binding any canvas. route() and EffectManager
            // already handle the null/legacy path gracefully. The Theia video pipeline
            // (attachTheiaRenderer) is a SEPARATE path and is unaffected.
            const renderHook = (_resolved, _entry) => {
                return null;
            };
            bridge.setRenderHook(renderHook);
        }
        catch (err) {
            console.warn('[TitanOrchestrator ðŸ›ï¸] WAVE 2483 playHook wiring failed:', err);
        }
    }
    /**
     *WAVE 2490: Set license tier â€” DJ_FOUNDER silences Hephaestus output
     */
    setLicenseTier(tier) {
        this._licenseTier = tier;
    }
    //  WAVE 5033: attachTheiaRenderer / detachTheiaRenderer REMOVED â€”
    //  no callers, TheiaVideoRenderer field exorcised. Revive if Theia returns.
    //  WAVE 4869: SeleneTheiaBridge 
    /**
     * Conecta el SeleneTheiaBridge al pipeline de processFrame().
     * LlÃ¡malo despuÃ©s de que ThetaOrchestrator.start() haya completado.
     */
    attachSeleneTheiaBridge(bridge) { this.theiaBridgeManager.attachSeleneTheiaBridge(bridge); }
    detachSeleneTheiaBridge() { this.theiaBridgeManager.detachSeleneTheiaBridge(); }
    /**
     * Initialize all TITAN modules
     */
    async init() { await this.lifecycleManager.init(); }
    /**
     * Start the main loop
     */
    start() {
        this._startCount++;
        console.warn(`[GHOST-HUNTER] ▶️ TitanOrchestrator.start() llamado. ID: ${this._instanceId} | startCount: ${this._startCount}`);
        if (this._startCount > 1) {
            console.error(`[GHOST-HUNTER] 🔴 ALERTA DE CLON: start() invocado ${this._startCount} veces en la misma instancia. Posible fuga de lifecycle.`);
        }
        this.lifecycleManager.start();
        if (this._glassTelemetryInterval)
            clearInterval(this._glassTelemetryInterval);
        this._glassTelemetryInterval = setInterval(() => {
            if (this.glassPool) {
                const m = this.glassPool.getMetrics();
                console.log(`[GlassBridge] 🏓 Ping-Pong Status: Sent: ${m.framesSent} | Dropped: ${m.framesDropped} | In-Flight: ${m.inFlight} | PoolFree: ${m.poolFree}`);
            }
        }, 2000);
    }
    /**
     * Stop the main loop.
     *
     * ZOMBIE KILLER: antes de matar el loop, forzamos un frame de ceros
     * fÃ­sico al hardware. Sin esto, el Ãºltimo frame de luz queda "congelado"
     * en el buffer FTDI â†’ los cabezales mÃ³viles siguen recibiendo su Ãºltimo
     * comando y sus motores oscilan (micro-tug-of-war â†’ pÃ©rdida de pasos).
     *
     * Secuencia:
     *   1. Blackout lÃ³gico en el HAL (mapper + driver)
     *   2. Flush fÃ­sico del buffer a cero vÃ­a universalDMX.blackout() + sendAll()
     *   3. Espera 30ms para que el chip FTDI drene los bytes al cable RS-485
     *   4. clearInterval + isRunning = false
     */
    async stop() {
        if (this._glassTelemetryInterval) {
            clearInterval(this._glassTelemetryInterval);
            this._glassTelemetryInterval = null;
        }
        await this.lifecycleManager.stop();
    }
    /**
     * Process a single frame of the Brain -> Engine -> HAL pipeline
     * PROCESAR FRAME: El latido del universo
     *  WAVE 972: ASYNC para DNA Brain sincrÃ³nico
     *  WAVE 2211: Stampede guard delegated to FrameScheduler (WAVE 3504.5)
     */
    async processFrame() {
        await this.tickEngine.tick();
    }
    /**
     * Set the current vibe
     * WAVE 289: Propagate vibe to Workers for Vibe-Aware Section Tracking
     * WAVE 2040.3: Fixed HAL receiving legacy alias instead of normalized ID
     */
    setVibe(vibeId) {
        // WAVE 4970 FIX: Inyectar dependencias perdidas en la refactorización
        if (!this.vibeLifecycleManager['engine']) {
            this.vibeLifecycleManager.setEngine(this.engine);
            this.vibeLifecycleManager.setHal(this.hal);
            this.vibeLifecycleManager.setTrinity(this.trinity);
        }
        this._aetherVibe.name = vibeId; // Bypass sincronización local
        this.vibeLifecycleManager.setVibe(vibeId);
    }
    /**
     *  WAVE 2019.6: Force Palette Sync
     *
     * Regenera la paleta del Engine usando el color constitution del Vibe activo.
     * Usado por Chronos Timeline para sincronizar Stage color al cambiar Vibe.
     */
    forcePaletteSync() { this.vibeLifecycleManager.forcePaletteSync(); }
    /**
     * WAVE 700.5.4: Set the current mood (calm/balanced/punk)
     *
     * Mood controls effect frequency and intensity:
     * - CALM: 1-3 EPM (effects minimal, paleta respira)
     * - BALANCED: 4-6 EPM (narrativa visual)
     * - PUNK: 8-10 EPM (caos controlado)
     */
    setMood(moodId) { this.vibeLifecycleManager.setMood(moodId); }
    /**
     * ðŸŽ­ WAVE 700.5.4: Get the current mood
     */
    getMood() { return this.vibeLifecycleManager.getMood(); }
    /**
     * WAVE 2540.4: THE PHANTOM BUFFER â€” Cache pre-calculated GodEar heatmap
     * in TitanEngine for offline band lookup during timeline playback.
     */
    setChronosHeatmap(heatmap) { this.vibeLifecycleManager.setChronosHeatmap(heatmap); }
    /**
     *  WAVE 2540.5: PLAYHEAD SYNC â€” Forward Chronos playhead to TitanEngine.
     * Called every frame from the frontend during Chronos playback.
     */
    setChronosPlayhead(timeMs, isPlaying) { this.vibeLifecycleManager.setChronosPlayhead(timeMs, isPlaying); }
    /**
     * WAVE 254: Set mode (auto/manual)
     */
    setMode(mode) { this.vibeLifecycleManager.setMode(mode); }
    /**
     * WAVE 254: Enable/disable brain processing (Layer 0 + Layer 1)
     *  DEPRECATED for consciousness control - use setConsciousnessEnabled instead
     * This kills EVERYTHING (blackout) - only use for full system stop
     */
    setUseBrain(enabled) { this.vibeLifecycleManager.setUseBrain(enabled); }
    /**
     *  WAVE 560: Enable/disable consciousness ONLY (Layer 1)
     *
     * This is the CORRECT toggle for the AI switch:
     * - When OFF: Layer 0 (fÃ­sica reactiva) keeps running
     * - When ON: Layer 1 (consciousness) provides recommendations
     *
     * NO MORE BLACKOUT!
     */
    setConsciousnessEnabled(enabled) { this.vibeLifecycleManager.setConsciousnessEnabled(enabled); }
    /**
     * WAVE 2401: Set Liquid Stereo mode (7-band per-zone envelopes)
     */
    setLiquidStereo(enabled) { this.vibeLifecycleManager.setLiquidStereo(enabled); }
    /**
     * WAVE 2432: THE GREAT WIRING â€” Layout Switch (4.1 / 7.1)
     */
    setLiquidLayout(mode) { this.vibeLifecycleManager.setLiquidLayout(mode); }
    getLiquidLayout() { return this.vibeLifecycleManager.getLiquidLayout(); }
    /**
     * WAVE 560: Get consciousness state
     */
    isConsciousnessEnabled() {
        return this.consciousnessEnabled;
    }
    /**
     *  WAVE 610: FORCE STRIKE - Manual Effect Detonator
     * WAVE 2030.4: Hephaestus curve automation support
     *
     * Dispara un efecto manualmente sin esperar decisiÃ³n de HuntEngine.
     * Ãštil para testear efectos visuales sin alterar umbrales de los algoritmos.
     *
     * FLOW:
     * 1. Frontend llama window.lux.forceStrike({ effect: 'solar_flare', intensity: 1.0 })
     * 2. IPC handler llama titanOrchestrator.forceStrikeNextFrame(config)
     * 3. Este mÃ©todo llama engine's forceStrikeNextFrame(config)
     * 4. TitanEngine fuerza un trigger de EffectManager en el prÃ³ximo frame
     * 5.  WAVE 2030.4: Si config.hephCurves existe, EffectManager crea un overlay
     *
     * @param config - ForceStrikeConfig with effect, intensity, source, and optional hephCurves
     */
    forceStrikeNextFrame(config) {
        if (!this.engine) {
            console.warn('[TitanOrchestrator] ðŸ§¨ Cannot force strike - Engine not initialized');
            return;
        }
        const sourceLabel = config.source === 'chronos' ? 'CHRONOS' : 'Manual';
        const hephTag = config.hephCurves ? ` âš’ï¸[HEPH: ${config.hephCurves.curves.size}]` : '';
        console.log(`[TitanOrchestrator] ðŸ§¨ ${sourceLabel} STRIKE: ${config.effect} @ ${config.intensity.toFixed(2)}${hephTag}`);
        this.log('Effect', `ðŸ§¨ ${sourceLabel} Strike: ${config.effect}`, { intensity: config.intensity });
        // Delegar al TitanEngine
        this.engine.forceStrikeNextFrame(config);
    }
    /**
     * WAVE 254: Set input gain for audio
     */
    setInputGain(gain) {
        this.inputGain = Math.max(0, Math.min(2, gain));
        console.log(`[TitanOrchestrator] Input gain set to: ${this.inputGain}`);
    }
    /**
     * WAVE 255.5: Set callback for broadcasting truth to frontend
     * This enables StageSimulator2 to receive fixture states
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBroadcastCallback(callback) {
        this.onBroadcast = callback;
    }
    /**
     * WAVE 2510: Set callback for hot-frame broadcast (44Hz fixture data)
     * Carries only dynamic fixture data for the RenderWorker.
     * Separate from full SeleneTruth which continues at ~7Hz.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHotFrameCallback(callback) {
        this.onHotFrame = callback;
    }
    setLogCallback(callback) {
        this.onLog = callback;
    }
    /**
     * WAVE 257: Send a log entry to the frontend Tactical Log
     * @param category - Log category (Brain, Mode, Hunt, Beat, Music, Genre, Visual, DMX, System, Error, Info)
     * @param message - The log message
     * @param data - Optional additional data
     */
    log(category, message, data) {
        if (!this.onLog)
            return;
        this.onLog({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            category,
            message,
            data: data || null,
            level: category === 'Error' ? 'error' : 'info'
        });
    }
    /**
     * WAVE 255: Process incoming audio frame from frontend
     *  WAVE 1012.5: HYBRID SOURCE â€” Frontend = 30fps bass/mid/high/energy, Worker = extended FFT
     *  WAVE 3060b PHOENIX: RESTAURADO como hot-path. Frontend tiene prioridad visual.
     */
    processAudioFrame(data) {
        this.audioPipeline?.processAudioFrame(data);
    }
    /**
     * ðŸ©¸ WAVE 259: RAW VEIN - Process raw audio buffer from frontend
     * This sends the Float32Array directly to BETA Worker for real FFT analysis
     */
    processAudioBuffer(buffer) {
        this.audioPipeline?.processAudioBuffer(buffer);
    }
    /**
     * WAVE 252: Set fixtures from ConfigManager (real data, no mocks)
     * WAVE 339.6: Register movers in PhysicsDriver for real interpolated movement
     * WAVE 374: Register fixtures in MasterArbiter
     * WAVE 382: Pass FULL fixture data including capabilities and hasMovementChannels
     * WAVE 686.11: Normalize address field (ShowFileV2 uses "address", legacy uses "dmxAddress")
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFixtures(fixtures, stageBounds) {
        // WAVE 4968 FIX: Directly update this.fixtures before delegating to hydrationEngine.
        // The hydrationCtx proxy setter should also update this, but we ensure it here
        // to prevent stale fixture IDs in the truth broadcast.
        this.fixtures = fixtures.map(f => ({
            ...f,
            dmxAddress: f.dmxAddress || f.address,
            isVirtual: f.isVirtual ?? false,
        }));
        console.log(`[TitanOrchestrator] setFixtures: ${this.fixtures.length} fixtures | IDs: ${this.fixtures.slice(0, 3).map((f) => f.id).join(', ')}...`);
        return this.hydrationEngine.setFixtures(this.fixtures, stageBounds);
    }
    /**
     * WAVE 4590: Output gate canonical state for Aether pipeline.
     */
    setOutputEnabled(enabled) {
        const nextEnabled = !!enabled;
        this._outputEnabled = nextEnabled;
        // WAVE 6015 PARCHE 2: Force immediate Smart Gate re-evaluation.
        // Without this, AetherSafetyMiddleware lags 1 frame behind the toggle.
        this._aetherSafety.setOutputEnabled(nextEnabled);
    }
    /**
     * WAVE 4590: Read current output gate state consumed by AetherSafety.
     */
    isOutputEnabled() {
        return this._outputEnabled;
    }
    /**
     * WAVE 4590: Toggle output gate canonical state.
     */
    toggleOutputEnabled() {
        this._outputEnabled = !this._outputEnabled;
        return this._outputEnabled;
    }
    /**
     * WAVE 252: Get current fixtures count
     */
    getFixturesCount() {
        return this.fixtures.length;
    }
    /**
     * WAVE 4703: Fixture query API â€” replaces masterArbiter.getFixtureIds().
     * Used by TimelineEngine and HephaestusRuntime for zone resolution.
     */
    getFixtureIds() {
        return this.fixtures.map((f) => f.id);
    }
    /**
     * WAVE 4703: Zone mapping data â€” replaces masterArbiter.getFixturesForZoneMapping().
     * ðŸŒŠ WAVE 4951: Includes fixture type + capabilities for dynamic composite zone
     * resolution (all-movers, all-pars via capability, not just zone tags).
     */
    getFixturesForZoneMapping() {
        return this.fixtures.map((f) => ({
            id: f.id,
            zone: f.zone || '',
            position: f.position,
            enabled: f.enabled !== false,
            type: this.profileResolver.normalizeFixtureType(f.type),
            capabilities: f.capabilities,
        }));
    }
    /**
     * WAVE 4703: Zone ID â†’ fixture IDs resolution â€” replaces masterArbiter.getFixtureIdsByZone().
     */
    getFixtureIdsByZone(effectZone) {
        const fixtures = this.getFixturesForZoneMapping();
        const result = resolveZone(effectZone, fixtures);
        if (result.length === 0) {
            console.warn(`[TitanOrchestrator] âš ï¸ Zone "${effectZone}" matched 0 fixtures â€” falling back to wildcard`);
            return this.getFixtureIds();
        }
        return result;
    }
    /**
     * Get current state for diagnostics
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            currentVibe: this.engine?.getCurrentVibe() ?? null,
            fixturesCount: this.fixtures.length,
        };
    }
}
//  WAVE 2510: Full truth broadcast divider
// At 44Hz tick, send full SeleneTruth every TRUTH_BROADCAST_DIVIDER ticks (~7Hz)
TitanOrchestrator.TRUTH_BROADCAST_DIVIDER = 6;
// WAVE 3050: HOT FRAME BROADCAST DIVIDER
// Decouple IPC rate from DMX engine rate. DMX runs at 44Hz, UI gets hot-frames at 44Hz.
//  WAVE 4559: Overclock â€” subido de 2 (22Hz) a 1 (44Hz).
// Strobe y flash ahora llegan sin frame-skip al canvas 2D.
// transientStore + RenderWorker interpolates between frames anyway.
TitanOrchestrator.HOT_FRAME_DIVIDER = 1;
// Singleton instance
let orchestratorInstance = null;
/**
 * Get the TitanOrchestrator singleton
 * WAVE 380: Returns the registered instance (from main.ts) or creates a new one
 */
export function getTitanOrchestrator() {
    if (!orchestratorInstance) {
        console.warn('[TitanOrchestrator] âš ï¸ No instance registered, creating new one');
        orchestratorInstance = new TitanOrchestrator();
    }
    return orchestratorInstance;
}
/**
 * WAVE 380: Register an existing instance as the singleton
 * Call this from main.ts after creating the orchestrator
 * 👻 WAVE 5037: GHOST-HUNTER — log para detectar registros múltiples.
 */
export function registerTitanOrchestrator(instance) {
    if (orchestratorInstance) {
        console.error(`[GHOST-HUNTER] registerTitanOrchestrator() llamado CON INSTANCIA PREVIA. ID previo: ${orchestratorInstance._instanceId}. Nuevo ID: ${instance._instanceId}. FUGA DETECTADA.`);
    }
    if (orchestratorInstance && orchestratorInstance !== instance) {
        console.warn('[TitanOrchestrator] âš ï¸ Replacing existing singleton instance');
    }
    orchestratorInstance = instance;
}
