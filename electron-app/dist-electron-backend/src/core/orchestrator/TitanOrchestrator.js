/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * WAVE 374: MASTER ARBITER INTEGRATION
 * ⚒️ WAVE 2030.4: HEPHAESTUS INTEGRATION
 * 🔒 WAVE 2211: PIPELINE EXORCISM — Async Stampede Guard + IPC Throttle + GC reduction
 *
 * Orquesta Brain -> Engine -> Arbiter -> HAL pipeline.
 * main.ts se encarga de IPC handlers, este módulo solo orquesta el flujo de datos.
 *
 * @module TitanOrchestrator
 */
import { TrinityBrain } from '../../brain/TrinityBrain';
import { TitanEngine } from '../../engine/TitanEngine';
import { HardwareAbstraction } from '../../hal/HardwareAbstraction';
import { getEventRouter } from './EventRouter';
import { getTrinity } from '../../workers/TrinityOrchestrator';
import { createDefaultCognitive } from '../protocol/SeleneProtocol';
// 🧨 WAVE 635: Import EffectManager para color override global
// 🚀 WAVE 4524.3: También necesario para SCN
import { getEffectManager } from '../effects/EffectManager';
// ❤️ WAVE 1153: THE PACEMAKER - Real Beat Detection
import { BeatDetector } from '../../engine/audio/BeatDetector';
// 🎭 WAVE 700.5.4: Import MoodController for backend mood control
import { MoodController } from '../mood/MoodController';
// ⚒️ WAVE 2030.19: HephaestusRuntime for .lfx execution
import { getHephaestusRuntime } from './IPCHandlers';
// WAVE 3401: OSC Nexus Provider for bidirectional OSC over UDP
import { OSCNexusProvider } from '../audio/OSCNexusProvider';
// WAVE 3402: Native audio providers
import { VirtualWireProvider } from '../audio/VirtualWireProvider';
import { USBDirectLinkProvider } from '../audio/USBDirectLinkProvider';
// ⚡ WAVE 3504.5: Extracted math + scheduling modules
import { SyncSmoother } from './metrics/SyncSmoother';
import { IntentComposer } from './intent/IntentComposer';
import { FrameScheduler } from './scheduler/FrameScheduler';
// ⚛️ WAVE 3505.4: AETHER MATRIX — Agnostic Engine V2 Pipeline
import { NodeGraph, IntentBus, NodeArbiter, NodeResolver, PhysicsPostProcessor } from '../aether';
// WAVE 4548.6: Forge Evaluator — compiled graphs for zero-alloc DMX
import { ForgeGraphCompiler } from '../forge/compiler/ForgeGraphCompiler';
// 🌊 WAVE 3516.2: Adapters — cableado al hot-path del frame loop
import { LiquidImpactAdapter, VMMAdapter } from '../aether';
// 🎨 WAVE 3516.3: ColorAdapter — extraída a su propio archivo
// 🎨 WAVE 4522.3: Actualizado para ingesta via setIngress() (paleta RGB de SeleneLux)
import { ColorAdapter } from '../aether/adapters/ColorAdapter';
// 🔦🌫️ WAVE 3516.4: Optic & Elemental Bridges
import { BeamAdapter } from '../aether/adapters/BeamAdapter';
import { AtmosphereAdapter } from '../aether/adapters/AtmosphereAdapter';
// 🌊 WAVE 4521.3: LiquidAetherAdapter — Capa L0 del IntentBus
import { LiquidAetherAdapter } from '../aether/adapters/LiquidAetherAdapter';
import { NodeFamily } from '../aether';
// 🚀 WAVE 4524.3: Selene-Aether Adapter — Puente Cognitivo L3
import { SeleneAetherAdapter } from '../aether/adapters/selene-aether-adapter';
import { ZoneNodeRouter } from '../aether/adapters/helpers/zone-node-router';
import { ChronosAetherAdapter } from '../aether/adapters/ChronosAetherAdapter';
import { HephaestusAetherAdapter } from '../aether/adapters/HephaestusAetherAdapter';
// 🛂 WAVE 4557: Aether Safety Middleware — La Aduana Aether
import { AetherSafetyMiddleware } from '../aether/egress/AetherSafetyMiddleware';
// 🎭 WAVE 4559: THE MIRROR — Projecta estado Aether → FixtureState[] legacy para la UI
import { AetherUIProjector } from '../aether/resolver/AetherUIProjector';
// ⚡ WAVE 4594: THE AETHER AWAKENING — NodeExtractionPipeline for fixture→NodeGraph injection
import { NodeExtractionPipeline } from '../aether/ingestion/NodeExtractionPipeline';
import { resolveRuntimeFixtureDefinition } from '../library/RuntimeFixtureLibrary';
import { timelineEngine } from '../engine/TimelineEngine';
// 🧟 ZOMBIE KILLER: singleton DMX para flushing físico en stop()
import { universalDMX } from '../../hal/drivers/UniversalDMXDriver';
// ⚡ WAVE 4700: Motor cinético nativo L2 — reemplaza masterArbiter para patrones manuales
import { aetherKineticEngine } from '../aether/AetherKineticEngine';
// 🧹 WAVE 2227: VMM singleton para cleanup en stop()
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager';
// 🗺️ WAVE 2543.4: Centralized zone resolution
import { fixtureMatchesZone as zoneMapperMatch, resolveZone } from '../zones/ZoneMapper';
// ⚡ WAVE 3050: MODULE-LEVEL CONSTANTS — allocated once, reused per frame
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
// Static DMX output placeholder (512 zeros) — no new Array(512).fill(0) per truth frame
const DMX_OUTPUT_ZEROS = Object.freeze(new Array(512).fill(0));
const DEFAULT_AETHER_STAGE_BOUNDS = {
    width: 8,
    height: 4,
    depth: 2,
    centerY: 1.5,
};
/**
 * 🌊 WAVE 2432 AUTO-DETECT: Detecta el layout requerido (4.1 o 7.1) basado en los fixtures del show
 *
 * Si el show tiene PAR fixtures (zona 'front' o 'back') con split L/R (algunos x<0, otros x>0),
 * retorna '7.1' para usar LiquidEngine71. De lo contrario, retorna '4.1' para rigs compactos.
 *
 * @param fixtures - Array de fixtures del show (FixtureV2)
 * @returns '4.1' o '7.1'
 */
