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
  // WAVE 3491: gateOn 0.28 + crushExponent 3.5 + squelchBase 0.30 — La Dama murió en silencio.
  // WAVE 3492: aflojar los tres. El treble latino medio = 0.18-0.30 en trompetas.
  //   gateOn 0.28->0.15: deja pasar trompetas y güira reales
  //   crushExponent 3.5->1.5: la Dama canta, no solo dispara picos extremos
  //   squelchBase 0.30->0.08: piso moderado, no celófano hermético
  //   ghostCap 0.00->0.04: hilo tenue de sustain para que el ritmo sea fluido
  envelopeVocal: {
    name: 'Mover R (La Dama — Brillo)',
    gateOn: 0.15,          // WAVE 3492: 0.28->0.15 — trompetas/güira reales pasan
    boost: 4.0,            // WAVE 2195: protocolo Schwarzenegger
    crushExponent: 1.5,    // WAVE 3492: 3.5->1.5 — La Dama canta, no solo ataca
    decayBase: 0.65,       // WAVE 3492: 0.70->0.65 — más ágil para ritmos
    decayRange: 0.05,
    maxIntensity: 0.85,
    squelchBase: 0.08,     // WAVE 3492: 0.30->0.08 — piso moderado, no hermético
    squelchSlope: 0.15,
    ghostCap: 0.04,        // WAVE 3492: 0.00->0.04 — hilo de sustain rítmico
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

  // Back L — El Latigazo (percusión highMid: congas, palmas, claves)
  // WAVE 3491: gateOn 0.35 + squelchBase 0.38 pero backLTrebleSub=-0.50 inyecta
  //   treble×0.50 al canal. Con treble latino ~0.25 en reposo: input = 0.125.
  //   Ese 0.125 no pasa el gate 0.35 — BIEN. Pero con percusión real (treble 0.40)
  //   input=0.20, tampoco llega. El canal se queda callado tambien en los golpes.
  // WAVE 3492: ajustar formula. backLTrebleSub no negativo por defecto —
  //   usar highMid directo (mas percutivo que treble continuo en latino).
  //   El gateOn 0.35 ya era correcto. Solo eliminar el truco del treble negativo
  //   que generaba el mural de voz.
  envelopeHighMid: {
    name: 'Back L (Latigazo Percusivo)',
    gateOn: 0.35,          // Conservado: solo percusión real
    boost: 3.0,
    crushExponent: 2.0,
    decayBase: 0.14,       // WAVE 3491: GUILLOTINA snap violento
    decayRange: 0.03,
    maxIntensity: 0.95,
    squelchBase: 0.38,     // Conservado: anti-barro
    squelchSlope: 0.10,
    ghostCap: 0.00,        // Negro absoluto
    gateMargin: 0.005,
  },

  // Mover L — "El Galán" (HighMid + Mid moderado — Congas, Acordeones, Melodías)
  // WAVE 3491: purga vocal (moverLMidWeight=0.00). Resultado: solo highMid (0.02-0.05)
  //   -> señal demasiado pequeña para el gate 0.25. Mover muerto.
  // WAVE 3492: recuperar mid MODERADAMENTE para cazar melodías (voces siguen purgadas
  //   del back via percMidSubtract=1.5). La separación voz/melodía la hace el motor,
  //   no el peso del cross-filter.
  //   crushExponent 3.5->1.8: el Bozal aplastaba tambien los picos melódicos reales.
  //   decayBase 0.82->0.55: dinamismo sin parpadeo (half-life ~15 frames = 750ms).
  //   ghostCap 0.00->0.06: suelo ligerisimo para que no muera entre notas de pad.
  envelopeTreble: {
    name: 'Mover L (El Galán — Melodía & Conga)',
    gateOn: 0.18,              // WAVE 3492: 0.25->0.18 — deja pasar melodias reales
    boost: 3.5,
    crushExponent: 1.8,        // WAVE 3492: 3.5->1.8 — picos melódicos no aplastados
    decayBase: 0.55,           // WAVE 3492: 0.82->0.55 — dinamismo real sin parpadeo
    decayRange: 0.05,
    maxIntensity: 0.85,
    squelchBase: 0.12,         // WAVE 3492: 0.30->0.12 — melodías suaves pasan
    squelchSlope: 0.15,
    ghostCap: 0.06,            // WAVE 3492: 0.00->0.06 — suelo ligerisimo entre notas
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

  bassSubtractBase: 0.45,    // WAVE 3492: 0.85->0.45 — 0.85 era tan agresivo que mataba senales medias
  bassSubtractRange: 0.20,

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
  // WAVE 3492: backLTrebleSub restaurado a positivo (convencional).
  // El truco -0.50 (sumar treble) generaba que voces+treble continuo colaran al Back.
  // Con highMid directo como input principal (backLHighMidWeight futuro)
  // y el gateOn 0.35 ya estricto, el canal es puramente percutivo.
  backLLowMidWeight: 0.00,
  backLMidWeight: 0.00,
  backLTrebleSub: 0.20,      // WAVE 3492: -0.50->+0.20 — ya no suma treble, pequeña resta para limpiar
  backLBassSub: 0.0,

  // ═══════════════════════════════════════════════════════════════
  // MOVER L ("El Galán"): Cross-filter + tonal gate
  // input = max(0, highMid × 0.8 + treble × 0.2) × isTonal
  // Más highMid que techno — El Galán caza congas y voces, no melodías agudas.
  // Tonal threshold más alto — el latino es más "ruidoso" armónicamente.
  // ═══════════════════════════════════════════════════════════════

  // MOVER L: WAVE 3492 — RECUPERAR MELODIAS.
  // Mid moderado restaurado para cazar melodías (mid 0.35-0.55 en trompetas latino).
  // La purga vocal la hace percMidSubtract=1.5 en el transient shaper (Back R),
  // no el weight del cross-filter. El Galán puede tener mid SIN contaminar Back.
  moverLHighMidWeight: 0.50,    // WAVE 3492: 0.80->0.50 — highMid importante pero no exclusivo
  moverLTrebleWeight: 0.20,     // Algo de treble para arpegios agudos
  moverLMidWeight: 0.40,        // WAVE 3492: 0.00->0.40 — recupera melodias (acordeón, trompeta)
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
  sidechainDepth: 0.00,         // WAVE 3457: sidechain exterminado globalmente
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
  // WAVE 3312: morphFloor 0.25→0.45 — el Centroid Shield (900×(1-morph)) bajaba
  //   centroidFloor a 675Hz con morph=0.25, silenciando TAckas legítimos del dembow
  //   que coincidían en el mismo frame que un kick. Con 0.45: floor=495Hz,
  //   Shield mucho más permisivo con las frecuencias medias de caja/clave.
  morphFloor: 0.45,      // WAVE 3312: 0.25→0.45 — Shield menos agresivo, caja/bombo legítimos pasan
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

    // ── BACK L: WAVE 3492 — trebleSub restaurado a positivo ─────
    // El truco -0.50 (sumaba treble al canal) generaba que el treble
    // continuo de voces/sinths colara al Back L. Con +0.20 convencional
    // y el gateOn=0.35 + squelchBase=0.38 de la GUILLOTINA, solo
    // percusion highMid real rompe el umbral.
    backLMidWeight: 0.00,
    backLLowMidWeight: 0.00,

    // ── WAVE 3492: EL GALÁN — override alineado con nueva base ─────────
    envelopeTreble: {
      gateOn: 0.18,        // WAVE 3492: igual que base
      squelchBase: 0.12,   // WAVE 3492: igual que base
      boost: 3.50,
      decayBase: 0.55,     // WAVE 3492: dinamismo real
      ghostCap: 0.06,      // WAVE 3492: suelo ligerisimo
    },

    // ── WAVE 3492: LA DAMA — override alineado con nueva base ─────────
    envelopeVocal: {
      gateOn: 0.15,        // WAVE 3492: trompetas/güira pasan
      squelchBase: 0.08,   // WAVE 3492: piso moderado
      boost: 4.00,
      decayBase: 0.65,
      ghostCap: 0.04,
    },

    // ── TONAL GATE — DESACTIVADO: el mid es melodía, no ruido ────
    moverLTonalThreshold: 0.99,  // WAVE 2460/2461: desactivado para latino

    // ── WAVE 3491: BACK L — GUILLOTINA DE DECAY (refuerzo del override) ──
    // La base ya aplica decayBase 0.14 / gateOn 0.35 / squelchBase 0.38.
    // El override confirma los valores críticos para garantizar el snap violento.
    envelopeHighMid: {
      gateOn: 0.35,        // WAVE 3491: alineado con base
      squelchBase: 0.38,   // WAVE 3491: anti-barro total
      decayBase: 0.14,     // WAVE 3491: GUILLOTINA — snap percusivo
      ghostCap: 0.00,      // Negro absoluto
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
      boost: 1.25,       // WAVE 3436: VW entrega picos masivos, preservar dinámica
    },

    // ── KICK STACCATO ─────────────────────────────────────────────
    envelopeKick: {
      decayBase: 0.10,
    },

    // ── S1: SNARE STACCATO — Back R el TAcka cae a negro ────────
    // WAVE 2459: decayBase 0.45→0.22 — el TAcka es un disparo, no un reverb.
    envelopeSnare: {
      gateOn: 0.34,
      squelchBase: 0.30,
      decayBase: 0.36,
      ghostCap: 0.00,
      boost: 4.0,
    },

    // WAVE 3457: sidechain exterminado también en overrides 4.1
    sidechainDepth: 0.00,
  },
}
