/**
 * 🎪 LUXSYNC DEMO V2 - CON FIXTURES DEL CASERO
 * 
 * Versión mejorada que:
 * - Carga fixtures desde archivos .fxt de FreeStyler
 * - 3 modos de audio: Mic-In, Simulador, Desktop Audio
 * - 2 modos DMX: Canvas Simulator, Tornado USB
 * - Sistema de ZONAS profesional (como discotecas reales)
 * 
 * @author LuxSync Team + PunkClaude
 * @date 2025-11-30
 */

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE ZONAS - Así funcionan las discotecas profesionales
// ═══════════════════════════════════════════════════════════════════════════

const ZONES = {
  // PARs: Ritmo, bass, ambiente base
  FRONT_PARS: {
    role: 'rhythm',           // Responden al BASS/ritmo
    fixtures: ['par_1', 'par_2', 'par_3'],
    position: 'front',
    behavior: {
      frequency: 'bass',      // Frecuencia principal
      secondaryFreq: 'mid',   // Frecuencia secundaria (en coros)
      intensity: 1.0,         // Multiplicador de intensidad
      onBeat: true,           // Flash en beat
    }
  },
  BACK_PARS: {
    role: 'rhythm',
    fixtures: ['par_4', 'par_5', 'par_6'],
    position: 'back',
    behavior: {
      frequency: 'bass',
      secondaryFreq: 'mid',
      intensity: 0.8,         // Un poco menos para dar profundidad
      onBeat: true,
      beatDelay: 50,          // 50ms de delay para efecto "wave"
    }
  },
  // Moving Heads: Melodía, armonía, efectos espectaculares
  MOVING_LEFT: {
    role: 'melody',           // Responden a MID/TREBLE
    fixtures: ['mh_1', 'mh_2', 'mh_3'],
    position: 'left',
    behavior: {
      frequency: 'mid',       // Melodía
      secondaryFreq: 'treble',
      intensity: 1.0,
      autoMove: true,         // Movimiento automático
      moveSpeed: 'medium',
      pattern: 'sweep',       // sweep, circle, random, mirror
    }
  },
  MOVING_RIGHT: {
    role: 'melody',
    fixtures: ['mh_4', 'mh_5', 'mh_6'],
    position: 'right',
    behavior: {
      frequency: 'mid',
      secondaryFreq: 'treble',
      intensity: 1.0,
      autoMove: true,
      moveSpeed: 'medium',
      pattern: 'mirror',      // Espejo del lado izquierdo
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE DATA - 12 Fixtures para instalación básica de discoteca
// (6 PARs frontales/traseros + 6 Moving Heads izq/der)
// ═══════════════════════════════════════════════════════════════════════════

const CASERO_FIXTURES = [
  // === FRONT PARS (3) - Frente al público ===
  {
    id: 'par_1',
    name: 'PAR Front L',
    type: 'PAR',
    zone: 'FRONT_PARS',
    dmxAddress: 1,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  {
    id: 'par_2',
    name: 'PAR Front C',
    type: 'PAR',
    zone: 'FRONT_PARS',
    dmxAddress: 8,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  {
    id: 'par_3',
    name: 'PAR Front R',
    type: 'PAR',
    zone: 'FRONT_PARS',
    dmxAddress: 15,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  // === BACK PARS (3) - Detrás del DJ/escenario ===
  {
    id: 'par_4',
    name: 'PAR Back L',
    type: 'PAR',
    zone: 'BACK_PARS',
    dmxAddress: 22,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  {
    id: 'par_5',
    name: 'PAR Back C',
    type: 'PAR',
    zone: 'BACK_PARS',
    dmxAddress: 29,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  {
    id: 'par_6',
    name: 'PAR Back R',
    type: 'PAR',
    zone: 'BACK_PARS',
    dmxAddress: 36,
    channels: 7,
    capabilities: { rgb: true, dimmer: true, strobe: true }
  },
  // === MOVING HEADS LEFT (3) - Lado izquierdo ===
  {
    id: 'mh_1',
    name: 'Beam Left 1',
    type: 'MOVING_HEAD',
    zone: 'MOVING_LEFT',
    dmxAddress: 43,
    channels: 13,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, colorWheel: true }
  },
  {
    id: 'mh_2',
    name: 'Beam Left 2',
    type: 'MOVING_HEAD',
    zone: 'MOVING_LEFT',
    dmxAddress: 56,
    channels: 13,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, colorWheel: true }
  },
  {
    id: 'mh_3',
    name: 'Spot Left',
    type: 'MOVING_HEAD',
    zone: 'MOVING_LEFT',
    dmxAddress: 69,
    channels: 16,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, zoom: true }
  },
  // === MOVING HEADS RIGHT (3) - Lado derecho (espejo) ===
  {
    id: 'mh_4',
    name: 'Beam Right 1',
    type: 'MOVING_HEAD',
    zone: 'MOVING_RIGHT',
    dmxAddress: 85,
    channels: 13,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, colorWheel: true }
  },
  {
    id: 'mh_5',
    name: 'Beam Right 2',
    type: 'MOVING_HEAD',
    zone: 'MOVING_RIGHT',
    dmxAddress: 98,
    channels: 13,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, colorWheel: true }
  },
  {
    id: 'mh_6',
    name: 'Spot Right',
    type: 'MOVING_HEAD',
    zone: 'MOVING_RIGHT',
    dmxAddress: 111,
    channels: 16,
    capabilities: { pan: true, tilt: true, gobo: true, prism: true, zoom: true }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COLORES PARA DIFERENTES ENERGÍAS
// ═══════════════════════════════════════════════════════════════════════════

const ENERGY_COLORS = {
  LOW: [
    { r: 0, g: 0, b: 150 },     // Azul oscuro
    { r: 80, g: 0, b: 150 },    // Púrpura
    { r: 0, g: 80, b: 150 },    // Cyan oscuro
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

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════════════════

let state = {
  audioMode: 'sim',       // 'mic' | 'sim' | 'desktop'
  dmxMode: 'canvas',      // 'canvas' | 'tornado'
  isRunning: false,
  audioContext: null,
  analyser: null,
  animationFrame: null,
  
  // 🌙 SELENE MODE - Siempre activa por defecto
  seleneMode: true,       // Selene siempre controla las luces
  seleneDecision: null,   // Última decisión de Selene
  
  // Audio data
  bass: 0,
  mid: 0,
  treble: 0,
  rms: 0,
  beat: false,
  bpm: 128,
  lastBeatTime: 0,
  beatDecay: 0,
  
  // BPM Detection V1.0 - Detector de tempo real
  beatHistory: [],          // Timestamps de los últimos beats
  bpmHistory: [],           // Historial de BPMs calculados (para suavizar)
  calculatedBPM: 0,         // BPM calculado en tiempo real
  bpmConfidence: 0,         // 0-1, confianza en el BPM detectado
  lastBPMUpdate: 0,         // Último momento que se actualizó el BPM
  
  // Simulator
  simulatorBPM: 128,
  simulatorPhase: 0,
  
  // Effects
  currentEffect: null,
  effectPhase: 0,
  
  // Fixtures
  fixtures: CASERO_FIXTURES.map(f => ({
    ...f,
    currentColor: { r: 0, g: 0, b: 0 },
    currentDimmer: 0,
    currentPan: 127,
    currentTilt: 127,
  })),
  
  // Canvas
  canvas: null,
  ctx: null,
  
  // Tornado USB
  tornadoDevice: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  log('🎪 LuxSync Demo V2 iniciando...', 'info');
  
  // Inicializar canvas
  initCanvas();
  
  // Inicializar lista de fixtures
  updateFixtureList();
  
  // Inicializar audio simulator por defecto
  log('🎵 Modo por defecto: Simulador de Audio (128 BPM)', 'info');
  log('✅ Demo lista! Haz clic en START para comenzar', 'info');
});

function initCanvas() {
  state.canvas = document.getElementById('fixture-canvas');
  if (!state.canvas) {
    log('❌ Canvas no encontrado!', 'error');
    return;
  }
  
  // Ajustar tamaño al contenedor
  const container = state.canvas.parentElement;
  state.canvas.width = container.clientWidth;
  state.canvas.height = 500;
  
  state.ctx = state.canvas.getContext('2d');
  
  // Dibujo inicial
  renderFixtures();
  
  log(`🖥️ Canvas inicializado: ${state.canvas.width}x${state.canvas.height}`, 'info');
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO MODES
// ═══════════════════════════════════════════════════════════════════════════

window.setAudioMode = async function(mode) {
  if (state.isRunning) {
    log('⚠️ Detén el demo antes de cambiar el modo', 'warn');
    return;
  }
  
  state.audioMode = mode;
  
  // Update button states
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-mode-${mode}`).classList.add('active');
  
  // Cerrar contexto de audio anterior
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  
  if (mode === 'mic') {
    log('🎤 Modo: Micrófono - Solicitando permisos...', 'info');
    try {
      await initMicrophone();
      log('✅ Micrófono activado!', 'info');
    } catch (err) {
      log(`❌ Error de micrófono: ${err.message}`, 'error');
      // Fallback to simulator
      state.audioMode = 'sim';
      document.getElementById('btn-mode-sim').classList.add('active');
      document.getElementById('btn-mode-mic').classList.remove('active');
    }
  } else if (mode === 'desktop') {
    log('🖥️ Modo: Audio del Escritorio - Selecciona una ventana/pestaña con audio...', 'info');
    try {
      await initDesktopAudio();
      log('✅ Captura de escritorio activada! Reproduce música en Spotify/YouTube', 'info');
    } catch (err) {
      log(`❌ Error de captura: ${err.message}`, 'error');
      // Fallback to simulator
      state.audioMode = 'sim';
      document.getElementById('btn-mode-sim').classList.add('active');
      document.getElementById('btn-mode-desktop').classList.remove('active');
    }
  } else {
    log('🎵 Modo: Simulador de Beats (128 BPM)', 'info');
  }
};

async function initMicrophone() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.audioContext.createMediaStreamSource(stream);
  
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 2048;
  state.analyser.smoothingTimeConstant = 0.8;
  
  source.connect(state.analyser);
}

async function initDesktopAudio() {
  // Usar getDisplayMedia para capturar audio del sistema
  // El usuario debe seleccionar una pestaña/ventana con "Compartir audio" activado
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,  // Requerido por la API, pero no usaremos el video
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000
    }
  });
  
  // Verificar que hay pista de audio
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    // Detener tracks de video si no hay audio
    stream.getTracks().forEach(track => track.stop());
    throw new Error('No se seleccionó audio. Marca "Compartir audio de la pestaña" al seleccionar.');
  }
  
  // Detener el track de video ya que no lo necesitamos (ahorra recursos)
  stream.getVideoTracks().forEach(track => track.stop());
  
  // Crear audio context solo con el audio
  const audioOnlyStream = new MediaStream(audioTracks);
  
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.audioContext.createMediaStreamSource(audioOnlyStream);
  
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 2048;
  state.analyser.smoothingTimeConstant = 0.7; // Un poco más reactivo para música
  
  source.connect(state.analyser);
  
  // Manejar cuando el usuario detiene la compartición
  audioTracks[0].onended = () => {
    log('⚠️ Captura de escritorio detenida', 'warn');
    state.audioMode = 'sim';
    document.getElementById('btn-mode-sim').classList.add('active');
    document.getElementById('btn-mode-desktop').classList.remove('active');
  };
}

function getAudioFrame() {
  if ((state.audioMode === 'mic' || state.audioMode === 'desktop') && state.analyser) {
    return getAudioFromAnalyser();
  } else {
    return getAudioFromSimulator();
  }
}

function getAudioFromAnalyser() {
  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  state.analyser.getByteFrequencyData(dataArray);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎵 ANÁLISIS DE FRECUENCIAS V2.0 - Rangos corregidos para detección de género
  // ═══════════════════════════════════════════════════════════════════════════
  // 
  // Con fftSize=2048 y sampleRate=44100:
  // - bufferLength = 1024 bins
  // - Cada bin = 44100/2048 = 21.5 Hz
  // - Bin máximo = 22050 Hz (Nyquist)
  //
  // RANGOS MUSICALES CORRECTOS:
  // - SUB-BASS (20-80 Hz): Kick de techno, sub del reggaeton → bins 1-4
  // - BASS (80-300 Hz): Bajo musical, tumbao de cumbia → bins 4-14  
  // - LOW-MID (300-800 Hz): Cuerpo, calidez → bins 14-37
  // - MID (800-2500 Hz): Voces, congas, guitarras → bins 37-116
  // - HIGH-MID (2500-5000 Hz): Presencia, cencerros, claps → bins 116-232
  // - TREBLE (5000-12000 Hz): Hi-hats, platos, brillos → bins 232-558
  // ═══════════════════════════════════════════════════════════════════════════
  
  const sampleRate = state.audioContext?.sampleRate || 44100;
  const hzPerBin = sampleRate / (bufferLength * 2);
  
  // Función helper para convertir Hz a bin
  const hzToBin = (hz) => Math.min(bufferLength - 1, Math.max(0, Math.floor(hz / hzPerBin)));
  
  // Definir rangos en Hz
  const RANGES = {
    subBass: { start: 20, end: 80 },     // Kick puro
    bass: { start: 80, end: 300 },        // Bajo musical
    lowMid: { start: 300, end: 800 },     // Cuerpo
    mid: { start: 800, end: 2500 },       // Voces, melodía
    highMid: { start: 2500, end: 5000 },  // Presencia
    treble: { start: 5000, end: 12000 },  // Hi-hats
  };
  
  // Calcular energía por banda
  const getEnergy = (startHz, endHz) => {
    const startBin = hzToBin(startHz);
    const endBin = hzToBin(endHz);
    let sum = 0;
    for (let i = startBin; i <= endBin; i++) {
      sum += dataArray[i];
    }
    return (sum / (endBin - startBin + 1)) / 255;
  };
  
  const subBass = getEnergy(RANGES.subBass.start, RANGES.subBass.end);
  const bassLow = getEnergy(RANGES.bass.start, RANGES.bass.end);
  const lowMid = getEnergy(RANGES.lowMid.start, RANGES.lowMid.end);
  const midReal = getEnergy(RANGES.mid.start, RANGES.mid.end);
  const highMid = getEnergy(RANGES.highMid.start, RANGES.highMid.end);
  const trebleReal = getEnergy(RANGES.treble.start, RANGES.treble.end);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Mapeo a las 3 bandas que usa Selene (pero con rangos CORRECTOS)
  // ═══════════════════════════════════════════════════════════════════════════
  // BASS = subBass + bassLow (0-300 Hz) - el KICK y el BAJO real
  // MID = lowMid + midReal (300-2500 Hz) - VOCES, MELODÍA, PERCUSIÓN LATINA
  // TREBLE = highMid + trebleReal (2500-12000 Hz) - HI-HATS, BRILLOS
  
  const bass = (subBass * 0.6 + bassLow * 0.4);  // Más peso al sub-bass
  const mid = (lowMid * 0.3 + midReal * 0.7);     // Más peso a las voces
  const treble = (highMid * 0.4 + trebleReal * 0.6);  // Más peso a hi-hats
  
  // RMS general
  let rmsSum = 0;
  for (let i = 0; i < bufferLength; i++) {
    rmsSum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(rmsSum / bufferLength) / 255;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🥁 BPM DETECTOR V4.0 - Optimizado para Cumbia/Latino
  // ═══════════════════════════════════════════════════════════════════════════
  // 
  // PROBLEMA V3: Cumbia argentina tiene "tumbao" (güiro/bajo) que hace 2 golpes
  // por tiempo. Detectaba ~140 BPM cuando la cumbia real es ~95-100 BPM.
  // 
  // SOLUCIÓN: Intervalo mínimo MUY ALTO (500ms = 120 BPM máx)
  // Esto fuerza a contar solo el beat principal, no los offbeats.
  // 
  // RANGOS ESPERADOS:
  // - Cumbia/Latino: 85-110 BPM → Latino 🔥
  // - House/Techno: Rara vez baja de 120 BPM en el beat principal
  // ═══════════════════════════════════════════════════════════════════════════
  
  const now = Date.now();
  const minBeatInterval = 500;   // 🔼 SUBIDO: Mínimo 500ms (120 BPM máx absoluto)
  const maxBeatInterval = 1500;  // Máximo 1500ms entre beats (40 BPM mín)
  
  // UMBRAL ADAPTATIVO: Rastrear el pico máximo de sub-bass
  if (!state.peakSubBass) state.peakSubBass = 0.5;
  if (!state.peakDecay) state.peakDecay = 0;
  
  // Actualizar pico máximo (con decay lento)
  if (subBass > state.peakSubBass) {
    state.peakSubBass = subBass;
    state.peakDecay = 0;
  } else {
    // Decay del pico: baja 0.01 cada 100ms
    state.peakDecay++;
    if (state.peakDecay > 6) {  // ~100ms a 60fps
      state.peakSubBass = Math.max(0.5, state.peakSubBass * 0.995);
      state.peakDecay = 0;
    }
  }
  
  // 🎯 UMBRAL DINÁMICO: 85% del pico máximo reciente (mínimo 0.65)
  const dynamicThreshold = Math.max(0.65, state.peakSubBass * 0.85);
  
  const timeSinceLastBeat = now - state.lastBeatTime;
  const beat = subBass > dynamicThreshold && timeSinceLastBeat > minBeatInterval;
  
  if (beat) {
    // Guardar timestamp del beat
    state.beatHistory.push(now);
    
    // Mantener solo los últimos 8 beats (suficiente para calcular BPM estable)
    if (state.beatHistory.length > 8) {
      state.beatHistory.shift();
    }
    
    // Calcular BPM si tenemos suficientes beats
    if (state.beatHistory.length >= 4) {
      const intervals = [];
      for (let i = 1; i < state.beatHistory.length; i++) {
        const interval = state.beatHistory[i] - state.beatHistory[i - 1];
        // Solo contar intervalos válidos (50-150 BPM range = 400-1200ms)
        if (interval >= minBeatInterval && interval <= maxBeatInterval) {
          intervals.push(interval);
        }
      }
      
      if (intervals.length >= 3) {
        // Calcular BPM promedio de los intervalos
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const instantBPM = 60000 / avgInterval;
        
        // SANITY CHECK V4: Rango 40-120 BPM (con intervalo mínimo de 500ms, max es 120)
        if (instantBPM >= 40 && instantBPM <= 120) {
          // Buffer grande para BPM muy estable
          state.bpmHistory.push(instantBPM);
          if (state.bpmHistory.length > 16) {  // 🔼 SUBIDO a 16 para máxima estabilidad
            state.bpmHistory.shift();
          }
          
          // BPM final = promedio del historial (muy estable)
          state.calculatedBPM = Math.round(
            state.bpmHistory.reduce((a, b) => a + b, 0) / state.bpmHistory.length
          );
          
          // Confianza basada en consistencia de intervalos
          const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          state.bpmConfidence = Math.max(0, Math.min(1, 1 - (stdDev / avgInterval)));
        }
      }
    }
    
    state.lastBeatTime = now;
  }
  
  // 🔍 DEBUG: Log detallado cada 2 segundos
  if (!state._lastFreqLog) state._lastFreqLog = 0;
  if (Date.now() - state._lastFreqLog > 2000) {
    state._lastFreqLog = Date.now();
    const bpmStr = state.calculatedBPM > 0 
      ? `🥁 BPM=${state.calculatedBPM} (${(state.bpmConfidence * 100).toFixed(0)}%)` 
      : '🥁 BPM=??? (calc...)';
    const threshStr = `thr=${dynamicThreshold.toFixed(2)}`;
    console.log(`🎚️ subB=${subBass.toFixed(2)} (pk=${state.peakSubBass.toFixed(2)} ${threshStr}) | B=${bass.toFixed(2)} M=${mid.toFixed(2)} T=${treble.toFixed(2)} | ${bpmStr}`);
  }
  
  return { bass, mid, treble, rms, beat, bpm: state.calculatedBPM, bpmConfidence: state.bpmConfidence };
}

function getAudioFromSimulator() {
  const now = Date.now();
  const time = now / 1000;
  
  // Beat cada beatInterval ms
  const beatInterval = 60000 / state.simulatorBPM;
  const timeSinceLastBeat = now - state.lastBeatTime;
  const beat = timeSinceLastBeat >= beatInterval;
  
  if (beat) {
    state.lastBeatTime = now;
  }
  
  // Bass con picos en beats
  const bassWave = Math.sin(time * 2) * 0.5 + 0.5;
  const bassRandom = Math.random() * 0.2;
  const bass = beat ? 0.85 + Math.random() * 0.15 : bassWave * 0.6 + bassRandom;
  
  // Mid con movimiento
  const midWave1 = Math.sin(time * 4 + 1) * 0.3 + 0.5;
  const midWave2 = Math.sin(time * 6.5 + 2) * 0.2;
  const midRandom = Math.random() * 0.15;
  const mid = (midWave1 + midWave2) * 0.6 + midRandom;
  
  // Treble rápido
  const trebleWave1 = Math.sin(time * 8 + 2) * 0.4 + 0.4;
  const trebleWave2 = Math.sin(time * 12.3 + 3) * 0.3;
  const trebleRandom = Math.random() * 0.25;
  const treble = (trebleWave1 + trebleWave2) * 0.4 + trebleRandom;
  
  const rms = (bass + mid + treble) / 3;
  
  return { bass, mid, treble, rms, beat };
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX MODES
// ═══════════════════════════════════════════════════════════════════════════

window.setDMXMode = async function(mode) {
  if (state.isRunning) {
    log('⚠️ Detén el demo antes de cambiar el modo', 'warn');
    return;
  }
  
  // Update button states
  document.querySelectorAll('[id^="btn-dmx-"]').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-dmx-${mode}`).classList.add('active');
  
  if (mode === 'tornado') {
    log('🌪️ Conectando Tornado USB DMX...', 'info');
    try {
      await initTornado();
      state.dmxMode = 'tornado';
      log('✅ Tornado USB conectado!', 'info');
    } catch (err) {
      log(`❌ Error Tornado: ${err.message}`, 'error');
      log('💡 Tip: Usa Chrome/Edge y asegúrate de que el Tornado está conectado', 'warn');
      // Fallback
      state.dmxMode = 'canvas';
      document.getElementById('btn-dmx-canvas').classList.add('active');
      document.getElementById('btn-dmx-tornado').classList.remove('active');
    }
  } else {
    log('🖥️ Modo: Simulador Canvas', 'info');
    state.dmxMode = 'canvas';
    if (state.tornadoDevice) {
      await state.tornadoDevice.close();
      state.tornadoDevice = null;
    }
  }
};

async function initTornado() {
  // Web USB API
  if (!navigator.usb) {
    throw new Error('Web USB no soportado en este navegador');
  }
  
  // Request device (FTDI based DMX interfaces)
  const device = await navigator.usb.requestDevice({
    filters: [
      { vendorId: 0x0403, productId: 0x6001 }, // FTDI FT232
      { vendorId: 0x0403, productId: 0x6010 }, // FTDI FT2232
      { vendorId: 0x0403, productId: 0x6014 }, // FTDI FT232H
    ]
  });
  
  await device.open();
  await device.selectConfiguration(1);
  await device.claimInterface(0);
  
  state.tornadoDevice = device;
  log(`🌪️ Conectado: ${device.productName || 'DMX USB Device'}`, 'info');
}

async function sendDMXFrame() {
  if (state.dmxMode !== 'tornado' || !state.tornadoDevice) return;
  
  // Crear frame DMX (513 bytes: start code + 512 channels)
  const frame = new Uint8Array(513);
  frame[0] = 0x00; // DMX start code
  
  // Llenar con datos de fixtures
  for (const fixture of state.fixtures) {
    const addr = fixture.dmxAddress - 1; // 0-based
    
    if (fixture.capabilities.rgb) {
      frame[addr + 1] = fixture.currentDimmer || 255;
      frame[addr + 2] = fixture.currentColor.r;
      frame[addr + 3] = fixture.currentColor.g;
      frame[addr + 4] = fixture.currentColor.b;
    }
    
    if (fixture.capabilities.pan) {
      frame[addr + 1] = fixture.currentPan || 127;
    }
    if (fixture.capabilities.tilt) {
      frame[addr + 2] = fixture.currentTilt || 127;
    }
  }
  
  try {
    await state.tornadoDevice.transferOut(2, frame);
  } catch (err) {
    console.error('DMX send error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════

window.startDemo = async function() {
  if (state.isRunning) return;
  
  log('🚀 Iniciando demo...', 'info');
  state.isRunning = true;
  
  // Start render loop
  renderLoop();
  
  log('✅ Demo en marcha! 🎉', 'info');
};

window.stopDemo = function() {
  if (!state.isRunning) return;
  
  state.isRunning = false;
  
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
  
  log('⏹️ Demo detenida', 'info');
};

window.testPattern = function() {
  log('🌈 Ejecutando patrón de prueba...', 'info');
  
  const colors = [
    { r: 255, g: 0, b: 0 },
    { r: 255, g: 127, b: 0 },
    { r: 255, g: 255, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 255, b: 255 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 0, b: 255 },
    { r: 255, g: 255, b: 255 },
  ];
  
  let step = 0;
  const interval = setInterval(() => {
    if (step >= colors.length * 2) {
      clearInterval(interval);
      // Blackout
      state.fixtures.forEach(f => {
        f.currentColor = { r: 0, g: 0, b: 0 };
        f.currentDimmer = 0;
      });
      renderFixtures();
      log('✅ Test completado', 'info');
      return;
    }
    
    state.fixtures.forEach((f, i) => {
      const colorIndex = (i + step) % colors.length;
      f.currentColor = { ...colors[colorIndex] };
      f.currentDimmer = 255;
    });
    
    renderFixtures();
    step++;
  }, 200);
};

window.blackout = function() {
  log('⚫ Blackout', 'info');
  
  state.fixtures.forEach(f => {
    f.currentColor = { r: 0, g: 0, b: 0 };
    f.currentDimmer = 0;
  });
  
  renderFixtures();
  updateFixtureList();
};

// ═══════════════════════════════════════════════════════════════════════════
// EFECTOS
// ═══════════════════════════════════════════════════════════════════════════

window.setEffect = function(effect) {
  log(`✨ Efecto: ${effect}`, 'info');
  state.currentEffect = effect;
  state.effectPhase = 0;
  
  // Update button states
  document.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
};

window.clearEffects = function() {
  log('🚫 Efectos desactivados', 'info');
  state.currentEffect = null;
  document.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌙 SELENE AI CONTROL
// ═══════════════════════════════════════════════════════════════════════════

window.toggleSeleneMode = function() {
  state.seleneMode = !state.seleneMode;
  const btn = document.getElementById('btn-selene-mode');
  const overlay = document.getElementById('selene-overlay');
  
  console.log('🌙 Toggle Selene:', state.seleneMode, 'window.selene:', !!window.selene);
  
  if (state.seleneMode) {
    btn.textContent = '🌙 Selene AI ACTIVA';
    btn.style.background = 'linear-gradient(135deg, #22C55E, #10B981)';
    btn.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.5)';
    if (overlay) overlay.style.display = 'flex';
    log('🌙 Selene AI activada - Ella controla ahora', 'info');
    
    // Reset Selene para nueva sesión
    if (window.selene) {
      window.selene.reset();
      console.log('🌙 Selene reset OK');
    } else {
      console.error('❌ window.selene NO EXISTE!');
    }
  } else {
    btn.textContent = '🌙 Activar Selene AI';
    btn.style.background = 'linear-gradient(135deg, #8B5CF6, #EC4899)';
    btn.style.boxShadow = 'none';
    if (overlay) overlay.style.display = 'none';
    log('🌙 Selene AI desactivada - Control manual', 'info');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETTE MANUAL CONTROL
// ═══════════════════════════════════════════════════════════════════════════

window.setPalette = function(paletteName) {
  if (!window.selene) {
    console.error('❌ Selene no cargada');
    return;
  }
  
  const result = window.selene.setPalette(paletteName);
  
  if (result.success) {
    // Actualizar UI
    const paletteLabels = {
      fuego: { icon: '🔥', name: 'FUEGO', color: '#F59E0B' },
      hielo: { icon: '❄️', name: 'HIELO', color: '#06B6D4' },
      selva: { icon: '🌿', name: 'SELVA', color: '#10B981' },
      neon:  { icon: '⚡', name: 'NEÓN', color: '#A855F7' },
    };
    
    const info = paletteLabels[result.palette] || { icon: '🎨', name: result.name, color: '#888' };
    
    // Actualizar texto de paleta activa
    const activePaletteEl = document.getElementById('active-palette');
    if (activePaletteEl) {
      activePaletteEl.innerHTML = `${info.icon} ${info.name}`;
      activePaletteEl.style.color = info.color;
    }
    
    // Actualizar overlay
    const overlayIcon = document.getElementById('overlay-palette-icon');
    const overlayName = document.getElementById('overlay-palette-name');
    if (overlayIcon) overlayIcon.textContent = info.icon;
    if (overlayName) {
      overlayName.textContent = info.name;
      overlayName.style.color = info.color;
    }
    
    // Resaltar botón activo
    ['fuego', 'hielo', 'selva', 'neon'].forEach(p => {
      const btn = document.getElementById(`btn-palette-${p}`);
      if (btn) {
        if (p === result.palette) {
          btn.style.boxShadow = `0 0 20px ${info.color}, inset 0 0 10px rgba(255,255,255,0.3)`;
          btn.style.transform = 'scale(1.05)';
        } else {
          btn.style.boxShadow = 'none';
          btn.style.transform = 'scale(1)';
        }
      }
    });
    
    log(`🎨 Paleta: ${info.icon} ${info.name}`, 'info');
  }
};

/**
 * 🌙 Actualiza el panel de Selene con la última decisión
 */
function updateSelenePanel(decision) {
  if (!decision) return;
  
  const colorRgb = decision.color ? 
    `rgb(${decision.color.r}, ${decision.color.g}, ${decision.color.b})` : '#F59E0B';
  
  const moodEmoji = {
    'drop': '🔥 DROP',
    'build': '📈 BUILD',
    'break': '🌙 BREAK',
    'silence': '🤫 SILENCE',
    'chill': '😎 CHILL'
  };
  
  const paletteEmoji = {
    'default': '🌙 Clásica',
    'latino': '🔥 Latino',
    'techno': '💀 Techno',
    'cyberpunk': '🌆 Cyberpunk',
    'trance': '🌀 Trance'
  };
  
  // === PANEL LATERAL (pequeño) ===
  const noteEl = document.getElementById('selene-note');
  const moodEl = document.getElementById('selene-mood');
  const beautyEl = document.getElementById('selene-beauty');
  const colorEl = document.getElementById('selene-color');
  const poemEl = document.getElementById('selene-poem');
  const paletteEl = document.getElementById('selene-palette');
  
  if (noteEl) {
    noteEl.textContent = decision.note;
    noteEl.style.color = colorRgb;
  }
  if (moodEl) moodEl.textContent = moodEmoji[decision.mood] || decision.mood;
  if (beautyEl) beautyEl.textContent = decision.beauty.toFixed(2);
  if (colorEl) {
    colorEl.style.background = colorRgb;
    colorEl.textContent = '';
  }
  if (poemEl) poemEl.textContent = decision.poem || '🌙 Procesando...';
  
  // 🆕 MOSTRAR PALETA ACTIVA
  if (paletteEl) {
    paletteEl.textContent = paletteEmoji[decision.palette] || decision.paletteName || 'Clásica';
  }
  
  // 🆕 MOSTRAR SCORES DE CADA PALETA (debug visual)
  if (window.selene && window.selene._lastScores) {
    const scores = window.selene._lastScores;
    const scoreLatino = document.getElementById('score-latino');
    const scoreTechno = document.getElementById('score-techno');
    const scoreCyberpunk = document.getElementById('score-cyberpunk');
    const scoreTrance = document.getElementById('score-trance');
    const confidenceEl = document.getElementById('selene-confidence');
    
    if (scoreLatino) scoreLatino.textContent = (scores.latino || 0).toFixed(2);
    if (scoreTechno) scoreTechno.textContent = (scores.techno || 0).toFixed(2);
    if (scoreCyberpunk) scoreCyberpunk.textContent = (scores.cyberpunk || 0).toFixed(2);
    if (scoreTrance) scoreTrance.textContent = (scores.trance || 0).toFixed(2);
    if (confidenceEl) confidenceEl.textContent = (decision.paletteConfidence || 0).toFixed(2);
    
    // Resaltar el ganador
    [scoreLatino, scoreTechno, scoreCyberpunk, scoreTrance].forEach(el => {
      if (el) el.style.fontWeight = 'normal';
    });
    const winnerEl = {
      'latino': scoreLatino,
      'techno': scoreTechno,
      'cyberpunk': scoreCyberpunk,
      'trance': scoreTrance
    }[decision.palette];
    if (winnerEl) {
      winnerEl.style.fontWeight = 'bold';
      winnerEl.style.textDecoration = 'underline';
    }
  }
  
  // === OVERLAY GRANDE (sobre el canvas) ===
  const noteBig = document.getElementById('selene-note-big');
  const colorBig = document.getElementById('selene-color-big');
  const moodBig = document.getElementById('selene-mood-big');
  const beautyRing = document.getElementById('selene-beauty-ring');
  const beautyValue = document.getElementById('selene-beauty-value');
  const poemBig = document.getElementById('selene-poem-big');
  const framesEl = document.getElementById('selene-frames');
  const dominantEl = document.getElementById('selene-dominant');
  const trendEl = document.getElementById('selene-trend');
  
  // Debug audio
  const debugBass = document.getElementById('selene-debug-bass');
  const debugMid = document.getElementById('selene-debug-mid');
  const debugTreble = document.getElementById('selene-debug-treble');
  
  if (noteBig) {
    noteBig.textContent = decision.note;
    noteBig.style.color = colorRgb;
    noteBig.style.textShadow = `0 0 30px ${colorRgb}`;
  }
  if (colorBig) {
    colorBig.style.background = colorRgb;
    colorBig.style.boxShadow = `0 0 40px ${colorRgb}`;
  }
  if (moodBig) {
    moodBig.textContent = moodEmoji[decision.mood] || decision.mood;
  }
  if (beautyRing) {
    const dashValue = Math.round(decision.beauty * 100);
    beautyRing.setAttribute('stroke-dasharray', `${dashValue}, 100`);
    // Color del ring según beauty
    if (decision.beauty > 0.7) beautyRing.setAttribute('stroke', '#22C55E');
    else if (decision.beauty > 0.4) beautyRing.setAttribute('stroke', '#F59E0B');
    else beautyRing.setAttribute('stroke', '#EF4444');
  }
  if (beautyValue) beautyValue.textContent = decision.beauty.toFixed(2);
  if (poemBig) poemBig.textContent = decision.poem || '🌙 Procesando...';
  
  // Debug audio en tiempo real
  if (debugBass) debugBass.textContent = state.bass.toFixed(2);
  if (debugMid) debugMid.textContent = state.mid.toFixed(2);
  if (debugTreble) debugTreble.textContent = state.treble.toFixed(2);
  
  // Stats de Selene
  if (window.selene) {
    const stats = window.selene.getStats();
    if (framesEl) framesEl.textContent = stats.framesProcessed;
    if (dominantEl) dominantEl.textContent = stats.dominantNote;
    if (trendEl) trendEl.textContent = stats.energyTrend;
  }
}

/**
 * 🌙 Aplica la decisión de Selene a todos los fixtures
 * 
 * TEORÍA DE ILUMINACIÓN POR FRECUENCIAS:
 * - FRONT PARs = KICK/Bass → Rojos/Naranjas (impacto)
 * - BACK PARs = Snare/Claps → Azules/Cyans (profundidad)  
 * - Moving LEFT = Melodía → Colores FRÍOS (verdes, cyans)
 * - Moving RIGHT = Melodía → Colores CÁLIDOS (rosas, violetas)
 * - Silencios = Fade out suave
 * - 🎭 V16: Moving heads con patrones Lissajous (circle, infinity, sweep, etc)
 */
function applySeleneDecision(decision, audioData = null) {
  if (!decision) return;
  
  const { color, intensity, zones } = decision;
  
  // Mapeo DIRECTO de zonas
  const ZONE_MAP = {
    'FRONT_PARS': 'front',
    'BACK_PARS': 'back',
    'MOVING_LEFT': 'movingLeft',
    'MOVING_RIGHT': 'movingRight',
    'STROBES': 'effects',
    'EFFECTS': 'effects',
  };
  
  // 🎭 V16: Actualizar movimiento si está disponible
  let movementOutput = null;
  if (window.selene && window.selene.movementEnabled && audioData) {
    movementOutput = window.selene.updateMovement(audioData);
  }
  
  // ⚡ V17: Procesar efectos activos
  let effectsState = null;
  if (window.selene && window.selene.effectsEnabled && window.selene.effectsEngine) {
    effectsState = window.selene.effectsEngine.effectManager.process(
      window.selene.effectsEngine.entropy
    );
  }
  
  state.fixtures.forEach((fixture) => {
    const fixtureZone = fixture.zone || 'FRONT_PARS';
    const seleneZone = ZONE_MAP[fixtureZone] || 'front';
    
    if (zones && zones[seleneZone]) {
      const zoneData = zones[seleneZone];
      // Aplicar color e intensidad directamente
      fixture.currentColor = { ...zoneData.color };
      fixture.currentDimmer = zoneData.intensity;
    } else {
      // Fallback
      fixture.currentColor = { ...color };
      fixture.currentDimmer = intensity;
    }
    
    // ⚡ V17: Aplicar efectos si están activos
    if (effectsState && effectsState.active) {
      // Dimmer multiplier (strobe, pulse, blinder)
      fixture.currentDimmer = Math.round(fixture.currentDimmer * effectsState.dimmerMultiplier);
      
      // Color override (blinder, police, rainbow)
      if (effectsState.colorOverride) {
        fixture.currentColor = { ...effectsState.colorOverride };
      }
      
      // Guardar estado de efecto para visualización
      fixture.effectActive = true;
      fixture.effectDimmerMult = effectsState.dimmerMultiplier;
    } else {
      fixture.effectActive = false;
      fixture.effectDimmerMult = 1.0;
    }
    
    // 🎭 V16: Aplicar movimiento a moving heads
    if (movementOutput && fixture.type === 'MOVING_HEAD') {
      const movementId = fixtureZone === 'MOVING_LEFT' ? 'moving_left' : 
                         fixtureZone === 'MOVING_RIGHT' ? 'moving_right' : null;
      
      if (movementId && movementOutput[movementId]) {
        const movement = movementOutput[movementId];
        fixture.currentPan = movement.pan;
        fixture.currentTilt = movement.tilt;
        
        // ⚡ V17: Aplicar position offset de efectos (shake, dizzy)
        if (effectsState && effectsState.active && effectsState.positionOffset) {
          fixture.currentPan = Math.max(0, Math.min(255, 
            fixture.currentPan + effectsState.positionOffset.pan));
          fixture.currentTilt = Math.max(0, Math.min(255, 
            fixture.currentTilt + effectsState.positionOffset.tilt));
        }
        
        // Fine channels si existen
        if (fixture.currentPanFine !== undefined) fixture.currentPanFine = movement.panFine || 0;
        if (fixture.currentTiltFine !== undefined) fixture.currentTiltFine = movement.tiltFine || 0;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE ZONA
// ═══════════════════════════════════════════════════════════════════════════

function applyDefaultBehavior(fixture, audio, palette, index) {
  // Comportamiento por defecto para fixtures sin zona
  let intensity = 0;
  if (index % 3 === 0) intensity = audio.bass;
  else if (index % 3 === 1) intensity = audio.mid;
  else intensity = audio.treble;
  
  const color = palette[index % palette.length];
  fixture.currentColor = {
    r: Math.floor(color.r * intensity),
    g: Math.floor(color.g * intensity),
    b: Math.floor(color.b * intensity),
  };
  fixture.currentDimmer = Math.floor(intensity * 255);
}

function updateMovingHeadPosition(fixture, zone, audio, index) {
  const now = Date.now();
  const behavior = zone.behavior;
  
  // Parámetros de movimiento basados en la música
  const moveSpeed = behavior.moveSpeed === 'fast' ? 0.003 : 
                    behavior.moveSpeed === 'slow' ? 0.0005 : 0.001;
  
  // Tiempo base para el movimiento suave
  const t = now * moveSpeed;
  
  // Offset único por fixture para que no se muevan todos igual
  const offset = index * 0.7;
  
  // === PATRONES DE MOVIMIENTO ===
  let targetPan, targetTilt;
  
  switch (behavior.pattern) {
    case 'sweep':
      // Barrido horizontal suave siguiendo la melodía
      targetPan = 127 + Math.sin(t + offset) * 80 * (0.5 + audio.mid * 0.5);
      targetTilt = 100 + Math.cos(t * 0.5 + offset) * 40 * audio.treble;
      break;
      
    case 'circle':
      // Movimiento circular
      targetPan = 127 + Math.cos(t + offset) * 60;
      targetTilt = 127 + Math.sin(t + offset) * 60;
      break;
      
    case 'mirror':
      // Espejo del lado izquierdo (invertir pan)
      targetPan = 127 - Math.sin(t + offset) * 80 * (0.5 + audio.mid * 0.5);
      targetTilt = 100 + Math.cos(t * 0.5 + offset) * 40 * audio.treble;
      break;
      
    case 'random':
      // Movimientos más erráticos en beats
      if (audio.beat) {
        fixture.targetPan = 50 + Math.random() * 155;
        fixture.targetTilt = 50 + Math.random() * 155;
      }
      targetPan = fixture.targetPan || 127;
      targetTilt = fixture.targetTilt || 127;
      break;
      
    default:
      targetPan = 127;
      targetTilt = 127;
  }
  
  // === REACCIÓN AL BEAT ===
  // En beats fuertes, movimiento más rápido/brusco
  if (audio.beat && audio.bass > 0.5) {
    // Añadir un "punch" al movimiento
    targetPan += (Math.random() - 0.5) * 30;
    targetTilt += (Math.random() - 0.5) * 20;
  }
  
  // === SUAVIZADO (easing) ===
  const smoothing = audio.beat ? 0.3 : 0.08; // Más rápido en beats
  
  const currentPan = fixture.currentPan || 127;
  const currentTilt = fixture.currentTilt || 127;
  
  fixture.currentPan = currentPan + (targetPan - currentPan) * smoothing;
  fixture.currentTilt = currentTilt + (targetTilt - currentTilt) * smoothing;
  
  // Clamp a rango válido (0-255)
  fixture.currentPan = Math.max(0, Math.min(255, fixture.currentPan));
  fixture.currentTilt = Math.max(0, Math.min(255, fixture.currentTilt));
}

function applyEffect(audio) {
  if (!state.currentEffect) return;
  
  state.effectPhase += 0.15;
  
  switch (state.currentEffect) {
    case 'chase':
      // Chase pattern - luces se encienden en secuencia
      state.fixtures.forEach((f, i) => {
        const phase = (state.effectPhase + i * 0.4) % (Math.PI * 2);
        const chaseIntensity = Math.max(0, Math.sin(phase));
        // Multiplicar el color actual por la intensidad del chase
        f.currentColor.r = Math.floor(f.currentColor.r * chaseIntensity);
        f.currentColor.g = Math.floor(f.currentColor.g * chaseIntensity);
        f.currentColor.b = Math.floor(f.currentColor.b * chaseIntensity);
        f.currentDimmer = Math.floor(f.currentDimmer * chaseIntensity);
      });
      break;
      
    case 'wave':
      // Wave effect - ola de colores que pasa por los fixtures
      state.fixtures.forEach((f, i) => {
        const phase = (state.effectPhase * 1.5 + i * 0.6) % (Math.PI * 2);
        const wave = (Math.sin(phase) + 1) / 2;
        // Mezclar el color actual con el efecto wave
        f.currentColor = {
          r: Math.floor(f.currentColor.r * (0.3 + wave * 0.7)),
          g: Math.floor(f.currentColor.g * (0.3 + (1 - wave) * 0.7)),
          b: Math.floor(f.currentColor.b * (0.5 + Math.sin(phase * 2) * 0.5)),
        };
      });
      break;
      
    case 'strobe':
      // Strobe real - parpadeo rápido sincronizado con bass
      const strobeOn = Math.floor(state.effectPhase * 3) % 2 === 0;
      if (audio.bass > 0.3 && strobeOn) {
        state.fixtures.forEach(f => {
          f.currentColor = { r: 255, g: 255, b: 255 };
          f.currentDimmer = 255;
        });
      } else if (audio.bass > 0.3) {
        // En el "off" del strobe, apagar
        state.fixtures.forEach(f => {
          f.currentColor = { r: 0, g: 0, b: 0 };
          f.currentDimmer = 0;
        });
      }
      // Si no hay bass suficiente, mantener colores normales
      break;
      
    case 'pulse':
      // Pulse - respiración suave que se intensifica en beats
      const breathe = (Math.sin(state.effectPhase * 0.5) + 1) / 2;
      const pulseIntensity = audio.beat ? 1 : (0.3 + breathe * 0.7);
      state.fixtures.forEach(f => {
        f.currentColor.r = Math.floor(f.currentColor.r * pulseIntensity);
        f.currentColor.g = Math.floor(f.currentColor.g * pulseIntensity);
        f.currentColor.b = Math.floor(f.currentColor.b * pulseIntensity);
        f.currentDimmer = Math.floor(f.currentDimmer * pulseIntensity);
      });
      break;
      
    case 'rainbow':
      // Rainbow cycle - arcoíris giratorio
      state.fixtures.forEach((f, i) => {
        const hue = ((state.effectPhase * 30 + i * 30) % 360);
        const rgb = hslToRgb(hue / 360, 1, 0.5);
        // Aplicar rainbow pero mantener la intensidad del audio
        const intensity = f.currentDimmer / 255;
        f.currentColor = { 
          r: Math.floor(rgb[0] * intensity), 
          g: Math.floor(rgb[1] * intensity), 
          b: Math.floor(rgb[2] * intensity) 
        };
      });
      break;
      
    case 'blackout':
      // Blackout total - TODO apagado
      state.fixtures.forEach(f => {
        f.currentColor = { r: 0, g: 0, b: 0 };
        f.currentDimmer = 0;
      });
      break;
  }
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════════════════════════

function renderLoop() {
  if (!state.isRunning) return;
  
  // Get audio data
  const audio = getAudioFrame();
  
  // Update state
  state.bass = audio.bass;
  state.mid = audio.mid;
  state.treble = audio.treble;
  state.rms = audio.rms;
  state.beat = audio.beat;
  
  // Beat decay
  const now = Date.now();
  const timeSinceBeat = now - state.lastBeatTime;
  state.beatDecay = Math.max(0, 1 - (timeSinceBeat / 400));
  
  // Calculate energy and select palette
  const energy = (audio.bass + audio.mid + audio.treble) / 3;
  let palette = ENERGY_COLORS.LOW;
  if (energy > 0.45) palette = ENERGY_COLORS.HIGH;  // Bajado de 0.6 para más rojos!
  else if (energy > 0.2) palette = ENERGY_COLORS.MID;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌙 MODO SELENE - Si está activa, ella controla todo
  // ═══════════════════════════════════════════════════════════════════════
  
  if (state.seleneMode && window.selene) {
    // Debug cada 60 frames (~1 segundo)
    if (window.selene.sessionStats.framesProcessed % 60 === 0) {
      console.log('🌙 Selene procesando frame', window.selene.sessionStats.framesProcessed, 
                  'audio:', { bass: audio.bass.toFixed(2), mid: audio.mid.toFixed(2), treble: audio.treble.toFixed(2) });
    }
    
    // Obtener decisión de Selene (ahora incluye BPM!)
    const seleneDecision = window.selene.process({
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.treble,
      rms: audio.rms,
      beat: audio.beat,
      bpm: audio.bpm || state.calculatedBPM || 0,           // 🥁 BPM calculado
      bpmConfidence: audio.bpmConfidence || state.bpmConfidence || 0,  // 🥁 Confianza
    });
    
    state.seleneDecision = seleneDecision;
    
    // Actualizar panel de Selene
    updateSelenePanel(seleneDecision);
    
    // Aplicar colores de Selene a los fixtures (+ movimiento V16)
    applySeleneDecision(seleneDecision, {
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.treble,
      beat: audio.beat,
      bpm: audio.bpm || state.calculatedBPM || 120,
    });
    
    // Render y siguiente frame
    renderFixtures();
    updateAudioBars(audio);
    updateStats(audio);
    state.animationFrame = requestAnimationFrame(renderLoop);
    return; // Skip el sistema de zonas manual
  } else if (state.seleneMode && !window.selene) {
    // Debug: Selene no está cargada
    console.warn('⚠️ Selene mode ON pero window.selene no existe!');
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SISTEMA DE ZONAS - Cada zona responde a diferentes frecuencias
  // ═══════════════════════════════════════════════════════════════════════
  
  state.fixtures.forEach((fixture, i) => {
    const zone = ZONES[fixture.zone];
    if (!zone) {
      applyDefaultBehavior(fixture, audio, palette, i);
      return;
    }
    
    const behavior = zone.behavior;
    
    // ═══════════════════════════════════════════════════════════════════════
    // THRESHOLD DE SENSIBILIDAD - Para crear apagones reales
    // ═══════════════════════════════════════════════════════════════════════
    const NOISE_THRESHOLD = 0.08;
    const MIN_INTENSITY_THRESHOLD = 0.10;
    
    let primaryIntensity = audio[behavior.frequency] || 0;
    let secondaryIntensity = audio[behavior.secondaryFreq] || 0;
    
    if (primaryIntensity < NOISE_THRESHOLD) primaryIntensity = 0;
    if (secondaryIntensity < NOISE_THRESHOLD) secondaryIntensity = 0;
    
    let intensity = (primaryIntensity * 0.8 + secondaryIntensity * 0.2) * behavior.intensity;
    
    // ═══════════════════════════════════════════════════════════════════════
    // LÓGICA POR TIPO DE ZONA
    // ═══════════════════════════════════════════════════════════════════════
    let fixtureColor;
    
    if (fixture.zone === 'FRONT_PARS') {
      // ═══════════════════════════════════════════════════════════════════
      // FRONT PARs: KICK/BASS DIRECTO - Colores CÁLIDOS
      // Solo reaccionan a bass FUERTE (no ruido ambiente)
      // ═══════════════════════════════════════════════════════════════════
      
      const PARS_THRESHOLD = 0.22; // Más alto para ignorar ruido/voces
      
      if (audio.bass < PARS_THRESHOLD) {
        // Por debajo del threshold = probablemente ruido, apagar
        fixture.currentColor = { r: 0, g: 0, b: 0 };
        fixture.currentDimmer = 0;
        return;
      }
      
      // Normalizar intensidad quitando la zona de ruido
      intensity = (audio.bass - PARS_THRESHOLD) / (1 - PARS_THRESHOLD);
      
      // Beat punch para los frontales
      if (state.beatDecay > 0.5) {
        intensity = Math.min(1, intensity * 1.5);
      }
      
      // Color basado en nivel de bass NORMALIZADO
      if (intensity > 0.7) {
        // ROJO FUEGO - Kick muy fuerte
        fixtureColor = { r: 255, g: 30, b: 0 };
      } else if (intensity > 0.5) {
        // NARANJA INTENSO
        fixtureColor = { r: 255, g: 100, b: 0 };
      } else if (intensity > 0.3) {
        // NARANJA-AMARILLO
        fixtureColor = { r: 255, g: 180, b: 0 };
      } else if (intensity > 0.1) {
        // AMARILLO
        fixtureColor = { r: 255, g: 230, b: 50 };
      } else {
        // AMARILLO SUAVE
        fixtureColor = { r: 200, g: 200, b: 0 };
      }
      
    } else if (fixture.zone === 'BACK_PARS') {
      // ═══════════════════════════════════════════════════════════════════
      // BACK PARs: SNARE/CLAPS + REVERB - Colores FRÍOS (profundidad)
      // También con threshold alto para evitar ruido
      // ═══════════════════════════════════════════════════════════════════
      
      const BACK_THRESHOLD = 0.18;
      const backEnergy = (audio.mid * 0.6 + audio.bass * 0.4);
      
      if (backEnergy < BACK_THRESHOLD) {
        fixture.currentColor = { r: 0, g: 0, b: 0 };
        fixture.currentDimmer = 0;
        return;
      }
      
      // Normalizar
      const backIntensity = (backEnergy - BACK_THRESHOLD) / (1 - BACK_THRESHOLD);
      
      if (backIntensity < MIN_INTENSITY_THRESHOLD) {
        fixture.currentColor = { r: 0, g: 0, b: 0 };
        fixture.currentDimmer = 0;
        return;
      }
      
      intensity = backIntensity * behavior.intensity;
      
      // Delay effect (ligeramente retrasados del front)
      if (behavior.beatDelay && state.beatDecay > 0.3) {
        intensity = Math.min(1, intensity * 1.3);
      }
      
      // Colores FRÍOS para crear profundidad
      const midLevel = audio.mid;
      
      if (midLevel > 0.6) {
        // CYAN BRILLANTE - Clap/Snare fuerte
        fixtureColor = { r: 0, g: 255, b: 255 };
      } else if (midLevel > 0.45) {
        // AZUL ELÉCTRICO
        fixtureColor = { r: 50, g: 150, b: 255 };
      } else if (midLevel > 0.30) {
        // AZUL-VIOLETA
        fixtureColor = { r: 100, g: 100, b: 255 };
      } else if (midLevel > 0.15) {
        // VIOLETA SUAVE
        fixtureColor = { r: 150, g: 50, b: 200 };
      } else {
        // AZUL OSCURO (ambiente)
        fixtureColor = { r: 50, g: 50, b: 150 };
      }
      
    } else if (zone.role === 'melody') {
      // ═══════════════════════════════════════════════════════════════════
      // MOVING HEADS: MELODÍA/ARMONÍA
      // - SÍ se apagan en silencios melódicos
      // - Color basado en RANGO de frecuencia (mid=cálido, treble=frío)
      // - Suavizado para evitar parpadeo tipo strobe
      // ═══════════════════════════════════════════════════════════════════
      
      const mid = audio.mid;
      const treble = audio.treble;
      const melodyEnergy = (mid * 0.6 + treble * 0.4);
      
      // ═══ THRESHOLD: SÍ se apagan en silencios ═══
      const MELODY_THRESHOLD = 0.12;
      
      if (melodyEnergy < MELODY_THRESHOLD) {
        // Silencio melódico = apagar (con fade suave)
        const currentSmoothed = fixture.smoothedIntensity || 0;
        fixture.smoothedIntensity = currentSmoothed * 0.85; // Fade out suave
        
        if (fixture.smoothedIntensity < 0.05) {
          fixture.currentColor = { r: 0, g: 0, b: 0 };
          fixture.currentDimmer = 0;
          return;
        }
        intensity = fixture.smoothedIntensity;
        // Mantener último color durante fade
        fixtureColor = fixture.lastColor || { r: 100, g: 100, b: 100 };
      } else {
        // ═══ HAY MELODÍA: Calcular color e intensidad ═══
        
        // Intensidad suavizada (máx 85% para dejar espacio a efectos)
        const targetIntensity = Math.min(0.85, melodyEnergy * 1.2);
        const currentSmoothed = fixture.smoothedIntensity || 0;
        const smoothing = 0.12; // Suave pero no tanto
        fixture.smoothedIntensity = currentSmoothed + (targetIntensity - currentSmoothed) * smoothing;
        intensity = fixture.smoothedIntensity;
        
        // ═══════════════════════════════════════════════════════════════
        // COLOR BASADO EN RATIO MID/TREBLE
        // - Más MID que TREBLE = melodía grave (voz, pads) = CÁLIDOS
        // - Más TREBLE que MID = melodía aguda (leads, arps) = FRÍOS
        // - Equilibrado = colores intermedios
        // ═══════════════════════════════════════════════════════════════
        
        const totalMelody = mid + treble + 0.001; // Evitar div/0
        const midRatio = mid / totalMelody;       // 0-1, cuánto es mid
        const trebleRatio = treble / totalMelody; // 0-1, cuánto es treble
        
        // Color objetivo basado en frecuencias
        let targetColor;
        
        if (fixture.zone === 'MOVING_LEFT') {
          // ═══ IZQUIERDA: Espectro FRÍO con variación ═══
          if (midRatio > 0.6) {
            targetColor = { r: 0, g: 255, b: 150 };   // Verde turquesa
          } else if (trebleRatio > 0.6) {
            targetColor = { r: 0, g: 200, b: 255 };   // Cyan eléctrico
          } else if (melodyEnergy > 0.5) {
            targetColor = { r: 0, g: 255, b: 255 };   // Cyan puro
          } else if (melodyEnergy > 0.3) {
            targetColor = { r: 50, g: 150, b: 255 };  // Azul cielo
          } else {
            targetColor = { r: 100, g: 220, b: 180 }; // Verde menta
          }
        } else {
          // ═══ DERECHA: Espectro CÁLIDO (complementario) ═══
          if (midRatio > 0.6) {
            targetColor = { r: 255, g: 100, b: 120 }; // Rosa coral
          } else if (trebleRatio > 0.6) {
            targetColor = { r: 180, g: 50, b: 255 };  // Violeta brillante
          } else if (melodyEnergy > 0.5) {
            targetColor = { r: 255, g: 0, b: 200 };   // Magenta
          } else if (melodyEnergy > 0.3) {
            targetColor = { r: 255, g: 80, b: 180 };  // Rosa fuerte
          } else {
            targetColor = { r: 200, g: 150, b: 220 }; // Lavanda
          }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // SUAVIZADO DE COLOR - Interpolación para evitar parpadeo
        // Los colores cambian gradualmente, no de golpe
        // ═══════════════════════════════════════════════════════════════
        const COLOR_SMOOTHING = 0.08; // Muy suave (0.08 = ~12 frames para transición)
        
        const prevColor = fixture.smoothedColor || targetColor;
        fixtureColor = {
          r: Math.round(prevColor.r + (targetColor.r - prevColor.r) * COLOR_SMOOTHING),
          g: Math.round(prevColor.g + (targetColor.g - prevColor.g) * COLOR_SMOOTHING),
          b: Math.round(prevColor.b + (targetColor.b - prevColor.b) * COLOR_SMOOTHING),
        };
        fixture.smoothedColor = fixtureColor;
        
        // Guardar color para el fade out
        fixture.lastColor = { ...fixtureColor };
      }
    } else {
      fixtureColor = palette[i % palette.length];
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // APLICAR COLOR FINAL
    // ═══════════════════════════════════════════════════════════════════════
    fixture.currentColor = {
      r: Math.floor(fixtureColor.r * intensity),
      g: Math.floor(fixtureColor.g * intensity),
      b: Math.floor(fixtureColor.b * intensity),
    };
    fixture.currentDimmer = Math.floor(intensity * 255);
    
    // === MOVING HEADS AUTO-MOVEMENT ===
    if (behavior.autoMove && fixture.capabilities.pan && fixture.capabilities.tilt) {
      updateMovingHeadPosition(fixture, zone, audio, i);
    }
  });
  
  // Apply effect overlay
  applyEffect(audio);
  
  // Render
  renderFixtures();
  updateAudioBars(audio);
  updateStats(audio);
  updateFixtureList();
  
  // Send DMX if tornado mode
  if (state.dmxMode === 'tornado') {
    sendDMXFrame();
  }
  
  // Next frame
  state.animationFrame = requestAnimationFrame(renderLoop);
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderFixtures() {
  const ctx = state.ctx;
  const canvas = state.canvas;
  if (!ctx || !canvas) return;
  
  // Clear
  ctx.fillStyle = '#0a0a15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Grid background
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Title
  ctx.fillStyle = '#00FFFF';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎪 LUXSYNC - 12 Fixtures en 4 Zonas', canvas.width / 2, 30);
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYOUT DE DISCOTECA PROFESIONAL
  // 
  //   [MH_L1] [MH_L2] [MH_L3]          [MH_R1] [MH_R2] [MH_R3]
  //        \     |     /                  \      |     /
  //         MOVING LEFT                    MOVING RIGHT
  //              |                              |
  //   ┌─────────────────────────────────────────────────┐
  //   │                    ESCENARIO                    │
  //   └─────────────────────────────────────────────────┘
  //        [PAR_B1] [PAR_B2] [PAR_B3]  <- BACK PARS
  //        
  //              ~~~  PISTA  ~~~
  //        
  //        [PAR_F1] [PAR_F2] [PAR_F3]  <- FRONT PARS
  // ═══════════════════════════════════════════════════════════════════════
  
  const centerX = canvas.width / 2;
  const marginX = 80;
  
  // Definir posiciones por zona
  const positions = {
    // FRONT PARS - Fila inferior (frente al público)
    'par_1': { x: centerX - 150, y: canvas.height - 80, zone: 'FRONT_PARS' },
    'par_2': { x: centerX,       y: canvas.height - 80, zone: 'FRONT_PARS' },
    'par_3': { x: centerX + 150, y: canvas.height - 80, zone: 'FRONT_PARS' },
    
    // BACK PARS - Fila media-baja (detrás del DJ)
    'par_4': { x: centerX - 150, y: canvas.height - 200, zone: 'BACK_PARS' },
    'par_5': { x: centerX,       y: canvas.height - 200, zone: 'BACK_PARS' },
    'par_6': { x: centerX + 150, y: canvas.height - 200, zone: 'BACK_PARS' },
    
    // MOVING LEFT - Arriba izquierda
    'mh_1': { x: marginX + 50,  y: 120, zone: 'MOVING_LEFT' },
    'mh_2': { x: marginX + 130, y: 90,  zone: 'MOVING_LEFT' },
    'mh_3': { x: marginX + 210, y: 120, zone: 'MOVING_LEFT' },
    
    // MOVING RIGHT - Arriba derecha
    'mh_4': { x: canvas.width - marginX - 210, y: 120, zone: 'MOVING_RIGHT' },
    'mh_5': { x: canvas.width - marginX - 130, y: 90,  zone: 'MOVING_RIGHT' },
    'mh_6': { x: canvas.width - marginX - 50,  y: 120, zone: 'MOVING_RIGHT' },
  };
  
  // Dibujar etiquetas de zona
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillStyle = '#FF6B6B';
  ctx.fillText('🔴 FRONT PARS (Bass)', centerX, canvas.height - 35);
  ctx.fillStyle = '#FFA94D';
  ctx.fillText('🟠 BACK PARS (Bass + Delay)', centerX, canvas.height - 155);
  ctx.fillStyle = '#69DB7C';
  ctx.textAlign = 'left';
  ctx.fillText('🟢 MOVING LEFT (Melody)', marginX + 130, 55);
  ctx.textAlign = 'right';
  ctx.fillText('🟢 MOVING RIGHT (Mirror)', canvas.width - marginX - 130, 55);
  ctx.textAlign = 'center';
  
  // Dibujar línea del escenario
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(50, canvas.height - 280);
  ctx.lineTo(canvas.width - 50, canvas.height - 280);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.font = '10px Inter';
  ctx.fillText('─── ESCENARIO ───', centerX, canvas.height - 285);
  
  // ⚡ V17: Obtener estado de efectos para visualización
  const effectsDebug = window.selene?.getEffectsDebugState?.() || null;
  const activeEffects = effectsDebug?.activeEffects || [];
  
  // Renderizar cada fixture
  state.fixtures.forEach((fixture) => {
    const pos = positions[fixture.id];
    if (!pos) return;
    
    const x = pos.x;
    const y = pos.y;
    const color = fixture.currentColor;
    const dimmer = fixture.currentDimmer / 255;
    
    // ⚡ V17: Efecto de strobe visual (parpadeo rápido del halo)
    const isStrobeActive = fixture.effectActive && fixture.effectDimmerMult < 0.5;
    const strobeFlash = isStrobeActive ? (Math.random() > 0.5 ? 1.5 : 0.3) : 1.0;
    
    // === HALO/GLOW - Diferente por zona ===
    // FRONT PARs: Halo normal (90px)
    // BACK PARs: Halo MÁS GRANDE (120px) para compensar distancia visual
    // MOVING: Halo medio (80px)
    let glowMultiplier = 90;
    if (pos.zone === 'BACK_PARS') {
      glowMultiplier = 130; // Más grande para que se vean igual que los front
    } else if (pos.zone === 'MOVING_LEFT' || pos.zone === 'MOVING_RIGHT') {
      glowMultiplier = 85;
    }
    
    // ⚡ V17: Multiplicar por strobe flash si está activo
    const glowRadius = glowMultiplier * dimmer * strobeFlash;
    if (glowRadius > 5) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`);
      gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
      gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Fixture body
    const radius = fixture.type === 'MOVING_HEAD' ? 28 : 22;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fill();
    ctx.strokeStyle = fixture.type === 'MOVING_HEAD' ? '#00FFFF' : '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner glow
    if (dimmer > 0.1) {
      const innerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      innerGradient.addColorStop(0, `rgba(255, 255, 255, ${dimmer * 0.6})`);
      innerGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Moving head beam indicator - V16 mejorado con PAN + TILT
    if (fixture.type === 'MOVING_HEAD' && fixture.capabilities.pan) {
      // PAN: Ángulo horizontal (-135° a +135° = 270° total)
      const panAngle = ((fixture.currentPan || 127) / 255) * Math.PI * 1.5 - Math.PI * 0.75;
      
      // TILT: Afecta la LONGITUD del beam (0=mirando arriba/corto, 127=horizontal, 255=abajo/corto)
      // Normalizamos: tilt 40-200 (zona segura) → 0.3 a 1.0 de longitud
      const tiltNorm = (fixture.currentTilt || 127) / 255;
      // Parábola: máxima longitud en tilt=127 (horizontal), mínima en extremos
      const tiltFactor = 1 - Math.pow((tiltNorm - 0.5) * 2, 2) * 0.7;
      
      const baseLength = 50 + dimmer * 30;
      const beamLength = baseLength * Math.max(0.3, tiltFactor);
      
      // Beam glow
      const beamGradient = ctx.createLinearGradient(
        x, y,
        x + Math.cos(panAngle) * beamLength,
        y + Math.sin(panAngle) * beamLength
      );
      beamGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
      beamGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(panAngle) * beamLength,
        y + Math.sin(panAngle) * beamLength
      );
      ctx.strokeStyle = beamGradient;
      ctx.lineWidth = 4 + dimmer * 4;
      ctx.stroke();
      
      // Beam core
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(panAngle) * beamLength * 0.8,
        y + Math.sin(panAngle) * beamLength * 0.8
      );
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // 🎯 Indicador de TILT (círculo en la punta que cambia de tamaño)
      const tipX = x + Math.cos(panAngle) * beamLength * 0.9;
      const tipY = y + Math.sin(panAngle) * beamLength * 0.9;
      const tiltIndicatorSize = 3 + (1 - Math.abs(tiltNorm - 0.5) * 2) * 5; // Grande=horizontal
      
      ctx.beginPath();
      ctx.arc(tipX, tipY, tiltIndicatorSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
      ctx.fill();
    }
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const shortName = fixture.name.replace('PAR ', 'P').replace('Beam ', 'B').replace('Spot ', 'S');
    ctx.fillText(shortName, x, y + radius + 15);
  });
  
  // Status
  ctx.fillStyle = state.isRunning ? '#10B981' : '#EF4444';
  ctx.font = 'bold 12px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(state.isRunning ? '● RUNNING' : '○ STOPPED', 15, canvas.height - 15);
  
  ctx.fillStyle = '#888';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.audioMode === 'mic' ? '🎤 MIC' : '🎵 SIM'} | ${state.dmxMode === 'tornado' ? '🌪️ USB' : '🖥️ CANVAS'}`, canvas.width - 15, canvas.height - 15);
}

// ═══════════════════════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════════════════════

function updateAudioBars(audio) {
  document.getElementById('bar-bass').style.height = `${audio.bass * 100}%`;
  document.getElementById('bar-bass2').style.height = `${audio.bass * 80}%`;
  document.getElementById('bar-mid').style.height = `${audio.mid * 100}%`;
  document.getElementById('bar-mid2').style.height = `${audio.mid * 80}%`;
  document.getElementById('bar-treble').style.height = `${audio.treble * 100}%`;
  document.getElementById('bar-treble2').style.height = `${audio.treble * 80}%`;
  
  // Actualizar overlay compacto
  const overlayBass = document.getElementById('overlay-bass');
  const overlayMid = document.getElementById('overlay-mid');
  const overlayTreble = document.getElementById('overlay-treble');
  const overlayBpm = document.getElementById('overlay-bpm');
  const overlayBeat = document.getElementById('overlay-beat');
  
  if (overlayBass) overlayBass.style.height = `${Math.max(5, audio.bass * 30)}px`;
  if (overlayMid) overlayMid.style.height = `${Math.max(5, audio.mid * 30)}px`;
  if (overlayTreble) overlayTreble.style.height = `${Math.max(5, audio.treble * 30)}px`;
  
  if (overlayBpm) {
    const bpm = state.calculatedBPM || state.simulatorBPM || 0;
    overlayBpm.textContent = bpm > 0 ? Math.round(bpm) : '---';
  }
  
  if (overlayBeat && audio.beat) {
    overlayBeat.style.background = 'radial-gradient(circle, #EF4444 0%, #DC2626 100%)';
    overlayBeat.style.boxShadow = '0 0 20px #EF4444';
    overlayBeat.style.transform = 'scale(1.1)';
    setTimeout(() => {
      overlayBeat.style.background = 'radial-gradient(circle, #333 0%, #111 100%)';
      overlayBeat.style.boxShadow = 'none';
      overlayBeat.style.transform = 'scale(1)';
    }, 100);
  }
}

function updateStats(audio) {
  document.getElementById('stat-bpm').textContent = state.simulatorBPM;
  
  const beatEl = document.getElementById('stat-beat');
  if (audio.beat) {
    beatEl.textContent = '🔴 BEAT!';
    beatEl.classList.add('beat');
  } else {
    beatEl.textContent = '⚫';
    beatEl.classList.remove('beat');
  }
}

function updateFixtureList() {
  const list = document.getElementById('fixture-list');
  if (!list) return;
  
  list.innerHTML = state.fixtures.map(f => {
    const c = f.currentColor;
    const colorStyle = `background: rgb(${c.r}, ${c.g}, ${c.b}); box-shadow: 0 0 10px rgb(${c.r}, ${c.g}, ${c.b})`;
    return `
      <div class="fixture-item">
        <div class="fixture-color" style="${colorStyle}"></div>
        <span class="fixture-name">${f.name}</span>
        <span class="fixture-dmx">DMX ${f.dmxAddress}</span>
      </div>
    `;
  }).join('');
}

function log(message, type = 'info') {
  const logDiv = document.getElementById('log');
  if (!logDiv) return;
  
  const entry = document.createElement('div');
  entry.className = `log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
  
  // Keep only last 50 entries
  while (logDiv.children.length > 50) {
    logDiv.removeChild(logDiv.firstChild);
  }
  
  console.log(`[LuxSync] ${message}`);
}
