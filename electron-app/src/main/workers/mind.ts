/**
 * 🧠 GAMMA WORKER - MIND (Selene Brain)
 * 
 * Worker Thread dedicado a la inteligencia de Selene.
 * 
 * TRINITY PHASE 1: Integrado con motores Wave 8 vía TrinityBridge
 * 
 * Procesa análisis de audio y genera decisiones de iluminación:
 * - REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * - REGLA 3: Syncopation > BPM para selección de patrones
 * - Memory Management (patrones aprendidos)
 * - Predictive Engine
 * - Aesthetic Decision Making
 * - Personality System
 * 
 * Recibe AudioAnalysis+Wave8Data de ALPHA (via BETA).
 * Envía LightingDecisions a ALPHA para DMX.
 */

// 🔇 WAVE 37.0: Silencio Táctico - Solo logs de alto nivel
const DEBUG_VERBOSE = false;

import { parentPort, workerData } from 'worker_threads';
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  AudioAnalysis,
  LightingDecision,
  WorkerHealth,
  HeartbeatPayload,
  HeartbeatAckPayload,
  RGBColor,
  MovementPattern,
  createMessage,
  TrinityConfig,
  DEFAULT_CONFIG,
  isAudioAnalysis
} from './WorkerProtocol';

// Wave 8 Bridge imports
import {
  sectionToMovement,
  createReactiveDecision,
  RhythmOutput,
  HarmonyOutput,
  SectionOutput,
  GenreOutput,
} from './TrinityBridge';

// 🎨 WAVE 17.2: Selene Color Engine - Motor procedural determinista
// 🌊 WAVE 70: Añadido SeleneColorInterpolator para transiciones suaves en Worker
import {
  SeleneColorEngine,
  SeleneColorInterpolator,
  paletteToRgb,
  type SelenePalette,
  type RGBColor as SeleneRGBColor,
  type ExtendedAudioAnalysis as SeleneExtendedAnalysis,
} from '../selene-lux-core/engines/visual/SeleneColorEngine';

// ⚓ WAVE 51: Key Stabilizer - Estabilización tonal para evitar parpadeo de color
import { KeyStabilizer } from '../selene-lux-core/engines/visual/KeyStabilizer';

// 🏎️ WAVE 52: Energy Stabilizer - Suavizado de energía y detección de silencio
import { EnergyStabilizer } from '../selene-lux-core/engines/visual/EnergyStabilizer';

// �️ WAVE 94: AGC - Automatic Gain Control (The Professional Ear)
import { AutomaticGainControl } from '../selene-lux-core/engines/audio/AutomaticGainControl';

// �🎭 WAVE 53: Mood Arbiter - Estabilización emocional para coherencia térmica
import { MoodArbiter, type MetaEmotion } from '../selene-lux-core/engines/visual/MoodArbiter';

// 🎨 WAVE 54: Strategy Arbiter - Estabilización de estrategia de color
import { StrategyArbiter, type ColorStrategy, type SectionType } from '../selene-lux-core/engines/visual/StrategyArbiter';

// 🎛️ WAVE 60: Vibe Manager - Bounded Context Provider (RESTRINGIR, NO FORZAR)
import { VibeManager } from '../../engines/context/VibeManager';
import type { VibeId } from '../../types/VibeProfile';
// 📜 WAVE 148: Color Constitutions - Reglas cromáticas por Vibe
import { getColorConstitution } from '../../engines/context/colorConstitutions';

// 🎯 WAVE 16: Schmitt Triggers para efectos sin flicker
import { getEffectTriggers } from './utils/HysteresisTrigger';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'gamma' as const;

// ============================================
// 🎨 WAVE 17.2: SeleneColorEngine (Static Class)
// ============================================
// Ya NO necesitamos instanciarlo - todos los métodos son estáticos
// El motor lee ExtendedAudioAnalysis y produce SelenePalette proceduralmente

// ============================================
// 🌊 WAVE 12.5: SELENE LIBRE - Sin Etiquetas
// ============================================
// FILOSOFÍA: El arte no necesita etiquetas de género.
// Los colores emergen PURAMENTE de la matemática musical:
//   - Energy → Saturación
//   - Syncopation → Contraste  
//   - Key → Tono (Hue)
//   - Density → Complejidad
// 
// El mismo Cyberpunk y la misma Cumbia producirán colores
// DIFERENTES porque su DNA musical es matemáticamente diferente.
// ============================================

// ============================================
// PERSONALITY & AESTHETIC SYSTEM
// ============================================

interface SelenePersonality {
  // Core traits (0-1)
  boldness: number;        // Preference for dramatic changes
  fluidity: number;        // Smooth vs sharp transitions
  colorfulness: number;    // Preference for saturated colors
  symmetry: number;        // Preference for symmetric patterns
  responsiveness: number;  // How quickly to react to music
  
  // Mood (influenced by music)
  currentMood: 'energetic' | 'calm' | 'dark' | 'playful';
}

const personality: SelenePersonality = {
  boldness: 0.6,
  fluidity: 0.7,
  colorfulness: 0.8,
  symmetry: 0.5,
  responsiveness: 0.75,
  currentMood: 'calm'
};

// ============================================
// NOTE: PALETTES eliminado en PHASE 1.5 (OPERATION PURGE)
// 🎨 WAVE 17.2: Ahora usamos ÚNICAMENTE SeleneColorEngine
// que genera colores proceduralmente basados en:
//   - Key (Círculo de Quintas → Cromático)
//   - Mode (temperature modifiers)
//   - Energy → saturación y brillo
//   - Syncopation → estrategia de contraste
//   - Macro-Género → subtle bias (NO forzado)
// ============================================

// ============================================
// STATE
// ============================================

/**
 * Extended AudioAnalysis with Wave 8 data (from BETA)
 * 🎨 WAVE 17.2: Compatible con SeleneColorEngine.ExtendedAudioAnalysis
 */
interface ExtendedAudioAnalysis extends AudioAnalysis {
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
  };
}

interface GammaState {
  isRunning: boolean;
  isPaused: boolean;  // 🔌 WAVE 63.95: System sleep state (no audio processing)
  frameCount: number;
  decisionCount: number;
  startTime: number;
  lastHeartbeat: number;
  
  // Audio history for pattern detection
  audioHistory: ExtendedAudioAnalysis[];
  maxAudioHistory: number;
  
  // 🎨 WAVE 17.2: Current state con nuevo motor
  currentPalette: SelenePalette | null;  // SelenePalette del nuevo motor (o null inicial)
  currentMoodHint: string;               // From Wave 8 harmony
  currentMovement: MovementPattern;
  lastDecisionTime: number;
  
