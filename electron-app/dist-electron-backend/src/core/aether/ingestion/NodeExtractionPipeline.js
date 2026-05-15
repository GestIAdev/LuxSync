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
    'focus', 'zoom', 'frost',
]);
// WAVE 4708: canales mecánicos/legacy cuarentenados.
// NO se exponen a familias automáticas de IA (BEAM/ATMOSPHERE adapter loop).
// Se enrutan en nodo :atmosphere para control explícito L2/L3 (Extras).
// CLEAN CABIN: ampliado con sound_active y auto.
// Pares LED baratos tienen canales auto-program que el LiquidEngine excita
// sin querer. Cuarentena total: defaultValue=0 forzado en build.
const QUARANTINED_MECHANICAL_CHANNEL_TYPES = new Set([
    'gobo',
    'gobo_rotation',
    'prism',
    'prism_rotation',
    'macro',
    'effect',
    'sound_active',
    'auto',
]);
// WAVE 3517.1: ATMOSPHERE incluye custom/macro/control (canales de máquinas de efecto).
// La detección semántica se refuerza con el fixture.type en _analyzeTopology().
const ATMOSPHERE_CHANNEL_TYPES = new Set([
    'control', 'custom',
    ...QUARANTINED_MECHANICAL_CHANNEL_TYPES,
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
    effect: 19,
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
        const fixtureGraph = fixtureDef.nodeGraph;
        const hasForgeGraph = fixtureGraph && fixtureGraph.nodes.length > 0;
        if (hasForgeGraph) {
            console.log(`[NodeExtractionPipeline] 🔧 WAVE 4735.7: V2 path — _buildNodesFromForgeGraph for ${String(resolvedDeviceId)} with ${fixtureGraph.nodes.length} output_dmx nodes`);
        }
        const nodes = hasForgeGraph
            ? this._buildNodesFromForgeGraph(resolvedDeviceId, resolvedZone, fixtureDef, fixtureGraph, resolvedPosition)
            : this._sanitizeOverlappingChannels(resolvedDeviceId, this._buildAllNodes(resolvedDeviceId, resolvedZone, fixtureDef, topology, resolvedPosition));
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
    // ── FORGE GRAPH PATH (WAVE 4722) ─────────────────────────────────────────
    /**
     * Construye ICapabilityNode[] desde un IForgeNodeGraph.
     * Lee los output_dmx nodes, los agrupa por aetherNodeId, y produce
     * los nodos Aether correctos con node IDs específicos y zonas declaradas.
     *
     * Esta ruta es la ÚNICA fuente de verdad cuando nodeGraph está presente.
     * Reemplaza _buildAllNodes para fixtures con topología multi-cell
     * (e.g. Tungsten: kinetic + golden-master + petal-l/c/r + wash + wash-color + beam-color).
     */
    _buildNodesFromForgeGraph(deviceId, fallbackZone, fixtureDef, graph, position) {
        const outputNodes = graph.nodes.filter((n) => n.type === 'output_dmx' && n.config.nodeType === 'output_dmx');
        if (outputNodes.length === 0)
            return [];
        const groups = new Map();
        for (const n of outputNodes) {
            const cfg = n.config;
            const suffix = cfg.aetherNodeId ?? this._inferAetherSuffix(cfg.channelType);
            const zone = cfg.aetherZone
                ? normalizeZoneId(cfg.aetherZone)
                : fallbackZone;
            const group = groups.get(suffix);
            if (group) {
                group.nodes.push(n);
                // WAVE 4743.2: profileMeta.customLabel (cell label set in Forge) tiene prioridad
                // sobre n.label que es un label genérico de canal (p.ej. "CH1: dimmer").
                if (!group.customLabel && n.profileMeta?.customLabel) {
                    group.customLabel = n.profileMeta.customLabel;
                }
            }
            else {
                // profileMeta.customLabel = nombre de célula user-defined; n.label = "CH1: dimmer" genérico.
                groups.set(suffix, { zone, nodes: [n], customLabel: n.profileMeta?.customLabel ?? undefined });
            }
        }
        // 3. Construir un ICapabilityNode por grupo
        const nodes = [];
        for (const [suffix, group] of groups) {
            const nodeId = `${deviceId}:${suffix}`;
            const channels = this._mapForgeNodes(group.nodes.map(n => n.config));
            const typeSet = new Set(group.nodes.map(n => this._normalizeChannelType(n.config.channelType)));
            const node = this._buildForgeGroupNode(nodeId, group.zone, fixtureDef, channels, typeSet, position);
            if (node) {
                // WAVE 4738: inyectar label custom en profileMeta → sobrevive roundtrip JSON.
                nodes.push(group.customLabel
                    ? ({ ...node, profileMeta: { ...node.profileMeta, customLabel: group.customLabel } })
                    : node);
            }
        }
        return nodes;
    }
    /**
     * Convierte IOutputDmxConfig[] → INodeChannelDef[].
     * A diferencia de _mapChannels, usa cfg.dmxOffset DIRECTAMENTE (0-based),
     * sin la corrección -1 que asume índices 1-based legacy.
     */
    _mapForgeNodes(configs) {
        return configs.map(cfg => {
            const mapped = {
                type: this._normalizeChannelType(cfg.channelType),
                dmxOffset: cfg.dmxOffset,
                defaultValue: cfg.defaultDmxValue,
                is16bit: cfg.is16bit ?? false,
                customName: cfg.channelName,
                ...(cfg.ignitionDeps && cfg.ignitionDeps.length > 0 && {
                    ignitionDeps: cfg.ignitionDeps.map(dep => ({
                        targetChannelType: this._normalizeChannelType(dep.channelType),
                        requiredValue: dep.requiredValue,
                        mode: dep.mode ?? 'hold',
                        ...(dep.targetChannelIndex !== undefined && { targetDmxOffset: dep.targetChannelIndex }),
                    })),
                }),
            };
            return mapped;
        });
    }
    /**
     * Infiere el sufijo de nodo Aether para canales sin aetherNodeId declarado.
     * Solo como fallback — los fixtures bien declarados tienen aetherNodeId.
     */
    _inferAetherSuffix(channelType) {
        const norm = this._normalizeChannelType(channelType);
        if (COLOR_CHANNEL_TYPES.has(norm))
            return 'color';
        if (IMPACT_CHANNEL_TYPES.has(norm))
            return 'impact';
        if (KINETIC_CHANNEL_TYPES.has(norm))
            return 'kinetic';
        if (BEAM_CHANNEL_TYPES.has(norm))
            return 'beam';
        return 'atmosphere';
    }
    /**
     * Construye el ICapabilityNode correcto según los tipos de canal del grupo.
     * Motor de decisión: familia determinada por mayoría de tipos presentes.
     */
    _buildForgeGroupNode(nodeId, zoneId, fixtureDef, channels, typeSet, position) {
        const deviceId = nodeId.split(':')[0];
        // COLOR: hay al menos un canal de mezcla cromática.
        // WAVE 4737 WASH FIX: grupos mixtos (color + dimmer) también van a COLOR.
        // El ColorBody ya tiene InlineImpactRow para gestionar el dimmer interno.
        const hasColorChannels = [...typeSet].some(t => COLOR_CHANNEL_TYPES.has(t));
        if (hasColorChannels) {
            const mixingType = this._detectMixingTypeFromSet(typeSet);
            const colorWheel = this._buildColorWheelDef(fixtureDef);
            return {
                nodeId,
                family: NodeFamily.COLOR,
                deviceId,
                zoneId,
                role: 'primary',
                channels,
                constraints: COLOR_CONSTRAINTS,
                mixingType,
                colorWheel,
                currentColor: { r: 0, g: 0, b: 0 },
                state: new Float64Array(4),
                ...(position !== undefined && { position }),
            };
        }
        // IMPACT: hay al menos un canal de impacto (dimmer/strobe/shutter)
        if ([...typeSet].some(t => IMPACT_CHANNEL_TYPES.has(t))) {
            const hasDimmer = typeSet.has('dimmer');
            return {
                nodeId,
                family: NodeFamily.IMPACT,
                deviceId,
                zoneId,
                role: hasDimmer ? 'primary' : 'percussion',
                channels,
                constraints: IMPACT_CONSTRAINTS,
                transferCurve: IMPACT_TRANSFER_CURVE,
                bandMix: IMPACT_BAND_MIX,
                envelopeState: IMPACT_ENVELOPE_INIT,
                state: new Float64Array(4),
                ...(position !== undefined && { position }),
            };
        }
        // KINETIC: hay al menos un canal cinético
        if ([...typeSet].some(t => KINETIC_CHANNEL_TYPES.has(t))) {
            const hasPanTilt = typeSet.has('pan') || typeSet.has('tilt');
            const hasRotation = typeSet.has('rotation');
            const isContinuous = !hasPanTilt && hasRotation;
            const motorType = this._mapMotorType(fixtureDef.physics?.motorType);
            const maxSpeed = fixtureDef.physics?.maxVelocity ?? 540;
            // WAVE 4814: respetar defaultValue del JSON para posición home de rotación.
            const rotCh = channels.find(c => c.type === 'rotation');
            const rotationHome = rotCh && typeof rotCh.defaultValue === 'number'
                ? rotCh.defaultValue / 255
                : 0.5;
            return {
                nodeId,
                family: NodeFamily.KINETIC,
                deviceId,
                zoneId,
                role: isContinuous ? 'percussion' : 'primary',
                channels,
                constraints: { ...KINETIC_CONSTRAINTS_BASE, maxSpeed },
                motorType,
                isContinuous,
                maxPanSpeed: isContinuous ? 0 : maxSpeed,
                maxTiltSpeed: isContinuous ? 0 : maxSpeed,
                maxRotationSpeed: isContinuous ? maxSpeed : undefined,
                currentPosition: isContinuous
                    ? { pan: 0, tilt: 0, rotation: rotationHome }
                    : { pan: 0.5, tilt: 0.5 },
                physicalPosition: position ?? NEUTRAL_POSITION,
                stereoIndex: 0,
                stereoTotal: 1,
                state: new Float64Array(4),
                ...(position !== undefined && { position }),
            };
        }
        // BEAM: has beam-shaping channels
        if ([...typeSet].some(t => BEAM_CHANNEL_TYPES.has(t))) {
            const hasBeamShaping = typeSet.has('zoom') || typeSet.has('focus');
            return {
                nodeId,
                family: NodeFamily.BEAM,
                deviceId,
                zoneId,
                role: hasBeamShaping ? 'primary' : 'decoration',
                channels,
                constraints: BEAM_CONSTRAINTS,
                hasGobo: typeSet.has('gobo'),
                hasGoboRotation: typeSet.has('gobo_rotation'),
                hasPrism: typeSet.has('prism'),
                hasPrismRotation: typeSet.has('prism_rotation'),
                hasFrost: typeSet.has('frost'),
                hasZoom: typeSet.has('zoom'),
                hasFocus: typeSet.has('focus'),
                state: new Float64Array(4),
                ...(position !== undefined && { position }),
            };
        }
        // Default: ATMOSPHERE (custom, control, macros, etc.)
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
            channels,
            constraints: ATMOSPHERE_CONSTRAINTS,
            atmosType,
            safety: ATMOSPHERE_SAFETY_INIT,
            state: new Float64Array(4),
            ...(position !== undefined && { position }),
        };
    }
    /** Detecta el tipo de mezcla de color desde un Set<string> de tipos normalizados. */
    _detectMixingTypeFromSet(typeSet) {
        if (typeSet.has('cyan') && typeSet.has('magenta') && typeSet.has('yellow'))
            return 'cmy';
        if (typeSet.has('color_wheel'))
            return 'wheel';
        const rgb = typeSet.has('red') && typeSet.has('green') && typeSet.has('blue');
        if (rgb && (typeSet.has('white') || typeSet.has('amber')))
            return 'rgbw';
        if (rgb)
            return 'rgb';
        return 'rgb';
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
        const channels = this._mapChannels(kineticChs, true);
        // WAVE 4814: respetar defaultValue del JSON para posición home de rotación.
        const rotCh = channels.find(c => c.type === 'rotation');
        const rotationHome = rotCh && typeof rotCh.defaultValue === 'number'
            ? rotCh.defaultValue / 255
            : 0.5;
        return {
            nodeId,
            family: NodeFamily.KINETIC,
            deviceId,
            zoneId,
            role: isContinuous ? 'percussion' : 'primary',
            channels,
            constraints: { ...KINETIC_CONSTRAINTS_BASE, maxSpeed },
            motorType,
            isContinuous,
            maxPanSpeed: isContinuous ? 0 : maxSpeed,
            maxTiltSpeed: isContinuous ? 0 : maxSpeed,
            maxRotationSpeed: isContinuous ? maxSpeed : undefined,
            currentPosition: isContinuous
                ? { pan: 0, tilt: 0, rotation: rotationHome }
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
        return channels.map(ch => {
            const mapped = {
                type: this._normalizeChannelType(ch.type),
                // 🔧 WAVE 4735.7: FixtureChannel.index is 1-based (DMX channel 1,2,3...).
                // dmxOffset must be 0-based (offset within fixture).
                dmxOffset: ch.index - 1,
                defaultValue: this._resolveDefaultValue(ch, kinetic),
                is16bit: ch.is16bit ?? false,
                customName: ch.customName,
                // 🔥 WAVE 4720: Propagar ignitionDeps al dominio Aether para pre-cómputo
                ...(ch.ignitionDeps && ch.ignitionDeps.length > 0 && {
                    ignitionDeps: ch.ignitionDeps.map(dep => ({
                        targetChannelType: this._normalizeChannelType(dep.channelType),
                        requiredValue: dep.requiredValue,
                        mode: dep.mode ?? 'hold',
                        ...(dep.targetChannelIndex !== undefined && { targetDmxOffset: dep.targetChannelIndex }),
                    })),
                }),
            };
            return mapped;
        });
    }
    _resolveDefaultValue(ch, kinetic) {
        const type = this._normalizeChannelType(ch.type);
        // WAVE 4708: hard-safe factory home para canales mecánicos/legacy cuarentenados.
        // Evita arranques en macros/gobos/prismas activos por default del perfil.
        if (QUARANTINED_MECHANICAL_CHANNEL_TYPES.has(type)) {
            return 0;
        }
        if (typeof ch.defaultValue === 'number') {
            return ch.defaultValue;
        }
        if (kinetic && (type === 'pan' || type === 'tilt' || type === 'rotation')) {
            return 128;
        }
        // WAVE 4752 F6: defaults seguros diferenciados.
        // shutter=255: obturador abierto — la luz pasa. Caída a default NO ciega el fixture.
        // strobe=0: sin parpadeo en silencio — evita velocidad máxima en idle.
        if (type === 'shutter')
            return 255;
        if (type === 'strobe')
            return 0;
        return 0;
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
