/**
 * ⚡ WAVE 667: FUZZY DECISION MAKER
 * ═══════════════════════════════════════════════════════════════════════════
 * "La Consciencia Borrosa de Selene"
 * 
 * Porque el universo no es binario, coño.
 * Un drop no es "drop" o "no-drop". Es 0.87 drop, 0.12 buildup, 0.01 verse.
 * 
 * ARQUITECTURA:
 * 
 *   Crisp Inputs (números)
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │  FUZZIFY     │ ← Convertir a membership grades (0-1 por categoría)
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ RULE ENGINE  │ ← Evaluar TODAS las reglas difusas
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ DEFUZZIFY    │ ← Agregar outputs → Decisión crisp
 *   └──────────────┘
 *          │
 *          ▼
 *   FuzzyDecision
 * 
 * @module core/intelligence/think/FuzzyDecisionMaker
 * @wave 667
 */

import type { SectionType } from '@/engine/types'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS: CONJUNTOS DIFUSOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Conjunto difuso para valores numéricos genéricos (0-1)
 * Representa el "grado de pertenencia" a cada categoría
 */
export interface FuzzySet {
  /** Grado de pertenencia a "bajo" (0-1) */
  low: number
  /** Grado de pertenencia a "medio" (0-1) */
  medium: number
  /** Grado de pertenencia a "alto" (0-1) */
  high: number
}

/**
 * Conjunto difuso para Z-Scores
 * Categorías especiales para anomalías estadísticas
 */
export interface ZScoreFuzzySet {
  /** |z| < 1.5 - Dentro de lo normal */
  normal: number
  /** 1.5 <= |z| < 2.5 - Algo está pasando */
  notable: number
  /** |z| >= 2.5 - Momento épico/anomalía */
  epic: number
}

/**
 * Conjunto difuso para secciones musicales
 * Agrupa secciones por "energía narrativa"
 */
