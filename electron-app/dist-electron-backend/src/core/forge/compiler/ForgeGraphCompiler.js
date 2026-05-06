/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE GRAPH COMPILER — Patch-Time Compilation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4a): Compila un IForgeNodeGraph en una estructura plana
 * (CompiledForgeGraph) optimizada para evaluación zero-alloc a 44Hz.
 *
 * PIPELINE:
 *   1. Topological Sort (Kahn's Algorithm) → executionOrder[]
 *   2. Wire Allocation → Float64Array (port → index mapping)
 *   3. State Allocation → Float64Array (stateful nodes get offsets)
 *   4. Program Build → CompiledInstruction[] (opcode + offsets)
 *   5. Edge Wiring → Uint32Array of [src, dst] pairs
 *   6. Input/Output Map extraction
 *
 * WAVE 4552: compound_ingenio inlining is NOW implemented via _inlineCompoundNodes().
 * Flat graphs with no compound nodes are passed through unchanged (zero overhead).
 *
 * @module core/forge/compiler/ForgeGraphCompiler
 * @version WAVE 4552
 */
// ═══════════════════════════════════════════════════════════════════════════
// OPCODE MAPPING — ForgeNodeType → numeric opcode
// Must stay in sync with OPCODE_TABLE in evaluator/opcodes.ts
// ═══════════════════════════════════════════════════════════════════════════
const OPCODE_MAP = {
    input_dmx: 1,
    input_audio_band: 2,
    input_beat: 3,
    input_bpm: 4,
    input_energy: 5,
    input_constant: 6,
    input_time: 7,
    proc_lfo: 8,
    proc_smooth: 9,
    proc_map_range: 10,
    proc_math: 11,
    proc_clamp: 12,
    proc_delay: 13,
    proc_merge: 14,
    proc_invert: 15,
    proc_curve: 16,
    logic_threshold: 17,
    logic_gate: 18,
    logic_switch: 19,
    logic_and: 20,
    logic_or: 21,
    logic_counter: 22,
    output_dmx: 23,
    compound_ingenio: 0, // WAVE 4552: never emitted — inlined at patch time by _inlineCompoundNodes()
};
// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM ENUM — for LFO params encoding
// ═══════════════════════════════════════════════════════════════════════════
const WAVEFORM_MAP = {
    sine: 0,
    triangle: 1,
    sawtooth: 2,
    square: 3,
    random_hold: 4,
};
// ═══════════════════════════════════════════════════════════════════════════
// MATH OP ENUM
// ═══════════════════════════════════════════════════════════════════════════
const MATH_OP_MAP = {
    add: 0,
    subtract: 1,
    multiply: 2,
    divide: 3,
    modulo: 4,
    power: 5,
};
// ═══════════════════════════════════════════════════════════════════════════
// CURVE TYPE ENUM
// ═══════════════════════════════════════════════════════════════════════════
const CURVE_TYPE_MAP = {
    linear: 0,
    exponential: 1,
    logarithmic: 2,
    scurve: 3,
    gamma: 4,
};
// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGY ENUM
// ═══════════════════════════════════════════════════════════════════════════
const MERGE_STRATEGY_MAP = {
    max: 0,
    min: 1,
    average: 2,
    sum: 3,
};
// ═══════════════════════════════════════════════════════════════════════════
// STATE SLOTS — How many Float64 state slots each node type needs
// ═══════════════════════════════════════════════════════════════════════════
function getStateSlots(node) {
    switch (node.type) {
        case 'proc_lfo': return 1; // phase accumulator
        case 'proc_smooth': return 1; // previous value
        case 'proc_delay': {
            const cfg = node.config;
            return cfg.delayFrames + 1; // ring buffer + write head
        }
        case 'logic_counter': return 1; // count
        case 'logic_threshold': return 1; // lastOutput (hysteresis)
        default: return 0; // stateless
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// PARAMS EXTRACTION — Config → Float64Array(8) for hot-path
// ═══════════════════════════════════════════════════════════════════════════
function extractParams(node) {
    const p = new Float64Array(8);
    const cfg = node.config;
    switch (cfg.nodeType) {
        case 'input_constant': {
            const c = cfg;
            p[0] = c.value;
            break;
        }
        case 'proc_lfo': {
            const c = cfg;
            p[0] = WAVEFORM_MAP[c.waveform] ?? 0;
            p[1] = c.frequencyHz;
            p[2] = c.syncToBpm ? 1.0 : 0.0;
            p[3] = c.bpmDivisor;
            p[4] = c.phase;
            break;
        }
        case 'proc_smooth': {
            const c = cfg;
            p[0] = c.attackMs;
            p[1] = c.releaseMs;
            break;
        }
        case 'proc_map_range': {
            const c = cfg;
            p[0] = c.inputMin;
            p[1] = c.inputMax;
            p[2] = c.outputMin;
            p[3] = c.outputMax;
            break;
        }
        case 'proc_math': {
            const c = cfg;
            p[0] = MATH_OP_MAP[c.operation] ?? 0;
            break;
        }
        case 'proc_clamp': {
            const c = cfg;
            p[0] = c.min;
            p[1] = c.max;
            break;
        }
        case 'proc_delay': {
            const c = cfg;
            p[0] = c.delayFrames;
            break;
        }
        case 'proc_merge': {
            const c = cfg;
            p[0] = MERGE_STRATEGY_MAP[c.strategy] ?? 0;
            break;
        }
        case 'proc_curve': {
            const c = cfg;
            p[0] = CURVE_TYPE_MAP[c.curveType] ?? 0;
            p[1] = c.exponent ?? 2.0;
            p[2] = c.gamma ?? 2.2;
            break;
        }
        case 'logic_threshold': {
            const c = cfg;
            p[0] = c.threshold;
            p[1] = c.hysteresis;
            break;
        }
        case 'logic_counter': {
            const c = cfg;
            p[0] = c.modulo;
            p[1] = c.emitNormalized ? 1.0 : 0.0;
            break;
        }
        case 'logic_switch': {
            const c = cfg;
            p[0] = c.switchThreshold;
            break;
        }
        case 'output_dmx': {
            const c = cfg;
            p[0] = c.defaultDmxValue / 255; // normalized default
            break;
        }
        // input_dmx, input_audio_band, input_beat, input_bpm, input_energy,
        // input_time, proc_invert, logic_gate, logic_and, logic_or:
        // No params needed (or already injected externally)
        default:
            break;
    }
    return p;
}
// ═══════════════════════════════════════════════════════════════════════════
// AUDIO BAND INDEX — string → Float64Array index
// ═══════════════════════════════════════════════════════════════════════════
export const AUDIO_BAND_INDEX = {
    subBass: 0,
    bass: 1,
    mid: 2,
    highMid: 3,
    presence: 4,
    air: 5,
};
// ═══════════════════════════════════════════════════════════════════════════
// FORGE GRAPH COMPILER
// ═══════════════════════════════════════════════════════════════════════════
export class ForgeGraphCompiler {
    /**
     * Compila un IForgeNodeGraph en una estructura plana zero-alloc.
     *
     * PATCH TIME — llamar UNA VEZ al registrar un device.
     * El resultado se reutiliza en cada frame sin allocations.
     *
     * @param graph — Grafo de nodos del fixture (design-time)
     * @param fixtureId — ID del fixture propietario
     * @returns CompiledForgeGraph listo para ForgeNodeEvaluator.evaluate()
     */
    static compile(graph, fixtureId) {
        // ── 0. Inline all compound_ingenio nodes (WAVE 4552) ──────────────
        const flatGraph = ForgeGraphCompiler._inlineCompoundNodes(graph);
        // ── 1. Build node index for O(1) lookups ──────────────────────────
        const nodeMap = new Map();
        for (const node of flatGraph.nodes) {
            nodeMap.set(node.id, node);
        }
        // ── 2. Topological Sort (Kahn's Algorithm) ────────────────────────
        const executionOrder = ForgeGraphCompiler._topologicalSort(flatGraph, nodeMap);
        // ── 3. Wire Allocation ────────────────────────────────────────────
        const { wireBuffer, portIndexMap, totalWireSlots } = ForgeGraphCompiler._allocateWires(executionOrder, nodeMap);
        // ── 4. State Allocation ───────────────────────────────────────────
        const { stateBuffer, stateOffsetMap, totalStateSlots } = ForgeGraphCompiler._allocateState(executionOrder, nodeMap);
        // ── 5. Build Edge Wiring ──────────────────────────────────────────
        const { edgeWiring, edgeCount } = ForgeGraphCompiler._buildEdgeWiring(flatGraph, portIndexMap);
        // ── 6. Build Program ──────────────────────────────────────────────
        const program = ForgeGraphCompiler._buildProgram(executionOrder, nodeMap, portIndexMap, stateOffsetMap);
        // ── 7. Extract Input/Output Maps ──────────────────────────────────
        const inputMap = new Map();
        const audioInputMap = new Map();
        let beatInputIndex = -1;
        let bpmInputIndex = -1;
        let energyInputIndex = -1;
        let timeInputIndex = -1;
        const outputs = [];
        for (const nodeId of executionOrder) {
            const node = nodeMap.get(nodeId);
            switch (node.type) {
                case 'input_dmx': {
                    const cfg = node.config;
                    const outPort = node.outputs[0];
                    if (outPort) {
                        const wireIdx = portIndexMap.get(`${nodeId}:out:${outPort.id}`);
                        if (wireIdx !== undefined)
                            inputMap.set(cfg.channelKey, wireIdx);
                    }
                    break;
                }
                case 'input_audio_band': {
                    const cfg = node.config;
                    const outPort = node.outputs[0];
                    if (outPort) {
                        const wireIdx = portIndexMap.get(`${nodeId}:out:${outPort.id}`);
                        if (wireIdx !== undefined)
                            audioInputMap.set(cfg.band, wireIdx);
                    }
                    break;
                }
                case 'input_beat': {
                    const outPort = node.outputs[0];
                    if (outPort) {
                        beatInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1;
                    }
                    break;
                }
                case 'input_bpm': {
                    const outPort = node.outputs[0];
                    if (outPort) {
                        bpmInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1;
                    }
                    break;
                }
                case 'input_energy': {
                    const outPort = node.outputs[0];
                    if (outPort) {
                        energyInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1;
                    }
                    break;
                }
                case 'input_time': {
                    const outPort = node.outputs[0];
                    if (outPort) {
                        timeInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1;
                    }
                    break;
                }
                case 'output_dmx': {
                    const cfg = node.config;
                    // The input port of the output_dmx node carries the final normalized value
                    const inPort = node.inputs[0];
                    if (inPort) {
                        const wireIdx = portIndexMap.get(`${nodeId}:in:${inPort.id}`);
                        if (wireIdx !== undefined) {
                            outputs.push({
                                wireIndex: wireIdx,
                                dmxOffset: cfg.dmxOffset,
                                defaultDmxValue: cfg.defaultDmxValue,
                                is16bit: cfg.is16bit ?? false,
                            });
                        }
                    }
                    break;
                }
            }
        }
        // Sort outputs by dmxOffset for sequential DMX writes
        outputs.sort((a, b) => a.dmxOffset - b.dmxOffset);
        return {
            fixtureId,
            wireBuffer,
            totalWireSlots,
            stateBuffer,
            totalStateSlots,
            program,
            edgeWiring,
            edgeCount,
            inputMap,
            audioInputMap,
            beatInputIndex,
            bpmInputIndex,
            energyInputIndex,
            timeInputIndex,
            outputs,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — Inline compound_ingenio nodes (WAVE 4552)
    //
    // Transforms a graph that may contain compound_ingenio nodes into a
    // fully flat graph of primitive nodes. This is PATCH TIME ONLY.
    //
    // Algorithm (iterative, handles arbitrary nesting depth):
    //   While any compound_ingenio nodes exist in the working graph:
    //     For each compound node:
    //       1. Prefix all internal node/port/edge IDs with the compound node's ID
    //       2. Build a translation map: exposedPortId -> internal wireKey
    //       3. Redirect all external edges that connect to the compound node
    //          to their corresponding internal port via the portMapping
    //       4. Remove the compound node and its external edges
    //       5. Insert the (now-prefixed) internal nodes and edges
    //   Result: a flat IForgeNodeGraph with only primitive nodes
    // ═══════════════════════════════════════════════════════════════════════
    static _inlineCompoundNodes(graph) {
        // Fast path: no compound nodes -> return as-is (zero overhead)
        if (!graph.nodes.some((n) => n.type === 'compound_ingenio'))
            return graph;
        // Iterative expansion to handle nested Ingenios
        let workNodes = [...graph.nodes];
        let workEdges = [...graph.edges];
        let hasCompound = true;
        let safetyLimit = 32; // max nesting depth guard
        while (hasCompound && safetyLimit-- > 0) {
            hasCompound = false;
            const nextNodes = [];
            const nextEdges = [];
            // Edges to keep (not connected to any compound node)
            const removedNodeIds = new Set();
            for (const node of workNodes) {
                if (node.type !== 'compound_ingenio') {
                    nextNodes.push(node);
                    continue;
                }
                hasCompound = true;
                removedNodeIds.add(node.id);
                const cfg = node.config;
                const prefix = node.id;
                const sub = cfg.subGraph;
                // Step 1: Clone internal nodes with prefixed IDs
                for (const internalNode of sub.nodes) {
                    const prefixedId = `${prefix}__${internalNode.id}`;
                    nextNodes.push({
                        ...internalNode,
                        id: prefixedId,
                        inputs: internalNode.inputs.map((p) => ({ ...p, id: `${prefix}__${p.id}` })),
                        outputs: internalNode.outputs.map((p) => ({ ...p, id: `${prefix}__${p.id}` })),
                    });
                }
                // Step 2: Clone internal edges with prefixed IDs
                for (const internalEdge of sub.edges) {
                    nextEdges.push({
                        id: `${prefix}__${internalEdge.id}`,
                        sourceNode: `${prefix}__${internalEdge.sourceNode}`,
                        sourcePort: `${prefix}__${internalEdge.sourcePort}`,
                        targetNode: `${prefix}__${internalEdge.targetNode}`,
                        targetPort: `${prefix}__${internalEdge.targetPort}`,
                    });
                }
                // Step 3: Build exposed-port -> prefixed-internal-port maps
                // input map: exposedPortId -> { internalNodeId (prefixed), internalPortId (prefixed) }
                const exposedInputMap = new Map();
                for (const mapping of cfg.portMapping.inputs) {
                    exposedInputMap.set(mapping.exposedPortId, {
                        nodeId: `${prefix}__${mapping.internalNodeId}`,
                        portId: `${prefix}__${mapping.internalPortId}`,
                    });
                }
                const exposedOutputMap = new Map();
                for (const mapping of cfg.portMapping.outputs) {
                    exposedOutputMap.set(mapping.exposedPortId, {
                        nodeId: `${prefix}__${mapping.internalNodeId}`,
                        portId: `${prefix}__${mapping.internalPortId}`,
                    });
                }
                // Step 4: Redirect external edges that point TO or FROM this compound node
                // These edges are NOT kept in nextEdges — they get translated
                for (const edge of workEdges) {
                    if (edge.targetNode === node.id) {
                        // External edge -> compound INPUT port -> rewire to internal node
                        const internal = exposedInputMap.get(edge.targetPort);
                        if (internal) {
                            nextEdges.push({
                                id: `${prefix}__redirect_in__${edge.id}`,
                                sourceNode: edge.sourceNode,
                                sourcePort: edge.sourcePort,
                                targetNode: internal.nodeId,
                                targetPort: internal.portId,
                            });
                        }
                        // If no mapping found: the edge connected to an unbound port -> silently drop
                    }
                    else if (edge.sourceNode === node.id) {
                        // compound OUTPUT port -> external node -> rewire from internal node
                        const internal = exposedOutputMap.get(edge.sourcePort);
                        if (internal) {
                            nextEdges.push({
                                id: `${prefix}__redirect_out__${edge.id}`,
                                sourceNode: internal.nodeId,
                                sourcePort: internal.portId,
                                targetNode: edge.targetNode,
                                targetPort: edge.targetPort,
                            });
                        }
                    }
                    // Edges unrelated to this compound node are handled below
                }
            }
            // Keep edges that do NOT touch any removed (compound) node
            for (const edge of workEdges) {
                if (!removedNodeIds.has(edge.sourceNode) && !removedNodeIds.has(edge.targetNode)) {
                    nextEdges.push(edge);
                }
            }
            workNodes = nextNodes;
            workEdges = nextEdges;
        }
        if (safetyLimit <= 0) {
            console.error('[ForgeGraphCompiler] _inlineCompoundNodes: max nesting depth (32) exceeded. Possible circular Ingenio reference. Compilation may be incomplete.');
        }
        return {
            version: graph.version,
            nodes: workNodes,
            edges: workEdges,
            meta: graph.meta,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — Topological Sort (Kahn's BFS)
    // ═══════════════════════════════════════════════════════════════════════
    static _topologicalSort(graph, nodeMap) {
        const inDegree = new Map();
        const adjacency = new Map();
        // Initialize
        for (const node of graph.nodes) {
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }
        // Count incoming edges per node
        for (const edge of graph.edges) {
            const prev = inDegree.get(edge.targetNode) ?? 0;
            inDegree.set(edge.targetNode, prev + 1);
            const adj = adjacency.get(edge.sourceNode);
            if (adj)
                adj.push(edge.targetNode);
        }
        // BFS: enqueue nodes with inDegree === 0
        const queue = [];
        for (const [nodeId, deg] of inDegree) {
            if (deg === 0)
                queue.push(nodeId);
        }
        const result = [];
        while (queue.length > 0) {
            const current = queue.shift();
            result.push(current);
            const successors = adjacency.get(current) ?? [];
            for (const succ of successors) {
                const newDeg = (inDegree.get(succ) ?? 1) - 1;
                inDegree.set(succ, newDeg);
                if (newDeg === 0)
                    queue.push(succ);
            }
        }
        if (result.length < graph.nodes.length) {
            // Cycle detected — push remaining nodes at the end with warning
            // (proc_delay nodes may cause valid cycles in future; for v1 we
            //  append them to avoid crashing the compiler)
            console.warn(`[ForgeGraphCompiler] Cycle detected: ${graph.nodes.length - result.length} nodes unreachable. Appending at end.`);
            const inResult = new Set(result);
            for (const node of graph.nodes) {
                if (!inResult.has(node.id))
                    result.push(node.id);
            }
        }
        return result;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — Wire Allocation (port → Float64Array index)
    // ═══════════════════════════════════════════════════════════════════════
    static _allocateWires(executionOrder, nodeMap) {
        const portIndexMap = new Map();
        let portIndex = 0;
        for (const nodeId of executionOrder) {
            const node = nodeMap.get(nodeId);
            for (const port of node.inputs) {
                portIndexMap.set(`${nodeId}:in:${port.id}`, portIndex++);
            }
            for (const port of node.outputs) {
                portIndexMap.set(`${nodeId}:out:${port.id}`, portIndex++);
            }
        }
        return {
            wireBuffer: new Float64Array(portIndex),
            portIndexMap,
            totalWireSlots: portIndex,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — State Allocation (stateful nodes → Float64Array offsets)
    // ═══════════════════════════════════════════════════════════════════════
    static _allocateState(executionOrder, nodeMap) {
        const stateOffsetMap = new Map();
        let stateOffset = 0;
        for (const nodeId of executionOrder) {
            const node = nodeMap.get(nodeId);
            stateOffsetMap.set(nodeId, stateOffset);
            stateOffset += getStateSlots(node);
        }
        return {
            stateBuffer: new Float64Array(stateOffset),
            stateOffsetMap,
            totalStateSlots: stateOffset,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — Edge Wiring (edges → Uint32Array of [src, dst] pairs)
    // ═══════════════════════════════════════════════════════════════════════
    static _buildEdgeWiring(graph, portIndexMap) {
        const pairs = [];
        for (const edge of graph.edges) {
            const srcKey = `${edge.sourceNode}:out:${edge.sourcePort}`;
            const dstKey = `${edge.targetNode}:in:${edge.targetPort}`;
            const srcIdx = portIndexMap.get(srcKey);
            const dstIdx = portIndexMap.get(dstKey);
            if (srcIdx !== undefined && dstIdx !== undefined) {
                pairs.push(srcIdx, dstIdx);
            }
            else {
                console.warn(`[ForgeGraphCompiler] Edge ${edge.id}: unmapped port (src=${srcKey} dst=${dstKey}). Skipping.`);
            }
        }
        return {
            edgeWiring: new Uint32Array(pairs),
            edgeCount: pairs.length / 2,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — Program Build (executionOrder → CompiledInstruction[])
    // ═══════════════════════════════════════════════════════════════════════
    static _buildProgram(executionOrder, nodeMap, portIndexMap, stateOffsetMap) {
        const program = [];
        for (const nodeId of executionOrder) {
            const node = nodeMap.get(nodeId);
            const opcode = OPCODE_MAP[node.type] ?? 0;
            // Resolve port offsets
            let inputOffset = 0;
            let outputOffset = 0;
            if (node.inputs.length > 0) {
                inputOffset = portIndexMap.get(`${nodeId}:in:${node.inputs[0].id}`) ?? 0;
            }
            if (node.outputs.length > 0) {
                outputOffset = portIndexMap.get(`${nodeId}:out:${node.outputs[0].id}`) ?? 0;
            }
            program.push({
                opcode,
                inputOffset,
                inputCount: node.inputs.length,
                outputOffset,
                outputCount: node.outputs.length,
                stateOffset: stateOffsetMap.get(nodeId) ?? 0,
                stateSlots: getStateSlots(node),
                params: extractParams(node),
            });
        }
        return program;
    }
}
