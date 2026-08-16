/**
 * WAVE 4963 PHASE 8: TICK ENGINE
 * @module TickEngine
 */

import type { DeviceId } from '../../aether/types'
import type { HephFixtureOutput } from '../../hephaestus/runtime/HephaestusRuntime'
import { fixtureMatchesZone as zoneMapperMatch, resolveZone, type ZoneMappableFixture } from '../../zones/ZoneMapper'
import { getHephaestusRuntime } from '../IPCHandlers'
import { getEffectManager } from '../../effects/EffectManager'
import { aetherKineticEngine } from '../../aether/AetherKineticEngine'
import { NodeFamily } from '../../aether'
import type { AudioMetrics, MusicalContext, VibeProfile, FrameContext, NodeGraph, IntentBus, NodeArbiter, NodeResolver, PhysicsPostProcessor, VMMAdapter, LiquidImpactAdapter, AetherSafetyMiddleware } from '../../aether'
import { FIX_DATA_FLOATS, CHANNELS_PER_UNI, MAX_UNIVERSES } from '../../aether/glass/layout'
import { DmxUniverseWriter, getDmxSab } from '../../aether/glass/DmxSabHandlers'
import type { CalibrationEntry } from '../../aether/glass/CalibrationSAB'
import type { INodeIntent } from '../../aether/intent-bus'
import { SeleneTruth, createDefaultCognitive } from '../../protocol/SeleneProtocol'
import type { TrinityBrain } from '../../../brain/TrinityBrain'
import type { TitanEngine } from '../../../engine/TitanEngine'
import type { HardwareAbstraction } from '../../../hal/HardwareAbstraction'
import type { TrinityOrchestrator } from '../../../workers/TrinityOrchestrator'
import type { AudioPipelineManager } from '../audio/AudioPipelineManager'
import type { ColorAdapter } from '../../aether/adapters/ColorAdapter'
import type { BeamAdapter } from '../../aether/adapters/BeamAdapter'
import type { AtmosphereAdapter } from '../../aether/adapters/AtmosphereAdapter'
import type { LiquidAetherAdapter } from '../../aether/adapters/LiquidAetherAdapter'
import type { SeleneAetherAdapter } from '../../aether/adapters/selene-aether-adapter'
import type { ChronosAetherAdapter } from '../../aether/adapters/ChronosAetherAdapter'
import type { HephaestusAetherAdapter } from '../../aether/adapters/HephaestusAetherAdapter'
import type { AetherCanvasManager } from '../../aether/canvas/AetherCanvasManager'
import type { PixelMapAetherAdapter } from '../../aether/canvas/PixelMapAetherAdapter'
import type { AetherUIProjector } from '../../aether/resolver/AetherUIProjector'
import type { MutableForgeFrameContext } from '../../forge/compiler/types'
import type { BufferPoolManager } from '../../aether/glass/BufferPoolManager'
import type { OSCNexusProvider } from '../../audio/OSCNexusProvider'
import type { SeleneTheiaBridge } from '../../../theia/SeleneTheiaBridge'
import type { TimelineEngine } from '../../engine/TimelineEngine'

export interface TickContext {
  brain: TrinityBrain | null
  engine: TitanEngine | null
  hal: HardwareAbstraction | null
  trinity: TrinityOrchestrator | null
  audioPipeline: AudioPipelineManager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fixtures: any[]
  onHotFrame: ((hotFrame: any) => void) | null
  onBroadcast: ((truth: any) => void) | null
  _aetherHasDevices: boolean
  _outputEnabled: boolean
  _isHydrating: boolean
  _showGeneration: number
  _aetherArbiter: NodeArbiter | null
  _aetherResolver: NodeResolver | null
  _colorAdapter: ColorAdapter | null
  _kineticAdapter: InstanceType<typeof VMMAdapter> | null
  _beamAdapter: BeamAdapter | null
  _atmosphereAdapter: AtmosphereAdapter | null
  _liquidAetherAdapter: LiquidAetherAdapter | null
  _seleneAetherAdapter: SeleneAetherAdapter | null
  _chronosAetherAdapter: ChronosAetherAdapter
  _hephaestusAetherAdapter: HephaestusAetherAdapter
  _aetherCanvasManager: AetherCanvasManager
  _pixelMapAdapter: PixelMapAetherAdapter
  _physicsPostProcessor: PhysicsPostProcessor
  _aetherSafety: AetherSafetyMiddleware
  _forgeFrameCtx: MutableForgeFrameContext
  _forgeAudioBands: Float64Array
  _aetherUIProjector: AetherUIProjector
  _goldenNukeLocks: Map<string, { universe: number; dmxAddress: number }>
  _aetherGraph: NodeGraph
  _aetherBus: IntentBus
  _seleneBus: IntentBus
  _effectBus: IntentBus
  _impactAdapter: LiquidImpactAdapter
  _aetherAudio: AudioMetrics
  _aetherMusical: MusicalContext
  _aetherVibe: VibeProfile
  _aetherCtx: FrameContext
  _aetherStageBounds: { width: number; height: number; depth: number; centerY: number }
  _hephByFixtureId: Map<string, HephFixtureOutput[]>
  _hephByZone: Map<string, HephFixtureOutput[]>
  _hephOutputPool: Map<string, HephFixtureOutput[]>
  peakHoldMap: Map<string, number>
  _seleneThetaBridge: SeleneTheiaBridge | null
  _timelineEngine: TimelineEngine
  EMPTY_FFT_BUFFER: readonly number[]
  oscProvider: OSCNexusProvider | null
  _licenseTier: 'DJ_FOUNDER' | 'FULL_SUITE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastConsciousnessOutput: any
  mode: 'auto' | 'manual'
  inputGain: number
  useBrain: boolean
  glassPool: BufferPoolManager | null
  log: (category: string, message: string, data?: Record<string, unknown>) => void
}

const ZONE_MAP: Readonly<Record<string, string>> = {
  'FRONT_PARS': 'front', 'BACK_PARS': 'back', 'LEFT_PARS': 'left', 'RIGHT_PARS': 'right',
  'CENTER_PARS': 'center', 'TRUSS_WASH': 'truss', 'FLOOR_WASH': 'floor',
  'FRONT_MOVERS': 'front', 'BACK_MOVERS': 'back', 'LEFT_MOVERS': 'left', 'RIGHT_MOVERS': 'right',
  'CENTER_MOVERS': 'center', 'TRUSS_MOVERS': 'truss', 'FLOOR_MOVERS': 'floor',
  'HAZE': 'atmosphere', 'FOG': 'atmosphere', 'STROBE': 'effects', 'BLINDER': 'effects',
  'LASER': 'effects', 'UV': 'effects',
}
const DMX_OUTPUT_ZEROS: readonly number[] = Object.freeze(new Array(512).fill(0))

export class TickEngine {
  // 🩸 WAVE-6060: 44Hz / 4 = ~11Hz para UI fluida
  private static readonly TRUTH_BROADCAST_DIVIDER = 4
  private static readonly HOT_FRAME_DIVIDER = 1
  frameCount = 0; warlogHeartbeatFrame = 0; _lastLoggedEngine = ''
  private ctx: TickContext

  // ðŸ› ï¸ WAVE 5032: Pre-allocated mutable caches to eliminate .map() / {} / [] in hot path
  private _cachedFixtureStates: any[] = []
  private _cachedHotFrame: any = {}
  private _cachedHotFrameFixtures: any[] = []
  private _cachedChronosSet = new Set<string>()
  private _cachedTruthFixtures: any[] = []
  private _glassView = new Float32Array(FIX_DATA_FLOATS)
  private dmxWriter = new DmxUniverseWriter(getDmxSab())
  private _universeSnapshots = new Map<number, Uint8Array>()

