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

      // 🏛️ WAVE 2483: resolve spatialBehavior for this output's source clip.
      // Defaults to 'absolute' for clips without a registry entry (legacy behaviour).
      const behavior = this._resolveSpatialBehavior(output.clipId)

      // Find the node for this fixture that belongs to the target family.
      // 🩹 WAVE 4852 FIX-B: the original code used `break` after the push,
      // which is correct for the happy path. The silent-drop occurred when NO
      // node matched `family` — the loop exited without pushing anything and
      // control fell into the WAVE 4844 guard which then stamped dimmer=1.0
      // without a corresponding color intent. The loop logic is correct; the
      // root cause was the guard below (FIX-A). No change needed here beyond
      // the clarifying comment — `break` after the push is intentional (one
      // node per family per fixture).
      for (let j = 0; j < nodeIds.length; j++) {
        const nodeId = nodeIds[j]
        const nodeData = this._graph.getNodeData(nodeId)
        if (!nodeData || nodeData.family !== family) continue

        // Acquire an intent from the pool and populate values
        const intent = this._acquireIntent(nodeId)
        _populateValues(intent.values, param, output, behavior)
        this._frameIntents.push(intent as INodeIntent)
        // Only one node per family per fixture — stop searching
        break
      }

      // ⚡ WAVE 4844 (NEUTRALIZED by WAVE 4852 FIX-A):
      // The original guard stamped dimmer=1.0 on the :impact node whenever a
      // color intent was emitted, intending to guarantee opacity for clips
      // without a separate intensity curve. However HephaestusRuntime iterates
      // curves in Map insertion order (intensity first, color second), so the
      // LTP merge inside NodeArbiter._applyIntent caused the guard's dimmer=1.0
      // to overwrite the curve-evaluated dimmer value every frame — producing a
      // hard 100 % brightness block for the entire clip duration.
      // Correct fix: clips that need an opacity floor must carry an explicit
      // 'intensity' curve. The guard is removed entirely; no dimmer injection.
    }

    // 🔬 WAVE-DEBUG: Log color intents emitted every 44 frames (1s at 44Hz)
    if (this._frameIntents.length > 0 && (this._debugFrameCount = ((this._debugFrameCount ?? 0) + 1)) % 44 === 0) {
      const colorIntents = this._frameIntents.filter(i => {
        const v = i.values as Record<string, number>
        return v['red'] !== undefined || v['green'] !== undefined || v['blue'] !== undefined
      })
      if (colorIntents.length > 0) {
        const first = colorIntents[0]
        const v = first.values as Record<string, number>
        console.log(
          `[HephAetherAdapter 🔬] f=${this._debugFrameCount} | ` +
          `intents=${this._frameIntents.length} colorIntents=${colorIntents.length} | ` +
          `first=${first.nodeId} r=${v['red']?.toFixed(3)} g=${v['green']?.toFixed(3)} b=${v['blue']?.toFixed(3)}`
        )
      } else {
        console.log(
          `[HephAetherAdapter 🔬] f=${this._debugFrameCount} | outputs=${outputs.length} intents=${this._frameIntents.length} (no color intents) | ` +
          `sampleParam=${outputs[0]?.parameter} isCustom=${outputs[0]?.isCustomClip} nodeLen=${this._graph.getDeviceNodes(outputs[0]?.fixtureId ?? '').length}`
        )
      }
    }

    arbiter.setHephaestusIntents(this._frameIntents)
  }

  private _debugFrameCount = 0

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
