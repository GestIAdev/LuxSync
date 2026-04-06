/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2470 FASE 2: CHILL LOUNGE PROFILE — El Descenso Oceánico
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Perfil Omniliquid para Chillout/Lounge. Diseñado como la antítesis del
 * Techno Industrial: donde Techno es estocástico y percutivo, Chill es
 * continuo y respiratorio. Donde Techno apaga zonas entre kicks, Chill
 * nunca apaga nada — hay siempre luz residual, como bioluminiscencia
 * en el fondo marino.
 *
 * Filosofía acústica:
 *   - Los envelopes NO responden a kicks. No hay kicks en el abismo.
 *   - Decays extremos (0.94-0.97) — las notas flotan, no golpean.
 *   - ghostCap alto (0.20-0.25) — el Dimmer Floor del océano. Nunca oscuro.
 *   - morphFactor inyectado externamente desde la tide machine hidrostática.
 *     (la profundidad es temporal, no sonora — ver WAVE 2470 Blueprint)
 *
 * Semántica de zonas 7.1:
 *   Front L → envSubBass  (El Pulso del Abismo — bass continuo, latido de ballena)
 *   Front R → envKick     (La Corriente — pulsaciones suaves de bajo)
 *   Back L  → envHighMid  (Las Algas — tejido continuo de pad/synth mid)
 *   Back R  → envSnare    (El Destello — brush/shaker, micro-transitories)
 *   Mover L → envVocal    (La Voz del Mar — pads flotantes, voces etéreas)
 *   Mover R → envTreble   (La Bioluminiscencia — shimmer puntual, brillo esporádico)
 *
 * Semántica de zonas 4.1 (via layout41Strategy: 'default'):
 *   frontPar = max(subBass, kick)    ← El latido + la corriente
 *   backPar  = max(highMid, snare)   ← Las algas + destellos
 *   moverL   = envVocal              ← La Voz del Mar
 *   moverR   = envTreble             ← La Bioluminiscencia
 *
 * El subBass con decayBase=0.97 domina el frontPar — crea el cuerpo
 * continuo deseado. El snare con gateOn=0.15 solo pasa destellos reales.
 *
 * Referencia: Tycho, Washed Out, Boards of Canada, Nils Frahm, Jon Hopkins
 * (secciones ambient), Portico Quartet, Ólafur Arnalds.
 *
 * El morphFactor de este perfil es inyectado por la tide machine:
 *   morphFactor = 1.0 - (currentDepth / 10000)
 *   Con morphFactor bajo (abismo) → los decays se reducen → todo se iguala.
 *   Con morphFactor alto (superficie) → los decays son máximos → todo flota.
 *
 * @module hal/physics/profiles/chilllounge
 * @version WAVE 2470 — OPERACIÓN DESCENSO OCEÁNICO
 */

import type { ILiquidProfile } from './ILiquidProfile'

