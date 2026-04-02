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
  // WAVE 2436.2: decay 0.30→0.88 — latino GROOVE: la luz RESPIRA con el ritmo.
  //              El bajo del reggaeton/salsa es continuo y melódico, no staccato.
  //              boost 2.5→2.0 — menos pico, más sustain (la ola, no el flash).
  //              maxI 0.75→0.80 — techo más alto para el groove continuo.
  //              ghostCap 0.08→0.10 — el bajo latino NUNCA se apaga del todo.
  envelopeSubBass: {
    name: 'Front L (TÚN del Dembow)',
    gateOn: 0.15,
    boost: 2.0,
    crushExponent: 2.0,
    decayBase: 0.88,
    decayRange: 0.05,
    maxIntensity: 0.80,
    squelchBase: 0.03,
    squelchSlope: 0.50,
    ghostCap: 0.10,
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
    gateOn: 0.15,          // WAVE 2436.2: 0.25→0.15 — el 0.25 era muro para reggaeton (treble avg=0.187); 0.15 deja pasar trompetas/güira real sin abrir a ruido de fondo
    boost: 4.0,            // WAVE 2195: protocolo Schwarzenegger
    crushExponent: 1.2,    // Ligeramente convexa — suaviza los picos
    decayBase: 0.70,       // WAVE 2436.2: 0.50→0.70 — La Dama baila con sustain latino
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
  // WAVE 2436.2: decay 0.25→0.45 — el TAcka del dembow tiene swing ancho.
  //              La caja del reggaeton RESPIRA más que el snare techno.
  envelopeSnare: {
    name: 'Back R (TAcka del Dembow)',
    gateOn: 0.28,
    boost: 3.5,
    crushExponent: 1.0,
    decayBase: 0.45,
    decayRange: 0.10,
    maxIntensity: 0.85,
    squelchBase: 0.03,
    squelchSlope: 0.15,
    ghostCap: 0.04,
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Teclados / Congas bajas
  // En latino, este canal captura el tumbao del bajo melódico y las
  // congas graves. Más presencia mid que techno, menos substracción de bass
  // porque el bajo latino ES la melodía.
  // WAVE 2436.2: decay 0.65→0.92 — el tumbao RESPIRA. Back L es el corazón
  //              rítmico del latino — congas, bajo melódico, teclados.
  //              boost 4.0→3.0 — menos pico, más sustain continuo.
  //              maxI 0.90→0.95 — headroom alto para groove perenne.
  //              ghostCap 0.06→0.08 — el tumbao SIEMPRE late.
  envelopeHighMid: {
    name: 'Back L (Tumbao & Teclados)',
    gateOn: 0.04,
    boost: 3.0,
    crushExponent: 1.0,
    decayBase: 0.92,
    decayRange: 0.03,
    maxIntensity: 0.95,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.08,
    gateMargin: 0.005,
  },

  // Mover L — "El Galán" (Mid/HighMid — Congas, Voces Masculinas, Tumbao)
  // WAVE 1004.1: MOVER_L_GATE=0.28, MOVER_L_ATTACK=0.65, MOVER_L_DECAY=0.25
  // MOVER_GAIN=1.50, MOVER_TREBLE_REJECTION=0.30
  // El Galán busca la zona media — voces, congas, piano.
  // El cross-filter ruta highMid×0.8 + treble×0.2 (ver moverLHighMidWeight).
  // WAVE 2436.2: decay 0.45→0.75 — El Galán baila con swing latino, no staccato.
  //              boost 2.5→3.5 — más presencia escénica para congas y voz.
  //              ghostCap 0.05→0.06 — El Galán nunca duerme del todo.
  envelopeTreble: {
    name: 'Mover L (El Galán — Conga & Voz)',
    gateOn: 0.30,
    boost: 3.5,
    crushExponent: 1.0,
    decayBase: 0.75,
    decayRange: 0.05,
    maxIntensity: 0.85,
    squelchBase: 0.04,
    squelchSlope: 0.15,
    ghostCap: 0.06,
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

  // WAVE 2438 — GUILLOTINA 4.1 (desactivada en latino: el groove es continuo)
  frontKickSidechainThreshold: 0,  // 0 = off
  auraCapBase: 0,                  // 0 = off (subBass tiene rienda suelta)
  auraCapExponent: 0,
  kickWindowFrames: 0,
  kickBoost: 1.0,

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
  // WAVE 2436: OVERRIDES 4.1 — Anti-Autotune + Compactación max()
  //
  // PROBLEMA 1 (WAVE 2435): compactación max()
  //   backPar = max(backLeft, backRight) → tumbao continuo asfixia TAcka.
  //
  // PROBLEMA 2 (WAVE 2436): AUTOTUNE COMO GENERADOR DE CUADRADAS
  //   El autotune aplana la voz en mid (~0.40-0.52 constante) mientras
  //   genera picos sintéticos en treble (consonantes T/K/S).
  //   → transientShaper ve trebleDelta alto + mid alto = "percusión" falsa
  //   → envelopeHighMid ve muro de mid = tumbao falso
  //   → max() junta ambos → Back PAR = monitor de voz
  //
  // CONTRAMEDIDA: percMidSubtract × 2.5 (0.6→1.5)
  //   Un hi-hat real tiene agudos SIN medios.
  //   Una voz con autotune tiene agudos CON medios.
  //   Si mid acompaña al treble spike → es voz, no percusión → cancelar.
  //
  // CONTRAMEDIDA: backL weights invertidos (mid↓ lowMid↑)
  //   El tumbao real vive en lowMid (bajo melódico profundo).
  //   La voz autotuneada vive en mid. Ignorar mid, cazar lowMid.
  //
  // CONTRAMEDIDA: envelopeTreble (El Galán) — devolver punch a movers
  //   Los muros altos de WAVE 2435 eran para compensar el desastre
  //   del autotune. Con percMidSubtract corregido, los movers pueden
  //   bajar gateOn y subir boost para recuperar presencia escénica.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    // ── ANTI-AUTOTUNE: Matar falsos latigazos en Back R ──────────
    // percMidSubtract controla cuánto mid se resta del trebleDelta
    // antes de calcular percRaw. A 1.5, si mid≈0.45 y trebleDelta≈0.03
    // → percRaw ≈ (0.03 - 0.45×1.5×factor) → aplastado a 0.
    // Un hi-hat real (mid≈0.05, trebleDelta≈0.03) sobrevive intacto.
    percMidSubtract: 1.5,  // 0.6→1.5: voz+autotune cancelada en transient shaper

    // ── TUMBAO LIMPIO: Back L ignora voz, caza bajo melódico ─────
    // backLMidWeight baja: el muro de mid del autotune ya no enciende backL
    // backLLowMidWeight sube: solo el bajo profundo mueve el tumbao
    backLMidWeight: 0.30,      // 0.60→0.30: la voz autotuneada no es tumbao
    backLLowMidWeight: 0.90,   // default→0.90: el bajo melódico profundo SÍ es tumbao

    // ── PUNCH A MOVERS: El Galán recupera presencia escénica ─────
    // WAVE 2436.2: Con percMidSubtract conectado, el anti-autotune actúa
    // en el Transient Shaper (Back R) donde debe. Los movers ya no necesitan
    // compensar con gates extremos. Gate baja para capturar congas reales.
    envelopeTreble: {
      gateOn: 0.14,        // 0.30→0.14: El Galán caza congas/voces sin muro
      boost: 4.5,          // 2.5→4.5: presencia escénica del Galán en compactación 4.1
    },

    // ── TONAL GATE: Permisivo con autotune ──────────────────────
    // flatness >0.45 (autotune) ya no debe asesinar a El Galán.
    // Con percMidSubtract activo, el autotune no contamina Back R,
    // así que El Galán puede bailar libre.
    moverLTonalThreshold: 0.60,  // 0.45→0.60: el autotune (flatness≈0.50) ya no mata

    // ── COMPACTACIÓN max() (WAVE 2435 + WAVE 2436.2) ───────────
    // Back L (Tumbao) — el base tiene decay 0.92 (groove continuo en 7.1).
    // En 4.1, max(backL, backR) haría que el tumbao asfixie al TAcka.
    // Bajamos decay para que el tumbao pulse pero suelte entre golpes.
    envelopeHighMid: {
      gateOn: 0.12,      // 0.04→0.12: ignora mid ambiente suave
      decayBase: 0.70,   // 0.92→0.70: pulsa y suelta, da paso al TAcka
      ghostCap: 0.03,    // 0.08→0.03: tumbao sutil en background del backPar
    },

    // Front L (SubBass) — el base tiene decay 0.88 (groove continuo en 7.1).
    // En 4.1 la energía RMS es más alta por compactación. Decay más corto.
    envelopeSubBass: {
      decayBase: 0.75,   // 0.88→0.75: groove pero sin saturar en 4.1
    },

    // Back R (TAcka) — boost extra para ganar el max() al tumbao
    envelopeSnare: {
      boost: 4.5,        // 3.5→4.5: más presencia para ganar el max() al tumbao
    },

    // Sidechain más suave — frontPar compactado tiene más energía constante
    sidechainDepth: 0.08,     // 0.12→0.08: menos ducking para compensar frontPar elevado
  },
}
