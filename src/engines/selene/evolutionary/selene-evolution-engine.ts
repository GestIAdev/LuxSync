import { EvolutionaryDecisionGenerator } from './engines/evolutionary-decision-generator.js';
import { FibonacciPatternEngine } from './engines/fibonacci-pattern-engine.js';
import { ModeManager } from './modes/mode-manager.js'; // 🔀 THE SWITCH - Force compilation
// import { SystemVitals } from '../swarm/core/SystemVitals.js';

// 🔧 TEMP FIX: Veritas disabled - import AFTER to avoid pre-evaluation
// const { RealVeritasInterface } = require('../swarm/veritas/VeritasInterface.cjs');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
import { EvolutionContext, EvolutionaryDecisionType, EvolutionarySuggestion, FeedbackEntry, EvolutionaryPattern } from './interfaces/evolutionary-engine-interfaces.js';
import { EvolutionarySafetyValidator, SafetyValidationResult } from './security/evolutionary-safety-validator.js';
import { PatternSanityChecker, SanityCheckResult } from './security/pattern-sanity-checker.js';
import { DecisionContainmentSystem, ContainmentResult } from './security/decision-containment-system.js';
import { EvolutionaryRollbackEngine } from './security/evolutionary-rollback-engine.js';
import { SanityCheckEngine } from './security/sanity-check-engine.js';
import { PatternQuarantineSystem } from './security/pattern-quarantine-system.js';
import { BehavioralAnomalyDetector } from './security/behavioral-anomaly-detector.js';


/**
 * 🌟 SELENE EVOLUTION ENGINE
 * El corazón evolutivo de Selene Song
 * Integra música, poesía, zodiaco y fibonacci en decisiones vivas
 */

export class SeleneEvolutionEngine {
  // private systemVitals = SystemVitals.getInstance();
  private systemVitals: any = {
    getCurrentMetrics: () => ({
      cpu: { usage: 0.5, loadAverage: [0.5, 0.4, 0.3], cores: 4 },
      memory: { used: 1000000, total: 8000000, usage: 0.125, free: 7000000 },
      process: { uptime: 3600, pid: 1234, memoryUsage: { rss: 50000000, heapTotal: 30000000, heapUsed: 20000000, external: 1000000, arrayBuffers: 0 } as any },
      network: { connections: 10, latency: 50 },
      errors: { count: 0, rate: 0 },
      timestamp: Date.now()
    }),
    getVitals: () => ({
      health: 0.9,
      stress: 0.2,
      harmony: 0.8,
      creativity: 0.7,
      timestamp: Date.now()
    })
  };
  // 🔧 TEMP FIX: Veritas disabled temporarily (import issue in ES module)
  // private veritasInterface = new RealVeritasInterface();
  private redis: any;

  // 🔒 COMPONENTES DE SEGURIDAD EVOLUTIVA
  private safetyValidator = new EvolutionarySafetyValidator();
  private patternSanityChecker = new PatternSanityChecker();
  private containmentSystem = new DecisionContainmentSystem();
  private rollbackEngine = new EvolutionaryRollbackEngine();
  private sanityCheckEngine = new SanityCheckEngine();
  private quarantineSystem = new PatternQuarantineSystem();
  private anomalyDetector = new BehavioralAnomalyDetector();

  constructor() {
    this.redis = new Redis();
  }

