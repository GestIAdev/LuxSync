import { NodeFamily } from '../types';
const LP_PRIORITY = 200;
const LP_SOURCE = 'chronos';
const LP_CONFIDENCE = 1.0;
function normalizeDmx(value) {
    if (value <= 0)
        return 0;
    if (value >= 255)
        return 1;
    return value / 255;
}
export class ChronosAetherAdapter {
    constructor(graph) {
        this._nodeFamilyIndex = new Map();
        this._intentPool = [];
        this._frameIntents = [];
        this._intentCursor = 0;
        this._lastProcessedTickMs = -1;
        this._emptyIntents = Object.freeze([]);
        this._graph = graph;
        this.rebuildNodeIndex();
    }
    rebuildNodeIndex() {
        this._nodeFamilyIndex.clear();
        this._graph.getView(NodeFamily.IMPACT).forEach((node) => {
            this._nodeFamilyIndex.set(node.nodeId, NodeFamily.IMPACT);
        });
        this._graph.getView(NodeFamily.COLOR).forEach((node) => {
            this._nodeFamilyIndex.set(node.nodeId, NodeFamily.COLOR);
        });
        this._graph.getView(NodeFamily.KINETIC).forEach((node) => {
            this._nodeFamilyIndex.set(node.nodeId, NodeFamily.KINETIC);
        });
        this._graph.getView(NodeFamily.BEAM).forEach((node) => {
            this._nodeFamilyIndex.set(node.nodeId, NodeFamily.BEAM);
        });
        this._graph.getView(NodeFamily.ATMOSPHERE).forEach((node) => {
            this._nodeFamilyIndex.set(node.nodeId, NodeFamily.ATMOSPHERE);
        });
    }
    ingest(timelineEngine, _deltaMs, arbiter) {
        if (!timelineEngine.isPlaying) {
            this.clear(arbiter);
            return;
        }
        const snapshot = timelineEngine.getLastPlaybackFrame();
        if (snapshot === null) {
            this.clear(arbiter);
            return;
        }
        if (snapshot.tickMs === this._lastProcessedTickMs) {
            arbiter.setPlaybackIntents(this._frameIntents);
            return;
        }
        this._lastProcessedTickMs = snapshot.tickMs;
        this._intentCursor = 0;
        this._frameIntents.length = 0;
        this._buildPlaybackIntents(snapshot);
        arbiter.setPlaybackIntents(this._frameIntents);
    }
    clear(arbiter) {
        this._lastProcessedTickMs = -1;
        this._intentCursor = 0;
        this._frameIntents.length = 0;
        arbiter.setPlaybackIntents(this._emptyIntents);
    }
    _buildPlaybackIntents(snapshot) {
        const targets = snapshot.targets;
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            const nodeIds = this._graph.getDeviceNodes(target.fixtureId);
            for (let j = 0; j < nodeIds.length; j++) {
                const nodeId = nodeIds[j];
                const family = this._nodeFamilyIndex.get(nodeId);
                if (family === undefined)
                    continue;
                if (family === NodeFamily.IMPACT) {
                    this._emitImpactIntent(nodeId, target);
                    continue;
                }
                if (family === NodeFamily.COLOR) {
                    this._emitColorIntent(nodeId, target);
                    continue;
                }
                if (family === NodeFamily.KINETIC) {
                    this._emitKineticIntent(nodeId, target);
                    continue;
                }
                if (family === NodeFamily.BEAM) {
                    this._emitBeamIntent(nodeId, target);
                }
            }
        }
    }
    _emitImpactIntent(nodeId, target) {
        const dimmer = normalizeDmx(target.dimmer);
        const isLtpBlackout = target.blendMode === 'LTP' && target.dimmer === 0;
        if (!isLtpBlackout && dimmer <= 0) {
            return;
        }
        const intent = this._acquireIntent(nodeId);
        intent.values.dimmer = dimmer;
        if (isLtpBlackout && this._impactNodeSupportsShutter(nodeId)) {
            intent.values.shutter = 0;
        }
        this._frameIntents.push(intent);
    }
    _emitColorIntent(nodeId, target) {
        if (!target.colorTouched) {
            return;
        }
        const intent = this._acquireIntent(nodeId);
        intent.values.r = normalizeDmx(target.red);
        intent.values.g = normalizeDmx(target.green);
        intent.values.b = normalizeDmx(target.blue);
        intent.values.white = normalizeDmx(target.white);
        this._frameIntents.push(intent);
    }
    _emitKineticIntent(nodeId, target) {
        const pan = normalizeDmx(target.pan);
        const tilt = normalizeDmx(target.tilt);
        const speed = normalizeDmx(target.speed);
        if (pan <= 0 && tilt <= 0 && speed <= 0) {
            return;
        }
        const intent = this._acquireIntent(nodeId);
        intent.values.pan = pan;
        intent.values.tilt = tilt;
        intent.values.speed = speed;
        this._frameIntents.push(intent);
    }
    _emitBeamIntent(nodeId, target) {
        if (target.zoom <= 0) {
            return;
        }
        const intent = this._acquireIntent(nodeId);
        intent.values.zoom = normalizeDmx(target.zoom);
        this._frameIntents.push(intent);
    }
    _acquireIntent(nodeId) {
        let intent;
        if (this._intentCursor < this._intentPool.length) {
            intent = this._intentPool[this._intentCursor];
            const values = intent.values;
            for (const key in values) {
                delete values[key];
            }
        }
        else {
            intent = {
                nodeId,
                values: {},
                priority: LP_PRIORITY,
                confidence: LP_CONFIDENCE,
                source: LP_SOURCE,
            };
            this._intentPool.push(intent);
        }
        this._intentCursor += 1;
        intent.nodeId = nodeId;
        intent.priority = LP_PRIORITY;
        intent.confidence = LP_CONFIDENCE;
        intent.source = LP_SOURCE;
        return intent;
    }
    _impactNodeSupportsShutter(nodeId) {
        const node = this._graph.getNodeData(nodeId);
        if (node === undefined || node.family !== NodeFamily.IMPACT) {
            return false;
        }
        for (let i = 0; i < node.channels.length; i++) {
            if (node.channels[i].type === 'shutter') {
                return true;
            }
        }
        return false;
    }
}
