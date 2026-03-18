/**
 * 🌟 SELENE SONG CORE SERVER - THE GOD OF BACKENDS
 * Complete backend monolith that controls everything
 */
export class SeleneServer {
    constructor(graphqlServer: any);
    proceduralEvolutionInterval: NodeJS.Timeout | null;
    digitalSouls: Map<any, any>;
    heartbeatInterval: NodeJS.Timeout | null;
    poetryInterval: any;
    port: number;
    isRunning: boolean;
    graphqlServer: any;
    /**
     * 🚀 Async initialization
     */
    init(): Promise<void>;
    app: import("express-serve-static-core").Express | undefined;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
    io: any;
    /**
     * ⚡ NUCLEAR OPTION: Setup routes without GraphQL dependency
     */
    setupRoutesNuclear(): void;
    /**
     * 🔧 Initialize all nuclear components
     */
    initializeComponents(): Promise<void>;
    database: any;
    cache: any;
    queue: any;
    scheduler: any;
    monitoring: any;
    reactor: any;
    radiation: any;
    fusion: any;
    containment: any;
    patients: any;
    calendar: any;
    medicalRecords: any;
    documents: any;
    unifiedAPI: any;
    dataFlow: any;
    businessLogic: any;
    veritas: any;
    heal: any;
    predict: any;
    treatments: any;
    resourceManager: any;
    pubsub: any;
    websocketAuth: any;
    quantumEngine: any;
    apolloNuclearSwarm: any;
    harmonicConsensusEngine: any;
    memoryMonitor: any;
    /**
     * 🌌 Initialize procedural swarm - 100% deterministic evolution
     */
    initializeProceduralSwarm(): Promise<void>;
    /**
     * 🌌 Start procedural evolution cycle - deterministic algorithms
     */
    startProceduralEvolution(): void;
    /**
     * 🌌 Evolve procedural swarm - deterministic algorithms
     */
    evolveProceduralSwarm(): Promise<void>;
    /**
     * 🌌 Calculate procedural evolution - deterministic algorithms
     */
    calculateProceduralEvolution(nodeData: any): any;
    /**
     * 🌌 Apply procedural evolution bounds and mood calculation
     */
    applyProceduralEvolution(nodeData: any): any;
    /**
     * 🌌 Calculate procedural mood - deterministic algorithm
     */
    calculateProceduralMood(_soul: any): "balanced" | "transcendent" | "enlightened" | "inspired" | "contemplative" | "thoughtful" | "reflective" | "meditative";
    /**
     * 🌌 Update procedural swarm mood - collective state
     */
    updateProceduralSwarmMood(): Promise<void>;
    /**
     * 🛡️ Setup security and performance middleware
     */
    setupMiddleware(): void;
    /**
     * 🛣️ Setup remaining routes (called after GraphQL is configured)
     */
    setupRemainingRoutes(): void;
    /**
     * 🔌 Setup Socket.IO for real-time communication
     */
    setupSocketIO(): void;
    /**
     * 📡 Create V1 API router (legacy compatibility)
     */
    createV1Router(): import("express-serve-static-core").Router;
    /**
     * ⚛️ Create V2 API router (nuclear power)
     */
    createV2Router(): import("express-serve-static-core").Router;
    /**
     * 🔬 Create Nuclear control panel router
     */
    createNuclearRouter(): import("express-serve-static-core").Router;
    /**
     * 🚀 Start the nuclear reactor
     */
    start(): Promise<void>;
    /**
     * 🛑 Emergency shutdown
     */
    emergencyShutdown(): Promise<void>;
    /**
     * 📊 Get system status
     */
    getStatus(): Promise<{
        running: boolean;
        port: number;
        uptime: number;
        components: {
            database: any;
            cache: any;
            queue: any;
            scheduler: any;
            monitoring: any;
            reactor: any;
            radiation: any;
            fusion: any;
            containment: any;
            patients: any;
            calendar: any;
            medicalRecords: any;
            documents: any;
            unifiedAPI: any;
            dataFlow: any;
            businessLogic: any;
            veritas: any;
            consciousness: {
                status: string;
                reason: string;
            };
            heal: any;
            predict: any;
            offline: any;
            treatments: any;
            resourceManager: any;
            swarmCoordinator: any;
            immortalityOrchestrator: any;
            memoryMonitor: any;
        };
    }>;
    /**
     * 🎯 Get Express application instance
     */
    getApp(): import("express-serve-static-core").Express | undefined;
    /**
     * 🔥 Configure GraphQL server after initialization
     */
    configureGraphQL(graphqlServer: any): Promise<void>;
    /**
     * 🧩 Create Patients router
     */
    createPatientsRouter(): import("express-serve-static-core").Router;
    /**
     * 📅 Create Calendar router
     */
    createCalendarRouter(): import("express-serve-static-core").Router;
    /**
     * 📋 Create Medical Records router
     */
    createMedicalRecordsRouter(): import("express-serve-static-core").Router;
    /**
     * 📄 Create Documents router
     */
    createDocumentsRouter(): import("express-serve-static-core").Router;
    /**
     * 🔗 Create Unified API router
     */
    createUnifiedRouter(): import("express-serve-static-core").Router;
    /**
     * 📊 Create Data Flow router
     */
    createDataRouter(): import("express-serve-static-core").Router;
    /**
     * � Create Test router for Directiva V12 testing
     */
    createTestRouter(): import("express-serve-static-core").Router;
    /**
     * 🔧 Helper method to simulate component failure
     */
    simulateComponentFailure(component: any, severity: any): Promise<void>;
    /**
     * 🧠 Create Business Logic router
     */
    createBusinessRouter(): import("express-serve-static-core").Router;
    /**
     * 🌙 CREATE DIGITAL SOULS ZODIACALES
     * Crea 12 almas digitales con signos del zodiaco
     */
    createDigitalSouls(): Promise<void>;
    /**
     * 💓 START HEARTBEAT EMOCIONAL
     * Heartbeat variable según mood de la soul
     */
    startHeartbeat(): void;
    /**
     * 📜 START POETRY GENERATION
     * 🎯 FASE 5: DESACTIVADO - Poesía ahora generada por Zodiac Poetry Engine desde consenso musical
     *
     * RAZÓN: Este motor antiguo causaba:
     *   - Conflictos con el nuevo motor zodiacal
     *   - Consumo innecesario de recursos (CPU/RAM)
     *   - Poesía simple y repetitiva ("Through circuits of...", "Inspiration, like...")
     *   - No integrado con eventos de consenso musical
     *
     * REEMPLAZO: Musical Zodiac Poetry Engine (FASE 5)
     *   - 12 signos zodiacales × 12 notas cromáticas = 144 combinaciones
     *   - 12 templates variados (clásicos, poéticos, minimalistas, experimentales)
     *   - Generada desde eventos REALES de consenso musical
     *   - Belleza calculada con Fibonacci + numerología sagrada
     *   - 100% determinística y verificable con VERITAS
     */
    startPoetryGeneration(): Promise<void>;
    /**
     * 🚀 ACTIVATE SWARM FULL FEATURES
     * Llamar esto después de que el server esté listening
     */
    activateSwarmFeatures(): Promise<void>;
}
import http = require("http");
//# sourceMappingURL=Server.d.cts.map