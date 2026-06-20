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
import type { MergeStrategy } from '../types'
import type { HephFixtureOutput } from '../../hephaestus/runtime/HephaestusRuntime'
// 🏛️ WAVE 2483: Registry lookup for spatialBehavior (relative_offset routing).
import { getDynamicEffectRegistry, type DynamicEffectRegistry } from '../../arsenal/DynamicEffectRegistry'
import type { SpatialBehavior } from '../../arsenal/lfxTypes'

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
  mergeStrategy: MergeStrategy
}

export class HephaestusAetherAdapter {
  private readonly _graph: INodeGraph
  private readonly _registry: DynamicEffectRegistry

  // Zero-alloc intent pool: grows during warm-up, then stabilizes
  private readonly _intentPool: MutableNodeIntent[] = []
  private _intentCursor = 0
  private readonly _frameIntents: INodeIntent[] = []
  
  // 🩹 WAVE 4995: Zero-alloc intent consolidation map
  private readonly _frameIntentMap = new Map<NodeId, MutableNodeIntent>()

  private readonly _emptyIntents: readonly INodeIntent[] = Object.freeze([])

  // 🏛️ WAVE 2483: per-frame cached lookup of (clipId → spatialBehavior).
  // Avoids hitting the registry once per output (N outputs → 1 lookup per
  // distinct clip). Cleared at the start of every ingest().
  private readonly _spatialCache = new Map<string, SpatialBehavior>()

  constructor(graph: INodeGraph, registry?: DynamicEffectRegistry) {
    this._graph = graph
    this._registry = registry ?? getDynamicEffectRegistry()
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
    this._spatialCache.clear()
    this._frameIntentMap.clear()

    // 🩹 WAVE 4995: Zero-alloc intent consolidation.
    // Instead of emitting multiple disconnected intents for the same nodeId,
    // we accumulate them in _frameIntentMap. The last track to touch a node
    // for a specific channel will overwrite within the intent dictionary,
    // sending exactly 1 intent per node to the Arbiter.
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

      // 🏛️ WAVE 2483: resolve spatialBehavior for this output's source clip.
      // Defaults to 'absolute' for clips without a registry entry (legacy behaviour).
      const behavior = this._resolveSpatialBehavior(output.clipId)

      // 🧩 COMPOUND FIXTURE ROUTING: collect all nodes of this family, then route
      // zone-aware for compound fixtures (N nodes/family) or direct for simple (1 node/family).
      let _foundNode = false
      const familyNodeIds: NodeId[] = []
      for (let j = 0; j < nodeIds.length; j++) {
        const nd = this._graph.getNodeData(nodeIds[j])
        if (nd && nd.family === family) familyNodeIds.push(nodeIds[j])
      }

      if (familyNodeIds.length === 1) {
        // Simple fixture: always route to the single family node (backward compat).
        const nodeId = familyNodeIds[0]
        let intent = this._frameIntentMap.get(nodeId)
        if (!intent) {
          intent = this._acquireIntent(nodeId)
          this._frameIntentMap.set(nodeId, intent)
          this._frameIntents.push(intent as INodeIntent)
        }
        _populateValues(intent.values, param, output, behavior)
        _foundNode = true
      } else if (familyNodeIds.length > 1) {
        // Compound fixture: multiple nodes of the same family.
        // Try zone-aware routing: match node.zoneId against track zones.
        const trackZones = output.trackZones
        if (trackZones && trackZones.length > 0) {
          for (let j = 0; j < familyNodeIds.length; j++) {
            const nodeId = familyNodeIds[j]
            const nd = this._graph.getNodeData(nodeId)!
            const nodeZone = (nd as any).zoneId as string | undefined
            if (nodeZone && _nodeZoneInTrackZones(nodeZone, trackZones)) {
              let intent = this._frameIntentMap.get(nodeId)
              if (!intent) {
                intent = this._acquireIntent(nodeId)
                this._frameIntentMap.set(nodeId, intent)
                this._frameIntents.push(intent as INodeIntent)
              }
              _populateValues(intent.values, param, output, behavior)
              _foundNode = true
            }
          }
        }
        // Fallback: no zone info or no zone match.
        // 🧩 WAVE 5017: v2.1 compound fallback — avoid flash-node flood on clips
        // without trackZones. If the clip is NOT a strobe clip, skip flash nodes.
        if (!_foundNode) {
          const isStrobeClip = output.clipId
            ? (this._registry.getEntry(output.clipId)?.simMeta?.isStrobe ?? false)
            : false
          for (let j = 0; j < familyNodeIds.length; j++) {
            const nodeId = familyNodeIds[j]
            const nd = this._graph.getNodeData(nodeId)!
            const nodeZone = (nd as any).zoneId as string | undefined
            if (!isStrobeClip && nodeZone === 'flash') continue
            let intent = this._frameIntentMap.get(nodeId)
            if (!intent) {
              intent = this._acquireIntent(nodeId)
              this._frameIntentMap.set(nodeId, intent)
              this._frameIntents.push(intent as INodeIntent)
            }
            _populateValues(intent.values, param, output, behavior)
            _foundNode = true
          }
        }
      }

      // ⚡ WAVE 4917: COLOR-ONLY BRIGHTNESS FALLBACK
      if (!_foundNode && param === 'intensity') {
        for (let j = 0; j < nodeIds.length; j++) {
          const nodeId = nodeIds[j]
          const nodeData = this._graph.getNodeData(nodeId)
          if (!nodeData || nodeData.family !== NodeFamily.COLOR) continue

          // 🩹 WAVE 4995: Retrieve intent from map or acquire new
          let intent = this._frameIntentMap.get(nodeId)
          if (!intent) {
            intent = this._acquireIntent(nodeId)
            this._frameIntentMap.set(nodeId, intent)
            this._frameIntents.push(intent as INodeIntent)
          }
          intent.values['brightness'] = output.normalizedValue
          break
        }
      }
    }

