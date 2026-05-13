/**
 * WAVE 1155: THE CHOREOGRAPHER REBORN
 * WAVE 2086.1: STEREO RESURRECTION — Phase offset (mirror/snake) lives HERE now
 * WAVE 2086.2: THE MAJESTIC REFORM — Professional period scaling (no more epilepsy)
 *
 * 🔥 WAVE 2213 FÉNIX: OPERACIÓN FÉNIX — RESTAURACIÓN DEL MOTOR DORADO
 *   Base code restored from commit 8123c08 (WAVE 2088.9-2088.12).
 *   The monotonic phase accumulator with smoothedBPM is the heart of this engine.
 *   WAVES 2206-2210 castrated the system trying to fix stutter caused by IPC/renderer
 *   throttling (fixed in WAVE 2211). This is the TRUE engine, restored and enhanced.
 *
 *   GEOMETRY FIXES applied on top of restoration:
 *   1. amplitudeScale split into panScale/tiltScale (WAVE 4645) for asymmetric hardware ranges
 *      techno=(0.40,0.70), latina=(0.35,0.65), rock=(0.45,0.65)
 *   2. diamond rewritten: was sin/cos (circle), now linear interpolation between
 *      cardinal vertices (0,1)→(1,0)→(0,-1)→(-1,0) — true rhombus
 *   3. ballyhoo fixtureOffset purified: was scaling amplitude per fixture (asymmetric)
 *   4. wave_y redesigned: was W-bounce (Lissajous 0.5:2), now latin pendulum U-arc
 *
 *   FPD FIXES applied on restoration:
 *   - Anti-Stuck (V16.4) REMOVED: false positives with valid DMX 0/255 targets
 *   - Anti-Jitter upgraded: dynamic threshold (3% of maxVelocity) instead of hardcoded 5
 *   - REV_LIMIT capped by hardware effectiveMaxVel (budget movers can't exceed their limits)
 *
 * FILOSOFIA: "HARMONIC MOTION"
 * El movimiento NO compite con efectos (Flash/Color).
 * El movimiento TRANSPORTA la luz. Es la danza, no el bailarin.
 *
 * LA DOCENA DORADA: 12 patrones matematicamente puros.
 * 3 por genero + 1 extra para Techno (4 total).
 * Sin fallbacks raros. Sin patrones fantasma. Sin legacy.
 *
 * ARQUITECTURA:
 *   TitanEngine -> VibeMovementManager.generateIntent(vibeId, audio, fixtureIndex, total)
 *   Cada fixture recibe su propia posición con phase offset (snake/mirror) aplicado.
 *   El Arbiter recibe posiciones L/R ya diferenciadas via mechanicsL/R.
 *
 * @layer ENGINE/MOVEMENT
 * @version WAVE 2213 FÉNIX — Operación Fénix: Motor Dorado Restaurado
 * @author PunkOpus
 */
