/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 AETHER MATRIX — NODE EXTRACTION PIPELINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3507: THE SPATIAL GENESIS (F1)
 *
 * Adaptador de solo lectura que traduce una FixtureDefinition legacy
 * a un IDeviceDefinition con todos sus ICapabilityNode descompuestos.
 *
 * INVARIANTES:
 * - JAMÁS muta la FixtureDefinition de entrada (read-only adapter).
 * - Solo se ejecuta en patch time — NUNCA en el hot path (44Hz).
 * - Produce ICapabilityNode con state: Float64Array(4) pre-asignado.
 * - Genera DeviceId y NodeId derivados del id del fixture legacy.
 *
 * ALGORITMO DE DESCOMPOSICIÓN:
 *   1. Analiza los canales (FixtureChannel[]) del perfil legacy.
 *   2. Detecta la topología: single-emitter, multi-emitter (fan),
 *      o hybrid (mover con color mixing).
 *   3. Agrupa canales por familia semántica (COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE).
 *   4. Para aparatos multi-emitter (fans): cada pétalo recibe su propio
 *      COLOR_NODE con offsets DMX calculados.
 *   5. Retorna IDeviceDefinition lista para NodeGraph.registerDevice().
 *
 * @module core/aether/ingestion/NodeExtractionPipeline
 * @version WAVE 3507
 */
import { NodeFamily } from '../types';
// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL CLASSIFICATION SETS
// ═══════════════════════════════════════════════════════════════════════════
const COLOR_CHANNEL_TYPES = new Set([
    'red', 'green', 'blue', 'white', 'amber', 'uv',
    'cyan', 'magenta', 'yellow', 'color_wheel',
]);
const IMPACT_CHANNEL_TYPES = new Set([
    'dimmer', 'strobe', 'shutter',
]);
const KINETIC_CHANNEL_TYPES = new Set([
    'pan', 'pan_fine', 'tilt', 'tilt_fine', 'speed', 'rotation',
]);
const BEAM_CHANNEL_TYPES = new Set([
    'gobo', 'gobo_rotation', 'prism', 'prism_rotation',
    'focus', 'zoom', 'iris', 'frost',
]);
const ATMOSPHERE_CHANNEL_TYPES = new Set([
    'control', 'macro', 'custom',
]);
// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT & CURVE DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════
const IMPACT_TRANSFER_CURVE = {
    type: 'exponential',
    exponent: 2.5,
    noiseGate: 0.02,
};
const IMPACT_BAND_MIX = {
    subBass: 0.80,
    bass: 0.60,
    lowMid: 0.20,
    mid: 0.20,
    highMid: 0.10,
    treble: 0.05,
    ultraAir: 0.0,
    energy: 0.40,
};
const IMPACT_ENVELOPE_INIT = {
    current: 0,
    velocity: 0,
};
const ATMOSPHERE_SAFETY_INIT = {
    lastActivationMs: 0,
    totalActiveMs: 0,
    cooldownRemaining: 0,
};
const DARKSPIN_INIT = {
    lastChangeMs: 0,
    isLocked: false,
};
const NEUTRAL_POSITION = { x: 0, y: 0, z: 0 };
const COLOR_CONSTRAINTS = {
    responseType: 'digital',
    minChangeTimeMs: 0,
    maxValue: 255,
};
const IMPACT_CONSTRAINTS = {
    responseType: 'digital',
    minChangeTimeMs: 0,
    maxValue: 255,
    transferCurve: IMPACT_TRANSFER_CURVE,
};
const KINETIC_CONSTRAINTS_BASE = {
    responseType: 'mechanical',
    minChangeTimeMs: 0,
    maxValue: 255,
    maxSpeed: 540,
};
const BEAM_CONSTRAINTS = {
    responseType: 'mechanical',
    minChangeTimeMs: 200,
    maxValue: 255,
};
const ATMOSPHERE_CONSTRAINTS = {
    responseType: 'digital',
    minChangeTimeMs: 0,
    maxValue: 255,
};
// ═══════════════════════════════════════════════════════════════════════════
// NODE EXTRACTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Adaptador sin estado. Convierte FixtureDefinition legacy a
 * IDeviceDefinition con CapabilityNodes descompuestos por familia.
 *
 * Instanciar una vez y reutilizar — no tiene estado mutable.
 */
