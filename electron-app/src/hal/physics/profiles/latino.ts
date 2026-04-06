/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2433: LATINO PROFILE — El ADN de la Fiesta (MONTE CARLO STRESS TEST)
 * WAVE 2459: CALIBRACIÓN 4.1 SALA — Tres síntomas resueltos:
 *   S1: Muro de luz → decayBase staccato en kick/snare/highMid overrides41
 *   S2: BackPar devora voces → gateOn highMid 0.12→0.20 en overrides41
 *   S3: Movers clones/dimmer → polarizar moverL (hM×1.0, tr×0.0),
 *       moverR trebleSub 0.10→0.45, gates mover 0.14/0.15→0.22/0.22
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
  // WAVE 2461: decay 0.88→0.50 — Log real muestra sB=0.20-0.30 en golpes,
  //   fPar se queda en 0.80 during 10+ frames entre golpes.
  //   decayBase 0.88 + 0.05×morph0.80 = 0.92/frame → half-life 8 frames = 400ms.
  //   Con 0.50: half-life ~1.4 frames = 70ms. Golpe fuerte, caída rápida.
  //   boost 2.0→2.5: compensar el gate más rápido para que el pico sea visible.
  envelopeSubBass: {
    name: 'Front L (TÚN del Dembow)',
    gateOn: 0.15,
    boost: 2.5,
    crushExponent: 2.0,
    decayBase: 0.50,           // WAVE 2461: 0.88→0.50 — staccato latino real
    decayRange: 0.08,
    maxIntensity: 0.80,
    squelchBase: 0.03,
    squelchSlope: 0.50,
    ghostCap: 0.00,
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

  // Mover L — "El Galán" (HighMid — Congas, Acordeón, Melodía, Marimba)
  // WAVE 1004.1: MOVER_L_GATE=0.28, MOVER_L_ATTACK=0.65, MOVER_L_DECAY=0.25
  // MOVER_GAIN=1.50, MOVER_TREBLE_REJECTION=0.30
  // El Galán caza la zona highMid — melodías, congas, acordeón de cumbia.
  // Cross-filter ruta highMid×1.0 (WAVE 2459: polarizado).
  // WAVE 2465: El síntoma era pulsos de sílabas — el mid latino (0.46-0.50 en voces)
  //   es continuo, pero la señal sube a 0.85 con cada sílaba forte y cae a 0.00 en
  //   las pausas de 40ms entre sílabas. Con decayBase=0.65 y ghostCap=0.04, el Galán
  //   parpadeaba con cada sílaba: visible como "pulsación" en el mover físico.
  //   FIX:
  //     decayBase 0.65→0.82 — la caída dura ~30 frames en lugar de ~8 → inercial
  //     ghostCap  0.04→0.18 — el haz nunca desaparece entre sílabas/melodías
  //   Resultado: el mover mantiene brillo continuo, con modulación suave en las
  //   crestas (trompetas/explosiones de melodía) que sube a 0.85 y baja a 0.18
  //   sin negro entre pulsaciones. Continuidad con expresión, no parpadeo.
  envelopeTreble: {
    name: 'Mover L (El Galán — Melodía & Conga)',
    gateOn: 0.14,              // base bajo — el override41 lo sube a 0.35
    boost: 3.5,
    crushExponent: 1.0,
    decayBase: 0.82,           // WAVE 2465: 0.65→0.82 — inercia larga, no staccato
    decayRange: 0.05,
    maxIntensity: 0.85,
    squelchBase: 0.04,
    squelchSlope: 0.15,
    ghostCap: 0.18,            // WAVE 2465: 0.04→0.18 — suelo continuo entre sílabas
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

  // BACK L: WAVE 2461 — Log real: percRaw=0.000 casi siempre porque treble
  // es estático (~0.25-0.36) y el transient shaper (delta) no lo ve.
  // Solución: backLTrebleSub negativo → la fórmula és -treble×backLTrebleSub.
  // Con backLTrebleSub=-0.50: -(0.30×-0.50) = +0.15 → treble SUMA al backL.
  // El gateOn del envHighMid (0.20 en override41) filtra el nivel base.
  // Solo los picos transientes de treble (snare, hi-hat, palma) rompen el gate.
  backLLowMidWeight: 0.00,   // WAVE 2461: 0.70→0.00 — lowMid es solo el bajo continuo
  backLMidWeight: 0.00,      // WAVE 2461: 0.60→0.00 — mid es melodía, no percusión
  backLTrebleSub: -0.50,     // WAVE 2461: suma treble — -(treble×-0.50)=+treble×0.50
  backLBassSub: 0.0,         // CERO

  // ═══════════════════════════════════════════════════════════════
  // MOVER L ("El Galán"): Cross-filter + tonal gate
  // input = max(0, highMid × 0.8 + treble × 0.2) × isTonal
  // Más highMid que techno — El Galán caza congas y voces, no melodías agudas.
  // Tonal threshold más alto — el latino es más "ruidoso" armónicamente.
  // ═══════════════════════════════════════════════════════════════

  // MOVER L: WAVE 2461 — Log real: hMid=0.02-0.05 (MICRO), mid=0.55-0.66 (ENORME).
  // highMid×1.0 sola da señal 0.02-0.05 → siempre por debajo del gate.
  // mid×0.80 da señal 0.44-0.53 → supera cualquier gate y reacciona a melodías.
  // El Galán es ahora el cazador del mid — melodías, acordeón, voces, congas.
  moverLHighMidWeight: 0.30,    // WAVE 2461: rol secundario — el mid manda
  moverLTrebleWeight: 0.00,     // CERO — treble es territorio de La Dama
  moverLMidWeight: 0.80,        // WAVE 2461: 0.30→0.80 — mid es la melodía latina
  moverLTonalThreshold: 0.45,   // WAVE 2434: Monte Carlo winner

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("La Dama"): Resta de treble para sibilantes
  // En latino La Dama QUIERE treble — menos resta que techno.
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: 0.45,    // WAVE 2459 S3: 0.10→0.45 — La Dama ignora mid/voz del Galán. Solo treble puro.

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

  // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
  // Latino/Reggaetón: energía alta, mucho mid melódico desde el inicio
  morphFloor: 0.25,      // Umbral bajo — el dembow ya trae mid desde el primer beat
  morphCeiling: 0.65,    // Techo medio — no necesita mid extremo para morph pleno

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
    percMidSubtract: 1.5,  // 0.6→1.5: voz+autotune cancelada en transient shaper

    // ── BACK L: WAVE 2461 — Treble estático como señal de percusión ─
    // Log muestra percRaw=0.000 casi siempre porque el treble es continuo (~0.30).
    // El transient shaper (delta) no ve el treble estable. Hay que meterlo directo.
    // backLTrebleSub=-0.50: la fórmula es -treble×backLTrebleSub → +treble×0.50.
    // El gateOn=0.25 del envHighMid filtra el nivel base estático del treble.
    // Solo los picos (snare, hi-hat, palma) rompen el gate. Igual que techno.
    backLMidWeight: 0.00,      // WAVE 2461: mid ya no va a backL (es del Galán)
    backLLowMidWeight: 0.00,   // WAVE 2461: lowMid es solo bajo continuo, no percusión

    // ── S3: EL GALÁN — WAVE 2465: decay inercial + ghostCap continuo ───
    // Con moverLMidWeight=0.80, señal = mid×0.80 ≈ 0.44-0.53.
    // gateOn: 0.35 — filtra ruido sin matar melodía (sin cambios).
    // boost 4.0: el mid ya llega fuerte (sin cambios).
    // NUEVO: decayBase y ghostCap para que el override replique los valores base.
    // El override solo necesita cambiar el gate y el boost — decay/ghostCap
    // se heredan del valor base (0.82 / 0.18) que ya tienen la calibración.
    envelopeTreble: {
      gateOn: 0.35,        // WAVE 2461: calibrado para señal mid=0.44-0.53
      boost: 4.0,
      decayBase: 0.82,     // WAVE 2465: espejo del valor base — continuidad
      ghostCap: 0.18,      // WAVE 2465: espejo del valor base — suelo continuo
    },

    // ── S3: LA DAMA — sin cambios, treble=0.25-0.36 funciona bien ─
    envelopeVocal: {
      gateOn: 0.22,
      boost: 5.0,
    },

    // ── TONAL GATE — DESACTIVADO: el mid es melodía, no ruido ────
    moverLTonalThreshold: 0.99,  // WAVE 2460/2461: desactivado para latino

    // ── BACK L envHighMid — treble como señal, gate selectivo ────
    // WAVE 2461: Con treble sumado al input, el gate debe ser alto para que
    // solo los picos transientes de treble enciendan el Back.
    // Señal base (treble×0.50 = 0.12-0.18) debe quedar bajo el gate.
    // Solo un snare/hi-hat real (treble>0.35) romperá el gate de 0.20.
    envelopeHighMid: {
      gateOn: 0.20,      // WAVE 2461: filtra treble base, pasa picos transientes
      decayBase: 0.28,   // latiguazo rápido, no DC
      ghostCap: 0.00,    // negro absoluto entre golpes
    },

    // ── FRONT SubBass — WAVE 2462: gate anti-bajo-continuo ───────
    // Log real: sB = 0.08-0.30. Entre golpes de bombo: sB = 0.13-0.19 (bajo
    // melódico continuo). Con gateOn=0.15, ese bajo SIEMPRE re-triggea el
    // envelope → front encendido todo el tiempo = "gordo/relleno" que Radwulf ve.
    // Solo los golpes reales de bombo empujan sB > 0.22. Gate en 0.22 = solo
    // golpes reales pasan. boost 2.5→1.8: la señal llega ya a 0.25-0.30, no
    // necesita boost enorme para alcanzar maxIntensity=0.80.
    envelopeSubBass: {
      decayBase: 0.50,   // WAVE 2461: staccato latino real
      gateOn: 0.22,      // WAVE 2462: 0.15→0.22 — bloquea bajo melódico continuo
      boost: 1.8,        // WAVE 2462: 2.5→1.8 — señal real ya es suficientemente fuerte
    },

    // ── KICK STACCATO ─────────────────────────────────────────────
    envelopeKick: {
      decayBase: 0.10,
    },

    // ── S1: SNARE STACCATO — Back R el TAcka cae a negro ────────
    // WAVE 2459: decayBase 0.45→0.22 — el TAcka es un disparo, no un reverb.
    envelopeSnare: {
      decayBase: 0.22,   // 0.45→0.22 WAVE 2459 S1: disparo limpio
      boost: 4.5,        // 3.5→4.5: más presencia para ganar el max() al tumbao
    },

    // Sidechain más suave — frontPar compactado tiene más energía constante
    sidechainDepth: 0.08,     // 0.12→0.08: menos ducking en 4.1
  },
}
