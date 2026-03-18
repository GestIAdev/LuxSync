/**
 * 🌙🎸 DEMO - SELENE AI
 * Demostración completa de Selene Consciousness + LuxSync Pipeline
 *
 * MUESTRA:
 * - Audio → Pattern → Consciousness → Evolver → Consensus → Lights
 * - Decisiones de Selene en tiempo real
 * - Votos de nodos musicales (Do-Si)
 * - Métricas de performance
 */
import { AudioSimulator } from './engines/audio/AudioSimulator.js';
import { VirtualDMXDriver } from './engines/dmx/VirtualDMXDriver.js';
import { TerminalVisualizer } from './engines/dmx/TerminalVisualizer.js';
import { LuxSyncEngine } from './engines/luxsync/LuxSyncEngine.js';
// ===== CONFIGURACIÓN =====
const FPS = 4; // 4 frames por segundo (250ms entre frames)
const TOTAL_DURATION = 30_000; // 30 segundos de demo
const LEARNING_INTERVAL = 10_000; // Análisis cada 10 segundos
// ===== MAIN =====
async function main() {
    console.clear();
    console.log('🌙🎸⚡ SELENE AI + LUXSYNC DEMO ⚡🎸🌙');
    console.log('='.repeat(60));
    console.log('Pipeline: Audio → Consciousness → Evolution → Consensus → DMX');
    console.log('='.repeat(60));
    console.log('');
    // Inicializar módulos
    console.log('🔧 Inicializando módulos...\n');
    // Usar AudioSimulator directamente (actúa como AudioEngine)
    const audioEngine = new AudioSimulator(128); // 128 BPM
    const dmxDriver = new VirtualDMXDriver({
        universeSize: 512,
        updateRate: 44,
        logUpdates: false
    });
    const visualizer = new TerminalVisualizer({
        fixtureCount: 4,
        channelsPerFixture: 3,
        refreshRate: FPS,
        showBars: true,
        showHex: true
    });
    const luxsync = new LuxSyncEngine(audioEngine, dmxDriver, {
        fixtureCount: 4,
        scenePoolSize: 3,
        mutationRate: 0.2,
        learningEnabled: true,
        ethicsEnabled: true,
        targetLatency: 50
    });
    // Inicializar
    await luxsync.initialize();
    console.log('✅ Todos los módulos inicializados\n');
    console.log('🎬 Iniciando demo por', TOTAL_DURATION / 1000, 'segundos...');
    console.log('(Presiona Ctrl+C para salir)\n');
    // Setup visualizer
    dmxDriver.on('dmxUpdate', (universe) => {
        const state = luxsync.getState();
        const audioContext = {
            bass: state.currentPattern?.spectralProfile.bass || 0,
            mid: state.currentPattern?.spectralProfile.mid || 0,
            treble: state.currentPattern?.spectralProfile.treble || 0,
            rms: state.currentPattern?.energy || 0,
            beat: false,
            beatStrength: 0,
            bpm: state.currentPattern?.bpm || 0
        };
        visualizer.render(universe, audioContext);
        // Imprimir decisiones de Selene cada N frames
        if (state.frameCount % 10 === 0 && state.currentAnalysis) {
            printSeleneDecisions(state);
        }
    });
    // Start LuxSync
    await luxsync.start(FPS);
    // Self-analysis periódico
    const learningInterval = setInterval(() => {
        console.log('\n');
        luxsync.learn();
        printMetrics(luxsync);
    }, LEARNING_INTERVAL);
    // Auto-stop después de duración
    setTimeout(async () => {
        clearInterval(learningInterval);
        console.log('\n⏹️  Demo completado\n');
        // Análisis final
        console.log('📊 REPORTE FINAL:');
        console.log('='.repeat(60));
        luxsync.learn();
        printMetrics(luxsync);
        await luxsync.close();
        process.exit(0);
    }, TOTAL_DURATION);
    // Handle Ctrl+C
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Cerrando demo...\n');
        clearInterval(learningInterval);
        await luxsync.close();
        process.exit(0);
    });
}
// ===== HELPERS =====
function printSeleneDecisions(state) {
    if (!state.currentAnalysis || !state.currentPattern)
        return;
    console.log('\n🧠 SELENE DECISIONS (Frame ' + state.frameCount + '):');
    console.log('─'.repeat(60));
    // Pattern info
    console.log(`🎵 Mood: ${state.currentPattern.mood.toUpperCase()}`);
    console.log(`🎯 Pattern: ${state.currentAnalysis.patternType} (confidence: ${(state.currentAnalysis.confidence * 100).toFixed(0)}%)`);
    console.log(`⚡ Energy: ${(state.currentPattern.energy * 100).toFixed(0)}%`);
    console.log(`📊 Entropy: ${(state.currentPattern.entropy * 100).toFixed(0)}%`);
    // Consensus info
    if (state.lastConsensus) {
        console.log(`🎼 Consensus: ${(state.lastConsensus.consensusStrength * 100).toFixed(0)}% agreement`);
        console.log(`👑 Dominant Nodes: ${state.lastConsensus.dominantNodes.join(', ')}`);
        // Top 3 votes
        const topVotes = state.lastConsensus.votes
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        console.log('🗳️  Top Votes:');
        topVotes.forEach((vote, i) => {
            console.log(`   ${i + 1}. ${vote.node}: ${(vote.score * 100).toFixed(0)}% - ${vote.reasoning}`);
        });
    }
    // Suggestions
    if (state.currentAnalysis.suggestions.length > 0) {
        console.log('💡 Suggestions:');
        state.currentAnalysis.suggestions.forEach((sug) => {
            console.log(`   ${sug}`);
        });
    }
    console.log('─'.repeat(60) + '\n');
}
function printMetrics(luxsync) {
    const metrics = luxsync.getMetrics();
    console.log('⏱️  PERFORMANCE METRICS:');
    console.log('─'.repeat(60));
    console.log(`Total Frames: ${metrics.totalFrames}`);
    console.log(`Avg Latency: ${metrics.avgLatency.toFixed(2)}ms`);
    console.log(`Min/Max: ${metrics.minLatency.toFixed(2)}ms / ${metrics.maxLatency.toFixed(2)}ms`);
    console.log(`Frames < 50ms: ${metrics.framesUnder50ms} (${(metrics.framesUnder50ms / metrics.totalFrames * 100).toFixed(1)}%)`);
    console.log(`Frames < 100ms: ${metrics.framesUnder100ms} (${(metrics.framesUnder100ms / metrics.totalFrames * 100).toFixed(1)}%)`);
    console.log('─'.repeat(60));
}
// ===== RUN =====
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=demo-selene-ai.js.map