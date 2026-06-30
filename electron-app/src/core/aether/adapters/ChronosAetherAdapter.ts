import { NodeFamily, type DeviceId, type IntentSource, type NodeId } from '../types'
import type { INodeGraph } from '../node-graph'
import type { INodeArbiter, INodeIntent } from '../intent-bus'
import { IntentBus } from '../IntentBus'
import type { ChronosFixtureTarget, PlaybackFrameSnapshot, TimelineEngine } from '../../engine/TimelineEngine'

// WAVE 7110-B: Chronos now injects at L1 alongside Selene.
// Priority aligned with L1 range (100-199).
const CHRONOS_PRIORITY = 150
const CHRONOS_SOURCE: IntentSource = 'chronos'
const CHRONOS_CONFIDENCE = 1.0

// WAVE 7110-B: Pre-allocated bus for zero-alloc L1 injection.
// Capacity 512: ~50 fixtures × 4 families max.
const CHRONOS_BUS_CAPACITY = 512

interface MutableNodeIntent {
  nodeId: NodeId
  values: Record<string, number>
  priority: number
  confidence: number
  source: IntentSource
}

function normalizeDmx(value: number): number {
  if (value <= 0) return 0
  if (value >= 255) return 1
  return value / 255
}

export class ChronosAetherAdapter {
  private readonly _graph: INodeGraph

  private readonly _nodeFamilyIndex = new Map<NodeId, NodeFamily>()

  private readonly _intentPool: MutableNodeIntent[] = []
  private _intentCursor = 0
  private _lastProcessedTickMs = -1

  // WAVE 7110-B: Dedicated L1 bus for zero-alloc injection into NodeArbiter.
  private readonly _bus = new IntentBus(CHRONOS_BUS_CAPACITY)

  constructor(graph: INodeGraph) {
    this._graph = graph
    this.rebuildNodeIndex()
  }

  /**
   * WAVE 7110-B: Returns the dedicated Chronos L1 bus.
   * Called once during initialization to wire to arbiter.setChronosBus().
   */
  getBus(): IntentBus {
    return this._bus
  }

  rebuildNodeIndex(): void {
    this._nodeFamilyIndex.clear()

    this._graph.getView(NodeFamily.IMPACT).forEach((node) => {
      this._nodeFamilyIndex.set(node.nodeId, NodeFamily.IMPACT)
    })
    this._graph.getView(NodeFamily.COLOR).forEach((node) => {
      this._nodeFamilyIndex.set(node.nodeId, NodeFamily.COLOR)
    })
    this._graph.getView(NodeFamily.KINETIC).forEach((node) => {
      this._nodeFamilyIndex.set(node.nodeId, NodeFamily.KINETIC)
    })
    this._graph.getView(NodeFamily.BEAM).forEach((node) => {
      this._nodeFamilyIndex.set(node.nodeId, NodeFamily.BEAM)
    })
    this._graph.getView(NodeFamily.ATMOSPHERE).forEach((node) => {
      this._nodeFamilyIndex.set(node.nodeId, NodeFamily.ATMOSPHERE)
    })
  }

  ingest(timelineEngine: TimelineEngine, _deltaMs: number, _arbiter: INodeArbiter): void {
    // WAVE 7110-B: Clear bus at start of every frame (zero-alloc reset).
    this._bus.clear()

    if (!timelineEngine.isPlaying) {
      this._lastProcessedTickMs = -1
      this._intentCursor = 0
      return
    }

    const snapshot = timelineEngine.getLastPlaybackFrame()
    if (snapshot === null) {
      this._lastProcessedTickMs = -1
      this._intentCursor = 0
      return
    }

    // Cache-and-replay: if same tick, bus was already populated.
    // But since we clear() above, we need to re-push for same tick.
    // Use the cached intents from last build.
    if (snapshot.tickMs === this._lastProcessedTickMs) {
      this._pushCachedIntentsToBus()
      return
    }

    this._lastProcessedTickMs = snapshot.tickMs
    this._intentCursor = 0

    this._buildPlaybackIntents(snapshot)
    this._pushCachedIntentsToBus()
  }

