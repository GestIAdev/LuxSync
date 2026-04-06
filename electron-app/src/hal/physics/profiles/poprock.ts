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
  envelopeSubBass: {
    name: 'Front L (Kick Drum Acústico)',
    gateOn: 0.15,
    boost: 2.8,
    crushExponent: 2.2,
    decayBase: 0.65,
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
  envelopeKick: {
    name: 'Front R (Kick Edge / Doble Pedal)',
    gateOn: 0.12,          // Más bajo que techno (0.15) — ghost notes
    boost: 2.8,
    crushExponent: 0.7,    // Expansivo — kicks débiles saturan
    decayBase: 0.06,       // Rápido — el pedal es staccato
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
  envelopeSnare: {
    name: 'Back R (Snare & Cymbal Snap)',
    gateOn: 0.10,
    boost: 3.5,
    crushExponent: 0.8,
    decayBase: 0.35,
    decayRange: 0.12,
    maxIntensity: 0.85,
    squelchBase: 0.02,
    squelchSlope: 0.12,
    ghostCap: 0.03,
    gateMargin: 0.01,
  },

  // Back L — Mid Synths / Guitarras Rítmicas / Teclados
  // En rock: la guitarra rítmica, el órgano Hammond, los pads.
  // ROCK_UNIFIED: moverLeft era LowMid+HighMid (guitarras+bajo).
  // Aquí Back L captura el cuerpo de la mezcla (mid synths).
  // WAVE 2436.2: decay 0.60→0.80 — guitarra rítmica orgánica con sustain real.
  //              Entre techno staccato (0.60) y latino groove (0.92).
  envelopeHighMid: {
    name: 'Back L (Rhythm Guitar & Keys)',
    gateOn: 0.03,
    boost: 4.0,
    crushExponent: 1.0,
    decayBase: 0.80,
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
  percGate: 0.008,        // Bajo — ghost notes de caja
  percBoost: 4.5,         // Entre techno (5.0) y latino (4.0)
  percExponent: 0.6,      // Ligeramente expansivo — suaviza los crashes

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("Lead/Sizzle"): Cross-filter hacia TREBLE+HIGHMID
  // Caza solos de guitarra, crashes, voces agudas.
  // bassSubtract moderado — el bajo eléctrico tiene fundamentales
  // que pueden filtrarse al treble vía armónicos.
  // ═══════════════════════════════════════════════════════════════

  bassSubtractBase: 0.45,    // Moderado — el bajo eléctrico tiene presencia
  bassSubtractRange: 0.30,   // Morph modula: secciones intensas → menos resta

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
  // input = max(0, mid × 0.5 + highMid × 0.8 + treble × 0.1 - bass × 0.1)
  // Mid+HighMid pesado — voz principal, riffs de guitarra.
  // Tonal threshold muy permisivo — el rock distorsionado no es tonal.
  // ═══════════════════════════════════════════════════════════════

  moverLHighMidWeight: 0.80,    // HighMid pesado — presencia de la voz
  moverLTrebleWeight: 0.10,     // Poco treble — no competir con Lead/Sizzle
  moverLMidWeight: 0.50,        // Mid pesado — cuerpo de la voz, power chords
  moverLTonalThreshold: 0.70,   // MUY permisivo — distorsión ≠ tonal, pero queremos que pase

  // ═══════════════════════════════════════════════════════════════
  // MOVER R ("Lead/Sizzle"): Resta de treble para sibilantes
  // En rock el Mover R QUIERE agudos — solos y crashes.
  // Resta mínima, solo para limpiar ruido de fondo.
  // ═══════════════════════════════════════════════════════════════

  moverRTrebleSub: 0.15,    // Resta leve — solos de guitarra son treble

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE — CASI NULO
  // El bombo acústico no ahoga al resto de la banda.
  // Un sidechain agresivo mataría la guitarra en el 4×4 del rock.
  // ═══════════════════════════════════════════════════════════════

  sidechainThreshold: 0.20,     // Alto — solo kicks extremos activan ducking
  sidechainDepth: 0.05,         // CASI NULO — el bombo es compañero, no dictador
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
  // ═══════════════════════════════════════════════════════════════

  harshnessAcidThreshold: 0.80,   // MUY alto — la distorsión del rock es normal, no acid
  flatnessNoiseThreshold: 0.75,   // Alto — el rock tiene armónicos, no ruido blanco
  apocalypseHarshness: 0.75,      // Solo en caos real (feedback, noise rock extremo)
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

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2439 — ESTRATEGIA DE ENRUTAMIENTO 4.1
  //
  // En 4.1 el rock usa 'default': frontPar = max(subBass, kick),
  // backPar = max(snare, highMid). Los dos graves coexisten —
  // el bombo acústico y el bajo eléctrico forman el muro de sonido.
  // 'strict-split' mataría el backPar (guitarra) al entregar solo
  // el snare, perdiendo el cuerpo rítmico del riff.
  // ═══════════════════════════════════════════════════════════════
  layout41Strategy: 'default',

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2435 — OVERRIDES 4.1
  //
  // El rock no necesita overrides de compactación: el max() del
  // default es correcto — el bombo acústico tiene decay suficiente
  // para coexistir con el bajo sin asfixiarlo (decayBase=0.65).
  // A diferencia del Latino (tumbao = decay 0.92 que domina el max),
  // el rock es más estocástico — los picos no se superponen tanto.
  // Sin overrides: herencia directa del perfil base.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    // Sin ajustes — el perfil base es correcto para 4.1
  },
}
