/**
 * 🎮 LUXSYNC DEMO APP
 * 
 * Complete integration demo with Selene Core
 * Run this to see audio-reactive lighting in action!
 * 
 * @date 2025-11-20
 */

import { AudioToMetricsAdapter } from '../dist/engines/selene/luxsync/AudioToMetricsAdapter.js';
import { AudioSimulatorAdapter } from '../dist/engines/selene/luxsync/AudioSimulatorAdapter.js';
import { NoteToColorMapper } from '../dist/engines/selene/luxsync/NoteToColorMapper.js';
import { SeleneLightBridge } from '../dist/engines/selene/luxsync/SeleneLightBridge.js';
import { SimulatorDriver } from '../dist/engines/selene/luxsync/drivers/SimulatorDriver.js';
import { TornadoUSBDriver } from '../dist/engines/selene/luxsync/drivers/TornadoUSBDriver.js';

// Stub Selene Core (simplified for demo)
class SimplifiedSeleneCore {
  async processSystemMetrics(metrics) {
    // ¡MODO ARCOÍRIS ACTIVADO! 🌈
    // Usamos un mapeo más dinámico y colorido
    
    const totalEnergy = metrics.cpu + metrics.memory + (1 - metrics.latency / 100);
    const bassLevel = metrics.cpu;
    const midLevel = metrics.memory;
    const trebleLevel = 1 - metrics.latency / 100;
    
    let note = 'RE'; // Default
    
    // Mapeo más variado basado en energía total y distribución
    if (bassLevel > 0.7 && midLevel < 0.3) {
      note = 'DO'; // ROJO - Bass puro y pesado
    } else if (bassLevel > 0.5 && midLevel > 0.5) {
      note = 'FA'; // VERDE - Bass + Medios = Energía completa
    } else if (midLevel > 0.6 && trebleLevel < 0.4) {
      note = 'SOL'; // CYAN - Medios dominantes
    } else if (trebleLevel > 0.6 && bassLevel < 0.3) {
      note = 'MI'; // AMARILLO - Agudos puros
    } else if (trebleLevel > 0.5 && midLevel > 0.4) {
      note = 'LA'; // AZUL - Agudos + Medios = Melodía
    } else if (totalEnergy > 1.5) {
      note = 'SI'; // MAGENTA - Energía total alta
    } else if (bassLevel > 0.4) {
      note = 'RE'; // NARANJA - Bass moderado
    } else {
      note = 'MI'; // AMARILLO - Default suave
    }
    
    // Calculate beauty with ENHANCED SENSITIVITY for high/down effects
    // More dramatic response = better visual impact
    let beauty = totalEnergy / 2.0; // More sensitive (was /2.5)
    
    // Apply exponential curve for dramatic highs and soft lows
    beauty = Math.pow(beauty, 0.8); // Slight curve to enhance mid-range
    
    // Boost peaks for "high" effect
    if (beauty > 0.7) {
      beauty = 0.7 + (beauty - 0.7) * 1.5; // Amplify peaks
    }
    
    // Compress lows for "down" effect (never fully dark)
    if (beauty < 0.2) {
      beauty = Math.max(0.1, beauty * 0.7); // Keep minimum visibility
    }
    
    return {
      musicalNote: note,
      beauty: Math.max(0.1, Math.min(1.0, beauty)), // Never go below 0.1 (always visible)
      poem: this.generatePoem(note, beauty),
      midiSequence: this.generateMidi(note),
      entropyMode: 'BALANCED',
      timestamp: Date.now()
    };
  }
  
  generatePoem(note, beauty) {
    const poems = {
      'DO': `🔴 Crimson waves of bass profound`,
      'RE': `🟠 Balanced harmony surrounds`,
      'MI': `🟡 Yellow brilliance, treble crowned`,
      'FA': `🟢 Verdant meadows of sound`,
      'SOL': `🔵 Cyan waves of higher realms`,
      'LA': `💙 Azure depths of tranquility`,
      'SI': `🟣 Magenta mysteries revealed`
    };
    return poems[note] || poems['RE'];
  }
  
  generateMidi(note) {
    const fibonacci = [500, 500, 1000, 1500, 2500];
    return fibonacci.map((duration, i) => ({
      note: note,
      duration: duration,
      velocity: 80 + i * 5
    }));
  }
}

// Global state
let app = null;

class LuxSyncDemoApp {
  constructor() {
    this.audioAdapter = null;
    this.seleneCore = null;
    this.simulator = null;
    this.bridge = null;
    this.isRunning = false;
    this.audioMode = 'microphone'; // 'microphone' or 'simulator'
    this.dmxMode = 'simulator'; // 'simulator' or 'usb'
  }
  
