/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * WAVE 374: MASTER ARBITER INTEGRATION
 * âš’ï¸ WAVE 2030.4: HEPHAESTUS INTEGRATION
 * ðŸ”’ WAVE 2211: PIPELINE EXORCISM â€” Async Stampede Guard + IPC Throttle + GC reduction
 * 
 * Orquesta Brain -> Engine -> Arbiter -> HAL pipeline.
 * main.ts se encarga de IPC handlers, este mÃ³dulo solo orquesta el flujo de datos.
 * 
 * @module TitanOrchestrator
 */

import { TrinityBrain } from '../../brain/TrinityBrain'
import { TitanEngine } from '../../engine/TitanEngine'
import { HardwareAbstraction } from '../../hal/HardwareAbstraction'
import { EventRouter, getEventRouter } from './EventRouter'
import { getTrinity, TrinityOrchestrator } from '../../workers/TrinityOrchestrator'
import { 
  SeleneTruth, 
  createDefaultTruth,
  createDefaultCognitive,
  createDefaultSensory 
} from '../protocol/SeleneProtocol'

// ðŸŽ­ WAVE 374: Import Arbiter types (masterArbiter singleton removed WAVE 4703)
import { 
  type Layer0_Titan,
  type FinalLightingTarget,
  type EffectIntentMap,
  type EffectIntent,
  ControlLayer 
} from '../arbiter'

// ðŸ§¨ WAVE 635: Import EffectManager para color override global
// ðŸš€ WAVE 4524.3: TambiÃ©n necesario para SCN
import { getEffectManager } from '../effects/EffectManager'

// â¤ï¸ WAVE 1153: THE PACEMAKER - Real Beat Detection
import { BeatDetector } from '../../engine/audio/BeatDetector'

// ðŸŽ­ WAVE 700.5.4: Import MoodController for backend mood control
import { MoodController } from '../mood/MoodController'

// âš’ï¸ WAVE 2030.4: Hephaestus types
import type { HephAutomationClip } from '../hephaestus/types'

// âš’ï¸ WAVE 2030.19: HephaestusRuntime for .lfx execution
import { getHephaestusRuntime } from './IPCHandlers'
import type { HephFixtureOutput } from '../hephaestus/runtime/HephaestusRuntime'

// ðŸŽµ WAVE 2672â†’2720: Harmonic Quantizer MIGRADO AL HAL
// La cuantizaciÃ³n armÃ³nica vive ahora en HAL.translateColorToWheel()
// (LA LEY UNIVERSAL DEL PÃ‰NDULO â€” WAVE 2720)

// Use inline type to avoid import issues
type VibeId = 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge' | 'idle'

// ðŸŽ¨ WAVE 686.10: Import IDMXDriver for external driver injection
import type { IDMXDriver } from '../../hal/drivers'

// WAVE 3401: OSC Nexus Provider for bidirectional OSC over UDP
import { OSCNexusProvider } from '../audio/OSCNexusProvider'
// WAVE 3402: Native audio providers
import { VirtualWireProvider } from '../audio/VirtualWireProvider'
import { USBDirectLinkProvider } from '../audio/USBDirectLinkProvider'

// âš¡ WAVE 3504.5: Extracted math + scheduling modules
import { SyncSmoother } from './metrics/SyncSmoother'
import { IntentComposer } from './intent/IntentComposer'
import { FrameScheduler } from './scheduler/FrameScheduler'
import type { FixtureSnapshot } from './intent/types'

// âš›ï¸ WAVE 3505.4: AETHER MATRIX â€” Agnostic Engine V2 Pipeline
import { NodeGraph, IntentBus, NodeArbiter, NodeResolver, PhysicsPostProcessor } from '../aether'
import type { IDeviceDefinition, IKineticNodeData } from '../aether'
// WAVE 4548.6: Forge Evaluator â€” compiled graphs for zero-alloc DMX
import { ForgeGraphCompiler } from '../forge/compiler/ForgeGraphCompiler'
import type { ForgeFrameContext, MutableForgeFrameContext } from '../forge/compiler/types'
import type { IForgeNodeGraph } from '../forge/types'
// ðŸŒŠ WAVE 3516.2: Adapters â€” cableado al hot-path del frame loop
import { LiquidImpactAdapter, VMMAdapter } from '../aether'
// ðŸŽ¨ WAVE 3516.3: ColorAdapter â€” extraÃ­da a su propio archivo
// ðŸŽ¨ WAVE 4522.3: Actualizado para ingesta via setIngress() (paleta RGB de SeleneLux)
import { ColorAdapter } from '../aether/adapters/ColorAdapter'
// ðŸ”¦ðŸŒ«ï¸ WAVE 3516.4: Optic & Elemental Bridges
import { BeamAdapter } from '../aether/adapters/BeamAdapter'
import { AtmosphereAdapter } from '../aether/adapters/AtmosphereAdapter'
// ðŸŒŠ WAVE 4521.3: LiquidAetherAdapter â€” Capa L0 del IntentBus
import { LiquidAetherAdapter } from '../aether/adapters/LiquidAetherAdapter'
import { NodeFamily } from '../aether'
import type { FrameContext, AudioMetrics, VibeProfile, MusicalContext } from '../aether'
// ðŸš€ WAVE 4524.3: Selene-Aether Adapter â€” Puente Cognitivo L3
import { SeleneAetherAdapter } from '../aether/adapters/selene-aether-adapter'
import { ZoneNodeRouter } from '../aether/adapters/helpers/zone-node-router'
import { ChronosAetherAdapter } from '../aether/adapters/ChronosAetherAdapter'
import { HephaestusAetherAdapter } from '../aether/adapters/HephaestusAetherAdapter'
// ðŸ›ï¸ WAVE 2483: Infinite Arsenal â€” bridge wiring (playHook â†’ HephaestusRuntime.play).
import { getSeleneHephBridge } from '../arsenal/SeleneHephBridge'
import type { ResolvedPixelParams, RenderHook } from '../arsenal/SeleneHephBridge'
import type { RegistryEntry } from '../arsenal/lfxTypes'
// ðŸŽ¨ WAVE 4812: Aether Canvas â€” Pixel Mapping engine
import { AetherCanvasManager } from '../aether/canvas/AetherCanvasManager'
import { PixelMapAetherAdapter } from '../aether/canvas/PixelMapAetherAdapter'
// ðŸ‘» WAVE 4952: PlasmaRenderer import REMOVED â€” test-pattern poltergeist amputated.
// ðŸŽ¬ WAVE 4867: TheiaVideoRenderer â€” twin-output bridge (THETA thumb SAB â†’ AetherCanvas)
import { TheiaVideoRenderer } from '../aether/canvas/renderers/TheiaVideoRenderer'
// ðŸŒ‰ WAVE 4869: SeleneTheiaBridge â€” Observer cognitivo Selene â†’ ThetaOrchestrator
import { type SeleneTheiaBridge } from '../../theia/SeleneTheiaBridge'
// ðŸ›‚ WAVE 4557: Aether Safety Middleware â€” La Aduana Aether
import { AetherSafetyMiddleware } from '../aether/egress/AetherSafetyMiddleware'
// ðŸŽ­ WAVE 4559: THE MIRROR â€” Projecta estado Aether â†’ FixtureState[] legacy para la UI
import { AetherUIProjector } from '../aether/resolver/AetherUIProjector'
// âš¡ WAVE 4594: THE AETHER AWAKENING â€” NodeExtractionPipeline for fixtureâ†’NodeGraph injection
import { NodeExtractionPipeline } from '../aether/ingestion/NodeExtractionPipeline'
import { timelineEngine } from '../engine/TimelineEngine'

