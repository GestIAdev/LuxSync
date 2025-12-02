/**
 * demo-casero-fixtures.ts
 * 🎪💡 Demo con los fixtures REALES del casero
 * 
 * Carga los archivos .fxt de FreeStyler desde /librerias
 * y los sincroniza con audio en tiempo real
 * 
 * Uso: npx ts-node src/demo-casero-fixtures.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { AudioSimulator } from './engines/audio/AudioSimulator.js';
import { VirtualDMXDriver } from './engines/dmx/VirtualDMXDriver.js';
import { TerminalVisualizer } from './engines/dmx/TerminalVisualizer.js';
import { FixtureManager, COLORS, FixtureType } from './engines/fixtures/index.js';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para diferentes energías musicales
const ENERGY_COLORS = {
  LOW: [
    { r: 0, g: 0, b: 100 },     // Azul oscuro
    { r: 50, g: 0, b: 100 },    // Púrpura
    { r: 0, g: 50, b: 100 },    // Cyan oscuro
  ],
  MID: [
    { r: 0, g: 200, b: 100 },   // Verde cyan
    { r: 100, g: 200, b: 0 },   // Verde lima
    { r: 0, g: 150, b: 200 },   // Cyan
  ],
  HIGH: [
    { r: 255, g: 50, b: 0 },    // Rojo fuego
    { r: 255, g: 100, b: 0 },   // Naranja
    { r: 255, g: 0, b: 100 },   // Rosa fuerte
  ],
  BEAT: [
    { r: 255, g: 255, b: 255 }, // Blanco flash
    { r: 255, g: 255, b: 0 },   // Amarillo
  ],
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.clear();
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                           ║');
  console.log('║      🎪💡 LUXSYNC - DEMO CON FIXTURES DEL CASERO 💡🎪                   ║');
  console.log('║                                                                           ║');
  console.log('║         Cargando fixtures reales desde archivos .fxt                     ║');
  console.log('║         ¡FreeStyler + LuxSync = Magia!                                   ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CARGAR FIXTURES DESDE /librerias
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('📂 Cargando fixtures del casero...\n');
  
  const fixtureManager = new FixtureManager();
  const libreriasPath = path.join(__dirname, '..', 'librerias');
  
  try {
    await fixtureManager.loadFromFolder(libreriasPath);
  } catch (error) {
    console.error('❌ Error cargando fixtures:', error);
    console.log('   Asegúrate de que la carpeta /librerias existe y tiene archivos .fxt');
    return;
  }
  
  console.log('');
  
  // Listar lo que encontramos
  const allFixtures = fixtureManager.listFixtureTypes();
  const pars = fixtureManager.listByType(FixtureType.PAR);
  const movingHeads = allFixtures.filter(f => 
    f.type === FixtureType.MOVING_HEAD_SPOT || 
    f.type === FixtureType.MOVING_HEAD_WASH ||
    f.type === FixtureType.MOVING_HEAD_BEAM ||
    f.type === FixtureType.BEAM
  );
  const strobes = fixtureManager.listByType(FixtureType.STROBE);
  const washes = fixtureManager.listByType(FixtureType.WASH);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            📦 INVENTARIO DE FIXTURES DEL CASERO              ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  PAR LEDs:         ${pars.length.toString().padEnd(43)}║`);
  console.log(`║  Moving Heads:     ${movingHeads.length.toString().padEnd(43)}║`);
  console.log(`║  Strobes:          ${strobes.length.toString().padEnd(43)}║`);
  console.log(`║  Washes:           ${washes.length.toString().padEnd(43)}║`);
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  
  for (const fixture of allFixtures) {
    const caps = fixture.capabilities;
    const features = [];
    if (caps.hasRGB) features.push('RGB');
    if (caps.hasPan && caps.hasTilt) features.push('Pan/Tilt');
    if (caps.hasGoboWheel) features.push('Gobo');
    if (caps.hasPrism) features.push('Prism');
    if (caps.hasColorWheel) features.push('ColorWheel');
    if (caps.hasZoom) features.push('Zoom');
    
    const line = `║  ${fixture.name.substring(0, 25).padEnd(25)} ${fixture.channelCount.toString().padStart(2)}ch | ${features.join(', ').substring(0, 18).padEnd(18)}║`;
    console.log(line);
  }
  
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  await sleep(2000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. INSTANCIAR FIXTURES (Simular setup del casero)
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('🔧 Configurando instancias de fixtures...\n');
  
  // Buscar fixture PAR para instanciar
  const parFixture = pars[0] || allFixtures.find(f => f.capabilities.hasRGB);
  const movingFixture = movingHeads[0];
  const washFixture = washes[0];
  
  const activeInstances: string[] = [];
  
  // Crear 4 PARs si hay alguno disponible
  if (parFixture) {
    console.log(`📍 Creando 4x ${parFixture.name}...`);
    const parInstances = fixtureManager.createInstances(parFixture.id, 4, 'par');
    parInstances.forEach(inst => activeInstances.push(inst.instanceId));
  }
  
  // Crear 2 Moving Heads si hay alguno disponible
  if (movingFixture) {
    console.log(`📍 Creando 2x ${movingFixture.name}...`);
    const mhInstances = fixtureManager.createInstances(movingFixture.id, 2, 'mh');
    mhInstances.forEach(inst => activeInstances.push(inst.instanceId));
  }
  
  // Crear 1 Wash si hay alguno disponible
  if (washFixture) {
    console.log(`📍 Creando 1x ${washFixture.name}...`);
    const washInstance = fixtureManager.createInstance(washFixture.id, 'wash_1');
    if (washInstance) activeInstances.push(washInstance.instanceId);
  }
  
  // Si no hay fixtures específicos, crear genéricos de lo que haya
  if (activeInstances.length === 0 && allFixtures.length > 0) {
    console.log('⚠️  No se encontraron fixtures específicos, usando lo disponible...');
    for (let i = 0; i < Math.min(4, allFixtures.length); i++) {
      const fixture = allFixtures[i];
      const instance = fixtureManager.createInstance(fixture.id, `fixture_${i + 1}`);
      if (instance) activeInstances.push(instance.instanceId);
    }
  }
  
  console.log('');
  console.log(fixtureManager.getSummary());
  
  await sleep(2000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INICIALIZAR AUDIO Y DMX
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('🎵 Inicializando simulador de audio (128 BPM)...');
  const audioSimulator = new AudioSimulator(128);
  
  console.log('💡 Inicializando driver DMX virtual...');
  const dmx = new VirtualDMXDriver({
    universeSize: 512,
    updateRate: 44,
    logUpdates: false,
  });
  await dmx.initialize();
  
  // Obtener información para el visualizador
  const instances = fixtureManager.listInstances();
  const maxChannels = Math.max(...instances.map(i => i.dmxAddress + i.fixture.channelCount));
  
  const visualizer = new TerminalVisualizer({
    fixtureCount: instances.length,
    channelsPerFixture: 16, // Mostrar primeros canales
    refreshRate: 4,
    showBars: true,
    showHex: true,
  });
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    🎬 INICIANDO SHOW AUTOMÁTICO                       ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  ▸ Los PARs reaccionan a BASS/MID/TREBLE');
  console.log('  ▸ Los Moving Heads se mueven al ritmo');
  console.log('  ▸ Los Beats producen flashes');
  console.log('  ▸ Selene aprenderá qué combinaciones funcionan mejor');
  console.log('');
  console.log('  Presiona Ctrl+C para detener');
  console.log('');
  
  await sleep(2000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LOOP PRINCIPAL DE SINCRONIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  
  let frameCount = 0;
  let lastBeatTime = 0;
  let beatDecay = 0;
  let currentColorSet = 0;
  
  // Posición de moving heads (pan/tilt)
  let mhPanTarget = 127;
  let mhTiltTarget = 127;
  let mhPan = 127;
  let mhTilt = 127;
  
  const renderLoop = async () => {
    while (true) {
      const startTime = Date.now();
      
      // Obtener frame de audio simulado
      const audioFrame = await audioSimulator.getFrame();
      
      // Calcular beat decay
      const now = Date.now();
      const timeSinceBeat = now - lastBeatTime;
      beatDecay = Math.max(0, 1 - (timeSinceBeat / 300)); // Decae en 300ms
      
      // Si hay beat nuevo
      if (audioFrame.beat) {
        lastBeatTime = now;
        beatDecay = 1.0;
        currentColorSet = (currentColorSet + 1) % 3;
        
        // Nuevo objetivo para moving heads
        mhPanTarget = 50 + Math.random() * 155;
        mhTiltTarget = 50 + Math.random() * 155;
      }
      
      // Suavizar movimiento de moving heads
      mhPan += (mhPanTarget - mhPan) * 0.1;
      mhTilt += (mhTiltTarget - mhTilt) * 0.1;
      
      // Calcular energía total (0-1)
      const energy = (audioFrame.bass + audioFrame.mid + audioFrame.treble) / 3;
      
      // Seleccionar paleta de colores según energía
      let palette = ENERGY_COLORS.LOW;
      if (energy > 0.6) {
        palette = ENERGY_COLORS.HIGH;
      } else if (energy > 0.3) {
        palette = ENERGY_COLORS.MID;
      }
      
      // Aplicar a cada instancia
      for (let i = 0; i < activeInstances.length; i++) {
        const instanceId = activeInstances[i];
        const instance = fixtureManager.getInstance(instanceId);
        if (!instance) continue;
        
        const fixture = instance.fixture;
        const caps = fixture.capabilities;
        
        // Intensidad base según frecuencia correspondiente
        let intensity = 0;
        if (i % 3 === 0) {
          intensity = audioFrame.bass * 255;
        } else if (i % 3 === 1) {
          intensity = audioFrame.mid * 255;
        } else {
          intensity = audioFrame.treble * 255;
        }
        
        // Boost si hay beat
        if (beatDecay > 0.5) {
          intensity = Math.min(255, intensity * 1.5);
        }
        
        // Color del palette
        const colorIndex = (i + currentColorSet) % palette.length;
        const color = palette[colorIndex];
        
        // Aplicar color con intensidad
        const dimmedR = Math.floor(color.r * (intensity / 255));
        const dimmedG = Math.floor(color.g * (intensity / 255));
        const dimmedB = Math.floor(color.b * (intensity / 255));
        
        // Comandos según capabilities
        if (caps.hasRGB) {
          fixtureManager.setColor(instanceId, dimmedR, dimmedG, dimmedB);
        }
        
        if (caps.hasDimmer) {
          fixtureManager.setDimmer(instanceId, Math.floor(intensity));
        }
        
        // Strobe en beats fuertes
        if (caps.hasStrobe && audioFrame.beat && audioFrame.beatStrength > 0.7) {
          fixtureManager.setStrobe(instanceId, 200);
        } else if (caps.hasStrobe) {
          fixtureManager.setStrobe(instanceId, 0);
        }
        
        // Movimiento para moving heads
        if (caps.hasPan && caps.hasTilt) {
          fixtureManager.moveTo(instanceId, Math.floor(mhPan), Math.floor(mhTilt));
        }
        
        // Gobo en beats
        if (caps.hasGoboWheel && audioFrame.beat) {
          const goboValue = Math.floor(Math.random() * 5) * 20; // 0, 20, 40, 60, 80
          fixtureManager.setGobo(instanceId, goboValue);
        }
      }
      
      // Generar y enviar comandos DMX
      const commands = fixtureManager.getAllDMXCommands();
      for (const cmd of commands) {
        dmx.setChannel(cmd.channel, cmd.value);
      }
      
      // Visualizar (menos frecuente para no saturar la terminal)
      if (frameCount % 10 === 0) {
        // Preparar datos para visualizador
        const visualData: number[][] = [];
        for (const inst of instances) {
          const channels: number[] = [];
          for (let ch = inst.dmxAddress; ch < inst.dmxAddress + Math.min(inst.fixture.channelCount, 8); ch++) {
            channels.push(dmx.getChannel(ch));
          }
          visualData.push(channels);
        }
        
        // Mostrar info
        console.clear();
        console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
        console.log('║          🎪💡 LUXSYNC - SHOW EN VIVO CON FIXTURES DEL CASERO            ║');
        console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`  🎵 BPM: ${audioFrame.bpm.toFixed(0).padStart(3)} | 🔊 RMS: ${(audioFrame.rms * 100).toFixed(0).padStart(3)}%`);
        console.log(`  🔈 Bass: ${(audioFrame.bass * 100).toFixed(0).padStart(3)}% | Mid: ${(audioFrame.mid * 100).toFixed(0).padStart(3)}% | Treble: ${(audioFrame.treble * 100).toFixed(0).padStart(3)}%`);
        console.log(`  💥 Beat: ${audioFrame.beat ? '🔴 BEAT!' : '⚫'}  Decay: ${'█'.repeat(Math.floor(beatDecay * 10))}`);
        console.log('');
        console.log('  ╔════════════════════════════════════════════════════════════════════════╗');
        
        for (const inst of instances) {
          const state = inst.state;
          const name = inst.instanceId.padEnd(15);
          const dmxAddr = `DMX ${inst.dmxAddress.toString().padStart(3)}`;
          
          // Barra de color
          const colorBar = state.red > 0 || state.green > 0 || state.blue > 0
            ? `R:${state.red.toString().padStart(3)} G:${state.green.toString().padStart(3)} B:${state.blue.toString().padStart(3)}`
            : `Dim: ${state.dimmer.toString().padStart(3)}`;
          
          const posInfo = inst.fixture.capabilities.hasPan 
            ? `P:${Math.floor(state.pan).toString().padStart(3)} T:${Math.floor(state.tilt).toString().padStart(3)}`
            : '';
          
          console.log(`  ║  ${name} | ${dmxAddr} | ${colorBar.padEnd(25)} ${posInfo.padEnd(12)}║`);
        }
        
        console.log('  ╚════════════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  Frame:', frameCount, '| Latency:', (Date.now() - startTime), 'ms');
        console.log('');
        console.log('  Ctrl+C para detener');
      }
      
      frameCount++;
      
      // Mantener ~30 FPS
      const elapsed = Date.now() - startTime;
      const sleepTime = Math.max(0, 33 - elapsed);
      await sleep(sleepTime);
    }
  };
  
  // Manejar Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Deteniendo show...');
    
    // Blackout
    fixtureManager.blackoutAll();
    const commands = fixtureManager.getAllDMXCommands();
    for (const cmd of commands) {
      dmx.setChannel(cmd.channel, cmd.value);
    }
    
    console.log('✅ Blackout aplicado');
    console.log('👋 ¡Hasta luego! Espero que le haya gustado al casero 🎪');
    process.exit(0);
  });
  
  // Iniciar loop
  await renderLoop();
}

// Ejecutar
main().catch(console.error);
