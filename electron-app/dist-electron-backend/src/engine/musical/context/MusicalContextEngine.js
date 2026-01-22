/**
 * 🧠 MUSICAL CONTEXT ENGINE - El Director de Orquesta de Selene
 * ================================================================
 * Wave 8 - FASE 4: Orquestación
 *
 * La clase maestra que coordina TODOS los analizadores musicales
 * y genera el MusicalContext unificado para la Consciencia Felina.
 *
 * FLUJO:
 * 1. Recibe AudioAnalysis (cada 30ms del Main Thread)
 * 2. Ejecuta RhythmAnalyzer (Main Thread, ligero)
 * 3. Ejecuta HarmonyDetector + SectionTracker + GenreClassifier (Throttled 500ms)
 * 4. Sintetiza el Mood global
 * 5. Calcula la Energía Global
 * 6. Calcula la Confianza Combinada
 * 7. **DECIDE: Modo Reactivo vs Modo Inteligente** ← REGLA 2 CRÍTICA
 * 8. Emite evento 'context' con todo empaquetado
 *
 * ⚠️ REGLAS DE ORO:
 * - REGLA 1: Main Thread < 5ms, Worker/Throttle para análisis pesado
 * - REGLA 2: confidence < 0.5 → fallbackReactiveMode() (V17 style)
 * - REGLA 3: Sincopación tiene peso 90% vs BPM 10% en confianza
 *
 * @module engines/musical/context/MusicalContextEngine
 * @version 1.0.0 - FASE 4
 */
import { EventEmitter } from 'events';
import { DEFAULT_MUSICAL_ENGINE_CONFIG, } from '../types.js';
import { RhythmAnalyzer } from '../analysis/RhythmAnalyzer.js';
import { createHarmonyDetector } from '../analysis/HarmonyDetector.js';
import { createSectionTracker } from '../analysis/SectionTracker.js';
// 🗑️ WAVE 61: GenreClassifier ELIMINADO - VibeManager en GAMMA es el nuevo dueño del contexto
import { createPredictionMatrix } from './PredictionMatrix.js';
// 🔋 WAVE 931: Motor de Consciencia Energética
import { createEnergyConsciousnessEngine } from '../../../core/intelligence/EnergyConsciousnessEngine.js';
const DEFAULT_ENGINE_CONFIG = {
    ...DEFAULT_MUSICAL_ENGINE_CONFIG,
    enableReactiveFallback: true,
    rhythmConfidenceWeight: 0.35, // Ritmo es MUY confiable
    harmonyConfidenceWeight: 0.20, // Armonía tarda más en converger
    genreConfidenceWeight: 0.25, // Género es importante
    sectionConfidenceWeight: 0.20, // Sección es útil
    modeHysteresis: 0.05, // 5% de histéresis para evitar flip-flop
};
/**
 * Mapeo de género a paleta sugerida
 * 🔥 WAVE 12: Cyberpunk → NEÓN obligatorio
 */
const GENRE_TO_PALETTE = {
    cumbia: 'fuego',
    reggaeton: 'neon',
    techno: 'cyber',
    cyberpunk: 'neon', // 🔥 WAVE 12: CYBERPUNK → NEÓN SIEMPRE
    house: 'rainbow',
    latin_pop: 'tropical',
    trap: 'dark',
    drum_and_bass: 'energy',
    ambient: 'ocean',
    edm: 'electric',
    trance: 'aurora',
    dubstep: 'glitch',
    pop: 'candy',
    rock: 'fire',
    indie: 'sunset',
    alternative: 'forest',
    hip_hop: 'urban',
    r_and_b: 'velvet',
    jazz: 'smoky',
    classical: 'elegant',
    salsa: 'salsa',
    bachata: 'romance',
    unknown: 'default',
};
/**
 * Mapeo de mood a movimiento sugerido
 */
