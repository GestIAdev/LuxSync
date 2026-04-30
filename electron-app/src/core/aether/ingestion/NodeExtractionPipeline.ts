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
  'focus', 'zoom', 'iris', 'frost',
])

const ATMOSPHERE_CHANNEL_TYPES = new Set<string>([
  'control', 'macro', 'custom',
])

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT & CURVE DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const IMPACT_TRANSFER_CURVE: TransferCurve = {
  type:      'exponential',
  exponent:  2.5,
  noiseGate: 0.02,
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
  public extract(
    fixtureDef:        Readonly<FixtureDefinition>,
    dmxAddress:        number,
    universe:          number,
    zoneId:            ZoneId,
    deviceIdOverride?: DeviceId,
  ): IDeviceDefinition {
    const deviceId: DeviceId = deviceIdOverride ?? (fixtureDef.id as DeviceId)
    const topology = this._analyzeTopology(fixtureDef)
    const nodes    = this._buildAllNodes(deviceId, zoneId, fixtureDef, topology)
    const calibr   = this._buildCalibration(fixtureDef)

    return {
      deviceId,
      name:         fixtureDef.name,
      type:         fixtureDef.type,
      dmxAddress,
      universe,
      channelCount: fixtureDef.channels.length,
      nodes:        Object.freeze(nodes),
      calibration:  calibr,
    } satisfies IDeviceDefinition
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 — TOPOLOGY ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────

  private _analyzeTopology(fixtureDef: Readonly<FixtureDefinition>): TopologyAnalysis {
    const chs = fixtureDef.channels

    const colorChs      = chs.filter(ch => COLOR_CHANNEL_TYPES.has(ch.type))
    const impactChs     = chs.filter(ch => IMPACT_CHANNEL_TYPES.has(ch.type))
    const kineticChs    = chs.filter(ch => KINETIC_CHANNEL_TYPES.has(ch.type))
    const beamChs       = chs.filter(ch => BEAM_CHANNEL_TYPES.has(ch.type))
    const atmosphereChs = chs.filter(ch => ATMOSPHERE_CHANNEL_TYPES.has(ch.type))

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
  ): ICapabilityNode[] {
    const nodes: ICapabilityNode[] = []

    for (const group of topology.colorGroups) {
      nodes.push(this._buildColorNode(deviceId, zoneId, fixtureDef, group))
    }
    if (topology.impactChannels.length > 0) {
      nodes.push(this._buildImpactNode(deviceId, zoneId, topology.impactChannels))
    }
    if (topology.kineticChannels.length > 0) {
      nodes.push(this._buildKineticNode(deviceId, zoneId, fixtureDef, topology.kineticChannels))
    }
    if (topology.beamChannels.length > 0) {
      nodes.push(this._buildBeamNode(deviceId, zoneId, topology.beamChannels))
    }
    if (topology.atmosphereChannels.length > 0) {
      nodes.push(this._buildAtmosphereNode(deviceId, zoneId, fixtureDef, topology.atmosphereChannels))
    }

    return nodes
  }

  // ── COLOR NODE ────────────────────────────────────────────────────────────

  private _buildColorNode(
    deviceId:   DeviceId,
    zoneId:     ZoneId,
    fixtureDef: Readonly<FixtureDefinition>,
    group:      ChannelGroup,
  ): IColorNodeData {
    const nodeId: NodeId = `${deviceId}:${group.labelSuffix}`

    const channels = this._mapChannels(group.channels)
    const mixingType  = this._detectMixingType(group.channels)
    const colorWheel  = this._buildColorWheelDef(fixtureDef)

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
    } satisfies IColorNodeData
  }

  // ── IMPACT NODE ───────────────────────────────────────────────────────────

  private _buildImpactNode(
    deviceId:  DeviceId,
    zoneId:    ZoneId,
    impactChs: readonly FixtureChannel[],
  ): IImpactNodeData {
    const nodeId: NodeId = `${deviceId}:impact`

    return {
      nodeId,
      family:        NodeFamily.IMPACT,
      deviceId,
      zoneId,
      role:          'percussion',
      channels:      this._mapChannels(impactChs),
      constraints:   IMPACT_CONSTRAINTS,
      transferCurve: IMPACT_TRANSFER_CURVE,
      bandMix:       IMPACT_BAND_MIX,
      envelopeState: IMPACT_ENVELOPE_INIT,
      state:         new Float64Array(4),
    } satisfies IImpactNodeData
  }

  // ── KINETIC NODE ──────────────────────────────────────────────────────────

  private _buildKineticNode(
    deviceId:   DeviceId,
    zoneId:     ZoneId,
    fixtureDef: Readonly<FixtureDefinition>,
    kineticChs: readonly FixtureChannel[],
  ): IKineticNodeData {
    const nodeId: NodeId = `${deviceId}:kinetic`

    const motorType = this._mapMotorType(fixtureDef.physics?.motorType)
    const maxSpeed  = fixtureDef.physics?.maxVelocity ?? 540

    // Heurística: si no hay pan/tilt pero sí rotation → rotación continua (fan, pétalo)
    const hasPanTilt = kineticChs.some(ch => ch.type === 'pan' || ch.type === 'tilt')
    const hasRotation = kineticChs.some(ch => ch.type === 'rotation')
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
      physicalPosition:  NEUTRAL_POSITION,
      stereoIndex:       0,
      stereoTotal:       1,
      state:             new Float64Array(4),
    } satisfies IKineticNodeData
  }

  // ── BEAM NODE ─────────────────────────────────────────────────────────────

  private _buildBeamNode(
    deviceId: DeviceId,
    zoneId:   ZoneId,
    beamChs:  readonly FixtureChannel[],
  ): IBeamNodeData {
    const nodeId: NodeId = `${deviceId}:beam`
    const types = new Set(beamChs.map(ch => ch.type))

    return {
      nodeId,
      family:           NodeFamily.BEAM,
      deviceId,
      zoneId,
      role:             'decoration',
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
    } satisfies IBeamNodeData
  }

  // ── ATMOSPHERE NODE ───────────────────────────────────────────────────────

  private _buildAtmosphereNode(
    deviceId:      DeviceId,
    zoneId:        ZoneId,
    fixtureDef:    Readonly<FixtureDefinition>,
    atmosphereChs: readonly FixtureChannel[],
  ): IAtmosphereNodeData {
    const nodeId: NodeId = `${deviceId}:atmosphere`

    return {
      nodeId,
      family:      NodeFamily.ATMOSPHERE,
      deviceId,
      zoneId,
      role:        'atmosphere',
      channels:    this._mapChannels(atmosphereChs),
      constraints: ATMOSPHERE_CONSTRAINTS,
      atmosType:   this._mapAtmosphereType(fixtureDef.type),
      safety:      ATMOSPHERE_SAFETY_INIT,
      state:       new Float64Array(4),
    } satisfies IAtmosphereNodeData
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3 — CALIBRATION EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  private _buildCalibration(fixtureDef: Readonly<FixtureDefinition>): IDeviceCalibration | undefined {
    const p = fixtureDef.physics
    if (!p) return undefined

    const calib: IDeviceCalibration = {
      ...(p.invertPan         !== undefined && { invertPan:    p.invertPan }),
      ...(p.invertTilt        !== undefined && { invertTilt:   p.invertTilt }),
      ...(p.homePosition                    && {
        panOffset:  p.homePosition.pan,
        tiltOffset: p.homePosition.tilt,
      }),
      ...(p.tiltLimits?.min   !== undefined && { tiltLimitMin: p.tiltLimits.min }),
      ...(p.tiltLimits?.max   !== undefined && { tiltLimitMax: p.tiltLimits.max }),
    }

    return Object.keys(calib).length > 0 ? calib : undefined
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
      type:         ch.type as AetherChannelType,
      dmxOffset:    ch.index - 1,   // FixtureChannel.index es 1-based
      defaultValue: ch.defaultValue ?? (
        kinetic && (ch.type === 'pan' || ch.type === 'tilt') ? 128 : 0
      ),
      is16bit:    ch.is16bit  ?? false,
      customName: ch.customName,
    }))
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
      case 'fan':   return 'fan'
      case 'fog':   return 'fog'
      case 'pyro':  return 'pyro'
      default:      return 'custom'
    }
  }
}
