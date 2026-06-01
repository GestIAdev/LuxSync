/**
 * WAVE 4961 PHASE 6a — BroadcastManager
 * Extracted from TitanOrchestrator.ts processFrame (~lines 1694-2360).
 *
 * Owns: Hot-frame emission, Full Truth (SeleneTruth) broadcast, peak hold,
 *       OSC state publishing, broadcast throttling.
 */

import type { TacticalLogManager } from '../logging/TacticalLogManager'
import type { SyncSmoother } from '../metrics/SyncSmoother'
import type { StateManager } from '../lifecycle/StateManager'
import type { SeleneTruth } from '../../protocol/SeleneProtocol'
import { createDefaultCognitive } from '../../protocol/SeleneProtocol'

// Re-exported from TitanOrchestrator for module-level constants
const ZONE_MAP: Readonly<Record<string, string>> = {
  'FRONT_PARS': 'front',
  'BACK_PARS': 'back',
  'MOVING_LEFT': 'left',
  'MOVING_RIGHT': 'right',
  'STROBES': 'center',
  'BLINDERS': 'center',
  'FOGGERS': 'center',
  'LASERS': 'center',
  'MOVING_HEADS': 'center',
  'PARS': 'center',
}

const DMX_OUTPUT_ZEROS: number[] = new Array(512).fill(0)

export interface BroadcastManagerContext {
  logManager: TacticalLogManager
  trinity: any
  engine: any
  fixtures: any[]
  frameCount: number
  peakHoldMap: Map<string, number>
  oscProvider: any
  syncSmoother: SyncSmoother
  stateManager: StateManager
  hasRealAudio: boolean
  lastAudioData: { energy?: number }
  EMPTY_FFT_BUFFER: readonly number[]
}

export class BroadcastManager {
  static readonly HOT_FRAME_DIVIDER = 2       // 44Hz → 22Hz
  static readonly TRUTH_BROADCAST_DIVIDER = 6  // ~7Hz

  constructor(private readonly ctx: BroadcastManagerContext) {}

  /**
   * WAVE 2464: Accumulate peak dimmer values between full truth broadcasts.
   */
  accumulatePeaks(fixtureStates: any[], chronosPlaying: boolean): void {
    if (chronosPlaying) return
    const { fixtures, peakHoldMap } = this.ctx
    for (let i = 0; i < fixtureStates.length; i++) {
      const f = fixtureStates[i]
      const id = fixtures[i]?.id || `fix_${i}`
      const prev = peakHoldMap.get(id) ?? 0
      if (f.dimmer > prev) peakHoldMap.set(id, f.dimmer)
    }
  }

  /**
   * WAVE 2510/4559: Emit hot-frame with fixture dynamic data at 44Hz.
   */
  emitHotFrame(
    fixtureStates: any[],
    now: number,
    engineAudioMetrics: { isBeat: boolean; beatConfidence: number; bpm: number },
    bass: number,
    mid: number,
    high: number,
    energy: number,
    chronosPlaying: boolean,
  ): void {
    const { logManager, trinity, fixtures, frameCount } = this.ctx
    const hotFrameCb = logManager.getHotFrameCallback()
    if (!hotFrameCb || (!chronosPlaying && frameCount % BroadcastManager.HOT_FRAME_DIVIDER !== 0)) {
      return
    }

    const matrixStatus = trinity?.getAudioMatrix()?.getStatus()
    const hotFrame = {
      frameNumber: frameCount,
      timestamp: now,
      onBeat: engineAudioMetrics.isBeat,
      beatConfidence: engineAudioMetrics.beatConfidence,
      bpm: engineAudioMetrics.bpm,
      bass,
      mid,
      high,
      energy,
      ringBufferFillLevel: matrixStatus?.ringBufferFillLevel ?? 0,
      activeAudioSource: matrixStatus?.activeSource ?? null,
      fixtures: fixtureStates.map((f: any, i: number) => {
        const originalFixture = fixtures[i]
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
      }),
    }
    hotFrameCb(hotFrame)
  }

