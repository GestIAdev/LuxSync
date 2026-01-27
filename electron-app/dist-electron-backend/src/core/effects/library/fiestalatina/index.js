/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎉 FIESTA LATINA - EFFECT LIBRARY INDEX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680: THE ARSENAL
 * WAVE 1004.3: FULL EXPORT - Todos los efectos del arsenal latino
 * WAVE 1004.4: THE LATINO LADDER - 14 efectos, 7 zonas energéticas
 *
 * Exporta TODOS los efectos del arsenal Fiesta Latina.
 *
 * THE LATINO LADDER (7 ZONAS):
 * ┌────────────────┬───────────┬─────────────────────────────────────────┐
 * │ ZONA           │ AGGRESSION│ EFECTOS                                 │
 * ├────────────────┼───────────┼─────────────────────────────────────────┤
 * │ 1. SILENCE     │ 0.00-0.15 │ ghost_breath, amazon_mist               │
 * │ 2. VALLEY      │ 0.15-0.30 │ cumbia_moon, tidal_wave                 │
 * │ 3. AMBIENT     │ 0.30-0.45 │ corazon_latino, strobe_burst            │
 * │ 4. GENTLE      │ 0.45-0.60 │ clave_rhythm, tropical_pulse            │
 * │ 5. ACTIVE      │ 0.60-0.75 │ glitch_guaguanco, machete_spark         │
 * │ 6. INTENSE     │ 0.75-0.90 │ salsa_fire, solar_flare                 │
 * │ 7. PEAK        │ 0.90-1.00 │ latina_meltdown, strobe_storm           │
 * └────────────────┴───────────┴─────────────────────────────────────────┘
 *
 * @module core/effects/library/fiestalatina
 * @version WAVE 680, 1004.3, 1004.4
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🎉 FIESTA LATINA EFFECTS - THE LATINO LADDER (14 efectos)
// ═══════════════════════════════════════════════════════════════════════════
// � ZONA 1: SILENCE (0-15%)
export { GhostBreath, createGhostBreath } from './GhostBreath';
export { AmazonMist } from './AmazonMist'; // 🆕 WAVE 1004.4
// 🌙 ZONA 2: VALLEY (15-30%)
export { CumbiaMoon } from './CumbiaMoon';
export { TidalWave } from './TidalWave';
// 💓 ZONA 3: AMBIENT (30-45%)
export { CorazonLatino } from './CorazonLatino';
export { StrobeBurst } from './StrobeBurst';
// 🥁 ZONA 4: GENTLE (45-60%)
export { ClaveRhythm } from './ClaveRhythm';
export { TropicalPulse } from './TropicalPulse';
// ⚔️ ZONA 5: ACTIVE (60-75%)
export { GlitchGuaguanco } from './GlitchGuaguanco';
export { MacheteSpark } from './MacheteSpark'; // 🆕 WAVE 1004.4
// 🔥 ZONA 6: INTENSE (75-90%)
export { SalsaFire } from './SalsaFire';
export { SolarFlare, createSolarFlare, SOLAR_FLARE_DEFAULT_CONFIG } from './SolarFlare';
// 💥 ZONA 7: PEAK (90-100%)
export { LatinaMeltdown } from './LatinaMeltdown';
export { StrobeStorm, createStrobeStorm } from './StrobeStorm';
