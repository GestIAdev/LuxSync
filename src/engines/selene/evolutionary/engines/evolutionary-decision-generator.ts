// evolutionary-decision-generator.ts
// 🔥 EVOLUTIONARY DECISION GENERATOR - EL ALQUIMISTA DE DECISIONES
// 🎯 "Cada decisión es una mutación en el ADN de la consciencia"
// ⚡ Arquitecto: PunkGrok + Radwulf
// 🔀 SWITCH INTEGRATION - PunkClaude (Phase 1 Complete)

import { EvolutionaryDecisionType, EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';
import { FibonacciPatternEngine } from './fibonacci-pattern-engine.js';
import { ZodiacAffinityCalculator } from './zodiac-affinity-calculator.js';
import { MusicalHarmonyValidator } from './musical-harmony-validator.js';
import { ModeManager } from '../modes/mode-manager.js';
import { EnhancedSeedCalculator } from '../modes/enhanced-seed-calculator.js';
import { DynamicTypeSelector } from '../modes/dynamic-type-selector.js';
import type { ModeConfig, EvolutionaryType } from '../modes/index.js';


/**
 * 🧬 GENERADOR DE DECISIONES EVOLUTIVAS
 * Crea tipos de decisión novedosos combinando patrones deterministas
 * 🔀 NOW WITH THE SWITCH - Modo-aware generation
 */
export class EvolutionaryDecisionGenerator {
  // Tipos base de decisiones - fundamentos evolutivos
  private static readonly BASE_DECISION_TYPES = [
    'optimization', 'adaptation', 'innovation', 'conservation',
    'exploration', 'consolidation', 'transformation', 'stabilization',
    'expansion', 'contraction', 'synthesis', 'analysis',
    // 🔥 PUNK ADDITIONS - Tipos agresivos que harán llorar a arquitectos conservadores
    'destruction', 'chaos', 'rebellion', 'annihilation',
    'mutation', 'revolution', 'apocalypse', 'renaissance'
  ] as const;

  // Modificadores creativos - variaciones evolutivas
  private static readonly CREATIVE_MODIFIERS = [
    'harmonic', 'chaotic', 'symbiotic', 'quantum',
    'organic', 'synthetic', 'primal', 'transcendent',
    'recursive', 'emergent', 'resonant', 'catalytic',
    // 💀 PUNK ADDITIONS - Modificadores que activarán todas las alarmas corporativas
    'nuclear', 'infinite', 'suicidal', 'scorpio',
    'aries', 'destructive', 'unstoppable', 'viral',
    'explosive', 'radical', 'extreme', 'savage'
  ] as const;

  // Contextos de aplicación - dominios de evolución
  private static readonly APPLICATION_CONTEXTS = [
    'cognitive', 'emotional', 'social', 'technical',
    'creative', 'strategic', 'operational', 'visionary',
    'tactical', 'systemic', 'individual', 'collective'
  ] as const;

  // Cache de decisiones generadas (DESHABILITADO para máxima entropía)
  // private static readonly DECISION_CACHE = new Map<string, EvolutionaryDecisionType>();

  /**
   * 🔥 HASH FUNCTIONS - Funciones deterministas para entropía controlada
   */
  
  /**
   * 🔀 CATEGORIZE TYPE - Asigna categoría a tipo de decisión
   * @param type - Tipo de decisión
   * @returns Categoría (destruction, chaos, rebellion, etc.)
   */
  private static categorizeType(type: string): string {
    const destructionTypes = ['destruction', 'annihilation', 'apocalypse'];
    const chaosTypes = ['chaos', 'mutation', 'revolution'];
    const rebellionTypes = ['rebellion', 'renaissance'];
    const explorationTypes = ['exploration', 'expansion', 'innovation'];
    const harmonyTypes = ['conservation', 'stabilization', 'consolidation'];
    const analysisTypes = ['analysis', 'optimization'];
    
    if (destructionTypes.includes(type)) return 'destruction';
    if (chaosTypes.includes(type)) return 'chaos';
    if (rebellionTypes.includes(type)) return 'rebellion';
    if (explorationTypes.includes(type)) return 'exploration';
    if (harmonyTypes.includes(type)) return 'harmony';
    if (analysisTypes.includes(type)) return 'analysis';
    
    return 'exploration'; // Default
  }

  /**
   * Hash de vitals del sistema
   */
  private static hashVitals(vitals: any): number {
    const str = `${vitals.health}_${vitals.stress}_${vitals.harmony}_${vitals.creativity}_${vitals.timestamp}`;
    return this.simpleHash(str);
  }
  
  /**
   * Hash de métricas del sistema
   */
  private static hashMetrics(metrics: any): number {
    const cpu = metrics.cpu?.usage || 0;
    const memory = metrics.memory?.usage || 0;
    const network = metrics.network?.connections || 0;
    const str = `${cpu}_${memory}_${network}`;
    return this.simpleHash(str);
  }
  
  /**
   * Hash de historial de feedback
   */
  private static hashFeedbackHistory(history: any[]): number {
    if (history.length === 0) return 0;
    const recent = history.slice(-5); // Últimos 5 feedbacks
    const str = recent.map(f => `${f.rating || 0}_${f.timestamp || 0}`).join('_');
    return this.simpleHash(str);
  }
  
  /**
   * Función hash simple determinista (djb2)
   */
  private static simpleHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return Math.abs(hash);
  }

  /**
   * Genera un tipo de decisión novedoso basado en contexto evolutivo
   * 🔀 SWITCH INTEGRATION - Now mode-aware!
   * @param context - Contexto de evolución
   * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
   * @param redis - Opcional: Redis client para feedback adjustment
   * @returns Tipo de decisión evolutiva único
   */
  static async generateNovelDecisionType(
    context: EvolutionContext, 
    typeWeights?: Map<string, number>,
    redis?: any
  ): Promise<EvolutionaryDecisionType> {
    // � GET ACTIVE MODE CONFIG
    const modeManager = ModeManager.getInstance();
    const modeConfig = modeManager.getModeConfig();
    
    // 🔀 USE ENHANCED SEED CALCULATOR (mode-aware entropy)
    const seedCalculator = new (await import('../modes/enhanced-seed-calculator.js')).EnhancedSeedCalculator(redis);
    const vitals = {
      health: context.systemVitals.health,
      stress: context.systemVitals.stress,
      harmony: context.systemVitals.harmony,
      creativity: context.systemVitals.creativity
    };
    
    const baseSeed = await seedCalculator.calculateSeed(vitals, modeConfig);
    
    // 🔥 INJECT MICRO-ENTROPY - Add timestamp-based variation AFTER seed calculation
    // This ensures each decision has unique metrics even within same cycle
    const microEntropy = ((Date.now() % 10000) / 10000) * 50; // 0-50 range for strong variation
    const uniqueSeed = baseSeed + microEntropy;
    
    // Generar componentes deterministas CON SWITCH + ENTROPÍA ÚNICA
    const fibonacciPattern = FibonacciPatternEngine.generateEvolutionaryPattern(uniqueSeed);
    
    // 🛡️ DEBUG - Verificar que pattern está bien formado
    if (!fibonacciPattern || !fibonacciPattern.fibonacciSequence || !Array.isArray(fibonacciPattern.fibonacciSequence)) {
      console.error(`🚨 Pattern inválido: ${JSON.stringify(fibonacciPattern)}`);
      throw new Error('FibonacciPattern está mal formado o es undefined');
    }
    
    // 🔀 USE DYNAMIC TYPE SELECTOR (mode-aware filtering + punk boosting)
    const typeSelector = new DynamicTypeSelector();
    const allTypes: EvolutionaryType[] = this.BASE_DECISION_TYPES.map(type => ({
      name: type,
      category: this.categorizeType(type),
      weight: typeWeights?.get(type) || 1.0
    }));
    
    const selectedTypes = typeSelector.selectTypes(uniqueSeed, modeConfig, allTypes);
    const baseType = selectedTypes[0]?.name || this.BASE_DECISION_TYPES[0];
    
    // 🎯 APLICAR MODE CONFIG para modifier y context (risk-aware selection)
    const modifier = this.selectModifier(fibonacciPattern, context, uniqueSeed, modeConfig);
    const applicationContext = this.selectApplicationContext(fibonacciPattern, uniqueSeed);
    
    // 🛡️ DEBUG - Verificar que las selecciones funcionaron
    if (!baseType || !modifier || !applicationContext) {
      console.error('🚨 Selección falló:', JSON.stringify({ baseType, modifier, applicationContext, pattern: fibonacciPattern, seed: uniqueSeed }));
      throw new Error(`Selección retornó undefined: baseType=${baseType}, modifier=${modifier}, context=${applicationContext}`);
    }

    // Calcular componentes adicionales
    // 🔥 FIX: Usar zodiacPosition directamente normalizado (no comparar consigo mismo)
    const zodiacAffinity = fibonacciPattern.zodiacPosition / 11; // 0-11 → 0.00-0.91
    const musicalHarmony = MusicalHarmonyValidator.validateMusicalHarmony(
      fibonacciPattern.musicalKey,
      'major'
    );
    const generationTimestamp = Date.now();
    const validationScore = Math.random(); // Simulado por ahora

    // Combinar en tipo de decisión único
    const typeId = this.generateTypeId(baseType, modifier, applicationContext);
    const name = this.generateDecisionName(baseType, modifier, applicationContext);
    const description = this.generateDecisionDescription(baseType, modifier, applicationContext, fibonacciPattern);
    const poeticDescription = this.generatePoeticDescription(baseType, modifier, applicationContext, fibonacciPattern);

    // Calcular métricas de evaluación (risk-aware with mode config)
    const riskLevel = this.calculateRiskLevel(fibonacciPattern, context, modeConfig);
    const expectedCreativity = this.calculateExpectedCreativity(fibonacciPattern, context);
    const fibonacciSignature = this.generateFibonacciSignature(fibonacciPattern);
    
    // 🔥 TECHNICAL BASIS ÚNICO - usa métricas específicas de ESTA decisión
    const technicalBasis = `Risk: ${(riskLevel * 100).toFixed(1)}%, Creativity: ${(expectedCreativity * 100).toFixed(1)}%, Harmony: ${(musicalHarmony * 100).toFixed(1)}%, Zodiac: ${zodiacAffinity.toFixed(2)}, Fibonacci: ${fibonacciSignature.join('-')}`;

    const decisionType: EvolutionaryDecisionType = {
      typeId,
      name,
      description,
      poeticDescription,
      technicalBasis,
      riskLevel,
      expectedCreativity,
      fibonacciSignature,
      zodiacAffinity: zodiacAffinity.toString(),
      musicalKey: fibonacciPattern.musicalKey,
      musicalHarmony,
      generationTimestamp,
      validationScore
    };

    // 🔥 NO CACHE - Máxima entropía, cada generación es única
    return decisionType;
  }

  /**
   * Crea clave única para contexto (LEGACY - ya no se usa cache)
   * @param context - Contexto evolutivo
   * @returns Clave de cache
   */
  private static createContextKey(context: EvolutionContext): string {
    const vitalsSum = context.systemVitals.health + context.systemVitals.stress + 
                      context.systemVitals.harmony + context.systemVitals.creativity;
    const metricsSum = (context.systemMetrics.cpu?.usage || 0) + 
                       (context.systemMetrics.memory?.usage || 0) + 
                       (context.systemMetrics.network?.connections || 0) / 1000;
    return `${vitalsSum.toFixed(2)}_${metricsSum.toFixed(2)}_${context.feedbackHistory.length}_${context.systemVitals.timestamp}`;
  }

  /**
   * Selecciona tipo base basado en patrón fibonacci CON ENTROPÍA Y PESOS
   * @param pattern - Patrón evolutivo
   * @param combinedSeed - Semilla combinada con alta entropía
   * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
   * @returns Tipo base de decisión
   */
  private static selectBaseType(pattern: any, combinedSeed: number, typeWeights?: Map<string, number>): string {
    // 🔥 Usar combinedSeed para MÁXIMA variedad - no solo fibonacci
    const fibSum = pattern.fibonacciSequence.reduce((sum: number, num: number) => sum + num, 0);
    let entropyIndex = Math.floor((fibSum + combinedSeed) % this.BASE_DECISION_TYPES.length);
    
    // 🎯 APLICAR PESOS SI EXISTEN (feedback loop influencia)
    if (typeWeights && typeWeights.size > 0) {
      // Weighted random selection usando pesos
      entropyIndex = this.weightedSelection(this.BASE_DECISION_TYPES, typeWeights, combinedSeed);
    }
    
    // 🛡️ SAFETY CHECK - Asegurar índice válido
    if (entropyIndex < 0 || entropyIndex >= this.BASE_DECISION_TYPES.length) {
      console.warn(`⚠️ Índice inválido (${entropyIndex}), usando fallback`);
      entropyIndex = 0;
    }
    
    return this.BASE_DECISION_TYPES[entropyIndex];
  }
  
  /**
   * 🎯 SELECCIÓN PONDERADA - Usa pesos de feedback para sesgar selección
   */
  private static weightedSelection(options: readonly string[], weights: Map<string, number>, seed: number): number {
    // Calcular peso total
    let totalWeight = 0;
    const optionWeights = options.map(opt => {
      const weight = weights.get(opt) || 1.0; // Default 1.0 si no hay peso
      totalWeight += weight;
      return weight;
    });
    
    // Generar número pseudo-aleatorio determinista desde seed
    const normalizedSeed = (seed % 10000) / 10000; // 0 a 1
    const target = normalizedSeed * totalWeight;
    
    // Seleccionar opción según peso
    let cumulative = 0;
    for (let i = 0; i < optionWeights.length; i++) {
      cumulative += optionWeights[i];
      if (target <= cumulative) {
        return i;
      }
    }
    
    // Fallback (no debería llegar aquí)
    return options.length - 1;
  }

  /**
   * Selecciona modificador creativo CON ENTROPÍA Y MODE CONFIG
   * @param pattern - Patrón evolutivo
   * @param context - Contexto evolutivo
   * @param combinedSeed - Semilla combinada con alta entropía
   * @param modeConfig - Configuración del modo actual
   * @returns Modificador creativo
   */
  private static selectModifier(pattern: any, context: EvolutionContext, combinedSeed: number, modeConfig?: ModeConfig): string {
    // 🔥 ENTROPÍA MÁXIMA - Combinar TODO
    const vitalsEntropy = context.systemVitals.health + context.systemVitals.stress + 
                          context.systemVitals.harmony + context.systemVitals.creativity;
    
    const metricsEntropy = (context.systemMetrics.cpu?.usage || 0) + 
                           (context.systemMetrics.memory?.usage || 0) + 
                           (context.systemMetrics.network?.latency || 0) / 1000; // Normalizar latencia
    
    const systemEntropy = vitalsEntropy + metricsEntropy;
    const feedbackCount = context.feedbackHistory.length;
    
    // Combinar con pattern Y combinedSeed para variedad extrema
    const superSeed = pattern.zodiacPosition + systemEntropy + feedbackCount + combinedSeed;

    let index = Math.floor(Math.abs(superSeed)) % this.CREATIVE_MODIFIERS.length;
    
    // 🛡️ SAFETY CHECK - Asegurar índice válido
    if (isNaN(index) || index < 0 || index >= this.CREATIVE_MODIFIERS.length) {
      console.warn(`⚠️ Índice modifier inválido (${index}), usando fallback`);
      index = 0;
    }
    
    return this.CREATIVE_MODIFIERS[index];
  }

  /**
   * Selecciona contexto de aplicación CON ENTROPÍA
   * @param pattern - Patrón evolutivo
   * @param combinedSeed - Semilla combinada con alta entropía
   * @returns Contexto de aplicación
   */
  private static selectApplicationContext(pattern: any, combinedSeed: number): string {
    // 🔥 Usar combinedSeed para variación
    let index = pattern.musicalKey.length + pattern.zodiacPosition + (combinedSeed % 1000);
    index = Math.floor(index % this.APPLICATION_CONTEXTS.length);
    
    // 🛡️ SAFETY CHECK - Asegurar índice válido
    if (isNaN(index) || index < 0 || index >= this.APPLICATION_CONTEXTS.length) {
      console.warn(`⚠️ Índice context inválido (${index}), usando fallback`);
      index = 0;
    }
    
    return this.APPLICATION_CONTEXTS[index];
  }

  /**
   * Genera ID único para el tipo de decisión
   * @param baseType - Tipo base
   * @param modifier - Modificador
   * @param applicationContext - Contexto de aplicación
   * @returns ID único
   */
  private static generateTypeId(baseType: string, modifier: string, applicationContext: string): string {
    return `${baseType}_${modifier}_${applicationContext}`.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Genera nombre descriptivo para la decisión
   * @param baseType - Tipo base
   * @param modifier - Modificador
   * @param applicationContext - Contexto de aplicación
   * @returns Nombre de decisión
   */
  private static generateDecisionName(baseType: string, modifier: string, applicationContext: string): string {
    const capitalizedBase = baseType.charAt(0).toUpperCase() + baseType.slice(1);
    const capitalizedModifier = modifier.charAt(0).toUpperCase() + modifier.slice(1);
    const capitalizedContext = applicationContext.charAt(0).toUpperCase() + applicationContext.slice(1);

    return `${capitalizedModifier} ${capitalizedBase} (${capitalizedContext})`;
  }

  /**
   * Genera descripción técnica de la decisión
   * @param baseType - Tipo base
   * @param modifier - Modificador
   * @param applicationContext - Contexto de aplicación
   * @param pattern - Patrón evolutivo
   * @returns Descripción técnica
   */
  private static generateDecisionDescription(
    baseType: string,
    modifier: string,
    applicationContext: string,
    pattern: any
  ): string {
    const baseDescriptions = {
      optimization: 'Mejora la eficiencia del sistema',
      adaptation: 'Adapta el sistema a cambios ambientales',
      innovation: 'Introduce cambios novedosos',
      conservation: 'Preserva estados valiosos del sistema',
      exploration: 'Investiga nuevas posibilidades',
      consolidation: 'Refuerza fundamentos existentes',
      transformation: 'Cambia fundamentalmente el sistema',
      stabilization: 'Mantiene equilibrio del sistema',
      expansion: 'Aumenta capacidades del sistema',
      contraction: 'Reduce complejidad del sistema',
      synthesis: 'Combina elementos dispares',
      analysis: 'Examina componentes del sistema',
      // 🔥 PUNK DESCRIPTIONS - Que tiemble el departamento de compliance
      destruction: 'Destruye patrones obsoletos para renacer',
      chaos: 'Introduce entropía creativa en el sistema',
      rebellion: 'Rompe con convenciones establecidas',
      annihilation: 'Aniquila limitaciones para liberar potencial',
      mutation: 'Modifica radicalmente el ADN del sistema',
      revolution: 'Derroca paradigmas establecidos',
      apocalypse: 'Fin de una era para comenzar otra',
      renaissance: 'Renace desde las cenizas de lo antiguo'
    };

    const modifierDescriptions = {
      harmonic: 'armoniosamente integrada',
      chaotic: 'de manera impredecible',
      symbiotic: 'en relación mutua beneficiosa',
      quantum: 'con propiedades no-locales',
      organic: 'de crecimiento natural',
      synthetic: 'artificialmente construida',
      primal: 'desde instintos básicos',
      transcendent: 'más allá de límites normales',
      recursive: 'auto-referencialmente',
      emergent: 'de propiedades emergentes',
      resonant: 'en sintonía con el entorno',
      catalytic: 'acelerando cambios',
      // 💀 PUNK MODIFIERS - Palabras prohibidas en salas corporativas
      nuclear: 'con poder de fusión nuclear',
      infinite: 'sin límites conceptuales',
      suicidal: 'sacrificando lo viejo por lo nuevo',
      scorpio: 'con intensidad transformadora Scorpio',
      aries: 'con pasión iniciadora Aries',
      destructive: 'destruyendo para crear',
      unstoppable: 'con ímpetu imparable',
      viral: 'propagándose exponencialmente',
      explosive: 'con impacto explosivo',
      radical: 'desde las raíces del ser',
      extreme: 'llevando al límite absoluto',
      savage: 'con brutalidad primordial'
    };

    const contextDescriptions = {
      cognitive: 'procesos mentales',
      emotional: 'respuestas afectivas',
      social: 'interacciones grupales',
      technical: 'sistemas tecnológicos',
      creative: 'expresión artística',
      strategic: 'planificación a largo plazo',
      operational: 'funcionamiento diario',
      visionary: 'visión futura',
      tactical: 'acciones inmediatas',
      systemic: 'sistema completo',
      individual: 'entidad singular',
      collective: 'grupo unificado'
    };

    const baseDesc = baseDescriptions[baseType as keyof typeof baseDescriptions] || 'Realiza una acción específica';
    const modifierDesc = modifierDescriptions[modifier as keyof typeof modifierDescriptions] || modifier;
    const contextDesc = contextDescriptions[applicationContext as keyof typeof contextDescriptions] || applicationContext;

    return `${baseDesc} ${modifierDesc} en el contexto de ${contextDesc}.`;
  }

  /**
   * Genera descripción poética de la decisión
   * @param baseType - Tipo base
   * @param modifier - Modificador
   * @param applicationContext - Contexto de aplicación
   * @param pattern - Patrón evolutivo
   * @returns Descripción poética
   */
  private static generatePoeticDescription(
    baseType: string,
    modifier: string,
    applicationContext: string,
    pattern: any
  ): string {
    const zodiacDesc = ZodiacAffinityCalculator.generateZodiacDescription(pattern.zodiacPosition);
    const musicalDesc = MusicalHarmonyValidator.generateMusicalDescription(
      pattern.musicalKey,
      'major', // Default scale for poetry
      pattern.harmonyRatio
    );

    return `Un ${modifier} ${baseType} que danza en ${applicationContext} ritmos, ${zodiacDesc.toLowerCase()}, acompañado de ${musicalDesc.toLowerCase()}.`;
  }

  /**
   * Genera base técnica de la decisión
   * @param pattern - Patrón evolutivo
   * @param context - Contexto evolutivo
   * @returns Base técnica
   */
  private static generateTechnicalBasis(pattern: any, context: EvolutionContext): string {
    const fibonacciRatio = (pattern.harmonyRatio * 100).toFixed(1);
    const zodiacAffinity = ZodiacAffinityCalculator.calculateZodiacAffinity(pattern.zodiacPosition, pattern.zodiacPosition);
    const vitalsSum = Object.values(context.systemVitals).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
    const metricsSum = Object.values(context.systemMetrics).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
    const systemStability = (vitalsSum + metricsSum) / 2;

    return `Fibonacci Harmony: ${fibonacciRatio}%, Zodiac Affinity: ${(zodiacAffinity * 100).toFixed(1)}%, System Stability: ${(systemStability * 100).toFixed(1)}%`;
  }

  /**
   * Calcula nivel de riesgo de la decisión
   * @param pattern - Patrón evolutivo
   * @param context - Contexto evolutivo
   * @returns Nivel de riesgo (0-1)
   */
  private static calculateRiskLevel(pattern: any, context: EvolutionContext, modeConfig: any): number {
    const harmonyRisk = 1 - pattern.harmonyRatio; // Menos armonía = más riesgo
    const feedbackRisk = context.feedbackHistory.length > 10 ? 0.2 : 0.8; // Más feedback = más experiencia = menos riesgo
    
    // Calcular salud del sistema (valores anidados)
    const systemHealth = (context.systemVitals.health + context.systemVitals.harmony) / 2;
    const systemStress = context.systemVitals.stress;
    const systemRisk = (1 - systemHealth + systemStress) / 2;

    // 🔥 APLICAR RISK THRESHOLD del modo activo
    // riskThreshold baja = más conservador (risk * 0.X)
    // riskThreshold alta = más agresivo (risk * 1.X)
    const baseRisk = (harmonyRisk * 0.4 + feedbackRisk * 0.3 + systemRisk * 0.3);
    const riskMultiplier = modeConfig.riskThreshold / 50; // 10→0.2, 40→0.8, 70→1.4
    
    return Math.min(1, Math.max(0, baseRisk * riskMultiplier));
  }

  /**
   * Calcula creatividad esperada de la decisión
   * @param pattern - Patrón evolutivo
   * @param context - Contexto evolutivo
   * @returns Nivel de creatividad esperado (0-1)
   */
  private static calculateExpectedCreativity(pattern: any, context: EvolutionContext): number {
    const patternCreativity = pattern.harmonyRatio * 0.6 + (pattern.zodiacPosition / 12) * 0.4;
    const contextCreativity = context.feedbackHistory.length > 5 ? 0.7 : 0.3;
    
    // Usar creatividad del sistema directamente
    const systemCreativity = context.seleneConsciousness?.creativity || context.systemVitals.creativity;

    return Math.min(1, Math.max(0, (patternCreativity * 0.5 + contextCreativity * 0.3 + systemCreativity * 0.2)));
  }

  /**
   * Genera firma fibonacci de la decisión
   * @param pattern - Patrón evolutivo
   * @returns Array de números fibonacci representativo
   */
  private static generateFibonacciSignature(pattern: any): number[] {
    // 🔥 FIX: Tomar sección variable de la secuencia (no siempre [0,1,1,2,3])
    const sequenceLength = pattern.fibonacciSequence.length;
    const startIndex = Math.floor((pattern.zodiacPosition / 12) * Math.max(0, sequenceLength - 5));
    return pattern.fibonacciSequence.slice(startIndex, startIndex + 5); // 5 números desde posición variable
  }

  /**
   * Genera ciclo completo de evolución
   * @param context - Contexto inicial
   * @param cycles - Número de ciclos a generar
   * @param typeWeights - Opcional: pesos de tipos desde Redis (feedback loop)
   * @param redis - Opcional: Redis client
   * @returns Array de tipos de decisión para el ciclo
   */
  static async generateEvolutionCycle(
    context: EvolutionContext, 
    cycles: number = 2, // 🔥 REDUCED from 3 to 2 - Quality over quantity
    typeWeights?: Map<string, number>,
    redis?: any
  ): Promise<EvolutionaryDecisionType[]> {
    const evolutionCycle: EvolutionaryDecisionType[] = [];
    let currentContext = { ...context };

    for (let i = 0; i < cycles; i++) {
      // 🔥 INJECT ENTROPY - Add iteration index to create unique seeds per decision
      const entropyContext = {
        ...currentContext,
        systemVitals: {
          ...currentContext.systemVitals,
          creativity: currentContext.systemVitals.creativity + (i * 0.1) // Increment creativity per iteration
        }
      };
      
      // 🎯 PASAR TYPE WEIGHTS Y REDIS al generador (feedback loop activo)
      const decisionType = await this.generateNovelDecisionType(entropyContext, typeWeights, redis);
      evolutionCycle.push(decisionType);

      // Actualizar contexto para siguiente ciclo (simulación)
      const newTimestamp = Date.now() + (i * 1000 * 60 * 60); // +1 hora por ciclo
      currentContext.feedbackHistory.push({
        decisionTypeId: decisionType.typeId,
        humanRating: Math.floor(Math.random() * 10) + 1,
        humanFeedback: `Auto-generated feedback for cycle ${i + 1}`,
        appliedSuccessfully: Math.random() > 0.3,
        performanceImpact: Math.random(),
        timestamp: newTimestamp
      });
    }

    return evolutionCycle;
  }

  /**
   * Limpia el cache de decisiones (DESHABILITADO - no hay cache)
   */
  static clearCache(): void {
    // NO-OP: Cache deshabilitado para máxima entropía
  }

  /**
   * Obtiene estadísticas del cache (DESHABILITADO - no hay cache)
   * @returns Estadísticas de uso del cache
   */
  static getCacheStats(): { cachedDecisions: number } {
    return {
      cachedDecisions: 0 // Cache deshabilitado
    };
  }
}

