// WAVE 3521: HEPHAESTUS AETHER ADAPTER
// Bridge layer L3+ between HephaestusRuntime (Diamond Data FX) and the Aether
// NodeArbiter. Consumes HephFixtureOutput[] (pre-scaled DMX values) and emits
// normalized INodeIntent[] via the setHephaestusIntents() slot.
//
// RULES:
//   - Only processes outputs where isCustomClip === true.
//   - Only processes outputs for fixtures registered in the NodeGraph.
//   - Zero-alloc hot path via intent pool.
//   - getDeviceNodes() is O(1) Map lookup — no per-adapter device cache needed.
//   - HephParamId → NodeFamily → INodeIntent.values mapping is static.

import { NodeFamily, type IntentSource, type NodeId } from '../types'
import type { INodeGraph } from '../node-graph'
import type { INodeArbiter, INodeIntent } from '../intent-bus'
import type { HephFixtureOutput } from '../../hephaestus/runtime/HephaestusRuntime'

// L3+ priority: after IntentComposer effects (300) so Heph custom curves dominate
const L3_HEPH_PRIORITY = 350
const L3_HEPH_SOURCE: IntentSource = 'hephaestus'
const L3_HEPH_CONFIDENCE = 1.0

interface MutableNodeIntent {
  nodeId: NodeId
  values: Record<string, number>
  priority: number
  confidence: number
  source: IntentSource
}

export class HephaestusAetherAdapter {
  private readonly _graph: INodeGraph

  // Zero-alloc intent pool: grows during warm-up, then stabilizes
  private readonly _intentPool: MutableNodeIntent[] = []
  private _intentCursor = 0
  private readonly _frameIntents: INodeIntent[] = []

  private readonly _emptyIntents: readonly INodeIntent[] = Object.freeze([])

  constructor(graph: INodeGraph) {
    this._graph = graph
  }

  /**
   * Ingest HephFixtureOutput[] and emit normalized intents to the arbiter.
   * Called from TitanOrchestrator AFTER hephRuntime.tick() and BEFORE arbitrate().
   *
   * @param outputs - Raw output array from HephaestusRuntime.tick()
   * @param arbiter - Aether NodeArbiter, receives setHephaestusIntents()
   */
  ingest(outputs: readonly HephFixtureOutput[], arbiter: INodeArbiter): void {
    if (outputs.length === 0) {
      this.clear(arbiter)
      return
    }

    this._intentCursor = 0
    this._frameIntents.length = 0

    // Group outputs by fixtureId so we can emit one intent per node per family
    // We process outputs sequentially: each output targets one fixture + one param.
    // The NodeArbiter merges per-channel, so emitting multiple intents for the same
    // nodeId is fine — LTP applies the last written value per channel.
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]

      // Only heph_custom clips belong in the L3+ Aether path
      if (!output.isCustomClip) continue

      const fixtureId = output.fixtureId
      const nodeIds = this._graph.getDeviceNodes(fixtureId)
      if (nodeIds.length === 0) continue

      const param = output.parameter

      // Determine target NodeFamily from param name
      const family = _paramFamily(param)
      if (family === null) continue

      // Find the node for this fixture that belongs to the target family
      for (let j = 0; j < nodeIds.length; j++) {
        const nodeId = nodeIds[j]
        const nodeData = this._graph.getNodeData(nodeId)
        if (!nodeData || nodeData.family !== family) continue

        // Acquire an intent from the pool and populate values
        const intent = this._acquireIntent(nodeId)
        _populateValues(intent.values, param, output)
        this._frameIntents.push(intent as INodeIntent)
        // Only one node per family per fixture — stop searching
        break
      }
    }

    arbiter.setHephaestusIntents(this._frameIntents)
  }

  /**
   * Clears the L3+ Hephaestus layer — called when no clips are active.
   */
  clear(arbiter: INodeArbiter): void {
    this._intentCursor = 0
    this._frameIntents.length = 0
    arbiter.setHephaestusIntents(this._emptyIntents)
  }

  private _acquireIntent(nodeId: NodeId): MutableNodeIntent {
    if (this._intentCursor < this._intentPool.length) {
      const intent = this._intentPool[this._intentCursor++]
      intent.nodeId = nodeId
      // Clean values dict in-place (zero-alloc)
      for (const key in intent.values) {
        delete intent.values[key]
      }
      return intent
    }
    // Pool exhausted: allocate new slot (only during warm-up)
    const intent: MutableNodeIntent = {
      nodeId,
      values: {},
      priority: L3_HEPH_PRIORITY,
      confidence: L3_HEPH_CONFIDENCE,
      source: L3_HEPH_SOURCE,
    }
    this._intentPool.push(intent)
    this._intentCursor++
    return intent
  }
}

// ── Static helpers (pure functions, no allocations) ──────────────────────

/**
 * Maps a HephParamId string to the Aether NodeFamily it targets.
 * Returns null for engine-internal params that produce no DMX intent.
 */
function _paramFamily(param: string): NodeFamily | null {
  switch (param) {
    case 'intensity':
    case 'strobe':
      return NodeFamily.IMPACT
    case 'color':
    case 'white':
    case 'amber':
      return NodeFamily.COLOR
    case 'pan':
    case 'tilt':
    case 'speed':
      return NodeFamily.KINETIC
    case 'zoom':
    case 'focus':
    case 'iris':
    case 'gobo1':
    case 'gobo2':
    case 'prism':
      return NodeFamily.BEAM
    // Engine-internal: no DMX intent
    case 'globalComp':
    case 'width':
    case 'direction':
    default:
      return null
  }
}

/**
 * Populates the mutable values dict from a HephFixtureOutput.
 * All values are normalized 0-1 (Aether contract).
 */
function _populateValues(
  values: Record<string, number>,
  param: string,
  output: HephFixtureOutput,
): void {
  switch (param) {
    case 'intensity':
      values['dimmer'] = output.normalizedValue
      break
    case 'strobe':
      values['strobe'] = output.normalizedValue
      break
    case 'color': {
      const nr = output.normalizedRgb
      if (nr) {
        values['red'] = nr.r
        values['green'] = nr.g
        values['blue'] = nr.b
      }
      break
    }
    case 'white':
      values['white'] = output.normalizedValue
      break
    case 'amber':
      values['amber'] = output.normalizedValue
      break
    case 'pan':
      values['pan'] = output.normalizedValue
      break
    case 'tilt':
      values['tilt'] = output.normalizedValue
      break
    case 'speed':
      values['speed'] = output.normalizedValue
      break
    case 'zoom':
      values['zoom'] = output.normalizedValue
      break
    case 'focus':
      values['focus'] = output.normalizedValue
      break
    case 'iris':
      values['iris'] = output.normalizedValue
      break
    case 'gobo1':
      values['gobo'] = output.normalizedValue
      break
    case 'gobo2':
      values['gobo_rotation'] = output.normalizedValue
      break
    case 'prism':
      values['prism'] = output.normalizedValue
      break
    default:
      break
  }
}
