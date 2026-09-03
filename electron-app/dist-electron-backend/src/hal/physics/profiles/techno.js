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
export const TECHNO_PROFILE = {
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
        gateOn: 0.08,
        boost: 2.7054,
        crushExponent: 1.0,
        decayBase: 0.30, // WAVE 7749.57: 0.40→0.30 — más pegada, menos meloso
        decayRange: 0.166,
        maxIntensity: 0.5291,
        squelchBase: 0.0613,
        squelchSlope: 0.5788,
        ghostCap: 0.00, // WAVE 7749.57: 0.0357→0.00 — sin ghostcaps en ningún perfil
        gateMargin: 0.0288,
    },
    // Front R — El Francotirador (WAVE 2437: Monte Carlo 15k iter, fitness=756, 100% kick, 0 FP)
    // WAVE 2520: ANTI-MICRO-STROBE — decayBase 0.0077→0.08.
    //   0.0077 mataba la intensidad en 1 frame (0.77% residual) → parpadeo errático
    //   ante micro-transitorientes. 0.08 da un corte limpio de 2-3 frames (~45-65ms):
    //   chasquido seco sin melaza, pero el dimmer/LED digiere el pulso en lugar de
    //   ver un flash de 1 frame + 19 frames de oscuridad.
    // decayRange 0.10→0.0329 — rango estrecho, comportamiento uniforme.
    // gateOn 0.15→0.1098 — gate más bajo, captura kicks débiles sin abrir en basura.
    // maxIntensity 0.85→1.0 — hits al máximo, contraste máximo con el silencio.
    // squelchSlope 0.10→0.0 — sin squelch dinámico, el gate fijo es suficiente.
    // boost 3.0→3.3 — leve compensación por gate más bajo.
    envelopeKick: {
        name: 'Front R (Kick Sniper)',
        gateOn: 0.28,
        boost: 3.3013,
        crushExponent: 1.0,
        decayBase: 0.06, // WAVE 7749.57: 0.08→0.06 — más snap, más contraste techno
        decayRange: 0.0329,
        maxIntensity: 0.80, // WAVE 2439.2 Cap de Dimmer — headroom para el slap del Snare
        squelchBase: 0.0388,
        squelchSlope: 0.0,
        ghostCap: 0.00,
        gateMargin: 0.0213,
    },
    // Mover R — El Coro / Voces (WAVE 2419 MONTE CARLO RIGHT HEMISPHERE)
    // WAVE 3491: Bozal de Mover — solo picos afilados de synth/arpegio pasan.
    // WAVE 2520: DESBOZALADO PARCIAL — crushExponent 3.5→1.8, squelchBase 0.30→0.15.
    //   El Bozal original guillotinaba arpegios progresivos (Opus / Eric Prydz)
    //   tratándolos como ruido. Curva más lineal + piso más bajo deja respirar
    //   las progresiones tonales y sintetizadores envolventes disparando las
    //   luces con naturalidad, sin perder la limpieza contra colchón de graves.
    envelopeVocal: {
        name: 'Mover R (Vocal & Synth Wash)',
        gateOn: 0.25, // WAVE 3491: 0.01→0.25 — mínimo obligatorio Bozal
        boost: 1.5,
        crushExponent: 1.8, // WAVE 2520: 3.5→1.8 — curva menos convexa, arpegios respiran
        decayBase: 0.70,
        decayRange: 0.05,
        maxIntensity: 0.80,
        squelchBase: 0.15, // WAVE 2520: 0.30→0.15 — piso relajado, progresiones pasan
        squelchSlope: 0.10,
        ghostCap: 0.00,
        gateMargin: 0.01,
    },
    // Back R — El Látigo / Percussion Slap (WAVE 2427 TRANSIENT SHAPER)
    // rawRight = trebleDelta×4: el ruido de fondo tiene delta≈0 (señal continua), los transitories arrancan.
    // gateOn 0.15: cualquier salto brusco del treble lo activa
    // gateOff 0.02: apagado inmediato tras el impacto
    // WAVE 3311: gateOn 0.05→0.18 + boost 3.0→2.5 + percGate 0.01→0.06
    //   Demasiado back-par con cualquier fuente (voces, fondo). Gate insuficiente.
    //   Subimos gate+percGate para requerir un hit de percusión real.
    envelopeSnare: {
        name: 'Back R (Percussion Slap)',
        gateOn: 0.28, // BACK-PAR TUNE: 0.35→0.28 — re-disparar más fácil entre hits del redoble
        boost: 2.5, // WAVE 8009.3: 1.0→2.5 — igualar ganancia efectiva del Latino para cruce visual
        crushExponent: 1.0,
        decayBase: 0.32, // WAVE 7749.21: 0.40→0.32 — snap industrial más brutal. Cae a negro en ~90ms. Latino respira con 0.60.
        decayRange: 0.40, // WAVE 2451: INTOCABLE — morfología líquida de los Back Pars preservada
        maxIntensity: 1.0, // WAVE 2439.5: 0.80→1.0 — el Látigo sin cap
        squelchBase: 0.20, // WAVE 6066: 0.52→0.20 — limpieza se hará matemáticamente pre-envelope
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
        gateOn: 0.15, // OPERACIÓN: Luz Líquida — baja la compuerta para capturar colas de voces
        boost: 1.5,
        crushExponent: 1.0, // OPERACIÓN: Linealidad pura para suavizar el pulso atmosférico
        decayBase: 0.50, // WAVE 7749.22: 0.62→0.50 — colchón más ágil, libera entre acordes
        decayRange: 0.25, // WAVE 3492: 0.35->0.25 — morph menos determinante para la caída
        maxIntensity: 0.85,
        squelchBase: 0.25, // OPERACIÓN: Mantiene a raya el barro de los graves
        squelchSlope: 0.10,
        ghostCap: 0.00, // WAVE 3492: 0.05->0.00 — negro entre golpes
        gateMargin: 0.005,
        adaptiveNoiseAlpha: 0.0, // WAVE 8009.3: anti-freeze — sin deriva adaptativa de ruido
        sustainedSquelchMaxBoost: 0.0, // WAVE 8009.3: anti-freeze — sin escalada de squelch por synths sostenidos
    },
    // Mover L — Melodías tonales (WAVE 2417: MONTE CARLO RESURRECTION)
    // WAVE 3491: Bozal de Mover — arpegios agudos pasan, colchón de graves NO.
    // WAVE 2520: DESBOZALADO PARCIAL — crushExponent 3.5→1.8, squelchBase 0.30→0.15.
    //   Mismo razonamiento que envelopeVocal: las melodías progresivas de synth
    //   (Opus, Eric Prydz) eran guillotinadas por el Bozal original. Curva más
    //   lineal + piso más bajo deja disparar los arpegios suaves con naturalidad.
    envelopeTreble: {
        name: 'Mover L (Tonal Melodies)',
        gateOn: 0.25, // WAVE 3491: 0.02→0.25 — mínimo obligatorio Bozal
        boost: 4.0,
        crushExponent: 1.8, // WAVE 2520: 3.5→1.8 — arpegios suaves respiran
        decayBase: 0.78,
        decayRange: 0.03,
        maxIntensity: 1.0,
        squelchBase: 0.15, // WAVE 2520: 0.30→0.15 — piso relajado
        squelchSlope: 0.10,
        ghostCap: 0.00, // WAVE 3491: 0.04→0.00 — negro absoluto entre arpegios
        gateMargin: 0.005,
    },
    // ═══════════════════════════════════════════════════════════════
    // BACK R: SCHWARZENEGGER (WAVE 2408M)
    // ═══════════════════════════════════════════════════════════════
    percMidSubtract: 1.0, // WAVE 2424: Escudo Absoluto — relación 1:1, ningún sinte puede engañar al Látigo
    percGate: 0.04, // BACK-PAR TUNE: 0.06→0.04 — dejar pasar hits suaves del redoble de caja
    percBoost: 5.0, // WAVE 2419: 8.0→5.0
    percExponent: 0.5, // WAVE 2419: 1.2→0.5 (raíz cuadrada, suaviza transitorio)
    // ═══════════════════════════════════════════════════════════════
    // MOVER R (VOCES): BASS SUBTRACTOR (WAVE 2408g)
    // ═══════════════════════════════════════════════════════════════
    bassSubtractBase: 0.65,
    bassSubtractRange: 0.45,
    // ═══════════════════════════════════════════════════════════════
    // BACK L (MID SYNTHS): Ghost Mids Reform (WAVE 3464)
    // Objetivo: alimentar Back L con cuerpo melódico (MID) y purgar fuga de bombo.
    // Señal efectiva buscada: mid*1.0 - bass*0.7 (sustracción híbrida purificada).
    // Esto deja pasar la base armónica de synths sin comer el pico percutivo del kick.
    // ═══════════════════════════════════════════════════════════════
    backLLowMidWeight: 0.0, // WAVE 2430: original no usaba lowMid
    backLMidWeight: 0.85, // OPERACIÓN: Devolvemos el cuerpo del sinte — potencia sin asfixia
    backLTrebleSub: -0.3, // WAVE 8009.3: 0.0→-0.3 — inyectar 30% treble para hi-hats sutiles del minimal
    backLBassSub: 0.0, // OPERACIÓN: Aislamiento estricto del bajo (0.0) para evitar fuga de bombo
    // ═══════════════════════════════════════════════════════════════
    // MOVER L (MELODÍAS): Cross-filter + tonal gate (WAVE 2411 → 2430)
    // Original hardcodeado: mid×0.4 + highMid×1.0 - bass×0.1
    // Nuevo: highMid×moverLHighMidWeight + treble×moverLTrebleWeight - bass×0.1
    // Para Techno: highMid×1.0 + treble×0.0 (mid×0.4 se mueve a highMid)
    // ═══════════════════════════════════════════════════════════════
    moverLHighMidWeight: 1.0, // WAVE 2430: original = highMid×1.0
    moverLTrebleWeight: 0.0, // WAVE 2430: original no usaba treble directo aquí
    moverLMidWeight: 0.4, // WAVE 2430: original = mid×0.4
    moverLTonalThreshold: 0.40,
    // ═══════════════════════════════════════════════════════════════
    // MOVER R (VOCES): resta de treble para sibilantes
    // ═══════════════════════════════════════════════════════════════
    moverRTrebleSub: 0.3,
    // ═══════════════════════════════════════════════════════════════
    // SIDECHAIN GUILLOTINE
    // ═══════════════════════════════════════════════════════════════
    sidechainThreshold: 0.1,
    sidechainDepth: 0.00, // WAVE 3457: sidechain exterminado globalmente
    snareSidechainDepth: 0.15, // WAVE 2420: 0.80→0.15 (liberamos Mover R — la guillotina era fratricida)
    // WAVE 2438 — valores legacy, ya no usados en strict-split pero se conservan
    // para compatibilidad con el path 'default' si se cambia la estrategia.
    frontKickSidechainThreshold: 0.2,
    auraCapBase: 0.25,
    auraCapExponent: 2,
    // WAVE 2439 — METRÓNOMO/LIENZO: enrutamiento estricto para Techno 4.1.
    // Front=kick, Back=snare, Movers=todo el muro atmosférico.
    layout41Strategy: 'strict-split',
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
    // WAVE 2488 — DT-02: MORPHOLOGY UNCHAINED
    // Techno industrial: energía media-alta, rango estándar
    morphFloor: 0.30, // avgMid mínimo para arrancar el morph (30%)
    morphCeiling: 0.70, // avgMid máximo = morph pleno (70%)
    kickEdgeMinInterval: 180, // WAVE 8005.2: 80→180 — subbass rodante dispara armónicos cada ~120ms, 180ms los filtra
    kickVetoFrames: 0, // WAVE 2419: 5→0 (veto ON 48% del tiempo, asfixiaba Mover R)
    // WAVE 4826.5: La Guillotina Techno — Ambient ultra-reactivo y cortante
    // Attack 30ms: dispara instantáneo con el bombo. Release 120ms: corte brutal entre kicks.
    ambientAttackMs: 30,
    ambientReleaseMs: 120,
    // ═══════════════════════════════════════════════════════════════
    // WAVE 2520: OVERRIDES 4.1 — CALIBRACIÓN EXTREMA ANTI-MELAZA
    //
    // PROBLEMA 1: Aislamiento Back PAR.
    //   backPar = max(backLeft, backRight) = max(envHighMid, envSnare).
    //   El colchón de sintes (envHighMid) es CONTINUO y satura ~0.85 constante;
    //   el Látigo (envSnare) es impulsivo. max() deja ganar al colchón casi
    //   siempre → el snare desaparece visualmente tras el muro de mid synths.
    //
    //   CONTRAMEDIDA: capar envHighMid.maxIntensity a 0.60 (por debajo del
    //   pico del Látigo) + acelerar su decayBase (0.62→0.45) para que el
    //   colchón libere entre golpes y deje campo al snare en el max().
    //   Además bajamos envSnare.gateOn (0.28→0.22) para capturar hits más
    //   sutiles del redoble que el compactado 4.1 tiende a tragarse.
    //
    // PROBLEMA 2: Pulso del Metrónomo en 4.1.
    //   El Front PAR en strict-split = envKick solo. El decayBase base ya
    //   subió a 0.08 (anti-micro-strobe). En 4.1 apretamos decayRange
    //   (0.0329→0.02) para comportamiento aún más uniforme entre frames,
    //   ya que el smoothing 0.88 del motor ha sido neutralizado para
    //   strict-split (ver LiquidEngine41.routeZones) — el envelope crudo
    //   es ahora el único responsable del pulso.
    //
    // PROBLEMA 3: Movers en compactación.
    //   Los movers NO se compactan en 4.1 (pasan directos), así que heredan
    //   el desbozalado del base (crushExponent 1.8, squelchBase 0.15). No
    //   requieren override adicional aquí.
    // ═══════════════════════════════════════════════════════════════
    overrides41: {
        // ── BACK PAR: el Látigo debe ganarle al Coro en max() ──────────
        envelopeHighMid: {
            maxIntensity: 0.60, // WAVE 2520: 0.85→0.60 — cap por debajo del pico del snare
            decayBase: 0.45, // WAVE 2520: 0.62→0.45 — colchón libera entre golpes
        },
        envelopeSnare: {
            gateOn: 0.22, // WAVE 2520: 0.28→0.22 — más sensible en compactación
        },
        // ── FRONT PAR: Metrónomo uniforme sin inercia del motor ────────
        envelopeKick: {
            decayRange: 0.02, // WAVE 2520: 0.0329→0.02 — uniforme (smoothing neutralizado)
        },
        layout41Strategy: 'strict-split',
        // WAVE 7749.4: Tame the Sustain Choke for dense techno.
        // The choke was murdering the channel during continuous bass walls,
        // dropping hybridSnare to 0.000 for seconds at a time (blackouts).
        // snareChokeFrames 4→15: wait ~300ms before choking, preventing blackouts
        // during fast 4/4 beats. snareChokeRate 0.70→0.85: softer exponential decay.
        // WAVE 7749.8: Veto floors raised 0.02→0.04. Now that we use RAW crackDelta
        // (not max(crackDelta, bodyDelta)), the raw delta is clean. The 0.02 floors
        // were letting hi-hat bleed and synth tails through. 0.04 requires real
        // broadband noise content, vetoing weak tonal bleed.
        snareVetoFlatnessFloor: 0.04,
        snareVetoFlatnessKnee: 0.10,
        snareVetoWnsFloor: 0.04,
        snareVetoWnsKnee: 0.20,
        snareVetoFluxFloor: 0.05,
        snareVetoFluxKnee: 0.20,
        snareChokeFrames: 15,
        snareChokeRate: 0.85,
        // ⚒️ WAVE 7749.60: Techno decay 0.50→0.65. The 0.50 decay produced a
        // 3-frame visual stutter (1.0→0.50→0.25→0.125) perceived as "3 broken
        // hits per beat". 0.65 smooths the tail: 1.0→0.65→0.42→0.27→0.18 —
        // a single cohesive strike with a natural fade. Latino stays at 0.25
        // (dembow density requires fast re-trigger).
        snareImpulseDecay: 0.65,
    },
};
