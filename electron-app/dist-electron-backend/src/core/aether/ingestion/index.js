/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 AETHER MATRIX — INGESTION MODULE BARREL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3507: THE SPATIAL GENESIS (F1)
 *
 * Puerta de entrada única al subsistema de ingesta:
 * FixtureDefinition legacy → IDeviceDefinition Aether V2.
 *
 * Pipeline completo de uso:
 * ```ts
 * import { NodeExtractionPipeline, SpatialRegistrar } from 'core/aether/ingestion'
 *
 * const pipeline   = new NodeExtractionPipeline()
 * const registrar  = new SpatialRegistrar({ petalRadiusM: 0.12 })
 *
 * // Cuando el usuario arrastra un fixture al Stage:
 * const deviceDef  = pipeline.extract(fixtureDef, address, universe, zone)
 * registrar.register(deviceDef, fixtureV2.position, orchestrator)
 * ```
 *
 * @module core/aether/ingestion
 * @version WAVE 3507
 */
export { NodeExtractionPipeline } from './NodeExtractionPipeline';
export { SpatialRegistrar, } from './SpatialRegistrar';
