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

import type {
  IDeviceDefinition,
  IDeviceCalibration,
} from '../device'
import type {
  ICapabilityNode,
  IColorNodeData,
  IImpactNodeData,
  IKineticNodeData,
  IBeamNodeData,
  IAtmosphereNodeData,
  INodeChannelDef,
  INodeConstraints,
} from '../capability-node'
import { NodeFamily } from '../types'
import type {
  DeviceId,
  NodeId,
  AetherChannelType,
  ColorMixingType,
  ZoneId,
  TransferCurve,
  MotorType,
  AtmosphereType,
  ColorWheelDefinition,
  BandMixWeights,
  EnvelopeState,
  AtmosphereSafetyState,
  DarkSpinState,
  Position3D,
} from '../types'
import type {
  FixtureDefinition,
  FixtureChannel,
  FixtureType,
} from '../../../types/FixtureDefinition'
import type { FixtureV2 } from '../../stage/ShowFileV2'
import { normalizeZoneId } from '../adapters/zoneUtils'

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL: CHANNEL GROUP para sub-emitters
// ═══════════════════════════════════════════════════════════════════════════

interface ChannelGroup {
  readonly emitterIndex: number
  readonly labelSuffix:  string
  readonly channels:     readonly FixtureChannel[]
}

interface TopologyAnalysis {
  readonly colorGroups:        readonly ChannelGroup[]
  readonly impactChannels:     readonly FixtureChannel[]
  readonly kineticChannels:    readonly FixtureChannel[]
  readonly beamChannels:       readonly FixtureChannel[]
  readonly atmosphereChannels: readonly FixtureChannel[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL CLASSIFICATION SETS
// ═══════════════════════════════════════════════════════════════════════════

const COLOR_CHANNEL_TYPES = new Set<string>([
  'red', 'green', 'blue', 'white', 'amber', 'uv',
  'cyan', 'magenta', 'yellow', 'color_wheel',
])

const IMPACT_CHANNEL_TYPES = new Set<string>([
  'dimmer', 'strobe', 'shutter',
])

const KINETIC_CHANNEL_TYPES = new Set<string>([
  'pan', 'pan_fine', 'tilt', 'tilt_fine', 'speed', 'rotation',
])

const BEAM_CHANNEL_TYPES = new Set<string>([
  'gobo', 'gobo_rotation', 'prism', 'prism_rotation',
  'focus', 'zoom', 'frost',
])

// WAVE 3517.1: ATMOSPHERE incluye custom/macro/control (canales de máquinas de efecto).
// La detección semántica se refuerza con el fixture.type en _analyzeTopology().
const ATMOSPHERE_CHANNEL_TYPES = new Set<string>([
  'control', 'macro', 'custom',
])

// Fixture types que por definición producen un ATMOSPHERE node aunque sus
// canales sean 'custom' (fog output, haze pump, spark ignition, etc.).
const ATMOSPHERE_FIXTURE_TYPES = new Set<string>([
  'fog', 'fan', 'pyro', 'laser',
])

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT & CURVE DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const IMPACT_TRANSFER_CURVE: TransferCurve = {
  type:      'linear',
  noiseGate: 0.0,
}

const IMPACT_BAND_MIX: BandMixWeights = {
  subBass:  0.80,
  bass:     0.60,
  mid:      0.20,
  highMid:  0.10,
  presence: 0.05,
  air:      0.0,
  energy:   0.40,
}

const IMPACT_ENVELOPE_INIT: EnvelopeState = {
  current:  0,
  velocity: 0,
}

const ATMOSPHERE_SAFETY_INIT: AtmosphereSafetyState = {
  lastActivationMs:  0,
  totalActiveMs:     0,
  cooldownRemaining: 0,
}

const DARKSPIN_INIT: DarkSpinState = {
  lastChangeMs: 0,
  isLocked:     false,
}

const NEUTRAL_POSITION: Position3D = { x: 0, y: 0, z: 0 }

const COLOR_CONSTRAINTS: INodeConstraints = {
  responseType:    'digital',
  minChangeTimeMs: 0,
  maxValue:        255,
}

const IMPACT_CONSTRAINTS: INodeConstraints = {
  responseType:    'digital',
  minChangeTimeMs: 0,
  maxValue:        255,
  transferCurve:   IMPACT_TRANSFER_CURVE,
}

const KINETIC_CONSTRAINTS_BASE: INodeConstraints = {
  responseType:    'mechanical',
  minChangeTimeMs: 0,
  maxValue:        255,
  maxSpeed:        540,
}

const BEAM_CONSTRAINTS: INodeConstraints = {
  responseType:    'mechanical',
  minChangeTimeMs: 200,
  maxValue:        255,
}

const ATMOSPHERE_CONSTRAINTS: INodeConstraints = {
  responseType:    'digital',
  minChangeTimeMs: 0,
  maxValue:        255,
}

const CHANNEL_PRIORITY_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
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
})

