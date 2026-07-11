/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 WAVE 1024: THE NARRATIVE ARC - SECTION TRACKER v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DIAGNÓSTICO DEL CÓDIGO ANTERIOR (WAVE 8 → WAVE 289):
 *
 * 1. 🩺 UMBRALES FIJOS GLOBALES
 *    Aunque WAVE 47.2 añadió baseline de percentiles (P25/P50/P75),
 *    estos se calculan sobre TODA la sesión (60s de historial).
 *    Problema: Una canción antigua masterizada baja (max 0.6)
 *    NUNCA disparaba el DROP. Una moderna comprimida NUNCA el breakdown.
 *
 * 2. 🩺 DETECCIÓN DE BUILDUP CIEGA
 *    Solo miraba trend (rising) + zona media de energía.
 *    NO usaba métricas espectrales del God Ear FFT:
 *    - Rolloff ↑ (brillo sube)
 *    - Flatness ↑ (ruido blanco, snare roll)
 *    - SubBass ↓ (bajo desaparece antes del drop)
 *
 * 3. 🩺 SISTEMA DE VOTOS INDEPENDIENTE
 *    Cada regla votaba por su cuenta sin correlación.
 *    No había "consenso" entre múltiples fuentes de verdad.
 *
 * SOLUCIÓN: THE NARRATIVE ARC
 *
 * A. 📈 SLIDING WINDOW ADAPATIVA (30 segundos)
 *    - localMaxEnergy: Pico de los últimos 30s
 *    - localMinEnergy: Suelo de los últimos 30s
 *    - DROP = currentEnergy > 0.8 * localMax (aunque absoluto sea bajo)
 *    - BREAKDOWN = currentEnergy < 1.2 * localMin (aunque absoluto sea alto)
 *
 * B. 🎻 BUILDUP DETECTOR ESPECTRAL (God Ear Integration)
 *    - Rising Rolloff: Brillo sube progresivamente
 *    - Rising Flatness: Ruido blanco aumenta (snare roll típico)
 *    - Falling SubBass: Bajo desaparece (filter sweep hacia arriba)
 *    - Resultado: Estado BUILDUP con precisión quirúrgica
 *
 * C. 🗳️ CONSENSUS VOTING (Multi-Motor)
 *    Si RhythmAnalyzer dice "mucha síncopa" +
 *    GodEar dice "alta claridad" +
 *    Energía es alta =
 *    VOTO UNÁNIME para CHORUS/DROP (peso 2.5x)
 *
 * @author PunkOpus
 * @wave 1024
 * @module engines/musical/analysis/SectionTracker
 */
import { EventEmitter } from 'events';
// 🎯 WAVE 289: Perfiles de sección por género
import { VIBE_SECTION_PROFILES, getVibeSectionProfile, calculateWeightedEnergy, } from './VibeSectionProfiles.js';
// ============================================================
// 📊 CONSTANTES Y CONFIGURACIÓN
// ============================================================
/**
 * Perfiles de energía típicos por sección
 *
 * Cada sección tiene un rango de energía y características típicas
 */
export const SECTION_PROFILES = {
    intro: {
        energyRange: [0.1, 0.4],
        typicalDuration: [8, 32],
        characteristics: ['low_energy', 'building', 'sparse'],
    },
    verse: {
        energyRange: [0.3, 0.6],
        typicalDuration: [16, 64],
        characteristics: ['moderate_energy', 'steady', 'melodic'],
    },
    pre_chorus: {
        energyRange: [0.5, 0.7],
        typicalDuration: [8, 16],
        characteristics: ['rising_energy', 'anticipation'],
    },
    chorus: {
        energyRange: [0.6, 0.9],
        typicalDuration: [16, 32],
        characteristics: ['high_energy', 'full_instrumentation'],
    },
    bridge: {
        energyRange: [0.4, 0.6],
        typicalDuration: [8, 16],
        characteristics: ['different_texture', 'contrast'],
    },
    buildup: {
        energyRange: [0.5, 0.95],
        typicalDuration: [8, 32],
        characteristics: ['rising_energy', 'tension', 'snare_roll', 'filter_sweep'],
    },
    drop: {
        energyRange: [0.8, 1.0],
        typicalDuration: [16, 64],
        characteristics: ['peak_energy', 'bass_heavy', 'full_impact'],
    },
    textural_drop: {
        energyRange: [0.3, 0.7],
        typicalDuration: [8, 32],
        characteristics: ['spectral_tension', 'high_freq_burst', 'textural_contrast'],
    },
    breakdown: {
        energyRange: [0.2, 0.5],
        typicalDuration: [8, 32],
        characteristics: ['low_energy', 'stripped_back', 'atmospheric'],
    },
    outro: {
        energyRange: [0.1, 0.4],
        typicalDuration: [8, 32],
        characteristics: ['falling_energy', 'fading', 'sparse'],
    },
    unknown: {
        energyRange: [0.0, 1.0],
        typicalDuration: [4, 120],
        characteristics: [],
    },
};
/**
 * Transiciones típicas entre secciones
 * Sección actual → Posibles siguientes secciones con probabilidad
 */
export const SECTION_TRANSITIONS = {
    intro: [
        { to: 'verse', probability: 0.5 },
        { to: 'buildup', probability: 0.3 },
        { to: 'drop', probability: 0.2 },
    ],
    verse: [
        { to: 'pre_chorus', probability: 0.4 },
        { to: 'chorus', probability: 0.3 },
        { to: 'buildup', probability: 0.2 },
        { to: 'bridge', probability: 0.1 },
    ],
    pre_chorus: [
        { to: 'chorus', probability: 0.7 },
        { to: 'buildup', probability: 0.2 },
        { to: 'drop', probability: 0.1 },
    ],
    chorus: [
        { to: 'verse', probability: 0.3 },
        { to: 'breakdown', probability: 0.25 },
        { to: 'bridge', probability: 0.2 },
        { to: 'buildup', probability: 0.15 },
        { to: 'outro', probability: 0.1 },
    ],
    bridge: [
        { to: 'chorus', probability: 0.5 },
        { to: 'buildup', probability: 0.3 },
        { to: 'breakdown', probability: 0.2 },
    ],
    buildup: [
        { to: 'drop', probability: 0.8 },
        { to: 'chorus', probability: 0.15 },
        { to: 'breakdown', probability: 0.05 },
    ],
    drop: [
        { to: 'breakdown', probability: 0.4 },
        { to: 'buildup', probability: 0.3 },
        { to: 'verse', probability: 0.15 },
        { to: 'outro', probability: 0.15 },
    ],
    textural_drop: [
        { to: 'breakdown', probability: 0.35 },
        { to: 'buildup', probability: 0.3 },
        { to: 'verse', probability: 0.2 },
        { to: 'outro', probability: 0.15 },
    ],
    breakdown: [
        { to: 'buildup', probability: 0.5 },
        { to: 'verse', probability: 0.25 },
        { to: 'drop', probability: 0.15 },
        { to: 'outro', probability: 0.1 },
    ],
    outro: [
        { to: 'unknown', probability: 1.0 }, // Fin de canción
    ],
    unknown: [
        { to: 'intro', probability: 0.5 },
        { to: 'verse', probability: 0.3 },
        { to: 'drop', probability: 0.2 },
    ],
};
const DEFAULT_CONFIG = {
    throttleMs: 500, // REGLA 1: Throttled
    energyHistorySize: 20, // ~10 segundos de historial
    energyChangeThreshold: 0.25, // Cambio del 25% = transición
    minSectionDuration: 8000, // WAVE 47.2: Mínimo 8 segundos por sección
    energyBaselineSize: 120, // WAVE 47.2: ~60 segundos de baseline (120 frames a 500ms)
    transitionConfidenceThreshold: 0.65, // WAVE 47.2: Mínimo 65% confianza para transición
    transitionConfirmationFrames: 6, // WAVE 47.2: 6 frames = 3 segundos de confirmación
    // 🌊 WAVE 70: DROP timeout y cooldown para evitar DROPs eternos
    maxDropDuration: 30000, // 30 segundos máximo de DROP (fiesta-latina puede ser 12s)
    dropCooldownTime: 5000, // 5 segundos de cooldown después de DROP
    dropEnergyKillThreshold: 0.6, // Si energía < 0.6, forzar salida de DROP
};
/**
 * Tracker de secciones musicales
 *
 * WAVE 47.2: Refactorizado con:
 * - Energía relativa (percentiles)
 * - Matriz de transición como gate
 * - Histéresis temporal aumentada
 * - Memoria narrativa
 *
 * Detecta intro, verse, buildup, drop, breakdown, chorus, outro
 * y predice la siguiente sección basado en patrones típicos
 */
