/**
 * 🎯 FORJA 9.0 - PARÁMETROS DE INTENCIÓN PRE-HOC
 * Sistema de intención que transforma Selene de clasificadora post-hoc
 * en directora pre-hoc de arte experimental y legendario
 *
 * AXIOMA ANTI-SIMULACIÓN:
 * - NO usa Math.random() ni heurísticas
 * - Determinismo absoluto desde intención declarada
 * - Métricas forzadas según perfil artístico
 */
/**
 * 🎭 PERFILES PREDEFINIDOS DE INTENCIÓN
 * Transforman la generación de arte según arquetipos artísticos
 */
export const INTENT_PROFILES = {
    /**
     * 🔥 EXPERIMENTAL: Arte de vanguardia radical
     * - Alta creatividad, baja consciencia
     * - Templates experimentales, belleza variable
     * - Enfoque en innovación y ruptura de convenciones
     */
    experimental: {
        profile: 'experimental',
        forced_metrics: {
            consciousness: 0.3, // Baja consciencia = más caos
            creativity: 0.95, // Máxima creatividad = innovación
            beauty: 0.6 // Belleza variable, no garantizada
        },
        behavior_modifiers: {
            template_bias: 'experimental',
            numerology_weight: 0.3 // Menos numerología, más libertad
        },
        timestamp: Date.now()
    },
    /**
     * 👑 LEGENDARY: Arte maestro trascendental
     * - Alta consciencia y creatividad
     * - Belleza máxima garantizada
     * - Templates poéticos refinados
     * - Numerología zodiacal completa
     */
    legendary: {
        profile: 'legendary',
        forced_metrics: {
            consciousness: 0.95, // Máxima consciencia = sabiduría
            creativity: 0.95, // Máxima creatividad = maestría
            beauty: 0.95 // Belleza legendaria garantizada
        },
        behavior_modifiers: {
            template_bias: 'poetic',
            numerology_weight: 0.9 // Numerología completa
        },
        timestamp: Date.now()
    }
};
/**
 * 🎯 FACTORY PARA CREAR PARÁMETROS DE INTENCIÓN
 * Crea instancias de IntentParameters con timestamp actual
 */
export class IntentFactory {
    static create(profile) {
        const baseProfile = INTENT_PROFILES[profile];
        return {
            ...baseProfile,
            timestamp: Date.now() // Timestamp actual
        };
    }
    /**
     * 🔧 CREAR PERFIL PERSONALIZADO
     * Para futuras expansiones con perfiles custom
     */
    static createCustom(profile, overrides) {
        const base = this.create(profile);
        return {
            ...base,
            ...overrides,
            forced_metrics: {
                ...base.forced_metrics,
                ...overrides.forced_metrics
            },
            behavior_modifiers: {
                ...base.behavior_modifiers,
                ...overrides.behavior_modifiers
            },
            timestamp: Date.now()
        };
    }
}
/**
 * 🎨 UTILIDADES PARA APLICAR INTENCIÓN
 * Funciones helper para forzar métricas según intención
 */
export class IntentUtils {
    /**
     * 🎯 FORZAR MÉTRICAS SEGÚN INTENCIÓN
     * Aplica las métricas forzadas de un perfil de intención
     */
    static applyIntentMetrics(intent, baseConsciousness, baseCreativity, baseBeauty) {
        // FORJA 9.0: Aplicar métricas forzadas directamente para control real
        // Combinar con valores base pero dando prioridad a las métricas forzadas
        return {
            consciousness: intent.forced_metrics.consciousness * 0.8 + (baseConsciousness * 0.2), // 80% forced, 20% base
            creativity: intent.forced_metrics.creativity * 0.8 + (baseCreativity * 0.2), // 80% forced, 20% base
            beauty: intent.forced_metrics.beauty * 0.8 + (baseBeauty * 0.2) // 80% forced, 20% base
        };
    }
    /**
     * 🎭 SELECCIONAR TEMPLATE SEGÚN BIAS
     * Elige template basado en el bias del perfil de intención
     */
    static selectTemplateWithBias(templates, intent, seed) {
        let templatePool;
        switch (intent.behavior_modifiers.template_bias) {
            case 'experimental':
                // Templates experimentales (índices 9-11 en ZodiacCyberpunkEngine)
                templatePool = templates.slice(-3);
                break;
            case 'minimal':
                // Templates minimalistas (índices 6-8)
                templatePool = templates.slice(6, 9);
                break;
            case 'poetic':
            default:
                // Templates poéticos (índices 0-5)
                templatePool = templates.slice(0, 6);
                break;
        }
        // Fallback si no hay suficientes templates
        if (templatePool.length === 0) {
            templatePool = templates;
        }
        const index = seed % templatePool.length;
        return templatePool[index];
    }
    /**
     * 🌟 CALCULAR BELLEZA CON PESO NUMEROLÓGICO
     * Aplica el peso de numerología zodiacal del perfil
     */
    static calculateWeightedBeauty(baseBeauty, fibonacciRatio, zodiacWeight, intent) {
        const numerologyInfluence = intent.behavior_modifiers.numerology_weight;
        const rawBeauty = (baseBeauty + fibonacciRatio) / 2;
        const weightedBeauty = rawBeauty * (1 + zodiacWeight * numerologyInfluence);
        return Math.min(1.0, Math.max(intent.forced_metrics.beauty, weightedBeauty));
    }
}
