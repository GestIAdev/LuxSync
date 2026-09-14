/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩸 RAVEX — DIENTES DE SIERRA (Perfil Físico de Destrucción Visual)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Referencia artística: Cyberpunk 2077 · Teknival underground · Anyma ·
 * Skrillex · 808 distorsionado · sintetizadores industriales.
 *
 * RaveX NO es un techno más agresivo. Es una inversión de la filosofía del
 * motor. El resto de perfiles buscan "luz líquida" (viscosidad, ríos, colchones,
 * respiración). RaveX busca lo contrario: **luz mecánica**. Ataque instantáneo,
 * amplitud binaria, corte seco, negro absoluto entre golpes.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LOS 7 AXIOMAS DE RAVEX (aplicados a TODAS las envolventes)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 1️⃣  MORPH CLAVADO EN 1 (morphFloor 0.01 / morphCeiling 0.06)
 *     Esta es la decisión más extrema del perfil y la que reescribe la física
 *     entera. `morphFactor = clamp((avgMid-0.01)/0.05)` → con cualquier música
 *     real (avgMid > 0.06) el morph queda **saturado a 1.0 permanentemente**.
 *     RaveX no tiene estados de ánimo, solo violencia. Consecuencias exactas
 *     dentro de LiquidEnvelope.process():
 *       · `requiredJump = 0.14 - 0.07·morph` → **0.07** (la mitad). Un salto de
 *         solo 7 puntos sobre el gate ya satura rawPower a 1.0 → hits binarios.
 *       · `crushExp = crushExponent + 0.3·(1-morph)` → el +0.3 desaparece: el
 *         exponente que escribo abajo es el exponente REAL, sin deriva.
 *       · `hit = kickPower · (1.2 + 0.8·morph) · boost` → factor **2.0** fijo:
 *         todo hit real revienta el techo → mesetas planas (onda cuadrada).
 *       · `squelch = squelchBase - squelchSlope·morph` → determinista (slope=0).
 *       · `decay = decayBase + decayRange·morph` → determinista (range=0).
 *       · Bonus letal: el Escudo Morfológico del Centroide
 *         (`centroidFloor = 900·(1-morph)`) cae a **0 Hz**. En techno bloquea
 *         los snare fills que caen sobre el bombo; en RaveX pasan TODOS. Los
 *         redobles de dubstep sobre el kick ya no se censuran.
 * 2️⃣  decayRange = 0 en todas las zonas → la caída no la negocia nadie.
 * 3️⃣  squelchSlope = 0 en todas las zonas → el umbral de ignición es una
 *     constante física, no una función del contexto.
 * 4️⃣  crushExponent < 1.0 SIEMPRE (expansivo, cóncavo). Es la inversión del
 *     "Bozal" (que usaba 1.8 convexo para dejar respirar arpegios). Aquí
 *     cualquier transitorio que cruce el gate se expande hacia 1.0: la luz no
 *     tiene rampas suaves, solo dos estados. Diente de sierra puro.
 * 5️⃣  ghostCap = 0.00 en todo. Sin brillo subliminal. Negro DMX absoluto.
 * 6️⃣  CERO `sustainedSquelch*`. El anti-sustain del motor DIMA la nota poco a
 *     poco (0.01/frame hasta un cap) — y dimar gradualmente **es respirar**,
 *     está prohibido por mandato. Se sustituye por `attackSlopeMin`: un veto
 *     binario de pendiente. Si no hay ataque medible, no hay luz. El pad
 *     sostenido no se atenúa: no existe.
 * 7️⃣  CERO `riseRate`. `riseRate` es una rampa de ataque (anti-tembleque de
 *     los movers latinos). Su ausencia = subida instantánea en un frame.
 *     Latencia residual = 0.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LA ARQUITECTURA 3D: PARALAJE TEMPORAL
 * ───────────────────────────────────────────────────────────────────────────
 * Las 10 zonas no comparten `decayBase`. Cada una tiene una **longitud de
 * diente distinta** (0.10 → 0.42 por frame). Al golpear todas en el mismo
 * transitorio pero apagarse a velocidades distintas, el ojo lee profundidad:
 * el Air muere en 2 frames, el Kick en 3, el Suelo en 5, la Sierra en 6.
 * Eso es un frente de onda atravesando la sala — la música en 3D.
 *
 *   Air        0.10  ▓▁▁▁▁▁▁▁▁     cuchilla
 *   BackL/hats 0.12  ▓▏▁▁▁▁▁▁▁     estroboscopio de contratiempo
 *   FrontR/kick 0.14 ▓▎▁▁▁▁▁▁▁     martillo neumático
 *   BackR/snare 0.20 ▓▍▁▁▁▁▁▁      látigo
 *   FrontL/808 0.30  ▓▌▂▁▁▁▁▁      pistón
 *   Floor      0.34  ▓▋▂▁▁▁▁▁      terremoto
 *   MoverR     0.38  ▓▊▃▁▁▁▁       grito
 *   MoverL     0.42  ▓▉▄▂▁▁▁       sierra
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMPORTAMIENTO EMERGENTE VERIFICADO (simulación 44Hz, 150 BPM)
 * ───────────────────────────────────────────────────────────────────────────
 * El cortafuegos de grave del hemisferio izquierdo (`backLBassSub` 0.20) y el
 * bass-subtractor del derecho (`bassSubtractBase` 0.90) producen un efecto no
 * planificado y perfectamente alineado con la tesis: cuando el kick SUELTA,
 * la caída del grave genera un flanco POSITIVO en `treble·1.5 - bass·0.20` y
 * en `mid - bass·0.90`. Resultado: Back L y Mover R se encienden en el hueco
 * inmediatamente posterior al martillo. La sala late en contrafase con el
 * bombo sin una sola línea de motor nueva. Es el estroboscopio inverso,
 * emergiendo de la aritmética.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * EL MURO ACÚSTICO — RESPETADO AL 100%
 * ───────────────────────────────────────────────────────────────────────────
 * No se toca NADA de la calibración post-FFT: `snareMomentumFloor` 0.040,
 * `snareMomentumFloorMin` 0.002, θ 0.01, αF 1.00, αS 0.05, reset 0.15/0.70,
 * `snarePath1BassDeltaFloor` 0.005 y los seis coeficientes del Veto de
 * Tonalidad (Monte Carlo WAVE 7775, 12704 frames) se heredan literales.
 * Esos números detectan la caja; RaveX solo decide qué hacer con ella.
 *
 * ⚠️ `id` DEBE seguir siendo 'rave-highfreq': es la clave de
 * `VIBE_TRAITS['rave'].liquidProfileId` (deriveTraitsFromProfile hace reverse
 * lookup por este string). Cambiarlo degradaría el vibe a traits de 'idle'.
 *
 * @module hal/physics/profiles/rave
 * @version WAVE RAVEX — DIENTES DE SIERRA
 */