export class NodeExtractionPipeline {
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Extrae un IDeviceDefinition a partir de un perfil de fixture legacy.
     *
     * @param fixtureDef       — Perfil leído de la biblioteca (.fxt / DB). NUNCA mutable.
     * @param dmxAddress       — Dirección DMX base (1–512).
     * @param universe         — Universo DMX (1-based).
     * @param zoneId           — Zona semántica ("movers-left", "front", etc.).
     * @param deviceIdOverride — DeviceId explícito. Si omitido, usa fixtureDef.id.
     */
    extract(fixtureDef, dmxAddress, universe, zoneId, deviceIdOverride) {
        const deviceId = deviceIdOverride ?? fixtureDef.id;
        const topology = this._analyzeTopology(fixtureDef);
        const nodes = this._buildAllNodes(deviceId, zoneId, fixtureDef, topology);
        const calibr = this._buildCalibration(fixtureDef);
        return {
            deviceId,
            name: fixtureDef.name,
            type: fixtureDef.type,
            dmxAddress,
            universe,
            channelCount: fixtureDef.channels.length,
            nodes: Object.freeze(nodes),
            calibration: calibr,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1 — TOPOLOGY ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    _analyzeTopology(fixtureDef) {
        const chs = fixtureDef.channels;
        const colorChs = chs.filter(ch => COLOR_CHANNEL_TYPES.has(ch.type));
        const impactChs = chs.filter(ch => IMPACT_CHANNEL_TYPES.has(ch.type));
        const kineticChs = chs.filter(ch => KINETIC_CHANNEL_TYPES.has(ch.type));
        const beamChs = chs.filter(ch => BEAM_CHANNEL_TYPES.has(ch.type));
        const atmosphereChs = chs.filter(ch => ATMOSPHERE_CHANNEL_TYPES.has(ch.type));
        const colorGroups = fixtureDef.type === 'fan'
            ? this._detectFanEmitterGroups(colorChs)
            : colorChs.length > 0
                ? [{ emitterIndex: 0, labelSuffix: 'color', channels: colorChs }]
                : [];
        return {
            colorGroups,
            impactChannels: impactChs,
            kineticChannels: kineticChs,
            beamChannels: beamChs,
            atmosphereChannels: atmosphereChs,
        };
    }
    /**
     * Divide los canales de color en bloques por pétalo para fans.
     * Cada bloque RGB/RGBW/CMY completo = 1 sub-emitter independiente.
     */
    _detectFanEmitterGroups(colorChs) {
        if (colorChs.length === 0)
            return [];
        const sorted = [...colorChs].sort((a, b) => a.index - b.index);
        const blockSize = this._inferBlockSize(sorted);
        const groups = [];
        let cursor = 0;
        while (cursor < sorted.length) {
            const block = sorted.slice(cursor, cursor + blockSize);
            if (block.length === 0)
                break;
            groups.push({
                emitterIndex: groups.length,
                labelSuffix: `petal-${groups.length}`,
                channels: block,
            });
            cursor += blockSize;
        }
        return groups;
    }
    /** Tamaño de bloque por pétalo inferido del conjunto de tipos de canal. */
    _inferBlockSize(sortedColorChs) {
        const types = new Set(sortedColorChs.map(ch => ch.type));
        if (types.has('cyan') && types.has('magenta') && types.has('yellow'))
            return 3;
        const hasRGB = types.has('red') && types.has('green') && types.has('blue');
        if (hasRGB) {
            let extra = 0;
            if (types.has('white'))
                extra++;
            if (types.has('amber'))
                extra++;
            if (types.has('uv'))
                extra++;
            return 3 + extra;
        }
        return sortedColorChs.length; // fallback: todo como un único bloque
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2 — NODE CONSTRUCTION
    // ─────────────────────────────────────────────────────────────────────────
    _buildAllNodes(deviceId, zoneId, fixtureDef, topology) {
        const nodes = [];
        for (const group of topology.colorGroups) {
            nodes.push(this._buildColorNode(deviceId, zoneId, fixtureDef, group));
        }
        if (topology.impactChannels.length > 0) {
            nodes.push(this._buildImpactNode(deviceId, zoneId, topology.impactChannels));
        }
        if (topology.kineticChannels.length > 0) {
            nodes.push(this._buildKineticNode(deviceId, zoneId, fixtureDef, topology.kineticChannels));
        }
        if (topology.beamChannels.length > 0) {
            nodes.push(this._buildBeamNode(deviceId, zoneId, topology.beamChannels));
        }
        if (topology.atmosphereChannels.length > 0) {
            nodes.push(this._buildAtmosphereNode(deviceId, zoneId, fixtureDef, topology.atmosphereChannels));
        }
        return nodes;
    }
    // ── COLOR NODE ────────────────────────────────────────────────────────────
    _buildColorNode(deviceId, zoneId, fixtureDef, group) {
        const nodeId = `${deviceId}:${group.labelSuffix}`;
        const channels = this._mapChannels(group.channels);
        const mixingType = this._detectMixingType(group.channels);
        const colorWheel = this._buildColorWheelDef(fixtureDef);
        return {
            nodeId,
            family: NodeFamily.COLOR,
            deviceId,
            zoneId,
            role: group.emitterIndex === 0 ? 'primary' : 'accent',
            channels,
            constraints: COLOR_CONSTRAINTS,
            mixingType,
            colorWheel,
            currentColor: { r: 0, g: 0, b: 0 },
            state: new Float64Array(4),
        };
    }
    // ── IMPACT NODE ───────────────────────────────────────────────────────────
    _buildImpactNode(deviceId, zoneId, impactChs) {
        const nodeId = `${deviceId}:impact`;
        return {
            nodeId,
            family: NodeFamily.IMPACT,
            deviceId,
            zoneId,
            role: 'percussion',
            channels: this._mapChannels(impactChs),
            constraints: IMPACT_CONSTRAINTS,
            transferCurve: IMPACT_TRANSFER_CURVE,
            bandMix: IMPACT_BAND_MIX,
            envelopeState: IMPACT_ENVELOPE_INIT,
            state: new Float64Array(4),
        };
    }
    // ── KINETIC NODE ──────────────────────────────────────────────────────────
    _buildKineticNode(deviceId, zoneId, fixtureDef, kineticChs) {
        const nodeId = `${deviceId}:kinetic`;
        const motorType = this._mapMotorType(fixtureDef.physics?.motorType);
        const maxSpeed = fixtureDef.physics?.maxVelocity ?? 540;
        return {
            nodeId,
            family: NodeFamily.KINETIC,
            deviceId,
            zoneId,
            role: 'primary',
            channels: this._mapChannels(kineticChs, true),
            constraints: { ...KINETIC_CONSTRAINTS_BASE, maxSpeed },
            motorType,
            maxPanSpeed: maxSpeed,
            maxTiltSpeed: maxSpeed,
            currentPosition: { pan: 0.5, tilt: 0.5 },
            physicalPosition: NEUTRAL_POSITION,
            stereoIndex: 0,
            stereoTotal: 1,
            state: new Float64Array(4),
        };
    }
    // ── BEAM NODE ─────────────────────────────────────────────────────────────
    _buildBeamNode(deviceId, zoneId, beamChs) {
        const nodeId = `${deviceId}:beam`;
        const types = new Set(beamChs.map(ch => ch.type));
        return {
            nodeId,
            family: NodeFamily.BEAM,
            deviceId,
            zoneId,
            role: 'decoration',
            channels: this._mapChannels(beamChs),
            constraints: BEAM_CONSTRAINTS,
            hasGobo: types.has('gobo'),
            hasGoboRotation: types.has('gobo_rotation'),
            hasPrism: types.has('prism'),
            hasPrismRotation: types.has('prism_rotation'),
            hasZoom: types.has('zoom'),
            hasFocus: types.has('focus'),
            hasFrost: types.has('frost'),
            darkSpinState: DARKSPIN_INIT,
            state: new Float64Array(4),
        };
    }
    // ── ATMOSPHERE NODE ───────────────────────────────────────────────────────
    _buildAtmosphereNode(deviceId, zoneId, fixtureDef, atmosphereChs) {
        const nodeId = `${deviceId}:atmosphere`;
        return {
            nodeId,
            family: NodeFamily.ATMOSPHERE,
            deviceId,
            zoneId,
            role: 'atmosphere',
            channels: this._mapChannels(atmosphereChs),
            constraints: ATMOSPHERE_CONSTRAINTS,
            atmosType: this._mapAtmosphereType(fixtureDef.type),
            safety: ATMOSPHERE_SAFETY_INIT,
            state: new Float64Array(4),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3 — CALIBRATION EXTRACTION
    // ─────────────────────────────────────────────────────────────────────────
    _buildCalibration(fixtureDef) {
        const p = fixtureDef.physics;
        if (!p)
            return undefined;
        const calib = {
            ...(p.invertPan !== undefined && { invertPan: p.invertPan }),
            ...(p.invertTilt !== undefined && { invertTilt: p.invertTilt }),
            ...(p.homePosition && {
                panOffset: p.homePosition.pan,
                tiltOffset: p.homePosition.tilt,
            }),
            ...(p.tiltLimits?.min !== undefined && { tiltLimitMin: p.tiltLimits.min }),
            ...(p.tiltLimits?.max !== undefined && { tiltLimitMax: p.tiltLimits.max }),
        };
        return Object.keys(calib).length > 0 ? calib : undefined;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Convierte FixtureChannel[] a INodeChannelDef[].
     * @param kinetic — Si true, usa 128 como default para pan/tilt (centro).
     */
    _mapChannels(channels, kinetic = false) {
        return channels.map(ch => ({
            type: ch.type,
            dmxOffset: ch.index - 1, // FixtureChannel.index es 1-based
            defaultValue: ch.defaultValue ?? (kinetic && (ch.type === 'pan' || ch.type === 'tilt') ? 128 : 0),
            is16bit: ch.is16bit ?? false,
            customName: ch.customName,
        }));
    }
    _detectMixingType(channels) {
        const t = new Set(channels.map(ch => ch.type));
        if (t.has('cyan') && t.has('magenta') && t.has('yellow'))
            return 'cmy';
        if (t.has('color_wheel'))
            return 'wheel';
        const rgb = t.has('red') && t.has('green') && t.has('blue');
        if (rgb && (t.has('white') || t.has('amber')))
            return 'rgbw';
        if (rgb)
            return 'rgb';
        return 'rgb';
    }
    _buildColorWheelDef(fixtureDef) {
        const wh = fixtureDef.capabilities?.colorWheel;
        if (!wh)
            return undefined;
        return {
            name: fixtureDef.name + ' Color Wheel',
            slots: wh.colors.map(c => ({
                name: c.name,
                dmxValue: c.dmx,
                previewRgb: c.rgb,
            })),
            minTransitionMs: wh.minChangeTimeMs ?? 200,
        };
    }
    _mapMotorType(legacyMotor) {
        switch (legacyMotor) {
            case 'servo':
            case 'servo-pro': return 'servo';
            // 'galvo' no existe en legacy — stepper es el fallback correcto
            case 'stepper':
            case 'stepper-pro':
            default: return 'stepper';
        }
    }
    _mapAtmosphereType(fixtureType) {
        switch (fixtureType) {
            case 'fan': return 'fan';
            case 'fog': return 'fog';
            case 'pyro': return 'pyro';
            default: return 'custom';
        }
    }
}
