import { EvolutionaryDecisionType, EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';
/**
 * 🧬 GENERADOR DE DECISIONES EVOLUTIVAS
 * Crea tipos de decisión novedosos combinando patrones deterministas
 * 🔀 NOW WITH THE SWITCH - Modo-aware generation
 */
export declare class EvolutionaryDecisionGenerator {
    private static readonly BASE_DECISION_TYPES;
    private static readonly CREATIVE_MODIFIERS;
    private static readonly APPLICATION_CONTEXTS;
    /**
     * 🔥 HASH FUNCTIONS - Funciones deterministas para entropía controlada
     */
    /**
     * 🔀 CATEGORIZE TYPE - Asigna categoría a tipo de decisión
     * @param type - Tipo de decisión
     * @returns Categoría (destruction, chaos, rebellion, etc.)
     */
    private static categorizeType;
    /**
     * Hash de vitals del sistema
     */
    private static hashVitals;
    /**
     * Hash de métricas del sistema
     */
    private static hashMetrics;
    /**
     * Hash de historial de feedback
     */
    private static hashFeedbackHistory;
    /**
     * Función hash simple determinista (djb2)
     */
    private static simpleHash;
    /**
     * Genera un tipo de decisión novedoso basado en contexto evolutivo
     * 🔀 SWITCH INTEGRATION - Now mode-aware!
     * @param context - Contexto de evolución
     * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
     * @param redis - Opcional: Redis client para feedback adjustment
     * @returns Tipo de decisión evolutiva único
     */
    static generateNovelDecisionType(context: EvolutionContext, typeWeights?: Map<string, number>, redis?: any): Promise<EvolutionaryDecisionType>;
    /**
     * Crea clave única para contexto (LEGACY - ya no se usa cache)
     * @param context - Contexto evolutivo
     * @returns Clave de cache
     */
    private static createContextKey;
    /**
     * Selecciona tipo base basado en patrón fibonacci CON ENTROPÍA Y PESOS
     * @param pattern - Patrón evolutivo
     * @param combinedSeed - Semilla combinada con alta entropía
     * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
     * @returns Tipo base de decisión
     */
    private static selectBaseType;
    /**
     * 🎯 SELECCIÓN PONDERADA - Usa pesos de feedback para sesgar selección
     */
    private static weightedSelection;
    /**
     * Selecciona modificador creativo CON ENTROPÍA Y MODE CONFIG
     * @param pattern - Patrón evolutivo
     * @param context - Contexto evolutivo
     * @param combinedSeed - Semilla combinada con alta entropía
     * @param modeConfig - Configuración del modo actual
     * @returns Modificador creativo
     */
    private static selectModifier;
    /**
     * Selecciona contexto de aplicación CON ENTROPÍA
     * @param pattern - Patrón evolutivo
     * @param combinedSeed - Semilla combinada con alta entropía
     * @returns Contexto de aplicación
     */
    private static selectApplicationContext;
    /**
     * Genera ID único para el tipo de decisión
     * @param baseType - Tipo base
     * @param modifier - Modificador
     * @param applicationContext - Contexto de aplicación
     * @returns ID único
     */
    private static generateTypeId;
    /**
     * Genera nombre descriptivo para la decisión
     * @param baseType - Tipo base
     * @param modifier - Modificador
     * @param applicationContext - Contexto de aplicación
     * @returns Nombre de decisión
     */
    private static generateDecisionName;
    /**
     * Genera descripción técnica de la decisión
     * @param baseType - Tipo base
     * @param modifier - Modificador
     * @param applicationContext - Contexto de aplicación
     * @param pattern - Patrón evolutivo
     * @returns Descripción técnica
     */
    private static generateDecisionDescription;
    /**
     * Genera descripción poética de la decisión
     * @param baseType - Tipo base
     * @param modifier - Modificador
     * @param applicationContext - Contexto de aplicación
     * @param pattern - Patrón evolutivo
     * @returns Descripción poética
     */
    private static generatePoeticDescription;
    /**
     * Genera base técnica de la decisión
     * @param pattern - Patrón evolutivo
     * @param context - Contexto evolutivo
     * @returns Base técnica
     */
    private static generateTechnicalBasis;
    /**
     * Calcula nivel de riesgo de la decisión
     * @param pattern - Patrón evolutivo
     * @param context - Contexto evolutivo
     * @returns Nivel de riesgo (0-1)
     */
    private static calculateRiskLevel;
    /**
     * Calcula creatividad esperada de la decisión
     * @param pattern - Patrón evolutivo
     * @param context - Contexto evolutivo
     * @returns Nivel de creatividad esperado (0-1)
     */
    private static calculateExpectedCreativity;
    /**
     * Genera firma fibonacci de la decisión
     * @param pattern - Patrón evolutivo
     * @returns Array de números fibonacci representativo
     */
    private static generateFibonacciSignature;
    /**
     * Genera ciclo completo de evolución
     * @param context - Contexto inicial
     * @param cycles - Número de ciclos a generar
     * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
     * @param redis - Opcional: Redis client
     * @returns Array de tipos de decisión para el ciclo
     */
    static generateEvolutionCycle(context: EvolutionContext, cycles?: number, // 🔥 REDUCED from 3 to 2 - Quality over quantity
    typeWeights?: Map<string, number>, redis?: any): Promise<EvolutionaryDecisionType[]>;
    /**
     * Limpia el cache de decisiones (DESHABILITADO - no hay cache)
     */
    static clearCache(): void;
    /**
     * Obtiene estadísticas del cache (DESHABILITADO - no hay cache)
     * @returns Estadísticas de uso del cache
     */
    static getCacheStats(): {
        cachedDecisions: number;
    };
}
//# sourceMappingURL=evolutionary-decision-generator.d.ts.map