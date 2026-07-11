/**
 * 🧠 MUSICAL CONTEXT ENGINE - El Enriquecedor de Contexto (Wave 1230)
 * ================================================================
 * Wave 1230 - CONSOLIDACIÓN: Eliminación de Análisis Duplicado
 *
 * CAMBIO RADICAL: De analizador independiente a ENRIQUECEDOR.
 *
 * ANTES (Wave 8):
 * - Recibía AudioAnalysis crudo
 * - Ejecutaba RhythmAnalyzer, HarmonyDetector, SectionTracker
 * - Duplicaba trabajo del GAMMA worker
 *
 * AHORA (Wave 1230):
 * 1. Recibe MusicalContext OFICIAL (del worker GAMMA)
 * 2. Enriquece con lógicas especiales:
 *    - EnergyConsciousnessEngine (consciencia energética avanzada)
 *    - PredictionMatrix (anticipación de cambios)
 *    - Reactive fallback (si fuera necesario)
 * 3. ELIMINA duplicidad: Un solo source of truth
 *
 * ⚠️ REGLAS UPDATED:
 * - REGLA 1.230: Single source of truth desde GAMMA worker
 * - REGLA 2.230: Enriquecimiento, no análisis
 * - REGLA 3.230: ~5% CPU savings por eliminar duplicate analysis
 *
 * @module engines/musical/context/MusicalContextEngine
 * @version 2.0.0 - WAVE 1230 CONSOLIDATION
 */
import { EventEmitter } from 'events';
import { DEFAULT_MUSICAL_ENGINE_CONFIG, } from '../types.js';
// 🗑️ WAVE 1230: ELIMINADOS los analizadores duplicados
// - RhythmAnalyzer ✂️ (análisis de ritmo hace el GAMMA worker)
// - HarmonyDetector ✂️ (análisis de armonía hace el GAMMA worker)
// - SectionTracker ✂️ (análisis de sección hace el GAMMA worker)
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
 * Motor de Contexto Musical - El Enriquecedor de Wave 1230
 * 🗑️ WAVE 1230: Eliminados RhythmAnalyzer, HarmonyDetector, SectionTracker
 * ✅ MANTIENE: PredictionMatrix, EnergyConsciousnessEngine
 *
 * Ya no realiza análisis. Enriquece el MusicalContext oficial.
 */
