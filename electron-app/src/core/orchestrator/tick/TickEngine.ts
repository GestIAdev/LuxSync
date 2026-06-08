/**
 * WAVE 4963 PHASE 8: TICK ENGINE
 * @module TickEngine
 */

import type { DeviceId } from '../../aether/types'
import type { HephFixtureOutput } from '../../hephaestus/runtime/HephaestusRuntime'
import { fixtureMatchesZone as zoneMapperMatch } from '../../zones/ZoneMapper'
import { getHephaestusRuntime } from '../IPCHandlers'
import { getEffectManager } from '../../effects/EffectManager'
import { aetherKineticEngine } from '../../aether/AetherKineticEngine'
import { NodeFamily } from '../../aether'
import type { AudioMetrics, MusicalContext, VibeProfile } from '../../aether'
import { FIX_DATA_FLOATS } from '../../aether/glass/layout'
import { SeleneTruth, createDefaultCognitive } from '../../protocol/SeleneProtocol'

const ZONE_MAP: Readonly<Record<string, string>> = {
  'FRONT_PARS': 'front', 'BACK_PARS': 'back', 'LEFT_PARS': 'left', 'RIGHT_PARS': 'right',
  'CENTER_PARS': 'center', 'TRUSS_WASH': 'truss', 'FLOOR_WASH': 'floor',
  'FRONT_MOVERS': 'front', 'BACK_MOVERS': 'back', 'LEFT_MOVERS': 'left', 'RIGHT_MOVERS': 'right',
  'CENTER_MOVERS': 'center', 'TRUSS_MOVERS': 'truss', 'FLOOR_MOVERS': 'floor',
  'HAZE': 'atmosphere', 'FOG': 'atmosphere', 'STROBE': 'effects', 'BLINDER': 'effects',
  'LASER': 'effects', 'UV': 'effects',
}
const DMX_OUTPUT_ZEROS: readonly number[] = Object.freeze(new Array(512).fill(0))

// 🛠️ WAVE 5034: Module-level constant to eliminate per-frame Set allocation
const OMNI_SOURCES_STALENESS = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus'])

export class TickEngine {
  private static readonly TRUTH_BROADCAST_DIVIDER = 6
  private static readonly HOT_FRAME_DIVIDER = 1
  frameCount = 0; warlogHeartbeatFrame = 0; _lastLoggedEngine = ''
  private ctx: any

  // ðŸ› ï¸ WAVE 5032: Pre-allocated mutable caches to eliminate .map() / {} / [] in hot path
  private _cachedFixtureStates: any[] = []
  private _cachedHotFrame: any = {}
  private _cachedHotFrameFixtures: any[] = []
  private _cachedChronosSet = new Set<string>()
  private _cachedTruthFixtures: any[] = []
  private _glassView = new Float32Array(FIX_DATA_FLOATS)

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
  constructor(ctx: any) { this.ctx = ctx }

