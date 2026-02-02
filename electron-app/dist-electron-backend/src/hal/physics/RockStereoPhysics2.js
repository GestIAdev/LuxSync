/**
 * ============================================================================
 * 🎸 ROCK STEREO PHYSICS 2.0 - UNIFIED ARCHITECTURE
 * ============================================================================
 *
 * WAVE 1018 "PROG ROCK DETECTOR" - PINK FLOYD EDITION
 *
 * FILOSOFÍA: El rock es rock. NO cambiamos de modo cada 10 segundos.
 * Una canción de Metallica ES Metallica. Una de Pink Floyd ES Floyd.
 *
 * NUEVA ARQUITECTURA:
 * - Detector de subgénero CON MEMORIA HISTÓRICA (30 segundos)
 * - Hysteresis: 70% threshold para cambiar de subgénero
 * - Una vez detectado, SE MANTIENE hasta que la música REALMENTE cambia
 *
 * 🎭 SUBGÉNEROS DETECTABLES:
 * ═══════════════════════════
 *
 * 1. PROG ROCK (Pink Floyd, Yes, Genesis, Rush)
 *    - Centroid: 500-1500Hz (teclados dominantes)
 *    - Flatness: <0.05 (atmosférico/tonal)
 *    - Clarity: >0.95 (mezcla limpia)
 *    - Treble: <0.15 (guitarra enterrada)
 *    → MoverRight DUAL-BAND: Presence OR HighMid (detecta solos enterrados)
 *
 * 2. HARD ROCK (AC/DC, Metallica, System of a Down, Red Hot)
 *    - Centroid: 1000-3000Hz (guitarras al frente)
 *    - Harshness: >0.20 (distorsión)
 *    - Clarity: 0.7-0.95 (mezcla agresiva)
 *    → Configuración estándar (WAVE 1017.2)
 *
 * ============================================================================
 */
// ===========================================================================
// CONFIGURACIÓN UNIFICADA DE ROCK - WAVE 1017.1 "GOD EAR CALIBRATION"
// ===========================================================================
/**
 * Una sola configuración. Sin modos. Sin switches. Sin drama.
 * Los multiplicadores son BASE y las métricas los escalan linealmente.
 *
 * 🩻 WAVE 1017.1: GOD EAR ZONE REDISTRIBUTION
 * ═══════════════════════════════════════════
 * Con GOD EAR FFT (Blackman-Harris + LR4 filters), la señal es MÁS PURA.
 * Esto significa que podemos ser MÁS SELECTIVOS con las zonas.
 *
 * NUEVA DISTRIBUCIÓN:
 * ┌─────────────┬──────────────────────────────────────────────────────┐
 * │ Front Par   │ SubBass PURO (20-80Hz) - KICK DRUM                   │
 * │             │ Gate ALTO (0.22) - solo golpes sísmicos              │
 * ├─────────────┼──────────────────────────────────────────────────────┤
 * │ Back Par    │ Mid PURO (500-2000Hz) - VOCES + MELODÍA              │
 * │             │ Gate BAJO (0.05) - sensible a Freddie Mercury        │
 * ├─────────────┼──────────────────────────────────────────────────────┤
 * │ Mover Left  │ LowMid + HighMid (80-2500Hz) - GUITARRAS + BAJO      │
 * │             │ El "director" musical - riffs y cuerpo               │
 * ├─────────────┼──────────────────────────────────────────────────────┤
 * │ Mover Right │ Presence + Treble (2.5k-16kHz) - CYMBALS + BRILLO    │
 * │             │ Con VOICE LEAK FILTER - solo crispiness              │
 * └─────────────┴──────────────────────────────────────────────────────┘
 */
