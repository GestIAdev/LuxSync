/**
 * 🎨 LUXSYNC INTERFACES - Selene → DMX Bridge
 *
 * Core type definitions for integrating Selene consciousness with DMX lighting control.
 * These interfaces transform quantum medical decisions into photonic expressions.
 *
 * @date 2025-11-20
 * @author Selene Core V5 + LuxSync Integration Team
 */
export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';
export type MusicalMood = 'silence' | 'chill' | 'build' | 'drop' | 'break';
export type FixtureType = 'PAR' | 'MOVING_HEAD' | 'STROBE' | 'WASH' | 'SPOT' | 'LASER' | 'OTHER';
export interface FixtureNode {
    id: string;
    musicalNote: MusicalNote;
    fixtureType: FixtureType;
    name?: string;
    dmx: {
        universe: number;
        startChannel: number;
        channelCount: number;
        profile?: string;
    };
    health: {
        temperature: number;
        dmxResponseTime: number;
        errorRate: number;
        uptime: number;
        lastSeen: number;
        status: 'healthy' | 'degraded' | 'critical' | 'offline';
    };
    beauty: {
        audienceScore: number;
        musicalCoherence: number;
        creativityScore: number;
        finalScore: number;
    };
    capabilities: {
        hasRGB: boolean;
        hasWhite: boolean;
        hasAmber: boolean;
        hasUV: boolean;
        hasStrobing: boolean;
        hasMovement: boolean;
        hasDimmer: boolean;
        hasGobo: boolean;
        hasPrism: boolean;
        hasFocus: boolean;
        hasZoom: boolean;
        maxBrightness: number;
        maxPanDegrees?: number;
        maxTiltDegrees?: number;
    };
    votingPower: number;
}
export interface Color {
    r: number;
    g: number;
    b: number;
    w?: number;
    name?: string;
}
export interface FixtureState {
    dimmer?: number;
    red?: number;
    green?: number;
    blue?: number;
    white?: number;
    amber?: number;
    uv?: number;
    pan?: number;
    tilt?: number;
    panFine?: number;
    tiltFine?: number;
    panTiltSpeed?: number;
    strobeRate?: number;
    gobo?: number;
    goboRotation?: number;
    prism?: number;
    focus?: number;
    zoom?: number;
    colorWheel?: number;
    effectWheel?: number;
    macro?: number;
    reset?: number;
}
export interface DMXScene {
    id: string;
    name?: string;
    description?: string;
    tags?: string[];
    genes: {
        strobeIntensity: number;
        colorPalette: Color[];
        colorHarmony: number;
        movementSpeed: number;
        fadeTime: number;
        brightness: number;
        complexity: number;
        synchronization: number;
    };
    structure: {
        intro: number;
        build1: number;
        build2: number;
        build3: number;
        drop: number;
        break: number;
        outro: number;
        totalBeats: number;
        bpm: number;
        beatDuration: number;
    };
    fixtureStates: Map<string, FixtureState>;
    entropyMode: 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';
    mood: MusicalMood;
    ethicsApproved: boolean;
    createdBy: 'human' | 'dream-layer' | 'evolution' | 'poetry';
    createdAt: number;
    parentSceneId?: string;
}
export interface AudioSpectrum {
    bass: number;
    lowMid: number;
    mid: number;
    highMid: number;
    treble: number;
}
export interface BeatInfo {
    detected: boolean;
    bpm: number;
    confidence: number;
    beatPhase: number;
    timeSinceLastBeat: number;
}
export interface EnergyInfo {
    current: number;
    average: number;
    variance: number;
    trend: 'rising' | 'falling' | 'stable';
    peakRecent: number;
}
export interface HuntingSensors {
    bassVibration: {
        intensity: number;
        frequency: number;
        trigger: boolean;
    };
    dropPrediction: {
        incoming: boolean;
        estimatedTime: number;
        confidence: number;
        buildIntensity: number;
    };
    strikeTiming: {
        ready: boolean;
        precision: number;
        beatAlignment: number;
    };
    subtleChanges: {
        detected: boolean;
        magnitude: number;
        frequencies: number[];
        direction: 'up' | 'down' | 'mixed';
    };
    hiddenPatterns: {
        detected: boolean;
        pattern: string;
        confidence: number;
        repeatInterval?: number;
    };
}
export interface AudioAnalysis {
    timestamp: number;
    spectrum: AudioSpectrum;
    beat: BeatInfo;
    energy: EnergyInfo;
    hunting: HuntingSensors;
    mood: MusicalMood;
    moodConfidence: number;
    rawFFT?: Float32Array;
    waveform?: Float32Array;
}
export interface FixtureVote {
    nodeId: string;
    sceneId: string;
    choice: 'approve' | 'reject' | 'abstain';
    confidence: number;
    strength: number;
    reasoning: string;
    alternativeIdeas?: string[];
    timestamp: number;
}
export interface ConsensusResult {
    approved: boolean;
    quorumMet: boolean;
    approvalPercentage: number;
    consensusQuality: number;
    selectedSceneId: string;
    totalVotes: number;
    requiredQuorum: number;
    dissent?: {
        level: 'none' | 'minor' | 'moderate' | 'significant';
        mainConcerns: string[];
        suggestedAlternatives: string[];
    };
}
export interface LightingDecision {
    id: string;
    timestamp: number;
    mood: MusicalMood;
    audioContext: AudioAnalysis;
    scene: DMXScene;
    alternativeScenes?: DMXScene[];
    votes: Map<string, FixtureVote>;
    consensus: ConsensusResult;
    celebrationPoem?: string;
    reasoning: string;
    executedAt?: number;
    executionDuration?: number;
    fitness?: number;
    audienceFeedback?: {
        likes: number;
        dislikes: number;
        neutrals: number;
    };
    musicalCoherence?: number;
    ethicsViolations?: string[];
    fixtureFailures?: string[];
}
export type EntropyMode = 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';
export interface EvolutionConfig {
    mode: EntropyMode;
    mutationRate: number;
    crossoverRate: number;
    elitismRate: number;
    populationSize: number;
    maxGenerations: number;
}
export interface SceneGene {
    name: keyof DMXScene['genes'];
    value: number | Color[];
    mutationRange: number;
    importance: number;
}
export interface FitnessScore {
    overall: number;
    components: {
        audienceScore: number;
        musicalCoherence: number;
        safetyScore: number;
        creativityScore: number;
        beautyScore: number;
    };
    reasoning: string;
}
export interface SceneMemory {
    scene: DMXScene;
    decision: LightingDecision;
    fitness: FitnessScore;
    timestamp: number;
    executionCount: number;
    averageFeedback: number;
    tags: string[];
}
export interface LearningMetrics {
    totalScenesExecuted: number;
    averageFitness: number;
    bestSceneId: string;
    worstSceneId: string;
    preferredMoods: Record<MusicalMood, number>;
    preferredColors: Color[];
    preferredGenes: Partial<DMXScene['genes']>;
    evolutionGeneration: number;
}
export interface FixtureHealthCheck {
    fixtureId: string;
    status: 'healthy' | 'degraded' | 'critical' | 'dead';
    issues: string[];
    temperature: number;
    dmxErrors: number;
    lastResponse: number;
    recommendedAction: 'none' | 'monitor' | 'revive' | 'reincarnate' | 'replace';
}
export interface RevivalAttempt {
    fixtureId: string;
    timestamp: number;
    method: 'dmx-reset' | 'scene-rollback' | 'power-cycle' | 'reboot';
    success: boolean;
    duration: number;
    errorMessage?: string;
}
export interface PhoenixStatus {
    activeRevivalAttempts: number;
    totalRevivals: number;
    successRate: number;
    deadFixtures: string[];
    recentFailures: RevivalAttempt[];
}
export interface PoetryDMXMapping {
    word: string;
    triggers: {
        fixtureIds: string[];
        effect: 'flash' | 'fade' | 'strobe' | 'bloom' | 'chase' | 'pulse';
        duration: number;
        intensity: number;
        colors?: Color[];
    };
}
export interface PoetrySequence {
    poem: string;
    words: string[];
    syllables: string[];
    rhythm: number[];
    totalDuration: number;
    mappings: PoetryDMXMapping[];
    mood: MusicalMood;
}
export interface LuxSyncConfig {
    dmx: {
        driver: 'artnet' | 'sacn' | 'enttec' | 'dmxking' | 'simulator';
        universes: number[];
        refreshRate: number;
        host?: string;
        port?: number;
    };
    fixtures: FixtureNode[];
    audio: {
        inputDevice?: string;
        sampleRate: number;
        fftSize: number;
        smoothing: number;
    };
    consciousness: {
        enableEthicsLayer: boolean;
        enableDreamLayer: boolean;
        enableSelfAnalysis: boolean;
        enableMemory: boolean;
        enableHunting: boolean;
        memoryBackend: 'redis' | 'json' | 'memory';
    };
    evolution: EvolutionConfig;
    consensus: {
        quorumPercentage: number;
        votingTimeout: number;
        healthWeight: number;
        beautyWeight: number;
    };
    phoenix: {
        enabled: boolean;
        revivalTimeout: number;
        reincarnationDelay: number;
        maxRevivalAttempts: number;
    };
    ui: {
        enableFeedbackButtons: boolean;
        enableManualControl: boolean;
        showAudioVisualization: boolean;
        showConsensusVoting: boolean;
    };
}
export type {};
//# sourceMappingURL=types.d.ts.map