export const CHILL_PROFILE: ILiquidProfile = {
  id: 'chill-oceanic',
  name: 'Chill Lounge Oceánico',

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — La Respiración Submarina
  // ═══════════════════════════════════════════════════════════════

  // Front L — "El Pulso del Abismo" (SubBass continuo)
  // El bajo del chill no hace PUM, hace ~eeeeoooooo~.
  // Bass continuo de synth pad, bajo eléctrico con reverb de catedral,
  // el latido lento del corazón del océano.
  // gateOn casi nulo — captura toda respiración de grave.
  // decayBase=0.97 — el abismo nunca suelta el bajo. Casi DC.
  // ghostCap=0.20 — luminosidad residual mínima. Nunca oscuro.
  envelopeSubBass: {
    name: 'Front L (El Pulso del Abismo)',
    gateOn: 0.02,           // Umbral mínimo — captura toda respiración de grave
    boost: 1.5,             // No agresivo, solo cuerpo. El abismo no grita.
    crushExponent: 1.8,     // Suave compresión — nivela los picos del sub
    decayBase: 0.97,        // EXTREMO — el latido de ballena no se apaga
    decayRange: 0.04,       // Poco rango — a mayor profundidad (morphFactor bajo) levemente más corto
    maxIntensity: 0.85,     // Cap suave — el sub no ahoga el resto
    squelchBase: 0.01,      // Casi nulo — el fondo del océano siempre zumba
    squelchSlope: 0.10,
    ghostCap: 0.20,         // DIMMER FLOOR — el océano nunca se queda a oscuras
    gateMargin: 0.005,
  },

  // Front R — "La Corriente" (Kick / Pulso de bajo)
  // En chill no hay bombo de 4×4 — hay pulsaciones de bajo suaves,
  // shakers lentos, conga ambiental. La corriente se mueve pero no golpea.
  // decayBase=0.90 — fluye, no staccato. Más rápido que subBass pero lento.
  // gateOn bajo — los ghost beats del shaker/cepillo deben pasar.
  envelopeKick: {
    name: 'Front R (La Corriente)',
    gateOn: 0.05,           // Bajo — ghost beats del shaker/cepillo pasan
    boost: 1.8,             // Suave — la corriente no empuja, arrastra
    crushExponent: 1.5,     // Compresión leve
    decayBase: 0.90,        // Fluido — sin staccato, la corriente nunca para
    decayRange: 0.06,
    maxIntensity: 0.75,     // Limitado — la corriente nunca manda, cede al Pulso
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.20,         // DIMMER FLOOR — la corriente nunca se detiene
    gateMargin: 0.005,
  },

  // Mover L — "La Voz del Mar" (Mid vocal / pad flotante)
  // Pads de voz, cuerdas, sintetizadores con mucho release.
  // La voz que flota entre el kelp y los corales.
  // decayBase=0.94 — sustain largo. Las voces del mar no terminan.
  // ghostCap=0.22 — siempre hay un susurro residual.
  // El moverLTonalThreshold es MUY permisivo — chill es tonal por naturaleza.
  envelopeVocal: {
    name: 'Mover L (La Voz del Mar)',
    gateOn: 0.03,           // Bajo — los pads suaves deben entrar
    boost: 2.0,             // No agresivo — las voces del mar no gritan
    crushExponent: 1.2,
    decayBase: 0.94,        // Largo — el sustain de un pad de 4 compases
    decayRange: 0.05,
    maxIntensity: 0.82,
    squelchBase: 0.02,
    squelchSlope: 0.08,
    ghostCap: 0.22,         // DIMMER FLOOR — siempre hay un susurro
    gateMargin: 0.005,
  },

  // Back R — "El Destello" (Snare / Brush / Micro-transitorio)
  // En chill no hay snare agresivo — hay escobillas de jazz, shakers,
  // rimshots suaves, el micro-click de un clave tocado con suavidad.
  // gateOn=0.15 — ALTO. Solo los destellos reales pasan. El ruido de fondo NO.
  // decayBase=0.80 — el destello persiste un poco. No es flash, es brillo.
  // ghostCap=0.20 — incluso sin destello, hay luz ambiental.
  envelopeSnare: {
    name: 'Back R (El Destello)',
    gateOn: 0.15,           // ALTO — solo destellos reales. El ruido no entra.
    boost: 2.5,             // Cuando brilla, que se note sobre el fondo continuo
    crushExponent: 0.9,     // Levemente expansivo — los destellos suaves se ven
    decayBase: 0.80,        // Persiste — el brillo de bioluminiscencia se va lento
    decayRange: 0.10,
    maxIntensity: 0.85,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.20,         // DIMMER FLOOR — luz ambiental continua
    gateMargin: 0.01,
  },

  // Back L — "Las Algas" (Mid Synths / Pad / Textura continua)
  // El tejido continuo del chill: pads de strings, synths de fondo,
  // el movimiento lento de las algas en la corriente.
  // Más sustain que el rock (0.80), más incluso que el latino (este es ABISMO).
  // decayBase=0.95 — tejido que nunca se deshace.
  // ghostCap=0.20 — el fondo marino siempre está presente.
  envelopeHighMid: {
    name: 'Back L (Las Algas)',
    gateOn: 0.02,           // Prácticamente nulo — los pads de fondo deben capturarse
    boost: 2.5,             // Tejido visible, no agresivo
    crushExponent: 1.0,
    decayBase: 0.95,        // El tejido continuo de algas. Larguísimo.
    decayRange: 0.04,
    maxIntensity: 0.88,
    squelchBase: 0.01,
    squelchSlope: 0.08,
    ghostCap: 0.21,         // DIMMER FLOOR — las algas siempre están allí
    gateMargin: 0.003,
  },

  // Mover R — "La Bioluminiscencia" (Treble / Shimmer / Brillo puntual)
  // El brillo del high-end en chill: shimmers de synth, destellos de piano,
  // el toque de platillo suave, el glitter de un arpeggio de cristal.
  // A diferencia de los otros envelopes, ESTE tiene más decay range —
  // a mayor profundidad (morphFactor bajo) los destellos se apagan más rápido.
  // En el abismo, la bioluminiscencia es rara y breve.
  // decayBase=0.88 — persistente pero no eterno. El brillo se va.
  // Ghost cap más alto porque en el Mover R necesitamos siempre
  // algún movimiento para simular la deriva oceánica.
  envelopeTreble: {
    name: 'Mover R (La Bioluminiscencia)',
    gateOn: 0.08,           // Moderado — shimmer real, no ruido de fondo
    boost: 3.0,             // Cuando brilla, BRILLA. El abismo es oscuro salvo los destellos.
    crushExponent: 0.8,     // Expansivo — los destellos suaves se ven
    decayBase: 0.88,        // Persistente pero no eterno
    decayRange: 0.14,       // RANGO ALTO — en el abismo (morphFactor=0) los destellos son breves
    maxIntensity: 0.90,
    squelchBase: 0.03,
    squelchSlope: 0.12,
    ghostCap: 0.23,         // DIMMER FLOOR más alto — el mover necesita movimiento continuo
    gateMargin: 0.008,
  },

  // ═══════════════════════════════════════════════════════════════
  // BACK R: TRANSIENT SHAPER (El Destello)
  // percMidSubtract alto — el mid continuo del chill (algas, pads)
  // no debe contaminar el Back R. Solo los micro-transitories pasan.
  // ═══════════════════════════════════════════════════════════════

  percMidSubtract: 0.80,   // ALTO — el chill tiene mucho mid pad, lo aislamos
  percGate: 0.015,         // Bajo — los micro-transitories del shaker/cepillo pasan
  percBoost: 3.0,          // Moderado — entre techno (5.0) y el cuerpo del chill
  percExponent: 0.7,       // Expansivo — los destellos suaves se amplifican

  // ═══════════════════════════════════════════════════════════════
  // MOVER L ("La Voz del Mar"): Cross-filter hacia MID VOCAL
  // El chill tiene pads mid-heavy, voces de fondo, strings.
  // Mid pesado, poco highMid (agresivo), poco treble (muy puntiagudo).
  // moverLTonalThreshold muy bajo — el chill ES tonal. Bloquear ruido.
  // ═══════════════════════════════════════════════════════════════

  moverLHighMidWeight: 0.30,    // Poco highMid — no queremos agresividad
  moverLTrebleWeight: 0.15,     // Poco treble — eso es para La Bioluminiscencia
  moverLMidWeight: 0.90,        // MID PESADO — voces, pads, strings son mid
  moverLTonalThreshold: 0.30,   // BAJO — el chill es tonal. Si no es tonal, no entra.

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("La Bioluminiscencia"): Cross-filter hacia TREBLE
  // Baja resta de bass — el bass no contamina mucho el treble en chill.
  // Los pads del chill tienen baja subtractRange.
  // ═══════════════════════════════════════════════════════════════

  bassSubtractBase: 0.20,    // Bajo — el bass no contamina tanto el treble en chill
  bassSubtractRange: 0.10,   // Poco rango — los pads son consistentes

  // ═══════════════════════════════════════════════════════════════
  // BACK L ("Las Algas"): Cross-filter hacia MID SYNTH
  // El chill vive en el lowMid y mid. Poco treble (eso es shimmer).
  // Bass subtract NULO — en chill el bass y el mid coexisten en paz.
  // ═══════════════════════════════════════════════════════════════

  backLLowMidWeight: 0.80,   // LowMid pesado — el cuerpo del pad bajo
  backLMidWeight: 0.90,      // Mid pesado — el tejido central del chill
  backLTrebleSub: 0.10,      // Resta treble mínima — no queremos cortar el shimmer
  backLBassSub: 0.05,        // Casi nulo — el bass es compañero del mid en chill

  // ═══════════════════════════════════════════════════════════════
  // MOVER R: Resta de treble para sibilantes
  // En el Mover R del chill (La Bioluminiscencia) QUEREMOS el treble.
  // Resta mínima — solo limpia ruido de fondo.
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: 0.05,    // MÍNIMO — la bioluminiscencia necesita el treble

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE — DESACTIVADO EN CHILL
  // El chill no tiene sidechain. El bajo y las voces coexisten.
  // La marea no pone en duck al kelp.
  // ═══════════════════════════════════════════════════════════════

  sidechainThreshold: 0.99,     // INACTIVO — nunca se activa en chill normal
  sidechainDepth: 0.0,          // CERO — el chill no es un rave
  snareSidechainDepth: 0.0,     // CERO — El Destello no mata La Voz del Mar

  // WAVE 2438 — GUILLOTINA 4.1 (desactivada: el chill no necesita punch staccato)
  frontKickSidechainThreshold: 0,  // 0 = off
  auraCapBase: 0,                  // 0 = off
  auraCapExponent: 0,

  // ═══════════════════════════════════════════════════════════════
  // STROBE — DESACTIVADO EN CHILL
  // El océano no hace strobe. El strobe es el anti-chill.
  // umbral imposible: solo existe para satisfacer la interfaz.
  // ═══════════════════════════════════════════════════════════════

  strobeThreshold: 0.999,       // IMPOSIBLE — nunca se activa
  strobeDuration: 10,           // Mínimo si por alguna razón ocurre
  strobeNoiseDiscount: 1.0,     // Sin descuento

  // ═══════════════════════════════════════════════════════════════
  // MODES — Chill nunca entra en Acid/Noise/Apocalypse
  // El océano no grita.
  // ═══════════════════════════════════════════════════════════════

  harshnessAcidThreshold: 0.999,   // IMPOSIBLE — el chill no tiene distorsión
  flatnessNoiseThreshold: 0.999,   // IMPOSIBLE — el chill no tiene ruido blanco
  apocalypseHarshness: 0.999,      // El abismo no es el apocalypse
  apocalypseFlatness: 0.999,

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION — No hay kick en el abismo
  // Intervalo amplio para ignorar las pulsaciones lentas del sub.
  // kickVetoFrames=0 — el sub NO silencia las voces.
  // ═══════════════════════════════════════════════════════════════

  // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
  // Chill/Lounge: energía baja pero rica. Sin esto, morphFactor≈0 siempre.
  // El mid ambiente raramente supera 0.25 → ajustamos el rango completo a eso.
  morphFloor: 0.05,      // Umbral bajo — cualquier pad ambient dispara el morph
  morphCeiling: 0.35,    // Techo bajo — el chill COMPLETO con apenas mid=35%

  kickEdgeMinInterval: 500,  // Muy largo — solo pulsaciones lentas son "kick"
  kickVetoFrames: 0,         // CERO — el pulso no silencia la Voz del Mar

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2439 — ESTRATEGIA DE ENRUTAMIENTO 4.1
  //
  // 'default': frontPar = max(subBass, kick), backPar = max(snare, highMid)
  // El subBass con decayBase=0.97 domina el frontPar — crea el
  // cuerpo continuo deseado. Las algas dominan el backPar.
  // 'strict-split' sería incorrecto — el bombo no existe aquí.
  // ═══════════════════════════════════════════════════════════════
  layout41Strategy: 'default',

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2435 — OVERRIDES 4.1
  //
  // En 4.1 el max() funciona bien con chill porque todos los envelopes
  // tienen ghostCap alto — no hay "silencio" que distorsione el max().
  // Sin overrides: herencia directa del perfil base.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    // Sin ajustes — los decays largos y ghostCaps altos garantizan
    // un max() siempre activo. El frontPar nunca llega a cero.
  },
}