  // Wave 8 Operation Mode (REGLA 2)
  operationMode: 'intelligent' | 'reactive';
  combinedConfidence: number;
  
  // 🧠 WAVE 10: Brain forced mode (from main process Big Switch)
  brainForced: boolean;
  
  // 🌊 WAVE 23.4: Smoothed syncopation (EMA filter)
  smoothedSync: number;
  
  // 💫 WAVE 47.1.7: Mood hysteresis (evitar flickeo)
  lastStableMood: string;
  lastMoodChangeTime: number;
  
  // ⚓ WAVE 51: Key Stabilizer instance
  keyStabilizer: KeyStabilizer;
  
  // 🏎️ WAVE 52: Energy Stabilizer instance
  energyStabilizer: EnergyStabilizer;
  
  // �️ WAVE 94: AGC - Automatic Gain Control
  agc: AutomaticGainControl;
  
  // �🎭 WAVE 53: Mood Arbiter instance
  moodArbiter: MoodArbiter;
  
  // 🎨 WAVE 54: Strategy Arbiter instance
  strategyArbiter: StrategyArbiter;
  
  // 🌊 WAVE 70: Color Interpolator para transiciones suaves en Worker
  colorInterpolator: SeleneColorInterpolator;
  lastFrameTime: number;
  
  // 🔬 WAVE 74: Diagnóstico de saltos de Hue
  lastSentHue: number;
  hueJumpCount: number;
  
  // Memory (learned patterns)
  learnedPatterns: Map<string, LearnedPattern>;
  
  // Performance
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
}

interface LearnedPattern {
  id: string;
  audioSignature: {
    bpmRange: [number, number];
    energyRange: [number, number];
    mood: string;
  };
  lightingResponse: {
    palette: string;
    movement: MovementPattern;
    intensity: number;
  };
  successScore: number;  // How well this pattern worked
  useCount: number;
}

const state: GammaState = {
  isRunning: false,
  isPaused: false,  // 🔌 WAVE 63.95: System sleep state
  frameCount: 0,
  decisionCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  
  audioHistory: [],
  maxAudioHistory: 60, // ~1 second at 60fps
  
  // 🎨 WAVE 17.2: Inicialización neutral (se genera en primer frame con audio real)
  currentPalette: null,  // Se genera dinámicamente con SeleneColorEngine
  currentMoodHint: 'neutral',
  currentMovement: 'sweep',
  lastDecisionTime: Date.now(),
  
  // Wave 8 defaults
  // 🔧 WAVE 74: CONFIDENCE CRASH FIX - Arrancar en intelligent por defecto
  // El modo reactive es un fallback para cuando hay problemas, no el modo normal
  operationMode: 'intelligent',
  combinedConfidence: 0.7,  // Default razonable hasta que se calcule el real
  
  // 🧠 WAVE 10 + WAVE 74: Brain activation flag (from main process)
  // 🔧 WAVE 74: Ahora TRUE por defecto - Selene es el modo principal
  brainForced: true,  // When true, ALWAYS use intelligent mode
  
  // 🌊 WAVE 23.4: Smoothed syncopation (inicializado en 0)
  smoothedSync: 0,
  
  // 💫 WAVE 47.1.7: Mood hysteresis (evitar flickeo)
  lastStableMood: 'dark',           // Default para electrónica
  lastMoodChangeTime: Date.now(),   // Timestamp del último cambio
  
  // ⚓ WAVE 51: Key Stabilizer - Evita cambios frenéticos de color
  // 🔥 WAVE 66.8: lockingFrames aumentado a 600 (10 segundos) para máxima estabilidad
  // ✅ WAVE 70.5 VALIDADO: lockingFrames=600 >> 180 mínimo requerido (3s)
  keyStabilizer: new KeyStabilizer({
    bufferSize: 720,        // 12 segundos de historia @ 60fps (WAVE 66.8: era 480)
    lockingFrames: 600,     // 10 segundos para confirmar cambio de key (WAVE 66.8: era 180)
    dominanceThreshold: 0.45,  // Key debe tener >45% de votos (WAVE 66.8: era 35%)
    useEnergyWeighting: true,  // Votos ponderados por energía
  }),
  
  // 🏎️ WAVE 52: Energy Stabilizer - Suavizado de energía + detección de silencio
  // NOTA: Se configura después de state para poder conectar el callback
  energyStabilizer: new EnergyStabilizer({
    smoothingWindowFrames: 120,  // 2 segundos @ 60fps
    silenceThreshold: 0.02,      // Prácticamente silencio
    silenceResetFrames: 180,     // 3 segundos = nueva canción
    emaFactor: 0.95,             // 95% histórico, 5% nuevo
  }),
  
  // �️ WAVE 94: AGC - Automatic Gain Control (The Professional Ear)
  agc: new AutomaticGainControl({
    peakDecay: 0.995,        // Decaimiento muy lento
    minPeak: 0.10,           // No amplificar más de 10x
    initialPeak: 0.50,       // Comenzar con peak moderado
    warmupFrames: 120,       // 2 segundos de calibración
  }),
  
  // �🎭 WAVE 53: Mood Arbiter - Estabilización emocional (temperatura térmica)
  moodArbiter: new MoodArbiter({
    bufferSize: 600,           // 10 segundos @ 60fps
    lockingFrames: 300,        // 5 segundos para confirmar cambio emocional
    dominanceThreshold: 0.60,  // 60% de dominancia requerida
    useEnergyWeighting: true,
    confidenceBonus: 1.5,
  }),
  
  // 🎨 WAVE 54: Strategy Arbiter - Estabilización de estrategia de color
  strategyArbiter: new StrategyArbiter({
    bufferSize: 900,           // 15 segundos @ 60fps
    lockingFrames: 900,        // 15 segundos de bloqueo
    lowSyncThreshold: 0.35,    // < 0.35 = ANALOGOUS (orden)
    highSyncThreshold: 0.55,   // > 0.55 = COMPLEMENTARY (caos)
    hysteresisBand: 0.05,
    dropOverrideEnergy: 0.85,
  }),
  
  // 🌊 WAVE 70: Color Interpolator para transiciones suaves en Worker
  // Evita "epilepsia cromática" - transiciones suaves entre paletas
  colorInterpolator: new SeleneColorInterpolator(),
  lastFrameTime: Date.now(),
  
  // 🔬 WAVE 74: Diagnóstico de saltos de Hue
  lastSentHue: -1,
  hueJumpCount: 0,
  
  learnedPatterns: new Map(),
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: []
};