// ðŸ§© WAVE 4959 PHASE 1-3: Extracted managers
import { TacticalLogManager } from './logging/TacticalLogManager'
import { TheiaBridgeManager } from './theia/TheiaBridgeManager'
import { StateManager } from './lifecycle/StateManager'
import { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager'
// ðŸ§© WAVE 4960.1 PHASE 5: Hydration managers
import { FixtureHydrationEngine } from './hydration/FixtureHydrationEngine'
import type { HydrationContext } from './hydration/FixtureHydrationEngine'
import { FixtureProfileResolver } from './hydration/FixtureProfileResolver'
import { StageBoundsManager } from './hydration/StageBoundsManager'
// ðŸ§© WAVE 4961 PHASE 6: I/O managers
import { BroadcastManager } from './tick/BroadcastManager'
import type { BroadcastManagerContext } from './tick/BroadcastManager'
import { HardwareDispatcher } from './hal/HardwareDispatcher'
import type { HardwareDispatcherContext } from './hal/HardwareDispatcher'

// ðŸ§Ÿ ZOMBIE KILLER: singleton DMX para flushing fÃ­sico en stop()
import { universalDMX } from '../../hal/drivers/UniversalDMXDriver'
// âš¡ WAVE 4700: Motor cinÃ©tico nativo L2 â€” reemplaza masterArbiter para patrones manuales
import { aetherKineticEngine } from '../aether/AetherKineticEngine'

// ðŸ§¹ WAVE 2227: VMM singleton para cleanup en stop()
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager'

// ðŸ—ºï¸ WAVE 2543.4: Centralized zone resolution
import { fixtureMatchesZone as zoneMapperMatch, resolveZone } from '../zones/ZoneMapper'

// âš¡ WAVE 3050: MODULE-LEVEL CONSTANTS â€” allocated once, reused per frame
// Zone mapping for StageSimulator2 compatibility (was recreated per fixture * per truth broadcast)
const ZONE_MAP: Readonly<Record<string, string>> = {
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
}

// Static DMX output placeholder (512 zeros) â€” no new Array(512).fill(0) per truth frame
const DMX_OUTPUT_ZEROS: readonly number[] = Object.freeze(new Array(512).fill(0))

type StageBoundsInput = {
  width: number
  height: number
  depth: number
}

const DEFAULT_AETHER_STAGE_BOUNDS = {
  width: 8,
  height: 4,
  depth: 2,
  centerY: 1.5,
}

/**
 * âš’ï¸ WAVE 2030.4: Config for manual/timeline effect triggers
 */
export interface ForceStrikeConfig {
  /** Effect ID to trigger */
  effect: string
  /** Intensity 0-1 */
  intensity: number
  /** Source of trigger for bypass rules */
  source?: 'manual' | 'chronos'
  /** âš’ï¸ WAVE 2030.4: Hephaestus automation curves */
  hephCurves?: HephAutomationClip
  /**
   * âŒ¨ WAVE 4802-D: Scoped fixture IDs.
   * When present, the effect is applied ONLY to these fixture IDs.
   * Propagates from the KeyForge chord payload through the full
   * IPC â†’ TitanEngine â†’ EffectManager pipeline.
   * Default (undefined) = all currently active fixtures.
   */
  scope?: string[]
}

/**
 * ConfiguraciÃ³n del orquestador
 */
export interface TitanConfig {
  debug?: boolean
  initialVibe?: VibeId
  /** ðŸŽ¨ WAVE 686.10: Optional external DMX driver (e.g., ArtNetDriverAdapter) */
  dmxDriver?: IDMXDriver
}

/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
  private brain: TrinityBrain | null = null
  private engine: TitanEngine | null = null
  private hal: HardwareAbstraction | null = null
  private trinity: TrinityOrchestrator | null = null  // ðŸ§  WAVE 258: Trinity reference
  private eventRouter: EventRouter

  // WAVE 3401: OSC Nexus Provider (bidirectional OSC over UDP)
  private oscProvider: OSCNexusProvider | null = null
  // WAVE 3402: Native audio providers
  private virtualWireProvider: VirtualWireProvider | null = null
  private usbDirectLinkProvider: USBDirectLinkProvider | null = null
  
  // â¤ï¸ WAVE 1153: THE PACEMAKER - Heart of the rhythm system
  private beatDetector: BeatDetector | null = null

  // ðŸ”¥ WAVE 2179: FREEWHEEL MEMORY â€” Cerebro retiene el Ãºltimo BPM estable del Worker
  // Cuando Worker conf=0 (break, silencio, transiciÃ³n), el PLL freewheela
  // en la frecuencia correcta en lugar de caer al default 120 BPM del Pacemaker.
  // Timeout: 300 frames (~5s a 60fps) â†’ luego cede al Pacemaker interno.
  private lastStableWorkerBpm = 0
  private lastStableWorkerBpmFrame = 0
  private readonly FREEWHEEL_TIMEOUT_FRAMES = 125  // ~5s a 25fps

  private config: TitanConfig
  private isInitialized = false
  private isRunning = false
  private cardiogramaInterval: NodeJS.Timeout | null = null
  private frameCount = 0
  private _lastLoggedEngine: string = ''
  
  // ðŸ§© WAVE 4959: Extracted managers
  private readonly logManager = new TacticalLogManager()
  private readonly stateManager = new StateManager()
  private readonly vibeManager = new VibeLifecycleManager(this.stateManager, this.logManager)
  // theiaManager initialized inline below (needs _aetherCanvasManager etc.)
  // ðŸ§© WAVE 4960.1: Hydration managers
  private readonly profileResolver = new FixtureProfileResolver()
  // stageBoundsManager initialized after _physicsPostProcessor
  // hydrationEngine initialized in constructor
  // ðŸ§© WAVE 4961: I/O managers
  // broadcastManager + hardwareDispatcher initialized in constructor
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // âš¡ WAVE 3504.5: FRAME SCHEDULER â€” replaces bare setInterval + isProcessingFrame
  // The Stampede Guard now lives inside FrameScheduler (WAVE 2211 contract kept).
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private readonly scheduler = new FrameScheduler(23, () => this.processFrame())

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ”§ DMX TIMING â€” Frame-drop protection for physical DMX timing
  // DMX512 spec: 1 frame = ~25ms (Break 88Âµs + MAB 8Âµs + 512ch Ã— 44Âµs).
  // Combined with isProcessingFrame (WAVE 2211), the 40ms loop interval
  // guarantees ~13ms of margin for the FTDI chip to drain its buffer before
  // the next frame arrives. No explicit isSendingDMX flag needed: the
  // Stampede Guard already ensures the pipeline is never re-entered.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ—‘ï¸ WAVE 2211: PRE-ALLOCATED FFT BUFFER â€” GC pressure reduction
  // BEFORE: `new Array(256).fill(0)` every frame = 256 floats Ã— 30fps = 7,680 allocs/sec
  // AFTER: Single buffer reused across frames. Zero GC from FFT.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private readonly EMPTY_FFT_BUFFER: readonly number[] = Object.freeze(new Array(256).fill(0))

  // WAVE 3190: PRE-ALLOCATED HEPHAESTUS ROUTING BUFFERS â€” GC Zero Allocation
  // Eliminan los new Map() que se creaban CADA FRAME cuando hay clips activos.
  // Se limpian con .clear() al inicio del bloque Hephaestus y se reusan.
  private readonly _hephByFixtureId = new Map<string, HephFixtureOutput[]>()
  private readonly _hephByZone = new Map<string, HephFixtureOutput[]>()
  // Pool de arrays de outputs por fixture â€” se reusan across frames
  // El pool crece hasta N fixtures y nunca encoge (GC amortizado)
  private readonly _hephOutputPool = new Map<string, HephFixtureOutput[]>()
  // WAVE 3190: Pre-allocated EffectIntentMap â€” evita new Map() cada frame con effects activos
  private readonly _effectIntentBuf: EffectIntentMap = new Map()
  
  // WAVE 252: Real fixtures from ConfigManager (no more mocks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fixtures: any[] = []
  
  // Vibe rotation for demo
  private vibeSequence: VibeId[] = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge']
  private currentVibeIndex = 0

  // ðŸ”’ WAVE 2490: THE TIER SEPARATION PROTOCOL â€” Hephaestus gate
  private _licenseTier: 'DJ_FOUNDER' | 'FULL_SUITE' = 'FULL_SUITE'

  // WAVE 254: Control state
  private mode: 'auto' | 'manual' = 'auto'
  private useBrain = true
  private inputGain = 1.0
  
  // ðŸ§¬ WAVE 560: Separated consciousness toggle (Layer 1 only)
  // useBrain = Layer 0 (reactiva) + Layer 1 (consciousness)
  // consciousnessEnabled = ONLY Layer 1 (consciousness)
  private consciousnessEnabled = true

  // WAVE 255: Real audio buffer from frontend
  // ðŸŽ¸ WAVE 1011: Extended para RockStereoPhysics2 (subBass, lowMid, highMid, transients)
  // ðŸ”¥ WAVE 1162: THE BYPASS - rawBassEnergy para BeatDetector
  private lastAudioData: { 
    bass: number; 
    mid: number; 
    high: number; 
    energy: number;
    rawTreble?: number;
    ultraAir?: number;
    harshness?: number;
    spectralFlatness?: number;
    spectralCentroid?: number;
    subBass?: number;           // ðŸŽ¸ WAVE 1011: 20-60Hz deep kicks
    lowMid?: number;            // ðŸŽ¸ WAVE 1011: 250-500Hz
    highMid?: number;           // ðŸŽ¸ WAVE 1011: 2000-4000Hz presence
    kickDetected?: boolean;     // ðŸŽ¸ WAVE 1011: Kick transient
    snareDetected?: boolean;    // ðŸŽ¸ WAVE 1011: Snare transient
    hihatDetected?: boolean;    // ðŸŽ¸ WAVE 1011: Hihat transient
    rawBassEnergy?: number;     // ðŸ”¥ WAVE 1162: Bass SIN AGC para BeatDetector
    // ï¿½ WAVE 2347: crestFactor desde GodEar para kick classification
    crestFactor?: number;
    // ï¿½ðŸ”¥ WAVE 2112: Worker BPM fields â€” GodEarBPMTracker is the authority
    workerBpm?: number;
    workerBpmConfidence?: number;
    workerOnBeat?: boolean;
    workerBeatPhase?: number;
    workerBeatStrength?: number;
    // ðŸ¥ WAVE 2213: Cumulative kick counter from Worker (phrase detection)
    workerKickCount?: number;
    // ðŸ”¬ WAVE 3418: Raw input telemetry (peak y RMS del buffer crudo pre-ring-buffer)
    inputPeakAbs?: number;
    inputRMS?: number;
  } = {
    bass: 0, mid: 0, high: 0, energy: 0
  }
  private hasRealAudio = false
  private currentLiquidLayout: '4.1' | '7.1' = '4.1'

  // ðŸš€ WAVE 4524.3: Last ConsciousnessOutput from the DecisionMaker
  // Se utiliza en el SeleneAetherAdapter para traducciÃ³n de efectos L3.
  // Por ahora inicializado como null; en el futuro el engine populate esto.
  private lastConsciousnessOutput: any = null

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // âš¡ WAVE 3504.5: PURE MATH MODULES â€” extracted from the monolith
  // SyncSmoother:   EMA filter bank + syncopation estimator + freewheel chain
  // IntentComposer: CombinedEffectOutput â†’ per-fixture EffectIntentMap
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private readonly syncSmoother = new SyncSmoother()
  private readonly intentComposer = new IntentComposer()

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // âš›ï¸ WAVE 3505.4: AETHER MATRIX â€” Agnostic Engine V2 Pipeline
  //
  // Este pipeline corre EN PARALELO con el pipeline legacy (masterArbiter â†’ HAL).
  // Los devices registrados en NodeGraph son procesados por Systems â†’ Arbiter â†’
  // Resolver y sus paquetes DMX son enviados directamente via HAL.sendUniverseRaw().
  //
  // ACTIVACIÃ“N: registerAetherDevice() activa automaticamente el pipeline.
  // Si _aetherNodeGraph estÃ¡ vacÃ­o, el bloque Aether en processFrame() es no-op.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private readonly _aetherGraph   = new NodeGraph()
  private readonly _aetherBus     = new IntentBus(4096)
  // WAVE 4663: Bus dedicado para Selene (L1). Aislado del bus L0 de los Systems.
  // Capacity 512: Selene emite dimmer+color+strobe por nodo (~50 fixtures Ã— 3 familias).
  private readonly _seleneBus     = new IntentBus(512)
  // WAVE 4705: Bus dedicado para LiveFX (L3). Autoridad sobre L2 manual.
  private readonly _effectBus     = new IntentBus(512)
  private _aetherArbiter: NodeArbiter | null = null
  private _aetherResolver: NodeResolver | null = null
  // âš™ï¸ WAVE 4518.1: Physics Post-Processor â€” The Inertia Engine
  private readonly _physicsPostProcessor = new PhysicsPostProcessor()
  // stageBoundsManager initialized after _aetherStageBounds
  private readonly hydrationEngine: FixtureHydrationEngine
  // ðŸ§© WAVE 4961: I/O managers
  private readonly broadcastManager: BroadcastManager
  private readonly hardwareDispatcher: HardwareDispatcher
  private _aetherHasDevices = false
  // âš¡ WAVE 4594: Stateless extraction pipeline â€” lazy-init, reutilizado en cada resync
  private _aetherPipeline: NodeExtractionPipeline | null = null
  // ï¿½ WAVE 4559: THE MIRROR â€” instancia Ãºnica, zero-alloc projection cada frame
  private readonly _aetherUIProjector = new AetherUIProjector()
  // ï¿½ðŸŒŠ WAVE 3516.2: Adapters â€” instanciados una vez, reutilizados cada frame
  private readonly _impactAdapter  = new LiquidImpactAdapter()
  // ðŸŽ¨ WAVE 3516.3: ColorAdapter â€” rebautizada de LiquidColorAdapter
  private _colorAdapter: ColorAdapter | null = null
  private _kineticAdapter: InstanceType<typeof VMMAdapter> | null = null
  // ðŸ”¦ðŸŒ«ï¸ WAVE 3516.4: Optic & Elemental Bridges
  private _beamAdapter: BeamAdapter | null = null
  private _atmosphereAdapter: AtmosphereAdapter | null = null
  // ðŸŒŠ WAVE 4521.3: LiquidAetherAdapter â€” Capa L0 del IntentBus
  // Se instancia con el NodeGraph y el liquidEngine71 para acceder a lastFrame
  private _liquidAetherAdapter: LiquidAetherAdapter | null = null
  // ðŸš€ WAVE 4524.3: Selene-Aether Adapter â€” Puente Cognitivo L3
  // Se instancia solo una vez. ZoneNodeRouter se construye en el constructor.
  private _zoneNodeRouter: ZoneNodeRouter | null = null
  private _seleneAetherAdapter: SeleneAetherAdapter | null = null
  private readonly _chronosAetherAdapter = new ChronosAetherAdapter(this._aetherGraph)
  // WAVE 3521: Hephaestus Diamond Data L3+ adapter
  private readonly _hephaestusAetherAdapter = new HephaestusAetherAdapter(this._aetherGraph)
  // ðŸŽ¨ WAVE 4812: Aether Canvas â€” Pixel Mapping engine (patch-time acquire, hot-path ingest)
  private readonly _aetherCanvasManager = new AetherCanvasManager()
  private readonly _pixelMapAdapter = new PixelMapAetherAdapter({ targetLayer: 'effect' })
  // ðŸ‘» WAVE 4952: _plasmaRenderers map REMOVED â€” test-pattern poltergeist amputated.
  // ðŸŽ¬ WAVE 4867: TheiaVideoRenderer â€” null hasta que se llame attachTheiaRenderer()
  private _theiaVideoRenderer: TheiaVideoRenderer | null = null
  // ðŸŒ‰ WAVE 4869: SeleneTheiaBridge â€” null hasta que se llame attachSeleneTheiaBridge()
  private _seleneThetaBridge: SeleneTheiaBridge | null = null
  private readonly _timelineEngine = timelineEngine
  // FrameContext pre-alloc â€” mutable in-place, cero alloc en hot-path
  private readonly _aetherAudio: AudioMetrics = {
    subBass: 0, bass: 0, mid: 0, highMid: 0, presence: 0, air: 0,
    energy: 0, hasTransient: false, transientStrength: 0,
    bpm: 0, beatPhase: 0, beatCount: 0,
  }
  private readonly _aetherMusical: MusicalContext = {
    section: 'unknown', dropImminent: false, sectionIntensity: 0, harmonicTension: 0, sectionElapsedMs: 0,
  }
  private readonly _aetherVibe: VibeProfile = {
    name: 'idle',
    palette: [{ h: 0, s: 0, l: 1 }],
    movementSpeed: 0.5,
    intensity: 0.5,
    beamExpressiveness: 0.5,
  }
  private readonly _aetherStageBounds = {
    width: DEFAULT_AETHER_STAGE_BOUNDS.width,
    height: DEFAULT_AETHER_STAGE_BOUNDS.height,
    depth: DEFAULT_AETHER_STAGE_BOUNDS.depth,
    centerY: DEFAULT_AETHER_STAGE_BOUNDS.centerY,
  }
  // ðŸ§© WAVE 4960.1: StageBoundsManager (needs _physicsPostProcessor + _aetherStageBounds)
  private readonly stageBoundsManager = new StageBoundsManager(
    this._aetherStageBounds,
    this._physicsPostProcessor,
  )
  private readonly _aetherCtx: FrameContext = {
    audio:      this._aetherAudio as AudioMetrics,
    musical:    this._aetherMusical as MusicalContext,
    vibe:       this._aetherVibe as VibeProfile,
    stageBounds: this._aetherStageBounds,
    nowMs:      0,
    deltaMs:    23,
    frameIndex: 0,
  }

  // ðŸ›‚ WAVE 4557: Aether Safety Middleware â€” velocity clamp, airbag, DarkSpin, output gate, throttle
  private readonly _aetherSafety = new AetherSafetyMiddleware()

  // WAVE 4548.6: Pre-allocated ForgeFrameContext â€” mutable in-place, zero alloc
  private readonly _forgeAudioBands = new Float64Array(6)
  private readonly _forgeFrameCtx: MutableForgeFrameContext = {
    timeMs: 0,
    deltaMs: 23,
    bpm: 120,
    bpmConfidence: 0,
    isBeat: false,
    energy: 0,
    audioBands: this._forgeAudioBands,
    frameIndex: 0,
  }

  /**
   * Registra un dispositivo en el Motor Agnostico Aether (WAVE 3505.4).
   *
   * Llama esto en patch time para que el dispositivo sea procesado por el
   * pipeline V2. El NodeGraph y NodeResolver se configuran automÃ¡ticamente.
   * El pipeline legacy mantiene el control de todos los demÃ¡s fixtures.
   *
   * @param definition â€” IDeviceDefinition con nodes, calibraciÃ³n y universo DMX
   * @param forgeGraph â€” WAVE 4548.6: Optional ForgeNodeGraph for zero-alloc evaluation
   */
  public registerAetherDevice(definition: IDeviceDefinition, forgeGraph?: IForgeNodeGraph): void {
    this.hydrationEngine.registerAetherDevice(definition, forgeGraph)
  }

  /**
   * WAVE 4529: Expone el NodeArbiter interno para que AetherIPCHandlers
   * pueda inyectar overrides manuales L2 desde el Programmer UI.
   */
  public getAetherArbiter(): NodeArbiter {
    this.hydrationEngine.ensureAetherMatrixInitialized()
    if (!this._aetherArbiter) {
      throw new Error('Aether Matrix initialization failed: NodeArbiter unavailable')
    }
    return this._aetherArbiter
  }

  /**
   * ðŸŒŠ WAVE 4699.2 M2: Resuelve los nodeIds del Tungsten para el Golden Nuke.
   * Busca el/los fixtures cuya definiciÃ³n tenga name === 'Tungsten',
   * luego devuelve un mapa de sufijo â†’ nodeId para cada nodo de flash.
   *
   * Retorna null si no hay ningÃºn Tungsten registrado en el NodeGraph.
   */
  public getTungstenNodeIds(): {
    goldenMaster: string
    petalL: string
    petalC: string
    petalR: string
    kinetic: string
  }[] {
    const results: {
      goldenMaster: string; petalL: string; petalC: string; petalR: string; kinetic: string
    }[] = []
    const deviceIds = this._aetherGraph.getDeviceIds()
    for (const deviceId of deviceIds) {
      const nodeIds = this._aetherGraph.getDeviceNodes(deviceId)
      const hasGoldenMaster = nodeIds.some(nid => nid.endsWith(':golden-master'))
      if (!hasGoldenMaster) continue
      results.push({
        goldenMaster: `${deviceId}:golden-master`,
        petalL:       `${deviceId}:petal-l`,
        petalC:       `${deviceId}:petal-c`,
        petalR:       `${deviceId}:petal-r`,
        kinetic:      `${deviceId}:kinetic`,
      })
    }
    return results
  }

  /**
   * ðŸ”¥ WAVE 4835 â€” DMX BYPASS: Habilita la inyecciÃ³n directa de 255 en los canales Golden Nuke
   */
  public setGoldenNukeLock(deviceId: string): void {
    const device = this._aetherGraph?.getDevice(deviceId)
    if (!device) return
    this._goldenNukeLocks.set(deviceId, {
      universe: device.universe,
      dmxAddress: device.dmxAddress,
    })
  }

  /**
   * ðŸ”¥ WAVE 4835 â€” DMX BYPASS: Deshabilita la inyecciÃ³n directa
   */
  public clearGoldenNukeLock(deviceId: string): void {
    this._goldenNukeLocks.delete(deviceId)
  }

  /**
   * Retira un dispositivo del Motor Agnostico Aether.
   *
   * @param deviceId â€” ID del dispositivo a retirar
   */
  public unregisterAetherDevice(deviceId: string): void {
    this.hydrationEngine.unregisterAetherDevice(deviceId)
  }

  // ðŸ—¡ï¸ WAVE 265: STALENESS DETECTION - Anti-SimulaciÃ³n
  // Si no llega audio fresco en AUDIO_STALENESS_THRESHOLD_MS, hasRealAudio = false
  // Esto evita que el sistema siga "animando" con datos congelados cuando el frontend muere
  private lastAudioTimestamp = 0
  private readonly AUDIO_STALENESS_THRESHOLD_MS = 500 // 500ms = medio segundo sin audio = stale

  // ðŸ“œ WAVE 1198: THE WARLOG HEARTBEAT - State tracking for tactical logs
  private hasLoggedFirstAudio = false
  private lastLoggedVibe = ''
  private lastLoggedMood = ''
  private lastLoggedBrainState = false
  private warlogHeartbeatFrame = 0  // For periodic heartbeat logs

  // WAVE 255.5: Callback to broadcast fixture states to frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onBroadcast: ((truth: any) => void) | null = null

  // âš¡ WAVE 2510: Hot Frame callback â€” high-frequency fixture data at 44Hz
  // Carries ONLY dynamic fixture data (fixtures array + beat flag + frame number)
  // Separate from full SeleneTruth which broadcasts at ~7Hz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onHotFrame: ((hotFrame: any) => void) | null = null

  // âš¡ WAVE 2510: Full truth broadcast divider
  // At 44Hz tick, send full SeleneTruth every TRUTH_BROADCAST_DIVIDER ticks (~7Hz)
  private static readonly TRUTH_BROADCAST_DIVIDER = 6

  // âš¡ WAVE 3050: HOT FRAME BROADCAST DIVIDER
  // Decouple IPC rate from DMX engine rate. DMX runs at 44Hz, UI gets hot-frames at 44Hz.
  // âš¡ WAVE 4559: Overclock â€” subido de 2 (22Hz) a 1 (44Hz).
  // Strobe y flash ahora llegan sin frame-skip al canvas 2D.
  // transientStore + RenderWorker interpolates between frames anyway.
  private static readonly HOT_FRAME_DIVIDER = 1

  // âš¡ WAVE 2464: PEAK HOLD â€” Captura el pico de intensidad del frame skipeado.
  // El throttle frameCount % 2 hace que broadcasts salten 1 de cada 2 frames (40ms).
  // Un beat con decay de 40ms puede nacer y morir en ese frame skipeado â€” el canvas
  // nunca lo ve. SoluciÃ³n: guardar el dimmer mÃ¡ximo visto entre dos broadcasts.
  // El siguiente broadcast manda el PICO, no el valor actual.
  // RESET: tras cada broadcast, se reinicia a 0 para el siguiente ciclo.
  private peakHoldMap: Map<string, number> = new Map()  // fixtureId â†’ peak dimmer (0-255)
  // WAVE 4590: Output gate canonical state para AetherSafety (independiente del arbiter clÃ¡sico)
  private _outputEnabled = false

  // ðŸ”¥ WAVE 4835 â€” DMX BYPASS: Golden Nuke Lock
  // Key: deviceId, Value: { universe, dmxAddress }
  // Cuando estÃ¡ presente, inyecta 255 directamente en los canales del Tungsteno
  private _goldenNukeLocks = new Map<string, { universe: number; dmxAddress: number }>()

  constructor(config: TitanConfig = {}) {
    this.config = {
      debug: false,
      // WAVE 255: Force IDLE on startup - system starts in blackout
      initialVibe: 'idle',
      ...config,
    }
    
    // ðŸ§© WAVE 4960.1: Build hydration context with getters/setters into orchestrator fields
    const self = this
    const hydrationCtx: HydrationContext = {
      aetherGraph: this._aetherGraph,
      get aetherArbiter() { return self._aetherArbiter },
      set aetherArbiter(v: NodeArbiter | null) { self._aetherArbiter = v },
      get aetherResolver() { return self._aetherResolver },
      set aetherResolver(v: NodeResolver | null) { self._aetherResolver = v },
      get aetherPipeline() { return self._aetherPipeline },
      set aetherPipeline(v: NodeExtractionPipeline | null) { self._aetherPipeline = v },
      get aetherHasDevices() { return self._aetherHasDevices },
      set aetherHasDevices(v: boolean) { self._aetherHasDevices = v },
      physicsPostProcessor: this._physicsPostProcessor,
      aetherSafety: this._aetherSafety,
      chronosAetherAdapter: this._chronosAetherAdapter,
      get colorAdapter() { return self._colorAdapter },
      set colorAdapter(v: ColorAdapter | null) { self._colorAdapter = v },
      get kineticAdapter() { return self._kineticAdapter },
      set kineticAdapter(v: InstanceType<typeof VMMAdapter> | null) { self._kineticAdapter = v },
      get beamAdapter() { return self._beamAdapter },
      set beamAdapter(v: BeamAdapter | null) { self._beamAdapter = v },
      get atmosphereAdapter() { return self._atmosphereAdapter },
      set atmosphereAdapter(v: AtmosphereAdapter | null) { self._atmosphereAdapter = v },
      get liquidAetherAdapter() { return self._liquidAetherAdapter },
      set liquidAetherAdapter(v: LiquidAetherAdapter | null) { self._liquidAetherAdapter = v },
      get seleneAetherAdapter() { return self._seleneAetherAdapter },
      set seleneAetherAdapter(v: SeleneAetherAdapter | null) { self._seleneAetherAdapter = v },
      get zoneNodeRouter() { return self._zoneNodeRouter },
      set zoneNodeRouter(v: ZoneNodeRouter | null) { self._zoneNodeRouter = v },
      get hal() { return self.hal },
      logManager: this.logManager,
      stateManager: this.stateManager,
      vibeManager: this.vibeManager,
      get fixtures() { return self.fixtures },
      set fixtures(v: any[]) { self.fixtures = v },
      profileResolver: this.profileResolver,
      stageBoundsManager: this.stageBoundsManager,
      seleneBus: this._seleneBus,
    }
    this.hydrationEngine = new FixtureHydrationEngine(hydrationCtx)
    
    // ðŸ§© WAVE 4961: Build broadcast + HAL dispatch contexts
    const broadcastCtx: BroadcastManagerContext = {
      logManager: this.logManager,
      trinity: this.trinity,
      engine: this.engine,
      get fixtures() { return self.fixtures },
      get frameCount() { return self.frameCount },
      peakHoldMap: this.peakHoldMap,
      oscProvider: this.oscProvider,
      syncSmoother: this.syncSmoother,
      stateManager: this.stateManager,
      get hasRealAudio() { return self.hasRealAudio },
      lastAudioData: this.lastAudioData,
      EMPTY_FFT_BUFFER: this.EMPTY_FFT_BUFFER,
    }
    this.broadcastManager = new BroadcastManager(broadcastCtx)

    const halCtx: HardwareDispatcherContext = {
      get hal() { return self.hal },
      get aetherResolver() { return self._aetherResolver },
      aetherSafety: this._aetherSafety,
      goldenNukeLocks: this._goldenNukeLocks,
      get fixtures() { return self.fixtures },
      stateManager: this.stateManager,
      get frameCount() { return self.frameCount },
    }
    this.hardwareDispatcher = new HardwareDispatcher(halCtx)
    
    this.eventRouter = getEventRouter()
    // WAVE 4703: _outputEnabled starts false at boot â€” canonical state owned by TitanOrchestrator
    // WAVE 2098: Boot silence

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ðŸ›ï¸ WAVE 2483: Wire SeleneHephBridge.playHook â†’ HephaestusRuntime.play.
    // Idempotente: si el constructor corre dos veces (tests), el Ãºltimo wins.
    // Si el HephaestusRuntime aÃºn no estuviera disponible, el lookup es lazy
    // dentro del closure, asÃ­ que no hay race condition al boot.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const bridge = getSeleneHephBridge()
      bridge.setPlayHook((resolved, _entry) => {
        if (!resolved.filePath) return -1
        // âš¡ WAVE 4913: import top-level (line 48) â€” la dependencia circular
        // ya estÃ¡ resuelta por el bundler. El require() lazy fallaba en el
        // build empaquetado porque no existe un archivo fÃ­sico ./IPCHandlers.
        const runtime = getHephaestusRuntime()
        const instanceId = runtime.play(resolved.filePath, {
          intensity: resolved.intensity,
          durationOverrideMs: resolved.durationMs,
        })
        return instanceId != null ? 1 : -1
      })

      // ðŸ‘» WAVE 4952 â€” THE POLTERGEIST HUNT: PlasmaRenderer test-pattern AMPUTATED.
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
      const renderHook: RenderHook = (_resolved: ResolvedPixelParams, _entry: RegistryEntry): string | null => {
        return null
      }
      bridge.setRenderHook(renderHook)
    } catch (err) {
      console.warn('[TitanOrchestrator ðŸ›ï¸] WAVE 2483 playHook wiring failed:', err)
    }
  }

  /**
   * ðŸ”’ WAVE 2490: Set license tier â€” DJ_FOUNDER silences Hephaestus output
   */
  setLicenseTier(tier: 'DJ_FOUNDER' | 'FULL_SUITE'): void {
    this._licenseTier = tier
  }

  // â”€â”€ ðŸŽ¬ WAVE 4867: Theia Twin-Output Bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Conecta el renderer de vÃ­deo de Theia al pipeline de Pixel Mapping.
   *
   * Llamar desde el renderer (TheiaEngineView / ThetaOrchestrator) despuÃ©s de
   * que el ThetaOrchestrator haya iniciado y el SAB estÃ© listo:
   *
   *   const thumbSAB = getThetaOrchestrator().getThumbPixelSAB()
   *   getTitanOrchestrator().attachTheiaRenderer('theia:active', thumbSAB)
   *
   * La llamada es idempotente: si ya existe un renderer para el mismo canvasId,
   * lo reemplaza (util para reconnect).
   */
  attachTheiaRenderer(
    canvasId: string,
    thumbPixelSAB: SharedArrayBuffer,
    opts: {
      /** Intensidad del muestreo [0..1]. Default: 1.0. */
      intensity?: number
      /** Si true, el alpha del pÃ­xel modula el dimmer. Default: false. */
      alphaToDimmer?: boolean
    } = {},
  ): void {
    this._theiaVideoRenderer?.stop()
    this._theiaVideoRenderer = new TheiaVideoRenderer(
      canvasId,
      this._aetherCanvasManager,
      thumbPixelSAB,
    )
    this._theiaVideoRenderer.active = true

    // Patch-time: bind world samplers so the PixelMapAetherAdapter knows which
    // nodes to sample from 'theia:active'. Falls back gracefully if the graph
    // has no positioned nodes (produces zero intents but no crash).
    const stageRect = {
      x0: -this._aetherStageBounds.width  * 0.5,
      z0: -this._aetherStageBounds.depth  * 0.5,
      x1:  this._aetherStageBounds.width  * 0.5,
      z1:  this._aetherStageBounds.depth  * 0.5,
    }
    this._pixelMapAdapter.bindWorldSamplers(
      canvasId,
      {
        intensity: opts.intensity ?? 1.0,
        alphaToDimmer: opts.alphaToDimmer ?? false,
      },
      this._aetherGraph,
      stageRect,
      64,
      64,
    )

    // eslint-disable-next-line no-console
    console.log(`[TitanOrchestrator ðŸŽ¬] WAVE 4867: TheiaVideoRenderer attached (canvasId='${canvasId}')`)
  }

  /**
   * Desconecta el renderer de vÃ­deo de Theia. El canvas queda a negro y el
   * PixelMapAetherAdapter deja de emitir intents para ese canvasId.
   */
  detachTheiaRenderer(): void {
    if (this._theiaVideoRenderer) {
      this._theiaVideoRenderer.stop()
      const canvasId = this._theiaVideoRenderer.getTelemetry().canvasId
      this._pixelMapAdapter.unbindCanvas(canvasId)
      this._aetherCanvasManager.release(canvasId)
      this._theiaVideoRenderer = null
      // eslint-disable-next-line no-console
      console.log('[TitanOrchestrator ðŸŽ¬] WAVE 4867: TheiaVideoRenderer detached')
    }
  }

  // â”€â”€ WAVE 4869: SeleneTheiaBridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Conecta el SeleneTheiaBridge al pipeline de processFrame().
   * LlÃ¡malo despuÃ©s de que ThetaOrchestrator.start() haya completado.
   */
  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
    this._seleneThetaBridge = bridge
    // eslint-disable-next-line no-console
    console.log('[TitanOrchestrator ðŸŒ‰] WAVE 4869: SeleneTheiaBridge attached')
  }

  detachSeleneTheiaBridge(): void {
    this._seleneThetaBridge = null
    // eslint-disable-next-line no-console
    console.log('[TitanOrchestrator ðŸŒ‰] WAVE 4869: SeleneTheiaBridge detached')
  }

  /**
   * Initialize all TITAN modules
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    
    // Initialize Brain
    this.brain = new TrinityBrain()
    
    // Connect Brain to Trinity Orchestrator and START the neural network
    try {
      const trinity = getTrinity()
      this.trinity = trinity  // ðŸ§  WAVE 258: Save reference for audio feeding
      this.brain.connectToOrchestrator(trinity)
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ðŸ”¥ WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
      // 
      // Frontend (30fps) â†’ bass/mid/high/energy â†’ processAudioFrame()
      // Worker (10fps) â†’ harshness/flatness/centroid/transients â†’ brain.on('audio-levels')
      // 
      // El Worker TAMBIÃ‰N envÃ­a bass/mid/high, pero los IGNORAMOS aquÃ­ porque
      // el Frontend tiene mayor frecuencia (30fps vs 10fps) y da fluidez visual.
      // El Worker es autoritativo SOLO para mÃ©tricas FFT extendidas.
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ðŸ”¥ WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
      // 
      // Frontend (60fps) â†’ bass/mid/high/energy â†’ processAudioFrame()
      // Worker (10fps) â†’ harshness/flatness/centroid/transients â†’ brain.on('audio-levels')
      // 
      // Frontend tiene PRIORIDAD TEMPORAL para core bands (60fps > 10fps)
      // Worker es autoritativo SOLO para mÃ©tricas FFT extendidas.
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // âš¡ WAVE 3060b PHOENIX: RESTAURADO â€” Frontend = core bands, Worker = extended FFT only
      this.brain.on('audio-levels', (levels: {
        bass: number; mid: number; treble: number; energy: number;
        subBass?: number; lowMid?: number; highMid?: number;
        rawTreble?: number; ultraAir?: number;
        harshness?: number; spectralFlatness?: number; spectralCentroid?: number;
        crestFactor?: number;
        kickDetected?: boolean; snareDetected?: boolean; hihatDetected?: boolean;
        rawBassEnergy?: number;
        bpm?: number; bpmConfidence?: number; onBeat?: boolean;
        beatPhase?: number; beatStrength?: number;
        kickCount?: number;
        inputPeakAbs?: number; inputRMS?: number;  // ðŸ”¬ WAVE 3418: Raw input telemetry
      }) => {
        // WAVE 3416: Detect if active source is Omni (VirtualWire / USB / OSC).
        // These sources bypass the WebAudio IPC path entirely â€” processAudioFrame()
        // is never called, so bass/mid/high/energy would stay frozen at 0 forever.
        // When an Omni source is active, the Worker IS the only audio pipeline,
        // so we promote its bands to core authority and update lastAudioTimestamp
        // so hasRealAudio can flip true and the lighting engine reacts.
        const matrixStatus = this.trinity?.getAudioMatrix()?.getStatus()
        const activeSource = matrixStatus?.activeSource ?? null
        const OMNI_SOURCES = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus'])
        const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false

        if (isOmniActive) {
          // Omni path: Worker = SOLE AUTHORITY for all bands + timestamp
          //
          // WAVE 3422 â€” EMA anti-parpadeo para bandas principales.
          // WAVE 3504.5: delegated to SyncSmoother.smooth(raw, omniPath=true).
          // SyncSmoother holds its own EMA state â€” no smoothedMetrics field here.
          const smoothedOmni = this.syncSmoother.smooth(
            {
              bass: levels.bass, mid: levels.mid, high: levels.treble,
              energy: levels.energy,
              harshness: levels.harshness, spectralFlatness: levels.spectralFlatness,
              spectralCentroid: levels.spectralCentroid, subBass: levels.subBass,
              lowMid: levels.lowMid, highMid: levels.highMid, crestFactor: levels.crestFactor,
            },
            true /* omniPath */,
          )

          this.lastAudioData = {
            ...this.lastAudioData,
            bass:   smoothedOmni.bass,
            mid:    smoothedOmni.mid,
            high:   smoothedOmni.high,
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
            // ðŸ”¬ WAVE 3418: Raw input telemetry
            inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
            inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
            // ðŸŒŠ WAVE 3516.2: El 7Âº Pasajero â€” alta frecuencia sin colapsar
            rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
            ultraAir:  levels.ultraAir  ?? this.lastAudioData.ultraAir,
          }
          // Update audio presence detection
          //
          // WAVE 3423: En el path Omni, hasRealAudio NO debe flipear por la energÃ­a
          // del frame individual. VW entrega frames con energyâ‰ˆ0 durante silencios
          // (intro, pausa entre drops) y el EMA ya se encarga de la caÃ­da gradual.
          // Si usamos levels.energy > 0.01 como gate, cada frame de silencio flipea
          // hasRealAudio=false â†’ processFrame fuerza bass=0 â†’ parpadeo epilÃ©ptico.
          //
          // Regla: en Omni, el primer frame activa hasRealAudio=true.
          //        Solo el STALENESS TIMEOUT (2s) puede desactivarlo.
          //        Esto es correcto: la fuente Omni estÃ¡ conectada o no lo estÃ¡.
          const wasActive = this.hasRealAudio
          this.hasRealAudio = true
          this.lastAudioTimestamp = Date.now()
          if (!wasActive && !this.hasLoggedFirstAudio) {
            this.hasLoggedFirstAudio = true
            this.log('System', `ðŸŽ§ WAVE 3416: Audio LIVE via ${activeSource} â€” Selene is now listening!`)
          } else if (!wasActive) {
            this.log('System', `ðŸŽ§ Audio restored via ${activeSource}`)
          }
        } else {
        // ðŸ”¥ WAVE 1012.5: Worker = SPECTRAL SOURCE ONLY (frontend/WebAudio path)
        // NO sobrescribir bass/mid/high/energy â€” Frontend tiene prioridad temporal (60fps)
        // SÃ actualizar mÃ©tricas FFT extendidas â€” Worker tiene precisiÃ³n espectral
        this.lastAudioData = {
          ...this.lastAudioData,
          // Core bands â€” IGNORADOS (Frontend es mÃ¡s rÃ¡pido a 60fps)
          // bass: levels.bass,     // âŒ Frontend tiene prioridad
          // mid: levels.mid,       // âŒ Frontend tiene prioridad  
          // high: levels.treble,   // âŒ Frontend tiene prioridad
          // energy: levels.energy, // âŒ Frontend tiene prioridad
          
          // Extended FFT metrics â€” WORKER AUTHORITATIVE (precisiÃ³n espectral)
          subBass: levels.subBass ?? this.lastAudioData.subBass,
          lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
          highMid: levels.highMid ?? this.lastAudioData.highMid,
          harshness: levels.harshness ?? this.lastAudioData.harshness,
          spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
          spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
          crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
          
          // Transient detection â€” WORKER AUTHORITATIVE
          kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
          snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
          hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
          
          // Raw bass energy â€” WORKER ONLY
          rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
          
          // BPM â€” WORKER AUTHORITATIVE (GodEarBPMTracker)
          workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
          workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
          workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
          workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
          workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
          workerKickCount: (levels.kickCount != null && levels.kickCount > 0)
            ? levels.kickCount
            : this.lastAudioData.workerKickCount,
          // ðŸ”¬ WAVE 3418: Raw input telemetry
          inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
          inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
          // ðŸŒŠ WAVE 3516.2: El 7Âº Pasajero â€” alta frecuencia sin colapsar
          rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
          ultraAir:  levels.ultraAir  ?? this.lastAudioData.ultraAir,
        };
        } // end isOmniActive else
      });
      
      await trinity.start()

      // WAVE 3401: Initialize OSC Nexus Provider
      // Register with AudioMatrix for bidirectional OSC + audio input
      this.oscProvider = new OSCNexusProvider()
      const audioMatrix = trinity.getAudioMatrix()
      if (audioMatrix) {
        audioMatrix.registerProvider(this.oscProvider)
      }
      try {
        await this.oscProvider.start()
        console.log('[TitanOrchestrator] WAVE 3401: OSCNexusProvider started (UDP 9000/9001)')
      } catch (oscErr) {
        console.error('[TitanOrchestrator] âš ï¸ OSCNexusProvider failed to start:', oscErr)
        // Non-fatal: LuxSync operates without OSC. Provider state â†’ error, AudioMatrix falls back.
      }

      // WAVE 3402: Register native audio providers (VirtualWire + USBDirectLink)
      // initialize() detects hardware / checks addon availability â€” never throws
      if (audioMatrix) {
        this.virtualWireProvider = new VirtualWireProvider()
        await this.virtualWireProvider.initialize({})
        audioMatrix.registerProvider(this.virtualWireProvider)
        console.log('[TitanOrchestrator] WAVE 3402: VirtualWireProvider registered')

        this.usbDirectLinkProvider = new USBDirectLinkProvider()
        await this.usbDirectLinkProvider.initialize({})
        audioMatrix.registerProvider(this.usbDirectLinkProvider)
        console.log('[TitanOrchestrator] WAVE 3402: USBDirectLinkProvider registered')
      }
    } catch (e) {
      console.error('[TitanOrchestrator] âŒ Trinity startup failed:', e)
    }
    
    // Initialize Engine with initial vibe
    this.engine = new TitanEngine({ 
      debug: this.config.debug, 
      initialVibe: this.config.initialVibe 
    })
    
    this.beatDetector = new BeatDetector({
      sampleRate: 44100,
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minBpm: 60,
      maxBpm: 200,
    })
    
    this.engine.on('log', (logEntry: { category: string; message: string; data?: Record<string, unknown> }) => {
      this.log(logEntry.category, logEntry.message, logEntry.data)
    })
    
    this.hal = new HardwareAbstraction({ 
      debug: this.config.debug,
      // ðŸ”¥ WAVE: USB por defecto. Si hay externalDriver, HardwareAbstraction lo usa y este valor no estorba.
      driverType: 'usb',
      externalDriver: this.config.dmxDriver
    })
    
    this.isInitialized = true
    // WAVE 2098: Boot silence â€” all init logs removed, unified banner in main.ts
  }

  /**
   * Start the main loop
   */
  start(): void {
    if (!this.isInitialized) {
      console.error('[TitanOrchestrator] Cannot start - not initialized')
      return
    }
    
    if (this.isRunning) {
      return
    }
    
    this.isRunning = true
    // âš¡ WAVE 3504.5: 44 Hz interval + Stampede Guard delegated to FrameScheduler
    this.scheduler.start()

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ðŸ«€ OPERACIÃ“N CARDIOGRAMA â€” Event Loop Lag Monitor (Main Thread)
    // Detecta GC Stop-The-World pauses y saturaciÃ³n del event loop.
    // Un delta > 25ms indica que el event loop estuvo bloqueado mÃ¡s de
    // lo esperado â€” GC mayor, IPC backpressure, spin-lock, etc.
    // 5ms interval = detecta spikes con 5ms de resoluciÃ³n.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DEBUG PROBE â€” Reactivar para auditorÃ­a (WAVE 3290 OJO DEL HURACÃN)
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
    //   // o cada 600 ticks (~5s) como heartbeat de diagnÃ³stico
    //   if (_delta > 40) {
    //     const _msg = `ðŸ«€ HARD BLOCK ${_delta.toFixed(1)}ms â€” event loop frozen`
    //     console.warn(`[CARDIOGRAMA MAIN] âš ï¸ ${_msg}`)
    //     this.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
    //   } else if (_cardiogramaCount % 600 === 0) {
    //     const _msg = `ðŸ«€ heartbeat â€” peak:${_cardiogramaPeak.toFixed(1)}ms (last 5s)`
    //     console.warn(`[CARDIOGRAMA MAIN] ${_msg}`)
    //     this.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
    //     _cardiogramaPeak = 0
    //   }
    // }, 5)

    // Relay CARDIOGRAMA del USB Worker â†’ Tactical Log del frontend
    universalDMX.onWarning = (msg: string) => {
      console.warn(msg)
      this.log('Error', msg)
    }
    
    // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
    setTimeout(() => {
      this.log('System', 'ðŸš€ TITAN 2.0 ONLINE - Main loop started @ 44fps (WAVE 2510 hot-frame)')
      this.log('Info', `ðŸ“Š Fixtures loaded: ${this.fixtures.length}`)
    }, 100)
  }

  /**
   * Stop the main loop.
   * 
   * ðŸ§Ÿ ZOMBIE KILLER: antes de matar el loop, forzamos un frame de ceros
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
  async stop(): Promise<void> {
    // Paso 1: Blackout lÃ³gico en el HAL (si ya fue inicializado)
    if (this.hal) {
      this.hal.setBlackout(true)
    }

    // Paso 2: Forzar buffer de ceros directo al driver serial
    universalDMX.blackout()
    await universalDMX.sendAll()

    // Paso 3: Dar tiempo al chip FTDI para drenar los bytes al cable RS-485
    await new Promise<void>(resolve => setTimeout(resolve, 30))

    // Paso 4: Ahora sÃ­ podemos matar el loop sin dejar zombis
    // WAVE 3504.5: scheduler encapsulates the interval and stampede guard
    await this.scheduler.stop()
    if (this.cardiogramaInterval) {
      clearInterval(this.cardiogramaInterval)
      this.cardiogramaInterval = null
    }
    universalDMX.onWarning = null
    this.isRunning = false

    // WAVE 3401: Stop OSC Nexus Provider
    if (this.oscProvider) {
      this.oscProvider.stop()
      this.oscProvider = null
    }

    // WAVE 3402: Stop native audio providers
    if (this.virtualWireProvider) {
      await this.virtualWireProvider.stop()
      this.virtualWireProvider = null
    }
    if (this.usbDirectLinkProvider) {
      await this.usbDirectLinkProvider.stop()
      this.usbDirectLinkProvider = null
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ§¹ WAVE 2227: REACTOR CLEANUP â€” Purgar estado residual
    // Sin esto, al re-armar el engine retoma desde la fase congelada:
    // VMM con acumuladores viejos, BeatDetector con BPM acumulado.
    // El resultado: saltos de posiciÃ³n al rearmar.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // Purgar acumuladores de fase del movement engine
    vibeMovementManager.resetTime()

    // WAVE 4703: ArbitrationDirector bypased (WAVE 4592) â€” clearTitanState removed

    // Purgar estado acumulado del beat detector
    if (this.beatDetector) {
      this.beatDetector.reset()
    }
  }

  /**
   * Process a single frame of the Brain -> Engine -> HAL pipeline
   * ðŸŽ¬ PROCESAR FRAME: El latido del universo
   * ðŸ§¬ WAVE 972: ASYNC para DNA Brain sincrÃ³nico
   * ðŸ”’ WAVE 2211: Stampede guard delegated to FrameScheduler (WAVE 3504.5)
   */
  private async processFrame(): Promise<void> {
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”’ WAVE 2211: STAMPEDE GUARD (now in FrameScheduler._onInterval())
    // The FrameScheduler skips ticks if the previous async processFrame()
    // is still running. Contract preserved â€” guard moved to the scheduler.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (!this.brain || !this.engine || !this.hal) return
    
    this.frameCount++

    // ðŸŽ¬ WAVE 4860: Advance the master SAB clock so ThetaWorker can read tickId
    // lock-free, zero IPC overhead â€” written directly into SharedArrayBuffer
    this.trinity?.advanceFrameContext(this.frameCount, Date.now())
    
    // WAVE 255: No more auto-rotation, system stays in selected vibe
    // Vibe changes only via IPC lux:setVibe
    
    const shouldLog = this.frameCount % 30 === 0 // Log every ~1 second
    
    // ï¿½ WAVE 671.5: Silenced heartbeat spam (every 5s)
    // ï¿½ðŸ« WAVE 266: IRON LUNG - Heartbeat cada 5 segundos (150 frames @ 30fps)
    // const shouldHeartbeat = this.frameCount % 150 === 0
    // if (shouldHeartbeat) {
    //   const timeSinceLastAudio = Date.now() - this.lastAudioTimestamp
    //   console.log(`[Titan] ðŸ« Heartbeat #${this.frameCount}: Audio flowing? ${this.hasRealAudio} | Last Packet: ${timeSinceLastAudio}ms ago`)
    // }
    
    // 1. Brain produces MusicalContext
    const context = this.brain.getCurrentContext()
    
    // ðŸ—¡ï¸ WAVE 265: STALENESS DETECTION - Verificar frescura del audio
    // Si el Ãºltimo audio llegÃ³ hace mÃ¡s de AUDIO_STALENESS_THRESHOLD_MS, es stale
    // âš¡ WAVE 3050: UNIFIED FRAME TIMESTAMP â€” one syscall per frame, not 9
    //
    // WAVE 3423: Omni sources (VW/USB) usan threshold extendido de 2000ms.
    // VW entrega ~10fps pero el SAB puede tener gaps de 200-400ms durante
    // silencios largos (intro, pausa entre drops). Con 500ms el staleness
    // se dispara en cualquier intro silenciosa y mata las luces en plena mÃºsica.
    const now = Date.now()
    const matrixStatusForStaleness = this.trinity?.getAudioMatrix()?.getStatus()
    const activeSourceForStaleness = matrixStatusForStaleness?.activeSource ?? null
    const OMNI_SOURCES_STALENESS = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus'])
    const isOmniForStaleness = activeSourceForStaleness ? OMNI_SOURCES_STALENESS.has(activeSourceForStaleness) : false
    const effectiveStalenessThreshold = isOmniForStaleness ? 2000 : this.AUDIO_STALENESS_THRESHOLD_MS
    if (this.hasRealAudio && (now - this.lastAudioTimestamp) > effectiveStalenessThreshold) {
      if (shouldLog) {
        console.warn(`[TitanOrchestrator] âš ï¸ AUDIO STALE - no data for ${now - this.lastAudioTimestamp}ms, switching to silence`)
      }
      this.hasRealAudio = false
      // Reset lastAudioData para no mentir con datos viejos
      // ðŸŽ›ï¸ WAVE 661: Incluir reset de textura espectral
      // ðŸŽ¸ WAVE 1011: Incluir reset de bandas extendidas y transientes
      // ðŸ”¥ WAVE 1162.2: Incluir reset de rawBassEnergy
      this.lastAudioData = { 
        bass: 0, mid: 0, high: 0, energy: 0, 
        harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
        subBass: undefined, lowMid: undefined, highMid: undefined,
        kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined,
        rawBassEnergy: undefined,  // ðŸ”¥ WAVE 1162.2: Reset tambiÃ©n el bypass
        // ðŸ”¥ WAVE 2213: PRESERVAR MEMORIA DEL WORKER DURANTE EL SILENCIO
        // Sin esto: workerBpm â†’ undefined â†’ zombie BeatDetector â†’ 200 BPM hardcodeado
        workerBpm: this.lastAudioData.workerBpm,
        workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
        workerOnBeat: false, // Es silencio, no hay beat activo
        workerBeatPhase: this.lastAudioData.workerBeatPhase,
        workerBeatStrength: 0,
        workerKickCount: this.lastAudioData.workerKickCount,
      }
    }
    
    // 2. WAVE 255: Use real audio if available, otherwise silence (IDLE mode)
    let bass: number, mid: number, high: number, energy: number
    
    if (this.hasRealAudio) {
      bass = this.lastAudioData.bass * this.inputGain
      mid = this.lastAudioData.mid * this.inputGain
      high = this.lastAudioData.high * this.inputGain
      energy = this.lastAudioData.energy * this.inputGain
    } else {
      // Silence - system in standby
      bass = 0
      mid = 0
      high = 0
      energy = 0
    }
    
    // âš¡ WAVE 3504.5: Delegated to SyncSmoother â€” apply EMA to all FFT metrics
    // Frontend (WebAudio path): omniPath=false (bass/mid/high/energy untouched)
    // Worker (Omni path): already smoothed in brain.on('audio-levels') handler
    this.syncSmoother.smooth(
      {
        harshness:       this.lastAudioData.harshness,
        spectralFlatness: this.lastAudioData.spectralFlatness,
        spectralCentroid: this.lastAudioData.spectralCentroid,
        subBass:          this.lastAudioData.subBass,
        lowMid:           this.lastAudioData.lowMid,
        highMid:          this.lastAudioData.highMid,
        crestFactor:      this.lastAudioData.crestFactor,
        bass: 0, mid: 0, high: 0, energy: 0, // not smoothed on frontend path
      },
      false /* omniPath */,
    )
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”¥ WAVE 2112: THE RESURRECTION â€” Worker BPM + PLL Flywheel
    // GodEarBPMTracker in Worker is the BPM AUTHORITY (fresh FFT every ~21ms).
    // Pacemaker is DEMOTED to PLL/Flywheel only â€” no more kick detection here.
    // The old process() was broken: rawBassEnergy arrived at 10fps via IPC,
    // but process() ran at 60fps â†’ same frozen value 6x â†’ transient=0 â†’ BPM chaos.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    }
    
    // ðŸ”¥ WAVE 2112: Worker BPM â€” the source of truth
    const workerBpm = this.lastAudioData.workerBpm ?? 0
    const workerConfidence = this.lastAudioData.workerBpmConfidence ?? 0
    const workerOnBeat = this.lastAudioData.workerOnBeat ?? false
    const workerBeatPhase = this.lastAudioData.workerBeatPhase ?? 0
    
    if (this.beatDetector && this.hasRealAudio) {
      // ðŸ”¥ WAVE 2112 + WAVE 2179: WORKER BPM â†’ PLL
      // Worker con seÃ±al â†’ setBpm() = lock real (PLL anclado a la verdad fÃ­sica)
      // Worker sordo pero memoria reciente â†’ freewheelAt() = inercia correcta
      // Worker sordo Y memoria expirada â†’ PLL cae al Pacemaker interno (120 default)
      // PunkArchytect doctrine: Worker = OÃ­dos (honesto). Cerebro = Memoria (inerte).
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (workerBpm > 0 && workerConfidence > 0.2) {
        // ðŸ”¥ Worker activo: lock real + actualizar memoria
        this.beatDetector.setBpm(workerBpm)
        this.lastStableWorkerBpm = workerBpm
        this.lastStableWorkerBpmFrame = this.frameCount
      } else {
        // ðŸ”¥ WAVE 2179: Worker sordo â†’ Â¿tenemos memoria reciente?
        const framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame
        if (this.lastStableWorkerBpm > 0 && framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES) {
          // FREEWHEEL: PLL gira en la frecuencia real, no en 120 BPM
          this.beatDetector.freewheelAt(this.lastStableWorkerBpm)
        }
        // Si el timeout expirÃ³ â†’ sin freewheelAt(), PLL se suelta al Pacemaker interno
      }
      
      // PLL Flywheel: advances phase continuously for smooth beat prediction
      beatState = this.beatDetector.tick(now) // âš¡ WAVE 3050: unified timestamp
      
      // Override onBeat with Worker's real detection (PLL can predict, but Worker detects)
      if (workerOnBeat) {
        beatState.onBeat = true
        beatState.kickDetected = true
      }
      
      if (this.frameCount % 60 === 0) {
        const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL'
        const syncInfo = this.syncSmoother.currentSyncopation.toFixed(2)
        const _framesSinceLog = this.frameCount - this.lastStableWorkerBpmFrame
        const freewheelTag = (!beatState.pllLocked && this.lastStableWorkerBpm > 0 && _framesSinceLog <= this.FREEWHEEL_TIMEOUT_FRAMES)
          ? ` [mem=${this.lastStableWorkerBpm.toFixed(0)}@-${_framesSinceLog}f]`
          : ''
        const rawEnergy = (this.lastAudioData.rawBassEnergy ?? 0).toFixed(4)
        const sabFill = this.trinity?.getAudioMatrix()?.getStatus()?.ringBufferFillLevel?.toFixed(3) ?? 'n/a'
        // ðŸ”¬ WAVE 3418: Peak/RMS del buffer crudo que llega al Worker
        const inputPeak = (this.lastAudioData.inputPeakAbs ?? 0).toFixed(5)
        const inputRms  = (this.lastAudioData.inputRMS ?? 0).toFixed(5)
        console.log(`[TitanOrchestrator] ðŸŽ§ WORKER BPM=${workerBpm.toFixed(0)} conf=${workerConfidence.toFixed(2)} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.lastAudioData.workerKickCount ?? 0} | bass=${rawEnergy} sab=${sabFill} | ðŸ”¬in_peak=${inputPeak} in_rms=${inputRms}`)
      }
    } else if (this.beatDetector) {
      // WAVE 2090.3: THE FLYWHEEL - tick even without audio
      // The metronome keeps spinning on inertia (freewheel mode)
      beatState = this.beatDetector.tick(now) // âš¡ WAVE 3050: unified timestamp
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  WAVE 2112: BRIDGE REVERSED â€” Worker no longer needs SET_BPM
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”¥ rBPM INJECTION â€” cadena de prioridad con freewheel memory (WAVE 2179)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Priority chain:
    //   1. Worker activo (conf > 0.2)         â†’ BPM del Worker (verdad fÃ­sica)
    //   2. Worker sordo + memoria reciente    â†’ Ãºltimo BPM estable (inercia)
    //   3. Sin memoria / timeout expirado     â†’ Pacemaker interno (Ãºltimo recurso)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const _framesSinceStable = this.frameCount - this.lastStableWorkerBpmFrame
    const hasFreewheelMemory = this.lastStableWorkerBpm > 0 && _framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES

    if (workerBpm > 0 && workerConfidence > 0.2) {
      // Priority 1: Worker activo
      context.bpm = workerBpm
      context.beatPhase = beatState.pllLocked
        ? (beatState.pllPhase ?? beatState.phase)
        : workerBeatPhase
      context.syncopation = this.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid)
    } else if (hasFreewheelMemory) {
      // ðŸ”¥ WAVE 2179: Priority 2 â€” FREEWHEEL MEMORY
      // Las luces no se enteran del break. El show continÃºa en el BPM real.
      context.bpm = this.lastStableWorkerBpm
      context.beatPhase = beatState.pllPhase ?? beatState.phase
      context.syncopation = this.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid)
    } else if (beatState.bpm > 0 && beatState.confidence > 0) {
      // Priority 3: Pacemaker interno (cuando no hay ningÃºn recuerdo del Worker)
      context.bpm = beatState.bpm
      context.beatPhase = beatState.pllPhase ?? beatState.phase
      context.syncopation = this.syncSmoother.estimateSyncopation(
        beatState.pllPhase ?? beatState.phase,
        bass,
        mid
      )
    }

    // For TitanEngine
    // ðŸŽ›ï¸ WAVE 661: Incluir textura espectral
    // ðŸŽ¸ WAVE 1011.5: Usar mÃ©tricas SUAVIZADAS (no crudas) para evitar parpadeo
    // â¤ï¸ WAVE 1153: beatPhase/isBeat/beatCount FROM REAL PACEMAKER
    // ï¿½ WAVE 2112: THE RESURRECTION â€” Worker BPM + PLL phase + Worker transients
    const engineAudioMetrics = {
      bass,  // Ya normalizado por AGC - INTOCABLE
      mid,   // Ya normalizado por AGC - INTOCABLE
      high,  // Ya normalizado por AGC - INTOCABLE
      energy, // Ya normalizado por AGC - INTOCABLE
      // ðŸ”¥ WAVE 2112: BPM from Worker (authority), phase from PLL (smooth prediction)
      beatPhase: beatState.pllLocked ? (beatState.pllPhase ?? beatState.phase) : workerBeatPhase,
      // ðŸ›¡ï¸ WAVE 2512 FIX 3: IBeat Silence Guard
      // PLL onBeat only propagates as isBeat if the PLL is locked (has real evidence).
      // Redundancy layer: FIX 1 already silences beatState.onBeat in freewheel,
      // but this guard ensures the merge logic itself is architecturally correct.
      isBeat: workerOnBeat || (beatState.pllLocked && beatState.onBeat),
      // ðŸ¥ WAVE 2213: beatCount RECONNECTED â€” Worker kickCount is the real monotonic counter.
      // beatState.beatCount (PLL) was always 0 because process() was retired in WAVE 2112.
      // The Worker's IntervalBPMTracker.totalKicks is the only real beat counter alive.
      beatCount: this.lastAudioData.workerKickCount ?? beatState.beatCount,
      bpm: workerBpm > 0 ? workerBpm : beatState.bpm,
      beatConfidence: workerConfidence > 0 ? workerConfidence : beatState.confidence,
      // ðŸŒŠ WAVE 1011.5: MÃ©tricas FFT SUAVIZADAS (WAVE 3504.5: via SyncSmoother)
      harshness: this.syncSmoother.currentSmoothed.harshness,
      spectralFlatness: this.syncSmoother.currentSmoothed.spectralFlatness,
      spectralCentroid: this.syncSmoother.currentSmoothed.spectralCentroid,
      // ðŸ’¥ WAVE 2352: crestFactor RAW para physics engines - los transitorios de kick NO se suavizan
      // El EMA destruye el pico que diferencia un bombo de un rolling bass
      crestFactor: this.lastAudioData.crestFactor ?? this.syncSmoother.currentSmoothed.crestFactor,
      // ðŸŽ¸ WAVE 1011.5: Bandas extendidas SUAVIZADAS
      subBass: this.syncSmoother.currentSmoothed.subBass,
      lowMid: this.syncSmoother.currentSmoothed.lowMid,
      highMid: this.syncSmoother.currentSmoothed.highMid,
      // ðŸ”¥ WAVE 2112: Transients from Worker (fresh FFT) â€” Pacemaker no longer detects kicks
      // ðŸ›¡ï¸ WAVE 2512 FIX 2: Kick Signal Veto in Freewheel
      // kickDetected only fires if Worker directly detected OR PLL has a real lock.
      // Prevents phantom Pacemaker kicks from polluting physics engines (LiquidEngineBase isKick).
      kickDetected: workerOnBeat || (beatState.pllLocked && this.lastAudioData.kickDetected),
      snareDetected: this.lastAudioData.snareDetected,
      hihatDetected: this.lastAudioData.hihatDetected,
      // â±ï¸ WAVE 2305: THE INFALLIBLE METRONOME â€” PLL beat prediction
      isPLLBeat: beatState.pllOnBeat,
    }
    
    // For HAL
    // ðŸŽµ WAVE 2211: Inject REAL beatPhase + BPM from PLL/Worker
    // BEFORE: HAL calculated its own fake beatPhase from hardcoded 120 BPM
    // â†’ optics pulsed at constant 2Hz regardless of actual music tempo
    // â†’ chill-lounge got rock-speed focus punches
    // AFTER: Real PLL phase flows from Worker â†’ Pacemaker â†’ here â†’ HAL
    const halBeatPhase = beatState.pllLocked 
      ? (beatState.pllPhase ?? beatState.phase) 
      : workerBeatPhase
    const halBpm = workerBpm > 0 ? workerBpm : beatState.bpm
    
    const halAudioMetrics = {
      rawBass: bass,
      rawMid: mid,
      rawTreble: high,
      energy,
      isRealSilence: false,
      isAGCTrap: false,
      beatPhase: halBeatPhase,
      bpm: halBpm,
      // ðŸŽµ WAVE 2720: LA LEY UNIVERSAL DEL PÃ‰NDULO â€” Propagar bpmConfidence al HAL
      // para que HarmonicQuantizer funcione universalmente en translateColorToWheel()
      bpmConfidence: this.lastAudioData?.workerBpmConfidence ?? 0,
    }

    // â”€â”€ WAVE 4869: SeleneTheiaBridge â”€ Observer pasivo, zero-alloc â”€â”€â”€â”€â”€â”€â”€â”€
    // Llamada DESPUÃ‰S de construir engineAudioMetrics (energy, sectionType listos).
    // El bridge solo hace forceState() cuando detecta un cambio de estado estable.
    if (this._seleneThetaBridge !== null) {
      this._seleneThetaBridge.notify({
        energy:       engineAudioMetrics.energy,
        sectionType:  (context.section?.type ?? 'unknown') as string,
        dropImminent: context.energy > 0.8,
        frameIndex:   this.frameCount,
      })
    }

    // 3. Engine processes context -> produces LightingIntent (ðŸ§¬ DNA Brain now awaited)
    const intent = await this.engine.update(context, engineAudioMetrics)
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸª“ WAVE 4592 â†’ WAVE 4703: AETHER PIPELINE ONLY
    // ArbitrationDirector (masterArbiter) is extinct. Aether is the single source of truth.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const effectManager = getEffectManager()
    const effectOutput = effectManager.getCombinedOutput()

    // Chronos protection: fixtures being painted by Chronos are off-limits
    const playbackFrame = this._timelineEngine.getLastPlaybackFrame()
    const chronosFixtureIds = new Set<string>(
      (playbackFrame?.targets ?? []).map(t => t.fixtureId)
    )

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”Ž FORENSIC TRACE (CP2): Aether â†’ HAL handoff snapshot
    // Enabled via env: LUXSYNC_TRACE_DMX=1 (optional LUXSYNC_TRACE_DMX_EVERY)
    // Optional focus: LUXSYNC_TRACE_FIXTURE_ID=<fixtureId>
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    try {
      const traceEnabled = String(process?.env?.LUXSYNC_TRACE_DMX ?? '') === '1'
      if (traceEnabled) {
        const everyRaw = Number.parseInt(String(process?.env?.LUXSYNC_TRACE_DMX_EVERY ?? ''), 10)
        const every = Number.isFinite(everyRaw) && everyRaw > 0 ? everyRaw : 60
        if (this.frameCount % every === 0) {
          // Trace CP2: Aether pipeline snapshot â€” no arbitratedTarget (WAVE 4703)
        }
      }
    } catch {
      // never block the render loop
    }
    
    // ðŸ“œ WAVE 1198: WARLOG HEARTBEAT - Periodic status every ~4 seconds (240 frames at 60fps)
    // ðŸŽ›ï¸ WAVE 1198.8: De 120 a 240 frames para reducir spam
    this.warlogHeartbeatFrame++
    if (this.warlogHeartbeatFrame >= 240) {
      this.warlogHeartbeatFrame = 0
      
      const currentVibe = this.engine.getCurrentVibe()
      const brainEnabled = this.useBrain
      const audioStatus = this.hasRealAudio ? 'LIVE' : 'SILENT'
      const bpm = context.bpm || 120
      
      // Emit heartbeat log
      this.log('System', `ðŸ’“ HEARTBEAT: ${audioStatus} | ${bpm} BPM | ${currentVibe.toUpperCase()}`, {
        audioActive: this.hasRealAudio,
        bpm,
        vibe: currentVibe,
        brainEnabled,
        fixtureCount: this.fixtures.length,
      })
    }
    
    // WAVE 380: Debug - verify fixtures are present in loop (WAVE 2098: silenced)
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŒ‰ WAVE-4592: AETHER UI REROUTE â€” OpciÃ³n B (placeholder array)
    // fixtureStates se inicializa desde this.fixtures con valores default puros.
    // AetherUIProjector.project() lo rellena con la verdad Aether cada frame.
    // hal.renderFromTarget() ya NO se llama: Aether es el productor exclusivo.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const fixtureStates: import('../../hal/mapping/FixtureMapper').FixtureState[] =
      this.fixtures.map(fix => ({
        dmxAddress: fix.dmxAddress,
        universe:   fix.universe,
        name:       fix.name,
        zone:       fix.zone   ?? 'center',
        type:       fix.type   ?? 'generic',
        isVirtual:  fix.isVirtual,
        dimmer: 0,
        r: 0, g: 0, b: 0,
        pan:    128,
        tilt:   128,
        zoom:   128,
        focus:  128,
        channels:   fix.channels,
        profileId:  fix.profileId,
        fixtureId:  fix.id,
        hasColorWheel:  fix.hasColorWheel,
        hasColorMixing: fix.hasColorMixing,
      }))
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ï¿½ WAVE 2662: POST-HAL MUTATION ELIMINATED
    //
    // BEFORE (WAVE 635 â†’ 993 â†’ 2065): ~500 lines of zone overrides, brocha gorda,
    // stereo movement, movement override â€” all mutating fixtureStates post-HAL.
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
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    // Chronos telemetry (post-HAL, for diagnostics only)
    const isChronosPlaying = this._timelineEngine.isPlaying
    if (isChronosPlaying && this.frameCount % 300 === 1) {
      const f0 = fixtureStates[0]
      console.log(
        `[TitanOrchestrator ðŸŽ¬] CHRONOS OVERLAY: ${chronosFixtureIds.size}/${fixtureStates.length} fixtures protected | ` +
        `f0: dim=${f0?.dimmer} RGB(${f0?.r},${f0?.g},${f0?.b})`
      )
    }
    
    // WAVE 257: Throttled logging to Tactical Log (every 4 seconds = 240 frames @ 60fps)
    // ðŸŽ›ï¸ WAVE 1198.8: De 120 a 240 frames para reducir spam
    const shouldLogToTactical = this.frameCount % 240 === 0
    
    if (shouldLogToTactical && this.hasRealAudio) {
      const avgDimmer = fixtureStates.length > 0 
        ? fixtureStates.reduce((sum, f) => sum + f.dimmer, 0) / fixtureStates.length 
        : 0
      const movers = fixtureStates.filter(f => f.zone.includes('MOVING'))
      const avgMover = movers.length > 0 ? movers.reduce((s, f) => s + f.dimmer, 0) / movers.length : 0
      const frontPars = fixtureStates.filter(f => f.zone === 'FRONT_PARS')
      const avgFront = frontPars.length > 0 ? frontPars.reduce((s, f) => s + f.dimmer, 0) / frontPars.length : 0
      
      // Send to Tactical Log
      this.log('Visual', `ðŸŽ¨ P:${intent.palette.primary.hex || '#???'} | Front:${avgFront.toFixed(0)} Mover:${avgMover.toFixed(0)}`, {
        bass, mid, high, energy,
        avgDimmer: avgDimmer.toFixed(0),
        paletteStrategy: intent.palette.strategy
      })
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // âš’ï¸ WAVE 2030.19: THE MERGER - HephaestusRuntime Integration
    // Evaluate all active .lfx clips and merge their outputs with DMX
    // 
    // MERGE STRATEGY:
    //   - Intensity/Dimmer: HTP (Highest Takes Precedence)
    //   - Color (RGB): LTP (Hephaestus overwrites if present)
    //   - Pan/Tilt: Overlay (Hephaestus controls movement if present)
    //   - Strobe: Additive (sum clamped to max)
    //
    // ðŸŽ¬ WAVE 2065: Heph always runs. Per-fixture Chronos check applied inside.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const hephRuntime = getHephaestusRuntime()
    const hephOutputs = hephRuntime.tick(now) // âš¡ WAVE 3050: unified timestamp
    
    // ðŸ”’ WAVE 2490: THE TIER SEPARATION PROTOCOL â€” Hephaestus DMX Gate
    // DJ_FOUNDER: Hephaestus runtime ticks are silently discarded.
    // The engine runs but its output never reaches fixtures.
    if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
      // WAVE 3190: Reutilizar buffers pre-asignados â€” cero new Map() por frame
      // ðŸŽ¯ WAVE 2544.3: Separate outputs into two buckets:
      //   - fixtureId bucket: output targets a specific fixture by ID (new tickLegacy path)
      //   - zone bucket: output targets a zone string (tickWithPhase legacy path)
      this._hephByFixtureId.clear()
      this._hephByZone.clear()
      // Limpiar arrays del pool reutilizados el frame anterior
      for (const arr of this._hephOutputPool.values()) arr.length = 0

      for (const output of hephOutputs) {
        // If fixtureId looks like a real fixture ID (not 'zone:xxx'), use fixture bucket
        if (output.fixtureId && !output.fixtureId.startsWith('zone:')) {
          let arr = this._hephByFixtureId.get(output.fixtureId)
          if (!arr) {
            // Reusar del pool o crear uno nuevo (solo en el primer clip para esta fixture)
            arr = this._hephOutputPool.get(output.fixtureId)
            if (!arr) { arr = []; this._hephOutputPool.set(output.fixtureId, arr) }
            this._hephByFixtureId.set(output.fixtureId, arr)
          }
          arr.push(output)
        } else {
          const zoneKey = output.zone === 'all' ? 'all' : output.zone.toString()
          let arr = this._hephByZone.get(zoneKey)
          if (!arr) {
            arr = this._hephOutputPool.get(`zone:${zoneKey}`)
            if (!arr) { arr = []; this._hephOutputPool.set(`zone:${zoneKey}`, arr) }
            this._hephByZone.set(zoneKey, arr)
          }
          arr.push(output)
        }
      }
      
      // WAVE 3190: Mutation in-place â€” cero map()+spread() por frame
      // Apply Hephaestus outputs to fixtures mutando f directamente.
      // fixtureStates son objetos propios del HAL por frame â€” son seguros de mutar.
      for (let index = 0; index < fixtureStates.length; index++) {
        const f = fixtureStates[index]
        // ðŸŽ¬ WAVE 2065: Skip fixtures that Chronos is currently painting
        const fixtureId = this.fixtures[index]?.id
        if (fixtureId && chronosFixtureIds.has(fixtureId)) continue
        // WAVE 3521: Skip fixtures registered in Aether NodeGraph (handled by HephaestusAetherAdapter L3+)
        if (fixtureId && this._aetherGraph.getDeviceNodes(fixtureId as import('../aether/types').DeviceId).length > 0) continue

        // Collect applicable outputs inline (sin crear array intermedio cuando posible)
        const directOutputs = fixtureId ? this._hephByFixtureId.get(fixtureId) : undefined
        const allOutputs = this._hephByZone.get('all')

        // Chequear si hay algo que aplicar antes de iterar zonas
        const fixtureZone = (f.zone || '').toLowerCase()
        const positionX = this.fixtures[index]?.position?.x ?? 0
        let hasAny = !!(directOutputs?.length) || !!(allOutputs?.length)
        if (!hasAny) {
          for (const [zoneKey] of this._hephByZone) {
            if (zoneKey === 'all') continue
            if (zoneMapperMatch(fixtureZone, zoneKey, positionX, this.fixtures[index])) { hasAny = true; break }
          }
        }
        if (!hasAny) continue

        // âš’ï¸ WAVE 2030.21: THE TRANSLATOR â€” mutar f in-place
        // Values arrive PRE-SCALED from HephaestusRuntime. Zero scaling here.
        const applyOutputs = (outputs: HephFixtureOutput[]) => {
          for (const output of outputs) {
            switch (output.parameter) {
              case 'intensity': f.dimmer = Math.max(f.dimmer, output.value); break
              case 'strobe': f.strobe = Math.min(255, (f.strobe || 0) + output.value); break
              case 'pan':
                f.pan = output.value
                if (output.fine !== undefined) (f as any).panFine = output.fine
                break
              case 'tilt':
                f.tilt = output.value
                if (output.fine !== undefined) (f as any).tiltFine = output.fine
                break
              case 'color':
                if (output.rgb) { f.r = output.rgb.r; f.g = output.rgb.g; f.b = output.rgb.b }
                break
              case 'white': f.white = output.value; break
              case 'amber': f.amber = output.value; break
              case 'zoom': f.zoom = output.value; break
              case 'focus': f.focus = output.value; break
              case 'iris': (f as any).iris = output.value; break
              case 'gobo1': f.gobo = output.value; break
              case 'gobo2': (f as any).gobo2 = output.value; break
              case 'prism': f.prism = output.value; break
              // speed/width/direction/globalComp: engine-internal â€” no DMX channel
            }
          }
        }

        if (directOutputs) applyOutputs(directOutputs)
        if (allOutputs) applyOutputs(allOutputs)
        // Check zone-specific outputs (old zone-string path)
        // ðŸ—ºï¸ WAVE 2543.5: Pass positionX for stereo zone support
        // ðŸŒŠ WAVE 4951: Pass fixture object for dynamic composite zone resolution
        for (const [zoneKey, outputs] of this._hephByZone) {
          if (zoneKey === 'all') continue
          if (zoneMapperMatch(fixtureZone, zoneKey, positionX, this.fixtures[index])) {
            applyOutputs(outputs)
          }
        }
      }
      
      // Throttled debug log
      if (this.frameCount % 60 === 0) {
        const activeClips = hephRuntime.getStats().activeClips
        console.log(`[TitanOrchestrator âš’ï¸] HEPHAESTUS: ${activeClips} clips, ${hephOutputs.length} outputs`)
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // âš¡ WAVE 3065: PHYSICS-FIRST, UI-BEFORE-ADUANA
    //
    // WAVE 3050 introdujo un regression: sendStatesWithPhysics() mutaba los
    // objetos fixtureStates IN-PLACE con la Aduana (zerificando dimmer/r/g/b
    // cuando outputEnabled=false) ANTES de que el hot-frame los leyera.
    // Resultado: HyperionView siempre negro con output OFF.
    //
    // Fix arquitectÃ³nico correcto:
    //   1. applyPhysicsOnly()  â†’ physicalPan/Tilt actualizados, SIN Aduana
    //   2. Hot-frame + Truth   â†’ UI lee valores reales del engine
    //   3. flushToDriver()     â†’ Aduana + DMX (puede zerificar, pero ya no importa)
    //
    // De esta forma el preview siempre refleja la realidad del engine,
    // y la Aduana sigue siendo el Ãºnico gate para el hardware fÃ­sico.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // âš¡ WAVE 3070: applyPhysicsOnly() eliminado â€” renderFromTarget() ya corriÃ³
    // la fÃ­sica (translateDMX + calibrationOffsets) internamente. Llamarlo aquÃ­
    // era doble-fÃ­sica: el mover se simulaba dos veces por frame, duplicando la
    // velocidad aparente y produciendo jitter esquizofrÃ©nico en la UI.
    // El pipeline correcto es: renderFromTarget (fÃ­sica+cÃ¡lculo) â†’ broadcast UI
    // â†’ flushToDriver (Aduana+send). Sin pasos intermedios redundantes.

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // âš¡ WAVE 2510: DUAL-CHANNEL BROADCAST â€” Hot Frame (22Hz) + Full Truth (~7Hz)
    //
    // Hot Frame: Every HOT_FRAME_DIVIDER ticks (22Hz). Carries fixture dynamic data.
    //   â†’ Frontend â†’ RenderWorker â†’ HyperionView preview.
    //   â†’ Lightweight: fixtures array + beat + frame number.
    //
    // Full Truth: Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz).
    //   â†’ Full SeleneTruth. Feeds React stores, HUD, audio meters, etc.
    //
    // ðŸ‘» WAVE 2540.7: CHRONOS BYPASS â€” During Chronos playback, broadcast
    // full truth at full rate (44fps) since Cinema needs complete data.
    //
    // âš¡ WAVE 3065: Broadcast happens BEFORE flushToDriver() so the Aduana
    // never pollutes the UI data with DMX gate zeros.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // ðŸ‘» Chronos bypass check
    const chronosPlaying = this.engine?.isChronosPlaybackActive() ?? false
    const shouldBroadcastFullTruth = chronosPlaying || (this.frameCount % TitanOrchestrator.TRUTH_BROADCAST_DIVIDER === 0)

    // âš¡ WAVE 2464: PEAK HOLD â€” Acumula picos entre full truth broadcasts
    if (!chronosPlaying) {
      for (let _pi = 0; _pi < fixtureStates.length; _pi++) {
        const _f = fixtureStates[_pi]
        const _id = this.fixtures[_pi]?.id || `fix_${_pi}`
        const _prev = this.peakHoldMap.get(_id) ?? 0
        if (_f.dimmer > _prev) this.peakHoldMap.set(_id, _f.dimmer)
      }
    }

    const emitHotFrame = () => {
      if (!this.onHotFrame || (!chronosPlaying && this.frameCount % TitanOrchestrator.HOT_FRAME_DIVIDER !== 0)) {
        return
      }

      // WAVE 3403: Snapshot AudioMatrix status once per hot-frame (avoid double getStatus())
      const matrixStatus = this.trinity?.getAudioMatrix()?.getStatus()
      const hotFrame = {
        frameNumber: this.frameCount,
        timestamp: now, // âš¡ WAVE 3050: unified timestamp
        onBeat: engineAudioMetrics.isBeat,
        beatConfidence: engineAudioMetrics.beatConfidence,
        bpm: engineAudioMetrics.bpm,
        // ðŸŽµ WAVE 3250: UNLEASH THE SPECTRUM â€” Audio bands en hot-frame (44Hz)
        // Antes: bass/mid/high/energy solo viajaban en selene:truth (~7Hz).
        // AudioSpectrumTitan leÃ­a el MISMO valor 8-9 frames seguidos â†’ escalones.
        // Ahora viajan a 44Hz â€” el smoothstep del frontend interpola a 60fps.
        bass,
        mid,
        high,
        energy,
        // WAVE 3403: AudioMatrix telemetry piggybacked on hot-frame (zero extra IPC)
        ringBufferFillLevel: matrixStatus?.ringBufferFillLevel ?? 0,
        activeAudioSource: matrixStatus?.activeSource ?? null,
        fixtures: fixtureStates.map((f, i) => {
          const originalFixture = this.fixtures[i]
          const realId = originalFixture?.id || `fix_${i}`
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
          }
        })
      }
      this.onHotFrame(hotFrame)
    }

    // â”€â”€ HOT FRAME â€” Every HOT_FRAME_DIVIDER ticks (44Hz) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // âš¡ WAVE 3050: Throttled from 44Hz â†’ 22Hz. DMX stays at 44Hz.
    // âš¡ WAVE 4559: Overclock â†’ 44Hz. Strobe y flash sin frame-skip al canvas.
    // âš¡ WAVE 3065: Emitted BEFORE flushToDriver â€” values are real engine output.
    if (!this._aetherHasDevices) {
      emitHotFrame()
    }

    // âš¡ WAVE-4592: flushToDriver() ELIMINADO â€” la Aduana y el send DMX
    // son responsabilidad exclusiva del bloque Aether (aetherSafety + sendUniverseRaw).
    // this.hal.flushToDriver(fixtureStates)  â† DISCONNECTED WAVE-4592

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // âš›ï¸ WAVE 3505.4: AETHER MATRIX â€” V2 Agnostic Engine Pipeline
    //
    // Corre DESPUÃ‰S del pipeline legacy para no interferir con Ã©l.
    // El _aetherBus recibe intents de los Systems en una versiÃ³n futura.
    // Por ahora el NodeArbiter arbitrarÃ¡ lo que tenga (vacÃ­o = paquetes default).
    // El pipeline estÃ¡ listo para que cada System inyecte sus intents.
    //
    // Zero-alloc: los buffers Uint8Array son propiedad del NodeResolver.
    // Se envÃ­an al driver por referencia directa (zero-copy al hardware).
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (this._aetherHasDevices && this.hal) {
      const aetherArbiter = this._aetherArbiter
      const aetherResolver = this._aetherResolver
      const colorAdapter = this._colorAdapter
      const kineticAdapter = this._kineticAdapter
      const beamAdapter = this._beamAdapter
      const atmosphereAdapter = this._atmosphereAdapter
      const liquidAetherAdapter = this._liquidAetherAdapter
      const seleneAetherAdapter = this._seleneAetherAdapter

      if (
        !aetherArbiter ||
        !aetherResolver ||
        !colorAdapter ||
        !kineticAdapter ||
        !beamAdapter ||
        !atmosphereAdapter ||
        !liquidAetherAdapter ||
        !seleneAetherAdapter
      ) {
        // Lazy-init safety guard: si la matriz no existe todavÃ­a, salimos sin tocar el pipeline legacy.
      } else {
      // â”€â”€ WAVE 3516.2: Construir FrameContext in-place (cero alloc) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Mutar los campos del objeto pre-allocado en lugar de crear uno nuevo.
      // AudioMetrics: mapear bandas del SyncSmoother al vocabulario de Aether.
      const _sm   = this.syncSmoother.currentSmoothed
      const _a    = this._aetherAudio as AudioMetrics & Record<string, unknown>
      _a.subBass           = _sm.subBass ?? 0
      _a.bass              = engineAudioMetrics.bass
      _a.mid               = engineAudioMetrics.mid
      _a.highMid           = _sm.highMid ?? 0
      // WAVE 3516.1: rawTreble y ultraAir del 7Âº Pasajero â€” sin colapsar
      _a.presence          = this.lastAudioData.rawTreble  ?? (high * 0.8)
      _a.air               = this.lastAudioData.ultraAir   ?? (high * 0.3)
      _a.energy            = engineAudioMetrics.energy
      _a.hasTransient      = engineAudioMetrics.isBeat
      _a.transientStrength = engineAudioMetrics.beatConfidence
      _a.bpm               = engineAudioMetrics.bpm
      _a.beatPhase         = engineAudioMetrics.beatPhase
      _a.beatCount         = engineAudioMetrics.beatCount

      // MusicalContext: del contexto de Brain
      const _m = this._aetherMusical as MusicalContext & Record<string, unknown>
      _m.section          = (context.section?.type ?? 'unknown') as MusicalContext['section']
      _m.dropImminent     = context.energy > 0.8
      _m.sectionIntensity = engineAudioMetrics.energy
      _m.harmonicTension  = engineAudioMetrics.bass
      _m.sectionElapsedMs = context.section?.duration ?? 0

      // VibeProfile: del engine + paleta del intent
      const _v = this._aetherVibe as VibeProfile & Record<string, unknown>
      _v.name               = this.engine.getCurrentVibe()
      _v.palette            = ((intent.palette as unknown as { colors?: VibeProfile['palette'] }).colors ?? [{ h: 0, s: 0, l: 1 }])
      _v.movementSpeed      = 0.5
      _v.intensity          = intent.masterIntensity ?? engineAudioMetrics.energy
      _v.beamExpressiveness = 0.5

      // nowMs y frameIndex del scope
      this._aetherCtx.nowMs = now
      this._aetherCtx.frameIndex = this.frameCount

      // 1. Limpiar el bus de intents del frame anterior
      this._aetherBus.clear()
      // WAVE 4663 PASO 2: Limpiar el bus L1 de Selene (Silence Rule).
      // Si hasActiveEffects=false en este frame, Selene no empuja nada
      // â†’ bus queda vacÃ­o â†’ L1 es no-op â†’ L0 (Liquid/VMM) retoma control.
      this._seleneBus.clear()
      // WAVE 4705: limpiar bus L3 de LiveFX en cada frame.
      this._effectBus.clear()

      // â”€â”€ WAVE 4655 F1: L0 â€” LiquidAetherAdapter usa el engine activo segÃºn layout UI â”€â”€â”€â”€
      // Corrige split-brain: ya no se hardcodea liquidEngine71, se lee del engine activo.
      const _activeEngine = this.engine?.getActiveLiquidEngine()
      // ðŸ©º WAVE 4655-DIAG: log engine read (throttled)
      const _engineName = (_activeEngine as { constructor?: { name?: string } })?.constructor?.name ?? 'none'
      if (this._lastLoggedEngine !== _engineName) {
        console.log(`[TitanOrchestrator ðŸŒŠ] AETHER-ENGINE: ${_engineName} | frame=${this.frameCount}`)
        this._lastLoggedEngine = _engineName
      }
      const _liqFrame  = _activeEngine?.lastFrame ?? null
      const _liqResult = _activeEngine?.lastResult ?? null
      if (_liqFrame !== null && _liqResult !== null) {
          liquidAetherAdapter.ingest(_liqFrame, _liqResult, this._aetherBus)
      }

      // â”€â”€ 2. WAVE 3516.2: Systems escriben sus intents en el _aetherBus â”€â”€â”€â”€â”€
      const ctx = this._aetherCtx
      this._impactAdapter.process(
        this._aetherGraph.getView(NodeFamily.IMPACT),
        ctx,
        this._aetherBus,
        _liqResult ?? undefined,  // F1+F2: result del engine activo â€” fuente Ãºnica de dimmer
      )
      // ðŸŽ¨ WAVE 4522.3: Inyectar paleta RGB de SeleneLux al ColorAdapter antes de process()
      const _colorPalette = this.engine.getLastColorPalette()
      if (_colorPalette !== null) {
        colorAdapter.setIngress(_colorPalette)
      }
      colorAdapter.process(
        this._aetherGraph.getView(NodeFamily.COLOR),
        ctx,
        this._aetherBus,
      )
      kineticAdapter.process(
        this._aetherGraph.getView(NodeFamily.KINETIC),
        ctx,
        this._aetherBus,
      )
      // ðŸ”¦ WAVE 3516.4: Beam â€” Ã³pticas (gobos, prismas, zoom, focus)
      beamAdapter.process(
        this._aetherGraph.getView(NodeFamily.BEAM),
        ctx,
        this._aetherBus,
      )
      // ðŸŒ«ï¸ WAVE 3516.4: Atmosphere â€” elementos (fog, haze, fan, spark, pyro)
      atmosphereAdapter.process(
        this._aetherGraph.getView(NodeFamily.ATMOSPHERE),
        ctx,
        this._aetherBus,
      )

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ðŸš€ WAVE 4524.3: L3 â€” Selene-Aether Adapter (Puente Cognitivo)
      // Consume el output de Selene (effectDecision, colorDecision, physicsModifier)
      // y lo traduce en intenciones L3 atÃ³micas: dimmer, RGB, strobeRate.
      // REGLA ESTRICTA: NO emite movimiento (targetX/Y/Z ni pan/tilt).
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      const consciousnessOutput = this.lastConsciousnessOutput ?? null
      const effectOutput = getEffectManager().getCombinedOutput()
      // WAVE 4675: passport VIP de Selene/LiveFX para saltar MoverShield cuando
      // el efecto dominante lo requiere (p.ej. CorazonLatino, OroSolido).
      aetherArbiter.setSeleneOverrideMoverShield(effectOutput?.overrideMoverShield === true)
      // LiveFX se inyecta en bus L3 dedicado para que domine sobre L2 manual.
      seleneAetherAdapter.ingest(
        consciousnessOutput,
        effectOutput,
        ctx.deltaMs,
        this._effectBus,
      )

      // STEP 4.5: Playback LP bridge Chronos -> Aether
      this._chronosAetherAdapter.ingest(
        this._timelineEngine,
        ctx.deltaMs,
        aetherArbiter,
      )

      // STEP 5: Hephaestus L3+ Diamond Data bridge
      // Reuses `hephOutputs` from the legacy block above (SINGLE tick per frame).
      // The adapter only processes fixtures registered in NodeGraph (isCustomClip === true).
      // Legacy post-HAL block still handles fixtures NOT in NodeGraph (backward compat).
      if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
        this._hephaestusAetherAdapter.ingest(hephOutputs, aetherArbiter)
      } else {
        this._hephaestusAetherAdapter.clear(aetherArbiter)
      }

      // âš¡ WAVE 4700: Motor cinÃ©tico nativo L2 â€” tick antes de arbitrate().
      // Escribe pan_base/tilt_base por fixture en L2 si hay patrÃ³n manual activo.
      // dtSeconds calculado desde deltaMs (FrameScheduler, monotonic, nunca Date.now).
      if (aetherKineticEngine.isActive()) {
        aetherKineticEngine.tick(this._aetherCtx.deltaMs / 1000, aetherArbiter)
      }

      // ðŸ‘» WAVE 4952: PlasmaRenderer tick loop REMOVED (test-pattern poltergeist
      // amputated in the renderHook above â€” no plasma renderers are ever created).
      // ðŸŽ¬ WAVE 4867: Tick TheiaVideoRenderer â€” copia el thumb SAB al back buffer de
      // 'theia:active' si hay frame nuevo, sin allocaciones extra.
      if (this._theiaVideoRenderer !== null) {
        this._theiaVideoRenderer.tick()
      }
      this._pixelMapAdapter.ingest(aetherArbiter, this._aetherCanvasManager)

      // 3. El Arbiter unifica todas las capas â†’ ArbitratedNodeMap
      aetherArbiter.setSystemIntents(this._aetherBus)
      aetherArbiter.setEffectIntents(this._effectBus.getAll())
      const arbitrated = aetherArbiter.arbitrate()

      // 3.5. âš™ï¸ WAVE 4518.1: Physics Post-Processor â€” aplica inercia a nodos KINETIC
      // WOODSTOCK: deltaMs viene del FrameScheduler (performance.now()-based), NUNCA Date.now()
      this._physicsPostProcessor.process(
        arbitrated,
        this._aetherGraph,
        this._aetherCtx.deltaMs,
        this._aetherCtx.vibe.name,
      )

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ðŸ›‚ WAVE 4557: AETHER SAFETY MIDDLEWARE â€” LA ADUANA AETHER
      //
      // FASE 0: PRE-RESOLVE  â€” Output gate + virtual filter (muta ArbitratedNodeMap)
      // FASE 1: INTRA-RESOLVE â€” Velocity clamp, airbag, DarkSpin (called by NodeResolver)
      // FASE 2: POST-RESOLVE  â€” Throttle + virtual skip before sendUniverseRaw
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      const aetherSafety = this._aetherSafety

      // FASE 0: Set frame context + apply output gate
      aetherSafety.setFrameContext(now, this._aetherCtx.vibe.name)
      aetherSafety.setOutputEnabled(this._outputEnabled)
      aetherSafety.setManualNodeIds(aetherArbiter.getManualOverrideNodeIds())

      aetherSafety.applyOutputGate(arbitrated as Map<string, Record<string, number>>)

      // 4. NodeResolver traduce a Uint8Array(512) por universo (pre-alloc, in-place)
      // FASE 1 safety (velocity clamp, airbag, DarkSpin) runs INSIDE resolve via _safetyMiddleware
      // ðŸŽ¨ WAVE 4522.4: Inyectar contexto musical para HarmonicQuantizer (gating de ruedas)
      aetherResolver.setResolveContext(
        engineAudioMetrics.bpm,
        engineAudioMetrics.beatConfidence,
      )

      // WAVE 4548.6: Populate ForgeFrameContext in-place (zero-alloc)
      const _fCtx = this._forgeFrameCtx
      _fCtx.timeMs         = now
      _fCtx.deltaMs        = this._aetherCtx.deltaMs
      _fCtx.bpm            = engineAudioMetrics.bpm
      _fCtx.bpmConfidence  = engineAudioMetrics.beatConfidence
      _fCtx.isBeat         = engineAudioMetrics.isBeat
      _fCtx.energy         = engineAudioMetrics.energy
      _fCtx.frameIndex     = this.frameCount
      // Audio bands: write directly into pre-allocated Float64Array
      this._forgeAudioBands[0] = _a.subBass as number
      this._forgeAudioBands[1] = _a.bass as number
      this._forgeAudioBands[2] = _a.mid as number
      this._forgeAudioBands[3] = _a.highMid as number
      this._forgeAudioBands[4] = _a.presence as number
      this._forgeAudioBands[5] = _a.air as number
      aetherResolver.setForgeFrameContext(this._forgeFrameCtx)

      aetherResolver.resolve(arbitrated)

      // ðŸŽ­ WAVE 4617-B M4: UI projection AFTER resolve â€” zero frame lag.
      // NodeResolver.resolve() actualiza currentPosition con el IK result
      // del frame actual. project() + emitHotFrame() ahora leen frame N,
      // no frame N-1, eliminando el desfase de ~23ms del ordenamiento previo.
      // WAVE 4612: `arbitrated` se pasa para leer dimmers reales del mapa post-arbitraje.
      // ðŸš¨ WAVE 4634: blackoutActive se lee ANTES de project() para sincronizar
      // la UI con el apagÃ³n real del DMX (zero desfase visual).
      const blackoutActive = aetherArbiter.isBlackoutActive()
      this._aetherUIProjector.project(fixtureStates, this._aetherGraph, arbitrated, blackoutActive, this._aetherCtx.deltaMs)
      emitHotFrame()
      // FASE 2: POST-RESOLVE EGRESS â€” Throttle + virtual skip + send
      // WAVE 4656: Output gate final en orquestador (source of truth Aether).
      // WAVE 4681: Keepalive â€” siempre iteramos registeredUniverses para mantener
      // el link DMX vivo. NodeResolver ya tiene los buffers correctos:
      //   - outputEnabled=true  â†’ valores reales del engine
      //   - outputEnabled=false â†’ KINETIC/manual pasan; IMPACT/COLOR/BEAM/ATMO = 0
      // El hardware NECESITA recibir el paquete (aunque sea todo ceros) para no
      // reportar "no data yet". El Smart Gate (WAVE 4680) vive en _writeNode.
      const outputEnabled = this._outputEnabled
      this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)

      for (const universe of aetherResolver.registeredUniverses) {
        // ðŸ›‚ WAVE 4557: shouldSendUniverse checks virtual-only + throttle
        if (!aetherSafety.shouldSendUniverse(universe)) continue
        const rawBuf = aetherResolver.getUniverseBuffer(universe)
        if (!rawBuf) continue

        // WAVE 4633-OMEGA: Smart blackout semÃ¡ntico.
        // Solo canales de emisiÃ³n (dimmer/color) van a 0. Pan/tilt/speed conservan
        // sus valores para proteger la mecÃ¡nica de los movers.
        const egressBuf = blackoutActive
          ? aetherResolver.getSoftBlackoutUniverseBuffer(universe, rawBuf)
          : rawBuf

        // ðŸ”¥ WAVE 4835 â€” DMX BYPASS: InyecciÃ³n directa para Golden Nuke
        // Si el Tungsteno estÃ¡ lockeado, clava 255 en CH2-6 (GM, Strobe, G1, G2, G3)
        for (const [deviceId, lockInfo] of this._goldenNukeLocks) {
          if (lockInfo.universe === universe && Array.isArray(egressBuf)) {
            const base = lockInfo.dmxAddress - 1  // 0-based
            // CH2: Golden Master Dimmer â†’ 255
            egressBuf[base + 1] = 255
            // CH3: Strobe â†’ 255
            egressBuf[base + 2] = 255
            // CH4: Gold 1 â†’ 255
            egressBuf[base + 3] = 255
            // CH5: Gold 2 â†’ 255
            egressBuf[base + 4] = 255
            // CH6: Gold 3 â†’ 255
            egressBuf[base + 5] = 255
          }
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // ðŸ”¬ WAVE 4832 â€” DMX SNIFFER (TUNGSTEN)
        // Imprime los bytes exactos del Tungsteno en el buffer final,
        // ANTES de que salgan al adaptador fÃ­sico.
        // Eliminar cuando se confirme el diagnÃ³stico.
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (this.frameCount % 30 === 0) {
          const tungstenFixture = (this.fixtures as Array<{ name?: string; dmxAddress?: number; address?: number }>)
            .find(f => typeof f.name === 'string' && f.name.toLowerCase().includes('tungsten'))
          if (tungstenFixture) {
            const base = (tungstenFixture.dmxAddress ?? (tungstenFixture.address ?? 1)) - 1 // 0-based
            // console.log(
            //   `[DMX-SNIFFER] universe=${universe} | base=${base + 1} (1-based) | ` +
            //   `CH1(StartCode/Pan?)=${egressBuf[base]} | ` +
            //   `CH2(GM)=${egressBuf[base + 1]} | ` +
            //   `CH3(Strobe)=${egressBuf[base + 2]} | ` +
            //   `CH4(G1)=${egressBuf[base + 3]} | ` +
            //   `CH5(G2)=${egressBuf[base + 4]} | ` +
            //   `CH6(G3)=${egressBuf[base + 5]} | ` +
            //   `CH7=${egressBuf[base + 6]}`,
            // )
          }
        }
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        this.hal.sendUniverseRaw(universe, egressBuf)

        // ðŸ”¬ WAVE 4681: Log de supervivencia cada 300 frames (~5s a 44Hz)
        if (this.frameCount % 300 === 0) {
          let byteSum = 0
          for (let _bi = 0; _bi < egressBuf.length; _bi++) byteSum += egressBuf[_bi]
          console.log(
            `[Egress ðŸ“¤] Universe ${universe} â†’ HAL. ` +
            `Suma bytes: ${byteSum} | ` +
            `outputEnabled: ${outputEnabled} | ` +
            `blackout: ${blackoutActive}`,
          )
        }
      }

      // ðŸš€ WAVE 4681: Flush â€” empuja todos los buffers de universo al worker DMX
      // via UPDATE_BUFFER IPC (sendAll). Sin esto, setUniverse() escribe en buffer
      // pero el worker nunca recibe datos â†’ "no data yet" perpetuo.
      this.hal.flushAetherEgress()

      // ðŸ›‚ WAVE 4557: Safety telemetry (~1Hz)
      if (this.frameCount % 44 === 0) {
        const tel = aetherSafety.consumeTelemetry()
        if (tel.velocityClamps > 0 || tel.airbagHits > 0 || tel.aduanaBlocks > 0 || tel.darkSpinActive > 0) {
          console.log(
            `[AetherAduana ðŸ›‚] VelClamp:${tel.velocityClamps} Airbag:${tel.airbagHits} ` +
            `DarkSpin:${tel.darkSpinActive} AduanaGate:${tel.aduanaBlocks}`,
          )
        }
      }
      }
    }

    // ðŸ§¹ WAVE 2227 + WAVE 3065: El visual gate fue eliminado en WAVE 2227.
    // WAVE 3065 refuerza esto: la Aduana DMX (flushToDriver) es el ÃšNICO gate.
    // El broadcast UI siempre recibe los valores reales del engine.

    // â”€â”€ FULL TRUTH â€” Every TRUTH_BROADCAST_DIVIDER ticks (~7Hz) â”€â”€â”€â”€â”€â”€â”€â”€
    if (this.onBroadcast && shouldBroadcastFullTruth) {
      const currentVibe = this.engine.getCurrentVibe()
      
      // Build a valid SeleneTruth structure
      const truth: SeleneTruth = {
        system: {
          frameNumber: this.frameCount,
          timestamp: now, // âš¡ WAVE 3050: unified timestamp
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
          fft: this.EMPTY_FFT_BUFFER as number[],
          beat: {
            onBeat: engineAudioMetrics.isBeat,
            confidence: engineAudioMetrics.beatConfidence,
            bpm: engineAudioMetrics.bpm,  // ðŸ•°ï¸ WAVE 2090.3: Pacemaker PLL BPM
            beatPhase: engineAudioMetrics.beatPhase,  // ðŸ•°ï¸ WAVE 2090.3: PLL-driven phase
            barPhase: 0,
            timeSinceLastBeat: 0
          },
          input: {
            gain: this.inputGain,
            device: 'Microphone',
            active: this.hasRealAudio,
            isClipping: false
          },
          // ðŸ§  WAVE 1195: BACKEND TELEMETRY EXPANSION - 7 GodEar Tactical Bands
          spectrumBands: {
            subBass: this.syncSmoother.currentSmoothed.subBass,
            bass: bass,  // Use the already available bass from engineAudioMetrics
            lowMid: this.syncSmoother.currentSmoothed.lowMid,
            mid: mid,    // Use the already available mid from engineAudioMetrics
            highMid: this.syncSmoother.currentSmoothed.highMid,
            treble: high * 0.8,  // Approximate from high
            ultraAir: high * 0.3, // Approximate ultra-high from high
            dominant: bass > mid && bass > high ? 'bass' as const : 
                     mid > bass && mid > high ? 'mid' as const : 'treble' as const,
            flux: Math.abs((this.lastAudioData.energy || 0) - energy)
          }
        },
        // ðŸŒ¡ï¸ WAVE 283: Usar datos REALES del TitanEngine en vez de defaults
        // ðŸ§¬ WAVE 550: AÃ±adir telemetrÃ­a de IA para el HUD tÃ¡ctico
        // ðŸ”Œ WAVE 1175: DATA PIPE FIX - Inyectar vibe REAL desde el engine
        consciousness: {
          ...createDefaultCognitive(),
          stableEmotion: this.engine.getStableEmotion(),
          thermalTemperature: this.engine.getThermalTemperature(),
          ai: this.engine.getConsciousnessTelemetry(),
          // ðŸ”Œ WAVE 1175: Vibe activo REAL (no el default 'idle')
          vibe: {
            active: currentVibe as 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge' | 'idle' | 'custom',
            transitioning: false // TODO: implementar transiciÃ³n real
          }
        },
        // ðŸ§  WAVE 260: SYNAPTIC BRIDGE - Usar el contexto REAL del Brain
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
          timestamp: now // âš¡ WAVE 3050: unified timestamp
        },
        hardware: {
          dmx: {
            connected: true,
            driver: 'none',
            universe: 0,  // ðŸ”¥ WAVE 1219: ArtNet 0-indexed
            frameRate: 30,
            port: null
          },
          dmxOutput: DMX_OUTPUT_ZEROS as number[],
          fixturesActive: fixtureStates.reduce((count, f) => count + (f.dimmer > 0 ? 1 : 0), 0),
          fixturesTotal: fixtureStates.length,
          // Map HAL FixtureState to Protocol FixtureState
          // WAVE 256.3: Normalize DMX values (0-255) to frontend values (0-1)
          // WAVE 256.7: Map zone names for StageSimulator2 compatibility
          fixtures: fixtureStates.map((f, i) => {
            // \ud83d\udd27 WAVE 700.9.4: Map HAL zones to StageSimulator2 zones
            // \u26a1 WAVE 3050: ZONE_MAP is now a module-level constant (was per-fixture per-frame)
            const mappedZone = ZONE_MAP[f.zone] || f.zone || 'center'
            
            // ðŸ©¸ WAVE 380: Use REAL fixture ID from this.fixtures, not generated index
            // This is critical for runtimeStateMap matching in StageSimulator2
            const originalFixture = this.fixtures[i]
            const realId = originalFixture?.id || `fix_${i}`
            
            // âš¡ WAVE 2464: PEAK HOLD â€” Usa el pico acumulado en el frame skipeado.
            // Si el fixture brillÃ³ al mÃ¡ximo en el frame que el throttle saltÃ³, aquÃ­
            // mandamos ese pico al canvas. DespuÃ©s de leerlo: reset a 0 para el ciclo.
            // ðŸ‘» WAVE 2540.7: Skip peak hold during Chronos â€” every frame is broadcast,
            // no skipped frames means no peaks to accumulate.
            let broadcastDimmer: number
            if (chronosPlaying) {
              broadcastDimmer = f.dimmer
            } else {
              const peakDimmer = this.peakHoldMap.get(realId) ?? f.dimmer
              broadcastDimmer = Math.max(f.dimmer, peakDimmer)
              this.peakHoldMap.set(realId, 0)  // Reset peak tras broadcast
            }

            return {
              id: realId,
              name: f.name,
              type: f.type,
              zone: mappedZone,
              dmxAddress: f.dmxAddress,
              universe: f.universe,
              dimmer: broadcastDimmer / 255,    // Normalize 0-255 â†’ 0-1 (con peak hold)
              intensity: broadcastDimmer / 255, // Normalize 0-255 â†’ 0-1 (con peak hold)
              color: { 
                r: Math.round(f.r),             // Keep 0-255 for RGB
                g: Math.round(f.g), 
                b: Math.round(f.b) 
              },
              pan: f.pan / 255,                 // Normalize 0-255 â†’ 0-1
              tilt: f.tilt / 255,               // Normalize 0-255 â†’ 0-1
              // ðŸ” WAVE 339: Optics (from HAL/FixtureMapper)
              zoom: f.zoom,                     // 0-255 DMX
              focus: f.focus,                   // 0-255 DMX
              // âš’ï¸ WAVE 2030.22g: Extended LED channels
              white: f.white ?? 0,              // 0-255 DMX
              amber: f.amber ?? 0,              // 0-255 DMX
              // ðŸŽ›ï¸ WAVE 339: Physics (interpolated positions from FixturePhysicsDriver)
              physicalPan: (f.physicalPan ?? f.pan) / 255,   // Normalize 0-255 â†’ 0-1
              physicalTilt: (f.physicalTilt ?? f.tilt) / 255, // Normalize 0-255 â†’ 0-1
              panVelocity: f.panVelocity ?? 0,  // DMX/s (raw)
              tiltVelocity: f.tiltVelocity ?? 0, // DMX/s (raw)
              online: true,
              active: f.dimmer > 0,
              // ðŸ”¥ WAVE 2084.6: THE PHANTOM DATA LINK â€” Robust profileId cascade
              // Priority: originalFixture.profileId > fixtureState.profileId > originalFixture.id
              // NEVER let profileId be undefined â€” the ExtrasSection IPC depends on it
              profileId: originalFixture?.profileId || (f as any).profileId || originalFixture?.id || realId
            }
          })
        },
        timestamp: now // âš¡ WAVE 3050: unified timestamp
      }
      
      
      this.onBroadcast(truth)
      
      // ðŸ§¹ WAVE 671.5: Silenced SYNAPTIC BRIDGE spam (kept for future debug if needed)
      // ðŸ§  WAVE 260: Debug log para verificar que el contexto fluye a la UI
      // Log cada 2 segundos (60 frames @ 30fps)
      // if (this.frameCount % 60 === 0) {
      //   console.log(
      //     `[Titan] ðŸŒ‰ SYNAPTIC BRIDGE: Key=${context.key ?? '---'} ${context.mode} | ` +
      //     `Genre=${context.genre.macro}/${context.genre.subGenre ?? 'none'} | ` +
      //     `BPM=${context.bpm} | Energy=${(context.energy * 100).toFixed(0)}%`
      //   )
      // }
    }
    
    // ðŸ§¹ WAVE 671.5: Silenced frame count spam (7-8 logs/sec)
    // Log every second
    // if (shouldLog && this.config.debug) {
    //   const currentVibe = this.engine.getCurrentVibe()
    //   console.log(`[TitanOrchestrator] Frame ${this.frameCount}: Vibe=${currentVibe}, Fixtures=${fixtureStates.length}`)
    // }

    // WAVE 3401: OSC State Publisher -- broadcast current state every 3 frames (~12Hz)
    // Low-frequency broadcast avoids flooding the network while keeping external
    // VJ/lighting software in sync with LuxSync's musical analysis.
    if (this.oscProvider && this.frameCount % 3 === 0) {
      const currentVibe = this.engine?.getCurrentVibe() ?? 'idle'
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
      })
    }
  }

  /**
   * Set the current vibe
   * ðŸŽ¯ WAVE 289: Propagate vibe to Workers for Vibe-Aware Section Tracking
   * ðŸ”§ WAVE 2040.3: Fixed HAL receiving legacy alias instead of normalized ID
   */
  setVibe(vibeId: VibeId): void {
    if (this.engine) {
      // 1ï¸âƒ£ Set vibe in engine (normalizes legacy aliases internally)
      this.engine.setVibe(vibeId)
      
      // 2ï¸âƒ£ Get the ACTUAL normalized vibe ID from engine
      // This ensures HAL receives 'techno-club' not 'techno'
      const normalizedVibeId = this.engine.getCurrentVibe()
      
      console.log(`[TitanOrchestrator] Vibe set to: ${normalizedVibeId}`)
      // WAVE 257: Log vibe change to Tactical Log
      this.log('Mode', `ðŸŽ­ Vibe changed to: ${normalizedVibeId.toUpperCase()}`)
      
      // ðŸŽ¯ WAVE 289: Propagate vibe to Trinity Workers
      // El SectionTracker en los Workers usarÃ¡ perfiles vibe-aware
      if (this.trinity) {
        this.trinity.setVibe(normalizedVibeId)
        console.log(`[TitanOrchestrator] ðŸŽ¯ WAVE 289: Vibe propagated to Workers`)
      }
      
      // ðŸŽ¯ WAVE 338: Propagate vibe to HAL for Movement Physics
      // ðŸ”§ WAVE 2040.3: FIX - Use normalizedVibeId so HAL gets 'techno-club' not 'techno'
      // Los movers usarÃ¡n fÃ­sica diferente segÃºn el vibe
      if (this.hal) {
        this.hal.setVibe(normalizedVibeId)
        console.log(`[TitanOrchestrator] ðŸŽ›ï¸ WAVE 338: Movement physics updated for vibe`)
      }

      // ðŸ§¨ WAVE 2140: AMNESIA PROTOCOL â€” Hard reset del Pacemaker en BETA.
      // Un cambio de Vibe = nuevo track = el BPM anterior es basura.
      // Obligamos al motor a escuchar en blanco.
      if (this.trinity) {
        this.trinity.resetPacemaker()
        console.log(`[TitanOrchestrator] ðŸ§¨ WAVE 2140: Pacemaker reset triggered by vibe change â†’ ${normalizedVibeId}`)
      }

      // ðŸŒŠ WAVE 2432: THE GREAT WIRING â€” Hot-swap profile on vibe change
      this.engine.setActiveProfile(normalizedVibeId)

      // ðŸ§¹ WAVE 3230: THE VIBE RESET â€” Clean Slate al cambiar de motor de fÃ­sicas
      // Un cambio de Vibe es un cambio de universo. Los overrides manuales del
      // Layer 2 pertenecen al universo anterior. Limpiarlos garantiza que el
      // nuevo estado se hidrate desde cero desde la AI (Layer 0).
      // WAVE 4703: ArbitrationDirector bypased (WAVE 4592) â€” releaseAllManualOverrides removed.
      // L2 manual overrides en NodeArbiter se limpian via getAetherArbiter().releaseAll() si aplica.
      console.log(`[TitanOrchestrator] ðŸ§¹ WAVE 3230: Clean Slate for vibe ${normalizedVibeId}`)
    }
  }
  
  /**
   * ðŸŽ¨ WAVE 2019.6: Force Palette Sync
   * 
   * Regenera la paleta del Engine usando el color constitution del Vibe activo.
   * Usado por Chronos Timeline para sincronizar Stage color al cambiar Vibe.
   */
  forcePaletteSync(): void {
    if (this.engine) {
      this.engine.forcePaletteRefresh()
      console.log(`[TitanOrchestrator] ðŸŽ¨ Palette forcefully synced to current vibe`)
    }
  }

  /**
   * ðŸŽ­ WAVE 700.5.4: Set the current mood (calm/balanced/punk)
   * 
   * Mood controls effect frequency and intensity:
   * - CALM: 1-3 EPM (effects minimal, paleta respira)
   * - BALANCED: 4-6 EPM (narrativa visual)
   * - PUNK: 8-10 EPM (caos controlado)
   */
  setMood(moodId: 'calm' | 'balanced' | 'punk'): void {
    if (this.engine) {
      // Access backend MoodController singleton (already imported at top)
      MoodController.getInstance().setMood(moodId)
      
      console.log(`[TitanOrchestrator] ðŸŽ­ Mood set to: ${moodId.toUpperCase()}`)
      this.log('Mode', `ðŸŽ­ Mood changed to: ${moodId.toUpperCase()}`)
    }
  }

  /**
   * ðŸŽ­ WAVE 700.5.4: Get the current mood
   */
  getMood(): 'calm' | 'balanced' | 'punk' {
    return MoodController.getInstance().getCurrentMood()
  }

  /**
   * ðŸ‘» WAVE 2540.4: THE PHANTOM BUFFER â€” Cache pre-calculated GodEar heatmap
   * in TitanEngine for offline band lookup during timeline playback.
   */
  setChronosHeatmap(heatmap: unknown): void {
    if (this.engine) {
      this.engine.setChronosHeatmap(heatmap as any)
    }
  }

  /**
   * ðŸ‘» WAVE 2540.5: PLAYHEAD SYNC â€” Forward Chronos playhead to TitanEngine.
   * Called every frame from the frontend during Chronos playback.
   */
  setChronosPlayhead(timeMs: number, isPlaying: boolean): void {
    if (this.engine) {
      this.engine.setChronosPlayhead(timeMs, isPlaying)
    }
  }

  /**
   * WAVE 254: Set mode (auto/manual)
   */
  setMode(mode: string): void {
    this.mode = mode as 'auto' | 'manual'
    console.log(`[TitanOrchestrator] Mode set to: ${mode}`)
    // WAVE 257: Log mode change to Tactical Log
    this.log('System', `âš™ï¸ Mode: ${mode.toUpperCase()}`)
  }

  /**
   * WAVE 254: Enable/disable brain processing (Layer 0 + Layer 1)
   * ðŸ”´ DEPRECATED for consciousness control - use setConsciousnessEnabled instead
   * This kills EVERYTHING (blackout) - only use for full system stop
   */
  setUseBrain(enabled: boolean): void {
    this.useBrain = enabled
    console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)`)
    this.log('System', `ðŸ§  Brain: ${enabled ? 'ONLINE' : 'OFFLINE'}`)
  }
  
  /**
   * ðŸ§¬ WAVE 560: Enable/disable consciousness ONLY (Layer 1)
   * 
   * This is the CORRECT toggle for the AI switch:
   * - When OFF: Layer 0 (fÃ­sica reactiva) keeps running
   * - When ON: Layer 1 (consciousness) provides recommendations
   * 
   * NO MORE BLACKOUT!
   */
  setConsciousnessEnabled(enabled: boolean): void {
    this.consciousnessEnabled = enabled
    
    // Propagar al TitanEngine (Selene V2)
    if (this.engine) {
      this.engine.setConsciousnessEnabled(enabled)
    }
    
    console.log(`[TitanOrchestrator] ðŸ§¬ Consciousness ${enabled ? 'ENABLED âœ…' : 'DISABLED â¸ï¸'}`)
    this.log('Brain', `ðŸ§¬ Consciousness: ${enabled ? 'ACTIVE' : 'STANDBY'}`)
  }
  
  /**
   * ðŸŒŠ WAVE 2401: Set Liquid Stereo mode (7-band per-zone envelopes)
   */
  setLiquidStereo(enabled: boolean): void {
    if (this.engine) {
      this.engine.setLiquidStereo(enabled)
    }
    console.log(`[TitanOrchestrator] ðŸŒŠ Liquid Stereo: ${enabled ? 'ACTIVE' : 'OFF'}`)
    this.log('Physics', `ðŸŒŠ Liquid Stereo: ${enabled ? '7-BAND' : 'GOD MODE'}`)
  }

  /**
   * ðŸŒŠ WAVE 2432: THE GREAT WIRING â€” Layout Switch (4.1 / 7.1)
   */
  setLiquidLayout(mode: '4.1' | '7.1'): void {
    this.currentLiquidLayout = mode
    if (this.engine) {
      this.engine.setLiquidLayout(mode)
    }
    console.log(`[TitanOrchestrator] ðŸŒŠ Layout: ${mode}`)
    this.log('Physics', `ðŸŒŠ Layout switched to ${mode}`)
  }

  getLiquidLayout(): '4.1' | '7.1' {
    return this.currentLiquidLayout
  }
  
  /**
   * ðŸ§¬ WAVE 560: Get consciousness state
   */
  isConsciousnessEnabled(): boolean {
    return this.consciousnessEnabled
  }
  
  /**
   * ðŸ§¨ WAVE 610: FORCE STRIKE - Manual Effect Detonator
   * âš’ï¸ WAVE 2030.4: Hephaestus curve automation support
   * 
   * Dispara un efecto manualmente sin esperar decisiÃ³n de HuntEngine.
   * Ãštil para testear efectos visuales sin alterar umbrales de los algoritmos.
   * 
   * FLOW:
   * 1. Frontend llama window.lux.forceStrike({ effect: 'solar_flare', intensity: 1.0 })
   * 2. IPC handler llama titanOrchestrator.forceStrikeNextFrame(config)
   * 3. Este mÃ©todo llama engine's forceStrikeNextFrame(config)
   * 4. TitanEngine fuerza un trigger de EffectManager en el prÃ³ximo frame
   * 5. âš’ï¸ WAVE 2030.4: Si config.hephCurves existe, EffectManager crea un overlay
   * 
   * @param config - ForceStrikeConfig with effect, intensity, source, and optional hephCurves
   */
  forceStrikeNextFrame(config: ForceStrikeConfig): void {
    if (!this.engine) {
      console.warn('[TitanOrchestrator] ðŸ§¨ Cannot force strike - Engine not initialized')
      return
    }
    
    const sourceLabel = config.source === 'chronos' ? 'CHRONOS' : 'Manual'
    const hephTag = config.hephCurves ? ` âš’ï¸[HEPH: ${config.hephCurves.curves.size}]` : ''
    console.log(`[TitanOrchestrator] ðŸ§¨ ${sourceLabel} STRIKE: ${config.effect} @ ${config.intensity.toFixed(2)}${hephTag}`)
    this.log('Effect', `ðŸ§¨ ${sourceLabel} Strike: ${config.effect}`, { intensity: config.intensity })
    
    // Delegar al TitanEngine
    this.engine.forceStrikeNextFrame(config)
  }

  /**
   * WAVE 254: Set input gain for audio
   */
  setInputGain(gain: number): void {
    this.inputGain = Math.max(0, Math.min(2, gain))
    console.log(`[TitanOrchestrator] Input gain set to: ${this.inputGain}`)
  }

  /**
   * WAVE 255.5: Set callback for broadcasting truth to frontend
   * This enables StageSimulator2 to receive fixture states
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBroadcastCallback(callback: (truth: any) => void): void {
    this.onBroadcast = callback
  }

  /**
   * âš¡ WAVE 2510: Set callback for hot-frame broadcast (44Hz fixture data)
   * Carries only dynamic fixture data for the RenderWorker.
   * Separate from full SeleneTruth which continues at ~7Hz.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setHotFrameCallback(callback: (hotFrame: any) => void): void {
    this.onHotFrame = callback
  }

  /**
   * WAVE 257: Set callback for sending logs to frontend (Tactical Log)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onLog: ((entry: any) => void) | null = null
  
  setLogCallback(callback: (entry: any) => void): void {
    this.onLog = callback
  }

  /**
   * WAVE 257: Send a log entry to the frontend Tactical Log
   * @param category - Log category (Brain, Mode, Hunt, Beat, Music, Genre, Visual, DMX, System, Error, Info)
   * @param message - The log message
   * @param data - Optional additional data
   */
  log(category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.onLog) return
    
    this.onLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      category,
      message,
      data: data || null,
      level: category === 'Error' ? 'error' : 'info'
    })
  }

  /**
   * WAVE 255: Process incoming audio frame from frontend
   * ðŸ”¥ WAVE 1012.5: HYBRID SOURCE â€” Frontend = 30fps bass/mid/high/energy, Worker = extended FFT
   * âš¡ WAVE 3060b PHOENIX: RESTAURADO como hot-path. Frontend tiene prioridad visual.
   */
  processAudioFrame(data: Record<string, unknown>): void {
    if (!this.isRunning || !this.useBrain) return
    
    // Core bands - FRONTEND SOURCE (30fps)
    const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass
    const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid
    const high = typeof data.treble === 'number' ? data.treble : 
                 typeof data.high === 'number' ? data.high : this.lastAudioData.high
    const energy = typeof data.energy === 'number' ? data.energy : this.lastAudioData.energy
    
    // ðŸ”¥ WAVE 1012.5: HYBRID MERGE â€” Frontend core + preserve Worker extended
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
    }
    
    // Detect audio presence
    const wasAudioActive = this.hasRealAudio
    this.hasRealAudio = energy > 0.01
    
    if (this.hasRealAudio && !this.hasLoggedFirstAudio) {
      this.hasLoggedFirstAudio = true
      this.log('System', 'ðŸŽ§ AUDIO DETECTED - Selene is now listening!')
    } else if (!this.hasRealAudio && wasAudioActive) {
      this.log('System', 'ðŸ”‡ AUDIO LOST - Waiting for signal...')
    }
    
    this.lastAudioTimestamp = Date.now()
  }

  /**
   * ðŸ©¸ WAVE 259: RAW VEIN - Process raw audio buffer from frontend
   * This sends the Float32Array directly to BETA Worker for real FFT analysis
   */
  private audioBufferRejectCount = 0;
  private _audioSondaCount = 0;
  private _audioSondaTotal = 0;
  private _audioSondaStart = 0;
  processAudioBuffer(buffer: Float32Array): void {
    const _audioStart = performance.now() // ðŸ”¬ WAVE 3041: SONDA AUDIO
    // ðŸ” WAVE 264.7: LOG CUANDO SE RECHAZA
    if (!this.isRunning || !this.useBrain) {
      this.audioBufferRejectCount++;
      if (this.audioBufferRejectCount % 60 === 1) { // Log cada ~1 segundo
        console.warn(`[TitanOrchestrator] â›” audioBuffer REJECTED #${this.audioBufferRejectCount} | isRunning=${this.isRunning} | useBrain=${this.useBrain}`);
      }
      return;
    }
    
    // ï¿½ WAVE 3040: Loop RMS eliminado â€” buffer.reduce sobre 8192 floats
    // aunque sea cada 300 frames es trabajo innecesario en el hilo principal.
    // El buffer llega correctamente â€” log eliminado.
    
    // ðŸ—¡ï¸ WAVE 265: Update timestamp - el buffer llegando ES la seÃ±al de que el frontend vive
    this.lastAudioTimestamp = Date.now()

    // WAVE 3424: TWO MASTERS GUARD â€” Early exit si la fuente activa del AudioMatrix
    // NO es legacy-bridge. Cuando VW (u otra fuente SAB) estÃ¡ activa, AudioMatrix.ingestAudio()
    // rechaza el dato IPC con `source !== effectiveSource`. Pero el trabajo ya habrÃ­a
    // ocurrido: applyMicHeadroom (O(n) loop), write al SAB, etc.
    // Cortamos aquÃ­: si audioMatrix existe y la fuente activa es SAB, no hay nada que hacer.
    if (this.trinity) {
      const _matrix = this.trinity.getAudioMatrix()
      if (_matrix) {
        const _matrixStatus = _matrix.getStatus()
        if (_matrixStatus.activeSource && _matrixStatus.activeSource !== 'legacy-bridge') {
          // Fuente SAB activa â€” el IPC data es redundante, AudioMatrix lo rechazarÃ¡ de todos modos.
          // Marcamos timestamp pero descartamos el buffer para evitar trabajo innecesario.
          return
        }
      }
    }

    // ðŸ©¸ Send raw buffer to Trinity -> BETA Worker for FFT
    if (this.trinity) {
      this.trinity.feedAudioBuffer(buffer)
    } else {
      console.warn(`[TitanOrchestrator] âš ï¸ trinity is null! Buffer discarded.`);
    }
    
    // ðŸ”¬ WAVE 3041: acumular telemetrÃ­a de coste del handler de audio
    const _audioCostMs = performance.now() - _audioStart
    if (!this._audioSondaCount) this._audioSondaCount = 0
    if (!this._audioSondaTotal) this._audioSondaTotal = 0
    this._audioSondaCount++
    this._audioSondaTotal += _audioCostMs
    if (this._audioSondaCount % 40 === 0) { // ~2s a 20fps
      const _avg = (this._audioSondaTotal / 40).toFixed(3)
      console.warn(`[SONDA AUDIO] ðŸ”¬ avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`)
      this.log('Error', `[SONDA AUDIO] ðŸ”¬ avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`)
      this._audioSondaCount = 0; this._audioSondaTotal = 0
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
  setFixtures(fixtures: any[], stageBounds?: StageBoundsInput): '4.1' | '7.1' {
    return this.hydrationEngine.setFixtures(fixtures, stageBounds)
  }


  /**
   * WAVE 4590: Output gate canonical state for Aether pipeline.
   */
  setOutputEnabled(enabled: boolean): void {
    const nextEnabled = !!enabled
    this._outputEnabled = nextEnabled
  }

  /**
   * WAVE 4590: Read current output gate state consumed by AetherSafety.
   */
  isOutputEnabled(): boolean {
    return this._outputEnabled
  }

  /**
   * WAVE 4590: Toggle output gate canonical state.
   */
  toggleOutputEnabled(): boolean {
    this._outputEnabled = !this._outputEnabled
    return this._outputEnabled
  }

  /**
   * WAVE 252: Get current fixtures count
   */
  getFixturesCount(): number {
    return this.fixtures.length
  }

  /**
   * WAVE 4703: Fixture query API â€” replaces masterArbiter.getFixtureIds().
   * Used by TimelineEngine and HephaestusRuntime for zone resolution.
   */
  getFixtureIds(): string[] {
    return this.fixtures.map((f: any) => f.id as string)
  }

  /**
   * WAVE 4703: Zone mapping data â€” replaces masterArbiter.getFixturesForZoneMapping().
   * ðŸŒŠ WAVE 4951: Includes fixture type + capabilities for dynamic composite zone
   * resolution (all-movers, all-pars via capability, not just zone tags).
   */
  getFixturesForZoneMapping(): Array<{ id: string; zone: string; position?: { x: number }; enabled?: boolean; type?: string; capabilities?: { hasMovementChannels?: boolean } }> {
    return this.fixtures.map((f: any) => ({
      id: f.id as string,
      zone: (f.zone as string) || '',
      position: f.position as { x: number } | undefined,
      enabled: (f as any).enabled !== false,
      type: this.profileResolver.normalizeFixtureType(f.type),
      capabilities: f.capabilities,
    }))
  }

  /**
   * WAVE 4703: Zone ID â†’ fixture IDs resolution â€” replaces masterArbiter.getFixtureIdsByZone().
   */
  getFixtureIdsByZone(effectZone: string): string[] {
    const fixtures = this.getFixturesForZoneMapping()
    const result = resolveZone(effectZone, fixtures)
    if (result.length === 0) {
      console.warn(`[TitanOrchestrator] âš ï¸ Zone "${effectZone}" matched 0 fixtures â€” falling back to wildcard`)
      return this.getFixtureIds()
    }
    return result
  }

  /**
   * Get current state for diagnostics
   */
  getState(): {
    isInitialized: boolean
    isRunning: boolean
    frameCount: number
    currentVibe: string | null
    fixturesCount: number
  } {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      currentVibe: this.engine?.getCurrentVibe() ?? null,
      fixturesCount: this.fixtures.length,
    }
  }
  
}

// Singleton instance
let orchestratorInstance: TitanOrchestrator | null = null

/**
 * Get the TitanOrchestrator singleton
 * WAVE 380: Returns the registered instance (from main.ts) or creates a new one
 */
export function getTitanOrchestrator(): TitanOrchestrator {
  if (!orchestratorInstance) {
    console.warn('[TitanOrchestrator] âš ï¸ No instance registered, creating new one')
    orchestratorInstance = new TitanOrchestrator()
  }
  return orchestratorInstance
}

/**
 * WAVE 380: Register an existing instance as the singleton
 * Call this from main.ts after creating the orchestrator
 */
export function registerTitanOrchestrator(instance: TitanOrchestrator): void {
  if (orchestratorInstance && orchestratorInstance !== instance) {
    console.warn('[TitanOrchestrator] âš ï¸ Replacing existing singleton instance')
  }
  orchestratorInstance = instance
}