    arbiter.setHephaestusIntents(this._frameIntents)
  }

  /**
   * 🏛️ WAVE 2483: Resolve spatialBehavior for a given clipId.
   *
   *   - No clipId               → 'absolute' (legacy, no rewrite).
   *   - clipId not in registry  → 'absolute' (legacy clip, no rewrite).
   *   - clipId in registry      → entry.spatialBehavior.
   *
   * Per-frame memoization avoids repeated Map lookups when many outputs
   * share the same clipId (typical for a multi-fixture sweep).
   */
  private _resolveSpatialBehavior(clipId: string | undefined): SpatialBehavior {
    if (!clipId) return 'absolute'
    const cached = this._spatialCache.get(clipId)
    if (cached !== undefined) return cached
    const entry = this._registry.getEntry(clipId)
    const behavior: SpatialBehavior = entry?.spatialBehavior ?? 'absolute'
    this._spatialCache.set(clipId, behavior)
    return behavior
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
      mergeStrategy: 'LTP',
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
    case 'strobeRate':  // 🩹 WAVE 4852 FIX-C: v3 canonical alias for 'strobe'
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
 *
 * 🏛️ WAVE 2483: When `behavior === 'relative_offset'`, the kinetic params
 * pan/tilt are remapped to pan_offset/tilt_offset and the value is
 * transformed [0,1] → [-1,+1] via `2v - 1`. The convention is:
 *   - 0.5 in the curve  → offset 0   (no displacement of IK base)
 *   - 0.0 in the curve  → offset -1  (full negative)
 *   - 1.0 in the curve  → offset +1  (full positive)
 * The NodeArbiter then sums the offset onto the IK-resolved pan/tilt base
 * via _applyRelativeOffsetFusion (WAVE 4914).
 */
function _populateValues(
  values: Record<string, number>,
  param: string,
  output: HephFixtureOutput,
  behavior: SpatialBehavior = 'absolute',
): void {
  switch (param) {
    case 'intensity':
      values['dimmer'] = output.normalizedValue
      break
    case 'strobe':
    case 'strobeRate':  // 🩹 WAVE 4852 FIX-C: v3 canonical alias falls through
      // 🩹 WAVE 4830: STROBE BLIND PATH FIX
      // LiquidAetherAdapter (L0) escribe { shutter: 1.0, strobeRate: v } para
      // abrir el obturador mecánico. HephaestusAetherAdapter solo escribía
      // { strobe: v }, dejando el shutter cerrado → strobe silencioso en hardware.
      // 🩹 WAVE 4853 FIX-D (DUAL-ALIAS): los perfiles de fixture declaran
      // `chDef.type` indistintamente como 'strobe' o 'strobeRate'. NodeResolver
      // busca por nombre literal — si solo escribimos uno, los fixtures que
      // declaran el otro pierden el canal y caen a defaultValue. Además
      // _l3DominatedChannels en NodeArbiter indexa por nombre literal: si L3
      // solo reclama 'strobeRate', L0's 'strobe' queda sin amordazar y
      // sangra. Escribir AMBOS aliases garantiza dominación y ruteo DMX.
      values['strobe']     = output.normalizedValue
      values['strobeRate'] = output.normalizedValue
      if (output.normalizedValue > 0) {
        values['shutter'] = 1.0  // abre el obturador mecánico cuando hay strobe
      }
      break
    case 'color': {
      const nr = output.normalizedRgb
      if (nr) {
        // 🩹 WAVE 4853 FIX-D (DUAL-ALIAS): NodeResolver._writeNode resuelve
        // canales COLOR vía `channelValues[CH_R] ?? channelValues[CH_RED]`,
        // priorizando 'r' sobre 'red'. ColorAdapter (L0) escribe 'r/g/b';
        // HephaestusAetherAdapter solo escribía 'red/green/blue'. Resultado:
        // ambos coexistían en el record arbitrado y L0 ganaba la lectura
        // pese a la "dominación" L3 (que indexa por nombre literal). Escribir
        // AMBOS aliases sella la dominación efectivamente y garantiza que el
        // proyector y el resolver lean la fuente L3.
        values['r']     = nr.r
        values['g']     = nr.g
        values['b']     = nr.b
        values['red']   = nr.r
        values['green'] = nr.g
        values['blue']  = nr.b
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
      if (behavior === 'relative_offset') {
        values['pan_offset'] = _toOffset(output.normalizedValue)
      } else {
        values['pan'] = output.normalizedValue
      }
      break
    case 'tilt':
      if (behavior === 'relative_offset') {
        values['tilt_offset'] = _toOffset(output.normalizedValue)
      } else {
        values['tilt'] = output.normalizedValue
      }
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

/** 🏛️ WAVE 2483: [0,1] → [-1,+1] linear remap for relative offsets. */
function _toOffset(v: number): number {
  const o = 2 * v - 1
  return o < -1 ? -1 : o > 1 ? 1 : o
}

/**
 * 🧩 COMPOUND ROUTING: checks if a node's canonical zoneId matches any of the
 * track's source zones. Only canonical zones (ambient, flash, air, ...) are
 * used here — composite zones like 'all-pars' do NOT appear as node zoneIds
 * so no expansion is needed.
 */
function _nodeZoneInTrackZones(nodeZone: string, trackZones: readonly string[]): boolean {
  const nz = nodeZone.toLowerCase().trim()
  for (let i = 0; i < trackZones.length; i++) {
    if (trackZones[i].toLowerCase().trim() === nz) return true
  }
  return false
}