  // P2: Pre-allocated Set/Array for commitFrame egress — zero-alloc per frame.
  private _universesToProcess = new Set<number>()
  private _uniList: Uint8Array[] = []

  // WAVE 7120: L3++ Calibration — plain entries stored directly (no SAB needed, both sides in main)
  private static _calibEntries: readonly INodeIntent[] = []
  private static _instances = new Set<TickEngine>()

  // 🔧 WAVE 7002.4 (T3): Phase crossfade — smooth transition between PLL and worker phase.
  // When pllLocked changes state, crossfade over PHASE_CROSSFADE_FRAMES frames
  // to avoid instantaneous phase jumps that cause visual discontinuities.
  private _phaseCrossfadeWeight = 0  // 0 = worker phase, 1 = PLL phase
  private _prevPllLocked = false
  private static readonly PHASE_CROSSFADE_FRAMES = 8

  // 🛡️ BPM STABILIZATION SHIELD: Hysteresis + EMA + Conditional feedKick
  private _stableBpm = 0
  private _bpmCandidate = 0
  private _bpmCandidateFrames = 0
  private _smoothedBpm = 0
  private static readonly BPM_HYSTERESIS_PCT = 0.08
  private static readonly BPM_CANDIDATE_CONFIRM_FRAMES = 60
  private static readonly BPM_CANDIDATE_MIN_CONFIDENCE = 0.7
  private static readonly BPM_CANDIDATE_TOLERANCE = 2
  private static readonly BPM_EMA_ALPHA = 0.15
  // 🛡️ Shield status tag for the BPM logger — set each frame by the
  // hysteresis gate so the post-shield log line can show whether the
  // gate accepted, rejected, or was bypassed (low confidence / freewheel).
  // Values: '' | '🛡️REJECT' | '🛡️HOLD' | '🛡️ACCEPT' | '⚠️OCT-DOWN' | '⚠️OCT-UP'
  private _shieldTag: string = ''

  get brain() { return this.ctx.brain }
  get engine() { return this.ctx.engine }
  get hal() { return this.ctx.hal }
  get trinity() { return this.ctx.trinity }
  get audioPipeline() { return this.ctx.audioPipeline }
  get fixtures() { return this.ctx.fixtures }
  get onHotFrame() { return this.ctx.onHotFrame }
  get onBroadcast() { return this.ctx.onBroadcast }
  get _aetherHasDevices() { return this.ctx._aetherHasDevices }
  get _outputEnabled() { return this.ctx._outputEnabled }
  get _isHydrating() { return this.ctx._isHydrating }
  get _showGeneration() { return this.ctx._showGeneration }
  get _aetherArbiter() { return this.ctx._aetherArbiter }
  get _aetherResolver() { return this.ctx._aetherResolver }
  get _colorAdapter() { return this.ctx._colorAdapter }
  get _kineticAdapter() { return this.ctx._kineticAdapter }
  get _beamAdapter() { return this.ctx._beamAdapter }
  get _atmosphereAdapter() { return this.ctx._atmosphereAdapter }
  get _liquidAetherAdapter() { return this.ctx._liquidAetherAdapter }
  get _seleneAetherAdapter() { return this.ctx._seleneAetherAdapter }
  get _chronosAetherAdapter() { return this.ctx._chronosAetherAdapter }
  get _hephaestusAetherAdapter() { return this.ctx._hephaestusAetherAdapter }
  get _aetherCanvasManager() { return this.ctx._aetherCanvasManager }
  get _pixelMapAdapter() { return this.ctx._pixelMapAdapter }
  get _physicsPostProcessor() { return this.ctx._physicsPostProcessor }
  get _aetherSafety() { return this.ctx._aetherSafety }
  get _forgeFrameCtx() { return this.ctx._forgeFrameCtx }
  get _forgeAudioBands() { return this.ctx._forgeAudioBands }
  get _aetherUIProjector() { return this.ctx._aetherUIProjector }
  get _goldenNukeLocks() { return this.ctx._goldenNukeLocks }
  get _aetherGraph() { return this.ctx._aetherGraph }
  get _aetherBus() { return this.ctx._aetherBus }
  get _seleneBus() { return this.ctx._seleneBus }
  get _effectBus() { return this.ctx._effectBus }
  get _impactAdapter() { return this.ctx._impactAdapter }
  get _aetherAudio() { return this.ctx._aetherAudio }
  get _aetherMusical() { return this.ctx._aetherMusical }
  get _aetherVibe() { return this.ctx._aetherVibe }
  get _aetherCtx() { return this.ctx._aetherCtx }
  get _aetherStageBounds() { return this.ctx._aetherStageBounds }
  get _hephByFixtureId() { return this.ctx._hephByFixtureId }
  get _hephByZone() { return this.ctx._hephByZone }
  get _hephOutputPool() { return this.ctx._hephOutputPool }
  get peakHoldMap() { return this.ctx.peakHoldMap }
  get _seleneThetaBridge() { return this.ctx._seleneThetaBridge }
  get _timelineEngine() { return this.ctx._timelineEngine }
  get EMPTY_FFT_BUFFER() { return this.ctx.EMPTY_FFT_BUFFER }
  get oscProvider() { return this.ctx.oscProvider }
  get _licenseTier() { return this.ctx._licenseTier }
  get lastConsciousnessOutput() { return this.ctx.lastConsciousnessOutput }
  get mode() { return this.ctx.mode }
  get inputGain() { return this.ctx.inputGain }
  get useBrain() { return this.ctx.useBrain }

  log(category: string, message: string, data?: Record<string, unknown>) { this.ctx.log(category, message, data) }
  constructor(ctx: TickContext) { this.ctx = ctx
    TickEngine._instances.add(this)
  }

  /** WAVE 7120: Write calibration entries directly (no SAB — both sides in main process).
   *  WAVE 7120.1: Compound fixture expansion — expand simple family nodeIds
   *  (e.g. 'fixtureId:impact') to all real NodeGraph nodeIds of that family
   *  (e.g. 'fixtureId:impact-20', 'fixtureId:impact-14') for compound fixtures. */
  static writeCalibration(entries: ReadonlyArray<CalibrationEntry>): void {
    // Get the first TickEngine instance to access the NodeGraph
    const instance = TickEngine._instances.values().next().value as TickEngine | undefined
    const graph = instance?._aetherGraph

    const intents: INodeIntent[] = []
    for (const entry of entries) {
      const values: Record<string, number> = {}
      for (const ch of entry.channels) {
        values[ch.channel] = ch.value
      }

      if (graph) {
        // Try to expand compound fixture: nodeId format is 'fixtureId:family'
        const sep = entry.nodeId.lastIndexOf(':')
        if (sep > 0) {
          const fixtureId = entry.nodeId.slice(0, sep)
          const family = entry.nodeId.slice(sep + 1)
          const deviceNodes = graph.getDeviceNodes(fixtureId as import('../../aether/types').DeviceId)
          if (deviceNodes.length > 0) {
            // Find all nodes of this family
            const familyNodeIds: string[] = []
            const familyUpper = family.toUpperCase()
            for (const nodeId of deviceNodes) {
              const nd = graph.getNodeData(nodeId)
              if (nd && nd.family === familyUpper) familyNodeIds.push(nodeId)
            }
            if (familyNodeIds.length > 0) {
              // Compound fixture: emit one intent per real node
              for (const nodeId of familyNodeIds) {
                intents.push({ nodeId, values, priority: 0, confidence: 1, source: 'hephaestus' })
              }
              continue
            }
          }
        }
      }

      // Fallback: use the nodeId as-is (simple fixture or no graph available)
      intents.push({ nodeId: entry.nodeId, values, priority: 0, confidence: 1, source: 'hephaestus' })
    }
    TickEngine._calibEntries = intents
  }

  /** WAVE 7120: Clear calibration entries. */
  static clearCalibration(): void {
    TickEngine._calibEntries = []
  }

