/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2433: LATINO PROFILE — El ADN de la Fiesta (MONTE CARLO STRESS TEST)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extraído del alma de LatinoStereoPhysics.ts (WAVE 1004.1 → WAVE 2200).
 * Convertido en pura parametría — cero lógica, cero funciones.
 *
 * Filosofía acústica:
 *   - Reggaetón/Salsa son ELÁSTICOS: decays largos, la luz respira con el ritmo.
 *   - El patrón 3-3-2 latino NO es 4×4 rígido: kick veto = 0, sidechain suave.
 *   - "El Galán" (Mover L): Caza mid+highMid (congas, voces masculinas, tumbao).
 *   - "La Dama" (Mover R): Caza treble casi exclusivo (trompetas, güira, siseos).
 *   - Back PARs: Dembow pesado — el TAcka del TÚN-tacka-TÚN-tacka.
 *   - Front PARs: El TÚN — bombo gordo con decay suave (no staccato techno).
 *
 * Referencia: Bad Bunny, Daddy Yankee, Marc Anthony, El Gran Combo.
 * Calibrado contra constantes de LatinoStereoPhysics WAVE 2192-2200.
 *
 * @module hal/physics/profiles/latino
 * @version WAVE 2430 — THE LATINO PROFILE
 */

import type { ILiquidProfile } from './ILiquidProfile'

