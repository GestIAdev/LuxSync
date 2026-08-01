/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2431: POP/ROCK PROFILE — El Rango Dinámico Humano
 * WAVE 2470: Verificado operativo en el Omniliquid Engine (4.1 y 7.1).
 *            Añadido layout41Strategy: 'default' y overrides41 explícito.
 *            El perfil ya estaba conectado desde WAVE 2431 via PROFILE_REGISTRY.
 *            TitanOrchestrator → setActiveProfile('pop-rock') → POPROCK_PROFILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Destilado del fracasado RockStereoPhysics2.ts — eliminamos la heurística
 * de subgéneros (detección Prog/Hard con 30s de memoria) y confiamos en
 * el Omni-Liquid Engine puro. Cero adivinación, cero switches internos.
 *
 * Filosofía acústica:
 *   - Bateristas HUMANOS: ghost notes, variación de fuerza, resonancia de
 *     parche. Gates bajos para no perder los golpes suaves.
 *   - Bombo acústico: NO ahoga al resto de la banda. Sidechain casi nulo.
 *   - Guitarra eléctrica: Mid+HighMid pesado (distorsión = energía mid).
 *   - Solos/Crashes: Treble+HighMid para cazar los leads y platillos.
 *   - PARs orgánicos: Decays que imitan la resonancia de un parche real —
 *     no tan secos como Techno, no tan elásticos como Latino.
 *
 * Valores de referencia rescatados de ROCK_UNIFIED_CONFIG (WAVE 1017-1019):
 *   frontPar: gain=2.6, gate=0.28, decay=0.20
 *   backPar:  gain=2.0, gate=0.05, decay=0.75
 *   moverL:   gain=1.8, gate=0.10, decay=0.65
 *   moverR:   gain=1.8, gate=0.12, decay=0.50
 *
 * Referencia: Metallica, Red Hot Chili Peppers, Arctic Monkeys, Foo Fighters,
 * The Killers, Queens of the Stone Age, Pink Floyd.
 *
 * @module hal/physics/profiles/poprock
 * @version WAVE 2431 — THE ACOUSTIC PROFILE
 */

import type { ILiquidProfile } from './ILiquidProfile'

