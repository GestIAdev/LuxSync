/**
 * demo-audio-lights-simple.ts
 * 🎵💡 Demo simplificado con MODO MANUAL
 *
 * Versión para testing rápido con control manual
 * Presiona teclas para simular diferentes beats
 */
import { VirtualDMXDriver } from './engines/dmx/VirtualDMXDriver.js';
import { TerminalVisualizer } from './engines/dmx/TerminalVisualizer.js';
import * as readline from 'readline';
// Configurar readline para capturar teclas
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}
async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                           ║');
    console.log('║            🎵💡 LUXSYNC - CONTROL MANUAL INTERACTIVO 💡🎵               ║');
    console.log('║                                                                           ║');
    console.log('║                    ¡Controla las luces con el teclado!                   ║');
    console.log('║                                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  🎹 CONTROLES:');
    console.log('     [1]     = BASS (Rojo) 🔴');
    console.log('     [2]     = MID (Verde) 🟢');
    console.log('     [3]     = TREBLE (Azul) 🔵');
    console.log('     [SPACE] = BEAT (Flash blanco) ⚪');
    console.log('     [R]     = Rainbow test 🌈');
    console.log('     [B]     = Blackout 🌑');
    console.log('     [Q]     = Salir 👋');
    console.log('');
    console.log('  💡 TIP: Presiona teclas para "tocar" las luces como un instrumento');
    console.log('  🎵 Refresh: 5 FPS (cada 200ms) - Velocidad perfecta para humanos 😎');
    console.log('');
    const dmx = new VirtualDMXDriver({
        universeSize: 512,
        updateRate: 44,
        logUpdates: false,
    });
    const visualizer = new TerminalVisualizer({
        fixtureCount: 4,
        channelsPerFixture: 3,
        refreshRate: 5, // 5 FPS = mucho más chill para terminal
        showBars: true,
        showHex: true,
    });
    await dmx.initialize();
    console.log('');
    console.log('✅ Sistema listo - Presiona teclas para controlar las luces');
    console.log('');
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let beat = 0;
    let beatDecay = 0;
    let bpm = 0;
    let lastBeatTime = 0;
    // Loop de renderizado (5 FPS = 200ms por frame)
    const renderInterval = setInterval(() => {
        // Decaimiento natural (más lento para que se vea)
        bass *= 0.85;
        mid *= 0.85;
        treble *= 0.85;
        beat *= 0.80;
        // Decaimiento de beat visual
        const now = Date.now();
        const timeSinceBeat = now - lastBeatTime;
        beatDecay = Math.max(0, 1 - (timeSinceBeat / 300));
        // Actualizar luces
        const bassR = Math.floor(bass * 255);
        const bassG = Math.floor(bass * 255 * 0.2);
        dmx.sendDMX(1, [bassR, bassG, 0]);
        const midR = Math.floor(mid * 255 * 0.3);
        const midG = Math.floor(mid * 255);
        dmx.sendDMX(4, [midR, midG, 0]);
        const trebleG = Math.floor(treble * 255 * 0.4);
        const trebleB = Math.floor(treble * 255);
        dmx.sendDMX(7, [0, trebleG, trebleB]);
        const beatIntensity = Math.floor(beat * beatDecay * 255);
        dmx.sendDMX(10, [beatIntensity, beatIntensity, beatIntensity]);
        // Renderizar
        const universe = dmx.getUniverse();
        visualizer.render(universe, {
            beat: beatDecay > 0.8,
            beatStrength: beat * beatDecay,
            bpm,
            bass,
            mid,
            treble,
            rms: (bass + mid + treble) / 3,
        });
    }, 200); // 5 FPS = 200ms = Mucho más chill y legible 😎
    // Capturar teclas
    process.stdin.on('keypress', async (str, key) => {
        if (!key)
            return;
        if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
            clearInterval(renderInterval);
            await dmx.close();
            process.exit(0);
        }
        // BASS (tecla 1)
        if (key.name === '1') {
            bass = 1.0;
        }
        // MID (tecla 2)
        if (key.name === '2') {
            mid = 1.0;
        }
        // TREBLE (tecla 3)
        if (key.name === '3') {
            treble = 1.0;
        }
        // BEAT (barra espaciadora)
        if (key.name === 'space') {
            beat = 1.0;
            lastBeatTime = Date.now();
            // Calcular BPM simple
            if (lastBeatTime > 0) {
                const interval = lastBeatTime - (lastBeatTime - 500); // aproximado
                bpm = Math.round(60000 / 500); // ~120 BPM
            }
        }
        // RAINBOW TEST (tecla R)
        if (key.name === 'r') {
            console.log('\n🌈 Iniciando rainbow test (5 segundos)...\n');
            clearInterval(renderInterval);
            await dmx.rainbowTest(5000);
            process.exit(0);
        }
        // BLACKOUT (tecla B)
        if (key.name === 'b') {
            dmx.blackout();
            bass = 0;
            mid = 0;
            treble = 0;
            beat = 0;
        }
    });
}
main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
//# sourceMappingURL=demo-manual-control.js.map