/**
 * 🧠 GAMMA WORKER - MIND (Pure Musical Analyst)
 *
 * 🔪 WAVE 230.5: OPERATION CLEAN SWEEP
 *
 * Worker Thread dedicado al ANÁLISIS MUSICAL PURO.
 * Este Worker ya NO genera colores ni LightingDecisions.
 * Solo analiza audio y emite MusicalContext para TITAN 2.0.
 *
 * V2 O NADA - La lógica de color vive ahora en TitanEngine/ColorLogic.
 *
 * Recibe AudioAnalysis+Wave8Data de ALPHA (via BETA).
 * Envía MusicalContext a ALPHA para TitanEngine.
 */
// 🔇 WAVE 37.0: Silencio Táctico - Solo logs de alto nivel
const DEBUG_VERBOSE = false;
import { parentPort, workerData } from 'worker_threads';
import { MessageType, MessagePriority, createMessage, DEFAULT_CONFIG, isAudioAnalysis } from './WorkerProtocol';
// 🧠 WAVE 230: THE LOBOTOMY - MusicalContext para TITAN 2.0
import { createDefaultMusicalContext } from '../core/protocol/MusicalContext';
// ============================================
// CONFIGURATION
// ============================================
const config = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'gamma';
const state = {
    isRunning: false,
    isPaused: false,
    frameCount: 0,
    startTime: Date.now(),
    lastHeartbeat: Date.now(),
    messagesProcessed: 0,
    totalProcessingTime: 0,
    errors: [],
    // 🎯 WAVE 289: Default vibe
    activeVibeId: 'techno'
};
// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 230.5: THE REAL LOBOTOMY - Extract Pure Musical Context
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Extrae MusicalContext PURO desde el análisis de audio.
 *
 * Esta función NO decide colores ni efectos. Solo describe:
 * - QUÉ tonalidad se detecta (key, mode)
 * - QUÉ ritmo hay (bpm, syncopation, beatPhase)
 * - QUÉ sección es (verse, drop, chorus, etc.)
 * - QUÉ género parece (electronic, latin, rock)
 * - QUÉ mood emocional tiene (euphoric, melancholic, etc.)
 *
 * TITAN 2.0 usará esto para que ColorLogic decida los colores.
 */