  async tick(): Promise<void> {
    // ⏱️ WAVE 5037: CHRONOS-ALERT — perf profiling del tick loop.
    // Si el tiempo de ejecución supera ~15ms, el Event Loop se ahoga y
    // el frame scheduler empieza a saltar frames → parpadeo / stutter.
    const _tickStart = performance.now()

    // WAVE 7124: Forensic phase timers (read-only instrumentation)
    let _t_ingest_end = 0, _t_arbitrate_start = 0, _t_arbitrate_end = 0
    let _t_hal_start = 0, _t_hal_end = 0, _t_glass_start = 0, _t_glass_end = 0

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”’ WAVE 2211: STAMPEDE GUARD (now in FrameScheduler._onInterval())
    // The FrameScheduler skips ticks if the previous async processFrame()
    // is still running. Contract preserved — guard moved to the scheduler.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (!this.brain || !this.engine || !this.hal) return

    // F2: HYDRATION LOCK GUARD — skip tick while setFixtures rebuilds the Aether graph.
    // Prevents the engine from reading a partially-constructed device graph or
    // emitting DMX to addresses that no longer exist in the new show.
    if (this._isHydrating) return

    // PARCHE 4: Capturar generación del show al inicio del tick.
    // Si setFixtures() se ejecuta durante el await de engine.update(),
    // el grafo Aether y el Arbiter serán de una generación distinta —
    // abortar el tick para evitar emitir DMX con intents obsoletos.
    const _tickShowGeneration = this._showGeneration

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
    //   const timeSinceLastAudio = Date.now() - this.audioPipeline.lastAudioTimestamp
    //   console.log(`[Titan] ðŸ« Heartbeat #${this.frameCount}: Audio flowing? ${this.audioPipeline.hasRealAudio} | Last Packet: ${timeSinceLastAudio}ms ago`)
    // }
    
    // 1. Brain produces MusicalContext
    const context = this.brain.getCurrentContext()
    
    // WAVE 3424: GRACE HOLD — Staleness detection with grace period.
    // Replaces inline staleness check with AudioPipelineManager.checkStaleness().
    // During grace: hasRealAudio stays true, bands decay gradually (no black cut).
    // After grace: hasRealAudio = false, full zero-out.
    const now = Date.now()
    this.audioPipeline.checkStaleness(this.frameCount, shouldLog)
    
    // 2. WAVE 255: Use real audio if available, otherwise silence (IDLE mode)
    let bass: number, mid: number, high: number, energy: number
    
    if (this.audioPipeline.hasRealAudio) {
      bass = this.audioPipeline.lastAudioData.bass * this.inputGain
      mid = this.audioPipeline.lastAudioData.mid * this.inputGain
      high = this.audioPipeline.lastAudioData.high * this.inputGain
      energy = this.audioPipeline.lastAudioData.energy * this.inputGain
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
    this.audioPipeline.syncSmoother.smooth(
      {
        harshness:       this.audioPipeline.lastAudioData.harshness,
        spectralFlatness: this.audioPipeline.lastAudioData.spectralFlatness,
        spectralCentroid: this.audioPipeline.lastAudioData.spectralCentroid,
        subBass:          this.audioPipeline.lastAudioData.subBass,
        lowMid:           this.audioPipeline.lastAudioData.lowMid,
        highMid:          this.audioPipeline.lastAudioData.highMid,
        crestFactor:      this.audioPipeline.lastAudioData.crestFactor,
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
    const workerBpm = this.audioPipeline.lastAudioData.workerBpm ?? 0
    const workerConfidence = this.audioPipeline.lastAudioData.workerBpmConfidence ?? 0
    const workerOnBeat = this.audioPipeline.lastAudioData.workerOnBeat ?? false
    const workerBeatPhase = this.audioPipeline.lastAudioData.workerBeatPhase ?? 0
    let acceptedBpm = workerBpm  // 🛡️ May be overridden by hysteresis gate
    this._shieldTag = ''  // reset each frame; set by hysteresis gate below
    
    if (this.audioPipeline.beatDetector && this.audioPipeline.hasRealAudio) {
      // ðŸ”¥ WAVE 2112 + WAVE 2179: WORKER BPM â†’ PLL
      // Worker con seÃ±al â†’ setBpm() = lock real (PLL anclado a la verdad fÃ­sica)
      // Worker sordo pero memoria reciente â†’ freewheelAt() = inercia correcta
      // Worker sordo Y memoria expirada â†’ PLL cae al Pacemaker interno (120 default)
      // PunkArchytect doctrine: Worker = OÃ­dos (honesto). Cerebro = Memoria (inerte).
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (workerBpm > 0 && workerConfidence > 0.5) {
        // 🛡️ BPM STABILIZATION SHIELD — Hysteresis Gate
        // If workerBpm differs from stable BPM by >8%, require 60 consecutive
        // frames at conf>0.7 before accepting. Prevents dembow ghost-kick
        // half-time detection (e.g., 101→89) from causing instant jumps.
        if (this._stableBpm > 0) {
          const delta = Math.abs(workerBpm - this._stableBpm) / this._stableBpm
          if (delta > TickEngine.BPM_HYSTERESIS_PCT) {
            // Large change — require confirmation
            // 🛡️ Detect octave jumps (×2 or ÷2) for the logger tag
            const ratio = workerBpm / this._stableBpm
            const isOctaveDown = ratio < 0.55 && ratio > 0.45  // ~÷2
            const isOctaveUp = ratio > 1.85 && ratio < 2.15    // ~×2
            if (Math.abs(workerBpm - this._bpmCandidate) <= TickEngine.BPM_CANDIDATE_TOLERANCE
                && workerConfidence > TickEngine.BPM_CANDIDATE_MIN_CONFIDENCE) {
              this._bpmCandidateFrames++
              if (this._bpmCandidateFrames >= TickEngine.BPM_CANDIDATE_CONFIRM_FRAMES) {
                this._stableBpm = workerBpm
                this._bpmCandidate = 0
                this._bpmCandidateFrames = 0
                this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN✅' : (isOctaveUp ? '⚠️OCT-UP✅' : '🛡️ACCEPT')
              } else {
                acceptedBpm = this._stableBpm
                this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN🛡️' : (isOctaveUp ? '⚠️OCT-UP🛡️' : '🛡️HOLD')
              }
            } else {
              this._bpmCandidate = workerBpm
              this._bpmCandidateFrames = 0
              acceptedBpm = this._stableBpm
              this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN🛡️' : (isOctaveUp ? '⚠️OCT-UP🛡️' : '🛡️REJECT')
            }
          } else {
            // Small change — accept and update stable
            this._stableBpm = workerBpm
            this._bpmCandidate = 0
            this._bpmCandidateFrames = 0
          }
        } else {
          this._stableBpm = workerBpm
        }
        // 🔧 WAVE 7002.4 (T2): Only call setBpm() when BPM actually changes.
        if (this.audioPipeline.lastSetBpm !== acceptedBpm) {
          this.audioPipeline.beatDetector.setBpm(acceptedBpm)
          this.audioPipeline.lastSetBpm = acceptedBpm
        }
        this.audioPipeline.lastStableWorkerBpm = acceptedBpm
        this.audioPipeline.lastStableWorkerBpmFrame = this.frameCount
      } else {
        // ðŸ”¥ WAVE 2179: Worker sordo â†’ Â¿tenemos memoria reciente?
        const framesSinceStable = this.frameCount - this.audioPipeline.lastStableWorkerBpmFrame
        if (this.audioPipeline.lastStableWorkerBpm > 0 && framesSinceStable <= this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES) {
          // FREEWHEEL: PLL gira en la frecuencia real, no en 120 BPM
          this.audioPipeline.beatDetector.freewheelAt(this.audioPipeline.lastStableWorkerBpm)
        }
        // Si el timeout expirÃ³ â†’ sin freewheelAt(), PLL se suelta al Pacemaker interno
      }
      
      // PLL Flywheel: advances phase continuously for smooth beat prediction
      beatState = this.audioPipeline.beatDetector.tick(now) // âš¡ WAVE 3050: unified timestamp
      
      // Override onBeat with Worker's real detection (PLL can predict, but Worker detects)
      if (workerOnBeat) {
        beatState.onBeat = true
        beatState.kickDetected = true
        // 🔧 WAVE 7002 (F11): Feed real kick timestamp to PLL phase corrector.
        // 🛡️ BPM SHIELD: Only feed kicks when worker confidence > 0.3 to prevent
        // false PLL locks on ghost kicks (dembow half-time detection).
        if (workerConfidence > 0.3) {
          this.audioPipeline.beatDetector.feedKick(now)
        }
      }
      // NOTE: The [TitanOrchestrator] BPM logger was moved to AFTER the
      // hysteresis gate + EMA shield (see "CLEAN THE CHASSIS" block below)
      // so it reports the post-shield context.bpm actually sent downstream,
      // not the pre-shield workerBpm that caused false alarms.
    } else if (this.audioPipeline.beatDetector) {
      // WAVE 2090.3: THE FLYWHEEL - tick even without audio
      // The metronome keeps spinning on inertia (freewheel mode)
      beatState = this.audioPipeline.beatDetector.tick(now) // âš¡ WAVE 3050: unified timestamp
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
    const _framesSinceStable = this.frameCount - this.audioPipeline.lastStableWorkerBpmFrame
    const hasFreewheelMemory = this.audioPipeline.lastStableWorkerBpm > 0 && _framesSinceStable <= this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES

    if (workerBpm > 0 && workerConfidence > 0.5) {
      // Priority 1: Worker activo (hysteresis-filtered)
      context.bpm = acceptedBpm
      // 🔧 WAVE 7003 (F5) + WAVE 7002.4 (T3): Phase crossfade.
      // Always prefer PLL phase, but crossfade on lock state transitions
      // to avoid instantaneous phase jumps that cause visual discontinuities.
      const pllPhase = beatState.pllPhase
      if (pllPhase !== undefined && pllPhase !== null) {
        // Update crossfade weight based on lock state
        const targetWeight = beatState.pllLocked ? 1 : 0
        if (beatState.pllLocked !== this._prevPllLocked) {
          // Lock state changed — start crossfade
          this._prevPllLocked = beatState.pllLocked
        }
        // Ease weight toward target
        const step = 1 / TickEngine.PHASE_CROSSFADE_FRAMES
        if (this._phaseCrossfadeWeight < targetWeight) {
          this._phaseCrossfadeWeight = Math.min(targetWeight, this._phaseCrossfadeWeight + step)
        } else if (this._phaseCrossfadeWeight > targetWeight) {
          this._phaseCrossfadeWeight = Math.max(targetWeight, this._phaseCrossfadeWeight - step)
        }
        // Crossfade between worker and PLL phase (circular interpolation)
        const w = this._phaseCrossfadeWeight
        let diff = pllPhase - workerBeatPhase
        // Wrap to shortest path
        if (diff > 0.5) diff -= 1
        if (diff < -0.5) diff += 1
        context.beatPhase = (workerBeatPhase + diff * w + 1) % 1
      } else {
        context.beatPhase = workerBeatPhase
      }
      context.syncopation = this.audioPipeline.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid)
    } else if (hasFreewheelMemory) {
      // ðŸ”¥ WAVE 2179: Priority 2 â€” FREEWHEEL MEMORY
      // Las luces no se enteran del break. El show continÃºa en el BPM real.
      context.bpm = this.audioPipeline.lastStableWorkerBpm
      context.beatPhase = beatState.pllPhase ?? beatState.phase
      context.syncopation = this.audioPipeline.syncSmoother.estimateSyncopation(context.beatPhase, bass, mid)
    } else if (beatState.bpm > 0 && beatState.confidence > 0) {
      // Priority 3: Pacemaker interno (cuando no hay ningÃºn recuerdo del Worker)
      context.bpm = beatState.bpm
      context.beatPhase = beatState.pllPhase ?? beatState.phase
      context.syncopation = this.audioPipeline.syncSmoother.estimateSyncopation(
        beatState.pllPhase ?? beatState.phase,
        bass,
        mid
      )
    }

    // 🛡️ BPM STABILIZATION SHIELD — EMA Smoothing
    // Smooth the target BPM to eliminate instantaneous jumps.
    // α=0.15 → ~4 seconds to converge on a large step change.
    if (this._smoothedBpm <= 0) {
      this._smoothedBpm = context.bpm
    } else if (context.bpm > 0) {
      this._smoothedBpm = (TickEngine.BPM_EMA_ALPHA * context.bpm) + (1 - TickEngine.BPM_EMA_ALPHA) * this._smoothedBpm
    }
    context.bpm = this._smoothedBpm

    // ═══════════════════════════════════════════════════════════════════
    // 📊 CLEAN THE CHASSIS: Post-shield BPM logger
    // Reports the FINAL context.bpm (post-hysteresis + post-EMA) that is
    // actually sent to TitanEngine/VMM, alongside the raw Oracle value for
    // debugging. This replaces the old pre-shield logger that caused false
    // alarms by printing workerBpm before the hysteresis gate could reject
    // octave-down jumps (e.g., 124→62).
    // ═══════════════════════════════════════════════════════════════════
    if (this.frameCount % 60 === 0) {
      const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL'
      const syncInfo = this.audioPipeline.syncSmoother.currentSyncopation.toFixed(2)
      const _framesSinceLog = this.frameCount - this.audioPipeline.lastStableWorkerBpmFrame
      const freewheelTag = (!beatState.pllLocked && this.audioPipeline.lastStableWorkerBpm > 0 && _framesSinceLog <= this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES)
        ? ` [mem=${this.audioPipeline.lastStableWorkerBpm.toFixed(2)}@-${_framesSinceLog}f]`
        : ''
      const rawEnergy = (this.audioPipeline.lastAudioData.rawBassEnergy ?? 0).toFixed(4)
      const sabFill = this.trinity?.getAudioMatrix()?.getStatus()?.ringBufferFillLevel?.toFixed(3) ?? 'n/a'
      const inputPeak = (this.audioPipeline.lastAudioData.inputPeakAbs ?? 0).toFixed(5)
      const inputRms  = (this.audioPipeline.lastAudioData.inputRMS ?? 0).toFixed(5)
      // rawBpm = raw Oracle output (pre-Kalman, pre-shield) for debugging
      const workerRawBpm = this.audioPipeline.lastAudioData.workerRawBpm ?? 0
      // context.bpm = post-hysteresis + post-EMA = value sent to TitanEngine/VMM
      // _shieldTag = 🛡️HOLD/🛡️REJECT/🛡️ACCEPT/⚠️OCT-DOWN🛡️/⚠️OCT-UP🛡️ when the
      // hysteresis gate acted on a large BPM jump this frame (empty = small/none)
      const shieldTagStr = this._shieldTag ? ` ${this._shieldTag}` : ''
      console.log(`[TitanOrchestrator] ðŸŽ§ BPM=${context.bpm.toFixed(2)} (raw=${workerRawBpm.toFixed(2)}) conf=${workerConfidence.toFixed(2)}${shieldTagStr} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.audioPipeline.lastAudioData.workerKickCount ?? 0} | bass=${rawEnergy} sab=${sabFill} | ðŸ”¬in_peak=${inputPeak} in_rms=${inputRms}`)
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
      beatCount: this.audioPipeline.lastAudioData.workerKickCount ?? beatState.beatCount,
      bpm: context.bpm,
      beatConfidence: workerConfidence > 0 ? workerConfidence : beatState.confidence,
      // 🔧 WAVE 7002 (F2): Propagate pllLocked to TitanEngine for Cassandra
      pllLocked: beatState.pllLocked,
      // ðŸŒŠ WAVE 1011.5: MÃ©tricas FFT SUAVIZADAS (WAVE 3504.5: via SyncSmoother)
      harshness: this.audioPipeline.syncSmoother.currentSmoothed.harshness,
      spectralFlatness: this.audioPipeline.syncSmoother.currentSmoothed.spectralFlatness,
      spectralCentroid: this.audioPipeline.syncSmoother.currentSmoothed.spectralCentroid,
      // ðŸ’¥ WAVE 2352: crestFactor RAW para physics engines - los transitorios de kick NO se suavizan
      // El EMA destruye el pico que diferencia un bombo de un rolling bass
      crestFactor: this.audioPipeline.lastAudioData.crestFactor ?? this.audioPipeline.syncSmoother.currentSmoothed.crestFactor,
      // ðŸŽ¸ WAVE 1011.5: Bandas extendidas SUAVIZADAS
      subBass: this.audioPipeline.syncSmoother.currentSmoothed.subBass,
      lowMid: this.audioPipeline.syncSmoother.currentSmoothed.lowMid,
      highMid: this.audioPipeline.syncSmoother.currentSmoothed.highMid,
      // ðŸ”¥ WAVE 2112: Transients from Worker (fresh FFT) â€” Pacemaker no longer detects kicks
      // ðŸ›¡ï¸ WAVE 2512 FIX 2: Kick Signal Veto in Freewheel
      // kickDetected only fires if Worker directly detected OR PLL has a real lock.
      // Prevents phantom Pacemaker kicks from polluting physics engines (LiquidEngineBase isKick).
      kickDetected: workerOnBeat || (beatState.pllLocked && this.audioPipeline.lastAudioData.kickDetected),
      snareDetected: this.audioPipeline.lastAudioData.snareDetected,
      hihatDetected: this.audioPipeline.lastAudioData.hihatDetected,
      // WAVE 8008: Rhythmic percussion isolated energies
      snare_energy: this.audioPipeline.lastAudioData.rhythmic?.snare_energy,
      hh_energy: this.audioPipeline.lastAudioData.rhythmic?.hh_energy,
      // 🌊 WAVE 8003: Photon block — strobe inputs + wallIntensity from GodEarFFT
      photon: this.audioPipeline.lastAudioData.photon,
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
      bpmConfidence: this.audioPipeline.lastAudioData?.workerBpmConfidence ?? 0,
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
    // WAVE FIX: Override engineAudioMetrics with phantom audio BEFORE engine.update()
    // so the LiquidEngine processes real audio data and produces non-zero zonal intensities.
    const _phantomAudioPre = this.engine?.getPhantomAudioMetrics()
    if (_phantomAudioPre) {
      engineAudioMetrics.bass = _phantomAudioPre.bass
      engineAudioMetrics.mid = _phantomAudioPre.mid
      engineAudioMetrics.high = _phantomAudioPre.high
      engineAudioMetrics.energy = _phantomAudioPre.energy
      engineAudioMetrics.subBass = _phantomAudioPre.subBass
      engineAudioMetrics.lowMid = _phantomAudioPre.lowMid
      engineAudioMetrics.highMid = _phantomAudioPre.highMid
    }

    // 🔒 TOTEM FIX: Compute dominant mount orientation from KINETIC nodes.
    // The VMM needs this to apply the correct tiltOffset per orientation
    // (e.g. totem -0.45 audience bias). Without this, all fixtures get the
    // floor offset in the automatic VMM path.
    if (this.engine && this._aetherGraph) {
      const kineticNodes = this._aetherGraph.getView(NodeFamily.KINETIC)
      let dominantOrientation: string | undefined = undefined
      if (kineticNodes.count > 0) {
        const orientationCounts = new Map<string, number>()
        kineticNodes.forEach((node) => {
          const inst = (node as any).ikOrientation?.installation
          if (inst) {
            orientationCounts.set(inst, (orientationCounts.get(inst) ?? 0) + 1)
          }
        })
        // Pick the most common orientation
        let maxCount = 0
        for (const [ori, count] of orientationCounts) {
          if (count > maxCount) {
            maxCount = count
            dominantOrientation = ori
          }
        }
      }
      this.engine.setDominantMountOrientation(dominantOrientation)
    }

    const intent = await this.engine.update(context, engineAudioMetrics)

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸª“ WAVE 4592 â†’ WAVE 4703: AETHER PIPELINE ONLY
    // ArbitrationDirector (masterArbiter) is extinct. Aether is the single source of truth.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // PARCHE 4: Post-await stale graph guard.
    // Si setFixtures() corrio durante el await anterior, el grafo Aether
    // fue reconstruido y el Arbiter fue purgado. Abortar este tick para
    // evitar emitir DMX con intents de la generacion anterior.
    if (this._showGeneration !== _tickShowGeneration) return

    const effectManager = getEffectManager()
    const effectOutput = effectManager.getCombinedOutput()

    // Chronos protection: fixtures being painted by Chronos are off-limits
    const playbackFrame = this._timelineEngine.getLastPlaybackFrame()
    const chronosTargets = playbackFrame?.targets
    if (chronosTargets && chronosTargets.length > 0) {
      this._cachedChronosSet.clear()
      for (let _ct = 0; _ct < chronosTargets.length; _ct++) {
        const _cid = chronosTargets[_ct].fixtureId
        if (typeof _cid === 'string') this._cachedChronosSet.add(_cid)
      }
    }
    const chronosFixtureIds = this._cachedChronosSet

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
      const audioStatus = this.audioPipeline.hasRealAudio ? 'LIVE' : 'SILENT'
      const bpm = context.bpm || 120
      
      // Emit heartbeat log
      this.log('System', `ðŸ’“ HEARTBEAT: ${audioStatus} | ${bpm} BPM | ${currentVibe.toUpperCase()}`, {
        audioActive: this.audioPipeline.hasRealAudio,
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
    // ðŸ› ï¸ WAVE 5032: Reuse _cachedFixtureStates â€” grow array if needed, mutate in-place
    const fixtureCount = this.fixtures.length
    for (let _fi = 0; _fi < fixtureCount; _fi++) {
      const fix = this.fixtures[_fi]
      let state = this._cachedFixtureStates[_fi]
      if (!state) {
        state = {
          dmxAddress: 0, universe: 0, name: '', zone: 'center', type: 'generic',
          isVirtual: false, dimmer: 0, r: 0, g: 0, b: 0,
          pan: 128, tilt: 128, zoom: 128, focus: 128,
          channels: null, profileId: '', fixtureId: '',
          hasColorWheel: false, hasColorMixing: false,
        }
        this._cachedFixtureStates[_fi] = state
      }
      state.dmxAddress = fix.dmxAddress
      state.universe   = fix.universe
      state.name       = fix.name
      state.zone       = fix.zone   ?? 'center'
      state.type       = fix.type   ?? 'generic'
      state.isVirtual  = fix.isVirtual
      state.dimmer     = 0
      state.r = 0; state.g = 0; state.b = 0
      state.pan  = 128
      state.tilt = 128
      state.zoom = 128
      state.focus = 128
      state.channels      = fix.channels
      state.profileId     = fix.profileId
      state.fixtureId     = fix.id
      state.hasColorWheel  = fix.hasColorWheel
      state.hasColorMixing = fix.hasColorMixing
    }
    // Trim excess if fixtures shrunk
    if (this._cachedFixtureStates.length > fixtureCount) {
      this._cachedFixtureStates.length = fixtureCount
    }
    const fixtureStates = this._cachedFixtureStates

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
    
    if (shouldLogToTactical && this.audioPipeline.hasRealAudio) {
      let _dimSum = 0, _movSum = 0, _movCount = 0, _frontSum = 0, _frontCount = 0
      for (let _ti = 0; _ti < fixtureStates.length; _ti++) {
        const _tf = fixtureStates[_ti]
        _dimSum += _tf.dimmer
        if (_tf.zone.includes('MOVING')) { _movSum += _tf.dimmer; _movCount++ }
        if (_tf.zone === 'FRONT_PARS')   { _frontSum += _tf.dimmer; _frontCount++ }
      }
      const avgDimmer = fixtureStates.length > 0 ? _dimSum / fixtureStates.length : 0
      const avgMover  = _movCount > 0   ? _movSum / _movCount   : 0
      const avgFront  = _frontCount > 0 ? _frontSum / _frontCount : 0
      
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
    // ENGINE UNCHAINED: DMX output gate removed — DJ_FOUNDER now has full playback.
    // Tier restriction is enforced at the UI level (Chronos/Hephaestus studios locked).
    // All trigger sources (MIDI, Keyboard, Selene IA, loaded Chronos shows) flow through.
    if (hephOutputs.length > 0) {
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
        if (fixtureId && this._aetherGraph.getDeviceNodes(fixtureId as import('../../aether/types').DeviceId).length > 0) continue

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
    // WAVE 2510: DUAL-CHANNEL BROADCAST — Hot Frame (44Hz) + Full Truth (11Hz)
    //
    // Hot Frame: Every HOT_FRAME_DIVIDER ticks (44Hz). Carries fixture dynamic data.
    //   → Frontend → RenderWorker → HyperionView preview.
    //   → Lightweight: fixtures array + beat + frame number.
    //
    // Full Truth: Every TRUTH_BROADCAST_DIVIDER ticks (11Hz).
    //   → Full SeleneTruth. Feeds React stores, HUD, audio meters, etc.
    //
    // ðŸ‘» WAVE 2540.7: CHRONOS BYPASS â€” During Chronos playback, broadcast
    // full truth at full rate (44fps) since Cinema needs complete data.
    //
    // âš¡ WAVE 3065: Broadcast happens BEFORE flushToDriver() so the Aduana
    // never pollutes the UI data with DMX gate zeros.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // ðŸ‘» Chronos bypass check
    const chronosPlaying = this.engine?.isChronosPlaybackActive() ?? false
    const shouldBroadcastFullTruth = chronosPlaying || (this.frameCount % TickEngine.TRUTH_BROADCAST_DIVIDER === 0)

    // âš¡ WAVE 2464: PEAK HOLD â€” Acumula picos entre full truth broadcasts
    if (!chronosPlaying) {
      for (let _pi = 0; _pi < fixtureStates.length; _pi++) {
        const _f = fixtureStates[_pi]
        const _id = this.fixtures[_pi]?.id
        if (!_id) continue
        const _prev = this.peakHoldMap.get(_id) ?? 0
        if (_f.dimmer > _prev) this.peakHoldMap.set(_id, _f.dimmer)
      }
    }

    // ── HOT FRAME — Every HOT_FRAME_DIVIDER ticks (44Hz) ──────────────────
    // WAVE 3050: Originally throttled to 22Hz. DMX stays at 44Hz.
    // WAVE 4559: Overclocked to 44Hz. Strobe y flash sin frame-skip al canvas.
    // WAVE 3065: Emitted BEFORE flushToDriver — values are real engine output.
    // 🛡️ WAVE-6060: Reactivado como fallback cuando GlassBridge no levanta.
    if (this.onHotFrame && this.frameCount % TickEngine.HOT_FRAME_DIVIDER === 0) {
      const _hfCount = fixtureStates.length
      for (let _hfi = 0; _hfi < _hfCount; _hfi++) {
        const _f = fixtureStates[_hfi]
        const _orig = this.fixtures[_hfi]
        let _hff = this._cachedHotFrameFixtures[_hfi]
        if (!_hff) {
          _hff = { id: '', dimmer: 0, pan: 0, tilt: 0, zoom: 0, focus: 0, white: 0, amber: 0, r: 0, g: 0, b: 0, physicalPan: 0, physicalTilt: 0, panVelocity: 0, tiltVelocity: 0 }
          this._cachedHotFrameFixtures[_hfi] = _hff
        }
        _hff.id = _orig?.id || ''
        _hff.dimmer = _f.dimmer / 255
        _hff.pan = _f.pan / 255
        _hff.tilt = _f.tilt / 255
        _hff.zoom = _f.zoom
        _hff.focus = _f.focus
        _hff.white = _f.white ?? 0
        _hff.amber = _f.amber ?? 0
        _hff.r = Math.round(_f.r)
        _hff.g = Math.round(_f.g)
        _hff.b = Math.round(_f.b)
        _hff.physicalPan = (_f.physicalPan ?? _f.pan) / 255
        _hff.physicalTilt = (_f.physicalTilt ?? _f.tilt) / 255
        _hff.panVelocity = _f.panVelocity ?? 0
        _hff.tiltVelocity = _f.tiltVelocity ?? 0
      }
      if (this._cachedHotFrameFixtures.length > _hfCount) {
        this._cachedHotFrameFixtures.length = _hfCount
      }

      this._cachedHotFrame.fixtures = this._cachedHotFrameFixtures
      this._cachedHotFrame.onBeat = beatState.onBeat
      this._cachedHotFrame.beatConfidence = engineAudioMetrics.beatConfidence
      this._cachedHotFrame.bpm = engineAudioMetrics.bpm
      this._cachedHotFrame.bass = bass
      this._cachedHotFrame.mid = mid
      this._cachedHotFrame.high = high
      this._cachedHotFrame.energy = energy

      this.onHotFrame(this._cachedHotFrame)
    }

    // âš¡ WAVE-4592: flushToDriver() ELIMINADO â€” la Aduana y el send DMX
    // son responsabilidad exclusiva del bloque Aether (aetherSafety + sendUniverseRaw).
    // this.hal.flushToDriver(fixtureStates)  â† DISCONNECTED WAVE-4592
    //
    // FIX: When there are no Aether devices, the SAB is never written and the
    // ArtNet driver reads empty buffers. Re-enable flushToDriver() as fallback
    // so DMX goes out via the CompositeDriver (USB + ArtNet adapter).
    // Only call when a driver is actually connected to avoid warning spam.
    if (!this._aetherHasDevices && this.hal && this.hal.isConnected) {
      this.hal.flushToDriver(fixtureStates)
    }

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
    _t_ingest_end = performance.now()

    let blackoutActive = false
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
      const _sm   = this.audioPipeline.syncSmoother.currentSmoothed
      const _a    = this._aetherAudio as AudioMetrics & Record<string, unknown>
      _a.subBass           = _sm.subBass ?? 0
      _a.bass              = engineAudioMetrics.bass
      _a.mid               = engineAudioMetrics.mid
      _a.highMid           = _sm.highMid ?? 0
      // WAVE 3516.1: rawTreble y ultraAir del 7Âº Pasajero â€” sin colapsar
      _a.presence          = this.audioPipeline.lastAudioData.rawTreble  ?? (high * 0.8)
      _a.air               = this.audioPipeline.lastAudioData.ultraAir   ?? (high * 0.3)
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
      // WAVE 2523: CHILL LOCKDOWN — vibe.intensity forzado a 1.0 en chill.
      // Antes: intent.masterIntensity ?? engineAudioMetrics.energy
      // Si masterIntensity no llegaba, caía al fallback de energía del audio,
      // y el ImpactAdapter multiplicaba el dimmer neutral por la energía →
      // los PARs laten con la música. En chill, el dimmerOverride del
      // chillFrame ya controla el dimmer final por la ruta de effects.
      // Forzar 1.0 = el ImpactAdapter pasa el zoneIntensity sin modulación.
      const _vibeName = _v.name ?? ''
      const _isChillVibe = _vibeName.includes('chill') || _vibeName.includes('lounge') ||
                           _vibeName.includes('ambient') || _vibeName.includes('jazz')
      _v.intensity          = _isChillVibe ? 1.0 : (intent.masterIntensity ?? engineAudioMetrics.energy)
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
      // WAVE 7110-B: Chronos L1 bus is cleared inside ChronosAetherAdapter.ingest().

      // â”€â”€ WAVE 4655 F1: L0 â€” LiquidAetherAdapter usa el engine activo segÃºn layout UI â”€â”€â”€â”€
      // Corrige split-brain: ya no se hardcodea liquidEngine71, se lee del engine activo.
      const _activeEngine = this.engine?.getActiveLiquidEngine()
      // ðŸ©º WAVE 4655-DIAG: log engine read (throttled)
      const _engineName = (_activeEngine as { constructor?: { name?: string } })?.constructor?.name ?? 'none'
      if (this._lastLoggedEngine !== _engineName) {
        // AETHER-ENGINE diagnostic log silenced
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
      // WAVE 6055+2523: MECHANICS BYPASS — ChillAmbientEngine Glaciar Sweep override.
      // intent.movement.mechanicsL/R llevan pan/tilt [0,1] + intensity del ChillAmbientEngine.
      // Se inyectan como intents absolutos pan/tilt con priority 50 (> L0=10).
      // WAVE 2523: También emite dimmer = intensity para sobreescribir el neutral
      // 0.5 del LiquidAetherAdapter (L0). Sin esto, los movers reciben dimmer del
      // motor líquido en lugar del chillFrame.dimmer del ChillAmbientEngine.
      if (intent.movement?.mechanicsL && intent.movement?.mechanicsR) {
        const _mechL = intent.movement.mechanicsL
        const _mechR = intent.movement.mechanicsR
        this._aetherGraph.getView(NodeFamily.KINETIC).forEach((node: any) => {
          if (node.isContinuous) return
          const _posX = node.physicalPosition?.x ?? node.position?.x ?? 0
          const _mech = (_posX < 0) ? _mechL : _mechR
          const _dimmer = Math.max(0, Math.min(1, _mech.intensity ?? 0))
          this._aetherBus.push({
            nodeId: node.nodeId,
            values: {
              pan:  Math.max(0, Math.min(1, _mech.pan)),
              tilt: Math.max(0, Math.min(1, _mech.tilt)),
              dimmer: _dimmer,  // WAVE 2523: sobreescribir neutral 0.5 del L0
            },
            priority: 50,
            confidence: 1.0,
            source: 'selene-bypass',
            mergeStrategy: 'LTP',
          } as any)
        })
      }
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

      // STEP 4.5: WAVE 7110-B — Chronos L1 bridge: inject zone resolver + ingest
      this._timelineEngine.setZoneResolver((zone: string) => {
        return resolveZone(zone, this.fixtures as readonly ZoneMappableFixture[])
      })
      this._chronosAetherAdapter.ingest(
        this._timelineEngine,
        ctx.deltaMs,
        aetherArbiter,
      )

      // STEP 5: Hephaestus L3+ Diamond Data bridge
      // Reuses `hephOutputs` from the legacy block above (SINGLE tick per frame).
      // The adapter only processes fixtures registered in NodeGraph (isCustomClip === true).
      // Legacy post-HAL block still handles fixtures NOT in NodeGraph (backward compat).
      // ENGINE UNCHAINED: DMX output gate removed — all tiers get full L3+ output.
      if (hephOutputs.length > 0) {
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
      // ðŸŽ¬ WAVE 4867: TheiaVideoRenderer tick REMOVED â€” no callers to attachTheiaRenderer,
      // field is always null. Safe to strip from hot path.
      this._pixelMapAdapter.ingest(aetherArbiter, this._aetherCanvasManager)

      // WAVE 7120: L3++ Calibration — inject entries directly (no SAB)
      if (TickEngine._calibEntries.length > 0) {
        aetherArbiter.setCalibrationIntents(TickEngine._calibEntries)
      } else {
        aetherArbiter.clearCalibrationIntents()
      }

      // 3. El Arbiter unifica todas las capas â†’ ArbitratedNodeMap
      aetherArbiter.setSystemIntents(this._aetherBus)
      aetherArbiter.setEffectIntents(this._effectBus.getAll())
      // WAVE 7110-B: Wire Chronos L1 bus (reference assignment, harmless to repeat).
      aetherArbiter.setChronosBus(this._chronosAetherAdapter.getBus())
      _t_arbitrate_start = performance.now()
      const arbitrated = aetherArbiter.arbitrate()
      _t_arbitrate_end = performance.now()

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
      blackoutActive = aetherArbiter.isBlackoutActive()
      this._aetherUIProjector.project(fixtureStates, this._aetherGraph, arbitrated, blackoutActive, this._aetherCtx.deltaMs)


      // WAVE 6019: FASE 2 ELIMINADA — el HAL ya no recibe datos del TickEngine.
      // Los drivers leen del SAB a su propio ritmo. TickEngine solo hace commitFrame().

      _t_hal_start = performance.now()
      for (const universe of aetherResolver.registeredUniverses) {
        // ðŸ›‚ WAVE 4557: shouldSendUniverse checks virtual-only + throttle
        if (!aetherSafety.shouldSendUniverse(universe)) continue
        const rawBuf = aetherResolver.getUniverseBuffer(universe)
        if (!rawBuf) {
          console.warn(`[TickEngine 🚨] Universe ${universe} buffer missing — NodeResolver failed to allocate or register it.`)
          continue
        }

        // WAVE 4633-OMEGA: Smart blackout semÃ¡ntico.
        // Solo canales de emisiÃ³n (dimmer/color) van a 0. Pan/tilt/speed conservan
        // sus valores para proteger la mecÃ¡nica de los movers.
        const egressBuf = blackoutActive
          ? aetherResolver.getSoftBlackoutUniverseBuffer(universe, rawBuf)
          : rawBuf

        // WAVE 6010 PATCH 2b: Egress SAB — reuse snapshot buffer in-place (zero-alloc)
        let uniArr = this._universeSnapshots.get(universe)
        if (!uniArr) {
          uniArr = new Uint8Array(CHANNELS_PER_UNI)
          this._universeSnapshots.set(universe, uniArr)
        }
        uniArr.set(egressBuf.subarray(0, CHANNELS_PER_UNI))
      }

      // WAVE 6013 PATCH 2: commitFrame atómico al SAB con Universo 0 forzado
      // AETHER PURITY: maskLo/maskHi replace BigInt — zero heap allocations.
      // P2 ABSOLUTE ZERO: Reuse pre-allocated Set/Array — zero alloc per frame.
      const uniList = this._uniList
      uniList.length = 0
      let maskLo = 0
      let maskHi = 0

      const universesToProcess = this._universesToProcess
      universesToProcess.clear()
      for (const u of aetherResolver.registeredUniverses) {
        universesToProcess.add(u)
      }
      universesToProcess.add(0)

      for (const universe of universesToProcess) {
        const buf = this._universeSnapshots.get(universe)
        if (buf) {
          uniList[universe] = buf
          if (universe < 31) {
            maskLo |= (1 << universe) >>> 0
          } else {
            maskHi |= (1 << (universe - 31)) >>> 0
          }
        }
      }
      if (uniList.length > 0) {
        this.dmxWriter.commitFrame(this.frameCount, uniList, maskLo, maskHi)
      }
      _t_hal_end = performance.now()

      // ðŸ›‚ WAVE 4557: Safety telemetry (~1Hz)
      // WAVE 7124: AduanaGate log silenced for forensic profiling clarity
      if (this.frameCount % 44 === 0) {
        aetherSafety.consumeTelemetry()
      }
      }
    }

    // ðŸ§¹ WAVE 2227 + WAVE 3065: El visual gate fue eliminado en WAVE 2227.
    // WAVE 3065 refuerza esto: la Aduana DMX (flushToDriver) es el ÃšNICO gate.
    // 🩸 WAVE-6060: GlassBridge SIEMPRE emite, incluso sin dispositivos Aether.
    _t_glass_start = performance.now()
    const view = this._glassView
    for (let fi = 0; fi < fixtureStates.length && fi < 2047; fi++) {
      const fs = fixtureStates[fi]
      const off = 10 + fi * 16
      view[off + 0]  = fs.r ?? 0
      view[off + 1]  = fs.g ?? 0
      view[off + 2]  = fs.b ?? 0
      view[off + 3]  = fs.w ?? 0
      view[off + 4]  = fs.a ?? 0
      view[off + 5]  = fs.dimmer ?? 0
      view[off + 6]  = fs.pan ?? 0
      view[off + 7]  = fs.tilt ?? 0
      view[off + 8]  = (fs as any).physicalPan ?? (fs as any).pan ?? 128
      view[off + 9]  = (fs as any).physicalTilt ?? (fs as any).tilt ?? 128
      view[off + 10] = fs.zoom ?? 0
      view[off + 11] = fs.focus ?? 0
      view[off + 12] = fs.panVel ?? 0
      view[off + 13] = fs.tiltVel ?? 0
      view[off + 14] = fs.strobe ?? 0
      view[off + 15] = (fs.dimmer > 0 ? 1 : 0) | (blackoutActive ? 2 : 0)
    }
    view[0] = engineAudioMetrics.bass || 0
    view[1] = engineAudioMetrics.mid || 0
    view[2] = engineAudioMetrics.high || 0
    view[3] = engineAudioMetrics.energy || 0
    view[4] = engineAudioMetrics.isBeat ? 1.0 : 0.0
    if (this.ctx.glassPool) {
      this.ctx.glassPool.pushFrame(view)
    }
    _t_glass_end = performance.now()

    // El broadcast UI siempre recibe los valores reales del engine.

    // ── FULL TRUTH — Every TRUTH_BROADCAST_DIVIDER ticks (11Hz) ──────────
    if (this.onBroadcast && shouldBroadcastFullTruth) {
      const currentVibe = this.engine.getCurrentVibe()
      
      // 🛠️ WAVE 5032: Mutate _cachedTruthFixtures in-place instead of .map()
      const _tfCount = fixtureStates.length
      for (let _tvi = 0; _tvi < _tfCount; _tvi++) {
        const _f = fixtureStates[_tvi]
        const _orig = this.fixtures[_tvi]
        const _realId = _orig?.id || ''
        let _tvf = this._cachedTruthFixtures[_tvi]
        if (!_tvf) {
          _tvf = {
            id: '', name: '', type: '', zone: '', dmxAddress: 0, universe: 0,
            dimmer: 0, intensity: 0, color: { r: 0, g: 0, b: 0 },
            pan: 0, tilt: 0, zoom: 0, focus: 0, white: 0, amber: 0,
            physicalPan: 0, physicalTilt: 0, panVelocity: 0, tiltVelocity: 0,
            online: true, active: false, profileId: '',
          }
          this._cachedTruthFixtures[_tvi] = _tvf
        }
        const _mappedZone = ZONE_MAP[_f.zone] || _f.zone || 'center'
        let _broadcastDimmer: number
        if (chronosPlaying) {
          _broadcastDimmer = _f.dimmer
        } else {
          const _peakDimmer = this.peakHoldMap.get(_realId) ?? _f.dimmer
          _broadcastDimmer = Math.max(_f.dimmer, _peakDimmer)
          this.peakHoldMap.set(_realId, 0)
        }
        _tvf.id = _realId
        _tvf.name = _f.name
        _tvf.type = _f.type
        _tvf.zone = _mappedZone
        _tvf.dmxAddress = _f.dmxAddress
        _tvf.universe = _f.universe
        _tvf.dimmer = _broadcastDimmer / 255
        _tvf.intensity = _broadcastDimmer / 255
        _tvf.color.r = Math.round(_f.r)
        _tvf.color.g = Math.round(_f.g)
        _tvf.color.b = Math.round(_f.b)
        _tvf.pan = _f.pan / 255
        _tvf.tilt = _f.tilt / 255
        _tvf.zoom = _f.zoom
        _tvf.focus = _f.focus
        _tvf.white = _f.white ?? 0
        _tvf.amber = _f.amber ?? 0
        _tvf.physicalPan = (_f.physicalPan ?? _f.pan) / 255
        _tvf.physicalTilt = (_f.physicalTilt ?? _f.tilt) / 255
        _tvf.panVelocity = _f.panVelocity ?? 0
        _tvf.tiltVelocity = _f.tiltVelocity ?? 0
        _tvf.online = true
        _tvf.active = _f.dimmer > 0
        _tvf.profileId = _orig?.profileId || (_f as any).profileId || _orig?.id || _realId
      }
      if (this._cachedTruthFixtures.length > _tfCount) {
        this._cachedTruthFixtures.length = _tfCount
      }

      // 🛠️ WAVE 5032: Count active fixtures with for loop instead of .reduce()
      let _activeCount = 0
      for (let _aci = 0; _aci < fixtureStates.length; _aci++) {
        if (fixtureStates[_aci].dimmer > 0) _activeCount++
      }

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
            active: this.audioPipeline.hasRealAudio,
            isClipping: false
          },
          // ðŸ§  WAVE 1195: BACKEND TELEMETRY EXPANSION - 7 GodEar Tactical Bands
          spectrumBands: {
            subBass: this.audioPipeline.syncSmoother.currentSmoothed.subBass,
            bass: bass,  // Use the already available bass from engineAudioMetrics
            lowMid: this.audioPipeline.syncSmoother.currentSmoothed.lowMid,
            mid: mid,    // Use the already available mid from engineAudioMetrics
            highMid: this.audioPipeline.syncSmoother.currentSmoothed.highMid,
            treble: high * 0.8,  // Approximate from high
            ultraAir: high * 0.3, // Approximate ultra-high from high
            dominant: bass > mid && bass > high ? 'bass' as const : 
                     mid > bass && mid > high ? 'mid' as const : 'treble' as const,
            flux: Math.abs((this.audioPipeline.lastAudioData.energy || 0) - energy)
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
          fixturesActive: _activeCount,
          fixturesTotal: fixtureStates.length,
          fixtures: this._cachedTruthFixtures
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
          this.audioPipeline.syncSmoother.currentSmoothed.subBass ?? 0,
          this.audioPipeline.syncSmoother.currentSmoothed.lowMid ?? 0,
          mid,
          this.audioPipeline.syncSmoother.currentSmoothed.highMid ?? 0,
          high,
          this.audioPipeline.syncSmoother.currentSmoothed.spectralCentroid ?? 0,
        ]
      })
    }

    // ⏱️ WAVE 7124: FORENSIC PROFILING — reportar si el tick ahogó el Event Loop.
    const _tickDelta = performance.now() - _tickStart
    if (_tickDelta > 15) {
      const _t_ingest = (_t_ingest_end - _tickStart).toFixed(1)
      const _t_arb = (_t_arbitrate_end - _t_arbitrate_start).toFixed(1)
      const _t_glass = (_t_glass_end - _t_glass_start).toFixed(1)
      const _t_hal = (_t_hal_end - _t_hal_start).toFixed(1)
      console.error(
        `[FORENSE] Tick ahogado (${_tickDelta.toFixed(1)}ms) | ` +
        `IPC_Read: ${_t_ingest}ms | ` +
        `Arbitraje: ${_t_arb}ms | ` +
        `GlassBridge: ${_t_glass}ms | ` +
        `HAL: ${_t_hal}ms`
      )
    }
  }
}
