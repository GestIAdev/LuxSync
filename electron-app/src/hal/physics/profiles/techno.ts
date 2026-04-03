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

  // Front L — El Océano de Subgraves (WAVE 2437: Monte Carlo co-optimizado con envelopeKick)
  // gateOn 0.12→0.0656 — responde a subgraves más débiles, groove más lleno.
  // boost 3.5→2.7 — menos agresivo, equilibrio con fR a maxI=1.0.
  // maxIntensity 0.70→0.529 — fL cede protagonismo al kick (fR=1.0).
  // squelchBase 0.04→0.0613 — squelch ligeramente más alto para limpiar el piso.
  envelopeSubBass: {
    name: 'Front L (SubBass Groove)',
    gateOn: 0.0656,
    boost: 2.7054,
    crushExponent: 2.4156,
    decayBase: 0.2218,
    decayRange: 0.166,
    maxIntensity: 0.5291,
    squelchBase: 0.0613,
    squelchSlope: 0.5788,
    ghostCap: 0.0357,
    gateMargin: 0.0288,
  },

  // Front R — El Francotirador (WAVE 2437: Monte Carlo 15k iter, fitness=756, 100% kick, 0 FP)
  // decayBase 0.04→0.0077 — el killer fix: decay ultrarrápido, fR muere entre kicks.
  // decayRange 0.10→0.0329 — rango estrecho, comportamiento uniforme.
  // gateOn 0.15→0.1098 — gate más bajo, captura kicks débiles sin abrir en basura.
  // maxIntensity 0.85→1.0 — hits al máximo, contraste máximo con el silencio.
  // squelchSlope 0.10→0.0 — sin squelch dinámico, el gate fijo es suficiente.
  // boost 3.0→3.3 — leve compensación por gate más bajo.
  envelopeKick: {
    name: 'Front R (Kick Sniper)',
    gateOn: 0.1098,
    boost: 3.3013,
    crushExponent: 0.4877,
    decayBase: 0.0077,
    decayRange: 0.0329,
    maxIntensity: 0.80,   // WAVE 2439.2 Cap de Dimmer — headroom para el slap del Snare
    squelchBase: 0.0388,
    squelchSlope: 0.0,
    ghostCap: 0.00,
    gateMargin: 0.0213,
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
    gateOn: 0.35,          // WAVE 2440.2: 0.20→0.35 — Recuperación del Rango Dinámico
                           // Click bombo (hybridSnare~0.25) muere contra el muro.
                           // Hi-hat real / clap (~0.50-0.70) atraviesa y brilla.
    boost: 3.5,            // WAVE 2440.2: 6.0→3.5 — volumen variable, no estrobo binario
    crushExponent: 1.0,
    decayBase: 0.05,
    decayRange: 0.15,
    maxIntensity: 1.0,     // WAVE 2439.5: 0.80→1.0 — el Látigo sin cap
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Atmósfera (WAVE 2417: MONTE CARLO RESURRECTION)
  // gateOn 0.10→0.02 (señal ~0.14 pasa), boost 4.5→5.0, decay 0.60→0.75 (colchón)
  // crush 1.2→1.0 (lineal), decayRange 0.15→0.03 (morph sutil)
  // WAVE 2436.2: decay 0.75→0.60 — teclados/pads techno: cortantes, no colchón.
  //              maxI 1.0→0.85 — liberar headroom para latino (groove continuo)
  envelopeHighMid: {
    name: 'Back L (Mid Synths)',
    gateOn: 0.02,
    boost: 5.0,
    crushExponent: 1.0,
    decayBase: 0.60,
    decayRange: 0.03,
    maxIntensity: 0.85,
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

  // WAVE 2438 — valores legacy, ya no usados en strict-split pero se conservan
  // para compatibilidad con el path 'default' si se cambia la estrategia.
  frontKickSidechainThreshold: 0.2,
  auraCapBase: 0.25,
  auraCapExponent: 2,

  // WAVE 2439 — METRÓNOMO/LIENZO: enrutamiento estricto para Techno 4.1.
  // Front=kick, Back=snare, Movers=todo el muro atmosférico.
  layout41Strategy: 'strict-split' as const,

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