const MOOD_TO_MOVEMENT = {
    euphoric: 'burst',
    melancholic: 'wave',
    aggressive: 'slash',
    chill: 'breathe',
    groovy: 'figure8',
    epic: 'sweep',
    intimate: 'pulse',
    party: 'random',
    neutral: 'circular',
};
// ============================================================
// 🧠 MUSICAL CONTEXT ENGINE CLASS
// ============================================================
/**
 * Motor de Contexto Musical - El Cerebro de Wave 8
 * 🗑️ WAVE 61: GenreClassifier ELIMINADO - VibeManager controla el contexto
 * 🔋 WAVE 931: EnergyConsciousnessEngine AÑADIDO - Consciencia energética absoluta
 */
export class MusicalContextEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.currentMode = 'reactive';
        this.overallConfidence = 0;
        this.lastContext = null;
        this.lastResult = null;
        // Throttling para análisis pesado
        this.lastHeavyAnalysisTime = 0;
        this.cachedHarmony = null;
        this.cachedSection = null;
        this.cachedGenre = null;
        // Warmup tracking
        this.startTime = Date.now();
        this.processCount = 0;
        // Performance tracking
        this.totalProcessTime = 0;
        this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
        // Inicializar analizadores
        this.rhythmAnalyzer = new RhythmAnalyzer();
        this.harmonyDetector = createHarmonyDetector();
        this.sectionTracker = createSectionTracker();
        // 🗑️ WAVE 61: genreClassifier eliminado - contexto controlado por VibeManager
        this.predictionMatrix = createPredictionMatrix();
        // 🔋 WAVE 931: Consciencia energética para evitar "grito en biblioteca"
        this.energyConsciousness = createEnergyConsciousnessEngine();
        // Escuchar eventos de los analizadores
        this.setupEventListeners();
    }
    // ============================================================
    // 🎯 WAVE 289: VIBE CONTEXT PROPAGATION
    // ============================================================
    /**
     * 🎯 WAVE 289: Establecer contexto de vibe para el SectionTracker
     *
     * Llamado por TitanEngine cuando el usuario cambia de vibe.
     * Propaga el vibeId al SectionTracker para que use los umbrales correctos.
     *
     * @param vibeId - ID del vibe activo ('techno', 'latino', 'rock', etc.)
     */
    setVibeContext(vibeId) {
        console.log(`[MusicalContextEngine] 🎯 WAVE 289: setVibeContext → ${vibeId}`);
        this.sectionTracker.setVibeProfile(vibeId);
        // Emitir evento para notificar el cambio
        this.emit('vibe-context-change', {
            vibeId,
            timestamp: Date.now(),
        });
    }
    /**
     * 🎯 WAVE 289: Obtener el vibeId activo del SectionTracker
     */
    getActiveVibeId() {
        return this.sectionTracker.getActiveVibeId();
    }
    // ============================================================
    // 🎯 MÉTODO PRINCIPAL: PROCESS
    // ============================================================
    /**
     * Procesa el audio y retorna el resultado apropiado
     *
     * ⚠️ REGLA 2 IMPLEMENTADA:
     * - Si confidence < 0.5 → fallbackReactiveMode()
     * - Si confidence >= 0.5 → intelligentMode()
     *
     * @param audio - Análisis de audio del BeatDetector/FFTAnalyzer
     * @returns Resultado reactivo o inteligente según confianza
     */
    process(audio) {
        const startTime = performance.now();
        const now = Date.now();
        this.processCount++;
        // =====================================================
        // PASO 1: Análisis Rítmico (SIEMPRE, Main Thread, Ligero)
        // =====================================================
        const audioMetrics = this.audioToMetrics(audio);
        const beatState = {
            bpm: audio.beat.bpm,
            phase: audio.beat.beatPhase,
            onBeat: audio.beat.detected,
        };
        const rhythm = this.rhythmAnalyzer.analyze(audioMetrics, beatState);
        // =====================================================
        // PASO 2: Análisis Pesado (Throttled 500ms)
        // =====================================================
        const shouldDoHeavyAnalysis = now - this.lastHeavyAnalysisTime >= this.config.workerThreadInterval;
        // Audio simplificado para SectionTracker y GenreClassifier
        const simpleAudio = {
            energy: audio.energy?.current ?? 0.5,
            bass: audio.spectrum.bass,
            mid: audio.spectrum.mid,
            treble: audio.spectrum.treble,
        };
        if (shouldDoHeavyAnalysis) {
            this.lastHeavyAnalysisTime = now;
            // Harmony (throttled)
            this.cachedHarmony = this.harmonyDetector.analyze(audio);
            // Section (throttled)
            this.cachedSection = this.sectionTracker.track(rhythm, this.cachedHarmony, simpleAudio);
            // 🗑️ WAVE 61: GenreClassifier ELIMINADO
            // El contexto musical ahora es controlado por VibeManager (selección manual del DJ)
            // Generamos un GenreClassification neutro para compatibilidad con el protocolo
            this.cachedGenre = {
                primary: 'unknown',
                confidence: 0, // Zero confidence = "sin detección de género"
                secondary: undefined,
                characteristics: [],
                timestamp: now,
            };
        }
        // =====================================================
        // PASO 3: Calcular Confianza Combinada
        // =====================================================
        this.overallConfidence = this.calculateOverallConfidence(rhythm, this.cachedHarmony, this.cachedSection, this.cachedGenre);
        // =====================================================
        // PASO 4: DECIDIR MODO (REGLA 2 CRÍTICA)
        // =====================================================
        const previousMode = this.currentMode;
        const newMode = this.decideMode(this.overallConfidence);
        // Emitir evento si cambió el modo
        if (newMode !== previousMode && newMode !== 'transitioning') {
            this.currentMode = newMode;
            this.emit('mode-change', {
                from: previousMode,
                to: newMode,
                confidence: this.overallConfidence,
                timestamp: now,
            });
        }
        // =====================================================
        // PASO 5: Ejecutar el modo apropiado
        // =====================================================
        let result;
        if (this.currentMode === 'reactive' || !this.hasValidAnalysis()) {
            result = this.fallbackReactiveMode(audio);
        }
        else {
            result = this.intelligentMode(rhythm, this.cachedHarmony, this.cachedSection, this.cachedGenre, audio);
        }
        // Performance tracking
        const elapsed = performance.now() - startTime;
        this.totalProcessTime += elapsed;
        // Guardar resultado
        this.lastResult = result;
        // Emitir resultado
        this.emit('result', result);
        return result;
    }
    // ============================================================
    // ❄️ MODO REACTIVO (REGLA 2 - FALLBACK)
    // ============================================================
    /**
     * 🔥 MODO REACTIVO (V17 Style)
     *
     * Cuando confidence < 0.5, NO esperamos al análisis de género.
     * Simplemente mapeamos directo:
     * - Bass → Pulso (intensidad de graves)
     * - Treble → Shimmer (brillo/parpadeo)
     * - Beat → Flash (flash en cada golpe)
     *
     * Esto garantiza que SIEMPRE hay reacción visual,
     * incluso en los primeros segundos de la canción.
     *
     * @param audio - Análisis de audio actual
     * @returns ReactiveResult con mapeo directo
     */
    fallbackReactiveMode(audio) {
        const now = Date.now();
        // Mapeo directo de frecuencias a efectos visuales
        const pulse = Math.pow(audio.spectrum.bass, 0.8); // Bass → Pulso
        const shimmer = audio.spectrum.treble * 0.7 + // Treble → Shimmer
            audio.spectrum.highMid * 0.3;
        const flash = audio.beat.detected; // Beat → Flash
        // Energía general (promedio ponderado)
        const intensity = (audio.spectrum.bass * 0.4 +
            audio.spectrum.mid * 0.3 +
            audio.spectrum.treble * 0.3);
        const result = {
            mode: 'reactive',
            pulse: Math.min(1, pulse),
            shimmer: Math.min(1, shimmer),
            flash,
            intensity: Math.min(1, intensity),
            timestamp: now,
        };
        this.emit('reactive-update', result);
        return result;
    }
    // ============================================================
    // 🎭 MODO INTELIGENTE
    // ============================================================
    /**
     * 🧠 MODO INTELIGENTE
     *
     * Cuando confidence >= 0.5, usamos toda la inteligencia:
     * - Género detectado → Paleta de colores
     * - Mood sintetizado → Patrón de movimiento
     * - Sección → Intensidad base
     * - Predicciones → Anticipación de cambios
     * - 🔋 WAVE 931: Consciencia energética → Evita "grito en biblioteca"
     *
     * @returns IntelligentResult con contexto completo
     */
    intelligentMode(rhythm, harmony, section, genre, audio) {
        const now = Date.now();
        // Sintetizar mood
        const mood = this.synthesizeMood(harmony, section, genre);
        // Calcular energía global
        const energy = this.calculateEnergy(rhythm, section, audio);
        // 🔋 WAVE 931: Procesar consciencia energética
        // Usa la energía RAW del audio para detectar zonas con asimetría temporal
        const rawEnergy = audio.energy?.current ?? energy;
        const energyContext = this.energyConsciousness.process(rawEnergy);
        // Construir contexto musical completo
        const context = {
            rhythm,
            harmony,
            section,
            genre,
            mood,
            energy,
            energyContext, // 🔋 WAVE 931: Contexto energético para decisiones inteligentes
            confidence: this.overallConfidence,
            timestamp: now,
        };
        // Generar predicción
        const prediction = this.predictionMatrix.generate(rhythm, section);
        // Seleccionar paleta y movimiento
        const suggestedPalette = GENRE_TO_PALETTE[genre.primary] || 'default';
        const suggestedMovement = MOOD_TO_MOVEMENT[mood] || 'circular';
        // Guardar contexto
        this.lastContext = context;
        // Emitir contexto
        this.emit('context', context);
        // Emitir predicción si existe
        if (prediction) {
            this.emit('prediction', prediction);
        }
        return {
            mode: 'intelligent',
            context,
            prediction,
            suggestedPalette,
            suggestedMovement,
            timestamp: now,
        };
    }
    // ============================================================
    // 🎭 SÍNTESIS DE MOOD
    // ============================================================
    /**
     * Sintetiza el mood combinando armonía, sección y género
     *
     * Prioridad:
     * 1. Sección (drop = euphoric, breakdown = chill)
     * 2. Armonía (mood detectado)
     * 3. Género (características típicas)
     */
    synthesizeMood(harmony, section, genre) {
        // Sección tiene prioridad alta
        const sectionMood = this.getSectionMood(section.current.type);
        if (sectionMood !== 'neutral') {
            return sectionMood;
        }
        // Luego considerar armonía
        const harmonicMood = harmony.mode?.mood || 'universal';
        const harmonicSynthMood = this.mapHarmonicToSynthesized(harmonicMood);
        // Combinar con género para casos específicos
        if (genre.primary === 'reggaeton' || genre.primary === 'cumbia') {
            return section.intensity > 0.7 ? 'party' : 'groovy';
        }
        if (genre.primary === 'ambient') {
            return 'chill';
        }
        if (genre.primary === 'drum_and_bass' || genre.primary === 'dubstep') {
            return section.intensity > 0.6 ? 'aggressive' : 'groovy';
        }
        return harmonicSynthMood;
    }
    /**
     * Mapea tipo de sección a mood
     */
    getSectionMood(sectionType) {
        const mapping = {
            drop: 'euphoric',
            buildup: 'epic',
            breakdown: 'chill',
            chorus: 'party',
            verse: 'groovy',
            intro: 'intimate',
            outro: 'melancholic',
        };
        return mapping[sectionType] || 'neutral';
    }
    /**
     * Mapea mood armónico a mood sintetizado
     */
    mapHarmonicToSynthesized(harmonic) {
        const mapping = {
            happy: 'euphoric',
            sad: 'melancholic',
            jazzy: 'groovy',
            spanish_exotic: 'aggressive',
            dreamy: 'chill',
            bluesy: 'intimate',
            tense: 'aggressive',
            universal: 'neutral',
        };
        return mapping[harmonic] || 'neutral';
    }
    // ============================================================
    // ⚡ CÁLCULO DE ENERGÍA
    // ============================================================
    /**
     * Calcula la energía global del momento musical
     *
     * Combina:
     * - Intensidad de sección (40%)
     * - Energía de audio (40%)
     * - Actividad rítmica (20%)
     */
    calculateEnergy(rhythm, section, audio) {
        // Energía de sección
        const sectionEnergy = section.intensity;
        // Energía de audio (espectro)
        const audioEnergy = (audio.spectrum.bass * 0.4 +
            audio.spectrum.mid * 0.3 +
            audio.spectrum.treble * 0.2 +
            (audio.energy?.current || 0.5) * 0.1);
        // Actividad rítmica
        const rhythmActivity = ((rhythm.drums.kickDetected ? 0.3 : 0) +
            (rhythm.drums.snareDetected ? 0.3 : 0) +
            (rhythm.drums.hihatDetected ? 0.2 : 0) +
            (rhythm.fillInProgress ? 0.2 : 0));
        // Combinar con pesos
        const totalEnergy = sectionEnergy * 0.4 +
            audioEnergy * 0.4 +
            rhythmActivity * 0.2;
        return Math.min(1, Math.max(0, totalEnergy));
    }
    // ============================================================
    // 📊 CÁLCULO DE CONFIANZA COMBINADA
    // ============================================================
    /**
     * Calcula la confianza combinada de todos los análisis
     *
     * ⚠️ REGLA 2: Este valor determina si usar fallback
     *
     * Sistema de confianza ponderada:
     * - Ritmo: 35% (muy confiable, rápido en converger)
     * - Género: 25% (importante para paleta)
     * - Armonía: 20% (tarda más en converger)
     * - Sección: 20% (útil para intensidad)
     *
     * REGLA 3 aplicada: Si ritmo dice Techno (90%) y armonía dice Jazz (10%),
     * la confianza de ritmo domina.
     */
    calculateOverallConfidence(rhythm, harmony, section, genre) {
        // Verificar si estamos en warmup
        const timeSinceStart = Date.now() - this.startTime;
        if (timeSinceStart < this.config.warmupTime) {
            // Durante warmup, confianza reducida proporcionalmente
            const warmupFactor = timeSinceStart / this.config.warmupTime;
            return Math.min(0.4, warmupFactor * 0.4);
        }
        // Obtener confianzas individuales
        const rhythmConf = rhythm.confidence;
        const harmonyConf = harmony?.confidence ?? 0;
        const sectionConf = section?.confidence ?? 0;
        const genreConf = genre?.confidence ?? 0;
        // Calcular confianza ponderada
        const weightedConfidence = rhythmConf * this.config.rhythmConfidenceWeight +
            harmonyConf * this.config.harmonyConfidenceWeight +
            sectionConf * this.config.sectionConfidenceWeight +
            genreConf * this.config.genreConfidenceWeight;
        // Penalizar si algún análisis falta
        const analysisCoverage = [
            harmony !== null,
            section !== null,
            genre !== null,
        ].filter(Boolean).length / 3;
        return weightedConfidence * (0.7 + 0.3 * analysisCoverage);
    }
    // ============================================================
    // 🔄 DECISIÓN DE MODO
    // ============================================================
    /**
     * Decide el modo de operación con histéresis
     *
     * ⚠️ REGLA 2: El umbral es 0.5 (configurable)
     *
     * Histéresis para evitar flip-flop:
     * - Para entrar en intelligent: confidence > threshold + hysteresis
     * - Para salir de intelligent: confidence < threshold - hysteresis
     */
    decideMode(confidence) {
        const threshold = this.config.confidenceThreshold;
        const hysteresis = this.config.modeHysteresis;
        if (this.currentMode === 'reactive') {
            // Estamos en reactivo, necesitamos superar threshold + hysteresis
            if (confidence >= threshold + hysteresis) {
                return 'intelligent';
            }
            return 'reactive';
        }
        else {
            // Estamos en inteligente, caemos si bajamos de threshold - hysteresis
            if (confidence < threshold - hysteresis) {
                return 'reactive';
            }
            return 'intelligent';
        }
    }
    // ============================================================
    // 🛠️ UTILIDADES
    // ============================================================
    /**
     * Verifica si tenemos análisis válidos
     */
    hasValidAnalysis() {
        return (this.cachedHarmony !== null &&
            this.cachedSection !== null &&
            this.cachedGenre !== null);
    }
    /**
     * Convierte AudioAnalysis a formato de RhythmAnalyzer
     */
    audioToMetrics(audio) {
        return {
            lowBass: audio.spectrum.bass,
            midBass: audio.spectrum.lowMid,
            lowMid: audio.spectrum.mid,
            highMid: audio.spectrum.highMid,
            treble: audio.spectrum.treble,
            spectralCentroid: 0.5, // Default
            beatPhase: audio.beat.beatPhase,
            bpm: audio.beat.bpm,
            beatConfidence: audio.beat.confidence,
        };
    }
    /**
     * Extrae características del análisis de género
     */
    extractCharacteristics(genreResult) {
        const chars = [];
        if (genreResult.features?.hasDembow)
            chars.push('dembow');
        if (genreResult.features?.hasGuiro)
            chars.push('caballito');
        if (genreResult.features?.bpm >= 120)
            chars.push('four_on_floor');
        if (genreResult.features?.syncopation > 0.4)
            chars.push('syncopated');
        return chars;
    }
    /**
     * Configura listeners para eventos de analizadores
     */
    setupEventListeners() {
        // Propagar eventos de SectionTracker
        this.sectionTracker.on('section-change', (data) => {
            this.emit('section-change', data);
        });
        // Propagar eventos de HarmonyDetector
        this.harmonyDetector.on('key-change', (data) => {
            this.emit('key-change', data);
        });
        this.harmonyDetector.on('tension', (data) => {
            this.emit('tension', data);
        });
        // Propagar eventos de PredictionMatrix
        this.predictionMatrix.on('prediction', (data) => {
            this.emit('prediction', data);
        });
    }
    // ============================================================
    // 📊 API PÚBLICA
    // ============================================================
    /**
     * Obtiene el modo de operación actual
     */
    getMode() {
        return this.currentMode;
    }
    /**
     * Obtiene la confianza actual
     */
    getConfidence() {
        return this.overallConfidence;
    }
    /**
     * Obtiene el último contexto (solo válido en modo inteligente)
     */
    getLastContext() {
        return this.lastContext;
    }
    /**
     * Obtiene el último resultado
     */
    getLastResult() {
        return this.lastResult;
    }
    /**
     * 🎵 WAVE 14.5: Obtiene el último análisis rítmico
     * Útil para modo reactivo donde no hay context completo
     */
    getLastRhythm() {
        return this.rhythmAnalyzer.getLastResult();
    }
    /**
     * Obtiene estadísticas de rendimiento
     */
    getPerformanceStats() {
        return {
            processCount: this.processCount,
            averageProcessTime: this.processCount > 0
                ? this.totalProcessTime / this.processCount
                : 0,
            currentMode: this.currentMode,
            overallConfidence: this.overallConfidence,
            timeSinceStart: Date.now() - this.startTime,
        };
    }
    /**
     * Resetea el estado del motor
     */
    reset() {
        this.currentMode = 'reactive';
        this.overallConfidence = 0;
        this.lastContext = null;
        this.lastResult = null;
        this.cachedHarmony = null;
        this.cachedSection = null;
        this.cachedGenre = null;
        this.lastHeavyAnalysisTime = 0;
        this.startTime = Date.now();
        this.processCount = 0;
        this.totalProcessTime = 0;
        // Reset analizadores
        this.rhythmAnalyzer.reset?.();
        this.harmonyDetector.reset?.();
        this.sectionTracker.reset?.();
        // 🗑️ WAVE 61: genreClassifier.reset eliminado
        this.predictionMatrix.reset();
        this.emit('reset');
    }
    /**
     * Actualiza la configuración
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.emit('config-updated', this.config);
    }
    /**
     * Fuerza el modo de operación (para testing/debug)
     */
    forceMode(mode) {
        const previousMode = this.currentMode;
        this.currentMode = mode;
        if (mode !== previousMode) {
            this.emit('mode-change', {
                from: previousMode,
                to: mode,
                confidence: this.overallConfidence,
                forced: true,
                timestamp: Date.now(),
            });
        }
    }
}
// ============================================================
// 🏭 FACTORY FUNCTION
// ============================================================
/**
 * Crea una instancia de MusicalContextEngine con configuración opcional
 */
export function createMusicalContextEngine(config) {
    return new MusicalContextEngine(config);
}
// Export default
export default MusicalContextEngine;