export const RAVEX_PROFILE = {
    id: 'rave-highfreq',
    name: 'RaveX — Dientes de Sierra',
    // ═══════════════════════════════════════════════════════════════
    // ENVELOPE CONFIGS — Las 8 personalidades mecánicas
    // ═══════════════════════════════════════════════════════════════
    // ── FRONT L · EL PISTÓN ────────────────────────────────────────
    // Deja de ser "El Océano". En RaveX el subgrave es un 808 distorsionado:
    // un martillo de pistón, no una marea. maxIntensity 0.529→1.00 (el cap de
    // techno existía para que el sub cediera protagonismo al kick; aquí front L
    // y front R son luminarias distintas, no compiten en un max()).
    // crushExponent 0.70: expansivo — el ataque del 808 llega a tope siempre.
    // attackSlopeMin 0.010 es el corazón del axioma 6: un sub-bass HELD (típico
    // en el drop de dubstep) tiene velocity ≈ 0 → jamás re-dispara → el envelope
    // lo deja caer a negro en 4 frames. Solo el ATAQUE del 808 produce luz.
    // El sustain no se dima: se ignora. Contraste brutal por construcción.
    envelopeSubBass: {
        name: 'Front L (808 Piston)',
        gateOn: 0.10,
        boost: 3.2,
        crushExponent: 0.70,
        decayBase: 0.30, // ~5 frames a negro (110ms) — diente medio
        decayRange: 0.00, // AXIOMA 2
        maxIntensity: 1.00,
        squelchBase: 0.18,
        squelchSlope: 0.00, // AXIOMA 3
        ghostCap: 0.00, // AXIOMA 5
        gateMargin: 0.035, // margen alto: el suelo de ruido del sub no cuenta
        attackSlopeMin: 0.010, // AXIOMA 6 — veto binario de pendiente
    },
    // ── FRONT R · EL MARTILLO NEUMÁTICO ───────────────────────────
    // gateOn 0.26 es el ÚNICO valor casi heredado de techno, y no por estética:
    // `isImpact = pureBassEnergy > envelopeKick.gateOn && bassDelta > dynamicDelta`
    // (LiquidEngineBase:807) reutiliza este campo como umbral del DETECTOR de
    // kick. Bajarlo a 0.26 (desde 0.28) abre un poco la sensibilidad para kicks
    // hardstyle comprimidos sin invitar falsos positivos del bajo rodante.
    // boost 4.2 + crush 0.55 + squelch 0.10 = con morph=1 CUALQUIER kick que
    // cruce el gate sale a 1.000 exacto. Cero dinámica, cero degradado: el kick
    // es un interruptor. decayBase 0.14 → 1.000 / 0.140 / 0.020 / 0 = golpe seco
    // de 3 frames (~68ms). Es el pulso del martillo, no un fade.
    envelopeKick: {
        name: 'Front R (Pneumatic Hammer)',
        gateOn: 0.26,
        boost: 4.2,
        crushExponent: 0.55,
        decayBase: 0.14,
        decayRange: 0.00,
        maxIntensity: 1.00, // techno capaba a 0.80 por headroom del snare; RaveX no cede
        squelchBase: 0.10,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.030,
    },
    // ── MOVER R · EL GRITO ────────────────────────────────────────
    // Deja de ser "La Dama" (voces suaves). Es el lead que chilla: growl de
    // neurofunk, reese, vocal chop destrozado. crushExponent 1.8→0.80 (el
    // "Desbozalado" de techno buscaba que los arpegios respiraran; RaveX no
    // quiere respiración, quiere el chillido a tope). squelchBase 0.16 bajo
    // porque el bass-subtractor de abajo (0.90) ya deja la señal muy limpia.
    // attackSlopeMin 0.006: los pads de breakdown quedan invisibles; el motor
    // solo enciende cuando el lead ataca.
    envelopeVocal: {
        name: 'Mover R (Lead Scream)',
        gateOn: 0.22,
        boost: 4.0,
        crushExponent: 0.80,
        decayBase: 0.38, // diente largo: el mover necesita cuerpo visible
        decayRange: 0.00,
        maxIntensity: 1.00,
        squelchBase: 0.16,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.020,
        attackSlopeMin: 0.006,
    },
    // ── BACK R · EL LÁTIGO / LA GUILLOTINA ────────────────────────
    // El detector de caja (MACD + veto + rescates) es intocable, así que aquí
    // solo esculpo la cinemática de salida. El input `hybridSnare` ya es un
    // impulso 0→1, así que crush 0.60 lo convierte en meseta plana instantánea.
    // decayBase 0.32→0.20: techno buscaba "un golpe cohesionado"; RaveX quiere
    // que cada 32avo de un redoble de Skrillex sea un diente independiente.
    // decayRange 0.40→0.00: la nota de WAVE 2451 marcaba ese 0.40 como
    // "morfología líquida INTOCABLE" — pero es intocable para el techno, no
    // para un perfil nuevo cuya tesis es exactamente eliminar la morfología.
    // squelchBase 0.26: el veto de tonalidad ya filtra sintes; este squelch alto
    // añade una segunda barrera para que solo impactos con cuerpo real enciendan.
    envelopeSnare: {
        name: 'Back R (Whip Guillotine)',
        gateOn: 0.20,
        boost: 4.5,
        crushExponent: 0.60,
        decayBase: 0.20,
        decayRange: 0.00,
        maxIntensity: 1.00,
        squelchBase: 0.26,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.020,
    },
    // ── BACK L · EL CONTRA-TIEMPO (LA INVERSIÓN) ──────────────────
    // 🔥 Aquí RaveX rompe con el motor. En todos los perfiles Back L es "El
    // Coro": un colchón de mid-synths con decayBase 0.75 ("Ríos de Luz") que
    // fluye continuo. Ese colchón es EXACTAMENTE lo que el mandato prohíbe:
    // luz que respira, señal que nunca se apaga.
    //
    // En RaveX Back L se convierte en un ESTROBOSCOPIO RÍTMICO INVERSO: se
    // alimenta de hi-hats y ruido de contratiempo (ver `backLMidWeight: 0.0` y
    // `hhBlendGain: 1.0` abajo), no de armonía. Mientras el hemisferio derecho
    // martillea el tiempo fuerte (kick/snare), el izquierdo dispara EN LOS
    // HUECOS. La sala se parte en dos máquinas antagónicas y el groove aparece
    // como interferencia entre ambas.
    //
    // decayBase 0.75→0.12: de río continuo a diente de 2 frames. Es el cambio
    // más violento del perfil (−84% de viscosidad).
    // Sin choke, sin adaptiveNoiseAlpha: no hay nada sostenido que asfixiar.
    envelopeHighMid: {
        name: 'Back L (Inverse Hat Strobe)',
        gateOn: 0.16,
        boost: 3.8,
        crushExponent: 0.55,
        decayBase: 0.12,
        decayRange: 0.00,
        maxIntensity: 1.00, // 0.85→1.00: ya no cede el max() al snare (ver overrides41)
        squelchBase: 0.22,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.030,
        // 🩸 IMPRESCINDIBLE (verificado en simulación 44Hz): sin este veto Back L
        // se clava en 1.000 permanente. El motor considera "atacando" a cualquier
        // frame con `velocity >= -0.005` (LiquidEnvelope:195), así que una señal
        // PLANA cruza el gate para siempre. Techno lo tapaba con el choke por
        // sustain (dimado gradual); RaveX lo resuelve en binario: 0.010 exige un
        // flanco real de charles. El colchón de agudos del supersaw no enciende.
        attackSlopeMin: 0.010,
    },
    // ── MOVER L · LA SIERRA ───────────────────────────────────────
    // El supersaw distorsionado, el riser, el growl de Anyma. crushExponent
    // 1.8→0.75 y squelchBase 0.15→0.14: el Bozal queda desmantelado.
    // decayBase 0.42 es el diente MÁS LARGO del perfil (6 frames, ~135ms) y es
    // deliberado: los movers son los únicos cuerpos con inercia mecánica real
    // (pan/tilt). Darles el diente largo genera el paralaje que hace legible la
    // profundidad; si todo cayera en 2 frames, la sala sería un plano.
    envelopeTreble: {
        name: 'Mover L (Saw Blade)',
        gateOn: 0.20,
        boost: 4.5,
        crushExponent: 0.75,
        decayBase: 0.42,
        decayRange: 0.00,
        maxIntensity: 1.00,
        squelchBase: 0.14,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.020,
        attackSlopeMin: 0.006, // el pad de breakdown no enciende; el stab sí
    },
    // ── FLOOR · EL TERREMOTO (láser de suelo) ─────────────────────
    // Sobrescribo el default del motor (decayBase 0.75 = "pulso rodante"), que
    // para RaveX es melaza. Input = max(0,bassDelta)·2 + subBass·floorSubWeight.
    // crushExponent 1.5→0.65: el delta del bombo es pequeño pero afilado;
    // expandirlo lo lleva a tope en un frame.
    envelopeFloor: {
        name: 'Floor (Earthquake)',
        gateOn: 0.06,
        boost: 3.6,
        crushExponent: 0.65,
        decayBase: 0.34, // 5 frames — el suelo es la onda más lenta del frente
        decayRange: 0.00,
        maxIntensity: 1.00,
        squelchBase: 0.20,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.015,
        attackSlopeMin: 0.000, // bassDelta YA es una velocidad: no vetar por pendiente
    },
    // ── AIR · LAS CUCHILLAS (láser aéreo) ─────────────────────────
    // El default del motor (gateOn 0.35, crush 2.5) está prácticamente MUERTO en
    // la práctica: con `airTrebleWeight 1.0 / airHighMidWeight 0.0` el input es
    // treble puro, y el AGC del treble está vetado a targetRMS 0.10 — casi nunca
    // llega a 0.35. RaveX lo resucita por dos vías legales (sin tocar el AGC):
    //   · gateOn 0.35→0.16 (umbral del perfil, no del muro acústico)
    //   · airHighMidWeight 0.0→0.55 (mezcla el cuerpo del hat/crash 2-6kHz)
    // crushExponent 0.50 = el más expansivo del perfil: un roce de charles ya
    // es un fogonazo. decayBase 0.10 = 2 frames. Cuchilla, no haz.
    envelopeAir: {
        name: 'Air (Blades)',
        gateOn: 0.16,
        boost: 4.2,
        crushExponent: 0.50,
        decayBase: 0.10,
        decayRange: 0.00,
        maxIntensity: 1.00,
        squelchBase: 0.20,
        squelchSlope: 0.00,
        ghostCap: 0.00,
        gateMargin: 0.030,
        attackSlopeMin: 0.008, // solo estocadas: el ruido de fondo de agudos no cuenta
    },
    // ═══════════════════════════════════════════════════════════════
    // BACK R: SCHWARZENEGGER (legacy inerte)
    // El transient shaper de percusión ya no se lee en el hot-path
    // (LiquidEngineBase solo los fusiona en el perfil efectivo). Se
    // declaran por contrato de tipo; no producen física.
    // ═══════════════════════════════════════════════════════════════
    percMidSubtract: 1.0,
    percGate: 0.04,
    percBoost: 5.0,
    percExponent: 0.5,
    // ═══════════════════════════════════════════════════════════════
    // MOVER R: BASS SUBTRACTOR — purga total del grave
    // subtractFactor = base - morph×range = 0.90 - 1.0×0.00 = 0.90
    // ═══════════════════════════════════════════════════════════════
    // Con morph clavado en 1, techno (0.65/0.45) colapsaría a 0.20: el bombo
    // entero se filtraría al mover y La Dama se volvería un segundo kick.
    // RaveX invierte los papeles: range 0.00 (determinismo, axioma 2) y base
    // 0.90 — sustracción quirúrgica del grave. El mover derecho solo ve el lead.
    bassSubtractBase: 0.90,
    bassSubtractRange: 0.00,
    // ═══════════════════════════════════════════════════════════════
    // BACK L: EL CROSS-FILTER INVERTIDO (la mutación clave)
    // input = lowMid·0 + cleanMid·0.0·(...) - treble·(-1.50) - bass·0.20
    //       = treble·1.50 - bass·0.20
    // ═══════════════════════════════════════════════════════════════
    // backLMidWeight 0.85 → 0.00 : ejecución del colchón armónico. El mid es la
    //   banda más continua del espectro de club; mientras alimente a Back L, esa
    //   zona nunca se apagará. Se elimina de raíz.
    // backLTrebleSub -0.3 → -1.50 : el signo negativo INYECTA (input resta este
    //   término). Techno metía un 30% de treble "para hi-hats sutiles del
    //   minimal". RaveX mete 150%: el treble pasa de condimento a combustible
    //   único. Con AGC treble targetRMS 0.10, el ×1.5 es lo que permite cruzar
    //   el suelo duro `signal > 0.15` del envelope sin tocar el muro acústico.
    // backLBassSub 0.20 : cortafuegos. Sin él, la fuga del bombo en agudos
    //   sincronizaría Back L con Front R y el contra-tiempo se perdería.
    backLLowMidWeight: 0.00,
    backLMidWeight: 0.00,
    backLTrebleSub: -1.50,
    backLBassSub: 0.20,
    // hhBlendGain 0.8 → 1.00 : el adaptador de hi-hat entrega un impulso binario
    // (1.0 en el onset, ×0.03/frame después). Con gain 1.0 ese impulso entra
    // CRUDO a Back L vía `max(midSynthInput, hhImpulse·gain)`. Como midSynthInput
    // ya no tiene colchón, el max() deja de ser un problema y se convierte en el
    // reloj del contra-tiempo: un diente de sierra perfecto por cada charles.
    hhBlendGain: 1.00,
    // ═══════════════════════════════════════════════════════════════
    // MOVER L: CROSS-FILTER + CENSURA TONAL ABOLIDA
    // ═══════════════════════════════════════════════════════════════
    // Pesos: RaveX vive arriba. highMid 1.0 + treble 0.85 (techno usaba 0.0:
    // no quería agudos en el mover) + mid 0.4→0.20 (menos barro).
    //
    // moverLTonalThreshold 0.40 → 0.99 : ejecución del gate tonal.
    //   `isTonal = flatness < threshold`. Y OJO al dato duro: desde WAVE 8001 la
    //   flatness es POWER-DOMAIN (música tonal 0.01-0.09, percusiva 0.16-0.36,
    //   ruido 0.49+). Un umbral de 0.40 ya deja pasar casi todo lo percusivo,
    //   pero guillotina justo lo que define a RaveX: el growl saturado, el riser
    //   de ruido blanco, el 808 con distorsión — señales de flatness alta que el
    //   motor clasifica como "basura no tonal". En RaveX **el ruido ES la
    //   melodía**, así que la puerta se abre de par en par (0.99). La
    //   discriminación de ruido se delega a `flatnessNoiseThreshold` y al
    //   Apocalypse Mode, donde el ruido no se castiga: se celebra.
    moverLHighMidWeight: 1.00,
    moverLTrebleWeight: 0.85,
    moverLMidWeight: 0.20,
    moverLTonalThreshold: 0.99,
    // ═══════════════════════════════════════════════════════════════
    // MOVER R: inyección de agudos (signo invertido)
    // input = max(0, cleanMid - treble·moverRTrebleSub)
    // ═══════════════════════════════════════════════════════════════
    // Techno restaba 0.3 para limpiar sibilantes. RaveX pone -0.40: inyecta un
    // 40% de treble. El chillido metálico del lead ya no se filtra, se amplifica.
    moverRTrebleSub: -0.40,
    // ═══════════════════════════════════════════════════════════════
    // SIDECHAIN — EXTERMINADO POR COMPLETO
    // ═══════════════════════════════════════════════════════════════
    // En RaveX nada cede el paso a nada. El ducking es cortesía musical, y la
    // colisión simultánea de las 10 zonas ES el efecto buscado. snareSidechain
    // 0.15→0.00: el látigo ya no baja el mover derecho.
    sidechainThreshold: 0.10,
    sidechainDepth: 0.00,
    snareSidechainDepth: 0.00,
    // Guillotina 4.1 y Aura Cap desactivadas (0 = off). Ambas existían para
    // domar el subgrave en el path 'default'; RaveX corre strict-split y su
    // pistón de 808 no necesita tutela.
    frontKickSidechainThreshold: 0.00,
    auraCapBase: 0.00,
    auraCapExponent: 0.00,
    // ═══════════════════════════════════════════════════════════════
    // ENRUTAMIENTO 4.1 — strict-split obligatorio
    // ═══════════════════════════════════════════════════════════════
    // Decisión con coste asumido: 'default' sumaría el Contra-Tiempo al back par
    // (max(backLeft, backRight) = hats + snare, que en RaveX ya son ambos
    // percusivos y no se asfixiarían entre sí). PERO el path 'default' activa
    // también el release smoothing 0.88 del front par (LiquidEngine41:79), que
    // es inercia pura — incompatible con el mandato de latencia cero.
    // Sacrifico el estroboscopio inverso en rigs 4.1 para preservar el martillo.
    // En 7.1 (las 7 zonas independientes + 3 láseres = las 10) RaveX se ve entero.
    layout41Strategy: 'strict-split',
    // ═══════════════════════════════════════════════════════════════
    // STROBE — LA METRALLETA
    // ═══════════════════════════════════════════════════════════════
    // strobeThreshold 0.80 → 0.46. El 0.80 de techno es inalcanzable: se compara
    // contra `bands.treble`, cuyo AGC está VETADO a targetRMS 0.10. El strobe de
    // techno está de facto muerto. 0.46 lo devuelve a la vida en crashes, risers
    // y drops sin tocar una sola constante del muro acústico.
    // strobeDuration 30 → 22ms ≈ 1 frame a 44Hz: "silencios que se rompen en un
    // micron". El motor permite re-armar en el frame siguiente
    // (LiquidEngineBase:2429), así que un pasaje de agudos sostenido produce
    // metralla de 1 frame ON / 1 frame OFF a ~22Hz. No es un flash: es un muro
    // de fotones dentados.
    // strobeNoiseDiscount 0.80 → 0.55 → umbral efectivo 0.253 en noiseMode: cada
    // riser de ruido blanco y cada crash disparan.
    strobeThreshold: 0.46,
    strobeDuration: 22,
    strobeNoiseDiscount: 0.55,
    // ═══════════════════════════════════════════════════════════════
    // MODES — CALIBRADOS SOBRE LOS RANGOS REALES DE LA MÉTRICA
    // ═══════════════════════════════════════════════════════════════
    // Dato duro: `harshness = softClip01(bands.highMid)` (GodEarFFT:3062), y el
    // AGC de highMid apunta a targetRMS 0.25. Un umbral de 0.60 (techno) exige
    // 2.4× el RMS objetivo → acidMode casi nunca entra. Y la flatness es
    // power-domain: 0.70 (techno) es ruido extremo → noiseMode casi nunca entra.
    // Ambos modos estaban dormidos. RaveX los despierta a sus rangos reales:
    //   acid 0.30    → cualquier pasaje agresivo/metálico
    //   noise 0.24   → todo el drop percusivo (0.16-0.36) → descuento de strobe
    harshnessAcidThreshold: 0.30,
    flatnessNoiseThreshold: 0.24,
    // APOCALYPSE MODE — el arma que el motor ya traía cargada.
    // `harshness > X && flatness > Y` inyecta `chaosEnergy = max(mid, treble)`
    // por la fuerza en backRight, moverLeft y moverRight, saltándose gates,
    // squelch y envolventes (LiquidEngineBase:2103-2109). Es el único camino del
    // motor capaz de encender tres zonas a la vez sin pasar por la física.
    // Con 0.55/0.55 (techno) jamás se dispara. Con 0.34/0.30 se dispara donde
    // debe: en el muro de distorsión del drop, en el crash, en el growl saturado.
    // La AND de dos ejes ortogonales (energía metálica × dispersión espectral)
    // garantiza que no se enganche en pasajes tonales limpios.
    apocalypseHarshness: 0.34,
    apocalypseFlatness: 0.30,
    // ═══════════════════════════════════════════════════════════════
    // MORPHOLOGY — EL AXIOMA 1 (ver cabecera)
    // ═══════════════════════════════════════════════════════════════
    // morph = clamp((avgMid - 0.01) / 0.05) → saturado a 1.0 con cualquier
    // material real. RaveX no interpola entre "industrial" y "melódico":
    // habita permanentemente el extremo de máxima ganancia y mínimo requiredJump.
    // (En silencio absoluto avgMid→0 y el morph cae solo, sin efecto: no hay luz.)
    morphFloor: 0.01,
    morphCeiling: 0.06,
    // ═══════════════════════════════════════════════════════════════
    // KICK DETECTION
    // ═══════════════════════════════════════════════════════════════
    // kickEdgeMinInterval 180 → 120ms. A 174 BPM (neurofunk/DnB) las parejas de
    // bombo sincopadas caen a 86-172ms; 180 las fusionaba en un solo edge.
    // El riesgo de armónicos del sub rodante (~120ms) que motivó el 180 en techno
    // está cubierto aquí por el hold de 6 frames + KICK_COOLDOWN_MS 150 del
    // motor, que son hardcoded y ya limitan el detector a ~6.6 kicks/s.
    kickEdgeMinInterval: 120,
    kickVetoFrames: 0, // cero veto: el mover derecho nunca se calla por el kick
    // ═══════════════════════════════════════════════════════════════
    // 🧱 MURO ACÚSTICO — HEREDADO LITERAL, NO TOCAR
    // Detector de caja: MACD sobre snare_energy + reset híbrido + floor
    // dinámico. Calibrado con Monte Carlo (12704 frames / 375 impactos
    // etiquetados) y telemetría de producción. RaveX no opina sobre CUÁNDO
    // hay una caja; solo sobre qué luz produce.
    // ═══════════════════════════════════════════════════════════════
    snarePath1BassDeltaFloor: 0.005,
    snareMomentumThreshold: 0.01,
    snareMomentumAlphaFast: 1.00,
    snareMomentumAlphaSlow: 0.05,
    snareMomentumResetThreshold: 0.15,
    snareMomentumResetRatio: 0.70,
    snareMomentumFloor: 0.040, // ← SAGRADO
    snareMomentumFloorMin: 0.002, // ← SAGRADO
    // Veto de Tonalidad (6 ejes, Monte Carlo WAVE 7775) declarado también en la
    // BASE — techno solo lo declaraba en overrides41, dejando el 7.1 con los
    // defaults blandos del motor. RaveX está saturado de sintes distorsionados,
    // así que necesita el veto duro en AMBOS layouts.
    snareVetoFlatnessFloor: 0.10,
    snareVetoFlatnessKnee: 0.10,
    snareVetoWnsFloor: 0.10,
    snareVetoWnsKnee: 0.25,
    snareVetoFluxFloor: 0.02,
    snareVetoFluxKnee: 0.15,
    // Sustain choke del detector: se conserva relajado (15 frames / 0.85). Es
    // anti-blackout, no anti-sustain visual: sin él, los muros de bajo continuo
    // dejaban hybridSnare a 0.000 durante segundos.
    snareChokeFrames: 15,
    snareChokeRate: 0.85,
    // snareImpulseDecay 0.30 (base techno) / 0.65 (4.1) → 0.18.
    // Ese 0.65 se eligió para fundir el redoble en "un golpe cohesionado con
    // fade natural". RaveX quiere lo opuesto: 0.18 → 1.00 / 0.18 / 0.03 / 0.
    // Cada 32avo de un fill de Skrillex mantiene su propio diente.
    snareImpulseDecay: 0.18,
    // ═══════════════════════════════════════════════════════════════
    // AMBIENT — EL RUGIDO (el pulmón, amputado)
    // ═══════════════════════════════════════════════════════════════
    // alpha = min(1, 1000/(ms·44)). Con attack 12ms → alpha 1.89 → CLAMPEA A 1.0:
    // el EMA deja de ser un EMA y se convierte en un seguidor instantáneo. El
    // "lavabo respirante" de 800ms/10s del motor queda oficialmente amputado.
    // release 45ms → alpha 0.505: cae a la mitad cada frame. Guillotina.
    // Curva: crush 2.3 + gain 1.9 + output 1.45 = expansor brutal, NO un dimmer
    // lineal. Medido en simulación: mezcla 0.43 (cuerpo del track) → 0.14 · kick
    // → 1.00. El wash bombea de un 14% de rugido residual a tope en un frame.
    // Traducción: el wash ignora el cuerpo del track y solo explota en el drop.
    // midWeight 0.25: en RaveX el rugido industrial no vive solo en el subgrave,
    // vive en los medios saturados (reeses, growls, guitarras de hardcore).
    ambientAttackMs: 12,
    ambientReleaseMs: 45,
    ambientMidWeight: 0.25,
    ambientGain: 1.90,
    ambientCrushExponent: 2.30,
    ambientOutputExponent: 1.45,
    // ═══════════════════════════════════════════════════════════════
    // FLOOR & AIR — mezcla espectral de los láseres
    // ═══════════════════════════════════════════════════════════════
    // floorSubWeight 0.5 → 0.12. El 0.5 de techno era el "Terremoto Híbrido":
    // un baño de luz de suelo sostenido por el subgrave. En RaveX eso es un
    // colchón. Con 0.12 el término continuo aporta ~0.03-0.06, muy por debajo
    // del suelo duro `signal > 0.15` del envelope → NUNCA enciende por sí solo.
    // El suelo solo existe cuando hay impacto (bassDelta). Negro entre bombos.
    floorSubWeight: 0.12,
    // airHighMidWeight 0.0 → 0.55: resucita el láser aéreo (ver envelopeAir).
    // El treble solo, con su AGC vetado a 0.10, no alcanzaba ningún umbral útil.
    airTrebleWeight: 1.00,
    airHighMidWeight: 0.55,
    // ═══════════════════════════════════════════════════════════════
    // OVERRIDES 4.1 — COMPACTACIÓN
    // ═══════════════════════════════════════════════════════════════
    // En strict-split el back par es SOLO backRight (LiquidEngine41:87), así que
    // el clásico "capar envHighMid para que el Coro no se coma al Látigo" no
    // aplica: aquí Back L simplemente no llega al par. Los overrides se centran
    // en compensar esa pérdida de información.
    overrides41: {
        // El látigo es la ÚNICA fuente del back par en 4.1 → se abre el gate para
        // que ningún hit del redoble se pierda (es todo lo que esa luminaria verá).
        envelopeSnare: {
            gateOn: 0.16,
            decayBase: 0.16, // aún más seco: sin Back L al lado, nada rellena el hueco
        },
        // Con backPar mono-fuente, el impulso puede ser todavía más afilado.
        snareImpulseDecay: 0.12,
        // El muro acústico se re-declara idéntico (paridad base ↔ 4.1).
        snareVetoFlatnessFloor: 0.10,
        snareVetoFlatnessKnee: 0.10,
        snareVetoWnsFloor: 0.10,
        snareVetoWnsKnee: 0.25,
        snareVetoFluxFloor: 0.02,
        snareVetoFluxKnee: 0.15,
        snareChokeFrames: 15,
        snareChokeRate: 0.85,
        layout41Strategy: 'strict-split',
    },
};
/**
 * Alias de compatibilidad. `profiles/index.ts` y el PROFILE_REGISTRY importan
 * `RAVE_PROFILE`; el nombre canónico del perfil físico es `RAVEX_PROFILE`.
 */
export const RAVE_PROFILE = RAVEX_PROFILE;