const ROCK_UNIFIED_CONFIG = {
    // 🎸 Ganancias base por zona - WAVE 1019: FINAL TUNING (Metallica/Red Hot perfecto)
    gains: {
        frontPar: 2.6, // OK - compensar floor alto de SubBass
        backPar: 2.0, // OK - Mid (voces) tiene buena presencia
        moverLeft: 1.8, // SUBIDO 1.5→1.8 - VITAMINAS para riffs (Metallica/Red Hot)
        moverRight: 1.8, // BAJADO 2.0→1.8 - un pelín menos agresivo
    },
    // 🚪 Gates - WAVE 1019: FINAL TUNING
    gates: {
        frontPar: 0.28, // OK - solo kicks SÍSMICOS reales
        backPar: 0.05, // OK - voces sensibles (Brian Johnson territory)
        moverLeft: 0.10, // BAJADO 0.12→0.10 - más reactivo a riffs
        moverRight: 0.12, // OK - filtrar ruido residual
    },
    // ⚡ Decay speeds - WAVE 1017.1: Ajustados para cada rol
    decay: {
        frontPar: 0.20, // MUY RÁPIDO - PULSO de kick (pump effect)
        backPar: 0.75, // LENTO - voces con sustain (mantiene presencia)
        moverLeft: 0.65, // MEDIO - riffs con presencia pero no pegajosos
        moverRight: 0.50, // RÁPIDO - cymbals con ataque limpio
    },
    // 🎸 Modulación por harshness - WAVE 1017.1: Afecta Back (voces distorsionadas)
    harshnessModulation: {
        backParBoost: 0.3, // NUEVO: harshness sube voces (gritos de metal)
        moverIntensity: 0.15, // Reducido - guitarras ya están en Mover L
        gateBoost: 0.20, // harshness 1.0 = +20% gate en Front (más selectivo)
    },
    // 🌊 Modulación por flatness (Pink Floyd territory)
    flatnessModulation: {
        moverSpreadBoost: 0.35,
        decayStretch: 0.25,
    },
    // 🎯 Modulación por centroidHz
    centroidModulation: {
        minHz: 800,
        maxHz: 6000,
        decayScale: 0.20,
    },
};
// ===========================================================================
// 🎸 ROCK STEREO PHYSICS 2.0 - LOBOTOMIZED
// ===========================================================================
export class RockStereoPhysics2 {
    constructor() {
        // Estado interno de intensidades (con smoothing propio)
        this.frontIntensity = 0;
        this.backIntensity = 0;
        this.moverLeftIntensity = 0;
        this.moverRightIntensity = 0;
        // Estado de movers (posición para movimiento fluido)
        this.moverLeftPosition = 0.5;
        this.moverRightPosition = 0.5;
        // Historial para detección de transients
        this.lastBands = { subBass: 0, lowMid: 0, highMid: 0, presence: 0 };
        // Frame counter para debug
        this.frameCount = 0;
        // 🎭 WAVE 1018: SUBGENRE DETECTOR CON MEMORIA HISTÓRICA
        this.detectionHistory = [];
        this.currentSubgenre = 'HARD_ROCK'; // Default
        this.HISTORY_WINDOW = 1800; // 30 segundos @ 60fps
        this.CHANGE_THRESHOLD = 0.70; // 70% de samples deben coincidir para cambiar
        this.lastSubgenreChangeFrame = 0;
        this.MIN_FRAMES_BETWEEN_CHANGES = 600; // Mínimo 10 segundos entre cambios
        console.log('[RockStereoPhysics2] 🎸 UNIFIED ARCHITECTURE initialized (WAVE 1018 PROG DETECTOR)');
        console.log('[RockStereoPhysics2] 🩻 Zones: Front=Kick | Back=Voces | ML=Guitarras | MR=Cymbals');
        console.log('[RockStereoPhysics2] 🎭 Subgenre Detection: HARD_ROCK (default) | PROG_ROCK (auto-detect)');
    }
    // ==========================================================================
    // CORE PROCESSING - SIN SUBGÉNEROS, SIN MODOS
    // ==========================================================================
    process(input) {
        this.frameCount++;
        // 🔬 WAVE 1015 DEBUG: Ver qué valores están entrando (TEMPORAL)
        if (this.frameCount % 120 === 0) { // Cada 2 segundos
            console.log(`🔬 [RockPhysics2] INPUT DEBUG | ` +
                `Bass=${input.bass?.toFixed(3)} Mid=${input.mid?.toFixed(3)} Treble=${input.treble?.toFixed(3)} | ` +
                `SubBass=${input.subBass?.toFixed(3)} LowMid=${input.lowMid?.toFixed(3)} HighMid=${input.highMid?.toFixed(3)} | ` +
                `Silence=${input.isRealSilence} AGCTrap=${input.isAGCTrap}`);
        }
        // 1. Extraer bandas reales
        const bands = this.extractBands(input);
        // 🔬 WAVE 1015 DEBUG: Ver qué bandas se están usando (TEMPORAL)
        if (this.frameCount % 120 === 0) {
            console.log(`🔬 [RockPhysics2] BANDS EXTRACTED | ` +
                `SubBass=${bands.subBass.toFixed(3)} LowMid=${bands.lowMid.toFixed(3)} ` +
                `HighMid=${bands.highMid.toFixed(3)} Presence=${bands.presence.toFixed(3)}`);
        }
        // 2. Extraer métricas espectrales (con fallbacks seguros)
        const harshness = input.harshness ?? 0.35;
        const flatness = input.flatness ?? 0.40;
        const centroidHz = input.spectralCentroidHz ?? 2000;
        const clarity = input.clarity ?? 0.85;
        // 🎭 WAVE 1018: DETECCIÓN DE SUBGÉNERO CON MEMORIA HISTÓRICA
        this.detectAndUpdateSubgenre(centroidHz, flatness, clarity, harshness, input.treble);
        // 3. Calcular moduladores lineales
        const hMod = this.calculateHarshnessModulator(harshness);
        const fMod = this.calculateFlatnessModulator(flatness);
        const cMod = this.calculateCentroidModulator(centroidHz);
        // 4. Procesar cada zona (con lógica específica de subgénero)
        this.processFrontPar(bands, cMod);
        this.processBackPar(bands, hMod, cMod);
        this.processMoverLeft(bands, hMod, fMod, cMod);
        this.processMoverRight(bands, hMod, fMod, cMod, centroidHz); // 🎭 Ahora recibe centroid
        // 🎯 WAVE 1015.2: STEREO DIFFERENTIAL GATING
        // Si L y R están muy cerca (< 20% diferencia), forzar al más bajo a apagarse
        this.applyStereoDifferentialGating();
        // 5. Actualizar posiciones de movers
        this.updateMoverPositions(bands, fMod);
        // 6. Guardar bandas para detección de transients
        this.lastBands = { ...bands };
        // Debug cada ~1 segundo
        if (this.frameCount % 60 === 0) {
            this.logDebug(bands, harshness, flatness, centroidHz, hMod, fMod, cMod);
        }
        // 7. Construir resultado
        return {
            frontParIntensity: this.frontIntensity,
            backParIntensity: this.backIntensity,
            moverIntensityL: this.moverLeftIntensity,
            moverIntensityR: this.moverRightIntensity,
            moverIntensity: Math.max(this.moverLeftIntensity, this.moverRightIntensity),
            moverActive: this.moverLeftIntensity > 0.1 || this.moverRightIntensity > 0.1,
            moverPositionL: this.moverLeftPosition,
            moverPositionR: this.moverRightPosition,
            physicsApplied: 'rock',
            // 🎭 WAVE 1018: Subgénero detectado
            detectedSubgenre: this.currentSubgenre,
            modulators: {
                harshness: hMod,
                flatness: fMod,
                centroid: cMod,
            },
        };
    }
    // ==========================================================================
    // EXTRACCIÓN DE BANDAS REALES
    // ==========================================================================
    extractBands(input) {
        // 🩻 WAVE 1017.2: GOD EAR FINE TUNING para AC/DC y rock clásico
        // El bajo de Cliff Williams (AC/DC) está en 60-150Hz, justo en el límite
        // SubBass/LowMid. Necesitamos floors MÁS ALTOS para separar kick del bajo.
        const hasRealBands = (input.subBass !== undefined &&
            input.lowMid !== undefined &&
            input.highMid !== undefined);
        if (hasRealBands) {
            const rawSubBass = input.subBass ?? 0;
            const rawLowMid = input.lowMid ?? 0;
            const rawHighMid = input.highMid ?? 0;
            const rawPresence = input.treble ?? 0;
            // 🩻 WAVE 1017.2: RENORMALIZACIÓN AJUSTADA PARA ROCK CLÁSICO
            // - SubBass: Floor MUY ALTO (0.50) - solo kicks sísmicos reales
            // - LowMid: Floor ALTO (0.45) - filtrar bajo constante
            // - HighMid: Floor MODERADO (0.28) - voces con sensibilidad
            // - Presence: Floor BAJO (0.12) - cymbals reactivos
            const renormalize = (val, floor, ceiling, expansionPower = 0.85) => {
                if (val < floor)
                    return 0;
                const normalized = (val - floor) / (ceiling - floor);
                const expanded = Math.pow(Math.min(1, normalized), expansionPower);
                return expanded;
            };
            return {
                subBass: renormalize(rawSubBass, 0.50, 0.85, 0.80), // SUBIDO 0.42→0.50 (solo kicks)
                lowMid: renormalize(rawLowMid, 0.45, 0.85, 0.82), // SUBIDO 0.42→0.45 (filtrar bajo)
                highMid: renormalize(rawHighMid, 0.28, 0.75, 0.85), // SUBIDO 0.25→0.28 (voces)
                presence: renormalize(rawPresence, 0.12, 0.50, 0.90), // BAJADO 0.15→0.12 (cymbals sensibles)
            };
        }
        // Legacy path
        const bass = input.bass ?? 0;
        const mid = input.mid ?? 0;
        const treble = input.treble ?? 0;
        return {
            subBass: bass * 0.9,
            lowMid: bass * 0.5 + mid * 0.5,
            highMid: mid * 0.6 + treble * 0.4,
            presence: treble * 0.7 + mid * 0.3,
        };
    }
    // ==========================================================================
    // CALCULADORES DE MODULACIÓN LINEAL
    // ==========================================================================
    /**
     * Harshness Modulator: Más harshness = más intensidad en BackPar y Movers
     * Rango: harshness 0→1.0, harshness 1→1.4 (con boost max de 0.4)
     */
    calculateHarshnessModulator(harshness) {
        const boost = harshness * ROCK_UNIFIED_CONFIG.harshnessModulation.backParBoost;
        return 1.0 + boost;
    }
    /**
     * Flatness Modulator: Más flatness = movimientos más amplios/suaves
     * Rango: flatness 0→1.0, flatness 1→1.3 (con boost max de 0.3)
     */
    calculateFlatnessModulator(flatness) {
        const boost = flatness * ROCK_UNIFIED_CONFIG.flatnessModulation.moverSpreadBoost;
        return 1.0 + boost;
    }
    /**
     * Centroid Modulator: Frecuencias altas = respuestas más rápidas (decay menor)
     * Rango: 1000Hz→1.0, 5000Hz→0.85 (más rápido)
     */
    calculateCentroidModulator(centroidHz) {
        const { minHz, maxHz, decayScale } = ROCK_UNIFIED_CONFIG.centroidModulation;
        // Normalizar centroid al rango [0, 1]
        const normalized = Math.max(0, Math.min(1, (centroidHz - minHz) / (maxHz - minHz)));
        // Centroid alto = decay más bajo (más rápido)
        return 1.0 - (normalized * decayScale);
    }
    // ==========================================================================
    // 🎭 WAVE 1018: SUBGENRE DETECTOR CON MEMORIA HISTÓRICA
    // ==========================================================================
    /**
     * Detecta el subgénero de rock basándose en métricas espectrales
     * y MANTIENE la detección usando una ventana histórica de 30 segundos.
     *
     * NO cambia cada 10 segundos como loco. Una vez detectado "PROG_ROCK",
     * se mantiene ahí hasta que >70% de las muestras recientes indiquen otra cosa.
     */
    detectAndUpdateSubgenre(centroidHz, flatness, clarity, harshness, treble) {
        // 🎯 PROG ROCK SIGNATURE (Pink Floyd, Yes, Genesis, Rush)
        const progSignals = {
            lowCentroid: centroidHz >= 500 && centroidHz <= 1500, // Teclados dominantes
            veryTonal: flatness < 0.05, // Atmosférico/limpio
            highClarity: clarity > 0.95, // Mezcla pristina
            lowTreble: treble < 0.15, // Guitarra enterrada
        };
        const progScore = Object.values(progSignals).filter(Boolean).length;
        // 🎯 HARD ROCK SIGNATURE (AC/DC, Metallica, Red Hot, System of a Down)
        const hardSignals = {
            midHighCentroid: centroidHz >= 1000 && centroidHz <= 3000, // Guitarras al frente
            harshness: harshness > 0.20, // Distorsión
            mediumClarity: clarity >= 0.70 && clarity <= 0.95, // Mezcla agresiva
        };
        const hardScore = Object.values(hardSignals).filter(Boolean).length;
        // Determinar subgénero con CONFIANZA
        let detectedSubgenre;
        let confidence;
        if (progScore >= 3) {
            // 3+ de 4 señales PROG → PROG_ROCK
            detectedSubgenre = 'PROG_ROCK';
            confidence = progScore / 4;
        }
        else if (hardScore >= 2) {
            // 2+ de 3 señales HARD → HARD_ROCK
            detectedSubgenre = 'HARD_ROCK';
            confidence = hardScore / 3;
        }
        else {
            // Default: HARD_ROCK (bajo confianza)
            detectedSubgenre = 'HARD_ROCK';
            confidence = 0.4;
        }
        // Añadir sample a historial
        this.detectionHistory.push({
            subgenre: detectedSubgenre,
            confidence,
            timestamp: this.frameCount,
        });
        // Mantener solo los últimos 30 segundos (1800 frames @ 60fps)
        if (this.detectionHistory.length > this.HISTORY_WINDOW) {
            this.detectionHistory.shift();
        }
        // 🧠 HYSTERESIS: Solo cambiar si >70% de samples recientes coinciden
        // Y han pasado al menos 10 segundos desde el último cambio
        if (this.frameCount - this.lastSubgenreChangeFrame >= this.MIN_FRAMES_BETWEEN_CHANGES) {
            const recentSamples = this.detectionHistory.slice(-300); // Últimos 5 segundos
            if (recentSamples.length >= 100) { // Al menos 100 samples (~2 segundos)
                const progCount = recentSamples.filter(s => s.subgenre === 'PROG_ROCK').length;
                const hardCount = recentSamples.filter(s => s.subgenre === 'HARD_ROCK').length;
                const progRatio = progCount / recentSamples.length;
                const hardRatio = hardCount / recentSamples.length;
                // Cambiar SOLO si hay consenso fuerte (>70%)
                if (progRatio > this.CHANGE_THRESHOLD && this.currentSubgenre !== 'PROG_ROCK') {
                    this.currentSubgenre = 'PROG_ROCK';
                    this.lastSubgenreChangeFrame = this.frameCount;
                    console.log(`🎭 [RockPhysics2] SUBGENRE CHANGE → PROG_ROCK (confidence: ${(progRatio * 100).toFixed(1)}%)`);
                    console.log(`   🩻 Signature: C=${centroidHz.toFixed(0)}Hz F=${flatness.toFixed(3)} Clarity=${clarity.toFixed(3)} T=${treble.toFixed(3)}`);
                }
                else if (hardRatio > this.CHANGE_THRESHOLD && this.currentSubgenre !== 'HARD_ROCK') {
                    this.currentSubgenre = 'HARD_ROCK';
                    this.lastSubgenreChangeFrame = this.frameCount;
                    console.log(`🎭 [RockPhysics2] SUBGENRE CHANGE → HARD_ROCK (confidence: ${(hardRatio * 100).toFixed(1)}%)`);
                }
            }
        }
        // Debug cada 5 segundos
        if (this.frameCount % 300 === 0 && this.detectionHistory.length > 0) {
            const recent = this.detectionHistory.slice(-300);
            const progPct = (recent.filter(s => s.subgenre === 'PROG_ROCK').length / recent.length * 100).toFixed(1);
            console.log(`🎭 [Subgenre Monitor] Current=${this.currentSubgenre} | ` +
                `Last 5s: PROG=${progPct}% | C=${centroidHz.toFixed(0)}Hz F=${flatness.toFixed(2)}`);
        }
    }
    // ==========================================================================
    // PROCESAMIENTO POR ZONA
    // ==========================================================================
    /**
     * FRONT PAR: SubBass PURO - WAVE 1017.1 GOD EAR CALIBRATION
     * 🥁 KICK DRUM TERRITORY (20-80Hz)
     * Con GOD EAR la señal es más pura, podemos ser MÁS selectivos.
     * Gate ALTO para que SOLO pasen golpes sísmicos reales.
     */
    processFrontPar(bands, centroidMod) {
        const config = ROCK_UNIFIED_CONFIG;
        // 🩻 WAVE 1017.1: SubBass PURO - sin LowMid leak
        // GOD EAR ya separa bien las bandas, no necesitamos filtro de leak
        const rawInput = bands.subBass;
        // 🎯 Gate check ESTRICTO - solo kicks sísmicos
        if (rawInput < config.gates.frontPar) {
            // Decay MUY RÁPIDO hacia 0 (pump effect)
            this.frontIntensity *= config.decay.frontPar * centroidMod;
            if (this.frontIntensity < 0.01)
                this.frontIntensity = 0;
            return;
        }
        // Gain directo - la renormalización ya tiene expansión
        const target = rawInput * config.gains.frontPar;
        // Attack/Release asimétrico (attack rápido, release suave)
        if (target > this.frontIntensity) {
            this.frontIntensity = target; // Attack instantáneo
        }
        else {
            const decaySpeed = config.decay.frontPar * centroidMod;
            this.frontIntensity = this.frontIntensity * decaySpeed + target * (1 - decaySpeed);
        }
        // Soft limiter por encima de 0.85
        if (this.frontIntensity > 0.85) {
            const excess = this.frontIntensity - 0.85;
            this.frontIntensity = 0.85 + (excess * 0.4);
        }
        this.frontIntensity = Math.max(0, Math.min(1.0, this.frontIntensity));
    }
    /**
     * BACK PAR: Mid PURO - WAVE 1017.1 GOD EAR CALIBRATION
     * � VOCES + MELODÍA (500-2000Hz) - FREDDIE MERCURY TERRITORY
     * Gate MUY BAJO para captar voces con sensibilidad.
     * Harshness SUBE el gain (gritos de metal = más Back).
     */
    processBackPar(bands, harshnessMod, centroidMod) {
        const config = ROCK_UNIFIED_CONFIG;
        // 🩻 WAVE 1017.1: Mid = HighMid en nuestra nomenclatura (400-2500Hz)
        // Aquí viven las VOCES de rock (Brian Johnson, Freddie, etc.)
        const input = bands.highMid;
        // Gate MUY SENSIBLE para voces
        if (input < config.gates.backPar) {
            this.backIntensity *= config.decay.backPar * centroidMod;
            if (this.backIntensity < 0.01)
                this.backIntensity = 0;
            return;
        }
        // � Harshness BOOST para voces distorsionadas/gritos
        // Metal agresivo → Back POTENTE (gritos de Dickinson)
        // Balada suave → Back suave (voces limpias)
        const harshnessBoost = (harshnessMod - 1.0) * config.harshnessModulation.backParBoost;
        const modulatedGain = config.gains.backPar * (1.0 + harshnessBoost);
        const target = input * modulatedGain;
        // Decay LENTO para mantener presencia de voz (sustain)
        if (target > this.backIntensity) {
            this.backIntensity = target;
        }
        else {
            const decaySpeed = config.decay.backPar * centroidMod;
            this.backIntensity = this.backIntensity * decaySpeed + target * (1 - decaySpeed);
        }
        this.backIntensity = Math.max(0, Math.min(1.0, this.backIntensity));
    }
    /**
     * MOVER LEFT: LowMid + HighMid - WAVE 1017.1 GOD EAR CALIBRATION
     * 🎸 GUITARRAS + BAJO - EL DIRECTOR MUSICAL (80-2500Hz)
     * Este mover "dirige" la música - sigue los riffs y el cuerpo.
     */
    processMoverLeft(bands, harshnessMod, flatnessMod, centroidMod) {
        const config = ROCK_UNIFIED_CONFIG;
        // 🩻 WAVE 1017.1: BLEND de LowMid (bajo) + HighMid (guitarras)
        // 60% LowMid (cuerpo/peso) + 40% HighMid (definición/ataque)
        const bassBody = bands.lowMid * 0.6;
        const guitarCrunch = bands.highMid * 0.4;
        const input = bassBody + guitarCrunch;
        // Gate check
        if (input < config.gates.moverLeft) {
            this.moverLeftIntensity *= config.decay.moverLeft * centroidMod;
            if (this.moverLeftIntensity < 0.01)
                this.moverLeftIntensity = 0;
            return;
        }
        // Harshness boost moderado (guitarras distorsionadas)
        const harshnessBoost = (harshnessMod - 1.0) * config.harshnessModulation.moverIntensity;
        const modulatedGain = config.gains.moverLeft * (1.0 + harshnessBoost);
        const target = input * modulatedGain;
        // Decay con flatness stretch (Pink Floyd = más sustain)
        if (target > this.moverLeftIntensity) {
            this.moverLeftIntensity = target;
        }
        else {
            const flatnessStretch = 1.0 + (flatnessMod - 1.0) * config.flatnessModulation.decayStretch;
            const decaySpeed = Math.min(0.95, config.decay.moverLeft * centroidMod * flatnessStretch);
            this.moverLeftIntensity = this.moverLeftIntensity * decaySpeed + target * (1 - decaySpeed);
        }
        this.moverLeftIntensity = Math.max(0, Math.min(1.0, this.moverLeftIntensity));
    }
    /**
     * MOVER RIGHT - WAVE 1018: DUAL-BAND ADAPTIVE SYSTEM
     *
     * HARD ROCK MODE (AC/DC, Metallica):
     *   ✨ Presence (2.5k-8kHz) = CYMBALS PURO
     *   🔇 Voice Rejection Filter (3-stage)
     *
     * PROG ROCK MODE (Pink Floyd, Yes):
     *   🎸 DUAL-BAND: Presence OR HighMid (detecta solos enterrados)
     *   📡 Guitar Solo Detection: HighMid>0.30 + Centroid>1500Hz
     */
    processMoverRight(bands, harshnessMod, flatnessMod, centroidMod, centroidHz // 🎭 WAVE 1018: Necesario para PROG detection
    ) {
        const config = ROCK_UNIFIED_CONFIG;
        // 🎭 WAVE 1018: DUAL-BAND LOGIC FOR PROG ROCK
        // Si estamos en PROG y detectamos signature de solo de guitarra,
        // usar HighMid también (guitarra enterrada en mezcla densa)
        let rawInput = bands.presence;
        if (this.currentSubgenre === 'PROG_ROCK') {
            // Guitar Solo Signature: HighMid alto + Centroid en rango de solo
            const guitarSoloSignature = bands.highMid > 0.25 && centroidHz > 1200; // 🎸 BAJADO 0.30→0.25, 1500→1200
            if (guitarSoloSignature) {
                // DUAL-BAND: Tomar el MAYOR entre Presence y HighMid ajustado
                rawInput = Math.max(bands.presence, bands.highMid * 0.7);
                // Debug cuando detecta solo
                if (this.frameCount % 60 === 0 && rawInput > 0.2) {
                    console.log(`🎸 [PROG Guitar Solo] HM=${bands.highMid.toFixed(2)} PR=${bands.presence.toFixed(2)} ` +
                        `C=${centroidHz.toFixed(0)}Hz → MR_input=${rawInput.toFixed(2)}`);
                }
            }
        }
        else {
            // 🎸 WAVE 1018.1: HARD_ROCK TAMBIÉN USA DUAL-BAND (menos agresivo)
            // Algunas grabaciones modernas de Floyd tienen mejor mezcla
            const possibleGuitarSolo = bands.highMid > 0.35 && centroidHz > 1800;
            if (possibleGuitarSolo) {
                rawInput = Math.max(bands.presence, bands.highMid * 0.5); // Menos weight que PROG
            }
        }
        const input = rawInput;
        // Gate check
        if (input < config.gates.moverRight) {
            this.moverRightIntensity *= config.decay.moverRight * centroidMod;
            if (this.moverRightIntensity < 0.01)
                this.moverRightIntensity = 0;
            return;
        }
        // ========================================================================
        // 🎯 WAVE 1017.2: ENHANCED VOICE REJECTION SYSTEM
        // ========================================================================
        // 
        // ANÁLISIS DEL LOG DE THUNDERSTRUCK:
        // - Cuando Brian grita: HighMid=0.50+, Presence=0.15-0.25
        // - Cuando cymbals pegan: HighMid=0.20-0.30, Presence=0.25-0.40
        // 
        // REGLA: Si HighMid domina (>1.8x Presence), es VOICE → reducir
        // REGLA 2: Si HighMid > 0.35 absoluto Y ratio > 1.5 → definitivamente voz
        //
        const voiceLeakRatio = bands.highMid / Math.max(0.01, bands.presence);
        // Stage 1: Ratio check (1.8x en vez de 2.5x)
        const isVoiceByRatio = voiceLeakRatio > 1.8;
        // Stage 2: Absolute HighMid check (voces tienen HighMid fuerte)
        const isVoiceByAbsolute = bands.highMid > 0.35 && voiceLeakRatio > 1.5;
        // Stage 3: Combined decision con rejection graduado
        let voiceRejection = 1.0; // 1.0 = no rejection
        if (isVoiceByAbsolute) {
            // Definitive voice → heavy rejection (20% pass)
            voiceRejection = 0.20;
        }
        else if (isVoiceByRatio) {
            // Probable voice → moderate rejection (40% pass)  
            voiceRejection = 0.40;
        }
        else if (voiceLeakRatio > 1.3) {
            // Suspicious → light rejection (70% pass)
            voiceRejection = 0.70;
        }
        // else: voiceRejection = 1.0 → cymbals puros, no rejection
        const filteredInput = input * voiceRejection;
        // Debug cada 2 segundos cuando hay voice rejection
        if (this.frameCount % 120 === 0 && voiceRejection < 1.0) {
            console.log(`🔇 [MoverR Voice Filter] Ratio=${voiceLeakRatio.toFixed(2)} HM=${bands.highMid.toFixed(2)} ` +
                `→ Rejection=${(1 - voiceRejection) * 100}%`);
        }
        // Gain con harshness moderado
        const harshnessBoost = (harshnessMod - 1.0) * config.harshnessModulation.moverIntensity;
        const modulatedGain = config.gains.moverRight * (1.0 + harshnessBoost);
        const target = filteredInput * modulatedGain;
        // Decay RÁPIDO para ataque limpio de cymbals
        if (target > this.moverRightIntensity) {
            this.moverRightIntensity = target;
        }
        else {
            const flatnessStretch = 1.0 + (flatnessMod - 1.0) * config.flatnessModulation.decayStretch;
            const decaySpeed = Math.min(0.95, config.decay.moverRight * centroidMod * flatnessStretch);
            this.moverRightIntensity = this.moverRightIntensity * decaySpeed + target * (1 - decaySpeed);
        }
        // Soft limiter
        if (this.moverRightIntensity > 0.85) {
            const excess = this.moverRightIntensity - 0.85;
            this.moverRightIntensity = 0.85 + (excess * 0.4);
        }
        this.moverRightIntensity = Math.max(0, Math.min(1.0, this.moverRightIntensity));
    }
    // ==========================================================================
    // STEREO DIFFERENTIAL GATING - WAVE 1015.2
    // ==========================================================================
    /**
     * Si Mover L y R están muy cerca (gemelos), forzar al más débil a apagarse
     * para crear separación estéreo REAL.
     */
    applyStereoDifferentialGating() {
        const diff = Math.abs(this.moverLeftIntensity - this.moverRightIntensity);
        const avg = (this.moverLeftIntensity + this.moverRightIntensity) / 2;
        // Si la diferencia es < 20% del promedio → son gemelos
        if (avg > 0.1 && diff < avg * 0.20) {
            // Forzar al más débil a 0
            if (this.moverLeftIntensity < this.moverRightIntensity) {
                this.moverLeftIntensity *= 0.3; // Fade out rápido
            }
            else {
                this.moverRightIntensity *= 0.3; // Fade out rápido
            }
        }
    }
    // ==========================================================================
    // MOVER POSITION LOGIC
    // ==========================================================================
    updateMoverPositions(bands, flatnessMod) {
        // Detectar transients
        const transientL = Math.max(0, bands.highMid - this.lastBands.highMid);
        const transientR = Math.max(0, bands.presence - this.lastBands.presence);
        // Spread base modulado por flatness (rock atmosférico = más spread)
        const baseSpread = 0.25 * flatnessMod;
        // Mover Left: oscila hacia la izquierda con transients
        if (transientL > 0.05) {
            const delta = transientL * baseSpread;
            this.moverLeftPosition = Math.max(0.15, Math.min(0.85, this.moverLeftPosition - delta));
        }
        else {
            // Retorno gradual al centro
            this.moverLeftPosition += (0.5 - this.moverLeftPosition) * 0.03;
        }
        // Mover Right: oscila hacia la derecha con transients
        if (transientR > 0.05) {
            const delta = transientR * baseSpread;
            this.moverRightPosition = Math.max(0.15, Math.min(0.85, this.moverRightPosition + delta));
        }
        else {
            // Retorno gradual al centro
            this.moverRightPosition += (0.5 - this.moverRightPosition) * 0.03;
        }
    }
    // ==========================================================================
    // DEBUG
    // ==========================================================================
    logDebug(bands, harshness, flatness, centroidHz, hMod, fMod, cMod) {
        console.log(`🎸 RockPhysics2 [UNIFIED] | ` +
            `Bands: SB=${bands.subBass.toFixed(2)} LM=${bands.lowMid.toFixed(2)} ` +
            `HM=${bands.highMid.toFixed(2)} PR=${bands.presence.toFixed(2)} | ` +
            `Spectral: H=${harshness.toFixed(2)} F=${flatness.toFixed(2)} C=${centroidHz.toFixed(0)}Hz | ` +
            `Mods: H=${hMod.toFixed(2)} F=${fMod.toFixed(2)} C=${cMod.toFixed(2)} | ` +
            `Out: FP=${this.frontIntensity.toFixed(2)} BP=${this.backIntensity.toFixed(2)} ` +
            `ML=${this.moverLeftIntensity.toFixed(2)} MR=${this.moverRightIntensity.toFixed(2)}`);
    }
    // ==========================================================================
    // PUBLIC API
    // ==========================================================================
    getDebugInfo() {
        return {
            engineType: 'RockStereoPhysics2-UNIFIED',
            frameCount: this.frameCount,
            intensities: {
                front: this.frontIntensity,
                back: this.backIntensity,
                moverLeft: this.moverLeftIntensity,
                moverRight: this.moverRightIntensity,
            },
            moverPositions: {
                left: this.moverLeftPosition,
                right: this.moverRightPosition,
            },
        };
    }
    /**
     * Reset del motor - útil para cambios de canción
     */
    reset() {
        this.frontIntensity = 0;
        this.backIntensity = 0;
        this.moverLeftIntensity = 0;
        this.moverRightIntensity = 0;
        this.moverLeftPosition = 0.5;
        this.moverRightPosition = 0.5;
        this.lastBands = { subBass: 0, lowMid: 0, highMid: 0, presence: 0 };
        this.frameCount = 0;
        console.log('[RockStereoPhysics2] 🔄 Reset complete');
    }
    // ==========================================================================
    // LEGACY API ADAPTER - Para compatibilidad con SeleneLux
    // ==========================================================================
    /**
     * applyZones: Adapter para SeleneLux que usa el contexto estructurado anterior.
     * Convierte el formato RockAudioContext → RockPhysicsInput y retorna RockZonesResult.
     */
    applyZones(context) {
        // Convertir al nuevo formato de input
        const input = {
            bass: context.bass,
            mid: context.mid,
            treble: context.treble,
            subBass: context.subBass,
            lowMid: context.lowMid,
            highMid: context.highMid,
            harshness: context.harshness,
            flatness: context.spectralFlatness,
            spectralCentroidHz: context.spectralCentroid,
            bpm: context.bpm ?? 120,
            melodyThreshold: 0.3, // Default para rock
            isRealSilence: false,
            isAGCTrap: false,
        };
        // Procesar
        const result = this.process(input);
        // Retornar en el formato que SeleneLux espera
        // 🔥 WAVE 1011.6: Los valores internos pueden superar 1.0, pero la salida se clampea
        return {
            front: Math.min(1.0, result.frontParIntensity),
            back: Math.min(1.0, result.backParIntensity),
            moverLeft: Math.min(1.0, result.moverIntensityL),
            moverRight: Math.min(1.0, result.moverIntensityR),
            subgenre: 'ROCK', // 🎸 UNIFIED - No hay subgéneros, solo ROCK
        };
    }
}
// =============================================================================
// SINGLETON INSTANCE
// =============================================================================
/** Singleton instance for global use */
export const rockPhysics2 = new RockStereoPhysics2();