  /**
   * WAVE 2510/2540.7: Emit full SeleneTruth at ~7Hz (or 44Hz during Chronos).
   */
  emitFullTruth(
    fixtureStates: any[],
    now: number,
    engineAudioMetrics: { isBeat: boolean; beatConfidence: number; bpm: number; beatPhase: number; energy: number },
    bass: number,
    mid: number,
    high: number,
    energy: number,
    chronosPlaying: boolean,
    context: any,
    intent: any,
  ): void {
    const { logManager, engine, fixtures, frameCount, peakHoldMap, stateManager, syncSmoother, hasRealAudio, lastAudioData, EMPTY_FFT_BUFFER } = this.ctx
    const shouldBroadcastFullTruth = chronosPlaying || (frameCount % BroadcastManager.TRUTH_BROADCAST_DIVIDER === 0)
    if (!logManager.getBroadcastCallback() || !shouldBroadcastFullTruth) return

    const currentVibe = engine.getCurrentVibe()
    const truth: SeleneTruth = {
      system: {
        frameNumber: frameCount,
        timestamp: now,
        deltaTime: 23,
        targetFPS: 44,
        actualFPS: 44,
        mode: stateManager.mode === 'auto' ? 'selene' : 'manual',
        vibe: currentVibe,
        brainStatus: 'peaceful',
        uptime: frameCount * 23,
        titanEnabled: true,
        sessionId: 'titan-2.0',
        version: '2.0.0',
        performance: {
          audioProcessingMs: 0,
          brainProcessingMs: 0,
          colorEngineMs: 0,
          dmxOutputMs: 0,
          totalFrameMs: 0,
        },
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
          zeroCrossingRate: 0,
        },
        fft: EMPTY_FFT_BUFFER as unknown as number[],
        beat: {
          onBeat: engineAudioMetrics.isBeat,
          confidence: engineAudioMetrics.beatConfidence,
          bpm: engineAudioMetrics.bpm,
          beatPhase: engineAudioMetrics.beatPhase,
          barPhase: 0,
          timeSinceLastBeat: 0,
        },
        input: {
          gain: stateManager.inputGain,
          device: 'Microphone',
          active: hasRealAudio,
          isClipping: false,
        },
        spectrumBands: {
          subBass: syncSmoother.currentSmoothed.subBass,
          bass,
          lowMid: syncSmoother.currentSmoothed.lowMid,
          mid,
          highMid: syncSmoother.currentSmoothed.highMid,
          treble: high * 0.8,
          ultraAir: high * 0.3,
          dominant: bass > mid && bass > high ? 'bass' as const :
                     mid > bass && mid > high ? 'mid' as const : 'treble' as const,
          flux: Math.abs((lastAudioData.energy || 0) - energy),
        },
      },
      consciousness: {
        ...createDefaultCognitive(),
        stableEmotion: engine.getStableEmotion(),
        thermalTemperature: engine.getThermalTemperature(),
        ai: engine.getConsciousnessTelemetry(),
        vibe: {
          active: currentVibe as 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge' | 'idle' | 'custom',
          transitioning: false,
        },
      },
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
        timestamp: context.timestamp,
      },
      intent: {
        palette: intent.palette,
        masterIntensity: intent.masterIntensity,
        zones: intent.zones,
        movement: intent.movement,
        effects: intent.effects,
        source: 'procedural',
        timestamp: now,
      },
      hardware: {
        dmx: {
          connected: true,
          driver: 'none',
          universe: 0,
          frameRate: 30,
          port: null,
        },
        dmxOutput: DMX_OUTPUT_ZEROS as number[],
        fixturesActive: fixtureStates.reduce((count: number, f: any) => count + (f.dimmer > 0 ? 1 : 0), 0),
        fixturesTotal: fixtureStates.length,
        fixtures: fixtureStates.map((f: any, i: number) => {
          const mappedZone = ZONE_MAP[f.zone] || f.zone || 'center'
          const originalFixture = fixtures[i]
          const realId = originalFixture?.id || `fix_${i}`

          let broadcastDimmer: number
          if (chronosPlaying) {
            broadcastDimmer = f.dimmer
          } else {
            const peakDimmer = peakHoldMap.get(realId) ?? f.dimmer
            broadcastDimmer = Math.max(f.dimmer, peakDimmer)
            peakHoldMap.set(realId, 0)
          }

          return {
            id: realId,
            name: f.name,
            type: f.type,
            zone: mappedZone,
            dmxAddress: f.dmxAddress,
            universe: f.universe,
            dimmer: broadcastDimmer / 255,
            intensity: broadcastDimmer / 255,
            color: { r: Math.round(f.r), g: Math.round(f.g), b: Math.round(f.b) },
            pan: f.pan / 255,
            tilt: f.tilt / 255,
            zoom: f.zoom,
            focus: f.focus,
            white: f.white ?? 0,
            amber: f.amber ?? 0,
            physicalPan: (f.physicalPan ?? f.pan) / 255,
            physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
            panVelocity: f.panVelocity ?? 0,
            tiltVelocity: f.tiltVelocity ?? 0,
            online: true,
            active: f.dimmer > 0,
            profileId: originalFixture?.profileId || (f as any).profileId || originalFixture?.id || realId,
          }
        }),
      },
      timestamp: now,
    }

    const broadcastCb = logManager.getBroadcastCallback()!
    broadcastCb(truth)
  }

  /**
   * WAVE 3401: Publish state to OSC provider (~12Hz).
   */
  publishOSCState(
    energy: number,
    context: { bpm: number },
    beatState: { onBeat: boolean },
  ): void {
    const { oscProvider, engine, frameCount } = this.ctx
    if (!oscProvider || frameCount % 3 !== 0) return

    const currentVibe = engine?.getCurrentVibe() ?? 'idle'
    oscProvider.publishState({
      vibe: currentVibe,
      energy,
      bpm: context.bpm,
      onBeat: beatState.onBeat,
    })
  }
}