const FAMILY_PRIORITY: Readonly<Record<NodeFamily, number>> = Object.freeze({
  [NodeFamily.KINETIC]: 5,
  [NodeFamily.IMPACT]: 4,
  [NodeFamily.BEAM]: 3,
  [NodeFamily.COLOR]: 2,
  [NodeFamily.ATMOSPHERE]: 1,
})

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
   * WAVE 3517.1: Firma principal (blueprint 3506 §1.4).
   *
   * Extrae un IDeviceDefinition a partir del perfil legacy + datos del
   * Stagebuilder. La posición 3D, la calibración show-level (panOffset,
   * tiltInvert…) y el zoneId se leen directamente del FixtureV2.
   *
   * @param definition — Perfil de la Forja (.fxt / DB). NUNCA mutable.
   * @param fixtureV2  — Instancia del Stagebuilder (posición, zona, calibración).
   */
  public extract(
    definition: Readonly<FixtureDefinition>,
    fixtureV2:  Readonly<FixtureV2>,
  ): IDeviceDefinition

  /**
   * Firma legacy: compatible con código previo a WAVE 3517.1 que
   * pasa los parámetros manualmente en lugar del FixtureV2.
   *
   * @param fixtureDef       — Perfil leído de la biblioteca (.fxt / DB).
   * @param dmxAddress       — Dirección DMX base (1–512).
   * @param universe         — Universo DMX (1-based).
   * @param zoneId           — Zona semántica ("movers-left", "front", etc.).
   * @param deviceIdOverride — DeviceId explícito. Si omitido, usa fixtureDef.id.
   */
  public extract(
    fixtureDef:        Readonly<FixtureDefinition>,
    dmxAddress:        number,
    universe:          number,
    zoneId:            ZoneId,
    deviceIdOverride?: DeviceId,
  ): IDeviceDefinition

  // Implementación unificada
  public extract(
    fixtureDef:            Readonly<FixtureDefinition>,
    dmxAddressOrFixtureV2: number | Readonly<FixtureV2>,
    universe?:             number,
    zoneId?:               ZoneId,
    deviceIdOverride?:     DeviceId,
  ): IDeviceDefinition {

    // ── Despacho de firma ────────────────────────────────────────────────
    let resolvedAddress:     number
    let resolvedUniverse:    number
    let resolvedZone:        ZoneId
    let resolvedDeviceId:    DeviceId
    let resolvedPosition:    Position3D | undefined
    let v2CalibOverride:     Readonly<FixtureV2['calibration']> | undefined
    let isVirtual:           boolean | undefined
    let resolvedOrientation: string | undefined
    let resolvedIsPlaced:    boolean | undefined

    if (typeof dmxAddressOrFixtureV2 === 'object') {
      // ── Firma FixtureV2 (WAVE 3517.1 — recomendada) ──────────────────
      const fv2        = dmxAddressOrFixtureV2
      resolvedAddress  = fv2.address
      resolvedUniverse = fv2.universe
      resolvedZone     = normalizeZoneId(fv2.zone) as ZoneId
      resolvedDeviceId = (fv2.id as DeviceId)
      resolvedPosition = fv2.position
      v2CalibOverride  = fv2.calibration
      isVirtual        = fv2.isVirtual
      // 🧭 WAVE 4573 Phase 5b: Read orientation from root (not physics.orientation)
      resolvedOrientation = fv2.orientation
      resolvedIsPlaced    = fv2.isPlaced
    } else {
      // ── Firma legacy (compatibilidad) ─────────────────────────────────
      resolvedAddress     = dmxAddressOrFixtureV2
      resolvedUniverse    = universe!
      resolvedZone        = normalizeZoneId(zoneId!) as ZoneId
      resolvedDeviceId    = deviceIdOverride ?? (fixtureDef.id as DeviceId)
      resolvedPosition    = undefined
      v2CalibOverride     = undefined
      isVirtual           = undefined
      resolvedOrientation = undefined
      resolvedIsPlaced    = undefined
    }

    const topology = this._analyzeTopology(fixtureDef)
    const nodes    = this._sanitizeOverlappingChannels(
      resolvedDeviceId,
      this._buildAllNodes(
        resolvedDeviceId,
        resolvedZone,
        fixtureDef,
        topology,
        resolvedPosition,
      ),
    )
    const calibration = this._buildCalibration(fixtureDef, v2CalibOverride)

    return {
      deviceId:     resolvedDeviceId,
      name:         fixtureDef.name,
      type:         fixtureDef.type,
      dmxAddress:   resolvedAddress,
      universe:     resolvedUniverse,
      channelCount: fixtureDef.channels.length,
      nodes:        Object.freeze(nodes),
      calibration,
      ...(isVirtual              !== undefined && { isVirtual }),
      ...(resolvedOrientation   !== undefined && { orientation: resolvedOrientation }),
      ...(resolvedIsPlaced      !== undefined && { isPlaced: resolvedIsPlaced }),
    } satisfies IDeviceDefinition
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 — TOPOLOGY ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────

  private _analyzeTopology(fixtureDef: Readonly<FixtureDefinition>): TopologyAnalysis {
    const chs = fixtureDef.channels
    const isAtmosphereFixture = ATMOSPHERE_FIXTURE_TYPES.has(fixtureDef.type)

    // WAVE 3517.1: Para fixtures de atmósfera, los canales 'custom' son
    // el medio principal de control (fog output, fan speed, spark output…).
    // Un fixture de tipo 'fog' con un canal 'custom' llamado "Fog Output"
    // debe producir un ATMOSPHERE node, no caer en el void.
    // Para el resto de fixtures, 'custom' sigue siendo atmósfera si existe.

    const colorChs   = chs.filter(ch => COLOR_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))
    const impactChs  = chs.filter(ch => IMPACT_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))
    const kineticChs = chs.filter(ch => KINETIC_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))
    const beamChs    = chs.filter(ch => BEAM_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))

    // Para fixtures de atmósfera: todos los canales no capturados por las
    // otras familias se convierten en ATMOSPHERE channels.
    // Para el resto: solo los tipos explícitamente en ATMOSPHERE_CHANNEL_TYPES.
    const classifiedTypes = new Set([
      ...COLOR_CHANNEL_TYPES,
      ...IMPACT_CHANNEL_TYPES,
      ...KINETIC_CHANNEL_TYPES,
      ...BEAM_CHANNEL_TYPES,
    ])

    const atmosphereChs: FixtureChannel[] = isAtmosphereFixture
      ? chs.filter(ch => !classifiedTypes.has(this._normalizeChannelType(ch.type)) || ATMOSPHERE_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))
      : chs.filter(ch => ATMOSPHERE_CHANNEL_TYPES.has(this._normalizeChannelType(ch.type)))

    // Para fans multi-emitter: detectar grupos de color por pétalo.
    // Para el resto: un único grupo de color si hay canales de color.
    const colorGroups: ChannelGroup[] =
      fixtureDef.type === 'fan'
        ? this._detectFanEmitterGroups(colorChs)
        : colorChs.length > 0
          ? [{ emitterIndex: 0, labelSuffix: 'color', channels: colorChs }]
          : []

    return {
      colorGroups,
      impactChannels:     impactChs,
      kineticChannels:    kineticChs,
      beamChannels:       beamChs,
      atmosphereChannels: atmosphereChs,
    }
  }

  /**
   * Divide los canales de color en bloques por pétalo para fans.
   * Cada bloque RGB/RGBW/CMY completo = 1 sub-emitter independiente.
   */
  private _detectFanEmitterGroups(colorChs: readonly FixtureChannel[]): ChannelGroup[] {
    if (colorChs.length === 0) return []

    const sorted    = [...colorChs].sort((a, b) => a.index - b.index)
    const blockSize = this._inferBlockSize(sorted)

    const groups: ChannelGroup[] = []
    let cursor = 0

    while (cursor < sorted.length) {
      const block = sorted.slice(cursor, cursor + blockSize)
      if (block.length === 0) break
      groups.push({
        emitterIndex: groups.length,
        labelSuffix:  `petal-${groups.length}`,
        channels:     block,
      })
      cursor += blockSize
    }

    return groups
  }

  /** Tamaño de bloque por pétalo inferido del conjunto de tipos de canal. */
  private _inferBlockSize(sortedColorChs: readonly FixtureChannel[]): number {
    const types = new Set(sortedColorChs.map(ch => ch.type))
    if (types.has('cyan') && types.has('magenta') && types.has('yellow')) return 3
    const hasRGB = types.has('red') && types.has('green') && types.has('blue')
    if (hasRGB) {
      let extra = 0
      if (types.has('white'))  extra++
      if (types.has('amber'))  extra++
      if (types.has('uv'))     extra++
      return 3 + extra
    }
    return sortedColorChs.length // fallback: todo como un único bloque
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2 — NODE CONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────

  private _buildAllNodes(
    deviceId:   DeviceId,
    zoneId:     ZoneId,
    fixtureDef: Readonly<FixtureDefinition>,
    topology:   TopologyAnalysis,
    position?:  Position3D,
  ): ICapabilityNode[] {
    const nodes: ICapabilityNode[] = []

    for (const group of topology.colorGroups) {
      nodes.push(this._buildColorNode(deviceId, zoneId, fixtureDef, group, position))
    }
    if (topology.impactChannels.length > 0) {
      nodes.push(this._buildImpactNode(deviceId, zoneId, topology.impactChannels, position))
    }
    if (topology.kineticChannels.length > 0) {
      nodes.push(this._buildKineticNode(deviceId, zoneId, fixtureDef, topology.kineticChannels, position))
    }
    if (topology.beamChannels.length > 0) {
      nodes.push(this._buildBeamNode(deviceId, zoneId, topology.beamChannels, position))
    }
    if (topology.atmosphereChannels.length > 0) {
      nodes.push(this._buildAtmosphereNode(deviceId, zoneId, fixtureDef, topology.atmosphereChannels, position))
    }

    return nodes
  }

  private _sanitizeOverlappingChannels(
    deviceId: DeviceId,
    nodes: ICapabilityNode[],
  ): ICapabilityNode[] {
    type Candidate = {
      node: ICapabilityNode
      nodeIndex: number
      channel: INodeChannelDef
      score: number
    }

    const byOffset = new Map<number, Candidate[]>()

    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      const node = nodes[nodeIndex]
      for (let channelIndex = 0; channelIndex < node.channels.length; channelIndex++) {
        const channel = node.channels[channelIndex]
        const score = this._getChannelPriority(node.family, channel.type)
        const list = byOffset.get(channel.dmxOffset)
        const candidate: Candidate = { node, nodeIndex, channel, score }
        if (list) {
          list.push(candidate)
        } else {
          byOffset.set(channel.dmxOffset, [candidate])
        }
      }
    }

    const winners = new Map<number, Candidate>()
    const collisionLogs: string[] = []

    for (const [offset, candidates] of byOffset) {
      let winner = candidates[0]
      for (let i = 1; i < candidates.length; i++) {
        const current = candidates[i]
        if (
          current.score > winner.score ||
          (current.score === winner.score && current.nodeIndex > winner.nodeIndex)
        ) {
          winner = current
        }
      }
      winners.set(offset, winner)

      if (candidates.length > 1) {
        collisionLogs.push(
          `offset=${offset} winner=${String(winner.node.nodeId)}:${winner.channel.type} ` +
          `candidates=${candidates.map(candidate => `${String(candidate.node.nodeId)}:${candidate.channel.type}`).join(',')}`,
        )
      }
    }

    if (collisionLogs.length > 0) {
      console.warn(
        `[NodeExtractionPipeline] ⚠️ DMX offset collision sanitized for ${String(deviceId)} | ${collisionLogs.join(' | ')}`,
      )
    }

    const sanitized = nodes
      .map(node => {
        const nextChannels = node.channels.filter(channel => winners.get(channel.dmxOffset)?.channel === channel)
        return { ...node, channels: nextChannels } as ICapabilityNode
      })
      .filter(node => node.channels.length > 0)

    return sanitized
  }

  private _getChannelPriority(family: NodeFamily, channelType: string): number {
    const typePriority = CHANNEL_PRIORITY_BY_TYPE[channelType] ?? 0
    const familyPriority = FAMILY_PRIORITY[family] ?? 0
    return typePriority * 10 + familyPriority
  }

  // ── COLOR NODE ────────────────────────────────────────────────────────────

  private _buildColorNode(
    deviceId:   DeviceId,
    zoneId:     ZoneId,
    fixtureDef: Readonly<FixtureDefinition>,
    group:      ChannelGroup,
    position?:  Position3D,
  ): IColorNodeData {
    const nodeId: NodeId = `${deviceId}:${group.labelSuffix}`

    const channels   = this._mapChannels(group.channels)
    const mixingType = this._detectMixingType(group.channels)
    const colorWheel = this._buildColorWheelDef(fixtureDef)

    return {
      nodeId,
      family:       NodeFamily.COLOR,
      deviceId,
      zoneId,
      role:         group.emitterIndex === 0 ? 'primary' : 'accent',
      channels,
      constraints:  COLOR_CONSTRAINTS,
      mixingType,
      colorWheel,
      currentColor: { r: 0, g: 0, b: 0 },
      state:        new Float64Array(4),
      ...(position !== undefined && { position }),
    } satisfies IColorNodeData
  }

  // ── IMPACT NODE ───────────────────────────────────────────────────────────

  private _buildImpactNode(
    deviceId:  DeviceId,
    zoneId:    ZoneId,
    impactChs: readonly FixtureChannel[],
    position?: Position3D,
  ): IImpactNodeData {
    const nodeId: NodeId = `${deviceId}:impact`

    // Blueprint 3506 §1.5: dimmer → role 'primary'; shutter/strobe → role 'percussion'.
    // Si hay dimmer, el nodo principal es de dimmer (primary).
    // Si solo hay shutter o strobe (sin dimmer), el rol es 'percussion'.
    const hasDimmer = impactChs.some(ch => this._normalizeChannelType(ch.type) === 'dimmer')

    return {
      nodeId,
      family:        NodeFamily.IMPACT,
      deviceId,
      zoneId,
      role:          hasDimmer ? 'primary' : 'percussion',
      channels:      this._mapChannels(impactChs),
      constraints:   IMPACT_CONSTRAINTS,
      transferCurve: IMPACT_TRANSFER_CURVE,
      bandMix:       IMPACT_BAND_MIX,
      envelopeState: IMPACT_ENVELOPE_INIT,
      state:         new Float64Array(4),
      ...(position !== undefined && { position }),
    } satisfies IImpactNodeData
  }

  // ── KINETIC NODE ──────────────────────────────────────────────────────────

  private _buildKineticNode(
    deviceId:   DeviceId,
    zoneId:     ZoneId,
    fixtureDef: Readonly<FixtureDefinition>,
    kineticChs: readonly FixtureChannel[],
    position?:  Position3D,
  ): IKineticNodeData {
    const nodeId: NodeId = `${deviceId}:kinetic`

    const motorType = this._mapMotorType(fixtureDef.physics?.motorType)
    const maxSpeed  = fixtureDef.physics?.maxVelocity ?? 540

    // Heurística: si no hay pan/tilt pero sí rotation → rotación continua (fan, pétalo)
    const hasPanTilt   = kineticChs.some(ch => ch.type === 'pan' || ch.type === 'tilt')
    const hasRotation  = kineticChs.some(ch => ch.type === 'rotation')
    const isContinuous = !hasPanTilt && hasRotation

    return {
      nodeId,
      family:            NodeFamily.KINETIC,
      deviceId,
      zoneId,
      role:              isContinuous ? 'percussion' : 'primary',
      channels:          this._mapChannels(kineticChs, true),
      constraints:       { ...KINETIC_CONSTRAINTS_BASE, maxSpeed },
      motorType,
      isContinuous,
      maxPanSpeed:       isContinuous ? 0 : maxSpeed,
      maxTiltSpeed:      isContinuous ? 0 : maxSpeed,
      maxRotationSpeed:  isContinuous ? maxSpeed : undefined,
      currentPosition:   isContinuous
        ? { pan: 0, tilt: 0, rotation: 0.5 }
        : { pan: 0.5, tilt: 0.5 },
      physicalPosition:  position ?? NEUTRAL_POSITION,
      stereoIndex:       0,
      stereoTotal:       1,
      state:             new Float64Array(4),
      ...(position !== undefined && { position }),
    } satisfies IKineticNodeData
  }

  // ── BEAM NODE ─────────────────────────────────────────────────────────────

  private _buildBeamNode(
    deviceId:  DeviceId,
    zoneId:    ZoneId,
    beamChs:   readonly FixtureChannel[],
    position?: Position3D,
  ): IBeamNodeData {
    const nodeId: NodeId = `${deviceId}:beam`
    const types = new Set(beamChs.map(ch => ch.type))

    // Blueprint 3506 §1.5: zoom/focus/iris → role 'primary'; gobo/prism → role 'decoration'.
    // Si hay zoom, focus o iris, el nodo es primario (conformación del haz).
    // Si solo hay gobos/prism, es decoración pura.
    const hasBeamShaping = types.has('zoom') || types.has('focus')

    return {
      nodeId,
      family:           NodeFamily.BEAM,
      deviceId,
      zoneId,
      role:             hasBeamShaping ? 'primary' : 'decoration',
      channels:         this._mapChannels(beamChs),
      constraints:      BEAM_CONSTRAINTS,
      hasGobo:          types.has('gobo'),
      hasGoboRotation:  types.has('gobo_rotation'),
      hasPrism:         types.has('prism'),
      hasPrismRotation: types.has('prism_rotation'),
      hasZoom:          types.has('zoom'),
      hasFocus:         types.has('focus'),
      hasFrost:         types.has('frost'),
      darkSpinState:    DARKSPIN_INIT,
      state:            new Float64Array(4),
      ...(position !== undefined && { position }),
    } satisfies IBeamNodeData
  }

  // ── ATMOSPHERE NODE ───────────────────────────────────────────────────────

  private _buildAtmosphereNode(
    deviceId:      DeviceId,
    zoneId:        ZoneId,
    fixtureDef:    Readonly<FixtureDefinition>,
    atmosphereChs: readonly FixtureChannel[],
    position?:     Position3D,
  ): IAtmosphereNodeData {
    const nodeId: NodeId = `${deviceId}:atmosphere`

    // WAVE 3517.1: Detectar role semántico por tipo de fixture.
    // fog/haze → 'ambient' (rellena el espacio continuamente)
    // pyro/laser/spark → 'atmosphere' (efecto puntual dramático)
    // fan → 'ambient' (movimiento de aire continuo)
    const atmosType = this._mapAtmosphereType(fixtureDef.type)
    const role = (atmosType === 'fog' || atmosType === 'haze' || atmosType === 'fan')
      ? 'ambient'
      : 'atmosphere'

    return {
      nodeId,
      family:      NodeFamily.ATMOSPHERE,
      deviceId,
      zoneId,
      role,
      channels:    this._mapChannels(atmosphereChs),
      constraints: ATMOSPHERE_CONSTRAINTS,
      atmosType,
      safety:      ATMOSPHERE_SAFETY_INIT,
      state:       new Float64Array(4),
      ...(position !== undefined && { position }),
    } satisfies IAtmosphereNodeData
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
  private _buildCalibration(
    fixtureDef:    Readonly<FixtureDefinition>,
    v2Calibration?: Readonly<FixtureV2['calibration']>,
  ): IDeviceCalibration | undefined {
    const p = fixtureDef.physics

    // ── Datos de base (Forja / physics profile) ──────────────────────────
    const fromPhysics: IDeviceCalibration = {
      ...(p?.invertPan      !== undefined && { invertPan:    p.invertPan }),
      ...(p?.invertTilt     !== undefined && { invertTilt:   p.invertTilt }),
      ...(p?.homePosition              && {
        panOffset:  p.homePosition.pan,
        tiltOffset: p.homePosition.tilt,
      }),
      ...(p?.tiltLimits?.min !== undefined && { tiltLimitMin: p.tiltLimits.min }),
      ...(p?.tiltLimits?.max !== undefined && { tiltLimitMax: p.tiltLimits.max }),
    }

    // ── Override del show (FixtureV2.calibration — CalibrationLab) ───────
    // Los valores del show reemplazan a los del physics cuando están presentes.
    if (v2Calibration) {
      const merged: IDeviceCalibration = {
        ...fromPhysics,
        invertPan:  v2Calibration.panInvert  ?? fromPhysics.invertPan,
        invertTilt: v2Calibration.tiltInvert ?? fromPhysics.invertTilt,
        panOffset:  v2Calibration.panOffset  ?? fromPhysics.panOffset,
        tiltOffset: v2Calibration.tiltOffset ?? fromPhysics.tiltOffset,
      }
      return Object.keys(merged).length > 0 ? merged : undefined
    }

    return Object.keys(fromPhysics).length > 0 ? fromPhysics : undefined
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convierte FixtureChannel[] a INodeChannelDef[].
   * @param kinetic — Si true, usa 128 como default para pan/tilt (centro).
   */
  private _mapChannels(
    channels: readonly FixtureChannel[],
    kinetic = false,
  ): INodeChannelDef[] {
    return channels.map(ch => ({
      type:         this._normalizeChannelType(ch.type) as AetherChannelType,
      dmxOffset:    ch.index - 1,   // FixtureChannel.index es 1-based
      defaultValue: ch.defaultValue ?? (
        kinetic && (this._normalizeChannelType(ch.type) === 'pan' || this._normalizeChannelType(ch.type) === 'tilt') ? 128 :
        (this._normalizeChannelType(ch.type) === 'shutter' || this._normalizeChannelType(ch.type) === 'strobe') ? 255 :
        0
      ),
      is16bit:    ch.is16bit  ?? false,
      customName: ch.customName,
    }))
  }

  private _normalizeChannelType(type: string): string {
    return typeof type === 'string' ? type.toLowerCase() : 'unknown'
  }

  private _detectMixingType(channels: readonly FixtureChannel[]): ColorMixingType {
    const t = new Set(channels.map(ch => ch.type))
    if (t.has('cyan') && t.has('magenta') && t.has('yellow')) return 'cmy'
    if (t.has('color_wheel')) return 'wheel'
    const rgb = t.has('red') && t.has('green') && t.has('blue')
    if (rgb && (t.has('white') || t.has('amber'))) return 'rgbw'
    if (rgb) return 'rgb'
    return 'rgb'
  }

  private _buildColorWheelDef(fixtureDef: Readonly<FixtureDefinition>): ColorWheelDefinition | undefined {
    const wh = fixtureDef.capabilities?.colorWheel
    if (!wh) return undefined

    return {
      name:            fixtureDef.name + ' Color Wheel',
      slots:           wh.colors.map(c => ({
        name:       c.name,
        dmxValue:   c.dmx,
        previewRgb: c.rgb,
      })),
      minTransitionMs: wh.minChangeTimeMs ?? 200,
    } satisfies ColorWheelDefinition
  }

  private _mapMotorType(legacyMotor: string | undefined): MotorType {
    switch (legacyMotor) {
      case 'servo':
      case 'servo-pro':   return 'servo'
      // 'galvo' no existe en legacy — stepper es el fallback correcto
      case 'stepper':
      case 'stepper-pro':
      default:            return 'stepper'
    }
  }

  private _mapAtmosphereType(fixtureType: FixtureType): AtmosphereType {
    switch (fixtureType) {
      case 'fan':    return 'fan'
      case 'fog':    return 'fog'
      case 'pyro':   return 'pyro'
      case 'laser':  return 'spark'
      default:       return 'custom'
    }
  }
}