// VIBE CONFIGURATIONS
const VIBE_CONFIG = {
    // TECHNO: Geometría dura, cortes precisos — CATEDRAL industrial
    // �️ WAVE 4730 TRÍADA: panScale 0.72→0.92, tiltScale 0.68→0.85, freq 0.22→0.10
    //   Barrido enorme (92% del pan = ~497°), frecuencia sostenible para hardware real.
    'techno-club': {
        panScale: 0.92,
        tiltScale: 0.85,
        baseFrequency: 0.22, // 🔥 NITRO: restaurado al valor original pre-WAVE-4730
        patterns: ['scan_x', 'square', 'diamond', 'botstep', 'darkspin'],
        homeOnSilence: false,
    },
    // LATINO: Curvas, fluidez, caderas — CATEDRAL sensual
    // �️ WAVE 4730 TRÍADA: panScale 0.95→0.95, tiltScale 0.80→0.88, freq 0.17→0.12
    //   Full stage pan, tilt abierto (88% = ~238°), frecuencia oceánica.
    'fiesta-latina': {
        panScale: 0.95,
        tiltScale: 0.88,
        baseFrequency: 0.17, // 🔥 NITRO: restaurado al valor original pre-WAVE-4730
        patterns: ['figure8', 'wave_y', 'ballyhoo', 'cadera_libre', 'espiral_conga'],
        homeOnSilence: false,
    },
    // POP-ROCK: Simetría, majestuosidad, estadio — CATEDRAL épica
    // 🏛️ WAVE 4730 TRÍADA: panScale 0.75→0.90, tiltScale 0.65→0.82, freq 0.20→0.08
    //   Arcos enormes de estadio (90% pan = ~486°), frecuencia lenta y solemne.
    'pop-rock': {
        panScale: 0.90,
        tiltScale: 0.82,
        baseFrequency: 0.20, // 🔥 NITRO: restaurado al valor original pre-WAVE-4730
        patterns: ['circle_big', 'cancan', 'dual_sweep'],
        homeOnSilence: true,
    },
    // CHILL: Oceánico, deriva continental — CATEDRAL submarina
    // �️ WAVE 4730 TRÍADA: panScale 0.70→0.85, tiltScale 0.70→0.80, freq 0.04→0.03
    //   La medusa ahora abarca más océano, pero más lentamente que nunca.
    'chill-lounge': {
        panScale: 0.85,
        tiltScale: 0.80,
        baseFrequency: 0.03,
        patterns: ['drift', 'sway', 'breath'],
        homeOnSilence: false,
    },
    // IDLE: Mínimo — respiración imperceptible
    // �️ WAVE 4730 TRÍADA: sin cambio significativo (ya era correcto)
    'idle': {
        panScale: 0.15,
        tiltScale: 0.20,
        baseFrequency: 0.04,
        patterns: ['breath'],
        homeOnSilence: true,
    },
};
// PATTERN PERIODS - Cuantos beats por ciclo completo
// ═══════════════════════════════════════════════════════════════════════════
// 🎭 WAVE 2086.2: THE MAJESTIC REFORM
// ANTES: Periodos de 1-4 beats → 1-2 Hz de oscilación → epilepsia mecánica
// AHORA: Periodos profesionales de 8-32 beats → movimientos de estadio
//
// Referencia shows profesionales:
//   Barrido lento (scan):   1 ciclo / 4-8 compases  = 16-32 beats
//   Circle/Figure8:         1 ciclo / 4 compases     = 16 beats
//   Snap a posición:        1 posición / 2 compases  = 8 beats
//   Ballyhoo/Drift épico:   1 ciclo / 8 compases     = 32 beats
// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 4730 TRÍADA: Períodos duplicados para acomodar la amplitud masiva.
// Con panScale ~0.90 y hardware real (~180°/s pan), el foco necesita ≥4s
// para recorrer el arco completo. Períodos largos = majestuosidad = cero estrés.
const PATTERN_PERIOD = {
    // TECHNO — geometría industrial, DELIBERADA y ENORME
    scan_x: 16, // 🏛️ 8→16. 4 compases: barrido de pared a pared con gravitas
    square: 32, // 🏛️ 16→32. 8 compases: 1 esquina cada 2 compases, monumental
    diamond: 16, // 🏛️ 8→16. 4 compases: rombo amplio con tiempo de llegada
    botstep: 16, // 🏛️ 8→16. 4 compases: posiciones con peso, no nervio
    darkspin: 24, // 🏛️ 12→24. 6 compases: órbita oscura lenta y densa
    // LATINO — fluido, sensual, cadera — arcos épicos
    figure8: 32, // 🏛️ 16→32. 8 compases: el infinito respira profundo
    wave_y: 16, // 🏛️ 8→16. 4 compases: ola con masa, no espuma
    ballyhoo: 32, // 🏛️ 16→32. 8 compases: espiral épica con cadencia
    cadera_libre: 32, // �️ 20→32. 8 compases: Lissajous 3:2 necesita espacio
    espiral_conga: 48, // �️ 24→48. 12 compases: hélice monumental
    // POP-ROCK — estadio, simetría, majestuosidad — arcos de catedral
    circle_big: 32, // 🏛️ 16→32. 8 compases: el rey recorre TODO el escenario
    cancan: 16, // 🏛️ 8→16. 4 compases: subida/bajada con gravitas
    dual_sweep: 32, // 🏛️ 16→32. 8 compases: barrido en U cinematográfico
    // CHILL — oceánico, periodos geológicos — WAVE 4750: escalados a catedral submarina
    drift: 512, // 128 compases: la deriva continental profunda.
    sway: 256, // 64 compases: la corriente del abismo.
    breath: 192, // 48 compases: la luz respira en cámara lenta.
    // THE FOUR NOBLES — sin cambio significativo
    slow_pan: 48, // 🏛️ 32→48. 12 compases: faro lento del fondo
    tilt_nod: 24, // 🏛️ 16→24. 6 compases: cabeceo meditativo
    figure_of_4: 24, // 🏛️ 16→24. 6 compases: figure8 contenido
    chase_position: 24, // 🏛️ 16→24. 6 compases: posiciones con solemnidad
};
// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4741: PATTERN_CONFIG — Reemplaza PATTERN_PERIOD
// ─────────────────────────────────────────────────────────────────────────
// Cada entrada desacopla cycleBeats (velocidad) de phraseDuration (escena).
// Regla musical: phraseDuration = N × cycleBeats (múltiplo entero siempre).
// safeHarborWindow = π/4 (±45°) estándar — tolerancia generosa sin ruido.
// hardDeadlineExtra = cycleBeats (1 ciclo extra de gracia anti-bloqueo).
// PATTERN_PERIOD permanece como fallback para código legacy hasta ASALTO 2.
// ═══════════════════════════════════════════════════════════════════════════
const PATTERN_CONFIG = {
    // ── TECHNO — geometría industrial, majestuosa (CALIBRACIÓN DE FÁBRICA) ───
    // cycleBeats duplicados → mitad de velocidad física con GM=1.0x
    // phraseDuration extendido → 4-8 compases para que el show respire
    scan_x: { cycleBeats: 8, phraseDuration: 32, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8, transitionBeats: 1 },
    square: { cycleBeats: 8, phraseDuration: 32, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8, transitionBeats: 1 },
    diamond: { cycleBeats: 8, phraseDuration: 32, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8, transitionBeats: 1 },
    botstep: { cycleBeats: 4, phraseDuration: 16, safeHarborPhase: Math.PI, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 4, transitionBeats: 0.5 },
    darkspin: { cycleBeats: 12, phraseDuration: 48, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 12, transitionBeats: 2 },
    // ── LATINO — fluido, sensual, cadencia relajada (CALIBRACIÓN DE FÁBRICA) ──
    // cycleBeats 12-20 → 1 revolución en 6-10 compases a 100 BPM = meditativo
    figure8: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2 },
    wave_y: { cycleBeats: 12, phraseDuration: 48, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 12, transitionBeats: 2 },
    ballyhoo: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3 },
    cadera_libre: { cycleBeats: 20, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 20, transitionBeats: 3 },
    espiral_conga: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3 },
    // ── POP-ROCK — estadio, simetría majestuosa (CALIBRACIÓN DE FÁBRICA) ──────
    // cycleBeats 8-16 → 1 revolución en 4-8 compases = monumentalidad
    circle_big: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2 },
    cancan: { cycleBeats: 8, phraseDuration: 32, safeHarborPhase: Math.PI, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8, transitionBeats: 1 },
    dual_sweep: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2 },
    // ── CHILL — WAVE 4750: ABISMO OCEÁNICO — velocidad de catedral submarina ──────
    // cycleBeats 256-512 → 1 ciclo en 128-256 compases a 120 BPM = 64-128 minutos.
    // Con anti-jitter 8-bit (dithering) el movimiento es terciopelo puro.
    drift: { cycleBeats: 512, phraseDuration: 1024, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 128, transitionBeats: 8 },
    sway: { cycleBeats: 256, phraseDuration: 512, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 64, transitionBeats: 8 },
    breath: { cycleBeats: 192, phraseDuration: 384, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 48, transitionBeats: 6 },
    // ── THE FOUR NOBLES — universales relajados (CALIBRACIÓN DE FÁBRICA) ──────
    slow_pan: { cycleBeats: 32, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3 },
    tilt_nod: { cycleBeats: 16, phraseDuration: 32, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2 },
    figure_of_4: { cycleBeats: 16, phraseDuration: 32, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2 },
    chase_position: { cycleBeats: 8, phraseDuration: 16, safeHarborPhase: 0, safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8, transitionBeats: 1 },
};
const STEREO_CONFIG = {
    'techno-club': { offset: Math.PI, type: 'mirror' }, // L/R espejos (puertas abren/cierran)
    'fiesta-latina': { offset: Math.PI / 4, type: 'snake' }, // 45° cadena de caderas
    'pop-rock': { offset: Math.PI / 3, type: 'snake' }, // 60° wall ondulante
    'chill-lounge': { offset: Math.PI / 2, type: 'snake' }, // 90° ola de mar lenta
    'idle': { offset: 0, type: 'sync' }, // Sin movimiento
};
const PATTERNS = {
    // TECHNO PATTERNS - Industrial / Sharp / Geometria Dura
    // SCAN_X: Barrido horizontal con ondulación vertical (Lissajous 1:2 suave)
    // 🔧 WAVE 2221 MENDOZA: Añadido Y sinusoidal. Sin offset hardcodeado.
    // 🌊 WAVE 4703 M3: Añadido detuning armónico sutil (3er parcial a 3%) para
    //   romper la periodicidad perfecta sin perder la identidad del barrido.
    scan_x: (phase, audio, index = 0, total = 1) => {
        const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 0.5;
        // Detuning orgánico: 3er armónico al 3% — apenas perceptible pero elimina la rigidez
        const detuneX = Math.sin((phase + fixtureOffset) * 3) * 0.03;
        return {
            x: Math.sin(phase + fixtureOffset) + detuneX,
            y: Math.sin((phase + fixtureOffset) * 2) * 0.45,
        };
    },
    // SQUARE: Movimiento cuadrado con interpolación lineal entre esquinas
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
    // 🌊 WAVE 4703 M3: Las esquinas tienen un micro-wobble senoidal (±2%) que
    //   hace que el fixture no llegue exactamente al vértice, sino que lo roce
    //   con un leve desvío — como un robot con personalidad.
    square: (phase, audio) => {
        const corners = [
            { x: 1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: -1 },
            { x: -1, y: 1 },
        ];
        const normalizedPhase = (phase / (Math.PI * 2)) * 4;
        const currentCorner = Math.floor(normalizedPhase) % 4;
        const nextCorner = (currentCorner + 1) % 4;
        const t = normalizedPhase - Math.floor(normalizedPhase);
        const from = corners[currentCorner];
        const to = corners[nextCorner];
        // Micro-wobble: desvío senoidal de baja frecuencia en cada arista
        const wobble = Math.sin(phase * 7.3) * 0.02;
        return {
            x: from.x + (to.x - from.x) * t + wobble,
            y: from.y + (to.y - from.y) * t + wobble * 0.5,
        };
    },
    // DIAMOND: Rombo con interpolación lineal entre vértices cardinales
    // � WAVE 2213 FÉNIX: el diamante anterior era un círculo (sin/cos).
    //   FIX: Mismo método que square — 4 vértices cardinales con interpolación
    //   lineal a velocidad constante. Vértices: Top(0,1)→Right(1,0)→Bot(0,-1)→Left(-1,0).
    //   Es square rotado 45°: las aristas son diagonales, no horizontales.
    diamond: (phase, audio) => {
        const vertices = [
            { x: 0, y: 1 }, // Top
            { x: 1, y: 0 }, // Right
            { x: 0, y: -1 }, // Bottom
            { x: -1, y: 0 }, // Left
        ];
        const normalizedPhase = (phase / (Math.PI * 2)) * 4;
        const currentVertex = Math.floor(normalizedPhase) % 4;
        const nextVertex = (currentVertex + 1) % 4;
        const t = normalizedPhase - Math.floor(normalizedPhase);
        const from = vertices[currentVertex];
        const to = vertices[nextVertex];
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
        };
    },
    // BOTSTEP: Posiciones cuantizadas robóticas con interpolación lineal
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
    // 8 posiciones golden-ratio con transición a velocidad constante.
    // El carácter "robótico" lo dará el PhysicsDriver al frenar en cada posición.
    botstep: (phase, audio) => {
        const phi = 1.618033988749;
        const totalSteps = 8;
        const normalizedPhase = (phase / (Math.PI * 2)) * totalSteps;
        const currentStep = Math.floor(normalizedPhase) % totalSteps;
        const nextStep = (currentStep + 1) % totalSteps;
        const t = normalizedPhase - Math.floor(normalizedPhase);
        const fromX = Math.sin(currentStep * phi * Math.PI) * 0.9;
        const fromY = Math.cos(currentStep * phi * phi * Math.PI) * 0.9; // 🔧 WAVE 2221: 0.6→0.9. Tilt agresivo para saltos verticales obvios
        const toX = Math.sin(nextStep * phi * Math.PI) * 0.9;
        const toY = Math.cos(nextStep * phi * phi * Math.PI) * 0.9; // 🔧 WAVE 2221: 0.6→0.9
        return {
            x: fromX + (toX - fromX) * t,
            y: fromY + (toY - fromY) * t,
        };
    },
    // DARKSPIN: órbita elíptica con pulso de radio y contra-rotación vertical.
    // Diseñado para conservar identidad "oscura" sin entrar en jitter ni picos.
    darkspin: (phase, audio, index = 0, total = 1) => {
        const fixtureOffset = (index / Math.max(total, 1)) * (Math.PI / 2);
        const radiusPulse = 0.70 + 0.20 * Math.sin(phase * 0.5);
        const x = Math.sin(phase + fixtureOffset) * radiusPulse;
        const y = Math.cos((phase + fixtureOffset) * 1.5) * 0.62;
        return { x, y };
    },
    // LATINO PATTERNS - Fluid / Hips / Curvas Sensuales
    // FIGURE8: El clasico infinito (Lissajous 1:2)
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Y-axis 0.6 → 0.75
    // X ya toca ±1. Y sube a 0.75 para que el 8 sea más pronunciado
    // sin perder la proporción Lissajous (ratio 1:0.75 sigue siendo elegante).
    figure8: (phase, audio) => {
        return {
            x: Math.sin(phase),
            y: Math.sin(phase * 2) * 0.75,
        };
    },
    // WAVE_Y: Péndulo elíptico — ola suave con elevación
    // WAVE 4740 FIX: La fórmula anterior tenía dos bugs críticos:
    //   1) y = -(Math.abs(cos(p*0.5)) * 0.6) → y SIEMPRE ≤ 0 (cabeza al suelo)
    //      → con ancla baja, tiltBase clipea a 0 → deadzone de 2+ compases.
    //   2) Math.abs(cos(p*0.5)) = 0 en p=π y 3π → y=0 exacto dos veces
    //      por ciclo: el foco se queda estático en el ancla durante ~2s.
    // FIX: Péndulo elíptico simétrico. X=balanceo, Y=elevación.
    //   Nunca toca (0,0) excepto instantáneamente. Rango completo en ambos ejes.
    wave_y: (phase, audio) => {
        return {
            x: Math.sin(phase) * 0.80,
            y: Math.cos(phase) * 0.70,
        };
    },
    // BALLYHOO: Espiral polar con radio garantizado (WAVE 4740 REDISEÑO)
    // DIAGNÓSTICO: La serie de Fourier anterior colapsaba a (0,0) cuando
    //   phase = π/2 (todos los armónicos cos/sin en cuadratura suman cero).
    //   El ×1.8 amplifier llevaba picos a ±1.35 → clipping duro adicional.
    // REDISEÑO: Polar con envolvente garantizada.
    //   r = 0.75 + 0.25×cos(2p) → r ∈ [0.50, 1.00] — piso del 50% garantizado.
    //   x = sin(1.5p)×r / y = cos(p)×r: ratio 3:2 Lissajous no cierra exactamente
    //   → patrón siempre activo, NUNCA colapsa al centro (x=0, y=0).
    ballyhoo: (phase, audio, index = 0, total = 1) => {
        const r = 0.75 + 0.25 * Math.cos(phase * 2); // r ∈ [0.50, 1.00]
        return {
            x: Math.sin(phase * 1.5) * r, // barrido complejo en X
            y: Math.cos(phase) * r, // elevación que respira con r
        };
    },
    // ─────────────────────────────────────────────────────────────────────
    // 🌊 WAVE 4703: NUEVOS PATRONES LATINOS — La Expansión del Alma
    // ─────────────────────────────────────────────────────────────────────
    // CADERA_LIBRE: Lissajous 3:2 con micro-deriva de fase orgánica
    // La relación 3:2 crea una figura-8 asimétrica que nunca cierra exactamente
    // (ligeramente irracional) — da la sensación de movimiento vivo, no mecánico.
    // La deriva senoidal lenta (period ≈ 37 beats) hace que el patrón "respire".
    // Resultado: una cadera que no repite exactamente, como una bailarina real.
    cadera_libre: (phase, audio, index = 0, total = 1) => {
        // Deriva lenta: 1 ciclo cada ~37 beats (primo relativo al período de 20)
        const drift = Math.sin(phase * 0.137) * 0.18;
        return {
            x: Math.sin(phase * 3 + drift) * 0.90,
            y: Math.sin(phase * 2) * 0.65 + Math.sin(phase * 0.5) * 0.12,
        };
    },
    // ESPIRAL_CONGA: Hélice tridimensional con modulación de elevación
    // Combina un barrido circular creciente con un arco de tilt que simula
    // la elevación/bajada del bombo en la conga. El índice de fixture añade
    // un offset de π/3 para que el ensemble forme una ola escalonada.
    // El multiplicador de radio (0.7 + 0.3*sin) hace que la espiral "respire".
    espiral_conga: (phase, audio, index = 0, total = 1) => {
        const fixturePhase = phase + (index / Math.max(total, 1)) * (Math.PI / 3);
        // WAVE 4740: Radio mínimo elevado 0.40 → 0.50 — anillo constante y dinámico.
        // El foco NUNCA colapsa al centro/suelo: r ∈ [0.50, 1.00] garantizado.
        const r = 0.75 + 0.25 * Math.sin(phase * 0.25);
        // Y combina arco de hélice (sin 1x) con acento de conga (sin 3x)
        return {
            x: Math.cos(fixturePhase) * r,
            y: Math.sin(fixturePhase) * 0.60 + Math.sin(fixturePhase * 3) * 0.18,
        };
    },
    // POP-ROCK PATTERNS - Stadium / Symmetry / Majestuosidad
    // CIRCLE_BIG: El rey de los estadios
    circle_big: (phase, audio, index = 0, total = 1) => {
        const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 2;
        return {
            x: Math.sin(phase + fixtureOffset),
            y: Math.cos(phase + fixtureOffset) * 0.75,
        };
    },
    // CANCAN: Piernas de bailarina (X fijo, Y arriba/abajo)
    cancan: (phase, audio, index = 0, total = 1) => {
        const fixtureOffset = (index / Math.max(total, 1)) * Math.PI;
        return {
            x: Math.sin(phase * 0.25) * 0.15,
            y: Math.sin(phase + fixtureOffset),
        };
    },
    // DUAL_SWEEP: Barrido en U majestuoso
    dual_sweep: (phase, audio) => {
        const x = Math.sin(phase);
        const y = (x * x) - 0.3;
        return { x, y };
    },
    // CHILL PATTERNS - Organic / Ambient / Respiracion
    // DRIFT: Movimiento browniano lento
    drift: (phase, audio) => {
        const phi = 1.618033988749;
        const sqrt2 = Math.SQRT2;
        const sqrt3 = Math.sqrt(3);
        const x = Math.sin(phase * phi) * 0.4 +
            Math.sin(phase * sqrt2) * 0.25 +
            Math.sin(phase * sqrt3) * 0.15;
        const y = Math.cos(phase * phi * 0.7) * 0.35 +
            Math.cos(phase * sqrt2 * 0.8) * 0.2 +
            Math.cos(phase * sqrt3 * 0.9) * 0.12;
        return { x, y };
    },
    // SWAY: Pendulo muy suave (solo X)
    sway: (phase, audio) => {
        return {
            x: Math.sin(phase) * 0.6,
            y: 0,
        };
    },
    // BREATH: La luz respira (solo Y sutil)
    breath: (phase, audio) => {
        return {
            x: 0,
            y: Math.sin(phase) * 0.35,
        };
    },
    // ═══════════════════════════════════════════════════
    // 🎭 WAVE 2086.5: THE FOUR NOBLES
    // ═══════════════════════════════════════════════════
    // SLOW_PAN: El faro del fondo — barrido horizontal puro, 32 beats
    slow_pan: (phase, _audio) => {
        // Sin(phase) puro: el moving head barre 180° en 8 compases
        // Sin componente Y — movimiento hipnótico lateral
        return {
            x: Math.sin(phase),
            y: 0,
        };
    },
    // TILT_NOD: Cabeceo meditativo — solo vertical, 16 beats
    tilt_nod: (phase, _audio) => {
        // Amplitud 0.6 para no ser agresivo — es un asentimiento, no un headbang
        return {
            x: 0,
            y: Math.sin(phase) * 0.6,
        };
    },
    // FIGURE_OF_4: Figure8 contenido — mismo espíritu, menos territorio
    figure_of_4: (phase, _audio) => {
        // x = sin(phase) * 0.5: la mitad del recorrido horizontal
        // y = sin(2*phase) * 0.3: doble frecuencia vertical, amplitud contenida
        // El resultado es un 8 compacto que ocupa el centro del escenario
        return {
            x: Math.sin(phase) * 0.5,
            y: Math.sin(2 * phase) * 0.3,
        };
    },
    // CHASE_POSITION: 4 posiciones cardinales con interpolación lineal
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
    chase_position: (phase, _audio) => {
        const positions = [
            { x: -0.7, y: 0 }, // Izquierda
            { x: 0, y: 0.7 }, // Arriba
            { x: 0.7, y: 0 }, // Derecha
            { x: 0, y: -0.7 }, // Abajo
        ];
        const totalSteps = 4;
        const normalizedPhase = (phase / (2 * Math.PI)) * totalSteps;
        const currentStep = Math.floor(normalizedPhase) % totalSteps;
        const nextStep = (currentStep + 1) % totalSteps;
        const t = normalizedPhase - Math.floor(normalizedPhase);
        const from = positions[currentStep];
        const to = positions[nextStep];
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
        };
    },
};
// VIBE MOVEMENT MANAGER - THE CHOREOGRAPHER
export class VibeMovementManager {
    constructor() {
        this.time = 0;
        this.lastUpdate = Date.now();
        this.frameCount = 0;
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 4741: SCHEDULER STATE — Desacoplado cycleBeats / phraseDuration
        // ─────────────────────────────────────────────────────────────────────
        // Reemplaza phaseAccumulator+barCount+lastBeatCount como fuente de verdad.
        // schedulerState.phase avanza a (2π/cycleBeats)*beatsThisFrame (velocidad pura).
        // schedulerState.sceneBeatsElapsed avanza el mismo ΔBeats independientemente.
        // Cuando sceneBeatsElapsed >= phraseDuration + hardDeadlineExtra el
        // scheduler rota al siguiente patrón (implementación completa en ASALTO 2;
        // aquí ya se acumula correctamente la información temporal).
        // ═══════════════════════════════════════════════════════════════════════
        this.schedulerState = {
            patternIndex: 0,
            phase: 0,
            sceneBeatsElapsed: 0,
        };
        // Último vibeId procesado — detecta cambios de vibe para resetear el scheduler
        this.lastVibeId = null;
        this.smoothedBPM = 120;
        this.BPM_SMOOTH_FACTOR = 0.05; // Very slow BPM tracking (20 frames to converge)
        // 🎚️ WAVE 2472: GRANDMASTER SPEED — multiplicador global de la IA
        // Escala el flujo de fase del motor generativo (0.1 = cámara lenta, 2.0 = doble velocidad)
        // NO afecta patrones manuales (Layer 2 del Arbiter) — solo Layer 0 (CHOREO)
        // 🏛️ WAVE 4730 TRÍADA: 0.6 → 0.8. Con períodos duplicados, 0.6 sería
        //   demasiado lento. A 0.8× con nuevos períodos:
        //   circle_big (32b) @ 120 BPM: 1 ciclo cada 20 s (majestuoso)
        //   scan_x (16b) @ 130 BPM:     1 ciclo cada 9 s  (catedral industrial)
        //   drift (256b) @ 100 BPM:     1 ciclo cada ~192 s (glacial)
        this.globalSpeedMultiplier = 0.8;
        // 🌪️ WAVE 4708 T3: CAOS UNIFICADO — amplitud y semilla globales del slider
        // ChaosOrderSlider, leídos por el KineticAdapter (L0) para calcular un
        // desfase determinista por nodo. Permite que el caos afecte a la IA igual
        // que ya afecta al patrón manual L2 (vía _flushClassic).
        this.globalChaosAmount = 0;
        this.globalChaosSeed = 0;
        // Manual override system (WAVE 999 compatible)
        this.manualSpeedOverride = null;
        this.manualAmplitudeOverride = null;
        this.manualPatternOverride = null;
        // WAVE 1155.1: SMOOTH TRANSITION SYSTEM
        // Cuando el patron cambia, hacemos LERP de 2 segundos
        this.lastPosition = { x: 0, y: 0 };
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 4741 ASALTO 2: KINETIC CROSSFADE — Interpolación beat-sincronizada
        // Reemplaza TRANSITION_DURATION_MS + transitionStartTime + isTransitioning.
        // fromPattern continúa avanzando su fase durante el crossfade (movimiento vivo).
        // totalBeats proviene de patternCfg.transitionBeats del patrón SALIENTE.
        // ═══════════════════════════════════════════════════════════════════════
        this.kineticTransition = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 };
        // ─── WAVE 4717.2: L2 PHASE OFFSETS (Fan Distribute) ──────────────────────
        // Record pre-allocado, mutado in-place en el hot-path — cero alloc @ 44Hz.
        // Key: nodeId (`${fixtureId}:kinetic`). Value: phase offset en radianes.
        // El KineticAdapter lee este record en process() antes de llamar a generateIntent().
        // El bridge (renderer-side) lo actualiza vía IPC cada vez que cambia fanValue.
        this._l2PhaseOverrides = {};
    }
    // 🎚️ WAVE 2472: GRANDMASTER SPEED API
    setGlobalSpeedMultiplier(mult) {
        this.globalSpeedMultiplier = Math.max(0.1, Math.min(2.0, mult));
        console.log(`[CHOREO] 🎚️ GrandMaster Speed: ×${this.globalSpeedMultiplier.toFixed(2)}`);
    }
    getGlobalSpeedMultiplier() {
        return this.globalSpeedMultiplier;
    }
    // 🌪️ WAVE 4708 T3: CAOS UNIFICADO API
    /**
     * Establece la amplitud (0-1) y semilla (uint16) del caos global.
     * Llamado desde AetherIPCHandlers cuando el operador mueve ChaosOrderSlider.
     * El KineticAdapter lo aplica por nodo como desfase de fase determinista.
     */
    setGlobalChaos(amount, seed) {
        this.globalChaosAmount = amount < 0 ? 0 : amount > 1 ? 1 : amount;
        this.globalChaosSeed = (seed | 0) & 0xFFFF;
    }
    // MANUAL OVERRIDE API
    setManualSpeed(speed) {
        this.manualSpeedOverride = speed;
        console.log(speed !== null
            ? `[CHOREO] Manual SPEED: ${speed}%`
            : `[CHOREO] Speed -> AI control`);
    }
    setManualAmplitude(amplitude) {
        this.manualAmplitudeOverride = amplitude;
        console.log(amplitude !== null
            ? `[CHOREO] Manual AMPLITUDE: ${amplitude}%`
            : `[CHOREO] Amplitude -> AI control`);
    }
    setManualPattern(pattern) {
        if (pattern === null || pattern === 'static') {
            // Liberar a Selene
            this.manualPatternOverride = null;
            console.log(`[CHOREO] Pattern → AI control (Selene)`);
            return;
        }
        // Traducir UI pattern → GoldenPattern
        const goldenPattern = VibeMovementManager.UI_TO_GOLDEN_PATTERN[pattern];
        if (goldenPattern) {
            this.manualPatternOverride = goldenPattern;
            console.log(`[CHOREO] Manual PATTERN: ${pattern} → ${goldenPattern}`);
        }
        else {
            // Pattern no reconocido - intentar usar directo (por si ya es GoldenPattern)
            if (PATTERNS[pattern]) {
                this.manualPatternOverride = pattern;
                console.log(`[CHOREO] Manual PATTERN: ${pattern} (direct)`);
            }
            else {
                console.warn(`[CHOREO] Unknown pattern: ${pattern}, falling back to circle_big`);
                this.manualPatternOverride = 'circle_big';
            }
        }
    }
    getManualOverrides() {
        return {
            speed: this.manualSpeedOverride,
            amplitude: this.manualAmplitudeOverride,
            pattern: this.manualPatternOverride,
        };
    }
    /**
     * Actualiza los offsets de fase L2 para el fan distribute.
     * Limpia keys obsoletas e inserta las nuevas — sin crear el objeto Record.
     * @param offsets map de nodeId → phase offset (rad)
     */
    setKineticFanOffsets(offsets) {
        // Limpiar keys que ya no están en el nuevo batch
        for (const key in this._l2PhaseOverrides) {
            if (!(key in offsets)) {
                delete this._l2PhaseOverrides[key];
            }
        }
        // Escribir valores nuevos in-place
        for (const key in offsets) {
            this._l2PhaseOverrides[key] = offsets[key];
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    clearManualOverrides() {
        this.manualSpeedOverride = null;
        this.manualAmplitudeOverride = null;
        this.manualPatternOverride = null;
        // Limpiar también los L2 phase offsets
        for (const key in this._l2PhaseOverrides) {
            delete this._l2PhaseOverrides[key];
        }
        console.log(`[CHOREO] All overrides cleared`);
    }
    // GENERATE INTENT - El corazon del coreografo
    generateIntent(vibeId, audio, fixtureIndex = 0, totalFixtures = 1, 
    /** 🏎️ WAVE 2074.3: Per-fixture max speed (DMX/s). Defaults to 250 if not provided. */
    fixtureMaxSpeed = 250, 
    /** 🎭 WAVE 4645: Phase offset (rad) for left/right asymmetry */
    phaseOffset = 0) {
        // ═══════════════════════════════════════════════════════════════════════
        // 🎭 WAVE 2086.1: FRAME-ONCE GUARD
        // TitanEngine now calls generateIntent() TWICE per frame (L + R stereo).
        // Internal state (time, frameCount, barCount, pattern selection) must
        // only update ONCE per frame. We use lastFrameTimestamp to detect
        // same-frame calls: if Date.now() === lastUpdate, skip state updates.
        // ═══════════════════════════════════════════════════════════════════════
        const now = Date.now();
        // 🌊 WAVE 4703 M1 JITTER FIX: threshold 2ms→1ms.
        // Date.now() has 1ms resolution. At 60fps, dt≈16ms so two consecutive real
        // frames are ≥16ms apart. <1ms reliably means same-frame second call (R fixture).
        // <2ms was causing some real frames (dt=1ms on high-res clocks) to be skipped.
        const isSameFrame = (now - this.lastUpdate) < 1; // <1ms = same render frame
        // 🔥 WAVE 2088.10: Capture dt BEFORE updating lastUpdate
        let frameDeltaTime = 0.016; // default 60fps
        if (!isSameFrame) {
            // First call this frame: update all internal state
            frameDeltaTime = Math.min((now - this.lastUpdate) / 1000, 0.1); // Cap at 100ms
            this.lastUpdate = now;
            this.time += frameDeltaTime;
            this.frameCount++;
        }
        // Second call (R fixture): reuse same time/frameCount from first call
        // Obtener configuracion del vibe
        const config = VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle'];
        const beatCount = audio.beatCount ?? 0;
        const beatPhase = audio.beatPhase ?? 0;
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 4741: TICK DESACOPLADO — Paso A + B (Blueprint §5)
        //
        // Paso A: BPM suavizado + beatsThisFrame
        // Paso B: Avance de fase a ritmo de cycleBeats (velocidad pura)
        //         + avance de sceneBeatsElapsed independiente (duración escena)
        // Paso C (Paso D del Blueprint): Safe-harbor check y scheduler
        //         → implementación completa en ASALTO 2 (se conecta aquí)
        //
        // El viejo PATTERN_PERIOD se conserva como fallback para el Gearbox
        // hasta que ASALTO 2 lo reemplace con patternConfig.cycleBeats.
        // ═══════════════════════════════════════════════════════════════════
        const safeBPM = this.getSafeBPM(audio.bpm);
        // Reset scheduler si cambió el vibe (nuevo set de patrones)
        if (!isSameFrame && this.lastVibeId !== null && this.lastVibeId !== vibeId) {
            this.schedulerState.patternIndex = 0;
            this.schedulerState.phase = 0;
            this.schedulerState.sceneBeatsElapsed = 0;
            this.kineticTransition = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 };
            console.log(`[CHOREO4741] Vibe changed ${this.lastVibeId} → ${vibeId}: scheduler + crossfade reset`);
        }
        if (!isSameFrame) {
            this.lastVibeId = vibeId;
        }
        // Smooth BPM con filtro paso-bajo pesado (solo en la primera llamada del frame)
        if (!isSameFrame) {
            this.smoothedBPM += (safeBPM - this.smoothedBPM) * this.BPM_SMOOTH_FACTOR;
        }
        // ── Lookup patrón ACTUAL (previo a la posible rotación de este frame) ────────────
        // Se consulta ANTES del bloque de fase para que el safe-harbor sepa desde
        // qué patrón se está saliendo y pueda disparar el crossfade cinético.
        const currentPatternName = this.selectPattern(config, audio);
        const currentPatternCfg = PATTERN_CONFIG[currentPatternName];
        const currentCycleBeats = currentPatternCfg
            ? currentPatternCfg.cycleBeats
            : (PATTERN_PERIOD[currentPatternName] || 8);
        if (!isSameFrame) {
            const beatsPerSecond = this.smoothedBPM / 60;
            const beatsThisFrame = beatsPerSecond * frameDeltaTime;
            const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0;
            const manualSpeedFactor = this.manualSpeedOverride !== null
                ? Math.pow(2, (this.manualSpeedOverride - 50) / 50)
                : 1.0;
            const effectiveBeats = beatsThisFrame * this.globalSpeedMultiplier * manualSpeedFactor * chillSedationFactor;
            // ── PASO A: avanzar fase a ritmo de cycleBeats (velocidad pura) ──────────────
            const phasePerBeat = (2 * Math.PI) / currentCycleBeats;
            this.schedulerState.phase += effectiveBeats * phasePerBeat;
            // ── PASO B: avanzar contador de escena (independiente de cycleBeats) ─────────
            // sceneBeatsElapsed mide el tiempo en escena del patrón actual.
            // Es TOTALMENTE independiente de la velocidad del ciclo.
            this.schedulerState.sceneBeatsElapsed += effectiveBeats;
            // ── PASO C: SAFE-HARBOR — Rotación de patrón beat-sincronizada ───────────────
            // Espera a que sceneBeatsElapsed supere phraseDuration Y la fase esté
            // próxima a safeHarborPhase (fixture cerca del centro) para rotar.
            // Si se excede hardDeadline, fuerza la rotación igualmente.
            if (currentPatternCfg && this.manualPatternOverride === null && config.patterns.length > 1) {
                if (this.schedulerState.sceneBeatsElapsed >= currentPatternCfg.phraseDuration) {
                    const TWO_PI = 2 * Math.PI;
                    const normalizedPhase = ((this.schedulerState.phase % TWO_PI) + TWO_PI) % TWO_PI;
                    const distFromHarbor = Math.abs(normalizedPhase - currentPatternCfg.safeHarborPhase);
                    const inHarbor = distFromHarbor < currentPatternCfg.safeHarborWindow;
                    const hardDeadline = this.schedulerState.sceneBeatsElapsed >=
                        currentPatternCfg.phraseDuration + currentPatternCfg.hardDeadlineExtra;
                    if (inHarbor || hardDeadline) {
                        const oldIndex = this.schedulerState.patternIndex;
                        this.schedulerState.patternIndex = (oldIndex + 1) % config.patterns.length;
                        this.schedulerState.sceneBeatsElapsed = 0;
                        // ── Disparar crossfade cinético ────────────────────────────────────────
                        this.kineticTransition = {
                            active: true,
                            fromPattern: currentPatternName,
                            fromPhaseSnapshot: this.schedulerState.phase,
                            progressBeats: 0,
                            totalBeats: currentPatternCfg.transitionBeats,
                        };
                        const newPattern = config.patterns[this.schedulerState.patternIndex];
                        console.log(`[SCHED] 🌊 ${currentPatternName} → ${newPattern}` +
                            ` | harbor:${inHarbor} deadline:${hardDeadline}` +
                            ` | phase:${Math.round(normalizedPhase * 180 / Math.PI)}°`);
                    }
                }
            }
            // ── Avanzar crossfade en curso ────────────────────────────────────────────────
            if (this.kineticTransition.active) {
                this.kineticTransition.progressBeats += effectiveBeats;
                if (this.kineticTransition.progressBeats >= this.kineticTransition.totalBeats) {
                    this.kineticTransition.active = false;
                    const finishedPattern = config.patterns[this.schedulerState.patternIndex];
                    console.log(`[SCHED] ✅ Crossfade complete → ${finishedPattern}`);
                }
            }
        }
        // ── patternName post-rotación: refleja el índice actualizado en este frame ───────
        const patternName = this.selectPattern(config, audio);
        const patternCfg = PATTERN_CONFIG[patternName];
        const patternPeriod = patternCfg ? patternCfg.cycleBeats : (PATTERN_PERIOD[patternName] || 8);
        // 🥶 WAVE 1165: GHOST PROTOCOL — FREEZE instead of HOME on silence
        // When energy is very low, MAINTAIN last position instead of going to center
        if (audio.energy < 0.03 && config.homeOnSilence) {
            return this.createFreezeIntent(patternName);
        }
        const phase = this.schedulerState.phase + phaseOffset;
        // PATTERN EXECUTION
        const patternFn = PATTERNS[patternName];
        if (!patternFn) {
            console.warn(`[CHOREO] Unknown pattern: ${patternName}, using breath`);
            return this.createHomeIntent('breath');
        }
        const rawPosition = patternFn(phase, audio, fixtureIndex, totalFixtures);
        // THE GEARBOX - Dynamic Amplitude Scaling
        // 🔥 WAVE 2088.10: Use smoothedBPM for stable gearbox calculations
        const effectivePanAmplitude = this.calculateEffectiveAmplitude(config.panScale, this.smoothedBPM, patternPeriod, audio.energy, fixtureMaxSpeed);
        const effectiveTiltAmplitude = this.calculateEffectiveAmplitude(config.tiltScale, this.smoothedBPM, patternPeriod, audio.energy, fixtureMaxSpeed);
        // ═══════════════════════════════════════════════════════════════════
        // 🎭 WAVE 2086.3 + 2088.8: PHRASE ENVELOPE — The Breathing Amplifier
        //
        // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
        // ANTES: Rango 0.60-1.00. En los primeros compases, la amplitud era 60%
        // → los patrones perdían su forma (un square al 60% = un blob centrado).
        // AHORA: Rango 0.85-1.00. La frase RESPIRA pero los patrones mantienen
        // su identidad geométrica en TODO momento.
        //
        //   Beat 0-7   (compás 1-2):  0.85 → 0.90  — arranque contenido
        //   Beat 8-19  (compás 3-5):  0.90 → 1.00  — expansión progresiva
        //   Beat 20-23 (compás 6):    1.00          — CLÍMAX: apertura máxima
        //   Beat 24-31 (compás 7-8):  1.00 → 0.85  — relajación elegante
        // ═══════════════════════════════════════════════════════════════════
        const phraseBeats = 32;
        const phraseProgress = (beatCount % phraseBeats) / phraseBeats; // 0.0 → 1.0
        // Coseno desplazado: arranca en 0.85, pico en 1.0 a ~62% de la frase
        const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15));
        // Clamp final: el envelope escala entre 0.85 y 1.0
        const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope));
        const finalPanAmplitude = effectivePanAmplitude * clampedEnvelope;
        const finalTiltAmplitude = effectiveTiltAmplitude * clampedEnvelope;
        // Aplicar amplitud (con phrase envelope de WAVE 2086.3)
        // WAVE 2224: DANCEFLOOR GRAVITY — techno-club apunta a la pista (adelante/abajo)
        // 🔧 WAVE 2233: -0.35 → -0.20. Con tiltScale 0.70, -0.20 points toward dancefloor.
        const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0;
        const position = {
            x: Math.max(-1, Math.min(1, rawPosition.x * finalPanAmplitude)),
            y: Math.max(-1, Math.min(1, (rawPosition.y * finalTiltAmplitude) + tiltOffset)),
        };
        // WAVE 4741 ASALTO 2: KINETIC CROSSFADE
        // Guard defensivo: si el fromPattern ya no existe en este vibe (edge case de cambio
        // de vibe rápido), matar el crossfade antes de calcular nada.
        if (this.kineticTransition.active) {
            const fromInVibe = config.patterns.includes(this.kineticTransition.fromPattern);
            if (!fromInVibe) {
                console.warn(`[SCHED] ⚠️ Crossfade killed — fromPattern '${this.kineticTransition.fromPattern}'` +
                    ` not in ${vibeId} playlist. Race condition on vibe change?`);
                this.kineticTransition.active = false;
            }
        }
        // Si hay un crossfade activo, calcula la posición del patrón SALIENTE en tiempo
        // real (continúa avanzando su fase) y hace un LERP hasta la del ENTRANTE.
        let finalPosition = position;
        let crossfadeSmoothT = 0; // 0 = 100% saliente, 1 = 100% entrante
        if (this.kineticTransition.active) {
            const fromCfg = PATTERN_CONFIG[this.kineticTransition.fromPattern]
                ?? PATTERN_CONFIG['breath'];
            const fromPhasePerBeat = (2 * Math.PI) / fromCfg.cycleBeats;
            // Fase del patrón saliente: snapshot + beats acumulados × velocidad de su ciclo
            const fromPhase = this.kineticTransition.fromPhaseSnapshot +
                this.kineticTransition.progressBeats * fromPhasePerBeat + phaseOffset;
            const fromPatternFn = PATTERNS[this.kineticTransition.fromPattern];
            if (fromPatternFn) {
                const fromRaw = fromPatternFn(fromPhase, audio, fixtureIndex, totalFixtures);
                const fromPosition = {
                    x: Math.max(-1, Math.min(1, fromRaw.x * finalPanAmplitude)),
                    y: Math.max(-1, Math.min(1, (fromRaw.y * finalTiltAmplitude) + tiltOffset)),
                };
                // Smoothstep ease-in-out: t² × (3 − 2t)
                const t = Math.min(1.0, this.kineticTransition.progressBeats / this.kineticTransition.totalBeats);
                crossfadeSmoothT = t * t * (3 - 2 * t);
                finalPosition = {
                    x: fromPosition.x + (position.x - fromPosition.x) * crossfadeSmoothT,
                    y: fromPosition.y + (position.y - fromPosition.y) * crossfadeSmoothT,
                };
            }
        }
        // 🎭 WAVE 2086.1: Save lastPosition ONE per frame (para GHOST PROTOCOL)
        if (!isSameFrame) {
            this.lastPosition = finalPosition;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🎭 WAVE 2086.1: STEREO PHASE OFFSET — The Resurrection
        //
        // ANTES: applyPhaseOffset() vivía en HAL pero SOLO era llamada por
        // renderFromIntent() (flujo muerto). renderFromTarget() (flujo activo)
        // la ignoraba. Resultado: todos los movers eran clones (Borg mode).
        //
        // AHORA: La lógica de mirror/snake vive AQUÍ, donde se genera el
        // movimiento. Cada fixture recibe su posición diferenciada ANTES de
        // que llegue al Arbiter. Así el Arbiter ya ve L/R distinto.
        //
        // MIRROR (techno): Fixture impar invierte X → puertas del infierno
        // SNAKE (latino/pop/chill): Cada fixture añade offset a la fase base
        //   → ola mexicana, cadena de caderas
        // SYNC (idle): Sin cambio
        // ═══════════════════════════════════════════════════════════════════════
        const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle'];
        let stereoPosition = { ...finalPosition };
        if (stereoConfig.type === 'mirror' && totalFixtures > 1) {
            // 🪞 MIRROR: Fixtures impares (derecha) invierten PAN (eje X)
            // Fixture 0 (L): x se mantiene → puerta izquierda
            // Fixture 1 (R): x se invierte → puerta derecha
            // Efecto: las puertas se abren y cierran en espejo horizontal
            // TILT (eje Y) es compartido: ambos apuntan al mismo nivel vertical
            const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1;
            stereoPosition.x = finalPosition.x * mirrorSign;
            // Y no se toca: stereoPosition.y = finalPosition.y (ya copiado)
        }
        else if (stereoConfig.type === 'snake' && totalFixtures > 1) {
            // 🐍 SNAKE: Cada fixture aplica un desfase angular a la posición
            // La posición base (finalPosition) es un punto en una trayectoria
            // circular/elíptica. Rotamos ese punto alrededor del centro (0,0)
            // por el offset del fixture → efecto ola/cadena.
            const phaseOffset = fixtureIndex * stereoConfig.offset;
            // Magnitud del movimiento (distancia al centro en espacio -1..+1)
            const mag = Math.sqrt(finalPosition.x * finalPosition.x + finalPosition.y * finalPosition.y);
            if (mag > 0.01) {
                // Ángulo actual del vector posición
                const currentAngle = Math.atan2(finalPosition.y, finalPosition.x);
                // Rotar por el phase offset del fixture
                const newAngle = currentAngle + phaseOffset;
                stereoPosition.x = Math.cos(newAngle) * mag;
                stereoPosition.y = Math.sin(newAngle) * mag;
            }
            // Si mag ≈ 0 (posición en centro), no hay nada que rotar
        }
        // 'sync' → stereoPosition = finalPosition (sin cambio)
        // Clampar al rango válido
        stereoPosition.x = Math.max(-1, Math.min(1, stereoPosition.x));
        stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y));
        // Frecuencia efectiva (con override manual)
        const effectiveFrequency = this.manualSpeedOverride !== null
            ? 0.01 + (this.manualSpeedOverride / 100) * 0.49
            : config.baseFrequency;
        // Debug log cada ~1 segundo — solo en la primera llamada real del frame.
        // Aether puede pedir múltiples intents en el mismo frame (uno por nodo),
        // así que `fixtureIndex === 0` no basta para evitar spam.
        if (!isSameFrame && this.frameCount % 60 === 0 && fixtureIndex === 0) {
            const panDeg = Math.round(stereoPosition.x * 270);
            const tiltDeg = Math.round(stereoPosition.y * 135);
            const manualTag = this.hasAnyOverride() ? ' [MANUAL]' : '';
            const xfadeTag = this.kineticTransition.active
                ? ` [XF→${config.patterns[this.schedulerState.patternIndex] ?? '?'}]`
                : '';
            const stereoTag = stereoConfig.type !== 'sync' ? ` [${stereoConfig.type.toUpperCase()} ×${totalFixtures}]` : '';
            const phaseDeg = Math.round((this.schedulerState.phase % (2 * Math.PI)) * 180 / Math.PI);
            const sceneB = Math.round(this.schedulerState.sceneBeatsElapsed);
            console.log(`[CHOREO] ${vibeId} | #${this.schedulerState.patternIndex}:${patternName}${manualTag}${xfadeTag}${stereoTag}` +
                ` | scene:${sceneB}b | Pan:${panDeg} Tilt:${tiltDeg} | sBPM:${Math.round(this.smoothedBPM)} phase:${phaseDeg}°`);
        }
        // Determinar phaseType
        // 🔧 WAVE 2086.1: phaseType is now informational only (stereo already applied)
        // We keep it for downstream compatibility but HAL no longer uses it for phase offset
        const phaseType = (patternName === 'scan_x' || patternName === 'cancan') ? 'linear' : 'polar';
        // UI SYNC: reportar el patrón que DOMINA visualmente.
        // Durante crossfade, el saliente domina hasta que smoothT >= 0.5.
        // Fuera de crossfade, siempre es patternName.
        const reportedPattern = this.kineticTransition.active && crossfadeSmoothT < 0.5
            ? this.kineticTransition.fromPattern
            : patternName;
        return {
            x: stereoPosition.x,
            y: stereoPosition.y,
            pattern: reportedPattern,
            speed: effectiveFrequency,
            amplitude: effectivePanAmplitude,
            phaseType,
            _frequency: effectiveFrequency,
            _phrase: this.schedulerState.patternIndex,
        };
    }
    // PATTERN SELECTION
    selectPattern(config, audio) {
        // Manual override tiene prioridad absoluta
        if (this.manualPatternOverride !== null) {
            if (PATTERNS[this.manualPatternOverride]) {
                return this.manualPatternOverride;
            }
            console.warn(`[CHOREO] Invalid manual pattern: ${this.manualPatternOverride}`);
        }
        const patterns = config.patterns;
        if (patterns.length === 0)
            return 'breath';
        // WAVE 4741 ASALTO 2: índice directo desde el scheduler (rotado por safe-harbor)
        const safeIndex = this.schedulerState.patternIndex % patterns.length;
        return patterns[safeIndex];
    }
    // GEARBOX - Hardware speed limiting
    calculateEffectiveAmplitude(baseAmplitude, bpm, patternPeriod, energy, 
    /** 🏎️ WAVE 2074.3: Per-fixture max speed (DMX/s). No more global constant. */
    fixtureMaxSpeed = 250) {
        // Manual override
        if (this.manualAmplitudeOverride !== null) {
            return 0.05 + (this.manualAmplitudeOverride / 100) * 0.95;
        }
        // 🏎️ WAVE 2074.3: Per-fixture hardware limit
        // ANTES: HARDWARE_MAX_SPEED = 250 (global para todos los fixtures)
        // AHORA: Cada fixture pasa su propio maxSpeed desde su physicsProfile.
        // Si un fixture tiene maxVelocity: 100, el Gearbox reduce la amplitud
        // para que el patrón no pida más de lo que sus motores pueden dar.
        const HARDWARE_MAX_SPEED = fixtureMaxSpeed;
        const secondsPerBeat = 60 / bpm;
        // Presupuesto de movimiento en un ciclo del patron
        const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod;
        // Energia boost (+20% con energy = 1.0)
        const energyBoost = 1.0 + energy * 0.2;
        const requestedAmplitude = baseAmplitude * energyBoost;
        // Distancia solicitada (255 DMX = full range)
        const requestedTravel = 255 * requestedAmplitude;
        // Factor de reduccion si excede el presupuesto
        const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel);
        // 🔧 WAVE 2192: GEARBOX LIBERATION — Floor 0.85 → 0.10
        // WAVE 2088.7 puso floor en 0.85 para "intentar recorrido completo",
        // pero eso ANULA cualquier amplitudeScale < 0.85 del preset.
        // Techno con amplitudeScale=0.40 se forzaba a 0.85 = movimiento gigante.
        // Floor 0.10 permite que los presets controlen la amplitud real.
        const GEARBOX_MIN_AMPLITUDE = 0.10;
        const gearboxResult = requestedAmplitude * gearboxFactor;
        return Math.min(1.0, Math.max(GEARBOX_MIN_AMPLITUDE, gearboxResult));
    }
    // UTILITIES
    getSafeBPM(bpm) {
        if (!bpm || !isFinite(bpm) || bpm <= 0)
            return 120;
        return Math.max(60, Math.min(200, bpm));
    }
    hasAnyOverride() {
        return this.manualSpeedOverride !== null ||
            this.manualAmplitudeOverride !== null ||
            this.manualPatternOverride !== null;
    }
    createHomeIntent(pattern) {
        return {
            x: 0,
            y: 0,
            pattern: 'home',
            speed: 0,
            amplitude: 0,
            _frequency: 0,
            _phrase: this.schedulerState.patternIndex,
        };
    }
    /**
     * 🥶 WAVE 1165: GHOST PROTOCOL - Create FREEZE intent
     * Returns LAST KNOWN POSITION instead of going home
     * This prevents the "whip to center" movement when audio stops
     */
    createFreezeIntent(pattern) {
        return {
            x: this.lastPosition.x, // Stay where you are
            y: this.lastPosition.y, // Stay where you are
            pattern: 'freeze', // Special pattern name for debugging
            speed: 0,
            amplitude: 0,
            _frequency: 0,
            _phrase: this.schedulerState.patternIndex,
        };
    }
    // PUBLIC GETTERS
    getVibeConfig(vibeId) {
        return VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle'];
    }
    getAvailablePatterns() {
        return Object.keys(PATTERNS);
    }
    resetTime() {
        this.time = 0;
        this.lastUpdate = Date.now();
        // WAVE 4741: reset completo — scheduler + crossfade
        this.schedulerState = { patternIndex: 0, phase: 0, sceneBeatsElapsed: 0 };
        this.lastVibeId = null;
        this.kineticTransition = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 };
        this.lastPosition = { x: 0, y: 0 };
        this.smoothedBPM = 120;
    }
    getTime() {
        return this.time;
    }
    getBarCount() {
        // WAVE 4741: aprox desde sceneBeatsElapsed (mantiene compatibilidad de tests)
        return Math.floor(this.schedulerState.sceneBeatsElapsed / 4);
    }
}
// UI Pattern → GoldenPattern Translation Map
// Babel Fish: traduce nombres legibles de UI a los nombres internos del backend
VibeMovementManager.UI_TO_GOLDEN_PATTERN = {
    // Mappings directos
    'circle': 'circle_big',
    'eight': 'figure8',
    'sweep': 'scan_x',
    'spiral': 'ballyhoo',
    'darkspin': 'darkspin',
    'tornado': 'darkspin',
    'wave': 'wave_y',
    'bounce': 'botstep',
    'random': 'drift',
    // Aliases adicionales por si acaso
    'figure8': 'figure8',
    'circle_big': 'circle_big',
    'scan_x': 'scan_x',
    // Hold/Static → devolvemos null para que Selene tome control
};
// SINGLETON EXPORT
export const vibeMovementManager = new VibeMovementManager();
export default vibeMovementManager;
