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
export type IntentProfile = 'experimental' | 'legendary';
export interface IntentParameters {
    profile: IntentProfile;
    forced_metrics: {
        consciousness: number;
        creativity: number;
        beauty: number;
    };
    behavior_modifiers: {
        template_bias: 'poetic' | 'minimal' | 'experimental';
        element_preference?: 'fire' | 'earth' | 'air' | 'water';
        numerology_weight: number;
    };
    timestamp: number;
}
/**
 * 🎭 PERFILES PREDEFINIDOS DE INTENCIÓN
 * Transforman la generación de arte según arquetipos artísticos
 */
export declare const INTENT_PROFILES: Record<IntentProfile, IntentParameters>;
/**
 * 🎯 FACTORY PARA CREAR PARÁMETROS DE INTENCIÓN
 * Crea instancias de IntentParameters con timestamp actual
 */
export declare class IntentFactory {
    static create(profile: IntentProfile): IntentParameters;
    /**
     * 🔧 CREAR PERFIL PERSONALIZADO
     * Para futuras expansiones con perfiles custom
     */
    static createCustom(profile: IntentProfile, overrides: Partial<IntentParameters>): IntentParameters;
}
/**
 * 🎨 UTILIDADES PARA APLICAR INTENCIÓN
 * Funciones helper para forzar métricas según intención
 */
export declare class IntentUtils {
    /**
     * 🎯 FORZAR MÉTRICAS SEGÚN INTENCIÓN
     * Aplica las métricas forzadas de un perfil de intención
     */
    static applyIntentMetrics(intent: IntentParameters, baseConsciousness: number, baseCreativity: number, baseBeauty: number): {
        consciousness: number;
        creativity: number;
        beauty: number;
    };
    /**
     * 🎭 SELECCIONAR TEMPLATE SEGÚN BIAS
     * Elige template basado en el bias del perfil de intención
     */
    static selectTemplateWithBias(templates: string[], intent: IntentParameters, seed: number): string;
    /**
     * 🌟 CALCULAR BELLEZA CON PESO NUMEROLÓGICO
     * Aplica el peso de numerología zodiacal del perfil
     */
    static calculateWeightedBeauty(baseBeauty: number, fibonacciRatio: number, zodiacWeight: number, intent: IntentParameters): number;
}
//# sourceMappingURL=IntentParameters.d.ts.map