function extractMusicalContext(analysis) {
    const wave8 = analysis.wave8;
    // Sin wave8 data → contexto por defecto
    if (!wave8) {
        return createDefaultMusicalContext();
    }
    const { rhythm, harmony, section, genre } = wave8;
    // ═══════════════════════════════════════════════════════════════════════
    // MAPEO: wave8 → MusicalContext
    // ═══════════════════════════════════════════════════════════════════════
    // Key: harmony.key ya es string ('A', 'D#', etc.) o null
    const key = harmony.key;
    // Mode: harmony.mode puede ser 'major', 'minor', o algo más
    const mode = harmony.mode === 'major' ? 'major' :
        harmony.mode === 'minor' ? 'minor' : 'unknown';
    // Section: section.type → SectionType
    const sectionType = section.type;
    // Mood: Mapear harmony.mood y genre mood a los moods de MusicalContext
    const genreMood = genre.mood ?? null;
    const harmonyMood = harmony.mood ?? null;
    // 🌉 WAVE 260.5: Mapear TODOS los moods posibles de HarmonyOutput
    // HarmonyOutput moods: happy, sad, tense, dreamy, bluesy, jazzy, spanish_exotic, universal
    // MusicalContext moods: euphoric, melancholic, aggressive, dreamy, neutral, mysterious, triumphant
    let mood = 'neutral';
    const rawMood = genreMood || harmonyMood || 'neutral';
    const sectionEnergy = section.energy ?? 0;
    if (rawMood === 'happy' || rawMood === 'energetic' || rawMood === 'euphoric') {
        mood = 'euphoric';
    }
    else if (rawMood === 'sad' || rawMood === 'melancholic' || rawMood === 'bluesy') {
        // 🎵 bluesy = melancolía con groove
        mood = 'melancholic';
    }
    else if (rawMood === 'tense' || rawMood === 'aggressive' || rawMood === 'dark') {
        mood = 'aggressive';
    }
    else if (rawMood === 'dreamy' || rawMood === 'chill' || rawMood === 'calm') {
        mood = 'dreamy';
    }
    else if (rawMood === 'mysterious' || rawMood === 'jazzy') {
        mood = 'mysterious';
    }
    else if (rawMood === 'triumphant' || rawMood === 'heroic' || rawMood === 'spanish_exotic') {
        // 🎵 spanish_exotic = pasión/triunfo
        mood = 'triumphant';
    }
    else if (rawMood === 'universal' || rawMood === 'neutral') {
        // 🌉 WAVE 260.5: 'universal' = el detector no está seguro
        // Usar energía de sección para decidir
        if (sectionEnergy > 0.7) {
            mood = 'euphoric';
        }
        else if (sectionEnergy > 0.4) {
            mood = 'neutral';
        }
        else {
            mood = 'dreamy';
        }
    }
    // Genre: Mapear a MacroGenre
    const genreName = (genre.genre ?? genre.primary ?? 'unknown').toUpperCase();
    let macro = 'UNKNOWN';
    if (genreName.includes('ELECTRONIC') || genreName.includes('TECHNO') ||
        genreName.includes('HOUSE') || genreName.includes('EDM')) {
        macro = 'ELECTRONIC';
    }
    else if (genreName.includes('LATIN') || genreName.includes('REGGAETON') ||
        genreName.includes('CUMBIA') || genreName.includes('SALSA')) {
        macro = 'LATIN';
    }
    else if (genreName.includes('ROCK') || genreName.includes('METAL')) {
        macro = 'ROCK';
    }
    else if (genreName.includes('POP')) {
        macro = 'POP';
    }
    else if (genreName.includes('CHILL') || genreName.includes('AMBIENT') ||
        genreName.includes('LOUNGE')) {
        macro = 'CHILL';
    }
    // Calcular confianza combinada
    const combinedConfidence = rhythm.confidence * 0.45 +
        harmony.confidence * 0.30 +
        section.confidence * 0.25;
    return {
        key,
        mode,
        bpm: analysis.bpm,
        beatPhase: analysis.beatPhase,
        syncopation: rhythm.syncopation,
        section: {
            type: sectionType,
            current: sectionType,
            confidence: section.confidence,
            duration: 0,
            isTransition: section.type === 'buildup' || section.type === 'breakdown',
        },
        energy: analysis.energy,
        mood,
        genre: {
            macro,
            subGenre: genreName !== macro ? genreName.toLowerCase() : null,
            confidence: genre.confidence,
        },
        confidence: combinedConfidence,
        timestamp: Date.now(),
    };
}
// ============================================
// HEALTH REPORTING
// ============================================
function generateHealthReport() {
    const uptime = Date.now() - state.startTime;
    const memUsage = process.memoryUsage();
    let status = 'healthy';
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        status = 'critical';
    }
    else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
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
        uptime
    };
}
// ============================================
// MESSAGE HANDLER
// ============================================
function handleMessage(message) {
    const startTime = performance.now();
    try {
        switch (message.type) {
            case MessageType.INIT:
                state.isRunning = true;
                state.startTime = Date.now();
                console.log('[GAMMA] 🧠 WAVE 230.5: Pure Musical Analyst INITIALIZED');
                sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
                break;
            case MessageType.SHUTDOWN:
                state.isRunning = false;
                console.log('[GAMMA] 🧠 Shutting down...');
                process.exit(0);
                break;
            case MessageType.HEARTBEAT:
                const hbPayload = message.payload;
                const ackPayload = {
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
                if (!state.isRunning)
                    break;
                if (state.isPaused)
                    break;
                const analysis = message.payload;
                state.frameCount++;
                // 🔍 Log cada 60 frames (~1 segundo)
                if (state.frameCount % 60 === 0) {
                    console.log(`[GAMMA 🎵] Frame ${state.frameCount}: bpm=${analysis.bpm?.toFixed(0)}, energy=${analysis.energy?.toFixed(2)}`);
                }
                if (isAudioAnalysis(analysis)) {
                    // 🧠 WAVE 230.5: SOLO EMITIR MUSICAL_CONTEXT
                    // NO hay LightingDecision, NO hay generateDecision()
                    const musicalContext = extractMusicalContext(analysis);
                    sendMessage(MessageType.MUSICAL_CONTEXT, 'alpha', musicalContext, MessagePriority.NORMAL);
                    state.messagesProcessed++;
                }
                break;
            case MessageType.CONFIG_UPDATE:
                Object.assign(config, message.payload);
                if (DEBUG_VERBOSE)
                    console.log('[GAMMA] Config updated');
                break;
            // 🔌 WAVE 63.95: System Power Control
            case MessageType.SYSTEM_SLEEP:
                console.log('[GAMMA] 💤 SYSTEM SLEEP - Pausing analysis');
                state.isPaused = true;
                break;
            case MessageType.SYSTEM_WAKE:
                console.log('[GAMMA] ☀️ SYSTEM WAKE - Resuming analysis');
                state.isPaused = false;
                break;
            // 🎯 WAVE 289: Vibe-Aware Section Tracking
            case MessageType.SET_VIBE:
                const vibePayload = message.payload;
                state.activeVibeId = vibePayload.vibeId;
                console.log(`[GAMMA] 🎯 WAVE 289: Vibe set to ${vibePayload.vibeId}`);
                // El vibeId se usará cuando los Workers tengan SectionTracker vibe-aware
                // Por ahora solo almacenamos el estado
                break;
            default:
                // Ignorar mensajes legacy no manejados
                if (DEBUG_VERBOSE) {
                    console.log(`[GAMMA] Ignoring legacy message: ${message.type}`);
                }
        }
        state.totalProcessingTime += performance.now() - startTime;
    }
    catch (error) {
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
function sendMessage(type, target, payload, priority = MessagePriority.NORMAL) {
    const message = createMessage(type, NODE_ID, target, payload, priority);
    parentPort?.postMessage(message);
}
// ============================================
// MAIN LISTENER
// ============================================
if (parentPort) {
    parentPort.on('message', handleMessage);
    console.log('[GAMMA] 🧠 WAVE 230.5: Pure Musical Analyst ready');
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('[GAMMA] Uncaught exception:', error);
        sendMessage(MessageType.WORKER_ERROR, 'alpha', {
            nodeId: NODE_ID,
            error: error.message,
            fatal: true
        }, MessagePriority.CRITICAL);
    });
    process.on('unhandledRejection', (reason) => {
        console.error('[GAMMA] Unhandled rejection:', reason);
        sendMessage(MessageType.WORKER_ERROR, 'alpha', {
            nodeId: NODE_ID,
            error: String(reason),
            fatal: false
        }, MessagePriority.CRITICAL);
    });
}
else {
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