export class MusicalContextEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.currentMode = 'intelligent'; // 🆕 Ahora siempre intelligent (confiamos en GAMMA)
        this.lastContext = null;
        this.lastResult = null;
        // 🗑️ WAVE 1230: Eliminadas propiedades de análisis/throttling
        // private lastHeavyAnalysisTime: number = 0;
        // private cachedHarmony: HarmonyAnalysis | null = null;
        // private cachedSection: SectionAnalysis | null = null;
        // private cachedGenre: GenreClassification | null = null;
        // Warmup tracking
        this.startTime = Date.now();
        this.processCount = 0;
        // Performance tracking
        this.totalProcessTime = 0;
        this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
        // 🗑️ WAVE 1230: ELIMINADA inicialización de analizadores duplicados
        // this.rhythmAnalyzer = new RhythmAnalyzer();
        // this.harmonyDetector = createHarmonyDetector();
        // this.sectionTracker = createSectionTracker();
        // ✅ MANTIENE: Sistemas únicos que agregan valor
        this.predictionMatrix = createPredictionMatrix();
        // 🔋 WAVE 931: Consciencia energética para evitar "grito en biblioteca"
        this.energyConsciousness = createEnergyConsciousnessEngine();
        // Escuchar eventos de los analizadores
        this.setupEventListeners();
    }
    // ============================================================
    // 🎯 WAVE 289: VIBE CONTEXT (Compatibility layer)
    // ============================================================
    /**
     * � WAVE 1230: No hay SectionTracker local, pero mantenemos API
     * El vibeId es propagado ahora por SeleneMusicalBrain
     */
    setVibeContext(vibeId) {
        console.log(`[MusicalContextEngine] 🎯 WAVE 289 (compat): setVibeContext → ${vibeId}`);
        // 🗑️ WAVE 1230: No-op, el vibe context viene del GAMMA worker
        this.emit('vibe-context-change', {
            vibeId,
            timestamp: Date.now(),
        });
    }
    /**
     * � WAVE 1230: Compatibility method (returns unknown)
     */
    getActiveVibeId() {
        return 'unknown';
    }
    // ============================================================
    // 🎯 MÉTODO PRINCIPAL (WAVE 1230): ENRICH
    // ============================================================
    /**
     * 🆕 WAVE 1230: Enriquece un MusicalContext oficial con análisis especiales
     *
     * NO analiza audio crudo. Recibe el MusicalContext ya procesado por GAMMA worker.
     * Agrega valor:
     * - Consciencia energética (EnergyConsciousnessEngine)
     * - Predicciones (PredictionMatrix)
     * - Modo inteligente (ahora siempre, confiamos en GAMMA)
     *
     * @param baseContext - MusicalContext oficial del worker
     * @param audio - AudioAnalysis para EnergyConsciousnessEngine
     * @returns IntelligentResult enriquecido
     */
    enrich(baseContext, audio) {
        const startTime = performance.now();
        const now = Date.now();
        this.processCount++;
        // 🔋 WAVE 931: Procesar consciencia energética con energía cruda del audio
        const rawEnergy = audio.energy?.current ?? baseContext.energy;
        const energyContext = this.energyConsciousness.process(rawEnergy, undefined, baseContext.section.evidence);
        // Enriquecer el contexto con consciencia energética
        const enrichedContext = {
            ...baseContext,
            energyContext, // Agregar/actualizar consciencia energética
        };
        // Generar predicción basada en rhythm + section (datos que YA vienen en baseContext)
        const prediction = this.predictionMatrix.generate(baseContext.rhythm, baseContext.section);
        // Mapear paleta y movimiento
        const suggestedPalette = GENRE_TO_PALETTE[baseContext.genre.primary] || 'default';
        const suggestedMovement = MOOD_TO_MOVEMENT[baseContext.mood] || 'circular';
        // Guardar contexto
        this.lastContext = enrichedContext;
        // Emitir contexto enriquecido
        this.emit('context', enrichedContext);
        // Emitir predicción si existe
        if (prediction) {
            this.emit('prediction', prediction);
        }
        // Performance tracking
        const elapsed = performance.now() - startTime;
        this.totalProcessTime += elapsed;
        const result = {
            mode: 'intelligent',
            context: enrichedContext,
            prediction,
            suggestedPalette,
            suggestedMovement,
            timestamp: now,
        };
        this.lastResult = result;
        this.emit('result', result);
        return result;
    }
    /**
     * 🆕 WAVE 1230: Método legacy "process()" para compatibilidad
     *
     * Mantiene API compatible pero ahora SOLO para audio análisis
     * de emergencia en modo reactivo (fallback).
     *
     * ⚠️ DEPRECATED: Usar enrich() en lugar de process()
     */
    process(audio) {
        const now = Date.now();
        // Fallback reactivo simple cuando NO hay contexto oficial
        const pulse = Math.pow(audio.spectrum.bass, 0.8);
        const shimmer = audio.spectrum.treble * 0.7 + audio.spectrum.highMid * 0.3;
        const flash = audio.beat.detected;
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
    // 🛠️ UTILIDADES (SIMPLIFICADAS WAVE 1230)
    // ============================================================
    /**
     * Configura listeners para eventos
     * 🗑️ WAVE 1230: Ya no hay analizadores locales
     */
    setupEventListeners() {
        // Propagar eventos de PredictionMatrix
        this.predictionMatrix.on('prediction', (data) => {
            this.emit('prediction', data);
        });
    }
    // ============================================================
    // 📊 API PÚBLICA (SIMPLIFICADA)
    // ============================================================
    /**
     * Obtiene el modo de operación
     * 🆕 WAVE 1230: Siempre inteligente (confiamos en GAMMA)
     */
    getMode() {
        return 'intelligent';
    }
    /**
     * Obtiene el último contexto enriquecido
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
     * Estadísticas de rendimiento (simplificado)
     */
    getPerformanceStats() {
        return {
            processCount: this.processCount,
            averageProcessTime: this.processCount > 0
                ? this.totalProcessTime / this.processCount
                : 0,
            timeSinceStart: Date.now() - this.startTime,
        };
    }
    /**
     * Resetea el estado
     */
    reset() {
        this.lastContext = null;
        this.lastResult = null;
        this.startTime = Date.now();
        this.processCount = 0;
        this.totalProcessTime = 0;
        // Reset PredictionMatrix
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
