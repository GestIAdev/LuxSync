/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2411: TECHNO INDUSTRIAL PROFILE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extraído 1:1 del motor LiquidStereoPhysics WAVE 2408M+2408N.
 * Cada valor está documentado con la WAVE de origen y el test de referencia.
 *
 * Perfil de referencia: Boris Brejcha, Charlotte de Witte, Amelie Lens.
 * Calibrado con Monte Carlo (WAVE 2407b) + logs de producción real.
 *
 * ESTE PERFIL ES EL DEFAULT. El singleton global lo usa si no se pasa nada.
 *
 * @module hal/physics/profiles/techno
 * @version WAVE 2411 — THE ARCHITECTURE FORGE
 */

import type { ILiquidProfile } from './ILiquidProfile'

export const TECHNO_PROFILE: ILiquidProfile = {
  id: 'techno-industrial',
  name: 'Techno Industrial',

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — Valores exactos de LiquidStereoPhysics pre-2411
  // ═══════════════════════════════════════════════════════════════

  // Front L — El Océano de Subgraves (WAVE 2407b Monte Carlo)
  envelopeSubBass: {
    name: 'Front L (SubBass Groove)',
    gateOn: 0.12,
    boost: 3.0,
    crushExponent: 2.6,
    decayBase: 0.40,
    decayRange: 0.15,
    maxIntensity: 0.72,
    squelchBase: 0.04,
    squelchSlope: 0.55,
    ghostCap: 0.06,
    gateMargin: 0.01,
  },

  // Front R — El Francotirador (WAVE 2415: Monte Carlo Kick Calibration)
  // Problema: decay 0.12 dejaba tail visible de 0.15-0.18 en frames garbage.
  // Solución: decay 0.04 → 0.75×0.04=0.03 (debajo de fadeZone 0.08, invisible).
  // crush 0.6 expansivo: asegura que bass 0.70+ siempre sature al maxI.
  // boost 3.0: sweet spot para kicks débiles sin oversaturar los fuertes.
  envelopeKick: {
    name: 'Front R (Kick Sniper)',
    gateOn: 0.15,
    boost: 3.0,
    crushExponent: 0.6,
    decayBase: 0.04,
    decayRange: 0.10,
    maxIntensity: 0.85,
    squelchBase: 0.03,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Mover R — El Coro / Voces (WAVE 2419 MONTE CARLO RIGHT HEMISPHERE)
  // gateOn 0.15→0.01, boost 2.2→1.5, crush 1.5→1.5, decay 0.65→0.70
  // maxI 0.65→0.80, squelch 0.06→0.02, squelchSlope 0.45→0.10
  envelopeVocal: {
    name: 'Mover R (Vocal & Synth Wash)',
    gateOn: 0.01,
    boost: 1.5,
    crushExponent: 1.5,
    decayBase: 0.70,
    decayRange: 0.05,
    maxIntensity: 0.80,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Back R — El Látigo / Percussion Slap (WAVE 2427 TRANSIENT SHAPER)
  // rawRight = trebleDelta×4: el ruido de fondo tiene delta≈0 (señal continua), los transitories arrancan.
  // gateOn 0.15: cualquier salto brusco del treble lo activa
  // gateOff 0.02: apagado inmediato tras el impacto
  envelopeSnare: {
    name: 'Back R (Percussion Slap)',
    gateOn: 0.15,
    boost: 2.0,
    crushExponent: 1.0,
    decayBase: 0.05,
    decayRange: 0.15,
    maxIntensity: 0.80,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Atmósfera (WAVE 2417: MONTE CARLO RESURRECTION)
  // gateOn 0.10→0.02 (señal ~0.14 pasa), boost 4.5→5.0, decay 0.60→0.75 (colchón)
  // crush 1.2→1.0 (lineal), decayRange 0.15→0.03 (morph sutil)
  envelopeHighMid: {
    name: 'Back L (Mid Synths)',
    gateOn: 0.02,
    boost: 5.0,
    crushExponent: 1.0,
    decayBase: 0.75,
    decayRange: 0.03,
    maxIntensity: 1.0,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.05,
    gateMargin: 0.005,
  },

  // Mover L — Melodías tonales (WAVE 2417: MONTE CARLO RESURRECTION)
  // gateOn 0.14→0.02, boost 8.0→4.0 (ML menos agresivo), decay 0.50→0.78
  // crush 1.2→1.0, decayRange 0.20→0.03
  envelopeTreble: {
    name: 'Mover L (Tonal Melodies)',
    gateOn: 0.02,
    boost: 4.0,
    crushExponent: 1.0,
    decayBase: 0.78,
    decayRange: 0.03,
    maxIntensity: 1.0,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.04,
    gateMargin: 0.005,
  },

  // ═══════════════════════════════════════════════════════════════
  // BACK R: SCHWARZENEGGER (WAVE 2408M)
  // ═══════════════════════════════════════════════════════════════

  percMidSubtract: 1.0,   // WAVE 2424: Escudo Absoluto — relación 1:1, ningún sinte puede engañar al Látigo
  percGate: 0.01,          // WAVE 2419: 0.14→0.01 (rIn maxeaba 0.155, gate era muro)
  percBoost: 5.0,          // WAVE 2419: 8.0→5.0
  percExponent: 0.5,       // WAVE 2419: 1.2→0.5 (raíz cuadrada, suaviza transitorio)

  // ═══════════════════════════════════════════════════════════════
  // MOVER R (VOCES): BASS SUBTRACTOR (WAVE 2408g)
  // ═══════════════════════════════════════════════════════════════

  bassSubtractBase: 0.65,
  bassSubtractRange: 0.45,

  // ═══════════════════════════════════════════════════════════════
  // BACK L (MID SYNTHS): Cross-filter (WAVE 2411 → WAVE 2430 PARAMETRIZADO)
  // Original hardcodeado: mid×0.6 - bass×0.2
  // Nuevo: lowMid×backLLowMidWeight + mid×backLMidWeight - treble×backLTrebleSub
  // Para Techno: lowMid×0.0 + mid×0.6 - treble×0.0 (bass×0.2 se pierde, era marginal)
  // NOTA: El original restaba bass, el nuevo resta treble. Para mantener exactitud,
  // usamos lowMid=-0.2 como proxy (lowMid ≈ bass en techno). Pero lowMid no existe
  // como peso negativo limpio. Solucón pragmática: mid×0.6, el resto en 0.
  // ═══════════════════════════════════════════════════════════════

  backLLowMidWeight: 0.0,   // WAVE 2430: original no usaba lowMid
  backLMidWeight: 0.6,      // WAVE 2430: original = mid×0.6
  backLTrebleSub: 0.0,      // WAVE 2430: original no restaba treble
  backLBassSub: 0.2,        // WAVE 2430: original = -bass×0.2

  // ═══════════════════════════════════════════════════════════════
  // MOVER L (MELODÍAS): Cross-filter + tonal gate (WAVE 2411 → 2430)
  // Original hardcodeado: mid×0.4 + highMid×1.0 - bass×0.1
  // Nuevo: highMid×moverLHighMidWeight + treble×moverLTrebleWeight - bass×0.1
  // Para Techno: highMid×1.0 + treble×0.0 (mid×0.4 se mueve a highMid)
  // ═══════════════════════════════════════════════════════════════

  moverLHighMidWeight: 1.0,   // WAVE 2430: original = highMid×1.0
  moverLTrebleWeight: 0.0,    // WAVE 2430: original no usaba treble directo aquí
  moverLMidWeight: 0.4,       // WAVE 2430: original = mid×0.4
  moverLTonalThreshold: 0.40,

  // ═══════════════════════════════════════════════════════════════
  // MOVER R (VOCES): resta de treble para sibilantes
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: 0.3,

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE
  // ═══════════════════════════════════════════════════════════════

  sidechainThreshold: 0.1,
  sidechainDepth: 0.30,  // WAVE 2412: ducking suave — techno tiene graves continuos, no asfixiar movers
  snareSidechainDepth: 0.15,  // WAVE 2420: 0.80→0.15 (liberamos Mover R — la guillotina era fratricida)

  // ═══════════════════════════════════════════════════════════════
  // STROBE (God Mode exacto)
  // ═══════════════════════════════════════════════════════════════

  strobeThreshold: 0.80,
  strobeDuration: 30,
  strobeNoiseDiscount: 0.80,

  // ═══════════════════════════════════════════════════════════════
  // MODES
  // ═══════════════════════════════════════════════════════════════

  harshnessAcidThreshold: 0.60,
  flatnessNoiseThreshold: 0.70,
  apocalypseHarshness: 0.55,
  apocalypseFlatness: 0.55,

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION
  // ═══════════════════════════════════════════════════════════════

  kickEdgeMinInterval: 80,
  kickVetoFrames: 0,    // WAVE 2419: 5→0 (veto ON 48% del tiempo, asfixiaba Mover R)
}