  async initialize() {
    try {
      this.log('🚀 Initializing LuxSync Demo...', 'info');
      
      // Create components (default: microphone mode)
      this.audioAdapter = new AudioToMetricsAdapter();
      this.seleneCore = new SimplifiedSeleneCore();
      this.simulator = new SimulatorDriver({
        canvasId: 'dmx-simulator',
        width: 1200,
        height: 600,
        fixtureCount: 8,
        showStats: true,
        showLabels: true
      });
      
      // Initialize simulator
      await this.simulator.initialize();
      this.log('✅ Simulator initialized', 'info');
      
      // Create bridge
      this.bridge = new SeleneLightBridge(
        this.audioAdapter,
        this.seleneCore,
        this.simulator
      );
      
      this.log('✅ All components ready!', 'info');
      this.updateStatus('sim', 'active', 'Ready - 8 PAR fixtures');
      
    } catch (error) {
      this.log(`❌ Initialization error: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async setAudioMode(mode) {
    if (this.isRunning) {
      this.log('⚠️ Detén el demo antes de cambiar el modo de audio', 'warning');
      return;
    }

    this.audioMode = mode;

    if (mode === 'microphone') {
      this.audioAdapter = new AudioToMetricsAdapter();
      this.log('🎤 Modo: Micrófono', 'info');
    } else if (mode === 'simulator') {
      this.audioAdapter = new AudioSimulatorAdapter(128);
      this.log('🎵 Modo: Simulador de Audio (128 BPM)', 'info');
    }

    try {
      await this.audioAdapter.initialize();
      this.log('✅ Audio adapter inicializado', 'info');
      this.updateStatus('audio', 'active', `${mode === 'microphone' ? 'Micrófono' : 'Simulador'} activo`);

      // Recrear el bridge con el nuevo adapter
      this.bridge = new SeleneLightBridge(
        this.audioAdapter,
        this.seleneCore,
        this.simulator
      );
      this.log('🔗 Bridge recreado con nuevo audio adapter', 'info');
    } catch (error) {
      this.log(`❌ Error inicializando audio: ${error.message}`, 'error');
      this.updateStatus('audio', 'inactive', 'Error de audio');
    }
  }

  async setDMXMode(mode) {
    if (this.isRunning) {
      this.log('⚠️ Detén el demo antes de cambiar el modo DMX', 'warning');
      return;
    }

    this.dmxMode = mode;

    if (mode === 'usb') {
      this.log('🌪️ Iniciando Tornado USB DMX...', 'info');
      
      try {
        // Create Tornado USB driver
        const tornadoDriver = new TornadoUSBDriver(30); // 30 FPS
        
        // Initialize (will prompt user to select USB device)
        await tornadoDriver.initialize();
        
        this.log('✅ Tornado USB conectado!', 'info');
        this.log('   LEDs: USB=ON, DMX=ON, OUT1=READY', 'info');
        
        // Replace simulator with Tornado
        this.simulator = tornadoDriver;
        
        // Recreate bridge with Tornado driver
        this.bridge = new SeleneLightBridge(
          this.audioAdapter,
          this.seleneCore,
          this.simulator
        );
        
        this.log('🔗 Bridge recreado con Tornado USB', 'info');
        this.updateStatus('sim', 'active', 'Tornado USB Ready');
        
        alert('🌪️ ¡Tornado USB conectado!\n\n' +
              'Ahora las luces se controlarán vía DMX512.\n' +
              'Haz clic en "Start Demo" para comenzar.');
        
      } catch (error) {
        this.log(`❌ Error conectando Tornado USB: ${error.message}`, 'error');
        this.updateStatus('sim', 'inactive', 'USB error');
        
        alert(`❌ Error al conectar Tornado USB:\n\n${error.message}\n\n` +
              'Asegúrate de:\n' +
              '1. Conectar el Tornado USB a la laptop\n' +
              '2. Usar Chrome o Edge (Web USB no funciona en Firefox)\n' +
              '3. Dar permisos cuando aparezca el diálogo USB');
        
        // Fall back to simulator
        this.dmxMode = 'simulator';
        this.log('🔄 Volviendo a modo simulador', 'warning');
      }
      
    } else {
      this.log('💻 Modo: Simulador Canvas', 'info');
      
      // Recreate canvas simulator
      this.simulator = new SimulatorDriver(8, 'simulator');
      
      // Recreate bridge
      this.bridge = new SeleneLightBridge(
        this.audioAdapter,
        this.seleneCore,
        this.simulator
      );
      
      this.log('� Bridge recreado con simulador canvas', 'info');
      this.updateStatus('sim', 'active', 'Canvas Ready');
    }
  }

  async initAudio() {
    try {
      this.log('🎤 Requesting microphone access...', 'info');
      await this.audioAdapter.initialize();
      this.log('✅ Microphone access granted!', 'info');
      this.updateStatus('audio', 'active', 'Capturing audio');
      return true;
    } catch (error) {
      this.log(`❌ Microphone error: ${error.message}`, 'error');
      alert('No se pudo acceder al micrófono. Asegúrate de dar permisos.');
      return false;
    }
  }
  
  async start() {
    if (this.isRunning) {
      this.log('⚠️  Already running', 'warning');
      return;
    }
    
    // Check audio
    if (!this.audioAdapter.isReady()) {
      const audioOk = await this.initAudio();
      if (!audioOk) return;
    }
    
    this.log('🚀 Starting demo...', 'info');
    await this.bridge.start();
    this.isRunning = true;
    
    this.updateStatus('sim', 'active', 'Processing at 30 FPS');
    this.log('✅ Demo started! Play some music!', 'info');
    
    // Update stats periodically
    this.startStatsUpdater();
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.log('🛑 Stopping demo...', 'info');
    this.bridge.stop();
    this.isRunning = false;
    this.stopStatsUpdater();
    
    this.updateStatus('sim', 'inactive', 'Stopped');
    this.log('✅ Demo stopped', 'info');
  }
  
  async testPattern() {
    this.log('🌈 Running test pattern...', 'info');
    await this.simulator.testPattern();
    this.log('✅ Test pattern complete', 'info');
  }
  
  blackout() {
    if (!this.isRunning) {
      this.log('⚠️ Demo must be running to apply blackout', 'warning');
      return;
    }
    
    this.log('⚫ Blackout applied', 'info');
    
    // Stop the bridge loop temporarily
    const wasRunning = this.isRunning;
    this.bridge.stop();
    this.isRunning = false;
    
    // Apply blackout
    this.simulator.blackout();
    
    // Update UI
    this.updateStatus('sim', 'inactive', 'Blackout');
    this.log('⚫ All fixtures off. Click "Start Demo" to resume.', 'info');
  }

  setEffect(mode, speed = 0.5, intensity = 0.7) {
    this.log(`🎨 Effect activated: ${mode}`, 'info');
    this.bridge.setEffect(mode, speed, intensity);
  }

  clearEffects() {
    this.log('🚫 Effects cleared', 'info');
    this.bridge.clearEffects();
  }
  
  startStatsUpdater() {
    this.statsInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      const stats = this.bridge.getStats();
      const perfInfo = document.getElementById('perf-info');
      if (perfInfo) {
        perfInfo.textContent = 
          `FPS: ${stats.averageFps.toFixed(1)} | ` +
          `Frames: ${stats.framesProcessed} | ` +
          `Note: ${stats.lastNote}`;
      }
    }, 1000);
  }
  
  stopStatsUpdater() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
  
  log(message, type = 'info') {
    const logDiv = document.getElementById('log');
    if (!logDiv) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    
    console.log(message);
  }
  
  updateStatus(component, status, info) {
    const statusEl = document.getElementById(`${component}-status`);
    const infoEl = document.getElementById(`${component}-info`);
    
    if (statusEl) {
      statusEl.className = `status ${status}`;
      statusEl.textContent = status === 'active' ? 'Active' : 'Inactive';
    }
    
    if (infoEl && info) {
      infoEl.textContent = info;
    }
  }
}

// Global functions for buttons
window.initAudio = async () => {
  if (!app) return;
  await app.initAudio();
};

window.startDemo = async () => {
  if (!app) return;
  await app.start();
};

window.stopDemo = () => {
  if (!app) return;
  app.stop();
};

window.testPattern = async () => {
  if (!app) return;
  await app.testPattern();
};

window.blackout = () => {
  if (!app) return;
  app.blackout();
};

window.setEffect = (mode, speed, intensity) => {
  if (!app) return;
  app.setEffect(mode, speed, intensity);
};

window.clearEffects = () => {
  if (!app) return;
  app.clearEffects();
};

window.setAudioMode = async (mode) => {
  if (!app) return;
  await app.setAudioMode(mode);
};

window.setDMXMode = async (mode) => {
  if (!app) return;
  await app.setDMXMode(mode);
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🎵 LuxSync Demo Loading...');
  
  try {
    app = new LuxSyncDemoApp();
    await app.initialize();
    console.log('✅ LuxSync Demo Ready!');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    alert('Error al inicializar la demo. Ver consola para detalles.');
  }
});