export class SectionTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        // Estado interno
        this.currentSection = 'unknown';
        this.sectionStartTime = 0;
        this.lastAnalysisTime = 0;
        this.cachedAnalysis = null;
        // Historial de energía para detectar trends
        this.energyHistory = [];
        // WAVE 47.2: Baseline de energía para cálculos relativos
        this.energyBaseline = {
            p25: 0.3, p50: 0.5, p75: 0.7, min: 0, max: 1, sampleCount: 0
        };
        this.allEnergySamples = [];
        // WAVE 47.2: Acumulador de votos persistente (no se resetea cada frame)
        this.sectionVotes = new Map();
        this.pendingTransition = null;
        this.pendingTransitionFrames = 0;
        // WAVE 47.2: Memoria narrativa - historial de secciones
        this.sectionHistory = [];
        // Contadores para estabilizar detección
        this.consecutiveSection = 0;
        // 🌊 WAVE 70: DROP timeout y cooldown
        this.dropStartTime = 0; // Cuando empezó el DROP actual
        this.lastDropEndTime = 0; // Cuando terminó el último DROP
        this.isDropCooldown = false; // Estamos en período de cooldown?
        // 🌊 WAVE 70.5: Nuclear Kill Switch - fuerza salida inmediata de DROP
        this.forceDropExit = false; // Kill switch activado?
        // ═══════════════════════════════════════════════════════════════════════
        // 🩺 OPERATION OPEN HEART: Probe de telemetría (temporal)
        // ═══════════════════════════════════════════════════════════════════════
        this.lastProbeTime = 0;
        this.PROBE_THROTTLE_MS = 500;
        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 WAVE 289: VIBE-AWARE SECTION PROFILES
        // El tracker ya no es ciego al género - cada vibe tiene su física
        // ═══════════════════════════════════════════════════════════════════════
        this.activeVibeId = 'techno';
        this.activeProfile = VIBE_SECTION_PROFILES['techno'];
        // ═══════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 81: ENERGY DELTA MODEL
        // Física de energía pura para detección macroscópica de secciones
        // ═══════════════════════════════════════════════════════════════════════
        this.avgEnergy = 0.5; // Media móvil lenta (~2s inercia)
        this.instantEnergy = 0.5; // Media móvil rápida (~100ms inercia)
        this.timeInLowEnergy = 0; // Tiempo acumulado en energía baja
        this.lastFrameTime = 0; // Timestamp del último frame
        // ═══════════════════════════════════════════════════════════════════════
        // 📈 WAVE 1024: THE NARRATIVE ARC - Sliding Window + Spectral Detection
        // ═══════════════════════════════════════════════════════════════════════
        /** Ventana deslizante de 30 segundos para umbrales LOCALES */
        this.slidingWindow = {
            samples: [],
            timestamps: [],
            localMax: 0.8,
            localMin: 0.2,
            localMedian: 0.5,
        };
        /** Historial espectral para detección de buildup (últimos 10 frames) */
        this.spectralHistory = {
            rolloffHistory: [],
            flatnessHistory: [],
            subBassHistory: [],
        };
        /** Última claridad recibida del God Ear (para Consensus Voting) */
        this.lastClarity = 0.5;
        /** Última síncopa recibida del RhythmAnalyzer (para Consensus Voting) */
        this.lastSyncopation = 0;
        /** Contador de frames con señales de buildup espectral */
        this.buildupSpectralFrames = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ============================================================
    // 🎯 WAVE 289: VIBE PROFILE MANAGEMENT
    // ============================================================
    /**
     * 🎯 WAVE 289: Establecer perfil de sección basado en Vibe
     *
     * Llamado por MusicalContextEngine cuando cambia el vibe.
     * Cada género tiene umbrales diferentes para drops, builds, etc.
     *
     * @param vibeId - ID del vibe activo ('techno', 'latino', 'rock', 'chill', etc.)
     */
    setVibeProfile(vibeId) {
        const normalizedId = vibeId.toLowerCase().replace(/[_\s]/g, '-');
        // Evitar cambio si es el mismo vibe
        if (normalizedId === this.activeVibeId) {
            return;
        }
        const profile = getVibeSectionProfile(normalizedId);
        this.activeVibeId = normalizedId;
        this.activeProfile = profile;
        // Log del cambio
        console.log(`[SectionTracker] 🎯 WAVE 289: Profile changed → ${vibeId}`);
        console.log(`[SectionTracker]    DROP: max=${profile.maxDropDuration}ms, ratio=${profile.dropEnergyRatio}, cooldown=${profile.dropCooldown}ms`);
        console.log(`[SectionTracker]    WEIGHTS: bass=${profile.frequencyWeights.bass}, midBass=${profile.frequencyWeights.midBass}, mid=${profile.frequencyWeights.mid}`);
        // Emitir evento de cambio de perfil
        this.emit('profile-change', {
            vibeId: normalizedId,
            profile,
            timestamp: Date.now(),
        });
    }
    /**
     * 🎯 WAVE 289: Obtener el vibeId activo
     */
    getActiveVibeId() {
        return this.activeVibeId;
    }
    /**
     * 🎯 WAVE 289: Obtener el perfil activo
     */
    getActiveProfile() {
        return this.activeProfile;
    }
    /**
     * 🔮 WAVE 1190: PROJECT CASSANDRA - Spectral Buildup Score
     *
     * Expone el score de buildup espectral para que el PredictionEngine
     * pueda usarlo para mejorar la anticipación de drops.
     *
     * Detecta patrones típicos de buildup en EDM:
     * - Rising Rolloff: El brillo sube (high-pass abriendo)
     * - Rising Flatness: Ruido blanco aumenta (snare roll, white noise sweep)
     * - Falling SubBass: El bajo desaparece (ducking antes del drop)
     *
     * @returns Score 0-1 de "probabilidad de buildup espectral"
     */
    getSpectralBuildupScore() {
        return this.detectSpectralBuildup();
    }
    // ============================================================
    // 📊 MÉTODO PRINCIPAL - TRACK
    // ============================================================
    /**
     * 📈 WAVE 1024: Analizar y trackear sección actual (THE NARRATIVE ARC)
     *
     * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
     * ⚠️ REGLA 2: Siempre retorna confidence
     *
     * 📈 WAVE 1024 NUEVO: Acepta métricas espectrales opcionales del God Ear
     * para detección de buildup con precisión quirúrgica.
     *
     * @param rhythm Análisis rítmico del frame actual
     * @param harmony Análisis armónico (puede ser null si no está disponible)
     * @param audio Métricas de audio del frame actual
     * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
     * @param spectral 📈 WAVE 1024: Métricas espectrales opcionales del God Ear
     */
    track(rhythm, _harmony, // Reserved for future genre-aware section detection
    audio, forceAnalysis = false, spectral) {
        const now = Date.now();
        // THROTTLING: Retornar caché si no ha pasado suficiente tiempo
        if (!forceAnalysis &&
            this.cachedAnalysis &&
            (now - this.lastAnalysisTime) < this.config.throttleMs) {
            return this.cachedAnalysis;
        }
        // === PASO 0: 📈 WAVE 1024: Actualizar ventana deslizante ===
        this.updateSlidingWindow(audio.energy, now);
        // === PASO 0.5: 📈 WAVE 1024: Actualizar métricas espectrales ===
        if (spectral) {
            this.updateSpectralHistory(spectral);
            this.lastClarity = spectral.clarity;
        }
        // === PASO 0.7: 📈 WAVE 1024: Guardar síncopa para Consensus Voting ===
        this.lastSyncopation = rhythm.groove?.syncopation ?? 0;
        // === PASO 1: Actualizar historial de energía ===
        this.updateEnergyHistory(audio, now);
        // === PASO 2: Calcular intensidad actual ===
        const intensity = this.calculateIntensity(audio, rhythm);
        // === PASO 3: Detectar trend de energía ===
        const trend = this.detectEnergyTrend();
        // === PASO 4: 📈 WAVE 1024: Detectar sección con métricas espectrales ===
        const detectedSection = this.detectSection(intensity, trend, rhythm, audio, spectral);
        // === PASO 5: Verificar cambio de sección ===
        this.handleSectionChange(detectedSection, now);
        // === PASO 6: Predecir siguiente sección ===
        const prediction = this.predictNextSection(trend, rhythm);
        // === PASO 7: Calcular confianza ===
        const confidence = this.calculateConfidence(rhythm);
        // === PASO 8: Construir resultado ===
        const analysis = {
            current: {
                type: this.currentSection,
                confidence: this.calculateSectionConfidence(),
                startedAt: this.sectionStartTime,
                duration: now - this.sectionStartTime,
            },
            predicted: prediction,
            intensity,
            intensityTrend: trend,
            confidence,
            timestamp: now,
        };
        // Actualizar cache y tiempo
        this.cachedAnalysis = analysis;
        this.lastAnalysisTime = now;
        // Emitir evento
        this.emit('section', analysis);
        return analysis;
    }
    // ============================================================
    // 🔋 CÁLCULO DE ENERGÍA E INTENSIDAD
    // ============================================================
    // ═══════════════════════════════════════════════════════════════════════════
    // 📈 WAVE 1024: THE NARRATIVE ARC - Sliding Window Methods
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 📈 WAVE 1024: Actualizar ventana deslizante de 30 segundos
     *
     * Esta ventana permite calcular máximos y mínimos LOCALES
     * en lugar de usar umbrales fijos globales.
     *
     * Resultado: Una canción antigua masterizada baja (max 0.6)
     * ahora SÍ puede disparar el DROP porque comparamos contra
     * su propio localMax, no contra 0.8 hardcoded.
     */
    updateSlidingWindow(energy, timestamp) {
        const WINDOW_DURATION_MS = 30000; // 30 segundos
        // Añadir nueva muestra
        this.slidingWindow.samples.push(energy);
        this.slidingWindow.timestamps.push(timestamp);
        // Eliminar muestras fuera de la ventana de 30s
        while (this.slidingWindow.timestamps.length > 0 &&
            this.slidingWindow.timestamps[0] < timestamp - WINDOW_DURATION_MS) {
            this.slidingWindow.samples.shift();
            this.slidingWindow.timestamps.shift();
        }
        // Recalcular min/max/median solo si tenemos suficientes muestras
        if (this.slidingWindow.samples.length >= 10) {
            const sorted = [...this.slidingWindow.samples].sort((a, b) => a - b);
            const len = sorted.length;
            this.slidingWindow.localMin = sorted[0];
            this.slidingWindow.localMax = sorted[len - 1];
            this.slidingWindow.localMedian = sorted[Math.floor(len / 2)];
        }
    }
    /**
     * 🎻 WAVE 1024: Actualizar historial de métricas espectrales
     *
     * Guarda las últimas 10 muestras de rolloff, flatness y subBass
     * para detectar TENDENCIAS (rising/falling) necesarias para buildup.
     */
    updateSpectralHistory(spectral) {
        const MAX_HISTORY = 10; // ~5 segundos @ 500ms throttle
        this.spectralHistory.rolloffHistory.push(spectral.rolloff);
        this.spectralHistory.flatnessHistory.push(spectral.flatness);
        this.spectralHistory.subBassHistory.push(spectral.subBass);
        // Mantener tamaño del buffer
        while (this.spectralHistory.rolloffHistory.length > MAX_HISTORY) {
            this.spectralHistory.rolloffHistory.shift();
        }
        while (this.spectralHistory.flatnessHistory.length > MAX_HISTORY) {
            this.spectralHistory.flatnessHistory.shift();
        }
        while (this.spectralHistory.subBassHistory.length > MAX_HISTORY) {
            this.spectralHistory.subBassHistory.shift();
        }
    }
    /**
     * 🎻 WAVE 1024: Detectar buildup usando métricas espectrales
     *
     * Señales de buildup típicas:
     * - Rising Rolloff: El brillo sube progresivamente (filtro abriendo)
     * - Rising Flatness: Ruido blanco aumenta (snare roll, white noise sweep)
     * - Falling SubBass: El bajo desaparece (ducking antes del drop)
     *
     * @returns Score 0-1 de "probabilidad de buildup espectral"
     */
    detectSpectralBuildup() {
        const history = this.spectralHistory;
        // Necesitamos al menos 5 muestras para detectar tendencia
        if (history.rolloffHistory.length < 5) {
            return 0;
        }
        const len = history.rolloffHistory.length;
        const halfLen = Math.floor(len / 2);
        // Calcular promedios de primera y segunda mitad
        const avgRolloffFirst = history.rolloffHistory.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
        const avgRolloffSecond = history.rolloffHistory.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen);
        const avgFlatnessFirst = history.flatnessHistory.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
        const avgFlatnessSecond = history.flatnessHistory.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen);
        const avgSubBassFirst = history.subBassHistory.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
        const avgSubBassSecond = history.subBassHistory.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen);
        let buildupScore = 0;
        // ⬆️ Rising Rolloff (brillo sube) - peso 0.35
        const rolloffRising = avgRolloffSecond > avgRolloffFirst * 1.1; // >10% incremento
        if (rolloffRising) {
            const rolloffDelta = (avgRolloffSecond - avgRolloffFirst) / (avgRolloffFirst + 0.01);
            buildupScore += Math.min(0.35, rolloffDelta * 0.5);
        }
        // ⬆️ Rising Flatness (ruido sube) - peso 0.35
        const flatnessRising = avgFlatnessSecond > avgFlatnessFirst + 0.05; // >5% incremento absoluto
        if (flatnessRising) {
            const flatnessDelta = avgFlatnessSecond - avgFlatnessFirst;
            buildupScore += Math.min(0.35, flatnessDelta * 3.5);
        }
        // ⬇️ Falling SubBass (bajo cae) - peso 0.30
        const subBassFalling = avgSubBassSecond < avgSubBassFirst * 0.85; // >15% caída
        if (subBassFalling) {
            const subBassDelta = (avgSubBassFirst - avgSubBassSecond) / (avgSubBassFirst + 0.01);
            buildupScore += Math.min(0.30, subBassDelta * 0.5);
        }
        return Math.min(1, buildupScore);
    }
    /**
     * 🗳️ WAVE 1024: Calcular voto de consenso multi-motor
     *
     * Si múltiples fuentes de verdad están de acuerdo, el voto es más fuerte.
     *
     * @param intensity Intensidad actual (0-1)
     * @param syncopation Síncopa del RhythmAnalyzer (0-1)
     * @param clarity Claridad del God Ear (0-1)
     * @returns { section: SectionType, weight: number } o null si no hay consenso
     */
    calculateConsensusVote(intensity, syncopation, clarity) {
        // Consenso para CHORUS/DROP: Alta energía + Alta síncopa + Alta claridad
        if (intensity > 0.7 && syncopation > 0.3 && clarity > 0.6) {
            // Voto unánime! Peso 2.5x
            return {
                section: intensity > 0.85 ? 'drop' : 'chorus',
                weight: 2.5,
            };
        }
        // Consenso para BREAKDOWN: Baja energía + Baja síncopa + Alta claridad
        if (intensity < 0.35 && syncopation < 0.2 && clarity > 0.5) {
            return {
                section: 'breakdown',
                weight: 2.0,
            };
        }
        // Consenso para VERSE: Energía media + Síncopa media + Claridad decente
        if (intensity >= 0.35 && intensity <= 0.65 && syncopation < 0.4 && clarity > 0.4) {
            return {
                section: 'verse',
                weight: 1.5,
            };
        }
        // Sin consenso claro
        return null;
    }
    /**
     * 📈 WAVE 1024: Calcular energía relativa usando Sliding Window
     *
     * En lugar de comparar contra umbrales fijos (0.8 para DROP),
     * comparamos contra el máximo LOCAL de los últimos 30 segundos.
     *
     * @param currentEnergy Energía actual (0-1)
     * @returns Energía relativa (0-1+) donde 0.8 = 80% del máximo local
     */
    calculateRelativeEnergy(currentEnergy) {
        const window = this.slidingWindow;
        // Si no tenemos ventana, usar energía absoluta
        if (window.samples.length < 10) {
            return currentEnergy;
        }
        const range = window.localMax - window.localMin;
        // Si el rango es muy pequeño (canción muy plana), usar absoluta
        if (range < 0.1) {
            return currentEnergy;
        }
        // Normalizar: 0 = localMin, 1 = localMax
        const relativeEnergy = (currentEnergy - window.localMin) / range;
        return Math.max(0, Math.min(1.2, relativeEnergy));
    }
    /**
     * 📈 WAVE 1024: Setter para claridad externa (God Ear integration)
     */
    setClarity(clarity) {
        this.lastClarity = Math.max(0, Math.min(1, clarity));
    }
    /**
     * 📈 WAVE 1024: Getter para diagnósticos de Narrative Arc
     */
    getNarrativeArcDiagnostics() {
        return {
            slidingWindow: { ...this.slidingWindow },
            spectralHistory: { ...this.spectralHistory },
            buildupSpectralScore: this.detectSpectralBuildup(),
            relativeEnergy: this.calculateRelativeEnergy(this.instantEnergy),
            lastClarity: this.lastClarity,
            lastSyncopation: this.lastSyncopation,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // FIN WAVE 1024 - Métodos de Sliding Window y Spectral Detection
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Actualizar historial de energía
     * WAVE 47.2: También actualiza baseline para cálculos relativos
     */
    updateEnergyHistory(audio, timestamp) {
        const rawIntensity = (audio.bass * 0.4 + audio.mid * 0.3 + audio.energy * 0.3);
        const frame = {
            energy: audio.energy,
            bass: audio.bass,
            intensity: rawIntensity,
            timestamp,
        };
        this.energyHistory.push(frame);
        // Mantener tamaño del buffer
        while (this.energyHistory.length > this.config.energyHistorySize) {
            this.energyHistory.shift();
        }
        // WAVE 47.2: Actualizar baseline de energía
        this.updateEnergyBaseline(rawIntensity);
    }
    /**
     * WAVE 47.2: Actualizar baseline de energía (percentiles)
     * Mantiene un buffer grande para calcular percentiles estables
     */
    updateEnergyBaseline(intensity) {
        this.allEnergySamples.push(intensity);
        // Limitar tamaño del buffer
        while (this.allEnergySamples.length > this.config.energyBaselineSize) {
            this.allEnergySamples.shift();
        }
        // Recalcular percentiles cada 10 muestras para eficiencia
        if (this.allEnergySamples.length % 10 === 0 && this.allEnergySamples.length >= 20) {
            const sorted = [...this.allEnergySamples].sort((a, b) => a - b);
            const len = sorted.length;
            this.energyBaseline = {
                p25: sorted[Math.floor(len * 0.25)],
                p50: sorted[Math.floor(len * 0.50)],
                p75: sorted[Math.floor(len * 0.75)],
                min: sorted[0],
                max: sorted[len - 1],
                sampleCount: len,
            };
        }
    }
    /**
     * Calcular intensidad actual (0-1)
     *
     * WAVE 47.2: Ahora usa energía RELATIVA basada en percentiles
     * En lugar de umbrales absolutos, compara con el baseline de la canción
     *
     * Combina:
     * - Energía del audio (40%)
     * - Bass (30%)
     * - Actividad de drums (30%)
     */
    calculateIntensity(audio, rhythm) {
        // Calcular intensidad raw
        const audioIntensity = audio.energy;
        const bassIntensity = audio.bass;
        const drumActivity = ((rhythm.drums.kickDetected ? rhythm.drums.kickIntensity : 0) * 0.4 +
            (rhythm.drums.snareDetected ? rhythm.drums.snareIntensity : 0) * 0.3 +
            (rhythm.drums.hihatDetected ? rhythm.drums.hihatIntensity : 0) * 0.3);
        const rawIntensity = audioIntensity * 0.4 + bassIntensity * 0.3 + drumActivity * 0.3;
        // WAVE 47.2: Convertir a intensidad RELATIVA usando baseline
        // Si no hay suficientes muestras, usar valor raw normalizado
        if (this.energyBaseline.sampleCount < 20) {
            return Math.min(1, rawIntensity);
        }
        // Normalizar: 0 = P25 (baja), 0.5 = P50 (media), 1 = P75+ (alta)
        const range = this.energyBaseline.p75 - this.energyBaseline.p25;
        if (range < 0.05) {
            // Rango muy pequeño = canción muy plana, usar raw
            return Math.min(1, rawIntensity);
        }
        const relativeIntensity = (rawIntensity - this.energyBaseline.p25) / range;
        // Clamp entre 0 y 1, pero permitir valores > 1 para picos extremos
        return Math.max(0, Math.min(1.2, relativeIntensity));
    }
    /**
     * Detectar tendencia de energía
     *
     * Analiza el historial para determinar si la energía está:
     * - rising: Subiendo (típico de buildup)
     * - falling: Bajando (típico de breakdown/outro)
     * - stable: Estable
     */
    detectEnergyTrend() {
        if (this.energyHistory.length < 4) {
            return 'stable';
        }
        // Dividir historial en dos mitades
        const midPoint = Math.floor(this.energyHistory.length / 2);
        const firstHalf = this.energyHistory.slice(0, midPoint);
        const secondHalf = this.energyHistory.slice(midPoint);
        // Calcular promedio de cada mitad
        const avgFirst = firstHalf.reduce((sum, f) => sum + f.intensity, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, f) => sum + f.intensity, 0) / secondHalf.length;
        const change = avgSecond - avgFirst;
        const threshold = this.config.energyChangeThreshold / 4; // Más sensible para trend
        if (change > threshold) {
            return 'rising';
        }
        else if (change < -threshold) {
            return 'falling';
        }
        return 'stable';
    }
    // ============================================================
    // 🎯 DETECCIÓN DE SECCIÓN
    // ============================================================
    /**
     * Detectar tipo de sección actual
     *
     * WAVE 47.2: Refactorizado con:
     * - Intensidad RELATIVA (comparada con baseline de la canción)
     * - Votos ACUMULATIVOS (no se resetean, solo decaen)
     * - Validación de transición con matriz
     *
     * 🎯 WAVE 289: VIBE-AWARE
     * - Usa activeProfile en lugar de constantes mágicas
     * - frequencyWeights determinan qué frecuencias importan
     * - Cada género tiene sus propios umbrales de drop/buildup/breakdown
     *
     * Algoritmo:
     * 1. 🎯 WAVE 289: Calcular energía ponderada por género
     * 2. 🔥 WAVE 81: Energy Delta Model (prioridad)
     * 3. Decay de votos existentes (memoria temporal)
     * 4. Votar por sección más probable
     * 5. Validar transición con matriz (o transitionOverrides)
     *
     * 📈 WAVE 1024: THE NARRATIVE ARC - Mejoras:
     * 6. Usar energía RELATIVA (Sliding Window) en lugar de absoluta
     * 7. Detectar buildup con métricas espectrales (Rolloff, Flatness, SubBass)
     * 8. Aplicar Consensus Voting cuando múltiples fuentes están de acuerdo
     */
    detectSection(intensity, trend, rhythm, audio, spectral) {
        const now = Date.now();
        const profile = this.activeProfile; // 🎯 WAVE 289: Usar perfil activo
        // ═══════════════════════════════════════════════════════════════════════
        // 📈 WAVE 1024: ENERGÍA RELATIVA (Sliding Window)
        // En lugar de comparar contra umbrales fijos, comparamos contra
        // el máximo/mínimo LOCAL de los últimos 30 segundos.
        // ═══════════════════════════════════════════════════════════════════════
        const relativeEnergy = this.calculateRelativeEnergy(audio.energy);
        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 WAVE 289: ENERGÍA PONDERADA POR GÉNERO
        // Cada género tiene diferentes frecuencias dominantes:
        // - Techno: Bass es rey (kick 4x4)
        // - Latino: Mid-Bass manda (dembow, tumbao)
        // - Rock: Mid domina (guitarras)
        // ═══════════════════════════════════════════════════════════════════════
        const weightedEnergy = calculateWeightedEnergy(profile, audio);
        const e = weightedEnergy; // Usar energía ponderada en lugar de audio.energy
        // ═══════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 81: ENERGY DELTA MODEL (FÍSICA PURA)
        // Este modelo tiene PRIORIDAD sobre el sistema de votos.
        // Si detecta un cambio macroscópico, retorna inmediatamente.
        // ═══════════════════════════════════════════════════════════════════════
        // 1. CÁLCULO DE ENERGÍA (Física Simple)
        // avgEnergy = Baseline lento (~2 seg inercia)
        // instantEnergy = Pico instantáneo (~100ms inercia)
        this.avgEnergy = this.avgEnergy * 0.98 + e * 0.02;
        this.instantEnergy = this.instantEnergy * 0.8 + e * 0.2;
        const delta = this.instantEnergy - this.avgEnergy;
        const ratio = this.instantEnergy / (this.avgEnergy + 0.01);
        // 🎯 WAVE 289: Umbrales dinámicos DESDE EL PERFIL DEL GÉNERO
        // Ya no usamos constantes mágicas hardcodeadas
        const dropRatio = profile.dropEnergyRatio;
        const dropAbsThreshold = profile.dropAbsoluteThreshold;
        const dropCooldownMs = profile.dropCooldown;
        // 🌴 WAVE 84: HIGH-ENERGY PHYSICS (Loudness War Tracks)
        // ═══════════════════════════════════════════════════════════════════════
        // Problema: Tracks "comprimidos" (reggaetón, EDM mastered hot) tienen avgEnergy > 0.7
        // permanente, haciendo imposible que ratio se cumpla.
        // Solución: Umbrales dinámicos adaptados al nivel de compresión.
        // 🎯 WAVE 289: Los valores base ahora vienen del perfil del género
        // ═══════════════════════════════════════════════════════════════════════
        const isHighEnergyTrack = this.avgEnergy > 0.7;
        // 🎯 WAVE 289: Umbrales adaptativos basados en perfil de género
        const adjustedDropRatio = isHighEnergyTrack ? dropRatio * 0.85 : dropRatio;
        const adjustedDropAbsThreshold = isHighEnergyTrack
            ? Math.min(0.95, dropAbsThreshold + 0.10)
            : dropAbsThreshold;
        // ═══════════════════════════════════════════════════════════════════════
        // 📈 WAVE 1024: DETECCIÓN DE BUILDUP ESPECTRAL
        // Usa métricas del God Ear FFT para detectar buildups con precisión
        // ═══════════════════════════════════════════════════════════════════════
        const spectralBuildupScore = this.detectSpectralBuildup();
        if (spectralBuildupScore > 0.5 && this.currentSection !== 'drop') {
            this.buildupSpectralFrames++;
            // Si tenemos 3+ frames con señales de buildup espectral, votar fuertemente
            if (this.buildupSpectralFrames >= 3) {
                this.addVote('buildup', 1.5 + spectralBuildupScore);
            }
        }
        else {
            this.buildupSpectralFrames = Math.max(0, this.buildupSpectralFrames - 1);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🗳️ WAVE 1024: CONSENSUS VOTING
        // Si múltiples fuentes de verdad están de acuerdo, voto más fuerte
        // ═══════════════════════════════════════════════════════════════════════
        const consensusVote = this.calculateConsensusVote(intensity, this.lastSyncopation, this.lastClarity);
        if (consensusVote) {
            this.addVote(consensusVote.section, consensusVote.weight);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 📈 WAVE 1024: DROP DETECTION CON ENERGÍA RELATIVA
        // Ahora usamos relativeEnergy además del ratio absoluto
        // Un DROP es cuando: relativeEnergy > 0.8 (80% del máximo local)
        // ═══════════════════════════════════════════════════════════════════════
        const passesRelativeDrop = relativeEnergy > 0.8;
        // ═══════════════════════════════════════════════════════════════════════
        // 🩺 OPERATION OPEN HEART: TELEMETRY PROBE
        // 🗑️ WAVE 289.5: PROBE DESACTIVADO - Diagnóstico completado
        // Dejar código comentado para referencia futura
        // ═══════════════════════════════════════════════════════════════════════
        /*
        if (now - this.lastProbeTime >= this.PROBE_THROTTLE_MS) {
          this.lastProbeTime = now;
          
          const votesSummary: string[] = [];
          for (const [section, votes] of this.sectionVotes) {
            if (votes > 0.1) {
              votesSummary.push(`${section.charAt(0).toUpperCase() + section.slice(1)}(${votes.toFixed(1)})`);
            }
          }
          const votesStr = votesSummary.length > 0 ? votesSummary.join(' ') : 'none';
          
          const passesRatio = ratio > adjustedDropRatio;
          const passesAbsThreshold = this.instantEnergy > adjustedDropAbsThreshold;
          const wouldTriggerDrop = passesRatio && passesAbsThreshold;
          const resultEmoji = wouldTriggerDrop ? '🔥 DROP TRIGGER' : (this.currentSection === 'drop' ? '⚡ IN DROP' : '✅ OK');
          
          console.log(
            `[TRACKER-PROBE] 🌊 Vibe:${this.activeVibeId.toUpperCase()} | ` +
            `E(W): ${weightedEnergy.toFixed(2)} | ` +
            `Avg: ${this.avgEnergy.toFixed(2)} | ` +
            `Inst: ${this.instantEnergy.toFixed(2)} | ` +
            `Ratio: ${ratio.toFixed(2)}/${adjustedDropRatio.toFixed(2)} | ` +
            `AbsThr: ${adjustedDropAbsThreshold.toFixed(2)} | ` +
            `Votes: [${votesStr}] | ` +
            `Section: ${this.currentSection.toUpperCase()} | ` +
            resultEmoji
          );
        }
        */
        // ═══════════════════════════════════════════════════════════════════════
        // 2. REGLAS DE DETECCIÓN MACROSCÓPICA (PRIORIDAD ALTA)
        // 🎯 WAVE 289: Cooldown específico del género (no hardcoded 10s)
        const timeSinceLastDrop = now - this.lastDropEndTime;
        // 🚀 DETECCIÓN DE DROP (La Subida Explosiva)
        // 🎯 WAVE 289: Usar umbrales del perfil del género
        // 📈 WAVE 1024: TAMBIÉN usar energía relativa (Sliding Window)
        // Un DROP puede ser detectado por:
        // A) ratio > adjustedDropRatio && instantEnergy > adjustedDropAbsThreshold (método original)
        // B) relativeEnergy > 0.8 (80% del máximo local - método nuevo para canciones masterizadas bajo)
        const passesOriginalDrop = ratio > adjustedDropRatio && this.instantEnergy > adjustedDropAbsThreshold;
        const passesRelativeDropCheck = passesRelativeDrop && this.slidingWindow.samples.length >= 20;
        if (passesOriginalDrop || passesRelativeDropCheck) {
            if (this.currentSection !== 'drop') {
                // 🛡️ Si estamos en cooldown específico del género, redirigir a CHORUS
                if (timeSinceLastDrop < dropCooldownMs) {
                    // Energía de Drop pero en cooldown → marcar como CHORUS (energía alta estable)
                    this.addVote('chorus', 1.5);
                }
                else if (!this.isDropCooldown && !this.forceDropExit) {
                    // 🔥 Transición real a DROP (fuera de cooldown)
                    this.timeInLowEnergy = 0;
                    this.lastFrameTime = now;
                    // 📈 WAVE 1024: Votar más fuerte si ambos métodos coinciden
                    const dropWeight = (passesOriginalDrop && passesRelativeDropCheck) ? 3.0 : 2.5;
                    this.addVote('drop', dropWeight);
                }
            }
        }
        // 🛡️ DETECCIÓN DE BREAKDOWN (El Silencio)
        // 🎯 WAVE 289: Usar umbral del perfil del género
        // 📈 WAVE 1024: TAMBIÉN usar energía relativa (por debajo del 25% del máximo local)
        const relativeBreakdown = relativeEnergy < 0.25;
        const passesBreakdownCheck = (this.avgEnergy < profile.breakdownEnergyThreshold &&
            this.instantEnergy < profile.breakdownEnergyThreshold * 0.75) || relativeBreakdown;
        if (passesBreakdownCheck && !passesOriginalDrop && !passesRelativeDropCheck) {
            const frameTime = this.lastFrameTime > 0 ? now - this.lastFrameTime : 16;
            this.timeInLowEnergy += frameTime;
            // 🎯 WAVE 289: Histéresis del perfil
            if (this.timeInLowEnergy > profile.minBreakdownDuration) {
                // 📈 WAVE 1024: Votar más fuerte si relativeBreakdown también
                const breakdownWeight = relativeBreakdown ? 1.8 : 1.5;
                this.addVote('breakdown', breakdownWeight);
            }
        }
        else if (!passesOriginalDrop && !passesRelativeDropCheck) {
            this.timeInLowEnergy = 0;
        }
        // 📈 DETECCIÓN DE BUILDUP (La Escalada)
        // 🎯 WAVE 289: Usar delta threshold del perfil
        // 🎬 WAVE 1024: TAMBIÉN usar detección espectral (rolloff ↑, flatness ↑, subBass ↓)
        const energyBasedBuildup = this.avgEnergy > 0.4 && delta > profile.buildupDeltaThreshold;
        const spectralBuildup = spectralBuildupScore > 0.6; // Tendencias espectrales de buildup
        if ((energyBasedBuildup || spectralBuildup) && this.currentSection !== 'drop') {
            // 📈 WAVE 1024: El peso depende de cuántas señales coinciden
            let buildupWeight = 0.8;
            if (energyBasedBuildup && spectralBuildup) {
                buildupWeight = 1.5; // Ambas señales = certeza alta
            }
            else if (spectralBuildup) {
                buildupWeight = 1.2; // Solo espectral = muy fiable (detecta antes que energía)
            }
            this.addVote('buildup', buildupWeight);
        }
        // 🎵 ALTA ENERGÍA SOSTENIDA = CHORUS (no DROP)
        // 📈 WAVE 1024: También usar consenso si está disponible
        const stableHighEnergy = this.avgEnergy > 0.6 && delta < 0.03 && delta > -0.03;
        const consensusChorusVote = consensusVote?.section === 'chorus';
        if ((stableHighEnergy || consensusChorusVote) && this.currentSection !== 'drop') {
            const chorusWeight = (stableHighEnergy && consensusChorusVote) ? 1.0 : 0.6;
            this.addVote('chorus', chorusWeight);
        }
        // Actualizar timestamp
        this.lastFrameTime = now;
        // ═══════════════════════════════════════════════════════════════════════
        // FIN WAVE 81/289/1024 - Continúa con sistema de votos legacy
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 47.2: Decay de votos (memoria temporal, no reset total)
        const DECAY_FACTOR = 0.85;
        for (const [section, votes] of this.sectionVotes) {
            const decayed = votes * DECAY_FACTOR;
            if (decayed < 0.1) {
                this.sectionVotes.delete(section);
            }
            else {
                this.sectionVotes.set(section, decayed);
            }
        }
        // === REGLAS DE DETECCIÓN CON INTENSIDAD RELATIVA ===
        // intensity > 0.8 = por encima del P75 (energía alta para ESTA canción)
        // intensity < 0.3 = por debajo del P25 (energía baja para ESTA canción)
        // Calcular bass relativo también
        const bassRange = this.energyBaseline.p75 - this.energyBaseline.p25;
        const relativeBass = bassRange > 0.05
            ? (audio.bass - this.energyBaseline.p25) / bassRange
            : audio.bass;
        // 🌊 WAVE 70: DROP timeout y cooldown
        // (now ya está declarado arriba en Energy Delta Model)
        // 🎯 WAVE 289: Usar cooldown del perfil del género
        // Verificar si estamos en cooldown después de un DROP
        if (this.isDropCooldown) {
            const cooldownElapsed = now - this.lastDropEndTime;
            if (cooldownElapsed >= profile.dropCooldown) {
                this.isDropCooldown = false;
                this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag al terminar cooldown
                // console.log('[SectionTracker] 🌊 DROP cooldown terminado');
            }
        }
        // 🌊 WAVE 70.5: NUCLEAR KILL SWITCH - Forzar salida INMEDIATA de DROP si:
        // 1. Duración excede maxDropDuration (del perfil del género)
        // 2. Energía cae por debajo del umbral (del perfil del género)
        // 🎯 WAVE 289: Usar valores del perfil
        if (this.currentSection === 'drop') {
            const dropDuration = now - this.dropStartTime;
            const shouldKillDrop = dropDuration >= profile.maxDropDuration ||
                intensity < profile.dropEnergyKillThreshold;
            if (shouldKillDrop) {
                // 🌊 WAVE 70.5: NUCLEAR - Activar flag inmediatamente
                this.forceDropExit = true;
                this.lastDropEndTime = now;
                this.isDropCooldown = true;
                // 🌊 WAVE 70.5: LIMPIAR VOTOS DE DROP INMEDIATAMENTE
                // Evita que el sistema de votación lo reactive al siguiente frame
                this.sectionVotes.set('drop', 0);
                // Votar fuertemente por chorus/breakdown para forzar transición
                this.addVote('chorus', 3.0); // 🌊 WAVE 70.5: Aumentado de 2.0 a 3.0
                this.addVote('breakdown', 2.0); // 🌊 WAVE 70.5: Aumentado de 1.0 a 2.0
                // console.log(`[SectionTracker] � VIBE-AWARE DROP KILL: vibe=${this.activeVibeId}, duration=${dropDuration}ms, max=${profile.maxDropDuration}ms`);
            }
        }
        // 🔥 DROP: Intensidad muy por encima de la media + bass pesado + kick
        // 🌊 WAVE 70.5: BLOQUEADO si estamos en cooldown O si nuclear kill está activo
        if (!this.isDropCooldown && !this.forceDropExit) {
            if (intensity > 0.85 && relativeBass > 0.7 && rhythm.drums.kickDetected) {
                this.addVote('drop', 1.0);
            }
            else if (intensity > 0.75 && rhythm.drums.kickDetected && rhythm.drums.kickIntensity > 0.6) {
                this.addVote('drop', 0.6);
            }
        }
        // 📈 BUILDUP: Energía subiendo + zona media-alta
        if (trend === 'rising') {
            if (intensity > 0.4 && intensity < 0.85) {
                this.addVote('buildup', 0.8);
            }
            // Bonus si hay fill de batería
            if (rhythm.fillInProgress) {
                this.addVote('buildup', 0.4);
            }
        }
        // 📉 BREAKDOWN: Por debajo de la media + trend descendente
        if (intensity < 0.4 && trend === 'falling') {
            this.addVote('breakdown', 0.7);
        }
        else if (intensity < 0.3 && !rhythm.drums.kickDetected) {
            // Muy baja energía sin kick = definitivamente breakdown
            this.addVote('breakdown', 0.5);
        }
        // 🎤 VERSE: Zona media + estable
        if (intensity >= 0.35 && intensity <= 0.65 && trend === 'stable') {
            this.addVote('verse', 0.5);
        }
        // 🎵 CHORUS: Zona alta + estable (post-buildup)
        if (intensity > 0.65 && intensity < 0.85 && trend === 'stable') {
            this.addVote('chorus', 0.6);
        }
        // 🎬 INTRO: Baja energía al principio
        if (intensity < 0.35 && this.currentSection === 'unknown') {
            this.addVote('intro', 0.8);
        }
        else if (intensity < 0.4 && this.sectionHistory.length === 0) {
            this.addVote('intro', 0.5);
        }
        // 👋 OUTRO: Baja energía + falling + contexto narrativo
        if (intensity < 0.35 && trend === 'falling') {
            const wasHighEnergy = this.currentSection === 'drop' || this.currentSection === 'chorus';
            if (wasHighEnergy) {
                this.addVote('outro', 0.5);
            }
        }
        // WAVE 47.2: Bonus por consistencia con sección actual
        if (this.consecutiveSection > 3) {
            this.addVote(this.currentSection, 0.3);
        }
        // Obtener candidato con más votos
        const candidate = this.getMostVotedSection();
        // WAVE 47.2: Validar transición con matriz
        return this.validateTransition(candidate);
    }
    /**
     * WAVE 47.2: Validar que la transición sea lógica usando la matriz
     * Solo permite transiciones definidas en SECTION_TRANSITIONS
     *
     * 🎯 WAVE 289: Los transitionOverrides del perfil tienen PRIORIDAD
     * Esto permite que Latino haga verse→drop (prohibido en Techno)
     */
    validateTransition(candidate) {
        // Si es la misma sección, siempre válido
        if (candidate === this.currentSection) {
            return candidate;
        }
        const profile = this.activeProfile;
        // 🎯 WAVE 289: Verificar primero si hay override en el perfil del género
        if (profile.transitionOverrides?.[this.currentSection]) {
            const allowedByProfile = profile.transitionOverrides[this.currentSection];
            if (allowedByProfile.includes(candidate)) {
                // El perfil del género permite esta transición (ej: Latino verse→drop)
                return candidate;
            }
            // El perfil define explícitamente las transiciones permitidas
            // Si el candidato no está en la lista, está BLOQUEADO
            // console.log(`[SectionTracker] 🎯 WAVE 289: Blocked by profile ${this.activeVibeId}: ${this.currentSection} → ${candidate}`);
            return this.currentSection;
        }
        // Sin override específico, usar matriz global
        const validTransitions = SECTION_TRANSITIONS[this.currentSection] || [];
        const isValidTransition = validTransitions.some(t => t.to === candidate);
        // Si la transición es válida, aceptarla
        if (isValidTransition) {
            return candidate;
        }
        // WAVE 47.2: Transición inválida - mantener sección actual
        // console.log(`[SectionTracker] Blocked invalid transition: ${this.currentSection} → ${candidate}`);
        return this.currentSection;
    }
    /**
     * Añadir voto para una sección
     * WAVE 47.2: Ahora es acumulativo
     */
    addVote(section, weight) {
        const current = this.sectionVotes.get(section) || 0;
        this.sectionVotes.set(section, current + weight);
    }
    /**
     * Obtener sección con más votos
     * WAVE 47.2: Requiere umbral mínimo de confianza para cambiar
     */
    getMostVotedSection() {
        let maxVotes = 0;
        let winner = this.currentSection; // Default: mantener actual
        for (const [section, votes] of this.sectionVotes) {
            if (votes > maxVotes) {
                maxVotes = votes;
                winner = section;
            }
        }
        // WAVE 47.2: Calcular confianza del ganador
        const totalVotes = Array.from(this.sectionVotes.values()).reduce((a, b) => a + b, 0);
        const winnerConfidence = totalVotes > 0 ? maxVotes / totalVotes : 0;
        // Si el ganador no tiene suficiente confianza, mantener sección actual
        if (winnerConfidence < this.config.transitionConfidenceThreshold) {
            return this.currentSection;
        }
        return winner;
    }
    /**
     * Manejar cambio de sección
     *
     * WAVE 47.2: Sistema de confirmación de frames
     * - No cambia inmediatamente cuando se detecta nueva sección
     * - Requiere N frames consecutivos confirmando la misma sección
     * - Previene flickeo en transiciones ambiguas
     */
    handleSectionChange(detected, now) {
        // Verificar si es diferente a la actual
        if (detected !== this.currentSection) {
            // WAVE 47.2: Sistema de confirmación de transición pendiente
            if (this.pendingTransition === detected) {
                // Misma sección pendiente - incrementar contador
                this.pendingTransitionFrames++;
                // Verificar si tenemos suficientes frames de confirmación
                if (this.pendingTransitionFrames >= this.config.transitionConfirmationFrames) {
                    // Verificar duración mínima de sección actual
                    const duration = now - this.sectionStartTime;
                    if (duration >= this.config.minSectionDuration || this.currentSection === 'unknown') {
                        // WAVE 47.2: Guardar en historial narrativo antes de cambiar
                        this.addToSectionHistory(now);
                        const oldSection = this.currentSection;
                        this.currentSection = detected;
                        this.sectionStartTime = now;
                        this.consecutiveSection = 1;
                        // 🌊 WAVE 70: Registrar tiempos de DROP
                        if (detected === 'drop') {
                            this.dropStartTime = now;
                            // console.log('[SectionTracker] 🌊 DROP iniciado');
                        }
                        if (oldSection === 'drop' && detected !== 'drop') {
                            this.lastDropEndTime = now;
                            this.isDropCooldown = true;
                            this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag al salir del DROP
                            // console.log('[SectionTracker] 🌊 DROP terminado, entrando en cooldown');
                        }
                        // Reset pendiente
                        this.pendingTransition = null;
                        this.pendingTransitionFrames = 0;
                        // Emitir evento de cambio
                        this.emit('section-change', {
                            from: oldSection,
                            to: detected,
                            timestamp: now,
                        });
                    }
                }
            }
            else {
                // Nueva sección diferente - resetear contador
                this.pendingTransition = detected;
                this.pendingTransitionFrames = 1;
            }
        }
        else {
            // Sección igual a la actual - resetear pendiente
            this.pendingTransition = null;
            this.pendingTransitionFrames = 0;
            this.consecutiveSection++;
        }
    }
    /**
     * WAVE 47.2: Añadir sección actual al historial narrativo
     */
    addToSectionHistory(now) {
        const duration = now - this.sectionStartTime;
        // Calcular intensidad promedio durante esta sección
        const recentEnergy = this.energyHistory.slice(-10);
        const avgIntensity = recentEnergy.length > 0
            ? recentEnergy.reduce((sum, f) => sum + f.intensity, 0) / recentEnergy.length
            : 0.5;
        this.sectionHistory.push({
            section: this.currentSection,
            timestamp: this.sectionStartTime,
            duration,
            avgIntensity,
        });
        // Mantener solo las últimas 20 secciones
        while (this.sectionHistory.length > 20) {
            this.sectionHistory.shift();
        }
    }
    // ============================================================
    // 🔮 PREDICCIÓN DE SIGUIENTE SECCIÓN
    // ============================================================
    /**
     * Predecir la siguiente sección
     *
     * Basado en:
     * 1. Transiciones típicas desde sección actual
     * 2. Trend de energía actual
     * 3. Señales de transición (fills, etc.)
     */
    predictNextSection(trend, rhythm) {
        const transitions = SECTION_TRANSITIONS[this.currentSection];
        if (!transitions || transitions.length === 0) {
            return null;
        }
        // Ajustar probabilidades basado en trend
        const adjusted = transitions.map(t => {
            let probability = t.probability;
            // Si la energía está subiendo, más probable buildup/drop
            if (trend === 'rising') {
                if (t.to === 'buildup' || t.to === 'drop') {
                    probability *= 1.5;
                }
                if (t.to === 'breakdown' || t.to === 'outro') {
                    probability *= 0.5;
                }
            }
            // Si la energía está bajando, más probable breakdown/outro
            if (trend === 'falling') {
                if (t.to === 'breakdown' || t.to === 'outro') {
                    probability *= 1.5;
                }
                if (t.to === 'buildup' || t.to === 'drop') {
                    probability *= 0.5;
                }
            }
            // Si hay fill, probablemente viene un cambio
            if (rhythm.fillInProgress) {
                if (t.to === 'drop' || t.to === 'chorus') {
                    probability *= 1.3;
                }
            }
            return { ...t, probability: Math.min(1, probability) };
        });
        // Normalizar probabilidades
        const total = adjusted.reduce((sum, t) => sum + t.probability, 0);
        const normalized = adjusted.map(t => ({
            ...t,
            probability: t.probability / total,
        }));
        // Obtener la más probable
        const best = normalized.reduce((a, b) => a.probability > b.probability ? a : b);
        // Estimar tiempo hasta el cambio
        const sectionDuration = Date.now() - this.sectionStartTime;
        const profile = SECTION_PROFILES[this.currentSection];
        const avgDuration = ((profile.typicalDuration[0] + profile.typicalDuration[1]) / 2) * 1000;
        const estimatedIn = Math.max(1000, avgDuration - sectionDuration);
        return {
            type: best.to,
            probability: best.probability,
            estimatedIn,
        };
    }
    // ============================================================
    // 📊 CÁLCULO DE CONFIANZA
    // ============================================================
    /**
     * Calcular confianza de la sección actual
     * 🔧 WAVE 14.6: Protección contra NaN
     */
    calculateSectionConfidence() {
        // Basado en:
        // 1. Cantidad de frames en esta sección
        // 2. Consistencia de votos
        // 3. Match con perfil típico
        const now = Date.now();
        const duration = this.sectionStartTime > 0 ? now - this.sectionStartTime : 0;
        const durationFactor = Math.min(1, duration / 10000); // Max confidence después de 10s
        const voteConfidence = Math.min(1, (this.consecutiveSection || 0) / 10);
        const result = durationFactor * 0.5 + voteConfidence * 0.5;
        // 🔧 WAVE 14.6: Protección contra NaN
        return Number.isFinite(result) ? result : 0;
    }
    /**
     * Calcular confianza general del análisis
     *
     * ⚠️ REGLA 2: Si < 0.5, el orquestador usará fallback
     * 🔧 WAVE 14.6: Protección contra NaN
     */
    calculateConfidence(rhythm) {
        // Factores:
        // 1. Historial suficiente
        // 2. Confianza del análisis rítmico
        // 3. Estabilidad de sección
        const historyFactor = Math.min(1, (this.energyHistory.length || 0) / 10);
        const rhythmFactor = rhythm?.confidence ?? 0; // 🔧 Protección
        const stabilityFactor = this.calculateSectionConfidence();
        const result = historyFactor * 0.3 + rhythmFactor * 0.4 + stabilityFactor * 0.3;
        // 🔧 WAVE 14.6: Protección contra NaN
        return Number.isFinite(result) ? result : 0;
    }
    // ============================================================
    // 📤 GETTERS Y UTILIDADES
    // ============================================================
    /**
     * Obtener último análisis (caché)
     */
    getLastAnalysis() {
        return this.cachedAnalysis;
    }
    /**
     * Obtener sección actual
     */
    getCurrentSection() {
        return this.currentSection;
    }
    /**
     * Verificar si estamos en buildup (útil para preparar el drop)
     */
    isBuildup() {
        return this.currentSection === 'buildup';
    }
    /**
     * Verificar si estamos en drop (máxima energía)
     */
    isDrop() {
        return this.currentSection === 'drop';
    }
    /**
     * WAVE 47.2: Obtener historial de secciones (memoria narrativa)
     */
    getSectionHistory() {
        return [...this.sectionHistory];
    }
    /**
     * WAVE 47.2: Obtener baseline de energía actual
     */
    getEnergyBaseline() {
        return { ...this.energyBaseline };
    }
    /**
     * Reset del tracker
     * WAVE 47.2: Incluye nuevos campos
     * WAVE 70: Incluye campos de DROP timeout
     * 🎯 WAVE 289: Incluye campos de vibe-aware
     */
    reset() {
        this.currentSection = 'unknown';
        this.sectionStartTime = 0;
        this.lastAnalysisTime = 0;
        this.cachedAnalysis = null;
        this.energyHistory = [];
        this.sectionVotes.clear();
        this.consecutiveSection = 0;
        // WAVE 47.2: Reset nuevos campos
        this.energyBaseline = { p25: 0.3, p50: 0.5, p75: 0.7, min: 0, max: 1, sampleCount: 0 };
        this.allEnergySamples = [];
        this.pendingTransition = null;
        this.pendingTransitionFrames = 0;
        this.sectionHistory = [];
        // 🌊 WAVE 70: Reset campos de DROP timeout
        this.dropStartTime = 0;
        this.lastDropEndTime = 0;
        this.isDropCooldown = false;
        this.forceDropExit = false; // 🌊 WAVE 70.5: Reset nuclear flag
        // 🎯 WAVE 289: Reset energy delta model
        this.avgEnergy = 0.5;
        this.instantEnergy = 0.5;
        this.timeInLowEnergy = 0;
        this.lastFrameTime = 0;
        // 🎯 WAVE 289: NO reseteamos el vibeProfile - se mantiene el género seleccionado
        // El perfil solo cambia cuando el usuario cambia de vibe
    }
}
// ============================================================
// 📤 FACTORY FUNCTION
// ============================================================
/**
 * Crear instancia de SectionTracker con config por defecto
 */
export function createSectionTracker(config) {
    return new SectionTracker(config);
}
// Export default instance for quick usage
export const defaultSectionTracker = new SectionTracker();
