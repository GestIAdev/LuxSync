/**
 * 🧬 EVOLUTION ENGINE
 * Sistema de aprendizaje y adaptación gradual
 *
 * Basado en: EvolutionEngine de Auditoría 1
 * - Evalúa qué patrones funcionan mejor
 * - Evoluciona paletas y patrones exitosos
 * - Memoria de sesiones anteriores
 */
/**
 * 🧬 EvolutionEngine
 */
export class EvolutionEngine {
    constructor(config = {}) {
        this.population = [];
        this.mutations = [];
        this.generation = 0;
        this.currentContext = null;
        // Historial de energía para contexto
        this.energyHistory = [];
        this.populationSize = 20;
        this.mutationRate = 0.2;
        this.elitismRate = 0.1;
        this.currentConfig = {
            mode: 'reactive',
            palette: 'fire',
            movement: 'lissajous',
        };
        this.sessionStartTime = Date.now();
        // Inicializar población base
        this.initializePopulation();
    }
    /**
     * Inicializar población con configuraciones predeterminadas
     */
    initializePopulation() {
        const modes = ['reactive', 'ambient', 'show', 'sync'];
        const palettes = ['fire', 'ocean', 'forest', 'sunset', 'neon', 'cosmic'];
        const movements = ['lissajous', 'circle', 'wave', 'figure8', 'scan', 'random'];
        // Crear combinaciones iniciales con fitness neutro
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push({
                config: {
                    mode: modes[i % modes.length],
                    palette: palettes[i % palettes.length],
                    movement: movements[i % movements.length],
                },
                score: 0.5, // Neutral inicial
                uses: 0,
                lastUsed: 0,
                contexts: [],
            });
        }
    }
    /**
     * Actualizar contexto musical basado en métricas
     */
    updateContext(metrics, beatState) {
        this.energyHistory.push(metrics.energy);
        if (this.energyHistory.length > 60) {
            this.energyHistory.shift();
        }
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        this.currentContext = {
            energyLevel: avgEnergy < 0.33 ? 'low' : avgEnergy < 0.66 ? 'medium' : 'high',
            bpmRange: beatState.bpm < 100 ? 'slow' : beatState.bpm < 140 ? 'medium' : 'fast',
            dominantFreq: metrics.bass > metrics.mid && metrics.bass > metrics.treble
                ? 'bass'
                : metrics.mid > metrics.treble ? 'mid' : 'treble',
        };
    }
    /**
     * Evaluar fitness de configuración actual
     * Llamado periódicamente o cuando el usuario cambia manualmente
     */
    evaluate(wasManualChange, userSatisfaction = 0.5 // 0-1, inferido por comportamiento
    ) {
        // Encontrar o crear record para config actual
        let record = this.population.find(r => r.config.mode === this.currentConfig.mode &&
            r.config.palette === this.currentConfig.palette &&
            r.config.movement === this.currentConfig.movement);
        if (!record) {
            record = {
                config: { ...this.currentConfig },
                score: 0.5,
                uses: 0,
                lastUsed: Date.now(),
                contexts: [],
            };
            this.population.push(record);
        }
        // Actualizar score
        // Cambio manual = el usuario no estaba satisfecho
        if (wasManualChange) {
            record.score = Math.max(0, record.score - 0.1);
        }
        else {
            // Usar más tiempo = satisfacción implícita
            const timeFactor = Math.min(1, (Date.now() - record.lastUsed) / 60000); // 1 min
            record.score = record.score * 0.9 + userSatisfaction * 0.1 * timeFactor;
        }
        record.uses++;
        record.lastUsed = Date.now();
        // Guardar contexto donde funcionó bien
        if (this.currentContext && record.score > 0.6) {
            const contextKey = `${this.currentContext.energyLevel}-${this.currentContext.bpmRange}-${this.currentContext.dominantFreq}`;
            if (!record.contexts.includes(contextKey)) {
                record.contexts.push(contextKey);
            }
        }
    }
    /**
     * Sugerir configuración basada en contexto actual
     */
    suggest() {
        if (!this.currentContext) {
            return this.currentConfig;
        }
        const contextKey = `${this.currentContext.energyLevel}-${this.currentContext.bpmRange}-${this.currentContext.dominantFreq}`;
        // Buscar configuraciones que funcionaron bien en este contexto
        const suitable = this.population
            .filter(r => r.contexts.includes(contextKey) && r.score > 0.5)
            .sort((a, b) => b.score - a.score);
        if (suitable.length > 0) {
            // Con probabilidad de mutación, mutar la mejor
            if (Math.random() < this.mutationRate) {
                return this.mutate(suitable[0].config);
            }
            return suitable[0].config;
        }
        // Fallback: mejor score general
        const best = [...this.population].sort((a, b) => b.score - a.score)[0];
        return best?.config ?? this.currentConfig;
    }
    /**
     * Mutar una configuración
     */
    mutate(config) {
        const mutated = { ...config };
        const modes = ['reactive', 'ambient', 'show', 'sync'];
        const palettes = ['fire', 'ocean', 'forest', 'sunset', 'neon', 'cosmic'];
        const movements = ['lissajous', 'circle', 'wave', 'figure8', 'scan', 'random', 'static'];
        const mutationType = Math.floor(Math.random() * 3);
        switch (mutationType) {
            case 0:
                mutated.mode = modes[Math.floor(Math.random() * modes.length)];
                break;
            case 1:
                mutated.palette = palettes[Math.floor(Math.random() * palettes.length)];
                break;
            case 2:
                mutated.movement = movements[Math.floor(Math.random() * movements.length)];
                break;
        }
        this.mutations.push({
            type: ['mode', 'palette', 'movement'][mutationType],
            from: String(config[['mode', 'palette', 'movement'][mutationType]]),
            to: String(mutated[['mode', 'palette', 'movement'][mutationType]]),
            fitness: 0, // Se evaluará después
        });
        return mutated;
    }
    /**
     * Evolucionar población (llamar periódicamente)
     */
    evolve() {
        this.generation++;
        // Ordenar por fitness
        this.population.sort((a, b) => b.score - a.score);
        // Mantener elite
        const eliteCount = Math.floor(this.population.length * this.elitismRate);
        const elite = this.population.slice(0, eliteCount);
        // Crear nueva generación
        const newPopulation = [...elite];
        while (newPopulation.length < this.populationSize) {
            // Selección por torneo
            const parent = this.tournamentSelect();
            // Mutación
            const childConfig = Math.random() < this.mutationRate
                ? this.mutate(parent.config)
                : { ...parent.config };
            newPopulation.push({
                config: childConfig,
                score: 0.5, // Reset para nueva variante
                uses: 0,
                lastUsed: 0,
                contexts: [],
            });
        }
        this.population = newPopulation.slice(0, this.populationSize);
    }
    /**
     * Selección por torneo
     */
    tournamentSelect() {
        const tournamentSize = 3;
        const contestants = [];
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * this.population.length);
            contestants.push(this.population[idx]);
        }
        return contestants.sort((a, b) => b.score - a.score)[0];
    }
    /**
     * Setters
     */
    setCurrentConfig(config) {
        this.currentConfig = { ...this.currentConfig, ...config };
    }
    /**
     * Obtener estadísticas
     */
    getStats() {
        const scores = this.population.map(r => r.score);
        return {
            generation: this.generation,
            populationSize: this.population.length,
            bestScore: Math.max(...scores),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            mutations: this.mutations.length,
        };
    }
    /**
     * Exportar estado para persistencia
     */
    exportState() {
        return {
            population: this.population,
            generation: this.generation,
            sessionDuration: Date.now() - this.sessionStartTime,
        };
    }
    /**
     * Importar estado guardado
     */
    importState(state) {
        if (state.population) {
            this.population = state.population;
        }
        if (state.generation) {
            this.generation = state.generation;
        }
    }
}
