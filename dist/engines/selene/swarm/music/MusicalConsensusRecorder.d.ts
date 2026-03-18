import { ModeConfig } from '../../evolutionary/modes/mode-manager.js';
type EngineStatus = any;
type EngineInput = any;
type EngineOutput = any;
type UsageMetrics = any;
type UserTier = 'free' | 'pro' | 'enterprise' | 'admin';
type RateLimits = any;
type EngineMetrics = any;
type EngineFeedback = any;
/**
 * 🎵 MUSIC ENGINE - SELENE MULTIMODAL ARCHITECTURE
 *
 * Generates procedural MIDI symphonies and poetry based on swarm consensus
 * and evolutionary modes (Deterministic/Balanced/Punk).
 *
 * Features:
 * - Mode-aware generation (entropyFactor, riskThreshold, punkProbability)
 * - Fibonacci-based harmonic patterns
 * - Zodiac-infused poetry templates
 * - Deterministic PRNG (no Math.random())
 * - Redis persistence
 * - NFT-ready output with Veritas signatures
 *
 * SSE-7.7: Refactored from MusicalConsensusRecorder to implement BaseEngine interface
 *
 * @author PunkClaude + RadWulf
 * @version 2.0.0
 * @date 2025-10-23
 */
export declare class MusicEngine {
    name: string;
    version: string;
    description: string;
    private recording;
    private isRecording;
    private startTime;
    private redis;
    private poetryLibrary;
    private modeManager;
    private currentModeConfig;
    private engineStartTime;
    private engineStatus;
    private verseCount;
    private totalRequests;
    private totalLatency;
    private errorCount;
    private activeRequests;
    private profileLog;
    constructor();
    /**
     * 🎵 FASE 3: DESCOMPRESIÓN MIDI
     * Descomprime datos MIDI comprimidos para reproducción
     */
    private decompressMIDI;
    /**
     * 🎵 FASE 3: COMPRESIÓN INTELIGENTE
     * Decide si comprimir basado en tamaño y calidad del archivo
     */
    private shouldCompressMIDI;
    /**
     * Start recording
     */
    startRecording(): void;
    /**
     * Record consensus event as musical note
     * PHASE 7.6: Simplified - no intent parameters, mode-driven only
     */
    recordConsensusEvent(result: ConsensusResult): Promise<any>;
    /**
     * 🎵 DASHBOARD INTEGRATION: Save consensus data to Redis for dashboard display
     * PHASE 7.6: Simplified - no intent parameters or 4D classification
     */
    private saveConsensusToDashboard;
    /**
     * Save poetry to regular poems list (selene:poems:nft)
     * SSE-7.6: Simplified to accept only numeric quality (mode-driven architecture)
     */
    private saveToRegularPoems;
    /**
     * Save high-quality art to legendary cache (selene:art:legendary)
     * SSE-7.6: Simplified to accept only numeric quality (mode-driven architecture)
     */
    private saveToLegendaryCache;
    /**
     * Save MIDI recording for high-quality consensus
     * SSE-7.6: Simplified to accept only numeric quality (mode-driven architecture)
     */
    private saveMIDIRecording;
    /**
     * 🎵 FASE 3: DESCOMPRESIÓN PARA REPRODUCCIÓN
     * Descomprime y devuelve archivo MIDI listo para reproducción
     */
    decompressMIDIFile(compressedFilePath: string): Promise<Buffer>;
    /**
     * 🎵 FASE 3: OBTENER ESTADÍSTICAS DE COMPRESIÓN
     * Devuelve métricas de compresión para monitoreo
     */
    getCompressionStats(): {
        totalFiles: number;
        compressedFiles: number;
        averageRatio: number;
        totalSpaceSaved: number;
    };
    /**
     * 🎯 FASE 3: CACHE INTELIGENTE - HIGH QUALITY ART ONLY
     * Evalúa si el arte es digno de preservación eterna (quality >= 0.95 for legendary)
     * Para FORJA 9.0: MIDI usa combinación de vectores 4D con umbral más accesible
     */
    private isLegendaryArt;
    /**
     * 🎯 FASE 3: SISTEMA DE PRIORIDADES DE CACHE
     * Asigna prioridad basada en calidad artística (0-10, donde 10 es máxima prioridad)
     */
    private getCachePriority;
    /**
     * 🎯 FASE 3: GESTIÓN INTELIGENTE DE MEMORIA
     * Aplica política de cache simple: mantiene límites de memoria usando ltrim
     * DIRECTIVA 12.10: Restauración de política de caché normal
     */
    private enforceLegendaryCachePolicy;
    /**
     * 🎯 FASE 3: LÍMITES DE MEMORIA INTELIGENTES
     * Mantiene solo los mejores arte basados en calidad y prioridad
     */
    private enforceMemoryLimits;
    /**
     * 🎯 FASE 3: ESTADÍSTICAS DE CACHE LEGENDARIO
     * Devuelve métricas del sistema de cache inteligente
     */
    getLegendaryCacheStats(): Promise<{
        totalLegendaryItems: number;
        midiLegendaryCount: number;
        poemLegendaryCount: number;
        fileLegendaryCount: number;
        averageQuality: number;
        memoryEfficiency: number;
    }>;
    /**
     * 🎯 FASE 3: LIMPIEZA DE CACHE MANUAL
     * Fuerza limpieza inmediata del cache no legendario
     */
    forceLegendaryCacheCleanup(): Promise<void>;
    /**
     * Hash string to number (deterministic)
     */
    private hashString;
    /**
     * Determine winning musical note from consensus result
     */
    private determineWinningNote;
    /**
     * Generate main melody for the composition
     */
    private generateMelody;
    /**
     * Generate harmony notes to accompany the melody
     */
    private generateHarmony;
    /**
     * Generate rhythmic elements (bass/drums)
     */
    private generateRhythm;
    /**
     * Convert note name to frequency
     */
    private noteToFrequency;
    /**
     * Generate Veritas RSA signature for NFT metadata
     */
    generateVeritasSignature(poetryData: any): Promise<string>;
    /**
     * 🎯 FIBONACCI PATTERN ENGINE - Calculate mathematical harmony ratio
     * Extracts harmony from fibonacci sequences in musical patterns
     */
    private calculateHarmonyRatio;
    /**
     * 🎵 MUSICAL HARMONY VALIDATOR - Advanced musical quality metrics
     * Validates musical harmony through multiple dimensions
     */
    private validateMusicalHarmony;
    /**
     * Helper: Group notes by time for chord analysis
     */
    private groupNotesByTime;
    /**
     * Helper: Check if pitches form a major triad
     */
    private isMajorTriad;
    /**
     * Helper: Check if pitches form a minor triad
     */
    private isMinorTriad;
    /**
     * Helper: Convert MIDI pitch to frequency
     */
    private midiToFrequency;
    /**
     * Helper: Simplify frequency ratio to smallest integer ratio
     */
    private simplifyRatio;
    /**
     * 🎯 CALCULATE RARITY BONUS - Directiva de Forja 4.0
     * Bonus basado en la frecuencia de patrones Note-Sign (nota musical + signo zodiacal)
     */
    private calculateRarityBonus;
    /**
     * 🎯 FORJA 7.1: Generate Procedural Profile Vector (4D) with Fibonacci Harmony
     * Returns multidimensional classification instead of scalar quality score
     * Now includes mathematical harmony analysis using Fibonacci ratios
     */
    /**
     * Basic musical quality evaluation (music-only, before poetry generation)
     * Evaluates core musical elements with lower threshold for art generation
     */
    evaluateBasicMusicalQuality(result: ConsensusResult, midiNotes: Array<MIDINote>): number;
    /**
     * Evaluate melodic complexity based on pitch variety and patterns
     */
    private evaluateMelodicComplexity;
    /**
     * Evaluate harmonic coherence (chord progressions, consonance)
     */
    private evaluateHarmonicCoherence;
    /**
     * Evaluate rhythmic variety and interest
     */
    private evaluateRhythmicVariety;
    /**
     * Evaluate structural balance and form
     */
    private evaluateStructuralBalance;
    /**
     * Evaluate dynamic range and expression
     */
    private evaluateDynamicRange;
    /**
     * Evaluate synergy between poetry and music
     */
    private evaluatePoeticSynergy;
    /**
     * Evaluate emotional depth based on consensus and poetry - influenced by leader personality
     */
    private evaluateEmotionalDepth;
    /**
     * Evaluate technical proficiency of the composition - influenced by leader personality
     */
    private evaluateTechnicalProficiency;
    /**
     * Evaluate innovation and uniqueness - influenced by leader personality
     */
    private evaluateInnovationFactor;
    /**
     * Get emotional depth based on zodiac sign
     */
    private getZodiacEmotionalDepth;
    /**
     * � SSE-7.2: PRNG DETERMINISTA (Linear Congruential Generator)
     * Genera números pseudoaleatorios reproducibles basados en semilla
     * @param seed - Semilla para el generador
     * @returns Número entre 0 y 1
     */
    private seededRandom;
    /**
     * 🎲 SSE-7.2: PRNG RANGE DETERMINISTA
     * Genera entero aleatorio en rango [min, max] basado en semilla
     * @param seed - Semilla para el generador
     * @param min - Valor mínimo (inclusive)
     * @param max - Valor máximo (inclusive)
     * @returns Entero en rango [min, max]
     */
    private seededRandomInt;
    /**
     * �🎵 DIRECTIVA 13.5: COMPONER SINFONÍA DE CONSENSO PROCEDIMENTAL
     * Genera sinfonías musicales épicas de 20-60 segundos usando algoritmos completamente deterministas
     * con proporciones Fibonacci, modos zodiacales, belleza del consenso y densidad de participantes
     */
    private composeConsensusSymphony;
    /**
     * 🎹 GENERAR CAPA DE ARMONÍA: Acompañamiento armónico determinista
     */
    private generateHarmonyLayer;
    /**
     * 🥁 GENERAR CAPA RÍTMICA: Elementos percusivos deterministas
     */
    private generateRhythmLayer;
    /**
     * 🎹 GENERAR ACORDE DETERMINISTA basado en modo musical
     */
    private generateChord;
    /**
     * 🎵 GENERAR MELODÍA FIBONACCI: Melodía determinista usando proporción áurea
     */
    private generateFibonacciMelody;
    private generateConsensusPoetry;
    /**
     * Stop recording and export to MIDI file
     */
    stopRecording(filename?: string): Promise<string>;
    /**
     * Get recording statistics
     */
    getStats(): {
        noteCount: number;
        duration: number;
        isRecording: boolean;
    };
    /**
     * Save basic consensus data to dashboard keys (selene:consensus:latest and history)
     */
    /**
     * Create MIDI buffer from recorded notes
     */
    private createMIDIBuffer;
    /**
     * Compress MIDI buffer using simple RLE
     */
    private compressMIDI;
    /**
     * Write variable length quantity to array
     */
    private writeVariableLength;
    /**
     * 🎭 SELECCIÓN PONDERADA DE PALABRAS (Mezclador Temático)
     * 70% probabilidad de elegir de fuente primaria (zodiacal)
     * 30% probabilidad de elegir de fuentes suplementarias
     * Con influencia numerológica opcional
     */
    private selectWeightedWord;
    /**
     * 🧬 EXTRAER PALABRAS DE LIBRERÍAS SUPLEMENTARIAS
     * Convierte las estructuras contextuales en arrays de palabras
     */
    private extractWordsFromSupplements;
    /**
     * 🔍 EXTRAER PALABRAS ESPECÍFICAS DE UNA FRASE
     */
    private extractWordsFromPhrase;
    /**
     * 🎯 DIRECTIVA 12.13: Clasificar perfil procedural basado en métricas 4D
     */
    private classifyProfile;
    /**
     * 🎯 DIRECTIVA 12.13: Exportar estadísticas del perfil log
     */
    exportProfileStats(): any;
    /**
     * 🎯 DIRECTIVA 12.13: Limpiar el log de perfiles
     */
    clearProfileLog(): void;
    /**
     * 🎯 DIRECTIVA 12.13: Capturar vector de perfil para debug en tiempo real
     */
    private captureProfileVector;
    /**
     * 🎸 SSE-7.2-VALIDATE: Public test method para validar generación multi-modo
     * Permite acceso directo a composeConsensusSymphony para testing
     * @param result - ConsensusResult para generar MIDI
     * @returns Array de MIDINote generadas
     */
    testGenerateMIDI(result: ConsensusResult): Array<MIDINote>;
    /**
     * 🧪 TEST METHOD: Generate poetry for validation purposes
     * Used by test_validate_poetry.mjs to verify mode-aware poetry generation
     * SSE-7.6: Simplified to remove IntentParameters (mode-driven architecture)
     */
    testGeneratePoetry(result: ConsensusResult): Promise<any>;
    /**
     * Initialize engine (lifecycle method)
     * SSE-7.7: Moved initialization logic from constructor
     */
    initialize(): Promise<void>;
    /**
     * Graceful shutdown (lifecycle method)
     * SSE-7.7: Implement Redis disconnect and cleanup
     */
    shutdown(): Promise<void>;
    /**
     * Get current engine status (lifecycle method)
     * SSE-7.7: Return operational status
     */
    getStatus(): EngineStatus;
    /**
     * Generate music output (core generation method)
     * SSE-7.7: Adapt recordConsensusEvent to use EngineInput/EngineOutput
     */
    generate(input: EngineInput, mode: ModeConfig): Promise<EngineOutput>;
    /**
     * Apply mode transformations (mode integration)
     * SSE-7.7: Placeholder - mode already applied in generation
     */
    applyMode(mode: ModeConfig, baseOutput: any): any;
    /**
     * Calculate entropy (mode integration)
     * SSE-7.7: Return normalized entropy factor
     */
    calculateEntropy(input: any, mode: ModeConfig): number;
    /**
     * Get rate limits (monetization)
     * SSE-7.7: Define tier-based limits
     */
    getRateLimits(tier: UserTier): RateLimits;
    /**
     * Get usage metrics (monetization)
     * SSE-7.7: Return placeholder metrics
     */
    getUsageMetrics(): UsageMetrics;
    /**
     * Report metrics (evolution)
     * SSE-7.7: Connect to SynergyEngine
     */
    reportMetrics(metrics: EngineMetrics): Promise<void>;
    /**
     * Receive feedback (evolution)
     * SSE-7.7: Process user feedback and adjust weights
     */
    receiveFeedback(feedback: EngineFeedback): Promise<void>;
}
interface ConsensusResult {
    consensusAchieved: boolean;
    participants: string[];
    consensusTime: number;
    beauty: number;
}
interface MIDINote {
    pitch: number;
    duration: number;
    velocity: number;
    time: number;
}
export {};
//# sourceMappingURL=MusicalConsensusRecorder.d.ts.map