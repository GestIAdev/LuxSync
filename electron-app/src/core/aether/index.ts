/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — PUBLIC CONTRACT SURFACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: Barrel export de todos los contratos fundacionales.
 *
 * Este archivo es la ÚNICA puerta de entrada al módulo Aether.
 * Cualquier consumidor externo importa desde `core/aether`.
 * Nunca se importa directamente de los archivos internos.
 *
 * REGLA: Solo re-exporta tipos, interfaces y enums.
 * Nunca instancia clases ni ejecuta lógica.
 *
 * @module core/aether
 * @version WAVE 3505.1
 */

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE TYPES & ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  NodeId,
  DeviceId,
  ZoneId,
  NodeRole,
  AetherChannelType,
  ResponseType,
  TransferCurveType,
  ColorMixingType,
  MotorType,
  AtmosphereType,
  IntentSource,
  MergeStrategy,
} from './types'

export { NodeFamily } from './types'

export type {
  TransferCurve,
  Position3D,
  ColorWheelSlot,
  ColorWheelDefinition,
  BandMixWeights,
  AtmosphereSafetyState,
  DarkSpinState,
  EnvelopeState,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY NODE CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  INodeChannelDef,
  INodeConstraints,
  ICapabilityNode,
  IColorNodeData,
  IImpactNodeData,
  IKineticNodeData,
  IBeamNodeData,
  IAtmosphereNodeData,
  AnyNodeData,
} from './capability-node'

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  IDeviceCalibration,
  IDeviceDefinition,
} from './device'

// ═══════════════════════════════════════════════════════════════════════════
// NODE GRAPH CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  INodeSlotLocation,
  INodeView,
  INodeGraphSnapshot,
  NodeFamilyDataMap,
  INodeGraph,
} from './node-graph'

// ═══════════════════════════════════════════════════════════════════════════
// INTENT BUS & ARBITER CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  INodeIntent,
  AggregatedNodeIntentMap,
  ArbitratedNodeMap,
  IDMXPacket,
  IIntentBus,
  INodeArbiter,
  INodeResolver,
} from './intent-bus'
