/**
 * 🏛️ WAVE 248: SELENE PROTOCOL - THE FUSION
 *
 * ARCHIVO ÍNDICE DEL PROTOCOLO TITAN 2.0 ENRIQUECIDO.
 *
 * Este archivo define TODOS los tipos que cruzan límites de módulo.
 * Si un tipo no está aquí, NO PUEDE usarse para comunicación inter-módulo.
 *
 * WAVE 248: Incorpora toda la riqueza cognitiva y sensorial del V1.
 * - SensoryData (audio crudo, FFT, beat)
 * - CognitiveData (mood, evolution, dream, zodiac, beauty)
 * - Estructura enriquecida de SeleneTruth
 *
 * "SELENEPROTOCOL ES LA BIBLIA" - Mandamiento #4
 *
 * @version TITAN 2.0 ENRICHED
 * @wave 248
 */
// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTAR PROTOCOLOS DE CAPAS
// ═══════════════════════════════════════════════════════════════════════════
// CEREBRO → MOTOR
export * from './MusicalContext';
// MOTOR → HAL
export * from './LightingIntent';
// HAL → HARDWARE
export * from './DMXPacket';
// ═══════════════════════════════════════════════════════════════════════════
// CANALES IPC DEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Definición de canales IPC oficiales de TITAN
 */
export const TITAN_IPC_CHANNELS = {
    /** Backend → Frontend: Estado completo @ 30fps */
    TRUTH: 'selene:truth',
    /** Frontend → Backend: Comandos de usuario */
    COMMAND: 'selene:command',
    /** Bidireccional: Configuración */
    CONFIG: 'selene:config',
    /** Backend → Frontend: Estado de fixtures */
    FIXTURES: 'selene:fixtures',
    /** Backend → Frontend: Logs del sistema */
    LOGS: 'selene:logs',
};
// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Verifica si un objeto es un MusicalContext válido
 */
export function isMusicalContext(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const ctx = obj;
    return (typeof ctx.bpm === 'number' &&
        typeof ctx.energy === 'number' &&
        typeof ctx.confidence === 'number' &&
        typeof ctx.timestamp === 'number');
}
/**
 * Verifica si un objeto es un LightingIntent válido
 */
export function isLightingIntent(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const intent = obj;
    return (intent.palette !== undefined &&
        typeof intent.masterIntensity === 'number' &&
        typeof intent.timestamp === 'number');
}
/**
 * Verifica si un objeto es un SeleneTruth válido
 */
export function isSeleneTruth(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const truth = obj;
    return ('system' in truth &&
        'sensory' in truth &&
        'consciousness' in truth &&
        'context' in truth &&
        'intent' in truth &&
        'hardware' in truth &&
        'timestamp' in truth);
}
// ═══════════════════════════════════════════════════════════════════════════
// 8. DEFAULT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Create default UnifiedColor
 */
export function createDefaultColor() {
    return { h: 0, s: 0, l: 50, r: 128, g: 128, b: 128, hex: '#808080' };
}
/**
 * Create default SensoryData
 */
export function createDefaultSensory() {
    return {
        audio: {
            energy: 0, peak: 0, average: 0, bass: 0, mid: 0, high: 0,
            spectralCentroid: 0, spectralFlux: 0, zeroCrossingRate: 0
        },
        fft: new Array(256).fill(0),
        beat: { onBeat: false, confidence: 0, bpm: 120, beatPhase: 0, barPhase: 0, timeSinceLastBeat: 0 },
        input: { gain: 1, device: 'None', active: false, isClipping: false },
        // 🧠 WAVE 1195: GOD EAR SPECTRUM BANDS
        spectrumBands: {
            subBass: 0,
            bass: 0,
            lowMid: 0,
            mid: 0,
            highMid: 0,
            treble: 0,
            ultraAir: 0,
            dominant: 'mid',
            flux: 0
        }
    };
}
/**
 * Create default CognitiveData
 */