// �️ WAVE 60: Vibe Manager - Singleton para restricciones de contexto
// FILOSOFÍA: RESTRINGIR, NO FORZAR - El DJ define el contexto, Selene opera dentro
const vibeManager = VibeManager.getInstance();

// �🏎️ WAVE 52 + 🎭 WAVE 53 + 🎨 WAVE 54: Conectar cadena de reset COMPLETA
// Cuando EnergyStabilizer detecta silencio prolongado (entre canciones),
// reseteamos TODOS los estabilizadores para que la nueva canción empiece limpia.
state.energyStabilizer.onReset(() => {
  console.log('[GAMMA] 🏎️→⚓🎭🎨 SILENCE RESET: All stabilizers cleared for new song');
  state.keyStabilizer.reset();
  state.moodArbiter.reset();
  state.strategyArbiter.reset();
});

// ============================================
// COLOR UTILITIES (Pure functions - no legacy dependencies)
// ============================================

function adjustColorIntensity(color: RGBColor, intensity: number): RGBColor {
  return {
    r: Math.round(color.r * intensity),
    g: Math.round(color.g * intensity),
    b: Math.round(color.b * intensity)
  };
}

// ============================================
// DECISION GENERATION - WAVE 8 INTEGRATED
// ============================================

/**
 * Generate lighting decision using Wave 8 intelligence
 * 
 * REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * REGLA 3: Syncopation > BPM para patrones
 */
