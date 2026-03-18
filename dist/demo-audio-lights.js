/**
 * demo-audio-lights.ts
 * 🎵💡 Demo de sincronización Audio → Luces
 *
 * Conecta AudioEngine + VirtualDMX + TerminalVisualizer
 * Las luces reaccionan a beats y frecuencias en tiempo real
 */
import { AudioEngine } from './engines/audio/index.js';
import { AudioSimulator } from './engines/audio/AudioSimulator.js';
import { VirtualDMXDriver } from './engines/dmx/VirtualDMXDriver.js';
import { TerminalVisualizer } from './engines/dmx/TerminalVisualizer.js';
async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                           ║');
    console.log('║            🎵💡 LUXSYNC - AUDIO REACTIVE LIGHTS DEMO 💡🎵               ║');
    console.log('║                                                                           ║');
    console.log('║              ¡Las luces bailan con la música en tiempo real!             ║');
    console.log('║                                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    // Crear componentes
    const audioEngine = new AudioEngine();
    const audioSimulator = new AudioSimulator(128); // 128 BPM por defecto
    let useSimulator = false;
    const dmx = new VirtualDMXDriver({
        universeSize: 512,
        updateRate: 44,
        logUpdates: false, // No logs para no interferir con visualizador
    });
    const visualizer = new TerminalVisualizer({
        fixtureCount: 4,
        channelsPerFixture: 3,
        refreshRate: 4, // 4 FPS = legible sin mareo 😌
        showBars: true,
        showHex: true,
    });
    try {
        // Inicializar audio
        console.log('🎤 Inicializando captura de audio...');
        console.log('   (Si no hay micrófono, simulará audio)');
        console.log('');
        try {
            await audioEngine.initialize();
            console.log('✅ Audio Engine inicializado - Capturando audio real');
            console.log('   🎤 Reproduce música o haz sonidos para ver las luces reaccionar');
        }
        catch (audioError) {
            console.log('⚠️  No se detectó micrófono - Usando simulación');
            console.log('   🎵 Simulando música a 128 BPM con beats sintéticos');
            console.log('   (Para audio real, ejecuta en navegador o con micrófono conectado)');
            useSimulator = true;
        }
        console.log('');
        // Inicializar DMX
        await dmx.initialize();
        console.log('');
        // Variables de estado
        let lastBeatTime = 0;
        let beatDecay = 0; // Decaimiento del beat (1.0 → 0 en ~500ms)
        // Loop principal de sincronización
        console.log('🎬 Iniciando sincronización Audio → Luces...');
        console.log('   Presiona Ctrl+C para detener');
        console.log('');
        await sleep(1000);
        // Función de renderizado continuo
        const renderLoop = async () => {
            while (true) {
                // Obtener frame de audio (real o simulado)
                const audioFrame = useSimulator
                    ? await audioSimulator.getFrame()
                    : await audioEngine.getFrame();
                // Decaimiento del beat
                const now = Date.now();
                const timeSinceBeat = now - lastBeatTime;
                beatDecay = Math.max(0, 1 - (timeSinceBeat / 500)); // Decae en 500ms
                // Si hay beat nuevo, resetear decay
                if (audioFrame.beat) {
                    lastBeatTime = now;
                    beatDecay = 1.0;
                }
                // ESTRATEGIA DE ILUMINACIÓN:
                // - PAR 1: Reacciona a BASS (Rojo)
                // - PAR 2: Reacciona a MID (Verde)
                // - PAR 3: Reacciona a TREBLE (Azul)
                // - PAR 4: Mezcla total con beat intensity
                // PAR 1 - BASS (Rojo)
                const bass = audioFrame.bass;
                const bassIntensity = Math.floor(bass * 255);
                const bassR = bassIntensity;
                const bassG = Math.floor(bassIntensity * 0.2); // Ligero tinte naranja
                const bassB = 0;
                dmx.sendDMX(1, [bassR, bassG, bassB]);
                // PAR 2 - MID (Verde/Amarillo)
                const mid = audioFrame.mid;
                const midIntensity = Math.floor(mid * 255);
                const midR = Math.floor(midIntensity * 0.3); // Tinte amarillento
                const midG = midIntensity;
                const midB = 0;
                dmx.sendDMX(4, [midR, midG, midB]);
                // PAR 3 - TREBLE (Azul/Cyan)
                const treble = audioFrame.treble;
                const trebleIntensity = Math.floor(treble * 255);
                const trebleR = 0;
                const trebleG = Math.floor(trebleIntensity * 0.4); // Tinte cyan
                const trebleB = trebleIntensity;
                dmx.sendDMX(7, [trebleR, trebleG, trebleB]);
                // PAR 4 - BEAT RESPONDER (Blanco con beats)
                const beatIntensity = Math.floor(beatDecay * audioFrame.beatStrength * 255);
                const whiteR = beatIntensity;
                const whiteG = beatIntensity;
                const whiteB = beatIntensity;
                dmx.sendDMX(10, [whiteR, whiteG, whiteB]);
                // Renderizar visualización
                const universe = dmx.getUniverse();
                visualizer.render(universe, {
                    beat: audioFrame.beat,
                    beatStrength: audioFrame.beatStrength * beatDecay,
                    bpm: audioFrame.bpm,
                    bass: audioFrame.bass,
                    mid: audioFrame.mid,
                    treble: audioFrame.treble,
                    rms: audioFrame.rms,
                });
                // 4 FPS = 250ms por frame (mucho más chill)
                await sleep(250);
            }
        };
        // Iniciar loop
        await renderLoop();
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await audioEngine.close();
        await dmx.close();
        console.log('\n✅ Demo cerrada correctamente\n');
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Manejo de señales de cierre
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Deteniendo demo...\n');
    process.exit(0);
});
// Ejecutar
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=demo-audio-lights.js.map