  clear(_arbiter: INodeArbiter): void {
    this._lastProcessedTickMs = -1
    this._intentCursor = 0
    this._bus.clear()
  }

  /**
   * WAVE 7110-B: Push all cached intents from this frame into the L1 bus.
   */
  private _pushCachedIntentsToBus(): void {
    for (let i = 0; i < this._intentCursor; i++) {
      this._bus.push(this._intentPool[i] as INodeIntent)
    }
  }

  private _buildPlaybackIntents(snapshot: PlaybackFrameSnapshot): void {
    const targets = snapshot.targets
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      const nodeIds = this._graph.getDeviceNodes(target.fixtureId as DeviceId)
      for (let j = 0; j < nodeIds.length; j++) {
        const nodeId = nodeIds[j]
        const family = this._nodeFamilyIndex.get(nodeId)
        if (family === undefined) continue

        if (family === NodeFamily.IMPACT) {
          this._emitImpactIntent(nodeId, target)
          continue
        }

        if (family === NodeFamily.COLOR) {
          this._emitColorIntent(nodeId, target)
          continue
        }

        if (family === NodeFamily.KINETIC) {
          this._emitKineticIntent(nodeId, target)
          continue
        }

        if (family === NodeFamily.BEAM) {
          this._emitBeamIntent(nodeId, target)
        }
      }
    }
  }

  private _emitImpactIntent(nodeId: NodeId, target: ChronosFixtureTarget): void {
    const dimmer = normalizeDmx(target.dimmer)
    const isLtpBlackout = target.blendMode === 'LTP' && target.dimmer === 0

    if (!isLtpBlackout && dimmer <= 0) {
      return
    }

    const intent = this._acquireIntent(nodeId)
    intent.values.dimmer = dimmer

    if (isLtpBlackout && this._impactNodeSupportsShutter(nodeId)) {
      intent.values.shutter = 0
    }

  }

  private _emitColorIntent(nodeId: NodeId, target: ChronosFixtureTarget): void {
    if (!target.colorTouched) {
      return
    }

    const intent = this._acquireIntent(nodeId)
    intent.values.r = normalizeDmx(target.red)
    intent.values.g = normalizeDmx(target.green)
    intent.values.b = normalizeDmx(target.blue)
    intent.values.white = normalizeDmx(target.white)
  }

  private _emitKineticIntent(nodeId: NodeId, target: ChronosFixtureTarget): void {
    const pan = normalizeDmx(target.pan)
    const tilt = normalizeDmx(target.tilt)
    const speed = normalizeDmx(target.speed)

    if (pan <= 0 && tilt <= 0 && speed <= 0) {
      return
    }

    const intent = this._acquireIntent(nodeId)
    intent.values.pan = pan
    intent.values.tilt = tilt
    intent.values.speed = speed
  }

  private _emitBeamIntent(nodeId: NodeId, target: ChronosFixtureTarget): void {
    if (target.zoom <= 0) {
      return
    }

    const intent = this._acquireIntent(nodeId)
    intent.values.zoom = normalizeDmx(target.zoom)
  }

  private _acquireIntent(nodeId: NodeId): MutableNodeIntent {
    let intent: MutableNodeIntent

    if (this._intentCursor < this._intentPool.length) {
      intent = this._intentPool[this._intentCursor]
      const values = intent.values
      for (const key in values) {
        delete values[key]
      }
    } else {
      intent = {
        nodeId,
        values: {},
        priority: CHRONOS_PRIORITY,
        confidence: CHRONOS_CONFIDENCE,
        source: CHRONOS_SOURCE,
      }
      this._intentPool.push(intent)
    }

    this._intentCursor += 1
    intent.nodeId = nodeId
    intent.priority = CHRONOS_PRIORITY
    intent.confidence = CHRONOS_CONFIDENCE
    intent.source = CHRONOS_SOURCE

    return intent
  }

  private _impactNodeSupportsShutter(nodeId: NodeId): boolean {
    const node = this._graph.getNodeData(nodeId)
    if (node === undefined || node.family !== NodeFamily.IMPACT) {
      return false
    }

    for (let i = 0; i < node.channels.length; i++) {
      if (node.channels[i].type === 'shutter') {
        return true
      }
    }

    return false
  }
}