function detectLiquidLayoutFromFixtures(fixtures) {
    // Buscar PAR fixtures con zona 'front' o 'back' que tengan split L/R
    const frontBackPars = fixtures.filter(f => (f.zone === 'front' || f.zone === 'back') &&
        (f.type === 'par' || f.model?.toLowerCase?.().includes('par') || f.name?.toLowerCase?.().includes('par')));
    if (frontBackPars.length < 2) {
        // Menos de 2 fixtures → no hay espacio para split L/R
        return '4.1';
    }
    // Verificar si hay al menos un fixture con x < 0 y otro con x > 0 en la MISMA zona
    const byZone = {};
    for (const f of frontBackPars) {
        const zone = f.zone;
        if (!byZone[zone])
            byZone[zone] = [];
        const x = f.position?.x ?? 0;
        byZone[zone].push(x);
    }
    // Si alguna zona tiene al menos un x<-0.1 y otro x>0.1, necesita 7.1 stereo
    for (const zone in byZone) {
        const positions = byZone[zone];
        const hasLeft = positions.some(x => x < -0.1);
        const hasRight = positions.some(x => x > 0.1);
        if (hasLeft && hasRight) {
            // Split L/R detectado → necesita LiquidEngine71
            console.log(`[TitanOrchestrator] 🌊 AUTO-DETECT: Zone '${zone}' has L/R split → Layout: 7.1`);
            return '7.1';
        }
    }
    // Sin split real → 4.1
    return '4.1';
}
/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
    /**
     * Registra un dispositivo en el Motor Agnostico Aether (WAVE 3505.4).
     *
     * Llama esto en patch time para que el dispositivo sea procesado por el
     * pipeline V2. El NodeGraph y NodeResolver se configuran automáticamente.
     * El pipeline legacy mantiene el control de todos los demás fixtures.
     *
     * @param definition — IDeviceDefinition con nodes, calibración y universo DMX
     * @param forgeGraph — WAVE 4548.6: Optional ForgeNodeGraph for zero-alloc evaluation
     */
    registerAetherDevice(definition, forgeGraph) {
        this._ensureAetherMatrixInitialized();
        const resolver = this._aetherResolver;
        if (!resolver) {
            this.log('Error', '[Aether] Lazy-init failure: NodeResolver unavailable');
            return;
        }
        const nodeIds = this._aetherGraph.registerDevice(definition);
        this._chronosAetherAdapter.rebuildNodeIndex();
        resolver.registerUniverse(definition.universe);
        this._aetherHasDevices = true;
        // ⚙️ WAVE 4518.1: Registrar nodos KINETIC en el PhysicsPostProcessor
        // Iteramos los nodeIds devueltos por registerDevice para pre-alocar estado de inercia
        for (const nodeId of nodeIds) {
            const nodeData = this._aetherGraph.getNodeData(nodeId);
            if (nodeData?.family === NodeFamily.KINETIC) {
                this._physicsPostProcessor.registerNode(nodeId);
                // 🛂 WAVE 4557: Pre-allocate kinetic state in safety middleware
                this._aetherSafety.registerKineticNode(nodeId);
            }
        }
        // 🛂 WAVE 4557: Register device in safety middleware for virtual/throttle tracking
        this._aetherSafety.registerDevice(definition.deviceId, definition.universe, definition.isVirtual ?? false);
        // WAVE 4548.6: Compile ForgeNodeGraph at patch time for zero-alloc evaluation
        if (forgeGraph && forgeGraph.nodes.length > 0) {
            try {
                const compiled = ForgeGraphCompiler.compile(forgeGraph, definition.deviceId);
                resolver.registerForgeGraph(definition.deviceId, compiled);
                this.log('Info', `[Forge] Compiled graph for device ${definition.deviceId}: ${forgeGraph.nodes.length} nodes, ${compiled.program.length} instructions`);
            }
            catch (err) {
                this.log('Error', `[Forge] Failed to compile graph for device ${definition.deviceId}: ${err}`);
                // Fallback: legacy flow will handle this device
            }
        }
        this._refreshAetherMoverShieldMap();
    }
    /**
     * WAVE 4529: Expone el NodeArbiter interno para que AetherIPCHandlers
     * pueda inyectar overrides manuales L2 desde el Programmer UI.
     */
    getAetherArbiter() {
        this._ensureAetherMatrixInitialized();
        if (!this._aetherArbiter) {
            throw new Error('Aether Matrix initialization failed: NodeArbiter unavailable');
        }
        return this._aetherArbiter;
    }
    /**
     * 🌊 WAVE 4699.2 M2: Resuelve los nodeIds del Tungsten para el Golden Nuke.
     * Busca el/los fixtures cuya definición tenga name === 'Tungsten',
     * luego devuelve un mapa de sufijo → nodeId para cada nodo de flash.
     *
     * Retorna null si no hay ningún Tungsten registrado en el NodeGraph.
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
     * Retira un dispositivo del Motor Agnostico Aether.
     *
     * @param deviceId — ID del dispositivo a retirar
     */
    unregisterAetherDevice(deviceId) {
        this._aetherGraph.unregisterDevice(deviceId);
        // _aetherHasDevices permanece true si hay otros devices registrados
        // (optimización: NodeGraph.size o similar podría comprobarlo, but it's fine)
        this._refreshAetherMoverShieldMap();
    }
    _ensureAetherMatrixInitialized() {
        if (this._aetherArbiter &&
            this._aetherResolver &&
            this._colorAdapter &&
            this._kineticAdapter &&
            this._beamAdapter &&
            this._atmosphereAdapter &&
            this._liquidAetherAdapter &&
            this._seleneAetherAdapter) {
            return;
        }
        if (!this._aetherArbiter) {
            this._aetherArbiter = new NodeArbiter();
            // WAVE 4663 PASO 1: Conectar el bus L1 de Selene al Arbiter.
            // El bus es una referencia fija — se limpia y rellena cada frame.
            this._aetherArbiter.setSeleneBus(this._seleneBus);
        }
        if (!this._aetherResolver) {
            this._aetherResolver = new NodeResolver(this._aetherGraph);
            // 🛂 WAVE 4557: Wire safety middleware into resolver
            this._aetherResolver.setSafetyMiddleware(this._aetherSafety);
            // ⚡ WAVE 4611: Registrar universo 0 por defecto para que registeredUniverses
            // nunca sea vacío antes del primer _syncFixturesToAether.
            // Si los fixtures declaran otro universo, se añade dinámicamente en registerAetherDevice.
            this._aetherResolver.registerUniverse(0);
        }
        this._colorAdapter = this._colorAdapter ?? new ColorAdapter();
        this._kineticAdapter = this._kineticAdapter ?? new VMMAdapter();
        this._beamAdapter = this._beamAdapter ?? new BeamAdapter();
        this._atmosphereAdapter = this._atmosphereAdapter ?? new AtmosphereAdapter();
        this._liquidAetherAdapter = this._liquidAetherAdapter ?? new LiquidAetherAdapter(this._aetherGraph);
        // ZoneNodeRouter se construye en _syncFixturesToAether() después de que todos
        // los devices estén en el NodeGraph. Aquí solo hacemos lazy-init de emergencia
        // (primera llamada a getAetherArbiter() o registerAetherDevice() antes de sync).
        // En ese caso el router queda con caché vacío y se reconstruirá post-sync.
        if (!this._zoneNodeRouter) {
            this._zoneNodeRouter = new ZoneNodeRouter(this._aetherGraph);
        }
        this._seleneAetherAdapter = this._seleneAetherAdapter ?? new SeleneAetherAdapter(this._zoneNodeRouter);
    }
    /**
     * WAVE 4670: Precálculo patch-time del Mover Shield para L1.
     * Marca como protegidos los nodos COLOR que pertenezcan a devices con
     * nodo KINETIC absoluto (mover) y mezcla de color con rueda física.
     */
    _refreshAetherMoverShieldMap() {
        const arbiter = this._aetherArbiter;
        if (!arbiter) {
            return;
        }
        const moverDeviceIds = new Set();
        const kineticView = this._aetherGraph.getView(NodeFamily.KINETIC);
        kineticView.forEach((node) => {
            if (!node.isContinuous) {
                moverDeviceIds.add(node.deviceId);
            }
        });
        const protectedColorNodes = [];
        const colorView = this._aetherGraph.getView(NodeFamily.COLOR);
        colorView.forEach((node) => {
            const hasPhysicalWheel = node.colorWheel !== undefined || node.mixingType === 'wheel' || node.mixingType === 'hybrid';
            if (hasPhysicalWheel && moverDeviceIds.has(node.deviceId)) {
                protectedColorNodes.push(node.nodeId);
            }
        });
        arbiter.setMoverShieldNodeIds(protectedColorNodes);
    }
    constructor(config = {}) {
        this.brain = null;
        this.engine = null;
        this.hal = null;
        this.trinity = null; // 🧠 WAVE 258: Trinity reference
        // WAVE 3401: OSC Nexus Provider (bidirectional OSC over UDP)
        this.oscProvider = null;
        // WAVE 3402: Native audio providers
        this.virtualWireProvider = null;
        this.usbDirectLinkProvider = null;
        // ❤️ WAVE 1153: THE PACEMAKER - Heart of the rhythm system
        this.beatDetector = null;
        // 🔥 WAVE 2179: FREEWHEEL MEMORY — Cerebro retiene el último BPM estable del Worker
        // Cuando Worker conf=0 (break, silencio, transición), el PLL freewheela
        // en la frecuencia correcta en lugar de caer al default 120 BPM del Pacemaker.
        // Timeout: 300 frames (~5s a 60fps) → luego cede al Pacemaker interno.
        this.lastStableWorkerBpm = 0;
        this.lastStableWorkerBpmFrame = 0;
        this.FREEWHEEL_TIMEOUT_FRAMES = 125; // ~5s a 25fps
        this.isInitialized = false;
        this.isRunning = false;
        this.cardiogramaInterval = null;
        this.frameCount = 0;
        this._lastLoggedEngine = '';
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 3504.5: FRAME SCHEDULER — replaces bare setInterval + isProcessingFrame
        // The Stampede Guard now lives inside FrameScheduler (WAVE 2211 contract kept).
        // ═══════════════════════════════════════════════════════════════════════════
        this.scheduler = new FrameScheduler(23, () => this.processFrame());
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔧 DMX TIMING — Frame-drop protection for physical DMX timing
        // DMX512 spec: 1 frame = ~25ms (Break 88µs + MAB 8µs + 512ch × 44µs).
        // Combined with isProcessingFrame (WAVE 2211), the 40ms loop interval
        // guarantees ~13ms of margin for the FTDI chip to drain its buffer before
        // the next frame arrives. No explicit isSendingDMX flag needed: the
        // Stampede Guard already ensures the pipeline is never re-entered.
        // ═══════════════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════════
        // 🗑️ WAVE 2211: PRE-ALLOCATED FFT BUFFER — GC pressure reduction
        // BEFORE: `new Array(256).fill(0)` every frame = 256 floats × 30fps = 7,680 allocs/sec
        // AFTER: Single buffer reused across frames. Zero GC from FFT.
        // ═══════════════════════════════════════════════════════════════════════════
        this.EMPTY_FFT_BUFFER = Object.freeze(new Array(256).fill(0));
        // WAVE 3190: PRE-ALLOCATED HEPHAESTUS ROUTING BUFFERS — GC Zero Allocation
        // Eliminan los new Map() que se creaban CADA FRAME cuando hay clips activos.
        // Se limpian con .clear() al inicio del bloque Hephaestus y se reusan.
        this._hephByFixtureId = new Map();
        this._hephByZone = new Map();
        // Pool de arrays de outputs por fixture — se reusan across frames
        // El pool crece hasta N fixtures y nunca encoge (GC amortizado)
        this._hephOutputPool = new Map();
        // WAVE 3190: Pre-allocated EffectIntentMap — evita new Map() cada frame con effects activos
        this._effectIntentBuf = new Map();
        // WAVE 252: Real fixtures from ConfigManager (no more mocks)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.fixtures = [];
        // Vibe rotation for demo
        this.vibeSequence = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge'];
        this.currentVibeIndex = 0;
        // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — Hephaestus gate
        this._licenseTier = 'FULL_SUITE';
        // WAVE 254: Control state
        this.mode = 'auto';
        this.useBrain = true;
        this.inputGain = 1.0;
        // 🧬 WAVE 560: Separated consciousness toggle (Layer 1 only)
        // useBrain = Layer 0 (reactiva) + Layer 1 (consciousness)
        // consciousnessEnabled = ONLY Layer 1 (consciousness)
        this.consciousnessEnabled = true;
        // WAVE 255: Real audio buffer from frontend
        // 🎸 WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
        // 🔥 WAVE 1162: THE BYPASS - rawBassEnergy para BeatDetector
        this.lastAudioData = {
            bass: 0, mid: 0, high: 0, energy: 0
        };
        this.hasRealAudio = false;
        this.currentLiquidLayout = '4.1';
        // 🚀 WAVE 4524.3: Last ConsciousnessOutput from the DecisionMaker
        // Se utiliza en el SeleneAetherAdapter para traducción de efectos L3.
        // Por ahora inicializado como null; en el futuro el engine populate esto.
        this.lastConsciousnessOutput = null;
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 3504.5: PURE MATH MODULES — extracted from the monolith
        // SyncSmoother:   EMA filter bank + syncopation estimator + freewheel chain
        // IntentComposer: CombinedEffectOutput → per-fixture EffectIntentMap
        // ═══════════════════════════════════════════════════════════════════════════
        this.syncSmoother = new SyncSmoother();
        this.intentComposer = new IntentComposer();
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚛️ WAVE 3505.4: AETHER MATRIX — Agnostic Engine V2 Pipeline
        //
        // Este pipeline corre EN PARALELO con el pipeline legacy (masterArbiter → HAL).
        // Los devices registrados en NodeGraph son procesados por Systems → Arbiter →
        // Resolver y sus paquetes DMX son enviados directamente via HAL.sendUniverseRaw().
        //
        // ACTIVACIÓN: registerAetherDevice() activa automaticamente el pipeline.
        // Si _aetherNodeGraph está vacío, el bloque Aether en processFrame() es no-op.
        // ═══════════════════════════════════════════════════════════════════════════
        this._aetherGraph = new NodeGraph();
        this._aetherBus = new IntentBus(4096);
        // WAVE 4663: Bus dedicado para Selene (L1). Aislado del bus L0 de los Systems.
        // Capacity 512: Selene emite dimmer+color+strobe por nodo (~50 fixtures × 3 familias).
        this._seleneBus = new IntentBus(512);
        // WAVE 4705: Bus dedicado para LiveFX (L3). Autoridad sobre L2 manual.
        this._effectBus = new IntentBus(512);
        this._aetherArbiter = null;
        this._aetherResolver = null;
        // ⚙️ WAVE 4518.1: Physics Post-Processor — The Inertia Engine
        this._physicsPostProcessor = new PhysicsPostProcessor();
        this._aetherHasDevices = false;
        // ⚡ WAVE 4594: Stateless extraction pipeline — lazy-init, reutilizado en cada resync
        this._aetherPipeline = null;
        // � WAVE 4559: THE MIRROR — instancia única, zero-alloc projection cada frame
        this._aetherUIProjector = new AetherUIProjector();
        // �🌊 WAVE 3516.2: Adapters — instanciados una vez, reutilizados cada frame
        this._impactAdapter = new LiquidImpactAdapter();
        // 🎨 WAVE 3516.3: ColorAdapter — rebautizada de LiquidColorAdapter
        this._colorAdapter = null;
        this._kineticAdapter = null;
        // 🔦🌫️ WAVE 3516.4: Optic & Elemental Bridges
        this._beamAdapter = null;
        this._atmosphereAdapter = null;
        // 🌊 WAVE 4521.3: LiquidAetherAdapter — Capa L0 del IntentBus
        // Se instancia con el NodeGraph y el liquidEngine71 para acceder a lastFrame
        this._liquidAetherAdapter = null;
        // 🚀 WAVE 4524.3: Selene-Aether Adapter — Puente Cognitivo L3
        // Se instancia solo una vez. ZoneNodeRouter se construye en el constructor.
        this._zoneNodeRouter = null;
        this._seleneAetherAdapter = null;
        this._chronosAetherAdapter = new ChronosAetherAdapter(this._aetherGraph);
        // WAVE 3521: Hephaestus Diamond Data L3+ adapter
        this._hephaestusAetherAdapter = new HephaestusAetherAdapter(this._aetherGraph);
        this._timelineEngine = timelineEngine;
        // FrameContext pre-alloc — mutable in-place, cero alloc en hot-path
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
        this._aetherCtx = {
            audio: this._aetherAudio,
            musical: this._aetherMusical,
            vibe: this._aetherVibe,
            stageBounds: this._aetherStageBounds,
            nowMs: 0,
            deltaMs: 23,
            frameIndex: 0,
        };
        // 🛂 WAVE 4557: Aether Safety Middleware — velocity clamp, airbag, DarkSpin, output gate, throttle
        this._aetherSafety = new AetherSafetyMiddleware();
        // WAVE 4548.6: Pre-allocated ForgeFrameContext — mutable in-place, zero alloc
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
        // 🗡️ WAVE 265: STALENESS DETECTION - Anti-Simulación
        // Si no llega audio fresco en AUDIO_STALENESS_THRESHOLD_MS, hasRealAudio = false
        // Esto evita que el sistema siga "animando" con datos congelados cuando el frontend muere
        this.lastAudioTimestamp = 0;
        this.AUDIO_STALENESS_THRESHOLD_MS = 500; // 500ms = medio segundo sin audio = stale
        // 📜 WAVE 1198: THE WARLOG HEARTBEAT - State tracking for tactical logs
        this.hasLoggedFirstAudio = false;
        this.lastLoggedVibe = '';
        this.lastLoggedMood = '';
        this.lastLoggedBrainState = false;
        this.warlogHeartbeatFrame = 0; // For periodic heartbeat logs
        // WAVE 255.5: Callback to broadcast fixture states to frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onBroadcast = null;
        // ⚡ WAVE 2510: Hot Frame callback — high-frequency fixture data at 44Hz
        // Carries ONLY dynamic fixture data (fixtures array + beat flag + frame number)
        // Separate from full SeleneTruth which broadcasts at ~7Hz
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onHotFrame = null;
        // ⚡ WAVE 2464: PEAK HOLD — Captura el pico de intensidad del frame skipeado.
        // El throttle frameCount % 2 hace que broadcasts salten 1 de cada 2 frames (40ms).
        // Un beat con decay de 40ms puede nacer y morir en ese frame skipeado — el canvas
        // nunca lo ve. Solución: guardar el dimmer máximo visto entre dos broadcasts.
        // El siguiente broadcast manda el PICO, no el valor actual.
        // RESET: tras cada broadcast, se reinicia a 0 para el siguiente ciclo.
        this.peakHoldMap = new Map(); // fixtureId → peak dimmer (0-255)
        // WAVE 4590: Output gate canonical state para AetherSafety (independiente del arbiter clásico)
        this._outputEnabled = false;
        /**
         * WAVE 257: Set callback for sending logs to frontend (Tactical Log)
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onLog = null;
        /**
         * 🩸 WAVE 259: RAW VEIN - Process raw audio buffer from frontend
         * This sends the Float32Array directly to BETA Worker for real FFT analysis
         */
        this.audioBufferRejectCount = 0;
        this._audioSondaCount = 0;
        this._audioSondaTotal = 0;
        this._audioSondaStart = 0;
        this.config = {
            debug: false,
            // WAVE 255: Force IDLE on startup - system starts in blackout
            initialVibe: 'idle',
            ...config,
        };
        this.eventRouter = getEventRouter();
        // WAVE 4703: _outputEnabled starts false at boot — canonical state owned by TitanOrchestrator
        // WAVE 2098: Boot silence
    }
    /**
     * 🔒 WAVE 2490: Set license tier — DJ_FOUNDER silences Hephaestus output
     */
    setLicenseTier(tier) {
        this._licenseTier = tier;
    }
    /**
     * Initialize all TITAN modules
     */
    async init() {
        if (this.isInitialized) {
            return;
        }
        // Initialize Brain
        this.brain = new TrinityBrain();
        // Connect Brain to Trinity Orchestrator and START the neural network
        try {
            const trinity = getTrinity();
            this.trinity = trinity; // 🧠 WAVE 258: Save reference for audio feeding
            this.brain.connectToOrchestrator(trinity);
            // ═══════════════════════════════════════════════════════════════════════════
            // 🔥 WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
            // 
            // Frontend (30fps) → bass/mid/high/energy → processAudioFrame()
            // Worker (10fps) → harshness/flatness/centroid/transients → brain.on('audio-levels')
            // 
            // El Worker TAMBIÉN envía bass/mid/high, pero los IGNORAMOS aquí porque
            // el Frontend tiene mayor frecuencia (30fps vs 10fps) y da fluidez visual.
            // El Worker es autoritativo SOLO para métricas FFT extendidas.
            // ═══════════════════════════════════════════════════════════════════════════
            // ═══════════════════════════════════════════════════════════════════════════
            // 🔥 WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
            // 
            // Frontend (60fps) → bass/mid/high/energy → processAudioFrame()
            // Worker (10fps) → harshness/flatness/centroid/transients → brain.on('audio-levels')
            // 
            // Frontend tiene PRIORIDAD TEMPORAL para core bands (60fps > 10fps)
            // Worker es autoritativo SOLO para métricas FFT extendidas.
            // ═══════════════════════════════════════════════════════════════════════════
            // ⚡ WAVE 3060b PHOENIX: RESTAURADO — Frontend = core bands, Worker = extended FFT only
            this.brain.on('audio-levels', (levels) => {
                // WAVE 3416: Detect if active source is Omni (VirtualWire / USB / OSC).
                // These sources bypass the WebAudio IPC path entirely — processAudioFrame()
                // is never called, so bass/mid/high/energy would stay frozen at 0 forever.
                // When an Omni source is active, the Worker IS the only audio pipeline,
                // so we promote its bands to core authority and update lastAudioTimestamp
                // so hasRealAudio can flip true and the lighting engine reacts.
                const matrixStatus = this.trinity?.getAudioMatrix()?.getStatus();
                const activeSource = matrixStatus?.activeSource ?? null;
                const OMNI_SOURCES = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus']);
                const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false;
                if (isOmniActive) {
                    // Omni path: Worker = SOLE AUTHORITY for all bands + timestamp
                    //
                    // WAVE 3422 — EMA anti-parpadeo para bandas principales.
                    // WAVE 3504.5: delegated to SyncSmoother.smooth(raw, omniPath=true).
                    // SyncSmoother holds its own EMA state — no smoothedMetrics field here.
                    const smoothedOmni = this.syncSmoother.smooth({
                        bass: levels.bass, mid: levels.mid, high: levels.treble,
                        energy: levels.energy,
                        harshness: levels.harshness, spectralFlatness: levels.spectralFlatness,
                        spectralCentroid: levels.spectralCentroid, subBass: levels.subBass,
                        lowMid: levels.lowMid, highMid: levels.highMid, crestFactor: levels.crestFactor,
                    }, true /* omniPath */);
                    this.lastAudioData = {
                        ...this.lastAudioData,
                        bass: smoothedOmni.bass,
                        mid: smoothedOmni.mid,
                        high: smoothedOmni.high,
                        energy: smoothedOmni.energy,
                        subBass: levels.subBass ?? this.lastAudioData.subBass,
                        lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
                        highMid: levels.highMid ?? this.lastAudioData.highMid,
                        harshness: levels.harshness ?? this.lastAudioData.harshness,
                        spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
                        spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
                        crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
                        kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                        snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                        hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                        rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
                        workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
                        workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
                        workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
                        workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
                        workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
                        workerKickCount: (levels.kickCount != null && levels.kickCount > 0) ? levels.kickCount : this.lastAudioData.workerKickCount,
                        // 🔬 WAVE 3418: Raw input telemetry
                        inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
                        inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
                        // 🌊 WAVE 3516.2: El 7º Pasajero — alta frecuencia sin colapsar
                        rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
                        ultraAir: levels.ultraAir ?? this.lastAudioData.ultraAir,
                    };
                    // Update audio presence detection
                    //
                    // WAVE 3423: En el path Omni, hasRealAudio NO debe flipear por la energía
                    // del frame individual. VW entrega frames con energy≈0 durante silencios
                    // (intro, pausa entre drops) y el EMA ya se encarga de la caída gradual.
                    // Si usamos levels.energy > 0.01 como gate, cada frame de silencio flipea
                    // hasRealAudio=false → processFrame fuerza bass=0 → parpadeo epiléptico.
                    //
                    // Regla: en Omni, el primer frame activa hasRealAudio=true.
                    //        Solo el STALENESS TIMEOUT (2s) puede desactivarlo.
                    //        Esto es correcto: la fuente Omni está conectada o no lo está.
                    const wasActive = this.hasRealAudio;
                    this.hasRealAudio = true;
                    this.lastAudioTimestamp = Date.now();
                    if (!wasActive && !this.hasLoggedFirstAudio) {
                        this.hasLoggedFirstAudio = true;
                        this.log('System', `🎧 WAVE 3416: Audio LIVE via ${activeSource} — Selene is now listening!`);
                    }
                    else if (!wasActive) {
                        this.log('System', `🎧 Audio restored via ${activeSource}`);
                    }
                }
                else {
                    // 🔥 WAVE 1012.5: Worker = SPECTRAL SOURCE ONLY (frontend/WebAudio path)
                    // NO sobrescribir bass/mid/high/energy — Frontend tiene prioridad temporal (60fps)
                    // SÍ actualizar métricas FFT extendidas — Worker tiene precisión espectral
                    this.lastAudioData = {
                        ...this.lastAudioData,
                        // Core bands — IGNORADOS (Frontend es más rápido a 60fps)
                        // bass: levels.bass,     // ❌ Frontend tiene prioridad
                        // mid: levels.mid,       // ❌ Frontend tiene prioridad  
                        // high: levels.treble,   // ❌ Frontend tiene prioridad
                        // energy: levels.energy, // ❌ Frontend tiene prioridad
                        // Extended FFT metrics — WORKER AUTHORITATIVE (precisión espectral)
                        subBass: levels.subBass ?? this.lastAudioData.subBass,
                        lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
                        highMid: levels.highMid ?? this.lastAudioData.highMid,
                        harshness: levels.harshness ?? this.lastAudioData.harshness,
                        spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
                        spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
                        crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
                        // Transient detection — WORKER AUTHORITATIVE
                        kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                        snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                        hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                        // Raw bass energy — WORKER ONLY
                        rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
                        // BPM — WORKER AUTHORITATIVE (GodEarBPMTracker)
                        workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
                        workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
                        workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
                        workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
                        workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
                        workerKickCount: (levels.kickCount != null && levels.kickCount > 0)
                            ? levels.kickCount
                            : this.lastAudioData.workerKickCount,
                        // 🔬 WAVE 3418: Raw input telemetry
                        inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
                        inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
                        // 🌊 WAVE 3516.2: El 7º Pasajero — alta frecuencia sin colapsar
                        rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
                        ultraAir: levels.ultraAir ?? this.lastAudioData.ultraAir,
                    };
                } // end isOmniActive else
            });
            await trinity.start();
            // WAVE 3401: Initialize OSC Nexus Provider
            // Register with AudioMatrix for bidirectional OSC + audio input
            this.oscProvider = new OSCNexusProvider();
            const audioMatrix = trinity.getAudioMatrix();
            if (audioMatrix) {
                audioMatrix.registerProvider(this.oscProvider);
            }
            try {
                await this.oscProvider.start();
                console.log('[TitanOrchestrator] WAVE 3401: OSCNexusProvider started (UDP 9000/9001)');
            }
            catch (oscErr) {
                console.error('[TitanOrchestrator] ⚠️ OSCNexusProvider failed to start:', oscErr);
                // Non-fatal: LuxSync operates without OSC. Provider state → error, AudioMatrix falls back.
            }
            // WAVE 3402: Register native audio providers (VirtualWire + USBDirectLink)
            // initialize() detects hardware / checks addon availability — never throws
            if (audioMatrix) {
                this.virtualWireProvider = new VirtualWireProvider();
                await this.virtualWireProvider.initialize({});
                audioMatrix.registerProvider(this.virtualWireProvider);
                console.log('[TitanOrchestrator] WAVE 3402: VirtualWireProvider registered');
                this.usbDirectLinkProvider = new USBDirectLinkProvider();
                await this.usbDirectLinkProvider.initialize({});
                audioMatrix.registerProvider(this.usbDirectLinkProvider);
                console.log('[TitanOrchestrator] WAVE 3402: USBDirectLinkProvider registered');
            }
        }
        catch (e) {
            console.error('[TitanOrchestrator] ❌ Trinity startup failed:', e);
        }
        // Initialize Engine with initial vibe
        this.engine = new TitanEngine({
            debug: this.config.debug,
            initialVibe: this.config.initialVibe
        });
        this.beatDetector = new BeatDetector({
            sampleRate: 44100,
            fftSize: 2048,
            smoothingTimeConstant: 0.8,
            minBpm: 60,
            maxBpm: 200,
        });
        this.engine.on('log', (logEntry) => {
            this.log(logEntry.category, logEntry.message, logEntry.data);
        });
        this.hal = new HardwareAbstraction({
            debug: this.config.debug,
            // 🔥 WAVE: USB por defecto. Si hay externalDriver, HardwareAbstraction lo usa y este valor no estorba.
            driverType: 'usb',
            externalDriver: this.config.dmxDriver
        });
        this.isInitialized = true;
        // WAVE 2098: Boot silence — all init logs removed, unified banner in main.ts
    }
    /**
     * Start the main loop
     */
    start() {
        if (!this.isInitialized) {
            console.error('[TitanOrchestrator] Cannot start - not initialized');
            return;
        }
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        // ⚡ WAVE 3504.5: 44 Hz interval + Stampede Guard delegated to FrameScheduler
        this.scheduler.start();
        // ─────────────────────────────────────────────────────────────────
        // 🫀 OPERACIÓN CARDIOGRAMA — Event Loop Lag Monitor (Main Thread)
        // Detecta GC Stop-The-World pauses y saturación del event loop.
        // Un delta > 25ms indica que el event loop estuvo bloqueado más de
        // lo esperado — GC mayor, IPC backpressure, spin-lock, etc.
        // 5ms interval = detecta spikes con 5ms de resolución.
        // ─────────────────────────────────────────────────────────────────
        // DEBUG PROBE — Reactivar para auditoría (WAVE 3290 OJO DEL HURACÁN)
        // let _cardiogramaLastTick = performance.now()
        // let _cardiogramaPeak = 0
        // let _cardiogramaCount = 0
        // this.cardiogramaInterval = setInterval(() => {
        //   const _now = performance.now()
        //   const _delta = _now - _cardiogramaLastTick
        //   _cardiogramaLastTick = _now
        //   if (_delta > _cardiogramaPeak) _cardiogramaPeak = _delta
        //   _cardiogramaCount++
        //   // Solo loguear si supera 40ms (bloqueo GRAVE, no baseline de 15ms)
        //   // o cada 600 ticks (~5s) como heartbeat de diagnóstico
        //   if (_delta > 40) {
        //     const _msg = `🫀 HARD BLOCK ${_delta.toFixed(1)}ms — event loop frozen`
        //     console.warn(`[CARDIOGRAMA MAIN] ⚠️ ${_msg}`)
        //     this.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
        //   } else if (_cardiogramaCount % 600 === 0) {
        //     const _msg = `🫀 heartbeat — peak:${_cardiogramaPeak.toFixed(1)}ms (last 5s)`
        //     console.warn(`[CARDIOGRAMA MAIN] ${_msg}`)
        //     this.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
        //     _cardiogramaPeak = 0
        //   }
        // }, 5)
        // Relay CARDIOGRAMA del USB Worker → Tactical Log del frontend
        universalDMX.onWarning = (msg) => {
            console.warn(msg);
            this.log('Error', msg);
        };
        // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
        setTimeout(() => {
            this.log('System', '🚀 TITAN 2.0 ONLINE - Main loop started @ 44fps (WAVE 2510 hot-frame)');
            this.log('Info', `📊 Fixtures loaded: ${this.fixtures.length}`);
        }, 100);
    }
    /**
     * Stop the main loop.
     *
     * 🧟 ZOMBIE KILLER: antes de matar el loop, forzamos un frame de ceros
     * físico al hardware. Sin esto, el último frame de luz queda "congelado"
     * en el buffer FTDI → los cabezales móviles siguen recibiendo su último
     * comando y sus motores oscilan (micro-tug-of-war → pérdida de pasos).
     *
     * Secuencia:
     *   1. Blackout lógico en el HAL (mapper + driver)
     *   2. Flush físico del buffer a cero vía universalDMX.blackout() + sendAll()
     *   3. Espera 30ms para que el chip FTDI drene los bytes al cable RS-485
     *   4. clearInterval + isRunning = false
     */
    async stop() {
        // Paso 1: Blackout lógico en el HAL (si ya fue inicializado)
        if (this.hal) {
            this.hal.setBlackout(true);
        }
        // Paso 2: Forzar buffer de ceros directo al driver serial
        universalDMX.blackout();
        await universalDMX.sendAll();
        // Paso 3: Dar tiempo al chip FTDI para drenar los bytes al cable RS-485
        await new Promise(resolve => setTimeout(resolve, 30));
        // Paso 4: Ahora sí podemos matar el loop sin dejar zombis
        // WAVE 3504.5: scheduler encapsulates the interval and stampede guard
        await this.scheduler.stop();
        if (this.cardiogramaInterval) {
            clearInterval(this.cardiogramaInterval);
            this.cardiogramaInterval = null;
        }
        universalDMX.onWarning = null;
        this.isRunning = false;
        // WAVE 3401: Stop OSC Nexus Provider
        if (this.oscProvider) {
            this.oscProvider.stop();
            this.oscProvider = null;
        }
        // WAVE 3402: Stop native audio providers
        if (this.virtualWireProvider) {
            await this.virtualWireProvider.stop();
            this.virtualWireProvider = null;
        }
        if (this.usbDirectLinkProvider) {
            await this.usbDirectLinkProvider.stop();
            this.usbDirectLinkProvider = null;
        }
        // ═══════════════════════════════════════════════════════════════════
        // 🧹 WAVE 2227: REACTOR CLEANUP — Purgar estado residual
        // Sin esto, al re-armar el engine retoma desde la fase congelada:
        // VMM con acumuladores viejos, BeatDetector con BPM acumulado.
        // El resultado: saltos de posición al rearmar.
        // ═══════════════════════════════════════════════════════════════════
        // Purgar acumuladores de fase del movement engine
        vibeMovementManager.resetTime();
        // WAVE 4703: ArbitrationDirector bypased (WAVE 4592) — clearTitanState removed
        // Purgar estado acumulado del beat detector
        if (this.beatDetector) {
            this.beatDetector.reset();
        }
    }
    /**
     * Process a single frame of the Brain -> Engine -> HAL pipeline
     * 🎬 PROCESAR FRAME: El latido del universo
     * 🧬 WAVE 972: ASYNC para DNA Brain sincrónico
     * 🔒 WAVE 2211: Stampede guard delegated to FrameScheduler (WAVE 3504.5)
     */
    async processFrame() {
        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 WAVE 2211: STAMPEDE GUARD (now in FrameScheduler._onInterval())
        // The FrameScheduler skips ticks if the previous async processFrame()
        // is still running. Contract preserved — guard moved to the scheduler.
        // ═══════════════════════════════════════════════════════════════════════
        if (!this.brain || !this.engine || !this.hal)
            return;
        this.frameCount++;
        // WAVE 255: No more auto-rotation, system stays in selected vibe
        // Vibe changes only via IPC lux:setVibe
        const shouldLog = this.frameCount % 30 === 0; // Log every ~1 second
        // � WAVE 671.5: Silenced heartbeat spam (every 5s)
        // �🫁 WAVE 266: IRON LUNG - Heartbeat cada 5 segundos (150 frames @ 30fps)
        // const shouldHeartbeat = this.frameCount % 150 === 0
        // if (shouldHeartbeat) {
        //   const timeSinceLastAudio = Date.now() - this.lastAudioTimestamp
        //   console.log(`[Titan] 🫁 Heartbeat #${this.frameCount}: Audio flowing? ${this.hasRealAudio} | Last Packet: ${timeSinceLastAudio}ms ago`)
        // }
        // 1. Brain produces MusicalContext
        const context = this.brain.getCurrentContext();
        // 🗡️ WAVE 265: STALENESS DETECTION - Verificar frescura del audio
        // Si el último audio llegó hace más de AUDIO_STALENESS_THRESHOLD_MS, es stale
        // ⚡ WAVE 3050: UNIFIED FRAME TIMESTAMP — one syscall per frame, not 9
        //
        // WAVE 3423: Omni sources (VW/USB) usan threshold extendido de 2000ms.
        // VW entrega ~10fps pero el SAB puede tener gaps de 200-400ms durante
        // silencios largos (intro, pausa entre drops). Con 500ms el staleness
        // se dispara en cualquier intro silenciosa y mata las luces en plena música.
        const now = Date.now();
        const matrixStatusForStaleness = this.trinity?.getAudioMatrix()?.getStatus();
        const activeSourceForStaleness = matrixStatusForStaleness?.activeSource ?? null;
        const OMNI_SOURCES_STALENESS = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus']);
        const isOmniForStaleness = activeSourceForStaleness ? OMNI_SOURCES_STALENESS.has(activeSourceForStaleness) : false;
        const effectiveStalenessThreshold = isOmniForStaleness ? 2000 : this.AUDIO_STALENESS_THRESHOLD_MS;
        if (this.hasRealAudio && (now - this.lastAudioTimestamp) > effectiveStalenessThreshold) {
            if (shouldLog) {
                console.warn(`[TitanOrchestrator] ⚠️ AUDIO STALE - no data for ${now - this.lastAudioTimestamp}ms, switching to silence`);
            }
            this.hasRealAudio = false;
            // Reset lastAudioData para no mentir con datos viejos
            // 🎛️ WAVE 661: Incluir reset de textura espectral
            // 🎸 WAVE 1011: Incluir reset de bandas extendidas y transientes
            // 🔥 WAVE 1162.2: Incluir reset de rawBassEnergy
            this.lastAudioData = {
                bass: 0, mid: 0, high: 0, energy: 0,
                harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
                subBass: undefined, lowMid: undefined, highMid: undefined,
                kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined,
                rawBassEnergy: undefined, // 🔥 WAVE 1162.2: Reset también el bypass
                // 🔥 WAVE 2213: PRESERVAR MEMORIA DEL WORKER DURANTE EL SILENCIO
                // Sin esto: workerBpm → undefined → zombie BeatDetector → 200 BPM hardcodeado
                workerBpm: this.lastAudioData.workerBpm,
                workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
                workerOnBeat: false, // Es silencio, no hay beat activo
                workerBeatPhase: this.lastAudioData.workerBeatPhase,
                workerBeatStrength: 0,
                workerKickCount: this.lastAudioData.workerKickCount,
            };
        }
        // 2. WAVE 255: Use real audio if available, otherwise silence (IDLE mode)
        let bass, mid, high, energy;
        if (this.hasRealAudio) {
            bass = this.lastAudioData.bass * this.inputGain;
            mid = this.lastAudioData.mid * this.inputGain;
            high = this.lastAudioData.high * this.inputGain;
            energy = this.lastAudioData.energy * this.inputGain;
        }
        else {
            // Silence - system in standby
            bass = 0;
            mid = 0;
            high = 0;
            energy = 0;
        }
        // ⚡ WAVE 3504.5: Delegated to SyncSmoother — apply EMA to all FFT metrics
        // Frontend (WebAudio path): omniPath=false (bass/mid/high/energy untouched)
        // Worker (Omni path): already smoothed in brain.on('audio-levels') handler
        this.syncSmoother.smooth({
            harshness: this.lastAudioData.harshness,
            spectralFlatness: this.lastAudioData.spectralFlatness,
            spectralCentroid: this.lastAudioData.spectralCentroid,
            subBass: this.lastAudioData.subBass,
            lowMid: this.lastAudioData.lowMid,
            highMid: this.lastAudioData.highMid,
            crestFactor: this.lastAudioData.crestFactor,
            bass: 0, mid: 0, high: 0, energy: 0, // not smoothed on frontend path
        }, false /* omniPath */);
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 2112: THE RESURRECTION — Worker BPM + PLL Flywheel
        // GodEarBPMTracker in Worker is the BPM AUTHORITY (fresh FFT every ~21ms).
        // Pacemaker is DEMOTED to PLL/Flywheel only — no more kick detection here.
        // The old process() was broken: rawBassEnergy arrived at 10fps via IPC,
        // but process() ran at 60fps → same frozen value 6x → transient=0 → BPM chaos.
        // ═══════════════════════════════════════════════════════════════════════════
        let beatState = {
            bpm: 120,
            phase: 0,
            beatCount: 0,
            onBeat: false,
            confidence: 0,
            kickDetected: false,
            snareDetected: false,
            hihatDetected: false,
            // PLL defaults
            pllPhase: 0,
            pllOnBeat: false,
            predictedNextBeatTime: 0,
            phaseError: 0,
            pllLocked: false,
        };
        // 🔥 WAVE 2112: Worker BPM — the source of truth
        const workerBpm = this.lastAudioData.workerBpm ?? 0;
        const workerConfidence = this.lastAudioData.workerBpmConfidence ?? 0;
        const workerOnBeat = this.lastAudioData.workerOnBeat ?? false;
        const workerBeatPhase = this.lastAudioData.workerBeatPhase ?? 0;
        if (this.beatDetector && this.hasRealAudio) {
            // 🔥 WAVE 2112 + WAVE 2179: WORKER BPM → PLL
            // Worker con señal → setBpm() = lock real (PLL anclado a la verdad física)
            // Worker sordo pero memoria reciente → freewheelAt() = inercia correcta
            // Worker sordo Y memoria expirada → PLL cae al Pacemaker interno (120 default)
            // PunkArchytect doctrine: Worker = Oídos (honesto). Cerebro = Memoria (inerte).
            // ═══════════════════════════════════════════════════════════════════════
            if (workerBpm > 0 && workerConfidence > 0.2) {
                // 🔥 Worker activo: lock real + actualizar memoria
                this.beatDetector.setBpm(workerBpm);
                this.lastStableWorkerBpm = workerBpm;
                this.lastStableWorkerBpmFrame = this.frameCount;
            }
            else {
                // 🔥 WAVE 2179: Worker sordo → ¿tenemos memoria reciente?
                const framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame;
                if (this.lastStableWorkerBpm > 0 && framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES) {
                    // FREEWHEEL: PLL gira en la frecuencia real, no en 120 BPM
                    this.beatDetector.freewheelAt(this.lastStableWorkerBpm);
                }
                // Si el timeout expiró → sin freewheelAt(), PLL se suelta al Pacemaker interno
            }
            // PLL Flywheel: advances phase continuously for smooth beat prediction
            beatState = this.beatDetector.tick(now); // ⚡ WAVE 3050: unified timestamp
            // Override onBeat with Worker's real detection (PLL can predict, but Worker detects)
            if (workerOnBeat) {
                beatState.onBeat = true;
                beatState.kickDetected = true;
            }
            if (this.frameCount % 60 === 0) {
                const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL';
                const syncInfo = this.syncSmoother.currentSyncopation.toFixed(2);
                const _framesSinceLog = this.frameCount - this.lastStableWorkerBpmFrame;
                const freewheelTag = (!beatState.pllLocked && this.lastStableWorkerBpm > 0 && _framesSinceLog <= this.FREEWHEEL_TIMEOUT_FRAMES)
                    ? ` [mem=${this.lastStableWorkerBpm.toFixed(0)}@-${_framesSinceLog}f]`
                    : '';
                const rawEnergy = (this.lastAudioData.rawBassEnergy ?? 0).toFixed(4);
                const sabFill = this.trinity?.getAudioMatrix()?.getStatus()?.ringBufferFillLevel?.toFixed(3) ?? 'n/a';
                // 🔬 WAVE 3418: Peak/RMS del buffer crudo que llega al Worker
                const inputPeak = (this.lastAudioData.inputPeakAbs ?? 0).toFixed(5);
                const inputRms = (this.lastAudioData.inputRMS ?? 0).toFixed(5);
                console.log(`[TitanOrchestrator] 🎧 WORKER BPM=${workerBpm.toFixed(0)} conf=${workerConfidence.toFixed(2)} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.lastAudioData.workerKickCount ?? 0} | bass=${rawEnergy} sab=${sabFill} | 🔬in_peak=${inputPeak} in_rms=${inputRms}`);
            }
        }
        else if (this.beatDetector) {
            // WAVE 2090.3: THE FLYWHEEL - tick even without audio
            // The metronome keeps spinning on inertia (freewheel mode)
            beatState = this.beatDetector.tick(now); // ⚡ WAVE 3050: unified timestamp
        }
        // ═══════════════════════════════════════════════════════════════════════════
        //  WAVE 2112: BRIDGE REVERSED — Worker no longer needs SET_BPM
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 rBPM INJECTION — cadena de prioridad con freewheel memory (WAVE 2179)
        // ═══════════════════════════════════════════════════════════════════════════
        // Priority chain:
        //   1. Worker activo (conf > 0.2)         → BPM del Worker (verdad física)
        //   2. Worker sordo + memoria reciente    → último BPM estable (inercia)
        //   3. Sin memoria / timeout expirado     → Pacemaker interno (último recurso)
        // ═══════════════════════════════════════════════════════════════════════════
        const _framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame;
        const hasFreewheelMemory = this.lastStableWorkerBpm > 0 && _framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES;
        if (workerBpm > 0 && workerConfidence > 0.2) {
            // Priority 1: Worker activo
            context.bpm = workerBpm;
            context.beatPhase = beatState.pllLocked
                ? (beatState.pllPhase ?? beatState.phase)
                : workerBeatPhase;
            context.syncopation = this.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid);
        }
        else if (hasFreewheelMemory) {
            // 🔥 WAVE 2179: Priority 2 — FREEWHEEL MEMORY
            // Las luces no se enteran del break. El show continúa en el BPM real.
            context.bpm = this.lastStableWorkerBpm;
            context.beatPhase = beatState.pllPhase ?? beatState.phase;
            context.syncopation = this.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid);
        }
        else if (beatState.bpm > 0 && beatState.confidence > 0) {
            // Priority 3: Pacemaker interno (cuando no hay ningún recuerdo del Worker)
            context.bpm = beatState.bpm;
            context.beatPhase = beatState.pllPhase ?? beatState.phase;
            context.syncopation = this.syncSmoother.estimateSyncopation(beatState.pllPhase ?? beatState.phase, bass, mid);
        }
        // For TitanEngine
        // 🎛️ WAVE 661: Incluir textura espectral
        // 🎸 WAVE 1011.5: Usar métricas SUAVIZADAS (no crudas) para evitar parpadeo
        // ❤️ WAVE 1153: beatPhase/isBeat/beatCount FROM REAL PACEMAKER
        // � WAVE 2112: THE RESURRECTION — Worker BPM + PLL phase + Worker transients
        const engineAudioMetrics = {
            bass, // Ya normalizado por AGC - INTOCABLE
            mid, // Ya normalizado por AGC - INTOCABLE
            high, // Ya normalizado por AGC - INTOCABLE
            energy, // Ya normalizado por AGC - INTOCABLE
            // 🔥 WAVE 2112: BPM from Worker (authority), phase from PLL (smooth prediction)
            beatPhase: beatState.pllLocked ? (beatState.pllPhase ?? beatState.phase) : workerBeatPhase,
            // 🛡️ WAVE 2512 FIX 3: IBeat Silence Guard
            // PLL onBeat only propagates as isBeat if the PLL is locked (has real evidence).
            // Redundancy layer: FIX 1 already silences beatState.onBeat in freewheel,
            // but this guard ensures the merge logic itself is architecturally correct.
            isBeat: workerOnBeat || (beatState.pllLocked && beatState.onBeat),
            // 🥁 WAVE 2213: beatCount RECONNECTED — Worker kickCount is the real monotonic counter.
            // beatState.beatCount (PLL) was always 0 because process() was retired in WAVE 2112.
            // The Worker's IntervalBPMTracker.totalKicks is the only real beat counter alive.
            beatCount: this.lastAudioData.workerKickCount ?? beatState.beatCount,
            bpm: workerBpm > 0 ? workerBpm : beatState.bpm,
            beatConfidence: workerConfidence > 0 ? workerConfidence : beatState.confidence,
            // 🌊 WAVE 1011.5: Métricas FFT SUAVIZADAS (WAVE 3504.5: via SyncSmoother)
            harshness: this.syncSmoother.currentSmoothed.harshness,
            spectralFlatness: this.syncSmoother.currentSmoothed.spectralFlatness,
            spectralCentroid: this.syncSmoother.currentSmoothed.spectralCentroid,
            // 💥 WAVE 2352: crestFactor RAW para physics engines - los transitorios de kick NO se suavizan
            // El EMA destruye el pico que diferencia un bombo de un rolling bass
            crestFactor: this.lastAudioData.crestFactor ?? this.syncSmoother.currentSmoothed.crestFactor,
            // 🎸 WAVE 1011.5: Bandas extendidas SUAVIZADAS
            subBass: this.syncSmoother.currentSmoothed.subBass,
            lowMid: this.syncSmoother.currentSmoothed.lowMid,
            highMid: this.syncSmoother.currentSmoothed.highMid,
            // 🔥 WAVE 2112: Transients from Worker (fresh FFT) — Pacemaker no longer detects kicks
            // 🛡️ WAVE 2512 FIX 2: Kick Signal Veto in Freewheel
            // kickDetected only fires if Worker directly detected OR PLL has a real lock.
            // Prevents phantom Pacemaker kicks from polluting physics engines (LiquidEngineBase isKick).
            kickDetected: workerOnBeat || (beatState.pllLocked && this.lastAudioData.kickDetected),
            snareDetected: this.lastAudioData.snareDetected,
            hihatDetected: this.lastAudioData.hihatDetected,
            // ⏱️ WAVE 2305: THE INFALLIBLE METRONOME — PLL beat prediction
            isPLLBeat: beatState.pllOnBeat,
        };
        // For HAL
        // 🎵 WAVE 2211: Inject REAL beatPhase + BPM from PLL/Worker
        // BEFORE: HAL calculated its own fake beatPhase from hardcoded 120 BPM
        // → optics pulsed at constant 2Hz regardless of actual music tempo
        // → chill-lounge got rock-speed focus punches
        // AFTER: Real PLL phase flows from Worker → Pacemaker → here → HAL
        const halBeatPhase = beatState.pllLocked
            ? (beatState.pllPhase ?? beatState.phase)
            : workerBeatPhase;
        const halBpm = workerBpm > 0 ? workerBpm : beatState.bpm;
        const halAudioMetrics = {
            rawBass: bass,
            rawMid: mid,
            rawTreble: high,
            energy,
            isRealSilence: false,
            isAGCTrap: false,
            beatPhase: halBeatPhase,
            bpm: halBpm,
            // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — Propagar bpmConfidence al HAL
            // para que HarmonicQuantizer funcione universalmente en translateColorToWheel()
            bpmConfidence: this.lastAudioData?.workerBpmConfidence ?? 0,
        };
        // 3. Engine processes context -> produces LightingIntent (🧬 DNA Brain now awaited)
        const intent = await this.engine.update(context, engineAudioMetrics);
        // ═══════════════════════════════════════════════════════════════════════
        // 🪓 WAVE 4592 → WAVE 4703: AETHER PIPELINE ONLY
        // ArbitrationDirector (masterArbiter) is extinct. Aether is the single source of truth.
        // ═══════════════════════════════════════════════════════════════════════
        const effectManager = getEffectManager();
        const effectOutput = effectManager.getCombinedOutput();
        // Chronos protection: fixtures being painted by Chronos are off-limits
        const playbackFrame = this._timelineEngine.getLastPlaybackFrame();
        const chronosFixtureIds = new Set((playbackFrame?.targets ?? []).map(t => t.fixtureId));
        // ═══════════════════════════════════════════════════════════════════════
        // 🔎 FORENSIC TRACE (CP2): Aether → HAL handoff snapshot
        // Enabled via env: LUXSYNC_TRACE_DMX=1 (optional LUXSYNC_TRACE_DMX_EVERY)
        // Optional focus: LUXSYNC_TRACE_FIXTURE_ID=<fixtureId>
        // ═══════════════════════════════════════════════════════════════════════
        try {
            const traceEnabled = String(process?.env?.LUXSYNC_TRACE_DMX ?? '') === '1';
            if (traceEnabled) {
                const everyRaw = Number.parseInt(String(process?.env?.LUXSYNC_TRACE_DMX_EVERY ?? ''), 10);
                const every = Number.isFinite(everyRaw) && everyRaw > 0 ? everyRaw : 60;
                if (this.frameCount % every === 0) {
                    // Trace CP2: Aether pipeline snapshot — no arbitratedTarget (WAVE 4703)
                }
            }
        }
        catch {
            // never block the render loop
        }
        // 📜 WAVE 1198: WARLOG HEARTBEAT - Periodic status every ~4 seconds (240 frames at 60fps)
        // 🎛️ WAVE 1198.8: De 120 a 240 frames para reducir spam
        this.warlogHeartbeatFrame++;
        if (this.warlogHeartbeatFrame >= 240) {
            this.warlogHeartbeatFrame = 0;
            const currentVibe = this.engine.getCurrentVibe();
            const brainEnabled = this.useBrain;
            const audioStatus = this.hasRealAudio ? 'LIVE' : 'SILENT';
            const bpm = context.bpm || 120;
            // Emit heartbeat log
            this.log('System', `💓 HEARTBEAT: ${audioStatus} | ${bpm} BPM | ${currentVibe.toUpperCase()}`, {
                audioActive: this.hasRealAudio,
                bpm,
                vibe: currentVibe,
                brainEnabled,
                fixtureCount: this.fixtures.length,
            });
        }
        // WAVE 380: Debug - verify fixtures are present in loop (WAVE 2098: silenced)
        // ═══════════════════════════════════════════════════════════════════════
        // 🌉 WAVE-4592: AETHER UI REROUTE — Opción B (placeholder array)
        // fixtureStates se inicializa desde this.fixtures con valores default puros.
        // AetherUIProjector.project() lo rellena con la verdad Aether cada frame.
        // hal.renderFromTarget() ya NO se llama: Aether es el productor exclusivo.
        // ═══════════════════════════════════════════════════════════════════════
        const fixtureStates = this.fixtures.map(fix => ({
            dmxAddress: fix.dmxAddress,
            universe: fix.universe,
            name: fix.name,
            zone: fix.zone ?? 'center',
            type: fix.type ?? 'generic',
            isVirtual: fix.isVirtual,
            dimmer: 0,
            r: 0, g: 0, b: 0,
            pan: 128,
            tilt: 128,
            zoom: 128,
            focus: 128,
            channels: fix.channels,
            profileId: fix.profileId,
            fixtureId: fix.id,
            hasColorWheel: fix.hasColorWheel,
            hasColorMixing: fix.hasColorMixing,
        }));
        // ═══════════════════════════════════════════════════════════════════════
        // � WAVE 2662: POST-HAL MUTATION ELIMINATED
        //
        // BEFORE (WAVE 635 → 993 → 2065): ~500 lines of zone overrides, brocha gorda,
        // stereo movement, movement override — all mutating fixtureStates post-HAL.
        // This was the root cause of ghost effects (WAVE 2660): UI got the mutation,
        // DMX didn't (conditional re-send gated behind Hephaestus).
        //
        // NOW: Effects are injected as EffectIntents BEFORE arbitrate().
        // The Arbiter produces a FinalLightingTarget that ALREADY includes effects.
        // HAL.renderFromTarget() sends the COMPLETE truth to DMX.
        // Single Source of Truth. Zero ghosts. Clean cascade.
        //
        // The only post-HAL mutation that remains is Hephaestus (.lfx clips),
        // which has its own legitimate re-send path.
        // ═══════════════════════════════════════════════════════════════════════
        // Chronos telemetry (post-HAL, for diagnostics only)
        const isChronosPlaying = this._timelineEngine.isPlaying;
        if (isChronosPlaying && this.frameCount % 300 === 1) {
            const f0 = fixtureStates[0];
            console.log(`[TitanOrchestrator 🎬] CHRONOS OVERLAY: ${chronosFixtureIds.size}/${fixtureStates.length} fixtures protected | ` +
                `f0: dim=${f0?.dimmer} RGB(${f0?.r},${f0?.g},${f0?.b})`);
        }
        // WAVE 257: Throttled logging to Tactical Log (every 4 seconds = 240 frames @ 60fps)
        // 🎛️ WAVE 1198.8: De 120 a 240 frames para reducir spam
        const shouldLogToTactical = this.frameCount % 240 === 0;
        if (shouldLogToTactical && this.hasRealAudio) {
            const avgDimmer = fixtureStates.length > 0
                ? fixtureStates.reduce((sum, f) => sum + f.dimmer, 0) / fixtureStates.length
                : 0;
            const movers = fixtureStates.filter(f => f.zone.includes('MOVING'));
            const avgMover = movers.length > 0 ? movers.reduce((s, f) => s + f.dimmer, 0) / movers.length : 0;
            const frontPars = fixtureStates.filter(f => f.zone === 'FRONT_PARS');
            const avgFront = frontPars.length > 0 ? frontPars.reduce((s, f) => s + f.dimmer, 0) / frontPars.length : 0;
            // Send to Tactical Log
            this.log('Visual', `🎨 P:${intent.palette.primary.hex || '#???'} | Front:${avgFront.toFixed(0)} Mover:${avgMover.toFixed(0)}`, {
                bass, mid, high, energy,
                avgDimmer: avgDimmer.toFixed(0),
                paletteStrategy: intent.palette.strategy
            });
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚒️ WAVE 2030.19: THE MERGER - HephaestusRuntime Integration
        // Evaluate all active .lfx clips and merge their outputs with DMX
        // 
        // MERGE STRATEGY:
        //   - Intensity/Dimmer: HTP (Highest Takes Precedence)
        //   - Color (RGB): LTP (Hephaestus overwrites if present)
        //   - Pan/Tilt: Overlay (Hephaestus controls movement if present)
        //   - Strobe: Additive (sum clamped to max)
        //
        // 🎬 WAVE 2065: Heph always runs. Per-fixture Chronos check applied inside.
        // ═══════════════════════════════════════════════════════════════════════════
        const hephRuntime = getHephaestusRuntime();
        const hephOutputs = hephRuntime.tick(now); // ⚡ WAVE 3050: unified timestamp
        // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — Hephaestus DMX Gate
        // DJ_FOUNDER: Hephaestus runtime ticks are silently discarded.
        // The engine runs but its output never reaches fixtures.
        if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
            // WAVE 3190: Reutilizar buffers pre-asignados — cero new Map() por frame
            // 🎯 WAVE 2544.3: Separate outputs into two buckets:
            //   - fixtureId bucket: output targets a specific fixture by ID (new tickLegacy path)
            //   - zone bucket: output targets a zone string (tickWithPhase legacy path)
            this._hephByFixtureId.clear();
            this._hephByZone.clear();
            // Limpiar arrays del pool reutilizados el frame anterior
            for (const arr of this._hephOutputPool.values())
                arr.length = 0;
            for (const output of hephOutputs) {
                // If fixtureId looks like a real fixture ID (not 'zone:xxx'), use fixture bucket
                if (output.fixtureId && !output.fixtureId.startsWith('zone:')) {
                    let arr = this._hephByFixtureId.get(output.fixtureId);
                    if (!arr) {
                        // Reusar del pool o crear uno nuevo (solo en el primer clip para esta fixture)
                        arr = this._hephOutputPool.get(output.fixtureId);
                        if (!arr) {
                            arr = [];
                            this._hephOutputPool.set(output.fixtureId, arr);
                        }
                        this._hephByFixtureId.set(output.fixtureId, arr);
                    }
                    arr.push(output);
                }
                else {
                    const zoneKey = output.zone === 'all' ? 'all' : output.zone.toString();
                    let arr = this._hephByZone.get(zoneKey);
                    if (!arr) {
                        arr = this._hephOutputPool.get(`zone:${zoneKey}`);
                        if (!arr) {
                            arr = [];
                            this._hephOutputPool.set(`zone:${zoneKey}`, arr);
                        }
                        this._hephByZone.set(zoneKey, arr);
                    }
                    arr.push(output);
                }
            }
            // WAVE 3190: Mutation in-place — cero map()+spread() por frame
            // Apply Hephaestus outputs to fixtures mutando f directamente.
            // fixtureStates son objetos propios del HAL por frame — son seguros de mutar.
            for (let index = 0; index < fixtureStates.length; index++) {
                const f = fixtureStates[index];
                // 🎬 WAVE 2065: Skip fixtures that Chronos is currently painting
                const fixtureId = this.fixtures[index]?.id;
                if (fixtureId && chronosFixtureIds.has(fixtureId))
                    continue;
                // WAVE 3521: Skip fixtures registered in Aether NodeGraph (handled by HephaestusAetherAdapter L3+)
                if (fixtureId && this._aetherGraph.getDeviceNodes(fixtureId).length > 0)
                    continue;
                // Collect applicable outputs inline (sin crear array intermedio cuando posible)
                const directOutputs = fixtureId ? this._hephByFixtureId.get(fixtureId) : undefined;
                const allOutputs = this._hephByZone.get('all');
                // Chequear si hay algo que aplicar antes de iterar zonas
                const fixtureZone = (f.zone || '').toLowerCase();
                const positionX = this.fixtures[index]?.position?.x ?? 0;
                let hasAny = !!(directOutputs?.length) || !!(allOutputs?.length);
                if (!hasAny) {
                    for (const [zoneKey] of this._hephByZone) {
                        if (zoneKey === 'all')
                            continue;
                        if (zoneMapperMatch(fixtureZone, zoneKey, positionX)) {
                            hasAny = true;
                            break;
                        }
                    }
                }
                if (!hasAny)
                    continue;
                // ⚒️ WAVE 2030.21: THE TRANSLATOR — mutar f in-place
                // Values arrive PRE-SCALED from HephaestusRuntime. Zero scaling here.
                const applyOutputs = (outputs) => {
                    for (const output of outputs) {
                        switch (output.parameter) {
                            case 'intensity':
                                f.dimmer = Math.max(f.dimmer, output.value);
                                break;
                            case 'strobe':
                                f.strobe = Math.min(255, (f.strobe || 0) + output.value);
                                break;
                            case 'pan':
                                f.pan = output.value;
                                if (output.fine !== undefined)
                                    f.panFine = output.fine;
                                break;
                            case 'tilt':
                                f.tilt = output.value;
                                if (output.fine !== undefined)
                                    f.tiltFine = output.fine;
                                break;
                            case 'color':
                                if (output.rgb) {
                                    f.r = output.rgb.r;
                                    f.g = output.rgb.g;
                                    f.b = output.rgb.b;
                                }
                                break;
                            case 'white':
                                f.white = output.value;
                                break;
                            case 'amber':
                                f.amber = output.value;
                                break;
                            case 'zoom':
                                f.zoom = output.value;
                                break;
                            case 'focus':
                                f.focus = output.value;
                                break;
                            case 'iris':
                                f.iris = output.value;
                                break;
                            case 'gobo1':
                                f.gobo = output.value;
                                break;
                            case 'gobo2':
                                f.gobo2 = output.value;
                                break;
                            case 'prism':
                                f.prism = output.value;
                                break;
                            // speed/width/direction/globalComp: engine-internal — no DMX channel
                        }
                    }
                };
                if (directOutputs)
                    applyOutputs(directOutputs);
                if (allOutputs)
                    applyOutputs(allOutputs);
                // Check zone-specific outputs (old zone-string path)
                // 🗺️ WAVE 2543.5: Pass positionX for stereo zone support
                for (const [zoneKey, outputs] of this._hephByZone) {
                    if (zoneKey === 'all')
                        continue;
                    if (zoneMapperMatch(fixtureZone, zoneKey, positionX)) {
                        applyOutputs(outputs);
                    }
                }
            }
            // Throttled debug log
            if (this.frameCount % 60 === 0) {
                const activeClips = hephRuntime.getStats().activeClips;
                console.log(`[TitanOrchestrator ⚒️] HEPHAESTUS: ${activeClips} clips, ${hephOutputs.length} outputs`);
            }
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 3065: PHYSICS-FIRST, UI-BEFORE-ADUANA
        //
        // WAVE 3050 introdujo un regression: sendStatesWithPhysics() mutaba los
        // objetos fixtureStates IN-PLACE con la Aduana (zerificando dimmer/r/g/b
        // cuando outputEnabled=false) ANTES de que el hot-frame los leyera.
        // Resultado: HyperionView siempre negro con output OFF.
        //
        // Fix arquitectónico correcto:
        //   1. applyPhysicsOnly()  → physicalPan/Tilt actualizados, SIN Aduana
        //   2. Hot-frame + Truth   → UI lee valores reales del engine
        //   3. flushToDriver()     → Aduana + DMX (puede zerificar, pero ya no importa)
        //
        // De esta forma el preview siempre refleja la realidad del engine,
        // y la Aduana sigue siendo el único gate para el hardware físico.
        // ═══════════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 3070: applyPhysicsOnly() eliminado — renderFromTarget() ya corrió
        // la física (translateDMX + calibrationOffsets) internamente. Llamarlo aquí
        // era doble-física: el mover se simulaba dos veces por frame, duplicando la
        // velocidad aparente y produciendo jitter esquizofrénico en la UI.
        // El pipeline correcto es: renderFromTarget (física+cálculo) → broadcast UI
        // → flushToDriver (Aduana+send). Sin pasos intermedios redundantes.
        // ═══════════════════════════════════════════════════════════════════════
        // ⚡ WAVE 2510: DUAL-CHANNEL BROADCAST — Hot Frame (22Hz) + Full Truth (~7Hz)
        //
        // Hot Frame: Every HOT_FRAME_DIVIDER ticks (22Hz). Carries fixture dynamic data.
        //   → Frontend → RenderWorker → HyperionView preview.
        //   → Lightweight: fixtures array + beat + frame number.
        //
        // Full Truth: Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz).
        //   → Full SeleneTruth. Feeds React stores, HUD, audio meters, etc.
        //
        // 👻 WAVE 2540.7: CHRONOS BYPASS — During Chronos playback, broadcast
        // full truth at full rate (44fps) since Cinema needs complete data.
        //
        // ⚡ WAVE 3065: Broadcast happens BEFORE flushToDriver() so the Aduana
        // never pollutes the UI data with DMX gate zeros.
        // ═══════════════════════════════════════════════════════════════════════
        // 👻 Chronos bypass check
        const chronosPlaying = this.engine?.isChronosPlaybackActive() ?? false;
        const shouldBroadcastFullTruth = chronosPlaying || (this.frameCount % TitanOrchestrator.TRUTH_BROADCAST_DIVIDER === 0);
        // ⚡ WAVE 2464: PEAK HOLD — Acumula picos entre full truth broadcasts
        if (!chronosPlaying) {
            for (let _pi = 0; _pi < fixtureStates.length; _pi++) {
                const _f = fixtureStates[_pi];
                const _id = this.fixtures[_pi]?.id || `fix_${_pi}`;
                const _prev = this.peakHoldMap.get(_id) ?? 0;
                if (_f.dimmer > _prev)
                    this.peakHoldMap.set(_id, _f.dimmer);
            }
        }
        const emitHotFrame = () => {
            if (!this.onHotFrame || (!chronosPlaying && this.frameCount % TitanOrchestrator.HOT_FRAME_DIVIDER !== 0)) {
                return;
            }
            // WAVE 3403: Snapshot AudioMatrix status once per hot-frame (avoid double getStatus())
            const matrixStatus = this.trinity?.getAudioMatrix()?.getStatus();
            const hotFrame = {
                frameNumber: this.frameCount,
                timestamp: now, // ⚡ WAVE 3050: unified timestamp
                onBeat: engineAudioMetrics.isBeat,
                beatConfidence: engineAudioMetrics.beatConfidence,
                bpm: engineAudioMetrics.bpm,
                // 🎵 WAVE 3250: UNLEASH THE SPECTRUM — Audio bands en hot-frame (44Hz)
                // Antes: bass/mid/high/energy solo viajaban en selene:truth (~7Hz).
                // AudioSpectrumTitan leía el MISMO valor 8-9 frames seguidos → escalones.
                // Ahora viajan a 44Hz — el smoothstep del frontend interpola a 60fps.
                bass,
                mid,
                high,
                energy,
                // WAVE 3403: AudioMatrix telemetry piggybacked on hot-frame (zero extra IPC)
                ringBufferFillLevel: matrixStatus?.ringBufferFillLevel ?? 0,
                activeAudioSource: matrixStatus?.activeSource ?? null,
                fixtures: fixtureStates.map((f, i) => {
                    const originalFixture = this.fixtures[i];
                    const realId = originalFixture?.id || `fix_${i}`;
                    return {
                        id: realId,
                        dimmer: f.dimmer / 255,
                        r: Math.round(f.r),
                        g: Math.round(f.g),
                        b: Math.round(f.b),
                        white: Math.round(f.white ?? 0),
                        amber: Math.round(f.amber ?? 0),
                        pan: f.pan / 255,
                        tilt: f.tilt / 255,
                        zoom: f.zoom,
                        focus: f.focus,
                        physicalPan: (f.physicalPan ?? f.pan) / 255,
                        physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
                        panVelocity: f.panVelocity ?? 0,
                        tiltVelocity: f.tiltVelocity ?? 0,
                    };
                })
            };
            this.onHotFrame(hotFrame);
        };
        // ── HOT FRAME — Every HOT_FRAME_DIVIDER ticks (44Hz) ────────────────────────
        // ⚡ WAVE 3050: Throttled from 44Hz → 22Hz. DMX stays at 44Hz.
        // ⚡ WAVE 4559: Overclock → 44Hz. Strobe y flash sin frame-skip al canvas.
        // ⚡ WAVE 3065: Emitted BEFORE flushToDriver — values are real engine output.
        if (!this._aetherHasDevices) {
            emitHotFrame();
        }
        // ⚡ WAVE-4592: flushToDriver() ELIMINADO — la Aduana y el send DMX
        // son responsabilidad exclusiva del bloque Aether (aetherSafety + sendUniverseRaw).
        // this.hal.flushToDriver(fixtureStates)  ← DISCONNECTED WAVE-4592
        // ═══════════════════════════════════════════════════════════════════════
        // ⚛️ WAVE 3505.4: AETHER MATRIX — V2 Agnostic Engine Pipeline
        //
        // Corre DESPUÉS del pipeline legacy para no interferir con él.
        // El _aetherBus recibe intents de los Systems en una versión futura.
        // Por ahora el NodeArbiter arbitrará lo que tenga (vacío = paquetes default).
        // El pipeline está listo para que cada System inyecte sus intents.
        //
        // Zero-alloc: los buffers Uint8Array son propiedad del NodeResolver.
        // Se envían al driver por referencia directa (zero-copy al hardware).
        // ═══════════════════════════════════════════════════════════════════════
        if (this._aetherHasDevices && this.hal) {
            const aetherArbiter = this._aetherArbiter;
            const aetherResolver = this._aetherResolver;
            const colorAdapter = this._colorAdapter;
            const kineticAdapter = this._kineticAdapter;
            const beamAdapter = this._beamAdapter;
            const atmosphereAdapter = this._atmosphereAdapter;
            const liquidAetherAdapter = this._liquidAetherAdapter;
            const seleneAetherAdapter = this._seleneAetherAdapter;
            if (!aetherArbiter ||
                !aetherResolver ||
                !colorAdapter ||
                !kineticAdapter ||
                !beamAdapter ||
                !atmosphereAdapter ||
                !liquidAetherAdapter ||
                !seleneAetherAdapter) {
                // Lazy-init safety guard: si la matriz no existe todavía, salimos sin tocar el pipeline legacy.
            }
            else {
                // ── WAVE 3516.2: Construir FrameContext in-place (cero alloc) ──────────
                // Mutar los campos del objeto pre-allocado en lugar de crear uno nuevo.
                // AudioMetrics: mapear bandas del SyncSmoother al vocabulario de Aether.
                const _sm = this.syncSmoother.currentSmoothed;
                const _a = this._aetherAudio;
                _a.subBass = _sm.subBass ?? 0;
                _a.bass = engineAudioMetrics.bass;
                _a.mid = engineAudioMetrics.mid;
                _a.highMid = _sm.highMid ?? 0;
                // WAVE 3516.1: rawTreble y ultraAir del 7º Pasajero — sin colapsar
                _a.presence = this.lastAudioData.rawTreble ?? (high * 0.8);
                _a.air = this.lastAudioData.ultraAir ?? (high * 0.3);
                _a.energy = engineAudioMetrics.energy;
                _a.hasTransient = engineAudioMetrics.isBeat;
                _a.transientStrength = engineAudioMetrics.beatConfidence;
                _a.bpm = engineAudioMetrics.bpm;
                _a.beatPhase = engineAudioMetrics.beatPhase;
                _a.beatCount = engineAudioMetrics.beatCount;
                // MusicalContext: del contexto de Brain
                const _m = this._aetherMusical;
                _m.section = (context.section?.type ?? 'unknown');
                _m.dropImminent = context.energy > 0.8;
                _m.sectionIntensity = engineAudioMetrics.energy;
                _m.harmonicTension = engineAudioMetrics.bass;
                _m.sectionElapsedMs = context.section?.duration ?? 0;
                // VibeProfile: del engine + paleta del intent
                const _v = this._aetherVibe;
                _v.name = this.engine.getCurrentVibe();
                _v.palette = (intent.palette.colors ?? [{ h: 0, s: 0, l: 1 }]);
                _v.movementSpeed = 0.5;
                _v.intensity = intent.masterIntensity ?? engineAudioMetrics.energy;
                _v.beamExpressiveness = 0.5;
                // nowMs y frameIndex del scope
                this._aetherCtx.nowMs = now;
                this._aetherCtx.frameIndex = this.frameCount;
                // 1. Limpiar el bus de intents del frame anterior
                this._aetherBus.clear();
                // WAVE 4663 PASO 2: Limpiar el bus L1 de Selene (Silence Rule).
                // Si hasActiveEffects=false en este frame, Selene no empuja nada
                // → bus queda vacío → L1 es no-op → L0 (Liquid/VMM) retoma control.
                this._seleneBus.clear();
                // WAVE 4705: limpiar bus L3 de LiveFX en cada frame.
                this._effectBus.clear();
                // ── WAVE 4655 F1: L0 — LiquidAetherAdapter usa el engine activo según layout UI ────
                // Corrige split-brain: ya no se hardcodea liquidEngine71, se lee del engine activo.
                const _activeEngine = this.engine?.getActiveLiquidEngine();
                // 🩺 WAVE 4655-DIAG: log engine read (throttled)
                const _engineName = _activeEngine?.constructor?.name ?? 'none';
                if (this._lastLoggedEngine !== _engineName) {
                    console.log(`[TitanOrchestrator 🌊] AETHER-ENGINE: ${_engineName} | frame=${this.frameCount}`);
                    this._lastLoggedEngine = _engineName;
                }
                const _liqFrame = _activeEngine?.lastFrame ?? null;
                const _liqResult = _activeEngine?.lastResult ?? null;
                if (_liqFrame !== null && _liqResult !== null) {
                    liquidAetherAdapter.ingest(_liqFrame, _liqResult, this._aetherBus);
                }
                // ── 2. WAVE 3516.2: Systems escriben sus intents en el _aetherBus ─────
                const ctx = this._aetherCtx;
                this._impactAdapter.process(this._aetherGraph.getView(NodeFamily.IMPACT), ctx, this._aetherBus, _liqResult ?? undefined);
                // 🎨 WAVE 4522.3: Inyectar paleta RGB de SeleneLux al ColorAdapter antes de process()
                const _colorPalette = this.engine.getLastColorPalette();
                if (_colorPalette !== null) {
                    colorAdapter.setIngress(_colorPalette);
                }
                colorAdapter.process(this._aetherGraph.getView(NodeFamily.COLOR), ctx, this._aetherBus);
                kineticAdapter.process(this._aetherGraph.getView(NodeFamily.KINETIC), ctx, this._aetherBus);
                // 🔦 WAVE 3516.4: Beam — ópticas (gobos, prismas, zoom, focus)
                beamAdapter.process(this._aetherGraph.getView(NodeFamily.BEAM), ctx, this._aetherBus);
                // 🌫️ WAVE 3516.4: Atmosphere — elementos (fog, haze, fan, spark, pyro)
                atmosphereAdapter.process(this._aetherGraph.getView(NodeFamily.ATMOSPHERE), ctx, this._aetherBus);
                // ═══════════════════════════════════════════════════════════════════════
                // 🚀 WAVE 4524.3: L3 — Selene-Aether Adapter (Puente Cognitivo)
                // Consume el output de Selene (effectDecision, colorDecision, physicsModifier)
                // y lo traduce en intenciones L3 atómicas: dimmer, RGB, strobeRate.
                // REGLA ESTRICTA: NO emite movimiento (targetX/Y/Z ni pan/tilt).
                // ═══════════════════════════════════════════════════════════════════════
                const consciousnessOutput = this.lastConsciousnessOutput ?? null;
                const effectOutput = getEffectManager().getCombinedOutput();
                // WAVE 4675: passport VIP de Selene/LiveFX para saltar MoverShield cuando
                // el efecto dominante lo requiere (p.ej. CorazonLatino, OroSolido).
                aetherArbiter.setSeleneOverrideMoverShield(effectOutput?.overrideMoverShield === true);
                // LiveFX se inyecta en bus L3 dedicado para que domine sobre L2 manual.
                seleneAetherAdapter.ingest(consciousnessOutput, effectOutput, ctx.deltaMs, this._effectBus);
                // STEP 4.5: Playback LP bridge Chronos -> Aether
                this._chronosAetherAdapter.ingest(this._timelineEngine, ctx.deltaMs, aetherArbiter);
                // STEP 5: Hephaestus L3+ Diamond Data bridge
                // Reuses `hephOutputs` from the legacy block above (SINGLE tick per frame).
                // The adapter only processes fixtures registered in NodeGraph (isCustomClip === true).
                // Legacy post-HAL block still handles fixtures NOT in NodeGraph (backward compat).
                if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
                    this._hephaestusAetherAdapter.ingest(hephOutputs, aetherArbiter);
                }
                else {
                    this._hephaestusAetherAdapter.clear(aetherArbiter);
                }
                // ⚡ WAVE 4700: Motor cinético nativo L2 — tick antes de arbitrate().
                // Escribe pan_base/tilt_base por fixture en L2 si hay patrón manual activo.
                // dtSeconds calculado desde deltaMs (FrameScheduler, monotonic, nunca Date.now).
                if (aetherKineticEngine.isActive()) {
                    aetherKineticEngine.tick(this._aetherCtx.deltaMs / 1000, aetherArbiter);
                }
                // 3. El Arbiter unifica todas las capas → ArbitratedNodeMap
                aetherArbiter.setSystemIntents(this._aetherBus);
                aetherArbiter.setEffectIntents(this._effectBus.getAll());
                const arbitrated = aetherArbiter.arbitrate();
                // 3.5. ⚙️ WAVE 4518.1: Physics Post-Processor — aplica inercia a nodos KINETIC
                // WOODSTOCK: deltaMs viene del FrameScheduler (performance.now()-based), NUNCA Date.now()
                this._physicsPostProcessor.process(arbitrated, this._aetherGraph, this._aetherCtx.deltaMs, this._aetherCtx.vibe.name);
                // ═══════════════════════════════════════════════════════════════════════
                // 🛂 WAVE 4557: AETHER SAFETY MIDDLEWARE — LA ADUANA AETHER
                //
                // FASE 0: PRE-RESOLVE  — Output gate + virtual filter (muta ArbitratedNodeMap)
                // FASE 1: INTRA-RESOLVE — Velocity clamp, airbag, DarkSpin (called by NodeResolver)
                // FASE 2: POST-RESOLVE  — Throttle + virtual skip before sendUniverseRaw
                // ═══════════════════════════════════════════════════════════════════════
                const aetherSafety = this._aetherSafety;
                // FASE 0: Set frame context + apply output gate
                aetherSafety.setFrameContext(now, this._aetherCtx.vibe.name);
                aetherSafety.setOutputEnabled(this._outputEnabled);
                aetherSafety.setManualNodeIds(aetherArbiter.getManualOverrideNodeIds());
                aetherSafety.applyOutputGate(arbitrated);
                // 4. NodeResolver traduce a Uint8Array(512) por universo (pre-alloc, in-place)
                // FASE 1 safety (velocity clamp, airbag, DarkSpin) runs INSIDE resolve via _safetyMiddleware
                // 🎨 WAVE 4522.4: Inyectar contexto musical para HarmonicQuantizer (gating de ruedas)
                aetherResolver.setResolveContext(engineAudioMetrics.bpm, engineAudioMetrics.beatConfidence);
                // WAVE 4548.6: Populate ForgeFrameContext in-place (zero-alloc)
                const _fCtx = this._forgeFrameCtx;
                _fCtx.timeMs = now;
                _fCtx.deltaMs = this._aetherCtx.deltaMs;
                _fCtx.bpm = engineAudioMetrics.bpm;
                _fCtx.bpmConfidence = engineAudioMetrics.beatConfidence;
                _fCtx.isBeat = engineAudioMetrics.isBeat;
                _fCtx.energy = engineAudioMetrics.energy;
                _fCtx.frameIndex = this.frameCount;
                // Audio bands: write directly into pre-allocated Float64Array
                this._forgeAudioBands[0] = _a.subBass;
                this._forgeAudioBands[1] = _a.bass;
                this._forgeAudioBands[2] = _a.mid;
                this._forgeAudioBands[3] = _a.highMid;
                this._forgeAudioBands[4] = _a.presence;
                this._forgeAudioBands[5] = _a.air;
                aetherResolver.setForgeFrameContext(this._forgeFrameCtx);
                aetherResolver.resolve(arbitrated);
                // 🎭 WAVE 4617-B M4: UI projection AFTER resolve — zero frame lag.
                // NodeResolver.resolve() actualiza currentPosition con el IK result
                // del frame actual. project() + emitHotFrame() ahora leen frame N,
                // no frame N-1, eliminando el desfase de ~23ms del ordenamiento previo.
                // WAVE 4612: `arbitrated` se pasa para leer dimmers reales del mapa post-arbitraje.
                // 🚨 WAVE 4634: blackoutActive se lee ANTES de project() para sincronizar
                // la UI con el apagón real del DMX (zero desfase visual).
                const blackoutActive = aetherArbiter.isBlackoutActive();
                this._aetherUIProjector.project(fixtureStates, this._aetherGraph, arbitrated, blackoutActive);
                emitHotFrame();
                // FASE 2: POST-RESOLVE EGRESS — Throttle + virtual skip + send
                // WAVE 4656: Output gate final en orquestador (source of truth Aether).
                // WAVE 4681: Keepalive — siempre iteramos registeredUniverses para mantener
                // el link DMX vivo. NodeResolver ya tiene los buffers correctos:
                //   - outputEnabled=true  → valores reales del engine
                //   - outputEnabled=false → KINETIC/manual pasan; IMPACT/COLOR/BEAM/ATMO = 0
                // El hardware NECESITA recibir el paquete (aunque sea todo ceros) para no
                // reportar "no data yet". El Smart Gate (WAVE 4680) vive en _writeNode.
                const outputEnabled = this._outputEnabled;
                this.hal.setAetherOutputGateState(outputEnabled, blackoutActive);
                for (const universe of aetherResolver.registeredUniverses) {
                    // 🛂 WAVE 4557: shouldSendUniverse checks virtual-only + throttle
                    if (!aetherSafety.shouldSendUniverse(universe))
                        continue;
                    const rawBuf = aetherResolver.getUniverseBuffer(universe);
                    if (!rawBuf)
                        continue;
                    // WAVE 4633-OMEGA: Smart blackout semántico.
                    // Solo canales de emisión (dimmer/color) van a 0. Pan/tilt/speed conservan
                    // sus valores para proteger la mecánica de los movers.
                    const egressBuf = blackoutActive
                        ? aetherResolver.getSoftBlackoutUniverseBuffer(universe, rawBuf)
                        : rawBuf;
                    this.hal.sendUniverseRaw(universe, egressBuf);
                    // 🔬 WAVE 4681: Log de supervivencia cada 300 frames (~5s a 44Hz)
                    if (this.frameCount % 300 === 0) {
                        let byteSum = 0;
                        for (let _bi = 0; _bi < egressBuf.length; _bi++)
                            byteSum += egressBuf[_bi];
                        console.log(`[Egress 📤] Universe ${universe} → HAL. ` +
                            `Suma bytes: ${byteSum} | ` +
                            `outputEnabled: ${outputEnabled} | ` +
                            `blackout: ${blackoutActive}`);
                    }
                }
                // 🚀 WAVE 4681: Flush — empuja todos los buffers de universo al worker DMX
                // via UPDATE_BUFFER IPC (sendAll). Sin esto, setUniverse() escribe en buffer
                // pero el worker nunca recibe datos → "no data yet" perpetuo.
                this.hal.flushAetherEgress();
                // 🛂 WAVE 4557: Safety telemetry (~1Hz)
                if (this.frameCount % 44 === 0) {
                    const tel = aetherSafety.consumeTelemetry();
                    if (tel.velocityClamps > 0 || tel.airbagHits > 0 || tel.aduanaBlocks > 0 || tel.darkSpinActive > 0) {
                        console.log(`[AetherAduana 🛂] VelClamp:${tel.velocityClamps} Airbag:${tel.airbagHits} ` +
                            `DarkSpin:${tel.darkSpinActive} AduanaGate:${tel.aduanaBlocks}`);
                    }
                }
            }
        }
        // 🧹 WAVE 2227 + WAVE 3065: El visual gate fue eliminado en WAVE 2227.
        // WAVE 3065 refuerza esto: la Aduana DMX (flushToDriver) es el ÚNICO gate.
        // El broadcast UI siempre recibe los valores reales del engine.
        // ── FULL TRUTH — Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz) ────────
        if (this.onBroadcast && shouldBroadcastFullTruth) {
            const currentVibe = this.engine.getCurrentVibe();
            // Build a valid SeleneTruth structure
            const truth = {
                system: {
                    frameNumber: this.frameCount,
                    timestamp: now, // ⚡ WAVE 3050: unified timestamp
                    deltaTime: 23,
                    targetFPS: 44,
                    actualFPS: 44,
                    mode: this.mode === 'auto' ? 'selene' : 'manual',
                    vibe: currentVibe,
                    brainStatus: 'peaceful',
                    uptime: this.frameCount * 23,
                    titanEnabled: true,
                    sessionId: 'titan-2.0',
                    version: '2.0.0',
                    performance: {
                        audioProcessingMs: 0,
                        brainProcessingMs: 0,
                        colorEngineMs: 0,
                        dmxOutputMs: 0,
                        totalFrameMs: 0
                    }
                },
                sensory: {
                    audio: {
                        energy,
                        peak: energy,
                        average: energy * 0.8,
                        bass,
                        mid,
                        high,
                        spectralCentroid: 0,
                        spectralFlux: 0,
                        zeroCrossingRate: 0
                    },
                    fft: this.EMPTY_FFT_BUFFER,
                    beat: {
                        onBeat: engineAudioMetrics.isBeat,
                        confidence: engineAudioMetrics.beatConfidence,
                        bpm: engineAudioMetrics.bpm, // 🕰️ WAVE 2090.3: Pacemaker PLL BPM
                        beatPhase: engineAudioMetrics.beatPhase, // 🕰️ WAVE 2090.3: PLL-driven phase
                        barPhase: 0,
                        timeSinceLastBeat: 0
                    },
                    input: {
                        gain: this.inputGain,
                        device: 'Microphone',
                        active: this.hasRealAudio,
                        isClipping: false
                    },
                    // 🧠 WAVE 1195: BACKEND TELEMETRY EXPANSION - 7 GodEar Tactical Bands
                    spectrumBands: {
                        subBass: this.syncSmoother.currentSmoothed.subBass,
                        bass: bass, // Use the already available bass from engineAudioMetrics
                        lowMid: this.syncSmoother.currentSmoothed.lowMid,
                        mid: mid, // Use the already available mid from engineAudioMetrics
                        highMid: this.syncSmoother.currentSmoothed.highMid,
                        treble: high * 0.8, // Approximate from high
                        ultraAir: high * 0.3, // Approximate ultra-high from high
                        dominant: bass > mid && bass > high ? 'bass' :
                            mid > bass && mid > high ? 'mid' : 'treble',
                        flux: Math.abs((this.lastAudioData.energy || 0) - energy)
                    }
                },
                // 🌡️ WAVE 283: Usar datos REALES del TitanEngine en vez de defaults
                // 🧬 WAVE 550: Añadir telemetría de IA para el HUD táctico
                // 🔌 WAVE 1175: DATA PIPE FIX - Inyectar vibe REAL desde el engine
                consciousness: {
                    ...createDefaultCognitive(),
                    stableEmotion: this.engine.getStableEmotion(),
                    thermalTemperature: this.engine.getThermalTemperature(),
                    ai: this.engine.getConsciousnessTelemetry(),
                    // 🔌 WAVE 1175: Vibe activo REAL (no el default 'idle')
                    vibe: {
                        active: currentVibe,
                        transitioning: false // TODO: implementar transición real
                    }
                },
                // 🧠 WAVE 260: SYNAPTIC BRIDGE - Usar el contexto REAL del Brain
                // Antes esto estaba hardcodeado a UNKNOWN/null. Ahora propagamos
                // el contexto que ya obtuvimos de brain.getCurrentContext()
                context: {
                    key: context.key,
                    mode: context.mode,
                    bpm: context.bpm,
                    beatPhase: context.beatPhase,
                    syncopation: context.syncopation,
                    section: context.section,
                    energy: context.energy,
                    mood: context.mood,
                    genre: context.genre,
                    confidence: context.confidence,
                    timestamp: context.timestamp
                },
                intent: {
                    palette: intent.palette,
                    masterIntensity: intent.masterIntensity,
                    zones: intent.zones,
                    movement: intent.movement,
                    effects: intent.effects,
                    source: 'procedural',
                    timestamp: now // ⚡ WAVE 3050: unified timestamp
                },
                hardware: {
                    dmx: {
                        connected: true,
                        driver: 'none',
                        universe: 0, // 🔥 WAVE 1219: ArtNet 0-indexed
                        frameRate: 30,
                        port: null
                    },
                    dmxOutput: DMX_OUTPUT_ZEROS,
                    fixturesActive: fixtureStates.reduce((count, f) => count + (f.dimmer > 0 ? 1 : 0), 0),
                    fixturesTotal: fixtureStates.length,
                    // Map HAL FixtureState to Protocol FixtureState
                    // WAVE 256.3: Normalize DMX values (0-255) to frontend values (0-1)
                    // WAVE 256.7: Map zone names for StageSimulator2 compatibility
                    fixtures: fixtureStates.map((f, i) => {
                        // \ud83d\udd27 WAVE 700.9.4: Map HAL zones to StageSimulator2 zones
                        // \u26a1 WAVE 3050: ZONE_MAP is now a module-level constant (was per-fixture per-frame)
                        const mappedZone = ZONE_MAP[f.zone] || f.zone || 'center';
                        // 🩸 WAVE 380: Use REAL fixture ID from this.fixtures, not generated index
                        // This is critical for runtimeStateMap matching in StageSimulator2
                        const originalFixture = this.fixtures[i];
                        const realId = originalFixture?.id || `fix_${i}`;
                        // ⚡ WAVE 2464: PEAK HOLD — Usa el pico acumulado en el frame skipeado.
                        // Si el fixture brilló al máximo en el frame que el throttle saltó, aquí
                        // mandamos ese pico al canvas. Después de leerlo: reset a 0 para el ciclo.
                        // 👻 WAVE 2540.7: Skip peak hold during Chronos — every frame is broadcast,
                        // no skipped frames means no peaks to accumulate.
                        let broadcastDimmer;
                        if (chronosPlaying) {
                            broadcastDimmer = f.dimmer;
                        }
                        else {
                            const peakDimmer = this.peakHoldMap.get(realId) ?? f.dimmer;
                            broadcastDimmer = Math.max(f.dimmer, peakDimmer);
                            this.peakHoldMap.set(realId, 0); // Reset peak tras broadcast
                        }
                        return {
                            id: realId,
                            name: f.name,
                            type: f.type,
                            zone: mappedZone,
                            dmxAddress: f.dmxAddress,
                            universe: f.universe,
                            dimmer: broadcastDimmer / 255, // Normalize 0-255 → 0-1 (con peak hold)
                            intensity: broadcastDimmer / 255, // Normalize 0-255 → 0-1 (con peak hold)
                            color: {
                                r: Math.round(f.r), // Keep 0-255 for RGB
                                g: Math.round(f.g),
                                b: Math.round(f.b)
                            },
                            pan: f.pan / 255, // Normalize 0-255 → 0-1
                            tilt: f.tilt / 255, // Normalize 0-255 → 0-1
                            // 🔍 WAVE 339: Optics (from HAL/FixtureMapper)
                            zoom: f.zoom, // 0-255 DMX
                            focus: f.focus, // 0-255 DMX
                            // ⚒️ WAVE 2030.22g: Extended LED channels
                            white: f.white ?? 0, // 0-255 DMX
                            amber: f.amber ?? 0, // 0-255 DMX
                            // 🎛️ WAVE 339: Physics (interpolated positions from FixturePhysicsDriver)
                            physicalPan: (f.physicalPan ?? f.pan) / 255, // Normalize 0-255 → 0-1
                            physicalTilt: (f.physicalTilt ?? f.tilt) / 255, // Normalize 0-255 → 0-1
                            panVelocity: f.panVelocity ?? 0, // DMX/s (raw)
                            tiltVelocity: f.tiltVelocity ?? 0, // DMX/s (raw)
                            online: true,
                            active: f.dimmer > 0,
                            // 🔥 WAVE 2084.6: THE PHANTOM DATA LINK — Robust profileId cascade
                            // Priority: originalFixture.profileId > fixtureState.profileId > originalFixture.id
                            // NEVER let profileId be undefined — the ExtrasSection IPC depends on it
                            profileId: originalFixture?.profileId || f.profileId || originalFixture?.id || realId
                        };
                    })
                },
                timestamp: now // ⚡ WAVE 3050: unified timestamp
            };
            this.onBroadcast(truth);
            // 🧹 WAVE 671.5: Silenced SYNAPTIC BRIDGE spam (kept for future debug if needed)
            // 🧠 WAVE 260: Debug log para verificar que el contexto fluye a la UI
            // Log cada 2 segundos (60 frames @ 30fps)
            // if (this.frameCount % 60 === 0) {
            //   console.log(
            //     `[Titan] 🌉 SYNAPTIC BRIDGE: Key=${context.key ?? '---'} ${context.mode} | ` +
            //     `Genre=${context.genre.macro}/${context.genre.subGenre ?? 'none'} | ` +
            //     `BPM=${context.bpm} | Energy=${(context.energy * 100).toFixed(0)}%`
            //   )
            // }
        }
        // 🧹 WAVE 671.5: Silenced frame count spam (7-8 logs/sec)
        // Log every second
        // if (shouldLog && this.config.debug) {
        //   const currentVibe = this.engine.getCurrentVibe()
        //   console.log(`[TitanOrchestrator] Frame ${this.frameCount}: Vibe=${currentVibe}, Fixtures=${fixtureStates.length}`)
        // }
        // WAVE 3401: OSC State Publisher -- broadcast current state every 3 frames (~12Hz)
        // Low-frequency broadcast avoids flooding the network while keeping external
        // VJ/lighting software in sync with LuxSync's musical analysis.
        if (this.oscProvider && this.frameCount % 3 === 0) {
            const currentVibe = this.engine?.getCurrentVibe() ?? 'idle';
            this.oscProvider.publishState({
                vibe: currentVibe,
                energy,
                bpm: context.bpm,
                onBeat: beatState.onBeat,
                section: context.section?.type ?? 'unknown',
                bands: [
                    bass,
                    this.syncSmoother.currentSmoothed.subBass ?? 0,
                    this.syncSmoother.currentSmoothed.lowMid ?? 0,
                    mid,
                    this.syncSmoother.currentSmoothed.highMid ?? 0,
                    high,
                    this.syncSmoother.currentSmoothed.spectralCentroid ?? 0,
                ]
            });
        }
    }
    /**
     * Set the current vibe
     * 🎯 WAVE 289: Propagate vibe to Workers for Vibe-Aware Section Tracking
     * 🔧 WAVE 2040.3: Fixed HAL receiving legacy alias instead of normalized ID
     */
    setVibe(vibeId) {
        if (this.engine) {
            // 1️⃣ Set vibe in engine (normalizes legacy aliases internally)
            this.engine.setVibe(vibeId);
            // 2️⃣ Get the ACTUAL normalized vibe ID from engine
            // This ensures HAL receives 'techno-club' not 'techno'
            const normalizedVibeId = this.engine.getCurrentVibe();
            console.log(`[TitanOrchestrator] Vibe set to: ${normalizedVibeId}`);
            // WAVE 257: Log vibe change to Tactical Log
            this.log('Mode', `🎭 Vibe changed to: ${normalizedVibeId.toUpperCase()}`);
            // 🎯 WAVE 289: Propagate vibe to Trinity Workers
            // El SectionTracker en los Workers usará perfiles vibe-aware
            if (this.trinity) {
                this.trinity.setVibe(normalizedVibeId);
                console.log(`[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers`);
            }
            // 🎯 WAVE 338: Propagate vibe to HAL for Movement Physics
            // 🔧 WAVE 2040.3: FIX - Use normalizedVibeId so HAL gets 'techno-club' not 'techno'
            // Los movers usarán física diferente según el vibe
            if (this.hal) {
                this.hal.setVibe(normalizedVibeId);
                console.log(`[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe`);
            }
            // 🧨 WAVE 2140: AMNESIA PROTOCOL — Hard reset del Pacemaker en BETA.
            // Un cambio de Vibe = nuevo track = el BPM anterior es basura.
            // Obligamos al motor a escuchar en blanco.
            if (this.trinity) {
                this.trinity.resetPacemaker();
                console.log(`[TitanOrchestrator] 🧨 WAVE 2140: Pacemaker reset triggered by vibe change → ${normalizedVibeId}`);
            }
            // 🌊 WAVE 2432: THE GREAT WIRING — Hot-swap profile on vibe change
            this.engine.setActiveProfile(normalizedVibeId);
            // 🧹 WAVE 3230: THE VIBE RESET — Clean Slate al cambiar de motor de físicas
            // Un cambio de Vibe es un cambio de universo. Los overrides manuales del
            // Layer 2 pertenecen al universo anterior. Limpiarlos garantiza que el
            // nuevo estado se hidrate desde cero desde la AI (Layer 0).
            // WAVE 4703: ArbitrationDirector bypased (WAVE 4592) — releaseAllManualOverrides removed.
            // L2 manual overrides en NodeArbiter se limpian via getAetherArbiter().releaseAll() si aplica.
            console.log(`[TitanOrchestrator] 🧹 WAVE 3230: Clean Slate for vibe ${normalizedVibeId}`);
        }
    }
    /**
     * 🎨 WAVE 2019.6: Force Palette Sync
     *
     * Regenera la paleta del Engine usando el color constitution del Vibe activo.
     * Usado por Chronos Timeline para sincronizar Stage color al cambiar Vibe.
     */
    forcePaletteSync() {
        if (this.engine) {
            this.engine.forcePaletteRefresh();
            console.log(`[TitanOrchestrator] 🎨 Palette forcefully synced to current vibe`);
        }
    }
    /**
     * 🎭 WAVE 700.5.4: Set the current mood (calm/balanced/punk)
     *
     * Mood controls effect frequency and intensity:
     * - CALM: 1-3 EPM (effects minimal, paleta respira)
     * - BALANCED: 4-6 EPM (narrativa visual)
     * - PUNK: 8-10 EPM (caos controlado)
     */
    setMood(moodId) {
        if (this.engine) {
            // Access backend MoodController singleton (already imported at top)
            MoodController.getInstance().setMood(moodId);
            console.log(`[TitanOrchestrator] 🎭 Mood set to: ${moodId.toUpperCase()}`);
            this.log('Mode', `🎭 Mood changed to: ${moodId.toUpperCase()}`);
        }
    }
    /**
     * 🎭 WAVE 700.5.4: Get the current mood
     */
    getMood() {
        return MoodController.getInstance().getCurrentMood();
    }
    /**
     * 👻 WAVE 2540.4: THE PHANTOM BUFFER — Cache pre-calculated GodEar heatmap
     * in TitanEngine for offline band lookup during timeline playback.
     */
    setChronosHeatmap(heatmap) {
        if (this.engine) {
            this.engine.setChronosHeatmap(heatmap);
        }
    }
    /**
     * 👻 WAVE 2540.5: PLAYHEAD SYNC — Forward Chronos playhead to TitanEngine.
     * Called every frame from the frontend during Chronos playback.
     */
    setChronosPlayhead(timeMs, isPlaying) {
        if (this.engine) {
            this.engine.setChronosPlayhead(timeMs, isPlaying);
        }
    }
    /**
     * WAVE 254: Set mode (auto/manual)
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`[TitanOrchestrator] Mode set to: ${mode}`);
        // WAVE 257: Log mode change to Tactical Log
        this.log('System', `⚙️ Mode: ${mode.toUpperCase()}`);
    }
    /**
     * WAVE 254: Enable/disable brain processing (Layer 0 + Layer 1)
     * 🔴 DEPRECATED for consciousness control - use setConsciousnessEnabled instead
     * This kills EVERYTHING (blackout) - only use for full system stop
     */
    setUseBrain(enabled) {
        this.useBrain = enabled;
        console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)`);
        this.log('System', `🧠 Brain: ${enabled ? 'ONLINE' : 'OFFLINE'}`);
    }
    /**
     * 🧬 WAVE 560: Enable/disable consciousness ONLY (Layer 1)
     *
     * This is the CORRECT toggle for the AI switch:
     * - When OFF: Layer 0 (física reactiva) keeps running
     * - When ON: Layer 1 (consciousness) provides recommendations
     *
     * NO MORE BLACKOUT!
     */
    setConsciousnessEnabled(enabled) {
        this.consciousnessEnabled = enabled;
        // Propagar al TitanEngine (Selene V2)
        if (this.engine) {
            this.engine.setConsciousnessEnabled(enabled);
        }
        console.log(`[TitanOrchestrator] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`);
        this.log('Brain', `🧬 Consciousness: ${enabled ? 'ACTIVE' : 'STANDBY'}`);
    }
    /**
     * 🌊 WAVE 2401: Set Liquid Stereo mode (7-band per-zone envelopes)
     */
    setLiquidStereo(enabled) {
        if (this.engine) {
            this.engine.setLiquidStereo(enabled);
        }
        console.log(`[TitanOrchestrator] 🌊 Liquid Stereo: ${enabled ? 'ACTIVE' : 'OFF'}`);
        this.log('Physics', `🌊 Liquid Stereo: ${enabled ? '7-BAND' : 'GOD MODE'}`);
    }
    /**
     * 🌊 WAVE 2432: THE GREAT WIRING — Layout Switch (4.1 / 7.1)
     */
    setLiquidLayout(mode) {
        this.currentLiquidLayout = mode;
        if (this.engine) {
            this.engine.setLiquidLayout(mode);
        }
        console.log(`[TitanOrchestrator] 🌊 Layout: ${mode}`);
        this.log('Physics', `🌊 Layout switched to ${mode}`);
    }
    getLiquidLayout() {
        return this.currentLiquidLayout;
    }
    /**
     * 🧬 WAVE 560: Get consciousness state
     */
    isConsciousnessEnabled() {
        return this.consciousnessEnabled;
    }
    /**
     * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
     * ⚒️ WAVE 2030.4: Hephaestus curve automation support
     *
     * Dispara un efecto manualmente sin esperar decisión de HuntEngine.
     * Útil para testear efectos visuales sin alterar umbrales de los algoritmos.
     *
     * FLOW:
     * 1. Frontend llama window.lux.forceStrike({ effect: 'solar_flare', intensity: 1.0 })
     * 2. IPC handler llama titanOrchestrator.forceStrikeNextFrame(config)
     * 3. Este método llama engine's forceStrikeNextFrame(config)
     * 4. TitanEngine fuerza un trigger de EffectManager en el próximo frame
     * 5. ⚒️ WAVE 2030.4: Si config.hephCurves existe, EffectManager crea un overlay
     *
     * @param config - ForceStrikeConfig with effect, intensity, source, and optional hephCurves
     */
    forceStrikeNextFrame(config) {
        if (!this.engine) {
            console.warn('[TitanOrchestrator] 🧨 Cannot force strike - Engine not initialized');
            return;
        }
        const sourceLabel = config.source === 'chronos' ? 'CHRONOS' : 'Manual';
        const hephTag = config.hephCurves ? ` ⚒️[HEPH: ${config.hephCurves.curves.size}]` : '';
        console.log(`[TitanOrchestrator] 🧨 ${sourceLabel} STRIKE: ${config.effect} @ ${config.intensity.toFixed(2)}${hephTag}`);
        this.log('Effect', `🧨 ${sourceLabel} Strike: ${config.effect}`, { intensity: config.intensity });
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
     * ⚡ WAVE 2510: Set callback for hot-frame broadcast (44Hz fixture data)
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
     * 🔥 WAVE 1012.5: HYBRID SOURCE — Frontend = 30fps bass/mid/high/energy, Worker = extended FFT
     * ⚡ WAVE 3060b PHOENIX: RESTAURADO como hot-path. Frontend tiene prioridad visual.
     */
    processAudioFrame(data) {
        if (!this.isRunning || !this.useBrain)
            return;
        // Core bands - FRONTEND SOURCE (30fps)
        const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass;
        const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid;
        const high = typeof data.treble === 'number' ? data.treble :
            typeof data.high === 'number' ? data.high : this.lastAudioData.high;
        const energy = typeof data.energy === 'number' ? data.energy : this.lastAudioData.energy;
        // 🔥 WAVE 1012.5: HYBRID MERGE — Frontend core + preserve Worker extended
        this.lastAudioData = {
            bass,
            mid,
            high,
            energy,
            // Preserve Worker FFT metrics
            harshness: this.lastAudioData.harshness,
            spectralFlatness: this.lastAudioData.spectralFlatness,
            spectralCentroid: this.lastAudioData.spectralCentroid,
            subBass: this.lastAudioData.subBass,
            lowMid: this.lastAudioData.lowMid,
            highMid: this.lastAudioData.highMid,
            kickDetected: this.lastAudioData.kickDetected,
            snareDetected: this.lastAudioData.snareDetected,
            hihatDetected: this.lastAudioData.hihatDetected,
            rawBassEnergy: this.lastAudioData.rawBassEnergy,
            crestFactor: this.lastAudioData.crestFactor,
            workerBpm: this.lastAudioData.workerBpm,
            workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
            workerOnBeat: this.lastAudioData.workerOnBeat,
            workerBeatPhase: this.lastAudioData.workerBeatPhase,
            workerBeatStrength: this.lastAudioData.workerBeatStrength,
            workerKickCount: this.lastAudioData.workerKickCount,
        };
        // Detect audio presence
        const wasAudioActive = this.hasRealAudio;
        this.hasRealAudio = energy > 0.01;
        if (this.hasRealAudio && !this.hasLoggedFirstAudio) {
            this.hasLoggedFirstAudio = true;
            this.log('System', '🎧 AUDIO DETECTED - Selene is now listening!');
        }
        else if (!this.hasRealAudio && wasAudioActive) {
            this.log('System', '🔇 AUDIO LOST - Waiting for signal...');
        }
        this.lastAudioTimestamp = Date.now();
    }
    processAudioBuffer(buffer) {
        const _audioStart = performance.now(); // 🔬 WAVE 3041: SONDA AUDIO
        // 🔍 WAVE 264.7: LOG CUANDO SE RECHAZA
        if (!this.isRunning || !this.useBrain) {
            this.audioBufferRejectCount++;
            if (this.audioBufferRejectCount % 60 === 1) { // Log cada ~1 segundo
                console.warn(`[TitanOrchestrator] ⛔ audioBuffer REJECTED #${this.audioBufferRejectCount} | isRunning=${this.isRunning} | useBrain=${this.useBrain}`);
            }
            return;
        }
        // � WAVE 3040: Loop RMS eliminado — buffer.reduce sobre 8192 floats
        // aunque sea cada 300 frames es trabajo innecesario en el hilo principal.
        // El buffer llega correctamente — log eliminado.
        // 🗡️ WAVE 265: Update timestamp - el buffer llegando ES la señal de que el frontend vive
        this.lastAudioTimestamp = Date.now();
        // WAVE 3424: TWO MASTERS GUARD — Early exit si la fuente activa del AudioMatrix
        // NO es legacy-bridge. Cuando VW (u otra fuente SAB) está activa, AudioMatrix.ingestAudio()
        // rechaza el dato IPC con `source !== effectiveSource`. Pero el trabajo ya habría
        // ocurrido: applyMicHeadroom (O(n) loop), write al SAB, etc.
        // Cortamos aquí: si audioMatrix existe y la fuente activa es SAB, no hay nada que hacer.
        if (this.trinity) {
            const _matrix = this.trinity.getAudioMatrix();
            if (_matrix) {
                const _matrixStatus = _matrix.getStatus();
                if (_matrixStatus.activeSource && _matrixStatus.activeSource !== 'legacy-bridge') {
                    // Fuente SAB activa — el IPC data es redundante, AudioMatrix lo rechazará de todos modos.
                    // Marcamos timestamp pero descartamos el buffer para evitar trabajo innecesario.
                    return;
                }
            }
        }
        // 🩸 Send raw buffer to Trinity -> BETA Worker for FFT
        if (this.trinity) {
            this.trinity.feedAudioBuffer(buffer);
        }
        else {
            console.warn(`[TitanOrchestrator] ⚠️ trinity is null! Buffer discarded.`);
        }
        // 🔬 WAVE 3041: acumular telemetría de coste del handler de audio
        const _audioCostMs = performance.now() - _audioStart;
        if (!this._audioSondaCount)
            this._audioSondaCount = 0;
        if (!this._audioSondaTotal)
            this._audioSondaTotal = 0;
        this._audioSondaCount++;
        this._audioSondaTotal += _audioCostMs;
        if (this._audioSondaCount % 40 === 0) { // ~2s a 20fps
            const _avg = (this._audioSondaTotal / 40).toFixed(3);
            console.warn(`[SONDA AUDIO] 🔬 avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`);
            this.log('Error', `[SONDA AUDIO] 🔬 avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`);
            this._audioSondaCount = 0;
            this._audioSondaTotal = 0;
        }
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
        // 🎨 WAVE 686.11: Normalize address field for ALL downstream consumers (Arbiter + HAL)
        this.fixtures = fixtures.map(f => ({
            ...f,
            dmxAddress: f.dmxAddress || f.address, // Ensure dmxAddress exists regardless of format
            isVirtual: f.isVirtual ?? false, // 🛡️ WAVE 3110: Normalize virtual flag
        }));
        this._updateAetherStageBounds(stageBounds);
        // 🔥 WAVE 2183: GHOST EXORCISM — Invalidate HAL profile caches on fixture sync
        // When the Forge renames/edits a profile, reconcileFixturesWithProfile updates the
        // stageStore, TitanSyncBridge re-sends fixtures here, and HAL must drop its stale cache.
        if (this.hal) {
            this.hal.invalidateProfileCache();
        }
        //  WAVE 2432 AUTO-DETECT: Detectar y auto-setear el layout basado en PAR fixtures
        // Si el show tiene PAR stereo (L/R), usa LiquidEngine71. De lo contrario, 4.1.
        const detectedLayout = detectLiquidLayoutFromFixtures(this.fixtures);
        this.setLiquidLayout(detectedLayout);
        // 🔥 WAVE 339.6: Register movers in PhysicsDriver
        // Without this, PhysicsDriver doesn't know about the fixtures and returns fallback values
        //
        // 🚨 WAVE 4575-B: IK DUALITY GATE
        // isPlaced=false → Classic Pan/Tilt domain. Spatial enrichment (IK) MUST be skipped.
        // Feeding 3D IK parameters to a 2D fixture causes incorrect DMX output on real hardware.
        // isPlaced=true (or undefined, legacy) → Full IK path in HAL PhysicsDriver.
        let moverCount = 0;
        for (const fixture of fixtures) {
            if (fixture.hasMovementChannels) {
                // 🚨 WAVE 4575-B: Skip IK registration for Classic (2D) domain fixtures
                if (fixture.isPlaced === false) {
                    continue;
                }
                // Register in HAL's physics driver
                if (this.hal) {
                    // 🧭 WAVE 4573 Phase 5c: Read from fixture.orientation (root) — not installationType (legacy)
                    // installationType was the old field; orientation is the canonical WAVE 4573 source of truth.
                    const installOrientation = fixture.orientation || fixture.installationType || 'ceiling';
                    this.hal.registerMover(fixture.id, installOrientation);
                    moverCount++;
                }
            }
        }
        // WAVE 2098: Boot silence
        // ⚡ WAVE 4594: THE AETHER AWAKENING — inject all fixtures into Aether NodeGraph
        this._syncFixturesToAether(this.fixtures);
        return detectedLayout;
    }
    /**
     * ⚡ WAVE 4594: THE AETHER AWAKENING — Aether Patch Bridge
     *
     * Sincroniza la lista completa de fixtures con el NodeGraph de Aether.
     * Full-resync strategy: unregister all → re-register all.
     * Llamado exclusivamente desde setFixtures() — nunca desde el hot-path (44Hz).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _syncFixturesToAether(fixtures) {
        // 1. Lazy-init del pipeline (stateless, reutilizado en cada sync)
        if (!this._aetherPipeline) {
            this._aetherPipeline = new NodeExtractionPipeline();
        }
        const pipeline = this._aetherPipeline;
        // 2. Unregistrar todos los devices actualmente en el NodeGraph (resync limpio)
        const existingIds = [...this._aetherGraph.getDeviceIds()];
        for (const deviceId of existingIds) {
            this._aetherGraph.unregisterDevice(deviceId);
        }
        this._aetherHasDevices = false;
        // 3. Registrar cada fixture como un Device Aether
        let registered = 0;
        for (const fixture of fixtures) {
            if (!fixture.id) {
                continue;
            }
            try {
                let definition = this._resolveFixtureDefinitionForAether(fixture);
                // ⚡ WAVE 4610-B Acción A: si la resolución falla o devuelve channels vacíos,
                // construir una definición mínima con un canal dimmer sintético siempre que
                // el fixture tenga profileId u otro identificador estructural válido.
                // Esto evita descartar fixtures válidos que lleguen sin perfil en runtime.
                if (!definition || definition.channels.length === 0) {
                    const profileId = this._resolveFixtureProfileId(fixture);
                    if (!profileId && !fixture.profileId && !fixture.id) {
                        continue;
                    }
                    const minimalDimmerChannel = {
                        index: 1,
                        name: 'Dimmer',
                        // ⚡ WAVE 4610-B Acción B: el type ya pasa por _normalizeFixtureChannelType
                        // que aplica toLowerCase(), pero el canal sintético se crea directamente
                        // con el literal normalizado para evitar cualquier riesgo de mismatch.
                        type: 'dimmer',
                        defaultValue: 0,
                        is16bit: false,
                    };
                    definition = {
                        id: profileId ?? fixture.id,
                        name: fixture.name ?? fixture.id ?? 'Unknown Fixture',
                        manufacturer: fixture.manufacturer ?? 'Unknown',
                        type: this._normalizeFixtureType(fixture.type),
                        channels: [minimalDimmerChannel],
                        physics: fixture.physics,
                        capabilities: fixture.capabilities,
                        wheels: fixture.wheels,
                    };
                    console.warn(`[TitanOrchestrator] ⚡ WAVE 4610-B: Fixture "${fixture.id}" sin perfil resuelto — inyectando definición mínima (dimmer)`);
                }
                const fixtureV2 = this._buildFixtureV2ForAether(fixture, definition);
                const deviceDef = pipeline.extract(definition, fixtureV2);
                // ⚡ WAVE 4610-B Acción C: pasar forgeGraph si el fixture lo trae
                // (serializado desde ForgeView o cargado desde show file).
                const forgeGraph = fixture.forgeGraph ?? undefined;
                this.registerAetherDevice(deviceDef, forgeGraph);
                registered++;
                // 🔦 WAVE 4674 PASO 3: Log de registro por fixture — PARs y estáticos incluidos.
                // Muestra nodeIds generados para verificar que color/impact siempre aparecen.
                const nodeIds = deviceDef.nodes.map(n => `${String(n.nodeId)}(${n.family})`).join(', ');
                console.log(`[TitanOrchestrator] ✅ WAVE 4674: Fixture "${fixture.id}" (${fixture.type ?? '?'}) ` +
                    `→ Aether @ dmx:${deviceDef.dmxAddress}/u${deviceDef.universe} | nodes: [${nodeIds}]`);
            }
            catch (err) {
                console.warn(`[TitanOrchestrator] ⚡ WAVE 4594: Aether sync SKIPPED fixture "${fixture.id}" ` +
                    `(type="${fixture.type ?? '?'}", name="${fixture.name ?? '?'}"):`, err);
            }
        }
        // WAVE 4663 FIX: Reconstruir ZoneNodeRouter y SeleneAetherAdapter DESPUÉS de que
        // todos los fixtures están en el NodeGraph. El router cachea zone→nodeIds en
        // construcción; si se construye antes de registrar fixtures, el caché queda
        // vacío y Selene no puede emitir intents → efectos invisibles en la UI.
        this._zoneNodeRouter = new ZoneNodeRouter(this._aetherGraph);
        this._seleneAetherAdapter = new SeleneAetherAdapter(this._zoneNodeRouter);
        void registered;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _resolveFixtureDefinitionForAether(fixture) {
        const profileId = this._resolveFixtureProfileId(fixture);
        const runtimeDefinition = resolveRuntimeFixtureDefinition([
            profileId,
            fixture.profileId,
            fixture.definitionId,
            fixture.fixtureDefId,
            fixture.definitionPath,
            fixture.model,
            fixture.name,
        ]);
        if (runtimeDefinition) {
            return this._normalizeFixtureDefinitionForAether(runtimeDefinition, fixture, profileId);
        }
        if (Array.isArray(fixture.channels) && fixture.channels.length > 0) {
            return this._normalizeFixtureDefinitionForAether({
                id: profileId ?? fixture.id,
                name: fixture.name ?? fixture.id ?? 'Unknown Fixture',
                manufacturer: fixture.manufacturer ?? 'Unknown',
                type: this._normalizeFixtureType(fixture.type),
                channels: fixture.channels,
                physics: fixture.physics,
                capabilities: fixture.capabilities,
                wheels: fixture.wheels,
            }, fixture, profileId);
        }
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _normalizeFixtureDefinitionForAether(definition, fixture, profileId) {
        const rawChannels = Array.isArray(definition.channels) && definition.channels.length > 0
            ? definition.channels
            : Array.isArray(fixture.channels) ? fixture.channels : [];
        const channels = rawChannels
            .filter((channel) => channel)
            .map((channel, idx) => {
            const type = this._normalizeFixtureChannelType(channel.type, channel.name ?? channel.customName);
            return {
                index: this._normalizeFixtureChannelIndex(channel.index, idx + 1),
                name: channel.name ?? channel.customName ?? type,
                type,
                defaultValue: this._resolveAetherChannelDefaultValue(type, channel.defaultValue),
                is16bit: channel.is16bit === true,
                ...(channel.customName ? { customName: channel.customName } : {}),
                ...(channel.continuousRotation === true ? { continuousRotation: true } : {}),
            };
        });
        // 🧮 WAVE 4674 PASO 2: FIX COLISIÓN DMX — Detectar índices duplicados.
        // Si tras la normalización dos o más canales tienen el mismo index (e.g. todos
        // index=1 porque el perfil almacenó los índices como 0-based sin conversión),
        // NodeExtractionPipeline los traduciría todos a dmxOffset=0 → colisión masiva.
        // Solución: si los índices no son todos únicos, reasignar en orden posicional (1-based).
        const indexSet = new Set(channels.map(ch => ch.index));
        const hasDuplicateIndices = indexSet.size < channels.length;
        if (hasDuplicateIndices) {
            console.warn(`[TitanOrchestrator] ⚠️ WAVE 4674: fixture "${fixture.id ?? profileId}" tiene índices de canal duplicados ` +
                `(${channels.map(c => c.index).join(',')}) — reasignando posicionalmente (1-based) para evitar colisión DMX.`);
        }
        const finalChannels = hasDuplicateIndices
            ? channels.map((ch, i) => ({ ...ch, index: i + 1 }))
            : channels;
        return {
            ...definition,
            id: profileId ?? definition.id ?? fixture.id,
            name: definition.name ?? fixture.name ?? profileId ?? fixture.id ?? 'Unknown Fixture',
            manufacturer: definition.manufacturer ?? fixture.manufacturer ?? 'Unknown',
            type: this._normalizeFixtureType(definition.type ?? fixture.type),
            channels: finalChannels,
            physics: definition.physics ?? fixture.physics,
            capabilities: definition.capabilities ?? fixture.capabilities,
            wheels: definition.wheels ?? fixture.wheels,
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _buildFixtureV2ForAether(fixture, definition) {
        const profileId = this._resolveFixtureProfileId(fixture) ?? definition.id;
        return {
            id: fixture.id,
            name: fixture.name ?? definition.name ?? fixture.id,
            model: fixture.model ?? definition.name ?? fixture.name ?? fixture.id,
            manufacturer: fixture.manufacturer ?? definition.manufacturer ?? 'Unknown',
            type: this._normalizeFixtureType(fixture.type ?? definition.type),
            address: fixture.dmxAddress ?? fixture.address ?? 1,
            universe: fixture.universe ?? 0,
            channelCount: definition.channels.length,
            profileId,
            position: fixture.position ?? { x: 0, y: 0, z: 0 },
            rotation: fixture.rotation ?? { x: 0, y: 0, z: 0 },
            orientation: fixture.orientation ?? fixture.installationType ?? 'ceiling',
            // WAVE 4626: usar ?? en lugar de || para que isPlaced=true no sea anulado.
            // || evalua false como falsy — fixture.isPlaced=true seguiría correcto,
            // pero si llega undefined (campo ausente), ?? cae a false correctamente
            // y si llega false (guerrilla mode) también preserva false. Sin regressions.
            isPlaced: fixture.isPlaced ?? false,
            physics: fixture.physics ?? {
                motorType: 'stepper',
                maxAcceleration: 0,
                safetyCap: false,
            },
            zone: this._normalizeAetherZone(fixture.zone),
            definitionPath: fixture.definitionPath,
            enabled: fixture.enabled ?? true,
            isVirtual: fixture.isVirtual ?? false,
            channels: definition.channels,
            capabilities: fixture.capabilities ?? definition.capabilities,
            calibration: fixture.calibration,
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _resolveFixtureProfileId(fixture) {
        const rawProfileId = fixture.profileId || fixture.definitionId || fixture.fixtureDefId || fixture.id;
        return typeof rawProfileId === 'string' && rawProfileId.length > 0 ? rawProfileId : null;
    }
    _normalizeFixtureChannelIndex(rawIndex, fallback) {
        if (typeof rawIndex === 'number' && Number.isFinite(rawIndex)) {
            return rawIndex > 0 ? Math.trunc(rawIndex) : fallback;
        }
        if (typeof rawIndex === 'string') {
            const parsed = Number.parseInt(rawIndex, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return fallback;
    }
    _normalizeFixtureChannelType(type, name) {
        const normalized = typeof type === 'string' ? type.toLowerCase() : this._inferFixtureChannelTypeFromName(name);
        switch (normalized) {
            case 'dimmer':
            case 'strobe':
            case 'shutter':
            case 'red':
            case 'green':
            case 'blue':
            case 'white':
            case 'amber':
            case 'uv':
            case 'cyan':
            case 'magenta':
            case 'yellow':
            case 'color_wheel':
            case 'pan':
            case 'pan_fine':
            case 'tilt':
            case 'tilt_fine':
            case 'gobo':
            case 'gobo_rotation':
            case 'prism':
            case 'prism_rotation':
            case 'focus':
            case 'zoom':
            case 'frost':
            case 'speed':
            case 'macro':
            case 'control':
            case 'rotation':
            case 'custom':
                return normalized;
            default:
                return 'unknown';
        }
    }
    _inferFixtureChannelTypeFromName(name) {
        if (typeof name !== 'string')
            return 'unknown';
        const normalizedName = name.toLowerCase();
        if (normalizedName.includes('dimmer') || normalizedName.includes('intensity'))
            return 'dimmer';
        if (normalizedName.includes('shutter'))
            return 'shutter';
        if (normalizedName.includes('strobe'))
            return 'strobe';
        if (normalizedName.includes('pan'))
            return 'pan';
        if (normalizedName.includes('tilt'))
            return 'tilt';
        if (normalizedName === 'red' || normalizedName.includes(' red'))
            return 'red';
        if (normalizedName === 'green' || normalizedName.includes(' green'))
            return 'green';
        if (normalizedName === 'blue' || normalizedName.includes(' blue'))
            return 'blue';
        if (normalizedName === 'white' || normalizedName.includes(' white'))
            return 'white';
        return 'unknown';
    }
    _resolveAetherChannelDefaultValue(type, value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            if (value < 0)
                return 0;
            if (value > 255)
                return 255;
            return Math.round(value);
        }
        if (type === 'pan' || type === 'tilt')
            return 128;
        if (type === 'shutter' || type === 'strobe')
            return 255;
        return 0;
    }
    _normalizeFixtureType(type) {
        switch (typeof type === 'string' ? type.toLowerCase() : 'generic') {
            case 'moving-head':
            case 'scanner':
            case 'par':
            case 'bar':
            case 'wash':
            case 'strobe':
            case 'effect':
            case 'laser':
            case 'blinder':
            case 'fan':
            case 'fog':
            case 'mirror-ball':
            case 'pyro':
            case 'generic':
                return (typeof type === 'string' ? type.toLowerCase() : 'generic');
            case 'spot':
                return 'moving-head';
            default:
                return 'generic';
        }
    }
    _normalizeAetherZone(zone) {
        if (typeof zone !== 'string' || zone.length === 0)
            return 'unassigned';
        return zone;
    }
    _updateAetherStageBounds(stageBounds) {
        const bounds = this._aetherStageBounds;
        // WAVE 4622-A Mission 2: STAGE BOUNDS AUDIT — verify propagation to PhysicsPostProcessor
        console.log(`[STAGE-BOUNDS] input=(${stageBounds?.width?.toFixed(2) ?? 'N/A'},${stageBounds?.height?.toFixed(2) ?? 'N/A'},${stageBounds?.depth?.toFixed(2) ?? 'N/A'}) ` +
            `current=(${bounds.width.toFixed(2)},${bounds.height.toFixed(2)},${bounds.depth.toFixed(2)})`);
        if (stageBounds) {
            if (Number.isFinite(stageBounds.width) && stageBounds.width > 0) {
                bounds.width = stageBounds.width;
            }
            if (Number.isFinite(stageBounds.height) && stageBounds.height > 0) {
                bounds.height = stageBounds.height;
            }
            if (Number.isFinite(stageBounds.depth) && stageBounds.depth > 0) {
                bounds.depth = stageBounds.depth;
            }
        }
        let sumY = 0;
        let count = 0;
        for (const fixture of this.fixtures) {
            const y = fixture?.position?.y;
            if (typeof y === 'number' && Number.isFinite(y)) {
                sumY += y;
                count++;
            }
        }
        const avgY = count > 0 ? (sumY / count) : bounds.height * 0.5;
        bounds.centerY = Math.max(0, Math.min(bounds.height, avgY));
        // WAVE 4617-B M3: Propagar dimensiones al PhysicsPostProcessor para que
        // la inercia espacial escale proporcionalmente al escenario real.
        this._physicsPostProcessor.setStageBounds(bounds.width, bounds.height, bounds.depth);
    }
    /**
     * WAVE 4590: Output gate canonical state for Aether pipeline.
     */
    setOutputEnabled(enabled) {
        const nextEnabled = !!enabled;
        this._outputEnabled = nextEnabled;
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
     * WAVE 4703: Fixture query API — replaces masterArbiter.getFixtureIds().
     * Used by TimelineEngine and HephaestusRuntime for zone resolution.
     */
    getFixtureIds() {
        return this.fixtures.map((f) => f.id);
    }
    /**
     * WAVE 4703: Zone mapping data — replaces masterArbiter.getFixturesForZoneMapping().
     */
    getFixturesForZoneMapping() {
        return this.fixtures.map((f) => ({
            id: f.id,
            zone: f.zone || '',
            position: f.position,
            enabled: f.enabled !== false,
        }));
    }
    /**
     * WAVE 4703: Zone ID → fixture IDs resolution — replaces masterArbiter.getFixtureIdsByZone().
     */
    getFixtureIdsByZone(effectZone) {
        const fixtures = this.getFixturesForZoneMapping();
        const result = resolveZone(effectZone, fixtures);
        if (result.length === 0) {
            console.warn(`[TitanOrchestrator] ⚠️ Zone "${effectZone}" matched 0 fixtures — falling back to wildcard`);
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
// ⚡ WAVE 2510: Full truth broadcast divider
// At 44Hz tick, send full SeleneTruth every TRUTH_BROADCAST_DIVIDER ticks (~7Hz)
TitanOrchestrator.TRUTH_BROADCAST_DIVIDER = 6;
// ⚡ WAVE 3050: HOT FRAME BROADCAST DIVIDER
// Decouple IPC rate from DMX engine rate. DMX runs at 44Hz, UI gets hot-frames at 44Hz.
// ⚡ WAVE 4559: Overclock — subido de 2 (22Hz) a 1 (44Hz).
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
        console.warn('[TitanOrchestrator] ⚠️ No instance registered, creating new one');
        orchestratorInstance = new TitanOrchestrator();
    }
    return orchestratorInstance;
}
/**
 * WAVE 380: Register an existing instance as the singleton
 * Call this from main.ts after creating the orchestrator
 */
export function registerTitanOrchestrator(instance) {
    if (orchestratorInstance && orchestratorInstance !== instance) {
        console.warn('[TitanOrchestrator] ⚠️ Replacing existing singleton instance');
    }
    orchestratorInstance = instance;
}
