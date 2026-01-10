/**
 * 🔗 WORKER PROTOCOL - Protocolo de Comunicación Trinity
 *
 * Define los tipos de mensajes entre:
 * - ALPHA (Main Process): Orquestador + DMX
 * - BETA (Worker): Sentidos (Audio Analysis)
 * - GAMMA (Worker): Mente (Selene Brain)
 */
export const NODE_NAMES = {
    alpha: '🛡️ ALPHA (Orchestrator)',
    beta: '👂 BETA (Senses)',
    gamma: '🧠 GAMMA (Mind)'
};
// ============================================
// MESSAGE TYPES
// ============================================
export var MessageType;
(function (MessageType) {
    // Lifecycle
    MessageType["INIT"] = "init";
    MessageType["READY"] = "ready";
    MessageType["SHUTDOWN"] = "shutdown";
    // Heartbeat
    MessageType["HEARTBEAT"] = "heartbeat";
    MessageType["HEARTBEAT_ACK"] = "heartbeat_ack";
    // Health
    MessageType["HEALTH_REPORT"] = "health_report";
    MessageType["HEALTH_REQUEST"] = "health_request";
    // Audio Pipeline (Alpha → Beta)
    MessageType["AUDIO_BUFFER"] = "audio_buffer";
    // Analysis Pipeline (Beta → Alpha → Gamma)
    MessageType["AUDIO_ANALYSIS"] = "audio_analysis";
    // Lighting Pipeline (Gamma → Alpha → DMX)
    MessageType["LIGHTING_DECISION"] = "lighting_decision";
    // State Management
    MessageType["STATE_SNAPSHOT"] = "state_snapshot";
    MessageType["STATE_RESTORE"] = "state_restore";
    // Phoenix Protocol
    MessageType["WORKER_ERROR"] = "worker_error";
    MessageType["WORKER_RESURRECTING"] = "worker_resurrecting";
    // Config
    MessageType["CONFIG_UPDATE"] = "config_update";
    // 🧠 WAVE 10: Brain Control
    MessageType["SET_MODE"] = "set_mode";
    MessageType["ENABLE_BRAIN"] = "enable_brain";
    MessageType["DISABLE_BRAIN"] = "disable_brain";
    // 🎛️ WAVE 60: Vibe Control
    MessageType["SET_VIBE"] = "set_vibe";
    // 🔌 WAVE 63.95: System Power Control
    MessageType["SYSTEM_SLEEP"] = "system_sleep";
    MessageType["SYSTEM_WAKE"] = "system_wake";
    // 🧠 WAVE 230: Musical Context (Brain Lobotomy)
    // El Worker ahora emite contexto puro, sin decidir colores
    MessageType["MUSICAL_CONTEXT"] = "musical_context";
})(MessageType || (MessageType = {}));
export var MessagePriority;
(function (MessagePriority) {
    MessagePriority[MessagePriority["LOW"] = 0] = "LOW";
    MessagePriority[MessagePriority["NORMAL"] = 1] = "NORMAL";
    MessagePriority[MessagePriority["HIGH"] = 2] = "HIGH";
    MessagePriority[MessagePriority["CRITICAL"] = 3] = "CRITICAL";
})(MessagePriority || (MessagePriority = {}));
export const DEFAULT_CONFIG = {
    heartbeatInterval: 1000,
    heartbeatTimeout: 3000,
    maxResurrections: 5,
    resurrectionDelay: 500,
    audioBufferSize: 2048,
    audioSampleRate: 44100,
    inputGain: 1.0, // 🔧 WAVE 15: Default 100%
    targetFps: 60
};
// ============================================
// MESSAGE FACTORY
// ============================================
let messageCounter = 0;
export function createMessage(type, source, target, payload, priority = MessagePriority.NORMAL) {
    return {
        id: `${source}-${type}-${++messageCounter}-${Date.now()}`,
        type,
        source,
        target,
        timestamp: Date.now(),
        priority,
        payload
    };
}
// ============================================
// TYPE GUARDS
// ============================================
export function isAudioAnalysis(payload) {
    return (typeof payload === 'object' &&
        payload !== null &&
        'bpm' in payload &&
        'bass' in payload &&
        'energy' in payload);
}
export function isLightingDecision(payload) {
    return (typeof payload === 'object' &&
        payload !== null &&
        'palette' in payload &&
        'movement' in payload);
}
export function isWorkerHealth(payload) {
    return (typeof payload === 'object' &&
        payload !== null &&
        'nodeId' in payload &&
        'status' in payload);
}
// 🧠 WAVE 230: Type guard for MusicalContext
export function isMusicalContext(payload) {
    return (typeof payload === 'object' &&
        payload !== null &&
        'bpm' in payload &&
        'section' in payload &&
        'mood' in payload &&
        'genre' in payload &&
        'confidence' in payload);
}
