/**
 * 🌱 ENHANCED SEED CALCULATOR
 *
 * Calculador de seeds con soporte para múltiples modos.
 * Combina Fibonacci (determinista) + Entropy (configurable) + Feedback + Punk Boost
 *
 * @author PunkClaude + Radwulf
 * @date 2025-10-23
 */
/**
 * Calculador de seeds con soporte para múltiples modos
 *
 * Combina:
 * - Fibonacci base (determinista)
 * - Entropy injection (configurable)
 * - Feedback loop weights (aprendizaje)
 * - Punk type boosting (creatividad)
 */
export class EnhancedSeedCalculator {
    redis; // Optional Redis
    fibonacciCache = new Map();
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * Calcula seed combinado según modo activo
     *
     * @param vitals - Vitales del sistema
     * @param modeConfig - Configuración del modo actual
     * @returns Seed calculado (0-100)
     *
     * Fórmula:
     * seed = (fibonacci + entropy + feedback + punkBoost) % 100
     *
     * Donde:
     * - fibonacci: Basado en vitals (determinista)
     * - entropy: Aleatorio controlado por entropyFactor
     * - feedback: Ajuste basado en ratings (feedbackInfluence)
     * - punkBoost: Boost para tipos punk (punkProbability)
     */
    async calculateSeed(vitals, modeConfig) {
        // Base Fibonacci (siempre presente)
        const fibonacciSeed = this.fibonacci(vitals.creativity + vitals.harmony + vitals.health - vitals.stress);
        // Entropy injection (según entropyFactor)
        const entropy = this.getEntropy(modeConfig.entropyFactor);
        // Feedback adjustment (según feedbackInfluence)
        const feedbackAdjustment = await this.getFeedbackAdjustment(modeConfig.feedbackInfluence);
        // Punk type boosting (según punkProbability)
        const punkBoost = this.getPunkBoost(modeConfig.punkProbability);
        // Combinar todo
        const combinedSeed = fibonacciSeed + entropy + feedbackAdjustment + punkBoost;
        return combinedSeed % 100;
    }
    /**
     * Fibonacci base (determinista, cacheable)
     *
     * @param n - Número de entrada
     * @returns Fibonacci(n) % 100
     */
    fibonacci(n) {
        const normalized = Math.abs(Math.floor(n)) % 47; // Ciclo Pisano para mod 100
        if (this.fibonacciCache.has(normalized)) {
            return this.fibonacciCache.get(normalized);
        }
        if (normalized <= 1) {
            return normalized;
        }
        let a = 0;
        let b = 1;
        for (let i = 2; i <= normalized; i++) {
            const temp = (a + b) % 100;
            a = b;
            b = temp;
        }
        this.fibonacciCache.set(normalized, b);
        return b;
    }
    /**
     * Genera entropía controlada
     *
     * @param entropyFactor - Factor de entropía (0-100)
     * @returns Entropía generada
     *
     * Comportamiento:
     * - Factor 0: Sin entropía (determinista)
     * - Factor 50: Entropía moderada (~0-50)
     * - Factor 100: Entropía máxima (~0-100)
     *
     * NOTA: Aquí SÍ usamos Math.random() controlado por factor
     */
    getEntropy(entropyFactor) {
        if (entropyFactor === 0) {
            return 0; // Modo determinista puro
        }
        // Timestamp base (cambia cada ms)
        const timestamp = Date.now() % 10000;
        // Performance timing (microsegundos)
        const microtime = performance.now() % 1000;
        // System random (controlado)
        const systemRandom = Math.random() * 1000;
        // Combinar fuentes de entropía
        const rawEntropy = (timestamp + microtime + systemRandom) % 100;
        // Escalar por entropyFactor
        return Math.floor(rawEntropy * (entropyFactor / 100));
    }
    /**
     * Obtiene ajuste del feedback loop
     *
     * @param feedbackInfluence - Influencia del feedback (0-100)
     * @returns Ajuste calculado (-20 a +20)
     *
     * Comportamiento:
     * - Influence 0: Sin ajuste
     * - Influence 100: Ajuste máximo según ratings
     *
     * Lee de Redis: selene:evolution:type_weights
     */
    async getFeedbackAdjustment(feedbackInfluence) {
        if (feedbackInfluence === 0 || !this.redis) {
            return 0; // Sin feedback o sin Redis
        }
        try {
            // Leer weights de Redis
            const weights = await this.redis.hgetall('selene:evolution:type_weights');
            if (!weights || Object.keys(weights).length === 0) {
                return 0; // Sin datos de feedback
            }
            // Calcular promedio de weights
            const values = Object.values(weights).map(Number);
            const avgWeight = values.reduce((a, b) => a + b, 0) / values.length;
            // Normalizar a rango -20 a +20
            const adjustment = (avgWeight - 1.0) * 20; // 1.0 es neutral
            // Escalar por feedbackInfluence
            return Math.floor(adjustment * (feedbackInfluence / 100));
        }
        catch (error) {
            console.warn('Failed to get feedback adjustment:', error);
            return 0;
        }
    }
    /**
     * Calcula boost para tipos punk
     *
     * @param punkProbability - Probabilidad de punk types (0-100)
     * @returns Boost calculado (0-30)
     *
     * Comportamiento:
     * - Probability 0: Sin boost
     * - Probability 50: Boost moderado (~15)
     * - Probability 100: Boost máximo (~30)
     */
    getPunkBoost(punkProbability) {
        if (punkProbability === 0) {
            return 0;
        }
        // Boost proporcional a probability
        return Math.floor((punkProbability / 100) * 30);
    }
    /**
     * Limpia cache de Fibonacci (útil para testing)
     */
    clearCache() {
        this.fibonacciCache.clear();
    }
}
//# sourceMappingURL=enhanced-seed-calculator.js.map