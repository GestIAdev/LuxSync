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
export { NodeFamily } from './types';
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
export { NodeGraph } from './NodeGraph';
export { IntentBus } from './IntentBus';
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
export { BaseSystem, ImpactSystem, ColorSystem, KineticSystem, BeamSystem, AtmosphereSystem } from './systems';
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
export { NodeArbiter } from './NodeArbiter';
export { NodeResolver, PhysicsPostProcessor } from './resolver';
// ---------------------------------------------------------------------------
// INGESTION — WAVE 3507: THE SPATIAL GENESIS (F1)
// ---------------------------------------------------------------------------
/**
 * Pipeline de ingesta: convierte FixtureDefinition legacy a
 * IDeviceDefinition Aether V2 con CapabilityNodes descompuestos.
 *
 * Uso completo:
 * ```ts
 * import { NodeExtractionPipeline, SpatialRegistrar } from 'core/aether'
 *
 * const pipeline  = new NodeExtractionPipeline()
 * const registrar = new SpatialRegistrar()
 *
 * // Cuando el usuario añade un fixture al Stage:
 * const deviceDef = pipeline.extract(fixtureDef, address, universe, zoneId)
 * registrar.register(deviceDef, fixtureV2.position, orchestrator)
 * ```
 */
export { NodeExtractionPipeline, SpatialRegistrar, } from './ingestion';
// ---------------------------------------------------------------------------
// ADAPTERS — WAVE 3508: BLOOD & MUSCLE (F2)
// ---------------------------------------------------------------------------
/**
 * Los Adapters son el puente entre los motores de física existentes
 * (VibeMovementManager, LiquidEngine) y la capa Aether V2.
 *
 * VMMAdapter:          VibeMovementManager → IKineticNodeData intents (pan/tilt)
 * LiquidImpactAdapter: LiquidEngine → IImpactNodeData intents (dimmer zonal)
 * LiquidColorAdapter:  LiquidEngine → IColorNodeData intents (rgb tintado)
 *
 * Uso:
 * ```ts
 * import { VMMAdapter, LiquidImpactAdapter, LiquidColorAdapter } from 'core/aether'
 *
 * const vmmAdapter    = new VMMAdapter()
 * const impactAdapter = new LiquidImpactAdapter()
 * const colorAdapter  = new LiquidColorAdapter()
 *
 * // En patch-time, opcionalmente fijar epicentro:
 * impactAdapter.setEpicenter(0, 3, 0)   // 3m hacia el fondo del stage
 * colorAdapter.setEpicenter(0, 3, 0)
 * ```
 */
export { VMMAdapter, LiquidImpactAdapter, LiquidColorAdapter } from './adapters';
// ---------------------------------------------------------------------------
// EGRESS — WAVE 4557: LA ADUANA AETHER (Safety Middleware)
// ---------------------------------------------------------------------------
export { AetherSafetyMiddleware } from './egress';