export function createDefaultCognitive() {
    return {
        mood: 'peaceful',
        consciousnessLevel: 0,
        evolution: { stage: 'awakening', totalExperiences: 0, patternsDiscovered: 0, generation: 1, lineage: ['Genesis'] },
        dream: { isActive: false, currentType: null, currentThought: 'Selene awakening...', projectedBeauty: 0, lastRecommendation: null },
        zodiac: { element: 'water', sign: 'Pisces', affinity: 0.5, quality: 'mutable', description: 'The dreaming mystic' },
        beauty: { current: 0.5, average: 0.5, max: 0.5, components: { fibonacciAlignment: 0, zodiacResonance: 0, musicalHarmony: 0, patternResonance: 0, historicalBonus: 0 } },
        lastInsight: 'Selene Lux awakening...',
        activeSources: [],
        vibe: { active: 'idle', transitioning: false },
        stableEmotion: 'NEUTRAL',
        thermalTemperature: 4500,
        dropState: { state: 'IDLE', isActive: false },
        // 🧠 WAVE 550: AI Telemetry defaults
        // 🔮 WAVE 1168: Expanded with Dream Simulator output
        // 🧠 WAVE 1195: Expanded with hunt stats, council votes, dream history
        ai: {
            enabled: false,
            huntState: 'sleeping',
            confidence: 0,
            prediction: null,
            predictionProbability: 0,
            predictionTimeMs: 0,
            beautyScore: 0.5,
            beautyTrend: 'stable',
            consonance: 1,
            lastDecision: null,
            decisionSource: null,
            reasoning: null,
            biasesDetected: [],
            energyOverrideActive: false,
            // 🔮 WAVE 1168: Dream Simulator output
            lastDreamResult: {
                effectName: null,
                status: 'IDLE',
                reason: 'No simulation yet',
                riskLevel: 0
            },
            ethicsFlags: [],
            energyZone: 'calm',
            zScore: 0,
            dropBridgeAlert: 'none',
            // 🔥 WAVE 1176: OPERATION SNIPER
            energyVelocity: 0,
            // 🧠 WAVE 1195: BACKEND TELEMETRY EXPANSION
            huntStats: {
                duration: 0,
                targetsAcquired: 0,
                successRate: 0
            },
            councilVotes: {
                beauty: { vote: 'abstain', confidence: 0, reason: 'Waiting for beauty signal' },
                energy: { vote: 'abstain', confidence: 0, reason: 'Analyzing energy levels' },
                calm: { vote: 'abstain', confidence: 0, reason: 'Assessing stability' }
            },
            consensusScore: 0.33,
            dreamHistory: [],
            predictionHistory: [],
            // 🌊 WAVE 7003.4: Liquid Cognition default (offline)
            liquidCognition: null
        }
    };
}
/**
 * Create default SystemState
 */
export function createDefaultSystem() {
    return {
        frameNumber: 0,
        timestamp: Date.now(),
        deltaTime: 0,
        targetFPS: 30,
        actualFPS: 0,
        mode: 'selene',
        vibe: 'idle',
        brainStatus: 'peaceful',
        uptime: 0,
        titanEnabled: true,
        sessionId: '',
        version: '2.0.0',
        performance: {
            audioProcessingMs: 0,
            brainProcessingMs: 0,
            colorEngineMs: 0,
            dmxOutputMs: 0,
            totalFrameMs: 0
        }
    };
}
/**
 * Create default HardwareState
 */
export function createDefaultHardware() {
    return {
        dmx: {
            connected: false,
            driver: 'none',
            universe: 0, // 🔥 WAVE 1219: ArtNet 0-indexed
            frameRate: 40,
            port: null
        },
        dmxOutput: new Array(512).fill(0),
        fixturesActive: 0,
        fixturesTotal: 0,
        fixtures: []
    };
}
/**
 * 🌙 Create default SeleneTruth
 *
 * Creates a fully initialized SeleneTruth object with safe defaults.
 * Use this for initialization before receiving real data from backend.
 */
export function createDefaultTruth() {
    // Import default palette from LightingIntent if available, otherwise create inline
    const defaultPalette = {
        primary: { h: 0, s: 0, l: 0.5 },
        secondary: { h: 0.5, s: 0, l: 0.5 },
        accent: { h: 0.25, s: 0, l: 0.5 },
        ambient: { h: 0.75, s: 0, l: 0.3 }
    };
    const defaultIntent = {
        palette: defaultPalette,
        masterIntensity: 1,
        zones: {},
        movement: {
            pattern: 'static',
            speed: 0,
            amplitude: 0,
            centerX: 0.5,
            centerY: 0.5,
            beatSync: false
        },
        effects: [],
        source: 'procedural',
        timestamp: Date.now()
    };
    const defaultContext = {
        key: null,
        mode: 'unknown',
        bpm: 120,
        beatPhase: 0,
        syncopation: 0,
        section: { type: 'unknown', current: 'unknown', confidence: 0, duration: 0, isTransition: false },
        energy: 0,
        mood: 'neutral',
        genre: { macro: 'UNKNOWN', subGenre: null, confidence: 0 },
        confidence: 0,
        timestamp: Date.now()
    };
    return {
        system: createDefaultSystem(),
        sensory: createDefaultSensory(),
        consciousness: createDefaultCognitive(),
        context: defaultContext,
        intent: defaultIntent,
        hardware: createDefaultHardware(),
        timestamp: Date.now()
    };
}
/**
 * @deprecated Use createDefaultTruth instead
 */
export const createDefaultBroadcast = createDefaultTruth;
/**
 * @deprecated Use isSeleneTruth instead
 */
export const isSeleneBroadcast = isSeleneTruth;