function generateDecision(analysis: ExtendedAudioAnalysis): LightingDecision {
  const startTime = performance.now();
  state.frameCount++;
  state.decisionCount++;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎚️ WAVE 94: AGC - NORMALIZACIÓN DINÁMICA
  // Aplicar antes de cualquier procesamiento para compensar volúmenes
  // ═══════════════════════════════════════════════════════════════════════════
  const rawEnergy = analysis.energy ?? 0;
  const rawBass = analysis.bass ?? 0;
  const rawMid = analysis.mid ?? 0;
  const rawTreble = analysis.treble ?? 0;
  
  const agcOutput = state.agc.update(rawEnergy, rawBass, rawMid, rawTreble);
  
  // Sobrescribir análisis con valores normalizados
  const normalizedAnalysis: ExtendedAudioAnalysis = {
    ...analysis,
    energy: agcOutput.normalizedEnergy,
    bass: agcOutput.normalizedBass,
    mid: agcOutput.normalizedMid,
    treble: agcOutput.normalizedTreble,
  };
  
  // Usar análisis normalizado de aquí en adelante
  const effectiveAnalysis = normalizedAnalysis;
  
  // 🏎️ WAVE 52: Procesar energía a través del stabilizer (AHORA NORMALIZADA)
  // Esto detecta silencio y suaviza la energía para evitar parpadeo
  const energyOutput = state.energyStabilizer.update(effectiveAnalysis.energy);
  
  // 📊 WAVE 93+94: LOG DIAGNÓSTICO - Una vez por segundo (60 frames @ 60fps)
  if (state.frameCount % 60 === 0) {
    console.log(`[AUDIO_DEBUG] Raw:[E:${rawEnergy.toFixed(2)} B:${rawBass.toFixed(2)}] → AGC:[E:${agcOutput.normalizedEnergy.toFixed(2)} B:${agcOutput.normalizedBass.toFixed(2)}] Peak:${agcOutput.maxPeak.toFixed(2)} Gain:${agcOutput.gainFactor.toFixed(1)}x`);
  }
  
  // Add to history (normalizado)
  state.audioHistory.push(effectiveAnalysis);
  if (state.audioHistory.length > state.maxAudioHistory) {
    state.audioHistory.shift();
  }
  
  // === REGLA 2: Check confidence for mode selection ===
  // 🧠 WAVE 10: brainForced overrides REGLA 2 - si el usuario puso SELENE, ¡USAMOS EL BRAIN!
  const wave8 = analysis.wave8;
  if (wave8) {
    // Calculate combined confidence (REGLA 2)
    // 🔧 WAVE 74: CONFIDENCE CRASH FIX - GenreClassifier fue eliminado (zombie muerto)
    // wave8.genre.confidence ahora siempre es 0, así que redistribuimos los pesos
    // ANTES: rhythm=0.35, harmony=0.20, section=0.20, genre=0.25 (máximo=0.75 sin genre)
    // AHORA: rhythm=0.45, harmony=0.30, section=0.25, genre=0 (máximo=1.0)
    state.combinedConfidence = 
      wave8.rhythm.confidence * 0.45 +
      wave8.harmony.confidence * 0.30 +
      wave8.section.confidence * 0.25;
      // wave8.genre.confidence ya no se usa - GenreClassifier eliminado en WAVE 70+
    
    // 🧠 WAVE 10: brainForced ignora la confidence - SI EL USUARIO DIJO SELENE, SELENE ES
    if (state.brainForced) {
      state.operationMode = 'intelligent';
    } else {
      state.operationMode = state.combinedConfidence >= 0.5 ? 'intelligent' : 'reactive';
    }
  } else {
    // Sin wave8 data, pero si brainForced, intentamos intelligent anyway
    state.operationMode = state.brainForced ? 'intelligent' : 'reactive';
    state.combinedConfidence = state.brainForced ? 0.6 : 0.3;
  }
  
  // === REACTIVE MODE (V17 Style) ===
  // 🧠 WAVE 10: Solo si NO está forzado el brain
  if (state.operationMode === 'reactive' && !state.brainForced) {
    // Direct audio → light mapping (fast fallback)
    const reactiveDecision = createReactiveDecision(analysis, state.frameCount);
    state.totalProcessingTime += performance.now() - startTime;
    state.messagesProcessed++;
    state.lastDecisionTime = Date.now();
    return reactiveDecision;
  }
  
  // === INTELLIGENT MODE (Wave 8 Full Analysis) ===
  const { rhythm, harmony, section, genre } = wave8!;
  
  // 🌊 WAVE 23.4 + WAVE 74: SUAVIZADO DE SYNCOPATION (EMA Filter)
  // Evita parpadeo visual causado por cambios abruptos (0.90 → 0.10)
  // EMA: smoothed = (smoothed * alpha) + (new * (1 - alpha))
  // 🔒 WAVE 74: alpha = 0.95 (95% histórico, 5% nuevo) → suavizado EXTREMO
  // Antes era 0.8/0.2 - ahora mucho más lento para evitar saltos de estrategia
  state.smoothedSync = (state.smoothedSync * 0.95) + (rhythm.syncopation * 0.05);
  
  // � WAVE 17.2: SELENE COLOR ENGINE - Motor determinista procedural
  // Los colores emergen de la MATEMÁTICA MUSICAL:
  //   - Key → Hue (Círculo de Quintas = Círculo Cromático)
  //   - Mode → Temperature modifier (major +15°, minor -15°, etc.)
  //   - Energy → Saturación y Brillo (NUNCA cambia el hue)
  //   - Syncopation → Estrategia de contraste (analogous/complementary/triadic/split)
  //   - Macro-Género → Subtle bias (tempBias, satBoost, lightBoost)
  //   - Fibonacci rotation → Secondary color (φ × 360° = 222.5°)
  
  // 🧹 WAVE 63: LOGS CLEANUP - Eliminados logs masivos de HEARTBEAT/genre/scores
  // Los logs de genre/senate/votes fueron ELIMINADOS (VibeManager es el nuevo dueño)
  // Se mantienen: [VibeManager], [StrategyArbiter] DROP START/END, [ColorEngine] Palette
  
  // ⚓ WAVE 51: KEY STABILIZATION - Estabilizar la Key antes de generar colores
  // Esto evita que acordes de paso cambien el color de toda la sala
  const keyStabilizerOutput = state.keyStabilizer.update({
    key: harmony.key,
    confidence: harmony.confidence,
    energy: effectiveAnalysis.energy,  // 🎚️ WAVE 94: Usar energía normalizada
  });

  // 🎭 WAVE 53: MOOD ARBITRATION - Estabilizar estado emocional
  // Esto evita fluctuaciones térmicas (Cálido↔Frío) por acordes pasajeros
  const moodArbiterOutput = state.moodArbiter.update({
    mode: harmony.mode,
    mood: harmony.mood,
    confidence: harmony.confidence,
    energy: effectiveAnalysis.energy,  // 🎚️ WAVE 94: Usar energía normalizada
    key: keyStabilizerOutput.stableKey,  // 🌍 WAVE 55: Para Zodiac Affinity
  });

  // 🎨 WAVE 54: STRATEGY ARBITRATION - Estabilizar estrategia de color
  // Esto evita cambios de contraste por picos de sincopa momentaneos
  const strategyArbiterOutput = state.strategyArbiter.update({
    syncopation: rhythm.syncopation,
    sectionType: section.type as SectionType,
    energy: effectiveAnalysis.energy,  // 🎚️ WAVE 94: Usar energía normalizada
    confidence: rhythm.confidence,
    isRelativeDrop: energyOutput.isRelativeDrop, // WAVE 55: DROP relativo
    vibeId: vibeManager.getActiveVibe().id, // 🔫 WAVE 164: Para override de reglas
  });
  
  // 🎛️ WAVE 60: VIBE CONSTRAINTS - Aplicar restricciones del contexto
  // El VibeManager actúa como "Gatekeeper" que restringe las decisiones
  // de los Arbiters según el Vibe seleccionado por el DJ.
  vibeManager.updateTransition(state.frameCount);
  
  // Constrain MetaEmotion (BRIGHT/DARK/NEUTRAL) según Vibe
  const constrainedEmotion = vibeManager.constrainMetaEmotion(moodArbiterOutput.stableEmotion);
  
  // Constrain Strategy según Vibe
  const constrainedStrategy = vibeManager.constrainStrategy(
    strategyArbiterOutput.stableStrategy as ColorStrategy
  );
  
  // WAVE 52-54 + 60 + 73: Crear analisis FULL STABILIZED + VIBE CONSTRAINED
  // - stableKey: evita cambio de color por acordes de paso
  // - smoothedEnergy: evita parpadeo por picos de kick
  // - constrainedEmotion: coherencia térmica según Vibe (WAVE 60)
  // - constrainedStrategy: coherencia de contraste según Vibe (WAVE 60)
  // 🏛️ WAVE 73: MOOD INJECTION - Inyectar constrainedEmotion en wave8.harmony.mood
  // Esto asegura que SeleneColorEngine use el mood validado por Vibe, no el raw
  const constrainedMood = constrainedEmotion.toLowerCase() as 'bright' | 'dark' | 'neutral';
  
  // 🌴 WAVE 84: Mover activeVibe aquí para inyectar vibeId en stabilizedAnalysis
  const activeVibe = vibeManager.getActiveVibe();
  
  const stabilizedAnalysis = {
    ...analysis,
    energy: energyOutput.smoothedEnergy,
    // 🏛️ WAVE 73: Top-level mood para fallback
    mood: constrainedMood,
    // 🌴 WAVE 84: Vibe ID para paleta Tropical (Caribeña, Latina)
    vibeId: activeVibe.id,
    wave8: {
      ...wave8,
      rhythm: {
        ...rhythm,
        syncopation: strategyArbiterOutput.averagedSyncopation,
      },
      harmony: {
        ...harmony,
        key: keyStabilizerOutput.stableKey,
        // 🏛️ WAVE 73: CRITICAL FIX - Sobrescribir mood RAW con mood VALIDADO
        // SeleneColorEngine lee wave8.harmony.mood para determinar el Hue
        // Antes: usaba el mood crudo del audio (podía ser 'dark' en Fiesta Latina)
        // Ahora: usa constrainedMood que respeta el Vibe seleccionado
        mood: constrainedMood,
        temperature: constrainedEmotion === 'BRIGHT' ? 'warm' :
                     constrainedEmotion === 'DARK' ? 'cold' : 'neutral',
      },
    },
  } as SeleneExtendedAnalysis;
  
  // � WAVE 70: Calcular dt para interpolación suave
const frameTime = Date.now();
  const isDrop = section.type === 'drop' || section.type === 'chorus';

  // 📜 WAVE 148: Obtener la Constitución de Color del Vibe activo
  // Esto incluye forbiddenHueRanges, allowedHueRanges, ambientLock (si existe), etc.
  const colorConstitution = getColorConstitution(activeVibe.id);

  // 🎨 WAVE 70: Generar paleta INTERPOLADA (no raw)
  // El interpolador suaviza transiciones entre Keys y Moods
  // isDrop = true → transición rápida (0.5s), false → transición suave (4s)
  // ⚡ WAVE 148: Pasar la Constitución al interpolador para que aplique las reglas
  const selenePalette = state.colorInterpolator.update(stabilizedAnalysis, isDrop, colorConstitution);

  // 🔬 WAVE 74: DIAGNÓSTICO DE SALTOS DE HUE
  // Solo loguea cuando hay un salto > 30° (epilepsia cromática)
  const currentHue = selenePalette.primary.h;
  if (state.lastSentHue >= 0) {
    let hueDiff = Math.abs(currentHue - state.lastSentHue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff; // Camino más corto
    
    if (hueDiff > 30) {
      state.hueJumpCount++;
      console.warn(`[WAVE74] 🚨 HUE JUMP #${state.hueJumpCount}: ${state.lastSentHue.toFixed(0)}° → ${currentHue.toFixed(0)}° (Δ${hueDiff.toFixed(0)}°) | key=${keyStabilizerOutput.stableKey} mood=${constrainedMood} strategy=${constrainedStrategy} isDrop=${isDrop}`);
    }
  }
  state.lastSentHue = currentHue;

  // Generar RGB desde la paleta interpolada (no desde análisis directo)
  const rgbPalette = paletteToRgb(selenePalette);

  // Actualizar lastFrameTime para próximo frame
  state.lastFrameTime = frameTime;  
  
  // 🔬 WAVE 65 + 73: Chromatic Audit Log (Smart logging - solo cuando hay cambios)
  // 🏛️ WAVE 73: Usar constrainedMood en lugar de stableEmotion para reflejar lo que realmente usa el motor
  // 🌴 WAVE 84: activeVibe ya declarado arriba para inyectar vibeId
  const overrideReason = strategyArbiterOutput.overrideType !== 'none' 
    ? strategyArbiterOutput.overrideType : null;
  SeleneColorEngine.logChromaticAudit(
    { 
      key: keyStabilizerOutput.stableKey, 
      mood: constrainedMood,  // 🏛️ WAVE 73: El mood que REALMENTE usa el motor (no el raw)
      energy: energyOutput.smoothedEnergy 
    },
    selenePalette,
    activeVibe.id,
    overrideReason
  );
  
  // Guardar en state
  state.currentPalette = selenePalette;
  
  // Calculate intensity - 🎛️ WAVE 60: Apply Vibe dimmer constraints
  const baseIntensity = section.energy;
  const beatBoost = analysis.onBeat ? 0.2 * analysis.beatStrength : 0;
  const rawIntensity = Math.min(1, baseIntensity + beatBoost);
  
  // 🎛️ WAVE 60: Constrain intensity through VibeManager
  // Aplica floor/ceiling y reglas de blackout según el Vibe activo
  const intensity = vibeManager.constrainDimmer(rawIntensity);
  
  // Select movement based on section (from Wave 8)
  const movementPattern = sectionToMovement(section, effectiveAnalysis.energy, rhythm.syncopation);
  state.currentMovement = movementPattern;
  
  // 🔥 WAVE 74: Build palette with RAW RGB (sin intensity aplicada)
  // Intensity se envía separada para que Main Process interpole colores puros
  // y aplique intensity al FINAL (evita flickering por beat boost)
  // 🌴 WAVE 84.5: Añadir ambient para STEREO REAL (4 colores distintos)
  const palette = {
    primary: rgbPalette.primary,      // 🔥 RAW - sin adjustColorIntensity
    secondary: rgbPalette.secondary,  // 🔥 RAW
    accent: rgbPalette.accent,        // 🔥 RAW
    ambient: rgbPalette.ambient,      // 🌴 WAVE 84.5: STEREO - color independiente
    intensity                         // Se envía separada para aplicar después de interpolación
  };
  
  // Movement parameters (influenced by genre)
  // WAVE 18.3: genre is now GenreAnalysis (.genre) not GenreOutput (.primary)
  const genreValue = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
  const genreSpeedMultiplier = genreValue === 'techno' ? 1.2 : 
                               genreValue === 'reggaeton' ? 0.9 :
                               genreValue === 'cumbia' ? 0.85 : 1.0;
  
  const movement = {
    pattern: movementPattern,
    speed: (0.3 + analysis.bpm / 300) * genreSpeedMultiplier,
    range: 0.5 + section.energy * 0.5,
    sync: (analysis.bpmConfidence > 0.7 ? 'beat' : 
           section.type === 'chorus' || section.type === 'drop' ? 'phrase' : 'free') as 'beat' | 'phrase' | 'free'
  };
  
  // Effects (section-aware) - 🎯 WAVE 16: Con Schmitt Triggers
  // Los triggers tienen histéresis para evitar flicker
  const effectTriggers = getEffectTriggers();
  const triggerStates = effectTriggers.processAll(effectiveAnalysis.energy);
  
  // Lógica mejorada: combina triggers con contexto musical
  const shouldStrobe = triggerStates.strobe && 
                       (section.type === 'drop' || section.type === 'chorus') && 
                       analysis.onBeat && 
                       personality.boldness > 0.5;
  
  const shouldChase = triggerStates.chase &&
                      (section.type === 'drop' || section.type === 'buildup');
  
  const shouldPulse = triggerStates.pulse &&
                      analysis.onBeat;
  
  const shouldLaser = triggerStates.laser &&
                      (harmony.mood === 'tense' || analysis.treble > 0.7);
  
  const shouldPrism = triggerStates.prism &&
                      (section.type === 'chorus' || harmony.mood === 'dreamy');
  
  // 🎛️ WAVE 60: Apply Vibe effect constraints
  // El VibeManager puede prohibir strobe o limitar su velocidad
  const maxStrobeRate = vibeManager.getMaxStrobeRate();
  const vibeAllowsStrobe = maxStrobeRate > 0 && vibeManager.isEffectAllowed('strobe');
  
  // Calculate strobe rate respecting Vibe constraints
  let strobeRate: number | undefined;
  if (shouldStrobe && vibeAllowsStrobe && analysis.bpm > 140) {
    const rawStrobeRate = analysis.bpm / 60;
    strobeRate = maxStrobeRate > 0 ? Math.min(rawStrobeRate, maxStrobeRate) : rawStrobeRate;
  }
  
  const effects = {
    strobe: shouldStrobe && vibeAllowsStrobe,
    strobeRate,
    fog: section.type === 'buildup' ? section.energy * 0.8 :
         section.type === 'breakdown' ? 0.3 : 0,
    laser: shouldLaser,
    // 🎯 WAVE 16: Nuevos efectos con triggers
    chase: shouldChase,
    pulse: shouldPulse,
    prism: shouldPrism,
  };
  
  // Calculate beauty score with Wave 8 data
  const beautyScore = calculateBeautyScore(analysis, palette, movement, wave8);
  
  // 💫 WAVE 47.1.3: MOOD ARBITRATION - Jerarquía de 4 niveles
  // Prioridad: genre.mood > harmony.mood > VAD.mood > fallback
  // Este es el "árbitro final" que consolida todas las fuentes de mood
  let finalMood: string = 'peaceful'; // 4️⃣ Default Fallback
  
  // Extraer VAD mood del MoodSynthesizer
  const vadMood = (analysis.wave8 as any)?.mood?.primary ?? 'peaceful';
  
  // Extraer genre mood (de GenreAnalysis)
  const genreMood = (genre as any).mood ?? null;
  const genreConfidence = genre.confidence;
  const genreName = (genre as any).genre ?? (genre as any).primary ?? 'unknown';
  
  // Extraer harmony mood
  const harmonyMood = harmony.mood ?? null;
  const harmonyConfidence = harmony.confidence;
  
  // 🔧 WAVE 47.1.6: ELECTRONIC GENRE OVERRIDE
  // Si el género detectado es ELECTRONIC (aunque confidence sea baja),
  // NO permitir que VAD "harmonious" gane - es incorrecto para techno
  const isElectronicGenre = genreName.startsWith('ELECTRONIC');
  const electronicMoodOverride = isElectronicGenre ? 
    (genreMood === 'chill' ? 'calm' : genreMood ?? 'dark') : null;
  
  // 1️⃣ PRIORIDAD MÁXIMA: Contexto de Género (The Senate)
  // Si el género está claro (>0.6) y tiene opinión fuerte (no neutral)
  if (genreConfidence > 0.6 && genreMood && genreMood !== 'chill') {
    finalMood = genreMood;
  }
  // 🔧 WAVE 47.1.6: Si es género electrónico pero confidence baja, usar override
  else if (isElectronicGenre && electronicMoodOverride) {
    finalMood = electronicMoodOverride;
  }
  // 2️⃣ PRIORIDAD MEDIA: Teoría Musical (Harmony)
  // Si no hay género fuerte, pero la tonalidad dicta emoción (ej: Minor -> Sad)
  else if (harmonyConfidence > 0.7 && harmonyMood) {
    // Mapear harmony.mood a finalMood (UI moods)
    if (harmonyMood === 'happy' || harmonyMood === 'bluesy') {
      finalMood = 'energetic';
    } else if (harmonyMood === 'sad' || harmonyMood === 'tense') {
      finalMood = 'dark';
    } else if (harmonyMood === 'dreamy' || harmonyMood === 'jazzy') {
      finalMood = 'calm';
    } else if (harmonyMood === 'spanish_exotic') {
      finalMood = 'playful';
    }
  }
  // 3️⃣ PRIORIDAD BAJA: VAD (Instinto Crudo del MoodSynthesizer)
  // Solo si los anteriores fallan o son neutros
  else {
    finalMood = vadMood;
  }
  
  // 💫 WAVE 47.1.7: MOOD HYSTERESIS
  // El mood de un DJ set no cambia 10 veces por segundo.
  // Solo permitir cambio si han pasado al menos 10 segundos.
  const MOOD_HYSTERESIS_MS = 10000; // 10 segundos mínimo entre cambios
  const now = Date.now();
  const timeSinceLastChange = now - state.lastMoodChangeTime;
  
  if (finalMood !== state.lastStableMood) {
    if (timeSinceLastChange >= MOOD_HYSTERESIS_MS) {
      // Suficiente tiempo ha pasado, permitir el cambio
      state.lastStableMood = finalMood;
      state.lastMoodChangeTime = now;
    } else {
      // No ha pasado suficiente tiempo, mantener el mood anterior
      finalMood = state.lastStableMood;
    }
  }
  
  // Update personality mood (ahora basado en finalMood arbitrado + hysteresis)
  // Mapear a los 4 moods permitidos por personality interface
  if (finalMood === 'energetic' || finalMood === 'dramatic' || finalMood === 'euphoric') {
    personality.currentMood = 'energetic';
  } else if (finalMood === 'dark') {
    personality.currentMood = 'dark';
  } else if (finalMood === 'calm' || finalMood === 'peaceful') {
    personality.currentMood = 'calm';
  } else if (finalMood === 'playful') {
    personality.currentMood = 'playful';
  }

  // 🧹 WAVE 63: MOOD ARBITRATION log eliminado (contenía genre/senate legacy)
  // El VibeManager es el nuevo dueño del contexto
  
  // Track processing time
  state.totalProcessingTime += performance.now() - startTime;
  state.messagesProcessed++;
  state.lastDecisionTime = Date.now();
  
  return {
    timestamp: Date.now(),
    frameId: state.frameCount,
    decisionId: `decision-${state.decisionCount}-${Date.now()}`,
    
    confidence: state.combinedConfidence,
    beautyScore,
    source: 'procedural', // Could be 'memory' when using learned patterns
    
    palette,
    movement,
    effects,
    
    // 🎨 WAVE 68.5: Debug info from SeleneColorEngine (PURO - sin género)
    // 🔥 WAVE 23.1 OPERATION TRUTH: Exponer paletteSource real (sin histéresis)
    // 🌊 WAVE 23.4: Syncopation suavizado (EMA) para DNA derivation
    // 💫 WAVE 47.1.3: MOOD ARBITRATION - Enviar finalMood (arbitrado) no VAD raw
    // 🎭 WAVE 53: Mood Arbiter - Meta-emoción estabilizada
    // 🎛️ WAVE 60: Vibe activo
    debugInfo: {
      strategy: selenePalette.meta.strategy,
      temperature: selenePalette.meta.temperature,
      description: selenePalette.meta.description,
      key: keyStabilizerOutput.stableKey,  // ⚓ WAVE 51: Key ESTABILIZADA
      mode: harmony.mode,
      source: 'procedural' as const,  // 🔥 LA VERDAD CRUDA - mind.ts siempre es procedural (no usa Brain)
      syncopation: state.smoothedSync,  // 🌊 WAVE 23.4: Syncopation suavizado (EMA) para evitar flicker en DNA
      // 🎛️ WAVE 60: Vibe Engine Info
      activeVibe: vibeManager.getActiveVibe().id,
      vibeTransitioning: vibeManager.isTransitioning(),
      mood: {
        primary: finalMood,  // 💫 WAVE 47.1.3: Mood arbitrado (genre > harmony > VAD)
        stableEmotion: constrainedEmotion,  // 🎭 WAVE 53 + 60: Constrained by Vibe
        // 🌡️ WAVE 68.1: Thermal Temperature - DIRECT FROM PALETTE (UNIFIED SOURCE)
        // SeleneColorEngine calcula temperatura basada en HUE de la paleta real
        // Esto garantiza que UI y logs muestren el MISMO valor
        thermalTemperature: (() => {
          const isLatinoVibe = activeVibe.id.toLowerCase().includes('latin') || 
                              activeVibe.id.toLowerCase().includes('fiesta');
          let effectiveTemp = selenePalette.meta.temperature;
          
          // Hard clamp para Latino (failsafe)
          if (isLatinoVibe && effectiveTemp !== 'warm') {
            effectiveTemp = 'warm';
          }
          
          // Calcular Kelvin (mismo algoritmo que logChromaticAudit)
          let tempKelvin = 4500;
          if (effectiveTemp === 'warm') {
            tempKelvin = 3000 + Math.floor(selenePalette.primary.h / 360 * 500);
          } else if (effectiveTemp === 'cool') {
            tempKelvin = 5500 + Math.floor((360 - selenePalette.primary.h) / 360 * 1000);
          }
          
          // Clamp final para Latino (max 4500K)
          if (isLatinoVibe) {
            tempKelvin = Math.min(tempKelvin, 4500);
          }
          
          return tempKelvin;
        })(),
        // 🎨 WAVE 54: Strategy Arbiter output (dentro de mood porque debugInfo tiene tipos estrictos)
        colorStrategy: {
          stable: constrainedStrategy,  // 🎛️ WAVE 60: Constrained by Vibe
          instant: strategyArbiterOutput.instantStrategy,
          avgSyncopation: strategyArbiterOutput.averagedSyncopation,
          contrastLevel: strategyArbiterOutput.contrastLevel,
          sectionOverride: strategyArbiterOutput.overrideType,
        },
        raw: (analysis.wave8 as any)?.mood,  // ⚠️ VAD raw preservado para debug
        sources: {
          genre: { mood: genreMood, confidence: genreConfidence },
          harmony: { mood: harmonyMood, confidence: harmonyConfidence },
          vad: { mood: vadMood }
        }
      },
      sectionDetail: section,  // 💫 WAVE 47.1: SectionTracker output completo
      // 🎢 WAVE 57.5: DROP STATE MACHINE - Estado real del drop
      drop: {
        isDropActive: state.energyStabilizer.isDropActive,
        dropState: state.energyStabilizer.getDropState(),
      },
      // 🎚️ WAVE 94.2: AGC normalized audio para Relative Gates en fixtures
      agc: {
        normalizedBass: agcOutput.normalizedBass,
        normalizedMid: agcOutput.normalizedMid,
        normalizedTreble: agcOutput.normalizedTreble,
        normalizedEnergy: agcOutput.normalizedEnergy,
        avgNormEnergy: agcOutput.avgNormEnergy,
        gainFactor: agcOutput.gainFactor,
      },
    }
  };
}

function calculateBeautyScore(
  analysis: ExtendedAudioAnalysis,
  _palette: LightingDecision['palette'],
  movement: LightingDecision['movement'],
  wave8?: ExtendedAudioAnalysis['wave8']
): number {
  // Aesthetic heuristics
  let score = 0.5; // Base
  
  // Sync bonus
  if (movement.sync === 'beat' && analysis.bpmConfidence > 0.7) {
    score += 0.15;
  }
  
  // Energy matching (usa analysis directo - scoring estético no afecta control)
  const energyMatch = 1 - Math.abs(analysis.energy - movement.range);
  score += energyMatch * 0.1;
  
  // Groove bonus (REGLA 3: good groove = good vibes)
  score += analysis.groove * 0.15;
  
  // Wave 8 bonuses
  if (wave8) {
    // Genre confidence bonus
    if (wave8.genre.confidence > 0.7) score += 0.1;
    
    // Section-appropriate bonus (usa analysis directo - scoring estético no afecta control)
    if ((wave8.section.type === 'drop' || wave8.section.type === 'chorus') && analysis.energy > 0.7) {
      score += 0.1;
    }
    
    // Harmony coherence
    if (wave8.harmony.confidence > 0.6) score += 0.05;
  }
  
  return Math.min(1, score);
}

// ============================================
// HEALTH REPORTING
// ============================================

function generateHealthReport(): WorkerHealth {
  const uptime = Date.now() - state.startTime;
  const memUsage = process.memoryUsage();
  
  let status: WorkerHealth['status'] = 'healthy';
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    status = 'critical';
  } else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
    status = 'degraded';
  }
  
  return {
    nodeId: NODE_ID,
    timestamp: Date.now(),
    cpuUsage: 0,
    memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    messagesProcessed: state.messagesProcessed,
    messagesPerSecond: state.messagesProcessed / (uptime / 1000),
    avgProcessingTime: state.messagesProcessed > 0 
      ? state.totalProcessingTime / state.messagesProcessed 
      : 0,
    status,
    lastError: state.errors[state.errors.length - 1],
    uptime,
    decisionsGenerated: state.decisionCount
  };
}

