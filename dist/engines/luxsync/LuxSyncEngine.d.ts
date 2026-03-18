/**
 * 🎸⚡ LUXSYNC ENGINE - ORQUESTADOR PRINCIPAL
 * Conecta todo el pipeline: Audio → Consciousness → Evolution → Consensus → Lights
 *
 * PIPELINE:
 * 1. AudioFrame (Audio Engine)
 * 2. MusicalPattern (AudioToPatternMapper)
 * 3. PatternAnalysis (Consciousness - Hunting Layer)
 * 4. Scene Generation (SceneEvolver)
 * 5. Creative Suggestions (Consciousness - Dream Layer)
 * 6. Ethics Validation (Consciousness - Ethics Layer)
 * 7. Harmonic Voting (HarmonicController)
 * 8. Scene Refinement (Consensus + Smoothing)
 * 9. DMX Conversion (SceneBuilder)
 * 10. Hardware Output (TornadoDriver/VirtualDMX)
 *
 * 🎯 Objetivo: Latencia < 100ms end-to-end
 */
import { AudioEngine, AudioFrame } from '../audio/index.js';
import { VirtualDMXDriver } from '../dmx/VirtualDMXDriver.js';
import { MusicalPattern } from './AudioToPatternMapper.js';
import { LightScene } from './SceneEvolver.js';
import { PatternAnalysis } from './ConsciousnessIntegration.js';
import { ConsensusResult } from './HarmonicController.js';
/**
 * ESTADO DEL SISTEMA
 */
export interface LuxSyncState {
    currentPattern: MusicalPattern | null;
    currentAnalysis: PatternAnalysis | null;
    currentScene: LightScene | null;
    lastConsensus: ConsensusResult | null;
    frameCount: number;
    avgLatency: number;
    isRunning: boolean;
}
/**
 * MÉTRICAS DE PERFORMANCE
 */
export interface PerformanceMetrics {
    totalFrames: number;
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    framesUnder50ms: number;
    framesUnder100ms: number;
}
/**
 * CONFIGURACIÓN
 */
export interface LuxSyncConfig {
    fixtureCount: number;
    scenePoolSize: number;
    mutationRate: number;
    learningEnabled: boolean;
    ethicsEnabled: boolean;
    targetLatency: number;
}
/**
 * LUXSYNC ENGINE
 */
export declare class LuxSyncEngine {
    private audioEngine;
    private dmxDriver;
    private patternMapper;
    private sceneEvolver;
    private consciousness;
    private harmonic;
    private state;
    private config;
    private latencyHistory;
    private processingInterval;
    constructor(audioEngine: AudioEngine, dmxDriver: VirtualDMXDriver, config?: Partial<LuxSyncConfig>);
    /**
     * Inicializar sistema
     */
    initialize(): Promise<void>;
    /**
     * Procesar un frame de audio completo (pipeline end-to-end)
     */
    processAudioFrame(frame: AudioFrame): Promise<void>;
    /**
     * Convertir escena a comandos DMX
     */
    private sceneToDMX;
    /**
     * Start processing loop
     */
    start(fps?: number): Promise<void>;
    /**
     * Stop processing loop
     */
    stop(): void;
    /**
     * Get current state
     */
    getState(): LuxSyncState;
    /**
     * Get performance metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Self-analysis: Learn from experience
     */
    learn(): void;
    /**
     * Close engine
     */
    close(): Promise<void>;
    private hexToRGB;
}
//# sourceMappingURL=LuxSyncEngine.d.ts.map