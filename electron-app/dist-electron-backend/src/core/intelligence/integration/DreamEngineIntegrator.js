/**
 * 🌀 DREAM ENGINE INTEGRATOR
 * "El Tejedor que conecta Oráculo + Juez + Decisor"
 *
 * WAVE 900.3 - Phase 3: Integration
 *
 * FLUJO COMPLETO:
 * 1. Hunt genera candidatos (worthiness > threshold)
 * 2. Dream simula futuros (proyecta belleza)
 * 3. Decide selecciona top 3 candidatos
 * 4. Filter (Conscience) evalúa ética
 * 5. Execute dispara efecto aprobado
 * 6. Learn audita outcome
 *
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 * @revision WAVE 900.3.1 - Fixed type casting, cache key, execution tracking
 */
import { effectDreamSimulator } from '../dream/EffectDreamSimulator';
import { effectDisplayName } from '../../arsenal/DynamicEffectRegistry';
import { visualConscienceEngine } from '../conscience/VisualConscienceEngine';
import { effectBiasTracker } from '../dream/EffectBiasTracker';
import { AudienceSafetyContextBuilder } from '../dream/AudienceSafetyContext';
// 🎭 WAVE 920: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController';
// 🧬 WAVE 6000.V7: COOLDOWN SEAL — Filter cooldown-locked IDs from Dream candidates
import { getArsenalRepository } from '../../effects/ContextualEffectSelector';
// ═══════════════════════════════════════════════════════════════════════════
// DREAM ENGINE INTEGRATOR
// ═══════════════════════════════════════════════════════════════════════════
export class DreamEngineIntegrator {
    constructor() {
        // 🔧 WAVE 1003.15: Comentado para reducir spam de logs
        // console.log('[INTEGRATOR] 🌀 Dream Engine Integrator initialized')
        this.dreamCache = new Map();
        this.dreamCacheTTL = 5000;
        this.executionHistory = [];
        this.maxHistorySize = 100;
        // Timeout para dream simulation (evita hangs)
        this.dreamTimeoutMs = 3000;
        // 🔬 WAVE 7522: Throttle maps for verbose logs (were 60fps spam)
        this._approvedLogThrottle = new Map();
        this._preBufferLogThrottle = new Map();
        // 🩸 WAVE 2530: Invalidate dream cache on mood change.
        // The mood's blockList filters the effect pool, so a mood switch must
        // force a fresh simulation. Without this, switching from CALM (which
        // blocks strobes) to BALANCED would keep serving cached CALM-filtered
        // results for up to 5s (the cache TTL).
        MoodController.getInstance().onMoodChange(() => {
            this.dreamCache.clear();
        });
    }
    /**
     * Ejecuta pipeline COMPLETO: Hunt → Dream → Decide → Filter → Execute
     */
    async executeFullPipeline(context) {
        const pipelineStartTime = Date.now();
        // 🩸 WAVE 2103: ZONE GATE REFORM — "ambient" and "valley" are WHERE TECHNO LIVES
        // 
        // THE BUG: WAVE 2101.3/2101.5 blocked ambient+valley+silence from the pipeline.
        // In techno at 118-122 BPM, energy oscillates between 0.20-0.70 constantly,
        // which maps to valley/ambient/gentle. The gate was blocking ~60% of all frames.
        // Effects NEVER fired because by the time energy hit "gentle", the hunt moment
        // had already passed and the cooldown was already registered from a failed attempt.
        //
        // THE FIX: Only block "silence" zone (E < 0.15). That's a real dead zone.
        // Valley and ambient are NORMAL operating zones for techno buildups/breakdowns.
        // The ContextualEffectSelector ALREADY handles zone-appropriate effect selection
        // via EFFECTS_BY_INTENSITY — that's the correct architectural layer for this.
        // Duplicating zone filtering here was violating Single Responsibility.
        const energyZone = context.energyZone ?? 'ambient';
        if (energyZone === 'silence') {
            return {
                approved: false,
                effect: null,
                dreamTime: 0,
                filterTime: 0,
                totalTime: Date.now() - pipelineStartTime,
                dreamRecommendation: `Zone gate: silence (E < 0.15)`,
                ethicalVerdict: null,
                circuitHealthy: true,
                fallbackUsed: false,
                alternatives: []
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // STEP 2: DREAM (simula futuros)
        // ═════════════════════════════════════════════════════════════════════
        const dreamStartTime = Date.now();
        const dreamResult = await this.dreamEffects(context);
        const dreamTime = Date.now() - dreamStartTime;
        // Generate candidates
        const candidates = this.generateCandidates(dreamResult);
        if (candidates.length === 0) {
            console.warn('[INTEGRATOR] ⚠️ Dream produced no candidates');
            return {
                approved: false,
                effect: null,
                dreamTime,
                filterTime: 0,
                totalTime: Date.now() - pipelineStartTime,
                dreamRecommendation: 'No candidates generated',
                ethicalVerdict: null,
                circuitHealthy: true,
                fallbackUsed: true,
                alternatives: []
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // 🔮 WAVE 4913: TEMPORAL SEAL GATE
        // Si CASSANDRA selló un pre-buffer, recommendation === 'modify'.
        // Cortocircuitar ANTES de ethics para que el sello sea real (no residual).
        // De lo contrario, un Z-score alto podría hacer pasar ethics y disparar
        // el efecto prematuramente, vaciando el pre-buffer antes de la sección.
        // ═════════════════════════════════════════════════════════════════════
        // ⏳ WAVE 5009 FIX 3: El Contrato Blindado de Cassandra
        // Si la recomendacion es modify pero HAY urgencia / timeToEvent = 0
        // O si la razon menciona FAST PATH, DEBEMOS ejecutar. No cortocircuitar.
        const isFastPath = dreamResult.reason.includes('FAST PATH');
        if (dreamResult.recommendation === 'modify' && !isFastPath) {
            return {
                approved: false,
                effect: null,
                dreamTime,
                filterTime: 0,
                totalTime: Date.now() - pipelineStartTime,
                dreamRecommendation: dreamResult.recommendation,
                ethicalVerdict: null,
                circuitHealthy: true,
                fallbackUsed: false,
                alternatives: []
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // 🔮 WAVE 5011: CASSANDRA PRE-BUFFER GUARD
        // Si hay un pre-buffer activo (el simulador no lo limpió porque timeToEvent
        // era > 1500ms), el pipeline ejecuta normalmente y puede aprobar un efecto
        // DIFERENTE al pre-bufferizado, robándole el slot al Oráculo.
        // SOLUCIÓN: Si el pre-buffer existe y aún no expiró, bloquear aprobaciones
        // de efectos distintos. El Sovereign Clock en process() disparará el efecto
        // correcto cuando el reloj llegue a cero.
        // ═════════════════════════════════════════════════════════════════════
        {
            const activeBuffer = effectDreamSimulator.getPreBufferStatus();
            if (activeBuffer && !isFastPath) {
                const nowGuard = Date.now();
                const bufferAge = nowGuard - activeBuffer.bufferedAt;
                const isBufferExpired = bufferAge > 5000; // PRE_BUFFER_MAX_AGE_MS
                if (!isBufferExpired) {
                    // 🔬 WAVE 7522: Throttle PRE-BUFFER GUARD log (was firing every frame for ~3s)
                    const _guardKey = activeBuffer.effectId;
                    const _now = Date.now();
                    const _last = this._preBufferLogThrottle.get(_guardKey) ?? 0;
                    if (_now - _last >= 1000) {
                        console.log(`[INTEGRATOR] 🔮🛡️ PRE-BUFFER GUARD: blocking normal approval — ` +
                            `"${activeBuffer.effectId}" sealed, ${Math.ceil((activeBuffer.predictedEventAt - nowGuard) / 1000)}s remaining`);
                        this._preBufferLogThrottle.set(_guardKey, _now);
                    }
                    return {
                        approved: false,
                        effect: null,
                        dreamTime,
                        filterTime: 0,
                        totalTime: Date.now() - pipelineStartTime,
                        dreamRecommendation: `pre-buffer-guard: awaiting "${activeBuffer.effectId}"`,
                        ethicalVerdict: null,
                        circuitHealthy: true,
                        fallbackUsed: false,
                        alternatives: []
                    };
                }
            }
        }
        // ═════════════════════════════════════════════════════════════════════
        // STEP 3: FILTER (Conscience evalúa ética)
        // ═════════════════════════════════════════════════════════════════════
        const filterStartTime = Date.now();
        const safetyContext = this.buildAudienceSafetyContext(context);
        const ethicalVerdict = await visualConscienceEngine.evaluate(candidates, safetyContext);
        const filterTime = Date.now() - filterStartTime;
        // ═════════════════════════════════════════════════════════════════════
        // STEP 4: DECIDE (APPROVED/REJECTED/DEFERRED)
        // ═════════════════════════════════════════════════════════════════════
        // 🎭 WAVE 920: Apply mood intensity modifier to approved effect
        let moodAdjustedEffect = ethicalVerdict.approvedEffect;
        if (moodAdjustedEffect) {
            const _moodController = MoodController.getInstance();
            const _currentProfile = _moodController.getCurrentProfile();
            const rawIntensity = moodAdjustedEffect.intensity;
            const adjustedIntensity = _moodController.applyIntensity(rawIntensity);
            if (rawIntensity !== adjustedIntensity) {
                console.log(`[INTEGRATOR] 🎭 Intensity adjusted: ${rawIntensity.toFixed(2)} → ${adjustedIntensity.toFixed(2)} (${_currentProfile.emoji})`);
                // Clone effect with adjusted intensity
                moodAdjustedEffect = {
                    ...moodAdjustedEffect,
                    intensity: adjustedIntensity
                };
            }
        }
        const decision = {
            approved: ethicalVerdict.verdict === 'APPROVED',
            effect: moodAdjustedEffect,
            dreamTime,
            filterTime,
            totalTime: Date.now() - pipelineStartTime,
            dreamRecommendation: dreamResult.recommendation,
            ethicalVerdict,
            circuitHealthy: ethicalVerdict.circuitBreakerStatus !== 'OPEN',
            fallbackUsed: ethicalVerdict.verdict !== 'APPROVED' || ethicalVerdict.approvedEffect === null,
            alternatives: ethicalVerdict.alternatives.slice(0, 5) // 🩸 WAVE 2104.2: was 2 — con solo 2 alternativas, si ambas están en cooldown = SILENCIO. 5 da rotation real
        };
        // � WAVE 2102: MINIMUM INTENSITY GATE — log approvals and reject weak intensities
        if (decision.approved && decision.effect) {
            if (decision.effect.intensity < 0.30) {
                console.log(`[INTEGRATOR] 🔇 LOW INTENSITY BLOCKED: ${decision.effect.effect} @ ${decision.effect.intensity.toFixed(2)} (min=0.30)`);
                return {
                    ...decision,
                    approved: false,
                    dreamRecommendation: `Intensity gate: ${decision.effect.intensity.toFixed(2)} < 0.30 minimum`,
                };
            }
            // V3.4: Static Divine Z-score threshold purged.
            // Divine leak prevention is now handled in DecisionMaker via V3 epicness.
            // The integrator no longer gates divine effects — it routes them.
            // 🔬 WAVE 7522: Throttle APPROVED log (was firing every frame for same effect)
            const _approvedKey = decision.effect.effect;
            const _nowApproved = Date.now();
            const _lastApproved = this._approvedLogThrottle.get(_approvedKey) ?? 0;
            if (_nowApproved - _lastApproved >= 1000) {
                console.log(`[INTEGRATOR] ✅ APPROVED: ${effectDisplayName(decision.effect.effect)} @ ${decision.effect.intensity.toFixed(2)} | ` +
                    `ethics=${decision.ethicalVerdict?.ethicalScore?.toFixed(3) ?? '?'} | ` +
                    `Dream: ${dreamTime}ms | Total: ${decision.totalTime}ms`);
                this._approvedLogThrottle.set(_approvedKey, _nowApproved);
            }
        }
        else if (decision.totalTime > 10 || !decision.approved) {
            // 🩸 WAVE 4832 P1: TRANSPARENT DIAGNOSTICS — exposes real verdict, score, violations
            const conscienceVerdict = ethicalVerdict?.verdict ?? 'NO_VERDICT';
            const verdictEmoji = decision.approved ? '✅' :
                conscienceVerdict === 'DEFERRED' ? '⏸️' : '❌';
            const violationSummary = (ethicalVerdict?.violations ?? [])
                .map(v => `${v.value}/${v.severity}`)
                .slice(0, 3)
                .join(', ') || 'none';
            console.log(`[INTEGRATOR] 📊 Pipeline: ${verdictEmoji} ${conscienceVerdict} | ` +
                `score=${ethicalVerdict?.ethicalScore?.toFixed(3) ?? '?'} | ` +
                `dream=${decision.dreamRecommendation} | violations=[${violationSummary}] | ` +
                `${dreamTime}+${filterTime}=${decision.totalTime}ms`);
        }
        // Record for learning
        if (decision.approved && decision.effect) {
            effectBiasTracker.recordEffect({
                effect: decision.effect.effect,
                timestamp: Date.now(),
                intensity: decision.effect.intensity,
                zones: decision.effect.zones ?? ['all'],
                success: true,
                vibe: context.pattern.vibe
            });
        }
        // Track decision in history
        this.recordDecision(decision);
        return decision;
    }
    /**
     * Post-execution audit
     */
    async auditExecution(decision, outcome) {
        if (!decision.ethicalVerdict || !decision.effect)
            return;
        const audit = visualConscienceEngine.audit({
            effect: decision.effect,
            timestamp: Date.now(),
            verdict: decision.approved ? 'APPROVED' : 'REJECTED',
            ethicalScore: decision.ethicalVerdict.ethicalScore
        }, outcome);
        if (!audit.passes) {
            console.warn('[INTEGRATOR] 🔍 Audit failed:', audit.violations.map(v => v.description));
        }
        // Evolve maturity
        const maturityUpdate = visualConscienceEngine.evolveMaturity({
            effect: decision.effect,
            timestamp: Date.now(),
            verdict: decision.approved ? 'APPROVED' : 'REJECTED',
            ethicalScore: decision.ethicalVerdict.ethicalScore
        }, outcome);
        if (maturityUpdate.unlockedFeatures.length > 0) {
            console.log(`[INTEGRATOR] 🧠 Maturity evolved: ${maturityUpdate.evolutionReason}`);
            console.log(`[INTEGRATOR] 🔓 Unlocked: ${maturityUpdate.unlockedFeatures.join(', ')}`);
        }
    }
    /**
     * Get health status
     */
    getHealthStatus() {
        const circuitStatus = visualConscienceEngine.checkCircuitHealth();
        const maturityMetrics = visualConscienceEngine.getMaturityMetrics();
        return {
            circuitBreakerState: circuitStatus.state,
            evolutionLevel: maturityMetrics?.level ?? 1,
            cacheSize: this.dreamCache.size
        };
    }
    /**
     * ⚡ WAVE 2093.2: Invalidar Dream cache
     * Se llama cuando un efecto se disparó con éxito para forzar alternativas
     */
    invalidateDreamCache() {
        this.dreamCache.clear();
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE: DREAM EXECUTION
    // ═════════════════════════════════════════════════════════════════════════
    async dreamEffects(context) {
        const cacheKey = this.getDreamCacheKey(context);
        // Check cache
        const cached = this.dreamCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.dreamCacheTTL) {
            // 🧹 WAVE 1015: Silenciado - spam innecesario
            return cached.result;
        }
        // Run dream simulation with timeout protection
        try {
            // Build proper SystemState
            // 🧬 WAVE 6000.V7: Populate activeCooldowns from the Gatekeeper so the
            // DreamSimulator can filter cooldown-locked candidates before simulating.
            const vibeId = context.pattern.vibe;
            let activeCooldowns;
            try {
                activeCooldowns = getArsenalRepository().getActiveCooldowns(vibeId);
            }
            catch {
                activeCooldowns = new Map();
            }
            // BUILDING phase: multiply cooldowns by 2.5 to slow down effect cadence
            const narrativePhase = context.narrativePhase ?? '';
            if (narrativePhase.toLowerCase() === 'building') {
                const scaledCooldowns = new Map();
                for (const [k, v] of activeCooldowns) {
                    scaledCooldowns.set(k, v * 2.5);
                }
                activeCooldowns = scaledCooldowns;
            }
            const systemState = {
                currentPalette: { primary: 0, secondary: 0.33, accent: 0.66 }, // Default neutral
                currentBeauty: context.huntDecision?.confidence ?? 0.5,
                lastEffect: null,
                lastEffectTime: 0,
                activeCooldowns,
                energy: context.pattern.energy ?? 0.5,
                tempo: context.pattern.tempo ?? 120,
                vibe: vibeId
            };
            // Build proper MusicalPrediction
            // 🧠 WAVE 1173: NEURAL LINK - Pass Oracle prediction to Dreamer
            // 🔮 WAVE 1190: PROYECTO CASSANDRA - Usar predicción REAL del Oráculo
            const energy = context.pattern.energy ?? 0.5;
            const predictionType = context.predictionType ?? 'none';
            const energyTrend = context.energyTrend ?? 'stable';
            // 🔮 CASSANDRA: Usar probabilidad REAL, no hardcodeada
            const realProbability = context.predictionProbability ?? 0;
            const hasStrongPrediction = realProbability > 0.5;
            // Derive drop/breakdown flags from prediction type
            const isDropComing = predictionType === 'drop_incoming' ||
                predictionType === 'energy_spike' ||
                (energy > 0.8 && energyTrend === 'rising');
            const isBreakdownComing = predictionType === 'breakdown_imminent' ||
                predictionType === 'energy_drop' ||
                (energy < 0.3 && energyTrend === 'falling');
            // 🔮 CASSANDRA: Calcular tiempo de anticipación para el Dreamer
            // Si el Oráculo predice algo en <2s, el Dreamer tiene que actuar YA
            const timeToEvent = context.predictionTimeMs ?? 8000;
            const isUrgent = timeToEvent < 2000 && hasStrongPrediction;
            const musicalPrediction = {
                predictedEnergy: energy,
                predictedSection: this.deriveSectionFromPrediction(predictionType, energy),
                predictedTempo: context.pattern.tempo ?? 120,
                // 🔮 CASSANDRA: Usar probabilidad REAL del Oráculo
                confidence: hasStrongPrediction ? realProbability : (predictionType !== 'none' ? 0.5 : 0.3),
                isDropComing,
                isBreakdownComing,
                energyTrend: energyTrend === 'spike' ? 'rising' : energyTrend,
                // 🧠 WAVE 1173: Pass raw prediction type to Dreamer
                predictionType,
                // 🔮 CASSANDRA: Nuevos campos para anticipación inteligente
                timeToEventMs: timeToEvent,
                isUrgent,
                oracleProbability: realProbability, // 🔮 Probabilidad cruda del Oráculo para scoring
                suggestedEffects: context.suggestedEffects ?? [],
                oracleReasoning: context.predictionReasoning ?? null,
            };
            // Execute with timeout
            const dreamPromise = effectDreamSimulator.dreamEffects(systemState, musicalPrediction, this.buildAudienceSafetyContext(context));
            // Timeout wrapper
            const result = await Promise.race([
                dreamPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Dream timeout')), this.dreamTimeoutMs))
            ]);
            // Cache result
            this.dreamCache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
        catch (error) {
            console.error('[INTEGRATOR] ❌ Dream simulation error:', error);
            // Fallback: empty but valid result
            return {
                scenarios: [],
                bestScenario: null,
                recommendation: 'abort',
                reason: `Dream simulation failed: ${error}`,
                warnings: ['Dream engine error - using fallback'],
                simulationTimeMs: 0
            };
        }
    }
    generateCandidates(dreamResult) {
        const candidates = [];
        const moodController = MoodController.getInstance();
        const profile = moodController.getCurrentProfile();
        // 🎭 WAVE 920: Helper para filtrar por blockList
        const isBlocked = (effectId) => {
            if (moodController.isEffectBlocked(effectId)) {
                console.log(`[INTEGRATOR] 🚫 Effect "${effectId}" blocked by ${profile.emoji} mood`);
                return true;
            }
            return false;
        };
        if (dreamResult.bestScenario && !isBlocked(dreamResult.bestScenario.effect.effect)) {
            candidates.push(dreamResult.bestScenario.effect);
        }
        for (const scenario of dreamResult.scenarios.slice(0, 3)) {
            // Skip si es el best scenario ya añadido O si está bloqueado
            if (scenario.effect === dreamResult.bestScenario?.effect)
                continue;
            if (isBlocked(scenario.effect.effect))
                continue;
            candidates.push(scenario.effect);
        }
        return candidates.slice(0, 5);
    }
    buildAudienceSafetyContext(context) {
        const builder = new AudienceSafetyContextBuilder()
            .withVibe(context.pattern.vibe)
            .withEnergy(context.pattern.energy ?? 0.5)
            .withCrowdSize(context.crowdSize)
            .withGpuLoad(context.gpuLoad);
        // 🧠 WAVE 975.5: ZONE UNIFICATION - Inyectar zona desde SeleneTitanConscious
        if (context.energyZone) {
            builder.withEnergyZone(context.energyZone);
        }
        // 🛡️ WAVE 1178: ZONE PROTECTION - Inyectar Z-Score para bloquear disparos en bajadas
        if (context.zScore !== undefined) {
            builder.withZScore(context.zScore);
        }
        // Add epilepsy mode if enabled
        if (context.epilepsyMode) {
            builder.withEpilepsyMode(true);
        }
        // 🧬 WAVE 2093 COG-3: Spectral Context
        if (context.spectralContext) {
            builder.withSpectral(context.spectralContext);
        }
        // 🧬 M-SARFE: Pass AcousticRealityState to Dream Simulator for real DNA target derivation
        if (context.acousticReality) {
            builder.withAcousticReality(context.acousticReality);
        }
        // Narrative phase for BUILDING aggression filter
        if (context.narrativePhase) {
            builder.withNarrativePhase(context.narrativePhase);
        }
        // 🔥 WAVE 996.8: CABLEAR EL HISTORIAL AL DREAMSIMULATOR
        // El Diversity Engine NECESITA el historial de efectos recientes para penalizar repeticiones
        // Sin esto, recentEffects siempre era [] y cyber_dualism ganaba TODO
        if (context.recentEffects && context.recentEffects.length > 0) {
            // Convertir al formato que espera el builder (EffectHistoryEntry[])
            const effectHistoryEntries = context.recentEffects.map(e => ({
                effect: e.effect,
                timestamp: e.timestamp,
                energy: 0.7, // Default razonable
                intensity: 0.7, // Default razonable  
                duration: 2000, // Default 2s
                zones: ['all'], // Default zones
                success: true, // Asumimos que se ejecutó
                vibe: context.pattern.vibe // Vibe actual del contexto
            }));
            builder.withRecentEffects(effectHistoryEntries);
            // 🧹 WAVE 1015: Silenciado - spam innecesario
        }
        return builder.build();
    }
    // ═════════════════════════════════════════════════════════════════════════
    // 🧠 WAVE 1173: NEURAL LINK - Helper methods
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Deriva la sección musical esperada del tipo de predicción del Oráculo
     */
    deriveSectionFromPrediction(predictionType, energy) {
        switch (predictionType) {
            case 'energy_spike':
            case 'drop_incoming':
                return 'drop';
            case 'buildup_starting':
                return 'buildup';
            case 'breakdown_imminent':
            case 'energy_drop':
                return 'breakdown';
            default:
                // Fallback basado en energía
                if (energy > 0.8)
                    return 'drop';
                if (energy > 0.6)
                    return 'chorus';
                if (energy < 0.3)
                    return 'breakdown';
                return 'verse';
        }
    }
    getDreamCacheKey(context) {
        // Cache key incluye factores que afectan decisión ética
        // NO cachear si epilepsyMode diferente (cambia completamente los resultados)
        // 🔥 WAVE 996.5: INCLUIR recentEffects para que Diversity Engine funcione correctamente
        // 🩸 WAVE 2530: INCLUIR mood — el blockList del mood filtra el pool de efectos,
        //   así que un cambio de mood debe invalidar la cache. Sin esto, al pasar de
        //   CALM a BALANCED se seguían usando los efectos filtrados de CALM.
        const energy = Math.round((context.pattern.energy ?? 0.5) * 10);
        const worthiness = (context.huntDecision?.worthiness ?? 0).toFixed(1);
        const gpuBucket = Math.round(context.gpuLoad * 5); // 0, 0.2, 0.4, 0.6, 0.8, 1.0
        const epilepsy = context.epilepsyMode ? '1' : '0';
        const mood = MoodController.getInstance().getCurrentMood();
        // 🎯 WAVE 996.5: Hash de efectos recientes para invalidar cache cuando cambia el historial
        const recentEffectsHash = context.recentEffects
            .map(e => e.effect)
            .join(',');
        return `${context.pattern.vibe}:e${energy}:w${worthiness}:g${gpuBucket}:ep${epilepsy}:m${mood}:h${recentEffectsHash}`;
    }
    recordDecision(decision) {
        this.executionHistory.push(decision);
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory.shift();
        }
    }
    // ═══════════════════════════════════════════════════════════════════
    // 🔮 WAVE 5011: CASSANDRA'S SOVEREIGN CLOCK — Pre-buffer proxy API
    // ═══════════════════════════════════════════════════════════════════
    /** @see EffectDreamSimulator.getPreBufferStatus */
    getPreBufferStatus() {
        return effectDreamSimulator.getPreBufferStatus();
    }
    /** @see EffectDreamSimulator.getPreBufferedCandidate */
    getPreBufferedCandidate() {
        return effectDreamSimulator.getPreBufferedCandidate();
    }
    /** @see EffectDreamSimulator.clearPreBuffer */
    clearPreBuffer() {
        effectDreamSimulator.clearPreBuffer();
    }
}
// ═════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═════════════════════════════════════════════════════════════════════════
export const dreamEngineIntegrator = new DreamEngineIntegrator();