export const LATINO_PROFILE: ILiquidProfile = {
  id: 'latino-fiesta',
  name: 'Latino Fiesta',

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — La Pareja de Baile y su Orquesta
  // ═══════════════════════════════════════════════════════════════

  // Front L — SubBass Groove (El TÚN del dembow)
  // Latino: bombo más gordo y sostenido que techno. El reggaetón vive del
  // bajo continuo. Gate bajo para que entre todo, decay alto para que respire.
  // WAVE 2199: clon de Techno FRONT_PAR_GATE=0.48 → aquí más permisivo en gate
  // porque el bajo latino es más melódico y menos percusivo.
  envelopeSubBass: {
    name: 'Front L (TÚN del Dembow)',
    gateOn: 0.15,          // WAVE 2434: Monte Carlo 530 frames reales 4.1 — winner (0% leak, 30.6% picos) vs 0.22 que en 4.1 era demasiado alto (RMS mezclado, no separado como 7.1)
    boost: 2.5,            // Menos boost que techno (3.0) — no queremos clipear
    crushExponent: 2.0,    // Más suave que techno (2.6) — curva menos agresiva
    decayBase: 0.30,       // WAVE 2434: Monte Carlo winner — más rápido que 0.38, golpe más limpio sin cola en el dembow
    decayRange: 0.10,
    maxIntensity: 0.75,
    squelchBase: 0.03,
    squelchSlope: 0.50,
    ghostCap: 0.08,        // Más ghost que techno — el bajo latino nunca se apaga del todo
    gateMargin: 0.01,
  },

  // Front R — Kick Edge (Bombo Terminator — WAVE 2199 clon)
  // Latino: el kick es menos staccato que techno. FRONT_PAR_GATE=0.48,
  // BASS_VITAMIN_BOOST=1.8. Decay más largo para que el golpe se sienta gordo.
  envelopeKick: {
    name: 'Front R (Kick Latino)',
    gateOn: 0.18,          // WAVE 2199: 0.48 hysteresis → aquí gate de envelope
    boost: 2.5,            // WAVE 2199: FRONT_PAR_GAIN=2.0 + vitamina
    crushExponent: 0.8,    // Más suave que techno (0.6) — menos compresión
    decayBase: 0.08,       // Más largo que techno (0.04) — kick gordo, no needle
    decayRange: 0.08,
    maxIntensity: 0.80,
    squelchBase: 0.03,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Mover R — "La Dama" (Treble / Trompetas / Güira / Siseos)
  // WAVE 1004.1: MOVER_R_GATE=0.18, MOVER_R_ATTACK=0.80, MOVER_R_DECAY=0.50
  // WAVE 2195: Schwarzenegger suavizado — MOVER_R_GAIN=4.0
  // La Dama caza treble casi exclusivo. El cross-filter en la Base ruta
  // treble×0.9 + highMid×0.1 hacia este envelope (ver moverRTrebleSub).
  envelopeVocal: {
    name: 'Mover R (La Dama — Brillo)',
    gateOn: 0.25,          // WAVE 2434: Monte Carlo winner — treble avg real=0.187 en captura 4.1; con 0.32 La Dama nunca disparaba; 0.25 balanceado: silencio en susurros (treble<0.18), canta con fuerza real (treble>0.25)
    boost: 4.0,            // WAVE 2195: protocolo Schwarzenegger
    crushExponent: 1.2,    // Ligeramente convexa — suaviza los picos
    decayBase: 0.50,       // WAVE 2195: líquido no estrobo
    decayRange: 0.05,
    maxIntensity: 0.85,
    squelchBase: 0.03,
    squelchSlope: 0.15,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Back R — El Látigo del Dembow (Snare/Hi-hat — WAVE 2199/2200)
  // WAVE 2200: BACK_PAR_GATE=0.45, BACK_PAR_GAIN=5.0, BACK_PAR_DECAY=0.25
  // El TAcka del reggaetón. Decay 0.42 (WAVE 2200) — más pesado que techno
  // porque el dembow tiene un swing más ancho.
  // NOTA: En el Omni-Liquid, Back R usa el Transient Shaper (trebleDelta×4).
  // El decay largo del envelope suaviza las ráfagas de transitories.
  envelopeSnare: {
    name: 'Back R (TAcka del Dembow)',
    gateOn: 0.28,          // WAVE 2433: el transient shaper entrega trebleDelta×4; en 7.1 el ruido de fondo tiene delta≈0.05-0.10 (gateOn 0.12 lo activaba); el latigazo real de caja llega a delta>0.35→×4=1.4; sweet spot 0.28 = muro que ignora respiración ambiental y caza solo el TAcka limpio
    boost: 3.5,            // Moderado (techno=2.0) — más presencia para el hi-hat
    crushExponent: 1.0,    // Lineal — sin distorsión
    decayBase: 0.25,       // WAVE 2200: decay pesado del dembow
    decayRange: 0.10,      // Más rango que techno — morph afecta más
    maxIntensity: 0.85,
    squelchBase: 0.03,
    squelchSlope: 0.15,
    ghostCap: 0.04,        // Ghost sutil — el hi-hat siempre susurra
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Teclados / Congas bajas
  // En latino, este canal captura el tumbao del bajo melódico y las
  // congas graves. Más presencia mid que techno, menos substracción de bass
  // porque el bajo latino ES la melodía.
  envelopeHighMid: {
    name: 'Back L (Tumbao & Teclados)',
    gateOn: 0.04,          // Más permisivo que techno (0.02) — sutil
    boost: 4.0,            // Menos que techno (5.0) — no competir con movers
    crushExponent: 1.0,
    decayBase: 0.65,       // Más corto que techno (0.75) — más pulso, menos colchón
    decayRange: 0.05,
    maxIntensity: 0.90,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.06,        // Ghost más alto — el tumbao siempre late
    gateMargin: 0.005,
  },

  // Mover L — "El Galán" (Mid/HighMid — Congas, Voces Masculinas, Tumbao)
  // WAVE 1004.1: MOVER_L_GATE=0.28, MOVER_L_ATTACK=0.65, MOVER_L_DECAY=0.25
  // MOVER_GAIN=1.50, MOVER_TREBLE_REJECTION=0.30
  // El Galán busca la zona media — voces, congas, piano.
  // El cross-filter ruta highMid×0.8 + treble×0.2 (ver moverLHighMidWeight).
  envelopeTreble: {
    name: 'Mover L (El Galán — Conga & Voz)',
    gateOn: 0.30,          // WAVE 2433: en 7.1 highMid separado tiene ruido de transición ≈0.14-0.22; platillo real highMid+treble sumado ≥0.28; sweet spot 0.30 caza platillo limpio sin estática de transición
    boost: 2.5,            // WAVE 1004.1: MOVER_GAIN×1.67 ajustado
    crushExponent: 1.0,
    decayBase: 0.45,       // Más elástico que techno (0.78) — PERO más corto
    decayRange: 0.05,      // que el decay original 0.25 porque el envelope tiene
    maxIntensity: 0.85,    // su propio squelch que simula la histéresis
    squelchBase: 0.04,     // Histéresis simulada — piso de voz
    squelchSlope: 0.15,
    ghostCap: 0.05,        // Ghost medio — El Galán nunca duerme del todo
    gateMargin: 0.01,
  },

  // ═══════════════════════════════════════════════════════════════
  // BACK R: SCHWARZENEGGER → TRANSIENT SHAPER (trebleDelta×4)
  // En latino el transient shaper caza el hi-hat y las claves.
  // Gate más permisivo porque el swing del dembow es irregular.
  // ═══════════════════════════════════════════════════════════════

  percMidSubtract: 0.6,   // Menos agresivo que techno (1.0) — el mid latino es aliado
  percGate: 0.019,        // WAVE 2434: Monte Carlo winner — con 0.005 falseAlarmRate=53% (ruido de fondo disparando TAcka); 0.019 aísla el TAcka real (percRaw>0.35, hitRate=100%)
  percBoost: 4.0,         // Moderado (techno=5.0) — no saturar
  percExponent: 0.6,      // Ligeramente más convexo que techno (0.5)

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("La Dama"): Cross-filter hacia TREBLE PURO
  // La Dama en latino caza trompetas, güira, platillos, siseos.
  // bassSubtract bajo porque el bajo latino no contamina agudos tanto.
  // ═══════════════════════════════════════════════════════════════

  bassSubtractBase: 0.30,    // Menos resta que techno (0.65) — el bajo no estorba
  bassSubtractRange: 0.20,   // Menos modulación — estable

  // ═══════════════════════════════════════════════════════════════
  // BACK L (Tumbao): Cross-filter coefficients
  // input = max(0, lowMid × 0.7 + mid × 0.6 - treble × 0.15)
  // Más lowMid que techno — el tumbao vive ahí. Menos resta de treble.
  // ═══════════════════════════════════════════════════════════════

  backLLowMidWeight: 0.70,   // MÁS que techno (0.0) — tumbao
  backLMidWeight: 0.60,      // MÁS que techno (0.6) — congas graves
  backLTrebleSub: 0.15,      // Resta de treble (techno=0.0)
  backLBassSub: 0.0,         // CERO — el bajo latino ES la melodía, no contamina

  // ═══════════════════════════════════════════════════════════════
  // MOVER L ("El Galán"): Cross-filter + tonal gate
  // input = max(0, highMid × 0.8 + treble × 0.2) × isTonal
  // Más highMid que techno — El Galán caza congas y voces, no melodías agudas.
  // Tonal threshold más alto — el latino es más "ruidoso" armónicamente.
  // ═══════════════════════════════════════════════════════════════

  moverLHighMidWeight: 0.80,    // MÁS que techno (1.0) — congas/voz masculina
  moverLTrebleWeight: 0.20,     // MÁS que techno (0.0) — un poco de brillo
  moverLMidWeight: 0.30,        // Mid melódico — voz masculina, piano
  moverLTonalThreshold: 0.45,   // WAVE 2434: Monte Carlo winner — 0.55 silenciaba El Galán (avgMoverL≈0); 0.45 tonalFraction=41% con presencia equilibrada

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("La Dama"): Resta de treble para sibilantes
  // En latino La Dama QUIERE treble — menos resta que techno.
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: 0.10,    // MENOS que techno (0.3) — La Dama abraza el brillo

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE — MUCHO MÁS SUAVE
  // El patrón 3-3-2 latino no es 4×4 rígido. Un sidechain agresivo
  // asfixia a los movers en los beats "and" de la síncopa.
  // ═══════════════════════════════════════════════════════════════

  sidechainThreshold: 0.15,     // Ligeramente más alto que techno (0.1)
  sidechainDepth: 0.12,         // MUCHO MENOS que techno (0.30) — no asfixiar
  snareSidechainDepth: 0.05,    // Mínimo — el snare latino es compañero, no rival

  // ═══════════════════════════════════════════════════════════════
  // STROBE — Menos agresivo en latino (es fiesta, no industrial)
  // ═══════════════════════════════════════════════════════════════

  strobeThreshold: 0.85,        // Más alto que techno (0.80) — solo picos extremos
  strobeDuration: 25,           // Más corto que techno (30) — flash, no martillo
  strobeNoiseDiscount: 0.85,    // Menos descuento que techno (0.80)

  // ═══════════════════════════════════════════════════════════════
  // MODES — Acid/Noise no aplican mucho en latino, pero los dejamos
  // con umbrales altos para que casi nunca se activen.
  // ═══════════════════════════════════════════════════════════════

  harshnessAcidThreshold: 0.75,   // MÁS alto que techno (0.60) — raro en latino
  flatnessNoiseThreshold: 0.80,   // MÁS alto que techno (0.70) — raro en latino
  apocalypseHarshness: 0.70,      // MÁS alto que techno (0.55) — solo en caos real
  apocalypseFlatness: 0.70,       // MÁS alto que techno (0.55)

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION — Permisivo para el 3-3-2
  // ═══════════════════════════════════════════════════════════════

  kickEdgeMinInterval: 60,   // MÁS corto que techno (80) — el dembow es rápido
  kickVetoFrames: 0,         // CERO — la síncopa 3-3-2 no puede aguantar vetos

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2435: OVERRIDES 4.1 — Compensación de compactación max()
  //
  // En 4.1, routeZones() hace backPar = max(backLeft, backRight).
  // - backLeft (tumbao) = continuo, avg ≈ 0.15-0.30
  // - backRight (TAcka) = impulsivo, avg ≈ 0.02, picos ≈ 0.70
  //
  // Sin overrides: el tumbao sostiene backPar encendido SIEMPRE,
  // asfixiando el contraste percusivo del TAcka.
  //
  // Solución: subir gateOn del tumbao (backL) para que solo responda
  // a mid REAL, y bajar decay para que suelte rápido dando paso al TAcka.
  // También subir gateOn del SubBass porque en 4.1 el RMS está mezclado
  // (no separado como en 7.1) y el gate original de 0.15 captura ruido.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    // Back L (Tumbao & Teclados) — el principal problema de compactación
    // En 7.1 gateOn=0.04 es correcto (va a hardware separado).
    // En 4.1 ese tumbao compite via max() con el TAcka.
    envelopeHighMid: {
      gateOn: 0.18,      // 0.04→0.18: ignora mid ambiente, solo tumbao REAL
      decayBase: 0.40,   // 0.65→0.40: suelta rápido, da paso al TAcka impulsivo
      ghostCap: 0.02,    // 0.06→0.02: el tumbao no debe latir en background del backPar
    },

    // Front L (SubBass) — RMS mezclado en 4.1
    // WAVE 2434 Monte Carlo: winner con 0% leak en captura 4.1
    envelopeSubBass: {
      decayBase: 0.25,   // 0.30→0.25: golpe más limpio sin cola
    },

    // Back R (TAcka) — el snare envelope se beneficia de un boost extra
    // porque ahora compite con el tumbao dentro del mismo backPar
    envelopeSnare: {
      boost: 4.5,        // 3.5→4.5: más presencia para ganar el max() al tumbao
    },

    // Sidechain más suave — en 4.1 el frontPar compactado tiene más energía
    // constante que en 7.1 (max de frontL y frontR), así que un sidechain
    // igual de agresivo asfixiaría los movers permanentemente
    sidechainDepth: 0.08,     // 0.12→0.08: menos ducking para compensar frontPar elevado
  },
}
