/**
 * demo-virtual-lights.ts
 * 🎨 Demo de luces virtuales
 *
 * Prueba el VirtualDMXDriver + TerminalVisualizer sin hardware
 * Ejecutar con: npm run dev
 */
import { VirtualDMXDriver } from './engines/dmx/VirtualDMXDriver.js';
import { TerminalVisualizer } from './engines/dmx/TerminalVisualizer.js';
async function main() {
    // Crear driver virtual
    const dmx = new VirtualDMXDriver({
        universeSize: 512,
        updateRate: 44,
        logUpdates: false, // Desactivar logs para no interferir con visualizador
    });
    // Crear visualizador
    const visualizer = new TerminalVisualizer({
        fixtureCount: 4,
        channelsPerFixture: 3, // RGB
        refreshRate: 10, // 10 FPS suficiente para terminal
        showBars: true,
        showHex: true,
    });
    // Inicializar
    await dmx.initialize();
    visualizer.showWelcome();
    // Escuchar actualizaciones del DMX
    dmx.on('update', (universe) => {
        visualizer.render(universe, {
            beat: false,
            beatStrength: 0,
            bpm: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            rms: 0,
        });
    });
    // Esperar 2 segundos
    await sleep(2000);
    console.log('\n🎨 Iniciando secuencia de prueba...\n');
    // TEST 1: Rojo
    console.log('🔴 TEST 1: Rojo en todos los fixtures');
    for (let i = 0; i < 4; i++) {
        dmx.sendDMX(i * 3 + 1, [255, 0, 0]); // R=255, G=0, B=0
    }
    await sleep(2000);
    // TEST 2: Verde
    console.log('🟢 TEST 2: Verde en todos los fixtures');
    for (let i = 0; i < 4; i++) {
        dmx.sendDMX(i * 3 + 1, [0, 255, 0]); // R=0, G=255, B=0
    }
    await sleep(2000);
    // TEST 3: Azul
    console.log('🔵 TEST 3: Azul en todos los fixtures');
    for (let i = 0; i < 4; i++) {
        dmx.sendDMX(i * 3 + 1, [0, 0, 255]); // R=0, G=0, B=255
    }
    await sleep(2000);
    // TEST 4: Colores diferentes
    console.log('🌈 TEST 4: Colores diferentes por fixture');
    dmx.sendDMX(1, [255, 0, 0]); // PAR 1: Rojo
    dmx.sendDMX(4, [255, 255, 0]); // PAR 2: Amarillo
    dmx.sendDMX(7, [0, 255, 0]); // PAR 3: Verde
    dmx.sendDMX(10, [0, 255, 255]); // PAR 4: Cyan
    await sleep(3000);
    // TEST 5: Rainbow test
    console.log('🌈 TEST 5: Rainbow cycle (5 segundos)');
    await dmx.rainbowTest(5000);
    // Blackout
    console.log('🌑 Blackout final');
    dmx.blackout();
    await sleep(1000);
    // Cerrar
    await dmx.close();
    console.log('\n✅ Demo completada. ¡Listo para integrar con Audio Engine! 🎵💡\n');
    process.exit(0);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Ejecutar
main().catch(error => {
    console.error('❌ Error en demo:', error);
    process.exit(1);
});
//# sourceMappingURL=demo-virtual-lights.js.map