  async tick(): Promise<void> {
    // ⏱️ WAVE 5037: CHRONOS-ALERT — perf profiling del tick loop.
    // Si el tiempo de ejecución supera ~15ms, el Event Loop se ahoga y
    // el frame scheduler empieza a saltar frames → parpadeo / stutter.
    const _tickStart = performance.now()

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”’ WAVE 2211: STAMPEDE GUARD (now in FrameScheduler._onInterval())
    // The FrameScheduler skips ticks if the previous async processFrame()
    // is still running. Contract preserved — guard moved to the scheduler.
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
    //   const timeSinceLastAudio = Date.now() - this.audioPipeline.lastAudioTimestamp
    //   console.log(`[Titan] ðŸ« Heartbeat #${this.frameCount}: Audio flowing? ${this.audioPipeline.hasRealAudio} | Last Packet: ${timeSinceLastAudio}ms ago`)
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
    const isOmniForStaleness = activeSourceForStaleness ? OMNI_SOURCES_STALENESS.has(activeSourceForStaleness) : false
    const effectiveStalenessThreshold = isOmniForStaleness ? 2000 : this.audioPipeline.AUDIO_STALENESS_THRESHOLD_MS
    if (this.audioPipeline.hasRealAudio && (now - this.audioPipeline.lastAudioTimestamp) > effectiveStalenessThreshold) {
      if (shouldLog) {
        console.warn(`[TitanOrchestrator] âš ï¸ AUDIO STALE - no data for ${now - this.audioPipeline.lastAudioTimestamp}ms, switching to silence`)
      }
      this.audioPipeline.hasRealAudio = false
      // Reset lastAudioData para no mentir con datos viejos
      // ðŸŽ›ï¸ WAVE 661: Incluir reset de textura espectral
      // ðŸŽ¸ WAVE 1011: Incluir reset de bandas extendidas y transientes
      // ðŸ”¥ WAVE 1162.2: Incluir reset de rawBassEnergy
      this.audioPipeline.lastAudioData = { 
        bass: 0, mid: 0, high: 0, energy: 0, 
        harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
        subBass: undefined, lowMid: undefined, highMid: undefined,
        kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined,
        rawBassEnergy: undefined,  // ðŸ”¥ WAVE 1162.2: Reset tambiÃ©n el bypass
        // ðŸ”¥ WAVE 2213: PRESERVAR MEMORIA DEL WORKER DURANTE EL SILENCIO
        // Sin esto: workerBpm â†’ undefined â†’ zombie BeatDetector â†’ 200 BPM hardcodeado
        workerBpm: this.audioPipeline.lastAudioData.workerBpm,
        workerBpmConfidence: this.audioPipeline.lastAudioData.workerBpmConfidence,
        workerOnBeat: false, // Es silencio, no hay beat activo
        workerBeatPhase: this.audioPipeline.lastAudioData.workerBeatPhase,
        workerBeatStrength: 0,
        workerKickCount: this.audioPipeline.lastAudioData.workerKickCount,
      }
    }
    
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
    
    if (this.audioPipeline.beatDetector && this.audioPipeline.hasRealAudio) {
      // ðŸ”¥ WAVE 2112 + WAVE 2179: WORKER BPM â†’ PLL
      // Worker con seÃ±al â†’ setBpm() = lock real (PLL anclado a la verdad fÃ­sica)
      // Worker sordo pero memoria reciente â†’ freewheelAt() = inercia correcta
      // Worker sordo Y memoria expirada â†’ PLL cae al Pacemaker interno (120 default)
      // PunkArchytect doctrine: Worker = OÃ­dos (honesto). Cerebro = Memoria (inerte).
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (workerBpm > 0 && workerConfidence > 0.2) {
        // ðŸ”¥ Worker activo: lock real + actualizar memoria
        this.audioPipeline.beatDetector.setBpm(workerBpm)
        this.audioPipeline.lastStableWorkerBpm = workerBpm
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
      }
      
      if (this.frameCount % 60 === 0) {
        const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL'
        const syncInfo = this.audioPipeline.syncSmoother.currentSyncopation.toFixed(2)
        const _framesSinceLog = this.frameCount - this.audioPipeline.lastStableWorkerBpmFrame
        const freewheelTag = (!beatState.pllLocked && this.audioPipeline.lastStableWorkerBpm > 0 && _framesSinceLog <= this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES)
          ? ` [mem=${this.audioPipeline.lastStableWorkerBpm.toFixed(0)}@-${_framesSinceLog}f]`
          : ''
        const rawEnergy = (this.audioPipeline.lastAudioData.rawBassEnergy ?? 0).toFixed(4)
        const sabFill = this.trinity?.getAudioMatrix()?.getStatus()?.ringBufferFillLevel?.toFixed(3) ?? 'n/a'
        // ðŸ”¬ WAVE 3418: Peak/RMS del buffer crudo que llega al Worker
        const inputPeak = (this.audioPipeline.lastAudioData.inputPeakAbs ?? 0).toFixed(5)
        const inputRms  = (this.audioPipeline.lastAudioData.inputRMS ?? 0).toFixed(5)
        console.log(`[TitanOrchestrator] ðŸŽ§ WORKER BPM=${workerBpm.toFixed(0)} conf=${workerConfidence.toFixed(2)} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.audioPipeline.lastAudioData.workerKickCount ?? 0} | bass=${rawEnergy} sab=${sabFill} | ðŸ”¬in_peak=${inputPeak} in_rms=${inputRms}`)
      }
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

    if (workerBpm > 0 && workerConfidence > 0.2) {
      // Priority 1: Worker activo
      context.bpm = workerBpm
      context.beatPhase = beatState.pllLocked
        ? (beatState.pllPhase ?? beatState.phase)
        : workerBeatPhase
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
      bpm: workerBpm > 0 ? workerBpm : beatState.bpm,
      beatConfidence: workerConfidence > 0 ? workerConfidence : beatState.confidence,
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
    const intent = await this.engine.update(context, engineAudioMetrics)
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸª“ WAVE 4592 â†’ WAVE 4703: AETHER PIPELINE ONLY
    // ArbitrationDirector (masterArbiter) is extinct. Aether is the single source of truth.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    const emitHotFrame = () => {
      // 💀 WAVE 6005 v2 Phase 5: LA PURGA
      // El JSON estructurado asesino de 44Hz ha sido erradicado.
      // La UI ahora lee de GlassBridge (BufferPool) y el HW de Phantom Worker (SAB).
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
      // ðŸŽ¬ WAVE 4867: TheiaVideoRenderer tick REMOVED â€” no callers to attachTheiaRenderer,
      // field is always null. Safe to strip from hot path.
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

      if (this.ctx.glassPool) {
        this.ctx.glassPool.pushFrame(this._glassView)
      }

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

        // 💀 WAVE 6005 v2 Phase 5: LA PURGA
        // Se apaga el Egress Legacy hacia UniversalDMXDriver.
        // El Phantom Worker de la Fase 2 ahora lee directamente del SAB.
        // this.hal.sendUniverseRaw(universe, egressBuf)

        // 🔬 WAVE 4681: Log de supervivencia comentado en la purga
        /*
        if (this.frameCount % 300 === 0) {
          let byteSum = 0
          for (let _bi = 0; _bi < egressBuf.length; _bi++) byteSum += egressBuf[_bi]
          console.log(
            `[Egress 📥] Universe ${universe} → HAL. ` +
            `Suma bytes: ${byteSum} | ` +
            `outputEnabled: ${outputEnabled} | ` +
            `blackout: ${blackoutActive}`,
          )
        }
        */
      }

      // 🚀 WAVE 4681: Flush — comentado por la purga
      // this.hal.flushAetherEgress()

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

    // ⏱️ WAVE 5037: CHRONOS-ALERT — reportar si el tick bloqueó el Event Loop.
    const _tickDelta = performance.now() - _tickStart
    if (_tickDelta > 15) {
      console.error(
        `[CHRONOS-ALERT] ⏱️ Tick bloqueó el Event Loop durante ${_tickDelta.toFixed(2)}ms ` +
        `(frame=${this.frameCount})`
      )
    } else if (_tickDelta > 8 && this.frameCount % 44 === 0) {
      // Throttled warning for sub-lethal but concerning times (~1Hz)
      console.warn(
        `[CHRONOS-ALERT] ⚠️ Tick lento: ${_tickDelta.toFixed(2)}ms ` +
        `(frame=${this.frameCount})`
      )
    }
  }
}