export const POPROCK_PROFILE: ILiquidProfile = {
  id: 'poprock-live',
  name: 'Pop/Rock Live',

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — La Banda en Vivo
  // ═══════════════════════════════════════════════════════════════

  // Front L — SubBass (El Bombo Acústico)
  // Rock: el bajo eléctrico vive en subBass con el bombo. Gate moderado
  // para separar del bajo — queremos solo los golpes del pedal.
  // ROCK_UNIFIED: frontPar gate=0.28, gain=2.6, decay=0.20 (pump effect)
  // Traducción: gate alto, boost alto, decay rápido = kick puro y seco.
  // WAVE 2436.2: decay 0.25→0.65 — bombo acústico: resonancia de parche real.
  //              Más sustain que techno (0.30) pero menos que latino (0.88).
  //              boost 3.0→2.8 — ajuste fino para sustain orgánico.
  //              maxI 0.78→0.82 — más headroom que techno (0.70).
  // WAVE 2522: ANTI-MELAZA FRONTAL — decayBase 0.65→0.25. El pulso largo
  //             residual (0.65) generaba arrastre visual en el Front L.
  //             0.25 = golpe seco que se apaga rápido, como el bombo
  //             acústico real en un mix rock comprimido.
  envelopeSubBass: {
    name: 'Front L (Kick Drum Acústico)',
    gateOn: 0.15,
    boost: 2.8,
    crushExponent: 2.2,
    decayBase: 0.25,       // WAVE 2522: 0.65→0.25 — anti-melaza frontal, golpe seco
    decayRange: 0.10,
    maxIntensity: 0.82,
    squelchBase: 0.03,
    squelchSlope: 0.45,
    ghostCap: 0.04,
    gateMargin: 0.01,
  },

  // Front R — Kick Edge (El Redoble del Pedal)
  // Bateristas humanos: double bass, blast beats, fills rápidos.
  // kickEdgeMinInterval bajo (50ms) para no perder redobles.
  // WAVE 2521: ANTI-MELAZA — decayBase 0.06→0.04. Staccato que aguanta
  // blast beats de doble pedal a 200+ BPM sin arrastre visual. El smoothing
  // 0.88 del motor 4.1 (default strategy) tiende el puente entre frames;
  // con decay 0.04 el pulso se corta limpio antes de que el puente se acumule.
  envelopeKick: {
    name: 'Front R (Kick Edge / Doble Pedal)',
    gateOn: 0.12,          // Más bajo que techno (0.15) — ghost notes
    boost: 2.8,
    crushExponent: 0.7,    // Expansivo — kicks débiles saturan
    decayBase: 0.04,       // WAVE 2521: 0.06→0.04 — staccato anti-melaza para blast beats
    decayRange: 0.10,
    maxIntensity: 0.82,
    squelchBase: 0.03,
    squelchSlope: 0.10,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Mover R — "Lead/Sizzle" (Solos de Guitarra + Crashes + Voces Agudas)
  // ROCK_UNIFIED: moverRight gain=1.8, gate=0.12, decay=0.50
  // Caza treble+highMid: distorsión de guitarra lead, platillos,
  // chirridos de cuerdas, voces femeninas altas.
  // bassSubtract moderado para ignorar el bajo eléctrico.
  envelopeVocal: {
    name: 'Mover R (Lead & Sizzle)',
    gateOn: 0.10,          // ROCK_UNIFIED gate=0.12, bajamos para solos suaves
    boost: 2.5,            // ROCK_UNIFIED gain=1.8, ajustado a formato envelope
    crushExponent: 1.2,    // Ligera compresión — solos tienen picos extremos
    decayBase: 0.45,       // ROCK_UNIFIED decay=0.50, ligeramente más rápido
    decayRange: 0.08,      // Morph modula: más sustain en secciones intensas
    maxIntensity: 0.85,
    squelchBase: 0.02,
    squelchSlope: 0.12,
    ghostCap: 0.00,
    gateMargin: 0.01,
  },

  // Back R — El Látigo (Snare + Hi-hat + Crashes)
  // ROCK_UNIFIED: backPar gate=0.05, gain=2.0, decay=0.75
  // ¡Pero en Rock el back era MID (voces)! Aquí en Omni-Liquid el Back R
  // usa el Transient Shaper (trebleDelta×4) — perfecto para cazar el
  // snap del snare/rimshot y los crashes.
  // Decay orgánico: la caja resuena más que en techno (parche real).
  // WAVE 2436.2: decay 0.15→0.35 — snap orgánico: parche real que resuena.
  //              boost 3.0→3.5 — más presencia del rimshot/crash.
  // WAVE 2521: SOAD MODE — squelchBase 0.02→0.10 para silenciar el ruido de
  //            fondo (hat bursts continuos, distorsión densa) antes de que
  //            entre al envelope. ghostCap 0.03→0.00 — negro entre hits como
  //            techno; el halo residual se sumaba al colchón en 4.1.
  envelopeSnare: {
    name: 'Back R (Snare & Cymbal Snap)',
    gateOn: 0.10,
    boost: 3.5,
    crushExponent: 0.8,
    decayBase: 0.35,
    decayRange: 0.12,
    maxIntensity: 0.85,
    squelchBase: 0.10,     // WAVE 2521: 0.02→0.10 — SOAD: pisar ruido de fondo pre-envelope
    squelchSlope: 0.12,
    ghostCap: 0.00,        // WAVE 2521: 0.03→0.00 — negro entre hits, sin halo residual
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Guitarras Rítmicas / Teclados
  // En rock: la guitarra rítmica, el órgano Hammond, los pads.
  // ROCK_UNIFIED: moverLeft era LowMid+HighMid (guitarras+bajo).
  // Aquí Back L captura el cuerpo de la mezcla (mid synths).
  // WAVE 2436.2: decay 0.60→0.80 — guitarra rítmica orgánica con sustain real.
  //              Entre techno staccato (0.60) y latino groove (0.92).
  // WAVE 2522: ANTI-MELAZA TRASERA — decayBase 0.80→0.35. El colchón de
  //             guitarras debe respirar al ritmo de los rasgueos, no
  //             quedarse pegado. 0.35 = release entre acordes, el muro
  //             de mid sube y baja con cada rasgueo de púa.
  envelopeHighMid: {
    name: 'Back L (Rhythm Guitar & Keys)',
    gateOn: 0.03,
    boost: 4.0,
    crushExponent: 1.0,
    decayBase: 0.35,       // WAVE 2522: 0.80→0.35 — respirar entre rasgueos
    decayRange: 0.05,
    maxIntensity: 0.90,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.05,
    gateMargin: 0.005,
  },

  // Mover L — "Ritmo/Voz" (Voz Principal + Guitarra Mid + Riffs)
  // ROCK_UNIFIED: moverLeft gain=1.8, gate=0.10, decay=0.65
  // Enfocado en mid+highMid pesado — cuerpo de la voz, riffs de guitarra,
  // power chords. El corazón de una banda en vivo.
  envelopeTreble: {
    name: 'Mover L (Voice & Riff)',
    gateOn: 0.08,          // ROCK_UNIFIED gate=0.10, bajamos para voces suaves
    boost: 3.0,            // ROCK_UNIFIED gain=1.8, ajustado
    crushExponent: 1.0,    // Lineal — respeta el rango dinámico humano
    decayBase: 0.55,       // ROCK_UNIFIED decay=0.65, ligeramente más rápido
    decayRange: 0.06,
    maxIntensity: 0.88,
    squelchBase: 0.03,
    squelchSlope: 0.12,
    ghostCap: 0.04,        // Ghost — la voz nunca desaparece del todo
    gateMargin: 0.008,
  },

  // ═══════════════════════════════════════════════════════════════
  // BACK R: TRANSIENT SHAPER (trebleDelta×4)
  // En rock caza el snap del snare, rimshots y crashes.
  // percMidSubtract bajo — el mid rock (guitarras) no contamina
  // tanto como los sintetizadores techno.
  // ═══════════════════════════════════════════════════════════════

  percMidSubtract: 0.5,   // Moderado — las guitarras distorsionadas tienen mid
  percGate: 0.04,         // WAVE 2521: SOAD — 0.008→0.04, evitar que el Látigo dispare erráticamente con platillos continuos
  percBoost: 4.5,         // Entre techno (5.0) y latino (4.0)
  percExponent: 0.6,      // Ligeramente expansivo — suaviza los crashes

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("Lead/Sizzle"): Cross-filter hacia TREBLE+HIGHMID
  // Caza solos de guitarra, crashes, voces agudas.
  // bassSubtract moderado — el bajo eléctrico tiene fundamentales
  // que pueden filtrarse al treble vía armónicos.
  // WAVE 2521: SEPARACIÓN QUIRÚRGICA — Mover R prioriza FRECUENCIAS ALTAS.
  //   bassSubtractBase 0.45→0.60 — resta más agresiva de bass, deja limpio el
  //   mid+treble para armónicos de guitarra lead y crashes.
  //   bassSubtractRange 0.30→0.20 — menos modulación por morph, se mantiene
  //   agresiva incluso en secciones intensas.
  //   moverRTrebleSub 0.15→-0.40 — INVERSIÓN: en lugar de restar treble, lo
  //   INYECTA (cleanMid + treble×0.40). Los armónicos de guitarra lead y los
  //   crashes alimentan el canal directamente. La voz (mid puro, sin treble)
  //   queda relegada al Mover L.
  // ═══════════════════════════════════════════════════════════════

  bassSubtractBase: 0.60,    // WAVE 2521: 0.45→0.60 — resta agresiva de bass
  bassSubtractRange: 0.20,   // WAVE 2521: 0.30→0.20 — estable across morph

  // ═══════════════════════════════════════════════════════════════
  // BACK L (Guitarra Rítmica): Cross-filter coefficients
  // input = max(0, lowMid × 0.5 + mid × 0.7 - treble × 0.2 - bass × 0.15)
  // Más mid que techno — el cuerpo de la guitarra rítmica y el Hammond.
  // Resta de bass moderada — el bajo eléctrico tiene overlap con mid.
  // ═══════════════════════════════════════════════════════════════

  backLLowMidWeight: 0.50,   // LowMid: cuerpo de la guitarra rítmica
  backLMidWeight: 0.70,      // Mid pesado: power chords, órgano
  backLTrebleSub: 0.20,      // Resta treble moderada — no queremos crashes aquí
  backLBassSub: 0.15,        // Resta bass leve — separar del bajo eléctrico

  // ═══════════════════════════════════════════════════════════════
  // MOVER L ("Voice & Riff"): Cross-filter + tonal gate
  // WAVE 2521: SEPARACIÓN QUIRÚRGICA — Mover L caza FRECUENCIAS MEDIAS PURAS.
  //   moverLMidWeight 0.50→0.90 — mid puro es el cuerpo de la voz (~400-1200Hz).
  //   moverLHighMidWeight 0.80→0.30 — reducir highMid: ese es territorio de
  //   guitarra lead (~1500-4000Hz), ahora cazado por Mover R.
  //   moverLTrebleWeight 0.10→0.0 — sin treble: la voz no vive en agudos.
  //   moverLTonalThreshold 0.70→0.55 — MÁS ESTRICTO: flatness < 0.55 para pasar.
  //   La voz es tonal (flatness baja) → pasa. La distorsión de guitarra tiene
  //   flatness alta → se rechaza. Esto separa voz de riff distorsionado.
  // ═══════════════════════════════════════════════════════════════

  moverLHighMidWeight: 0.30,    // WAVE 2521: 0.80→0.30 — menos highMid (guitarra lead → Mover R)
  moverLTrebleWeight: 0.0,      // WAVE 2521: 0.10→0.0 — sin treble en canal de voz
  moverLMidWeight: 0.90,        // WAVE 2521: 0.50→0.90 — mid puro = cuerpo de la voz
  moverLTonalThreshold: 0.55,   // WAVE 2521: 0.70→0.55 — estricto: rechaza distorsión de guitarra

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("Lead/Sizzle"): Resta de treble para sibilantes
  // WAVE 2521: INVERSIÓN — moverRTrebleSub 0.15→-0.40.
  //   El signo negativo INYECTA treble en lugar de restarlo:
  //   moverRInput = max(0, cleanMid + treble × 0.40)
  //   Los armónicos de guitarra lead y los crashes alimentan el canal
  //   directamente. La voz (mid puro, sin treble) no activa este canal.
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: -0.40,    // WAVE 2521: 0.15→-0.40 — INVERSIÓN: inyectar treble (lead + crashes)

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE — CASI NULO
  // El bombo acústico no ahoga al resto de la banda.
  // Un sidechain agresivo mataría la guitarra en el 4×4 del rock.
  // ═══════════════════════════════════════════════════════════════

  sidechainThreshold: 0.20,     // Alto — solo kicks extremos activan ducking
  sidechainDepth: 0.00,         // WAVE 3457: sidechain exterminado globalmente
  snareSidechainDepth: 0.03,    // Mínimo — el snare no debe matar la guitarra

  // WAVE 2438 — GUILLOTINA 4.1 (desactivada en poprock: los graves sostienen la melodía)
  frontKickSidechainThreshold: 0,  // 0 = off
  auraCapBase: 0,                  // 0 = off
  auraCapExponent: 0,

  // ═══════════════════════════════════════════════════════════════
  // STROBE — Conservador en rock (es concierto, no rave)
  // Solo se activa en momentos extremos (final de solo, breakdown)
  // ═══════════════════════════════════════════════════════════════

  strobeThreshold: 0.88,        // MUY alto — solo picos extremos (crashes + solo climax)
  strobeDuration: 20,           // Corto — flash puntual
  strobeNoiseDiscount: 0.90,    // Casi sin descuento — rock ruidoso no merece strobe fácil

  // ═══════════════════════════════════════════════════════════════
  // MODES — Rock tiene más acid natural (distorsión) y menos noise
  // Umbrales altos para acid (distorsión NO es acid mode) y apocalypse
  // WAVE 2521: SOAD MODE — umbrales bajados para atravesar barreras de
  //   ruido blanco (System of a Down, noise rock). La distorsión extrema
  //   + hat bursts densos no disparaban ni apocalypse ni noise mode con
  //   los umbrales legacy (0.75). Ahora sí.
  // ═══════════════════════════════════════════════════════════════

  harshnessAcidThreshold: 0.80,   // MUY alto — la distorsión del rock es normal, no acid
  flatnessNoiseThreshold: 0.60,   // WAVE 2521: SOAD — 0.75→0.60, ruido blanco detectable activa noise mode
  apocalypseHarshness: 0.65,      // WAVE 2521: SOAD — 0.75→0.65, distorsión extrema dispara máxima intensidad
  apocalypseFlatness: 0.65,       // Ligeramente más permisivo — walls of sound

  // ═══════════════════════════════════════════════════════════════
  // KICK DETECTION — Rápido para doble pedal
  // ═══════════════════════════════════════════════════════════════

  // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
  // Pop/Rock: energía media, guitarras dan mid consistente
  morphFloor: 0.20,      // El rock tiene mid desde la intro (guitarras)
  morphCeiling: 0.60,    // Chorus rock al 60% de mid → morph pleno

  kickEdgeMinInterval: 50,   // MUY corto — double bass drumming (blast beats 200+ BPM)
  kickVetoFrames: 0,         // CERO — el bombo NO puede silenciar la guitarra

  // WAVE 4686: Ambient viscosity — Pop/Rock organic
  // Viscoso musical: resonancia de parche real entre golpes
  // WAVE 2521: ANTI-MELAZA — attack 250→80ms, release 900→300ms.
  //   Los valores legacy generaban arrastre visual de 1.15s de ventana:
  //   el fan de tungsteno tardaba una vida en encenderse y apagarse.
  //   Con 80ms/300ms el ambiente reacciona orgánico pero corta de raíz.
  // WAVE 2522: VITAMINAS PARA EL TUNGSTENO — inyección de medios + gain boost.
  //   El ambient se alimentaba SOLO de subBass (bombo impulsivo) → caía a ~0
  //   entre kicks. El "rugido constante" del rock vive en MEDIOS (guitarras).
  //   ambientMidWeight 0.5: _ambMix = subBass + mid×0.5 → base 40-50% con
  //   guitarras constantes, 100% en estribillos (mid satura).
  //   ambientGain 2.0: boost post-crush para llevar la base a 40-50%.
  //   Matemática: mid~0.5 → _ambMix~0.55 → EMA~0.50 → crushed 0.25 →
  //   preGain 0.50 → intensity 0.41 (base). mid~0.75 → preGain 1.0 → 1.0 (clímax).
  ambientAttackMs: 80,
  ambientReleaseMs: 300,
  ambientMidWeight: 0.50,   // WAVE 2522: inyectar 50% de mid (guitarras) en el ambient
  ambientGain: 2.0,         // WAVE 2522: boost post-crush → base 40-50%, clímax 100%

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2522 — ESTRATEGIA DE ENRUTAMIENTO 4.1
  //
  // CAMBIO: 'default' → 'strict-split'. Neutraliza el smoothing residual
  // de 0.88 en el motor 4.1 (LiquidEngine41) y obliga al Front PAR a
  // acatar la velocidad real y staccato de los envelopes, sin puentes
  // artificiales. Con decayBase 0.25 (subBass) y 0.04 (kick), el pulso
  // rockero es seco y cortante — el smoothing lo convertía en melaza.
  // Front PAR = envKick solo (Metrónomo), Back PAR = max(snare, highMid).
  // ═══════════════════════════════════════════════════════════════
  layout41Strategy: 'strict-split',

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2521+2522 — OVERRIDES 4.1: OPERACIÓN RESCATE DEL BACK PAR
  //
  // PROBLEMA: backPar = max(envHighMid, envSnare) en 4.1.
  //   La guitarra rítmica (envHighMid) es CONTINUA y satura casi
  //   permanente → el snare nunca gana el max().
  //
  // CONTRAMEDIDAS:
  //   1. Capar envHighMid.maxIntensity 0.90→0.65 (por debajo del pico del
  //      snare 0.85) → el Látigo gana el max() en sus picos.
  //   2. Acelerar envHighMid.decayBase 0.35→0.30 (override del base 0.35)
  //      → aún más staccato en compactación 4.1.
  //   3. Subir envHighMid.gateOn 0.03→0.10 → no se abre permanentemente.
  //   4. Bajar envSnare.gateOn 0.10→0.06 → más sensible en compactación.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    // ── BACK PAR: el Látigo debe ganarle a la rítmica en max() ────
    envelopeHighMid: {
      maxIntensity: 0.65,   // WAVE 2521: 0.90→0.65 — cap por debajo del pico del snare
      decayBase: 0.30,      // WAVE 2522: 0.55→0.30 — aún más staccato en 4.1
      gateOn: 0.10,         // WAVE 2521: 0.03→0.10 — no abrir con murmullo
    },
    envelopeSnare: {
      gateOn: 0.06,         // WAVE 2521: 0.10→0.06 — más sensible en compactación
    },
  },
}