export interface SectionFuzzySet {
  /** intro, outro, breakdown - Zonas tranquilas */
  quiet: number
  /** verse, pre_chorus, buildup - Construyendo tensión */
  building: number
  /** chorus, drop - Climax */
  peak: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS: INPUTS Y OUTPUTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inputs ya fuzzificados listos para el motor de reglas
 */
export interface FuzzyInputs {
  /** Energía fuzzificada */
  energy: FuzzySet
  /** Z-Score fuzzificado */
  zScore: ZScoreFuzzySet
  /** Sección fuzzificada */
  section: SectionFuzzySet
  /** Harshness (dureza espectral) fuzzificada */
  harshness: FuzzySet
  /** Hunt score crisp (0-1) - No se fuzzifica, ya es un score */
  huntScore: number
  /** Belleza crisp (0-1) - No se fuzzifica */
  beauty: number
}

/**
 * Outputs del motor de reglas (antes de defuzzificar)
 */
export interface FuzzyOutputs {
  /** Grado de activación de FORCE_STRIKE */
  forceStrike: number
  /** Grado de activación de STRIKE */
  strike: number
  /** Grado de activación de PREPARE */
  prepare: number
  /** Grado de activación de HOLD */
  hold: number
}

/**
 * Decisión final defuzzificada
 */
export interface FuzzyDecision {
  /** Acción elegida */
  action: 'force_strike' | 'strike' | 'prepare' | 'hold'
  /** Intensidad de la acción (0-1) */
  intensity: number
  /** Confianza en la decisión (0-1) */
  confidence: number
  /** Razonamiento humano-legible */
  reasoning: string
  /** Scores difusos crudos (para debug) */
  fuzzyScores: FuzzyOutputs
  /** Regla dominante que disparó */
  dominantRule: string
}

/**
 * Inputs crisp para el evaluador
 */
export interface FuzzyEvaluatorInput {
  /** Energía raw (0-1) */
  energy: number
  /** Z-Score de energía (típicamente -4 a +4) */
  zScore: number
  /** Tipo de sección actual */
  sectionType: SectionType
  /** Harshness espectral (0-1) */
  harshness: number
  /** Score del HuntEngine (0-1) */
  huntScore: number
  /** Score de belleza (0-1) */
  beauty: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS: REGLAS DIFUSAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Una regla difusa: IF antecedente THEN consecuente
 */
interface FuzzyRule {
  /** Nombre descriptivo de la regla */
  name: string
  /** Función que evalúa el antecedente y retorna grado de activación (0-1) */
  antecedent: (inputs: FuzzyInputs) => number
  /** Output que activa esta regla */
  consequent: keyof FuzzyOutputs
  /** Peso de la regla (0-1) */
  weight: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES: PARÁMETROS DE MEMBERSHIP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parámetros para las funciones de membresía
 * Estos definen los "bordes" de cada categoría fuzzy
 */
const MEMBERSHIP_PARAMS = {
  // Energy (0-1 input)
  energy: {
    low: { center: 0.0, spread: 0.35 },      // Pico en 0, cae hasta 0.35
    medium: { center: 0.5, spread: 0.30 },   // Pico en 0.5, ±0.30
    high: { center: 1.0, spread: 0.35 },     // Pico en 1, desde 0.65
  },
  
  // Z-Score (típicamente -4 a +4)
  zScore: {
    normal: { threshold: 1.5 },              // |z| < 1.5
    notable: { low: 1.5, high: 2.5 },        // 1.5 <= |z| < 2.5
    epic: { threshold: 2.5 },                // |z| >= 2.5
  },
  
  // Harshness (0-1 input)
  harshness: {
    low: { center: 0.0, spread: 0.35 },
    medium: { center: 0.5, spread: 0.30 },
    high: { center: 1.0, spread: 0.35 },
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERSHIP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Función de membresía triangular
 * Retorna 1 en el centro, decae linealmente hacia los lados
 */
function triangularMembership(value: number, center: number, spread: number): number {
  const distance = Math.abs(value - center)
  if (distance >= spread) return 0
  return 1 - (distance / spread)
}

/**
 * Función de membresía trapezoidal izquierda
 * Retorna 1 hasta cierto punto, luego decae
 */
function leftTrapezoid(value: number, edge: number, spread: number): number {
  if (value <= edge - spread) return 1
  if (value >= edge) return 0
  return (edge - value) / spread
}

/**
 * Función de membresía trapezoidal derecha
 * Crece hasta cierto punto, luego 1
 */
function rightTrapezoid(value: number, edge: number, spread: number): number {
  if (value >= edge + spread) return 1
  if (value <= edge) return 0
  return (value - edge) / spread
}

// ═══════════════════════════════════════════════════════════════════════════
// FUZZIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔮 FUZZIFICAR: Convierte valores crisp a conjuntos difusos
 * 
 * @param input - Valores crisp (números reales)
 * @returns Conjuntos difusos con grados de membresía
 */
function fuzzify(input: FuzzyEvaluatorInput): FuzzyInputs {
  // === ENERGY ===
  const energy: FuzzySet = {
    low: leftTrapezoid(input.energy, 0.3, 0.3),
    medium: triangularMembership(input.energy, 0.5, 0.35),
    high: rightTrapezoid(input.energy, 0.65, 0.35),
  }
  
  // === Z-SCORE ===
  const absZ = Math.abs(input.zScore)
  const zScore: ZScoreFuzzySet = {
    normal: absZ < 1.5 ? 1 - (absZ / 1.5) * 0.5 : Math.max(0, 1 - (absZ - 1.0)),
    notable: absZ < 1.5 ? absZ / 2.5 : absZ >= 2.5 ? Math.max(0, 1 - (absZ - 2.5) / 1.0) : 1,
    epic: absZ < 2.5 ? Math.max(0, (absZ - 1.5) / 1.0) : Math.min(1, 0.5 + (absZ - 2.5) * 0.25),
  }
  
  // === SECTION ===
  const section = fuzzifySection(input.sectionType)
  
  // === HARSHNESS ===
  const harshness: FuzzySet = {
    low: leftTrapezoid(input.harshness, 0.3, 0.3),
    medium: triangularMembership(input.harshness, 0.5, 0.35),
    high: rightTrapezoid(input.harshness, 0.65, 0.35),
  }
  
  return {
    energy,
    zScore,
    section,
    harshness,
    huntScore: input.huntScore,
    beauty: input.beauty,
  }
}

/**
 * Fuzzifica el tipo de sección en quiet/building/peak
 */
function fuzzifySection(sectionType: SectionType): SectionFuzzySet {
  // Mappeo de secciones a energía narrativa
  const sectionProfiles: Record<SectionType, SectionFuzzySet> = {
    'intro':     { quiet: 1.0, building: 0.2, peak: 0.0 },
    'verse':     { quiet: 0.3, building: 0.7, peak: 0.1 },
    'chorus':    { quiet: 0.0, building: 0.2, peak: 1.0 },
    'bridge':    { quiet: 0.4, building: 0.6, peak: 0.2 },
    'buildup':   { quiet: 0.0, building: 1.0, peak: 0.3 },
    'drop':      { quiet: 0.0, building: 0.0, peak: 1.0 },
    'breakdown': { quiet: 0.8, building: 0.2, peak: 0.0 },
    'outro':     { quiet: 1.0, building: 0.1, peak: 0.0 },
  }
  
  return sectionProfiles[sectionType] ?? { quiet: 0.5, building: 0.3, peak: 0.2 }
}

// ═══════════════════════════════════════════════════════════════════════════
// REGLAS DIFUSAS - EL CÓDIGO DE CONDUCTA DE SELENE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📜 LAS REGLAS DE LA CONSCIENCIA
 * 
 * Cada regla es un IF-THEN difuso:
 * - El antecedente calcula el grado de activación (0-1)
 * - El consecuente indica qué output se activa
 * - El weight indica la importancia de la regla
 * 
 * Operadores:
 * - AND = Math.min (el más restrictivo gana)
 * - OR = Math.max (el más permisivo gana)
 */
const FUZZY_RULES: FuzzyRule[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // FORCE STRIKE - Condición Divina (máxima prioridad)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Divine_Drop',
    antecedent: (i) => Math.min(i.energy.high, i.zScore.epic, i.section.peak),
    consequent: 'forceStrike',
    weight: 1.0,
  },
  {
    name: 'Epic_Peak',
    antecedent: (i) => Math.min(i.zScore.epic, i.section.peak) * 0.9,
    consequent: 'forceStrike',
    weight: 0.95,
  },
  {
    name: 'Epic_Hunt',
    antecedent: (i) => i.zScore.epic * i.huntScore * i.energy.high,
    consequent: 'forceStrike',
    weight: 0.90,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // STRIKE - Momento óptimo para actuar
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Hunt_Strike',
    antecedent: (i) => Math.min(i.energy.high, i.huntScore, i.section.peak),
    consequent: 'strike',
    weight: 0.85,
  },
  {
    name: 'Harsh_Climax',
    antecedent: (i) => Math.min(i.energy.high, i.harshness.high, i.section.peak),
    consequent: 'strike',
    weight: 0.80,
  },
  {
    name: 'Notable_Peak',
    antecedent: (i) => Math.min(i.zScore.notable, i.section.peak),
    consequent: 'strike',
    weight: 0.75,
  },
  {
    name: 'High_Energy_Hunt',
    antecedent: (i) => i.energy.high * i.huntScore * 0.9,
    consequent: 'strike',
    weight: 0.70,
  },
  {
    name: 'Beautiful_Peak',
    antecedent: (i) => Math.min(i.section.peak, i.beauty * 0.8),
    consequent: 'strike',
    weight: 0.65,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // PREPARE - Anticipación, algo viene
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Building_Tension',
    antecedent: (i) => Math.min(i.energy.medium, i.section.building),
    consequent: 'prepare',
    weight: 0.60,
  },
  {
    name: 'Notable_Building',
    antecedent: (i) => Math.min(i.zScore.notable, i.section.building),
    consequent: 'prepare',
    weight: 0.55,
  },
  {
    name: 'Harshness_Rising',
    antecedent: (i) => Math.min(i.harshness.high, i.section.building),
    consequent: 'prepare',
    weight: 0.50,
  },
  {
    name: 'Energy_Rising',
    antecedent: (i) => i.energy.medium * (1 - i.section.quiet) * 0.7,
    consequent: 'prepare',
    weight: 0.45,
  },
  {
    name: 'Hunt_Preparing',
    antecedent: (i) => i.huntScore * i.section.building * 0.8,
    consequent: 'prepare',
    weight: 0.50,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // HOLD - Mantener estado, no hacer nada
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Quiet_Section',
    antecedent: (i) => Math.min(i.energy.low, i.section.quiet),
    consequent: 'hold',
    weight: 1.0,
  },
  {
    name: 'Normal_State',
    antecedent: (i) => i.zScore.normal * (1 - i.huntScore) * i.section.quiet,
    consequent: 'hold',
    weight: 0.85,
  },
  {
    name: 'Low_Energy',
    antecedent: (i) => i.energy.low * (1 - i.section.peak),
    consequent: 'hold',
    weight: 0.70,
  },
  {
    name: 'No_Hunt_Interest',
    antecedent: (i) => (1 - i.huntScore) * i.energy.low,
    consequent: 'hold',
    weight: 0.60,
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE INFERENCIA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 EVALUAR REGLAS: Ejecuta todas las reglas y agrega activaciones
 * 
 * Usa método de agregación MAX-MIN (Mamdani):
 * - Cada regla produce un grado de activación
 * - Se multiplica por el peso de la regla
 * - Para cada output, se toma el MAX de todas las reglas que lo activan
 */
function evaluateRules(fuzzyInputs: FuzzyInputs): { 
  outputs: FuzzyOutputs
  activations: Array<{ rule: string; activation: number; output: keyof FuzzyOutputs }>
} {
  // Inicializar outputs
  const outputs: FuzzyOutputs = {
    forceStrike: 0,
    strike: 0,
    prepare: 0,
    hold: 0,
  }
  
  // Tracking de activaciones para debug
  const activations: Array<{ rule: string; activation: number; output: keyof FuzzyOutputs }> = []
  
  // Evaluar cada regla
  for (const rule of FUZZY_RULES) {
    // Calcular grado de activación del antecedente
    const rawActivation = rule.antecedent(fuzzyInputs)
    
    // Aplicar peso
    const weightedActivation = rawActivation * rule.weight
    
    // Clamp a [0, 1]
    const activation = Math.max(0, Math.min(1, weightedActivation))
    
    // Registrar si hay activación significativa
    if (activation > 0.01) {
      activations.push({
        rule: rule.name,
        activation,
        output: rule.consequent,
      })
    }
    
    // Agregación MAX: el máximo de todas las reglas para este output
    outputs[rule.consequent] = Math.max(outputs[rule.consequent], activation)
  }
  
  // Ordenar activaciones por fuerza (para debug)
  activations.sort((a, b) => b.activation - a.activation)
  
  return { outputs, activations }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFUZZIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 DEFUZZIFICAR: Convierte outputs difusos a decisión crisp
 * 
 * Usa método de "Centro de Área" simplificado:
 * - Cada output tiene un "centro" predefinido
 * - La decisión final es el promedio ponderado
 * 
 * Pero primero aplicamos prioridades:
 * 1. forceStrike > 0.5 → FORCE_STRIKE
 * 2. strike > hold + 0.1 → STRIKE
 * 3. prepare > hold → PREPARE
 * 4. default → HOLD
 */
function defuzzify(
  outputs: FuzzyOutputs,
  activations: Array<{ rule: string; activation: number; output: keyof FuzzyOutputs }>
): FuzzyDecision {
  // Determinar acción por prioridad
  let action: FuzzyDecision['action']
  let dominantRule = 'None'
  
  // Prioridad 1: Force Strike (override divino)
  if (outputs.forceStrike > 0.5) {
    action = 'force_strike'
    dominantRule = activations.find(a => a.output === 'forceStrike')?.rule ?? 'Divine_Override'
  }
  // Prioridad 2: Strike supera Hold significativamente
  else if (outputs.strike > outputs.hold + 0.15 && outputs.strike > 0.3) {
    action = 'strike'
    dominantRule = activations.find(a => a.output === 'strike')?.rule ?? 'Strike_Rule'
  }
  // Prioridad 3: Prepare supera Hold
  else if (outputs.prepare > outputs.hold && outputs.prepare > 0.25) {
    action = 'prepare'
    dominantRule = activations.find(a => a.output === 'prepare')?.rule ?? 'Prepare_Rule'
  }
  // Default: Hold
  else {
    action = 'hold'
    dominantRule = activations.find(a => a.output === 'hold')?.rule ?? 'Default_Hold'
  }
  
  // Calcular intensidad basada en la fuerza de la decisión
  const intensity = calculateIntensity(action, outputs)
  
  // Calcular confianza basada en la claridad de la decisión
  const confidence = calculateConfidence(outputs)
  
  // Generar razonamiento
  const reasoning = generateReasoning(action, dominantRule, outputs, activations)
  
  return {
    action,
    intensity,
    confidence,
    reasoning,
    fuzzyScores: outputs,
    dominantRule,
  }
}

/**
 * Calcula la intensidad basada en la acción y sus scores
 */
function calculateIntensity(action: FuzzyDecision['action'], outputs: FuzzyOutputs): number {
  switch (action) {
    case 'force_strike':
      // Force strike siempre es intenso: 0.85-1.0
      return 0.85 + outputs.forceStrike * 0.15
    case 'strike':
      // Strike: 0.6-0.95 basado en su score
      return 0.6 + outputs.strike * 0.35
    case 'prepare':
      // Prepare: 0.3-0.6 basado en su score
      return 0.3 + outputs.prepare * 0.3
    case 'hold':
    default:
      // Hold: 0.0-0.3
      return outputs.hold * 0.3
  }
}

/**
 * Calcula la confianza basada en qué tan "clara" es la decisión
 * Alta confianza = un output domina claramente sobre los demás
 */
function calculateConfidence(outputs: FuzzyOutputs): number {
  const values = [outputs.forceStrike, outputs.strike, outputs.prepare, outputs.hold]
  const max = Math.max(...values)
  const secondMax = values.filter(v => v !== max).reduce((a, b) => Math.max(a, b), 0)
  
  // Gap entre el primero y el segundo
  const gap = max - secondMax
  
  // Confianza = promedio del valor máximo y el gap
  return (max + gap) / 2
}

/**
 * Genera razonamiento humano-legible
 */
function generateReasoning(
  action: FuzzyDecision['action'],
  dominantRule: string,
  outputs: FuzzyOutputs,
  activations: Array<{ rule: string; activation: number }>
): string {
  const topRules = activations.slice(0, 3).map(a => `${a.rule}(${a.activation.toFixed(2)})`).join(', ')
  
  const actionLabels: Record<FuzzyDecision['action'], string> = {
    force_strike: '⚡ FORCE_STRIKE',
    strike: '🎯 STRIKE',
    prepare: '🔮 PREPARE',
    hold: '😴 HOLD',
  }
  
  return `${actionLabels[action]} via [${dominantRule}] | ` +
         `Scores: F=${outputs.forceStrike.toFixed(2)} S=${outputs.strike.toFixed(2)} ` +
         `P=${outputs.prepare.toFixed(2)} H=${outputs.hold.toFixed(2)} | ` +
         `Top: ${topRules}`
}

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎸 EVALUAR: El método principal del FuzzyDecisionMaker
 * 
 * @param input - Valores crisp del estado actual
 * @returns Decisión fuzzy con acción, intensidad, confianza y razonamiento
 * 
 * @example
 * ```ts
 * const decision = fuzzyEvaluate({
 *   energy: 0.85,
 *   zScore: 3.2,
 *   sectionType: 'drop',
 *   harshness: 0.7,
 *   huntScore: 0.9,
 *   beauty: 0.6,
 * })
 * // → { action: 'force_strike', intensity: 0.95, confidence: 0.88, ... }
 * ```
 */
export function fuzzyEvaluate(input: FuzzyEvaluatorInput): FuzzyDecision {
  // STEP 1: Fuzzificar inputs
  const fuzzyInputs = fuzzify(input)
  
  // STEP 2: Evaluar reglas
  const { outputs, activations } = evaluateRules(fuzzyInputs)
  
  // STEP 3: Defuzzificar
  const decision = defuzzify(outputs, activations)
  
  return decision
}

/**
 * 🔬 DEBUG: Exponer fuzzificación para inspección
 */
export function debugFuzzify(input: FuzzyEvaluatorInput): FuzzyInputs {
  return fuzzify(input)
}

/**
 * 📜 Obtener todas las reglas (para debug/documentación)
 */
export function getFuzzyRules(): Array<{ name: string; output: string; weight: number }> {
  return FUZZY_RULES.map(r => ({
    name: r.name,
    output: r.consequent,
    weight: r.weight,
  }))
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER (Opcional - para quienes prefieren OOP)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧬 FuzzyDecisionMaker Class
 * Wrapper OOP sobre las funciones puras
 */
export class FuzzyDecisionMaker {
  private lastDecision: FuzzyDecision | null = null
  private frameCount = 0
  private readonly LOG_INTERVAL = 60 // Log cada 60 frames (~1 segundo)
  
  /**
   * Evalúa el estado actual y retorna una decisión fuzzy
   */
  evaluate(input: FuzzyEvaluatorInput): FuzzyDecision {
    const decision = fuzzyEvaluate(input)
    this.lastDecision = decision
    this.frameCount++
    
    // Debug log periódico
    if (this.frameCount % this.LOG_INTERVAL === 0) {
      this.logDecision(input, decision)
    }
    
    return decision
  }
  
  /**
   * Obtiene la última decisión tomada
   */
  getLastDecision(): FuzzyDecision | null {
    return this.lastDecision
  }
  
  /**
   * Log de debug formateado
   */
  private logDecision(input: FuzzyEvaluatorInput, decision: FuzzyDecision): void {
    const emoji = {
      force_strike: '⚡',
      strike: '🎯',
      prepare: '🔮',
      hold: '😴',
    }[decision.action]
    
    console.log(
      `[FUZZY ${emoji}] ${decision.action.toUpperCase()} ` +
      `| E=${input.energy.toFixed(2)} Z=${input.zScore.toFixed(1)}σ ` +
      `| Conf=${decision.confidence.toFixed(2)} Int=${decision.intensity.toFixed(2)} ` +
      `| ${decision.dominantRule}`
    )
  }
  
  /**
   * Reset del estado (para cambio de canción)
   */
  reset(): void {
    this.lastDecision = null
    this.frameCount = 0
  }
}
