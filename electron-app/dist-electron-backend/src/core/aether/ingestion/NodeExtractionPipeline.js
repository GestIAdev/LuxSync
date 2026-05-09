/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 AETHER MATRIX — NODE EXTRACTION PIPELINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3507: THE SPATIAL GENESIS (F1)
 * WAVE 3517.1: THE FORGE UPGRADE — Soporte completo para 5 familias,
 *              inyección espacial desde FixtureV2, y firma dual de extract().
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
 * REGLA DE ORO (Zero Functionality Loss):
 * - FixtureDefinition legacy permanece intacto en store/disco.
 * - Este pipeline es un traductor UNIDIRECCIONAL: legacy → Aether.
 * - La Forja sigue trabajando con FixtureDefinition; el NodeGraph
 *   trabaja con IDeviceDefinition. No hay mutación cruzada.
 *
 * ALGORITMO DE DESCOMPOSICIÓN:
 *   1. Analiza los canales (FixtureChannel[]) del perfil legacy.
 *   2. Detecta la topología: single-emitter, multi-emitter (fan),
 *      o hybrid (mover con color mixing).
 *   3. Agrupa canales por familia semántica (COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE).
 *   4. Para aparatos multi-emitter (fans): cada pétalo recibe su propio
 *      COLOR_NODE con offsets DMX calculados.
 *   5. Inyecta Position3D desde FixtureV2 en todos los nodos.
 *   6. Fusiona calibración de physics + calibración de show (FixtureV2.calibration).
 *   7. Retorna IDeviceDefinition lista para NodeGraph.registerDevice().
 *
 * @module core/aether/ingestion/NodeExtractionPipeline
 * @version WAVE 3517.1
 */
