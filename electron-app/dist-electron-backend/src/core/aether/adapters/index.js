/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AETHER MATRIX — ADAPTERS BARREL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WAVE 3508: THE BLOOD & MUSCLE — Fase 2 Acoplamiento de Motores
 * WAVE 3516.3: COLOR DECOUPLING — Separación de responsabilidades
 * WAVE 3516.4: OPTIC & ELEMENTAL BRIDGES — BeamAdapter + AtmosphereAdapter
 *
 * Exporta todos los adapters del módulo Aether.
 * Los adapters son el puente entre los motores de física existentes
 * (VMM, LiquidEngine) y la capa Aether V2 (NodeGraph + IntentBus).
 *
 * Cada adapter tiene responsabilidad única (SOLID):
 * - ImpactAdapter: IMPACT family (dimmers, strobes)
 * - ColorAdapter: COLOR family (wash LED, PARs tintados)
 * - VMMAdapter: KINETIC family (movimiento de cabezas)
 * - BeamAdapter: BEAM family (gobos, prismas, zoom, focus)
 * - AtmosphereAdapter: ATMOSPHERE family (fog, haze, fan, spark, pyro)
 *
 * @module core/aether/adapters
 */
export { VMMAdapter } from './KineticAdapter';
export { ImpactAdapter as LiquidImpactAdapter } from './ImpactAdapter';
export { ColorAdapter, ColorAdapter as LiquidColorAdapter } from './ColorAdapter';
export { BeamAdapter } from './BeamAdapter';
export { AtmosphereAdapter } from './AtmosphereAdapter';
export { ChronosAetherAdapter } from './ChronosAetherAdapter';
export { HephaestusAetherAdapter } from './HephaestusAetherAdapter';
