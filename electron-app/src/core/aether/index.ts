/**
 * ---------------------------------------------------------------------------
 * ??  AETHER MATRIX � PUBLIC CONTRACT SURFACE
 * ---------------------------------------------------------------------------
 *
 * WAVE 3505.2: Barrel export � contratos + implementaciones concretas.
 *
 * Este archivo es la �NICA puerta de entrada al m�dulo Aether.
 * Cualquier consumidor externo importa desde `core/aether`.
 * Nunca se importa directamente de los archivos internos.
 *
 * REGLA: Re-exporta tipos, interfaces, enums, y clases concretas.
 * Nunca instancia clases ni ejecuta l�gica de negocio aqu�.
 *
 * @module core/aether
 * @version WAVE 3505.2
 */

// ---------------------------------------------------------------------------
// PRIMITIVE TYPES & ENUMS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CAPABILITY NODE CONTRACTS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DEVICE CONTRACTS
// ---------------------------------------------------------------------------

export type {
  IDeviceCalibration,
  IDeviceDefinition,
} from './device'

// ---------------------------------------------------------------------------
// NODE GRAPH CONTRACTS
// ---------------------------------------------------------------------------

export type {
  INodeSlotLocation,
  INodeView,
  INodeGraphSnapshot,
  NodeFamilyDataMap,
  INodeGraph,
} from './node-graph'

// ---------------------------------------------------------------------------
// INTENT BUS & ARBITER CONTRACTS
// ---------------------------------------------------------------------------

export type {
  INodeIntent,
  AggregatedNodeIntentMap,
  ArbitratedNodeMap,
  IDMXPacket,
  IIntentBus,
  INodeArbiter,
  INodeResolver,
} from './intent-bus'

// ---------------------------------------------------------------------------
// CONCRETE IMPLEMENTATIONS � WAVE 3505.2
// ---------------------------------------------------------------------------

/**
 * Implementaciones concretas del Motor Agn�stico.
 * Instanciar desde `core/aether` � nunca desde archivos internos.
 *
 * Uso:
 * ```ts
 * import { NodeGraph, IntentBus } from 'core/aether'
 *
 * const graph = new NodeGraph()
 * const bus   = new IntentBus(4096)
 * ```
 */
export { NodeGraph } from './NodeGraph'
export { IntentBus } from './IntentBus'

// ---------------------------------------------------------------------------
// SYSTEMS — WAVE 3505.3
// ---------------------------------------------------------------------------

/**
 * Los Sistemas son los "cerebros" del Motor Agnóstico.
 * Cada sistema procesa un NodeFamily específico y escribe intents al bus.
 *
 * Uso:
 * ```ts
 * import { ImpactSystem, ColorSystem, KineticSystem } from 'core/aether'
 *
 * const systems = [new ImpactSystem(), new ColorSystem(), new KineticSystem()]
 * ```
 */
export { BaseSystem, ImpactSystem, ColorSystem, KineticSystem } from './systems'
export type {
  IAetherSystem,
  FrameContext,
  AudioMetrics,
  VibeProfile,
  MusicalContext,
  ColorEntry,
} from './systems'

// ---------------------------------------------------------------------------
// ARBITER & RESOLVER — WAVE 3505.4
// ---------------------------------------------------------------------------

/**
 * El NodeArbiter unifica intents de todas las capas (L0-L4) y produce
 * el ArbitratedNodeMap que el NodeResolver traduce a DMX.
 *
 * El NodeResolver es el último paso antes del HAL: convierte valores
 * normalizados a Uint8Array pre-allocated (zero-alloc en hot path).
 *
 * Uso:
 * ```ts
 * import { NodeArbiter, NodeResolver } from 'core/aether'
 *
 * const arbiter  = new NodeArbiter()
 * const resolver = new NodeResolver(nodeGraph)
 * resolver.registerUniverse(1)   // una vez en patch time
 * ```
 */
export { NodeArbiter } from './NodeArbiter'
export { NodeResolver } from './resolver'
