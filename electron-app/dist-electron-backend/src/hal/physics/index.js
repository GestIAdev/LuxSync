/**
 * 🏛️ WAVE 205: Physics Module Exports
 * WAVE 253: Added StereoPhysics exports with named classes
 * WAVE 290.3: Added technoStereoPhysics singleton
 * WAVE 1011: HIGH VOLTAGE - RockStereoPhysics2 replaces legacy
 * WAVE 1031: THE PHOTON WEAVER - Laser & Washer physics
 * WAVE 1044: THE DEEP FIELD - Chill ecosystem rewrite
 * WAVE 2401: THE LIQUID STEREO - 7-band engine + LiquidEnvelope
 * WAVE 3450: THE AMBIENT REBIRTH - ChillAmbientEngine, legacy purge
 */
export * from './PhysicsEngine';
// ⚰️ WAVE 3450 THE AMBIENT REBIRTH: TechnoStereoPhysics, LatinoStereoPhysics, RockStereoPhysics2
// movidos a _legacy_archive. Los paths de SeleneLux (techno/rock/latino) importan directamente.
// 🧘 WAVE 3450: EL NUEVO CEREBRO ZEN — Motor ambiental sin FFT, sin océano, puro tiempo
export { ChillAmbientEngine, chillAmbientEngine, } from './ChillAmbientEngine';
// 🎸 WAVE 3450: Stubs de compatibilidad — los legacy fallbacks de SeleneLux
// (techno/rock/latino) siguen importando desde _legacy_archive directamente si se activan.
// El barrel ya no los re-exporta para no contaminar el árbol de módulos limpio.
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
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 2411: THE LIQUID STEREO - 7-Band Omni-Liquid Engine + Profiles
// ═══════════════════════════════════════════════════════════════════════════
//
// LiquidEnvelope: Abstracción universal de banda (1 clase, N instancias)
// LiquidStereoPhysics: Motor de 7 zonas, parametrizado por ILiquidProfile
// Profiles: TECHNO_PROFILE (default), futuro: ROCK, LATINO, CHILL...
// ═══════════════════════════════════════════════════════════════════════════
export { LiquidEnvelope, } from './LiquidEnvelope';
export { LiquidStereoPhysics, liquidStereoPhysics, } from './LiquidStereoPhysics';
// 🌊 WAVE 2429: THE A/B FOUNDATION — Omni-Liquid Engine (Base + 4.1 + 7.1)
export { LiquidEngineBase } from './LiquidEngineBase';
export { LiquidEngine71, liquidEngine71 } from './LiquidEngine71';
export { LiquidEngine41, liquidEngine41 } from './LiquidEngine41';
// 🌊 WAVE 2434: TELEMETRY ENGINE — Drop-in replacement de liquidEngine41 para captura de datos
export { LiquidEngine41Telemetry, latinoEngine41Telemetry } from './LiquidEngine41Telemetry';
export { TECHNO_PROFILE, LATINO_PROFILE, POPROCK_PROFILE, PROFILE_REGISTRY, DEFAULT_LIQUID_PROFILE } from './profiles';