import { NodeFamily } from '../types';
import { normalizeZoneId } from '../adapters/zoneUtils';
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
    'focus', 'zoom', 'frost',
]);
// WAVE 3517.1: ATMOSPHERE incluye custom/macro/control (canales de máquinas de efecto).
// La detección semántica se refuerza con el fixture.type en _analyzeTopology().
const ATMOSPHERE_CHANNEL_TYPES = new Set([
    'control', 'macro', 'custom',
]);
// Fixture types que por definición producen un ATMOSPHERE node aunque sus
// canales sean 'custom' (fog output, haze pump, spark ignition, etc.).
const ATMOSPHERE_FIXTURE_TYPES = new Set([
    'fog', 'fan', 'pyro', 'laser',
]);
// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT & CURVE DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════
const IMPACT_TRANSFER_CURVE = {
    type: 'linear',
    noiseGate: 0.0,
};
const IMPACT_BAND_MIX = {
    subBass: 0.80,
    bass: 0.60,
    mid: 0.20,
    highMid: 0.10,
    presence: 0.05,
    air: 0.0,
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
const CHANNEL_PRIORITY_BY_TYPE = Object.freeze({
    pan: 90,
    pan_fine: 89,
    tilt: 88,
    tilt_fine: 87,
    rotation: 86,
    speed: 85,
    dimmer: 80,
    shutter: 79,
    strobe: 78,
    color_wheel: 70,
    gobo: 69,
    gobo_rotation: 68,
    prism: 67,
    prism_rotation: 66,
    focus: 65,
    zoom: 64,
    frost: 63,
    red: 50,
    green: 49,
    blue: 48,
    white: 47,
    amber: 46,
    uv: 45,
    cyan: 44,
    magenta: 43,
    yellow: 42,
    control: 20,
    macro: 19,
    custom: 18,
    unknown: 0,
});
const FAMILY_PRIORITY = Object.freeze({
    [NodeFamily.KINETIC]: 5,
    [NodeFamily.IMPACT]: 4,
    [NodeFamily.BEAM]: 3,
    [NodeFamily.COLOR]: 2,
    [NodeFamily.ATMOSPHERE]: 1,
});
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
    /**
     * Convierte zonas mono front/back a sub-zonas estéreo cuando hay posición X.
     * Esto evita colapsar intensidades L/R en adapters que promedian zonas compuestas.
     */
    _resolveStereoAwareZone(zoneRaw, position) {
        const normalized = normalizeZoneId(zoneRaw);
        const x = position?.x;
        if ((normalized === 'front' || normalized === 'back') && typeof x === 'number' && !Number.isNaN(x)) {
            if (x < -0.1) {
                return (normalized === 'front' ? 'front-left' : 'back-left');
            }
            if (x > 0.1) {
                return (normalized === 'front' ? 'front-right' : 'back-right');
            }
        }
        return normalized;
    }
    // Implementación unificada
    extract(fixtureDef, dmxAddressOrFixtureV2, universe, zoneId, deviceIdOverride) {
        // ── Despacho de firma ────────────────────────────────────────────────
        let resolvedAddress;
        let resolvedUniverse;
        let resolvedZone;
        let resolvedDeviceId;
        let resolvedPosition;
        let v2CalibOverride;
        let isVirtual;
        let resolvedOrientation;
        let resolvedIsPlaced;
        if (typeof dmxAddressOrFixtureV2 === 'object') {
            // ── Firma FixtureV2 (WAVE 3517.1 — recomendada) ──────────────────
            const fv2 = dmxAddressOrFixtureV2;
            const legacyFv2 = fv2;
            resolvedAddress = fv2.address;
            resolvedUniverse = fv2.universe;
            resolvedZone = this._resolveStereoAwareZone(fv2.zone, fv2.position);
            resolvedDeviceId = fv2.id;
            resolvedPosition = fv2.position;
            v2CalibOverride = fv2.calibration;
            isVirtual = fv2.isVirtual;
            // 🧭 WAVE 4573: orientación canónica en root. Compat legacy:
            // installationType (v1/v2 temprano) y physics.orientation (deprecated).
            resolvedOrientation = fv2.orientation
                ?? legacyFv2.installationType
                ?? legacyFv2.physics?.orientation;
            resolvedIsPlaced = fv2.isPlaced;
        }
        else {
            // ── Firma legacy (compatibilidad) ─────────────────────────────────
            resolvedAddress = dmxAddressOrFixtureV2;
            resolvedUniverse = universe;
            resolvedZone = normalizeZoneId(zoneId);
            resolvedDeviceId = deviceIdOverride ?? fixtureDef.id;
            resolvedPosition = undefined;
            v2CalibOverride = undefined;
            isVirtual = undefined;
            resolvedOrientation = undefined;
            resolvedIsPlaced = undefined;
        }
        const topology = this._analyzeTopology(fixtureDef);
        const nodes = this._sanitizeOverlappingChannels(resolvedDeviceId, fixtureDef.name === 'Tungsten'
            ? this._buildTungstenBypassNodes(resolvedDeviceId, fixtureDef, resolvedPosition)
            : this._buildAllNodes(resolvedDeviceId, resolvedZone, fixtureDef, topology, resolvedPosition));
        const calibration = this._buildCalibration(fixtureDef, v2CalibOverride);
        return {
            deviceId: resolvedDeviceId,
            name: fixtureDef.name,
            type: fixtureDef.type,
            dmxAddress: resolvedAddress,
            universe: resolvedUniverse,
            channelCount: fixtureDef.channels.length,
            nodes: Object.freeze(nodes),
            calibration,
            ...(isVirtual !== undefined && { isVirtual }),
            ...(resolvedOrientation !== undefined && { orientation: resolvedOrientation }),
            ...(resolvedIsPlaced !== undefined && { isPlaced: resolvedIsPlaced }),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1 — TOPOLOGY ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    _analyzeTopology(fixtureDef) {
        const chs = fixtureDef.channels;
        const isAtmosphereFixture = ATMOSPHERE_FIXTURE_TYPES.has(fixtureDef.type);
        // WAVE 3517.1: Para fixtures de atmósfera, los canales 'custom' son
        // el medio principal de control (fog output, fan speed, spark output…).
        // Un fixture de tipo 'fog' con un canal 'custom' llamado "Fog Output"
        // debe producir un ATMOSPHERE node, no caer en el void.
        // Para el resto de fixtures, 'custom' sigue siendo atmósfera si existe.
        const colorChs = chs.filter(ch => COLOR_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)));
        const impactChs = chs.filter(ch => IMPACT_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)));
        const kineticChs = chs.filter(ch => KINETIC_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)));
        const beamChs = chs.filter(ch => BEAM_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)));
        // Para fixtures de atmósfera: todos los canales no capturados por las
        // otras familias se convierten en ATMOSPHERE channels.
        // Para el resto: solo los tipos explícitamente en ATMOSPHERE_CHANNEL_TYPES.
        const classifiedTypes = new Set([
            ...COLOR_CHANNEL_TYPES,
            ...IMPACT_CHANNEL_TYPES,
            ...KINETIC_CHANNEL_TYPES,
            ...BEAM_CHANNEL_TYPES,
        ]);
        const atmosphereChs = isAtmosphereFixture
            ? chs.filter(ch => !classifiedTypes.has(this._normalizeChannelType(ch.type)) || ATMOSPHERE_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))
            : chs.filter(ch => ATMOSPHERE_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)));
        // Para fans multi-emitter: detectar grupos de color por pétalo.
        // Para el resto: un único grupo de color si hay canales de color.
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
    // [INYECCIÓN WAVE 4683] - BYPASS TUNGSTEN (Zonas independientes para LiquidEngine)
    _buildTungstenBypassNodes(deviceId, fixtureDef, position) {
        const mkChannel = (dmxOffset, type, defaultValue, fallbackName) => {
            const source = fixtureDef.channels.find(ch => (ch.index - 1) === dmxOffset);
            return {
                index: dmxOffset + 1,
                name: source?.name ?? fallbackName,
                type: type,
                defaultValue: defaultValue,
                is16bit: source?.is16bit ?? false,
                ...(source?.customName !== undefined && { customName: source.customName }),
            };
        };
        // [INYECCIÓN WAVE 4683.4] - BYPASS TUNGSTEN (KILL PAN + COLOR SELENE)
        // 1a. PAN KILL: canal 'custom' clavado en 127 — el VMM lo ignora (ciego).
        //     Sigue siendo un ATMOSPHERE node para que el resolver no lo mueva.
        const tungstenPanKillChannels = [
            mkChannel(0, 'custom', 127, 'Pan Kill'),
        ];
        // 1b. ROTOR SPIN: canal de rotación continua (bipolar: 0=izq, 127=stop, 255=dcha).
        //     🌊 WAVE 4699.2 M1: tipado como 'rotation' → _buildKineticNode detecta
        //     isContinuous=true (hasRotation && !hasPanTilt) → KINETIC family.
        const tungstenRotorChannels = [
            mkChannel(1, 'rotation', 127, 'Rotor Spin'),
        ];
        // 2. WASH: Baño RGB -> IMPACT/front para dimmer, COLOR para RGB
        const tungstenWashChannels = [
            mkChannel(7, 'dimmer', 0, 'Staining Dim'),
        ];
        const tungstenWashColorChannels = [
            mkChannel(9, 'red', 0, 'Wash Red'),
            mkChannel(10, 'green', 0, 'Wash Green'),
            mkChannel(11, 'blue', 0, 'Wash Blue'),
        ];
        // 3. BEAM: Cañón RGBW -> COLOR (no hay dimmer en beam)
        const tungstenBeamColorChannels = [
            mkChannel(12, 'red', 0, 'Red'),
            mkChannel(13, 'green', 0, 'Green'),
            mkChannel(14, 'blue', 0, 'Blue'),
            mkChannel(15, 'white', 0, 'White'),
        ];
        // 4. LOS 3 DORADOS: dormidos en flash hasta el PAD MIDI
        const tungstenPetalLeftChannels = [
            mkChannel(4, 'dimmer', 0, 'Petal Left Dimmer'),
        ];
        const tungstenPetalCenterChannels = [
            mkChannel(5, 'dimmer', 0, 'Petal Center Dimmer'),
        ];
        const tungstenPetalRightChannels = [
            mkChannel(6, 'dimmer', 0, 'Petal Right Dimmer'),
        ];
        // 5. MASTER GOLDEN + STROBE: botón Nuke
        const tungstenGoldenMasterChannels = [
            mkChannel(2, 'dimmer', 0, 'Golden Master Dimmer'),
            mkChannel(3, 'strobe', 0, 'Golden Strobe'),
        ];
        const impactNode = (nodeSuffix, zoneId, channels) => ({
            nodeId: `${deviceId}:${nodeSuffix}`,
            family: NodeFamily.IMPACT,
            deviceId,
            zoneId,
            role: channels.some(ch => this._normalizeChannelType(ch.type) === 'dimmer') ? 'primary' : 'percussion',
            channels: this._mapChannels(channels),
            constraints: IMPACT_CONSTRAINTS,
            transferCurve: IMPACT_TRANSFER_CURVE,
            bandMix: IMPACT_BAND_MIX,
            envelopeState: IMPACT_ENVELOPE_INIT,
            state: new Float64Array(4),
            ...(position !== undefined && { position }),
        });
        return [
            this._buildAtmosphereNode(deviceId, normalizeZoneId('unassigned'), fixtureDef, tungstenPanKillChannels, position),
            // 🌊 WAVE 4699.2 M1: KINETIC node de giro continuo.
            // isContinuous=true → AetherUIProjector proyecta fixture.rotation.
            // Control bipolar: rotation=0.5 (norm) → DMX 127 (parado).
            this._buildKineticNode(deviceId, normalizeZoneId('unassigned'), fixtureDef, tungstenRotorChannels, position),
            impactNode('wash', normalizeZoneId('ambient'), tungstenWashChannels),
            this._buildColorNode(deviceId, normalizeZoneId('ambient'), fixtureDef, { emitterIndex: 0, labelSuffix: 'wash-color', channels: tungstenWashColorChannels }, position),
            this._buildColorNode(deviceId, normalizeZoneId('air'), fixtureDef, { emitterIndex: 0, labelSuffix: 'beam-color', channels: tungstenBeamColorChannels }, position),
            impactNode('petal-l', normalizeZoneId('flash'), tungstenPetalLeftChannels),
            impactNode('petal-c', normalizeZoneId('flash'), tungstenPetalCenterChannels),
            impactNode('petal-r', normalizeZoneId('flash'), tungstenPetalRightChannels),
            impactNode('golden-master', normalizeZoneId('flash'), tungstenGoldenMasterChannels),
        ];
    }
    _buildAllNodes(deviceId, zoneId, fixtureDef, topology, position) {
        const nodes = [];
        for (const group of topology.colorGroups) {
            nodes.push(this._buildColorNode(deviceId, zoneId, fixtureDef, group, position));
        }
        if (topology.impactChannels.length > 0) {
            nodes.push(this._buildImpactNode(deviceId, zoneId, topology.impactChannels, position));
        }
        if (topology.kineticChannels.length > 0) {
            nodes.push(this._buildKineticNode(deviceId, zoneId, fixtureDef, topology.kineticChannels, position));
        }
        if (topology.beamChannels.length > 0) {
            nodes.push(this._buildBeamNode(deviceId, zoneId, topology.beamChannels, position));
        }
        if (topology.atmosphereChannels.length > 0) {
            nodes.push(this._buildAtmosphereNode(deviceId, zoneId, fixtureDef, topology.atmosphereChannels, position));
        }
        return nodes;
    }
    _sanitizeOverlappingChannels(deviceId, nodes) {
        const byOffset = new Map();
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];
            for (let channelIndex = 0; channelIndex < node.channels.length; channelIndex++) {
                const channel = node.channels[channelIndex];
                const score = this._getChannelPriority(node.family, channel.type);
                const list = byOffset.get(channel.dmxOffset);
                const candidate = { node, nodeIndex, channel, score };
                if (list) {
                    list.push(candidate);
                }
                else {
                    byOffset.set(channel.dmxOffset, [candidate]);
                }
            }
        }
        const winners = new Map();
        const collisionLogs = [];
        for (const [offset, candidates] of byOffset) {
            let winner = candidates[0];
            for (let i = 1; i < candidates.length; i++) {
                const current = candidates[i];
                if (current.score > winner.score ||
                    (current.score === winner.score && current.nodeIndex > winner.nodeIndex)) {
                    winner = current;
                }
            }
            winners.set(offset, winner);
            if (candidates.length > 1) {
                collisionLogs.push(`offset=${offset} winner=${String(winner.node.nodeId)}:${winner.channel.type} ` +
                    `candidates=${candidates.map(candidate => `${String(candidate.node.nodeId)}:${candidate.channel.type}`).join(',')}`);
            }
        }
        if (collisionLogs.length > 0) {
            console.warn(`[NodeExtractionPipeline] ⚠️ DMX offset collision sanitized for ${String(deviceId)} | ${collisionLogs.join(' | ')}`);
        }
        const sanitized = nodes
            .map(node => {
            const nextChannels = node.channels.filter(channel => winners.get(channel.dmxOffset)?.channel === channel);
            return { ...node, channels: nextChannels };
        })
            .filter(node => node.channels.length > 0);
        return sanitized;
    }
    _getChannelPriority(family, channelType) {
        const typePriority = CHANNEL_PRIORITY_BY_TYPE[channelType] ?? 0;
        const familyPriority = FAMILY_PRIORITY[family] ?? 0;
        return typePriority * 10 + familyPriority;
    }
    // ── COLOR NODE ────────────────────────────────────────────────────────────
    _buildColorNode(deviceId, zoneId, fixtureDef, group, position) {
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
            ...(position !== undefined && { position }),
        };
    }
    // ── IMPACT NODE ───────────────────────────────────────────────────────────
    _buildImpactNode(deviceId, zoneId, impactChs, position) {
        const nodeId = `${deviceId}:impact`;
        // Blueprint 3506 §1.5: dimmer → role 'primary'; shutter/strobe → role 'percussion'.
        // Si hay dimmer, el nodo principal es de dimmer (primary).
        // Si solo hay shutter o strobe (sin dimmer), el rol es 'percussion'.
        const hasDimmer = impactChs.some(ch => this._normalizeChannelType(ch.type) === 'dimmer');
        return {
            nodeId,
            family: NodeFamily.IMPACT,
            deviceId,
            zoneId,
            role: hasDimmer ? 'primary' : 'percussion',
            channels: this._mapChannels(impactChs),
            constraints: IMPACT_CONSTRAINTS,
            transferCurve: IMPACT_TRANSFER_CURVE,
            bandMix: IMPACT_BAND_MIX,
            envelopeState: IMPACT_ENVELOPE_INIT,
            state: new Float64Array(4),
            ...(position !== undefined && { position }),
        };
    }
    // ── KINETIC NODE ──────────────────────────────────────────────────────────
    _buildKineticNode(deviceId, zoneId, fixtureDef, kineticChs, position) {
        const nodeId = `${deviceId}:kinetic`;
        const motorType = this._mapMotorType(fixtureDef.physics?.motorType);
        const maxSpeed = fixtureDef.physics?.maxVelocity ?? 540;
        // Heurística: si no hay pan/tilt pero sí rotation → rotación continua (fan, pétalo)
        const hasPanTilt = kineticChs.some(ch => ch.type === 'pan' || ch.type === 'tilt');
        const hasRotation = kineticChs.some(ch => ch.type === 'rotation');
        const isContinuous = !hasPanTilt && hasRotation;
        return {
            nodeId,
            family: NodeFamily.KINETIC,
            deviceId,
            zoneId,
            role: isContinuous ? 'percussion' : 'primary',
            channels: this._mapChannels(kineticChs, true),
            constraints: { ...KINETIC_CONSTRAINTS_BASE, maxSpeed },
            motorType,
            isContinuous,
            maxPanSpeed: isContinuous ? 0 : maxSpeed,
            maxTiltSpeed: isContinuous ? 0 : maxSpeed,
            maxRotationSpeed: isContinuous ? maxSpeed : undefined,
            currentPosition: isContinuous
                ? { pan: 0, tilt: 0, rotation: 0.5 }
                : { pan: 0.5, tilt: 0.5 },
            physicalPosition: position ?? NEUTRAL_POSITION,
            stereoIndex: 0,
            stereoTotal: 1,
            state: new Float64Array(4),
            ...(position !== undefined && { position }),
        };
    }
    // ── BEAM NODE ─────────────────────────────────────────────────────────────
    _buildBeamNode(deviceId, zoneId, beamChs, position) {
        const nodeId = `${deviceId}:beam`;
        const types = new Set(beamChs.map(ch => ch.type));
        // Blueprint 3506 §1.5: zoom/focus/iris → role 'primary'; gobo/prism → role 'decoration'.
        // Si hay zoom, focus o iris, el nodo es primario (conformación del haz).
        // Si solo hay gobos/prism, es decoración pura.
        const hasBeamShaping = types.has('zoom') || types.has('focus');
        return {
            nodeId,
            family: NodeFamily.BEAM,
            deviceId,
            zoneId,
            role: hasBeamShaping ? 'primary' : 'decoration',
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
            ...(position !== undefined && { position }),
        };
    }
    // ── ATMOSPHERE NODE ───────────────────────────────────────────────────────
    _buildAtmosphereNode(deviceId, zoneId, fixtureDef, atmosphereChs, position) {
        const nodeId = `${deviceId}:atmosphere`;
        // WAVE 3517.1: Detectar role semántico por tipo de fixture.
        // fog/haze → 'ambient' (rellena el espacio continuamente)
        // pyro/laser/spark → 'atmosphere' (efecto puntual dramático)
        // fan → 'ambient' (movimiento de aire continuo)
        const atmosType = this._mapAtmosphereType(fixtureDef.type);
        const role = (atmosType === 'fog' || atmosType === 'haze' || atmosType === 'fan')
            ? 'ambient'
            : 'atmosphere';
        return {
            nodeId,
            family: NodeFamily.ATMOSPHERE,
            deviceId,
            zoneId,
            role,
            channels: this._mapChannels(atmosphereChs),
            constraints: ATMOSPHERE_CONSTRAINTS,
            atmosType,
            safety: ATMOSPHERE_SAFETY_INIT,
            state: new Float64Array(4),
            ...(position !== undefined && { position }),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3 — CALIBRATION EXTRACTION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Construye IDeviceCalibration fusionando dos fuentes:
     * 1. FixtureDefinition.physics   — datos de la Forja (fixture library)
     * 2. FixtureV2.calibration       — datos del show (CalibrationLab override)
     *
     * Los datos del show (FixtureV2) tienen PRECEDENCIA sobre los de la Forja.
     * Esta es la decisión correcta: el operador que ajusta en vivo sabe más
     * que el perfil genérico de la librería.
     */
    _buildCalibration(fixtureDef, v2Calibration) {
        const p = fixtureDef.physics;
        // ── Datos de base (Forja / physics profile) ──────────────────────────
        // 🌊 WAVE 4684: homePosition (pan/tilt DMX 0-255) NUNCA se mapea a panOffset/tiltOffset.
        // panOffset y tiltOffset son ángulos en GRADOS para el IK engine.
        // Mapear homePosition.pan=127 como tiltOffset=127° provocaría que el fixture
        // apuntara 127° fuera del vertical en reposo — el bug de "mirando al frente".
        const fromPhysics = {
            ...(p?.invertPan !== undefined && { invertPan: p.invertPan }),
            ...(p?.invertTilt !== undefined && { invertTilt: p.invertTilt }),
            ...(p?.tiltLimits?.min !== undefined && { tiltLimitMin: p.tiltLimits.min }),
            ...(p?.tiltLimits?.max !== undefined && { tiltLimitMax: p.tiltLimits.max }),
        };
        // ── Override del show (FixtureV2.calibration — CalibrationLab) ───────
        // Los valores del show reemplazan a los del physics cuando están presentes.
        if (v2Calibration) {
            const merged = {
                ...fromPhysics,
                invertPan: v2Calibration.panInvert ?? fromPhysics.invertPan,
                invertTilt: v2Calibration.tiltInvert ?? fromPhysics.invertTilt,
                panOffset: v2Calibration.panOffset ?? fromPhysics.panOffset,
                tiltOffset: v2Calibration.tiltOffset ?? fromPhysics.tiltOffset,
            };
            return Object.keys(merged).length > 0 ? merged : undefined;
        }
        return Object.keys(fromPhysics).length > 0 ? fromPhysics : undefined;
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
            type: this._normalizeChannelType(ch.type),
            dmxOffset: ch.index - 1, // FixtureChannel.index es 1-based
            defaultValue: ch.defaultValue ?? (kinetic && (this._normalizeChannelType(ch.type) === 'pan' || this._normalizeChannelType(ch.type) === 'tilt') ? 128 :
                (this._normalizeChannelType(ch.type) === 'shutter' || this._normalizeChannelType(ch.type) === 'strobe') ? 255 :
                    0),
            is16bit: ch.is16bit ?? false,
            customName: ch.customName,
        }));
    }
    _normalizeChannelType(type) {
        return typeof type === 'string' ? type.toLowerCase() : 'unknown';
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
            case 'laser': return 'spark';
            default: return 'custom';
        }
    }
}