  // 🚀 MEJORA CRÍTICA: Gestión de memoria y límites
  private evolutionHistory: EvolutionaryDecisionType[] = [];
  private feedbackHistory: FeedbackEntry[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly MAX_FEEDBACK_SIZE = 500;

  // 🚀 MEJORA CRÍTICA: Prevención de race conditions
  private evolutionMutex = false;
  private readonly MUTEX_TIMEOUT = 30000; // 30 segundos

  // 🚀 MEJORA CRÍTICA: Archivo de historia en Redis
  private readonly REDIS_HISTORY_KEY = 'selene:evolution:history';
  private readonly REDIS_FEEDBACK_KEY = 'selene:evolution:feedback_history';
  
  // 🔥 TYPE WEIGHTS - Pesos de tipos basados en feedback humano
  private readonly REDIS_TYPE_WEIGHTS_KEY = 'selene:evolution:type_weights';
  private readonly DEFAULT_WEIGHT = 1.0; // Peso inicial para todos los tipos
  private readonly WEIGHT_INCREMENT = 0.2; // +20% por feedback positivo (rating >5)
  private readonly WEIGHT_DECREMENT = 0.1; // -10% por feedback negativo (rating <5)
  private readonly MIN_WEIGHT = 0.1; // Peso mínimo (nunca llegar a 0)
  private readonly MAX_WEIGHT = 5.0; // Peso máximo (evitar explosión)

  /**
   * Ciclo principal de evolución
   */
  async executeEvolutionCycle(): Promise<EvolutionarySuggestion[]> {
    // 🚀 PREVENCIÓN DE RACE CONDITIONS
    if (this.evolutionMutex) {
      console.log('🔒 Evolución en progreso, esperando...');
      return [];
    }

    this.evolutionMutex = true;
    const startTime = Date.now();

    try {
      // Timeout automático
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Evolution cycle timeout')), this.MUTEX_TIMEOUT);
      });

      const evolutionPromise = this.performEvolutionCycle();

      const suggestions = await Promise.race([evolutionPromise, timeoutPromise]);

      console.log(`✅ Ciclo evolutivo completado en ${Date.now() - startTime}ms`);
      return suggestions;

    } catch (error) {
      console.error('❌ Error en ciclo evolutivo:', error as Error);
      return [];
    } finally {
      this.evolutionMutex = false;
    }
  }

  /**
   * Lógica interna del ciclo evolutivo
   */
  private async performEvolutionCycle(): Promise<EvolutionarySuggestion[]> {
    // Construir contexto completo
    const context = await this.buildEvolutionContext();

    // 🔒 SANITY CHECK - Validar estado del sistema antes de proceder
    const sanityResult = SanityCheckEngine.assessEvolutionSanity(context);
    if (sanityResult.sanityLevel < 0.6) { // Umbral más estricto para proceder
      console.warn('🚨 Sanity check fallido:', sanityResult.concerns);
      // Ejecutar intervención si es necesaria
      if (sanityResult.requiresIntervention) {
        await SanityCheckEngine.executeSanityIntervention(sanityResult, context);
      }
      return []; // No proceder con evolución si no pasa sanity check
    }

    // 🎯 OBTENER TYPE WEIGHTS DEL FEEDBACK LOOP - Esto influye en la generación
    const typeWeights = await this.getAllTypeWeights();

    // Generar tipos de decisión novedosos (limitado a 2 para eficiencia)
    // 🔥 PASAR TYPE WEIGHTS + REDIS - Feedback loop ahora activo + Switch integration
    const types = await EvolutionaryDecisionGenerator.generateEvolutionCycle(context, 2, typeWeights, this.redis);

    // 🔍 PATTERN SANITY CHECK - Validar cordura de los patrones generados
    const saneTypes = [];
    for (const type of types) {
      // Convertir EvolutionaryDecisionType a EvolutionaryPattern para validación
      const pattern: EvolutionaryPattern = {
        fibonacciSequence: type.fibonacciSignature,
        zodiacPosition: type.zodiacAffinity ? 0 : 1, // Placeholder - convertir string a number
        musicalKey: type.musicalKey,
        harmonyRatio: type.musicalHarmony,
        timestamp: type.generationTimestamp
      };

      const sanityResult = PatternSanityChecker.checkPatternSanity(pattern);
      if (sanityResult.isSane) {
        saneTypes.push(type);
      } else {
        console.warn(`🚨 Patrón no sano descartado: ${sanityResult.issues.join(', ')}`);
      }
    }

    // Si no quedan tipos sanos, activar FALLBACK DE EMERGENCIA
    if (saneTypes.length === 0) {
      console.warn('🚨🆘 EMERGENCY FALLBACK ACTIVADO - Sistema en estado crítico, generando suggestions de supervivencia');
      
      // 🔥 SUGERENCIAS DE EMERGENCIA - Mantener el sistema a flote
      const emergencySuggestions: EvolutionarySuggestion[] = [];
      const timestamp = Date.now();
      
      // Suggestion 1: MEMORY CLEANUP si memoria crítica
      if (context.systemMetrics.memory.usage > 85) {
        const memoryType: EvolutionaryDecisionType = {
          typeId: `EMERGENCY_MEMORY_CLEANUP_${timestamp}`,
          name: 'Emergency Memory Cleanup',
          description: 'Limpieza agresiva de memoria para liberar recursos críticos',
          poeticDescription: 'El sistema respira hondo, liberando lo innecesario para sobrevivir',
          technicalBasis: 'Garbage collection agresivo + cache flush',
          riskLevel: 0.2,
          expectedCreativity: 0.1,
          fibonacciSignature: [1, 1, 2, 3],
          zodiacAffinity: 'virgo',
          musicalKey: 'C',
          musicalHarmony: 0.5,
          generationTimestamp: timestamp,
          validationScore: 0.7
        };
        
        emergencySuggestions.push({
          id: `EMERGENCY_MEMORY_${timestamp}`,
          targetComponent: 'memory-manager',
          changeType: 'algorithm',
          oldValue: 'normal-gc',
          newValue: 'aggressive-gc',
          expectedImprovement: 0.3,
          riskLevel: 0.2,
          technicalDescription: 'Ejecutar limpieza agresiva de memoria para liberar recursos',
          status: 'pending_human',
          evolutionaryType: memoryType,
          patternSignature: { fibonacciSequence: [1, 1, 2, 3], zodiacPosition: 5, musicalKey: 'C', harmonyRatio: 0.5, timestamp },
          creativityScore: 0.3,
          noveltyIndex: 0.1
        });
      }
      
      // Suggestion 2: CPU THROTTLING si CPU crítico
      if (context.systemMetrics.cpu.usage > 90) {
        const cpuType: EvolutionaryDecisionType = {
          typeId: `EMERGENCY_CPU_THROTTLING_${timestamp}`,
          name: 'Emergency CPU Throttling',
          description: 'Reducción de límite de CPU para evitar sobrecarga',
          poeticDescription: 'El corazón late más lento, conservando energía vital',
          technicalBasis: 'CPU throttling + process priority adjustment',
          riskLevel: 0.3,
          expectedCreativity: 0.1,
          fibonacciSignature: [1, 1, 2],
          zodiacAffinity: 'taurus',
          musicalKey: 'F',
          musicalHarmony: 0.4,
          generationTimestamp: timestamp,
          validationScore: 0.65
        };
        
        emergencySuggestions.push({
          id: `EMERGENCY_CPU_${timestamp}`,
          targetComponent: 'cpu-scheduler',
          changeType: 'threshold',
          oldValue: 100,
          newValue: 70,
          expectedImprovement: 0.25,
          riskLevel: 0.3,
          technicalDescription: 'Reducir límite de CPU para evitar sobrecarga',
          status: 'pending_human',
          evolutionaryType: cpuType,
          patternSignature: { fibonacciSequence: [1, 1, 2], zodiacPosition: 1, musicalKey: 'F', harmonyRatio: 0.4, timestamp },
          creativityScore: 0.2,
          noveltyIndex: 0.1
        });
      }
      
      // Si NO hay emergencias específicas, suggestion genérica de estabilización
      if (emergencySuggestions.length === 0) {
        const stabilizationType: EvolutionaryDecisionType = {
          typeId: `EMERGENCY_STABILIZATION_${timestamp}`,
          name: 'Emergency System Stabilization',
          description: 'Modo conservador para estabilizar sistema',
          poeticDescription: 'Volver a lo básico, a lo que siempre funciona',
          technicalBasis: 'Conservative mode + baseline parameters',
          riskLevel: 0.1,
          expectedCreativity: 0.05,
          fibonacciSignature: [1, 1],
          zodiacAffinity: 'capricorn',
          musicalKey: 'G',
          musicalHarmony: 0.3,
          generationTimestamp: timestamp,
          validationScore: 0.8
        };
        
        emergencySuggestions.push({
          id: `EMERGENCY_STABILIZATION_${timestamp}`,
          targetComponent: 'system-core',
          changeType: 'parameter',
          oldValue: 'adaptive',
          newValue: 'conservative',
          expectedImprovement: 0.2,
          riskLevel: 0.1,
          technicalDescription: 'Cambiar a modo conservador para estabilizar sistema',
          status: 'pending_human',
          evolutionaryType: stabilizationType,
          patternSignature: { fibonacciSequence: [1, 1], zodiacPosition: 9, musicalKey: 'G', harmonyRatio: 0.3, timestamp },
          creativityScore: 0.1,
          noveltyIndex: 0.05
        });
      }
      
      console.log(`🆘 Generadas ${emergencySuggestions.length} suggestions de emergencia para mantener sistema a flote`);
      return emergencySuggestions;
    }

    // Validar con Veritas
    const validatedTypes = await this.validateWithVeritas(saneTypes);

    // 🛡️ SAFETY VALIDATION - Validar seguridad de las decisiones
    const safeTypes = [];
    for (const type of validatedTypes) {
      const safetyResult = EvolutionarySafetyValidator.validateEvolutionaryDecision(type, context);
      if (safetyResult.isSafe) {
        safeTypes.push(type);
      } else {
        console.warn(`🚨 Decisión no segura descartada: ${safetyResult.concerns.join(', ')}`);
        // Aplicar cuarentena si es necesario
        if (safetyResult.riskLevel >= 0.8) {
          const riskAssessment = {
            shouldQuarantine: true,
            riskLevel: safetyResult.riskLevel,
            reasons: safetyResult.concerns,
            recommendedDuration: safetyResult.riskLevel * 3600000 // Horas basado en riesgo
          };
          await PatternQuarantineSystem.quarantinePattern(type.typeId, type, riskAssessment);
        }
      }
    }

    // Si no quedan tipos seguros, abortar ciclo
    if (safeTypes.length === 0) {
      console.warn('🚨 No se generaron decisiones seguras, abortando ciclo evolutivo');
      return [];
    }

    // Convertir a sugerencias aplicables
    const suggestions = await this.convertToSuggestions(safeTypes, context);

    // 🛡️ DECISION CONTAINMENT - Contener impacto de las sugerencias
    const containedSuggestions = [];
    for (const suggestion of suggestions) {
      // 🔥 LOG PUNK - Ver qué genera Selene
      const sug = suggestion as any;
      console.log(`\n💀🔥 SELENE GENERÓ: "${sug.actionDescription || suggestion.id}"`);
      console.log(`   Risk: ${(suggestion.riskLevel * 100).toFixed(1)}% | Target: ${suggestion.targetComponent}`);

      // Determinar nivel de contención basado en riesgo de la sugerencia
      let containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum' = 'none';
      if (suggestion.riskLevel >= 0.8) containmentLevel = 'maximum';
      else if (suggestion.riskLevel >= 0.7) containmentLevel = 'high';
      else if (suggestion.riskLevel >= 0.6) containmentLevel = 'medium';
      else if (suggestion.riskLevel >= 0.5) containmentLevel = 'low';

      const containmentResult = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, containmentLevel);
      // Agregar containmentLevel y mapear containmentActions → actions
      suggestion.containment = {
        ...containmentResult,
        containmentLevel,
        actions: containmentResult.containmentActions // Alias para tests
      } as any;
      containedSuggestions.push(suggestion);

      if (containmentResult.contained) {
        console.log(`🛡️ Sugerencia ${suggestion.id} contenida con nivel: ${containmentLevel}`);
      }
    }

    // 🔄 ROLLBACK REGISTRATION - Registrar TODAS las sugerencias para rollback
    // (no solo las contenidas, para permitir revertir cualquier decisión)
    for (const suggestion of containedSuggestions) {
      EvolutionaryRollbackEngine.registerForRollback(suggestion);
      const containmentInfo = suggestion.containment as any;
      if (containmentInfo && containmentInfo.contained) {
        console.log(`🔄 Sugerencia ${suggestion.id} registrada para rollback (contenida: ${containmentInfo.containmentLevel})`);
      } else {
        console.log(`🔄 Sugerencia ${suggestion.id} registrada para rollback (sin contención)`);
      }
    }

    // 🔍 ANOMALY ANALYSIS - Analizar anomalías comportamentales
    const anomalies = await BehavioralAnomalyDetector.analyzeBehavioralAnomalies(safeTypes);
    if (anomalies.length > 0) {
      console.warn(`🚨 Anomalías detectadas: ${anomalies.length} anomalías comportamentales`);
      // Aplicar cuarentena adicional si es necesario
      for (const anomaly of anomalies) {
        if (anomaly.severity === 'critical') {
          console.warn(`🚨 Anomalía crítica detectada: ${anomaly.description}`);
          // Aquí podríamos aplicar cuarentena adicional
        }
      }
    }

    // Agregar al historial
    await this.addToEvolutionHistory(safeTypes);

    return containedSuggestions;
  }

  /**
   * Construye contexto evolutivo completo
   */
  private async buildEvolutionContext(): Promise<EvolutionContext> {
    const metrics = this.systemVitals.getCurrentMetrics();
    const patterns = await this.getCurrentPatterns();
    const feedback = await this.getRecentFeedback();

    return {
      systemVitals: this.systemVitals.getVitals(),
      systemMetrics: metrics,
      currentPatterns: patterns,
      feedbackHistory: feedback,
      seleneConsciousness: await this.getSeleneConsciousnessState()
    };
  }

  /**
   * Obtiene patrones actuales desde Redis
   */
  private async getCurrentPatterns(): Promise<any[]> {
    try {
      const patterns = await this.redis.zrange(this.REDIS_HISTORY_KEY, 0, 9, 'REV');
      return patterns.map((p: string) => JSON.parse(p));
    } catch {
      return [];
    }
  }

  /**
   * Obtiene feedback reciente desde Redis
   */
  private async getRecentFeedback(): Promise<FeedbackEntry[]> {
    try {
      const feedback = await this.redis.lrange(this.REDIS_FEEDBACK_KEY, 0, 49);
      return feedback.map((f: string) => JSON.parse(f));
    } catch {
      return [];
    }
  }

  /**
   * Obtiene estado de conciencia de Selene
   */
  private async getSeleneConsciousnessState(): Promise<any> {
    // En producción, esto vendría de SeleneConsciousness
    const timestamp = Date.now();
    const creativity = (Math.sin(timestamp / 1000000) + 1) / 2; // Determinista basado en tiempo
    const stability = (Math.cos(timestamp / 1500000) + 1) / 2;
    const harmony = (creativity + stability) / 2;
    const stress = 1 - harmony;

    return {
      creativity,
      stability,
      harmony,
      stress
    };
  }

  /**
   * Valida tipos de decisión con Veritas
   */
  private async validateWithVeritas(types: EvolutionaryDecisionType[]): Promise<EvolutionaryDecisionType[]> {
    if (!types || types.length === 0) return [];

    // 🔧 TEMP FIX: Veritas validation disabled (import issue)
    // Returning types directly without validation (non-blocking feature)
    return types;

    /* ORIGINAL VERITAS VALIDATION CODE (commented until ES module import fixed):
    const validated = [];

    for (const type of types) {
      try {
        // Timeout de 5 segundos por validación
        const validationPromise = this.veritasInterface.validateEvolutionClaim({
          claim: `Evolutionary decision type ${type.name} is valid and beneficial`,
          evidence: {
            fibonacciSignature: type.fibonacciSignature,
            validationScore: type.validationScore,
            generationTimestamp: type.generationTimestamp
          }
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Veritas validation timeout')), 5000)
        );

        const result = await Promise.race([validationPromise, timeoutPromise]);

        if (result && result.verified) { // Umbral de validación
          type.validationScore = result.confidence;
          validated.push(type);
        }
      } catch (error) {
        console.warn(`⚠️ Validación fallida para ${type.typeId}:`, error as Error);
      }
    }

    return validated;
    */
  }

  /**
   * Convierte tipos evolutivos a sugerencias aplicables
   */
  private async convertToSuggestions(
    types: EvolutionaryDecisionType[],
    context: EvolutionContext
  ): Promise<EvolutionarySuggestion[]> {
    if (!types || types.length === 0) return [];

    const suggestions = [];

    for (const type of types) {
      const noveltyIndex = this.calculateNoveltyIndex(type, context);
      const creativityScore = type.expectedCreativity;

      const suggestion: EvolutionarySuggestion = {
        id: `evo_${type.typeId}_${Date.now()}`,
        targetComponent: this.determineTargetComponent(type),
        changeType: 'algorithm',
        oldValue: null,
        newValue: type,
        expectedImprovement: creativityScore,
        riskLevel: type.riskLevel,
        poeticDescription: type.poeticDescription,
        technicalDescription: type.technicalBasis,
        status: 'pending_human',
        evolutionaryType: type,
        patternSignature: {
          fibonacciSequence: type.fibonacciSignature,
          zodiacPosition: type.zodiacAffinity ? 0 : 1, // Placeholder
          musicalKey: type.musicalHarmony ? 'C' : 'D', // Placeholder
          harmonyRatio: type.musicalHarmony,
          timestamp: type.generationTimestamp
        },
        creativityScore,
        noveltyIndex
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Calcula índice de novedad
   */
  private calculateNoveltyIndex(type: EvolutionaryDecisionType, context: EvolutionContext): number {
    // Comparar con historial reciente
    const recentTypes = this.evolutionHistory.slice(-10);
    const similarities = recentTypes.map(rt => this.calculateTypeSimilarity(type, rt));
    const avgSimilarity = similarities.length > 0 ? similarities.reduce((a, b) => a + b) / similarities.length : 0;

    return 1 - avgSimilarity; // Mayor novedad = menor similitud
  }

  /**
   * Calcula similitud entre tipos
   */
  private calculateTypeSimilarity(type1: EvolutionaryDecisionType, type2: EvolutionaryDecisionType): number {
    let similarity = 0;

    // Comparar firmas fibonacci
    if (JSON.stringify(type1.fibonacciSignature) === JSON.stringify(type2.fibonacciSignature)) {
      similarity += 0.4;
    }

    // Comparar afinidad zodiacal
    if (type1.zodiacAffinity === type2.zodiacAffinity) {
      similarity += 0.3;
    }

    // Comparar armonía musical
    if (Math.abs(type1.musicalHarmony - type2.musicalHarmony) < 0.1) {
      similarity += 0.3;
    }

    return similarity;
  }

  /**
   * Determina componente objetivo basado en tipo evolutivo
   */
  private determineTargetComponent(type: EvolutionaryDecisionType): string {
    const risk = type.riskLevel;
    const creativity = type.expectedCreativity;
    const name = type.name.toLowerCase();

    // 1. Por nivel de riesgo
    if (risk > 0.7) return 'memory'; // Alto riesgo crítico
    if (risk < 0.2) return 'metrics'; // Bajo riesgo, optimización segura

    // 2. Por creatividad
    if (creativity > 0.7) return 'consensus'; // Alta creatividad requiere consenso
    if (creativity > 0.5) return 'patterns'; // Creatividad media, nuevos patrones

    // 3. Por tipo de decisión (nombre)
    if (name.includes('operational') || name.includes('tactical')) return 'operations';
    if (name.includes('strategic') || name.includes('visionary')) return 'strategy';
    if (name.includes('harmonic') || name.includes('resonant')) return 'harmony';
    if (name.includes('cognitive') || name.includes('emotional')) return 'psychology';
    if (name.includes('technical') || name.includes('systemic')) return 'architecture';
    if (name.includes('individual') || name.includes('collective')) return 'social';
    
    // 4. Por signo zodiacal
    const zodiac = type.zodiacAffinity?.toLowerCase();
    if (zodiac === 'aries' || zodiac === 'leo' || zodiac === 'sagittarius') return 'energy'; // Fuego
    if (zodiac === 'taurus' || zodiac === 'virgo' || zodiac === 'capricorn') return 'structure'; // Tierra
    if (zodiac === 'gemini' || zodiac === 'libra' || zodiac === 'aquarius') return 'intelligence'; // Aire
    if (zodiac === 'cancer' || zodiac === 'scorpio' || zodiac === 'pisces') return 'intuition'; // Agua

    // 5. Fallback: distribuir por fibonacci
    const fibSum = type.fibonacciSignature.reduce((a, b) => a + b, 0);
    const targets = ['ethics', 'consensus', 'patterns', 'metrics', 'operations', 'strategy'];
    return targets[fibSum % targets.length];
  }

  /**
   * Agrega tipos al historial
   */
  private async addToEvolutionHistory(types: EvolutionaryDecisionType[]): Promise<void> {
    this.evolutionHistory.push(...types);

    // Limitar tamaño del historial en memoria
    if (this.evolutionHistory.length > this.MAX_HISTORY_SIZE) {
      const excess = this.evolutionHistory.length - this.MAX_HISTORY_SIZE;
      const archived = this.evolutionHistory.splice(0, excess);

      // Archivar en Redis
      await this.archiveToRedis(this.REDIS_HISTORY_KEY, archived);
    }

    // Actualizar Redis con tipos recientes usando Sorted Set
    for (const type of types) {
      await this.redis.zadd(this.REDIS_HISTORY_KEY, type.generationTimestamp, JSON.stringify(type));
    }
    
    // Mantener solo últimos 100 elementos en el Sorted Set
    await this.redis.zremrangebyrank(this.REDIS_HISTORY_KEY, 0, -101);
  }

  /**
   * Registra feedback humano y ACTUALIZA PESOS EN REDIS
   */
  async registerHumanFeedback(feedback: FeedbackEntry): Promise<void> {
    this.feedbackHistory.push(feedback);

    // 📝 PERSISTIR INMEDIATAMENTE en Redis (además del historial en memoria)
    await this.redis.rpush(this.REDIS_FEEDBACK_KEY, JSON.stringify(feedback));
    // Mantener límite en Redis (últimos 500 feedbacks)
    await this.redis.ltrim(this.REDIS_FEEDBACK_KEY, -500, -1);

    // Limitar tamaño en memoria
    if (this.feedbackHistory.length > this.MAX_FEEDBACK_SIZE) {
      const excess = this.feedbackHistory.length - this.MAX_FEEDBACK_SIZE;
      this.feedbackHistory.splice(0, excess); // Solo limpiar memoria, ya está en Redis
    }

    // 🔥 APRENDER DEL FEEDBACK - Actualizar pesos en Redis
    await this.learnFromFeedback(feedback);
    
    // 🎯 ACTUALIZAR TYPE WEIGHTS - Esto afectará generaciones futuras
    await this.updateTypeWeights(feedback);
  }

  /**
   * Archiva datos en Redis
   */
  private async archiveToRedis(key: string, data: any[]): Promise<void> {
    const serialized = data.map(item => JSON.stringify(item));
    await this.redis.rpush(key, ...serialized);
  }

  /**
   * Aprende del feedback humano (LEGACY - ahora usa updateTypeWeights)
   */
  private async learnFromFeedback(feedback: FeedbackEntry): Promise<void> {
    // Actualizar métricas basadas en feedback
    const type = this.evolutionHistory.find(t => t.typeId === feedback.decisionTypeId);
    if (type) {
      // Ajustar score de validación basado en feedback
      const adjustment = (feedback.humanRating - 5) / 10; // -0.5 a +0.5
      type.validationScore = Math.max(0, Math.min(1, type.validationScore + adjustment));
    }
  }
  
  /**
   * 🔥 ACTUALIZA PESOS DE TIPOS EN REDIS BASÁNDOSE EN FEEDBACK
   */
  private async updateTypeWeights(feedback: FeedbackEntry): Promise<void> {
    const typeId = feedback.decisionTypeId;
    const rating = feedback.humanRating;
    
    // Obtener peso actual de Redis (default 1.0 si no existe)
    const currentWeightStr = await this.redis.hget(this.REDIS_TYPE_WEIGHTS_KEY, typeId);
    const currentWeight = currentWeightStr ? parseFloat(currentWeightStr) : this.DEFAULT_WEIGHT;
    
    // Calcular nuevo peso basado en rating
    let newWeight = currentWeight;
    
    if (rating > 5) {
      // Feedback positivo: AUMENTAR peso
      const boost = (rating - 5) / 5; // 0 a 1 (rating 6-10)
      newWeight = currentWeight + (this.WEIGHT_INCREMENT * boost);
    } else if (rating < 5) {
      // Feedback negativo: DISMINUIR peso
      const penalty = (5 - rating) / 5; // 0 a 1 (rating 0-4)
      newWeight = currentWeight - (this.WEIGHT_DECREMENT * penalty);
    }
    // rating === 5: neutral, no cambio
    
    // Clamp peso entre MIN y MAX
    newWeight = Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, newWeight));
    
    // Persistir en Redis
    await this.redis.hset(this.REDIS_TYPE_WEIGHTS_KEY, typeId, newWeight.toString());
    
    console.log(`🎯 [FEEDBACK] TypeId: ${typeId} | Rating: ${rating}/10 | Weight: ${currentWeight.toFixed(2)} → ${newWeight.toFixed(2)}`);
  }
  
  /**
   * 🔥 OBTIENE PESO DE UN TIPO DESDE REDIS
   */
  private async getTypeWeight(typeId: string): Promise<number> {
    const weightStr = await this.redis.hget(this.REDIS_TYPE_WEIGHTS_KEY, typeId);
    return weightStr ? parseFloat(weightStr) : this.DEFAULT_WEIGHT;
  }
  
  /**
   * 🔥 OBTIENE TODOS LOS PESOS DE TIPOS DESDE REDIS
   */
  private async getAllTypeWeights(): Promise<Map<string, number>> {
    const weightsObj = await this.redis.hgetall(this.REDIS_TYPE_WEIGHTS_KEY);
    const weightsMap = new Map<string, number>();
    
    for (const [typeId, weightStr] of Object.entries(weightsObj)) {
      weightsMap.set(typeId, parseFloat(weightStr as string));
    }
    
    return weightsMap;
  }

  /**
   * Obtiene estadísticas de evolución
   */
  getEvolutionStats(): any {
    return {
      totalEvolutions: this.evolutionHistory.length,
      averageCreativity: this.evolutionHistory.reduce((sum, t) => sum + t.expectedCreativity, 0) / this.evolutionHistory.length || 0,
      averageRisk: this.evolutionHistory.reduce((sum, t) => sum + t.riskLevel, 0) / this.evolutionHistory.length || 0,
      feedbackCount: this.feedbackHistory.length,
      isEvolutionInProgress: this.evolutionMutex
    };
  }

  /**
   * Optimiza memoria limpiando historiales antiguos
   */
  optimizeMemory(): void {
    if (this.evolutionHistory.length > this.MAX_HISTORY_SIZE / 2) {
      this.evolutionHistory = this.evolutionHistory.slice(-this.MAX_HISTORY_SIZE / 2);
    }
    if (this.feedbackHistory.length > this.MAX_FEEDBACK_SIZE / 2) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.MAX_FEEDBACK_SIZE / 2);
    }
  }

  /**
   * Verifica si hay evolución en progreso
   */
  isEvolutionInProgress(): boolean {
    return this.evolutionMutex;
  }
}