// ============================================
// STATE SNAPSHOT (For Phoenix Protocol)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createStateSnapshot(): unknown {
  return {
    frameCount: state.frameCount,
    decisionCount: state.decisionCount,
    // Wave 8 Pure - save generated palette (can be regenerated on restore)
    currentPalette: state.currentPalette,
    currentMoodHint: state.currentMoodHint,
    currentMovement: state.currentMovement,
    operationMode: state.operationMode,
    combinedConfidence: state.combinedConfidence,
    personality: { ...personality },
    learnedPatterns: Array.from(state.learnedPatterns.entries())
  };
}

function restoreStateSnapshot(snapshot: unknown): void {
  if (typeof snapshot === 'object' && snapshot !== null) {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.frameCount === 'number') state.frameCount = s.frameCount;
    if (typeof s.decisionCount === 'number') state.decisionCount = s.decisionCount;
    if (typeof s.currentMoodHint === 'string') {
      state.currentMoodHint = s.currentMoodHint;
      // 🎨 WAVE 17.2: Palette se genera dinámicamente en el próximo frame
      // No necesitamos regenerar aquí - será null hasta que llegue audio real
      state.currentPalette = null;
    }
    if (s.personality && typeof s.personality === 'object') {
      Object.assign(personality, s.personality);
    }
    if (Array.isArray(s.learnedPatterns)) {
      state.learnedPatterns = new Map(s.learnedPatterns);
    }
  }
  if (DEBUG_VERBOSE) console.log(`[GAMMA] State restored: ${state.decisionCount} decisions, mood: ${personality.currentMood}`);
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(message: WorkerMessage): void {
  try {
    switch (message.type) {
      case MessageType.INIT:
        state.isRunning = true;
        state.startTime = Date.now();
        console.log('[GAMMA] 🧠 Mind initialized');  // Keep - startup only
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;
        
      case MessageType.SHUTDOWN:
        console.log('[GAMMA] Shutting down...');  // Keep - shutdown only
        state.isRunning = false;
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        process.exit(0);
        break;
        
      case MessageType.HEARTBEAT:
        const hbPayload = message.payload as HeartbeatPayload;
        const ackPayload: HeartbeatAckPayload = {
          originalTimestamp: hbPayload.timestamp,
          ackTimestamp: Date.now(),
          sequence: hbPayload.sequence,
          latency: Date.now() - hbPayload.timestamp
        };
        sendMessage(MessageType.HEARTBEAT_ACK, 'alpha', ackPayload, MessagePriority.HIGH);
        state.lastHeartbeat = Date.now();
        break;
        
      case MessageType.HEALTH_REQUEST:
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        break;
        
      case MessageType.AUDIO_ANALYSIS:
        if (!state.isRunning) break;
        
        // 🔌 WAVE 63.95: Skip processing when system is paused (sleeping)
        if (state.isPaused) {
          // Silently ignore audio frames when system is OFF
          break;
        }
        
        const analysis = message.payload;
        
        // 🔍 WAVE 15.3 DIAGNOSTIC: Log audio reception cada 60 frames
        state.frameCount = (state.frameCount || 0) + 1;
        if (state.frameCount % 60 === 0) {
          const a = analysis as { spectrum?: { bass?: number; mid?: number; treble?: number }; dynamics?: { energy?: number } };
          console.log(`[GAMMA 🎵] Audio frame ${state.frameCount}: bass=${a.spectrum?.bass?.toFixed(2) || '?'}, mid=${a.spectrum?.mid?.toFixed(2) || '?'}, energy=${a.dynamics?.energy?.toFixed(2) || '?'}`);
        }
        
        if (isAudioAnalysis(analysis)) {
          const decision = generateDecision(analysis);
          sendMessage(
            MessageType.LIGHTING_DECISION,
            'alpha',
            decision,
            analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL
          );
        }
        break;
        
      case MessageType.STATE_RESTORE:
        const snapshot = message.payload as { state: unknown };
        restoreStateSnapshot(snapshot.state);
        break;
        
      case MessageType.CONFIG_UPDATE:
        Object.assign(config, message.payload);
        if (DEBUG_VERBOSE) console.log('[GAMMA] Config updated');
        break;
      
      // 🧠 WAVE 10: Brain Control Messages
      case MessageType.SET_MODE: {
        const modePayload = message.payload as { mode: 'reactive' | 'intelligent' | 'forced' };
        if (modePayload.mode === 'intelligent' || modePayload.mode === 'forced') {
          state.brainForced = true;
          state.operationMode = 'intelligent';
          console.log('[GAMMA] 🧠 BRAIN MODE ACTIVATED');  // Keep - high level
        } else {
          state.brainForced = false;
          state.operationMode = 'reactive';
          console.log('[GAMMA] 🔄 REACTIVE MODE');  // Keep - high level
        }
        break;
      }
      
      case MessageType.ENABLE_BRAIN:
        state.brainForced = true;
        state.operationMode = 'intelligent';
        console.log('[GAMMA] ⚡ BRAIN ENABLED');  // Keep - one clean log
        break;
      
      case MessageType.DISABLE_BRAIN:
        state.brainForced = false;
        state.operationMode = 'reactive';
        console.log('[GAMMA] 💤 BRAIN DISABLED');  // Keep - one clean log
        break;
      
      // 🎛️ WAVE 60: Vibe Control
      case MessageType.SET_VIBE: {
        const vibePayload = message.payload as { vibeId: string };
        const success = vibeManager.setActiveVibe(vibePayload.vibeId as VibeId, state.frameCount);
        if (success) {
          console.log(`[GAMMA] 🎛️ VIBE CHANGED: ${vibePayload.vibeId}`);
        } else {
          // 🐛 WAVE 69.1: FIX - false puede significar "ya activo" o "inválido"
          // Solo logueamos si realmente no existe en el registry
          const currentVibe = vibeManager.getActiveVibe();
          if (currentVibe.id === vibePayload.vibeId) {
            // Ya está activo, no es un error
            console.log(`[GAMMA] 🎛️ VIBE ALREADY ACTIVE: ${vibePayload.vibeId}`);
          } else {
            // Vibe inválido o no encontrado
            console.warn(`[GAMMA] ⚠️ Invalid vibe ID: ${vibePayload.vibeId}`);
          }
        }
        break;
      }
      
      // 🔌 WAVE 63.95: System Power Control
      case MessageType.SYSTEM_SLEEP: {
        console.log('[GAMMA] 💤 SYSTEM SLEEP - Pausing audio processing');
        state.isPaused = true;
        // Reset all stabilizers for clean restart
        state.keyStabilizer.reset();
        state.energyStabilizer.reset();
        state.moodArbiter.reset();
        state.strategyArbiter.reset();
        // 🔌 WAVE 64.5: Reset vibe to IDLE (no pop-rock)
        vibeManager.setActiveVibeImmediate('idle');
        break;
      }
      
      case MessageType.SYSTEM_WAKE: {
        console.log('[GAMMA] ☀️ SYSTEM WAKE - Resuming audio processing');
        state.isPaused = false;
        break;
      }
        
      default:
        console.warn(`[GAMMA] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push(errorMsg);
    console.error(`[GAMMA] Error handling ${message.type}:`, errorMsg);
    
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: errorMsg,
      messageType: message.type
    }, MessagePriority.CRITICAL);
  }
}

// ============================================
// SEND MESSAGE
// ============================================

function sendMessage<T>(
  type: MessageType,
  target: 'alpha' | 'beta' | 'broadcast',
  payload: T,
  priority: MessagePriority = MessagePriority.NORMAL
): void {
  const message = createMessage(type, NODE_ID, target, payload, priority);
  parentPort?.postMessage(message);
}

// ============================================
// MAIN LISTENER
// ============================================

if (parentPort) {
  parentPort.on('message', handleMessage);
  
  console.log('[GAMMA] 🧠 Worker ready');  // Keep - startup only
  
  // Handle uncaught errors
  (process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
    console.error('[GAMMA] Uncaught exception:', error);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: error.message,
      fatal: true
    }, MessagePriority.CRITICAL);
  });
  
  (process as NodeJS.EventEmitter).on('unhandledRejection', (reason: unknown) => {
    console.error('[GAMMA] Unhandled rejection:', reason);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: String(reason),
      fatal: false
    }, MessagePriority.CRITICAL);
  });
} else {
  console.error('[GAMMA] No parentPort - not running as worker thread!');
  process.exit(1);
}

// ============================================
// PERIODIC HEALTH REPORT
// ============================================

setInterval(() => {
  if (state.isRunning) {
    sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
  }
}, 5000);
