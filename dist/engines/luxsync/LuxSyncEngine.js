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
import { AudioToPatternMapper } from './AudioToPatternMapper.js';
import { SceneEvolver } from './SceneEvolver.js';
import { ConsciousnessIntegration } from './ConsciousnessIntegration.js';
import { HarmonicController } from './HarmonicController.js';
/**
 * LUXSYNC ENGINE
 */
export class LuxSyncEngine {
    audioEngine;
    dmxDriver;
    patternMapper;
    sceneEvolver;
    consciousness;
    harmonic;
    state;
    config;
    latencyHistory = [];
    processingInterval = null;
    constructor(audioEngine, dmxDriver, config) {
        this.audioEngine = audioEngine;
        this.dmxDriver = dmxDriver;
        // Módulos de procesamiento
        this.patternMapper = new AudioToPatternMapper();
        this.sceneEvolver = new SceneEvolver();
        this.consciousness = new ConsciousnessIntegration();
        this.harmonic = new HarmonicController();
        // Configuración
        this.config = {
            fixtureCount: 4,
            scenePoolSize: 3,
            mutationRate: 0.2,
            learningEnabled: true,
            ethicsEnabled: true,
            targetLatency: 50,
            ...config
        };
        // Estado inicial
        this.state = {
            currentPattern: null,
            currentAnalysis: null,
            currentScene: null,
            lastConsensus: null,
            frameCount: 0,
            avgLatency: 0,
            isRunning: false
        };
    }
    /**
     * Inicializar sistema
     */
    async initialize() {
        console.log('🎸 Initializing LuxSyncEngine...');
        // Inicializar Audio Engine
        await this.audioEngine.initialize();
        console.log('✅ Audio Engine initialized');
        // Inicializar DMX Driver
        await this.dmxDriver.initialize();
        console.log('✅ DMX Driver initialized');
        // Inicializar Swarm
        this.harmonic.initSwarm();
        console.log('✅ Harmonic Swarm initialized (7 nodes: Do-Si)');
        console.log('🚀 LuxSyncEngine ready!');
    }
    /**
     * Procesar un frame de audio completo (pipeline end-to-end)
     */
    async processAudioFrame(frame) {
        const startTime = Date.now();
        try {
            // 1. Audio → Musical Pattern
            const pattern = this.patternMapper.toSelenePattern(frame);
            this.state.currentPattern = pattern;
            // 2. Consciousness: Pattern Analysis (Hunting Layer)
            const analysis = this.consciousness.analyzePattern(pattern);
            this.state.currentAnalysis = analysis;
            // 3. Scene Evolution: Generate pool of scenes
            const scenePool = [];
            // Generar escena base
            const baseScene = this.sceneEvolver.generateScene(pattern, this.config.fixtureCount);
            scenePool.push(baseScene);
            // Si ya hay escena, mutar para generar variantes
            if (this.state.currentScene) {
                for (let i = 0; i < this.config.scenePoolSize - 1; i++) {
                    const mutated = this.sceneEvolver.mutateScene(this.state.currentScene, this.config.mutationRate);
                    scenePool.push(mutated);
                }
            }
            else {
                // Si no hay escena previa, generar variaciones del base
                for (let i = 0; i < this.config.scenePoolSize - 1; i++) {
                    const variant = this.sceneEvolver.mutateScene(baseScene, this.config.mutationRate);
                    scenePool.push(variant);
                }
            }
            // 4. Dream Layer: Agregar sugerencias creativas
            if (Math.random() < 0.3) { // 30% chance de idea creativa
                const dreams = this.consciousness.dreamScenes(pattern, 1);
                if (dreams.length > 0) {
                    // Aplicar dream genes a una escena random del pool
                    const dreamScene = { ...scenePool[0] };
                    dreamScene.genes = { ...dreamScene.genes, ...dreams[0].genes };
                    scenePool.push(dreamScene);
                }
            }
            // 5. Ethics Layer: Validar seguridad
            if (this.config.ethicsEnabled) {
                scenePool.forEach(scene => {
                    const validation = this.consciousness.ethicsCheck(scene);
                    if (!validation.safe) {
                        // Aplicar ajustes de seguridad
                        scene.genes = { ...scene.genes, ...validation.adjustments };
                    }
                });
            }
            // 6. Harmonic Consensus: Voting
            const consensus = this.harmonic.voteOnScenes(scenePool, pattern);
            this.state.lastConsensus = consensus;
            // 7. Aplicar consenso con transición suave
            const smoothedScene = this.harmonic.applyConsensus(this.state.currentScene, consensus.winningScene, consensus, 500 // 500ms transition
            );
            // 8. Scene → DMX
            this.sceneToDMX(smoothedScene);
            // 9. Memory Layer: Recordar escena
            if (this.config.learningEnabled) {
                const feedback = {
                    audioCorrelation: consensus.consensusStrength,
                    stability: 0.8 // Placeholder
                };
                const fitness = this.sceneEvolver.evaluateFitness(smoothedScene, feedback);
                this.consciousness.rememberScene(smoothedScene, fitness);
            }
            // Actualizar estado
            this.state.currentScene = smoothedScene;
            this.state.frameCount++;
            // Calcular latencia
            const latency = Date.now() - startTime;
            this.latencyHistory.push(latency);
            if (this.latencyHistory.length > 100) {
                this.latencyHistory.shift();
            }
            this.state.avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
            // Warning si latencia muy alta
            if (latency > this.config.targetLatency * 2) {
                console.warn(`⚠️ High latency: ${latency}ms (target: ${this.config.targetLatency}ms)`);
            }
        }
        catch (error) {
            console.error('❌ Error processing frame:', error);
        }
    }
    /**
     * Convertir escena a comandos DMX
     */
    sceneToDMX(scene) {
        const { genes } = scene;
        // Parse color palette
        const primaryColor = this.hexToRGB(genes.colorPalette[0] || '#FFFFFF');
        // Aplicar brightness
        const r = Math.floor(primaryColor.r * genes.brightness);
        const g = Math.floor(primaryColor.g * genes.brightness);
        const b = Math.floor(primaryColor.b * genes.brightness);
        // Aplicar a todos los fixtures
        for (let i = 0; i < this.config.fixtureCount; i++) {
            const startChannel = i * 3 + 1; // 3 channels per fixture (RGB)
            this.dmxDriver.sendDMX(startChannel, [r, g, b]);
        }
    }
    /**
     * Start processing loop
     */
    async start(fps = 4) {
        if (this.state.isRunning) {
            console.warn('⚠️ LuxSyncEngine already running');
            return;
        }
        this.state.isRunning = true;
        const interval = 1000 / fps;
        console.log(`🎸 Starting LuxSyncEngine at ${fps} FPS (${interval}ms interval)`);
        this.processingInterval = setInterval(async () => {
            try {
                const frame = await this.audioEngine.getFrame();
                await this.processAudioFrame(frame);
            }
            catch (error) {
                console.error('❌ Error in processing loop:', error);
            }
        }, interval);
    }
    /**
     * Stop processing loop
     */
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.state.isRunning = false;
        console.log('🛑 LuxSyncEngine stopped');
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get performance metrics
     */
    getMetrics() {
        const framesUnder50ms = this.latencyHistory.filter(l => l < 50).length;
        const framesUnder100ms = this.latencyHistory.filter(l => l < 100).length;
        return {
            totalFrames: this.state.frameCount,
            avgLatency: this.state.avgLatency,
            maxLatency: Math.max(...this.latencyHistory, 0),
            minLatency: Math.min(...this.latencyHistory, Infinity),
            framesUnder50ms,
            framesUnder100ms
        };
    }
    /**
     * Self-analysis: Learn from experience
     */
    learn() {
        const analysis = this.consciousness.selfAnalysis();
        console.log('\n🧠 SELF-ANALYSIS REPORT:');
        console.log('========================');
        analysis.insights.forEach(insight => console.log(insight));
        console.log(`📊 Best patterns: ${analysis.bestPatterns.join(', ')}`);
        console.log(`⭐ Avg success rate: ${(analysis.avgSuccessRate * 100).toFixed(1)}%`);
        console.log('========================\n');
    }
    /**
     * Close engine
     */
    async close() {
        this.stop();
        await this.audioEngine.close();
        console.log('👋 LuxSyncEngine closed');
    }
    // ===== HELPERS =====
    hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }
}
//# sourceMappingURL=LuxSyncEngine.js.map