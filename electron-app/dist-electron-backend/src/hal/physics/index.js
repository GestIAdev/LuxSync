/**
 * 🏛️ WAVE 205: Physics Module Exports
 * WAVE 253: Added StereoPhysics exports with named classes
 * WAVE 290.3: Added technoStereoPhysics singleton
 * WAVE 1011: HIGH VOLTAGE - RockStereoPhysics2 replaces legacy
 * WAVE 1031: THE PHOTON WEAVER - Laser & Washer physics
 * WAVE 1044: THE DEEP FIELD - Chill ecosystem rewrite
 */
export * from './PhysicsEngine';
export { TechnoStereoPhysics, technoStereoPhysics } from './TechnoStereoPhysics';
// ❌ WAVE 1011: DELETED LEGACY FRANKENSTEIN
// export { RockStereoPhysics } from './RockStereoPhysics'
export { LatinoStereoPhysics } from './LatinoStereoPhysics';
// 🌌 WAVE 1044: THE DEEP FIELD - Chill Lounge Generative Ecosystem
export { calculateChillStereo, resetDeepFieldState, getDeepFieldState } from './ChillStereoPhysics';
// 🎸 WAVE 1011.5: UNIFIED ROCK PHYSICS (Lobotomized - No Subgenres)
export { RockStereoPhysics2, rockPhysics2, } from './RockStereoPhysics2';
// ═══════════════════════════════════════════════════════════════════════════
// 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Physics
// ═══════════════════════════════════════════════════════════════════════════
// 
// ARQUITECTURA ESPECTRAL COMPLETA:
// - Sub-Graves (Washers) = Sentimiento/Atmósfera
// - Medios (Movers/PARs) = Ritmo/Baile
// - Ultra-Agudos (Láseres) = Detalle/Tecnología
// ═══════════════════════════════════════════════════════════════════════════
// 🟢 LASER PHYSICS - "La Cirugía de Luz"
// Input: ultraAir (16-22kHz) + clarity
// Comportamientos: LIQUID_SKY (clean) | SPARKLE_RAIN (harsh)
export { LaserPhysics, laserPhysics, } from './LaserPhysics';
// 🎨 WASHER PHYSICS - "El Lienzo de Fondo"
// Input: subBass (20-60Hz) + texture
// Comportamientos: BREATHING_WALL (warm) | REACTIVE_STROBE (harsh)
export { WasherPhysics, washerPhysics, } from './WasherPhysics';
