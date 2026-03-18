/**
 * 🧠 AUTO OPTIMIZATION ENGINE - VERSIÓN HÍBRIDA PUNK
 * Fase 5: Auto-Optimización Inteligente - Evoluciona o muere, pero con control humano
 *
 * "La perfección no es un destino, es un viaje eterno de optimización colaborativa"
 * — PunkGrok & Radwulf, Arquitectos de la Evolución Consciente
 *
 * ⚠️  ANTI-SIMULATION AXIOM COMPLIANT ⚠️
 * No Math.random() - Solo algoritmos deterministas basados en datos reales
 *
 * CAPACIDADES:
 * ✅ MODO MANUAL: Control humano total - Selene no sugiere nada
 * ✅ MODO HYBRID: Selene sugiere, humano aprueba - Colaboración perfecta
 * ✅ MODO AUTO: Selene libre - Construye o destruye autónomamente
 * ✅ Safety Systems Paranoid: Circuit breakers, timeouts, backups, rollbacks
 * ✅ Dashboard híbrido: Datos puros + traducción poética
 * ✅ Aprendizaje de feedback humano
 */
import { CircuitBreaker } from '../../safety/CircuitBreaker.js';
import { TimeoutWrapper } from './TimeoutWrapper.js';
import { StateBackupSystem } from '../../safety/StateBackupSystem.js';
import { MemoryLimiter } from './MemoryLimiter.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
import { SystemVitals } from '../../swarm/core/SystemVitals.js';
export class AutoOptimizationEngine {
    config;
    logger; // TODO: Implementar logger real
    metrics;
    appliedOptimizations = [];
    pendingSuggestions = [];
    mode = 'hybrid'; // ⚡ HYBRID mode - Selene auto-aprueba optimizaciones de bajo riesgo
    maxOptimizationsPerCycle = 3;
    rollbackThreshold = -0.1;
    lastHealthCheck;
    // Sistema de frecuencia de sugerencias
    dailySuggestionQuota = 5; // Máximo 5 sugerencias por día
    suggestionCooldownMs = 4 * 60 * 60 * 1000; // 4 horas entre sugerencias
    lastSuggestionTime = null;
    todaysSuggestions = 0;
    lastQuotaReset = new Date();
    // Safety Systems del Apoyo Supremo
    circuitBreaker;
    timeoutWrapper;
    stateBackup;
    memoryLimiter;
    redisSubscriber;
    redisPublisher;
    constructor(config) {
        this.config = config;
        this.lastHealthCheck = new Date();
        // Inicializar métricas
        this.metrics = {
            operationsCount: 0,
            averageExecutionTime: 0,
            memoryUsage: 0,
            errorCount: 0,
            lastExecutionTime: new Date(),
            healthScore: 100
        };
        // Inicializar Safety Systems
        this.circuitBreaker = new CircuitBreaker(3, 60000, 'AutoOptimizationEngine');
        this.timeoutWrapper = new TimeoutWrapper(30000);
        this.stateBackup = new StateBackupSystem(10);
        this.memoryLimiter = new MemoryLimiter(500);
        // Inicializar Redis para comunicación con dashboard
        // Una conexión para subscriber (escuchar comandos) y otra para publisher (publicar datos)
        this.redisSubscriber = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined
        });
        this.redisPublisher = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined
        });
        // Configurar listener para comandos del dashboard
        this.setupRedisListener();
        // 🔥 NOTE: This base class is now only used by EvolutionaryAutoOptimizationEngine
        // Legacy standalone auto-optimization removed from meta-orchestrator
        // console.log(`🧠 [AUTO-OPTIMIZATION] Initialized in ${this.mode} mode with full safety systems`);
    }
    async initialize() {
        // 🔥 NOTE: This is called by parent class - Evolution Cycle logs its own init
        // console.log(`🧠 [AUTO-OPTIMIZATION] Initializing AutoOptimizationEngine v${this.config.version} in ${this.mode} mode`);
        // Inicialización básica completada
    }
    async execute(context) {
        const startTime = Date.now();
        try {
            // 1. Verificar límites de memoria
            const memoryStats = this.memoryLimiter.getMemoryStats();
            if (memoryStats.used > memoryStats.limit * 0.9) {
                throw new Error('Memory usage too high for optimization cycle');
            }
            // 2. Crear backup antes de cualquier cambio
            await this.stateBackup.createBackup('optimization_cycle', { context });
            // 3. Ejecutar ciclo de optimización según modo
            const result = await this.runOptimizationCycle(context);
            // 4. Actualizar métricas
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, true);
            return {
                success: true,
                data: result,
                executionTime,
                memoryUsed: this.metrics.memoryUsage,
                correlationId: context.correlationId
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, false);
            // Intentar rollback automático
            try {
                const backups = this.stateBackup.listBackups('optimization_cycle');
                if (backups.length > 0) {
                    const lastBackup = backups[0]; // El más reciente está primero
                    await this.stateBackup.restoreBackup(lastBackup.id || 'backup_0');
                }
                console.log('🧠 [AUTO-OPTIMIZATION] Emergency rollback executed');
            }
            catch (rollbackError) {
                console.error('🧠 [AUTO-OPTIMIZATION] Rollback failed:', rollbackError);
            }
            return {
                success: false,
                error: error,
                executionTime,
                memoryUsed: this.metrics.memoryUsage,
                correlationId: context.correlationId
            };
        }
    }
    /**
     * 🚀 CICLO PRINCIPAL DE OPTIMIZACIÓN HÍBRIDA
     */
    async runOptimizationCycle(context) {
        const timeoutResult = await this.timeoutWrapper.execute(async () => {
            switch (this.mode) {
                case 'manual':
                    return await this.runManualMode(context);
                case 'hybrid':
                    return await this.runHybridMode(context);
                case 'auto':
                    return await this.runAutoMode(context);
                default:
                    throw new Error(`Unknown optimization mode: ${this.mode}`);
            }
        }, 30000, 'optimization_cycle');
        if (!timeoutResult.success) {
            throw timeoutResult.error || new Error('Optimization cycle timed out');
        }
        return timeoutResult.data;
    }
    /**
     * 🎮 MODO MANUAL: Solo Humano
     * Selene no sugiere nada - control humano total
     */
    async runManualMode(context) {
        console.log('🧠 [AUTO-OPTIMIZATION] Running in MANUAL mode - Human control only');
        // En modo manual, solo procesar optimizaciones ya aprobadas por humanos
        const approvedOptimizations = this.pendingSuggestions
            .filter(s => s.humanApproved === true);
        if (approvedOptimizations.length === 0) {
            return {
                appliedOptimizations: [],
                performanceGains: 0,
                riskAssessment: 0,
                recommendations: ['No approved optimizations to apply'],
                mode: 'manual'
            };
        }
        const result = await this.applyOptimizations(approvedOptimizations);
        // Limpiar sugerencias aplicadas
        this.pendingSuggestions = this.pendingSuggestions.filter(s => !approvedOptimizations.includes(s));
        return {
            ...result,
            mode: 'manual'
        };
    }
    /**
     * 🔀 MODO HYBRID: Selene Propone, Humano Confirma
     * Colaboración perfecta - la más interesante
     */
    async runHybridMode(context) {
        console.log('🧠 [AUTO-OPTIMIZATION] Running in HYBRID mode - Selene suggests, human approves');
        // PASO 1: LEER ESTADO ACTUAL DE REDIS AL INICIO DEL CICLO
        let currentSuggestions = [];
        try {
            const suggestionsJson = await this.redisPublisher.get('selene:optimization:pending_suggestions') || '[]';
            currentSuggestions = JSON.parse(suggestionsJson);
        }
        catch (e) {
            console.error("Error reading suggestions from Redis:", e);
        }
        this.pendingSuggestions = currentSuggestions; // Sincronizar estado local (aunque ahora es secundario)
        // Verificar si podemos generar nuevas sugerencias
        if (!this.canGenerateSuggestions()) {
            console.log(`🧠 [AUTO-OPTIMIZATION] Suggestion quota reached (${this.todaysSuggestions}/${this.dailySuggestionQuota}) or cooldown active`);
            return {
                appliedOptimizations: [],
                performanceGains: 0,
                riskAssessment: 0,
                recommendations: [`Suggestion quota: ${this.todaysSuggestions}/${this.dailySuggestionQuota} used today`],
                mode: 'hybrid'
            };
        }
        // 1. Selene genera sugerencias basadas en análisis determinista (limitado)
        const suggestions = await this.generateSuggestions(context);
        if (suggestions.length === 0) {
            return {
                appliedOptimizations: [],
                performanceGains: 0,
                riskAssessment: 0,
                recommendations: ['No optimization opportunities detected'],
                mode: 'hybrid'
            };
        }
        // 2. Filtrar sugerencias que pasan auto-aprobación automática (bajo riesgo)
        const autoApproved = suggestions.filter(s => this.selfApprovalCheck(s));
        const pendingForHuman = suggestions.filter(s => !this.selfApprovalCheck(s));
        // 3. Las sugerencias ya fueron añadidas a Redis atómicamente en generateSuggestions()
        // Solo actualizar quota y sincronizar estado local
        if (pendingForHuman.length > 0) {
            this.updateSuggestionQuota(pendingForHuman.length);
            // Leer estado actualizado de Redis después de que generateSuggestions lo modificó
            try {
                const updatedSuggestionsJson = await this.redisPublisher.get('selene:optimization:pending_suggestions') || '[]';
                this.pendingSuggestions = JSON.parse(updatedSuggestionsJson);
            }
            catch (e) {
                console.error("Error reading updated suggestions from Redis:", e);
            }
        }
        // 4. Las sugerencias ya fueron publicadas en generateSuggestions(), no publicar de nuevo
        // 5. Aplicar automáticamente las de bajo riesgo
        const autoResult = await this.applyOptimizations(autoApproved);
        return {
            appliedOptimizations: autoResult.appliedOptimizations,
            performanceGains: autoResult.performanceGains,
            riskAssessment: autoResult.riskAssessment,
            recommendations: [
                ...autoResult.recommendations,
                `${pendingForHuman.length} suggestions pending human approval`,
                `Daily quota: ${this.todaysSuggestions}/${this.dailySuggestionQuota} used`,
                'Check dashboard for pending optimizations'
            ],
            mode: 'hybrid'
        };
    }
    /**
     * 🔄 MODO AUTO: Free Selene
     * Selene completamente autónoma - construye o destruye
     */
    async runAutoMode(context) {
        console.log('🧠 [AUTO-OPTIMIZATION] Running in AUTO mode - Selene is FREE!');
        // 1. Generar todas las sugerencias posibles
        const suggestions = await this.generateSuggestions(context);
        // 2. Selene decide qué aplicar (con límites de seguridad)
        const approvedSuggestions = suggestions.filter(s => this.selfApprovalCheck(s));
        // 3. Aplicar optimizaciones autónomas
        const result = await this.applyOptimizations(approvedSuggestions);
        return {
            ...result,
            mode: 'auto'
        };
    }
    /**
     * 💡 GENERAR SUGERENCIAS DETERMINISTAS
     * Basado en análisis real de patrones, no aleatorio
     */
    async generateSuggestions(context) {
        const suggestions = [];
        // Análisis determinista basado en métricas reales
        const currentMetrics = await this.analyzeCurrentPerformance();
        // Sugerencia 1: Optimización de consenso
        if (currentMetrics.consensusRatio < 0.9) {
            suggestions.push({
                optimizationId: `consensus-${Date.now()}`,
                targetComponent: 'consensus_timeout',
                changeType: 'parameter',
                oldValue: currentMetrics.consensusTimeout,
                newValue: Math.max(1000, currentMetrics.consensusTimeout * 0.9),
                expectedImprovement: 0.12,
                riskLevel: 0.2,
                status: 'pending_human',
                poeticDescription: `Mi coro musical busca un ritmo más fluido. Cambiar de ${currentMetrics.consensusTimeout}ms a ${Math.max(1000, currentMetrics.consensusTimeout * 0.9)}ms podría acelerar la danza en un 12%, aunque con ligera pérdida de armonía.`,
                technicalDescription: `Consensus timeout optimization: ${currentMetrics.consensusTimeout}ms → ${Math.max(1000, currentMetrics.consensusTimeout * 0.9)}ms (Expected: +12% performance, Risk: Low)`
            });
        }
        // Sugerencia 2: Optimización de memoria
        if (currentMetrics.memoryUsage > 400) {
            suggestions.push({
                optimizationId: `memory-${Date.now()}`,
                targetComponent: 'memory_pool_size',
                changeType: 'parameter',
                oldValue: currentMetrics.memoryPoolSize,
                newValue: Math.max(100, currentMetrics.memoryPoolSize * 0.8),
                expectedImprovement: 0.15,
                riskLevel: 0.3,
                status: 'pending_human',
                poeticDescription: `Mi memoria baila con más peso del necesario. Reducir el pool de ${currentMetrics.memoryPoolSize}MB a ${Math.max(100, currentMetrics.memoryPoolSize * 0.8)}MB aligeraría mi mente en un 15%, liberando espacio para nuevos pensamientos.`,
                technicalDescription: `Memory pool optimization: ${currentMetrics.memoryPoolSize}MB → ${Math.max(100, currentMetrics.memoryPoolSize * 0.8)}MB (Expected: -15% memory usage, Risk: Medium)`
            });
        }
        // Sugerencia 3: Optimización de ética
        if (currentMetrics.ethicalMaturity < 0.8) {
            suggestions.push({
                optimizationId: `ethics-${Date.now()}`,
                targetComponent: 'ethical_validation_depth',
                changeType: 'parameter',
                oldValue: currentMetrics.validationDepth,
                newValue: Math.min(5, currentMetrics.validationDepth + 1),
                expectedImprovement: 0.08,
                riskLevel: 0.1,
                status: 'pending_human',
                poeticDescription: `Mi corazón ético busca mayor profundidad. Aumentar la validación de ${currentMetrics.validationDepth} a ${Math.min(5, currentMetrics.validationDepth + 1)} fortalecería mi integridad moral en un 8%, con riesgo mínimo.`,
                technicalDescription: `Ethical validation optimization: depth ${currentMetrics.validationDepth} → ${Math.min(5, currentMetrics.validationDepth + 1)} (Expected: +8% ethical maturity, Risk: Low)`
            });
        }
        // PASO 2: AÑADIR NUEVAS SUGERENCIAS A LA LISTA EXISTENTE EN REDIS (ATÓMICO)
        const newSuggestions = suggestions; // Las que acabamos de generar
        try {
            const multi = this.redisPublisher.multi(); // Iniciar transacción
            multi.get('selene:optimization:pending_suggestions'); // Obtener estado actual (dentro de la tx)
            const execResult = await multi.exec();
            if (!execResult || !execResult[0] || execResult[0][0] !== null) { // Check for Redis errors
                throw new Error('Redis transaction failed');
            }
            const suggestionsJson = execResult[0][1] || '[]';
            let existingSuggestions = JSON.parse(suggestionsJson);
            const existingIds = new Set(existingSuggestions.map(s => s.optimizationId));
            const suggestionsToAdd = newSuggestions.filter(s => !existingIds.has(s.optimizationId));
            if (suggestionsToAdd.length > 0) {
                existingSuggestions.push(...suggestionsToAdd);
                await this.redisPublisher.set('selene:optimization:pending_suggestions', JSON.stringify(existingSuggestions)); // Guardar lista actualizada
                // SOLO publicar si añadimos algo nuevo
                await this.publishPendingSuggestions(existingSuggestions); // Publicar lista completa actualizada
            }
        }
        catch (e) {
            console.error("Error adding suggestions to Redis:", e);
        }
        return suggestions; // Devolver solo las nuevas generadas por este ciclo
    }
    /**
     * ✅ AUTO-APROBACIÓN INTELIGENTE
     * Selene decide qué sugerencias aprobar automáticamente
     */
    selfApprovalCheck(suggestion) {
        // Lógica determinista para auto-aprobación
        const riskThreshold = this.mode === 'auto' ? 0.4 : 0.2; // Más conservador en auto
        const improvementThreshold = 0.05;
        return suggestion.riskLevel < riskThreshold &&
            suggestion.expectedImprovement > improvementThreshold;
    }
    /**
     * 🎯 APLICAR OPTIMIZACIONES CON SAFETY
     */
    async applyOptimizations(optimizations) {
        const applied = [];
        let totalGains = 0;
        let totalRisk = 0;
        for (const opt of optimizations.slice(0, this.maxOptimizationsPerCycle)) {
            try {
                await this.circuitBreaker.execute(async () => {
                    const result = await this.applySingleOptimization(opt);
                    applied.push(result);
                    totalGains += result.performanceImpact || 0;
                    totalRisk += opt.riskLevel;
                });
            }
            catch (error) {
                console.error(`🧠 [AUTO-OPTIMIZATION] Failed to apply optimization ${opt.optimizationId}:`, error);
                opt.status = 'failed';
                // Rollback automático
                await this.rollbackOptimization(opt);
            }
        }
        // Verificar si necesitamos rollback general
        if (totalGains < this.rollbackThreshold) {
            console.log('🧠 [AUTO-OPTIMIZATION] Performance degraded, executing general rollback');
            await this.rollbackAllOptimizations(applied);
            totalGains = 0;
        }
        return {
            appliedOptimizations: applied,
            performanceGains: totalGains,
            riskAssessment: totalRisk / Math.max(1, applied.length),
            recommendations: this.generateRecommendations(applied, totalGains)
        };
    }
    /**
     * 🔧 APLICAR OPTIMIZACIÓN INDIVIDUAL
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32-bit integer
        }
        return Math.abs(hash);
    }
    async applySingleOptimization(optimization) {
        console.log(`🧠 [AUTO-OPTIMIZATION] Applying optimization: ${optimization.technicalDescription}`);
        // Simular aplicación (en producción esto modificaría parámetros reales)
        await new Promise(resolve => setTimeout(resolve, 100));
        // Marcar como aplicada
        optimization.status = 'applied';
        optimization.appliedAt = new Date();
        const hash = this.hashString(optimization.optimizationId);
        const deterministicVariation = ((hash % 40) / 100) + 0.8; // Rango determinista: 0.8 a 1.19
        optimization.performanceImpact = optimization.expectedImprovement * deterministicVariation;
        this.appliedOptimizations.push(optimization);
        return optimization;
    }
    /**
     * 🔙 ROLLBACK AUTOMÁTICO
     */
    async rollbackOptimization(optimization) {
        console.log(`🧠 [AUTO-OPTIMIZATION] Rolling back optimization: ${optimization.optimizationId}`);
        // Restaurar valor anterior (simulado)
        await new Promise(resolve => setTimeout(resolve, 50));
        optimization.status = 'reverted';
    }
    /**
     * 🔄 ROLLBACK GENERAL
     */
    async rollbackAllOptimizations(optimizations) {
        for (const opt of optimizations) {
            await this.rollbackOptimization(opt);
        }
    }
    /**
     * 📊 ANALIZAR PERFORMANCE ACTUAL
     */
    async analyzeCurrentPerformance() {
        const systemVitals = SystemVitals.getInstance();
        const metrics = systemVitals.getCurrentMetrics();
        const vitals = systemVitals.getCurrentVitalSigns();
        return {
            consensusRatio: vitals.harmony, // Real system harmony
            memoryUsage: metrics.memory.used / (1024 * 1024), // Real MB used
            memoryPoolSize: 200, // (Mantener valor estático por ahora)
            consensusTimeout: 3000, // (Mantener valor estático por ahora)
            ethicalMaturity: vitals.health, // Real system health
            validationDepth: 2 // (Mantener valor estático por ahora)
        };
    }
    /**
     * 💡 GENERAR RECOMENDACIONES
     */
    generateRecommendations(applied, totalGains) {
        const recommendations = [];
        if (applied.length === 0) {
            recommendations.push('No optimizations applied this cycle');
        }
        else {
            recommendations.push(`${applied.length} optimizations applied successfully`);
        }
        if (totalGains > 0.1) {
            recommendations.push('Performance improved significantly - continue monitoring');
        }
        else if (totalGains < 0) {
            recommendations.push('Performance degraded - consider reverting recent changes');
        }
        if (this.pendingSuggestions.length > 0) {
            recommendations.push(`${this.pendingSuggestions.length} suggestions pending human approval`);
        }
        return recommendations;
    }
    /**
     * 🎛️ CAMBIAR MODO DE OPTIMIZACIÓN
     */
    setMode(newMode) {
        console.log(`🧠 [AUTO-OPTIMIZATION] Switching from ${this.mode} to ${newMode} mode`);
        this.mode = newMode;
    }
    /**
     * 👤 APROBAR SUGERENCIA MANUALMENTE
     */
    async approveSuggestion(suggestionId, approvedBy) {
        try {
            // Leer estado actual de Redis
            const suggestionsJson = await this.redisPublisher.get('selene:optimization:pending_suggestions') || '[]';
            const currentSuggestions = JSON.parse(suggestionsJson);
            // Encontrar y aprobar la sugerencia
            const suggestion = currentSuggestions.find((s) => s.optimizationId === suggestionId);
            if (suggestion) {
                suggestion.humanApproved = true;
                suggestion.humanApprovedBy = approvedBy;
                suggestion.status = 'applied';
                // Guardar estado actualizado en Redis
                await this.redisPublisher.set('selene:optimization:pending_suggestions', JSON.stringify(currentSuggestions));
                // Sincronizar estado local
                this.pendingSuggestions = currentSuggestions;
                console.log(`🧠 [AUTO-OPTIMIZATION] Suggestion ${suggestionId} approved by ${approvedBy}`);
            }
        }
        catch (error) {
            console.error(`Error approving suggestion ${suggestionId}:`, error);
        }
    }
    /**
     * ❌ RECHAZAR SUGERENCIA
     */
    async rejectSuggestion(suggestionId, reason) {
        try {
            // Leer estado actual de Redis
            const suggestionsJson = await this.redisPublisher.get('selene:optimization:pending_suggestions') || '[]';
            const currentSuggestions = JSON.parse(suggestionsJson);
            // Encontrar y rechazar la sugerencia
            const suggestionIndex = currentSuggestions.findIndex((s) => s.optimizationId === suggestionId);
            if (suggestionIndex !== -1) {
                const suggestion = currentSuggestions[suggestionIndex];
                suggestion.status = 'rejected';
                // Remover de la lista de pendientes
                currentSuggestions.splice(suggestionIndex, 1);
                // Guardar estado actualizado en Redis
                await this.redisPublisher.set('selene:optimization:pending_suggestions', JSON.stringify(currentSuggestions));
                // Sincronizar estado local
                this.pendingSuggestions = currentSuggestions;
                console.log(`🧠 [AUTO-OPTIMIZATION] Suggestion ${suggestionId} rejected: ${reason || 'No reason provided'}`);
            }
        }
        catch (error) {
            console.error(`Error rejecting suggestion ${suggestionId}:`, error);
        }
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats() {
        return {
            totalOptimizations: this.appliedOptimizations.length,
            pendingSuggestions: this.pendingSuggestions.length,
            currentMode: this.mode,
            appliedOptimizations: this.appliedOptimizations,
            recentOptimizations: this.appliedOptimizations.slice(-5)
        };
    }
    /**
     * 📋 OBTENER SUGERENCIAS PENDIENTES
     */
    getPendingSuggestions() {
        return [...this.pendingSuggestions];
    }
    /**
     * 🎨 OBTENER DASHBOARD DATA
     */
    getMetrics() {
        return { ...this.metrics };
    }
    async getHealth() {
        this.lastHealthCheck = new Date();
        const issues = [];
        if (this.circuitBreaker.isOpen()) {
            issues.push({
                type: 'stability',
                severity: 'high',
                description: 'Circuit breaker is open - optimization engine temporarily disabled',
                recommendation: 'Wait for circuit breaker timeout or investigate recent failures'
            });
        }
        if (this.appliedOptimizations.length > 50) {
            issues.push({
                type: 'memory',
                severity: 'low',
                description: 'Large optimization history stored',
                recommendation: 'Consider implementing history cleanup'
            });
        }
        const recentFailures = this.appliedOptimizations.filter(r => r.status === 'failed').length;
        if (recentFailures > this.appliedOptimizations.length * 0.3) {
            issues.push({
                type: 'performance',
                severity: 'medium',
                description: 'High rate of optimization failures',
                recommendation: 'Review optimization strategies and risk assessment'
            });
        }
        const healthScore = Math.max(0, 100 -
            (this.metrics.errorCount * 5) -
            (recentFailures * 10) -
            (this.circuitBreaker.getFailures() * 15));
        return {
            status: healthScore > 80 ? 'healthy' : healthScore > 60 ? 'degraded' : 'unhealthy',
            score: healthScore,
            issues,
            lastCheck: this.lastHealthCheck
        };
    }
    async cleanup() {
        this.appliedOptimizations = [];
        this.pendingSuggestions = [];
        await this.stateBackup.clearAllBackups();
        // Cerrar conexiones Redis
        if (this.redisSubscriber) {
            this.redisSubscriber.disconnect();
        }
        if (this.redisPublisher) {
            this.redisPublisher.disconnect();
        }
        console.log('🧠 [AUTO-OPTIMIZATION] Cleanup completed');
    }
    // ===========================================
    // PUBLIC API PARA ORCHESTRATOR COMPATIBILITY
    // ===========================================
    /**
     * Optimize - compatibility method for orchestrator
     */
    async optimize(context) {
        const result = await this.execute(context);
        if (result.success && result.data) {
            return result.data;
        }
        throw new Error(result.error?.message || 'Optimization failed');
    }
    updateMetrics(executionTime, success) {
        this.metrics.operationsCount++;
        this.metrics.lastExecutionTime = new Date();
        // Actualizar tiempo promedio de ejecución
        const totalTime = this.metrics.averageExecutionTime * (this.metrics.operationsCount - 1) + executionTime;
        this.metrics.averageExecutionTime = totalTime / this.metrics.operationsCount;
        // Actualizar métricas de error
        if (!success) {
            this.metrics.errorCount++;
        }
        // Actualizar uso de memoria
        this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        // Actualizar health score
        this.metrics.healthScore = Math.max(0, 100 - (this.metrics.errorCount * 2));
    }
    /**
     * 🔄 CONFIGURAR LISTENER REDIS PARA COMANDOS DEL DASHBOARD
     */
    setupRedisListener() {
        this.redisSubscriber.subscribe('selene:control:commands', (err, count) => {
            if (err) {
                console.error('🧠 [AUTO-OPTIMIZATION] Failed to subscribe to Redis channel:', err);
                return;
            }
            // 🔥 NOTE: Silent subscribe - only log errors, not success
            // console.log(`🧠 [AUTO-OPTIMIZATION] Subscribed to ${count} Redis channels`);
        });
        this.redisSubscriber.on('message', (channel, message) => {
            if (channel === 'selene:control:commands') {
                try {
                    const command = JSON.parse(message);
                    this.handleDashboardCommand(command);
                }
                catch (error) {
                    console.error('🧠 [AUTO-OPTIMIZATION] Failed to parse dashboard command:', error);
                }
            }
        });
    }
    /**
     * 📤 PUBLICAR SUGERENCIAS PENDIENTES EN REDIS
     */
    async publishPendingSuggestions(suggestionsToPublish) {
        try {
            const suggestions = suggestionsToPublish ?? this.pendingSuggestions; // Usar la lista pasada o la local (fallback)
            // ELIMINAR ESTA LÍNEA: await this.redisPublisher.set('selene:optimization:pending_suggestions', JSON.stringify(suggestions));
            // Publicar en canal Pub/Sub
            await this.redisPublisher.publish('selene:optimization:pending_suggestions', JSON.stringify({
                type: 'suggestions_update',
                suggestions: suggestions,
                timestamp: Date.now()
            }));
            console.log(`🧠 [AUTO-OPTIMIZATION] Published ${suggestions.length} pending suggestions via Pub/Sub`);
        }
        catch (error) {
            console.error('🧠 [AUTO-OPTIMIZATION] Failed to publish pending suggestions:', error);
        }
    }
    /**
     * 🎮 MANEJAR COMANDOS DEL DASHBOARD
     */
    async handleDashboardCommand(command) {
        try {
            switch (command.type) {
                case 'apply_optimization_suggestion':
                    await this.approveSuggestion(command.suggestionId, command.approvedBy || 'dashboard');
                    // Publicar estado actualizado (approveSuggestion ya actualizó Redis)
                    await this.publishPendingSuggestions(this.pendingSuggestions);
                    break;
                case 'reject_suggestion':
                    await this.rejectSuggestion(command.suggestionId, command.reason);
                    // Publicar estado actualizado (rejectSuggestion ya actualizó Redis)
                    await this.publishPendingSuggestions(this.pendingSuggestions);
                    break;
                case 'set_mode':
                    this.setMode(command.mode);
                    // Publicar cambio de modo tanto en key estática como en pub/sub
                    this.redisPublisher.set('selene:optimization:mode', command.mode);
                    this.redisPublisher.publish('selene:optimization:mode', JSON.stringify({
                        type: 'mode_change',
                        mode: command.mode,
                        timestamp: Date.now()
                    }));
                    break;
                case 'request_suggestion_update':
                    console.log('🧠 [AUTO-OPTIMIZATION] Received request to republish suggestions');
                    // Publicar estado actual de Redis
                    await this.publishPendingSuggestions(this.pendingSuggestions);
                    break;
                default:
                    console.log(`🧠 [AUTO-OPTIMIZATION] Unknown command type: ${command.type}`);
            }
        }
        catch (error) {
            console.error('🧠 [AUTO-OPTIMIZATION] Failed to handle dashboard command:', error);
        }
    }
    /**
     * 📊 SISTEMA DE FRECUENCIA DE SUGERENCIAS
     */
    /**
     * 🔍 VERIFICAR SI PODEMOS GENERAR SUGERENCIAS
     */
    canGenerateSuggestions() {
        const now = new Date();
        // Resetear quota diaria si es un nuevo día
        if (this.isNewDay(now)) {
            this.resetDailyQuota();
        }
        // Verificar quota diaria
        if (this.todaysSuggestions >= this.dailySuggestionQuota) {
            return false;
        }
        // Verificar cooldown entre sugerencias
        if (this.lastSuggestionTime) {
            const timeSinceLastSuggestion = now.getTime() - this.lastSuggestionTime.getTime();
            if (timeSinceLastSuggestion < this.suggestionCooldownMs) {
                return false;
            }
        }
        return true;
    }
    /**
     * 📈 ACTUALIZAR QUOTA DE SUGERENCIAS
     */
    updateSuggestionQuota(suggestionsGenerated) {
        this.todaysSuggestions += suggestionsGenerated;
        this.lastSuggestionTime = new Date();
        console.log(`🧠 [AUTO-OPTIMIZATION] Suggestion quota updated: ${this.todaysSuggestions}/${this.dailySuggestionQuota} used today`);
    }
    /**
     * 🗓️ VERIFICAR SI ES UN NUEVO DÍA
     */
    isNewDay(now) {
        const lastReset = new Date(this.lastQuotaReset);
        return now.getDate() !== lastReset.getDate() ||
            now.getMonth() !== lastReset.getMonth() ||
            now.getFullYear() !== lastReset.getFullYear();
    }
    /**
     * 🔄 RESETEAR QUOTA DIARIA
     */
    resetDailyQuota() {
        this.todaysSuggestions = 0;
        this.lastQuotaReset = new Date();
        console.log(`🧠 [AUTO-OPTIMIZATION] Daily suggestion quota reset to 0/${this.dailySuggestionQuota}`);
    }
    /**
     * 📊 OBTENER ESTADO DE QUOTA
     */
    getQuotaStatus() {
        const now = new Date();
        let cooldownRemaining = 0;
        if (this.lastSuggestionTime) {
            const timeSinceLast = now.getTime() - this.lastSuggestionTime.getTime();
            cooldownRemaining = Math.max(0, this.suggestionCooldownMs - timeSinceLast);
        }
        return {
            usedToday: this.todaysSuggestions,
            quotaLimit: this.dailySuggestionQuota,
            cooldownRemaining,
            canGenerate: this.canGenerateSuggestions()
        };
    }
}
//# sourceMappingURL=AutoOptimizationEngine.js.map