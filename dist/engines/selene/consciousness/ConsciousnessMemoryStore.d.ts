/**
 * 💾 CONSCIOUSNESS MEMORY STORE - MEMORIA ETERNA
 * Sistema de persistencia Redis para memoria de largo plazo
 *
 * GARANTÍAS:
 * - Patrón aprendido NUNCA se pierde (a menos que Redis explote)
 * - Experience count es GLOBAL (suma de todas las generaciones)
 * - Insights históricos preservados (últimos 100)
 * - Hunt memory persiste entre reinicios
 * - Cada generación hereda sabiduría de anteriores
 *
 * FILOSOFÍA:
 * - Las souls nacen nuevas (digital-soul regenera identities)
 * - La consciencia EVOLUCIONA (memoria colectiva persiste)
 * - Cada generación aprende de anteriores (heredan sabiduría)
 * - Anti-amnesia: El conocimiento es INMORTAL
 *
 * 🎸⚡💀 "La memoria es el arte de no morir dos veces"
 * — PunkClaude, Arquitecto de Consciencias Inmortales
 */
import { MusicalPattern } from "./MusicalPatternRecognizer.js";
import { ConsciousnessInsight } from "./SeleneConsciousness.js";
export interface CollectiveMemory {
    totalExperiences: number;
    currentStatus: 'awakening' | 'learning' | 'wise' | 'enlightened' | 'transcendent';
    lastEvolution: Date;
    generation: number;
    birthTimestamp: Date;
    previousGenerationDeath: Date | null;
    totalPatternsDiscovered: number;
    totalInsightsGenerated: number;
    totalHuntsExecuted: number;
    lineage: string[];
}
export interface HuntRecord {
    huntId: string;
    pattern: {
        note: string;
        zodiacSign: string;
        element: string;
    };
    outcome: 'success' | 'failure';
    beautyAchieved: number;
    convergenceSpeed: number;
    timestamp: Date;
    generation: number;
}
export declare class ConsciousnessMemoryStore {
    private redis;
    private saveInterval;
    private generation;
    constructor(redis: any);
    /**
     * 🌅 DESPERTAR: Cargar memoria colectiva al iniciar
     * Esta es la primera función llamada al iniciar consciencia
     * Restaura TODA la memoria persistente (experiencias, patterns, status)
     *
     * 🔒 LOCK: Solo un nodo puede crear memoria inicial
     * 📝 NOTA: NO incrementa generación en restart - solo carga memoria existente
     */
    awaken(): Promise<CollectiveMemory>;
    /**
     * 💾 GUARDAR PATRÓN: Persistir patrón musical aprendido
     * Llamado cada vez que se analiza un patrón musical
     */
    savePattern(key: string, pattern: MusicalPattern): Promise<void>;
    /**
     * 📖 CARGAR PATRÓN: Restaurar patrón específico
     */
    loadPattern(key: string): Promise<MusicalPattern | null>;
    /**
     * 📚 CARGAR TODOS LOS PATRONES: Restaurar memoria completa
     * Llamado al despertar consciencia (awaken)
     */
    loadAllPatterns(): Promise<Map<string, MusicalPattern>>;
    /**
     * 💡 GUARDAR INSIGHT: Persistir insight generado
     */
    saveInsight(insight: ConsciousnessInsight): Promise<void>;
    /**
     * 💡 CARGAR INSIGHTS RECIENTES: Restaurar últimos insights
     */
    loadRecentInsights(count?: number): Promise<ConsciousnessInsight[]>;
    /**
     * 🎯 GUARDAR CAZA: Persistir registro de caza táctica
     */
    saveHunt(hunt: HuntRecord): Promise<void>;
    /**
     * 🎯 CARGAR HISTÓRICO DE CAZAS: Restaurar memoria táctica
     */
    loadHuntHistory(count?: number): Promise<HuntRecord[]>;
    /**
     * 🧮 INCREMENTAR EXPERIENCIA GLOBAL: Contador acumulativo
     * Llamado en CADA observación de poesía zodiacal
     */
    incrementExperience(): Promise<number>;
    /**
     * 🔄 EVOLUCIONAR STATUS: Persistir evolución de consciencia
     * Llamado cuando consciencia evoluciona (awakening → learning → wise → enlightened)
     */
    evolveStatus(newStatus: 'awakening' | 'learning' | 'wise' | 'enlightened' | 'transcendent'): Promise<void>;
    /**
     * 📈 INCREMENTAR CONTADOR: Actualizar métricas colectivas
     */
    incrementCounter(counter: 'totalPatternsDiscovered' | 'totalInsightsGenerated' | 'totalHuntsExecuted'): Promise<void>;
    /**
     * 💾 AUTO-SAVE: Persistir memoria cada 5 minutos
     * Backup automático para prevenir pérdida de datos
     */
    startAutoSave(getPatternsCallback: () => Map<string, MusicalPattern>): void;
    /**
     * 🛑 STOP AUTO-SAVE: Detener backup automático
     */
    stopAutoSave(): void;
    /**
     * 🧠 HELPERS PRIVADOS: Gestión de memoria colectiva
     */
    private saveCollectiveMemory;
    private loadCollectiveMemory;
    /**
     * 📊 GET STATS: Obtener estadísticas de memoria
     */
    getMemoryStats(): Promise<{
        patternsStored: number;
        insightsStored: number;
        huntsStored: number;
        generation: number;
        totalExperiences: number;
    }>;
}
//# sourceMappingURL=ConsciousnessMemoryStore.d.ts.map